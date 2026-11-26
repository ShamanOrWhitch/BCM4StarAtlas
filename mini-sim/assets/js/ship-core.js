/*
 * BCMShipCore — one flight model for every ship in BCM4SA (owner 26.11.2026, IDEA-031: "давай сведём
 * управление кораблями в единый файл, как системный, чтобы не изобретать велосипед в каждой игре").
 *
 * Ship flight used to live in four places: open space and Warp (mini-sim.js), the seeded asteroid
 * (deep-space-warp.js / asteroid-maze-location.js), the ships and the carpet over a planet
 * (island/sim.ts, carpet.ts), and the races (game/sim.ts). This is the one model they move to; the
 * sphere planet Orbis (IDEA-033) flies on it first. Profiles differ by numbers only.
 *
 * Pure maths: no THREE, no DOM. Loaded as a page script (window.BCMShipCore) and imported by the
 * First Planet bundle; tested in node.
 *
 *   const ship = BCMShipCore.create("hover", { position, forward });
 *   BCMShipCore.step(ship, intent, dt, world);
 *     intent = { thrust, strafe, lift, yaw, pitch, boost }   (each -1..1, boost 0/1)
 *     world  = openWorld() | flatWorld({ ground }) | sphereWorld({ radius, height })
 *   ship = { position, velocity, forward, up, yawRate, pitchRate, bank, hold, speed }
 *
 * Profiles:
 *   space    — six degrees of freedom, keeps its drift, no gravity.
 *   asteroid — the seeded asteroid: the stick answers sooner, more drag (owner asked for it).
 *   hover    — a ship or a carpet over the ground: holds a height over the surface, nose along it.
 *   race     — fast over the ground, firm grip.
 */
(function (root) {
  "use strict";

  var PROFILES = {
    space: { maxSpeed: 40, accel: 14, drag: 0.05, turnRate: 1.6, turnLag: 3, strafe: 0.6, hover: false, pitch: true, boost: 1.6 },
    asteroid: { maxSpeed: 30, accel: 22, drag: 0.6, turnRate: 2.2, turnLag: 9, strafe: 0.8, hover: false, pitch: true, boost: 1.4 },
    hover: {
      maxSpeed: 16, accel: 11, drag: 1.6, turnRate: 1.5, turnLag: 4.5, strafe: 0.5, hover: true, pitch: false, boost: 1.5,
      hold: 3.2, minClear: 1.4, maxClear: 16, climbRate: 5, liftLag: 7, sinkLag: 2.4, bankMax: 0.55
    },
    race: {
      maxSpeed: 34, accel: 18, drag: 0.9, turnRate: 2.0, turnLag: 6, strafe: 0.3, hover: true, pitch: false, boost: 1.3,
      hold: 1.2, minClear: 0.8, maxClear: 2.5, climbRate: 2, liftLag: 10, sinkLag: 6, bankMax: 0.4
    }
  };

  function v(x, y, z) { return { x: x, y: y, z: z }; }
  function add(a, b) { return v(a.x + b.x, a.y + b.y, a.z + b.z); }
  function scale(a, k) { return v(a.x * k, a.y * k, a.z * k); }
  function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
  function cross(a, b) { return v(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x); }
  function len(a) { return Math.hypot(a.x, a.y, a.z); }
  function norm(a, fallback) { var l = len(a); return l > 1e-9 ? scale(a, 1 / l) : (fallback || v(0, 1, 0)); }
  /** Rotate a about the unit axis k by angle t (Rodrigues). */
  function rotate(a, k, t) {
    var c = Math.cos(t), s = Math.sin(t);
    return add(add(scale(a, c), scale(cross(k, a), s)), scale(k, dot(k, a) * (1 - c)));
  }
  /** The part of a along the plane whose normal is n. */
  function tangent(a, n) { return add(a, scale(n, -dot(a, n))); }

  /** Open space: no ground, no gravity; "up" is the ship's own. */
  function openWorld() {
    return { kind: "open", up: null, surface: null };
  }
  /** A flat world: up is +y, the ground is ground(x, z). */
  function flatWorld(o) {
    var ground = (o && o.ground) || function () { return 0; };
    return {
      kind: "flat",
      up: function () { return v(0, 1, 0); },
      surface: function (p) { return ground(p.x, p.z); },
      ground: ground
    };
  }
  /**
   * A sphere planet centred on the origin: up points away from the centre, the ground stands at
   * radius + height(n), n the unit direction from the centre.
   */
  function sphereWorld(o) {
    var radius = Number(o && o.radius) || 100;
    var height = (o && o.height) || function () { return 0; };
    return {
      kind: "sphere",
      radius: radius,
      height: height,
      up: function (p) { return norm(p); },
      /** Distance from the centre of the ground under p. */
      surface: function (p) { return radius + height(norm(p)); }
    };
  }

  function create(profile, opts) {
    var o = opts || {};
    var P = PROFILES[profile] || PROFILES.space;
    var position = o.position ? v(o.position.x, o.position.y, o.position.z) : v(0, 0, 0);
    var forward = norm(o.forward || v(0, 0, -1), v(0, 0, -1));
    var up = norm(o.up || v(0, 1, 0));
    return {
      profile: PROFILES[profile] ? profile : "space",
      position: position,
      velocity: v(0, 0, 0),
      forward: forward,
      up: up,
      yawRate: 0,
      pitchRate: 0,
      bank: 0,
      hold: P.hold || 0,
      speed: 0,
      // A ship of its own make within the profile: tune.speed scales the top speed and the push.
      tune: { speed: Number(o.tune && o.tune.speed) || 1 }
    };
  }

  /** Height of the ship over the ground in this world (Infinity in open space). */
  function clearance(ship, world) {
    if (!world || !world.surface) return Infinity;
    if (world.kind === "sphere") return len(ship.position) - world.surface(ship.position);
    return ship.position.y - world.surface(ship.position);
  }

  /**
   * One step of flight. Order: turn, push, drag and limit, move — then, over ground, settle on the
   * height over the ground at the NEW point (a fast ship otherwise sinks into a hill) and carry the
   * heading and the velocity into the new tangent plane.
   */
  function step(ship, intent, dt, world) {
    var P = PROFILES[ship.profile] || PROFILES.space;
    var i = intent || {};
    var d = Math.max(0, Math.min(0.1, Number(dt) || 0));
    var w = world || openWorld();
    var clampIn = function (x) { return Math.max(-1, Math.min(1, Number(x) || 0)); };

    // "Up" is the world's over ground, the ship's own in open space.
    var up = w.up ? w.up(ship.position) : ship.up;
    if (P.hover && w.up) ship.up = up;

    // Turn: the rate eases towards the stick (turnLag), then the heading turns about "up".
    var lag = 1 - Math.exp(-P.turnLag * d);
    ship.yawRate += (clampIn(i.yaw) * P.turnRate - ship.yawRate) * lag;
    ship.forward = norm(rotate(ship.forward, norm(ship.up), -ship.yawRate * d));
    if (P.pitch) {
      ship.pitchRate += (clampIn(i.pitch) * P.turnRate - ship.pitchRate) * lag;
      var right = norm(cross(ship.forward, ship.up));
      ship.forward = norm(rotate(ship.forward, right, ship.pitchRate * d));
      ship.up = norm(rotate(ship.up, right, ship.pitchRate * d));
    }
    if (P.hover && w.up) ship.forward = norm(tangent(ship.forward, up), ship.forward);

    // Push: thrust along the nose, strafe to the side; lift moves the held height over ground.
    var boost = (i.boost ? P.boost : 1) * ((ship.tune && ship.tune.speed) || 1);
    var side = norm(cross(ship.forward, ship.up));
    var push = add(scale(ship.forward, clampIn(i.thrust) * P.accel * boost), scale(side, clampIn(i.strafe) * P.accel * P.strafe));
    if (!P.hover && P.pitch) push = add(push, scale(ship.up, clampIn(i.lift) * P.accel * P.strafe));
    ship.velocity = add(ship.velocity, scale(push, d));
    if (P.hover && w.surface) ship.hold = Math.max(P.minClear, Math.min(P.maxClear, ship.hold + clampIn(i.lift) * P.climbRate * d));

    // Drag: always a little; much more when the stick is let go (a hover ship stops, space drifts).
    var idle = !i.thrust && !i.strafe;
    var drag = P.drag * (idle ? 1 : 0.25);
    ship.velocity = scale(ship.velocity, Math.exp(-drag * d));
    var top = P.maxSpeed * boost;
    var speed = len(ship.velocity);
    if (speed > top) ship.velocity = scale(ship.velocity, top / speed);

    // Over ground the ship moves in the tangent plane; its height is set below.
    if (P.hover && w.up) ship.velocity = tangent(ship.velocity, up);
    ship.position = add(ship.position, scale(ship.velocity, d));

    if (P.hover && w.surface) {
      var nUp = w.up(ship.position);
      var want = ship.hold;
      var now = clearance(ship, w);
      var k = 1 - Math.exp(-(now < want ? P.liftLag : P.sinkLag) * d);
      var next = Math.max(P.minClear * 0.6, now + (want - now) * k);
      if (w.kind === "sphere") ship.position = scale(nUp, w.surface(ship.position) + next);
      else ship.position = v(ship.position.x, w.surface(ship.position) + next, ship.position.z);
      // Carry the heading and the speed into the new tangent plane.
      var sp = len(ship.velocity);
      ship.velocity = scale(norm(tangent(ship.velocity, nUp), ship.forward), sp);
      ship.forward = norm(tangent(ship.forward, nUp), ship.forward);
      ship.up = nUp;
    }

    ship.speed = len(ship.velocity);
    var bankMax = P.bankMax || 0.6;
    ship.bank += (-ship.yawRate / Math.max(0.01, P.turnRate) * bankMax - ship.bank) * (1 - Math.exp(-4.5 * d));
    return ship;
  }

  var api = {
    PROFILES: PROFILES,
    create: create,
    step: step,
    clearance: clearance,
    openWorld: openWorld,
    flatWorld: flatWorld,
    sphereWorld: sphereWorld,
    vec: { v: v, add: add, scale: scale, dot: dot, cross: cross, len: len, norm: norm, rotate: rotate, tangent: tangent }
  };
  root.BCMShipCore = api;
})(typeof window !== "undefined" ? window : globalThis);
