import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Script } from "node:vm";

const warp = await readFile(new URL("../mini-sim/assets/js/deep-space-warp.js", import.meta.url), "utf8");
const plugin = await readFile(new URL("../mini-sim/bcm-mini-sim.php", import.meta.url), "utf8");

test("Warp Drive slot sizes map to the staged visual classes", () => {
  const start = warp.indexOf("function warpVisualClassForSlotSize(slotSize)");
  const end = warp.indexOf("\n    function currentWarpDriveSlotSize()", start);
  assert.ok(start >= 0 && end > start, "slot-to-class mapper should exist");
  const mapper = new Script(warp.slice(start, end) + "\nwarpVisualClassForSlotSize;").runInNewContext();

  assert.equal(mapper("XX-Small"), 1);
  assert.equal(mapper("X-Small"), 1);
  assert.equal(mapper("Small"), 2);
  assert.equal(mapper("MEDIUM"), 3);
  assert.equal(mapper("Large"), 4);
  assert.equal(mapper("Class 8"), 4);
});

test("Class 2 adds light-weight animated ion rails without changing Tube gameplay", () => {
  const start = warp.indexOf("function drawTubeTunnel");
  const end = warp.indexOf("function drawBackdrop", start);
  assert.ok(start >= 0 && end > start, "Tube drawing function should exist");
  const draw = warp.slice(start, end);

  assert.match(draw, /if \(state\.warpVisualClass >= 2\)/);
  assert.match(draw, /const railCount = 4/);
  assert.match(draw, /g\.globalCompositeOperation = "lighter"/);
  assert.match(draw, /state\.tubeTravel \* 0\.012/);
  assert.match(draw, /const routeProgress = warpObstacleProgress\(state\.elapsed\)/);
  assert.doesNotMatch(draw, /new THREE\.WebGLRenderer/);
  assert.match(warp, /window\.BCMDeepSpaceWarpSetDriveSlot = \(slotSize\) =>/);
});

test("Mini-Sim plugin cache version is bumped for the Warp visual preview", () => {
  assert.match(plugin, /Version: 0\.9\.106/);
  assert.match(plugin, /define\('BCM_MINI_SIM_VERSION', '0\.9\.106'\)/);
});
