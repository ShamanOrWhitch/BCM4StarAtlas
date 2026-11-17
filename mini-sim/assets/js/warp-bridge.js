/* BCM4SA Warp bridge — selected SAGE destination and committed local location are separate.
 * Плюс ПОЛЁТ: состояние и отрисовка кадра варпа живут здесь (решение владельца:
 * «наша часть полёта должна быть в bridge»). Ядро расчётов одно на страницу —
 * его публикует варп как window.BCMWarpSpace; мост берёт готовое.
 */
(function (window) {
  "use strict";
  function finiteCoordinate(value) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }
  function copyNode(node) {
    if (!node || typeof node !== "object" || !node.id) return null;
    return { id: String(node.id), name: String(node.name || node.id),
      x: finiteCoordinate(node.x), y: finiteCoordinate(node.y) };
  }
  function copyLocation(place, node) {
    if (!place || typeof place !== "object" || !place.id) return null;
    const result = { id: String(place.id), label: String(place.label || place.id) };
    const sectorX = finiteCoordinate(place.sectorX), sectorY = finiteCoordinate(place.sectorY);
    if (sectorX !== null) result.sectorX = sectorX;
    if (sectorY !== null) result.sectorY = sectorY;
    const galaxyNode = copyNode(node || place.galaxyNode);
    if (galaxyNode) result.galaxyNode = galaxyNode;
    return result;
  }
  function create(options) {
    const config = options || {};
    let destination = null, currentLocation = null;
    function notifyLocation() {
      if (typeof config.onCurrentLocationChange === "function") {
        config.onCurrentLocationChange(copyLocation(currentLocation));
      }
    }
    return Object.freeze({
      previewDestination(node) {
        // Hover previews are snapshots only. They never write either route state.
        const preview = copyNode(node);
        if (preview && node.raw && typeof node.raw === "object") preview.raw = node.raw;
        return preview;
      },
      selectDestination(node) {
        const selected = copyNode(node);
        if (!selected) return null;
        destination = selected;
        return copyNode(destination);
      },
      getDestination() { return copyNode(destination); },
      clearDestination() { destination = null; return null; },
      commitArrival(place, node) {
        if (!place || !place.id) throw new Error("Warp bridge cannot commit an empty location");
        currentLocation = copyLocation(place, node || destination);
        if (!currentLocation) throw new Error("Warp bridge received an invalid arrival location");
        notifyLocation();
        return copyLocation(currentLocation);
      },
      setCurrentLocation(place, node) {
        currentLocation = copyLocation(place, node || destination);
        notifyLocation();
        return copyLocation(currentLocation);
      },
      getCurrentLocation() { return copyLocation(currentLocation); },
      clearCurrentLocation() { currentLocation = null; notifyLocation(); return null; },
      snapshot() { return { destination: copyNode(destination), currentLocation: copyLocation(currentLocation) }; }
    });
  }
  window.BCMWarpBridge = Object.freeze({ create });

  "use strict";

  function core() {
    return window.BCMWarpSpace || null;
  }

  /* Состояние полёта. Дефолты — те, что владелец уже принял на сайте. */
  var FLIGHT_DEFAULTS = Object.freeze({
    visualClass: 1,      // класс I: только фиолетовый (радуга — с II)
    rainbow: false,
    lowMode: false,      // слабый Android
    seed: 20261116,
    density: 1,          // плотность астероидов 0..1
    anomalies: 1,        // аномалии-«полувраги» вкл/выкл
    variant: "auto",     // вид аномалии: auto | wall | gate | mid | coil | twin
    haptics: true,       // вибрация на близком проходе камня
    dangerous: true,     // камни ОПАСНЫ: попадание бьёт по корпусу
    panels: 18,          // панелей по окружности
    depthSteps: 23,      // колец по глубине
    cullScale: 1.6       // порог отсечения субпиксельных панелей
  });

  var flightState = {};
  Object.keys(FLIGHT_DEFAULTS).forEach(function (key) {
    flightState[key] = FLIGHT_DEFAULTS[key];
  });

  var lastHapticAt = 0;

  /* Состояние опасности. Держим отдельно от настроек: это «что случилось»,
   * а не «как настроено». */
  var impactState = {
    hits: 0,             // сколько попаданий за заезд
    damage: 0,           // суммарный урон
    integrity: null,     // последняя целостность от отсека (если хулл ответил)
    lastAt: -1e9,        // мс, для общего кулдауна
    last: null,          // последнее попадание (для HUD и тестов)
    flashUntil: -1e9,    // до какого времени рисуем вспышку
    log: []              // последние 8 попаданий: кто, куда, сколько
  };
  var IMPACT_COOLDOWN_MS = 800;   // один удар за 0.8 с — не «смерть за кадр»

  function configure(options) {
    var opts = options || {};
    Object.keys(FLIGHT_DEFAULTS).forEach(function (key) {
      if (opts[key] === undefined) return;
      if (key === "density") {
        var d = Number(opts.density);
        flightState.density = isFinite(d) ? Math.max(0, Math.min(1, d)) : FLIGHT_DEFAULTS.density;
      } else if (key === "visualClass") {
        var c = Math.trunc(Number(opts.visualClass));
        flightState.visualClass = [1, 2, 3].indexOf(c) >= 0 ? c : FLIGHT_DEFAULTS.visualClass;
      } else if (key === "panels" || key === "depthSteps") {
        var n = Math.trunc(Number(opts[key]));
        flightState[key] = isFinite(n) && n > 0 ? n : FLIGHT_DEFAULTS[key];
      } else if (key === "cullScale") {
        var s = Number(opts[key]);
        flightState.cullScale = isFinite(s) && s > 0 ? s : FLIGHT_DEFAULTS.cullScale;
      } else if (key === "seed") {
        flightState.seed = Number(opts.seed) >>> 0;
      } else if (key === "variant") {
        var wanted = String(opts.variant == null ? "auto" : opts.variant);
        flightState.variant = wanted || "auto";
      } else {
        flightState[key] = !!opts[key];
      }
    });
    // «warp medium включает радужный проход» — если класс поднят, радуга
    // включается сама; малый слот остаётся фиолетовым.
    if (flightState.visualClass >= 2) flightState.rainbow = true;
    else if (opts.rainbow === undefined) flightState.rainbow = false;
    return snapshot();
  }

  function snapshot() {
    var copy = {};
    Object.keys(flightState).forEach(function (key) { copy[key] = flightState[key]; });
    copy.hasCore = !!core();
    return copy;
  }

  function localMix(spatialPhase) {
    var api = core();
    if (api && typeof api.phatoliFlow === "function") {
      return api.phatoliFlow(0.5, spatialPhase, 0);
    }
    return 0.5;
  }

  /* Угловая разница -π..π: сравнивать углы «в лоб» нельзя, 0.02 и 6.26 — рядом. */
  function angleDelta(a, b) {
    var d = (Number(a) || 0) - (Number(b) || 0);
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  /* Попадает ли камень в корабль.
   * Корабль висит на стенке внутри кольца, поэтому честный критерий — угловой:
   * камень проходит через тот же слот кольца, что и корабль, на его глубине.
   * Экранное расстояние оставлено запасным вариантом (если игра не передала
   * угол корабля). */
  function rockHitsShip(hit, ship) {
    if (!hit || !ship) return false;
    var ring = Number(hit.ring) > 1 ? Number(hit.ring) : 0;
    if (ring && isFinite(Number(ship.angle))) {
      var rockHalf = (Number(hit.px) || 10) / (2 * ring);      // радианы
      var shipHalf = Math.max(0.02, (Number(ship.size) || 28) / (2 * ring));
      return Math.abs(angleDelta(hit.angle, ship.angle)) < shipHalf + rockHalf;
    }
    var reach = (Number(ship.size) || 28) * 0.55 + (Number(hit.px) || 10) * 0.45;
    var dx = Number(hit.x) - Number(ship.x);
    var dy = Number(hit.y) - Number(ship.y);
    return Math.sqrt(dx * dx + dy * dy) <= reach;
  }

  /* Попадание: камень прошёл вплотную к кораблю.
   * Урон по размеру камня, отсек — по стороне удара (лево / центр / право),
   * ровно как это делает лабиринт астероида, чтобы корпус вёл себя одинаково. */
  function applyImpact(hit, ship, nowMs) {
    if (!flightState.dangerous) return null;
    if (nowMs - impactState.lastAt < IMPACT_COOLDOWN_MS) return null;
    var dx = hit.x - ship.x;
    var compartment = dx < -ship.size * 0.35 ? 1 : (dx > ship.size * 0.35 ? 3 : 2);
    var damage = Math.max(2, Math.min(24, Math.round(Number(hit.damage) || 6)));
    var record = {
      at: nowMs, x: hit.x, y: hit.y, size: hit.size, damage: damage,
      compartment: compartment, depth: hit.depth
    };
    impactState.lastAt = nowMs;
    impactState.last = record;
    impactState.hits += 1;
    impactState.damage += damage;
    impactState.flashUntil = nowMs + 240;
    impactState.log.push(record);
    if (impactState.log.length > 8) impactState.log.shift();

    // Корпус: если модуль ремонта загружен — бьём по отсеку и забираем
    // целостность. Нет модуля — попадание всё равно считается (хук и событие).
    var hull = null;
    try {
      hull = window.BCMHullRepairState && typeof window.BCMHullRepairState.triggerExternalImpact === "function"
        ? window.BCMHullRepairState.triggerExternalImpact(compartment, damage) : null;
    } catch (error) { hull = null; }
    if (hull) {
      record.integrity = typeof hull.integrity === "number" ? hull.integrity : null;
      record.compartmentName = String(hull.name || "");
      if (record.integrity != null) impactState.integrity = record.integrity;
    }

    // Вибрация: короткий, но ощутимый удар.
    if (flightState.haptics && typeof window.navigator !== "undefined" &&
        typeof window.navigator.vibrate === "function") {
      try { window.navigator.vibrate([38, 26, 22]); } catch (error) { /* без вибрации */ }
    }
    // Событие для остальных систем (HUD, звук, миссии) — по-настоящему, а не «на глаз».
    try {
      if (typeof window.dispatchEvent === "function" && typeof window.CustomEvent === "function") {
        window.dispatchEvent(new window.CustomEvent("bcm:warp:asteroid-hit", { detail: record }));
      }
    } catch (error) { /* событие не обязательно */ }
    return record;
  }

  /* Вспышка попадания: кольцо в точке удара + красная заливка на кадр.
   * Дешево: два штриха и один прямоугольник. */
  function drawImpactFlash(g, w, h, nowMs) {
    if (!(nowMs < impactState.flashUntil) || !impactState.last) return 0;
    var left = (impactState.flashUntil - nowMs) / 240;
    if (!(left > 0)) return 0;
    var hit = impactState.last;
    g.save();
    g.globalAlpha = Math.max(0, Math.min(1, left));
    g.strokeStyle = "rgba(255,120,96,0.95)";
    g.lineWidth = 2 + 3 * left;
    g.beginPath();
    g.arc(hit.x, hit.y, 10 + 34 * (1 - left), 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = "rgba(255,232,214,0.75)";
    g.lineWidth = 1;
    g.beginPath();
    g.arc(hit.x, hit.y, 6 + 18 * (1 - left), 0, Math.PI * 2);
    g.stroke();
    g.globalAlpha = Math.max(0, Math.min(0.18, left * 0.18));
    g.fillStyle = "rgba(255,64,48,1)";
    g.fillRect(0, 0, Math.max(1, w), Math.max(1, h));
    g.restore();
    return 1;
  }

  /* Отрисовка кадра полёта.
   * opts: point(d, a, extra), maxRadius, elapsed, shimmerTime, playerAngle, w, h,
   *       images (карта id -> Image для камней), t (мс), haptic(fn).
   * Возвращает статистику: панели, камни, сегменты аномалии, ближние камни. */
  function drawArt(g, opts) {
    var o = opts || {};
    var api = core();
    var stats = { panels: 0, rocks: 0, near: 0, anomaly: 0, backdrop: 0 };
    if (!api || typeof o.point !== "function") return stats;

    var w = Math.max(1, Math.floor(Number(o.w) || 0));
    var h = Math.max(1, Math.floor(Number(o.h) || 0));
    var elapsed = Number(o.elapsed) || 0;
    var shimmerTime = o.shimmerTime == null ? elapsed : Number(o.shimmerTime);
    var playerAngle = Number(o.playerAngle) || 0;
    var rainbow = flightState.rainbow;
    var nowMs = Number(o.t) || 0;
    // Где корабль: игра передаёт его точку и размер, иначе — центр снизу.
    var ship = o.ship && isFinite(Number(o.ship.x)) && isFinite(Number(o.ship.y))
      ? {
          x: Number(o.ship.x), y: Number(o.ship.y),
          size: Math.max(8, Number(o.ship.size) || 28),
          angle: isFinite(Number(o.ship.angle)) ? Number(o.ship.angle) : null
        }
      : { x: w * 0.5, y: h * 0.86, size: Math.max(8, Math.min(w, h) * 0.06), angle: null };
    stats.hits = 0;
    stats.impacts = 0;

    // 0. Вспышка прошлого попадания (рисуется поверх всего в конце кадра).
    var flashPending = nowMs < impactState.flashUntil;

    // 1. Космос на фоне: одна плоская заливка звёзд на кадр.
    if (api.drawWarpSpaceBackdrop && w && h) {
      api.drawWarpSpaceBackdrop(g, w, h, elapsed);
      stats.backdrop = 1;
    }

    // 2. Стенка: панели по окружности и по глубине. Отсечение — по полной
    // площади (иначе панели на 0°/180° выбрасывались и давали дыры), а соседей
    // сдвигаем на 1 px от центра, чтобы сглаживание не давало волосяных щелей.
    var panelCount = flightState.panels;
    var depthSteps = flightState.depthSteps;
    for (var step = 0; step < depthSteps; step += 1) {
      var d0 = 0.04 + (step / depthSteps) * 0.96;
      var d1 = 0.04 + ((step + 1) / depthSteps) * 0.96;
      for (var panel = 0; panel < panelCount; panel += 1) {
        var a0 = panel * Math.PI * 2 / panelCount;
        var a1 = (panel + 1) * Math.PI * 2 / panelCount;
        var p00 = o.point(d0, a0, 0), p01 = o.point(d0, a1, 0);
        var p11 = o.point(d1, a1, 0), p10 = o.point(d1, a0, 0);
        if (!api.warpSpacePanelVisible(p00, p01, p10, flightState.cullScale)) continue;
        var cxq = (p00.x + p01.x) / 2, cyq = (p00.y + p01.y) / 2;
        var push = function (p) {
          var dx = p.x - cxq, dy = p.y - cyq;
          var len = Math.sqrt(dx * dx + dy * dy) || 1;
          return { x: p.x + (dx / len), y: p.y + (dy / len) };
        };
        var q00 = push(p00), q01 = push(p01), q11 = push(p11), q10 = push(p10);
        var shimmer = Math.sin(shimmerTime * 1.35 + panel * 1.72 + step * 0.77 + playerAngle) * 0.5 + 0.5;
        // Огоньки-подсветки: шаг 8 раз в секунду. На слабом режиме — вдвое реже,
        // чтобы не мигало и не стоило лишних вычислений.
        var tick = flightState.lowMode ? 4 : 8;
        var light = (((step + Math.floor(shimmerTime * tick) + panel * 3) % 5 + 5) % 5 === 0) ? 1 : 0;
        var phase = panel / panelCount + step * 0.04;
        g.beginPath();
        g.moveTo(q00.x, q00.y);
        g.lineTo(q01.x, q01.y);
        g.lineTo(q11.x, q11.y);
        g.lineTo(q10.x, q10.y);
        g.closePath();
        g.fillStyle = api.warpSpacePanelCss(
          flightState.visualClass, shimmer, light, localMix(phase),
          rainbow ? api.warpSpaceRainbowAt(phase, elapsed) : null
        );
        g.fill();
        stats.panels += 1;
      }
    }

    // 3. Аномалия-«полувраг» перед камнями (её видно сквозь них как ленту).
    if (flightState.anomalies) {
      var anchor = null;
      if (flightState.density > 0 && typeof api.warpSpaceAsteroidField === "function") {
        var slots = api.warpSpaceAsteroidField(flightState.seed, flightState.density);
        var best = 9;
        for (var i = 0; i < slots.length; i += 1) {
          var rs = slots[i];
          if (!rs || !(rs.depth > 0.22) || !(rs.depth < 0.66)) continue;
          var dist = Math.abs(rs.depth - 0.45);
          if (dist < best) { best = dist; anchor = { depth: rs.depth, angle: rs.angle }; }
        }
      }
      stats.anomaly = api.drawWarpSpaceAnomaly(g, o.point, elapsed, anchor, flightState.variant);
    }

    // 4. Камни: один drawImage на камень. `near` — те, что прошли рядом,
    // по ним дёргается вибрация геймпада/телефона.
    if (flightState.density > 0 && typeof api.drawWarpSpaceAsteroids === "function") {
      var res = api.drawWarpSpaceAsteroids(g, o.point, Number(o.maxRadius) || 0,
        flightState.seed, flightState.density, o.images || null, elapsed);
      stats.rocks = (res && res.drawn) || 0;
      stats.near = (res && res.near) || 0;
      // ОПАСНОСТЬ: камень прошёл вплотную к кораблю — это удар, а не «мимо».
      var candidates = (res && res.hits) || [];
      for (var hi = 0; hi < candidates.length; hi += 1) {
        var hit = candidates[hi];
        if (!rockHitsShip(hit, ship)) continue;
        var record = applyImpact(hit, ship, nowMs);
        if (record) stats.impacts += 1;
      }
      if (stats.near > 0 && flightState.haptics && typeof o.haptic === "function") {
        o.haptic(stats.near);
      }
      // Вибрацию можно дёрнуть и здесь, если кадр рисует мост целиком.
      if (stats.near > 0 && flightState.haptics && typeof window.navigator !== "undefined" &&
          typeof window.navigator.vibrate === "function") {
        var nowMs = Number(o.t) || 0;
        if (nowMs - lastHapticAt > 700) {
          lastHapticAt = nowMs;
          try { window.navigator.vibrate(14); } catch (error) { /* без вибрации */ }
        }
      }
    }
    stats.hits = impactState.hits;
    stats.damage = impactState.damage;
    stats.integrity = impactState.integrity;
    stats.lastImpact = impactState.last;
    if (flashPending) stats.flash = drawImpactFlash(g, w, h, nowMs);
    return stats;
  }

  /* Хуки полёта — те же имена, что были у варпа, чтобы старый код и QA не ломались. */
  var flight = {
    defaults: FLIGHT_DEFAULTS,
    configure: configure,
    snapshot: snapshot,
    drawArt: drawArt,
    core: core,
    setAnomalies: function (on) { flightState.anomalies = on ? 1 : 0; return flightState.anomalies; },
    setAnomalyVariant: function (id) {
      var api = core();
      var wanted = id == null ? "auto" : String(id);
      var list = api && typeof api.warpSpaceAnomalyVariantIds === "function"
        ? api.warpSpaceAnomalyVariantIds() : ["wall", "gate", "mid", "coil", "twin"];
      if (wanted === "auto" || list.indexOf(wanted) >= 0) flightState.variant = wanted;
      return flightState.variant;
    },
    anomalyVariants: function () {
      var api = core();
      return api && typeof api.warpSpaceAnomalyVariantIds === "function"
        ? api.warpSpaceAnomalyVariantIds().slice()
        : ["wall", "gate", "mid", "coil", "twin"];
    },
    setAsteroids: function (density, seed) {
      configure({ density: density });
      if (seed != null) flightState.seed = Number(seed) >>> 0;
      return flightState.density;
    },
    asteroidStats: function () {
      var api = core();
      var slots = api && typeof api.warpSpaceAsteroidField === "function"
        ? api.warpSpaceAsteroidField(flightState.seed, flightState.density) : [];
      var sizes = { small: 0, medium: 0, large: 0 };
      slots.forEach(function (slot) { if (sizes[slot.size] != null) sizes[slot.size] += 1; });
      return { density: flightState.density, seed: flightState.seed, slots: slots.length, sizes: sizes };
    },
    setHaptics: function (on) { flightState.haptics = !!on; return flightState.haptics; },
    // Опасность: true — камни бьют по корпусу, false — пролетают мимо.
    setDangerous: function (on) { flightState.dangerous = !!on; return flightState.dangerous; },
    dangerous: function () { return flightState.dangerous; },
    impacts: function () {
      return {
        dangerous: flightState.dangerous, hits: impactState.hits, damage: impactState.damage,
        integrity: impactState.integrity, last: impactState.last,
        log: impactState.log.slice()
      };
    },
    resetImpacts: function () {
      impactState.hits = 0; impactState.damage = 0; impactState.integrity = null;
      impactState.last = null; impactState.lastAt = -1e9; impactState.flashUntil = -1e9;
      impactState.log.length = 0;
      return impactState.hits;
    },
    rockHitsShip: rockHitsShip,
    hitShip: function (hit, ship) {
      // для тестов и QA: посчитать попадание без кадра
      return applyImpact(hit || { x: 0, y: 0, px: 10, damage: 6, depth: 0.9, size: "small" },
        ship || { x: 0, y: 0, size: 28 }, Number(arguments[2]) || 0);
    },
    setRainbow: function (on) { flightState.rainbow = !!on; return flightState.rainbow; },
    getRainbow: function () { return flightState.rainbow; },
    effectLevel: function () {
      var api = core();
      if (api && typeof api.warpSpaceEffectLevel === "function") return api.warpSpaceEffectLevel(flightState.visualClass);
      return { id: flightState.visualClass >= 2 ? "medium+" : "small", rainbow: flightState.visualClass >= 2 };
    }
  };

  window.BCMWarpBridgeFlight = Object.freeze(flight);

  /* Основной фасад моста: маршрут (как был) + полёт. */
  var base = window.BCMWarpBridge && typeof window.BCMWarpBridge.create === "function"
    ? window.BCMWarpBridge : null;
  window.BCMWarpBridge = Object.freeze({
    create: base ? base.create : null,
    flight: flight
  });
})(window);
