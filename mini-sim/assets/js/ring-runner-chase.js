/* BCM Ring — Runner chase (owner 23.11.2026 "Погоня Гонщика").
 *
 * After the Brawler, the Runner is fought as a rear-view chase in Opal Jetjet
 * (RING_PIG_BOSS_ARC.md, "Сцена Боец → Jetjet → гонка"; spec stage 6). This file
 * holds only the rules — no THREE, no DOM — so tests run it in node and
 * ring-platformer.js draws it in the same scene and WebGL context.
 *
 *   BCMRingRunnerChase.create({ seed }) -> {
 *     step(dt, { steer: -1|0|1, jumpEdge, boost }) -> out,
 *     canBeHit() -> bool   // the laser lands: open window and within range
 *   }
 *   out = { phase: "board"|"chase", speed, distance, gap, range, maxGap,
 *           player: { lane, x, y }, boss: { lane, x, state, vulnerable, attacking, tell },
 *           obstacles: [{ id, kind: "low"|"gate"|"mine", lane, x, z }], hits: [{ kind }], cue }
 *
 * z is metres ahead of the Jetjet. Lanes 0..2, 1.8 m apart; x = (lane - 1) * 1.8.
 * Low walls are hopped, gates (two lanes) are steered around, mines are dropped by
 * the Runner into the lane it marked. The Runner is armoured except in its windows:
 * a skid after a failed turn, or an overheat.
 */
(function (root) {
  "use strict";

  var LANE_W = 1.8;
  var SPEED = 20;          // m/s, road under the Jetjet
  var SPAWN_Z = 40;        // obstacles appear 2 s ahead
  var BOARD = 1.2;         // s, parked Jetjet before the chase
  var RANGE = 12;          // m, laser reach
  var MIN_GAP = 6, MAX_GAP = 24, START_GAP = 14;
  var JUMP_V = 6.5, GRAVITY = 20;
  var LANE_REPEAT = 0.2;   // s between lane steps while steer is held
  var PATTERN = ["g01", "l2", "g12", "l0", "l1", "g12", "l0", "g01", "l2", "l1"];

  var CUES = {
    run: "ГОНЩИК УХОДИТ · РЫВОК — ДОГНАТЬ",
    rev: "РЁВ · МЕТКА НА ПОЛОСЕ — УЙДИ С НЕЁ",
    drop: "МИНА НА ДОРОГЕ",
    turn: "РАЗВОРОТ…",
    skid: "ЗАНОС · ОКНО — ЛАЗЕР!",
    overheat: "ПЕРЕГРЕВ · ОКНО — ЛАЗЕР!"
  };

  function seeded(seed) {
    var s = (seed >>> 0) || 1;
    return function () {
      s = (Math.imul(s ^ (s >>> 15), 2246822519) + 0x6d2b79f5) >>> 0;
      s ^= s >>> 13;
      return ((s >>> 0) % 100000) / 100000;
    };
  }
  function laneX(lane) { return (lane - 1) * LANE_W; }

  function create(opts) {
    var o = opts || {};
    var rand = seeded(((Number(o.seed) >>> 0) ^ 0x51ed27) >>> 0);
    var jitter = function (v) { return v * (0.9 + rand() * 0.2); };
    var s = {
      phase: "board", t: 0, clock: 0, distance: 0, gap: START_GAP,
      player: { lane: 1, x: 0, y: 0, vy: 0, lastSteer: 0, repeat: 0, safe: 0 },
      boss: { lane: 1, x: 0, state: "run", t: 0, dur: 2, drops: 0, ends: 0, tell: null, vulnerable: false, attacking: false },
      obstacles: [], nextId: 1, spawnIn: 0.4, pattern: 0, boost: 0, boostCd: 0
    };
    function bossGo(state, dur) { s.boss.state = state; s.boss.t = 0; s.boss.dur = dur; }

    function gateAhead() { return s.obstacles.some(function (ob) { return ob.kind === "gate" && ob.z > -1; }); }
    function mineAhead() { return s.obstacles.some(function (ob) { return ob.kind === "mine" && ob.z > 0; }); }

    function spawn() {
      var code = PATTERN[s.pattern % PATTERN.length];
      s.pattern += 1;
      var busy = s.boss.state === "rev" || s.boss.state === "drop" || mineAhead();
      if (code.charAt(0) === "g" && busy) code = "l" + code.charAt(1); // no gate while a mine is coming
      if (code.charAt(0) === "g") {
        [Number(code.charAt(1)), Number(code.charAt(2))].forEach(function (lane) {
          s.obstacles.push({ id: s.nextId++, kind: "gate", lane: lane, x: laneX(lane), z: SPAWN_Z });
        });
      } else {
        var lane = Number(code.charAt(1));
        s.obstacles.push({ id: s.nextId++, kind: "low", lane: lane, x: laneX(lane), z: SPAWN_Z });
      }
    }

    function stepBoss(d) {
      var b = s.boss;
      b.t += d;
      b.tell = null;
      b.vulnerable = false;
      b.attacking = false;
      var done = b.t >= b.dur;
      if (b.state === "run") {
        // Swerve between lanes now and then; wait for gates to pass before an attack.
        if (rand() < d * 0.9) b.lane = Math.max(0, Math.min(2, b.lane + (rand() < 0.5 ? -1 : 1)));
        if (done && !gateAhead()) {
          if (b.drops >= 2) {
            b.drops = 0;
            if (b.ends % 2 === 0) bossGo("turn", 1.0); else bossGo("overheat", jitter(2.2));
            b.ends += 1;
          } else {
            b.markLane = s.player.lane;
            bossGo("rev", 0.8);
          }
        }
      } else if (b.state === "rev") {
        b.lane = b.markLane;
        b.tell = { kind: "lane", lane: b.markLane };
        if (done) {
          bossGo("drop", 0.3);
          b.drops += 1;
          s.obstacles.push({ id: s.nextId++, kind: "mine", lane: b.markLane, x: laneX(b.markLane), z: s.gap });
        }
      } else if (b.state === "drop") {
        b.attacking = true;
        if (done) bossGo("run", jitter(1.9));
      } else if (b.state === "turn") {
        b.tell = { kind: "turn" };
        if (done) bossGo("skid", jitter(1.8)); // the turn fails: the Runner skids
      } else if (b.state === "skid" || b.state === "overheat") {
        b.vulnerable = !done;
        if (done) bossGo("run", jitter(1.9));
      }
      var swayX = b.state === "skid" ? Math.sin(s.clock * 9) * 0.7 : 0;
      b.x += (laneX(b.lane) + swayX - b.x) * Math.min(1, d * 6);
    }

    function step(dt, input) {
      var d = Math.min(0.1, Math.max(0, Number(dt) || 0));
      var c = input || {};
      var hits = [];
      var p = s.player;
      s.t += d;
      s.clock += d;
      if (s.phase === "board" && s.t >= BOARD) s.phase = "chase";

      // Pilot: lane steps while steer is held, a hop on jump.
      var steer = Math.sign(Number(c.steer) || 0);
      p.repeat = Math.max(0, p.repeat - d);
      if (s.phase === "chase" && steer && (steer !== p.lastSteer || p.repeat <= 0)) {
        p.lane = Math.max(0, Math.min(2, p.lane + steer));
        p.repeat = LANE_REPEAT;
      }
      p.lastSteer = steer;
      var tx = laneX(p.lane);
      p.x += Math.max(-12 * d, Math.min(12 * d, tx - p.x));
      if (s.phase === "chase" && c.jumpEdge && p.y <= 0.001) p.vy = JUMP_V;
      if (p.y > 0 || p.vy > 0) {
        p.vy -= GRAVITY * d;
        p.y = Math.max(0, p.y + p.vy * d);
        if (p.y === 0) p.vy = 0;
      }
      p.safe = Math.max(0, p.safe - d);

      if (s.phase === "chase") {
        s.distance += SPEED * d;
        stepBoss(d);
        // The Runner keeps about 14 m ahead (after a hit it drops back there); in its
        // window it loses speed and comes into laser range.
        s.gap += s.boss.vulnerable ? -4 * d : (START_GAP - s.gap) * 0.25 * d;
        s.boostCd = Math.max(0, s.boostCd - d);
        if (c.boost && s.boostCd <= 0) { s.boost = 0.5; s.boostCd = 1.5; }
        if (s.boost > 0) { s.boost = Math.max(0, s.boost - d); s.gap -= 10 * d; }
        s.gap = Math.max(MIN_GAP, Math.min(MAX_GAP, s.gap));

        s.spawnIn -= d;
        if (s.spawnIn <= 0) { spawn(); s.spawnIn = 1.4 + rand() * 0.5; }

        s.obstacles = s.obstacles.filter(function (ob) {
          var before = ob.z;
          ob.z -= SPEED * d;
          if (before > 0 && ob.z <= 0 && p.safe <= 0 && Math.abs(p.x - ob.x) < 1.1) {
            var clear = ob.kind === "low" ? p.y >= 0.6 : ob.kind === "mine" ? p.y >= 0.8 : false;
            if (!clear) {
              hits.push({ kind: ob.kind });
              p.safe = 1.0;
              s.gap = Math.min(MAX_GAP, s.gap + 3);
            }
          }
          return ob.z > -6;
        });
      }

      var b = s.boss;
      return {
        phase: s.phase, speed: s.phase === "chase" ? SPEED : 0, distance: s.distance,
        gap: s.gap, range: RANGE, maxGap: MAX_GAP, boosting: s.boost > 0,
        player: { lane: p.lane, x: p.x, y: p.y, safe: p.safe > 0 },
        boss: { lane: b.lane, x: b.x, state: b.state, vulnerable: s.phase === "chase" && b.vulnerable, attacking: b.attacking,
          tell: b.tell ? { kind: b.tell.kind, lane: b.tell.lane } : null },
        obstacles: s.obstacles.map(function (ob) { return { id: ob.id, kind: ob.kind, lane: ob.lane, x: ob.x, z: ob.z }; }),
        hits: hits,
        cue: s.phase === "board" ? "ПОСАДКА · OPAL JETJET" : (CUES[b.state] || "")
      };
    }

    function canBeHit() {
      return s.phase === "chase" && s.boss.vulnerable && s.gap <= RANGE;
    }

    return { step: step, canBeHit: canBeHit, laneWidth: LANE_W };
  }

  root.BCMRingRunnerChase = { create: create, LANE_W: LANE_W };
})(typeof window !== "undefined" ? window : globalThis);
