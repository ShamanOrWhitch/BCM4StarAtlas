/*
 * BCMSectorLook — every planet sector has its own space (owner 24.11.2026: "неужели нельзя
 * сделать простой космический оригинальный сектор … все сектора с планетами одинаковые").
 *
 * The ship used to arrive in every planet sector at the same ONI CSS scene. Now the sector is
 * dressed for its planet: a large planet with its own procedural surface (bands, craters, dunes,
 * aurora), its own rings and moons, its own light and nebula tint. Outside ONI CSS the ONI station
 * sphere and the station traffic are hidden; the landing gate stays (it is how the ship goes down).
 *
 *   BCMSectorLook.LOOKS                 — the data of every look (pure, tested in node)
 *   BCMSectorLook.lookFor(planetId)     — the look of a planet, or null
 *   BCMSectorLook.apply(runtime, id)    — dress the live scene (id null = clear)
 *   BCMSectorLook.current()             — the id that is applied now
 *
 * Built from a few meshes and one canvas texture per planet: no model files, no second context.
 */
(function (root) {
  "use strict";

  var LOOKS = {
    // Fable stands at ONI CSS: the purple world the owner asked for, with a green-violet aurora.
    fable: {
      id: "fable", title: "Fable",
      planet: { radius: 46, at: [-70, 26, -330], tilt: 0.35, spin: 0.012 },
      surface: { kind: "aurora", base: "#3a1f6e", band: "#7a4fd0", accent: "#58ffd0", bands: 9 },
      ring: null,
      moons: [{ radius: 4, orbit: 70, speed: 0.05, color: "#d9ccff" }],
      light: "#b48cff", nebula: "#5a2d9c", stars: "#e2d6ff", keepStation: true, suns: 1
    },
    // Twinsun: an orange dune world under two suns, a dusty haze, no station nearby.
    first: {
      id: "first", title: "Twinsun",
      planet: { radius: 52, at: [60, -10, -360], tilt: 0.12, spin: 0.008 },
      surface: { kind: "dunes", base: "#b8551e", band: "#ffb35a", accent: "#7a2e14", bands: 14 },
      ring: null,
      moons: [],
      light: "#ffb15a", nebula: "#9a3a1a", stars: "#ffd9a8", keepStation: false, suns: 2
    },
    // Opus: a pale amber limestone world with a thin white ring and one grey moon. Calm.
    opus: {
      id: "opus", title: "Opus",
      planet: { radius: 40, at: [-20, 40, -300], tilt: 0.42, spin: 0.006 },
      surface: { kind: "terraces", base: "#d9c09a", band: "#f4e3bd", accent: "#4a6a52", bands: 6 },
      ring: { inner: 1.35, outer: 1.95, color: "#fff4e0", opacity: 0.55 },
      moons: [{ radius: 5, orbit: 88, speed: 0.03, color: "#c9d6e3" }],
      light: "#fff1d6", nebula: "#2b3f63", stars: "#fff4e0", keepStation: false, suns: 1
    },
    // Pearce (MUD CSS): a blue-green ocean world with white cloud swirls.
    pearce: {
      id: "pearce", title: "Pearce",
      planet: { radius: 50, at: [80, 30, -340], tilt: 0.25, spin: 0.01 },
      surface: { kind: "ocean", base: "#1d4f7a", band: "#3f8f6a", accent: "#eef6ff", bands: 10 },
      ring: null,
      moons: [{ radius: 6, orbit: 92, speed: 0.04, color: "#bfbfbf" }],
      light: "#cfe8ff", nebula: "#163a5a", stars: "#dfefff", keepStation: true, suns: 1
    },
    // Ioki (Ustur CSS): a rust-red cratered world with two small moons.
    ioki: {
      id: "ioki", title: "Ioki",
      planet: { radius: 42, at: [-80, -14, -320], tilt: 0.18, spin: 0.009 },
      surface: { kind: "craters", base: "#8a3420", band: "#c25a32", accent: "#4a1a10", bands: 4 },
      ring: { inner: 1.3, outer: 1.5, color: "#c9a08a", opacity: 0.35 },
      moons: [{ radius: 3, orbit: 60, speed: 0.08, color: "#9a8070" }, { radius: 2.2, orbit: 76, speed: -0.06, color: "#7a6a60" }],
      light: "#ffcab0", nebula: "#4a1a14", stars: "#ffe0d0", keepStation: true, suns: 1
    }
  };

  function lookFor(id) {
    return Object.prototype.hasOwnProperty.call(LOOKS, id) ? LOOKS[id] : null;
  }

  // Small seeded random so a planet's surface is the same on every visit.
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function paintSurface(doc, look) {
    var canvas = doc.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    var ctx = canvas.getContext("2d");
    if (!ctx) return canvas;
    var s = look.surface;
    var rand = rng(look.id.length * 7919 + s.bands * 31);
    ctx.fillStyle = s.base;
    ctx.fillRect(0, 0, 512, 256);
    var i;
    if (s.kind === "aurora" || s.kind === "dunes" || s.kind === "terraces") {
      // Latitude bands, wavy for dunes, stepped for terraces.
      for (i = 0; i < s.bands; i += 1) {
        var y = (i + rand() * 0.6) * (256 / s.bands);
        ctx.globalAlpha = 0.25 + rand() * 0.35;
        ctx.fillStyle = i % 2 ? s.band : s.accent;
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (var x = 0; x <= 512; x += 16) {
          var wave = s.kind === "dunes" ? Math.sin(x * 0.05 + i) * 6 : s.kind === "terraces" ? Math.round(Math.sin(x * 0.02 + i) * 2) * 4 : Math.sin(x * 0.03 + i * 2) * 3;
          ctx.lineTo(x, y + wave);
        }
        ctx.lineTo(512, y + 256 / s.bands * 0.6);
        ctx.lineTo(0, y + 256 / s.bands * 0.6);
        ctx.fill();
      }
    }
    if (s.kind === "aurora") {
      // Polar curtains of light.
      ctx.globalAlpha = 0.55;
      var g = ctx.createLinearGradient(0, 0, 0, 60);
      g.addColorStop(0, s.accent);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 512, 60);
    }
    if (s.kind === "ocean") {
      // Continents and cloud swirls.
      for (i = 0; i < 9; i += 1) {
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = s.band;
        ctx.beginPath();
        ctx.ellipse(rand() * 512, 40 + rand() * 176, 20 + rand() * 50, 10 + rand() * 30, rand() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = s.accent;
      ctx.lineWidth = 4;
      for (i = 0; i < 14; i += 1) {
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(rand() * 512, rand() * 256, 10 + rand() * 30, rand() * 3, rand() * 3 + 2.5);
        ctx.stroke();
      }
    }
    if (s.kind === "craters" || s.kind === "terraces") {
      var count = s.kind === "craters" ? 60 : 12;
      for (i = 0; i < count; i += 1) {
        var r = 3 + rand() * (s.kind === "craters" ? 16 : 6);
        var cx = rand() * 512;
        var cy = 20 + rand() * 216;
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = s.accent;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = s.band;
        ctx.beginPath();
        ctx.arc(cx - r * 0.25, cy - r * 0.25, r * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    return canvas;
  }

  var state = { id: null, group: null, hidden: [], runtime: null, moons: [], planet: null, look: null };

  function clear() {
    if (state.group && state.group.parent) state.group.parent.remove(state.group);
    if (state.group) {
      state.group.traverse(function (obj) {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (obj.material.map) obj.material.map.dispose();
          obj.material.dispose();
        }
      });
    }
    state.hidden.forEach(function (obj) { obj.visible = true; obj.userData.bcmSectorHidden = false; });
    state.hidden = [];
    state.group = null;
    state.moons = [];
    state.planet = null;
    state.id = null;
    state.look = null;
  }

  function apply(runtime, id) {
    if (state.id === id && state.group) return state.group;
    clear();
    var look = lookFor(id);
    if (!look || !runtime || !runtime.scene || !runtime.THREE) return null;
    var THREE = runtime.THREE;
    var doc = root.document;
    var group = new THREE.Group();
    group.name = "sector-look-" + id;
    group.userData.planet = id;

    var map = doc ? new THREE.CanvasTexture(paintSurface(doc, look)) : null;
    var p = look.planet;
    var planet = new THREE.Mesh(
      new THREE.SphereGeometry(p.radius, 48, 32),
      new THREE.MeshStandardMaterial({ map: map, color: map ? 0xffffff : look.surface.base, roughness: 0.9, metalness: 0,
        emissive: new THREE.Color(look.surface.base), emissiveIntensity: 0.18, fog: false })
    );
    planet.name = "sector-planet-" + id;
    planet.position.set(p.at[0], p.at[1], p.at[2]);
    planet.rotation.z = p.tilt;
    group.add(planet);
    state.planet = planet;

    // A soft rim of the planet's own light (an atmosphere you can tell from far away).
    var halo = new THREE.Mesh(
      new THREE.SphereGeometry(p.radius * 1.06, 32, 24),
      new THREE.MeshBasicMaterial({ color: look.light, transparent: true, opacity: 0.16, side: THREE.BackSide, depthWrite: false, fog: false })
    );
    halo.position.copy(planet.position);
    group.add(halo);

    if (look.ring) {
      var ring = new THREE.Mesh(
        new THREE.RingGeometry(p.radius * look.ring.inner, p.radius * look.ring.outer, 96),
        new THREE.MeshBasicMaterial({ color: look.ring.color, transparent: true, opacity: look.ring.opacity, side: THREE.DoubleSide, depthWrite: false, fog: false })
      );
      ring.name = "sector-ring-" + id;
      ring.position.copy(planet.position);
      ring.rotation.set(Math.PI / 2 - 0.25, 0, p.tilt);
      group.add(ring);
    }

    state.moons = look.moons.map(function (m, index) {
      var moon = new THREE.Mesh(
        new THREE.SphereGeometry(m.radius, 20, 14),
        new THREE.MeshStandardMaterial({ color: m.color, roughness: 1, fog: false })
      );
      moon.name = "sector-moon-" + id + "-" + index;
      moon.userData.orbit = m;
      moon.userData.phase = index * 2.1;
      group.add(moon);
      return moon;
    });

    // The sector's own light, and a second sun for Twinsun.
    var light = new THREE.DirectionalLight(look.light, 0.9);
    light.position.set(p.at[0] + 200, p.at[1] + 120, p.at[2] + 260);
    light.target = planet;
    group.add(light);
    for (var k = 0; k < look.suns; k += 1) {
      var sun = new THREE.Mesh(
        new THREE.SphereGeometry(k ? 6 : 10, 16, 12),
        new THREE.MeshBasicMaterial({ color: k ? "#fff6e0" : look.light, fog: false })
      );
      sun.name = "sector-sun-" + id + "-" + k;
      sun.position.set(p.at[0] + 260 - k * 140, p.at[1] + 150 + k * 40, p.at[2] - 200);
      group.add(sun);
    }

    // A tinted nebula shell far around the scene: each sector has its own sky colour.
    var shell = new THREE.Mesh(
      new THREE.SphereGeometry(900, 24, 16),
      new THREE.MeshBasicMaterial({ color: look.nebula, transparent: true, opacity: 0.22, side: THREE.BackSide, depthWrite: false, fog: false })
    );
    shell.name = "sector-nebula-" + id;
    shell.renderOrder = -10;
    group.add(shell);

    runtime.scene.add(group);
    state.group = group;
    state.id = id;
    state.look = look;
    state.runtime = runtime;

    // Outside ONI CSS the ONI station (satellite, its traffic, the station sphere) is not in this sky.
    if (!look.keepStation) {
      runtime.scene.traverse(function (obj) {
        if (obj.name === "onicss-companion-sphere" || obj.name === "space-satellite") {
          if (obj.visible) {
            obj.visible = false;
            obj.userData.bcmSectorHidden = true;
            state.hidden.push(obj);
          }
        }
      });
    }
    return group;
  }

  /** Per frame: the planet turns, the moons orbit, hidden station parts stay hidden. */
  function update(dt) {
    if (!state.group || !state.look) return;
    if (state.planet) state.planet.rotation.y += state.look.planet.spin * dt;
    state.moons.forEach(function (moon) {
      var o = moon.userData.orbit;
      moon.userData.phase += o.speed * dt;
      var c = state.planet.position;
      moon.position.set(c.x + Math.cos(moon.userData.phase) * o.orbit, c.y + Math.sin(moon.userData.phase) * o.orbit * 0.25, c.z + Math.sin(moon.userData.phase) * o.orbit);
    });
    state.hidden.forEach(function (obj) { if (obj.visible) obj.visible = false; });
  }

  root.BCMSectorLook = {
    LOOKS: LOOKS,
    lookFor: lookFor,
    apply: apply,
    clear: clear,
    update: update,
    current: function () { return state.id; }
  };
})(typeof window !== "undefined" ? window : globalThis);
