/*
 * BCMFleetMotion — local space traffic around a station (owner 23.11.2026: "в космосе у
 * некоторых кораблей должна быть жизнь, ну кто-то прилетает, кто-то улетает"; WORK LOCK #144).
 *
 * A LOCAL SIMULATION for the look of space: it never reads or moves a real SAGE fleet.
 * Pure maths, no THREE: mini-sim.js draws what this returns. Station-local coordinates.
 *
 *   BCMFleetMotion.create({ seed, count, spawnRadius, maxSpeed, accel, berths? }) -> {
 *     step(dt, { avoid: { x, y, z, r } }) -> [{ x, y, z, yaw, pitch, roll, state, visible, berth }]
 *   }
 * A ship waits out of sight, arrives from the edge of the volume to a free berth by the
 * station, holds there, then departs to another side and leaves; the cycle repeats.
 * Fixed internal step (1/30 s) and a seed: the same traffic at any frame rate. Speed and
 * acceleration are limited, headings turn smoothly, ships keep apart and keep clear of the
 * player (`avoid`). Heading convention (mini-sim.js aimFlightNose): the nose is −Z, so
 * yaw = atan2(−vx, −vz), pitch = atan2(vy, horizontal), Euler order YXZ.
 */
(function (root) {
  "use strict";

  var SUB = 1 / 30;

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

  function wrap(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }

  function create(opts) {
    var o = opts || {};
    var rand = seeded(o.seed);
    var count = Math.max(1, Number(o.count) || 4);
    var R = Number(o.spawnRadius) || 170;
    var vmax = Number(o.maxSpeed) || 22;
    var accel = Number(o.accel) || 7;
    var turn = 2.4; // rad/s
    var berths = o.berths || (function () {
      var list = [];
      var n = Math.max(count + 2, 6);
      for (var i = 0; i < n; i += 1) {
        var a = (i / n) * Math.PI * 2 + 0.3;
        list.push({ x: Math.cos(a) * 26, y: i % 2 ? 4 : -3, z: Math.sin(a) * 26 });
      }
      return list;
    })();

    var ships = [];
    for (var i = 0; i < count; i += 1) {
      ships.push({ state: "wait", t: 0.5 + i * 2.6, x: 0, y: 0, z: R, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, roll: 0, visible: false, berth: -1, exit: null, phase: rand() * 6 });
    }
    var carry = 0;

    function edgePoint(awayFrom) {
      // A point on the edge, on the far side from `awayFrom` (an angle) when given.
      var a = awayFrom == null ? rand() * Math.PI * 2 : awayFrom + Math.PI + (rand() - 0.5) * 1.6;
      return { x: Math.cos(a) * (R - 4), y: (rand() - 0.5) * 36, z: Math.sin(a) * (R - 4) };
    }

    function berthFree(b, avoid) {
      var p = berths[b];
      if (avoid && Math.hypot(p.x - avoid.x, p.y - avoid.y, p.z - avoid.z) < avoid.r + 6) return false;
      for (var k = 0; k < ships.length; k += 1) if (ships[k].berth === b) return false;
      return true;
    }

    function pickBerth(avoid) {
      var start = Math.floor(rand() * berths.length);
      for (var k = 0; k < berths.length; k += 1) {
        var b = (start + k) % berths.length;
        if (berthFree(b, avoid)) return b;
      }
      return -1;
    }

    function headingFrom(s) {
      var hz = Math.hypot(s.vx, s.vz);
      return { yaw: Math.atan2(-s.vx, -s.vz), pitch: Math.atan2(s.vy, Math.max(1e-6, hz)) };
    }

    function sub(h, avoid) {
      ships.forEach(function (s, index) {
        s.t -= h;
        if (s.state === "wait") {
          if (s.t > 0) return;
          var b = pickBerth(avoid);
          if (b < 0) { s.t = 1; return; }
          var tgt = berths[b];
          var p = edgePoint(Math.atan2(tgt.z, tgt.x) + Math.PI);
          s.x = p.x; s.y = p.y; s.z = p.z;
          var d = Math.hypot(tgt.x - p.x, tgt.y - p.y, tgt.z - p.z) || 1;
          var v0 = vmax * 0.8;
          s.vx = (tgt.x - p.x) / d * v0; s.vy = (tgt.y - p.y) / d * v0; s.vz = (tgt.z - p.z) / d * v0;
          var hd = headingFrom(s);
          s.yaw = hd.yaw; s.pitch = hd.pitch; s.roll = 0;
          s.berth = b; s.state = "arrive"; s.visible = true;
          return;
        }
        var target;
        var want = { x: 0, y: 0, z: 0 };
        if (s.state === "depart") target = s.exit;
        else {
          var bb = berths[s.berth];
          target = { x: bb.x, y: bb.y + (s.state === "hold" ? Math.sin(s.phase + s.t * 1.1) * 0.4 : 0), z: bb.z };
        }
        var dx = target.x - s.x, dy = target.y - s.y, dz = target.z - s.z;
        var dist = Math.hypot(dx, dy, dz) || 1e-6;
        var speed;
        if (s.state === "arrive") speed = Math.min(vmax, Math.sqrt(2 * accel * 0.7 * dist));
        else if (s.state === "hold") speed = Math.min(1.5, dist * 1.2);
        else speed = vmax;
        want.x = dx / dist * speed; want.y = dy / dist * speed; want.z = dz / dist * speed;
        // Keep apart from the other ships in sight.
        ships.forEach(function (o2, j) {
          if (j === index || !o2.visible) return;
          var ox = s.x - o2.x, oy = s.y - o2.y, oz = s.z - o2.z;
          var od = Math.hypot(ox, oy, oz);
          if (od < 16 && od > 1e-6) {
            var push = (16 - od) / 16 * vmax * 1.2;
            want.x += ox / od * push; want.y += oy / od * push; want.z += oz / od * push;
          }
        });
        // Keep clear of the player: near them a ship slows down and swerves harder.
        var evasive = false;
        if (avoid) {
          var ax = s.x - avoid.x, ay = s.y - avoid.y, az = s.z - avoid.z;
          var ad = Math.hypot(ax, ay, az);
          var reach = avoid.r + 18;
          if (ad < reach && ad > 1e-6) {
            evasive = true;
            var closing = -(s.vx * ax + s.vy * ay + s.vz * az) / ad;
            if (closing > 0) { want.x *= 0.4; want.y *= 0.4; want.z *= 0.4; }
            var away = (reach - ad) / 18 * vmax * 2;
            want.x += ax / ad * away; want.y += ay / ad * away; want.z += az / ad * away;
          }
          if (s.state === "hold" && !berthFree(s.berth, avoid) && Math.hypot(berths[s.berth].x - avoid.x, berths[s.berth].y - avoid.y, berths[s.berth].z - avoid.z) < avoid.r + 6) s.t = 0;
        }
        // Steer: change of velocity limited by the acceleration; speed capped.
        var cx = want.x - s.vx, cy = want.y - s.vy, cz = want.z - s.vz;
        var cl = Math.hypot(cx, cy, cz);
        var lim = accel * h * (evasive ? 4 : s.state === "hold" ? 0.6 : 1.6);
        if (cl > lim) { cx = cx / cl * lim; cy = cy / cl * lim; cz = cz / cl * lim; }
        s.vx += cx; s.vy += cy; s.vz += cz;
        var sp = Math.hypot(s.vx, s.vy, s.vz);
        if (sp > vmax) { s.vx = s.vx / sp * vmax; s.vy = s.vy / sp * vmax; s.vz = s.vz / sp * vmax; sp = vmax; }
        var nx = s.x + s.vx * h, ny = s.y + s.vy * h, nz = s.z + s.vz * h;
        // Last resort: never step inside the player's own space (slide along its edge instead).
        if (avoid) {
          var px = nx - avoid.x, py = ny - avoid.y, pz = nz - avoid.z;
          var pd = Math.hypot(px, py, pz);
          if (pd < avoid.r && pd > 1e-6) {
            var k2 = avoid.r / pd;
            var sx2 = avoid.x + px * k2, sy2 = avoid.y + py * k2, sz2 = avoid.z + pz * k2;
            var moved = Math.hypot(sx2 - s.x, sy2 - s.y, sz2 - s.z);
            var cap = vmax * h;
            if (moved > cap) { var f = cap / moved; sx2 = s.x + (sx2 - s.x) * f; sy2 = s.y + (sy2 - s.y) * f; sz2 = s.z + (sz2 - s.z) * f; }
            nx = sx2; ny = sy2; nz = sz2;
          }
        }
        s.x = nx; s.y = ny; s.z = nz;
        // Heading turns smoothly toward the motion; it banks into the turn.
        if (sp > 0.6) {
          var hd2 = headingFrom(s);
          var dyaw = wrap(hd2.yaw - s.yaw);
          var stepYaw = Math.max(-turn * h, Math.min(turn * h, dyaw));
          s.yaw = wrap(s.yaw + stepYaw);
          s.pitch += Math.max(-turn * h, Math.min(turn * h, hd2.pitch - s.pitch));
          s.roll += (Math.max(-0.6, Math.min(0.6, -stepYaw / h * 0.35)) - s.roll) * Math.min(1, h * 3);
        } else s.roll *= 0.95;
        // State changes.
        if (s.state === "arrive" && dist < 1.2 && sp < 2.5) { s.state = "hold"; s.t = 6 + rand() * 4; }
        else if (s.state === "hold" && s.t <= 0) {
          var berth = berths[s.berth];
          // Leave outward, on the berth's own side: never back across the station.
          s.exit = edgePoint(Math.atan2(berth.z, berth.x) + Math.PI);
          s.state = "depart";
          s.leftBerth = s.berth;
        } else if (s.state === "depart" && Math.hypot(s.x, s.y, s.z) >= R) {
          s.state = "wait"; s.visible = false; s.t = 2 + rand() * 4; s.berth = -1;
        } else if (s.state === "depart" && s.berth >= 0 && Math.hypot(s.x - berths[s.berth].x, s.y - berths[s.berth].y, s.z - berths[s.berth].z) > 40) {
          s.berth = -1; // the berth is free once the ship is well away
        }
      });
    }

    function step(dt, ctx) {
      var c = ctx || {};
      var avoid = c.avoid && Number.isFinite(c.avoid.x) ? { x: c.avoid.x, y: c.avoid.y, z: c.avoid.z, r: Number(c.avoid.r) || 12 } : null;
      carry += Math.min(0.25, Math.max(0, Number(dt) || 0));
      while (carry >= SUB - 1e-9) { sub(SUB, avoid); carry -= SUB; }
      return ships.map(function (s) {
        return { x: s.x, y: s.y, z: s.z, yaw: s.yaw, pitch: s.pitch, roll: s.roll, state: s.state, visible: s.visible, berth: s.berth };
      });
    }

    return { step: step, berths: berths, local: true };
  }

  root.BCMFleetMotion = { create: create };
})(typeof window !== "undefined" ? window : globalThis);
