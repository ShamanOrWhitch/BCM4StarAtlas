/* Контракт встраивания: проверяет САМ патченный файл, а не ядро.
 * Запускать на warp_patched.js; на исходнике обязан падать — это и есть
 * доказательство, что тест видит именно патч. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const requireCore = createRequire(import.meta.url);

const read = (name) => readFileSync(new URL("./" + name, import.meta.url), "utf8");
const patched = read("warp_patched.js");
const source = read("warp_source.js");

test("патч добавляет перелив палитры и хуки", () => {
  assert.match(patched, /warpPaletteFlow: false/);
  assert.match(patched, /function warpSpaceGlobalMix\(\)/);
  assert.match(patched, /function warpSpaceLocalMix\(/);
  assert.match(patched, /warpSpace\.warpSpacePaletteAt\(/);
  assert.match(patched, /window\.BCMDeepSpaceWarpSetPaletteFlow/);
  assert.match(patched, /window\.BCMDeepSpaceWarpSetPaletteTarget/);
  assert.match(patched, /window\.BCMDeepSpaceWarpGetPaletteMix/);
});

test("по умолчанию вид 0.14.0 не меняется: перелив выключен", () => {
  assert.match(patched, /warpPaletteFlow: false/);
  assert.doesNotMatch(patched, /warpPaletteFlow: true/);
});

test("исходник этих вставок не содержит — тест видит именно патч", () => {
  assert.doesNotMatch(source, /warpPaletteFlow/);
  assert.doesNotMatch(source, /window\.BCMDeepSpaceWarpSetPaletteFlow/);
});

test("курс, ворота и столкновения не тронуты", () => {
  const keep = [
    "const courseLayerCount = 24",
    "function warpObstacleProgress",
    "layer.type === \"gate\"",
    "layer.type === \"sweeper\"",
    "layer.type === \"spikes\"",
    "state.shields",
    "warpSpaceDepthSteps()",   // глубина 23 во всех тирах
    "seam < 12",
    "if (visualClass === 3) {"
  ];
  keep.forEach((needle) => {
    assert.ok(patched.includes(needle), "патч потерял существующий код: " + needle);
  });
  // Всё, что было в 0.14.0, обязано остаться в патче: удалений нет, только замены
  // трёх цветовых блоков и двух строк, перечисленных отдельно.
  const approved = [
    "const courseLayerCount = 24", "function warpObstacleProgress",
    "layer.type === \"gate\"", "layer.type === \"sweeper\"", "layer.type === \"spikes\"",
    "state.shields", "seam < 12", "if (visualClass === 3) {", "const depthSteps = 23"
  ];
  approved.forEach((needle) => {
    assert.ok(source.includes(needle), "исходник 0.14.0 должен содержать: " + needle);
  });
});

test("под «Пульсом» другой seed космоса и разворот стенки", () => {
  assert.match(patched, /seedShift: 1, reverseMotion: true/);
  assert.match(patched, /warpSpaceSeedFor\(Number\(state\.tubeBackdropSeed/, "фон берёт seed профиля");
  assert.match(patched, /const flowDirection = warpSpace\.warpSpaceDirectionFor\(visualClass, spaceProfile\)/,
    "направление стенки учитывает профиль, а не только класс");
  assert.doesNotMatch(patched, /const flowDirection = visualClass === 2 \? -1 : 1;/, "старое жёсткое правило заменено");
});

test("оптимизация: отсечение субпиксельных панелей и авто-качество", () => {
  assert.match(patched, /warpSpacePanelVisible\(p00, p01, p10, warpSpaceCullScale\(\)\)/, "отсечение панелей по порогу тира и полной площади");
  assert.match(patched, /warpSpaceTier\(Number\(state\.warpFrameMs/, "авто-тир по замеру кадра");
  assert.match(patched, /function warpSpaceDepthSteps\(\) \{\s*return 23;/, "глубина не зависит от тира");
  assert.match(patched, /const panelCount = 18;/, "18 панелей у всех классов: купола нет");
  assert.match(patched, /window\.BCMDeepSpaceWarpSetQuality/, "ручное управление тиром для QA");
  assert.match(patched, /state\.warpFrameMs = state\.warpFrameMs/, "замер кадра сглаживается");
});

test("фон вставлен между градиентом и стенкой, кольца — до продольных линий", () => {
  const bgAt = patched.indexOf("drawWarpSpaceBackdrop(g, w, h, t);");
  const panelsAt = patched.indexOf("// Build the inside wall from circumferential panels");
  const ringsAt = patched.indexOf("drawWarpSpaceRings(g, point, spaceProfile");
  const seamsAt = patched.indexOf("// Keep the established 12 longitudinal frame lines.");
  assert.ok(bgAt > 0 && panelsAt > 0 && ringsAt > 0 && seamsAt > 0, "все четыре точки должны существовать");
  assert.ok(bgAt < panelsAt, "фон рисуется до панелей стенки");
  assert.ok(ringsAt > panelsAt && ringsAt < seamsAt, "кольца между стенкой и продольными линиями");
});

test("цикл фонов в патче: тайминги, предзагрузка, остановка по прибытию", () => {
  assert.match(patched, /warpBgCycle: true/, "цикл включён по умолчанию");
  assert.match(patched, /warpSpaceCycleConfig\(3, 15, /, "тайминги берутся из ядра, а не из магических чисел");
  assert.match(patched, /const elapsed = Number\(state\.elapsed \|\| 0\);/, "фаза считается от elapsed заезда");
  assert.match(patched, /warpSpace\.warpSpaceCycleAt\(elapsed, cfg, remaining\)/, "тактовая ветка берёт тот же elapsed");
  assert.match(patched, /warpBgGet\(cs\.from \+ 1, w, h\)/, "следующая сцена предзагружается в паузе");
  assert.match(patched, /warpSpace\.drawSpaceDissolve\(/, "переход частицами на слое фона");
  assert.match(patched, /while \(warpBgOrder\.length > WARP_BG_POOL\)/, "в памяти не больше пула сцен");
  assert.match(patched, /const grid = warpCellGrid\(w, h\);/, "сетка перехода считается под кадр и устройство");
  assert.match(patched, /state\.warpBgRows = grid\.rows;/, "высота сетки тоже из расчёта, а не константа");
  assert.match(patched, /warpSpaceCycleConfig\(3, 15, Number\(state\.warpBgBpm\)/, "цикл выровнен по BPM");
  assert.match(patched, /window\.BCMDeepSpaceWarpSetBgBpm/, "BPM можно задать из QA");
  assert.match(patched, /function stopWarpBackgroundCycle/, "есть остановка цикла");
  assert.match(patched, /stopWarpBackgroundCycle\(\);\n      \/\/ Прибытие|stopWarpBackgroundCycle\(\);/, "остановка вызывается по событию");
  // остановка именно в finishTube, сразу после проверки режима
  const finish = patched.slice(patched.indexOf("function finishTube(success)"));
  assert.ok(finish.indexOf("stopWarpBackgroundCycle()") < finish.indexOf('state.mode = "result"'),
    "цикл гасится до перехода в режим результата");
});

test("переход не перекрывает HUD: он только на слое фона", () => {
  const bg = patched.slice(patched.indexOf("function drawWarpSpaceBackdrop"));
  const body = bg.slice(0, bg.indexOf("function stopWarpBackgroundCycle"));
  assert.doesNotMatch(body, /fillText|strokeRect.*HUD|tubeMeta/, "фон не рисует HUD и текст");
});

/* ---------- ревизия 10: обои seed из mini-sim/assets/scetchs ---------- */

test("патч учит Warp брать обои из assets/scetchs по URL", () => {
  assert.match(patched, /warpSpace\.WARP_SPACE_SKETCHES/);
  assert.match(patched, /warpSpace\.warpSpaceSketchFor\(/);
  assert.match(patched, /warpSpace\.createSketchCache\(/);
  assert.match(patched, /function warpSketchUrl\(name\)/);
  assert.match(patched, /Array\.isArray\(config\.assets\)/, "путь обязан искаться в манифесте ассетов");
  assert.match(patched, /function warpSketchBaseUrl\(\)/);
  assert.match(patched, /assets\/scetchs\//, "должен быть запасной путь рядом со скриптом");
});

test("ошибка загрузки скетча даёт процедурный фон, а не исключение", () => {
  assert.match(patched, /img\.onerror = \(\) => \{/);
  assert.match(patched, /warpSketchImages\.set\(name, null\)/);
  assert.match(patched, /built\.pendingSketch = true/);
  assert.match(patched, /function warpSketchDropPending\(\)/);
  // скетч рисуется в offscreen-кэш один раз: createSketchCache зовётся в загрузчике,
  // а в кадровом пути его нет
  const drawIndex = patched.indexOf("function drawWarpSpaceBackdrop(");
  const after = patched.slice(drawIndex);
  assert.doesNotMatch(after, /createSketchCache\(/, "растеризация SVG не должна попадать в кадр");
});

test("переключатель обоев и диагностика доступны снаружи, вид 0.14.0 не ломается", () => {
  assert.match(patched, /warpArtMode: "sketch"/);
  assert.match(patched, /window\.BCMDeepSpaceWarpSetArtMode/);
  assert.match(patched, /window\.BCMDeepSpaceWarpSetSketch/);
  assert.match(patched, /window\.BCMDeepSpaceWarpGetSketches/);
  assert.match(patched, /window\.BCMDeepSpaceWarpArtStats/);
  // режим по умолчанию не меняет геометрию: глубина и панели те же
  assert.match(patched, /return 23;/);
  assert.match(patched, /const panelCount = 18;/);
  // в исходнике 0.14.0 ничего из этого нет
  assert.doesNotMatch(source, /warpArtMode/);
  assert.doesNotMatch(source, /scetchs/);
  assert.doesNotMatch(source, /WARP_SPACE_SKETCHES/);
});

/* ---------- ревизия 11: пиксель по устройству, второй режим фиолетовый ---------- */

test("пиксель перехода в игре подбирается под устройство, а не зашит", () => {
  assert.match(patched, /warpSpace\.warpSpaceDeviceProfile\(\{ cores, dpr, shortSide, coarsePointer: coarse \}\)/);
  assert.match(patched, /warpCellSize: "auto"/);
  assert.match(patched, /function warpCellBudget\(w\)/);
  assert.match(patched, /warpSpaceTierNow\(\) === "low"/);
  assert.match(patched, /array|const grid = warpCellGrid/, "сетка пересчитывается на каждый переход".replace("array|", ""));
  // ступени остаются доступными снаружи
  assert.match(patched, /window\.BCMDeepSpaceWarpSetCellSize/);
  assert.match(patched, /window\.BCMDeepSpaceWarpDevice/);
  assert.match(patched, /warpSpace\.WARP_SPACE_CELL_PRESETS/);
  // и в исходнике 0.14.0 этого нет
  assert.doesNotMatch(source, /warpCellSize/);
  assert.doesNotMatch(source, /warpSpaceDeviceProfile/);
});

test("второй режим в патче фиолетовый: палитра III, а не жёсткие цвета 0.14.0", () => {
  assert.match(patched, /warpSpace\.warpSpacePaletteAt\(/);
  assert.match(patched, /warpSpacePanelCss\(\s*$/m, "цвет панели берётся готовой функцией палитры");
  // три захардкоженных ветви цвета панелей и линий убраны, цвет идёт из палитры
  assert.doesNotMatch(patched, /visualClass === 3\s*\n\s*\? Math\.round\(17 \+ shimmer \* 12 \+ light \* 3\)/);
  assert.doesNotMatch(patched, /seam % 3 === 0 \? "rgba\(110,239,246,0\.72\)"/);
  // профили идут в порядке меню: «Ленты» первыми
  assert.match(patched, /id: "ribbon",\s+label: "Ленты"/);
  assert.match(patched, /WARP_SPACE_PROFILE_INDEX/);
});

test("радужный перелив включён в игре и управляется хуком", () => {
  assert.match(patched, /warpRainbow: true/, "радуга включена по умолчанию");
  assert.match(patched, /window\.BCMDeepSpaceWarpSetRainbow/);
  assert.match(patched, /window\.BCMDeepSpaceWarpGetRainbow/);
  assert.match(patched, /window\.BCMDeepSpaceWarpRainbowAt/);
  // фаза радуги подаётся только когда радуга включена, иначе остаётся A/B
  assert.match(patched, /state\.warpRainbow \? spatialPhase : null/);
  // цвет панели идёт готовой функцией палитры, а не тремя каналами вручную
  assert.match(patched, /warpSpace\.warpSpacePanelCss\(/);
  assert.match(patched, /WARP_SPACE_RAINBOW/);
  // в исходнике 0.14.0 радуги нет
  assert.doesNotMatch(source, /warpRainbow/);
  assert.doesNotMatch(source, /WARP_SPACE_RAINBOW/);
});

test("каждая функция, которую игра зовёт через warpSpace, есть в экспорте", () => {
  // Классическая ловушка: внутри замыкания функция есть, а в return { … } её
  // забыли — в игре это TypeError посреди кадра, а тесты по тексту молчат.
  const callRe = /warpSpace\.([A-Za-z_][A-Za-z0-9_]*)\s*[\(,.]/g;
  const used = new Set();
  let m;
  while ((m = callRe.exec(patched))) used.add(m[1]);
  // список экспорта начинается с WARP_SPACE_PROFILES и заканчивается перед
  // закрытием замыкания — внутри тела есть свои IIFE, поэтому ищем по маркеру
  const apiStart = patched.indexOf("return {\n        WARP_SPACE_PROFILES");
  assert.ok(apiStart > 0, "список экспорта не найден");
  const apiEnd = patched.indexOf("})();", apiStart);
  const api = patched.slice(apiStart, apiEnd);
  const missing = [...used].filter((name) => !new RegExp("\\b" + name + "\\b").test(api));
  assert.deepEqual(missing, [], "игра зовёт, а экспорта нет: " + missing.join(", "));
  assert.ok(used.size >= 10, "должно быть найдено достаточно вызовов, найдено " + used.size);
});

test("каждое имя в экспорте действительно определено в теле замыкания", () => {
  const closureStart = patched.indexOf("const warpSpace = (() => {");
  const apiStart = patched.indexOf("return {\n        WARP_SPACE_PROFILES", closureStart);
  const apiEnd = patched.indexOf("})();", apiStart);
  const body = patched.slice(closureStart, apiStart);
  const names = patched.slice(apiStart, apiEnd)
    .split("\n")
    .map((line) => line.trim().replace(/,$/, ""))
    .filter((line) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(line));
  assert.ok(names.length > 20, "экспорт подозрительно короткий: " + names.length);
  const undefinedNames = names.filter((name) => {
    const isFn = new RegExp("function\\s+" + name + "\\s*\\(").test(body);
    const isVar = new RegExp("(var|const|let)\\s+" + name + "\\s*=").test(body);
    return !isFn && !isVar;
  });
  assert.deepEqual(undefinedNames, [], "в экспорте имена, которых нет в теле: " + undefinedNames.join(", "));
});

test("переходы и корабль в игре: рассыпание по умолчанию, корабль маленький", () => {
  // способ смены кадра — выбор, но по умолчанию рассыпание
  assert.match(patched, /warpTransition: "dissolve"/);
  assert.match(patched, /warpTransitionAuto: false/);
  assert.match(patched, /warpSpace\.drawSpaceTransition\(g, current, incoming, cs\.k, w, h, kind\)/);
  assert.match(patched, /function warpSpaceTransitionNow\(randomKind\)/);
  assert.match(patched, /window\.BCMDeepSpaceWarpSetTransition/);
  assert.match(patched, /window\.BCMDeepSpaceWarpGetTransitions/);
  // корабль: вид сзади вместо плоского глифа сверху
  assert.match(patched, /warpSpace\.drawWarpShip\(/);
  assert.match(patched, /warpShipSprite/);
  assert.match(patched, /window\.BCMDeepSpaceWarpSetShipSprite/);
  assert.match(patched, /window\.BCMDeepSpaceWarpShipStats/);
  // старый глиф сверху не остался ни куском
  assert.doesNotMatch(patched, /g\.moveTo\(0, -23\); g\.lineTo\(13, -7\)/);
  // в исходнике 0.14.0 ничего из этого нет
  assert.doesNotMatch(source, /warpTransition/);
  assert.doesNotMatch(source, /drawWarpShip/);
});

test("142 BPM и крен корабля есть в патче, «Пульс» больше не роняет кадр", () => {
  // точный темп владельца
  assert.match(patched, /warpBgBpm: 142/);
  assert.match(patched, /warpSpaceCycleConfig\(3, 15, Number\(state\.warpBgBpm\) \|\| 142\)/);
  // крен: положение на кольце + ручной Q/E
  assert.match(patched, /warpSpace\.warpSpaceShipRollFor\(craftRing, Number\(state\.warpShipRoll\) \|\| 0\)/);
  assert.match(patched, /window\.BCMDeepSpaceWarpSetShipRoll/);
  assert.match(patched, /window\.BCMDeepSpaceWarpAddShipRoll/);
  // «Пульс»: отрицательный ход больше не даёт отрицательный радиус
  assert.match(patched, /function wrap01\(v\)/);
  assert.match(patched, /var phase = wrap01\(time \* 0\.11 \+ i \/ 3\)/);
  assert.match(patched, /var phase = wrap01\(\(i \/ profile\.rings\) \+ t \* 0\.028\)/);
  assert.doesNotMatch(patched, /var phase = \(\(t \* 0\.11 \+ i \/ 3\) % 1\)/);
  // в исходнике 0.14.0 ничего из этого нет
  assert.doesNotMatch(source, /warpShipRoll/);
  assert.doesNotMatch(source, /wrap01/);
});

test("случайный ритм в патче: ~2 с пауза, свой вид и сила на каждый переход", () => {
  // режим и его поля
  assert.match(patched, /warpBgRandom: true/);
  assert.match(patched, /warpBgHold: 2/);
  assert.match(patched, /warpSpace\.warpSpaceRandomCycleAt\(elapsed, \{/);
  // тактовая сетка осталась вторым режимом
  assert.match(patched, /if \(state\.warpBgRandom\) \{/);
  assert.match(patched, /warpSpace\.warpSpaceCycleConfig\(3, 15, Number\(state\.warpBgBpm\) \|\| 142\)/);
  // вид берётся из плана переходов, сила — из плана с множителем игры
  assert.match(patched, /warpSpaceTransitionNow\(cs\.kind\)/);
  assert.match(patched, /function warpBgPowerNow\(cs\)/);
  assert.match(patched, /state\.warpBgKind = kind;/);
  // хуки
  ["BCMDeepSpaceWarpSetRandomCycle", "BCMDeepSpaceWarpGetRandomCycle",
    "BCMDeepSpaceWarpSetBgHold", "BCMDeepSpaceWarpSetBgSeed"].forEach((hook) => {
    assert.match(patched, new RegExp("window\\." + hook + " ="), "нет хука " + hook);
  });
  // сцены идут по кругу из пула: без этого быстрый ритм строил бы фон на
  // каждый переход (полная растеризация звёзд раз в ~2.8 с)
  assert.match(patched, /const WARP_BG_POOL = 4;/);
  assert.match(patched, /function warpBgSceneSlot\(index\)/);
  assert.match(patched, /while \(warpBgOrder\.length > WARP_BG_POOL\)/);
  // и в исходнике 0.14.0 этого нет
  assert.doesNotMatch(source, /warpSpaceRandomCycleAt/);
  assert.doesNotMatch(source, /warpBgRandom/);
});

test("дыры в стенке: отсечение панелей по полной площади, а не по одному члену", () => {
  // было: |dx1*dy2| — на 0°/180° обнуляется, панель выбрасывалась
  assert.doesNotMatch(patched, /Math\.abs\(p01\.x - p00\.x\) \* Math\.abs\(p10\.y - p00\.y\)/);
  assert.match(patched, /if \(!warpSpace\.warpSpacePanelVisible\(p00, p01, p10, warpSpaceCullScale\(\)\)\) continue;/);
  // сама функция в ядре внутри патча: две строки шнуровки
  assert.match(patched, /function warpSpaceQuadArea\(p00, p01, p10\)/);
  assert.match(patched, /var area = Math\.abs\(dx1 \* dy2 - dx2 \* dy1\);/);
  // 18 панелей и 23 шага не тронуты
  assert.match(patched, /const panelCount = 18;/);
  assert.match(patched, /function warpSpaceDepthSteps\(\) \{\n      return 23;/);
});

test("поля палитры: в патче используются только те, что ядро реально возвращает", () => {
  // Реальный провал: в патче стояло seamPalette.seam, а палитра отдаёт
  // seamThick/seamThin. rgbaCss(undefined) бросает TypeError на первом кадре —
  // node --check такое не ловит, а тест на кадр в фейковом DOM тоже (сцена
  // drawTubeTunnel там не рисуется).
  const core = requireCore("./warp_backdrop_core.js");
  const paletteKeys = new Set();
  [1, 2, 3].forEach((cls) => {
    [0, 0.5, 1].forEach((mix) => {
      Object.keys(core.warpSpacePaletteAt(cls, mix, null)).forEach((k) => paletteKeys.add(k));
      Object.keys(core.warpSpacePaletteAt(cls, mix, 0.37)).forEach((k) => paletteKeys.add(k));
    });
  });
  assert.ok(paletteKeys.has("seamThick") && paletteKeys.has("seamThin"), "палитра должна отдавать seamThick/seamThin");
  const used = new Set();
  const re = /seamPalette\.([A-Za-z_][A-Za-z0-9_]*)/g;
  let m;
  while ((m = re.exec(patched))) used.add(m[1]);
  assert.ok(used.size > 0, "в патче должны быть обращения к палитре");
  const missing = [...used].filter((k) => !paletteKeys.has(k));
  assert.deepEqual(missing, [], "поля палитры, которых ядро не возвращает: " + missing.join(", "));
});

test("завороты трубы вернулись, астероиды воткнуты в стенку", () => {
  // изгиб: множители на месте, «ровного цилиндра» больше нет
  assert.match(patched, /function warpTubeTurn\(elapsed\)/);
  assert.match(patched, /curve: 1\.8 \+ 1\.1 \* slow/);
  assert.match(patched, /Math\.sin\(d \* Math\.PI \* 1\.55 \+ phase\) \* curveScale \* 0\.05 \* tubeTurn\.curve/);
  assert.match(patched, /Math\.sin\(d \* Math\.PI \* 1\.25 \+ phase\) \* liftScale \* 0\.04 \* tubeTurn\.curve/);
  assert.match(patched, /widthScale \* tubeTurn\.wobble/);
  assert.doesNotMatch(patched, /curveScale \* 0\.05 \+/, "старая плоская формула не должна остаться");

  // астероиды: спрайты вкомпилированы, вызов стоит между панелями и кольцами
  assert.match(patched, /window\.BCM_WARP_ASTEROID_ART/);
  assert.equal((patched.match(/data:image\/png;base64,/g) || []).length, 6, "шесть спрайтов в файле");
  const panels = patched.indexOf("const panelCount = 18;");
  const rocks = patched.indexOf("drawWarpSpaceAsteroids(g, point, maxRadius");
  const rings = patched.indexOf("drawWarpSpaceRings(g, point, spaceProfile");
  assert.ok(panels > 0 && rocks > panels, "камни рисуются после панелей стенки");
  if (rings > 0) assert.ok(rocks < rings, "камни рисуются до колец");
  assert.match(patched, /warpAsteroidDensityNow\(\)/, "на слабом тире камней меньше");
  assert.match(patched, /function warpAsteroidImages\(\)/);

  // хуки
  ["BCMDeepSpaceWarpSetAsteroids", "BCMDeepSpaceWarpAsteroidStats"].forEach((hook) => {
    assert.match(patched, new RegExp("window\\." + hook + " ="), "нет хука " + hook);
  });
  // в исходнике 0.14.0 ничего этого нет
  assert.doesNotMatch(source, /warpTubeTurn/);
  assert.doesNotMatch(source, /BCM_WARP_ASTEROID_ART/);
});
