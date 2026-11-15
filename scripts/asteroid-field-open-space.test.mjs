// BUG-004, owner's frame (D-054, 15.11.2026): "Камни везде в космосе".
// The sector field is on in any exterior flight — first space and the asteroid
// landing alike — and follows the ship instead of staying on an axis through
// ONICSS. WORK LOCK #119.
//
// What this covers: the real frame gate expression from mini-sim.js and the real
// warp-sector-scene manager on the real three.min.js (GLB loading is not
// available in Node, so slots stay unloaded; odometer, anchoring and gating are
// exercised). It does not fly the ship through the Warp arrival in a browser.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const read = (p) => readFile(new URL(`../${p}`, import.meta.url), "utf8");

async function gate() {
  const src = await read("mini-sim/assets/js/mini-sim.js");
  const m = src.match(/BCMWarpSectorSceneFrame\(\{[\s\S]*?\n\s*active: ([\s\S]*?),\n\s*paused:/);
  assert.ok(m, "field gate expression not found in mini-sim.js");
  // Evaluate the exact expression with the game's own names.
  return new Function("running", "exteriorFlight", "ship", "getSpaceZone", "spaceSatellite", `return (${m[1]});`);
}
const getSpaceZone = (z) => (z >= -10 ? "ROOM1" : z >= -84.5 ? "ROOM2" : "DEEP_SPACE");
const station = { stationMesh: {} };

test("gate: the field is on at the asteroid landing (z = +150) in exterior flight, as in first space", async () => {
  const active = await gate();
  const at = (z, exteriorFlight = true, sat = station) => !!active(true, exteriorFlight, { position: { z } }, getSpaceZone, sat);
  assert.equal(at(-120), true, "first space lost its field");
  assert.equal(at(150), true, "no field at the asteroid landing in exterior flight (BUG-004)");
  assert.equal(at(150, true, {}), true, "field still needs the ONICSS mesh to exist");
  assert.equal(at(-30, false), false, "field must stay off inside the ship");
  assert.equal(!!active(false, true, { position: { z: 150 } }, getSpaceZone, station), false, "field on while the game is stopped");
});

async function sceneManager() {
  const context = vm.createContext({ console, Math, Number, Array, Object, JSON, Promise, Error, Set, Map, Float32Array, Uint16Array, Uint32Array, Int32Array, Uint8Array, Float64Array, setTimeout });
  context.window = context;
  context.self = context;
  vm.runInContext(await read("mini-sim/assets/js/three.min.js"), context);
  vm.runInContext(await read("mini-sim/assets/js/warp-sector-core.js"), context);
  vm.runInContext(await read("mini-sim/assets/js/warp-sector-scene.js"), context);
  const THREE = context.THREE;
  const scene = new THREE.Scene();
  const manager = context.BCMWarpSectorScene.create({ THREE, scene, runSeed: 7 });
  const ship = {
    position: new THREE.Vector3(0, 0, -120),
    velocity: new THREE.Vector3(0, 0, -12),
    quaternion: new THREE.Quaternion(),
    maxSpeed: 18
  };
  const onicss = new THREE.Vector3(0, -2, -260);
  const originMesh = { getWorldPosition: (t) => t.copy(onicss) };
  const tick = (extra = {}) => manager.tick({ active: true, paused: false, dt: 1 / 60, ship, originMesh, runSeed: 7, ...extra });
  const lateral = () => {
    const o = manager.snapshot().odometer;
    const d = { x: ship.position.x - o.origin.x, y: ship.position.y - o.origin.y, z: ship.position.z - o.origin.z };
    const t = d.x * o.axis.x + d.y * o.axis.y + d.z * o.axis.z;
    return Math.hypot(d.x - o.axis.x * t, d.y - o.axis.y * t, d.z - o.axis.z * t);
  };
  return { THREE, manager, ship, tick, lateral, onicss };
}

test("scene: after the Warp jump to the asteroid the rock tube is around the ship, not on the ONICSS axis", async () => {
  const { manager, ship, tick, lateral, THREE } = await sceneManager();
  tick();
  const first = manager.snapshot();
  assert.equal(first.active, true);
  assert.ok(lateral() < first.tubeRadius, "first space: ship outside its own tube");

  // Warp arrival: the game teleports the ship into the asteroid sector (deep-space-warp.js).
  ship.position.set(230, 0, 150);
  ship.velocity.set(0, 0, 0);
  ship.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  tick();
  const after = manager.snapshot();
  assert.ok(lateral() < after.tubeRadius,
    `asteroid landing: ship is ${lateral().toFixed(1)} from the rock tube axis, tube radius ${after.tubeRadius} (BUG-004)`);
  assert.equal(after.slots.length, 8, "eight sector slots after re-anchoring");

  // Flying on along the new heading keeps the same anchor (no rebuild every frame).
  const origin = JSON.stringify(after.odometer.origin);
  ship.velocity.set(-12, 0, 0);
  for (let i = 0; i < 30; i++) { ship.position.x -= 0.2; tick(); }
  assert.equal(JSON.stringify(manager.snapshot().odometer.origin), origin, "anchor jumps while flying straight");
});

test("scene: in first space the field stays exactly where the owner confirmed it (anchored at ONICSS)", async () => {
  const { manager, tick, onicss } = await sceneManager();
  tick();
  const o = manager.snapshot().odometer.origin;
  assert.deepEqual([o.x, o.y, o.z], [onicss.x, onicss.y, onicss.z]);
});
