/* Pearce F4 (PF4) — контроллер среднего патрульного истребителя (Star Atlas).
 * Three.js r128. 58 × 40 × 16 м, экипаж 5 (пилот, штурман, 2 офицера
 * безопасности). Слоты: 2 large fixed hardpoint, large missile bay,
 * large + medium контрмеры, Scanner Array, Tractor Beam, Heat Sink,
 * Maneuvering Thrusters; модули 2×Ammo / Cargo / Fuel.
 *
 * Что за машина: длинный плоский клин-корпус с острой мордой и «вилкой» из
 * двух орудийных перьев вперёд, фонарь на броневом горбе, два больших
 * двигателя по бортам кормы, отвал-крылья с красными полосами ливреи и
 * высокий скошенный киль. Тёмный графит с окалиной, циановые дюзы.
 *
 * Узлы модели (30):
 *   center_hull, nose_prong_r/l, wing_r/l, canard_r/l, engine_r/l,
 *   cm_pod_r/l, rear_block, missile_bay, scanner, greebles, decals — статика
 *   thrusters        — циановые диски RCS (своё свечение)
 *   lights           — прожектор, габариты, палубные люки (общая непрозрачность)
 *   beacon           — красные стробы на киле
 *   gun_r / gun_l    — орудия в наконечниках перьев: подъём на 14° вокруг Z
 *   ramp_ext_r/_l    — выдвижная ступень трапа (телескоп), едет вдоль полотна
   bay_door_r/_l    — КОРМОВАЯ АППАРЕЛЬ: общая петля на пороге, раскрытие
 *                      на 120° вокруг Z (полотно уходит вниз-назад на палубу)
 *   bay_lid_r/_l     — створки ракетного отсека на палубе: 78° вокруг X
 *   leg_0…leg_2      — посадочные стойки: выпуск на палубу / уборка на 2.0 м
 *
 * Режимы (modes.json):
 *   pad    — на палубе: стойки выпущены, стволы в походном, всё закрыто
 *   flight — полёт: стойки убраны, тяга 78 %
 *   hunt   — охота: стволы подняты, отсек открыт
 *   load   — погрузка: стойки выпущены, отсек открыт, люки горят
 */

(function (scope) {
  'use strict';

  var GUN_ELEV = 14.0;        // подъём орудий под форштевнем, градусы
  var BAY_OPEN = 148.0;       // кормовая аппарель: из вертикали вниз-назад, пятка на палубу
  var RAMP_EXT_L = 2.25;      // ход выдвижной ступени трапа, м
  var LID_OPEN = 78.0;        // створки ракетного отсека на палубе
  var LEG_RETRACT = 2.0;      // уборка стоек, м
  var LEG_COUNT = 3;

  var MODES = {
    pad:    { legs: 1.0, guns: 0.0, bay: 0.0, lid: 0.0, thrust: 0.0, strobe: 0.30, spots: 0.45 },
    flight: { legs: 0.0, guns: 0.0, bay: 0.0, lid: 1.0, thrust: 0.78, strobe: 0.55, spots: 1.0 },
    hunt:   { legs: 0.0, guns: 1.0, bay: 0.0, lid: 1.0, thrust: 0.95, strobe: 1.0, spots: 1.0 },
    load:   { legs: 1.0, guns: 0.0, bay: 1.0, lid: 0.0, thrust: 0.0, strobe: 0.40, spots: 0.85 }
  };

  scope.createPearceF4Controls = function (root, opts) {
    if (typeof THREE === 'undefined') throw new Error('THREE required');
    if (!root) throw new Error('root required');
    opts = opts || {};

    var guns = [], bayDoors = [], rampExt = [], lids = [], legs = [];
    ['r', 'l'].forEach(function (tag) {
      var g = root.getObjectByName('gun_' + tag);
      var b = root.getObjectByName('bay_door_' + tag);   // кормовая аппарель
      var e = root.getObjectByName('ramp_ext_' + tag);    // выдвижная ступень трапа
      var v = root.getObjectByName('bay_lid_' + tag);    // створка ракетного отсека
      if (g) guns.push(g);
      if (b) bayDoors.push(b);
      if (e) rampExt.push(e);
      if (v) lids.push(v);
    });
    for (var i = 0; i < LEG_COUNT; i++) {
      var lg = root.getObjectByName('leg_' + i);
      if (lg) legs.push(lg);
    }
    var thrusters = root.getObjectByName('thrusters');
    var lights = root.getObjectByName('lights');
    var beacon = root.getObjectByName('beacon');

    if (guns.length !== 2 || bayDoors.length !== 2 || lids.length !== 2 ||
        legs.length !== LEG_COUNT || !thrusters || !lights || !beacon) {
      throw new Error('pearce f4 nodes missing (gun_*/bay_door_*/bay_lid_*/leg_0..2' +
        '/thrusters/lights/beacon)');
    }

    /* -------- исходные положения -------- */
    var legRest = legs.map(function (o) { return o.position.y; });
    var hingeRest = bayDoors.map(function (o) { return o.position.clone(); });
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
    var tBay = 0, cBay = 0;
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
      // кормовая аппарель: общая петля на пороге, полотно уходит вниз-назад
      var ra = -BAY_OPEN * DEG * cBay;
      for (i = 0; i < bayDoors.length; i++) {
        bayDoors[i].rotation.z = ra;                       // из вертикали вниз-назад
      }
      // выдвижная ступень: едет вдоль полотна и достаёт до палубы
      for (i = 0; i < rampExt.length; i++) {
        var d = cBay * RAMP_EXT_L;
        var h = hingeRest[i];
        rampExt[i].rotation.z = ra;
        rampExt[i].position.set(h.x - Math.sin(ra) * d, h.y + Math.cos(ra) * d, h.z);
        rampExt[i].visible = cBay > 0.02;
      }
      // створки ракетного отсека: петли на бортах колодца, раскрытие наружу
      for (i = 0; i < lids.length; i++) {
        lids[i].rotation.x = -sign(lids[i]) * LID_OPEN * DEG * cLid;
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
        if (name === 'brig') name = 'load';       // псевдоним старого имени
        if (!MODES[name]) throw new Error('unknown mode: ' + name);
        mode = name;
        var m = MODES[name];
        tLegs = m.legs;
        tGuns = m.guns;
        tBay = m.bay;
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
      setBay: function (v) { tBay = clamp01(v); mode = 'manual'; return api; },
      getBay: function () { return tBay; },
      setLid: function (v) { tLid = clamp01(v); mode = 'manual'; return api; },
      getLid: function () { return tLid; },
      setRamp: function (v) { tBay = clamp01(v); mode = 'manual'; return api; },
      getRamp: function () { return tBay; },
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
        cBay = lerp(cBay, tBay, Math.min(1, dt * 2.0));
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
          bay: +cBay.toFixed(3),
          lid: +cLid.toFixed(3),
          thrust: +cThrust.toFixed(3),
          strobe: +cStrobe.toFixed(3), spots: +cSpots.toFixed(3),
          engines: enginesOn, shader: shader
        };
      },
      constants: {
        gunElev: GUN_ELEV, bayOpen: BAY_OPEN, lidOpen: LID_OPEN, rampExt: RAMP_EXT_L,
        legRetract: LEG_RETRACT
      },
      dispose: function () {
        for (var k = 0; k < mats.length; k++) {
          mats[k].cpu.dispose();
          mats[k].gpu.dispose();
        }
      }
    };

    api.setMode(opts.mode && MODES[opts.mode] ? opts.mode : 'pad');
    cLegs = tLegs; cGuns = tGuns; cBay = tBay; cLid = tLid;
    cThrust = tThrust; cStrobe = tStrobe; cSpots = tSpots;
    applyPose(0);
    return api;
  };
})(typeof window !== 'undefined' ? window : globalThis);
