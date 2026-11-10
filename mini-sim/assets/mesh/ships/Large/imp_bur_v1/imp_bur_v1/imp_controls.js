/* Armstrong IMP — контроллер капитального шахтёрского корабля (Star Atlas IMP3).
 * Three.js r128. 443 × 262 × 121 м, экипаж 43.
 *
 * Узлы модели (26):
 *   hull_mid, hull_bow, hull_rear, dorsal, prow_plates, jaws, hangar, gantry,
 *   engines, greebles, fins_l / fins_r — статика
 *   crusher      — барабан-измельчитель на оси буровой головы (вращение вокруг X)
 *   visor_ring   — янтарное кольцо-визор буровой головы (своё свечение)
 *   thrusters    — диски тяги на срезах восьми сопел
 *   lights       — посадочные/рабочие прожекторы и маркеры
 *   arm_0r … arm_2l — шесть «рук» (3 яруса × 2 борта): выдвигаются по своей оси z
 *   pylon_0…3    — стыковочные пилоны: в стыковке опираются на Y = 0, в полёте
 *                  уходят вверх в корпус
 *
 * Режимы (modes.json):
 *   docked  — пилоны выпущены, руки развёрнуты, визор притушен, прожекторы 60 %
 *   mining  — пилоны убраны, барабан 1.2 об/с, визор и прожекторы на максимум
 *   transit — руки задвинуты, тяга 55 %, визор 30 %
 *   warp    — руки задвинуты, тяга 100 %, барабан стоит
 *
 * Два пути отрисовки, одинаковые числа:
 *   CPU (по умолчанию) — MeshBasicMaterial + vertexColors, цвет и затенение
 *     запечены в вершины: 26 draw calls, шейдеров нет, дешёвый путь для слабых
 *     Android.
 *   SHADER (setShaderMode(true)) — MeshPhongMaterial с теми же vertexColors:
 *     настоящий свет сцены, дороже. GLB не пересобирается.
 */
(function (scope) {
  'use strict';

  var ARM_RETRACT = 14.0;        // ход уборки рук по локальной оси z, м
  var CRUSHER_RAD = 2.4;         // 1.0 скорости барабана = 2.4 рад/с

  var MODES = {
    docked:  { arms: 0.0, crusher: 0.0, thrust: 0.0, pylons: 1.0, visor: 0.35, floods: 0.6 },
    mining:  { arms: 0.0, crusher: 1.2, thrust: 0.0, pylons: 0.0, visor: 1.0,  floods: 1.0 },
    transit: { arms: 1.0, crusher: 0.0, thrust: 0.55, pylons: 0.0, visor: 0.30, floods: 0.0 },
    warp:    { arms: 1.0, crusher: 0.0, thrust: 1.0, pylons: 0.0, visor: 0.50, floods: 0.0 }
  };

  scope.createImpControls = function (root, opts) {
    if (typeof THREE === 'undefined') throw new Error('THREE required');
    if (!root) throw new Error('root required');
    opts = opts || {};

    var crusher = root.getObjectByName('crusher');
    var thrusters = root.getObjectByName('thrusters');
    var visor = root.getObjectByName('visor_ring');
    var lights = root.getObjectByName('lights');
    var arms = [], pylons = [];
    for (var i = 0; i < 3; i++) {
      ['r', 'l'].forEach(function (tag) {
        var a = root.getObjectByName('arm_' + i + tag);
        if (a) arms.push(a);
      });
    }
    for (var p = 0; p < 4; p++) {
      var pl = root.getObjectByName('pylon_' + p);
      if (pl) pylons.push(pl);
    }
    if (!crusher || !thrusters || !visor || arms.length !== 6 || pylons.length !== 4) {
      throw new Error('imp nodes missing (crusher / thrusters / visor_ring / arm_* / pylon_*)');
    }

    /* -------- запоминаем исходные положения -------- */
    var armRest = arms.map(function (a) { return a.position.z; });
    // высота крепления пилона над днищем = длина стойки до Y = 0
    var pylonRest = pylons.map(function (q) { return q.position.y; });

    /* -------- материалы: CPU по умолчанию -------- */
    var mats = [];
    root.traverse(function (o) {
      if (!o.isMesh) return;
      var cpu = new THREE.MeshBasicMaterial({
        vertexColors: true, transparent: false, opacity: 1, toneMapped: false
      });
      var gpu = new THREE.MeshPhongMaterial({
        vertexColors: true, shininess: 26, specular: 0x353b45
      });
      mats.push({ mesh: o, cpu: cpu, gpu: gpu });
      o.material = cpu;
    });
    // светящиеся узлы — прозрачные, с записью в буфер не нужны
    var glowMeshes = [thrusters, visor, lights];
    glowMeshes.forEach(function (m) {
      m.material.transparent = true;
      m.material.depthWrite = false;
    });

    /* -------- состояние -------- */
    var mode = 'docked';
    var armT = 0, armC = 0;
    var spinT = 0, spinC = 0, spinAngle = 0;
    var thrustT = 0, thrustC = 0;
    var visorT = 0.35, visorC = 0.35;
    var floodT = 0.6, floodC = 0.6;
    var pylonT = 1, pylonC = 1;
    var enginesOn = true;
    var shader = false;
    var t0 = 0;

    function lerp(a, b, k) { return a + (b - a) * k; }

    function applyPose(time) {
      for (var i = 0; i < arms.length; i++) {
        var sign = armRest[i] >= 0 ? 1 : -1;
        arms[i].position.z = armRest[i] - sign * ARM_RETRACT * armC;
      }
      for (var j = 0; j < pylons.length; j++) {
        // pylonC = 1 — стойка выпущена (ступня на Y = 0), 0 — ушла в корпус
        var up = (1 - pylonC) * pylonRest[j] * 0.92;
        pylons[j].position.y = pylonRest[j] + up;
        pylons[j].visible = pylonC > 0.02;
      }
      crusher.rotation.x = spinAngle;
      thrusters.visible = enginesOn && thrustC > 0.02;
      if (thrusters.visible) {
        thrusters.scale.set(1, 0.6 + 0.4 * thrustC, 0.6 + 0.4 * thrustC);
        thrusters.material.opacity = Math.min(1, thrustC * 1.3) * (0.92 + 0.08 * Math.sin(time * 18.0));
      }
      visor.material.opacity = 0.25 + 0.75 * visorC;
      lights.material.opacity = floodC;
      lights.visible = floodC > 0.02;
    }

    var api = {
      /* ---- режимы ---- */
      setMode: function (name) {
        if (!MODES[name]) throw new Error('unknown mode: ' + name);
        mode = name;
        var m = MODES[name];
        armT = m.arms;
        spinT = m.crusher;
        thrustT = enginesOn ? m.thrust : 0;
        visorT = m.visor;
        floodT = m.floods;
        pylonT = m.pylons;
        return api;
      },
      getMode: function () { return mode; },
      getModes: function () { return Object.keys(MODES); },

      /* ---- ручное управление ---- */
      setArms: function (v) {
        armT = Math.max(0, Math.min(1, +v));
        mode = 'manual';
        return api;
      },
      getArms: function () { return armT; },
      setCrusherSpeed: function (v) {
        spinT = Math.max(0, Math.min(3, +v));
        return api;
      },
      getCrusherSpeed: function () { return spinT; },
      setThrust: function (v) {
        thrustT = Math.max(0, Math.min(1, +v));
        return api;
      },
      getThrust: function () { return thrustT; },
      setVisor: function (v) {
        visorT = Math.max(0, Math.min(1, +v));
        return api;
      },
      getVisor: function () { return visorT; },
      setFloods: function (v) {
        floodT = Math.max(0, Math.min(1, +v));
        return api;
      },
      getFloods: function () { return floodT; },
      setPylons: function (v) {
        pylonT = Math.max(0, Math.min(1, +v));
        return api;
      },
      getPylons: function () { return pylonT; },
      setEngines: function (on) {
        enginesOn = !!on;
        if (!enginesOn) thrustT = 0;
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
        armC = lerp(armC, armT, Math.min(1, dt * 1.6));
        pylonC = lerp(pylonC, pylonT, Math.min(1, dt * 1.4));
        spinC = lerp(spinC, spinT, Math.min(1, dt * 2.2));
        thrustC = lerp(thrustC, thrustT, Math.min(1, dt * 2.6));
        visorC = lerp(visorC, visorT, Math.min(1, dt * 3.0));
        floodC = lerp(floodC, floodT, Math.min(1, dt * 3.4));
        spinAngle += spinC * CRUSHER_RAD * dt;
        if (spinAngle > Math.PI * 2) spinAngle -= Math.PI * 2;
        applyPose(time);
        return api;
      },
      getState: function () {
        return {
          mode: mode, arms: +armC.toFixed(3), armsTarget: armT,
          pylons: +pylonC.toFixed(3), crusher: +spinC.toFixed(3),
          thrust: +thrustC.toFixed(3), visor: +visorC.toFixed(3),
          floods: +floodC.toFixed(3), engines: enginesOn, shader: shader
        };
      },
      armRetract: ARM_RETRACT,
      dispose: function () {
        for (var k = 0; k < mats.length; k++) {
          mats[k].cpu.dispose();
          mats[k].gpu.dispose();
        }
      }
    };

    api.setMode(opts.mode && MODES[opts.mode] ? opts.mode : 'docked');
    armC = armT;
    spinC = spinT;
    thrustC = thrustT;
    visorC = visorT;
    floodC = floodT;
    pylonC = pylonT;
    applyPose(0);
    return api;
  };
})(typeof window !== 'undefined' ? window : globalThis);
