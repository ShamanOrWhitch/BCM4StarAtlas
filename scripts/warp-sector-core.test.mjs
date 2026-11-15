import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Script } from "node:vm";

const coreSource = await readFile(new URL("../mini-sim/assets/js/warp-sector-core.js", import.meta.url), "utf8");
const sceneSource = await readFile(new URL("../mini-sim/assets/js/warp-sector-scene.js", import.meta.url), "utf8");
const hostSource = await readFile(new URL("../mini-sim/assets/js/mini-sim.js", import.meta.url), "utf8");
const phpSource = await readFile(new URL("../mini-sim/bcm-mini-sim.php", import.meta.url), "utf8");

function loadUmd(source, globals = {}) {
  const sandbox = { module: { exports: {} }, globalThis: globals };
  new Script(source).runInNewContext(sandbox);
  return { api: sandbox.module.exports, globals };
}
const { api: Core } = loadUmd(coreSource);

test("Warp sector CPU module selfTest is clean without browser or THREE", () => {
  assert.equal(Core.selfTest().length, 0);
});
test("fixed sector window has eight unique sectors, two behind and five ahead", () => {
  const state = Core.createWindowState();
  const plan = Core.planWindow(state, 3.25 * 180, { sectorLength: 180, runSeed: 15 });
  assert.equal(plan.sectors.length, 8);
  assert.equal(new Set(plan.sectors).size, 8);
  assert.deepEqual(Array.from(plan.sectors), Array.from({ length: 8 }, (_, i) => plan.anchorSector - 2 + i));
});
test("one-sector forward and reverse moves replace at most one physical slot", () => {
  const state = Core.createWindowState();
  Core.commitWindowPlan(state, Core.planWindow(state, 90, { sectorLength: 180 }));
  const forward = Core.planWindow(state, 190, { sectorLength: 180 });
  assert.ok(forward.changes.length <= 1);
  Core.commitWindowPlan(state, forward);
  assert.ok(Core.planWindow(state, 170, { sectorLength: 180 }).changes.length <= 1);
});
test("large jumps replace only intersecting cache slots and never exceed eight", () => {
  const state = Core.createWindowState();
  Core.commitWindowPlan(state, Core.planWindow(state, 90, { sectorLength: 180 }));
  assert.ok(Core.planWindow(state, 5 * 180 + 5, { sectorLength: 180 }).changes.length <= 5);
  assert.equal(Core.planWindow(state, 12_000 * 180 + 5, { sectorLength: 180 }).changes.length, 8);
  assert.equal(state.slots.length, 8);
});
test("forty boundary oscillations inside the five-percent hysteresis do not churn slots", () => {
  const state = Core.createWindowState();
  Core.commitWindowPlan(state, Core.planWindow(state, 0.98 * 180, { sectorLength: 180 }));
  let rebuilds = 0;
  for (let i = 0; i < 40; i += 1) {
    const traveled = (i % 2 === 0 ? 1.02 : 0.98) * 180;
    const plan = Core.planWindow(state, traveled, { sectorLength: 180 });
    rebuilds += plan.changes.length;
    Core.commitWindowPlan(state, plan);
  }
  assert.equal(rebuilds, 0);
});
test("negative sectors map into real positive ring indices", () => {
  assert.equal(Core.sectorIndexFor(-0.01, 180), -1);
  assert.equal(Core.slotIndexFor(-1), 7);
  assert.equal(Core.slotIndexFor(-8), 0);
  assert.equal(Core.slotIndexFor(-9), 7);
});
test("plan is idempotent when traveled and slot assignments are unchanged", () => {
  const state = Core.createWindowState();
  Core.commitWindowPlan(state, Core.planWindow(state, 245, { sectorLength: 180, runSeed: 77 }));
  assert.equal(Core.planWindow(state, 245, { sectorLength: 180, runSeed: 77 }).changes.length, 0);
});
test("odometer samples exact post-physics position and supports signed reverse travel", () => {
  const odometer = Core.createOdometer({
    origin: { x: 2, y: 0, z: 10 }, position: { x: 2, y: 0, z: 10 }, axis: { x: 0, y: 0, z: -1 }
  });
  Core.advanceOdometer(odometer, { dt: 0.016, position: { x: 2, y: 0, z: -70 }, velocity: { x: 0, y: 0, z: 0 } });
  assert.equal(odometer.traveled, 80);
  assert.equal(odometer.drift.z, -80);
  Core.advanceOdometer(odometer, { dt: 0.016, position: { x: 2, y: 0, z: -30 }, velocity: { x: 0, y: 0, z: -999 } });
  assert.equal(odometer.traveled, 40);
});
test("sector layouts and seeds are deterministic and independent of physical slot", () => {
  const a = Core.layoutForSector(1234, -9, { sectorLength: 180 });
  const b = Core.layoutForSector(1234, -9, { sectorLength: 180 });
  const c = Core.layoutForSector(1234, -8, { sectorLength: 180 });
  assert.equal(a.seed, b.seed);
  assert.equal(a.templateIndex, b.templateIndex);
  assert.deepEqual(a.transforms, b.transforms);
  assert.notEqual(a.seed, c.seed);
});
test("scene adapter selfTest works without THREE or document", () => {
  const { api: Scene, globals } = loadUmd(sceneSource, { BCMWarpSectorCore: Core });
  assert.equal(Scene.selfTest().length, 0);
  assert.equal(Scene.SLOT_COUNT, 8);
  assert.equal(globals.BCMWarpSectorScene, Scene);
});
test("slot eviction disposes instance buffers but never shared templates", () => {
  const removeSlot = sceneSource.slice(sceneSource.indexOf("function removeSlot(slot)"), sceneSource.indexOf("function clearSlots()"));
  assert.match(removeSlot, /node\.userData\.slotOwned\s*!==\s*true/);
  assert.match(removeSlot, /node\.isInstancedMesh[\s\S]{0,120}node\.dispose\(\)/);
  assert.doesNotMatch(removeSlot, /geometry\.dispose|material\.dispose|texture\.dispose/);
  assert.match(sceneSource, /instances\.instanceMatrix\.setUsage\(THREE\.DynamicDrawUsage\)/);
  assert.match(sceneSource, /new THREE\.InstancedMesh\(template\.geometry,\s*template\.material/);
});
test("Mini-Sim streams sectors from the live post-collision ship position in Deep Space", () => {
  const physicsIndex = hostSource.indexOf("if (running && !settings.open)");
  const sectorIndex = hostSource.indexOf("window.BCMWarpSectorSceneFrame({", physicsIndex);
  const warpIndex = hostSource.indexOf("window.BCMDeepSpaceWarpFrame({", physicsIndex);
  assert.ok(physicsIndex >= 0 && sectorIndex > physicsIndex && warpIndex > sectorIndex);
  const call = hostSource.slice(sectorIndex, hostSource.indexOf("});", sectorIndex) + 3);
  assert.match(call, /active:[\s\S]*exteriorFlight[\s\S]*DEEP_SPACE/);
  assert.match(call, /position:|ship,/);
  assert.match(call, /originMesh: spaceSatellite\.stationMesh/);
  assert.match(call, /paused: externalPause \|\| settings\.open/);
  assert.match(phpSource, /warp-sector-core\.js/);
  assert.match(phpSource, /warp-sector-scene\.js/);
  assert.match(phpSource, /asteroid_clusters_v2/);
});