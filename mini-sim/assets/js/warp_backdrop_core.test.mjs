import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const W = require("./warp_backdrop_core.js");
const WS = W;  // ядро экспортируется объектом BCMWarpSpace

/* A recording stand-in for CanvasRenderingContext2D. Counts every mutating
 * call and keeps a compact op log so determinism can be asserted by equality. */
function mockCtx(log) {
  const rec = (name) => (...args) => {
    if (log) log.push(name + ":" + args.filter((a) => typeof a === "number").map((n) => n.toFixed(3)).join(","));
  };
  const gradient = () => ({ addColorStop: rec("stop") });
  return {
    createLinearGradient: (...a) => { rec("linear")(...a); return gradient(); },
    createRadialGradient: (...a) => { rec("radial")(...a); return gradient(); },
    fillRect: rec("fillRect"),
    strokeRect: rec("strokeRect"),
    beginPath: rec("beginPath"),
    closePath: rec("closePath"),
    moveTo: rec("moveTo"),
    lineTo: rec("lineTo"),
    arc: rec("arc"),
    ellipse: rec("ellipse"),
    fill: rec("fill"),
    stroke: rec("stroke"),
    save: rec("save"),
    restore: rec("restore"),
    translate: rec("translate"),
    rotate: rec("rotate"),
    scale: rec("scale"),
    drawImage: rec("drawImage"),
    set fillStyle(v) { this._fill = v; },
    get fillStyle() { return this._fill; },
    set strokeStyle(v) { this._stroke = v; },
    get strokeStyle() { return this._stroke; },
    lineWidth: 1,
    lineCap: "butt"
  };
}

test("five looks, unique ids, one drawing path", () => {
  const p = W.WARP_SPACE_PROFILES;
  assert.equal(p.length, 5);
  assert.equal(new Set(p.map((x) => x.id)).size, 5);
  const grid = p.find((x) => x.id === "grid");
  assert.equal(grid.rings, 0, "Class I must be able to reproduce the 0.14.0 look exactly");
});

test("profile selection stays inside the live classes and is deterministic", () => {
  for (let cls = 1; cls <= 3; cls += 1) {
    for (let seed = 0; seed < 40; seed += 1) {
      const a = W.warpSpaceProfileFor(cls, seed);
      const b = W.warpSpaceProfileFor(cls, seed);
      assert.equal(a.id, b.id, "same seed must give the same look");
      assert.ok(W.WARP_SPACE_PROFILES.includes(a));
      if (cls === 1) assert.ok(["grid", "lattice"].includes(a.id), "Class I stays close to the accepted look");
    }
  }
  assert.equal(W.warpSpaceProfileFor(9, 3).id !== undefined, true, "out-of-range class is clamped, not thrown");
  assert.equal(W.warpSpaceProfileFor("x", 3).id !== undefined, true);
});

test("backdrop is deterministic per seed and changes with the seed", () => {
  const paint = (seed) => {
    const log = [];
    W.paintSpaceBackdrop(mockCtx(log), 480, 270, seed, W.WARP_SPACE_PROFILES[1]);
    return log.join("|");
  };
  assert.equal(paint(1234), paint(1234));
  assert.notEqual(paint(1234), paint(4321));
});

test("backdrop uses no arcs per star (cost guard) and stays bounded", () => {
  const log = [];
  W.paintSpaceBackdrop(mockCtx(log), 800, 500, 99, W.WARP_SPACE_PROFILES[1]);
  const drawCalls = log.filter((l) => /^(fillRect|fill|stroke|drawImage)/.test(l)).length;
  assert.ok(drawCalls < 420, "expected a few hundred primitive calls, got " + drawCalls);
  assert.ok(log.some((l) => l.startsWith("linear")));
  assert.ok(log.some((l) => l.startsWith("radial")));
});

test("quality scale shrinks on large canvases", () => {
  assert.ok(W.warpSpaceQuality(1920, 1080) < W.warpSpaceQuality(800, 500));
  assert.ok(W.warpSpaceQuality(800, 500) <= 0.55);
});

test("cache creation paints once and reports scale", () => {
  const created = [];
  const byId = (id) => W.WARP_SPACE_PROFILES.find((p) => p.id === id);
  const cache = W.createSpaceBackdropCache(800, 500, 7, byId("lattice"), (w, h) => {
    const canvas = { width: w, height: h, getContext: () => mockCtx(null) };
    created.push(canvas);
    return canvas;
  });
  assert.equal(created.length, 1, "must paint exactly once, not per frame");
  assert.equal(cache.canvas.width, Math.round(800 * cache.scale));
  assert.equal(cache.id, "lattice");
});

test("blit is safe with no cache and is a single drawImage otherwise", () => {
  const log = [];
  const g = mockCtx(log);
  W.drawSpaceBackdrop(g, null, 800, 500, 1.5);
  assert.equal(log.filter((l) => l.startsWith("drawImage")).length, 0);
  W.drawSpaceBackdrop(g, { canvas: {} }, 800, 500, 1.5);
  assert.equal(log.filter((l) => l.startsWith("drawImage")).length, 1);
});

test("rings: zero for the plain look, present and faint otherwise", () => {
  const point = (d, a) => ({ x: 400 + Math.cos(a) * d * 300, y: 250 + Math.sin(a) * d * 300 });
  const log = [];
  const byId = (id) => W.WARP_SPACE_PROFILES.find((p) => p.id === id);
  assert.equal(W.drawWarpSpaceRings(mockCtx(log), point, byId("grid"), 2), 0);
  const lattice = W.drawWarpSpaceRings(mockCtx(log), point, byId("lattice"), 2);
  assert.ok(lattice > 0 && lattice <= 7);
  const dense = W.drawWarpSpaceRings(mockCtx(log), point, byId("dense"), 2);
  assert.ok(dense <= 21);
  // «Ленты» — первый пункт меню и профиль по умолчанию
  assert.equal(W.WARP_SPACE_PROFILES[0].id, "ribbon");
  assert.equal(W.WARP_SPACE_PROFILES[0].ribbon, true);
  // never fully opaque: a solid hoop would read as a collision gate
  assert.ok(W.WARP_SPACE_PROFILES.every((p) => p.ringAlpha <= 0.30));
});

test("ribbon draws three stacked strokes for one path", () => {
  const log = [];
  W.drawWarpSpaceRibbon(mockCtx(log), [{ x: 0, y: 0 }, { x: 10, y: 10 }], "rgba(1,2,3,1)");
  assert.equal(log.filter((l) => l.startsWith("stroke")).length, 3);
  assert.equal(log.filter((l) => l.startsWith("beginPath")).length, 3);
});

test("pulse is inert unless the profile asks for it", () => {
  const log = [];
  W.drawWarpSpacePulse(mockCtx(log), 400, 250, 200, 5, W.WARP_SPACE_PROFILES[1]);
  assert.equal(log.filter((l) => l.startsWith("arc")).length, 0);
  // На этой фазе одно из трёх колец уже погашено (alpha ~ 0.004), поэтому
  // колец 2–3, а не ровно 3. Важно, что пульс вообще рисует и не молчит.
  const arcs = W.drawWarpSpacePulse(mockCtx(log), 400, 250, 200, 5, W.WARP_SPACE_PROFILES[4]);
  assert.ok(arcs >= 2 && arcs <= 3, "колец пульса: " + arcs);
});

test("null profile never throws", () => {
  const g = mockCtx([]);
  assert.doesNotThrow(() => W.drawWarpSpaceRings(g, () => ({ x: 0, y: 0 }), null, 0));
  assert.doesNotThrow(() => W.drawWarpSpacePulse(g, 0, 0, 10, 0, null));
  assert.doesNotThrow(() => W.drawWarpSpaceRibbon(g, [], "red"));
});

/* ---------------------------------------------------------------- palettes */

/* Reference implementation, copied by hand from 0.14.0 drawTubeTunnel(). */
function refPanelCss(cls, shimmer, light) {
  let r, g, b;
  if (cls === 3) {
    r = Math.round(17 + shimmer * 12 + light * 3);
    g = Math.round(12 + shimmer * 8 + light * 5);
    b = Math.round(34 + shimmer * 28 + light * 12);
  } else {
    r = Math.round(8 + shimmer * 8 + light * 2);
    g = Math.round(20 + shimmer * 18 + light * 12);
    b = Math.round(31 + shimmer * 22 + light * 18);
  }
  return "rgba(" + r + "," + g + "," + b + ",0.98)";
}

test("wall colour at mix 0 is byte-identical to 0.14.0 (класс I — эталон)", () => {
  for (const cls of [1, 3]) {
    for (let sh = 0; sh <= 1.0001; sh += 0.02) {
      for (const li of [0, 1]) {
        assert.equal(W.warpSpacePanelCss(cls, sh, li, 0), refPanelCss(cls, sh, li),
          `class ${cls} shimmer ${sh.toFixed(2)} light ${li} drifted from 0.14.0`);
      }
    }
  }
});

test("seams and accents at mix 0 are byte-identical to 0.14.0 (класс I — эталон)", () => {
  // Класс II по прямому указанию владельца носит фиолетовые настройки III,
  // поэтому эталон 0.14.0 для него больше не действует. Класс I не менялся.
  const seams = {
    1: { thick: "rgba(110,239,246,0.72)", thin: "rgba(110,191,210,0.25)" },
    3: { thick: "rgba(189,139,246,0.86)", thin: "rgba(131,96,184,0.36)" }
  };
  const accents = { 1: "rgba(190,255,255,1)", 3: "rgba(230,205,255,1)" };
  for (const cls of [1, 3]) {
    assert.equal(W.warpSpaceSeamCss(cls, "thick", 0), seams[cls].thick, "thick seam, class " + cls);
    assert.equal(W.warpSpaceSeamCss(cls, "thin", 0), seams[cls].thin, "thin seam, class " + cls);
    assert.equal(W.warpSpaceAccentCss(cls, 0), accents[cls], "accent, class " + cls);
  }
});

test("the moving light pattern survives the whole A->B transition", () => {
  // The wall animation comes from shimmer/light; blending must not flatten it.
  for (const cls of [1, 2, 3]) {
    for (let mix = 0; mix <= 1.0001; mix += 0.1) {
      const dark = W.warpSpacePanelRgb(cls, 0, 0, mix);
      const lit = W.warpSpacePanelRgb(cls, 1, 1, mix);
      const delta = Math.abs(lit[1] - dark[1]) + Math.abs(lit[2] - dark[2]);
      assert.ok(delta >= 20, `class ${cls} mix ${mix.toFixed(1)}: light cells lost their contrast (${delta})`);
    }
  }
});

test("palette endpoints differ, and B keeps lines brighter than the wall", () => {
  for (const cls of [1, 2, 3]) {
    const a = W.warpSpacePaletteAt(cls, 0);
    const b = W.warpSpacePaletteAt(cls, 1);
    assert.notDeepEqual(a.fill, b.fill, "class " + cls + " must change its wall colour");
    assert.ok(W.relativeLuminance(b.fill) > W.relativeLuminance(a.fill) + 40,
      "class " + cls + ": B must invert the wall from dark to bright");
    for (const key of ["seamThick", "seamThin", "accent", "ring"]) {
      assert.ok(W.relativeLuminance(b[key]) > W.relativeLuminance(b.fill) + 30,
        `class ${cls} ${key}: line must stay brighter than the wall in B`);
    }
  }
});

test("palette transition is continuous, no visible jump", () => {
  for (const cls of [1, 2, 3]) {
    let prev = W.warpSpacePaletteAt(cls, 0);
    for (let mix = 0.01; mix <= 1.0001; mix += 0.01) {
      const cur = W.warpSpacePaletteAt(cls, mix);
      for (const k of ["fill", "seamThick", "seamThin", "accent", "ring"]) {
        for (let c = 0; c < 3; c += 1) {
          const jump = Math.abs(cur[k][c] - prev[k][c]);
          assert.ok(jump <= 4, `class ${cls} ${k}[${c}] jumps ${jump} at mix ${mix.toFixed(2)}`);
        }
      }
      prev = cur;
    }
  }
});

test("spatial wave stays in range and actually travels", () => {
  for (let p = 0; p <= 1.0001; p += 0.05) {
    for (let t = 0; t < 12; t += 0.5) {
      const m = W.warpSpaceFlowMix(0.5, p, t);
      assert.ok(m >= 0 && m <= 1, "flow mix escaped 0..1: " + m);
    }
  }
  const spread = [];
  for (let p = 0; p <= 1; p += 0.05) spread.push(W.warpSpaceFlowMix(0.5, p, 0));
  assert.ok(Math.max(...spread) - Math.min(...spread) > 0.1, "wave must differ along the surface");
});

test("ease and ping-pong behave", () => {
  assert.equal(W.warpSpaceEase(0), 0);
  assert.equal(W.warpSpaceEase(1), 1);
  assert.ok(Math.abs(W.warpSpaceEase(0.5) - 0.5) < 1e-9);
  assert.ok(W.warpSpacePingPong(0) < 1e-9);
  assert.ok(Math.abs(W.warpSpacePingPong(4.5, 9) - 1) < 1e-6);
});

test("palette helpers never throw on junk input", () => {
  assert.doesNotThrow(() => W.warpSpacePaletteAt("x", NaN));
  assert.doesNotThrow(() => W.warpSpacePanelCss(null, NaN, NaN, NaN));
  assert.doesNotThrow(() => W.warpSpaceFlowMix(NaN, NaN, NaN));
  assert.equal(W.rgbaCss([10, 20, 30], 0.5), "rgba(10,20,30,0.5)");
});

/* ------------------------------------------ наблюдаемые в браузере багули */

test("качество не понижается из-за одиночного медленного кадра", () => {
  // один тяжёлый кадр (переключение вкладки, первый кадр) не должен ничего менять
  assert.equal(W.warpSpaceTier(30, 1), "high");
  assert.equal(W.warpSpaceTier(30, 10), "high");
  assert.equal(W.warpSpaceTier(30, 44), "high");
  // устойчивый ряд — понижаем
  assert.equal(W.warpSpaceTier(30, 45), "low");
  // быстрый кадр возвращает high
  assert.equal(W.warpSpaceTier(12, 500), "high");
});

test("низкий тир НЕ меняет число панелей: силуэт стенки прежний", () => {
  const high = W.warpSpaceTierParams("high");
  const low = W.warpSpaceTierParams("low");
  assert.equal(high.panelCount, undefined, "число панелей не должно зависеть от тира");
  assert.equal(low.panelCount, undefined, "урезание панелей делало сечение гранёным");
  assert.ok(low.cullScale > high.cullScale, "экономия идёт отсечением, а не силуэтом");
  assert.equal(high.cullScale > 0, true);
});

test("направление меняется плавно, без телепорта стенки", () => {
  let d = 1;
  const steps = [];
  for (let i = 0; i < 10; i += 1) {
    d = W.warpSpaceDirectionRamp(d, -1, 0.016);
    steps.push(d);
  }
  // ни на одном кадре направление не перескакивает больше чем на 0.1
  let prev = 1;
  for (const v of steps) {
    assert.ok(Math.abs(v - prev) <= 0.12, "скачок направления " + Math.abs(v - prev).toFixed(3));
    prev = v;
  }
  assert.ok(steps[steps.length - 1] < 0.3, "направление должно уверенно идти к цели, а не стоять");
  for (let i = 0; i < 200; i += 1) d = W.warpSpaceDirectionRamp(d, -1, 0.016);
  assert.equal(d, -1, "рампа должна сойтись ровно в цель");
});

test("разворот не складывает трубу: фаза геометрии непрерывна", () => {
  // повторяем интегратор, как в updateTube(): разворот применяется при
  // интегрировании, а фаза в рисовании берётся без множителя
  let travel = 0;
  let dir = 1;
  const dt = 1 / 60;
  const speed = 1.6;
  let prev = 0;
  let maxJump = 0;
  for (let f = 0; f < 180; f += 1) {
    const target = f < 30 ? 1 : -1;
    dir = W.warpSpaceDirectionRamp(dir, target, dt);
    travel += dt * speed * 1.48 * dir;
    if (f > 0) maxJump = Math.max(maxJump, Math.abs(travel - prev));
    prev = travel;
  }
  // при 60 fps обычный ход ≈0.039 фазы за кадр; скачок больше 0.05 означает
  // рывок, а «замороженная» фаза дала бы 0 — тоже признак поломки конструкции
  assert.ok(maxJump > 0.02, "ход не должен замирать");
  assert.ok(maxJump < 0.05, "скачок фазы " + maxJump.toFixed(4) + " — это рывок трубы");
});

/* ---------- ревизия 10: обои seed из mini-sim/assets/scetchs ---------- */

test("обои seed: шесть векторных скетчей и детерминированный ряд", () => {
  assert.equal(W.WARP_SPACE_SKETCHES.length, 6);
  W.WARP_SPACE_SKETCHES.forEach((name) => {
    assert.match(name, /^(0[1-6])-[a-z-]+\.svg$/, "имя файла: " + name);
  });
  // ряд циклический и повторяемый: seed 18 с -> 3 перехода по 2 с
  assert.equal(W.warpSpaceSketchFor(0), "01-star-tunnel.svg");
  assert.equal(W.warpSpaceSketchFor(5), "06-portal-shift.svg");
  assert.equal(W.warpSpaceSketchFor(6), W.warpSpaceSketchFor(0), "ряд обязан замкнуться");
  assert.equal(W.warpSpaceSketchFor(7), W.warpSpaceSketchFor(1));
  // мусор на входе не должен давать undefined в src картинки
  ["-1", "NaN", "1e9"].forEach((bad) => {
    const value = W.warpSpaceSketchFor(Number(bad));
    assert.ok(W.WARP_SPACE_SKETCHES.includes(value), "для " + bad + " получено " + value);
  });
});

test("cover: скетч заполняет кадр целиком, без полей и без искажений", () => {
  const shapes = [
    [1600, 900, 880, 495],     // обычный кадр
    [1600, 900, 400, 900],     // узкий портрет
    [1600, 900, 1600, 400],    // широкий и низкий
    [900, 1600, 880, 495],     // вертикальный исходник
    [1600, 900, 2, 2]          // совсем крошечный
  ];
  shapes.forEach(([iw, ih, cw, ch]) => {
    const rect = W.warpSpaceCoverRect(iw, ih, cw, ch);
    assert.ok(rect.x <= 0.001 && rect.y <= 0.001,
      "левый/верхний край: " + rect.x + "," + rect.y);
    assert.ok(rect.x + rect.w >= cw - 0.001 && rect.y + rect.h >= ch - 0.001,
      "правый/нижний край: " + (rect.x + rect.w) + "," + (rect.y + rect.h));
    const srcAspect = iw / ih;
    const dstAspect = rect.w / rect.h;
    assert.ok(Math.abs(srcAspect - dstAspect) < 0.01, "пропорции поплыли: " + srcAspect + " vs " + dstAspect);
    // поля не обрезаны небрежно: одна из сторон совпадает с кадром
    assert.ok(Math.abs(rect.w - cw) < 0.5 || Math.abs(rect.h - ch) < 0.5,
      "cover должен упираться в кадр хотя бы одной стороной");
  });
});

test("createSketchCache: одна растеризация SVG в offscreen-кэш", () => {
  const calls = [];
  const canvas = { width: 0, height: 0, getContext: () => ({
    fillStyle: "", fillRect() {}, drawImage() { calls.push([].slice.call(arguments)); }
  }) };
  const makeCanvas = (w, h) => { canvas.width = w; canvas.height = h; return canvas; };
  const img = { naturalWidth: 1600, naturalHeight: 900 };
  const built = W.createSketchCache(img, 880, 495, makeCanvas);

  assert.equal(calls.length, 1, "SVG должен рисоваться ровно один раз, а не на кадр");
  assert.equal(built.canvas, canvas);
  assert.equal(built.id, "sketch");
  assert.ok(built.w <= 880 && built.h <= 495, "кэш не должен быть больше кадра");
  assert.ok(built.w > 100 && built.h > 100, "кэш развалился: " + built.w + "x" + built.h);
  assert.equal(built.w / built.h, canvas.width / canvas.height);
  // масштаб кэша — стандартное качество ядра, отдельной ручки нет
  assert.equal(built.scale, W.warpSpaceQuality(880, 495));
  // картинка без размеров (ещё грузится) не должна ронять растеризацию
  const fallback = W.createSketchCache({}, 640, 360, makeCanvas);
  assert.ok(fallback.w > 0 && fallback.h > 0);
});

/* ---------- ревизия 11: второй режим фиолетовый, «Ленты» первыми ---------- */

test("второй режим носит фиолетовые настройки третьего", () => {
  for (const mix of [0, 0.25, 0.5, 1]) {
    assert.deepEqual(W.warpSpacePaletteAt(2, mix), W.warpSpacePaletteAt(3, mix),
      "палитра класса II должна совпадать с классом III при mix " + mix);
    assert.equal(W.warpSpacePanelCss(2, 0.5, 1, mix), W.warpSpacePanelCss(3, 0.5, 1, mix));
    assert.equal(W.warpSpaceSeamCss(2, "thick", mix), W.warpSpaceSeamCss(3, "thick", mix));
    assert.equal(W.warpSpaceSeamCss(2, "thin", mix), W.warpSpaceSeamCss(3, "thin", mix));
    assert.equal(W.warpSpaceAccentCss(2, mix), W.warpSpaceAccentCss(3, mix));
  }
  // именно фиолетовый: синий канал заметно выше зелёного на обоих концах
  for (const mix of [0, 1]) {
    const p = W.warpSpacePaletteAt(2, mix);
    assert.ok(p.fill[2] > p.fill[1] + 10, "стенка должна быть фиолетовой, а не бирюзовой");
    assert.ok(p.seamThick[2] > p.seamThick[1] + 20, "шов должен быть фиолетовым");
  }
  // классы I и III не поехали
  assert.notDeepEqual(W.warpSpacePaletteAt(1, 0), W.warpSpacePaletteAt(3, 0));
});

test("«Ленты» первыми в списке и остаются первым выбором", () => {
  assert.equal(W.WARP_SPACE_PROFILES[0].id, "ribbon");
  assert.equal(W.WARP_SPACE_PROFILES[0].label, "Ленты");
  // порядок меню не влияет на то, какой вид выпадает заезду: пулы по id
  const seen = {};
  for (let cls = 1; cls <= 3; cls += 1) {
    for (let seed = 0; seed < 60; seed += 1) {
      seen[cls + ":" + W.warpSpaceProfileFor(cls, seed).id] = true;
    }
  }
  // класс I в игре — только «Сетка» и «Решётка», как и было в 0.14.0-логике
  assert.ok(seen["1:grid"] && seen["1:lattice"]);
  assert.ok(!seen["1:dense"] && !seen["1:pulse"] && !seen["1:ribbon"]);
  assert.ok(seen["3:dense"] && seen["3:ribbon"] && seen["3:pulse"]);
});

/* ---------- ревизия 11: пиксель перехода и профиль устройства ---------- */

test("сетка перехода: бюджет клеток, квадратные клетки, нижняя граница", () => {
  const micro = W.warpSpaceCellGrid(W.WARP_SPACE_CELL_PRESETS.micro, 1920, 1080);
  assert.ok(micro.cells >= 4000, "на ПК пиксель должен быть мелким, получено " + micro.cells);
  assert.ok(micro.cells <= W.WARP_SPACE_CELL_PRESETS.micro + 1);

  const phone = W.warpSpaceCellGrid(W.WARP_SPACE_CELL_PRESETS.fine, 487, 1055);
  assert.ok(phone.cells <= 260, "на телефоне клеток должно быть немного: " + phone.cells);
  // клетки примерно квадратные: клетка не должна быть вытянутой больше чем в 2 раза
  const cw = 487 / phone.cols;
  const ch = 1055 / phone.rows;
  assert.ok(Math.max(cw, ch) / Math.min(cw, ch) < 2, "клетка вытянулась: " + cw.toFixed(1) + "x" + ch.toFixed(1));

  // мельче 3 px на клетку не имееет смысла: бюджет упирается в площадь кадра
  const absurd = W.warpSpaceCellGrid(1e9, 300, 200);
  assert.ok(absurd.cols * 3 <= 300 + 3 && absurd.rows * 3 <= 200 + 3, "клетка мельче 3 px: " + absurd.cols + "x" + absurd.rows);
  assert.equal(absurd.cells, absurd.cols * absurd.rows);

  // мусор на входе не ломает сетку
  [0, -5, NaN, undefined, "abc"].forEach((bad) => {
    const g = W.warpSpaceCellGrid(bad, 800, 500);
    assert.ok(g.cols >= 4 && g.rows >= 3, "плохой бюджет " + bad + " дал " + g.cols + "x" + g.rows);
    assert.ok(g.cells > 0);
  });
});

test("профиль устройства: телефону крупнее пиксель и ниже разрешение, ПК — мельче", () => {
  const pc = W.warpSpaceDeviceProfile({ cores: 8, dpr: 2, shortSide: 1080, coarsePointer: false });
  const phone = W.warpSpaceDeviceProfile({ cores: 4, dpr: 3, shortSide: 390, coarsePointer: true });
  const weak = W.warpSpaceDeviceProfile({ tier: "low", cores: 4, dpr: 3, shortSide: 390 });

  assert.equal(pc.id, "desktop");
  assert.equal(phone.id, "touch");
  assert.equal(weak.id, "weak");
  // пиксель: у ПК заведомо мельче, у телефона и слабого — крупнее
  assert.ok(pc.cellBudget > phone.cellBudget * 4, "на ПК сетка должна быть заметно мельче");
  assert.ok(weak.cellBudget < phone.cellBudget);
  // разрешение: DPR ослаблен ровно там, где экран этого не заслуживает
  assert.ok(phone.dprCap < 3, "телефону незачем DPR 3");
  assert.ok(weak.dprCap <= 1.1, "слабому устройству DPR 1");
  assert.ok(pc.dprCap <= 1.5);
  // и профиль никогда не отдаёт мусор
  [undefined, {}, { dpr: -3 }, { cores: "x" }].forEach((bad) => {
    const p = W.warpSpaceDeviceProfile(bad);
    assert.ok(["desktop", "tablet", "touch", "weak"].includes(p.id), "неизвестный профиль: " + p.id);
    assert.ok(p.dprCap >= 1 && p.dprCap <= 1.5);
    assert.ok(p.cellBudget >= W.WARP_SPACE_CELL_PRESETS.coarse);
  });
});

test("мелкая сетка распадается кольцом, а не мерцает поворотом", () => {
  const run = (cols, rows, w, h) => {
    const rotates = [];
    const g = {
      save() {}, restore() {}, translate() {}, fillRect() {},
      rotate(a) { rotates.push(a); }, drawImage() {},
      set globalAlpha(v) { if (!isFinite(v)) throw new Error("alpha"); },
      set fillStyle(v) {}
    };
    const cells = W.warpSpaceCellField(cols, rows, 11);
    W.drawSpaceDissolve(g, { canvas: { width: 320, height: 200 } },
      { canvas: { width: 320, height: 200 } }, 0.5, w, h, cells, cols, rows, 1, 1.6);
    const maxSpin = rotates.reduce((m, a) => Math.max(m, Math.abs(a)), 0);
    return { maxSpin, count: rotates.length };
  };
  const micro = run(96, 54, 880, 495);   // клетка ~9 px
  const coarse = run(12, 7, 880, 495);   // клетка ~73 px
  const subpixel = run(200, 120, 640, 400); // клетка ~3 px
  assert.ok(micro.count > 0 && coarse.count > 0 && subpixel.count > 0);
  // крупные осколки вращаются заметно, мелкие — слабее, субпиксельные почти нет
  assert.ok(coarse.maxSpin >= micro.maxSpin, "крупная сетка не должна вращаться слабее мелкой");
  assert.ok(subpixel.maxSpin < 0.15, "клетка 3 px не должна мерцать поворотом: " + subpixel.maxSpin.toFixed(3));
  assert.ok(micro.maxSpin > subpixel.maxSpin * 3, "гашение поворота должно быть плавным: 9 px ещё вращается");
});

/* ---------- ревизия 12: радужный перелив вместо одного цвета ---------- */

test("радуга: за период перелива проходит весь цветовой круг", () => {
  for (const cls of [1, 2, 3]) {
    const hues = [];
    for (let i = 0; i < 24; i += 1) hues.push(W.warpSpacePaletteAt(cls, i / 24, 0).hue);
    // 24 шага по кругу: соседние оттенки не совпадают, полный круг набран
    const sorted = hues.slice().sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i += 1) {
      assert.ok(sorted[i] - sorted[i - 1] > 0.02, "class " + cls + ": оттенки слиплись");
    }
    assert.ok(Math.max(...hues) - Math.min(...hues) > 0.85, "class " + cls + ": круг не полный");
  }
});

test("радуга: полосы вдоль поверхности, а не один цвет на всю стенку", () => {
  const hues = [];
  for (let panel = 0; panel < 18; panel += 1) {
    hues.push(W.warpSpacePaletteAt(2, 0.3, panel / 18).hue);
  }
  const span = Math.max(...hues) - Math.min(...hues);
  assert.ok(span > 0.4, "вдоль сечения должно быть больше половины круга, получено " + span.toFixed(2));
  // и цвета соседних панелей действительно разные, а не «почти один»
  const distinct = new Set(hues.map((h) => Math.round(h * 24)));
  assert.ok(distinct.size >= 10, "уникальных оттенков по сечению: " + distinct.size);
});

test("радуга: стенка остаётся тёмной, шов и акцент — светлыми", () => {
  for (const cls of [1, 2, 3]) {
    for (let i = 0; i < 12; i += 1) {
      const pal = W.warpSpacePaletteAt(cls, i / 12, i / 24);
      assert.ok(W.relativeLuminance(pal.fill) < 70, "класс " + cls + ": стенка слишком светлая");
      assert.ok(W.relativeLuminance(pal.seamThick) > W.relativeLuminance(pal.fill) + 40,
        "класс " + cls + ": шов должен быть заметно ярче стенки");
      assert.ok(W.relativeLuminance(pal.accent) > W.relativeLuminance(pal.fill) + 50);
      // ни один канал не вылетает за диапазон
      ["fill", "seamThick", "seamThin", "accent", "ring"].forEach((key) => {
        pal[key].forEach((v) => {
          assert.ok(Number.isInteger(v) && v >= 0 && v <= 255, key + " вне диапазона: " + v);
        });
      });
    }
  }
});

test("радуга: огоньки ходят по светлоте, не уводя оттенок в чужой цвет", () => {
  for (const phase of [0, 0.2, 0.4, 0.6, 0.8]) {
    const dark = W.warpSpacePanelRgb(2, 0, 0, 0.2, phase);
    const lit = W.warpSpacePanelRgb(2, 1, 1, 0.2, phase);
    const pal = W.warpSpaceRainbowPalette(2, 0.2, phase);
    // огонёк ярче — и остаётся в той же цветовой семье (синий канал не перескочил)
    assert.ok(W.relativeLuminance(lit) > W.relativeLuminance(dark) + 10,
      "phase " + phase + ": огоньки потеряли яркость");
    const hueDark = Math.abs(pal.hue);
    assert.ok(Number.isFinite(hueDark));
    // знак разницы каналов у тёмной и светлой панели одинаковый
    const sign = (c) => Math.sign(c[2] - c[1]);
    assert.equal(sign(dark), sign(lit), "phase " + phase + ": огонёк сменил цвет, а не яркость");
  }
});

test("радуга не ломает непрерывность и не роняет старый путь A ↔ B", () => {
  for (const cls of [1, 2, 3]) {
    let prev = null;
    for (let mix = 0; mix <= 1.0001; mix += 0.02) {
      const pal = W.warpSpacePaletteAt(cls, mix, 0.3);
      if (prev) {
        for (const key of ["fill", "accent"]) {
          for (let ch = 0; ch < 3; ch += 1) {
            assert.ok(Math.abs(pal[key][ch] - prev[key][ch]) < 45,
              "класс " + cls + " " + key + ": скачок цвета при mix " + mix.toFixed(2));
          }
        }
      }
      prev = pal;
    }
  }
  // без фазы радуги всё по-прежнему: A/B, и при mix 0 класс I = 0.14.0
  assert.equal(W.warpSpacePanelCss(1, 0.5, 0, 0), "rgba(12,29,42,0.98)");
  assert.deepEqual(W.warpSpacePaletteAt(1, 0, null), W.warpSpacePaletteAt(1, 0));
  assert.notDeepEqual(W.warpSpacePaletteAt(1, 0, 0.5), W.warpSpacePaletteAt(1, 0));
  // мусор в фазе трактуется как «радуга выключена», а не как NaN в цвете
  [NaN, undefined, null, "abc", Infinity].forEach((bad) => {
    const css = W.warpSpacePanelCss(1, 0.4, 0, 0.2, bad);
    assert.match(css, /^rgba\(\d+,\d+,\d+,0\.98\)$/, "плохая фаза " + bad + " дала " + css);
  });
});

/* ---------- ревизия 13: виды перехода и корабль сзади ---------- */

test("переходы: список, рассыпание первым, цикл по кругу детерминирован", () => {
  const ids = W.warpSpaceTransitionIds();
  assert.equal(ids[0], "dissolve", "рассыпание — приоритет и первый пункт");
  assert.deepEqual(ids, ["dissolve", "iris", "doors", "blinds", "spiral", "sweep"]);
  ids.forEach((id) => assert.ok(W.WARP_SPACE_TRANSITIONS.find((t) => t.id === id).label.length > 2));
  // «по кругу» — это именно цикл, а не случайность
  const seq = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => W.warpSpaceTransitionFor(i));
  assert.deepEqual(seq, ["dissolve", "iris", "doors", "blinds", "spiral", "sweep", "dissolve", "iris"]);
  assert.equal(W.warpSpaceTransitionFor(-1), "sweep", "отрицательный индекс замыкается назад");
  assert.equal(W.warpSpaceTransitionFor(NaN), "dissolve");
});

test("каждый вид перехода рисует кадр и не оставляет его пустым", () => {
  const mk = () => {
    const ops = { drawImage: 0, clip: 0, arc: 0, rect: 0, stroke: 0 };
    const g = {
      save() {}, restore() {}, translate() {}, rotate() {},
      beginPath() {}, closePath() {}, moveTo() {}, lineTo() {},
      arc() { ops.arc += 1; }, rect() { ops.rect += 1; },
      clip() { ops.clip += 1; }, stroke() { ops.stroke += 1; },
      drawImage() { ops.drawImage += 1; }, fillRect() {}, fill() {},
      set globalAlpha(v) { if (!isFinite(v)) throw new Error("alpha"); },
      set fillStyle(v) {}, set strokeStyle(v) {},
      set lineWidth(v) { if (!isFinite(v)) throw new Error("lineWidth"); }
    };
    return { g, ops };
  };
  const prev = { canvas: { width: 400, height: 300 } };
  const next = { canvas: { width: 400, height: 300 } };
  const cells = W.warpSpaceCellField(12, 7, 5);

  W.warpSpaceTransitionIds().forEach((kind) => {
    [0, 0.01, 0.5, 0.99, 1].forEach((k) => {
      const { g, ops } = mk();
      assert.doesNotThrow(() => {
        W.drawSpaceTransition(g, prev, next, k, 880, 495, kind, cells, 12, 7, 1, 1.6);
      }, kind + " упал на k=" + k);
      assert.ok(ops.drawImage >= 1, kind + " не нарисовал ни одного кадра при k=" + k);
    });
  });

  // при k = 1 новый кадр обязан быть показан целиком, а не «наполовину»
  const { g, ops } = mk();
  W.drawSpaceTransition(g, prev, next, 1, 880, 495, "iris");
  assert.ok(ops.clip >= 1 && ops.drawImage >= 2, "финальный кадр должен содержать новый фон");
});

test("виды перехода дешевле рассыпания: не больше 20 blit-ов на кадр", () => {
  const measure = (kind) => {
    let blits = 0;
    const g = {
      save() {}, restore() {}, translate() {}, rotate() {}, beginPath() {}, closePath() {},
      moveTo() {}, lineTo() {}, arc() {}, rect() {}, clip() {}, stroke() {}, fill() {}, fillRect() {},
      drawImage() { blits += 1; },
      set globalAlpha(v) {}, set fillStyle(v) {}, set strokeStyle(v) {}, set lineWidth(v) {}
    };
    const prev = { canvas: { width: 400, height: 300 } };
    const next = { canvas: { width: 400, height: 300 } };
    W.drawSpaceTransition(g, prev, next, 0.5, 880, 495, kind, null, 0, 0, 1, 1.6);
    return blits;
  };
  ["iris", "doors", "blinds", "spiral", "sweep"].forEach((kind) => {
    const blits = measure(kind);
    assert.ok(blits > 0 && blits <= 20, kind + ": blit-ов " + blits);
  });
});

test("корабль сзади: маленький, внутри кольца, силуэт по числу двигателей", () => {
  // размер ограничен: не точка и не полэкрана
  [[320, 240], [800, 500], [1440, 900], [3840, 2160]].forEach(([w, h]) => {
    const size = W.warpSpaceShipSize(w, h);
    assert.ok(size >= 22 && size <= 46, w + "x" + h + ": размер " + size);
    assert.ok(size <= Math.min(w, h) * 0.15, "корабль не должен занимать больше 15% короткой стороны");
  });

  W.WARP_SPACE_SHIP_SPECS.forEach((spec) => {
    const ops = { engines: 0, fill: 0, stroke: 0, arc: 0 };
    const g = {
      save() {}, restore() {}, translate() {}, rotate() {},
      createLinearGradient: () => ({ addColorStop() {} }),
      beginPath() { ops.engines += 1; }, closePath() {}, moveTo() {}, lineTo() {},
      arc() { ops.arc += 1; }, ellipse() {}, fill() { ops.fill += 1; },
      stroke() { ops.stroke += 1; }, fillRect() {},
      set fillStyle(v) { if (v == null) throw new Error("fillStyle"); },
      set strokeStyle(v) {}, set lineWidth(v) { if (!isFinite(v)) throw new Error("lineWidth"); },
      set globalAlpha(v) { if (!isFinite(v)) throw new Error("alpha"); }
    };
    const out = W.paintShipRear(g, 100, 100, 40, spec.id, 0.6, 0.8);
    assert.equal(out.engines, spec.engines, spec.id + ": двигателей");
    assert.ok(out.width > 0 && out.height === 40);
    assert.ok(ops.arc >= spec.engines * 2, spec.id + ": сопла не нарисованы");
  });

  // крен и мусор не ломают отрисовку
  [-3, -1, 0, 1, 3, NaN, undefined].forEach((bank) => {
    assert.doesNotThrow(() => {
      const g = new Proxy({}, { get: (t, k) => (k === "createLinearGradient"
        ? () => ({ addColorStop() {} }) : () => {}), set: () => true });
      W.paintShipRear(g, 0, 0, 30, "chi", bank, 0.5);
    }, "крен " + bank);
  });
});

test("спрайт сзади важнее силуэта: один drawImage, пропорции сохранены", () => {
  const calls = [];
  const g = {
    save() {}, restore() {}, translate() {}, rotate() {},
    createLinearGradient: () => ({ addColorStop() {} }),
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {}, ellipse() {},
    fill() {}, stroke() {}, fillRect() {},
    set fillStyle(v) {}, set strokeStyle(v) {}, set lineWidth(v) {}, set globalAlpha(v) {},
    drawImage(sprite, x, y, w, h) { calls.push({ w, h, x, y }); }
  };
  const sprite = { width: 120, height: 80 };
  const out = W.drawWarpShip(g, 500, 400, 40, "pearce-f4", 0.5, 0.9, sprite);
  assert.equal(out.sprite, true);
  assert.equal(calls.length, 1, "спрайт рисуется одним drawImage");
  assert.equal(calls[0].h, 40);
  assert.equal(Math.round(calls[0].w), 60, "пропорции спрайта не должны искажаться");
  // без спрайта идёт процедурный силуэт
  const noSprite = W.drawWarpShip(g, 500, 400, 40, "pearce-f4", 0, 0.9, null);
  assert.equal(noSprite.sprite, undefined);
  assert.equal(W.warpSpaceShipSpec("нет-такого").id, "pearce-f4", "неизвестный корабль -> первый в списке");
});

/* ---------- ревизия 14: 142 BPM, «Пульс», крен корабля ---------- */

test("«Пульс»: при обратном ходе нет отрицательных радиусов (это и ломало кадр)", () => {
  const pulse = W.WARP_SPACE_PROFILES.find((p) => p.id === "pulse");
  const seen = [];
  const g = {
    set strokeStyle(v) { if (typeof v !== "string") throw new Error("strokeStyle"); },
    set lineWidth(v) { if (!isFinite(v) || v < 0) throw new Error("lineWidth " + v); },
    beginPath() {}, stroke() {}, moveTo() {}, lineTo() {}, closePath() {}, save() {}, restore() {},
    translate() {}, rotate() {}, ellipse() {}, fill() {}, fillRect() {},
    createLinearGradient: () => ({ addColorStop() {} }),
    // Настоящий браузер бросает IndexSizeError на отрицательном радиусе.
    arc(x, y, r) {
      if (!isFinite(r) || r < 0) throw new Error("отрицательный радиус " + r);
      if (!isFinite(x) || !isFinite(y)) throw new Error("нечисловой центр");
      seen.push(Number(r.toFixed(2)));
    }
  };
  const point = (d, a) => ({ x: Math.cos(a) * d * 300, y: Math.sin(a) * d * 300 });
  // стенка под «Пульсом» идёт назад: t отрицательное, ровно как в бою
  for (let t = -30; t <= 30; t += 0.37) {
    assert.doesNotThrow(() => W.drawWarpSpacePulse(g, 400, 250, 250, t, pulse, "190,255,255"),
      "пульс упал на t=" + t.toFixed(2));
    assert.doesNotThrow(() => W.drawWarpSpaceRings(g, point, pulse, t, "190,255,255"),
      "кольца упали на t=" + t.toFixed(2));
  }
  assert.ok(seen.length > 100, "пульс должен реально рисовать: " + seen.length);
  assert.ok(seen.every((r) => r > 0), "все радиусы положительные");
});

test("«Пульс»: кольца остаются внутри коридора при любом знаке времени", () => {
  const pulse = W.WARP_SPACE_PROFILES.find((p) => p.id === "pulse");
  const depths = [];
  const point = (d, a) => { depths.push(d); return { x: Math.cos(a) * d * 300, y: Math.sin(a) * d * 300 }; };
  const g = { beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, set strokeStyle(v) {}, set lineWidth(v) {} };
  for (let t = -20; t <= 20; t += 0.5) {
    depths.length = 0;
    W.drawWarpSpaceRings(g, point, pulse, t, "190,255,255");
    assert.ok(depths.every((d) => d >= 0 && d <= 1), "глубина вне 0..1 при t=" + t.toFixed(1));
  }
});

test("142 BPM — точный темп: такт, переход и цикл на сетке", () => {
  const cfg = W.warpSpaceCycleConfig(3, 15, 142);
  assert.equal(cfg.bpm, 142);
  assert.ok(Math.abs(cfg.bar - 240 / 142) < 1e-9, "такт 142 BPM = 240/142");
  assert.ok(Math.abs(cfg.bar - 1.69014) < 1e-4);
  // переход — ровно один такт, остальное — пауза
  assert.ok(Math.abs(cfg.transition - cfg.bar) < 1e-9);
  assert.ok(Math.abs(cfg.period - cfg.transition - cfg.hold) < 1e-9);
  // и цикл ложится в целое число тактов (11 при 142)
  assert.equal(cfg.bars, 11);
  assert.ok(Math.abs(cfg.period - cfg.bars * cfg.bar) < 1e-9, "цикл не кратен такту");
  assert.ok(cfg.period > 17.5 && cfg.period < 19.5, "цикл остался около 18 с: " + cfg.period.toFixed(2));
  // 120 BPM не поехал: прежние 2.00 / 16.00 / 18.00
  const old = W.warpSpaceCycleConfig(3, 15, 120);
  assert.equal(old.transition, 2);
  assert.equal(old.hold, 16);
  assert.equal(old.period, 18);
  // по умолчанию в ядре именно 142
  assert.equal(W.WARP_SPACE_CYCLE.bpm, 142);
});

test("крен корабля: по кольцу ходит и вверх тормашками", () => {
  const deg = (r) => r * 180 / Math.PI;
  // низ кольца — нормальное положение, верх — перевёрнут
  assert.ok(Math.abs(deg(W.warpSpaceShipRollFor(Math.PI / 2, 0))) < 1e-9);
  assert.ok(Math.abs(Math.abs(deg(W.warpSpaceShipRollFor(3 * Math.PI / 2, 0))) - 180) < 1e-9);
  // борт — на боку
  assert.ok(Math.abs(deg(W.warpSpaceShipRollFor(0, 0)) + 90) < 1e-9);
  assert.ok(Math.abs(deg(W.warpSpaceShipRollFor(Math.PI, 0)) - 90) < 1e-9);
  // Q/E добавляют крен сверх кольцевого
  assert.ok(Math.abs(deg(W.warpSpaceShipRollFor(Math.PI / 2, Math.PI / 4)) - 45) < 1e-9);
  assert.ok(Math.abs(deg(W.warpSpaceShipRollFor(Math.PI / 2, -Math.PI / 2)) + 90) < 1e-9);
  // поворот не накапливается бесконечно (иначе через десять кругов будет π*20)
  for (let k = -6; k <= 6; k += 1) {
    const r = W.warpSpaceShipRollFor(Math.PI / 2 + k * Math.PI * 2, 0);
    assert.ok(Math.abs(r) <= Math.PI + 1e-9, "крен вышел за -π..π: " + r);
  }
  // мусор не превращается в NaN
  [NaN, undefined, null, "abc", Infinity].forEach((bad) => {
    const r = W.warpSpaceShipRollFor(bad, bad);
    assert.ok(isFinite(r), "крен не число при " + bad);
  });
});

test("поворот доходит до отрисовки: силуэт вращается целиком", () => {
  const rotations = [];
  const g = {
    save() {}, restore() {}, translate() {},
    rotate(a) { rotations.push(a); },
    createLinearGradient: () => ({ addColorStop() {} }),
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {}, ellipse() {},
    fill() {}, stroke() {}, fillRect() {},
    set fillStyle(v) {}, set strokeStyle(v) {}, set lineWidth(v) {}, set globalAlpha(v) {}
  };
  W.paintShipRear(g, 0, 0, 40, "chi", 0, 0.8, Math.PI);   // вверх тормашками
  assert.equal(rotations.length, 1);
  assert.ok(Math.abs(rotations[0] - Math.PI) < 1e-9, "поворот не дошёл до контекста");
  // без абсолютного крена работает старое поведение (лёгкий крен от руля)
  rotations.length = 0;
  W.paintShipRear(g, 0, 0, 40, "chi", 1, 0.8);
  assert.ok(Math.abs(rotations[0] - 0.28) < 1e-9, "старый крен от руля сломан");
});

/* ---------- ревизия 15: случайный ритм и разнообразие ---------- */

test("случайный ритм: пауза ~2 с, переход ~0.9 с, отрезок ~2.9 с", () => {
  const plan = WS.warpSpaceRandomCyclePlan({}, 200);
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const holds = plan.map((p) => p.hold);
  const trans = plan.map((p) => p.transition);
  assert.ok(Math.abs(mean(holds) - 2) < 0.1, "средняя пауза ~2 с: " + mean(holds).toFixed(3));
  assert.ok(Math.abs(mean(trans) - 0.9) < 0.1, "средний переход ~0.9 с: " + mean(trans).toFixed(3));
  assert.ok(Math.abs(mean(holds) + mean(trans) - 2.9) < 0.15, "отрезок ~2.9 с");
  // переходов в минуту в разы больше, чем на тактовой сетке 142 BPM (3.2)
  const perMinute = 60 / (mean(holds) + mean(trans));
  assert.ok(perMinute > 15, "переходов в минуту: " + perMinute.toFixed(1));
  // при этом пауза не скачет как попало
  assert.ok(Math.min(...holds) > 1.2 && Math.max(...holds) < 2.8, "пауза гуляет: " + Math.min(...holds) + "…" + Math.max(...holds));
});

test("разнообразие: все виды выпадают, подряд не повторяются, сила в диапазоне", () => {
  const ids = WS.warpSpaceTransitionIds();
  const plan = WS.warpSpaceRandomCyclePlan({}, 60);
  const kinds = plan.map((p) => p.kind);
  ids.forEach((id) => assert.ok(kinds.indexOf(id) >= 0, "вид не выпал: " + id));
  kinds.forEach((k, i) => {
    if (i) assert.notEqual(k, kinds[i - 1], "вид повторился подряд на " + i + ": " + k);
  });
  // за каждый круг из ids.length переходов — все виды ровно по разу
  for (let round = 0; round < 5; round += 1) {
    const slice = kinds.slice(round * ids.length, (round + 1) * ids.length);
    assert.equal(new Set(slice).size, ids.length, "круг " + round + " неполный: " + slice.join(","));
  }
  plan.forEach((p) => {
    assert.ok(p.power >= 1 && p.power <= 2.5, "сила вне диапазона: " + p.power);
    assert.ok(Number.isFinite(p.start) && Number.isFinite(p.hold) && Number.isFinite(p.transition));
  });
  // сила действительно разная, а не константа
  assert.ok(new Set(plan.map((p) => p.power.toFixed(2))).size > 20, "сила почти не меняется");
});

test("случайный ритм — чистая функция от elapsed и от seed", () => {
  const a1 = WS.warpSpaceRandomCycleAt(7.31, {});
  const a2 = WS.warpSpaceRandomCycleAt(7.31, {});
  assert.equal(a1.kind, a2.kind);
  assert.equal(a1.k, a2.k);
  assert.equal(a1.from, a2.from);
  // сдвиг времени внутри одного отрезка: k растёт, вид тот же
  const later = WS.warpSpaceRandomCycleAt(7.31 + 0.2, {});
  assert.equal(later.from, a1.from);
  assert.ok(later.k >= a1.k);
  // разный seed — другой порядок видов
  const p1 = WS.warpSpaceRandomCyclePlan({}, 8).map((p) => p.kind).join(",");
  const p2 = WS.warpSpaceRandomCyclePlan({ seed: 777 }, 8).map((p) => p.kind).join(",");
  assert.notEqual(p1, p2, "seed не влияет на порядок видов");
  // смена seed обратно возвращает прежний порядок (кэш не залип)
  assert.equal(WS.warpSpaceRandomCyclePlan({}, 8).map((p) => p.kind).join(","), p1);
});

test("случайный ритм устойчив к мусору, отрицательному и огромному времени", () => {
  [-5, -0.001, 0, 1e-9, 3.7, 999, 100000].forEach((t) => {
    const cs = WS.warpSpaceRandomCycleAt(t, {});
    assert.ok(cs.phase === "hold" || cs.phase === "transition", "фаза: " + cs.phase);
    assert.ok(Number.isFinite(cs.k) && cs.k >= 0 && cs.k <= 1, "k: " + cs.k);
    assert.ok(Number.isFinite(cs.from) && cs.from >= 0, "from: " + cs.from);
    assert.ok(WS.warpSpaceTransitionIds().indexOf(cs.kind) >= 0, "вид: " + cs.kind);
    assert.ok(Number.isFinite(cs.power) && cs.power >= 1 && cs.power <= 2.5, "сила: " + cs.power);
  });
  [null, undefined, NaN, "abc", {}, { hold: -1, transition: 0, seed: "x" }].forEach((bad) => {
    const cs = WS.warpSpaceRandomCycleAt(1.5, bad);
    assert.ok(cs.kind && Number.isFinite(cs.k), "мусор в опциях: " + JSON.stringify(bad));
  });
  // время прибытия: переход не стартует, если не успевает дорисоваться
  const plan = WS.warpSpaceRandomCyclePlan({}, 2);
  const atTransition = plan[0].start + plan[0].hold + 0.01;
  const blocked = WS.warpSpaceRandomCycleAt(atTransition, {}, 0);
  assert.equal(blocked.phase, "hold", "при remaining=0 переход должен быть отменён");
});

test("случайный ритм не привязан к музыкальной сетке", () => {
  // отрезки не кратны такту 142 BPM — это и есть «не надо привязываться»
  const bar = WS.warpSpaceBarSeconds(142);
  const plan = WS.warpSpaceRandomCyclePlan({}, 20);
  const aligned = plan.filter((p) => Math.abs((p.hold + p.transition) / bar - Math.round((p.hold + p.transition) / bar)) < 1e-6);
  assert.equal(aligned.length, 0, "отрезки случайно попали в такты — проверка бессмысленна");
  // и сам период сильно короче прежнего цикла
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  assert.ok(mean(plan.map((p) => p.hold + p.transition)) < 4, "отрезок должен быть ~3 с, а не ~18");
});

/* ---------- ревизия 16: дыры в стенке из-за неверной площади панели ---------- */

test("площадь панели: полная шнуровка не обнуляется на 0° и 180°", () => {
  // Геометрия как в игре: эллиптическое кольцо, 18 панелей.
  const cx = 700, cy = 450, n = 18;
  const rx = (d) => 560 * (1 - d) + 40;
  const ry = (d) => 470 * (1 - d) + 34;
  const P = (d, a) => ({ x: cx + Math.cos(a) * rx(d), y: cy + Math.sin(a) * ry(d) });
  const d0 = 0.45, d1 = 0.45 + 0.96 / 23;
  const rows = [];
  for (let panel = 0; panel < n; panel += 1) {
    const a0 = (panel * 2 * Math.PI) / n;
    const a1 = ((panel + 1) * 2 * Math.PI) / n;
    const p00 = P(d0, a0), p01 = P(d0, a1), p10 = P(d1, a0);
    // старый (сломанный) критерий — один член векторного произведения
    const broken = Math.abs(p01.x - p00.x) * Math.abs(p10.y - p00.y);
    const area = WS.warpSpaceQuadArea(p00, p01, p10);
    rows.push({ panel, broken, area });
    assert.ok(area > 300, "панель " + panel + ": площадь должна быть большой, а не " + area.toFixed(1));
    assert.equal(WS.warpSpacePanelVisible(p00, p01, p10, 1.6), true, "панель " + panel + " не должна отсекаться");
  }
  // именно эти панели старый критерий выбрасывал — отсюда были дыры
  const lost = rows.filter((r) => r.broken < 1.6);
  assert.ok(lost.length >= 2, "старый критерий должен был терять панели на 0°/180°, а потерял " + lost.length);
  assert.ok(lost.some((r) => r.area > 1000), "терялись целые панели, а не субпиксельные");
});

test("площадь панели: субпиксельные всё-таки отсекаются, мусор не ломает", () => {
  const tiny = { x: 10, y: 10 }, tinyB = { x: 10.3, y: 10.2 }, tinyC = { x: 10.1, y: 10.4 };
  assert.equal(WS.warpSpacePanelVisible(tiny, tinyB, tinyC, 1.6), false, "панель 0.3 px должна отсекаться");
  assert.equal(WS.warpSpacePanelVisible(tiny, tinyB, tinyC, 0), true, "при нулевом пороге не отсекаем");
  // вырожденные входы: ноль, а не NaN
  assert.equal(WS.warpSpaceQuadArea(null, tiny, tinyC), 0);
  // NaN в координатах не должен протекать наружу: он приводится к 0,
  // и площадь остаётся конечным числом
  assert.ok(Number.isFinite(WS.warpSpaceQuadArea({ x: NaN, y: 0 }, tiny, tinyC)));
  assert.equal(WS.warpSpaceQuadArea(tiny, tiny, tiny), 0);
  // порядок точек не важен: модуль произведения
  const a = WS.warpSpaceQuadArea({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 6 });
  const b = WS.warpSpaceQuadArea({ x: 0, y: 0 }, { x: 0, y: 6 }, { x: 10, y: 0 });
  assert.equal(a, 60);
  assert.equal(b, 60);
});
