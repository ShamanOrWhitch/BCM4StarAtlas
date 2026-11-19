/*
 * BCMRoom0Race — the Room 0 race course and its rival ships (IDEA-021).
 *
 * Owner 19.11.2026: "в room 0 нужно более трудную систему трассы и также
 * другие корабли, которые стараются летать по кругу".
 *
 * Pure maths, no THREE: mini-sim.js draws what this returns.
 *   buildCourse(seed)                 -> { corners, segments, pylons, length }
 *   createRivals(course, n, seed)     -> rivals
 *   stepRivals(rivals, course, dt, maxSpeed)
 *   positionOf(course, rival)         -> { x, y, z, yaw }
 *   progressOn(course, point)         -> { segment, along, distance }
 *   placeOf({ laps, distance }, rivals) -> 1 = first
 *
 * A course is a closed loop of 8..11 corners around the old Room 0 start
 * (z = 24), climbing and falling, with narrow sections and pylons. Every pylon
 * leaves a way through of at least 4 m.
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

  function round(v) { return Math.round(v * 1000) / 1000; }

  function buildCourse(seed) {
    var rand = seeded(seed);
    var count = 8 + Math.floor(rand() * 4); // 8..11 corners
    var cx = 10 + rand() * 10;
    var cz = 24 + 52;
    var radius = 46 + rand() * 18;
    var corners = [];
    var phase = rand() * Math.PI * 2;
    for (var i = 0; i < count; i += 1) {
      var a = (i / count) * Math.PI * 2 + (rand() - 0.5) * 0.35;
      var r = radius * (0.68 + rand() * 0.5);
      corners.push({
        x: round(cx + Math.cos(a) * r),
        y: round(Math.max(0, 11 + Math.sin(a * 2 + phase) * 9 + (rand() - 0.5) * 6)),
        z: round(cz + Math.sin(a) * r * 0.85)
      });
    }
    // The start corner sits on the floor, where Room 0 begins.
    corners[0].y = 0;
    var segments = [];
    var length = 0;
    for (var j = 0; j < count; j += 1) {
      var p = corners[j];
      var q = corners[(j + 1) % count];
      var dx = q.x - p.x, dy = q.y - p.y, dz = q.z - p.z;
      var len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      var flat = Math.sqrt(dx * dx + dz * dz) || 1;
      // Narrow sections: every third segment is tight.
      var halfW = j % 3 === 2 ? 6.2 + rand() * 1.2 : 8.5 + rand() * 3;
      segments.push({
        a: p, b: q, len: round(len), start: round(length),
        dir: { x: dx / len, y: dy / len, z: dz / len },
        side: { x: -dz / flat, z: dx / flat },
        halfW: round(halfW)
      });
      length += len;
    }
    var pylons = [];
    segments.forEach(function (seg, k) {
      if (k === 0) return; // the start straight stays clear
      var n = seg.len > 40 ? 2 : 1;
      for (var m = 0; m < n; m += 1) {
        var t = n === 1 ? 0.5 : 0.32 + m * 0.36;
        var radiusP = 1.2 + rand() * 0.8;
        var sideSign = (k + m) % 2 === 0 ? 1 : -1;
        // Offset from the centre line; the far side keeps >= 4 m clear.
        var maxOffset = seg.halfW - radiusP - 0.4;
        var offset = sideSign * Math.min(maxOffset, seg.halfW * (0.18 + rand() * 0.3));
        var at = { x: seg.a.x + (seg.b.x - seg.a.x) * t, y: seg.a.y + (seg.b.y - seg.a.y) * t, z: seg.a.z + (seg.b.z - seg.a.z) * t };
        pylons.push({
          segment: k, t: round(t), offset: round(offset), radius: round(radiusP),
          x: round(at.x + seg.side.x * offset), y: round(at.y), z: round(at.z + seg.side.z * offset)
        });
      }
    });
    return { seed: Number(seed) >>> 0, corners: corners, segments: segments, pylons: pylons, length: round(length) };
  }

  function segmentAt(course, distance) {
    var d = ((distance % course.length) + course.length) % course.length;
    for (var i = course.segments.length - 1; i >= 0; i -= 1) {
      if (d >= course.segments[i].start) return { index: i, along: d - course.segments[i].start };
    }
    return { index: 0, along: d };
  }

  function createRivals(course, n, seed) {
    var rand = seeded((Number(seed) >>> 0) ^ 0x9e3779b9);
    var rivals = [];
    for (var i = 0; i < n; i += 1) {
      rivals.push({
        id: "rival-" + (i + 1),
        // Own pace, between a cautious and a bold pilot.
        pace: 0.56 + i * 0.07 + rand() * 0.05,
        distance: (i + 1) * 7,
        laps: 0,
        lane: (i - (n - 1) / 2) * 2.2,
        wantLane: 0,
        segment: 0
      });
    }
    return rivals;
  }

  function stepRivals(rivals, course, dt, maxSpeed) {
    var step = Math.min(0.1, Math.max(0, Number(dt) || 0));
    var top = Math.max(4, Number(maxSpeed) || 24);
    rivals.forEach(function (r) {
      var here = segmentAt(course, r.distance);
      var seg = course.segments[here.index];
      // Slow down in the tight sections, like a pilot would.
      var tight = seg.halfW < 7.5 ? 0.82 : 1;
      var before = r.distance;
      r.distance += top * r.pace * tight * step;
      if (Math.floor(r.distance / course.length) > Math.floor(before / course.length)) r.laps += 1;
      r.lapDistance = r.distance - Math.floor(r.distance / course.length) * course.length;
      var now = segmentAt(course, r.distance);
      r.segment = now.index;
      var cur = course.segments[now.index];
      // Dodge: the next pylon within 14 m on this segment decides the lane.
      r.wantLane = 0;
      for (var k = 0; k < course.pylons.length; k += 1) {
        var p = course.pylons[k];
        if (p.segment !== now.index) continue;
        var ahead = p.t * cur.len - now.along;
        if (ahead < -2 || ahead > 14) continue;
        var room = cur.halfW - 1.2;
        r.wantLane = p.offset > 0 ? -Math.min(room, Math.abs(p.offset) + p.radius + 1.6) : Math.min(room, Math.abs(p.offset) + p.radius + 1.6);
        break;
      }
      var limit = cur.halfW - 0.6;
      r.lane += (r.wantLane - r.lane) * Math.min(1, step * 3.2);
      r.lane = Math.max(-limit, Math.min(limit, r.lane));
    });
    return rivals;
  }

  function positionOf(course, rival) {
    var here = segmentAt(course, rival.distance);
    var seg = course.segments[here.index];
    var t = seg.len ? here.along / seg.len : 0;
    return {
      x: seg.a.x + (seg.b.x - seg.a.x) * t + seg.side.x * rival.lane,
      y: seg.a.y + (seg.b.y - seg.a.y) * t,
      z: seg.a.z + (seg.b.z - seg.a.z) * t + seg.side.z * rival.lane,
      yaw: Math.atan2(seg.dir.x, seg.dir.z)
    };
  }

  /** Where a point is along the loop: nearest segment and the distance from the start. */
  function progressOn(course, point) {
    var best = null;
    for (var i = 0; i < course.segments.length; i += 1) {
      var seg = course.segments[i];
      var rx = point.x - seg.a.x, ry = point.y - seg.a.y, rz = point.z - seg.a.z;
      var along = Math.max(0, Math.min(seg.len, rx * seg.dir.x + ry * seg.dir.y + rz * seg.dir.z));
      var px = seg.a.x + seg.dir.x * along - point.x;
      var py = seg.a.y + seg.dir.y * along - point.y;
      var pz = seg.a.z + seg.dir.z * along - point.z;
      var d = px * px + py * py + pz * pz;
      if (!best || d < best.d) best = { segment: i, along: along, distance: seg.start + along, d: d };
    }
    return best ? { segment: best.segment, along: best.along, distance: best.distance } : { segment: 0, along: 0, distance: 0 };
  }

  /** Place in the race: laps first, then the distance into the current lap. */
  function placeOf(player, rivals) {
    var key = function (laps, lapDistance) { return (Number(laps) || 0) * 1e6 + (Number(lapDistance) || 0); };
    var mine = key(player.laps, player.distance);
    var ahead = 0;
    rivals.forEach(function (r) {
      if (key(r.laps, r.lapDistance == null ? r.distance : r.lapDistance) > mine) ahead += 1;
    });
    return ahead + 1;
  }

  root.BCMRoom0Race = {
    buildCourse: buildCourse,
    createRivals: createRivals,
    stepRivals: stepRivals,
    positionOf: positionOf,
    progressOn: progressOn,
    placeOf: placeOf
  };
})(typeof window !== "undefined" ? window : globalThis);
