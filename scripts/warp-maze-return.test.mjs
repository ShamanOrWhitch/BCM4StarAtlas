import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
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

test("asteroid exit returns to Warp, Ring stays separate and Hull Dive is enterable in first-person", () => {
  assert.match(warp, /exitButton\.textContent = "СЛЕДУЮЩИЙ ПЕРЕХОД · V"/);
  assert.match(warp, /exitButton\.addEventListener\("click", returnToWarpMap\)/);
  assert.match(warp, /maze\.count === 3 \? "GOLD RING IS OPEN"/);
  assert.match(warp, /if \(state\.ringApproachArmed && !state\.ringEntryFailed && !state\.ringPlatformer &&[\s\S]{0,120}ringDistance < 2\.6\)\s*\{\s*attemptOpenRingPlatformer\(maze\)/);
  const mazeFrame = section(warp, "function updateMazeFrame(frame)", "function openHullInterior");
  assert.match(mazeFrame, /const ringDistance = pos\.distanceTo\(maze\.beacon\.position\)/);
  assert.match(mazeFrame, /state\.ringDistance = ringDistance/);
  assert.match(warp, /function openHullInterior\(\)/);
  assert.match(warp, /hullEnterButton\.textContent = "ВНУТРЬ КОРАБЛЯ · U \/ R3"/);
  assert.match(warp, /hullEnterButton\.addEventListener\("click", \(\) => openHullInterior\(\)\)/);
  const hull = section(warp, "function openHullInterior()", "function openRingPlatformer");
  assert.match(hull, /state\.hullOpen = true/);
  assert.doesNotMatch(hull, /engine\.pauseForWarp\(true\)/);
  assert.match(hull, /BCMHullHelmState/);
  assert.doesNotMatch(hull, /ship\.position\.copy\(maze\.beacon\.position\)/);
  assert.match(warp, /function openRingPlatformer\(maze, afterTransition = false\)/);
  assert.match(warp, /maze\.ringCompleted = success/);
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
  assert.match(body, /state\.returnQuaternion = runtime\.ship\.quaternion\.clone\(\)/);
  assert.doesNotMatch(body, /engine\.teleport\(state\.savedPosition,\s*state\.savedQuaternion\)/);
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
  assert.match(body, /Keep the established 12 longitudinal strips/);
  assert.doesNotMatch(body, /Circumferential rings and seams make the enclosing cylinder legible/);
  assert.match(body, /layer\.type === "gate"/);
  assert.match(body, /layer\.type === "sweeper"/);
  assert.match(body, /layer\.type === "spikes"/);
  assert.match(update, /layer\.type === "boost"/);
  assert.match(update, /layer\.type === "launcher"/);
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
  assert.match(hull, /const puffCount = 54/);
  assert.match(hull, /const bubbleCount = 96/);
  assert.match(hull, /activeCount = level > 0\.01 \? Math\.min\(bubble\.particleCount, Math\.max\(6, Math\.ceil\(level \* bubble\.particleCount \* 2\.2\)\)\)/);
  assert.match(hull, /function readAssignedGamepads\(\)/);
  assert.match(hull, /if \(connected\.length === 1\) return \[null, connected\[0\]\]/);
  assert.match(hull, /return \[connected\[0\] \|\| null, connected\[1\] \|\| null\]/);
  assert.match(hull, /canvas\.addEventListener\("pointerdown"/);
  assert.match(hull, /pointerInteraction\.action === "pump"/);
  assert.match(hull, /pointerInteraction\.action === "repair"/);
  assert.match(hull, /root\.style\.cssText = "position:fixed;left:auto;top:auto;right:max\(10px,env\(safe-area-inset-right\)\)/);
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


test("Ring intro plays ringgummy.mp4 and starts ring.mp3 on the first rendered video frame", () => {
  assert.match(warp, /function findRingTransitionVideoSource\(\)/);
  assert.match(warp, /fileName\(asset\) === "ringgummy\.mp4"/);
  const transition = section(warp, "function playRingTransition", "function openRingPlatformer");
  assert.match(transition, /prepareRingAudio\(\)/);
  assert.match(transition, /video\.requestVideoFrameCallback\(startSoundOnFirstFrame\)/);
  assert.match(transition, /video\.addEventListener\("ended", enterLevel/);
  assert.match(transition, /attemptOpenRingPlatformer\(maze, true\)/);
  assert.match(warp, /ringTransitionActive: false/);
});

test("Ring Frontier is a continuous side-scrolling action level with three large boss arenas", () => {
  const ring = section(warp, "function openRingPlatformer(maze, afterTransition = false)", "function finishRingPlatformer");
  assert.ok(ring.includes('world.name = "bcm-ring-frontier-side-scroll"'));
  assert.ok(ring.includes("function buildRingWorld()"));
  assert.ok(ring.includes("new THREE.OrthographicCamera"));
  assert.ok(ring.includes("window.BCMDeepSpaceWarpRender = renderRingViews"));
  assert.ok(ring.includes("data-ring-single"));
  assert.ok(ring.includes("data-ring-multi"));
  assert.ok(ring.includes("window.BCMMiniCrewSelection?.players"));
  assert.ok(ring.includes("makeCrewSpriteTexture"));
  assert.ok(ring.includes("function updateSplitState()"));
  assert.ok(ring.includes("function renderRingViews(frameContext)"));
  assert.ok(ring.includes("function drawMiniMap()"));
  assert.ok(ring.includes("function updateBosses(dt, now)"));
  assert.ok(ring.includes("const bosses = ["));
  assert.ok(ring.includes("СБОЙНЫЙ СТРАЖ"));
  assert.ok(ring.includes("ПЛАЗМЕННЫЙ СЕРДЕЧНИК"));
  assert.ok(ring.includes("СТАРШИЙ СИНГУЛЯРНОСТИ"));
  assert.ok(ring.includes("defeatedBosses < barrier.unlockAfter"));
  assert.match(ring, /maze\.cells/);
  assert.match(ring, /bcm-asteroid-cell-room/);
  assert.match(ring, /respawnMs: 240000/);
  assert.doesNotMatch(ring, /function triggerTurn\(|function triggerFloor\(/);
  assert.ok(warp.includes("maze.ringCompleted = success"));
  assert.match(warp, /ringApproachArmed: true/);
  assert.match(warp, /state\.ringApproachArmed = false/);
  assert.match(warp, /if \(ringDistance > 4\.2\) \{\s*state\.ringApproachArmed = true;\s*state\.ringEntryFailed = false;/);
  assert.match(warp, /state\.ringApproachArmed && !state\.ringEntryFailed && !state\.ringPlatformer &&[\s\S]{0,80}!maze\.ringCompleted/);
  assert.ok(ring.includes("function makeComicBackdrop(zone)"));
  assert.ok(ring.includes("new THREE.CanvasTexture(canvas)"));
  assert.ok(ring.includes("Each boss gets a framed arena"));
  assert.ok(ring.includes("bossOutlineGeometry"));
  assert.ok(ring.includes("worldTextures.push(texture)"));
});
test("Ring uses the shared WebGL renderer and exposes Tower's Crew alpha-cleaning helper", () => {
  assert.match(sim, /window\.BCMDeepSpaceWarpRender\(\{/);
  assert.match(sim, /deepSpaceCustomRendered = window\.BCMDeepSpaceWarpRender/);
  assert.match(sim, /window\.BCMDeepSpaceWarpPoll\(\{/);
  assert.match(tower, /window\.BCMTowerAPI\.makeCrewSpriteTexture = \(url\)/);
  assert.match(tower, /assetTexture\(String\(url \|\| ""\), renderer, \{ cutout: true \}\)/);
  assert.match(warp, /function renderRingViews\(frameContext\)/);
  assert.match(warp, /renderer\.render\(activeScene, view\.camera\)/);
  assert.doesNotMatch(warp, /new THREE\.WebGLRenderer/);
  assert.match(warp, /function updateRoomSlice\(\)/);
});

test("Ring transition video asset is present in the Mini-Sim merge checkout", async () => {
  const info = await stat(new URL("../mini-sim/assets/ringgummy.mp4", import.meta.url));
  assert.equal(info.isFile(), true);
  assert.ok(info.size > 0, "ringgummy.mp4 must not be an empty placeholder");
});

test("Ring soundtrack asset is present in the Mini-Sim merge checkout", async () => {
  const info = await stat(new URL("../mini-sim/assets/ring.mp3", import.meta.url));
  assert.equal(info.isFile(), true);
  assert.ok(info.size > 0, "ring.mp3 must not be an empty placeholder");
});


test("asteroid wall contact and flight radius match the 0.11.2 baseline", () => {
  const body = section(warp, "function updateMazeFrame(frame)", "function openHullInterior");
  assert.match(body, /for \(let pass = 0; pass < 2; pass \+= 1\)/);
  assert.match(body, /ship\.velocity\.x \*= 0\.15/);
  assert.match(body, /ship\.velocity\.y \*= 0\.15/);
  assert.match(body, /ship\.velocity\.z \*= 0\.15/);
  assert.doesNotMatch(body, /Sweep the ship's previous-to-current segment/);
  assert.doesNotMatch(body, /const previousPosition = maze\.lastPosition/);
  assert.match(warp, /flyRadius: 43\.2/);
  const radialBoundary = section(body, "const fromCenter = pos.clone().sub(maze.center);", "// Local artificial gravity activates near the gold ring");
  assert.match(radialBoundary, /ship\.velocity\.multiplyScalar\(0\.25\)/);
  assert.doesNotMatch(radialBoundary, /boundaryNormal|outwardSpeed|addScaledVector/);
});

test("Ring entry remains armed when the engine runtime is unavailable", () => {
  const body = section(warp, "function openRingPlatformer(maze, afterTransition = false)", "function finishRingPlatformer");
  const unavailable = body.indexOf("if (!runtime?.ship || !runtime.THREE || !runtime.scene) return false");
  const disarm = body.indexOf("state.ringApproachArmed = false");
  assert.ok(unavailable >= 0 && disarm > unavailable, "validate the engine before disarming Ring entry");
});


test("Ring transition hides duplicate entry UI and re-arms after a failed level start", () => {
  const body = section(warp, "function playRingTransition(maze, source, engine)", "function pauseLevelOst()");
  assert.match(body, /state\.ringTransitionActive = true;[\s\S]{0,120}ringEnterButton\.hidden = true/);
  assert.match(body, /if \(!attemptOpenRingPlatformer\(maze, true\)\) \{[\s\S]*?state\.ringEntryFailed = true;[\s\S]*?syncRingButtonVisibility\(\);/);
  const entry = section(warp, "function attemptOpenRingPlatformer(maze, afterTransition = false)", "if (typeof MutationObserver");
  assert.match(entry, /state\.ringEntryFailed = true/);
  assert.match(entry, /state\.ringApproachArmed = true/);
  assert.match(entry, /RING ENTRY FAILED/);
  assert.match(warp, /if \(ringDistance > 4\.2\) \{[\s\S]{0,120}state\.ringEntryFailed = false/);
});


test("Ring entry failures are retryable and don't disable the asteroid collision callback", () => {
  const entry = section(warp, "function attemptOpenRingPlatformer(maze, afterTransition = false)", "if (typeof MutationObserver");
  assert.match(entry, /state\.ringEntryFailed = true/);
  assert.match(entry, /state\.ringApproachArmed = true/);
  assert.match(entry, /RING ENTRY FAILED/);
  assert.match(warp, /!state\.ringEntryFailed && !state\.ringPlatformer/);
  assert.match(warp, /if \(ringDistance > 4\.2\) \{[\s\S]{0,100}state\.ringEntryFailed = false/);
  const callbacks = section(sim, "function reportDeepSpaceCallbackError(label, error)", "function toggleSettings()");
  assert.doesNotMatch(callbacks, /window\.BCMDeepSpaceWarpFrame = null/);
  assert.doesNotMatch(callbacks, /window\.BCMDeepSpaceWarpPoll = null/);
});


test("Ring initialization is transactional and restores the asteroid on setup failure", () => {
  const entry = section(warp, "function attemptOpenRingPlatformer(maze, afterTransition = false)", "if (typeof MutationObserver");
  assert.ok(entry.includes("const snapshot = {"));
  assert.ok(entry.includes("sceneChildren: new Set"));
  assert.ok(entry.includes("function restoreEntrySnapshot()"));
  assert.ok(entry.includes("partialCleanup"));
  assert.ok(entry.includes("snapshot.mazeGroup.visible = snapshot.mazeVisible"));
  assert.ok(entry.includes("snapshot.shipVisual.visible = snapshot.shipVisible"));
  assert.ok(entry.includes("snapshot.scene.background = snapshot.sceneBackground"));
  assert.ok(entry.includes("RING ENTRY FAILED · ASTEROID RESTORED"));

  const ring = section(warp, "function openRingPlatformer(maze, afterTransition = false)", "function finishRingPlatformer");
  const cleanupReady = ring.indexOf("state.ringPlatformerCleanup = () => {");
  assert.ok(cleanupReady >= 0);
  assert.ok(ring.indexOf("maze.group.visible = false;") > cleanupReady,
    "do not hide the asteroid before failure cleanup is registered");
  assert.ok(ring.indexOf("scene.background = new THREE.Color(0x030812)") > cleanupReady,
    "commit the Ring scene switch only after setup is ready");
});

test("Room 2 collision surfaces do not extend into open space", () => {
  const collisionSource = section(sim, "function collideCorridorShell(before)", "function collide(previousPosition)");
  const makeCollider = (ship, shellCrossed) => new Function(
    "ship", "shellCrossed", "hasOpenBacksideDoor",
    "let exteriorFlight = false;\n" + collisionSource +
      "\nreturn { run: collideCorridorShell, isExterior: () => exteriorFlight };"
  )(ship, shellCrossed, () => true);
  const collide = (before, after) => {
    const ship = { position: { ...after }, velocity: { x: 0, y: 0, z: 0 } };
    const collider = makeCollider(ship, (a, b, edge) =>
      (a >= edge && b < edge) || (a <= edge && b > edge));
    const blocked = collider.run({ ...before });
    return { ship, blocked, exterior: collider.isExterior() };
  };

  const openSide = collide({ x: 5.5, y: 20, z: -60 }, { x: 6.5, y: 20, z: -60 });
  assert.equal(openSide.blocked, false, "X wall plane outside the side wall must be open");
  assert.equal(openSide.ship.position.x, 6.5);

  const openYSide = collide({ x: 20, y: 3, z: -60 }, { x: 20, y: 4, z: -60 });
  assert.equal(openYSide.blocked, false, "Y wall plane outside the side wall must be open");
  assert.equal(openYSide.ship.position.y, 4);

  const openCap = collide({ x: 20, y: 0, z: -46.5 }, { x: 20, y: 0, z: -48.5 });
  assert.equal(openCap.blocked, false, "Room 2 front plane outside its cross-section must be open");
  assert.equal(openCap.ship.position.z, -48.5);

  const openRoom1Band = collide({ x: 20, y: 0, z: 5.8 }, { x: 20, y: 0, z: 0 });
  assert.equal(openRoom1Band.blocked, false, "Room 1 fallback must not capture a ship in space");
  assert.equal(openRoom1Band.ship.position.x, 20);
  assert.equal(openRoom1Band.ship.position.z, 0);

  const actualSide = collide({ x: 5.5, y: 0, z: -60 }, { x: 6.5, y: 0, z: -60 });
  assert.equal(actualSide.blocked, true, "the actual Room 2 side wall remains solid");
  assert.equal(actualSide.ship.position.x, 5.94);

  const actualCap = collide({ x: 0, y: 0, z: -46.5 }, { x: 0, y: 0, z: -48.5 });
  assert.equal(actualCap.blocked, true, "the actual Room 2 front cap remains solid");
  assert.equal(actualCap.ship.position.z, -47.44);

  const room2Exit = collide({ x: 0, y: 0, z: -84.4 }, { x: 0, y: 0, z: -84.8 });
  assert.equal(room2Exit.blocked, false, "the normal Room 2 rear exit remains open");
  assert.equal(room2Exit.exterior, true);
  assert.equal(room2Exit.ship.position.z, -84.8);
});

test("V opens the next-destination map from asteroid flight without resetting the ship", () => {
  assert.match(warp, /window\.BCMDeepSpaceWarpToggle = function \(\) \{[\s\S]*?state\.mode === "closed"\)[\s\S]*?state\.mode === "maze"[\s\S]*?returnToWarpMap\(\)/);
  const body = section(warp, "function returnToWarpMap()", "function resizeBackdrop()");
  assert.match(body, /state\.returnPosition = runtime\.ship\.position\.clone\(\)/);
  assert.match(body, /state\.returnQuaternion = runtime\.ship\.quaternion\.clone\(\)/);
  assert.doesNotMatch(body, /engine\.teleport\(state\.savedPosition,\s*state\.savedQuaternion\)/);
  assert.match(warp, /NEXT WARP DESTINATION · V/);
  assert.match(warp, /СЛЕДУЮЩИЙ ПЕРЕХОД · V/);
});


test("every backside shell tile is a proximity door; Room 2 corridor walls remain solid", () => {
  const shellBuild = section(sim, "function buildStarbaseExterior(parent)", "function trackSurfaceName");
  assert.ok(shellBuild.includes("function addPanel(material, x, y, z, w, h, rx, ry, surface)"));
  assert.ok(shellBuild.includes("const doorEligible = !!surfaceInfo;"));
  assert.ok(!shellBuild.includes("Math.random() < 0.095"));
  assert.ok(shellBuild.includes('addPanel(sideLeft, -outerX, y, center, segmentWidth, sideCellH, 0, -Math.PI / 2, "left")'));
  assert.ok(shellBuild.includes('addPanel(sideRight, outerX, y, center, segmentWidth, sideCellH, 0, Math.PI / 2, "right")'));
  assert.ok(shellBuild.includes('rotationY === 0 ? "front" : "rear"'));
  assert.ok(sim.includes("function updateBacksideDoors(dt, now)"));
  assert.ok(sim.includes("const openRange = 12.0"));
  assert.ok(sim.includes("const closeRange = 14.5"));
  assert.ok(sim.includes("panel.halfA + footprintPadding"));
  assert.ok(sim.includes("panel.halfB + footprintPadding"));

  const roomInterior = section(sim, "function collide(previousPosition)", "function updatePhysics(dt)");
  assert.match(roomInterior, /const room2Interior =/);
  assert.match(roomInterior, /ship\.position\.x = Math\.max\(-5\.3, Math\.min\(5\.3, ship\.position\.x\)\)/);
  assert.match(roomInterior, /ship\.position\.y = Math\.max\(-3\.2, Math\.min\(3\.2, ship\.position\.y\)\)/);

  const shellCollider = section(sim, "function collideStarbaseShell(before, allowInteriorOpenings)", "function collideCorridorShell(before)");
  assert.ok(shellCollider.includes('hasOpenBacksideDoor("x"'));
  assert.ok(shellCollider.includes('hasOpenBacksideDoor("y"'));
  assert.ok(shellCollider.includes('hasOpenBacksideDoor("z"'));
  const corridorCollider = section(sim, "function collideCorridorShell(before)", "function collide(previousPosition)");
  assert.ok(corridorCollider.includes('hasOpenBacksideDoor("z", room.rearZ, before, after)'));
  assert.ok(corridorCollider.includes("if (rearPassageOpen)"));
  assert.ok(!corridorCollider.includes("else if (before.z > room.rearZ && after.z < room.rearZ)"));
});

test("a backside passage needs every tile under the ship footprint fully open", () => {
  const helperSource = section(sim, "function hasOpenBacksideDoor(axis, edge, before, after)", "function collideStarbaseShell(before, allowInteriorOpenings)");
  const makeCheck = (panels) => new Function(
    "backside",
    "shellCrossed",
    helperSource + "\nreturn hasOpenBacksideDoor;"
  )({ panels }, (a, b, edge) => (a >= edge && b < edge) || (a <= edge && b > edge));
  const panel = {
    doorEligible: true,
    doorState: "OPEN",
    normalAxis: "x",
    base: { x: 16, y: 0, z: -60 },
    tangentA: "z",
    tangentB: "y",
    halfA: 2.25,
    halfB: 3
  };
  const before = { x: 15, y: 0, z: -60 };
  const after = { x: 17, y: 0, z: -60 };
  assert.equal(makeCheck([panel])("x", 16, before, after), true);
  assert.equal(makeCheck([{ ...panel, doorState: "CLOSING" }])("x", 16, before, after), false);
  assert.equal(makeCheck([{ ...panel, doorEligible: false }])("x", 16, before, after), false);

  const upper = { ...panel, base: { ...panel.base, y: 3 } };
  const lower = { ...panel, base: { ...panel.base, y: -3 } };
  assert.equal(makeCheck([upper, { ...lower, doorState: "CLOSED" }])("x", 16, before, after), false,
    "a ship on the tile seam must not pass while a neighboring tile is closed");
  assert.equal(makeCheck([upper, lower])("x", 16, before, after), true,
    "neighboring tiles open together to provide real clearance at a seam");
});

test("asteroid physics restores the 0.11.2 wall-contact and flight-radius baseline", () => {
  const body = section(warp, "function updateMazeFrame(frame)", "function openHullInterior");
  assert.match(body, /for \(let pass = 0; pass < 2; pass \+= 1\)/);
  assert.match(body, /ship\.velocity\.x \*= 0\.15/);
  assert.match(body, /ship\.velocity\.y \*= 0\.15/);
  assert.match(body, /ship\.velocity\.z \*= 0\.15/);
  assert.doesNotMatch(body, /Sweep the ship's previous-to-current segment/);
  assert.doesNotMatch(body, /const previousPosition = maze\.lastPosition/);
  assert.match(warp, /flyRadius: 43\.2/);
  const radialBoundary = section(body, "const fromCenter = pos.clone().sub(maze.center);", "// Local artificial gravity activates near the gold ring");
  assert.match(radialBoundary, /ship\.velocity\.multiplyScalar\(0\.25\)/);
  assert.doesNotMatch(radialBoundary, /boundaryNormal|outwardSpeed|addScaledVector/);
});

test("asteroid Hydrogen pickup has an obvious H+1 effect and updates the real mission counter", () => {
  const effect = section(warp, "function spawnCrystalPickupEffect(position, pickupLabel)", "function updateCrystalPickupEffects(dt)");
  assert.match(effect, /new THREE\.CanvasTexture\(labelCanvas\)/);
  assert.match(effect, /pickupLabel \|\| "CORE \+1"/);
  assert.match(effect, /pickupLabel === "H \+1"/);
  assert.match(effect, /labelSprite\.scale\.set/);

  const collect = section(warp, "maze.crystals.forEach((crystal) => {", "updateCrystalPickupEffects(Math.min");
  assert.match(collect, /const isHydrogenPickup = !!mission\.hydrogenUnlocked/);
  assert.match(collect, /spawnCrystalPickupEffect\(pickupPosition, isHydrogenPickup \? "H \+1" : "CORE \+1"\)/);
  assert.match(collect, /bcm:mission:hydrogen-shard-collected/);
  assert.match(collect, /const count = Number\(window\.BCMWorldMission\?\.hydrogenCount \|\| 0\)/);
  assert.match(collect, /HYDROGEN " \+ count \+ "\/3/);

  const missionSource = section(sim, "function recordHydrogenShard(detail)", "window.BCMWorldMissionAPI = {");
  assert.match(missionSource, /worldMission\.hydrogenCollectedIds\[id\]/);
  assert.match(missionSource, /worldMission\.hydrogenCount = Math\.min\(3, worldMission\.hydrogenCount \+ 1\)/);
  const mission = { hydrogenUnlocked: true, medusaUnlocked: false, hydrogenCount: 0, hydrogenCollectedIds: {} };
  const labels = [];
  const dialogs = [];
  const events = [];
  const record = new Function(
    "worldMission", "updateHydrogenMissionLabel", "interfaceLanguage",
    "showOperatorDialog", "window", "CustomEvent", "labyrinthSeed",
    missionSource + "\nreturn recordHydrogenShard;"
  )(
    mission,
    () => labels.push(mission.hydrogenCount),
    "en",
    (...args) => dialogs.push(args),
    { dispatchEvent: (event) => events.push(event) },
    function CustomEvent(type, init) { this.type = type; this.detail = init.detail; },
    123
  );
  record({ crystalId: "seed-a:1,1,2", asteroidSeed: "seed-a", cell: { x: 1, y: 1, z: 2 } });
  record({ crystalId: "seed-a:1,1,2", asteroidSeed: "seed-a", cell: { x: 1, y: 1, z: 2 } });
  assert.equal(mission.hydrogenCount, 1, "duplicate crystal IDs must not increment Hydrogen twice");
  record({ crystalId: "seed-a:2,1,2", asteroidSeed: "seed-a", cell: { x: 2, y: 1, z: 2 } });
  record({ crystalId: "seed-a:3,1,2", asteroidSeed: "seed-a", cell: { x: 3, y: 1, z: 2 } });
  assert.equal(mission.hydrogenCount, 3);
  assert.equal(mission.medusaUnlocked, true);
  assert.equal(events.filter((event) => event.type === "bcm:mission:medusa-unlocked").length, 1);
  assert.ok(labels.includes(1) && labels.includes(2) && labels.includes(3));
});
