import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Script } from "node:vm";

const warp = await readFile(new URL("../mini-sim/assets/js/deep-space-warp.js", import.meta.url), "utf8");
const plugin = await readFile(new URL("../mini-sim/bcm-mini-sim.php", import.meta.url), "utf8");
const qa = await readFile(new URL("../scripts/minisim-local-qa.test.mjs", import.meta.url), "utf8");
const css = await readFile(new URL("../mini-sim/assets/css/mini-sim.css", import.meta.url), "utf8");

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
  assert.match(warp, /state\.tubeTravel \+= dt \* speed \* 1\.48/);
  assert.match(warp, /window\.BCMDeepSpaceWarpSetDriveSlot = \(slotSize\) =>/);
});

test("Warp multiplier and displayed speed ramp faster from 1x to 12x", () => {
  const start = warp.indexOf("function warpNormalizedTime");
  const end = warp.indexOf("function tubeSectionBlend", start);
  assert.ok(start >= 0 && end > start, "Warp speed helpers should exist");
  const speed = new Script(warp.slice(start, end) + "\n({ warpSpeedMultiplier, warpCourseProgress });")
    .runInNewContext({ WARP_DURATION: 42 });
  assert.equal(speed.warpSpeedMultiplier(0), 1);
  assert.equal(speed.warpSpeedMultiplier(42), 12);
  assert.equal(speed.warpCourseProgress(0), 0);
  assert.equal(speed.warpCourseProgress(42), 1);
  assert.match(warp, /const t = Math\.pow\(warpNormalizedTime\(elapsed\), 0\.82\)/);
  assert.match(warp, /return Math\.pow\(12, t\)/);
  assert.match(warp, /return \(warpSpeedMultiplier\(elapsed\) - 1\) \/ 11/);
  assert.match(warp, /const courseLayerCount = 22/);
  assert.match(warp, /const typeRoll = rng\(\)/);
  assert.match(warp, /Math\.max\(1, Math\.min\(12,/);
  assert.match(warp, /tubeMeta\.textContent[\s\S]{0,180}"SPEED " \+ speed\.toFixed\(1\)/);
  assert.match(warp, /if \(distance > 0\.36 \|\| distance <= 0\) return null/);
  assert.match(warp, /return Math\.min\(1, 0\.055 \/ \(distance \+ 0\.05\)\)/);
});

test("Class II reverses the directional Warp streak logic", () => {
  const frame = warp.slice(warp.indexOf("function drawBackdrop(now)"), warp.indexOf("function updateTube(dt, now)"));
  assert.match(frame, /const reverseStreaks = activeWarpVisualClass\(\) === 2/);
  assert.match(frame, /reverseStreaks \? -1 : 1/);
  assert.match(frame, /reverseStreaks \? tx : sx/);
  assert.match(frame, /reverseStreaks \? sx : tx/);
});

test("Warp draws a real 2D SAGE coordinate plane and a separate sector-location layer", () => {
  assert.match(warp, /class="bcm-warp-galaxy-map" data-warp-galaxy-map/);
  assert.match(warp, /function renderGalaxyMap\(\)/);
  assert.match(warp, /SAGE_STAR_REFERENCE_POINTS/);
  assert.match(warp, /SAGE_CSS_REFERENCE_POINTS/);
  assert.match(warp, /nav\.adapter\.sectors/);
  assert.match(warp, /SAGE XY/);
  assert.match(warp, /−50 … \+50/);
  assert.match(warp, /data-warp-map-zoom-in/);
  assert.match(warp, /const GALAXY_MAP_ZOOM_LEVELS = \[1, 2, 4, 8\]/);
  assert.match(warp, /const centerX = zoom > 1/);
  assert.match(warp, /g\.clip\(\)/);
  assert.match(warp, /galaxyMapZoom >= 4 \|\| currentDistance > 9/);
  assert.match(warp, /if \(nearest && best <= 15\) selectTarget\(nearest\.sector\)/);
  assert.match(warp, /function renderSectorLocations\(sector\)/);
  assert.match(warp, /local-asteroid-complex/);
  assert.match(warp, /akenat-planet/);
  assert.match(warp, /Pearce/);
  assert.match(warp, /Ioki/);
  assert.match(warp, /Deep Space · внешняя зона/);
  assert.doesNotMatch(warp.slice(warp.indexOf("function renderGalaxyMap"), warp.indexOf("galaxyMap?.addEventListener")), /for \(let arm = 0; arm < 4/);
  assert.match(warp, /renderGalaxyMap\(\);\s*focusInitialMapChoice\(\)/);
  assert.match(warp, /engine\.releaseFlightPointerLock\(\)/);
  assert.match(warp, /function focusInitialMapChoice\(\)/);
  assert.match(warp, /focusMapChoice\(1\)/);
  assert.match(warp, /focusMapChoice\(-1\)/);
  assert.match(css, /bcm-warp-galaxy-map-tools/);
  assert.match(css, /data-warp-map-zoom-level/);
});

test("Mini-Sim doesn't relock the mouse or consume flight keys on the Warp map", async () => {
  const mini = await readFile(new URL("../mini-sim/assets/js/mini-sim.js", import.meta.url), "utf8");
  assert.match(mini, /canvas\.addEventListener\("click", \(\) => \{[\s\S]{0,180}!root\.classList\.contains\("bcm-warp-open"\)[\s\S]{0,120}canvas\.requestPointerLock/);
  assert.match(mini, /flightCodes\[e\.code\][\s\S]{0,130}!root\.classList\.contains\("bcm-warp-open"\)[\s\S]{0,90}!pointerLocked/);
  assert.match(mini, /settings\.open \|\| root\.classList\.contains\("bcm-warp-open"\)/);
});

test("Mini-Sim 0.11.21 cache/version contracts are synchronized", () => {
  assert.match(plugin, /Version: 0\.11\.21/);
  assert.match(plugin, /define\('BCM_MINI_SIM_VERSION', '0\.11\.21'\)/);
  assert.match(plugin, /SPACE LABYRINTH — 0\.11\.21/);
  assert.match(qa, /Version: 0\.11\.21/);
  assert.match(qa, /BCM_MINI_SIM_VERSION', '0\.11\.21'/);
  assert.match(qa, /SPACE LABYRINTH — 0\.11\.21/);
});
