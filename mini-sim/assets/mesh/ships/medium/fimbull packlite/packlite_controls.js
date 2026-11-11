/* Fimbul BYOS Packlite — контроллер среднего грузовика-баржи (Star Atlas).
 * Three.js r128. 67.1 × 26.5 × 21.6 м, экипаж 6.
 * Слоты: 2 medium fixed hardpoint, 2 x-small turret, small missile bay,
 * M + 2 small контрмеры, Scanner, Tractor Beam, Heat Sink, Subwarp L;
 * модули 2×Cargo / 2×Fuel.
 *
 * Что за машина: рабочая лошадка дальнобойщика — вытянутый плоский корпус,
 * охристая броня, носовая рубка с ленточным остеклением и двумя круглыми
 * воздухозаборниками, открытая грузовая палуба с контейнерами, турелями и
 * радиомачтой, кормовая открытая ферма с блоком из пяти сопел и бортовые
 * рёбристые гондолы-радиаторы.
 *
 * Узлы модели (31):
 *   center_hull, bridge, canopy, intake_r/l, cargo_deck, container_*,
 *   cargo_hold, radar_tower, engine_frame, nozzle_cluster, pod_r0/r1/l0/l1,
 *   cm_pod_r/l, greebles, decals — статика
 *   thrusters        — свечение пяти сопел (своя непрозрачность)
 *   lights           — прожекторы, палубные огни, подсветка трюма
 *   beacon           — красные стробы на мачте и ферме
 *   turret_r / turret_l   — турели на палубе: подъём стволов на 16°
 *   cargo_lid_r/_l   — створки грузового люка в палубе: раскрытие на 82° наружу
 *   leg_0…leg_3      — посадочные лыжи: выпуск на палубу / уборка на 2.0 м
 *
 * Режимы (modes.json):
 *   pad    — на палубе: лыжи выпущены, люк закрыт, тяга 0
 *   flight — полёт: лыжи убраны, тяга 70 %
 *   hunt   — охота: стволы подняты, тяга 88 %
 *   load   — погрузка: лыжи выпущены, люк раскрыт, подсветка трюма на максимум
 */

(function (scope) {
  'use strict';

  var GUN_ELEV = 16.0;        // подъём стволов турелей, градусы
  var LID_OPEN = 82.0;        // створки грузового люка: раскрытие наружу, градусы
  var LEG_RETRACT = 2.0;      // уборка лыж, м
  var LEG_COUNT = 4;

  var MODES = {
    pad:    { legs: 1.0, guns: 0.0, lid: 0.0, thrust: 0.0, strobe: 0.30, spots: 0.45 },
    flight: { legs: 0.0, guns: 0.0, lid: 0.0, thrust: 0.70, strobe: 0.55, spots: 1.0 },
    hunt:   { legs: 0.0, guns: 1.0, lid: 0.0, thrust: 0.88, strobe: 1.0, spots: 1.0 },
    load:   { legs: 1.0, guns: 0.0, lid: 1.0, thrust: 0.0, strobe: 0.40, spots: 0.85 }
  };

  scope.createPackliteControls = function (root, opts) {
    if (typeof THREE === 'undefined') throw new Error('THREE required');
    if (!root) throw new Error('root required');
    opts = opts || {};

    var guns = [], lids = [], legs = [];
    ['r', 'l'].forEach(function (tag) {
      var g = root.getObjectByName('turret_' + tag);      // турель на палубе
      var v = root.getObjectByName('cargo_lid_' + tag);   // створка грузового люка
      if (g) guns.push(g);
      if (v) lids.push(v);
    });
    for (var i = 0; i < LEG_COUNT; i++) {
      var lg = root.getObjectByName('leg_' + i);
      if (lg) legs.push(lg);
    }
    var thrusters = root.getObjectByName('thrusters');
    var lights = root.getObjectByName('lights');
    var beacon = root.getObjectByName('beacon');

    if (guns.length !== 2 || lids.length !== 2 ||
        legs.length !== LEG_COUNT || !thrusters || !lights || !beacon) {
      throw new Error('packlite nodes missing (turret_*/cargo_lid_*/leg_0..3' +
        '/thrusters/lights/beacon)');
    }

    /* -------- исходные положения -------- */
    var legRest = legs.map(function (o) { return o.position.y; });
    var sign = function (o) { return o.position.z >= 0 ? 1 : -1; };

    /* -------- материалы: CPU по умолчанию -------- */
    var mats = [];
    root.traverse(function (o) {
      if (!o.isMesh) return;
      var cpu = new THREE.MeshBasicMaterial({
        vertexColors: true, transparent: false, opacity: 1, toneMapped: false
      });
      // Lambert, а не Phong: блики Phong на светлом металле «съедали»
      // запечённую панелировку (на скрине это выглядело как «пропали
      // текстуры»), и Lambert дешевле на слабом Android.
      var gpu = new THREE.MeshLambertMaterial({
        vertexColors: true
      });
      mats.push({ mesh: o, cpu: cpu, gpu: gpu });
      o.material = cpu;
    });
    [thrusters, lights, beacon].forEach(function (m) {
      m.material.transparent = true;
      m.material.depthWrite = false;
    });

    /* -------- состояние -------- */
    var mode = 'pad';
    var tLegs = 1, cLegs = 1;
    var tGuns = 0, cGuns = 0;
    var tLid = 0, cLid = 0;
    var tThrust = 0, cThrust = 0;
    var tStrobe = 0.30, cStrobe = 0.30;
    var tSpots = 0.45, cSpots = 0.45;
    var enginesOn = true;
    var shader = false;
    var t0 = 0;
    var DEG = Math.PI / 180;

    function lerp(a, b, k) { return a + (b - a) * k; }
    function clamp01(v) { return Math.max(0, Math.min(1, +v)); }

    function applyPose(time) {
      var i;
      // стойки: уборка в опорные подушки клыков
      for (i = 0; i < legs.length; i++) {
        legs[i].position.y = legRest[i] + LEG_RETRACT * (1 - cLegs);
        legs[i].visible = cLegs > 0.04;
      }
      // носовые блоки стволов: подъём вокруг поперечной оси Z
      for (i = 0; i < guns.length; i++) {
        guns[i].rotation.z = -GUN_ELEV * DEG * cGuns;
      }
      // створки грузового люка: петля на комингсе, раскрытие наружу
      for (i = 0; i < lids.length; i++) {
        lids[i].rotation.x = sign(lids[i]) * LID_OPEN * DEG * cLid;
      }
      // маршевая тяга
      thrusters.visible = enginesOn && cThrust > 0.02;
      if (thrusters.visible) {
        // ВАЖНО: не масштабировать узел свечения. Раньше здесь стояло
        // thrusters.scale.set(1, tk, tk) — масштаб шёл ВОКРУГ НАЧАЛА
        // координат модели, и сопловые решётки съезжали со своих устьев
        // (на корме это читалось как «свечение сдвинуто наружу»).
        // Меняем только яркость, геометрия остаётся на месте.
        thrusters.material.opacity = Math.min(1, cThrust * 1.25) *
          (0.90 + 0.10 * Math.sin(time * 17.0));
      }
      // прожекторы, подсветка брига
      lights.material.opacity = cSpots;
      lights.visible = cSpots > 0.02;
      // стробы: сдвоенная оранжевая вспышка
      var ph = (time * 1.6) % 1.0;
      var flash = (ph < 0.08 || (ph > 0.14 && ph < 0.22)) ? 1.0 : 0.0;
      beacon.material.opacity = Math.max(0.05, cStrobe * (0.20 + 0.80 * flash));
      beacon.visible = cStrobe > 0.02;
    }

    var api = {
      /* ---- режимы ---- */
      setMode: function (name) {
        if (!MODES[name]) throw new Error('unknown mode: ' + name);
        mode = name;
        var m = MODES[name];
        tLegs = m.legs;
        tGuns = m.guns;
        tLid = m.lid;
        tThrust = enginesOn ? m.thrust : 0;
        tStrobe = m.strobe;
        tSpots = m.spots;
        return api;
      },
      getMode: function () { return mode; },
      getModes: function () { return Object.keys(MODES); },

      /* ---- ручное управление ---- */
      setLegs: function (v) { tLegs = clamp01(v); mode = 'manual'; return api; },
      getLegs: function () { return tLegs; },
      setGuns: function (v) { tGuns = clamp01(v); mode = 'manual'; return api; },
      getGuns: function () { return tGuns; },
      setLid: function (v) { tLid = clamp01(v); mode = 'manual'; return api; },
      getLid: function () { return tLid; },
      setThrust: function (v) { tThrust = clamp01(v); return api; },
      getThrust: function () { return tThrust; },
      setStrobe: function (v) { tStrobe = clamp01(v); return api; },
      getStrobe: function () { return tStrobe; },
      setSpots: function (v) { tSpots = clamp01(v); return api; },
      getSpots: function () { return tSpots; },
      setEngines: function (on) {
        enginesOn = !!on;
        if (!enginesOn) tThrust = 0;
        return api;
      },
      getEngines: function () { return enginesOn; },

      /* ---- путь отрисовки ---- */
      setShaderMode: function (on) {
        shader = !!on;
        for (var k = 0; k < mats.length; k++) {
          var rec = mats[k];
          var glow = [thrusters, lights, beacon].indexOf(rec.mesh.parent) >= 0;
          rec.mesh.material = shader ? rec.gpu : rec.cpu;
          if (glow) {
            rec.mesh.material.transparent = true;
            rec.mesh.material.depthWrite = false;
          }
        }
        return api;
      },
      getShaderMode: function () { return shader; },

      /* ---- кадр ---- */
      update: function (time, camera) {
        if (t0 === 0) t0 = time;
        var dt = Math.max(0, Math.min(0.12, time - t0));
        t0 = time;
        cLegs = lerp(cLegs, tLegs, Math.min(1, dt * 2.2));
        cGuns = lerp(cGuns, tGuns, Math.min(1, dt * 2.0));
        cLid = lerp(cLid, tLid, Math.min(1, dt * 2.0));
        cThrust = lerp(cThrust, tThrust, Math.min(1, dt * 2.6));
        cStrobe = lerp(cStrobe, tStrobe, Math.min(1, dt * 2.2));
        cSpots = lerp(cSpots, tSpots, Math.min(1, dt * 3.0));
        applyPose(time);
        return api;
      },
      getState: function () {
        return {
          mode: mode,
          legs: +cLegs.toFixed(3), guns: +cGuns.toFixed(3),
          lid: +cLid.toFixed(3),
          thrust: +cThrust.toFixed(3),
          strobe: +cStrobe.toFixed(3), spots: +cSpots.toFixed(3),
          engines: enginesOn, shader: shader
        };
      },
      constants: {
        gunElev: GUN_ELEV, lidOpen: LID_OPEN, legRetract: LEG_RETRACT
      },
      dispose: function () {
        for (var k = 0; k < mats.length; k++) {
          mats[k].cpu.dispose();
          mats[k].gpu.dispose();
        }
      }
    };

    api.setMode(opts.mode && MODES[opts.mode] ? opts.mode : 'pad');
    cLegs = tLegs; cGuns = tGuns; cLid = tLid;
    cThrust = tThrust; cStrobe = tStrobe; cSpots = tSpots;
    applyPose(0);
    return api;
  };
})(typeof window !== 'undefined' ? window : globalThis);
