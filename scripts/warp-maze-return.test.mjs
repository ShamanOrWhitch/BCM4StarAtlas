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

test("visual spacecraft rolls with the Warp tunnel instead of remaining upright", () => {
  const body = section(warp, "function drawTubeTunnel", "function drawBackdrop");
  assert.match(body, /const px=mid\+\(rawX-mid\)\*cosRoll/);
  assert.match(body, /const py=pivotY\+\(rawX-mid\)\*sinRoll/);
  assert.match(body, /g\.rotate\(roll\+Math\.max/);
});
