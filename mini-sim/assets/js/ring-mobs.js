/*
 * BCMRingMobs — the pig mobs of the Ring cells. Owner 24.11.2026 (BUG-028): "мобы не проработаны";
 * the cells held 0.7 x 0.9 m boxes that all walked the same way. The looks are the owner's sheet
 * art/ring-bosses/pig-mobs-sheet.png (cut into assets/ring-bosses/mobs.webp by tools/ring-mobs/cut.mjs),
 * and each look moves its own way.
 *
 * Pure maths, no THREE: ring-platformer.js draws the mob and applies the damage.
 *
 *   const mob = BCMRingMobs.create(kind, { offset, dir, limit, astral });
 *   const out = mob.step(dt, { targetOffset, targetY, near });   // offsets from the cell centre, metres
 *   out = { kind, state, offset, y, facing, flash, hurts, box: { x0, x1, y0, y1 } }  (y from the floor)
 *   mob.hit() — one laser hit; true when the mob is down.
 *
 * Kinds, in the order of the sheet (row by row):
 *   base     — walks.                          spiky    — walks slowly, two hits.
 *   ice      — slides fast, glides past a turn. toxic    — waddles, two hits.
 *   drill    — revs when the pilot is ahead, then charges across the cell and sticks.
 *   tank     — crawls, three hits.             spider   — hangs under the ceiling, drops on the pilot.
 *   angel    — flies in waves.                 amethyst — walks, three hits.
 * Numbers are first-pass values for playtest, not final tuning.
 */
(function (root) {
  "use strict";

  var KINDS = ["base", "spiky", "ice", "toxic", "drill", "tank", "spider", "angel", "amethyst"];
  var SPEC = {
    base: { speed: 1.7, hp: 1, height: 1.0 },
    spiky: { speed: 1.3, hp: 2, height: 1.05 },
    ice: { speed: 3.0, hp: 1, height: 1.0, slide: true },
    toxic: { speed: 1.1, hp: 2, height: 1.1 },
    drill: { speed: 1.0, hp: 2, height: 1.0, charge: 5.4 },
    tank: { speed: 0.7, hp: 3, height: 1.1 },
    spider: { speed: 1.4, hp: 1, height: 1.0, hang: 3.6 },
    angel: { speed: 1.5, hp: 1, height: 1.0, fly: true },
    amethyst: { speed: 1.2, hp: 3, height: 1.05 }
  };
  // Each pig's rectangle in assets/ring-bosses/mobs.webp, [x0, y0, x1, y1] with y from the top
  // (printed by tools/ring-mobs/cut.mjs); the feet stand on the rectangle's bottom edge.
  var ART = [
    [0.006, 0.0247, 0.3273, 0.3275],
    [0.3398, 0.0062, 0.6602, 0.3275],
    [0.6781, 0.0062, 0.9886, 0.3275],
    [0.0099, 0.3395, 0.3234, 0.6608],
    [0.3394, 0.3551, 0.6606, 0.6608],
    [0.6727, 0.3405, 0.994, 0.6608],
    [0.006, 0.6992, 0.3273, 0.9941],
    [0.3394, 0.6895, 0.6606, 0.9941],
    [0.6834, 0.6729, 0.9832, 0.9941]
  ];
  var ASPECT = ART.map(function (r) { return (r[2] - r[0]) / (r[3] - r[1]); });

  function kindAt(index) {
    var n = Math.abs(Math.floor(Number(index) || 0)) % KINDS.length;
    return KINDS[n];
  }

  function create(kind, opts) {
    if (KINDS.indexOf(kind) < 0) kind = "base";
    var o = opts || {};
    var spec = SPEC[kind];
    var limit = Number(o.limit) || 2.15;
    var chargeLimit = Math.max(limit, Number(o.chargeLimit) || 6.5);
    var astral = !!o.astral;
    var s = {
      kind: kind, hp: spec.hp, state: kind === "spider" ? "hang" : kind === "angel" ? "fly" : "walk",
      offset: Number(o.offset) || 0, dir: Number(o.dir) < 0 ? -1 : 1, v: 0,
      y: kind === "spider" ? spec.hang : 0, t: 0, clock: 0, flash: 0, phase: (Number(o.phase) || 0)
    };
    var height = spec.height;
    var width = height * ASPECT[KINDS.indexOf(kind)];

    function go(state) { s.state = state; s.t = 0; }
    function patrol(speed, d, lim) {
      s.offset += s.dir * speed * d;
      if (s.offset > lim) { s.offset = lim; s.dir = -1; }
      if (s.offset < -lim) { s.offset = -lim; s.dir = 1; }
    }

    function step(dt, input) {
      var d = Math.max(0, Math.min(0.1, Number(dt) || 0));
      var inp = input || {};
      var near = !!inp.near && Number.isFinite(inp.targetOffset);
      var tx = Number(inp.targetOffset) || 0;
      var ty = Number(inp.targetY) || 0;
      s.t += d;
      s.clock += d;
      s.flash = Math.max(0, s.flash - d);
      var hurts = true;
      if (kind === "ice") {
        // Slides: speeds up and glides a little past the turn.
        s.v += (s.dir * spec.speed - s.v) * Math.min(1, d * 1.4);
        s.offset += s.v * d;
        if (s.offset > limit) s.dir = -1;
        if (s.offset < -limit) s.dir = 1;
        s.offset = Math.max(-limit - 0.8, Math.min(limit + 0.8, s.offset));
        s.y = 0;
      } else if (kind === "drill") {
        if (s.state === "walk") {
          patrol(spec.speed, d, limit);
          s.y = 0;
          var ahead = (tx - s.offset) * s.dir;
          if (near && ahead > 0.6 && ahead < 6 && Math.abs(ty) < 1.2) go("rev");
        } else if (s.state === "rev") {
          // The tell: it stops and revs before it goes.
          if (s.t >= 0.55) go("charge");
        } else if (s.state === "charge") {
          s.offset += s.dir * spec.charge * d;
          if (Math.abs(s.offset) >= chargeLimit) { s.offset = Math.sign(s.offset) * chargeLimit; go("stuck"); }
        } else if (s.state === "stuck") {
          if (s.t >= 0.9) { s.dir *= -1; go("walk"); }
        }
      } else if (kind === "spider") {
        var top = spec.hang;
        if (s.state === "hang") {
          patrol(spec.speed, d, limit);
          s.y = top;
          hurts = false;
          if (near && Math.abs(tx - s.offset) < 1.0 && ty < 1.5) go("drop");
        } else if (s.state === "drop") {
          s.y = Math.max(0, s.y - 9 * d);
          if (s.y <= 0) go("ground");
        } else if (s.state === "ground") {
          if (s.t >= 1.2) go("climb");
        } else if (s.state === "climb") {
          s.y = Math.min(top, s.y + 2.2 * d);
          if (s.y >= top) go("hang");
        }
      } else if (kind === "angel") {
        patrol(spec.speed, d, limit + 1.2);
        s.y = 1.25 + Math.sin(s.clock * 1.7 + s.phase) * 0.9;
      } else {
        patrol(spec.speed, d, limit);
        s.y = 0;
      }
      // A purple (astral) cell lifts the walkers a little; the lift is drawn, never added to s.y
      // (a revving drill keeps s.y and would climb away frame by frame).
      var lift = astral && kind !== "spider" && kind !== "angel" ? 0.65 + Math.sin(s.clock * 1.3 + s.phase) * 0.12 : 0;
      var moving = s.state === "walk" || s.state === "fly" || s.state === "charge" || s.state === "hang" || kind === "ice";
      var facing = kind === "ice" ? (s.v < 0 ? -1 : 1) : s.dir;
      // A small step hop while it walks on the floor; nothing in the air.
      var bob = moving && s.y < 0.05 && kind !== "ice" && kind !== "tank" ? Math.abs(Math.sin(s.clock * spec.speed * 4)) * 0.05 : 0;
      var half = width * 0.4;
      return {
        kind: kind, state: s.state, offset: s.offset, y: s.y + lift + bob, facing: facing, flash: s.flash, hp: s.hp,
        width: width, height: height, hurts: hurts,
        box: { x0: s.offset - half, x1: s.offset + half, y0: s.y + lift, y1: s.y + lift + height * 0.85 }
      };
    }

    function hit() {
      s.hp -= 1;
      s.flash = 0.16;
      if (kind === "spider" && s.state === "hang") go("drop");
      return s.hp <= 0;
    }

    return { kind: kind, step: step, hit: hit, get hp() { return s.hp; }, width: width, height: height };
  }

  var api = { KINDS: KINDS, SPEC: SPEC, ART: ART, ASPECT: ASPECT, create: create, kindAt: kindAt };
  root.BCMRingMobs = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
