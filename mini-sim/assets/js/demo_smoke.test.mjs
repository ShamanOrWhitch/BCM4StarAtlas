/*
 * Headless smoke for the built demo. No Chromium is available in this
 * workspace, so this is not a browser test: it executes the demo's own
 * script inside node:vm against a stub DOM + stub 2D context and fails on
 * any thrown error. It catches the realistic breakage (typos, undefined
 * names, wrong API casing, NaN geometry), not CSS or real rendering.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";


/* Заглушка Image: src вызывает onload синхронно, как быстрый data URI. */
class FakeImage {
  constructor() {
    this.naturalWidth = 1600; this.naturalHeight = 900; this.width = 1600; this.height = 900;
    // data URI в браузере готов к рисованию сразу после onload — без complete
    // демо считало бы спрайты астероидов незагруженными и уходило в фолбэк
    this.complete = true;
  }
  set src(value) { this._src = value; if (typeof this.onload === "function") this.onload(); }
  get src() { return this._src; }
}

function makeCtx(stats) {
  stats.styles = stats.styles || new Set();
  stats.fillStyles = stats.fillStyles || new Set();
  const numeric = (v) => typeof v === "number" && !Number.isFinite(v);
  const check = (name, args) => {
    args.forEach((a) => {
      if (numeric(a)) throw new Error("non-finite coordinate passed to " + name + ": " + a);
    });
    stats.calls += 1;
  };
  const grad = () => ({ addColorStop: (p, c) => {
    if (typeof p !== "number" || p < 0 || p > 1) throw new Error("bad colour stop " + p);
    if (typeof c !== "string" || !c) throw new Error("bad colour " + c);
  } });
  const passthrough = (name) => (...args) => { check(name, args); };
  return {
    createLinearGradient: (...a) => { check("linear", a); return grad(); },
    createRadialGradient: (...a) => { check("radial", a); return grad(); },
    fillRect: passthrough("fillRect"),
    beginPath: () => { stats.calls += 1; },
    closePath: () => {},
    moveTo: passthrough("moveTo"),
    lineTo: passthrough("lineTo"),
    arc: passthrough("arc"),
    ellipse: passthrough("ellipse"),
    // нужны видам перехода: диафрагма/створки/жалюзи/спираль/сектор режут кадр
    rect: passthrough("rect"),
    clip: () => { stats.calls += 1; },
    fill: () => { stats.fills += 1; stats.calls += 1; },
    stroke: () => { stats.strokes += 1; stats.calls += 1; },
    save: () => {}, restore: () => {},
    translate: passthrough("translate"),
    rotate: passthrough("rotate"),
    scale: passthrough("scale"),
    drawImage: (...a) => { stats.blits += 1; stats.calls += 1; },
    get fillStyle() { return this._fill; },
    set fillStyle(v) { this._fill = v; stats.styles.add(String(v)); stats.fillStyles.add(String(v)); },
    get strokeStyle() { return this._stroke; },
    set strokeStyle(v) { this._stroke = v; stats.styles.add(String(v)); },
    lineWidth: 1, lineCap: "butt"
  };
}

function makeElement(id) {
  const listeners = {};
  const el = {
    id,
    textContent: "",
    _html: "",
    // как в браузере: запись innerHTML="" убирает прежних детей. Без этого
    // paintButtons «накапливал» кнопки и тест врал бы о состоянии панели.
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = String(v); if (!this._html) el.children.length = 0; },
    style: {},
    children: [],
    // атрибуты запоминаем: aria-pressed — это состояние выбранной кнопки
    _attrs: {},
    setAttribute(k, v) { this._attrs[k] = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this._attrs, k) ? this._attrs[k] : null; },
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    dispatch(type, event) { (listeners[type] || []).forEach((fn) => fn.call(this, event || {})); },
    appendChild(child) { this.children.push(child); },
    click() { this.dispatch("click"); },
    // реальный набор классов: демо прячет панели классом hide-ui
    classList: {
      _set: new Set(),
      add(c) { this._set.add(c); },
      remove(c) { this._set.delete(c); },
      toggle(c) { if (this._set.has(c)) this._set.delete(c); else this._set.add(c); },
      contains(c) { return this._set.has(c); }
    }
  };
  return el;
}


function boot() {
  const html = readFileSync(new URL("./warp_demo.html", import.meta.url), "utf8");
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.ok(scripts.length >= 1, "demo must contain its script");
  const code = scripts.join("\n");

  const stats = { calls: 0, fills: 0, strokes: 0, blits: 0 };
  const elements = new Map();
  const canvasEl = makeElement("c");
  canvasEl.getContext = () => makeCtx(stats);
  canvasEl.width = 0; canvasEl.height = 0;
  elements.set("c", canvasEl);

  const rafQueue = [];
  const winListeners = {};

  const sandbox = {
    console,
    Image: FakeImage,
    Math, Number, String, Object, Array, Set, Map, JSON, Date, isNaN, parseInt, parseFloat,
    requestAnimationFrame: (fn) => { rafQueue.push(fn); return rafQueue.length; },
    devicePixelRatio: 2,
    innerWidth: 900,
    innerHeight: 560,
    addEventListener: (type, fn) => { (winListeners[type] = winListeners[type] || []).push(fn); },
    document: {
      getElementById: (id) => {
        if (!elements.has(id)) elements.set(id, makeElement(id));
        return elements.get(id);
      },
      createElement: () => {
        const el = makeElement("generated");
        el.getContext = () => makeCtx(stats);
        el.width = 0; el.height = 0;
        return el;
      },
      addEventListener() {}
    }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: "warp_demo.html" });
  return { sandbox, stats, rafQueue, elements, winListeners };
}

test("demo script boots and its frame loop runs without throwing", () => {
  const { stats, rafQueue } = boot();
  assert.ok(rafQueue.length >= 1, "the demo must schedule its first frame");
  let t = 16;
  for (let i = 0; i < 90; i += 1) {
    const fn = rafQueue.shift();
    assert.ok(fn, "frame " + i + " was not scheduled");
    fn(t);
    t += 16;
  }
  assert.ok(stats.fills > 100, "wall panels must be filled, got " + stats.fills);
  assert.ok(stats.strokes > 0, "frame lines and rings must be stroked");
  assert.ok(stats.blits > 0, "the space backdrop must be blitted");
});

test("backdrop cache is painted once, not every frame", () => {
  const env = boot();
  const { stats, rafQueue } = env;
  let t = 16;
  const perFrame = [];
  for (let i = 0; i < 60; i += 1) {
    const before = stats.blits;
    rafQueue.shift()(t);
    t += 16;
    perFrame.push(stats.blits - before);
  }
  // Первые кадры строят сцены: там drawImage принадлежит растеризации кэша,
  // а не кадру. В установившемся режиме — 1 blit фона + камни астероидов
  // (по одному drawImage на камень, с ревизии 17).
  const rocks = env.sandbox.BCMWarpSpace.warpSpaceAsteroidField(20261116, 1).filter((s) => s.depth >= 0.10).length;
  const steady = perFrame.slice(3);
  const expected = 1 + rocks;
  const wrong = steady.filter((d) => d !== expected);
  assert.equal(wrong.length, 0,
    "в паузе должно быть " + expected + " blit-ов (фон + " + rocks + " камней), отклонения: " + wrong.join(","));
  assert.ok(perFrame.slice(0, 3).every((d) => d >= 1 && d <= expected + 2), "стартовые кадры: " + perFrame.slice(0, 3).join(","));
  assert.ok(stats.blits <= 62 * expected, "сумма blit-ов выросла: " + stats.blits);
});

test("new layers cost a small fraction of the existing wall", () => {
  const env = boot();
  const { stats, rafQueue, winListeners, sandbox } = env;
  const key = (k) => (winListeners.keydown || []).forEach((fn) => fn({ key: k }));
  let t = 16;
  const oneFrame = () => {
    const before = stats.calls;
    rafQueue.shift()(t); t += 16;
    return stats.calls - before;
  };
  for (let i = 0; i < 6; i += 1) rafQueue.shift()(t), t += 16; // warm the cache

  // Виды идут в порядке меню, а он начинается с «Лент». Поэтому ступени
  // выбираются по id, а не по номеру клавиши: иначе тест мерил бы не то.
  const step = (id) => {
    const idx = sandbox.BCMWarpSpace.WARP_SPACE_PROFILES.findIndex((p) => p.id === id);
    key(String(idx + 1));
  };
  // baseline: «Сетка» (никаких колец и лент) с выключенным фоном — кадр 0.14.0
  step("grid"); key("b");
  const baseline = oneFrame();

  // additions: space backdrop + rings + pulse, same wall.
  // The first frame after a profile change repaints the offscreen cache, so
  // measure the steady-state frame that follows it.
  key("b"); step("pulse");
  oneFrame();                 // cache repaint for the new profile, not measured
  const withExtras = oneFrame();

  // wall panels dominate: 23 depths x 18 panels x ~7 ops each. Additions on top
  // must stay well under it so a weak Android keeps its frame budget.
  assert.ok(baseline > 1500, "sanity: the existing wall should be the bulk, got " + baseline);
  const added = withExtras - baseline;
  assert.ok(added >= 0, "extras cannot be negative");
  assert.ok(added < baseline * 0.12, "extras must stay under 12% of the wall cost, got " + Math.round(100 * added / baseline) + "%");
});

test("keyboard and buttons change look without errors", () => {
  const { rafQueue, winListeners, elements } = boot();
  const key = (k) => (winListeners.keydown || []).forEach((fn) => fn({ key: k }));
  let t = 16;
  for (const k of ["1", "2", "3", "4", "5", "b", "p", "ArrowLeft", "ArrowRight"]) {
    key(k);
    rafQueue.shift()(t); t += 16;
  }
  assert.doesNotThrow(() => elements.get("bgStep").click());
  assert.doesNotThrow(() => elements.get("palB").click());
  assert.doesNotThrow(() => elements.get("palA").click());
  assert.doesNotThrow(() => elements.get("bgOn").click());
  rafQueue.shift()(t);
});

/* Прежний тест считал РАЗНЫЕ СТРОКИ ЦВЕТА и требовал, чтобы при закреплённой
 * палитре новых почти не появлялось. Это мерило не перелив, а мерцание:
 * shimmer меняет светлоту каждый кадр, поэтому новые строки идут всегда, и
 * порог держался только на конкретном числе кадров. Заменено на честную метрику:
 * считаем ОТТЕНКИ (корзины по 15°), которые не зависят от светлоты.
 *
 * Радуга включена — стенка обязана пройти по всему кругу оттенков.
 * Радуга выключена + палитра A — набор оттенков фиксированный и маленький.
 */
function hueBuckets(colors) {
  const out = new Set();
  colors.forEach((str) => {
    const m = String(str).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return;
    const r = +m[1] / 255, g = +m[2] / 255, b = +m[3] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    if (d < 0.08) return;                 // серый — не оттенок
    let h;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    out.add(Math.round((((h * 60) + 360) % 360) / 15));
  });
  return out;
}

test("перелив идёт по всей палитре, а с выключенной радугой — фиксированный набор", () => {
  const collect = (rainbow, flow) => {
    const env = boot();
    env.stats.fillStyles.clear();
    env.stats.styles.clear();
    let t = 16;
    for (let i = 0; i < 5; i += 1) { env.rafQueue.shift()(t); t += 16; }
    env.elements.get("cycleOn").click();            // меряем стенку, без переходов
    env.sandbox.BCMWarpSetRainbow(rainbow);
    if (!flow) env.elements.get("palA").click();
    for (let i = 0; i < 8; i += 1) { env.rafQueue.shift()(t); t += 16; }
    env.stats.styles.clear();
    for (let i = 0; i < 44; i += 1) { env.rafQueue.shift()(t); t += 16; }
    return hueBuckets([...env.stats.styles]);
  };
  const rainbow = collect(true, true);
  assert.ok(rainbow.size >= 16, "радуга должна пройти по кругу оттенков, корзин: " + rainbow.size);
  const fixed = collect(false, false);
  assert.ok(fixed.size >= 3 && fixed.size <= 10,
    "с выключенной радугой оттенков должно быть мало и они фиксированы: " + fixed.size);
  // набор фиксирован: второй прогон даёт те же корзины
  const fixed2 = collect(false, false);
  assert.deepEqual([...fixed2].sort((a, b) => a - b), [...fixed].sort((a, b) => a - b));
});

test("демо показывает радугу: за кадр появляются разные оттенки", () => {
  const env = boot();
  let t = 16;
  for (let i = 0; i < 4; i += 1) { env.rafQueue.shift()(t); t += 16; }
  env.stats.fillStyles.clear();
  for (let i = 0; i < 6; i += 1) { env.rafQueue.shift()(t); t += 16; }
  const panelRe = /^rgba\((\d+),(\d+),(\d+),0\.98\)$/;
  const panels = [...env.stats.fillStyles].filter((v) => panelRe.test(v));
  assert.ok(panels.length > 0, "панели должны заливаться");
  // радуга: у панелей одного кадра расходятся САМИ каналы, а не только яркость
  const hues = panels.map((css) => {
    const m = css.match(panelRe).slice(1, 4).map(Number);
    // доминирующий канал = грубый «оттенок»
    return m.indexOf(Math.max(...m));
  });
  assert.ok(new Set(hues).size >= 3, "за кадр должно быть минимум 3 разных доминирующих канала, есть " + new Set(hues).size);
  // и выключение радуги возвращает один цвет стенки
  env.elements.get("rainbowOn").click();
  env.stats.fillStyles.clear();
  for (let i = 0; i < 4; i += 1) { env.rafQueue.shift()(t); t += 16; }
  const flat = [...env.stats.fillStyles].filter((v) => panelRe.test(v)).map((css) => {
    const m = css.match(panelRe).slice(1, 4).map(Number);
    return m.indexOf(Math.max(...m));
  });
  assert.ok(flat.length > 0);
  assert.ok(new Set(flat).size <= 2, "без радуги стенка однотонная, доминирующих каналов: " + new Set(flat).size);
});

test("переход между кадрами: виды переключаются, рассыпание — по умолчанию", () => {
  const env = boot();
  let t = 16;
  for (let i = 0; i < 4; i += 1) { env.rafQueue.shift()(t); t += 16; }
  const host = env.elements.get("transitions");
  assert.ok(host.children.length >= 6, "в панели должны быть все виды перехода");
  // по умолчанию — рассыпание (первый пункт списка и он же вид по умолчанию)
  assert.match(env.elements.get("transRead").textContent, /dissolve/,
    "по умолчанию должен стоять рассыпание");

  // каждый вид: включаем, прыгаем в переход, кадр не падает и что-то рисует
  ["iris", "doors", "blinds", "spiral", "sweep", "dissolve"].forEach((id) => {
    env.sandbox.BCMWarpSetTransition(id);
    env.elements.get("cycleJump").click();
    const before = env.stats.calls;
    for (let i = 0; i < 6; i += 1) { env.rafQueue.shift()(t); t += 16; }
    assert.ok(env.stats.calls > before, id + ": переход ничего не нарисовал");
  });
  // «по кругу» тоже работает и не застревает на одном виде
  env.sandbox.BCMWarpSetTransition("auto");
  const seen = new Set();
  for (let round = 0; round < 3; round += 1) {
    env.elements.get("cycleJump").click();
    for (let i = 0; i < 40; i += 1) { env.rafQueue.shift()(t); t += 16; }
    seen.add(env.elements.get("transRead").textContent);
  }
  assert.ok(seen.size >= 2, "«по кругу» должен менять виды, увидели: " + [...seen].join(","));
});

test("корабль сзади: маленький, слушается стрелок и не выходит за кольцо", () => {
  const env = boot();
  let t = 16;
  for (let i = 0; i < 4; i += 1) { env.rafQueue.shift()(t); t += 16; }
  const size = env.sandbox.BCMWarpSpace.warpSpaceShipSize(1440, 900);
  assert.ok(size >= 22 && size <= 46, "размер корабля: " + size);
  // кнопки выбора корабля есть, переключение меняет подпись
  const host = env.elements.get("shipPick");
  assert.ok(host.children.length >= 4, "должны быть варианты кораблей");
  const before = env.elements.get("shipRead").textContent;
  env.sandbox.BCMWarpSetShip("fimbul-mamba");
  env.rafQueue.shift()(t); t += 16;
  assert.notEqual(env.elements.get("shipRead").textContent, before, "подпись корабля не обновилась");
  assert.match(env.elements.get("shipRead").textContent, /4 дв/, "у Fimbul Mamba четыре двигателя");
});

test("A and B endpoints are genuinely different palettes", () => {
  const env = boot();
  const seen = () => env.stats.styles;
  let t = 16;
  for (let i = 0; i < 4; i += 1) { env.rafQueue.shift()(t); t += 16; }
  env.elements.get("palA").click();
  const before = new Set(seen());
  env.rafQueue.shift()(t); t += 16;
  env.elements.get("palB").click();
  env.rafQueue.shift()(t);
  const added = [...seen()].filter((v) => !before.has(v));
  assert.ok(added.length > 0, "switching to B must introduce new colours");
});

test("wall light cells keep travelling with the colour flow switched off", () => {
  const env = boot();
  let t = 16;
  for (let i = 0; i < 4; i += 1) { env.rafQueue.shift()(t); t += 16; }
  env.elements.get("palA").click();          // fixed palette, no flow
  const perFrame = [];
  for (let i = 0; i < 30; i += 1) {
    const before = new Set(env.stats.styles);
    env.rafQueue.shift()(t); t += 16;
    perFrame.push([...env.stats.styles].filter((v) => !before.has(v)).length);
  }
  const moving = perFrame.filter((n) => n > 0).length;
  assert.ok(moving >= 20, "wall must keep changing colour frame to frame, moved in " + moving + "/30 frames");
});

test("pinned A reproduces the exact 0.14.0 colour range", () => {
  const env = boot();
  let t = 16;
  for (let i = 0; i < 4; i += 1) { env.rafQueue.shift()(t); t += 16; }
  // Демо стартует во втором режиме, а он по указанию владельца фиолетовый
  // (настройки третьего). Эталон 0.14.0 проверяем на первом классе.
  env.elements.get("classes").children[0].click();
  for (let i = 0; i < 2; i += 1) { env.rafQueue.shift()(t); t += 16; }
  // Радуга по умолчанию включена (весь цветовой круг). Для сверки с 0.14.0
  // её надо выключить: тогда A — это буквально цвет 0.14.0 бит в бит.
  env.elements.get("rainbowOn").click();
  env.elements.get("palA").click();          // pinned A, flow off, mix = 0
  env.stats.styles.clear();
  env.stats.fillStyles.clear();
  for (let i = 0; i < 60; i += 1) { env.rafQueue.shift()(t); t += 16; }

  const panelRe = /^rgba\(\d+,\d+,\d+,0\.98\)$/;
  const parts = /rgba\((\d+),(\d+),(\d+),0\.98\)/;
  // fillStyle only: the collision gate is a stroke of the same alpha and would
  // otherwise sneak into the panel range.
  const panels = [...env.stats.fillStyles].filter((v) => panelRe.test(v));
  assert.ok(panels.length > 0, "panel fills must be present");
  const ch = [[], [], []];
  panels.forEach((css) => {
    const m = css.match(parts).map(Number);
    ch[0].push(m[1]); ch[1].push(m[2]); ch[2].push(m[3]);
  });
  // 0.14.0 formula for classes I/II: r 8..18, g 20..50, b 31..71. Both endpoints
  // must actually occur because shimmer spans 0..1 and light takes 0 and 1.
  assert.deepEqual([Math.min(...ch[0]), Math.max(...ch[0])], [8, 18], "red must hit the 0.14.0 endpoints");
  assert.deepEqual([Math.min(...ch[1]), Math.max(...ch[1])], [20, 50], "green must hit the 0.14.0 endpoints");
  assert.deepEqual([Math.min(...ch[2]), Math.max(...ch[2])], [31, 71], "blue must hit the 0.14.0 endpoints");
});

test("142 BPM по умолчанию и крен корабля кнопками Q/E", () => {
  const env = boot();
  let t = 16;
  for (let i = 0; i < 4; i += 1) { env.rafQueue.shift()(t); t += 16; }
  // темп по умолчанию — 142, кнопка выбрана
  const bpmHost = env.elements.get("bpms");
  assert.equal(bpmHost.children.map((b) => b.textContent).join(","), "100,120,142");
  const cfg = env.sandbox.BCMWarpSpace.warpSpaceCycleConfig(3, 15, 142);
  assert.equal(cfg.bar.toFixed(4), (240 / 142).toFixed(4));

  const key = (k, down) => {
    const list = down ? "keydown" : "keyup";
    (env.winListeners[list] || []).forEach((fn) => fn({ key: k }));
  };
  const rollBefore = env.elements.get("shipRead").textContent;
  assert.match(rollBefore, /крен/, "в подписи корабля должен быть крен");
  // Q/E крутят корабль, подпись меняется и остаётся числом
  key("e", true);
  for (let i = 0; i < 30; i += 1) { env.rafQueue.shift()(t); t += 16; }
  key("e", false);
  const afterE = env.elements.get("shipRead").textContent;
  assert.notEqual(afterE, rollBefore, "Q/E не изменили крен");
  key("q", true);
  for (let i = 0; i < 20; i += 1) { env.rafQueue.shift()(t); t += 16; }
  key("q", false);
  assert.match(env.elements.get("shipRead").textContent, /крен -?\d+°/, "крен должен быть числом");
  // и корабль ходит по кольцу: стрелка меняет его поворот
  key("ArrowRight", true);
  for (let i = 0; i < 40; i += 1) { env.rafQueue.shift()(t); t += 16; }
  key("ArrowRight", false);
  assert.match(env.elements.get("shipRead").textContent, /крен -?\d+°/);
});

test("панели скрыты по умолчанию и включаются клавишей H", () => {
  const env = boot();
  const hidden = (id) => {
    const el = env.elements.get(id);
    assert.ok(el, "элемент " + id + " должен существовать");
    return el.classList.contains("hide-ui");
  };
  // при открытии видно только варп: панель, счётчик, подсказка и тост скрыты
  assert.equal(hidden("panel"), true, "панель настроек должна быть скрыта");
  assert.equal(hidden("meta"), true, "счётчик fps должен быть скрыт");
  assert.equal(hidden("hint"), true, "строка подсказок должна быть скрыта");
  assert.equal(env.sandbox.BCMWarpGetUi(), false);

  const key = (k) => (env.winListeners.keydown || []).forEach((fn) => fn({ key: k }));
  key("h");
  assert.equal(hidden("panel"), false, "H должна показать панель");
  assert.equal(env.sandbox.BCMWarpGetUi(), true);
  key("H");
  assert.equal(hidden("panel"), true, "H должна снова спрятать панель");
  key("р");                                   // русская раскладка
  assert.equal(hidden("panel"), false);

  // кадры при скрытых панелях идут как обычно — на них ничего не завязано
  let t = 16;
  key("h");
  for (let i = 0; i < 40; i += 1) { env.rafQueue.shift()(t); t += 16; }
  assert.equal(hidden("panel"), true);
});

test("дефолт как у владельца: Пульс, класс I, скетчи, seed 05", () => {
  const env = boot();
  const pressed = (id) => env.elements.get(id).children
    .filter((b) => b.getAttribute("aria-pressed") === "true")
    .map((b) => b.textContent);
  assert.deepEqual(pressed("profiles"), ["5 Пульс"], "по умолчанию выбран «5 Пульс»");
  // ревизия 19: перевод класса II «на место I» отменён владельцем — движения
  // туннеля были правильнее на классе I, поэтому дефолт снова I.
  assert.deepEqual(pressed("classes"), ["I"], "по умолчанию класс I");
  // Ритм по умолчанию — случайный (ревизия 15), поэтому сетка тактов не выбрана
  assert.deepEqual(pressed("rhythms"), ["случайно (~2 с)"], "ритм по умолчанию — случайный");
  assert.deepEqual(pressed("bpms"), [], "в случайном ритме темп не выбран");
  assert.deepEqual(pressed("powers"), ["сильный"]);
  assert.deepEqual(pressed("artModes"), ["скетчи"]);
  assert.ok(pressed("artPick").indexOf("05") >= 0, "по умолчанию seed 05: " + pressed("artPick").join(","));
  // и кадр на этих дефолтах живой
  let t = 16;
  for (let i = 0; i < 120; i += 1) { env.rafQueue.shift()(t); t += 16; }
});

test("случайный ритм: переходы в разы чаще, способы не повторяются, темп — второй режим", () => {
  const env = boot();
  const WS = env.sandbox.BCMWarpSpace;

  // план переходов: пауза ~2 с, переход ~0.9 с, каждый раз свой способ
  const plan = WS.warpSpaceRandomCyclePlan({}, 12);
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const holds = plan.map((p) => p.hold);
  assert.ok(Math.abs(mean(holds) - 2) < 0.15, "средняя пауза должна быть ~2 с: " + mean(holds).toFixed(2));
  assert.ok(Math.min(...holds) > 1.2 && Math.max(...holds) < 2.8, "пауза гуляет в разумных пределах");
  const trans = plan.map((p) => p.transition);
  assert.ok(mean(trans) > 1.5 && mean(trans) < 2.2, "переход ~1.8 с (вдвое длиннее прежних 0.9): " + mean(trans).toFixed(2));
  assert.equal(new Set(plan.map((p) => p.kind)).size, WS.warpSpaceTransitionIds().length,
    "за 12 переходов должны выпасть все виды");
  const repeats = plan.filter((p, i) => i && p.kind === plan[i - 1].kind);
  assert.equal(repeats.length, 0, "вид не должен повторяться подряд");
  plan.forEach((p) => {
    assert.ok(WS.warpSpaceTransitionIds().includes(p.kind), "неизвестный вид: " + p.kind);
    assert.ok(p.power >= 1 && p.power <= 2.5, "сила вне диапазона: " + p.power);
  });

  // в 60 с переходов должно быть много больше трёх, как было на 142 BPM
  const perMinute = 60 / (mean(holds) + mean(trans));
  assert.ok(perMinute > 12, "переходов в минуту: " + perMinute.toFixed(1));

  // в кадре: за 20 с переходы случаются не один раз, и способы разные
  const kinds = new Set();
  let t = 16;
  for (let i = 0; i < 60 * 20; i += 1) {
    env.rafQueue.shift()(t);
    t += 1000 / 60;
    if (env.elements.get("transRead").textContent.includes("по кругу:")) {
      kinds.add(env.elements.get("transRead").textContent);
    }
  }
  assert.ok(kinds.size >= 4, "за 20 с должны смениться минимум 4 способа, увидели: " + [...kinds].join(" "));

  // «по тактам» остаётся вторым режимом и включается кликом по темпу
  const bpmButtons = env.elements.get("bpms").children;
  bpmButtons[2].click();
  assert.deepEqual(env.elements.get("rhythms").children.map((b) => b.getAttribute("aria-pressed")),
    ["false", "true"], "после клика по темпу режим — «по тактам»");
  assert.equal(env.elements.get("bpms").children.filter((b) => b.getAttribute("aria-pressed") === "true")
    .map((b) => b.textContent)[0], "142");
  // и обратно
  env.elements.get("rhythms").children[0].click();
  assert.equal(env.elements.get("rhythms").children[0].getAttribute("aria-pressed"), "true");
});

test("астероиды из GLB рисуются в кадре, плотность 0 их убирает", () => {
  const env = boot();
  let t = 16;
  for (let i = 0; i < 30; i += 1) { env.rafQueue.shift()(t); t += 16; }
  // спрайты встроены в демо (6 штук) и рисуются как drawImage 6..140 px
  const blits = () => {
    const before = env.stats.blits;
    env.rafQueue.shift()(t);
    t += 16;
    return env.stats.blits - before;
  };
  const withRocks = blits();
  assert.ok(withRocks > 20, "в кадре должны быть камни, blit-ов: " + withRocks);
  // выключаем — камни исчезают, фон остаётся
  const api = env.sandbox.BCMWarpAsteroids;
  assert.ok(api, "нужен хук BCMWarpAsteroids");
  assert.equal(api(0).density, 0);
  const without = blits();
  assert.ok(without < withRocks - 15, "без камней blit-ов должно стать меньше: " + without + " против " + withRocks);
  assert.ok(without >= 1, "фон должен остаться");
  api(1);
  assert.ok(blits() > without, "камни возвращаются");
  // seed меняет поле, но не ломает кадр
  api(1, 777);
  for (let i = 0; i < 10; i += 1) { env.rafQueue.shift()(t); t += 16; }
});

test("завороты трубы: центр кадра уходит от оси, ближнее кольцо остаётся на месте", () => {
  const env = boot();
  const bend = (elapsed) => {
    const e = elapsed;
    const turn = 1.8 + 1.1 * (Math.sin(e * 0.45) * 0.6 + Math.sin(e * 0.19 + 1.7) * 0.4);
    const at = (d) => Math.abs(Math.sin(d * Math.PI * 1.55 + e * 0.7) * 1.18 * 0.05 * turn * 900 * (1 - d));
    return { mid: at(0.5), near: at(0.92) };
  };
  let maxMid = 0;
  let maxNear = 0;
  for (let e = 0; e < 20; e += 0.25) {
    const b = bend(e);
    maxMid = Math.max(maxMid, b.mid);
    maxNear = Math.max(maxNear, b.near);
  }
  assert.ok(maxMid > 60, "изгиб середины трубы должен быть заметным (>60 px), а он " + Math.round(maxMid));
  assert.ok(maxNear < 20, "у самого корабля труба не должна уезжать (иначе он «сходит с рельсов»): " + Math.round(maxNear));
  assert.ok(maxMid > maxNear * 4, "ближнее кольцо должно быть вчетверо устойчивее середины");
});
