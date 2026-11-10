/* Calico Evac (CALEV) — контроллер спасательной капсулы-корабля (Star Atlas).
 * Three.js r128. 53 × 30 × 13 м, экипаж 7 (пилот, штурман, 2 мед. офицера,
 * оператор оснастки, 2 оператора вооружения).
 *
 * Смысл машины: это капсула эвакуации, которая сама является кораблём спасения.
 * Она приходит к аварийному борту, раскрывает крылья-плоскости, выносит
 * спасательные руки-захваты, спускает из шахт две криокапсулы и выпускает
 * четыре дрона-спасателя, а лебёдка с крюком снимает людей с обшивки.
 *
 * Узлы модели (31):
 *   hull_mid, hull_fwd, hull_rear, spine, tail, engines, bay, greebles,
 *   decals, beacon, drone_cradle_* — статика
 *   thrusters    — циановые диски тяги на четырёх срезах (своё свечение)
 *   lights       — прожекторы, габариты, стробоскопы (общая непрозрачность)
 *   wings_r/l    — дельта-крылья: складка вокруг продольной оси, 0…62°
 *   arms_r/l     — спасательные руки: поворот вниз-вперёд + разворот наружу
 *   pods_r/l     — криокапсулы в шахтах: спуск на 6.2 м и разведение на 2.2 м
 *   drone_0r … drone_1l — четыре дрона: спуск из гнёзд и разведение в стороны
 *   skid_0 … 3   — посадочные лыжи: выпуск на палубу / уборка на 1.35 м
 *   winch        — лебёдка: трос с крюком и люлькой, ход 3.4 м
 *
 * Режимы (modes.json):
 *   pad    — на палубе: лыжи выпущены, крылья сложены, капсулы в шахтах
 *   launch — вылет: лыжи убраны, крылья раскрываются, тяга 100 %
 *   rescue — спасение: руки вынесены, капсулы спущены, дроны выпущены, крюк вниз
 *   evac   — эвакуация: капсулы отделены, дроны идут рядом, тяга 80 %
 *
 * Два пути отрисовки, одинаковые числа:
 *   CPU (по умолчанию) — MeshBasicMaterial + vertexColors: цвет и затенение
 *     запечены в вершины, шейдеров нет, дешёвый путь для слабого Android.
 *   SHADER (setShaderMode(true)) — MeshPhongMaterial с теми же vertexColors:
 *     настоящий свет сцены, дороже. GLB не пересобирается.
 */
(function (scope) {
  'use strict';

  var POD_DROP = 6.2;          // ход капсулы вниз, м
  var POD_SPREAD = 2.2;        // разведение капсул в стороны, м
  var WING_FOLD = 62.0;        // полная складка крыла, градусы
  var ARM_PITCH = 52.0;        // вынос руки вниз-вперёд, градусы
  var ARM_FLARE = 16.0;        // разворот руки наружу, градусы
  var DRONE_DROP = 1.5;        // спуск дрона из гнезда, м
  var DRONE_SPREAD = 1.6;      // разведение дронов, м
  var SKID_RETRACT = 1.35;     // уборка лыж, м
  var WINCH_DROP = 3.4;        // ход крюка, м

  var MODES = {
    pad:    { skids: 1.0, wings: 0.0, arms: 0.0, pods: 0.0, drones: 0.0, winch: 0.0,
              thrust: 0.0, strobe: 0.35, spots: 0.4 },
    launch: { skids: 0.0, wings: 0.35, arms: 0.0, pods: 0.0, drones: 0.35, winch: 0.0,
              thrust: 1.0, strobe: 0.6, spots: 1.0 },
    rescue: { skids: 0.0, wings: 0.0, arms: 1.0, pods: 1.0, drones: 1.0, winch: 0.35,
              thrust: 0.35, strobe: 1.0, spots: 1.0 },
    evac:   { skids: 0.0, wings: 0.0, arms: 0.0, pods: 1.0, drones: 1.0, winch: 0.0,
              thrust: 0.8, strobe: 0.8, spots: 0.7 }
  };

  scope.createCalicoEvacControls = function (root, opts) {
    if (typeof THREE === 'undefined') throw new Error('THREE required');
    if (!root) throw new Error('root required');
    opts = opts || {};

    var wings = [], arms = [], pods = [], drones = [], skids = [];
    ['r', 'l'].forEach(function (tag) {
      var w = root.getObjectByName('wings_' + tag);
      var a = root.getObjectByName('arms_' + tag);
      var p = root.getObjectByName('pods_' + tag);
      if (w) wings.push(w);
      if (a) arms.push(a);
      if (p) pods.push(p);
    });
    for (var d = 0; d < 2; d++) {
      ['r', 'l'].forEach(function (tag) {
        var o = root.getObjectByName('drone_' + d + tag);
        if (o) drones.push(o);
      });
    }
    for (var s = 0; s < 4; s++) {
      var sk = root.getObjectByName('skid_' + s);
      if (sk) skids.push(sk);
    }
    var thrusters = root.getObjectByName('thrusters');
    var lights = root.getObjectByName('lights');
    var beacon = root.getObjectByName('beacon');
    var winch = root.getObjectByName('winch');

    if (wings.length !== 2 || arms.length !== 2 || pods.length !== 2 ||
        drones.length !== 4 || skids.length !== 4 ||
        !thrusters || !lights || !beacon || !winch) {
      throw new Error('calico evac nodes missing (wings_*/arms_*/pods_*/drone_*/skid_*/winch/thrusters/lights/beacon)');
    }

    /* -------- исходные положения -------- */
    var wingRest = wings.map(function (w) {
      return { q: w.quaternion.clone(), sign: w.position.z >= 0 ? 1 : -1 };
    });
    var armRest = arms.map(function (a) { return a.position.z >= 0 ? 1 : -1; });
    var podRest = pods.map(function (p) {
      return { x: p.position.x, y: p.position.y, z: p.position.z, sign: p.position.z >= 0 ? 1 : -1 };
    });
    var droneRest = drones.map(function (o) {
      return { y: o.position.y, z: o.position.z, sign: o.position.z >= 0 ? 1 : -1 };
    });
    var skidRest = skids.map(function (o) { return o.position.y; });
    var winchRest = winch.position.y;

    /* -------- материалы: CPU по умолчанию -------- */
    var mats = [];
    root.traverse(function (o) {
      if (!o.isMesh) return;
      var cpu = new THREE.MeshBasicMaterial({
        vertexColors: true, transparent: false, opacity: 1, toneMapped: false
      });
      var gpu = new THREE.MeshPhongMaterial({
        vertexColors: true, shininess: 30, specular: 0x3a4250
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
    var tSkid = 1, cSkid = 1;
    var tWing = 0, cWing = 0;
    var tArm = 0, cArm = 0;
    var tPod = 0, cPods = 0;
    var tDrone = 0, cDrone = 0;
    var tWinch = 0, cWinch = 0;
    var tThrust = 0, cThrust = 0;
    var tStrobe = 0.35, cStrobe = 0.35;
    var tSpots = 0.4, cSpots = 0.4;
    var enginesOn = true;
    var shader = false;
    var t0 = 0;

    var qFold = new THREE.Quaternion();
    var qYaw = new THREE.Quaternion();
    var qPitch = new THREE.Quaternion();
    var axX = new THREE.Vector3(1, 0, 0);
    var axY = new THREE.Vector3(0, 1, 0);
    var axZ = new THREE.Vector3(0, 0, 1);
    var DEG = Math.PI / 180;

    function lerp(a, b, k) { return a + (b - a) * k; }
    function clamp01(v) { return Math.max(0, Math.min(1, +v)); }

    function applyPose(time) {
      var i;
      // крылья: складка вокруг продольной оси узла
      for (i = 0; i < wings.length; i++) {
        var wr = wingRest[i];
        qFold.setFromAxisAngle(axX, -WING_FOLD * DEG * (1 - cWing) * wr.sign);
        wings[i].quaternion.copy(wr.q).multiply(qFold);
      }
      // руки: вниз-вперёд и наружу
      for (i = 0; i < arms.length; i++) {
        var sg = armRest[i];
        qPitch.setFromAxisAngle(axZ, -ARM_PITCH * DEG * cArm);
        qYaw.setFromAxisAngle(axY, ARM_FLARE * DEG * cArm * sg);
        arms[i].quaternion.copy(qYaw).multiply(qPitch);
      }
      // капсулы: спуск и разведение
      for (i = 0; i < pods.length; i++) {
        var pr = podRest[i];
        pods[i].position.y = pr.y - POD_DROP * cPods;
        pods[i].position.z = pr.z + pr.sign * POD_SPREAD * cPods;
      }
      // дроны: выходят из гнёзд и расходятся
      for (i = 0; i < drones.length; i++) {
        var dr = droneRest[i];
        drones[i].position.y = dr.y - DRONE_DROP * cDrone;
        drones[i].position.z = dr.z + dr.sign * DRONE_SPREAD * cDrone;
      }
      // лыжи
      for (i = 0; i < skids.length; i++) {
        skids[i].position.y = skidRest[i] + SKID_RETRACT * (1 - cSkid);
        skids[i].visible = cSkid > 0.03;
      }
      // лебёдка
      winch.position.y = winchRest - WINCH_DROP * cWinch;
      winch.visible = cWinch > 0.02;
      // тяга
      thrusters.visible = enginesOn && cThrust > 0.02;
      if (thrusters.visible) {
        var k = 0.55 + 0.45 * cThrust;
        thrusters.scale.set(1, k, k);
        thrusters.material.opacity = Math.min(1, cThrust * 1.25) *
          (0.90 + 0.10 * Math.sin(time * 17.0));
      }
      // прожекторы и габариты
      lights.material.opacity = cSpots;
      lights.visible = cSpots > 0.02;
      // стробоскопы: двойная вспышка, красный/синий
      var ph = (time * 1.6) % 1.0;
      var flash = (ph < 0.10 || (ph > 0.16 && ph < 0.26)) ? 1.0 : 0.0;
      beacon.material.opacity = Math.max(0.06, cStrobe * (0.25 + 0.75 * flash));
      beacon.visible = cStrobe > 0.02;
    }

    var api = {
      /* ---- режимы ---- */
      setMode: function (name) {
        if (!MODES[name]) throw new Error('unknown mode: ' + name);
        mode = name;
        var m = MODES[name];
        tSkid = m.skids;
        tWing = m.wings;
        tArm = m.arms;
        tPod = m.pods;
        tDrone = m.drones;
        tWinch = m.winch;
        tThrust = enginesOn ? m.thrust : 0;
        tStrobe = m.strobe;
        tSpots = m.spots;
        return api;
      },
      getMode: function () { return mode; },
      getModes: function () { return Object.keys(MODES); },

      /* ---- ручное управление ---- */
      setSkids: function (v) { tSkid = clamp01(v); mode = 'manual'; return api; },
      getSkids: function () { return tSkid; },
      setWings: function (v) { tWing = clamp01(v); mode = 'manual'; return api; },
      getWings: function () { return tWing; },
      setArms: function (v) { tArm = clamp01(v); mode = 'manual'; return api; },
      getArms: function () { return tArm; },
      setPods: function (v) { tPod = clamp01(v); mode = 'manual'; return api; },
      getPods: function () { return tPod; },
      setDrones: function (v) { tDrone = clamp01(v); mode = 'manual'; return api; },
      getDrones: function () { return tDrone; },
      setWinch: function (v) { tWinch = clamp01(v); mode = 'manual'; return api; },
      getWinch: function () { return tWinch; },
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
        cSkid = lerp(cSkid, tSkid, Math.min(1, dt * 2.4));
        cWing = lerp(cWing, tWing, Math.min(1, dt * 1.5));
        cArm = lerp(cArm, tArm, Math.min(1, dt * 1.5));
        cPods = lerp(cPods, tPod, Math.min(1, dt * 1.1));
        cDrone = lerp(cDrone, tDrone, Math.min(1, dt * 1.2));
        cWinch = lerp(cWinch, tWinch, Math.min(1, dt * 1.8));
        cThrust = lerp(cThrust, tThrust, Math.min(1, dt * 2.6));
        cStrobe = lerp(cStrobe, tStrobe, Math.min(1, dt * 2.2));
        cSpots = lerp(cSpots, tSpots, Math.min(1, dt * 3.0));
        applyPose(time);
        return api;
      },
      getState: function () {
        return {
          mode: mode,
          skids: +cSkid.toFixed(3), wings: +cWing.toFixed(3), arms: +cArm.toFixed(3),
          pods: +cPods.toFixed(3), drones: +cDrone.toFixed(3), winch: +cWinch.toFixed(3),
          thrust: +cThrust.toFixed(3), strobe: +cStrobe.toFixed(3),
          spots: +cSpots.toFixed(3), engines: enginesOn, shader: shader
        };
      },
      constants: {
        podDrop: POD_DROP, podSpread: POD_SPREAD, wingFold: WING_FOLD,
        armPitch: ARM_PITCH, armFlare: ARM_FLARE, droneDrop: DRONE_DROP,
        droneSpread: DRONE_SPREAD, skidRetract: SKID_RETRACT, winchDrop: WINCH_DROP
      },
      dispose: function () {
        for (var k = 0; k < mats.length; k++) {
          mats[k].cpu.dispose();
          mats[k].gpu.dispose();
        }
      }
    };

    api.setMode(opts.mode && MODES[opts.mode] ? opts.mode : 'pad');
    cSkid = tSkid; cWing = tWing; cArm = tArm; cPods = tPod;
    cDrone = tDrone; cWinch = tWinch; cThrust = tThrust;
    cStrobe = tStrobe; cSpots = tSpots;
    applyPose(0);
    return api;
  };
})(typeof window !== 'undefined' ? window : globalThis);
