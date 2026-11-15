#!/usr/bin/env python3
"""Собирает патч для mini-sim/assets/js/deep-space-warp.js из канонического ядра.

Ядро (warp_backdrop_core.js) — единственный источник. Скрипт:
  1) вставляет ядро в closure файла прямо перед drawTubeTunnel(),
  2) подключает фон, кольца, пульс и ленты в существующие точки рисования,
  3) добавляет два поля состояния (seed фона) и одну строку в showTube(),
  4) проверяет результат через `node --check`,
  5) выпускает unified diff и проверяет его применимость `git apply --check`.

Исходник для патча: raw main @ 40d8a7b298c20ad8f1b02350b2bdba9da59c5e7f.
"""
from pathlib import Path
import subprocess
import sys

HERE = Path(__file__).resolve().parent
CORE = HERE / "warp_backdrop_core.js"
SRC = HERE / "warp_source.js"
OUT = HERE / "warp_patched.js"
PATCH = HERE / "warp_space.patch"
HEAD_SHA = "40d8a7b298c20ad8f1b02350b2bdba9da59c5e7f"

core = CORE.read_text(encoding="utf-8")
SKETCH_LOADER = (HERE / "warp_sketch_loader.js").read_text(encoding="utf-8")

BG_GET_OLD = """
    function warpBgGet(index, w, h) {
      const key = warpBgKey(index, w, h);
      const cached = warpBgStore.get(key);
      if (cached) { warpBgTouch(key); return cached; }
      const profile = warpSpaceProfile();
      const base = warpSpace.warpSpaceSeedFor(Number(state.tubeBackdropSeed || 0) >>> 0, profile);
      const seed = warpSpace.warpSpaceNextSeed(base, index);
      const built = warpSpace.createSpaceBackdropCache(w, h, seed, profile, (cw, ch) => {
        const canvas = document.createElement("canvas");
        canvas.width = cw;
        canvas.height = ch;
        return canvas;
      });
      built.key = key;
"""

BG_GET_NEW = """
    function warpBgGet(index, w, h) {
      const sketchMode = state.warpArtMode !== "procedural";
      const key = warpBgKey(index, w, h) + "|" + (sketchMode ? "sk" : "pr");
      const cached = warpBgStore.get(key);
      if (cached) { warpBgTouch(key); return cached; }
      const profile = warpSpaceProfile();
      const makeCanvas = (cw, ch) => {
        const canvas = document.createElement("canvas");
        canvas.width = cw;
        canvas.height = ch;
        return canvas;
      };
      const sketchName = sketchMode ? warpSketchName(index) : null;
      let built = sketchName ? warpSketchScene(sketchName, w, h) : null;
      if (!built) {
        const base = warpSpace.warpSpaceSeedFor(Number(state.tubeBackdropSeed || 0) >>> 0, profile);
        const seed = warpSpace.warpSpaceNextSeed(base, index);
        built = warpSpace.createSpaceBackdropCache(w, h, seed, profile, makeCanvas);
        // Пока SVG в пути — процедурный фон уже на экране, кадр не пустует.
        // Если файла нет вовсе, флаг не ставится и пересборки не будет.
        if (sketchName && warpSketchLoading.has(sketchName)) built.pendingSketch = true;
      }
      built.key = key;
"""

# --- 1. ядро -> локальный объект warpSpace внутри closure файла ---------------
start = core.index("  /* ---------------------------------------------------------------- profiles")
end = core.index("  var api = {")
body = core[start:end].rstrip() + "\n"

wrapper = """
    // ---------------------------------------------------------------------
    // WARP SPACE — декоративный слой Canvas 2D (фон космоса, кольца, ленты,
    // пульс). Ничего не читает и не меняет в курсе, столкновениях, скорости,
    // щитах, тайминге, управлении и звуке. Удаление блока = только пиксели.
    // ---------------------------------------------------------------------
    const warpSpace = (() => {
""" + body + """
      return {
        WARP_SPACE_PROFILES,
        warpSpaceProfileFor,
        warpSpaceQuality,
        paintSpaceBackdrop,
        createSpaceBackdropCache,
        drawSpaceBackdrop,
        drawWarpSpaceRings,
        drawWarpSpacePulse,
        warpSpacePaletteAt,
        warpSpaceFlowMix,
        warpSpacePingPong,
        warpSpacePanelCss,
        warpSpacePanelRgb,
        warpSpaceSeamCss,
        warpSpaceAccentCss,
        warpSpaceRingRgb,
        warpSpaceSeedFor,
        warpSpaceNextSeed,
        warpSpaceDirectionFor,
        warpSpaceDirectionRamp,
        warpSpaceTier,
        warpSpaceTierParams,
        warpSpaceCycleConfig,
        warpSpaceCycleAt,
        WARP_SPACE_RANDOM,
        warpSpaceRandomCycleAt,
        warpSpaceRandomCyclePlan,
        WARP_SPACE_ASTEROIDS,
        WARP_SPACE_ASTEROID_SLOTS,
        warpSpaceAsteroidIds,
        warpSpaceAsteroidSizeOf,
        warpSpaceAsteroidField,
        warpSpaceAsteroidRadius,
        drawWarpSpaceAsteroids,
        warpSpaceCellField,
        warpSpaceQuadArea,
        warpSpacePanelVisible,
        drawSpaceDissolve,
        WARP_SPACE_DISSOLVE,
        warpSpaceDissolveBudget,
        warpSpaceDissolveFrameCap,
        WARP_SPACE_TRANSITIONS,
        warpSpaceTransitionIds,
        warpSpaceTransitionFor,
        drawSpaceWipe,
        drawSpaceTransition,
        WARP_SPACE_SHIP_SPECS,
        warpSpaceShipSpec,
        warpSpaceShipSize,
        paintShipRear,
        drawWarpShip,
        warpSpaceShipRollFor,
        warpSpaceCellGrid,
        warpSpaceDeviceProfile,
        WARP_SPACE_CELL_PRESETS,
        WARP_SPACE_SKETCHES,
        warpSpaceSketchFor,
        warpSpaceCoverRect,
        createSketchCache,
        rgbCss,
        rgbaCss
      };
    })();

    let warpSpaceCache = null;

    function warpSpaceProfile() {
      return warpSpace.warpSpaceProfileFor(
        activeWarpVisualClass(),
        Number(state.tubeBackdropSeed || 0) >>> 0
      );
    }

    function warpSpaceRingTint() {
      const cls = activeWarpVisualClass();
      return cls === 3 ? "189,139,246" : cls === 2 ? "115,193,206" : "122,232,255";
    }

    function warpSpacePulseTint() {
      return activeWarpVisualClass() === 3 ? "230,205,255" : "190,255,255";
    }

    // Фон рисуется один раз в offscreen-canvas и потом только копируется:
    // перерисовка градиентов и 240 звёзд каждый кадр — это и есть просадка
    // на слабом Android, а не сам blit.
    // Палитра: не переключение, а непрерывный перелив A <-> B. В каждой точке
    // стенки локальный mix опережает общий, поэтому смена цвета бежит волной —
    // тот же приём, что перелив текстуры на Rainbow Photoli.
    function warpSpaceGlobalMix() {
      if (!state.warpPaletteFlow) return Number(state.warpPaletteMix || 0);
      return warpSpace.warpSpacePingPong(state.elapsed, Number(state.warpPalettePeriod) || 11);
    }

    function warpSpaceLocalMix(spatialPhase) {
      // Волна только в режиме перелива. При закреплённой палитре mix равен цели
      // ровно, поэтому вид A воспроизводит 0.14.0 бит в бит.
      if (!state.warpPaletteFlow) return warpSpaceGlobalMix();
      return warpSpace.warpSpaceFlowMix(warpSpaceGlobalMix(), spatialPhase, state.elapsed, 0.22);
    }

    function warpSpacePalette(spatialPhase) {
      // Радуга включена по умолчанию: цвет берётся с цветового круга, фаза
      // сдвигается вдоль поверхности — полосы переливаются по стенке, а не
      // переключаются в один момент. Выключенная радуга возвращает переход
      // A <-> B, то есть при mix 0 — ровно вид 0.14.0.
      return warpSpace.warpSpacePaletteAt(
        activeWarpVisualClass(),
        warpSpaceLocalMix(spatialPhase),
        state.warpRainbow ? spatialPhase : null
      );
    }

    // Тир качества: если кадр стабильно дороже 22 мс, режем глубину стенки.
    // Порог и параметры — в ядре, здесь только сглаживание замера.
    function warpSpaceTierNow() {
      if (state.warpQualityTier) return state.warpQualityTier;
      return warpSpace.warpSpaceTier(Number(state.warpFrameMs || 0), Number(state.warpSlowStreak || 0));
    }

    // Глубина и число панелей НЕ зависят от тира: урезание ломало силуэт
    // (гранёная «бочка», потом «купол» на классе III). Экономия — только
    // отсечением субпиксельных панелей и разрешением фона.
    // ---------------------------------------------- астероиды на стенке
    // Спрайты уже вкомпилированы (window.BCM_WARP_ASTEROID_ART) — это печёные
    // кадры настоящих GLB из mini-sim/assets/mesh/asteroid_variety. Здесь их
    // только декодируем один раз: в кадре остаётся один drawImage на камень,
    // никакого GLTFLoader и второго WebGL-контекста.
    const warpAsteroidImageCache = new Map();
    let warpAsteroidReadyMap = null;

    function warpAsteroidArt() {
      return (typeof window !== "undefined" && window.BCM_WARP_ASTEROID_ART) || {};
    }

    function warpAsteroidImages() {
      const art = warpAsteroidArt();
      const ids = Object.keys(art);
      if (!ids.length) return null;
      let allReady = true;
      ids.forEach((id) => {
        let img = warpAsteroidImageCache.get(id);
        if (!img) {
          img = new Image();
          img.src = art[id];
          warpAsteroidImageCache.set(id, img);
        }
        if (!(img.complete && img.naturalWidth > 0)) allReady = false;
      });
      if (allReady && !warpAsteroidReadyMap) {
        warpAsteroidReadyMap = {};
        warpAsteroidImageCache.forEach((img, id) => {
          if (img && img.complete && img.naturalWidth > 0) warpAsteroidReadyMap[id] = img;
        });
      }
      return warpAsteroidReadyMap;
    }

    // ------------------------------------------------- завороты трубы
    // Вернули изгиб: амплитуда была срезана «на глаз» до 0.05, и стенка
    // читалась ровным цилиндром. Медленная волна даёт длинные завороты
    // (период ~14 с), вторая — короткое «дыхание» сечения.
    function warpTubeTurn(elapsed) {
      const e = Number(elapsed) || 0;
      const slow = Math.sin(e * 0.45) * 0.6 + Math.sin(e * 0.19 + 1.7) * 0.4;
      return {
        curve: 1.8 + 1.1 * slow,
        wobble: 1 + 0.06 * Math.sin(e * 0.33 + 0.6)
      };
    }

    // Плотность поля: на слабом тире камней вдвое меньше (они дороже панелей —
    // это drawImage 80–160 px, а не заливка полигона).
    function warpAsteroidDensityNow() {
      const base = Math.max(0, Math.min(1, Number(state.warpAsteroids) || 0));
      return warpSpaceTierNow() === "low" ? base * 0.55 : base;
    }

    function warpSpaceDepthSteps() {
      return 23;
    }

    function warpSpaceCullScale() {
      return warpSpace.warpSpaceTierParams(warpSpaceTierNow()).cullScale;
    }

    // ---------------------------------------------------------- устройство
    // Пиксель перехода и разрешение канвы подбираются под железо, а не
    // выдаются всем одинаково: телефон с DPR 3 — это 3 млн пикселей на кадр
    // ни за что, а ПК зря получал грубую мозаику 18x10.
    const warpDevice = (() => {
      let cores = 0;
      let coarse = false;
      try {
        if (typeof navigator !== "undefined" && navigator.hardwareConcurrency) {
          cores = Number(navigator.hardwareConcurrency) || 0;
        }
        if (typeof window !== "undefined" && window.matchMedia) {
          coarse = !!window.matchMedia("(pointer: coarse)").matches;
        }
      } catch (e) {}
      const dpr = typeof window !== "undefined" && window.devicePixelRatio ? window.devicePixelRatio : 1;
      const shortSide = typeof window !== "undefined"
        ? Math.min(Number(window.innerWidth) || 0, Number(window.innerHeight) || 0)
        : 0;
      return warpSpace.warpSpaceDeviceProfile({ cores, dpr, shortSide, coarsePointer: coarse });
    })();

    // Ручная ступень из хука; null = авто по профилю устройства.
    function warpCellBudget(w) {
      const preset = warpSpace.WARP_SPACE_CELL_PRESETS[String(state.warpCellSize || "")];
      let budget = typeof preset === "number" ? preset : warpDevice.cellBudget;
      if (warpSpaceTierNow() === "low") {
        budget = Math.min(budget, warpSpace.WARP_SPACE_CELL_PRESETS.coarse);
      }
      return budget;
    }

    // Ревизия 19: «частицы рассыпания в 23 раза мельче» — считаем по площади,
    // то есть клеток ровно в 23 раза больше (клетка ~3 px вместо ~15). Меньше
    // 3 px уже упирается в warpSpaceCellGrid, поэтому дальше не мельчим.
    function warpDissolveBudget() {
      return warpSpace.warpSpaceDissolveBudget(warpCellBudget());
    }

    // Потолок отрисовки за кадр: переполненная сетка дорисовывается долями по
    // номеру кадра, на слабом тире доля меньше — иначе кадр не влезает.
    function warpDissolveFrameCap() {
      return warpSpace.warpSpaceDissolveFrameCap(warpSpaceTierNow());
    }

    function warpCellGrid(w, h) {
      return warpSpace.warpSpaceCellGrid(warpDissolveBudget(), w, h);
    }

    // ------------------------------------------------- способ смены кадра
    // Приоритет — рассыпание (по указанию владельца). Остальные виды — как
    // двери в первой комнате: каждый переход может открываться по-своему.
    function warpSpaceTransitionNow(randomKind) {
      if (state.warpTransitionAuto) {
        // Случайный ритм уже выбрал вид за нас — главнее «по кругу».
        if (state.warpBgRandom && randomKind &&
            warpSpace.warpSpaceTransitionIds().indexOf(randomKind) >= 0) {
          return randomKind;
        }
        // step начинается с 1 (первый переход), индекс — с 0
        return warpSpace.warpSpaceTransitionFor(Math.max(0, Number(state.warpTransitionStep || 1) - 1));
      }
      const want = String(state.warpTransition || "dissolve");
      return warpSpace.warpSpaceTransitionIds().indexOf(want) >= 0 ? want : "dissolve";
    }

    // -------------------------------------------------- корабль, вид сзади
    // Маленький силуэт внутри кольца. Если игра передала запечённый спрайт
    // настоящей модели (BCMDeepSpaceWarpSetShipSprite), рисуется он: в кадре
    // это один drawImage, второй WebGL-контекст не создаётся.
    // Размеры кадра: во время отрисовки они приходят из drawTubeTunnel, а при
    // вызове хука снаружи берутся из window. Без этого хук падал бы с
    // ReferenceError на w/h — ровно тот класс ошибки, что ловят новые стражи.
    function warpFrameSize() {
      const fw = Number(state.warpW || (typeof window !== "undefined" ? window.innerWidth : 800)) || 800;
      const fh = Number(state.warpH || (typeof window !== "undefined" ? window.innerHeight : 500)) || 500;
      return { w: fw, h: fh };
    }

    function warpShipInfo() {
      const spec = warpSpace.warpSpaceShipSpec(state.warpShipSpec);
      const frame = warpFrameSize();
      const size = warpSpace.warpSpaceShipSize(frame.w, frame.h) * (Number(state.warpShipScale) || 1);
      return {
        spec: spec.id,
        engines: spec.engines,
        sprite: !!state.warpShipSprite,
        roll: Number(state.warpShipRollShown || 0),
        manualRoll: Number(state.warpShipRoll || 0),
        size: Math.round(size)
      };
    }

    function drawWarpShipLayer(g, x, y, bank, thrust, roll) {
      const frame = warpFrameSize();
      const size = warpSpace.warpSpaceShipSize(frame.w, frame.h) * (Number(state.warpShipScale) || 1);
      warpSpace.drawWarpShip(g, x, y, size, state.warpShipSpec, bank, thrust,
        state.warpShipSprite || null, roll);
      return size;
    }

    // Кэш фоновых сцен. Ритм смены кадра быстрый (~2 с пауза), поэтому сцены
    // идут по кругу из пула: строить полноэкранный фон на каждый переход —
    // заметный рывок на слабом Android. Пул 4: текущая, следующая и две под
    // переиспользование. Разнообразие даёт способ перехода и сила, а не
    // бесконечная генерация новых звёзд.
    const WARP_BG_POOL = 4;
    const warpBgStore = new Map();
    const warpBgOrder = [];
    let warpBgCreated = 0;

    function warpBgSceneSlot(index) {
      const i = Number(index) || 0;
      return ((i % WARP_BG_POOL) + WARP_BG_POOL) % WARP_BG_POOL;
    }

    function warpBgKey(index, w, h) {
      const profile = warpSpaceProfile();
      const seed = warpSpace.warpSpaceSeedFor(Number(state.tubeBackdropSeed || 0) >>> 0, profile);
      return warpBgSceneSlot(index) + "|" + seed + "|" + profile.id + "|" + Math.round(w) + "x" + Math.round(h) +
        "|" + warpSpaceTierNow();
    }

    function warpBgTouch(key) {
      const at = warpBgOrder.indexOf(key);
      if (at >= 0) warpBgOrder.splice(at, 1);
      warpBgOrder.push(key);
    }

    function warpBgGet(index, w, h) {
      const key = warpBgKey(index, w, h);
      const cached = warpBgStore.get(key);
      if (cached) { warpBgTouch(key); return cached; }
      const profile = warpSpaceProfile();
      const base = warpSpace.warpSpaceSeedFor(Number(state.tubeBackdropSeed || 0) >>> 0, profile);
      const seed = warpSpace.warpSpaceNextSeed(base, index);
      const built = warpSpace.createSpaceBackdropCache(w, h, seed, profile, (cw, ch) => {
        const canvas = document.createElement("canvas");
        canvas.width = cw;
        canvas.height = ch;
        return canvas;
      });
      built.key = key;
      warpBgCreated += 1;
      warpBgStore.set(key, built);
      warpBgTouch(key);
      while (warpBgOrder.length > WARP_BG_POOL) {
        const oldest = warpBgOrder.shift();
        if (oldest !== key) warpBgStore.delete(oldest);
      }
      return built;
    }

    function warpBgReset() {
      warpBgStore.clear();
      warpBgOrder.length = 0;
      state.warpBgCells = null;
    }

    // Текущий отрезок ритма: случайный (по умолчанию) либо тактовая сетка.
    // Обе ветки возвращают одинаковый набор полей, поэтому кадр ниже один.
    function warpBgCycleState(remaining) {
      const elapsed = Number(state.elapsed || 0);
      if (state.warpBgRandom) {
        return warpSpace.warpSpaceRandomCycleAt(elapsed, {
          seed: Number(state.warpBgSeed || 0),
          hold: Number(state.warpBgHold) || 2
        }, remaining);
      }
      const cfg = warpSpace.warpSpaceCycleConfig(3, 15, Number(state.warpBgBpm) || 142);
      const cs = warpSpace.warpSpaceCycleAt(elapsed, cfg, remaining);
      cs.kind = null;
      cs.power = Number(state.warpBgPower) || 1.6;
      return cs;
    }

    // Сила перехода: в случайном ритме она тоже своя на каждый переход, но
    // общий регулятор игры (warpBgPower) остаётся главным — он множитель.
    function warpBgPowerNow(cs) {
      const base = Number(state.warpBgPower) || 1.6;
      if (!state.warpBgRandom || !cs || !isFinite(cs.power)) return base;
      const scaled = Number(cs.power) * (base / 1.6);
      return Math.max(0.6, Math.min(3, scaled));
    }

    // Декоративный фон живёт своим циклом: 3 с переход частицами, 4,5 с пауза.
    // Переход не начинается, если до прибытия он не успеет дорисоваться.
    function drawWarpSpaceBackdrop(g, w, h, t) {
      const remaining = Math.max(0, WARP_DURATION - Number(state.elapsed || 0));
      // Номер кадра нужен рассыпанию: при переполненной сетке оно рисует долю
      // клеток, и без счётчика одна и та же доля повторялась бы каждый кадр.
      state.warpFrameNo = (Number(state.warpFrameNo || 0) + 1) % 100000;

      if (!state.warpBgCycle) {
        warpSpace.drawSpaceBackdrop(g, warpBgGet(Number(state.warpBgIndex || 0), w, h), w, h, t);
        return;
      }

      // Ритм сцены. По умолчанию — СЛУЧАЙНЫЙ: пауза ~2 с, переход ~0.9 с, и
      // каждый переход берёт свой способ из всех шести (случайный «мешок» без
      // повторов подряд) и свою силу. Тактовую сетку (142 BPM) владелец оставил
      // вторым режимом: BCMDeepSpaceWarpSetRandomCycle(false).
      const cs = warpBgCycleState(remaining);
      const current = warpBgGet(cs.from, w, h);

      if (cs.phase === "hold") {
        warpBgGet(cs.from + 1, w, h);            // предзагрузка в паузе
        warpSpace.drawSpaceBackdrop(g, current, w, h, t);
        state.warpBgIndex = cs.from;
        state.warpBgCells = null;
        return;
      }

      const incoming = warpBgGet(cs.to, w, h);
      const low = warpSpaceTierNow() === "low";
      // Шаг «по кругу» считается по входу в переход: каждый новый переход —
      // следующая дверь, как в первой комнате. Последовательность детерминированная.
      if (state.warpTransitionFrom !== cs.to) {
        state.warpTransitionFrom = cs.to;
        state.warpTransitionStep = Number(state.warpTransitionStep || 0) + 1;
      }
      const kind = warpSpaceTransitionNow(cs.kind);
      state.warpBgKind = kind;
      if (kind !== "dissolve") {
        // Остальные виды — clip + 1–2 drawImage: дешевле рассыпания.
        warpSpace.drawSpaceTransition(g, current, incoming, cs.k, w, h, kind);
        state.warpBgIndex = cs.to;
        state.warpBgCells = null;
        return;
      }
      if (!state.warpBgCells) {
        // Пиксель перехода считается под кадр и под устройство, а в ревизии 19
        // ещё и мельче в 23 раза по площади: на ПК это ~437x273 клетки (клетка
        // 3.3 px), на телефоне ~44x94, на слабом — ещё грубее. Рисуется такая
        // сетка долями за кадр (warpSpaceDissolveFrameCap), поэтому снаружи
        // видна не мозаика 15 px, а мелкое рассыпание, собирающееся за ~10
        // кадров. Сетка пересчитывается на каждый переход, поэтому смена
        // размера окна или тира не оставляет старую.
        const grid = warpCellGrid(w, h);
        state.warpBgCells = warpSpace.warpSpaceCellField(grid.cols, grid.rows, cs.from * 7919 + cs.to);
        state.warpBgCols = grid.cols;
        state.warpBgRows = grid.rows;
      }
      warpSpace.drawSpaceDissolve(g, current, incoming, cs.k, w, h,
        state.warpBgCells, state.warpBgCols, state.warpBgRows, low ? 0.35 : 1,
        warpBgPowerNow(cs), state.warpFrameNo, warpDissolveFrameCap());
      state.warpBgIndex = cs.to;
    }

    // Остановка по РЕАЛЬНОМУ событию прибытия: finishTube() переводит режим из
    // tube, после чего фон больше не цикличный и таймер не запускается.
    function stopWarpBackgroundCycle() {
      state.warpBgCycle = false;
      state.warpBgCells = null;
      warpBgReset();
    }

"""

ASTEROID_ART = ""
_art_path = Path(__file__).with_name("asteroids_base64.js")
if _art_path.exists():
    # Берём только тело объекта: строки "id": "data:..." между { и };
    _raw = _art_path.read_text(encoding="utf-8")
    _body = _raw[_raw.index("{") + 1: _raw.rindex("}")]
    _pairs = [ln.strip().rstrip(",") for ln in _body.strip().splitlines() if ln.strip()]
    ASTEROID_ART = (
        "    // Спрайты астероидов: испечены из настоящих GLB\n"
        "    // mini-sim/assets/mesh/asteroid_variety (large/medium/small).\n"
        "    // Печём заранее, потому что слой варпа — Canvas 2D и второй\n"
        "    // WebGL-контекст на слабом Android не нужен.\n"
        "    window.BCM_WARP_ASTEROID_ART = window.BCM_WARP_ASTEROID_ART || {};\n"
        "    Object.assign(window.BCM_WARP_ASTEROID_ART, {\n"
        + ",\n".join("      " + pair for pair in _pairs)
        + "\n    });\n\n"
    )


def apply(text: str) -> str:
    """Пять хирургических вставок. Каждый анкер обязан встретиться ровно один раз."""

    def once(anchor: str, replacement: str) -> None:
        nonlocal text
        hits = text.count(anchor)
        if hits != 1:
            raise SystemExit(f"анкер встречается {hits} раз, нужен ровно 1: {anchor[:70]!r}")
        text = text.replace(anchor, replacement)

    # (1) состояние: seed фона, детерминированный на каждый заезд
    once(
        "      warpPreviewClass: null,\n",
        "      warpPreviewClass: null,\n      // Seed, из которого строится декоративный фон (не влияет на курс).\n      tubeBackdropSeed: 0,\n",
    )

    # (2) showTube: тот же seed, что уже считается для курса
    once(
        "      const rng = randomFrom(warpRunSeed);\n",
        "      state.tubeBackdropSeed = warpRunSeed;\n      const rng = randomFrom(warpRunSeed);\n",
    )

    # (2b) поля палитры
    once(
        "      tubeBackdropSeed: 0,\n",
        "      tubeBackdropSeed: 0,\n"
        "      // Перелив палитры: по умолчанию выключен, вид 0.14.0 сохраняется.\n"
        "      warpPaletteFlow: false,\n"
        "      warpPaletteMix: 0,\n"
        "      warpPaletteTarget: 0,\n"
        "      warpPalettePeriod: 11,\n"
        "      // Качество рисуемой стенки: null = авто по замеру кадра.\n"
        "      warpQualityTier: null,\n"
        "      warpFrameMs: 0,\n"
        "      warpSlowStreak: 0,\n"
        "      // Сглаженный множитель направления: 1 = вперёд, -1 = назад.\n"
        "      warpDirMix: 1,\n"
        "      // Цикл фоновых сцен: выровнен по тактам, ~18 с (2 с переход + 16 с пауза).\n"
        "      // 142 BPM — точный темп от владельца; такт 1.6901 с, цикл 11 тактов.\n"
        "      warpBgBpm: 142,\n"
        "      // Ритм сцены: случайный по умолчанию — пауза ~2 с, переход ~0.9 с,\n"
        "      // каждый переход свой (вид, сила, следующая сцена). Тактовая сетка\n"
        "      // осталась вторым режимом: BCMDeepSpaceWarpSetRandomCycle(false).\n"
        "      warpBgRandom: true,\n"
        "      warpBgHold: 2,\n"
        "      warpBgSeed: 0x5F3A21C7,\n"
        "      warpBgPower: 1.6,\n"
        "      // Астероиды на стенке: плотность 0..1 (0 — выключить), seed поля.\n"
        "      warpAsteroids: 1,\n"
        "      warpAsteroidSeed: 20261116,\n"
        "      warpBgCycle: true,\n"
        "      warpBgIndex: 0,\n"
        "      warpBgCells: null,\n"
        "      // Обои seed: 'sketch' — векторные скетчи из assets/scetchs, 'procedural' —\n"
        "      // генерация. При отсутствии файла скетч сам падает в процедурный фон.\n"
        "      // Радужный перелив вместо перехода между двумя наборами цветов.\n"
        "      warpRainbow: true,\n"
        "      // Чем сменяется кадр фона: 'dissolve' — рассыпание (по умолчанию),\n"
        "      // либо другой вид двери: iris / doors / blinds / spiral / sweep.\n"
        "      warpTransition: \"dissolve\",\n"
        "      warpTransitionAuto: false,\n"
        "      warpTransitionStep: 0,\n"
        "      warpTransitionFrom: -1,\n"
        "      // Корабль: вид сзади. Спрайт (если игра его запечёт) важнее силуэта.\n"
        "      warpShipSprite: null,\n"
        "      warpShipSpec: \"pearce-f4\",\n"
        "      // Ручной крен корабля (Q/E в третьем лице): радианы сверх кольцевого.\n"
        "      warpShipRoll: 0,\n"
        "      warpShipScale: 1,\n"
        "      // Пиксель перехода: \"auto\" — по профилю устройства (ПК мельче, телефон крупнее).\n"
        "      warpCellSize: \"auto\",\n"
        "      warpArtMode: \"sketch\",\n"
        "      warpSketch: null,\n",
    )

    # (2c) публичные хуки для детерминированной проверки визуала
    once(
        "    window.BCMDeepSpaceWarpGetPreviewClass = () => Number(state.warpPreviewClass) || null;\n",
        "    window.BCMDeepSpaceWarpGetPreviewClass = () => Number(state.warpPreviewClass) || null;\n"
        "    // Перелив палитры A <-> B: вкл/выкл и период в секундах.\n"
        "    window.BCMDeepSpaceWarpSetPaletteFlow = (on, period) => {\n"
        "      state.warpPaletteFlow = !!on;\n"
        "      if (period) state.warpPalettePeriod = Math.max(2, Number(period) || 11);\n"
        "    };\n"
        "    window.BCMDeepSpaceWarpSetPaletteTarget = (value) => {\n"
        "      state.warpPaletteTarget = Math.max(0, Math.min(1, Number(value) || 0));\n"
        "      if (!state.warpPaletteFlow) state.warpPaletteMix = state.warpPaletteTarget;\n"
        "    };\n"
        "    window.BCMDeepSpaceWarpGetPaletteMix = () => Number(warpSpaceGlobalMix());\n"
        "    // Радужный перелив: полный цветовой круг вместо одного перехода A <-> B.\n"
        "    window.BCMDeepSpaceWarpSetRainbow = (on) => { state.warpRainbow = !!on; };\n"
        "    // Способ смены кадра: id вида, либо 'auto' — по кругу, как двери в первой комнате.\n"
        "    window.BCMDeepSpaceWarpSetTransition = (kind) => {\n"
        "      const want = String(kind || \"dissolve\");\n"
        "      if (want === \"auto\") {\n"
        "        state.warpTransitionAuto = true;\n"
        "      } else if (warpSpace.warpSpaceTransitionIds().indexOf(want) >= 0) {\n"
        "        state.warpTransitionAuto = false;\n"
        "        state.warpTransition = want;\n"
        "      }\n"
        "      state.warpBgCells = null;\n"
        "      return warpSpaceTransitionNow();\n"
        "    };\n"
        "    window.BCMDeepSpaceWarpGetTransition = () => warpSpaceTransitionNow();\n"
        "    window.BCMDeepSpaceWarpGetTransitions = () => warpSpace.warpSpaceTransitionIds();\n"
        "    // Корабль сзади: настоящий запечённый спрайт важнее процедурного силуэта.\n"
        "    window.BCMDeepSpaceWarpSetShipSprite = (source) => {\n"
        "      if (!source) { state.warpShipSprite = null; return false; }\n"
        "      if (typeof source === \"string\") {\n"
        "        if (typeof Image !== \"function\") return false;\n"
        "        const img = new Image();\n"
        "        img.onload = () => { state.warpShipSprite = img; };\n"
        "        img.onerror = () => { state.warpShipSprite = null; };\n"
        "        img.src = source;\n"
        "        return true;\n"
        "      }\n"
        "      state.warpShipSprite = source;\n"
        "      return true;\n"
        "    };\n"
        "    window.BCMDeepSpaceWarpSetShip = (spec, scale) => {\n"
        "      if (spec != null) state.warpShipSpec = warpSpace.warpSpaceShipSpec(spec).id;\n"
        "      if (scale) state.warpShipScale = Math.max(0.5, Math.min(2.2, Number(scale) || 1));\n"
        "      return warpShipInfo();\n"
        "    };\n"
        "    window.BCMDeepSpaceWarpShipStats = () => warpShipInfo();\n"
        "    // Ручной крен, как Q/E в третьем лице. Абсолютный поворот = положение\n"
        "    // на кольце минус 90° плюс этот крен, поэтому на верхней точке кольца\n"
        "    // корабль честно оказывается вверх тормашками.\n"
        "    window.BCMDeepSpaceWarpSetShipRoll = (radians) => {\n"
        "      const r = Number(radians);\n"
        "      state.warpShipRoll = isFinite(r) ? r : 0;\n"
        "      return state.warpShipRoll;\n"
        "    };\n"
        "    window.BCMDeepSpaceWarpAddShipRoll = (delta) => {\n"
        "      const d = Number(delta);\n"
        "      if (isFinite(d)) state.warpShipRoll = Number(state.warpShipRoll || 0) + d;\n"
        "      return state.warpShipRoll;\n"
        "    };\n"
        "    window.BCMDeepSpaceWarpGetRainbow = () => !!state.warpRainbow;\n"
        "    window.BCMDeepSpaceWarpRainbowAt = (phase, mix) => {\n"
        "      // clampUnit живёт внутри замыкания ядра, снаружи его нет — считаем здесь.\n"
        "      const m = mix == null ? warpSpaceGlobalMix() : Number(mix);\n"
        "      const k = !isFinite(m) ? 0 : m < 0 ? 0 : m > 1 ? 1 : m;\n"
        "      return warpSpace.warpSpacePaletteAt(\n"
        "        activeWarpVisualClass(), k, state.warpRainbow ? Number(phase || 0) : null);\n"
        "    };\n"
        "    // Качество: 'auto' по замеру кадра, либо принудительно high/low.\n"
        "    window.BCMDeepSpaceWarpSetQuality = (tier) => {\n"
        "      state.warpQualityTier = tier === 'low' ? 'low' : tier === 'high' ? 'high' : null;\n"
        "    };\n"
        "    window.BCMDeepSpaceWarpGetQuality = () => warpSpaceTierNow();\n"
        "    // Цикл фоновых сцен и диагностика памяти.\n"
        "    window.BCMDeepSpaceWarpSetBgCycle = (on) => { state.warpBgCycle = !!on; state.warpBgCells = null; };\n"
        "    // Астероиды на стенке: плотность 0..1 и seed поля. 0 — выключить.\n"
        "    window.BCMDeepSpaceWarpSetAsteroids = (density, seed) => {\n"
        "      const d = Number(density);\n"
        "      state.warpAsteroids = isFinite(d) ? Math.max(0, Math.min(1, d)) : 1;\n"
        "      if (seed != null) state.warpAsteroidSeed = Number(seed) >>> 0;\n"
        "      return state.warpAsteroids;\n"
        "    };\n"
        "    window.BCMDeepSpaceWarpAsteroidStats = () => {\n"
        "      const field = warpSpace.warpSpaceAsteroidField(\n"
        "        Number(state.warpAsteroidSeed || 0) >>> 0, Number(state.warpAsteroids));\n"
        "      const sizes = { small: 0, medium: 0, large: 0 };\n"
        "      field.forEach((slot) => { sizes[slot.size] = (sizes[slot.size] || 0) + 1; });\n"
        "      const art = warpAsteroidArt();\n"
        "      return {\n"
        "        density: Number(state.warpAsteroids),\n"
        "        slots: field.length,\n"
        "        sizes: sizes,\n"
        "        art: Object.keys(art).length,\n"
        "        decoded: warpAsteroidReadyMap ? Object.keys(warpAsteroidReadyMap).length : 0\n"
        "      };\n"
        "    };\n"
        "    // Ритм сцены: true — случайный (~2 с пауза), false — тактовая сетка.\n"
        "    window.BCMDeepSpaceWarpSetRandomCycle = (on) => {\n"
        "      state.warpBgRandom = !!on;\n"
        "      state.warpBgCells = null;\n"
        "      state.warpBgIndex = 0;\n"
        "      return state.warpBgRandom;\n"
        "    };\n"
        "    window.BCMDeepSpaceWarpGetRandomCycle = () => !!state.warpBgRandom;\n"
        "    // Длина паузы в случайном ритме (по умолчанию 2 с) и seed порядка.\n"
        "    window.BCMDeepSpaceWarpSetBgHold = (sec) => {\n"
        "      state.warpBgHold = Math.max(0.6, Math.min(8, Number(sec) || 2));\n"
        "      state.warpBgCells = null;\n"
        "      return state.warpBgHold;\n"
        "    };\n"
        "    window.BCMDeepSpaceWarpSetBgSeed = (seed) => {\n"
        "      state.warpBgSeed = Number(seed) >>> 0;\n"
        "      state.warpBgCells = null;\n"
        "      state.warpBgIndex = 0;\n"
        "      return state.warpBgSeed;\n"
        "    };\n"
        "    window.BCMDeepSpaceWarpSetBgBpm = (bpm, power) => {\n"
        "      state.warpBgBpm = Math.max(40, Math.min(220, Number(bpm) || 142));\n"
        "      if (power) state.warpBgPower = Math.max(1, Math.min(3, Number(power) || 1.6));\n"
        "      state.warpBgCells = null;\n"
        "    };\n"
        "    window.BCMDeepSpaceWarpBgStats = () => ({\n"
        "      cached: warpBgStore.size,\n"
        "      pool: WARP_BG_POOL,\n"
        "      created: warpBgCreated,\n"
        "      index: Number(state.warpBgIndex || 0),\n"
        "      cycle: !!state.warpBgCycle,\n"
        "      random: !!state.warpBgRandom,\n"
        "      hold: Number(state.warpBgHold || 2),\n"
        "      kind: String(state.warpBgKind || \"dissolve\")\n"
        "    });\n"
        "    // Обои seed: скетчи из assets/scetchs, иначе генерация.\n"
        "    window.BCMDeepSpaceWarpSetArtMode = (mode) => {\n"
        "      state.warpArtMode = String(mode) === \"procedural\" ? \"procedural\" : \"sketch\";\n"
        "      warpBgReset();\n"
        "    };\n"
        "    window.BCMDeepSpaceWarpSetSketch = (name) => {\n"
        "      state.warpSketch = name ? String(name) : null;\n"
        "      warpBgReset();\n"
        "    };\n"
        "    window.BCMDeepSpaceWarpGetSketches = () => warpSpace.WARP_SPACE_SKETCHES.slice();\n"
        "    // Пиксель перехода: ступень ('coarse'...'micro') либо 'auto' по устройству.\n"
        "    window.BCMDeepSpaceWarpSetCellSize = (size) => {\n"
        "      const key = String(size || \"auto\");\n"
        "      state.warpCellSize = warpSpace.WARP_SPACE_CELL_PRESETS[key] ? key : \"auto\";\n"
        "      state.warpBgCells = null;\n"
        "      return state.warpCellSize;\n"
        "    };\n"
        "    // Профиль устройства и фактическая сетка перехода — для QA на живом сайте.\n"
        "    window.BCMDeepSpaceWarpDevice = (w, h) => ({\n"
        "      id: warpDevice.id,\n"
        "      label: warpDevice.label,\n"
        "      dprCap: warpDevice.dprCap,\n"
        "      cellBudget: warpCellBudget(),\n"
        "      dissolveBudget: warpDissolveBudget(),\n"
        "      dissolveFrameCap: warpDissolveFrameCap(),\n"
        "      grid: (() => {\n"
        "        const g = warpCellGrid(\n"
        "          Number(w || (typeof window !== \"undefined\" ? window.innerWidth : 800)) || 800,\n"
        "          Number(h || (typeof window !== \"undefined\" ? window.innerHeight : 500)) || 500);\n"
        "        return g.cols + \"x\" + g.rows;\n"
        "      })()\n"
        "    });\n"
        "    window.BCMDeepSpaceWarpArtStats = () => ({\n"
        "      mode: state.warpArtMode,\n"
        "      sketch: state.warpSketch,\n"
        "      loaded: Array.from(warpSketchImages.keys()).filter((k) => warpSketchImages.get(k)),\n"
        "      failed: Array.from(warpSketchImages.keys()).filter((k) => !warpSketchImages.get(k)),\n"
        "      scenes: warpSketchScenes.size\n"
        "    });\n",
    )

    # (2d) прибытие: остановить цикл по реальному событию
    once(
        "    function finishTube(success) {\n      if (state.mode !== \"tube\") return;\n",
        "    function finishTube(success) {\n"
        "      if (state.mode !== \"tube\") return;\n"
        "      // Прибытие — настоящее событие, а не таймер: гасим цикл фонов здесь.\n"
        "      stopWarpBackgroundCycle();\n",
    )

    # (3ab) спрайты астероидов (испечены из GLB репозитория) — рядом с ядром
    once(
        "    function drawTubeTunnel(g, w, h, now) {\n",
        ASTEROID_ART + "    function drawTubeTunnel(g, w, h, now) {\n",
    )

    # (3) блок ядра перед drawTubeTunnel
    once(
        "    function drawTubeTunnel(g, w, h, now) {\n",
        wrapper + "    function drawTubeTunnel(g, w, h, now) {\n",
    )

    # (3c) обои seed: загрузчик скетчей и выбор источника фона
    once(
        "    function warpBgGet(index, w, h) {\n",
        SKETCH_LOADER + "    function warpBgGet(index, w, h) {\n",
    )
    once(BG_GET_OLD, BG_GET_NEW)

    # (3b) направление стенки: XOR классового разворота и профиля
    once(
        "      const visualClass = activeWarpVisualClass();\n"
        "      // Class II reverses visible corridor motion, not just its colour pulse.\n"
        "      // Course timing and obstacle collision remain on the same forward clock.\n"
        "      const flowDirection = visualClass === 2 ? -1 : 1;\n",
        "      const visualClass = activeWarpVisualClass();\n"
        "      // Профиль нужен до расчёта направления: под «Пульсом» стенка идёт назад.\n"
        "      const spaceProfile = warpSpaceProfile();\n"
        "      // Class II reverses visible corridor motion, not just its colour pulse.\n"
        "      // Course timing and obstacle collision remain on the same forward clock.\n"
        "      // Профиль с reverseMotion разворачивает ход ещё раз, поэтому два\n"
        "      // разворота дают нормальный ход — XOR, а не двойное отрицание вслепую.\n"
        "      const flowDirection = warpSpace.warpSpaceDirectionFor(visualClass, spaceProfile);\n"

    )

    # (3d) размеры кадра для корабля и сетки перехода
    once(
        "      const visualClass = activeWarpVisualClass();\n"
        "      // Профиль нужен до расчёта направления",
        "      state.warpW = w;\n"
        "      state.warpH = h;\n"
        "      const visualClass = activeWarpVisualClass();\n"
        "      // Профиль нужен до расчёта направления",
    )

    # (4) фон: после градиента, до стенки
    once(
        '      bg.addColorStop(1, "#02040a");\n      g.fillStyle = bg;\n      g.fillRect(0, 0, w, h);\n',
        '      bg.addColorStop(1, "#02040a");\n      g.fillStyle = bg;\n      g.fillRect(0, 0, w, h);\n\n'
        "      // Космос виден вокруг силуэта трубы и в дальнем отверстии.\n"
        "      // Рисуется до стенки: стенка непрозрачна, значит препятствия не перекрываются.\n"
        "      drawWarpSpaceBackdrop(g, w, h, t);\n",
    )

    # (4y) заполнение дыр в стенке: соседние панели перекрываются на 1 px,
    #       поэтому дыр нет даже при моргании цвета или сглаживании краёв
    once(
        """          g.beginPath();
          g.moveTo(p00.x, p00.y);
          g.lineTo(p01.x, p01.y);""",
        """          // Перекрытие на 1 px: у соседних панелей общие рёбра, и любое
          // сглаживание края давало волосяные щели. Расширяем от центра.
          const cxq = (p00.x + p01.x) / 2;
          const cyq = (p00.y + p01.y) / 2;
          const push = (p) => {
            const dx = p.x - cxq;
            const dy = p.y - cyq;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            return { x: p.x + (dx / len) * 1.0, y: p.y + (dy / len) * 1.0 };
          };
          const q00 = push(p00), q01 = push(p01), q11 = push(p11), q10 = push(p10);
          g.beginPath();
          g.moveTo(q00.x, q00.y);
          g.lineTo(q01.x, q01.y);""",
    )
    once(
        """          g.lineTo(p11.x, p11.y);
          g.lineTo(p10.x, p10.y);
          g.closePath();
          const shimmer""",
        """          g.lineTo(q11.x, q11.y);
          g.lineTo(q10.x, q10.y);
          g.closePath();
          const shimmer""",
    )

    # (4w) ЗАВОРОТЫ ТРУБЫ: вернуть изгиб, который был срезан до ровного цилиндра
    once(
        "      const loopPhase = ((state.elapsed + 5) / 10.5) * Math.PI * 2;\n",
        "      const loopPhase = ((state.elapsed + 5) / 10.5) * Math.PI * 2;\n"
        "      // Завороты трубы: медленная волна изгиба плюс «дыхание» сечения.\n"
        "      // Раньше амплитуда была 0.05, и стенка читалась ровным цилиндром.\n"
        "      const tubeTurn = warpTubeTurn(state.elapsed);\n",
    )
    once(
        "         Math.sin(d * Math.PI * 1.55 + phase) * curveScale * 0.05 +\n",
        "         Math.sin(d * Math.PI * 1.55 + phase) * curveScale * 0.05 * tubeTurn.curve +\n",
    )
    once(
        "         Math.sin(d * Math.PI * 1.25 + phase) * liftScale * 0.04 +\n",
        "         Math.sin(d * Math.PI * 1.25 + phase) * liftScale * 0.04 * tubeTurn.curve +\n",
    )
    once(
        "      const radiusX = (d) => 4 + maxRadius * Math.pow(Math.max(0, d), 1.20) * widthScale;\n",
        "      const radiusX = (d) => 4 + maxRadius * Math.pow(Math.max(0, d), 1.20) * widthScale * tubeTurn.wobble;\n",
    )

    # (4x) астероиды на стенке: после панелей, до глубинных колец
    once(
        "      // Keep the established 12 longitudinal frame lines. Their geometry and\n",
        "      // Астероиды на стенке: настоящие меши, испечённые в спрайты. Рисуются\n"
        "      // после панелей (стенка уже залита) и до колец, чтобы кольца и пульс\n"
        "      // остались поверх — иначе поле перекрывает ориентиры глубины.\n"
        "      if (Number(state.warpAsteroids) > 0) {\n"
        "        warpSpace.drawWarpSpaceAsteroids(g, point, maxRadius,\n"
        "          Number(state.warpAsteroidSeed || 0) >>> 0,\n"
        "          warpAsteroidDensityNow(), warpAsteroidImages(),\n"
        "          Number(state.elapsed || 0));\n"
        "      }\n\n"
        "      // Keep the established 12 longitudinal frame lines. Their geometry and\n",
    )

    # (4z) число панелей одинаковое у всех классов: при 12 у III был «купол»
    once(
        "      const panelCount = visualClass === 3 ? 12 : 18;\n",
        "      // 18 панелей для всех классов: при 12 у класса III сечение читалось\n"
        "      // как гранёный «купол» — это и было видно на скриншотах.\n"
        "      const panelCount = 18;\n",
    )

    # (4a) глубина по тиру качества и отсечение субпиксельных панелей
    once(
        "      const depthSteps = 23;\n",
        "      const depthSteps = warpSpaceDepthSteps();\n",
    )
    once(
        """          const p00 = point(d0, a0, 0);
          const p01 = point(d0, a1, 0);
          const p11 = point(d1, a1, 0);
          const p10 = point(d1, a0, 0);
""",
        """          const p00 = point(d0, a0, 0);
          const p01 = point(d0, a1, 0);
          const p11 = point(d1, a1, 0);
          const p10 = point(d1, a0, 0);
          // Субпиксельные панели у точки схода не видны, но каждый fill стоит
          // вызова. Площадь — полная шнуровка (ядро: warpSpacePanelVisible).
          // Раньше здесь стоял один член |dx1*dy2|: на 0° и 180° радиальное
          // ребро горизонтально, произведение обнулялось, и здоровая панель
          // выбрасывалась — это и были «дыры» в стенке на живом сайте.
          if (!warpSpace.warpSpacePanelVisible(p00, p01, p10, warpSpaceCullScale())) continue;
""",
    )

    # (4b) панели: цвет из палитры вместо трёх захардкоженных ветвей
    once(
        """          const shimmer = Math.sin(shimmerTime * 1.35 + panel * 1.72 + step * 0.77 + playerAngle) * 0.5 + 0.5;
          const light = (((step + Math.floor(shimmerTime * 8) + panel * 3) % 5 + 5) % 5 === 0) ? 1 : 0;
          const red = visualClass === 3
            ? Math.round(17 + shimmer * 12 + light * 3)
            : Math.round(8 + shimmer * 8 + light * 2);
          const green = visualClass === 3
            ? Math.round(12 + shimmer * 8 + light * 5)
            : Math.round(20 + shimmer * 18 + light * 12);
          const blue = visualClass === 3
            ? Math.round(34 + shimmer * 28 + light * 12)
            : Math.round(31 + shimmer * 22 + light * 18);
          g.fillStyle = "rgba(" + red + "," + green + "," + blue + ",0.98)";
""",
        """          const shimmer = Math.sin(shimmerTime * 1.35 + panel * 1.72 + step * 0.77 + playerAngle) * 0.5 + 0.5;
          const light = (((step + Math.floor(shimmerTime * 8) + panel * 3) % 5 + 5) % 5 === 0) ? 1 : 0;
          // Цвет панели берётся из палитры класса с локальным сдвигом перелива,
          // поэтому смена A -> B идёт волной вдоль стенки, а не разом.
          // Цвет панели целиком из палитры (при радуге — из цветового круга).
          // warpSpacePanelCss сам добавляет модуляцию shimmer/light: в радужном
          // режиме она идёт по светлоте того же оттенка, чтобы огоньки не
          // уводили красную стенку в бирюзу.
          const panelMix = warpSpaceLocalMix(panel / panelCount + step * 0.04);
          g.fillStyle = warpSpace.warpSpacePanelCss(
            activeWarpVisualClass(), shimmer, light, panelMix,
            state.warpRainbow ? (panel / panelCount + step * 0.04) : null
          );
""",
    )

    # (5) кольца и пульс: после стенки, до продольных линий
    once(
        "      // Keep the established 12 longitudinal frame lines.",
        "      // Глубинные кольца и (опционально) расходящийся пульс. Тонкие, одного\n"
        "      // цвета, без разрывов — чтобы не читались как ворота столкновения.\n"
        "      const seamPalette = warpSpacePalette(0.25);\n"
        "      warpSpace.drawWarpSpaceRings(g, point, spaceProfile, t, warpSpace.rgbCss(seamPalette.ring));\n"
        "      warpSpace.drawWarpSpacePulse(g, centerX(0.5), centerY(0.5),\n"
        "        maxRadius * 0.9, t, spaceProfile, warpSpace.rgbCss(seamPalette.accent));\n\n"
        "      // Keep the established 12 longitudinal frame lines.",
    )

    # (5b) плавный догон цели палитры + замер кадра
    once(
        "    function updateTube(dt, now) {\n",
        "    function updateTube(dt, now) {\n"
        "      // Сглаженный замер кадра. Понижение качества — только по устойчивому\n"
        "      // ряду медленных кадров: один тяжёлый кадр не должен менять вид.\n"
        "      state.warpFrameMs = state.warpFrameMs\n"
        "        ? state.warpFrameMs * 0.94 + dt * 1000 * 0.06\n"
        "        : dt * 1000;\n"
        "      state.warpSlowStreak = state.warpFrameMs > 26\n"
        "        ? Number(state.warpSlowStreak || 0) + 1\n"
        "        : 0;\n"
        "      // Направление хода стенки меняется плавно, а не за один кадр.\n"
        "      state.warpDirMix = warpSpace.warpSpaceDirectionRamp(\n"
        "        state.warpDirMix, warpSpace.warpSpaceDirectionFor(activeWarpVisualClass(), warpSpaceProfile()), dt);\n"
        "      // При выключенном переливе mix плавно догоняет цель: переключение\n"
        "      // A -> B занимает около секунды, а не происходит мгновенно.\n"
        "      if (!state.warpPaletteFlow) {\n"
        "        const mixNow = Number(state.warpPaletteMix || 0);\n"
        "        const mixTarget = Number(state.warpPaletteTarget || 0);\n"
        "        if (Math.abs(mixTarget - mixNow) > 0.001) {\n"
        "          state.warpPaletteMix = mixNow + (mixTarget - mixNow) * Math.min(1, dt * 1.6);\n"
        "        }\n"
        "      }\n",
    )

    # (5c) продольные линии: цвет из палитры, яркость шва сохранена
    once(
        """        const baseColor = visualClass === 3
          ? (seam % 3 === 0 ? "rgba(189,139,246,0.86)" : "rgba(131,96,184,0.36)")
          : visualClass === 2
            ? (seam % 3 === 0 ? "rgba(115,193,206,0.56)" : "rgba(110,191,210,0.22)")
            : (seam % 3 === 0 ? "rgba(110,239,246,0.72)" : "rgba(110,191,210,0.25)");
        const pulseColor = visualClass === 3
          ? "rgba(230,205,255,1)"
          : visualClass === 2
            ? "rgba(190,244,250,0.98)"
            : "rgba(190,255,255,1)";
""",
        """        const seamPalette = warpSpacePalette(seam / 12);
        const baseColor = seam % 3 === 0
          ? warpSpace.rgbaCss(seamPalette.seamThick, 0.80)
          : warpSpace.rgbaCss(seamPalette.seamThin, 0.26);
        const pulseColor = warpSpace.rgbaCss(seamPalette.accent, 1);
""",
    )

    # (5d) корабль: плоский глиф сверху -> маленький вид СЗАДИ внутри кольца
    ship_start = "      const nearDepth = 0.92;\n"
    ship_end = "\n      const progress = warpObstacleProgress(t);\n"
    if text.count(ship_start) != 1 or text.count(ship_end) != 1:
        raise SystemExit("якоря отрисовки корабля не найдены")
    ship_from = text.index(ship_start)
    ship_to = text.index(ship_end, ship_from)
    old_ship = text[ship_from:ship_to]
    if "g.moveTo(0, -23)" not in old_ship:
        raise SystemExit("блок корабля выглядит иначе, чем ожидалось")
    text = text[:ship_from] + """      // Корабль: вид СЗАДИ, маленький, внутри кольца. Раньше здесь был
      // плоский глиф сверху и он был крупным; теперь силуэт сзади (двигатели
      // к камере), размер ограничен, управление то же — он едет по стенке.
      const nearDepth = 0.92;
      const craftPoint = point(nearDepth, playerAngle, -radiusX(nearDepth) * 0.20);
      const craftThrust = 0.55 + (Math.sin(now * 0.006) + 1) * 0.22;
      // Корабль висит на стенке: «верх» силуэта смотрит к центру кольца,
      // поэтому при ходе по кольцу он честно переворачивается (на верхней
      // точке — вверх тормашками). Ручной крен Q/E добавляется сверху.
      const craftRing = playerAngle + courseTwist(nearDepth);
      const craftRoll = warpSpace.warpSpaceShipRollFor(craftRing, Number(state.warpShipRoll) || 0);
      state.warpShipRollShown = craftRoll;
      const craftSize = drawWarpShipLayer(g, craftPoint.x, craftPoint.y,
        (state.steerBank || 0) * 1.4, craftThrust, craftRoll);
      // Кольцо вокруг корабля: видно, что он маленький и летит по стенке,
      // а не «висит» на экране. Тонкое, декоративное, на столкновения не влияет.
      g.save();
      g.globalAlpha = 0.20 + 0.10 * Math.sin(now * 0.004);
      g.strokeStyle = "rgba(200,245,255,0.85)";
      g.lineWidth = 1;
      g.beginPath();
      g.arc(craftPoint.x, craftPoint.y, craftSize * 0.95, 0, Math.PI * 2);
      g.stroke();
      g.restore();
""" + text[ship_to:]

    # (6) ленты: заменяют одиночную линию трёхслойной полосой там же, где шов
    once(
        "        g.strokeStyle = flowGradient;\n        g.lineWidth = seam % 3 === 0 ? 1.25 : 0.65;\n        g.stroke();\n",
        "        g.strokeStyle = flowGradient;\n"
        "        if (spaceProfile.ribbon && seam % 3 === 0) {\n"
        "          // Лента: широкий мягкий проход под чёткой линией. Без shadowBlur —\n"
        "          // это самый дорогой 2D-эффект на слабых GPU.\n"
        "          g.globalAlpha = 0.16;\n"
        "          g.lineWidth = 6;\n"
        "          g.stroke();\n"
        "          g.globalAlpha = 0.28;\n"
        "          g.lineWidth = 2.6;\n"
        "          g.stroke();\n"
        "          g.globalAlpha = 1;\n"
        "        }\n"
        "        g.lineWidth = seam % 3 === 0 ? 1.25 : 0.65;\n        g.stroke();\n",
    )
    return text


def main() -> int:
    if not SRC.exists():
        raise SystemExit(f"нет исходника {SRC} — сначала скачать raw main @ {HEAD_SHA}")
    source = SRC.read_text(encoding="utf-8")
    patched = apply(source)
    OUT.write_text(patched, encoding="utf-8")

    # проверка синтаксиса
    check = subprocess.run(["node", "--check", str(OUT)], capture_output=True, text=True)
    print("node --check:", "OK" if check.returncode == 0 else "FAIL\n" + check.stderr)
    if check.returncode != 0:
        return 1

    # unified diff против исходника
    diff = subprocess.run(
        ["git", "diff", "--no-index", "--no-color", "-U6",
         "--src-prefix=a/", "--dst-prefix=b/", str(SRC), str(OUT)],
        capture_output=True, text=True)
    if diff.returncode not in (0, 1):
        raise SystemExit("git diff не смог построить патч: " + diff.stderr)
    text = diff.stdout
    # git diff --no-index подставляет абсолютные пути после префикса a/ и b/.
    text = text.replace("a" + str(SRC), "a/mini-sim/assets/js/deep-space-warp.js")
    text = text.replace("b" + str(OUT), "b/mini-sim/assets/js/deep-space-warp.js")
    text = text.replace("--- " + str(SRC), "--- a/mini-sim/assets/js/deep-space-warp.js")
    text = text.replace("+++ " + str(OUT), "+++ b/mini-sim/assets/js/deep-space-warp.js")
    PATCH.write_text(text, encoding="utf-8")

    added = sum(1 for l in text.splitlines() if l.startswith("+") and not l.startswith("+++"))
    removed = sum(1 for l in text.splitlines() if l.startswith("-") and not l.startswith("---"))
    print(f"warp_space.patch: {len(text.encode())} байт, +{added} / -{removed} строк")
    print(f"warp_patched.js: {len(patched.encode())} байт (исходник {len(source.encode())} байт)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
