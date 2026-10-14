import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const warp = await readFile(new URL("../mini-sim/assets/js/deep-space-warp.js", import.meta.url), "utf8");
const mini = await readFile(new URL("../mini-sim/assets/js/mini-sim.js", import.meta.url), "utf8");
const tower = await readFile(new URL("../mini-sim/tower/assets/js/tower.js", import.meta.url), "utf8");

function section(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `missing source marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `missing source marker: ${endMarker}`);
  return source.slice(start, end);
}

test("Tube section geometry and speed interpolate cyclically without a loop seam jump", () => {
  const helper = section(warp, "function tubeSectionBlend(values, elapsed)", "function angleDifference");
  assert.match(helper, /const eased = t \* t \* \(3 - 2 \* t\)/);
  assert.match(helper, /const next = \(current \+ 1\) % count/);
  assert.match(helper, /phase: position \* Math\.PI \* 2 \/ count/);
  assert.match(warp, /tubeSectionBlend\(speedBySection, state\.elapsed\)\.value/);
  assert.match(warp, /const WARP_DURATION = 48/);
});

test("Tube rendering is a rotating cylinder, not a fixed trapezoid", () => {
  const draw = section(warp, "function drawTubeTunnel", "function drawBackdrop");
  assert.match(draw, /const twistAt = \(d\) => courseTwist\(d\)/);
  assert.match(draw, /const radiusX = \(d\) =>/);
  assert.match(draw, /const radiusY = \(d\) => radiusX\(d\) \* 0\.91/);
  assert.match(draw, /Circumferential rings and seams/);
  assert.match(draw, /for \(let seam = 0; seam < 12; seam \+= 1\)/);
  assert.match(draw, /g\.rotate\(craftAngle - Math\.PI \/ 2 \+ \(state\.steerBank \|\| 0\)\)/);
  assert.match(draw, /Math\.sin\(loopPhase \+ d \* Math\.PI \* 2\.4\) \* loopMix/);
  assert.doesNotMatch(draw, /const roadY=d=>|const half=d=>|Continuous floor panels and centre dashes/);
});

test("Tube displays multiple obstacle types and tests collisions against their visible open angles", () => {
  const create = section(warp, "const gateCount = 15", "tubeTitle.textContent");
  const update = section(warp, "function updateTube(dt, now)", "window.BCMDeepSpaceWarpToggle");
  const draw = section(warp, "function drawTubeTunnel", "function drawBackdrop");
  assert.match(create, /\? "boost"/);
  assert.match(create, /\? "launcher"/);
  assert.match(create, /type === "spikes"/);
  assert.match(create, /type === "sweeper"/);
  assert.match(draw, /layer\.type === "gate"/);
  assert.match(draw, /layer\.type === "sweeper"/);
  assert.match(draw, /layer\.type === "spikes"/);
  assert.match(draw, /layer\.type === "boost"/);
  assert.match(draw, /layer\.type === "launcher"/);
  assert.match(update, /angleDifference\(playerAngle, layer\.safeAngle\)/);
  assert.match(update, /layer\.blockedAngles\.some/);
  assert.match(update, /layer\.sweepAngle \+ state\.elapsed \* layer\.sweepSpeed/);
  assert.match(update, /state\.playerAngle = Number\(state\.playerAngle \|\| 0\) - steer \* dt \* 1\.85/);
});

test("a successful Warp to (-40,30) returns home only after the continue button", () => {
  const finish = section(warp, "function finishTube(success)", "function isOniCssDestination");
  assert.doesNotMatch(finish, /returnToOniCss\(\)/);
  assert.doesNotMatch(finish, /setTimeout/);
  assert.match(finish, /tubeContinue\.hidden = !success/);
  const confirm = section(warp, "function confirmTubeArrival()", "function returnToOniCss()");
  assert.match(confirm, /isOniCssDestination\(state\.target\)/);
  assert.match(confirm, /returnToOniCss\(\)/);
  assert.match(confirm, /enterAsteroidMaze\(\)/);
  const home = section(warp, "function returnToOniCss()", "function makeMazeTexture");
  assert.match(home, /candidate\.x === -40 && candidate\.y === 30/);
  assert.match(home, /name = "ONI CSS · NEUNO"/);
  assert.match(home, /closeOverlay\(false\)/);
  assert.match(home, /engine\.teleport\(\{ x: 0, y: 0, z: 2, yaw: 0 \}, null\)/);
  assert.match(warp, /tubeAbort\.addEventListener\("click", \(\) => closeOverlay\(true\)\)/);
});

test("portal buffering leaves the live flight controls and velocity untouched", () => {
  const portal = section(mini, "function playPortalVideo(direction)", "function tryPortal()");
  const activation = portal.indexOf("const activateTransition = () =>");
  assert.ok(activation > 0);
  assert.doesNotMatch(portal.slice(0, activation), /transitionBusy = true|ship\.velocity\.set\(0, 0, 0\)|ship\.angularVelocity\.set\(0, 0, 0\)/);
  assert.match(portal, /transitionVideo\.onloadeddata = requestPlayback/);
  assert.match(portal, /transitionVideo\.oncanplay = requestPlayback/);
  assert.match(portal, /transitionVideo\.onplaying = activateTransition/);
  assert.match(portal, /transitionBusy = true/);
  assert.match(portal, /transitionVideo\.onerror = \(\) => \{\s*transitionLoading = false;\s*transitionBusy = false/);
});

test("Tower keeps H1 and its overlay hidden until tower.mp4 actually starts playback", () => {
  const transition = section(tower, "function triggerTransition()", "function startNewTower()");
  assert.match(transition, /transition\.hidden = true/);
  assert.match(transition, /transitionVideo\.onloadeddata = requestPlayback/);
  assert.match(transition, /transitionVideo\.oncanplay = requestPlayback/);
  assert.match(transition, /transitionVideo\.onplaying = \(\) => \{/);
  assert.match(transition, /transition\.hidden = false/);
  assert.match(transition, /if \(landingHandoffPending && !landingFrameNotified\)/);
  assert.match(transition, /resolveLandingFirstFrame\(true\)/);
  assert.doesNotMatch(transition, /const revealFirstFrame/);
});

test("Tower OST starts with the first playing frame and is retained across the mode menu", () => {
  const transition = section(tower, "function triggerTransition()", "function startNewTower()");
  const mode = section(tower, "function startMode(nextMode)", "function showMenu()");
  assert.match(transition, /transitionVideo\.onplaying = \(\) => \{[\s\S]*?playTowerAudio\(\)/);
  assert.match(mode, /if \(!towerAudio \|\| towerAudio\.paused \|\| towerAudio\.ended\) playTowerAudio\(\)/);
  assert.match(tower, /window\.BCMTowerAPI\.preloadLanding = \(\) => primeTransitionVideo\(\)/);
  const bootTail = tower.slice(tower.lastIndexOf("resize();"));
  assert.doesNotMatch(bootTail, /primeTransitionVideo\(\);/);
});
