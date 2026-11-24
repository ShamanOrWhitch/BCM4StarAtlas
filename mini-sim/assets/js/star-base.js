/*
 * BCMStarBase — a star base planned from the sector's seed (owner 24.11.2026: "сектора со звёздными
 * базами в стиле Descent ко всем системам … нужны сектора с разными звёздными базами"). Descent is a
 * genre reference only: no code, models or art from it. Our own modular bases from plain shapes, in
 * the style of the sector's faction, light enough for a weak PC (8–48 meshes, shared materials).
 *
 *   seedFor(x, y)            → the sector's seed (same cell, same base)
 *   plan(seed, faction)      → { parts: [{ shape, size, pos, rot, mat }], lights, radius } — pure
 *   build(THREE, plan)       → THREE.Group named "star-base"
 *
 * Styles:
 *   ONI   — rounded: a sphere core, tori, curved petals; violet and teal
 *   MUD   — blocky industry: a box hull, gantries, cargo pods, a red beacon; rust and steel
 *   Ustur — gold symmetry: an octahedral core, a star crown of rings and rays
 *   MRZ   — (no faction) patched: mixed salvaged modules, uneven, yellow hazard lights
 */
(function (root) {
  "use strict";

  function seedFor(x, y) {
    let h = 2166136261 >>> 0;
    const s = Number(x) + "," + Number(y);
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const PALETTE = {
    ONI: { hull: "#3a3f6e", trim: "#9a7cff", glow: "#58ffd0", dark: "#1a1d33" },
    MUD: { hull: "#6b5a4e", trim: "#a0a4a8", glow: "#ff4a3a", dark: "#2a2420" },
    Ustur: { hull: "#c9a24a", trim: "#f4e3bd", glow: "#7fc8ff", dark: "#4a3a1a" },
    MRZ: { hull: "#5a6068", trim: "#8a7a5a", glow: "#ffd23a", dark: "#22262a" }
  };

  function r1(v) { return Math.round(v * 100) / 100; }

  function plan(seed, faction) {
    const style = faction === "ONI" || faction === "MUD" || faction === "Ustur" ? faction : "MRZ";
    const rand = rng(seed);
    const pick = (a, b) => a + rand() * (b - a);
    const parts = [];
    let lights = 0;
    const add = (shape, size, pos, rot, mat) => {
      parts.push({ shape, size: size.map(r1), pos: pos.map(r1), rot: (rot || [0, 0, 0]).map(r1), mat });
      if (mat === "glow") lights += 1;
    };

    if (style === "ONI") {
      const core = pick(7, 11);
      add("sphere", [core], [0, 0, 0], null, "hull");
      const rings = 1 + Math.floor(rand() * 3);
      for (let i = 0; i < rings; i += 1) {
        add("torus", [core * (1.5 + i * 0.6), pick(0.6, 1.2)], [0, pick(-2, 2), 0], [Math.PI / 2 + pick(-0.4, 0.4), 0, pick(-0.3, 0.3)], i % 2 ? "trim" : "hull");
      }
      const petals = 3 + Math.floor(rand() * 4);
      for (let i = 0; i < petals; i += 1) {
        const a = (i / petals) * Math.PI * 2;
        const d = core * pick(1.4, 2.2);
        add("sphere", [pick(1.6, 3)], [Math.cos(a) * d, pick(-3, 3), Math.sin(a) * d], null, "trim");
        add("sphere", [0.7], [Math.cos(a) * (d + 2.5), 0, Math.sin(a) * (d + 2.5)], null, "glow");
      }
      add("cylinder", [0.5, core * 2.6], [0, core * 1.4, 0], null, "trim");
      add("sphere", [1.1], [0, core * 2.7, 0], null, "glow");
    } else if (style === "MUD") {
      const len = pick(22, 34);
      add("box", [len, pick(6, 9), pick(8, 12)], [0, 0, 0], null, "hull");
      const decks = 2 + Math.floor(rand() * 3);
      for (let i = 0; i < decks; i += 1) {
        add("box", [pick(6, 10), pick(3, 6), pick(5, 8)], [pick(-len / 3, len / 3), pick(5, 8), pick(-2, 2)], null, i % 2 ? "trim" : "hull");
      }
      const gantries = 2 + Math.floor(rand() * 3);
      for (let i = 0; i < gantries; i += 1) {
        const x = -len / 2 + (i + 0.5) * (len / gantries);
        add("box", [1.2, 1.2, pick(14, 22)], [x, -2, 0], null, "trim");
        add("box", [pick(3, 4), pick(3, 4), pick(3, 5)], [x, -2, pick(8, 11) * (i % 2 ? 1 : -1)], null, "dark");
      }
      add("cylinder", [pick(2.5, 4), pick(8, 14)], [len / 2 + 3, 0, 0], [0, 0, Math.PI / 2], "dark");
      add("box", [0.8, 9, 0.8], [-len / 3, 9, 0], null, "trim");
      add("sphere", [0.9], [-len / 3, 14, 0], null, "glow");
      add("sphere", [0.7], [len / 2 + 9, 0, 0], null, "glow");
      add("sphere", [0.6], [0, -5, 6], null, "glow");
    } else if (style === "Ustur") {
      const core = pick(6, 9);
      add("octa", [core], [0, 0, 0], [0, pick(0, 1), 0], "hull");
      add("ring", [core * 1.7, core * 2.1], [0, 0, 0], [Math.PI / 2, 0, 0], "trim");
      add("ring", [core * 2.6, core * 2.8], [0, 0, 0], [Math.PI / 2, 0, 0], "hull");
      const rays = 5 + Math.floor(rand() * 4);
      for (let i = 0; i < rays; i += 1) {
        const a = (i / rays) * Math.PI * 2;
        add("box", [core * 1.4, 0.7, 0.7], [Math.cos(a) * core * 2.1, 0, Math.sin(a) * core * 2.1], [0, -a, 0], "trim");
        add("octa", [1.1], [Math.cos(a) * core * 3, 0, Math.sin(a) * core * 3], null, "glow");
      }
      add("octa", [core * 0.45], [0, core * 1.6, 0], null, "glow");
      add("octa", [core * 0.45], [0, -core * 1.6, 0], null, "trim");
    } else {
      // MRZ: whatever was salvaged — a cylinder spine with mismatched modules bolted on.
      const spine = pick(18, 30);
      add("cylinder", [pick(2.5, 4), spine], [0, 0, 0], [0, 0, Math.PI / 2], "hull");
      const mods = 4 + Math.floor(rand() * 5);
      for (let i = 0; i < mods; i += 1) {
        const x = pick(-spine / 2, spine / 2);
        const side = rand() < 0.5 ? -1 : 1;
        const kind = rand();
        if (kind < 0.4) add("box", [pick(3, 7), pick(3, 6), pick(3, 7)], [x, pick(-2, 4), side * pick(4, 7)], [0, pick(-0.5, 0.5), 0], rand() < 0.5 ? "hull" : "dark");
        else if (kind < 0.7) add("cylinder", [pick(1.5, 3), pick(4, 8)], [x, side * pick(4, 6), 0], null, "trim");
        else add("sphere", [pick(2, 3.5)], [x, pick(-3, 3), side * pick(4, 6)], null, "hull");
      }
      add("box", [pick(10, 16), 0.3, pick(5, 8)], [0, pick(6, 9), 0], [0, 0, pick(-0.2, 0.2)], "trim");
      add("sphere", [0.7], [spine / 2 + 1, 0, 0], null, "glow");
      add("sphere", [0.7], [-spine / 2 - 1, 0, 0], null, "glow");
      if (rand() < 0.7) add("sphere", [0.6], [0, 8, 0], null, "glow");
    }
    let radius = 0;
    parts.forEach((p) => { radius = Math.max(radius, Math.hypot(p.pos[0], p.pos[1], p.pos[2]) + Math.max.apply(null, p.size)); });
    return { style, seed: seed >>> 0, parts, lights, radius: r1(radius), palette: PALETTE[style] };
  }

  function build(THREE, plan) {
    const group = new THREE.Group();
    group.name = "star-base";
    group.userData.style = plan.style;
    const mats = {
      hull: new THREE.MeshStandardMaterial({ color: plan.palette.hull, roughness: 0.55, metalness: 0.6 }),
      trim: new THREE.MeshStandardMaterial({ color: plan.palette.trim, roughness: 0.45, metalness: 0.7 }),
      dark: new THREE.MeshStandardMaterial({ color: plan.palette.dark, roughness: 0.8, metalness: 0.4 }),
      glow: new THREE.MeshBasicMaterial({ color: plan.palette.glow })
    };
    const geo = (p) => {
      const s = p.size;
      if (p.shape === "sphere") return new THREE.SphereGeometry(s[0], 14, 10);
      if (p.shape === "torus") return new THREE.TorusGeometry(s[0], s[1], 8, 32);
      if (p.shape === "ring") return new THREE.RingGeometry(s[0], s[1], 40);
      if (p.shape === "cylinder") return new THREE.CylinderGeometry(s[0], s[0], s[1], 12);
      if (p.shape === "octa") return new THREE.OctahedronGeometry(s[0], 0);
      return new THREE.BoxGeometry(s[0], s[1], s[2]);
    };
    plan.parts.forEach((p) => {
      const mesh = new THREE.Mesh(geo(p), mats[p.mat] || mats.hull);
      if (p.shape === "ring") mesh.material = new THREE.MeshStandardMaterial({ color: plan.palette[p.mat] || plan.palette.trim, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.6 });
      mesh.position.set(p.pos[0], p.pos[1], p.pos[2]);
      mesh.rotation.set(p.rot[0], p.rot[1], p.rot[2]);
      group.add(mesh);
    });
    return group;
  }

  root.BCMStarBase = { seedFor, plan, build };
})(typeof window !== "undefined" ? window : globalThis);
