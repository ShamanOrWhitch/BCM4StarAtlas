/* Rainbow Om armor controller — Three.js r128, CPU only, no custom shaders.
 * Heavy photoli slabs slide across the hull by "thought":
 *   cruise — plates spread over the deck
 *   ram    — armor converges toward the nose, bay ribs seal the cargo slot
 *   aft    — plates cluster over the engines
 *   open   — plates lift off the hull, ribs drop from the belly pod
 * Plus CPU shimmer (vertex colours) on hull/plates/ribs: no GPU required. */
(function (scope) {
  var MODES = {"cruise": [[-1.2, 4.05, -15.0], [1.2, 4.05, -15.0], [-1.2, 4.05, -9.0], [1.2, 4.05, -9.0], [-1.2, 4.05, -3.0], [1.2, 4.05, -3.0], [-4.05, 0.0, -15.0], [4.05, 0.0, -15.0], [0, -4.15, -4.0], [0, -4.15, -1.0], [0, -4.15, 2.0]], "ram": [[0.0, 4.05, 2.0], [-1.2, 4.05, -2.7], [1.2, 4.05, -2.7], [-1.3, 4.05, -7.4], [1.3, 4.05, -7.4], [0.0, 4.05, -12.2], [-4.05, 0.0, -12.8], [4.05, 0.0, -12.8], [0, -4.59, -4.0], [0, -4.59, -1.0], [0, -4.59, 2.0]], "aft": [[-1.2, 4.05, -16.7], [1.2, 4.05, -16.7], [-1.2, 4.05, -11.9], [1.2, 4.05, -11.9], [-1.2, 4.05, -7.1], [1.2, 4.05, -7.1], [-4.05, 0.0, -16.7], [4.05, 0.0, -16.7], [0, -4.15, -4.0], [0, -4.15, -1.0], [0, -4.15, 2.0]], "open": [[-1.2, 4.5, -15.0], [1.2, 4.5, -15.0], [-1.2, 4.5, -9.0], [1.2, 4.5, -9.0], [-1.2, 4.5, -3.0], [1.2, 4.5, -3.0], [-4.5, 0.0, -15.0], [4.5, 0.0, -15.0], [0, -5.35, -4.0], [0, -5.35, -1.0], [0, -5.35, 2.0]]};
  scope.createOmControls = function (root, opts) {
    opts = opts || {};
    if (typeof THREE === 'undefined') throw new Error('THREE is required');
    var hull = root.getObjectByName('hull');
    var trim = root.getObjectByName('trim');
    var glow = root.getObjectByName('engine_glow');
    var plates = [], ribs = [], i;
    for (i = 0; i < 8; i++) { var p = root.getObjectByName('armor_' + i); if (p) plates.push(p); }
    for (i = 0; i < 3; i++) { var r = root.getObjectByName('rib_' + i); if (r) ribs.push(r); }
    if (!hull || !trim || !glow || plates.length !== 8 || ribs.length !== 3)
      throw new Error('rainbow_om nodes missing');
    /* unlit vertex-coloured materials: visible without scene lights, cheapest path */
    var prevTrimM = trim.material, prevGlowM = glow.material;
    trim.material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
    glow.material = new THREE.MeshBasicMaterial({ vertexColors: true });
    var nodes = plates.concat(ribs);
    var target = MODES.cruise.map(function (a) { return new THREE.Vector3(a[0], a[1], a[2]); });
    var mode = 'cruise', lastT = -Infinity, lastPaint = -Infinity;
    var shimmerMeshes = [hull].concat(plates, ribs);
    var material = new THREE.MeshBasicMaterial({ vertexColors: true });
    var data = shimmerMeshes.map(function (m) {
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
            base[k * 4 + c] = (c < isz ? raw[k * isz + c] : 255) * scale;
      } else {
        for (k = 0; k < n; k++) { base[k*4] = 0.16; base[k*4+1] = 0.18; base[k*4+2] = 0.21; base[k*4+3] = 1; }
      }
      var arr = new Float32Array(base);
      g.setAttribute('color', new THREE.BufferAttribute(arr, 4));
      var prevG = m.geometry, prevM = m.material;
      m.geometry = g; m.material = material;
      return { mesh: m, geo: g, base: base, arr: arr, attr: g.getAttribute('color'),
               prevG: prevG, prevM: prevM, pos: g.getAttribute('position') };
    });
    var shimmer = 0.6, flow = 1.0, hue = 0.0;
    function clamp01(v) { if (!Number.isFinite(v)) throw new Error('Expected finite number'); return Math.max(0, Math.min(1, v)); }
    function lerp(dt) {
      var k = 1 - Math.exp(-dt * 5);
      for (var i = 0; i < nodes.length; i++) nodes[i].position.lerp(target[i], k);
    }
    function paint(time) {
      var irid = shimmer * 0.10;
      for (var m = 0; m < data.length; m++) {
        var d = data[m], pos = d.pos, base = d.base, arr = d.arr;
        for (var i = 0, n = pos.count; i < n; i++) {
          var k = i * 4, x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
          var band = Math.pow(Math.max(0, Math.sin(z * 0.55 + x * 0.4 + y * 0.3 - time * flow * 0.8)), 6);
          var ph = hue + (z + x) * 0.25 + time * 0.3;
          var g0 = shimmer * 0.35 * band;
          var r = base[k] * (0.82 + g0) + irid * (0.5 + 0.5 * Math.cos(ph));
          var g1 = base[k+1] * (0.82 + g0) + irid * (0.5 + 0.5 * Math.cos(ph + 2.094));
          var b = base[k+2] * (0.82 + g0) + irid * (0.5 + 0.5 * Math.cos(ph + 4.188));
          arr[k] = r < 0 ? 0 : r > 1 ? 1 : r;
          arr[k+1] = g1 < 0 ? 0 : g1 > 1 ? 1 : g1;
          arr[k+2] = b < 0 ? 0 : b > 1 ? 1 : b;
          arr[k+3] = base[k+3];
        }
        d.attr.needsUpdate = true;
      }
    }
    return {
      setArmorMode: function (name) {
        if (!MODES[name]) throw new Error('Unknown armor mode: ' + name);
        mode = name;
        target = MODES[name].map(function (a) { return new THREE.Vector3(a[0], a[1], a[2]); });
      },
      getArmorMode: function () { return mode; },
      setEngines: function (on) { glow.visible = !!on; },
      setShimmer: function (v) { shimmer = clamp01(v); },
      setFlow: function (v) { if (!Number.isFinite(v)) throw new Error('Expected finite number'); flow = Math.max(0, Math.min(3, v)); },
      setHue: function (v) { if (!Number.isFinite(v)) throw new Error('Expected finite number'); hue = v; },
      update: function (time) {
        if (!Number.isFinite(time)) return;
        var dt = lastT < 0 || time < lastT ? 0.05 : Math.min(0.1, time - lastT);
        lastT = time;
        lerp(dt);
        if (shimmer > 0 && time - lastPaint >= 1/30) { lastPaint = time; paint(time); }
      },
      dispose: function () {
        data.forEach(function (d) { d.mesh.geometry = d.prevG; d.mesh.material = d.prevM; d.geo.dispose(); });
        material.dispose();
        trim.material = prevTrimM; glow.material = prevGlowM;
      }
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
