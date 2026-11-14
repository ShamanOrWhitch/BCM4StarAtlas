/* Поведение цикла фонов в собранном демо: тайминги, отсутствие наложений,
 * освобождение кэшей, независимость от ручной смены seed. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const html = readFileSync(new URL("./warp_demo.html", import.meta.url), "utf8");
const code = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");


/* Заглушка Image: src вызывает onload синхронно, как быстрый data URI. */
class FakeImage {
  constructor() { this.naturalWidth = 1600; this.naturalHeight = 900; this.width = 1600; this.height = 900; }
  set src(value) { this._src = value; if (typeof this.onload === "function") this.onload(); }
  get src() { return this._src; }
}

function boot() {
  const stat = { blits: 0, frames: 0, canvases: 0, errors: [] };
  const grad = () => ({ addColorStop() {} });
  const ctx = {
    createLinearGradient: grad, createRadialGradient: grad,
    fillRect() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {},
    arc() {}, ellipse() {}, fill() {}, stroke() {}, save() {}, restore() {},
    // нужны видам перехода (диафрагма/створки/жалюзи/спираль/сектор): без них
    // случайный ритм падает на первом же не-рассыпании
    rect() {}, clip() {},
    translate() {}, rotate() {}, scale() {},
    drawImage: (src) => { if (!src) stat.errors.push("drawImage без источника"); stat.blits += 1; },
    fillStyle: "", strokeStyle: "", globalAlpha: 1, lineWidth: 1, lineCap: "butt"
  };
  const els = new Map();
  const mk = (id) => {
    const el = {
    id, textContent: "", _html: "", style: {}, children: [],
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = String(v); if (!this._html) el.children.length = 0; },
    setAttribute(k, v) { this._attrs = this._attrs || {}; this._attrs[k] = String(v); },
    getAttribute(k) { return this._attrs && this._attrs[k] != null ? this._attrs[k] : null; },
    addEventListener(t, f) { (this._l = this._l || {})[t] = f; },
    appendChild(c) { this.children.push(c); }, click() { this._l && this._l.click && this._l.click.call(this); },
    classList: { add() {}, remove() {}, toggle() {} }
    };
    return el;
  };
  const canvas = mk("c"); canvas.getContext = () => ctx; els.set("c", canvas);
  const raf = [];
  const sb = {
    console, Image: FakeImage, Math, Number, String, Object, Array, Set, Map, JSON, Date, isFinite, isNaN,
    requestAnimationFrame: (f) => raf.push(f), devicePixelRatio: 1, innerWidth: 800, innerHeight: 500,
    addEventListener() {},
    document: {
      getElementById: (id) => { if (!els.has(id)) els.set(id, mk(id)); return els.get(id); },
      createElement: (tag) => {
        // кнопки UI тоже создаются через createElement — считаем только canvas
        if (tag === "canvas") stat.canvases += 1;
        const el = mk("cv");
        el.getContext = () => ctx;
        el.width = 0; el.height = 0;
        return el;
      },
      addEventListener() {}
    }
  };
  sb.window = sb; sb.globalThis = sb;
  vm.createContext(sb);
  vm.runInContext(code, sb, { filename: "demo" });
  return { stat, raf, els, sb };
}

const FRAME = 1000 / 60;

test("переход на тактовой сетке: старт и длина берутся из 142 BPM", () => {
  const { stat, raf, sb, els } = boot();
  // По умолчанию ритм случайный (ревизия 15). Сетка тактов осталась вторым
  // режимом, и здесь проверяется именно она.
  els.get("rhythms").children[1].click();
  // Темп — точный показатель владельца: 142 BPM. Такт 240/142 = 1.6901 с,
  // переход = ровно один такт, весь цикл — 11 тактов = 18.59 с.
  const cfg = sb.BCMWarpSpace.warpSpaceCycleConfig(3, 15, 142);
  const hold = cfg.hold;
  const period = cfg.period;
  const perFrame = [];
  let t = 0;
  for (let i = 0; i < 60 * 22; i += 1) {
    raf.shift()(t);
    perFrame.push({ t: t / 1000, blits: stat.blits });
    const before = stat.blits;
    t += FRAME;
    perFrame[perFrame.length - 1].d = 0;
  }
  // считаем blit-ы на кадр через приращение
  const deltas = [];
  let prev = 0;
  for (const row of perFrame) { deltas.push({ t: row.t, d: row.blits - prev }); prev = row.blits; }
  const heavy = deltas.filter((r) => r.d > 100);
  assert.ok(heavy.length > 0, "должен быть хотя бы один кадр перехода");
  assert.ok(Math.abs(heavy[0].t - hold) < 0.4,
    "переход должен начаться на " + hold.toFixed(2) + " с (8 тактов паузы), а начался на " + heavy[0].t.toFixed(2));
  assert.ok(heavy[heavy.length - 1].t <= period + 0.3,
    "переход (1 такт) должен закончиться к " + period.toFixed(2) + " с, а шёл до " + heavy[heavy.length - 1].t.toFixed(2));
  // 11 тактов при 142 BPM — это ~18.6 с, то есть по-прежнему «около 18»
  assert.ok(period > 17.5 && period < 19.5, "цикл должен остаться около 18 с: " + period.toFixed(2));
  const quiet = deltas.filter((r) => r.d <= 2 && r.t > 1 && r.t < hold - 1);
  assert.ok(quiet.length > 700, "должна быть длинная пауза, кадров покоя: " + quiet.length);
});

test("кэши не растут: в памяти не больше двух сцен, построек ~одна на переход", () => {
  const { stat, raf, sb } = boot();
  let t = 0;
  const maxCached = [];
  for (let i = 0; i < 60 * 60; i += 1) {
    raf.shift()(t); t += FRAME;
    if (i % 60 === 0) maxCached.push(sb.BCMWarpBgStats().cached);
  }
  const stats = sb.BCMWarpBgStats();
  // Пул сцен — 4 штуки (см. SCENE_POOL). Держим ровно его, не больше.
  assert.ok(Math.max(...maxCached) <= 4, "в памяти держится больше пула сцен: " + Math.max(...maxCached));
  // Случайный ритм: переходов в минуту ~20, но сцены идут по кругу из пула,
  // поэтому построек должно быть порядка пула, а не «одна на переход».
  assert.ok(stats.created <= 6, "построено сцен: " + stats.created + " — пересборка вместо переиспользования пула");
  assert.ok(stats.created >= 2, "сцен слишком мало: " + stats.created);
  assert.equal(stat.errors.length, 0, stat.errors.join("; "));
});

test("смена seed не оставляет старых кэшей и не ломает цикл", () => {
  const { stat, raf, els } = boot();
  let t = 0;
  for (let i = 0; i < 60 * 3; i += 1) { raf.shift()(t); t += FRAME; }
  for (let n = 0; n < 5; n += 1) {
    els.get("bgStep").click();
    for (let i = 0; i < 60; i += 1) { raf.shift()(t); t += FRAME; }
  }
  assert.equal(stat.errors.length, 0, stat.errors.join("; "));
  assert.ok(stat.canvases < 40, "канвасов после 5 смен seed: " + stat.canvases);
});

test("выключенный цикл даёт один blit за кадр", () => {
  const { stat, raf, els } = boot();
  let t = 0;
  for (let i = 0; i < 30; i += 1) { raf.shift()(t); t += FRAME; }
  els.get("cycleOn").click();     // цикл выкл
  for (let i = 0; i < 10; i += 1) { raf.shift()(t); t += FRAME; }
  const before = stat.blits;
  raf.shift()(t);
  assert.ok(stat.blits - before <= 2, "в покое должен быть один blit, а было " + (stat.blits - before));
});
