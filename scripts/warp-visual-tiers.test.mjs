import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Script } from "node:vm";

const warp = await readFile(new URL("../mini-sim/assets/js/deep-space-warp.js", import.meta.url), "utf8");
const plugin = await readFile(new URL("../mini-sim/bcm-mini-sim.php", import.meta.url), "utf8");
const qa = await readFile(new URL("../scripts/minisim-local-qa.test.mjs", import.meta.url), "utf8");

test("Warp Drive slot sizes map the intense rail look to XX-Small", () => {
  const start = warp.indexOf("function warpVisualClassForSlotSize(slotSize)");
  const end = warp.indexOf("\n    function currentWarpDriveSlotSize()", start);
  assert.ok(start >= 0 && end > start, "slot-to-class mapper should exist");
  const mapper = new Script(warp.slice(start, end) + "\nwarpVisualClassForSlotSize;").runInNewContext();

  assert.equal(mapper("XX-Small"), 2);
  assert.equal(mapper("XXS"), 2);
  assert.equal(mapper("X-Small"), 1);
  assert.equal(mapper("Small"), 1);
  assert.equal(mapper("MEDIUM"), 3);
  assert.equal(mapper("Large"), 4);
  assert.equal(mapper("Class 8"), 4);
  assert.equal(mapper("unknown"), 1);
  assert.match(warp, /config\.warpDriveSlotSize \|\| root\.dataset\.warpDriveSlotSize \|\| "x-small"/);
});

test("Tube view exposes a compact, live selector for all four visual classes", () => {
  for (const tier of [1, 2, 3, 4]) assert.ok(warp.includes('data-warp-tier="' + tier + '"'));
  assert.match(warp, /window\.BCMDeepSpaceWarpPreviewClass = setWarpVisualPreviewClass/);
  assert.match(warp, /function activeWarpVisualClass\(\)[\s\S]*?Number\(state\.warpPreviewClass\) \|\| Number\(state\.warpVisualClass\)/);
  assert.match(warp, /function setWarpVisualPreviewClass\(value\)[\s\S]*?\[1, 2, 3, 4\]\.includes\(selected\)/);
  assert.match(warp, /state\.warpPreviewClass = null;\s*updateWarpTierPreviewButtons\(\);\s*tubeResult\.hidden/);
});

test("Visual Classes II–IV have distinct decorative effects only", () => {
  const start = warp.indexOf("function drawTubeTunnel");
  const end = warp.indexOf("function drawBackdrop", start);
  assert.ok(start >= 0 && end > start, "Tube drawing function should exist");
  const draw = warp.slice(start, end);

  assert.match(draw, /if \(visualClass === 2\)[\s\S]*?const railCount = 4/);
  assert.match(draw, /Class III adds several shifting energy arcs[\s\S]*?if \(visualClass === 3\)/);
  assert.match(draw, /Class IV adds heavier twin stargate hoops[\s\S]*?if \(visualClass === 4\)/);
  assert.match(draw, /const routeProgress = warpObstacleProgress\(state\.elapsed\)/);
  assert.doesNotMatch(draw, /new THREE\.WebGLRenderer/);
  assert.match(warp, /state\.tubeTravel \+= dt \* speed \* 1\.12/);
  assert.match(warp, /window\.BCMDeepSpaceWarpSetDriveSlot = \(slotSize\) =>/);
});

test("Mini-Sim 0.11.6 cache/version contracts are synchronized", () => {
  assert.match(plugin, /Version: 0\.11\.6/);
  assert.match(plugin, /define\('BCM_MINI_SIM_VERSION', '0\.11\.6'\)/);
  assert.match(plugin, /SPACE LABYRINTH — 0\.11\.6/);
  assert.match(qa, /Version: 0\.11\.6/);
  assert.match(qa, /BCM_MINI_SIM_VERSION', '0\.11\.6'/);
  assert.match(qa, /SPACE LABYRINTH — 0\.11\.6/);
});
