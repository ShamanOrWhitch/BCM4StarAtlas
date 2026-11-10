/* Armstrong IMP Tap controller — Three.js r128, medium miner (Rare, 47.8 x 48.5 x 19 m).
 *
 * Узлы модели:
 *   hull, shell, armor, machinery, drill_mount — статика
 *   drills     — узел на оси барабанов, вращается вокруг локального X
 *   engines    — статика (раструбы дюз)
 *   thrusters  — диски тяги на срезах дюз, отдельный узел (гаснут/загораются)
 *   lights     — посадочные прожекторы и маркеры
 *   leg_0..5   — каждая лапа в своём шарнире (ноль — бедро), складка вокруг X
 *
 * Режимы (modes.json): landed / mining / flight / transit.
 *   landed  — лапы выпущены, ступни на земле, барабаны стоят
 *   mining  — лапы выпущены, барабаны вращаются, корпус мелко вибрирует
 *   flight  — лапы убраны (складка 96°), барабаны медленно, тяга 100 %
 *   transit — лапы убраны, барабаны стоят, тяга 50 %
 *
 * Два пути отрисовки, одинаковые числа:
 *   CPU (по умолчанию) — MeshBasicMaterial + vertexColors: цвет и затенение
 *     запечены в вершины, шейдеров нет, самый дешёвый путь для слабого Android.
 *   SHADER (setShaderMode(true)) — MeshPhongMaterial с vertexColors: настоящий
 *     свет сцены, дороже; вращается тот же GLB, ничего не пересобирается.
 */
(function (scope) {
  'use strict';

  var FOLD_DEG = 96.0;          // полная складка лап (из modes.json)
  var DRILL_RAD_PER_SEC = 6.0;  // 1.0 скорости барабанов = 6 рад/с

  var MODES = {
    landed:  { legs: 0, drills: 0.0,  thrust: 0.0,  lights: 1.0 },
    mining:  { legs: 0, drills: 1.0,  thrust: 0.06, lights: 1.0 },
    flight:  { legs: 1, drills: 0.35, thrust: 1.0,  lights: 0.35 },
    transit: { legs: 1, drills: 0.0,  thrust: 0.5,  lights: 0.0 }
  };

  var DEG = Math.PI / 180;

  scope.createImpTapControls = function (root, opts) {
    if (typeof THREE === 'undefined') throw new Error('THREE required');
    if (!root) throw new Error('root required');
    opts = opts || {};

    var drills = root.getObjectByName('drills');
    var thrusters = root.getObjectByName('thrusters');
    var lights = root.getObjectByName('lights');
    var legs = [];
    for (var i = 0; i < 6; i++) {
      var leg = root.getObjectByName('leg_' + i);
      if (leg) legs.push(leg);
    }
    if (!drills || !thrusters || legs.length !== 6) {
      throw new Error('imp_tap nodes missing (drills / thrusters / leg_0..5)');
    }

    /* ---------------- материалы: CPU по умолчанию ---------------- */
    var meshes = [];
    root.traverse(function (o) { if (o.isMesh) meshes.push(o); });
    var glowNames = { thrusters: 1, lights: 1 };
    var cpuMats = [], shaderMats = [];
    meshes.forEach(function (m) {
      var name = m.name || '';
      var isGlow = !!glowNames[m.parent && m.parent.name];
      var cpu = new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: isGlow,
        opacity: 1,
        depthWrite: !isGlow,
        side: THREE.FrontSide,
        toneMapped: false
      });
      var gpu = new THREE.MeshPhongMaterial({
        vertexColors: true,
        shininess: 22,
        specular: 0x2a2f38,
        transparent: isGlow,
        opacity: 1,
        depthWrite: !isGlow
      });
      cpuMats.push({ mesh: m, cpu: cpu, gpu: gpu, isGlow: isGlow });
      m.material = cpu;
    });

    /* ---------------- состояние ---------------- */
    var mode = 'landed';
    var legTarget = 0, legCur = 0, legSpeed = 1.15;      // доля складки 0..1
    var drillTarget = 0, drillCur = 0, drillAngle = 0;
    var thrustTarget = 0, thrustCur = 0;
    var lightTarget = 1, lightCur = 1;
    var enginesOn = true;
    var shader = false;
    var shake = 0;
    var hipSign = legs.map(function (l) { return l.position.z >= 0 ? 1 : -1; });
    var restY = root.position.y;
    var t0 = 0;

    function lerp(a, b, k) { return a + (b - a) * k; }
    function approach(cur, tgt, step) {
      if (cur < tgt) return Math.min(tgt, cur + step);
      return Math.max(tgt, cur - step);
    }

    function applyPose() {
      for (var k = 0; k < legs.length; k++) {
        var a = FOLD_DEG * legCur * DEG * hipSign[k];
        var l = legs[k];
        // небольшая разница фаз: передние лапы складываются чуть раньше
        l.rotation.x = a;
      }
      drills.rotation.x = drillAngle;
      thrusters.visible = enginesOn && thrustCur > 0.02;
      thrusters.scale.set(1, 0.55 + 0.45 * thrustCur, 0.55 + 0.45 * thrustCur);
      lights.visible = lightCur > 0.02;
    }

    function applyColors(time) {
      var flick = lightCur;
      var pulse = 0.86 + 0.14 * Math.sin(time * 5.2);
      for (var i = 0; i < cpuMats.length; i++) {
        var rec = cpuMats[i];
        var mat = rec.mesh.material;
        if (rec.mesh.parent && rec.mesh.parent.name === 'thrusters') {
          mat.opacity = Math.min(1, thrustCur * 1.25) * (0.9 + 0.1 * Math.sin(time * 21.0));
          mat.color.setScalar(0.55 + 0.6 * thrustCur);
        } else if (rec.mesh.parent && rec.mesh.parent.name === 'lights') {
          mat.opacity = Math.min(1, flick);
          mat.color.setScalar(flick * pulse);
        }
      }
    }

    var api = {
      /* ---- режимы ---- */
      setMode: function (name) {
        if (!MODES[name]) throw new Error('unknown mode: ' + name);
        mode = name;
        var m = MODES[name];
        legTarget = m.legs;
        drillTarget = m.drills;
        thrustTarget = enginesOn ? m.thrust : 0;
        lightTarget = m.lights;
        return api;
      },
      getMode: function () { return mode; },
      getModes: function () { return Object.keys(MODES); },

      /* ---- ручное управление ---- */
      setLegs: function (v) {
        legTarget = Math.max(0, Math.min(1, +v));
        mode = 'manual';
        return api;
      },
      getLegs: function () { return legTarget; },
      setDrillSpeed: function (v) {
        drillTarget = Math.max(0, Math.min(2.5, +v));
        return api;
      },
      getDrillSpeed: function () { return drillTarget; },
      setThrust: function (v) {
        thrustTarget = Math.max(0, Math.min(1, +v));
        return api;
      },
      getThrust: function () { return thrustTarget; },
      setLights: function (v) {
        lightTarget = Math.max(0, Math.min(1, +v));
        return api;
      },
      getLights: function () { return lightTarget; },
      setEngines: function (on) {
        enginesOn = !!on;
        if (!enginesOn) thrustTarget = 0;
        return api;
      },
      getEngines: function () { return enginesOn; },

      /* ---- путь отрисовки ---- */
      setShaderMode: function (on) {
        shader = !!on;
        for (var i = 0; i < cpuMats.length; i++) {
          cpuMats[i].mesh.material = shader ? cpuMats[i].gpu : cpuMats[i].cpu;
        }
        return api;
      },
      getShaderMode: function () { return shader; },

      /* ---- кадр ---- */
      update: function (time, camera) {
        if (t0 === 0) t0 = time;
        var dt = Math.max(0, Math.min(0.12, time - t0));
        t0 = time;
        legCur = approach(legCur, legTarget, dt * legSpeed);
        drillCur = lerp(drillCur, drillTarget, Math.min(1, dt * 3.4));
        thrustCur = lerp(thrustCur, thrustTarget, Math.min(1, dt * 3.0));
        lightCur = lerp(lightCur, lightTarget, Math.min(1, dt * 6.0));
        drillAngle += drillCur * DRILL_RAD_PER_SEC * dt;
        if (drillAngle > Math.PI * 2) drillAngle -= Math.PI * 2;
        // бурение: корпус мелко трясётся
        shake = lerp(shake, drillCur > 0.2 ? 1 : 0, Math.min(1, dt * 4.0));
        root.position.y = restY + Math.sin(time * 26.0) * 0.035 * shake;
        applyPose();
        applyColors(time);
        return api;
      },
      getState: function () {
        return {
          mode: mode, legs: +legCur.toFixed(3), legsTarget: legTarget,
          drills: +drillCur.toFixed(3), thrust: +thrustCur.toFixed(3),
          lights: +lightCur.toFixed(3), engines: enginesOn, shader: shader
        };
      },
      /* ---- служебное ---- */
      foldDegrees: FOLD_DEG,
      dispose: function () {
        for (var i = 0; i < cpuMats.length; i++) {
          cpuMats[i].cpu.dispose();
          cpuMats[i].gpu.dispose();
        }
      }
    };

    api.setMode(opts.mode && MODES[opts.mode] ? opts.mode : 'landed');
    legCur = legTarget;
    thrustCur = thrustTarget;
    lightCur = lightTarget;
    applyPose();
    applyColors(0);
    return api;
  };
})(typeof window !== 'undefined' ? window : globalThis);
