/* Rainbow Arc controller — Three.js r128. Photoli light levitation.
 * 10 panel sections hover over the hull held by light; four modes:
 *   flight — panelling pressed down, minimal seams
 *   load   — sections spread apart and rise: cargo bay opens from the belly
 *   shield — panelling pulled tight and shifted forward into a shell
 *   lift   — everything lifted high on the light field (hero pose)
 *
 * Two render paths, same numbers:
 *  CPU (default) — unlit vertex colours: hover shimmer + camouflage repainted
 *    on the CPU ~13 times a second; cheapest on weak Android, no custom shaders.
 *  SHADER (setShaderMode) — MeshPhongMaterial + onBeforeCompile patch: real
 *    lighting, vertex hover displacement and per-fragment camouflage, no CPU
 *    repaint at all. Upgrade switch, off by default.
 *
 * Camouflage (setCamouflage 0..1 + setEnvironment): the Arc photoli panels
 * sample a 3-stop environment ramp along the reflected view ray, tinted by the
 * panel's own steel/patina colour (setMetalTint). Alpha cloak: opacity =
 * 1 - 0.88*camo^1.5 on hull/panels/bridge only — the golden light seams, the
 * levitation field and the engine nozzles stay lit, so a cloaked Arc is a
 * ghost hull with its light lines still burning.
 */
(function (scope) {
  var MODES = /*MODES_JSON*/{"flight":[[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0],[0.0,0.0,0.0]],"load":[[-1.717,3.366,1.392],[-1.135,3.618,-1.682],[-0.554,3.87,1.973],[0.028,4.122,-2.264],[0.609,4.374,2.555],[1.191,4.626,-2.845],[1.772,4.878,3.136],[2.354,5.13,-3.427],[2.935,5.382,3.718],[3.517,5.634,-4.008]],"shield":[[-1.498,-0.35,0.0],[-1.343,-0.35,0.0],[-1.188,-0.35,0.0],[-1.033,-0.35,0.0],[-0.878,-0.35,0.0],[-0.722,-0.35,0.0],[-0.567,-0.35,0.0],[-0.412,-0.35,0.0],[-0.257,-0.35,0.0],[-0.102,-0.35,0.0]],"lift":[[0.0,2.879,1.2],[0.0,3.277,-1.2],[0.0,3.614,1.2],[0.0,3.856,-1.2],[0.0,3.984,1.2],[0.0,3.984,-1.2],[0.0,3.856,1.2],[0.0,3.614,-1.2],[0.0,3.277,1.2],[0.0,2.879,-1.2]]};

  var PS = [
    'float ahF = 1.0 - abs(dot(normalize(vAhN), normalize(-vAhV)));',
    'ahF *= ahF;',
    'vec3 ahLocal = vAhP + positionPre;',
    'float ahBand = 0.5 + 0.5 * sin(ahLocal.x * 0.09 + ahLocal.z * 0.13 + uAhTime * uAhFlow);',
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

  scope.createArcControls = function (root) {
    if (typeof THREE === 'undefined') throw new Error('THREE required');
    var hull = root.getObjectByName('hull_core');
    var bridge = root.getObjectByName('bridge');
    var bay = root.getObjectByName('cargo_bay');
    var seams = root.getObjectByName('light_seams');
    var lev = root.getObjectByName('levitation');
    var eng = root.getObjectByName('engines');
    var panels = [];
    for (var i = 0; i < 10; i++) {
      var p = root.getObjectByName('panel_' + i);
      if (p) panels.push(p);
    }
    if (!hull || !seams || !lev || panels.length !== 10)
      throw new Error('rainbow_arc nodes missing');

    /* ---- hover state ---- */
    var mode = 'flight';
    var target = MODES.flight.map(v3);
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
    var body = [hull, bridge].concat(panels);
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
      uAhChm: { value: 0.6 }, uAhSilver: { value: 0.25 }, uAhAmp: { value: 0.06 },
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
            '\tfloat ahW1 = sin(uAhTime * 0.9 + position.x * 0.085 + position.z * 0.11);\n' +
            '\tfloat ahW2 = cos(uAhTime * 0.7 + position.z * 0.13 - position.x * 0.05);\n' +
            '\ttransformed.y += ahW1 * uAhAmp;\n' +
            '\ttransformed.x += ahW2 * uAhAmp * 0.35;\n' +
            '\tvAhP = transformed;')
          .replace('#include <project_vertex>',
            '#include <project_vertex>\n' +
            '\tvAhN = normalize(normalMatrix * normal);\n' +
            '\tvAhV = mvPosition.xyz;\n' +
            '\tvAhU = clamp(position.x / 130.0 + 0.5, 0.0, 1.0);');
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
          var w1 = Math.sin(time * 0.9 + x * 0.085 + z * 0.11);
          var band = 0.5 + 0.5 * Math.sin(x * 0.09 + z * 0.13 + time * flow);
          var irid = chm * 0.10;
          var ph = (x / 130 + 0.5) * 3 + time * 0.35 + hue;
          var r = base[k] + irid * (0.5 + 0.5 * Math.cos(ph)) * band + w1 * 0.012;
          var g1 = base[k + 1] + irid * (0.5 + 0.5 * Math.cos(ph + 2.094)) * band + w1 * 0.012;
          var b = base[k + 2] + irid * (0.5 + 0.5 * Math.cos(ph + 4.188)) * band + w1 * 0.012;
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
          uni.uAhAmp.value = 0.05 + 0.16 * levitation;
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
        panels.forEach(function (p) { p.position.set(0, 0, 0); });
      }
    };
  };
  function clamp01(v) {
    if (!Number.isFinite(v)) throw new Error('Expected finite number');
    return Math.max(0, Math.min(1, v));
  }
})(typeof window !== 'undefined' ? window : globalThis);
