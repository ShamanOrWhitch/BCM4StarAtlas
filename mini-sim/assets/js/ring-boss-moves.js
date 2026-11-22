/*
 * BCMRingBossMoves — the moves of the six Ring boss forms after the Pig
 * (owner 22.11.2026: "Бои с боссами Ring"; RING_BOSS_AND_MAZE_GAMEPLAY_SPEC.md).
 *
 * Pure maths, no THREE: ring-platformer.js draws the tells and hazards and
 * applies the damage. Every attack comes after a visible tell (>= 0.5 s), has a
 * bounded hitbox and leaves a window when the core is open.
 *
 *   const boss = BCMRingBossMoves.create(phase 1..6, { homeX, seed });
 *   const out = boss.step(dt, { targetX, targetY });
 *   out = { form, state, x, y, facing, vulnerable, attacking, tell, hazards, cue }
 *     tell / hazard = { kind, x0, x1, y0, y1 } in world metres (y from the floor)
 *   boss.canBeHit(fromX) — the Brawler takes shots in the back at any time.
 *
 * Forms (stage 2..7 of the fight):
 *   roller  — wind-up, rolls across the floor, stuck at the wall: core open.
 *   walker  — walks, lifts a leg, stomps two ground waves, leg planted: open.
 *   orbiter — hovers with orbiting shards, marks the floor, drops an orb, opens.
 *   brawler — advances, winds up a fist zone, punches, fist stuck: open; back always.
 *   runner  — revs, dashes across leaving exhaust, overheats after two passes: open.
 *   stalker — marks a landing zone, leaps, lands in it, recovers: open.
 * Numbers are first-pass values for playtest, not final tuning.
 */
(function (root) {
  "use strict";

  var FORMS = ["roller", "walker", "orbiter", "brawler", "runner", "stalker"];
  var HALF_ARENA = 9;

  var CUES = {
    roller: { idle: "КАТОК КРУТИТСЯ", windup: "КАТОК РАЗГОНЯЕТСЯ · ПРЫГАЙ ЧЕРЕЗ НЕГО", roll: "КАТОК КАТИТСЯ", stunned: "КАТОК В СТЕНЕ · ЯДРО ОТКРЫТО" },
    walker: { walk: "ШАГОХОД ИДЁТ", lift: "ШАГОХОД ПОДНЯЛ НОГУ · ГОТОВЬСЯ ПРЫГАТЬ", stomp: "ТОПОТ · ПРЫГАЙ ЧЕРЕЗ ВОЛНУ", planted: "НОГА УВЯЗЛА · ЯДРО ОТКРЫТО" },
    orbiter: { orbit: "ОРБИТА · ОБЛОМКИ ВОКРУГ", mark: "МЕТКА НА ПОЛУ · УЙДИ", drop: "СГУСТОК ПАДАЕТ", open: "ОБЛОМКИ РАЗЛЕТЕЛИСЬ · ЯДРО ОТКРЫТО" },
    brawler: { advance: "БОЕЦ ИДЁТ · ЗАЙДИ СО СПИНЫ", windup: "ЗАМАХ · УЙДИ ИЗ ЗОНЫ УДАРА", punch: "УДАР", stuck: "КУЛАК ЗАСТРЯЛ · ЯДРО ОТКРЫТО" },
    runner: { rev: "ГОНЩИК РЕВЁТ · ПРЫГАЙ ЧЕРЕЗ НЕГО", dash: "ГОНЩИК ЛЕТИТ", turn: "РАЗВОРОТ", overheat: "ПЕРЕГРЕВ · ЯДРО ОТКРЫТО" },
    stalker: { stalk: "ТЕНЬ КРАДЁТСЯ", mark: "ТЕНЬ МЕТИТ МЕСТО · УЙДИ ИЗ МЕТКИ", leap: "ТЕНЬ ПРЫГАЕТ", land: "ПРИЗЕМЛЕНИЕ", recover: "ТЕНЬ ОШЕЛОМЛЕНА · ЯДРО ОТКРЫТО" }
  };

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

  function box(kind, x0, x1, y0, y1) {
    return { kind: kind, x0: Math.min(x0, x1), x1: Math.max(x0, x1), y0: y0, y1: y1 };
  }

  function create(phase, opts) {
    var o = opts || {};
    var form = FORMS[(Math.max(1, Number(phase) || 1) - 1) % FORMS.length];
    var homeX = Number(o.homeX) || 0;
    var minX = homeX - HALF_ARENA + 0.8;
    var maxX = homeX + HALF_ARENA - 0.8;
    var rand = seeded(((Number(o.seed) >>> 0) ^ Math.imul(Number(phase) || 1, 0x9e3779b1)) >>> 0);
    var clampX = function (x) { return Math.max(minX, Math.min(maxX, x)); };
    var jitter = function (v) { return v * (0.92 + rand() * 0.16); };

    var s = {
      x: homeX, y: 0, facing: -1, state: "", t: 0, dur: 0, clock: 0,
      vulnerable: false, attacking: false, tell: null,
      dir: -1, passes: 0, waves: [], patches: [], lastPatchX: null,
      mark: null, fromX: 0, orbAngle: 0, orbY: 0
    };
    function go(state, dur) { s.state = state; s.t = 0; s.dur = dur; }

    // Opening state per form.
    if (form === "roller") go("idle", 0.6);
    else if (form === "walker") go("walk", 1.4);
    else if (form === "orbiter") { s.y = 3.4; go("orbit", 1.6); }
    else if (form === "brawler") go("advance", 1.8);
    else if (form === "runner") { s.x = maxX; s.dir = -1; go("rev", 0.7); }
    else { s.y = 2.6; go("stalk", 1.2); }

    function towardTarget(targetX, speed, dt) {
      var dx = targetX - s.x;
      if (Math.abs(dx) > 0.05) s.facing = dx < 0 ? -1 : 1;
      s.x = clampX(s.x + Math.max(-speed * dt, Math.min(speed * dt, dx)));
    }

    function step(dt, ctx) {
      var c = ctx || {};
      var d = Math.min(0.1, Math.max(0, Number(dt) || 0));
      var targetX = Number(c.targetX);
      if (!Number.isFinite(targetX)) targetX = homeX;
      s.t += d;
      s.clock += d;
      s.tell = null;
      s.attacking = false;
      s.vulnerable = false;
      var hazards = [];
      var done = s.t >= s.dur;

      if (form === "roller") {
        if (s.state === "idle") {
          s.facing = targetX < s.x ? -1 : 1;
          if (done) {
            s.dir = targetX < s.x ? -1 : 1;
            // Roll toward the player, but never into a wall it already touches.
            if ((s.dir < 0 && s.x - minX < 2) || (s.dir > 0 && maxX - s.x < 2)) s.dir = -s.dir;
            go("windup", jitter(0.8));
          }
        } else if (s.state === "windup") {
          s.facing = s.dir;
          s.tell = box("lane", s.x, s.dir < 0 ? minX - 0.8 : maxX + 0.8, 0, 1.3);
          if (done) go("roll", 9);
        } else if (s.state === "roll") {
          s.attacking = true;
          s.x = clampX(s.x + s.dir * 13 * d);
          hazards.push(box("roll", s.x - 0.8, s.x + 0.8, 0, 1.3));
          if (s.x <= minX + 1e-6 || s.x >= maxX - 1e-6) go("stunned", jitter(1.5));
        } else if (s.state === "stunned") {
          s.vulnerable = true;
          if (done) go("idle", jitter(0.6));
        }
      } else if (form === "walker") {
        if (s.state === "walk") {
          towardTarget(targetX, 2.2, d);
          if (done) go("lift", jitter(0.7));
        } else if (s.state === "lift") {
          s.tell = box("stomp", s.x - 6, s.x + 6, 0, 0.7);
          if (done) {
            go("stomp", 0.15);
            s.waves.push({ x: s.x - 0.6, dir: -1 }, { x: s.x + 0.6, dir: 1 });
          }
        } else if (s.state === "stomp") {
          s.attacking = true;
          if (done) go("planted", jitter(1.1));
        } else if (s.state === "planted") {
          s.vulnerable = true;
          if (done) go("walk", jitter(1.4));
        }
      } else if (form === "orbiter") {
        s.x = clampX(homeX + Math.sin(s.clock * 0.6) * 3);
        s.y = 3.4;
        s.orbAngle += d * 1.2;
        var radius = s.state === "open" ? 3.2 : 1.8;
        for (var k = 0; k < 3; k += 1) {
          var a = s.orbAngle + (k * Math.PI * 2) / 3;
          var sx = s.x + Math.cos(a) * radius;
          var sy = s.y + Math.sin(a) * radius;
          hazards.push(box("shard", sx - 0.25, sx + 0.25, sy - 0.25, sy + 0.25));
        }
        if (s.state === "orbit") {
          if (done) {
            var mx = clampX(targetX);
            s.mark = { x0: mx - 0.8, x1: mx + 0.8 };
            go("mark", jitter(0.8));
          }
        } else if (s.state === "mark") {
          s.tell = box("drop", s.mark.x0, s.mark.x1, 0, 0.2);
          if (done) { s.orbY = s.y; go("drop", 0.6); }
        } else if (s.state === "drop") {
          s.attacking = true;
          s.orbY = Math.max(0.45, s.y - (s.t / 0.6) * s.y);
          var cx = (s.mark.x0 + s.mark.x1) / 2;
          hazards.push(box("orb", cx - 0.45, cx + 0.45, s.orbY - 0.45, s.orbY + 0.45));
          if (done) go("open", jitter(1.4));
        } else if (s.state === "open") {
          s.vulnerable = true;
          if (done) go("orbit", jitter(1.6));
        }
      } else if (form === "brawler") {
        var reach = function () { return box("fist", s.x + s.facing * 0.8, s.x + s.facing * 3.4, 0, 2.2); };
        if (s.state === "advance") {
          towardTarget(targetX, 1.8, d);
          if (done || Math.abs(targetX - s.x) < 3) go("windup", jitter(0.9));
        } else if (s.state === "windup") {
          s.tell = reach();
          if (done) go("punch", 0.25);
        } else if (s.state === "punch") {
          s.attacking = true;
          hazards.push(reach());
          if (done) go("stuck", jitter(1.2));
        } else if (s.state === "stuck") {
          s.vulnerable = true;
          if (done) go("advance", jitter(1.8));
        }
      } else if (form === "runner") {
        if (s.state === "rev") {
          s.facing = s.dir;
          s.tell = box("lane", minX - 0.8, maxX + 0.8, 0, 1.2);
          if (done) { s.lastPatchX = s.x; go("dash", 9); }
        } else if (s.state === "dash") {
          s.attacking = true;
          s.x = clampX(s.x + s.dir * 16 * d);
          hazards.push(box("chassis", s.x - 1, s.x + 1, 0, 1.2));
          if (Math.abs(s.x - s.lastPatchX) >= 1.2) {
            s.patches.push({ x: s.x, life: 1.0 });
            s.lastPatchX = s.x;
          }
          if (s.x <= minX + 1e-6 || s.x >= maxX - 1e-6) {
            s.passes += 1;
            s.dir = -s.dir;
            if (s.passes >= 2) { s.passes = 0; go("overheat", jitter(1.8)); }
            else go("turn", 0.5);
          }
        } else if (s.state === "turn") {
          s.facing = s.dir;
          if (done) go("rev", jitter(0.7));
        } else if (s.state === "overheat") {
          s.vulnerable = true;
          if (done) go("rev", jitter(0.7));
        }
      } else {
        // stalker
        if (s.state === "stalk") {
          s.y = 2.6;
          towardTarget(targetX, 1.2, d);
          if (done) {
            var lx = clampX(targetX);
            s.mark = { x0: lx - 1.2, x1: lx + 1.2 };
            go("mark", jitter(0.9));
          }
        } else if (s.state === "mark") {
          s.tell = box("landing", s.mark.x0, s.mark.x1, 0, 0.2);
          if (done) { s.fromX = s.x; go("leap", 0.5); }
        } else if (s.state === "leap") {
          s.attacking = true;
          var k2 = Math.min(1, s.t / 0.5);
          var to = (s.mark.x0 + s.mark.x1) / 2;
          s.x = s.fromX + (to - s.fromX) * k2;
          s.facing = to < s.fromX ? -1 : 1;
          s.y = 2.6 + Math.sin(k2 * Math.PI) * 2.4 - 2.6 * k2;
          if (done) { s.x = to; s.y = 0; go("land", 0.2); }
        } else if (s.state === "land") {
          s.attacking = true;
          hazards.push(box("landing", s.mark.x0, s.mark.x1, 0, 1.6));
          if (done) go("recover", jitter(1.3));
        } else if (s.state === "recover") {
          s.vulnerable = true;
          if (done) go("stalk", jitter(1.2));
        }
      }

      // Walker waves and Runner exhaust live on after their attack.
      s.waves = s.waves.filter(function (w) {
        w.x += w.dir * 9 * d;
        if (w.x < minX - 0.8 || w.x > maxX + 0.8) return false;
        hazards.push(box("wave", w.x - 0.4, w.x + 0.4, 0, 0.8));
        return true;
      });
      s.patches = s.patches.filter(function (p) {
        p.life -= d;
        if (p.life <= 0) return false;
        hazards.push(box("exhaust", p.x - 0.5, p.x + 0.5, 0, 0.45));
        return true;
      });

      return {
        form: form, state: s.state, x: s.x, y: s.y, facing: s.facing,
        vulnerable: s.vulnerable, attacking: s.attacking, tell: s.tell,
        hazards: hazards, cue: (CUES[form] && CUES[form][s.state]) || ""
      };
    }

    function canBeHit(fromX) {
      if (s.vulnerable) return true;
      if (form === "brawler") return (Number(fromX) - s.x) * s.facing < 0;
      return false;
    }

    return { form: form, step: step, canBeHit: canBeHit, homeX: homeX };
  }

  root.BCMRingBossMoves = { create: create, FORMS: FORMS };
})(typeof window !== "undefined" ? window : globalThis);
