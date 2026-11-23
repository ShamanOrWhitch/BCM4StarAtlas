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
    orbiter: { orbit: "ОРБИТА · ЛЕТИ: ПРЫЖОК = ИМПУЛЬС · ПОЛ УХОДИТ — ДЕРЖИСЬ В ВОЗДУХЕ ИЛИ НА УСТУПАХ", mark: "МЕТКА НА ПОЛУ · УЙДИ", drop: "СГУСТОК ПАДАЕТ", open: "ОБЛОМКИ РАЗЛЕТЕЛИСЬ · ЯДРО ОТКРЫТО" },
    brawler: { advance: "БОЕЦ ИДЁТ · ЗАЙДИ СО СПИНЫ", windup: "ЗАМАХ · УЙДИ ИЗ ЗОНЫ УДАРА", punch: "УДАР", stuck: "КУЛАК ЗАСТРЯЛ · ЯДРО ОТКРЫТО",
      charge: "ПУШКА ЗАРЯЖАЕТСЯ · СМЕНИ ЯРУС", fire: "ЗАЛП", recover: "ОТДАЧА", drink: "ПЬЁТ ПОД ЩИТОМ · ЧИНИТСЯ — ЖДИ", taunt: "ХОХОЧЕТ · ЯДРО ОТКРЫТО — БЕЙ!" },
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
      mark: null, fromX: 0, orbAngle: 0, orbY: 0, cycle: 0, band: null,
      sparks: [], bubbles: []
    };
    // Owner 22.11.2026 "Полёт в фазе Орбиты": the Orbiter is fought in Balloon flight.
    // Two electric clots cross the arena, a low one and a high one, in opposite
    // directions; air bubbles refill jet and breath and come back after a while.
    var flight = form === "orbiter";
    var CEILING = 8;
    var BUBBLE_RESPAWN = 6;
    // Owner 23.11.2026 "Пропасть в арене": the floor warns for FLOOR_WARN seconds,
    // then gives way; two ledges by the walls stay (the low bubble hangs over one).
    var FLOOR_WARN = 2.5;
    var PIT = { x0: homeX - 9.5, x1: homeX + 9.5 };
    var LEDGES = [{ x0: homeX - 8.6, x1: homeX - 5.6 }, { x0: homeX + 5.6, x1: homeX + 8.6 }];
    function pitOpen() { return flight && s.clock >= FLOOR_WARN; }
    if (flight) {
      s.sparks = [
        { x: minX + 1, y: 1.2, dir: 1, speed: 2.4, r: 0.38 },
        { x: maxX - 1, y: 5.0, dir: -1, speed: 3.0, r: 0.38 }
      ];
      s.bubbles = [
        { id: 0, x: homeX - 6.5, y: 1.3 },
        { id: 1, x: homeX - 2.5, y: 3.0 },
        { id: 2, x: homeX + 2.5, y: 6.4 },
        { id: 3, x: homeX + 6.5, y: 2.4 }
      ].map(function (b) { b.wait = 0; return b; });
    }
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
      s.shielded = false;
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
        // Owner 23.11.2026: the plasma cannon (owner video). It marks a band at the tier the
        // pilot stands on (floor 0, ledges 1.4 / 2.8 m) and fires across the arena: the
        // answer is to change tier. A pilot hiding up on a ledge always gets the cannon.
        var targetY = Number(c.targetY) || 0;
        if (s.state === "advance") {
          towardTarget(targetX, 1.8, d);
          if (done || Math.abs(targetX - s.x) < 3) {
            s.cycle += 1;
            if (targetY > 1 || s.cycle % 2 === 0) {
              var tier = targetY < 0.7 ? 0 : targetY < 2.1 ? 1.4 : 2.8;
              s.band = { y0: tier + 0.45, y1: tier + 1.25 };
              s.facing = targetX < s.x ? -1 : 1;
              go("charge", 2.0);
            } else go("windup", jitter(0.9));
          }
        } else if (s.state === "charge") {
          s.tell = box("beam", minX - 1, maxX + 1, s.band.y0, s.band.y1);
          if (done) go("fire", 0.4);
        } else if (s.state === "fire") {
          s.attacking = true;
          hazards.push(box("beam", minX - 1, maxX + 1, s.band.y0, s.band.y1));
          if (done) go("recover", 0.6);
        } else if (s.state === "recover") {
          // Owner 23.11.2026: after the shot it sits down and drinks to recover; its shields
          // hold, shots are useless (even in the back) and it mends. Then it laughs, mouth
          // open — that is the window. Clip lengths: drink 2.7 s, laugh 2.1 s.
          if (done) { go("drink", 2.7); s.shielded = true; }
        } else if (s.state === "drink") {
          s.shielded = true;
          if (done) { go("taunt", 2.1); s.shielded = false; s.vulnerable = true; }
        } else if (s.state === "taunt") {
          s.vulnerable = true;
          if (done) { go("advance", jitter(1.8)); s.vulnerable = false; }
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

      // Orbiter flight: clots bounce between the walls and bob a little.
      s.sparks.forEach(function (sp, index) {
        sp.x += sp.dir * sp.speed * d;
        if (sp.x < minX) { sp.x = minX; sp.dir = 1; }
        if (sp.x > maxX) { sp.x = maxX; sp.dir = -1; }
        var cy = sp.y + Math.sin(s.clock * 1.3 + index * 2) * 0.25;
        hazards.push(box("spark", sp.x - sp.r, sp.x + sp.r, cy - sp.r, cy + sp.r));
      });
      s.bubbles.forEach(function (b) { if (b.wait > 0) b.wait = Math.max(0, b.wait - d); });

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
        hazards: hazards, cue: (CUES[form] && CUES[form][s.state]) || "",
        shielded: !!s.shielded, healing: !!s.shielded,
        flight: flight, drift: flight ? 1.2 : 0, ceiling: flight ? CEILING : 0,
        floorWarn: flight && !pitOpen(),
        pit: pitOpen() ? { x0: PIT.x0, x1: PIT.x1 } : null,
        ledges: flight ? LEDGES.map(function (l) { return { x0: l.x0, x1: l.x1 }; }) : [],
        bubbles: s.bubbles.filter(function (b) { return b.wait <= 0; })
          .map(function (b) { return { id: b.id, x: b.x, y: b.y + Math.sin(s.clock * 1.6 + b.id) * 0.15 }; })
      };
    }

    function canBeHit(fromX) {
      if (s.shielded) return false;
      if (s.vulnerable) return true;
      if (form === "brawler") return (Number(fromX) - s.x) * s.facing < 0;
      return false;
    }

    // A pilot (centre of the body at x, y) takes a bubble it flies through.
    function collect(x, y) {
      for (var i = 0; i < s.bubbles.length; i += 1) {
        var b = s.bubbles[i];
        if (b.wait > 0) continue;
        if (Math.abs(Number(x) - b.x) < 0.75 && Math.abs(Number(y) - b.y) < 0.95) { b.wait = BUBBLE_RESPAWN; return true; }
      }
      return false;
    }

    // True where the floor is gone: in the open pit and off both ledges.
    function pitAt(x) {
      if (!pitOpen()) return false;
      var px = Number(x);
      if (px < PIT.x0 || px > PIT.x1) return false;
      return !LEDGES.some(function (l) { return px >= l.x0 && px <= l.x1; });
    }
    // Middle of the ledge closest to x: where a fallen pilot comes back.
    function nearestLedge(x) {
      var px = Number(x) || homeX;
      var best = LEDGES[0];
      LEDGES.forEach(function (l) { if (Math.abs((l.x0 + l.x1) / 2 - px) < Math.abs((best.x0 + best.x1) / 2 - px)) best = l; });
      return (best.x0 + best.x1) / 2;
    }

    return { form: form, step: step, canBeHit: canBeHit, collect: collect, pitAt: pitAt, nearestLedge: nearestLedge, homeX: homeX, flight: flight, ceiling: flight ? CEILING : 0 };
  }

  root.BCMRingBossMoves = { create: create, FORMS: FORMS };
})(typeof window !== "undefined" ? window : globalThis);
