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
  assert.equal(mapper("Large"), 3);
  assert.equal(mapper("Class 8"), 3);
  assert.equal(mapper("unknown"), 1);
  assert.match(warp, /config\.warpDriveSlotSize \|\| root\.dataset\.warpDriveSlotSize \|\| "x-small"/);
});

test("Tube view exposes three selectable visual classes; Class IV remains disabled", () => {
  for (const tier of [1, 2, 3]) assert.ok(warp.includes('data-warp-tier="' + tier + '"'));
  assert.match(warp, /data-warp-tier="4"[^>]*disabled/);
  assert.match(warp, /data-warp-tier-preview aria-label="Выбор оформления Warp"/);
  assert.match(warp, /Keep the established 12 longitudinal strips/);
  assert.doesNotMatch(warp, /Circumferential rings and seams make the enclosing cylinder legible/);
  assert.match(warp, /window\.BCMDeepSpaceWarpPreviewClass = setWarpVisualPreviewClass/);
  assert.match(warp, /function activeWarpVisualClass\(\)[\s\S]*?Number\(state\.warpPreviewClass\) \|\| Number\(state\.warpVisualClass\)/);
  assert.match(warp, /function setWarpVisualPreviewClass\(value\)[\s\S]*?\[1, 2, 3\]\.includes\(selected\)/);
  assert.match(warp, /state\.warpPreviewClass = null;\s*updateWarpTierPreviewButtons\(\);\s*tubeResult\.hidden/);
});

test("Warp keeps uncluttered longitudinal strips and clearly visible collision hazards", () => {
  const start = warp.indexOf("function drawTubeTunnel");
  const end = warp.indexOf("function drawBackdrop", start);
  assert.ok(start >= 0 && end > start, "Tube drawing function should exist");
  const draw = warp.slice(start, end);
  const updateStart = warp.indexOf("function updateTube(dt, now)");
  const updateEnd = warp.indexOf("window.BCMDeepSpaceWarpToggle", updateStart);
  const update = warp.slice(updateStart, updateEnd);

  assert.match(draw, /for \(let seam = 0; seam < 12; seam \+= 1\)/);
  assert.match(draw, /theta \+ \(d - 0\.92\) \* 0\.36/);
  assert.doesNotMatch(draw, /for \(let seam = 0; seam < 24/);
  assert.doesNotMatch(draw, /for \(let ring = 0; ring < 17/);
  assert.doesNotMatch(draw, /railCount|railSpin|pulseDepth/);
  assert.match(draw, /const pieces = 32/);
  assert.match(draw, /angleDifference\(\(from \+ to\) \* 0\.5, layer\.safeAngle\)/);
  assert.match(draw, /rgba\(255,112,86,0\.98\)/);
  assert.match(draw, /Bright inward-pointing hazard teeth/);
  assert.doesNotMatch(draw, /Two longitudinal guide-lines mark the safe opening/);
  assert.doesNotMatch(draw, /const chevron = point\(/);
  assert.doesNotMatch(draw, /const gateMark = point\(/);
  assert.match(draw, /const routeProgress = warpObstacleProgress\(state\.elapsed\)/);
  assert.match(update, /layer\.type === "gate"/);
  assert.match(update, /layer\.type === "sweeper"/);
  assert.match(update, /layer\.type === "spikes"/);
  assert.match(update, /layer\.type === "boost"/);
  assert.match(update, /layer\.type === "launcher"/);
  assert.match(warp, /state\.tubeTravel \+= dt \* speed \* 1\.12/);
  assert.match(warp, /window\.BCMDeepSpaceWarpSetDriveSlot = \(slotSize\) =>/);
});

test("Warp multiplier and displayed speed ramp from 1x to 8x", () => {
  const start = warp.indexOf("function warpNormalizedTime");
  const end = warp.indexOf("function tubeSectionBlend", start);
  assert.ok(start >= 0 && end > start, "Warp speed helpers should exist");
  const speed = new Script(warp.slice(start, end) + "\n({ warpSpeedMultiplier, warpCourseProgress });")
    .runInNewContext({ WARP_DURATION: 42 });
  assert.equal(speed.warpSpeedMultiplier(0), 1);
  assert.equal(speed.warpSpeedMultiplier(42), 8);
  assert.equal(speed.warpCourseProgress(0), 0);
  assert.equal(speed.warpCourseProgress(42), 1);
  assert.match(warp, /tubeMeta\.textContent[\s\S]{0,180}"SPEED " \+ speed\.toFixed\(1\)/);
  assert.match(warp, /if \(distance > 0\.36 \|\| distance <= 0\) return null/);
  assert.match(warp, /return Math\.min\(1, 0\.055 \/ \(distance \+ 0\.05\)\)/);
});

test("Mini-Sim 0.11.20 cache/version contracts are synchronized", () => {
  assert.match(plugin, /Version: 0\.11\.20/);
  assert.match(plugin, /define\('BCM_MINI_SIM_VERSION', '0\.11\.20'\)/);
  assert.match(plugin, /SPACE LABYRINTH — 0\.11\.20/);
  assert.match(qa, /Version: 0\.11\.20/);
  assert.match(qa, /BCM_MINI_SIM_VERSION', '0\.11\.20'/);
  assert.match(qa, /SPACE LABYRINTH — 0\.11\.20/);
});
