/* Самый жёсткий тест: НЕ читаем текст, а ИСПОЛНЯЕМ пропатченный файл в
 * минимальном фейковом DOM и дёргаем каждый публичный хук.
 *
 * Зачем: ревизия 12 показала, что `node --check` и текстовые сверки не ловят
 * ни забытых экспортов, ни ReferenceError внутри хука — в браузере это
 * TypeError посреди кадра. Здесь такие ошибки падают сразу. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const code = readFileSync(new URL("./warp_patched.js", import.meta.url), "utf8");

/* Минимальный 2D-контекст: считает вызовы, не притворяется браузером. */
function makeCtx(log) {
  const grad = () => ({ addColorStop() {} });
  return new Proxy({}, {
    get(target, key) {
      if (key === "createLinearGradient" || key === "createRadialGradient") return grad;
      if (key === "canvas") return { width: 800, height: 500 };
      if (typeof key === "symbol") return undefined;
      return (...args) => { log.push([key, args.length]); };
    },
    set(target, key, value) {
      if (typeof value === "number" && !Number.isFinite(value)) {
        throw new Error("в контекст записан NaN/Infinity: " + String(key));
      }
      target[key] = value;
      return true;
    }
  });
}

function makeElement(tag, log) {
  const listeners = {};
  const el = {
    tagName: String(tag).toUpperCase(),
    hidden: false, disabled: false, textContent: "", innerHTML: "",
    children: [], dataset: {}, style: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    clientWidth: 800, clientHeight: 500, offsetWidth: 800, offsetHeight: 500,
    setAttribute() {}, removeAttribute() {}, getAttribute() { return null; },
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    removeEventListener() {},
    appendChild(child) { el.children.push(child); return child; },
    removeChild(child) {
      const i = el.children.indexOf(child); if (i >= 0) el.children.splice(i, 1); return child;
    },
    insertBefore(child) { el.children.push(child); return child; },
    querySelector() { return makeElement("canvas", log); },
    querySelectorAll() { return []; },
    closest() { return null; },
    focus() {}, blur() {}, click() { (listeners.click || []).forEach((fn) => fn({ preventDefault() {} })); },
    setPointerCapture() {}, releasePointerCapture() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 500, right: 800, bottom: 500 }; },
    getContext() { return makeCtx(log); },
    toDataURL() { return "data:image/png;base64,"; },
    _listeners: listeners
  };
  return el;
}

function boot() {
  const log = [];
  const raf = [];
  const body = makeElement("body", log);
  body.hidden = false;
  class FakeImage {
    constructor() { this.naturalWidth = 128; this.naturalHeight = 96; this.width = 128; this.height = 96; }
    set src(value) { this._src = value; if (typeof this.onload === "function") this.onload(); }
    get src() { return this._src; }
  }
  const document = {
    body,
    documentElement: body,
    hidden: false,
    currentScript: { src: "https://walkingyog.com/bcm4sa/mini-sim/assets/js/deep-space-warp.js" },
    readyState: "complete",
    getElementById(id) { return elById[id] || (elById[id] = makeElement("div", log)); },
    querySelector(sel) { return makeElement("div", log); },
    querySelectorAll() { return []; },
    createElement(tag) { return makeElement(tag, log); },
    createElementNS(ns, tag) { return makeElement(tag, log); },
    createTextNode(text) { return { textContent: text }; },
    addEventListener() {}, removeEventListener() {}
  };
  const elById = {};
  const sandbox = {
    console, document, Image: FakeImage,
    Math, Number, String, Object, Array, Set, Map, JSON, Date, Boolean, RegExp, Error,
    isFinite, isNaN, parseFloat, parseInt, Intl,
    requestAnimationFrame: (fn) => { raf.push(fn); return raf.length; },
    cancelAnimationFrame() {},
    setTimeout: (fn) => { return 1; }, clearTimeout() {},
    setInterval: () => 1, clearInterval() {},
    performance: { now: () => 0 },
    devicePixelRatio: 2,
    innerWidth: 1440, innerHeight: 900,
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    navigator: { hardwareConcurrency: 8, userAgent: "node" },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    Audio: function () { return { play: () => Promise.resolve(), pause() {}, addEventListener() {} }; },
    HTMLElement: function () {}, HTMLCanvasElement: function () {},
    addEventListener() {}, removeEventListener() {},
    location: { href: "https://walkingyog.com/bcm4sa/", search: "", hash: "" }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: "warp_patched.js" });
  return { sandbox, raf, log };
}

test("пропатченный файл исполняется без исключений в фейковом DOM", () => {
  assert.doesNotThrow(() => boot());
});

test("каждый публичный хук существует и не падает при вызове", () => {
  const { sandbox } = boot();
  const hooks = Object.keys(sandbox).filter((k) => /^BCMDeepSpaceWarp[A-Z]/.test(k));
  assert.ok(hooks.length >= 18, "хуков найдено: " + hooks.length);
  const called = [];
  hooks.forEach((name) => {
    const fn = sandbox[name];
    if (typeof fn !== "function") return;
    assert.doesNotThrow(() => {
      const out = fn("dissolve", 1);
      if (out !== undefined) JSON.stringify(out);
    }, "хук " + name + " упал");
    called.push(name);
  });
  assert.ok(called.includes("BCMDeepSpaceWarpSetTransition"));
  assert.ok(called.includes("BCMDeepSpaceWarpSetShipSprite"));
});

test("вид перехода переключается и отдаёт осмысленный id", () => {
  const { sandbox } = boot();
  // массив приходит из другого realm: копируем, иначе строгая сверка ругается на прототип
  const ids = Array.from(sandbox.BCMDeepSpaceWarpGetTransitions());
  assert.deepEqual(ids, ["dissolve", "iris", "doors", "blinds", "spiral", "sweep"]);
  ids.forEach((id) => {
    assert.equal(sandbox.BCMDeepSpaceWarpSetTransition(id), id);
    assert.equal(sandbox.BCMDeepSpaceWarpGetTransition(), id);
  });
  // неизвестный id ничего не ломает: остаётся прежний вид
  sandbox.BCMDeepSpaceWarpSetTransition("doors");
  assert.equal(sandbox.BCMDeepSpaceWarpSetTransition("нет-такого"), "doors");
  // auto отдаёт валидный id из списка
  assert.ok(ids.includes(sandbox.BCMDeepSpaceWarpSetTransition("auto")));
});

test("корабль: спрайт важнее силуэта, размер маленький и ограничен", () => {
  const { sandbox } = boot();
  const before = sandbox.BCMDeepSpaceWarpShipStats();
  assert.equal(before.sprite, false);
  assert.ok(before.size >= 22 && before.size <= 46, "размер корабля вне 22–46 px: " + before.size);
  assert.ok(before.engines >= 1);

  assert.equal(sandbox.BCMDeepSpaceWarpSetShipSprite("data:image/png;base64,AA"), true);
  assert.equal(sandbox.BCMDeepSpaceWarpShipStats().sprite, true);
  sandbox.BCMDeepSpaceWarpSetShipSprite(null);
  assert.equal(sandbox.BCMDeepSpaceWarpShipStats().sprite, false);

  const info = sandbox.BCMDeepSpaceWarpSetShip("fimbul-mamba", 1.2);
  assert.equal(info.spec, "fimbul-mamba");
  assert.equal(info.engines, 4);
  // кривой масштаб зажимается, а не превращается в 0
  assert.ok(sandbox.BCMDeepSpaceWarpSetShip(null, -5).size > 0);
});

test("случайный ритм: хуки работают и ритм реально даёт разные виды", () => {
  const { sandbox } = boot();
  assert.equal(sandbox.BCMDeepSpaceWarpGetRandomCycle(), true, "по умолчанию ритм случайный");
  assert.equal(sandbox.BCMDeepSpaceWarpSetRandomCycle(false), false);
  assert.equal(sandbox.BCMDeepSpaceWarpGetRandomCycle(), false);
  assert.equal(sandbox.BCMDeepSpaceWarpSetRandomCycle(true), true);

  // пауза: 2 с по умолчанию, мусор и крайности зажимаются
  assert.equal(sandbox.BCMDeepSpaceWarpSetBgHold(0.1), 0.6);
  assert.equal(sandbox.BCMDeepSpaceWarpSetBgHold(99), 8);
  assert.equal(sandbox.BCMDeepSpaceWarpSetBgHold(2), 2);
  assert.equal(sandbox.BCMDeepSpaceWarpSetBgHold("abc"), 2);

  // seed порядка: число, а не что попало
  const seed = sandbox.BCMDeepSpaceWarpSetBgSeed(-1);
  assert.ok(Number.isFinite(seed) && seed >= 0, "seed: " + seed);
  sandbox.BCMDeepSpaceWarpSetBgSeed(0x5F3A21C7);

  // статистика отдаёт режим ритма и последний вид
  const stats = sandbox.BCMDeepSpaceWarpBgStats();
  assert.equal(stats.random, true);
  assert.equal(stats.hold, 2);
  assert.equal(stats.pool, 4, "пул сцен должен быть виден в статистике");
  assert.deepEqual(Array.from(sandbox.BCMDeepSpaceWarpGetTransitions()).includes(stats.kind), true);
});
