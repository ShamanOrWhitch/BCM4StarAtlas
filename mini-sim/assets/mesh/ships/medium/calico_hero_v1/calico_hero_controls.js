/* Calico Compakt Hero (CALCH) — контроллер многоцелевого корабля (Star Atlas).
 * Three.js r128. 46.6 × 30.1 × 11.5 м, экипаж 4 (пилот, штурман, 2 оператора
 * вооружения). 18 слотов компонентов: 2 medium + 2 small fixed hardpoint,
 * small и x-small турель, medium и 2 x-small ракетных отсека, 4 блока контрмер,
 * Drone Port; модули Ammo / Cargo / Fuel / Passenger.
 *
 * Что за машина: «Компакт-герой» — рабочий конь флота. Возит авиагруппу и грузы,
 * садится на любую площадку на четырёх стойках, в полёте убирает стойки и
 * отклоняет назад две высокие кормовые плоскости (на чертеже это конфигурации
 * landing / flight), держит управляемость на боковых VTOL-пилонах, вскрывает
 * палубные ракетные отсеки, разворачивает кольцевую турель и выпускает дрон.
 *
 * Узлы модели (28):
 *   hull_fwd, hull_mid, hull_rear, canopy, bay_wells, engines, cms, greebles,
 *   decals — статика
 *   thrusters      — циановые диски на четырёх соплах (своё свечение)
 *   lights         — прожекторы, габариты, подсветка срезов (общая непрозрачность)
 *   beacon         — оранжевые стробы
 *   turret         — кольцо-погон на палубе: разворот вокруг Y на 120°
 *   turret_guns    — стволы на башне: подъём/опускание на 22°
 *   fins_r / _l    — кормовые плоскости: в посадке вертикально, в полёте
 *                    отклоняются назад на 58° (конфигурации A / B)
 *   mbay_r / _l    — крышки ракетных отсеков: раскрываются на 64° наружу
 *   ramp           — кормовой грузовой трап: опускается на 70° вокруг Z
 *   drone_port     — сдвижной люк дрона в днище: выезд на 2.4 м
 *   leg_0…leg_3    — посадочные стойки: выпуск на палубу / уборка на 2.6 м
 *   vtol_r / _l    — прижимные диски VTOL под боковыми пилонами
 *
 * Режимы (modes.json):
 *   pad    — на палубе: стойки выпущены, плоскости вертикально, всё закрыто
 *   flight — полёт: стойки убраны, плоскости отклонены, тяга 70 %
 *   combat — бой: отсеки открыты, турель развёрнута, стволы подняты, контрмеры
 *   cargo  — погрузка: трап опущен, люк дрона сдвинут, VTOL поддув 90 %
 *
 * Два пути отрисовки, одинаковые числа:
 *   CPU (по умолчанию) — MeshBasicMaterial + vertexColors: цвет и затенение
 *     запечены в вершины, шейдеров нет, дешёвый путь для слабого Android.
 *   SHADER (setShaderMode(true)) — MeshPhongMaterial с теми же vertexColors:
 *     настоящий свет сцены, дороже. GLB не пересобирается.
 */
(function (scope) {
  'use strict';

  var FIN_SWEEP = 58.0;        // отклонение кормовых плоскостей назад, градусы
  var LEG_RETRACT = 2.6;       // уборка стоек, м
  var RAMP_OPEN = 70.0;        // опускание трапа, градусы (вокруг Z)
  var MBAY_OPEN = 64.0;        // раскрытие крышек ракетных отсеков, градусы
  var DPORT_SLIDE = 2.4;       // ход люка дрона, м
  var TURRET_YAW = 120.0;      // разворот кольца турели, градусы
  var GUN_PITCH = 22.0;        // подъём стволов, градусы

  var MODES = {
    pad:    { legs: 1.0, fins: 0.0, ramp: 0.0, mbay: 0.0, dport: 0.0, vtol: 0.0,
              thrust: 0.0, turret: 0.0, guns: 0.0, cms: 0.0, strobe: 0.30, spots: 0.45 },
    flight: { legs: 0.0, fins: 1.0, ramp: 0.0, mbay: 0.0, dport: 0.0, vtol: 0.0,
              thrust: 0.70, turret: 0.0, guns: 0.0, cms: 0.0, strobe: 0.55, spots: 1.0 },
    combat: { legs: 0.0, fins: 1.0, ramp: 0.0, mbay: 1.0, dport: 0.0, vtol: 0.0,
              thrust: 0.85, turret: 1.0, guns: 1.0, cms: 1.0, strobe: 1.0, spots: 1.0 },
    cargo:  { legs: 1.0, fins: 0.0, ramp: 1.0, mbay: 0.0, dport: 1.0, vtol: 0.9,
              thrust: 0.0, turret: 0.0, guns: 0.0, cms: 0.0, strobe: 0.40, spots: 0.85 }
  };

  scope.createCalicoHeroControls = function (root, opts) {
    if (typeof THREE === 'undefined') throw new Error('THREE required');
    if (!root) throw new Error('root required');
    opts = opts || {};

    var fins = [], winglets = [], vtols = [], mbays = [], legs = [];
    ['r', 'l'].forEach(function (tag) {
      var f = root.getObjectByName('fins_' + tag);
      var w = root.getObjectByName('winglets_' + tag);
      var v = root.getObjectByName('vtol_' + tag);
      var m = root.getObjectByName('mbay_' + tag);
      if (f) fins.push(f);
      if (w) winglets.push(w);
      if (v) vtols.push(v);
      if (m) mbays.push(m);
    });
    for (var i = 0; i < 4; i++) {
      var lg = root.getObjectByName('leg_' + i);
      if (lg) legs.push(lg);
    }
    var turret = root.getObjectByName('turret');
    var guns = root.getObjectByName('turret_guns');
    var ramp = root.getObjectByName('ramp');
    var dport = root.getObjectByName('drone_port');
    var thrusters = root.getObjectByName('thrusters');
    var lights = root.getObjectByName('lights');
    var beacon = root.getObjectByName('beacon');

    if (fins.length !== 2 || winglets.length !== 2 || vtols.length !== 2 ||
        mbays.length !== 2 || legs.length !== 4 || !turret || !guns || !ramp ||
        !dport || !thrusters || !lights || !beacon) {
      throw new Error('calico hero nodes missing (fins_*/winglets_*/vtol_*/mbay_*/leg_*' +
        '/turret/turret_guns/ramp/drone_port/thrusters/lights/beacon)');
    }

    /* -------- исходные положения -------- */
    var legRest = legs.map(function (o) { return o.position.y; });
    var rampRest = ramp.rotation.z;
    var dportRest = dport.position.x;
    var sign = function (o) { return o.position.z >= 0 ? 1 : -1; };

    /* -------- материалы: CPU по умолчанию -------- */
    var mats = [];
    root.traverse(function (o) {
      if (!o.isMesh) return;
      var cpu = new THREE.MeshBasicMaterial({
        vertexColors: true, transparent: false, opacity: 1, toneMapped: false
      });
      var gpu = new THREE.MeshPhongMaterial({
        vertexColors: true, shininess: 32, specular: 0x3c4452
      });
      mats.push({ mesh: o, cpu: cpu, gpu: gpu });
      o.material = cpu;
    });
    var glowMeshes = [thrusters, lights, beacon];
    glowMeshes.forEach(function (m) {
      m.material.transparent = true;
      m.material.depthWrite = false;
    });

    /* -------- состояние -------- */
    var mode = 'pad';
    var tLegs = 1, cLegs = 1;
    var tFins = 0, cFins = 0;
    var tRamp = 0, cRamp = 0;
    var tMbay = 0, cMbay = 0;
    var tDport = 0, cDport = 0;
    var tVtol = 0, cVtol = 0;
    var tThrust = 0, cThrust = 0;
    var tTurret = 0, cTurret = 0;
    var tGuns = 0, cGuns = 0;
    var tCms = 0, cCms = 0;
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
      // кормовые плоскости: отклонение назад вокруг поперечной оси
      for (i = 0; i < fins.length; i++) {
        fins[i].rotation.z = -FIN_SWEEP * DEG * cFins;
      }
      // стойки: уборка вверх в корпус
      for (i = 0; i < legs.length; i++) {
        legs[i].position.y = legRest[i] + LEG_RETRACT * (1 - cLegs);
        legs[i].visible = cLegs > 0.03;
      }
      // крышки ракетных отсеков: наружу вокруг продольной оси
      for (i = 0; i < mbays.length; i++) {
        mbays[i].rotation.x = sign(mbays[i]) * MBAY_OPEN * DEG * cMbay;
      }
      // трап
      // строго вокруг Z (поперечной оси): вокруг X полотно уходило вбок,
      // прямо в сопла двигателей
      ramp.rotation.z = rampRest - RAMP_OPEN * DEG * cRamp;
      // люк дрона
      dport.position.x = dportRest + DPORT_SLIDE * cDport;
      // турель и стволы
      turret.rotation.y = TURRET_YAW * DEG * cTurret;
      guns.rotation.z = -GUN_PITCH * DEG * cGuns;
      // VTOL-поддув
      vtols.forEach(function (v) {
        v.visible = cVtol > 0.02;
        if (v.visible) {
          var k = 0.5 + 0.5 * cVtol;
          v.scale.set(k, 1, k);
          v.material.opacity = Math.min(1, cVtol * 1.3) * (0.88 + 0.12 * Math.sin(time * 21.0));
        }
      });
      // маршевая тяга
      thrusters.visible = enginesOn && cThrust > 0.02;
      if (thrusters.visible) {
        var tk = 0.55 + 0.45 * cThrust;
        thrusters.scale.set(1, tk, tk);
        thrusters.material.opacity = Math.min(1, cThrust * 1.25) *
          (0.90 + 0.10 * Math.sin(time * 16.0));
      }
      // прожекторы, габариты, контрмеры
      lights.material.opacity = cSpots;
      lights.visible = cSpots > 0.02;
      // стробы: сдвоенная оранжевая вспышка
      var ph = (time * 1.7) % 1.0;
      var flash = (ph < 0.09 || (ph > 0.15 && ph < 0.24)) ? 1.0 : 0.0;
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
        tFins = m.fins;
        tRamp = m.ramp;
        tMbay = m.mbay;
        tDport = m.dport;
        tVtol = m.vtol;
        tThrust = enginesOn ? m.thrust : 0;
        tTurret = m.turret;
        tGuns = m.guns;
        tCms = m.cms;
        tStrobe = m.strobe;
        tSpots = m.spots;
        return api;
      },
      getMode: function () { return mode; },
      getModes: function () { return Object.keys(MODES); },

      /* ---- ручное управление ---- */
      setLegs: function (v) { tLegs = clamp01(v); mode = 'manual'; return api; },
      getLegs: function () { return tLegs; },
      setFins: function (v) { tFins = clamp01(v); mode = 'manual'; return api; },
      getFins: function () { return tFins; },
      setRamp: function (v) { tRamp = clamp01(v); mode = 'manual'; return api; },
      getRamp: function () { return tRamp; },
      setMbays: function (v) { tMbay = clamp01(v); mode = 'manual'; return api; },
      getMbays: function () { return tMbay; },
      setDronePort: function (v) { tDport = clamp01(v); mode = 'manual'; return api; },
      getDronePort: function () { return tDport; },
      setVtol: function (v) { tVtol = clamp01(v); mode = 'manual'; return api; },
      getVtol: function () { return tVtol; },
      setTurret: function (v) { tTurret = Math.max(-1, Math.min(1, +v)); return api; },
      getTurret: function () { return tTurret; },
      setGuns: function (v) { tGuns = clamp01(v); return api; },
      getGuns: function () { return tGuns; },
      setCms: function (v) { tCms = clamp01(v); return api; },
      getCms: function () { return tCms; },
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
          var glow = glowMeshes.indexOf(rec.mesh.parent) >= 0;
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
        cFins = lerp(cFins, tFins, Math.min(1, dt * 1.4));
        cRamp = lerp(cRamp, tRamp, Math.min(1, dt * 1.6));
        cMbay = lerp(cMbay, tMbay, Math.min(1, dt * 2.0));
        cDport = lerp(cDport, tDport, Math.min(1, dt * 1.8));
        cVtol = lerp(cVtol, tVtol, Math.min(1, dt * 2.4));
        cThrust = lerp(cThrust, tThrust, Math.min(1, dt * 2.6));
        cTurret = lerp(cTurret, tTurret, Math.min(1, dt * 2.0));
        cGuns = lerp(cGuns, tGuns, Math.min(1, dt * 2.4));
        cCms = lerp(cCms, tCms, Math.min(1, dt * 2.2));
        cStrobe = lerp(cStrobe, tStrobe, Math.min(1, dt * 2.2));
        cSpots = lerp(cSpots, tSpots, Math.min(1, dt * 3.0));
        applyPose(time);
        return api;
      },
      getState: function () {
        return {
          mode: mode,
          legs: +cLegs.toFixed(3), fins: +cFins.toFixed(3), ramp: +cRamp.toFixed(3),
          mbays: +cMbay.toFixed(3), dronePort: +cDport.toFixed(3),
          vtol: +cVtol.toFixed(3), turret: +cTurret.toFixed(3), guns: +cGuns.toFixed(3),
          cms: +cCms.toFixed(3), thrust: +cThrust.toFixed(3),
          strobe: +cStrobe.toFixed(3), spots: +cSpots.toFixed(3),
          engines: enginesOn, shader: shader
        };
      },
      constants: {
        finSweep: FIN_SWEEP, legRetract: LEG_RETRACT, rampOpen: RAMP_OPEN,
        mbayOpen: MBAY_OPEN, dportSlide: DPORT_SLIDE, turretYaw: TURRET_YAW,
        gunPitch: GUN_PITCH
      },
      dispose: function () {
        for (var k = 0; k < mats.length; k++) {
          mats[k].cpu.dispose();
          mats[k].gpu.dispose();
        }
      }
    };

    api.setMode(opts.mode && MODES[opts.mode] ? opts.mode : 'pad');
    cLegs = tLegs; cFins = tFins; cRamp = tRamp; cMbay = tMbay;
    cDport = tDport; cVtol = tVtol; cThrust = tThrust; cTurret = tTurret;
    cGuns = tGuns; cCms = tCms; cStrobe = tStrobe; cSpots = tSpots;
    applyPose(0);
    return api;
  };
})(typeof window !== 'undefined' ? window : globalThis);
