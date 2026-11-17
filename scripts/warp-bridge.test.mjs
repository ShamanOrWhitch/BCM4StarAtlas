import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));

test("Warp bridge keeps hover preview, selected destination and arrived location separate", async () => {
  const source = await read("mini-sim/assets/js/warp-bridge.js");
  const sandbox = { window: {} };
  runInNewContext(source, sandbox);
  const changes = [];
  const bridge = sandbox.window.BCMWarpBridge.create({ onCurrentLocationChange: (location) => changes.push(plain(location)) });
  const node = { id: "oni-neuno", name: "ONI · NEUNO", x: -40, y: 30, z: 999, raw: { gameLocations: [{ name: "ONI" }] } };
  const preview = bridge.previewDestination(node);
  assert.deepEqual(plain({ id: preview.id, name: preview.name, x: preview.x, y: preview.y }),
    { id: "oni-neuno", name: "ONI · NEUNO", x: -40, y: 30 });
  assert.equal(bridge.getDestination(), null, "hover does not select a destination");
  preview.x = 100;
  assert.equal(bridge.getDestination(), null, "mutating preview cannot write state");
  assert.equal(bridge.previewDestination(node).raw, node.raw, "preview retains source metadata for the menu panel");
  bridge.selectDestination(node);
  assert.deepEqual(plain(bridge.getDestination()), { id: "oni-neuno", name: "ONI · NEUNO", x: -40, y: 30 });
  bridge.previewDestination({ id: "other", name: "Other", x: 2, y: 3 });
  assert.equal(bridge.getDestination().id, "oni-neuno", "another hover cannot replace selection");
  const current = bridge.commitArrival({ id: "asteroid", label: "ASTEROID · X -40 / Y 30", sectorX: -40, sectorY: 30 });
  assert.equal(current.id, "asteroid");
  assert.deepEqual(plain(current.galaxyNode), { id: "oni-neuno", name: "ONI · NEUNO", x: -40, y: 30 });
  assert.equal("z" in current.galaxyNode, false, "SAGE node stays two-dimensional");
  assert.equal(bridge.getDestination().id, "oni-neuno");
  assert.equal(bridge.getCurrentLocation().id, "asteroid");
  assert.equal(changes.length, 1);
  bridge.clearDestination();
  assert.equal(bridge.getDestination(), null);
  assert.equal(bridge.getCurrentLocation().id, "asteroid", "clearing destination preserves current location");
  bridge.setCurrentLocation({ id: "asteroid", label: "ASTEROID" }, node);
  assert.equal(bridge.getCurrentLocation().galaxyNode.id, "oni-neuno");
  bridge.clearCurrentLocation();
  assert.equal(bridge.getCurrentLocation(), null);
  assert.equal(changes.length, 3);
});

test("Warp bridge rejects incomplete arrivals without committing a false current location", async () => {
  const source = await read("mini-sim/assets/js/warp-bridge.js");
  const sandbox = { window: {} };
  runInNewContext(source, sandbox);
  const bridge = sandbox.window.BCMWarpBridge.create();
  assert.throws(() => bridge.commitArrival(null), /cannot commit an empty location/);
  assert.equal(bridge.getCurrentLocation(), null);
});

test("Asteroid maze is a separate seeded location loaded before Warp in PHP and standalone QA", async () => {
  const [php, warp, location, shell] = await Promise.all([
    read("mini-sim/bcm-mini-sim.php"), read("mini-sim/assets/js/deep-space-warp.js"),
    read("mini-sim/assets/js/asteroid-maze-location.js"), read("tools/minisim-qa/standalone-shell.html")
  ]);
  assert.match(php, /bcm-warp-bridge[\s\S]*?warp-bridge\.js/);
  assert.match(php, /bcm-asteroid-maze-location[\s\S]*?asteroid-maze-location\.js/);
  assert.match(php, /bcm-asteroid-maze-location[\s\S]{0,180}bcm-warp-bridge/);
  assert.match(warp, /window\.BCMWarpBridge\.create/);
  assert.match(warp, /function selectTarget\(sector\)[\s\S]{0,120}setWarpDestination\(sector\)/);
  assert.match(warp, /function enterAsteroidMaze\(\) \{[\s\S]{0,140}location\.enter\(\)/);
  assert.doesNotMatch(warp, /const NX = 7, NY = 3, NZ = 7/);
  assert.match(location, /const NX = 7, NY = 3, NZ = 7/);
  assert.match(location, /Seeded depth-first carve guarantees a connected route/);
  assert.match(location, /function updateMazeFrame\(frame\)/);
  assert.match(location, /function disposeMaze\(\)/);
  assert.match(warp, /window\.BCMDeepSpaceWarpPreviewDestination = previewWarpDestination/);
  assert.match(warp, /pointermove/);
  const bridgeTag = shell.indexOf('id="bcm-warp-bridge-js"');
  const locationTag = shell.indexOf('id="bcm-asteroid-maze-location-js"');
  const warpTag = shell.indexOf('id="bcm-deep-space-warp-js"');
  assert.ok(bridgeTag >= 0 && bridgeTag < locationTag && locationTag < warpTag);

  const browserQa = await read("scripts/minisim-local-qa.mjs");
  assert.match(browserQa, /confirmed sector selection writes destination to Warp bridge/);
  assert.match(browserQa, /cancelling an unarrived Tube clears the pending destination/);
  assert.match(browserQa, /asteroid entry commits currentLocation through the existing BCMMiniSimAPI place contract/);
  assert.match(browserQa, /returning to the Warp map clears the next destination but preserves the current asteroid location/);
});
