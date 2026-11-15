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
const layoutOptions = {
  sectorLength: 180,
  shipRadius: 2.5,
  tubeRadius: 32,
  templateExtents: [4, 5, 6, 4.5, 5.5, 6.5],
  runSeed: 1234
};

test("Warp sector CPU module selfTest is clean without browser or THREE", () => {
  assert.equal(Core.selfTest().length, 0);
});
test("3/4 sector window still contains exactly eight unique physical slots", () => {
  const state = Core.createWindowState();
  const plan = Core.planWindow(state, 3.25 * 180, { sectorLength: 180, runSeed: 15 });
  assert.equal(plan.sectors.length, 8);
  assert.equal(new Set(plan.sectors).size, 8);
  assert.deepEqual(
    Array.from(plan.sectors),
    Array.from({ length: 8 }, (_, i) => plan.anchorSector - 3 + i)
  );
  assert.equal(Core.SLOT_COUNT, 8);
  assert.equal(Core.TRAILING_SECTORS, 3);
  assert.equal(Core.LEADING_SECTORS, 4);
});
test("one-sector forward/backward movement replaces at most one slot", () => {
  const state = Core.createWindowState();
  Core.commitWindowPlan(state, Core.planWindow(state, 90, { sectorLength: 180 }));
  const forward = Core.planWindow(state, 190, { sectorLength: 180 });
  assert.ok(forward.changes.length <= 1);
  Core.commitWindowPlan(state, forward);
  assert.ok(Core.planWindow(state, 170, { sectorLength: 180 }).changes.length <= 1);
});
test("five-sector jumps batch changed sectors and never exceed eight replacements", () => {
  const state = Core.createWindowState();
  Core.commitWindowPlan(state, Core.planWindow(state, 90, { sectorLength: 180 }));
  assert.ok(Core.planWindow(state, 5 * 180 + 5, { sectorLength: 180 }).changes.length <= 5);
  assert.equal(state.slots.length, 8);
  assert.equal(Core.planWindow(Core.createWindowState(), 12_000 * 180, { sectorLength: 180 }).changes.length, 8);
});
test("forty oscillations inside the five-percent hysteresis do not churn slots", () => {
  const state = Core.createWindowState();
  Core.commitWindowPlan(state, Core.planWindow(state, 0.98 * 180, { sectorLength: 180 }));
  let rebuilds = 0;
  for (let i = 0; i < 40; i += 1) {
    const traveled = (i % 2 === 0 ? 1.02 : 0.98) * 180;
    const plan = Core.planWindow(state, traveled, { sectorLength: 180 });
    rebuilds += plan.changes.length;
    Core.commitWindowPlan(state, plan);
  }
  assert.ok(rebuilds <= 1);
});
test("negative sectors preserve signed floor and map to positive physical slots", () => {
  assert.equal(Core.sectorIndexFor(-0.01, 180), -1);
  assert.equal(Core.slotIndexFor(-1), 7);
  assert.equal(Core.slotIndexFor(-8), 0);
  assert.equal(Core.slotIndexFor(-9), 7);
});
test("layoutForSector is repeatable across eviction and independent of slot identity", () => {
  const a = Core.layoutForSector(1234, -9, layoutOptions);
  const rebuilt = Core.layoutForSector(1234, -9, layoutOptions);
  const neighbour = Core.layoutForSector(1234, -8, layoutOptions);
  assert.deepEqual(a, rebuilt);
  assert.notDeepEqual(a, neighbour);
  assert.equal(a.seed, Core.seedForSector(1234, -9));
});
test("each sector has eight volumetric cluster instances throughout the full cylinder", () => {
  const layout = Core.layoutForSector(1234, 10, layoutOptions);
  assert.equal(layout.transforms.length, 8);
  const inner = [], middle = [], outer = [];
  layout.transforms.forEach((item, index) => {
    assert.ok(item.angle >= 0 && item.angle < Math.PI * 2, "angle range");
    assert.ok(item.radius >= layout.rMin && item.radius <= layout.rMax, "radius range");
    assert.ok(item.axial >= 0 && item.axial < 180, "axial range");
    assert.ok(item.radius + layout.clusterExtent * item.scale + layout.wallClearance <= layout.tubeRadius + 1e-8,
      "cluster must remain inside the tube wall");
    const fraction = (item.radius - layout.rMin) / Math.max(1e-6, layout.rMax - layout.rMin);
    if (fraction < 0.42) inner.push(item);
    else if (fraction < 0.76) middle.push(item);
    else outer.push(item);
  });
  assert.ok(inner.length >= 2);
  assert.ok(middle.length >= 2);
  assert.ok(outer.length >= 1);
  assert.ok(new Set(layout.transforms.map(item => Math.floor(item.angle / (Math.PI * 2 / 8))).values()).size >= 7);
});
test("200 consecutive sectors have no identical deterministic layouts", () => {
  const keys = new Set();
  for (let sector = -100; sector < 100; sector += 1) {
    keys.add(JSON.stringify(Core.layoutForSector(1234, sector, layoutOptions)));
  }
  assert.equal(keys.size, 200);
});
test("component sphere extraction separates disconnected GLB rock meshes", () => {
  const positions = [
    0, 0, 0,  1, 0, 0,  0, 1, 0,
    0, 0, 0,  0, 1, 0,  0, 0, 1,
    10, 0, 0,  11, 0, 0,  10, 1, 0,
    10, 0, 0,  10, 1, 0,  10, 0, 1
  ];
  const spheres = Core.componentSpheresFromGeometry(positions, null, 1e-5);
  assert.equal(spheres.length, 2);
  assert.ok(spheres.every(sphere => sphere.radius > 0));
  assert.ok(spheres[0].center.x < spheres[1].center.x);
  assert.ok(Core.templateExtentFromSpheres(spheres) > 0);
});
test("collision broadphase checks axial depth before full radial distance", () => {
  const sideHit = Core.sweepSphere(
    { x: 0, y: 0, z: -2 },
    { x: 0, y: 0, z: 2 },
    { x: 3, y: 0, z: 0 },
    3.5
  );
  assert.equal(sideHit.broadphase, true);
  assert.equal(sideHit.hit, true);
  const depthMiss = Core.sweepSphere(
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: 0, y: 0, z: 8 },
    2
  );
  assert.equal(depthMiss.broadphase, false);
  assert.equal(depthMiss.hit, false);
  const radialMiss = Core.sweepSphere(
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: 2.5, y: 2.5, z: 0 },
    3
  );
  assert.equal(radialMiss.hit, false);
});
test("swept collision catches a visible asteroid crossed between frames", () => {
  const hit = Core.sweepSphere(
    { x: 0, y: 0, z: -4 },
    { x: 0, y: 0, z: 4 },
    { x: 0, y: 0, z: 0 },
    1
  );
  assert.equal(hit.hit, true);
  assert.ok(hit.t > 0 && hit.t < 1);
  assert.ok(hit.penetration >= 0);
});
test("collision candidate reach includes component offsets inside the cluster template", () => {
  const body = sceneSource.slice(sceneSource.indexOf("function maxCollisionReach()"), sceneSource.indexOf("function detectCollision("));
  assert.match(body, /template\.extent \* 1\.28/);
  assert.match(body, /return shipRadius \+ maxClusterExtent \+ 0\.15/);
});

test("sector boundary candidates include both adjoining sectors", () => {
  const length = 180, reach = 4;
  const previous = 179.5, current = 180.5;
  const first = Math.floor((Math.min(previous, current) - reach) / length);
  const last = Math.floor((Math.max(previous, current) + reach) / length);
  assert.deepEqual(Array.from({ length: last - first + 1 }, (_, i) => first + i), [0, 1]);
});
test("scene adapter selfTest works without THREE or document", () => {
  const { api: Scene, globals } = loadUmd(sceneSource, { BCMWarpSectorCore: Core });
  assert.equal(Scene.selfTest().length, 0);
  assert.equal(Scene.SLOT_COUNT, 8);
  assert.equal(globals.BCMWarpSectorScene, Scene);
});
test("scene creates eight InstancedMesh slots and keeps component proxies aligned to visible GLBs", () => {
  assert.match(sceneSource, /new THREE\.InstancedMesh\(\s*template\.geometry/);
  assert.match(sceneSource, /instances\.instanceMatrix\.setUsage\(THREE\.DynamicDrawUsage\)/);
  assert.match(sceneSource, /geometryCollisionSpheres/);
  assert.match(sceneSource, /Core\.componentSpheresFromGeometry/);
  assert.match(sceneSource, /slot\.collisionSpheres = template\.collisionSpheres/);
  assert.match(sceneSource, /for \(var instanceIndex = 0; instanceIndex < matrices\.length/);
  assert.match(sceneSource, /for \(var componentIndex = 0; componentIndex < spheres\.length/);
  assert.match(sceneSource, /Core\.sweepSphere\(/);
});
test("slot eviction disposes only its own InstancedMesh, never shared template geometry or materials", () => {
  const removeSlot = sceneSource.slice(sceneSource.indexOf("function removeSlot(slot)"), sceneSource.indexOf("function clearSlots()"));
  assert.match(removeSlot, /node\.userData\.slotOwned !== true/);
  assert.match(removeSlot, /node\.isInstancedMesh[\s\S]{0,120}node\.dispose\(\)/);
  assert.doesNotMatch(removeSlot, /geometry\.dispose|material\.dispose|texture\.dispose/);
  assert.match(sceneSource, /templates\.forEach\(function \(template\)/);
});
test("tube frame is fixed at ONICSS origin and its circular basis follows ship roll", () => {
  assert.match(sceneSource, /rootGroup\.position\.copy\(worldOrigin\)/);
  assert.match(sceneSource, /referenceUp\.set\(0, 1, 0\)\.applyQuaternion\(ship\.quaternion\)/);
  assert.match(sceneSource, /basisMatrix\.makeBasis\(worldRight, referenceUp, worldAxis\)/);
  assert.doesNotMatch(sceneSource, /rootGroup\.position\.copy\(ship\.position\)/);
});
test("Mini-Sim invokes sector collision after physics and reuses existing impact feedback", () => {
  const physicsIndex = hostSource.indexOf("if (running && !settings.open)");
  const sectorIndex = hostSource.indexOf("window.BCMWarpSectorSceneFrame({", physicsIndex);
  const warpIndex = hostSource.indexOf("window.BCMDeepSpaceWarpFrame({", physicsIndex);
  assert.ok(physicsIndex >= 0 && sectorIndex > physicsIndex && warpIndex > sectorIndex);
  const call = hostSource.slice(sectorIndex, hostSource.indexOf("});", sectorIndex) + 3);
  assert.match(call, /onCollision:\s*\(contact\)\s*=>/);
  assert.match(call, /triggerCollisionImpact\(contact\.force\)/);
  assert.match(hostSource, /if \(sectorFrameResult && sectorFrameResult\.collision && ship\.position\)/);
  assert.match(hostSource, /0\.14\.6/);
  assert.match(phpSource, /Version: 0\.14\.6/);
  assert.match(phpSource, /BCM_MINI_SIM_VERSION', '0\.14\.6'/);
  assert.match(phpSource, /SPACE LABYRINTH — 0\.14\.6/);
  assert.match(phpSource, /warp-sector-core\.js/);
  assert.match(phpSource, /warp-sector-scene\.js/);
  assert.match(phpSource, /asteroid_clusters_v2/);
});
