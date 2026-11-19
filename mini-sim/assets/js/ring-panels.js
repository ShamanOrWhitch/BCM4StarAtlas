/*
 * BCMRingPanels — a comic-panel level for each Ring cell (owner 19.11.2026,
 * IDEA-024: "случайный генератор… расширять каждую ячейку… как в комиксах").
 *
 * Pure maths, no THREE: deep-space-warp.js draws what this returns.
 *   buildPanel(seed, cell, { half, height }) ->
 *     { kind, half, height, platforms: [{ minX, maxX, y }], spikes: [{ minX, maxX }] }
 * x runs from -half (left door) to +half (right door), y from the floor (0).
 * Rules every layout keeps: a tier is at most 1.4 m above the one it is reached
 * from and at most 2 m away; spikes stay 2 m clear of both doors; the top tier
 * leaves 1.9 m under the ceiling.
 */
(function (root) {
  "use strict";

  function seeded(seed) {
    var s = (Number(seed) >>> 0) || 1;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function cellSeed(seed, cell) {
    var c = cell || {};
    var h = (Number(seed) >>> 0) ^ 0x5bd1e995;
    [c.x, c.y, c.z].forEach(function (v) {
      h = Math.imul(h ^ ((Number(v) || 0) + 0x9e3779b9), 0x85ebca6b) >>> 0;
      h ^= h >>> 13;
    });
    return h >>> 0;
  }

  function r2(v) { return Math.round(v * 100) / 100; }

  var KINDS = ["steps", "bridge", "tower", "gallery"];

  function buildPanel(seed, cell, opts) {
    var o = opts || {};
    var half = Number(o.half) || 9;
    var height = Number(o.height) || 6;
    var top = Math.min(4.1, height - 1.9);
    var rand = seeded(cellSeed(seed, cell));
    var kind = KINDS[Math.floor(rand() * KINDS.length)];
    var flip = rand() < 0.5 ? 1 : -1; // mirror the layout left/right
    var jit = function (a) { return (rand() - 0.5) * 2 * a; };
    var platforms = [];
    var spikes = [];
    var add = function (cx, w, y) {
      var x0 = cx * flip - w / 2;
      var x1 = cx * flip + w / 2;
      x0 = Math.max(-half + 0.4, x0);
      x1 = Math.min(half - 0.4, x1);
      platforms.push({ minX: r2(x0), maxX: r2(x1), y: r2(Math.min(top, y)) });
    };

    if (kind === "steps") {
      // A staircase climbing across the panel to a lookout ledge.
      var x = -half + 2.6 + jit(0.4);
      var y = 1.3 + jit(0.1);
      for (var i = 0; i < 3; i += 1) {
        add(x, 2.6 + jit(0.3), y);
        x += 3.4 + jit(0.3);
        y += 1.3;
      }
      add(x + 0.6, 3.2, Math.min(top, y - 1.3)); // the ledge level with the last step
      add(half - 2.4, 2.4, 1.3 + jit(0.1)); // a step back down by the far door
      if (rand() < 0.7) spikes.push({ minX: -0.9, maxX: 1.1 }); // 2 m: a jump clears it
    } else if (kind === "bridge") {
      // A spike pit across the middle; stepping stones over it, a high walk above.
      var pitHalf = 3.4 + jit(0.6);
      spikes.push({ minX: -pitHalf, maxX: pitHalf });
      var stones = 3;
      for (var k = 0; k < stones; k += 1) {
        var cx = -pitHalf + 0.9 + (k * (2 * pitHalf - 1.8)) / (stones - 1);
        add(cx, 1.5 + jit(0.2), 1.2 + jit(0.15));
      }
      add(-pitHalf + 1.6, 2.4, 2.5);
      add(pitHalf - 1.6, 2.4, 2.5);
      add(0 + jit(0.6), 3.4, 3.8);
    } else if (kind === "tower") {
      // Zigzag tiers up one side and down the other.
      var side = -1;
      var ty = 1.3;
      for (var t = 0; t < 3; t += 1) {
        add(side * (2.2 + jit(0.4)), 3.2 + jit(0.3), ty + jit(0.08));
        side = -side;
        ty += 1.3;
      }
      add(side * (6.0 + jit(0.3)), 2.6, top - 1.3);
      add(-side * (6.0 + jit(0.3)), 2.6, 1.3);
      if (rand() < 0.6) spikes.push({ minX: -0.8 + jit(0.3), maxX: 0.9 + jit(0.3) });
    } else {
      // Gallery: two long walks with a gap, spike patches below them.
      var gy = 1.4 + jit(0.1);
      add(-half + 4.0, 5.2, gy);
      add(half - 4.0, 5.2, gy);
      add(0 + jit(0.8), 4.2, gy + 1.35);
      add(-3.4 + jit(0.4), 2.2, Math.min(top, gy + 2.7));
      add(3.4 + jit(0.4), 2.2, Math.min(top, gy + 2.7));
      spikes.push({ minX: -5.6 + jit(0.3), maxX: -3.0 + jit(0.3) });
      spikes.push({ minX: 3.0 + jit(0.3), maxX: 5.6 + jit(0.3) });
    }

    // Spikes keep 2 m clear of both doors and are sorted, mirrored like the rest.
    spikes = spikes.map(function (s) {
      var a = s.minX * flip;
      var b = s.maxX * flip;
      return { minX: r2(Math.max(-half + 2, Math.min(a, b))), maxX: r2(Math.min(half - 2, Math.max(a, b))) };
    }).filter(function (s) { return s.maxX - s.minX > 0.5; }).sort(function (a, b) { return a.minX - b.minX; });
    platforms.sort(function (a, b) { return a.y - b.y || a.minX - b.minX; });
    return { kind: kind, half: half, height: height, platforms: platforms, spikes: spikes };
  }

  root.BCMRingPanels = { buildPanel: buildPanel, cellSeed: cellSeed, KINDS: KINDS };
})(typeof window !== "undefined" ? window : globalThis);
