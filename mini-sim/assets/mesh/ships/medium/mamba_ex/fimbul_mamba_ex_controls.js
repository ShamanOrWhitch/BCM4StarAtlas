/* Fimbul Mamba (FBLMAM) — контроллер среднего охотника за головами (Star Atlas).
 * Three.js r128. 38 × 18 × 9 м, экипаж 5 (пилот, штурман, 2 оператора
 * вооружения, офицер безопасности). Слоты: 4 medium fixed hardpoint,
 * 2 small турели, missile bay small, 3 блока контрмер, Drone Port,
 * Tractor Beam, Scanner; модули Fuel / 2× Ammo / Cargo.
 *
 * Что за машина: «38 м чистой тощей охотничьей машины». Катамаран из двух
 * длинных орудийных клыков с круглыми дульными масками, между ними —
 * компактный центральный корпус с кабиной, корма — тяжёлый блок сопел с
 * выносными кормовыми коробами и зелёными плавниками. Никакой мишуры:
 * бортовая броня, грязь, бронзовые магистрали, винные полосы.
 * Длинного остекления в средней части нет: там низкий броневой гребень.
 *
 * Узлы модели (27):
 *   pod_r / pod_l, center_hull, canopy, rear_block, engines, rail_guns_r/l,
 *   turret_base_r/l, missile_bay, greebles, decals — статика
 *   thrusters        — циановые диски в раструбах (своё свечение)
 *   lights           — прожекторы, габариты, палубные люки (общая непрозрачность)
 *   beacon           — оранжевые стробы
 *   gun_r / gun_l    — носовые блоки стволов: подъём на 16° вокруг Z
 *   turret_r / _l    — малые турели на клыках: разворот на 110° вокруг Y
 *   bay_door         — крышка ракетного отсека: раскрытие на 60° вокруг Z
 *   ramp             — аппарель в переднем проёме: откидывается на 140°
 *   leg_0…leg_5      — посадочные стойки: выпуск на палубу / уборка на 1.9 м
 *
 * Режимы (modes.json):
 *   pad    — на палубе: стойки выпущены, стволы в походном, всё закрыто
 *   flight — полёт: стойки убраны, тяга 75 %
 *   hunt   — охота: стволы подняты, турели развёрнуты, отсек открыт
 *   load   — погрузка: стойки выпущены, ракетный отсек открыт, люки горят
 *            (старое имя режима 'brig' принимается как псевдоним)
 *
 * Два пути отрисовки, одинаковые числа:
 *   CPU (по умолчанию) — MeshBasicMaterial + vertexColors: цвет и затенение
 *     запечены в вершины, шейдеров нет, дешёвый путь для слабого Android.
 *   SHADER (setShaderMode(true)) — MeshLambertMaterial с теми же vertexColors:
 *     настоящий свет сцены, дороже. GLB не пересобирается.
 */
(function (scope) {
  'use strict';

  var GUN_ELEV = 16.0;        // подъём носовых блоков, градусы
  var TURRET_YAW = 110.0;     // разворот малых турелей, градусы
  var TURRET_PITCH = 18.0;    // подъём стволов турели, градусы
  var BAY_OPEN = 60.0;        // крышка отсека поднимается на 60° (дальше
                              // 78° выносила верх за габарит 9 м)
  var RAMP_OPEN = 140.0;      // аппарель откидывается вниз-вперёд, градусы
  var LEG_RETRACT = 1.9;      // уборка стоек, м

  var MODES = {
    pad:    { legs: 1.0, guns: 0.0, turret: 0.0, bay: 0.0, ramp: 0.0,
              thrust: 0.0, strobe: 0.30, spots: 0.45 },
    flight: { legs: 0.0, guns: 0.0, turret: 0.0, bay: 0.0, ramp: 0.0,
              thrust: 0.75, strobe: 0.55, spots: 1.0 },
    hunt:   { legs: 0.0, guns: 1.0, turret: 1.0, bay: 1.0, ramp: 0.0,
              thrust: 0.90, strobe: 1.0, spots: 1.0 },
    load:   { legs: 1.0, guns: 0.0, turret: 0.0, bay: 1.0, ramp: 1.0,
              thrust: 0.0, strobe: 0.40, spots: 0.85 }
  };

  scope.createFimbulMambaControls = function (root, opts) {
    if (typeof THREE === 'undefined') throw new Error('THREE required');
    if (!root) throw new Error('root required');
    opts = opts || {};

    var guns = [], turrets = [], legs = [];
    ['r', 'l'].forEach(function (tag) {
      var g = root.getObjectByName('gun_' + tag);
      var t = root.getObjectByName('turret_' + tag);
      if (g) guns.push(g);
      if (t) turrets.push(t);
    });
    for (var i = 0; i < 6; i++) {
      var lg = root.getObjectByName('leg_' + i);
      if (lg) legs.push(lg);
    }
    var bay = root.getObjectByName('bay_door');
    var ramp = root.getObjectByName('ramp');
    var thrusters = root.getObjectByName('thrusters');
    var lights = root.getObjectByName('lights');
    var beacon = root.getObjectByName('beacon');

    if (guns.length !== 2 || turrets.length !== 2 || legs.length !== 6 ||
        !bay || !ramp || !thrusters || !lights || !beacon) {
      throw new Error('fimbul mamba nodes missing (gun_*/turret_*/leg_0..5' +
        '/bay_door/ramp/thrusters/lights/beacon)');
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
    var tTurret = 0, cTurret = 0;
    var tBay = 0, cBay = 0;
    var tRamp = 0, cRamp = 0;
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
      // малые турели на клыках: разворот в борт
      for (i = 0; i < turrets.length; i++) {
        turrets[i].rotation.y = sign(turrets[i]) * TURRET_YAW * DEG * cTurret;
        turrets[i].rotation.z = -TURRET_PITCH * DEG * cTurret;
      }
      // крышка ракетного отсека
      bay.rotation.z = -BAY_OPEN * DEG * cBay;
      // аппарель: петля внизу проёма, плита уходит вперёд-вниз к палубе
      ramp.rotation.z = RAMP_OPEN * DEG * cRamp;
      // маршевая тяга
      thrusters.visible = enginesOn && cThrust > 0.02;
      if (thrusters.visible) {
        var tk = 0.60 + 0.40 * cThrust;
        thrusters.scale.set(1, tk, tk);
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
        tTurret = m.turret;
        tBay = m.bay;
        tRamp = m.ramp || 0;
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
      setTurret: function (v) { tTurret = clamp01(v); mode = 'manual'; return api; },
      getTurret: function () { return tTurret; },
      setBay: function (v) { tBay = clamp01(v); mode = 'manual'; return api; },
      getBay: function () { return tBay; },
      setRamp: function (v) { tRamp = clamp01(v); mode = 'manual'; return api; },
      getRamp: function () { return tRamp; },
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
        cTurret = lerp(cTurret, tTurret, Math.min(1, dt * 1.8));
        cBay = lerp(cBay, tBay, Math.min(1, dt * 2.0));
        cRamp = lerp(cRamp, tRamp, Math.min(1, dt * 1.6));
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
          turret: +cTurret.toFixed(3), bay: +cBay.toFixed(3), ramp: +cRamp.toFixed(3),
          thrust: +cThrust.toFixed(3),
          strobe: +cStrobe.toFixed(3), spots: +cSpots.toFixed(3),
          engines: enginesOn, shader: shader
        };
      },
      constants: {
        gunElev: GUN_ELEV, turretYaw: TURRET_YAW, turretPitch: TURRET_PITCH,
        bayOpen: BAY_OPEN, rampOpen: RAMP_OPEN, legRetract: LEG_RETRACT
      },
      dispose: function () {
        for (var k = 0; k < mats.length; k++) {
          mats[k].cpu.dispose();
          mats[k].gpu.dispose();
        }
      }
    };

    api.setMode(opts.mode && MODES[opts.mode] ? opts.mode : 'pad');
    cLegs = tLegs; cGuns = tGuns; cTurret = tTurret; cBay = tBay; cRamp = tRamp;
    cThrust = tThrust; cStrobe = tStrobe; cSpots = tSpots;
    applyPose(0);
    return api;
  };
})(typeof window !== 'undefined' ? window : globalThis);
