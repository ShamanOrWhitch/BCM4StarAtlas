/* Rainbow Phi controller — Three.js r128. Photoli light levitation.
 * 16 panelling sections hover over the triangular frame held by light; five modes:
 *   cruise     — panelling pressed down onto the frame
 *   levitation — sections lifted in waves on the light field (hero pose)
 *   shield     — panelling pulled tight and shifted forward into a shell
 *   iris       — terrace plates rise aside: the assembly deck is exposed
 *   dismantle  — the whole panelling breaks away on its own trajectories and
 *                tilts: the hull comes apart into 16 pieces (full teardown)
 *
 * Two render paths, same numbers:
 *  CPU (default) — unlit vertex colours: hover shimmer + camouflage repainted
 *    on the CPU ~13 times a second; cheapest on weak Android, no custom shaders.
 *  SHADER (setShaderMode) — MeshPhongMaterial + onBeforeCompile patch: real
 *    lighting, vertex hover displacement and per-fragment camouflage, no CPU
 *    repaint at all. Upgrade switch, off by default.
 *
 * Camouflage (setCamouflage 0..1 + setEnvironment): the Phi photoli panelling
 * samples a 3-stop environment ramp along the reflected view ray, tinted by the
 * plate's own steel/copper colour (setMetalTint). Alpha cloak: opacity =
 * 1 - 0.88*camo^1.5 on the frame, terraces, wall plates and the 8 sections
 * only — the golden rim lights, the gold core triangle and the engine nozzles
 * stay lit: a cloaked Phi is a ghost triangle with its emblem still burning.
 */
(function (scope) {
  var MODES = /*MODES_JSON*/{"cruise":[[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0]],"levitation":[[0.0,273.68,26.0],[9.76,284.91,23.75],[17.84,289.8,17.4],[22.83,288.14,8.03],[23.87,280.01,-2.72],[20.78,265.76,-13.0],[14.11,246.02,-21.03],[4.99,221.64,-25.43],[-4.99,193.69,-25.43],[-14.11,163.4,-21.03],[-20.78,132.08,-13.0],[-23.87,101.11,-2.72],[-22.83,71.84,8.03],[-17.84,45.55,17.4],[-9.76,23.39,23.75],[-0.0,6.32,26.0]],"shield":[[-24.0,34.0,0.0],[-28.0,31.73,0.0],[-32.0,29.47,0.0],[-36.0,27.2,0.0],[-40.0,24.93,0.0],[-44.0,22.67,0.0],[-48.0,20.4,0.0],[-52.0,18.13,0.0],[-56.0,15.87,0.0],[-60.0,13.6,0.0],[-64.0,11.33,0.0],[-68.0,9.07,0.0],[-72.0,6.8,0.0],[-76.0,4.53,0.0],[-80.0,2.27,0.0],[-84.0,0.0,0.0]],"iris":[[-75.0,176.0,-45.0],[-65.0,234.57,-39.0],[-55.0,283.01,-33.0],[-45.0,312.95,-27.0],[-35.0,319.21,-21.0],[-25.0,300.71,-15.0],[-15.0,260.64,-9.0],[-5.0,205.94,-3.0],[5.0,146.06,3.0],[15.0,91.36,9.0],[25.0,51.29,15.0],[35.0,32.79,21.0],[45.0,39.05,27.0],[55.0,68.99,33.0],[65.0,117.43,39.0],[75.0,176.0,45.0]],"dismantle":[[520.0,420.0,0.0],[475.04,528.11,211.5],[347.95,631.5,386.44],[160.69,725.65,494.55],[-54.35,806.44,517.15],[-260.0,870.33,450.33],[-420.69,914.55,305.65],[-508.64,937.15,108.11],[-508.64,937.15,-108.11],[-420.69,914.55,-305.65],[-260.0,870.33,-450.33],[-54.35,806.44,-517.15],[160.69,725.65,-494.55],[347.95,631.5,-386.44],[475.04,528.11,-211.5],[520.0,420.0,-0.0]]};
  var ROTS = /*ROTS_JSON*/{"cruise":[[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0]],"levitation":[[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0]],"shield":[[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0]],"iris":[[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0]],"dismantle":[[0.0,28.0,0.0],[8.95,22.65,13.38],[16.35,8.65,17.9],[20.92,-8.65,10.58],[21.88,-22.65,-3.74],[19.05,-28.0,-15.59],[12.93,-22.65,-17.12],[4.57,-8.65,-7.32],[-4.57,8.65,7.32],[-12.93,22.65,17.12],[-19.05,28.0,15.59],[-21.88,22.65,3.74],[-20.92,8.65,-10.58],[-16.35,-8.65,-17.9],[-8.95,-22.65,-13.38],[-0.0,-28.0,-0.0]]};

  var PS = [
    'float ahF = 1.0 - abs(dot(normalize(vAhN), normalize(-vAhV)));',
    'ahF *= ahF;',
    'vec3 ahLocal = vAhP + positionPre;',
    'float ahBand = 0.5 + 0.5 * sin(ahLocal.x * 0.006 + ahLocal.z * 0.009 + uAhTime * uAhFlow);',
    'float ahIrid = uAhChm * 0.10;',
    'float ahPh = vAhU * 3.0 + uAhTime * 0.35 + uAhHue + ahF * uAhChm * 2.4;',
    'diffuseColor.rgb += vec3(ahIrid * (0.5 + 0.5 * cos(ahPh)) * ahBand,',
    '  ahIrid * (0.5 + 0.5 * cos(ahPh + 2.094)) * ahBand,',
    '  ahIrid * (0.5 + 0.5 * cos(ahPh + 4.188)) * ahBand);',
    'float ahEdge = ahF * uAhChm * 0.10 + ahF * uAhSilver * 0.12;',
    'diffuseColor.rgb += vec3(ahEdge);',
    'if (uAhCamo > 0.0) {',
    '  vec3 ahR = reflect(normalize(vAhV), normalize(vAhN));',
    '  float ahCr = dot(ahR, uAhUpV);',
    '  vec3 ahEnv = ahCr >= 0.0 ? mix(uAhEnvH, uAhEnvZ, ahCr) : mix(uAhEnvH, uAhEnvG, -ahCr);',
    '  float ahLum = (diffuseColor.r + diffuseColor.g + diffuseColor.b) / 3.0;',
    '  ahEnv *= mix(vec3(1.0), max(vec3(0.5), diffuseColor.rgb / max(vec3(ahLum), vec3(0.05))), uAhTint);',
    '  float ahW = min(0.9, uAhCamo * (0.62 + 0.38 * ahF) + uAhCamo * uAhCamo * 0.20);',
    '  diffuseColor.rgb = mix(diffuseColor.rgb, ahEnv, ahW);',
    '}'
  ].join('\n');

  scope.createPhiControls = function (root) {
    if (typeof THREE === 'undefined') throw new Error('THREE required');
    var hull = root.getObjectByName('hull_ring');
    var bridge = root.getObjectByName('terraces');
    var bay = root.getObjectByName('core_emblem');
    var seams = root.getObjectByName('edge_lights');
    var lev = root.getObjectByName('core_emblem');
    var eng = root.getObjectByName('engines');
    var panels = [];
    for (var i = 0; i < 16; i++) {
      var p = root.getObjectByName('plates_' + i);
      if (p) panels.push(p);
    }
    if (!hull || !seams || !lev || panels.length !== 16)
      throw new Error('rainbow_phi nodes missing');

    /* ---- hover state ---- */
    var mode = 'cruise';
    var target = MODES.cruise.map(v3);
    var targetRot = (ROTS.cruise || MODES.cruise).map(rad3);
    var curRot = panels.map(function () { return new THREE.Vector3(); });
    function rad3(a) {
      return new THREE.Vector3(a[0] * Math.PI / 180, a[1] * Math.PI / 180, a[2] * Math.PI / 180);
    }
    var curOff = panels.map(function () { return new THREE.Vector3(); });
    function v3(a) { return new THREE.Vector3(a[0], a[1], a[2]); }

    /* ---- palette state ---- */
    var chm = 0.6, flow = 1.0, hue = 0.0, silver = 0.25, tint = 1.0;
    var camo = 0, levitation = 0.7, levT = 0;

    /* ---- environment ramp ---- */
    var envZ = [0.10, 0.14, 0.26], envH = [0.20, 0.26, 0.42], envG = [0.05, 0.06, 0.10];
    function pick(src) {
      if (typeof src === 'number')
        return [((src >> 16) & 255) / 255, ((src >> 8) & 255) / 255, (src & 255) / 255];
      if (Array.isArray(src) || (src && typeof src.length === 'number'))
        return [src[0], src[1], src[2]];
      if (src && src.isColor) return [src.r, src.g, src.b];
      throw new Error('unsupported environment colour');
    }
    function setEnvironment(src) {
      if (src == null) throw new Error('setEnvironment expects a colour or a ramp');
      if (src.zenith || src.horizon || src.ground) {
        if (src.zenith) envZ = pick(src.zenith);
        if (src.horizon) envH = pick(src.horizon);
        if (src.ground) envG = pick(src.ground);
        return;
      }
      var c = pick(src);
      envH = c.slice();
      envZ = [Math.min(1, c[0] * 1.7), Math.min(1, c[1] * 1.7), Math.min(1, c[2] * 1.7)];
      envG = [c[0] * 0.45, c[1] * 0.45, c[2] * 0.45];
    }

    /* ---- CPU path: per-mesh colour buffers for hull / panels / bridge ---- */
    var wallPlates = root.getObjectByName('wall_plates');
    var greebles = root.getObjectByName('greebles');
    var lowerHull = root.getObjectByName('lower_hull');
    var keel = root.getObjectByName('keel');
    // прячем весь корпус: рама, террасы, кромка, механизация, нижняя палуба,
    // киль и восемь подвижных секций. Свет и эмблема остаются горящими.
    var body = [hull, bridge, wallPlates, greebles, lowerHull, keel]
      .filter(Boolean).concat(panels);
    var cpu = body.map(function (m) {
      var g = m.geometry.clone();
      var src = g.getAttribute('color');
      var n = g.getAttribute('position').count;
      var base = new Float32Array(n * 4);
      if (src) {
        var raw = src.array, isz = src.itemSize, mx = 0, k;
        for (k = 0; k < raw.length; k++) if (raw[k] > mx) mx = raw[k];
        var scale = mx > 1.5 ? 1 / 255 : 1;
        for (k = 0; k < n; k++)
          for (var c = 0; c < 4; c++)
            base[k * 4 + c] = (c < isz ? raw[k * isz + c] : 1) * scale;
      } else {
        for (k = 0; k < n; k++) { base[k * 4] = 0.16; base[k * 4 + 1] = 0.17; base[k * 4 + 2] = 0.18; base[k * 4 + 3] = 1; }
      }
      var arr = new Float32Array(base);
      g.setAttribute('color', new THREE.BufferAttribute(arr, 4));
      var prevG = m.geometry, prevM = m.material;
      m.geometry = g;
      return { mesh: m, geo: g, base: base, arr: arr, attr: g.getAttribute('color'),
               pos: g.getAttribute('position'), nrm: g.getAttribute('normal'),
               prevG: prevG, prevM: prevM };
    });
    var mat = cpu[0].mesh.material;                     // unlit, shared look
    cpu.forEach(function (d) { d.mesh.material = mat; });

    /* ---- shader path ---- */
    var shaderOn = false, phong = null, prevOnBC = null, litBackup = [];
    var uni = {
      uAhTime: { value: 0 }, uAhFlow: { value: 1 }, uAhHue: { value: 0 },
      uAhChm: { value: 0.6 }, uAhSilver: { value: 0.25 }, uAhAmp: { value: 8.0 },
      uAhCamo: { value: 0 }, uAhTint: { value: 1 },
      uAhEnvZ: { value: new THREE.Color(0.10, 0.14, 0.26) },
      uAhEnvH: { value: new THREE.Color(0.20, 0.26, 0.42) },
      uAhEnvG: { value: new THREE.Color(0.05, 0.06, 0.10) },
      uAhUpV: { value: new THREE.Vector3(0, 1, 0) }
    };
    var tmpQ = new THREE.Quaternion();

    function installShader() {
      phong = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 42, specular: 0x4a5560 });
      prevOnBC = phong.onBeforeCompile;
      phong.onBeforeCompile = function (shader) {
        Object.keys(uni).forEach(function (k) { shader.uniforms[k] = uni[k]; });
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vAhN;varying vec3 vAhV;varying vec3 vAhP;varying float vAhU;uniform float uAhTime;uniform float uAhFlow;uniform float uAhAmp;uniform float uAhHue;')
          .replace('#include <begin_vertex>',
            '#include <begin_vertex>\n' +
            '\tfloat ahW1 = sin(uAhTime * 0.9 + position.x * 0.004 + position.z * 0.005);\n' +
            '\tfloat ahW2 = cos(uAhTime * 0.7 + position.z * 0.006 - position.x * 0.003);\n' +
            '\ttransformed.y += ahW1 * uAhAmp;\n' +
            '\ttransformed.x += ahW2 * uAhAmp * 0.35;\n' +
            '\tvAhP = transformed;')
          .replace('#include <project_vertex>',
            '#include <project_vertex>\n' +
            '\tvAhN = normalize(normalMatrix * normal);\n' +
            '\tvAhV = mvPosition.xyz;\n' +
            '\tvAhU = clamp(position.x / 3236.0 + 0.5, 0.0, 1.0);');
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vAhN;varying vec3 vAhV;varying vec3 vAhP;varying float vAhU;\n' +
            'uniform float uAhTime;uniform float uAhFlow;uniform float uAhHue;uniform float uAhChm;uniform float uAhSilver;\n' +
            'uniform float uAhCamo;uniform float uAhTint;uniform vec3 uAhEnvZ;uniform vec3 uAhEnvH;uniform vec3 uAhEnvG;uniform vec3 uAhUpV;')
          .replace('#include <color_fragment>', '#include <color_fragment>\n' + PS);
      };
      body.forEach(function (m) {
        litBackup.push({ mesh: m, material: m.material });
        m.material = phong;
      });
      phong.needsUpdate = true;
    }

    function removeShader() {
      litBackup.forEach(function (b) { b.mesh.material = b.material; });
      litBackup = [];
      if (phong) { phong.dispose(); phong = null; }
    }

    /* ---- alpha cloak ---- */
    function applyCloak() {
      var t = camo > 0;
      var op = t ? 1 - 0.88 * Math.pow(camo, 1.5) : 1;
      body.forEach(function (m) {
        var mm = m.material;
        if (mm.transparent !== t) { mm.transparent = t; mm.needsUpdate = true; }
        mm.opacity = op;
        mm.depthWrite = !t;
      });
    }

    /* ---- CPU repaint: hover shimmer per vertex + camouflage ---- */
    var camPos = new THREE.Vector3(), upLocal = new THREE.Vector3(), tmpV = new THREE.Vector3();
    function paint(time, camera) {
      var hasCam = camo > 0 && camera && camera.isCamera;
      if (hasCam) camera.getWorldPosition(camPos);
      for (var di = 0; di < cpu.length; di++) {
        var d = cpu[di], pos = d.pos, nrm = d.nrm, base = d.base, arr = d.arr;
        if (hasCam) {
          upLocal.set(0, 1, 0);
          d.mesh.getWorldQuaternion(tmpQ);
          upLocal.applyQuaternion(tmpQ.conjugate());
        }
        for (var i = 0, n = pos.count; i < n; i++) {
          var k = i * 4, x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
          var w1 = Math.sin(time * 0.6 + x * 0.004 + z * 0.005);
          var band = 0.5 + 0.5 * Math.sin(x * 0.006 + z * 0.009 + time * flow);
          var irid = chm * 0.10;
          var ph = (x / 3236 + 0.5) * 3 + time * 0.35 + hue;
          var r = base[k] + irid * (0.5 + 0.5 * Math.cos(ph)) * band + w1 * 0.010;
          var g1 = base[k + 1] + irid * (0.5 + 0.5 * Math.cos(ph + 2.094)) * band + w1 * 0.010;
          var b = base[k + 2] + irid * (0.5 + 0.5 * Math.cos(ph + 4.188)) * band + w1 * 0.010;
          if (hasCam) {
            var nx = nrm ? nrm.getX(i) : 0, ny = nrm ? nrm.getY(i) : 1, nz = nrm ? nrm.getZ(i) : 0;
            var nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
            nx /= nl; ny /= nl; nz /= nl;
            var ix = x - camPos.x, iy = y - camPos.y, iz = z - camPos.z;
            var il = Math.sqrt(ix * ix + iy * iy + iz * iz) || 1;
            ix /= il; iy /= il; iz /= il;
            var vdn = -(ix * nx + iy * ny + iz * nz);
            var fres = 1 - (vdn < 0 ? -vdn : vdn);
            fres *= fres;
            var idn = ix * nx + iy * ny + iz * nz;
            var cr = (ix - 2 * idn * nx) * upLocal.x + (iy - 2 * idn * ny) * upLocal.y + (iz - 2 * idn * nz) * upLocal.z;
            var er, eg, eb;
            if (cr >= 0) {
              er = envH[0] + (envZ[0] - envH[0]) * cr;
              eg = envH[1] + (envZ[1] - envH[1]) * cr;
              eb = envH[2] + (envZ[2] - envH[2]) * cr;
            } else {
              er = envH[0] + (envG[0] - envH[0]) * (-cr);
              eg = envH[1] + (envG[1] - envH[1]) * (-cr);
              eb = envH[2] + (envG[2] - envH[2]) * (-cr);
            }
            if (tint > 0) {
              var ml = (base[k] + base[k + 1] + base[k + 2]) / 3;
              var inv = ml > 0.02 ? 1 / ml : 1;
              er *= 1 + (clampR(base[k] * inv, 0.5, 2.0) - 1) * tint;
              eg *= 1 + (clampR(base[k + 1] * inv, 0.5, 2.0) - 1) * tint;
              eb *= 1 + (clampR(base[k + 2] * inv, 0.5, 2.0) - 1) * tint;
            }
            var wgt = camo * (0.62 + 0.38 * fres) + camo * camo * 0.20;
            if (wgt > 0.9) wgt = 0.9;
            r += (er - r) * wgt;
            g1 += (eg - g1) * wgt;
            b += (eb - b) * wgt;
          }
          arr[k] = r < 0 ? 0 : r > 1 ? 1 : r;
          arr[k + 1] = g1 < 0 ? 0 : g1 > 1 ? 1 : g1;
          arr[k + 2] = b < 0 ? 0 : b > 1 ? 1 : b;
          arr[k + 3] = base[k + 3];
        }
        d.attr.needsUpdate = true;
      }
    }
    function clampR(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

    /* ---- light field: seams and levitation glow breathe, engines stay lit ---- */
    function paintGlow(time) {
      var pulse = 0.72 + 0.28 * levitation * (0.5 + 0.5 * Math.sin(time * 1.5));
      if (seams) seams.material.color.setRGB(pulse, pulse * 0.82, pulse * 0.5);
      if (lev) lev.material.color.setRGB(pulse, pulse * 0.86, pulse * 0.55);
    }

    var lastT = -Infinity, lastPaint = -Infinity;

    return {
      /* --- modes --- */
      setMode: function (name) {
        if (!MODES[name]) throw new Error('Unknown mode: ' + name);
        mode = name;
        target = MODES[name].map(v3);
        targetRot = (ROTS[name] || MODES[name]).map(rad3);
      },
      getMode: function () { return mode; },
      /* --- look --- */
      setChameleon: function (v) { chm = clamp01(v); },
      getChameleon: function () { return chm; },
      setFlow: function (v) { flow = Math.max(0, Math.min(3, v)); },
      getFlow: function () { return flow; },
      setHue: function (v) { hue = v; },
      getHue: function () { return hue; },
      setSilver: function (v) { silver = clamp01(v); },
      getSilver: function () { return silver; },
      setMetalTint: function (v) { tint = clamp01(v); },
      getMetalTint: function () { return tint; },
      setLevitation: function (v) { levitation = clamp01(v); },
      getLevitation: function () { return levitation; },
      setEngines: function (on) { if (eng) eng.visible = !!on; },
      getEngines: function () { return eng ? eng.visible : false; },
      /* --- camouflage --- */
      setEnvironment: setEnvironment,
      setCamouflage: function (v) { camo = clamp01(v); applyCloak(); lastPaint = -Infinity; },
      getCamouflage: function () { return camo; },
      /* --- render path --- */
      setShaderMode: function (v) {
        v = !!v;
        if (v === shaderOn) return v;
        shaderOn = v;
        if (v) installShader(); else removeShader();
        applyCloak();
        return v;
      },
      getShaderMode: function () { return shaderOn; },
      /* --- frame --- */
      update: function (time, camera) {
        if (!Number.isFinite(time)) return;
        var dt = lastT < 0 || time < lastT ? 0.05 : Math.min(0.1, time - lastT);
        lastT = time;
        // hover easing: panels drift to their targets
        var k = 1 - Math.exp(-dt * 4);
        for (var i = 0; i < panels.length; i++) {
          curOff[i].lerp(target[i], k);
          panels[i].position.copy(curOff[i]);
          // разборка: секции не только уезжают, но и разворачиваются
          curRot[i].lerp(targetRot[i], k);
          panels[i].rotation.set(curRot[i].x, curRot[i].y, curRot[i].z);
        }
        paintGlow(time);
        if (shaderOn) {
          uni.uAhTime.value = time;
          uni.uAhFlow.value = flow;
          uni.uAhHue.value = hue;
          uni.uAhChm.value = chm;
          uni.uAhSilver.value = silver;
          uni.uAhCamo.value = camo;
          uni.uAhTint.value = tint;
          uni.uAhAmp.value = 4.0 + 26.0 * levitation;
          uni.uAhEnvZ.value.setRGB(envZ[0], envZ[1], envZ[2]);
          uni.uAhEnvH.value.setRGB(envH[0], envH[1], envH[2]);
          uni.uAhEnvG.value.setRGB(envG[0], envG[1], envG[2]);
          if (camera) {
            camera.getWorldQuaternion(tmpQ);
            uni.uAhUpV.value.set(0, 1, 0).applyQuaternion(tmpQ.conjugate());
          }
        } else if (time - lastPaint >= 1 / 13) {
          lastPaint = time;
          paint(time, camera);
        }
      },
      dispose: function () {
        if (shaderOn) { removeShader(); shaderOn = false; }
        cpu.forEach(function (d) {
          d.mesh.geometry = d.prevG; d.mesh.material = d.prevM; d.geo.dispose();
        });
        mat.dispose();
        panels.forEach(function (p) { p.position.set(0, 0, 0); p.rotation.set(0, 0, 0); });
      }
    };
  };
  function clamp01(v) {
    if (!Number.isFinite(v)) throw new Error('Expected finite number');
    return Math.max(0, Math.min(1, v));
  }
})(typeof window !== 'undefined' ? window : globalThis);
