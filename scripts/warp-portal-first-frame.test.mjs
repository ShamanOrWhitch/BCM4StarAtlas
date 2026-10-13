import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const warp = await readFile(new URL("../mini-sim/assets/js/deep-space-warp.js", import.meta.url), "utf8");
const tower = await readFile(new URL("../mini-sim/tower/assets/js/tower.js", import.meta.url), "utf8");

function section(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `missing source marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `missing source marker: ${endMarker}`);
  return source.slice(start, end);
}

test("Warp section geometry and speed interpolate cyclically without a loop seam jump", () => {
  const helper = section(warp, "function tubeSectionBlend(values, elapsed)", "function drawTubeTunnel");
  assert.match(helper, /const eased = t \* t \* \(3 - 2 \* t\)/);
  assert.match(helper, /const next = \(current \+ 1\) % count/);
  assert.match(helper, /phase: position \* Math\.PI \* 2 \/ count/);
  assert.match(warp, /tubeSectionBlend\(speedBySection, state\.elapsed\)\.value/);
});

test("the road does not roll globally and the ship banks only from steering", () => {
  const draw = section(warp, "function drawTubeTunnel", "function drawBackdrop");
  assert.doesNotMatch(draw, /g\.rotate\(roll\)|cosRoll|sinRoll|const roll\s*=/);
  assert.doesNotMatch(draw, /g\.translate\(mid, h \* 0\.62\)/);
  assert.match(draw, /const bank=Math\.max\(-\.24,Math\.min\(\.24,-state\.playerX\*\.20\)\)/);
  assert.match(draw, /const sectionCurve = tubeSectionBlend\(curves, state\.elapsed\)\.value/);
});

test("barrier gates stay visible until they pass the player and collide at the crossing plane", () => {
  const draw = section(warp, "function drawTubeTunnel", "function drawBackdrop");
  const update = section(warp, "function updateTube(dt,now)", "window.BCMDeepSpaceWarpToggle");
  assert.match(draw, /if \(distance < -0\.16 \|\| distance > 0\.23\) return/);
  assert.doesNotMatch(draw, /layer\.resolved \|\| distance/);
  assert.match(update, /if \(!layer\.resolved && distance <= 0\)/);
  assert.match(warp, /\* 0\.70 \+ \(rng\(\) - 0\.5\) \* 0\.012/);
});

test("Warp to ONI CSS coordinates returns to the Mini-Sim home instead of launching another maze", () => {
  const finish = section(warp, "function finishTube(success)", "function isOniCssDestination");
  assert.match(finish, /isOniCssDestination\(state\.target\)/);
  assert.match(finish, /returnToOniCss\(\)/);
  const home = section(warp, "function returnToOniCss()", "function makeMazeTexture");
  assert.match(home, /candidate\.x === -40 && candidate\.y === 30/);
  assert.match(home, /name = "ONI CSS · NEUNO"/);
  assert.match(home, /closeOverlay\(false\)/);
  assert.match(home, /engine\.teleport\(\{ x: 0, y: 0, z: 2, yaw: 0 \}, null\)/);
  assert.match(home, /state\.sectorProgressed = true/);
});

test("Tower transition keeps H1 hidden until the first decoded video frame", () => {
  const transition = section(tower, "function triggerTransition()", "function startNewTower()");
  const beforeReveal = transition.slice(0, transition.indexOf("const revealFirstFrame"));
  const reveal = section(transition, "const revealFirstFrame", "transitionVideo.onloadedmetadata");
  assert.match(beforeReveal, /transition\.hidden = true/);
  assert.match(beforeReveal, /transition\.style\.backgroundImage = ""/);
  assert.doesNotMatch(beforeReveal, /transition\.hidden = false|helipadMarkerUrl\(\)/);
  assert.match(reveal, /transitionVideo\.readyState < 2/);
  assert.match(reveal, /transition\.hidden = false/);
  assert.doesNotMatch(reveal, /playTowerAudio\(\)/);
  assert.match(transition, /if \(transitionVideo\.readyState >= 2\)\s*\{\s*revealFirstFrame\(\)/);
  assert.match(tower, /primeTransitionVideo\(\);\s*const autostart/);
});

test("Tower soundtrack starts with gameplay, not while the landing clip is loading", () => {
  const startMode = section(tower, "function startMode(nextMode)", "function showMenu()");
  assert.match(startMode, /playTowerAudio\(\)/);
  const transition = section(tower, "function triggerTransition()", "function startNewTower()");
  assert.doesNotMatch(transition, /playTowerAudio\(\)/);
});
