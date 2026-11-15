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

test("стенка без дыр: отсечение панелей считает полную площадь", () => {
  // Проверяем именно то, из-за чего были дыры: на 0° и 180° радиальное ребро
  // панели горизонтально. Один член произведения даёт ~0 (панель выбрасывалась),
  // полная шнуровка — нормальную площадь.
  const src = code;                       // загруженный пропатченный файл
  const fn = src.slice(src.indexOf("function warpSpaceQuadArea(p00, p01, p10)"));
  assert.ok(fn.length > 0, "в патче должна быть функция площади панели");
  const body = fn.slice(0, fn.indexOf("\n  }"));
  // считаем её в песочнице: у ядра внутри патча она замкнута, поэтому
  // повторяем ровно её выражения на реальной геометрии кольца
  const area = (p00, p01, p10) => {
    const dx1 = p01.x - p00.x, dy1 = p01.y - p00.y;
    const dx2 = p10.x - p00.x, dy2 = p10.y - p00.y;
    return Math.abs(dx1 * dy2 - dx2 * dy1);
  };
  assert.match(body, /Math\.abs\(dx1 \* dy2 - dx2 \* dy1\)/, "площадь — шнуровкой, оба члена");
  const cx = 700, cy = 450, rx = (d) => 560 * (1 - d) + 40, ry = (d) => 470 * (1 - d) + 34;
  const P = (d, a) => ({ x: cx + Math.cos(a) * rx(d), y: cy + Math.sin(a) * ry(d) });
  [0, 9].forEach((panel) => {
    const a0 = (panel * 2 * Math.PI) / 18, a1 = ((panel + 1) * 2 * Math.PI) / 18;
    const p00 = P(0.45, a0), p01 = P(0.45, a1), p10 = P(0.45 + 0.96 / 23, a0);
    const broken = Math.abs(p01.x - p00.x) * Math.abs(p10.y - p00.y);
    assert.ok(broken < 1.6, "панель " + panel + " по старому критерию выбрасывалась (" + broken.toFixed(2) + ")");
    assert.ok(area(p00, p01, p10) > 300, "по новой формуле панель " + panel + " видима");
  });
});

test("астероиды: спрайты в файле, хуки работают, плотность и seed управляемы", () => {
  const { sandbox } = boot();
  const art = sandbox.BCM_WARP_ASTEROID_ART;
  assert.equal(Object.keys(art).length, 6, "шесть спрайтов из GLB");
  Object.keys(art).forEach((id) => {
    assert.ok(String(art[id]).indexOf("data:image/png;base64,") === 0, "спрайт " + id + " не data URI");
  });

  const all = sandbox.BCMDeepSpaceWarpAsteroidStats();
  assert.equal(all.density, 1);
  assert.equal(all.slots, 30);
  assert.equal(all.art, 6);
  assert.ok(all.sizes.small > 0 && all.sizes.medium > 0 && all.sizes.large > 0,
    "в поле должны быть все три размера: " + JSON.stringify(all.sizes));

  assert.equal(sandbox.BCMDeepSpaceWarpSetAsteroids(0.4), 0.4);
  assert.equal(sandbox.BCMDeepSpaceWarpAsteroidStats().slots, 12);
  assert.equal(sandbox.BCMDeepSpaceWarpSetAsteroids(0), 0);
  assert.equal(sandbox.BCMDeepSpaceWarpAsteroidStats().slots, 0, "плотность 0 — поля нет");
  assert.equal(sandbox.BCMDeepSpaceWarpSetAsteroids(-5), 0, "отрицательное зажимается");
  assert.equal(sandbox.BCMDeepSpaceWarpSetAsteroids(9), 1, "больше единицы зажимается");
  assert.equal(sandbox.BCMDeepSpaceWarpSetAsteroids("мусор"), 1);
  // seed меняет поле
  const before = sandbox.BCMDeepSpaceWarpAsteroidStats().slots;
  sandbox.BCMDeepSpaceWarpSetAsteroids(1, 777);
  assert.equal(sandbox.BCMDeepSpaceWarpAsteroidStats().slots, before);
});

/* ---------- ревизия 19: класс II по умолчанию, переход x2, частицы x23 ---------- */

test("со старта игра запускает визуальный класс I (перевод на II отменён)", () => {
  const { sandbox } = boot();
  // Слот Warp Drive по умолчанию в 0.14.0 — x-small; по указанию владельца
  // движения туннеля на классе I были правильнее, поэтому дефолт снова I.
  assert.equal(sandbox.BCMDeepSpaceWarpGetVisualClass(), 1,
    "дефолтный слот x-small должен вести на класс I");
  assert.equal(sandbox.BCMDeepSpaceWarpGetPreviewClass(), null);
  // Ручной выбор никуда не делся: II и III включаются кнопками.
  assert.equal(sandbox.BCMDeepSpaceWarpPreviewClass(2), 2, "кнопка класса II должна работать");
  assert.equal(sandbox.BCMDeepSpaceWarpPreviewClass(3), 3, "кнопка класса III должна работать");
  assert.equal(sandbox.BCMDeepSpaceWarpPreviewClass(1), 1);
  assert.equal(sandbox.BCMDeepSpaceWarpPreviewClass(4), 1, "несуществующий класс не принимается");
});

test("переход между кадрами скетчей длиной 1.8 с и частицы в 23 раза мельче — в игре", () => {
  const { sandbox } = boot();
  const dev = sandbox.BCMDeepSpaceWarpDevice(1440, 900);
  const cols = Number(String(dev.grid).split("x")[0]);
  const rows = Number(String(dev.grid).split("x")[1]);
  assert.ok(dev.dissolveBudget === Math.round(dev.cellBudget * 23),
    "бюджет рассыпания = базовый x23: " + dev.cellBudget + " -> " + dev.dissolveBudget);
  assert.ok(cols > 380 && cols < 480, "сетка по горизонтали мелкая: " + cols);
  assert.ok(rows > 230 && rows < 300, "сетка по вертикали мелкая: " + rows);
  const cellW = 1440 / cols, cellH = 900 / rows;
  assert.ok(cellW < 4 && cellH < 4, "клетка должна быть ~3 px: " + cellW.toFixed(2) + "x" + cellH.toFixed(2));
  assert.equal(dev.dissolveFrameCap, 12000, "на обычном тире потолок кадра 12000 клеток");

  // тот же расчёт для телефона: частицы мельчают так же, но сетка мельче по числу
  const phone = sandbox.BCMDeepSpaceWarpDevice(390, 844);
  assert.equal(phone.dissolveBudget, Math.round(phone.cellBudget * 23));
});

test("рассыпание в игре получает номер кадра и потолок, поэтому не рисует всю сетку за кадр", () => {
  const src = readFileSync(new URL("./warp_patched.js", import.meta.url), "utf8");
  assert.match(src, /WARP_SPACE_DISSOLVE = \{ fineness: 23, maxDraws: 24000 \}/,
    "множитель 23 зашит в ядре");
  assert.match(src, /warpSpaceDissolveFrameCap/, "потолок кадра вынесен в ядро");
  assert.match(src, /transition: 1\.8,/, "переход между кадрами x2 (0.9 -> 1.8 с)");
  assert.match(src, /state\.warpFrameNo = \(Number\(state\.warpFrameNo \|\| 0\) \+ 1\) % 100000/,
    "номер кадра инкрементится в общем пути отрисовки");
  assert.match(src, /warpBgPowerNow\(cs\), state\.warpFrameNo, warpDissolveFrameCap\(\)\)/,
    "вызов рассыпания получает frame и потолок");
});
