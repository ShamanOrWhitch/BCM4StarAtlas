/* Calico ATS Enforcer — контроллер среднего истребителя ATS (Star Atlas).
 * Three.js r128. 92 × 69 × 19 м, экипаж 2 (пилот + штурман).
 * Слоты: 1 capital fixed hardpoint, 8 xx-small + 16 xxx-small ракетных ячеек,
 * 3 контрмеры M; компоненты M-класса (Power Core, Shield, Warp, Subwarp,
 * Maneuvering, Scanner, Tractor) + Heat Sink L; модули 2×Ammo, Cargo, Fuel.
 *
 * Что за машина: ATS = air-to-space, тяжёлый перехватчик-«летающее крыло»
 * с длинным клиновидным корпусом, кабиной-каплей в носу, вынесенной под нос
 * capital-пушкой со спаренными стволами, бортовыми батареями ракетных ячеек
 * и двумя гондолами с золотыми кольцами сопел. По лору живёт в трёх
 * режимах: flight (полёт), patrol (патруль) и siege (осада).
 *
 * Узлы модели (23):
 *   fuselage, canopy, spine_hump, nozzle_block, capital_cannon — статика
 *   wing_r / wing_l           — крылья: в патруле законцовки подняты на 6°
 *   tail_fin_r / tail_fin_l   — расходящиеся кили
 *   belly_fin_r / belly_fin_l — подфюзеляжные плавники
 *   missile_pod_r / missile_pod_l  — батареи: выдвигаются наружу на 0.45 м
 *   missile_glow_r / missile_glow_l — золотые соты: зажигаются в осаде
 *   thrusters        — свечение двух сопел и центральной турбины
 *   lights           — прожекторы, АНО крыла, подсветка кабины
 *   beacon           — красные стробы на килях
 *   greebles, decals — панелировка и ливрея
 *   leg_0…leg_2      — стойки шасси: выпуск на палубу / уборка на 1.7 м
 *
 * Режимы (modes.json):
 *   pad    — на палубе: стойки выпущены, тяга 0
 *   flight — полёт: стойки убраны, тяга 70 %
 *   patrol — патруль: стойки убраны, крылья раскрыты, тяга 55 %
 *   siege  — осада: стойки выпущены, пушка наведена, соты раскрыты, тяга 20 %
 */

(function (scope) {
  'use strict';

  var LEG_RETRACT = 1.7;      // уборка стоек, м
  var LEG_COUNT = 3;
  var GUNS_DEG = 7.0;         // наведение capital-пушки, градусы
  var RECOIL = 0.9;           // откат стволов при наведении, м
  var WING_TILT = 6.0;        // подъём законцовок в патруле, градусы
  var BAY_SLIDE = 0.0;        // выдвижения нет: трубы открываются «на месте»
  var LEG_PIVOT = [0, 4.95, 0];   // ось подъёма крыла (по высоте корня)
  var GUN_PIVOT = [-6.0, 4.6, 0.0]; // узел крепления пушки к днищу

  var MODES = {
    pad:    { legs: 1.0, guns: 0.0, wings: 0.0, bay: 0.0, thrust: 0.00,
              strobe: 0.30, spots: 0.45 },
    flight: { legs: 0.0, guns: 0.0, wings: 0.0, bay: 0.0, thrust: 0.70,
              strobe: 0.55, spots: 1.00 },
    patrol: { legs: 0.0, guns: 0.0, wings: 1.0, bay: 0.0, thrust: 0.55,
              strobe: 0.70, spots: 1.00 },
    siege:  { legs: 1.0, guns: 1.0, wings: 1.0, bay: 1.0, thrust: 0.20,
              strobe: 1.00, spots: 1.00 }
  };

  scope.createEnforcerControls = function (root, opts) {
    if (typeof THREE === 'undefined') throw new Error('THREE required');
    if (!root) throw new Error('root required');
    opts = opts || {};

    var wings = [], legs = [], bays = [], glows = [];
    ['r', 'l'].forEach(function (tag) {
      var w = root.getObjectByName('wing_' + tag);
      var p = root.getObjectByName('missile_pod_' + tag);
      var g = root.getObjectByName('missile_glow_' + tag);
      if (w) wings.push({ obj: w, sign: tag === 'r' ? 1 : -1 });
      if (p) bays.push(p);
      if (g) glows.push(g);
    });
    for (var i = 0; i < LEG_COUNT; i++) {
      var lg = root.getObjectByName('leg_' + i);
      if (lg) legs.push(lg);
    }
    var cannon = root.getObjectByName('capital_cannon');
    var thrusters = root.getObjectByName('thrusters');
    var lights = root.getObjectByName('lights');
    var beacon = root.getObjectByName('beacon');

    if (wings.length !== 2 || bays.length !== 2 || glows.length !== 2 ||
        legs.length !== LEG_COUNT || !cannon || !thrusters || !lights || !beacon) {
      throw new Error('ATS nodes missing (wing_*/missile_pod_*/missile_glow_*/' +
        'leg_0..2/capital_cannon/thrusters/lights/beacon)');
    }

    /* -------- исходные положения -------- */
    var legRest = legs.map(function (o) { return o.position.y; });

    /* -------- материалы: CPU по умолчанию -------- */
    var mats = [];
    root.traverse(function (o) {
      if (!o.isMesh) return;
      var cpu = new THREE.MeshBasicMaterial({
        vertexColors: true, transparent: false, opacity: 1, toneMapped: false
      });
      // Lambert, а не Phong: блики на светлом металле «съедали» запечённую
      // панелировку, и Lambert дешевле на слабом Android.
      var gpu = new THREE.MeshLambertMaterial({ vertexColors: true });
      mats.push({ mesh: o, cpu: cpu, gpu: gpu });
      o.material = cpu;
    });
    var glowNodes = [thrusters, lights, beacon].concat(glows);
    glowNodes.forEach(function (m) {
      m.material.transparent = true;
      m.material.depthWrite = false;
    });

    /* -------- состояние -------- */
    var mode = 'pad';
    var tLegs = 1, cLegs = 1;
    var tGuns = 0, cGuns = 0;
    var tWings = 0, cWings = 0;
    var tBay = 0, cBay = 0;
    var tThrust = 0, cThrust = 0;
    var tStrobe = 0.30, cStrobe = 0.30;
    var tSpots = 0.45, cSpots = 0.45;
    var enginesOn = true;
    var shader = false;
    var t0 = 0;
    var DEG = Math.PI / 180;

    function lerp(a, b, k) { return a + (b - a) * k; }
    function clamp01(v) { return Math.max(0, Math.min(1, +v)); }

    /* Поворот вокруг точки-пети: three.js вращает узел вокруг его начала,
     * поэтому компенсируем позицией  P - R*P.  Иначе киль/пушка улетают
     * от корпуса (на Пирсе это уже ловили). */
    function pivotSet(obj, axis, ang, pivot) {
      var c = Math.cos(ang), s = Math.sin(ang);
      var px = pivot[0], py = pivot[1], pz = pivot[2];
      var rx, ry, rz;
      if (axis === 'x') {
        rx = px; ry = c * py - s * pz; rz = s * py + c * pz;
        obj.rotation.x = ang; obj.rotation.y = 0; obj.rotation.z = 0;
      } else {
        rx = c * px - s * py; ry = s * px + c * py; rz = pz;
        obj.rotation.x = 0; obj.rotation.y = 0; obj.rotation.z = ang;
      }
      obj.position.set(px - rx, py - ry, pz - rz);
    }

    function applyPose(time) {
      var i;
      // стойки шасси: уборка вверх в гондолы
      for (i = 0; i < legs.length; i++) {
        legs[i].position.y = legRest[i] + LEG_RETRACT * (1 - cLegs);
        legs[i].visible = cLegs > 0.04;
      }
      // capital-пушка: наклон вниз вокруг узла крепления + откат
      pivotSet(cannon, 'z', -GUNS_DEG * DEG * cGuns, GUN_PIVOT);
      cannon.position.x += RECOIL * cGuns;   // откат уходит В корпус
      // крылья: законцовки подняты (патруль/осада), зеркально
      for (i = 0; i < wings.length; i++) {
        pivotSet(wings[i].obj, 'x', -WING_TILT * DEG * cWings * wings[i].sign, LEG_PIVOT);
      }
      // ракетные трубы: золотые донца светятся при открытом люке
      // (корпуса блоков не двигаем — трубы стоят на передней кромке крыла)
      for (i = 0; i < glows.length; i++) {
        glows[i].material.opacity = 0.12 + 0.88 * cBay;
        glows[i].visible = cBay > 0.02;
      }
      // маршевая тяга
      thrusters.visible = enginesOn && cThrust > 0.02;
      if (thrusters.visible) {
        // ВАЖНО: не масштабировать узел свечения — масштаб идёт вокруг начала
        // координат модели, и решётки съезжают со своих устьев. Только яркость.
        thrusters.material.opacity = Math.min(1, cThrust * 1.25) *
          (0.90 + 0.10 * Math.sin(time * 17.0));
      }
      // прожекторы
      lights.material.opacity = cSpots;
      lights.visible = cSpots > 0.02;
      // стробы: сдвоенная красная вспышка
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
        tWings = m.wings;
        tBay = m.bay;
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
      setWings: function (v) { tWings = clamp01(v); mode = 'manual'; return api; },
      getWings: function () { return tWings; },
      setBay: function (v) { tBay = clamp01(v); mode = 'manual'; return api; },
      getBay: function () { return tBay; },
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
          var glow = glowNodes.indexOf(rec.mesh) >= 0;
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
        cWings = lerp(cWings, tWings, Math.min(1, dt * 1.8));
        cBay = lerp(cBay, tBay, Math.min(1, dt * 2.4));
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
          wings: +cWings.toFixed(3), bay: +cBay.toFixed(3),
          thrust: +cThrust.toFixed(3),
          strobe: +cStrobe.toFixed(3), spots: +cSpots.toFixed(3),
          engines: enginesOn, shader: shader
        };
      },
      constants: {
        gunsDeg: GUNS_DEG, wingTilt: WING_TILT,
        legRetract: LEG_RETRACT, baySlide: BAY_SLIDE, recoil: RECOIL
      },
      dispose: function () {
        for (var k = 0; k < mats.length; k++) {
          mats[k].cpu.dispose();
          mats[k].gpu.dispose();
        }
      }
    };

    api.setMode(opts.mode && MODES[opts.mode] ? opts.mode : 'pad');
    cLegs = tLegs; cGuns = tGuns; cWings = tWings; cBay = tBay;
    cThrust = tThrust; cStrobe = tStrobe; cSpots = tSpots;
    applyPose(0);
    return api;
  };
})(typeof window !== 'undefined' ? window : globalThis);
