// Owner 26.11.2026 (IDEA-031): "давай сведём управление кораблями в единый файл, как системный, чтобы не
// изобретать велосипед в каждой игре … давай прорабатывать общую механику управления кораблями". Ship flight
// lived in four places (mini-sim.js, deep-space-warp.js / asteroid-maze-location.js, island/sim.ts with
// carpet.ts, game/sim.ts). ship-core.js is one flight model with profiles; the sphere planet Orbis
// (IDEA-033) flies on it first.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import vm from "node:vm";

const FILE = new URL("../mini-sim/assets/js/ship-core.js", import.meta.url);

function core() {
  assert.ok(existsSync(FILE), "every game still flies its own copy of the ship: no ship core");
  const c = vm.createContext({ Math, Number, Array, Object, JSON, String });
  c.window = c;
  vm.runInContext(readFileSync(FILE, "utf8"), c);
  return c.BCMShipCore;
}

const len = (v) => Math.hypot(v.x, v.y, v.z);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

function fly(S, ship, world, intent, seconds, each) {
  for (let i = 0; i < seconds * 60; i += 1) {
    S.step(ship, typeof intent === "function" ? intent(i) : intent, 1 / 60, world);
    if (each) each(ship, i);
  }
}

test("over a sphere planet the ship holds its height above the ground and flies right round it", () => {
  const S = core();
  const R = 120;
  // Rolling ground: up to 6 m of hills on the sphere.
  const world = S.sphereWorld({ radius: R, height: (n) => 3 + 3 * Math.sin(n.x * 4) * Math.cos(n.z * 3) });
  const ship = S.create("hover", { position: { x: 0, y: R + 10, z: 0 }, forward: { x: 0, y: 0, z: -1 } });
  const start = { ...ship.position };
  let lowest = Infinity, highest = -Infinity, travelled = 0, prev = { ...ship.position }, maxTilt = 0;
  fly(S, ship, world, { thrust: 1 }, 80, (s) => {
    const r = len(s.position);
    const n = { x: s.position.x / r, y: s.position.y / r, z: s.position.z / r };
    const clear = r - (R + world.height(n));
    lowest = Math.min(lowest, clear);
    highest = Math.max(highest, clear);
    travelled += Math.hypot(s.position.x - prev.x, s.position.y - prev.y, s.position.z - prev.z);
    prev = { ...s.position };
    // The nose stays along the ground: tangent to the sphere, not diving into it.
    maxTilt = Math.max(maxTilt, Math.abs(dot(s.forward, n)));
  });
  assert.ok(lowest > 1.0, `the ship scrapes the ground (${lowest.toFixed(2)} m)`);
  assert.ok(highest < 14, `the ship drifts off into space (${highest.toFixed(1)} m)`);
  assert.ok(travelled > 2 * Math.PI * R, `in 80 s the ship covers ${travelled.toFixed(0)} m: not once round the planet`);
  assert.ok(maxTilt < 0.35, `the nose dives or climbs off the surface (${maxTilt.toFixed(2)})`);
  // Turning: yaw changes the heading over the ground.
  const before = { ...ship.forward };
  fly(S, ship, world, { yaw: 1 }, 1);
  assert.ok(dot(before, ship.forward) < 0.8, "yaw does not turn the ship over the sphere");
  assert.ok(Math.hypot(start.x, start.y, start.z) > 0);
});

test("space keeps its drift and has no gravity; the asteroid profile answers the stick sooner", () => {
  const S = core();
  const world = S.openWorld();
  const ship = S.create("space", { position: { x: 0, y: 0, z: 0 }, forward: { x: 0, y: 0, z: -1 } });
  fly(S, ship, world, { thrust: 1 }, 3);
  const v = len(ship.velocity);
  assert.ok(v > 5, "the space ship does not speed up");
  fly(S, ship, world, {}, 2);
  assert.ok(len(ship.velocity) > v * 0.6, "the space ship stops dead when the thrust is let go");
  assert.ok(Math.abs(ship.position.y) < 0.01, "space pulls the ship down");

  const turnTime = (profile) => {
    const s = S.create(profile, { position: { x: 0, y: 0, z: 0 }, forward: { x: 0, y: 0, z: -1 } });
    let t = 0;
    for (; t < 600; t += 1) {
      S.step(s, { yaw: 1 }, 1 / 60, world);
      if (Math.abs(s.yawRate) >= S.PROFILES[profile].turnRate * 0.9) break;
    }
    return t;
  };
  assert.ok(turnTime("asteroid") < turnTime("space"), "the asteroid profile is no more responsive than open space");
});

test("the race profile is the fastest; every profile is one model with numbers, not its own code", () => {
  const S = core();
  const P = S.PROFILES;
  for (const id of ["space", "asteroid", "hover", "race"]) {
    for (const k of ["maxSpeed", "accel", "turnRate", "turnLag", "drag"]) assert.ok(Number.isFinite(P[id][k]), `${id}.${k} is missing`);
  }
  assert.ok(P.race.maxSpeed > P.hover.maxSpeed && P.race.maxSpeed > P.asteroid.maxSpeed);
  // One step function serves every profile.
  const src = readFileSync(FILE, "utf8");
  assert.equal((src.match(/function step\(/g) || []).length, 1);
});

test("Mini-Sim and First Planet load the one ship core", () => {
  const php = readFileSync(new URL("../mini-sim/bcm-mini-sim.php", import.meta.url), "utf8");
  assert.match(php, /wp_enqueue_script\('bcm-ship-core'/);
  assert.match(readFileSync(new URL("../tools/minisim-qa/standalone-shell.html", import.meta.url), "utf8"), /ship-core\.js/);
});
