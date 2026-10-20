import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Script } from "node:vm";

const warp = await readFile(new URL("../mini-sim/assets/js/deep-space-warp.js", import.meta.url), "utf8");
const sim = await readFile(new URL("../mini-sim/assets/js/mini-sim.js", import.meta.url), "utf8");
const hull = await readFile(new URL("../mini-sim/assets/js/hull-dive.js", import.meta.url), "utf8");
const tower = await readFile(new URL("../mini-sim/tower/assets/js/tower.js", import.meta.url), "utf8");
const css = await readFile(new URL("../mini-sim/assets/css/mini-sim.css", import.meta.url), "utf8");

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
  assert.match(warp, /maze\.count === 3 \? "GOLD RING IS OPEN"/);
  assert.match(warp, /if \(!state\.ringPlatformer && !maze\.ringCompleted && ringDistance < 2\.6\)\s*\{\s*openRingPlatformer\(maze\)/);
  const ring = section(warp, "function updateMazeFrame(frame)", "function setMazeStatus");
  assert.match(ring, /ship\.quaternion\.setFromAxisAngle/);
  assert.match(ring, /ship\.angularVelocity\) ship\.angularVelocity\.set\(0, 0, 0\)/);
  assert.match(ring, /state\.ringDistance = approachDistance/);
  assert.match(ring, /function openHullAtRing\(\)/);
  assert.match(ring, /function openRingPlatformer\(maze\)/);
  assert.match(ring, /maze\.ringCompleted = maze\.count >= maze\.crystals\.length/);
  assert.match(warp, /exitButton\.addEventListener\("click", returnToWarpMap\)/);
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
  assert.match(body, /state\.returnPosition = runtime\.ship\.position\.clone\(\)/);
  assert.match(body, /const yaw = Math\.atan2\(-forward\.x, -forward\.z\)/);
  assert.ok(body.indexOf("state.returnPosition = runtime.ship.position.clone()") < body.indexOf("disposeMaze()"), "capture asteroid anchor before disposing maze");
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
  assert.match(warp, /const WARP_DURATION = 42/);
  assert.match(body, /const twistAt = \(d\) => courseTwist\(d\)/);
  assert.match(body, /const radiusX = \(d\) =>/);
  assert.match(body, /const radiusY = \(d\) => radiusX\(d\) \* 0\.91/);
  assert.match(body, /const point = \(d, theta, extra\)/);
  assert.match(body, /for \(let panel = 0; panel < panelCount; panel \+= 1\)/);
  assert.match(body, /for \(let seam = 0; seam < 12; seam \+= 1\)/);
  assert.match(body, /layer\.type === "gate"/);
  assert.match(body, /layer\.type === "sweeper"/);
  assert.match(body, /layer\.type === "spikes"/);
  assert.match(body, /layer\.type === "boost"/);
  assert.match(body, /layer\.type === "launcher"/);
  assert.match(body, /g\.rotate\(craftAngle - Math\.PI \/ 2 \+ \(state\.steerBank \|\| 0\)\)/);
  assert.match(update, /state\.playerAngle = Number\(state\.playerAngle \|\| 0\) - steer \* dt \* 2\.2/);
  assert.match(update, /angleDifference\(playerAngle, layer\.safeAngle\)/);
  assert.match(update, /layer\.blockedAngles\.some/);
  assert.match(update, /layer\.sweepAngle \+ state\.elapsed \* layer\.sweepSpeed/);
  assert.doesNotMatch(update, /state\.playerX = nextX \/ radial \* 0\.78/);
  assert.doesNotMatch(body, /const roadY=d=>|const half=d=>|Continuous floor panels and centre dashes/);
});

test("Every generated obstacle layer has a distinct type and a passable opening", () => {
  const start = warp.indexOf("const gateCount = 22");
  const end = warp.indexOf("tubeTitle.textContent", start);
  assert.ok(start > 0 && end > start);
  const body = warp.slice(start, end);
  assert.match(body, /safeAngle/);
  assert.match(body, /gapHalf: type === "gate" \? 0\.76 : 0\.86/);
  assert.match(body, /type === "sweeper"/);
  assert.match(body, /type === "spikes"/);
  assert.match(body, /\? "boost"/);
  assert.match(body, /"boost" : "launcher"/);
  assert.match(body, /progress = 0\.08 \+ \(i \/ Math\.max\(1, gateCount - 1\)\) \* 0\.86/);
});

test("reopening Warp retains the arrived local sector instead of resetting to the adapter launch sector", () => {
  const body = section(warp, "function readNavigation()", "function sectorText(sector)");
  assert.match(body, /if \(state\.sectorProgressed && state\.nav\) return state\.nav/);
  const openBody = section(warp, "function openMap()", "function closeOverlay");
  assert.match(openBody, /state\.nav = readNavigation\(\)/);
});


test("mobile Warp caps canvas frame rate and pixel ratio to reduce load", () => {
  assert.ok(warp.includes('const mobileRenderTarget = !!('));
  assert.ok(warp.includes('const warpFrameInterval = mobileRenderTarget ? 1000 / 30 : 1000 / 60;'));
  const sizing = section(warp, "function resizeBackdrop()", "function startBackdropLoop()");
  assert.ok(sizing.includes('Math.min(window.devicePixelRatio || 1, mobileRenderTarget ? 1 : 1.25)'));
  const frame = section(warp, "function drawBackdrop(now)", "function updateTube(dt, now)");
  assert.ok(frame.includes("now - state.lastFrame < warpFrameInterval"));
  assert.ok(frame.includes("requestAnimationFrame(drawBackdrop);"));
});


test("Warp Tube restores a moderated axial roll and phone tilt steering", () => {
  const draw = section(warp, "function drawTubeTunnel", "function drawBackdrop");
  const update = section(warp, "function updateTube(dt, now)", "window.BCMDeepSpaceWarpToggle");
  assert.match(warp, /data-warp-control="tilt"/);
  assert.match(warp, /function enableWarpTilt\(recalibrate\)/);
  assert.match(draw, /const axialRoll = Number\(state\.tubeRoll \|\| 0\) \+ Math\.sin\(t \* 0\.13\) \* 0\.126/);
  assert.match(draw, /return axialRoll \+ ahead \* 0\.12/);
  assert.match(update, /const rollRates = \[0\.42, 0\.82, 0\.55, 1\.12, 0\.31, 0\.72\]/);
  assert.match(update, /tubeSectionBlend\(rollRates, state\.elapsed\)\.value \* 0\.45/);
  assert.match(update, /state\.tilt\.value \* 0\.9/);
});

test("Warp Tube mobile HUD hides instructional blocks and keeps only compact telemetry", () => {
  assert.match(css, /\.bcm-warp-tube-help \{\s*display: none !important/);
  assert.match(css, /\.bcm-warp-tube-meta \{[\s\S]*?font-size: 9px/);
  assert.match(warp, /tubeMeta\.textContent = Math\.ceil\(Math\.max\(0, WARP_DURATION - state\.elapsed\)\) \+ "s · "/);
});


test("Warp comeback cancellation restores the post-maze anchor before resuming flight", () => {
  const close = section(warp, "function closeOverlay(restoreMain)", "function showTube()");
  assert.match(close, /const anchorPosition = state\.returnPosition \|\| state\.savedPosition/);
  assert.match(close, /const anchorQuaternion = state\.returnQuaternion \|\| state\.savedQuaternion/);
  assert.match(close, /engine\.teleport\(anchorPosition, anchorQuaternion\)/);
  assert.ok(close.indexOf("engine.teleport(anchorPosition, anchorQuaternion)") < close.indexOf("engine.pauseForWarp(false)"));
});

test("Warp hazards are faster, denser, randomized per run and visually decoupled from shimmer", () => {
  assert.match(warp, /function warpObstacleProgress\(elapsed\)/);
  assert.match(warp, /Math\.pow\(warpCourseProgress\(elapsed\), 0\.86\)/);
  assert.match(warp, /const gateCount = 22/);
  assert.match(warp, /const runNonce = Date\.now\(\)\.toString\(36\) \+ "-" \+ Math\.random/);
  assert.match(warp, /state\.tubeTravel \+= dt \* speed \* 1\.12/);
  assert.match(warp, /state\.tubeShimmerTime = Number\(state\.tubeShimmerTime \|\| 0\) \+ dt \* speed/);
  assert.match(warp, /Math\.sin\(shimmerTime \* 1\.35/);
  assert.match(warp, /if \(Math\.abs\(delta\) > 1\.18\)/);
});


test("starting another Tube after asteroid comeback resets the cancel anchor to this trip's launch pose", () => {
  const tube = section(warp, "function showTube()", "function finishTube");
  assert.match(tube, /state\.savedPosition = startRuntime\.ship\.position\.clone\(\)/);
  assert.match(tube, /state\.savedQuaternion = startRuntime\.ship\.quaternion\.clone\(\)/);
  assert.match(tube, /state\.returnPosition = null/);
  assert.match(tube, /state\.returnQuaternion = null/);
});

test("cancelling after asteroid comeback restores the launch sector without moving the ship out of the asteroid zone", () => {
  const close = section(warp, "function closeOverlay(restoreMain)", "function showTube()");
  assert.match(close, /if \(restoreMain && state\.launchNav\)/);
  assert.match(close, /state\.nav = state\.launchNav/);
  assert.match(close, /state\.sectorProgressed = state\.launchSectorProgressed/);
  assert.match(close, /const anchorPosition = state\.returnPosition \|\| state\.savedPosition/);
  assert.match(close, /engine\.teleport\(anchorPosition, anchorQuaternion\)/);
  assert.match(close, /state\.launchNav = null/);
});

test("a new Tube attempt snapshots the currently selected sector as its own origin", () => {
  const tube = section(warp, "function showTube()", "function finishTube");
  assert.match(tube, /state\.launchNav = state\.nav/);
  assert.match(tube, /state\.launchSectorProgressed = state\.sectorProgressed/);
});


test("Hull Dive has dense bounded smoke, water-dependent bubbles and independent Crew gamepads", () => {
  assert.match(hull, /const puffCount = 20/);
  assert.match(hull, /const bubbleCount = 28/);
  assert.match(hull, /activeCount = level > 0\.018 \? Math\.max\(2, Math\.ceil\(level \* bubble\.particleCount \* 1\.35\)\)/);
  assert.match(hull, /function readAssignedGamepads\(\)/);
  assert.match(hull, /if \(connected\.length === 1\) return \[null, connected\[0\]\]/);
  assert.match(hull, /return \[connected\[0\] \|\| null, connected\[1\] \|\| null\]/);
  assert.match(hull, /canvas\.addEventListener\("pointerdown"/);
  assert.match(hull, /pointerInteraction\.action === "pump"/);
  assert.match(hull, /pointerInteraction\.action === "repair"/);
  assert.match(hull, /root\.style\.cssText = "position:fixed;inset:0;z-index:80;background:transparent/);
});

test("Warp tube impacts progressively call the compartment damage contract", () => {
  assert.match(warp, /state\.warpCollisionCount = Math\.min\(99, Number\(state\.warpCollisionCount \|\| 0\) \+ 1\)/);
  assert.match(warp, /const damage = Math\.min\(24, 4 \+ state\.warpCollisionCount \* 1\.6\)/);
  assert.match(warp, /repair\.triggerExternalImpact\(compartmentId, damage\)/);
  assert.match(warp, /if \(approachDistance < 22 && approachDistance > 2\.65\)/);
  assert.match(warp, /state\.ringPlatformer \|\| state\.hullOpen/);
  assert.match(warp, /findRingAudioSource\(\)/);
  assert.match(warp, /candidate === "ring\.mp3"/);
});


test("Ring platformer has independent randomized cores, a recoverable exit, and lazy ring.mp3 audio", () => {
  const ring = section(warp, "function openRingPlatformer(maze)", "function finishRingPlatformer");
  assert.match(warp, /candidate === "ring\\.mp3"/);
  assert.match(warp, /ringAudio\\.preload = "none"/);
  assert.match(warp, /const ringTrackAvailable = startRingAudio\\(\\)/);
  assert.match(ring, /const corePickups = \\[1, 3, 5\\]\\.map/);
  assert.match(ring, /let ringCount = 0/);
  assert.match(ring, /event\\.code === "Escape" && down/);
  assert.match(ring, /const canExit = ringCount >= corePickups\\.length/);
  assert.match(ring, /removeEventListener\\("resize", onResize\\)/);
  assert.doesNotMatch(ring, /maze\\.count|maze\\.crystals|pickup\\.crystal/);
  assert.match(warp, /maze\\.ringCoreCount = Math\\.max/);
  assert.match(warp, /falloff \\* falloff \\* 1\\.8/);
});

test("Tower gamepad polling is suppressed while its root is hidden or Ring/Hull owns input", () => {
  const poll = section(tower, "function pollGamepads()", "restartButton.addEventListener");
  assert.match(poll, /const inputSuppressed = \\!\\!root\\.hidden/);
  assert.match(poll, /getElementById\\("bcm-hull-dive"\\)/);
  assert.match(poll, /getElementById\\("bcm-ring-platformer"\\)/);
  assert.match(poll, /if \(towerAudio && !towerAudio\\.paused\\) stopTowerAudio\\(\\)/);
  assert.match(poll, /return;/);
});

test("Changed Hull Dive, Warp and Tower scripts all parse before browser QA", () => {
  assert.doesNotThrow(() => new Script(hull));
  assert.doesNotThrow(() => new Script(warp));
  assert.doesNotThrow(() => new Script(tower));
});
