import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const warp = await readFile(new URL("../mini-sim/assets/js/deep-space-warp.js", import.meta.url), "utf8");
const sim = await readFile(new URL("../mini-sim/assets/js/mini-sim.js", import.meta.url), "utf8");

function section(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `missing source marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `missing source marker: ${endMarker}`);
  return source.slice(start, end);
}

test("asteroid exit and return beacon both return to the Warp map", () => {
  assert.match(warp, /exitButton\.textContent = "RETURN TO WARP MAP"/);
  assert.match(warp, /exitButton\.addEventListener\("click", returnToWarpMap\)/);
  assert.match(warp, /if \(maze\.count === 3[\s\S]*?returnToWarpMap\(\)/);
});

test("returning to the sector map keeps Warp active and pauses the ship", () => {
  const body = section(warp, "function returnToWarpMap()", "function resizeBackdrop()");
  assert.match(body, /disposeMaze\(\)/);
  assert.match(body, /state\.nav = navigationAfterArrival\(arrivedSector\)/);
  assert.match(body, /overlay\.hidden = false/);
  assert.match(body, /state\.mode = "map"/);
  assert.match(body, /engine\.pauseForWarp\(true\)/);
  assert.doesNotMatch(body, /stopWarpAudio\(\)|resumeLevelOst\(\)/);
  assert.doesNotMatch(body, /state\.savedPosition = null|state\.savedQuaternion = null/);
});

test("asteroid maze uses speed mode 2 and restores the previous mode", () => {
  assert.match(warp, /state\.savedSpeedMode = engine\.getSpeedMode \? engine\.getSpeedMode\(\) : 1/);
  assert.match(warp, /engine\.setSpeedMode\(2\)/);
  assert.match(warp, /engine\.setSpeedMode\(state\.savedSpeedMode\)/);
  assert.match(sim, /window\.BCMiniSimAPI\.getSpeedMode = \(\) => speedMode/);
  assert.match(sim, /window\.BCMiniSimAPI\.setSpeedMode = \(mode\) => setSpeedMode\(mode\)/);
});

test("new live sectors do not inherit the previous sector's connection list", () => {
  const body = section(warp, "function navigationAfterArrival(sector)", "function sectorText(sector)");
  assert.match(body, /raw\[key\]/);
  assert.match(body, /adapter\.getNeighbors/);
  assert.match(body, /const references = Array\.isArray\(list\) \? list : \[\]/);
  assert.match(body, /do not reuse the previous[\s\S]*?sector's links/);
  assert.match(body, /localPreview: true/);
  assert.match(body, /live: false/);
});

test("Warp map identifies the current sector by data, not the fixed ONI CSS label", () => {
  const body = section(warp, "function renderSectorGrid()", "function selectTarget(sector)");
  assert.match(body, /current\.name \|\| "CURRENT SECTOR"/);
  assert.match(body, /"CURRENT SECTOR"/);
  assert.doesNotMatch(body, /title\.textContent = isCurrent \? "ONI CSS"/);
});

test("Warp gamepad horizontal directions use the corrected left/right mapping", () => {
  const body = section(sim, "function pollGamepadMenu()", "function focusGamepadMenuChoice");
  assert.match(body, /const isWarpMapMenu = menu\.classList\.contains\("bcm-warp-map-view"\)/);
  assert.match(body, /if \(left && !gamepadMenuNav\.previous\.left\) move\(isWarpMapMenu \? 1 : -1\)/);
  assert.match(body, /if \(right && !gamepadMenuNav\.previous\.right\) move\(isWarpMapMenu \? -1 : 1\)/);
});

test("Warp Tube is a rolling circular cylinder with a curved / corkscrew route", () => {
  const body = section(warp, "function drawTubeTunnel", "function drawBackdrop");
  const update = section(warp, "function updateTube(dt, now)", "window.BCMDeepSpaceWarpToggle");
  assert.match(warp, /const WARP_DURATION = 48/);
  assert.match(body, /const roll = Number\(state\.tubeRoll \|\| 0\)/);
  assert.match(body, /const twistAt = \(d\) => roll \+ \(d - 0\.92\)/);
  assert.match(body, /const radiusX = \(d\) =>/);
  assert.match(body, /const radiusY = \(d\) => radiusX\(d\) \* 0\.91/);
  assert.match(body, /const point = \(d, theta, extra\)/);
  assert.match(body, /for \(let panel = 0; panel < panelCount; panel \+= 1\)/);
  assert.match(body, /Longitudinal seams spiral around the whole wall/);
  assert.match(body, /layer\.type === "gate"/);
  assert.match(body, /layer\.type === "sweeper"/);
  assert.match(body, /layer\.type === "spikes"/);
  assert.match(body, /layer\.type === "boost"/);
  assert.match(body, /layer\.type === "launcher"/);
  assert.match(body, /g\.rotate\(playerAngle \+ craftRoll - Math\.PI \/ 2\)/);
  assert.match(update, /state\.tubeRoll = Number\(state\.tubeRoll \|\| 0\) \+ dt \* tubeSectionBlend\(rollRates/);
  assert.match(update, /angleDifference\(playerAngle, layer\.safeAngle\)/);
  assert.match(update, /layer\.blockedAngles\.some/);
  assert.match(update, /layer\.sweepAngle \+ state\.elapsed \* layer\.sweepSpeed/);
  assert.match(update, /state\.playerX = nextX \/ radial \* 0\.78/);
  assert.doesNotMatch(body, /const roadY=d=>|const half=d=>|Continuous floor panels and centre dashes/);
});

test("Every generated obstacle layer has a distinct type and a passable opening", () => {
  const start = warp.indexOf("const gateCount = 15");
  const end = warp.indexOf("tubeTitle.textContent", start);
  assert.ok(start > 0 && end > start);
  const body = warp.slice(start, end);
  assert.match(body, /safeAngle/);
  assert.match(body, /gapHalf: type === "gate" \? 0\.76 : 0\.86/);
  assert.match(body, /type === "sweeper"/);
  assert.match(body, /type === "spikes"/);
  assert.match(body, /\? "boost"/);
  assert.match(body, /\? "launcher"/);
  assert.match(body, /progress = 0\.15 \+ \(i \/ Math\.max\(1, gateCount - 1\)\) \* 0\.72/);
});

test("reopening Warp retains the arrived local sector instead of resetting to the adapter launch sector", () => {
  const body = section(warp, "function readNavigation()", "function sectorText(sector)");
  assert.match(body, /if \(state\.sectorProgressed && state\.nav\) return state\.nav/);
  const openBody = section(warp, "function openMap()", "function closeOverlay");
  assert.match(openBody, /state\.nav = readNavigation\(\)/);
});
