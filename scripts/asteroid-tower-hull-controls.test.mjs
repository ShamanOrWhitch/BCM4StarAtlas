import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("First-person flight exposes Hull Interior with touch, U and edge-triggered R3", async () => {
  const warp = await read("mini-sim/assets/js/deep-space-warp.js");
  const mini = await read("mini-sim/assets/js/mini-sim.js");
  const hull = await read("mini-sim/assets/js/hull-dive.js");
  assert.match(warp, /hullEnterButton\.textContent = "ВНУТРЬ КОРАБЛЯ · U \/ R3"/);
  assert.match(warp, /hullEnterButton\.addEventListener\("click", \(\) => openHullInterior\(\)\)/);
  assert.match(warp, /function openHullInterior\(\)/);
  const interior = warp.slice(warp.indexOf("function openHullInterior()"), warp.indexOf("window.BCMDeepSpaceWarpPoll"));
  assert.match(interior, /state\.hullOpen = true/);
  assert.doesNotMatch(interior, /engine\.pauseForWarp\(true\)/);
  assert.match(interior, /BCMHullHelmState/);
  assert.match(interior, /whoever is standing at the helm keeps flying it/);
  assert.doesNotMatch(interior, /ship\.position\.copy\(maze\.beacon\.position\)/);
  assert.match(mini, /window\.BCMDeepSpaceWarpPoll\(\{ dt, running, paused: externalPause, root \}\)/);
  assert.match(warp, /const wasDown = hullEntryPadWasDown\.get\(pad\.index\) \|\| false/);
  assert.match(hull, /data-hull-exit/);
  assert.match(hull, /say\("НАЗАД В ПОЛЁТ", "BACK TO FLIGHT"\)/);
});

test("Flight starts in Room 1 and does not teleport into the asteroid", async () => {
  const mini = await read("mini-sim/assets/js/mini-sim.js");
  const begin = mini.slice(mini.indexOf("function beginFlight()"), mini.indexOf("const byName = Object.create(null)"));
  assert.doesNotMatch(begin, /BCMDeepSpaceWarpEnterAsteroid\s*\(/);
  assert.match(mini, /ship\.position = new THREE\.Vector3\(0, 0, 2\)/);
  assert.match(mini, /КОСМИЧЕСКИЙ ЛАБИРИНТ — 0\.11\.10/);
});

test("Asteroid walls are resolved from the prepared asterwall asset family", async () => {
  const warp = await read("mini-sim/assets/js/deep-space-warp.js");
  assert.match(warp, /function asteroidWallAssetPool\(\)/);
  assert.match(warp, /asterwall/);
  assert.ok(warp.includes("asterwall[^.]*"), "include every asterwall filename suffix");
  assert.match(warp, /const chosenWallAssets = availableWallAssets;/);
  assert.ok(warp.includes('const wallAssetOrderRng = randomFrom(hashSeed(String(seed) + "|wall-assets"));'));
  assert.ok(warp.includes("Math.floor(wallAssetOrderRng() * (i + 1))"));
  assert.doesNotMatch(warp, /availableWallAssets\.slice\(0, 4\)/);
  assert.match(warp, /wallMesh\.name = "asteroid-maze-wall-panels-" \+ key\.replace\(":", "-"\)/);
  assert.match(warp, /wallMaterials\[index\]\.map = fallbackTexture/);
  assert.match(warp, /for \(const texture of new Set\(\[\.\.\.\(maze\.textures \|\| \[maze\.texture\]\), \.\.\.\(maze\.wallVariantTextures \|\| \[\]\)\]\)\)/);
});

test("Room 0 uses speed level 3 temporarily and restores its previous setting", async () => {
  const mini = await read("mini-sim/assets/js/mini-sim.js");
  assert.match(mini, /1: \{ thrust: 8\.5, maxSpeed: 18 \}/);
  assert.match(mini, /2: \{ thrust: 13\.5, maxSpeed: 31 \}/);
  assert.match(mini, /3: \{ thrust: 18, maxSpeed: 45 \}/);
  assert.match(mini, /function beginRoom0Speed\(\)/);
  assert.match(mini, /setSpeedMode\(3\)/);
  assert.match(mini, /ROOM 0 · SPEED 3/);
  assert.match(mini, /function restoreRoom0Speed\(\)/);
  const returnPath = mini.slice(mini.indexOf("function returnFromSlipstream"), mini.indexOf("function isInsideCorridor"));
  assert.match(returnPath, /restoreRoom0Speed\(\)/);
  const home = mini.slice(mini.indexOf("function returnToStart"), mini.indexOf("function resetCurrentRoom"));
  assert.match(home, /restoreRoom0Speed\(\)/);
});

test("Tower seed generation is gentler; keyboard/touch slow down without slowing gamepad", async () => {
  const tower = await read("mini-sim/tower/assets/js/tower.js");
  assert.match(tower, /const maxDelta = wide \? 1 \+ Math\.floor\(rand\(\) \* 3\) : \(level % 4 === 0 \? 2 : 1\)/);
  assert.match(tower, /temperament < 0\.28 \? 0\.87 : 0\.78/);
  assert.match(tower, /const sideCount = 1 \+ Math\.floor\(rand\(\) \* 2\)/);
  assert.match(tower, /objectRoll < 0\.22/);
  assert.match(tower, /const manualInputScale = c\.gamepad \? 1 : 0\.84/);
  assert.match(tower, /const count = 38;/);
  assert.match(tower, /const platformWidth = 3\.23;/);
  assert.match(tower, /const footContactReach = 0\.32;/);
  assert.match(tower, /let width = platformWidth;/);
  assert.match(tower, /let depth = 1\.9;/);
  assert.match(tower, /const angularReach = Math\.atan2\(platformHalfWidth \+ footContactReach, Math\.max\(1, surfaceRadius\)\)/);
  assert.match(tower, /Math\.abs\(player\.radial - targetRadial\) > 0\.88/);
  assert.match(tower, /function makeJetFlameTexture\(color\)/);
  assert.match(tower, /function makeBoostCrateLidTexture\(boostType\)/);
  assert.match(tower, /for \(let level = 4; level < levels - 4; level \+= 5\)/);
  assert.match(tower, /boostTypes = \[\"jet\", \"shield\", \"spring\"\]/);
  assert.match(tower, /function triggerDoubleJump\(player\)/);
  assert.match(tower, /JET BOOST · УСИЛЕННЫЙ ВТОРОЙ ПРЫЖОК/);
  assert.match(tower, /playerJetEffects\[index\]/);
  assert.match(tower, /controls\[i\]\.gamepad = true/);
  assert.match(tower, /p\.angle \+= dx \* 0\.0065/);
  assert.match(tower, /\/ 11, -1, 1\)/);
});

test("Warp Tube scrolls faster while retaining shared scene and soundtrack state", async () => {
  const warp = await read("mini-sim/assets/js/deep-space-warp.js");
  assert.match(warp, /const WARP_DURATION = 42/);
  assert.match(warp, /function warpSpeedMultiplier\(elapsed\)/);
  assert.match(warp, /return 8 \* Math\.pow\(8, warpNormalizedTime\(elapsed\)\)/);
  assert.match(warp, /return \(warpSpeedMultiplier\(elapsed\) \/ 8 - 1\) \/ 7/);
  assert.match(warp, /function warpCourseProgress\(elapsed\)/);
  assert.match(warp, /function warpObstacleProgress\(elapsed\)/);
  assert.match(warp, /state\.tubeTravel \+= dt \* speed \* 1\.12/);
  assert.match(warp, /state\.tubeShimmerTime = Number\(state\.tubeShimmerTime \|\| 0\) \+ dt \* speed/);
  assert.match(warp, /const gateCount = 22/);
  assert.match(warp, /const runNonce = Date\.now\(\).*Math\.random/);
  assert.match(warp, /const rampMultiplier = warpSpeedMultiplier\(state\.elapsed\)/);
  assert.match(warp, /Math\.max\(8, Math\.min\(64,/);
  assert.match(warp, /layer\.sweepAngle \+ state\.elapsed \* layer\.sweepSpeed/);
  assert.match(warp, /const runtime = engine\.getRuntime\(\)/);
  assert.match(warp, /if \(engine\.setSpeedMode\) engine\.setSpeedMode\(2\)/);
});

test("Hull Dive exclusively owns key input and handles X across keyboard layouts", async () => {
  const hull = await read("mini-sim/assets/js/hull-dive.js");
  const mini = await read("mini-sim/assets/js/mini-sim.js");
  assert.match(hull, /KeyX: "x"/);
  assert.match(hull, /down && !event\.repeat/);
  assert.match(hull, /event\.stopImmediatePropagation\(\)/);
  assert.match(mini, /document\.getElementById\("bcm-hull-dive"\)/);
  assert.match(mini, /Hull Dive owns keyboard input while its overlay is open/);
  assert.match(mini, /pointerLocked/);
  assert.match(mini, /two-handed control/);
});

test("Hull Dive uses Tower Crew cut-outs and supplies working pilot, weapon, ammunition and repair stations", async () => {
  const hull = await read("mini-sim/assets/js/hull-dive.js");
  assert.match(hull, /window\.BCMMiniCrewSelection\?\.players/);
  assert.match(hull, /function makeCrewTexture\(THREE, crew\)/);
  assert.match(hull, /function makeFallbackChibiTexture\(THREE, suitColor, accentColor\)/);
  assert.match(hull, /bcm-tower-crew-cutouts-v8/);
  assert.match(hull, /function officialCrewCutoutUrl\(url\)/);
  assert.match(hull, /new THREE\.Sprite\(new THREE\.SpriteMaterial/);
  assert.match(hull, /data-hull-control="shoot"/);
  assert.match(hull, /data-hull-control="reload"/);
  assert.match(hull, /data-hull-control="helm"/);
  assert.doesNotMatch(hull, /document\.exitPointerLock && document\.pointerLockElement/);
  const miniControlSource = await read("mini-sim/assets/js/mini-sim.js");
  assert.match(miniControlSource, /window\.BCMiniSimAPI\.requestFlightPointerLock =/);
  assert.match(miniControlSource, /window\.BCMiniSimAPI\.releaseFlightPointerLock =/);
  assert.match(hull, /releaseFlightPointerLock/);
  assert.match(hull, /requestFlightPointerLock/);
  assert.match(hull, /pilotMode = true/);
  assert.match(hull, /KeyX: "x"/);
  assert.match(hull, /down && !event\.repeat/);
  assert.match(hull, /\"KeyX\"/);
  assert.match(hull, /event\.stopImmediatePropagation\(\)/);
  assert.match(hull, /let helmTogglePending = false/);
  assert.match(hull, /let helmOwner = 0/);
  assert.match(hull, /const toggleRequester = inputs\.findIndex/);
  assert.match(hull, /index === helmOwner && atHelm/);
  assert.match(hull, /const activeHelmInput = helmOwner >= 0/);
  assert.match(hull, /helmToggleRequestedBy = helmOwner >= 0 \? helmOwner : -1/);
  assert.match(hull, /window\.addEventListener\(\"blur\", clearHeldKeys\)/);
  const mini = await read("mini-sim/assets/js/mini-sim.js");
  assert.match(mini, /document\.getElementById\(\"bcm-hull-dive\"\)/);
  assert.match(hull, /enginePower = Math\.max\(0, Math\.min\(1, enginePower \+ input\.dy \* dt \* 0\.7\)\)/);
  assert.match(hull, /function makeHullSideTexture\(THREE, english = false\)/);
  assert.match(hull, /"PILOT \/ NAVIGATION"/);
  assert.match(hull, /"ПИЛОТ \/ НАВИГАЦИЯ"/);
  assert.match(hull, /"GUN \/ AMMO"/);
  assert.match(hull, /"ОРУДИЕ \/ БОЕЗАПАС"/);
  assert.match(hull, /function fireWeapon\(player\)/);
  assert.match(hull, /const maxAmmo = 6/);
  assert.match(hull, /reloadProgress\[index\] >= 1\.05/);
  assert.match(hull, /window\.caches\.open\("bcm-tower-crew-cutouts-v8"\)/);
  assert.match(hull, /function readAssignedGamepads\(\)/);
  assert.match(hull, /function readGamepad\(gp\)/);
  assert.match(hull, /navigator\.getGamepads/);
  assert.match(hull, /shoot: !!keys\.space/);
  assert.match(hull, /repair: !!\(keys\.period \|\| pad\.repair\)/);
  assert.match(hull, /pump: !!\(keys\.shift \|\| pad\.pump\)/);
  assert.match(hull, /submergedRooms/);
  assert.match(hull, /const repairers = nearBreach\.reduce/);
  assert.match(hull, /let pilotMode = true/);
  assert.match(hull, /texture\.flipY = true/);
  assert.doesNotMatch(hull, /createImageBitmap\(cached\)/);
  assert.match(hull, /window\.BCMHullRepairState/);
  assert.match(hull, /repairState\.triggerExternalImpact =/);
  assert.match(hull, /repairState\.patchExternalHole =/);
  assert.match(hull, /fire\[room\] = Math\.max\(0, fire\[room\] - 0\.30 \* dt\)/);
  assert.match(hull, /smokeParticles\.forEach/);
  assert.match(hull, /BCMHullDive = \{ open: open \}/);
});


test("Crew facing follows the Tower convention and 3D wall materials use each cell's Ring map data", async () => {
  const core = await read("mini-sim/assets/js/crew-core.js");
  const warp = await read("mini-sim/assets/js/deep-space-warp.js");
  const tower = await read("mini-sim/tower/assets/js/tower.js");
  assert.ok(core.includes('const faceFactor = String(profile.species || "").toLowerCase().includes("mierese") ? baseFacing : -baseFacing;'));
  assert.ok(core.includes('const face = (Number(actor.facing) < 0 ? -1 : 1) * faceFactor;'));
  assert.match(core, /function facingFactor\(species\)/);
  assert.ok(tower.includes('p.visualFacing = (turnInput > 0 ? -1 : 1) * facingFactor;'));
  assert.ok(warp.includes('function addWall(x, y, z, sx, sy, sz, cell)'));
  assert.ok(warp.includes('walls.push({ x, y, z, sx, sy, sz, cell });'));
  assert.ok(warp.includes('const wallLookRng = randomFrom(hashSeed(seed + "|wall-map"));'));
  assert.ok(warp.includes('const resolved = wallVariant(wall.cell);'));
  assert.ok(warp.includes('variantTexture.rotation = turn * (Math.PI / 2);'));
  assert.ok(warp.includes('wallBatches.get(resolved.key).walls.push(wall)'));
  assert.doesNotMatch(warp, /walls\.forEach\(\(wall, index\) => wallBatches\[index % wallBatches\.length\]\.push\(wall\)\)/);
  assert.ok(warp.includes('maze.wallVariantTextures || []'));
  assert.ok(warp.includes('copy.image = loadedTexture.image;'));
  assert.ok(warp.includes('wallTextureCopiesByAsset[index].push(copy)'));
  assert.ok(warp.includes('(wallVariantsByAsset[index] || []).forEach((variant) => syncImage(variant.texture))'));
  assert.match(warp, /const previousPosition = maze\.lastPosition/);
  assert.match(warp, /let sweptHit = null/);
  assert.match(warp, /const routeParent = new Map\(\[\[startNode, null\]\]\)/);
  assert.match(warp, /scouted: true/);
});


test("Hydrogen unlock follows real screen playback and places the collectible in the asteroid start cell", async () => {
  const mini = await read("mini-sim/assets/js/mini-sim.js");
  const warp = await read("mini-sim/assets/js/deep-space-warp.js");
  assert.match(mini, /window\.BCMWorldMissionAPI = \{/);
  assert.match(mini, /function registerMissionScreen\(screenId, required = true\)/);
  assert.match(mini, /required\.every\(\(id\) => worldMission\.screenVisited\[id\]\)/);
  assert.match(mini, /video\.addEventListener\("playing", \(\) => markMissionScreenActive\(item\.screenId\)\)/);
  assert.match(mini, /registerMissionScreen\(item\.screenId, !item\.towerGate\)/);
  assert.match(warp, /cell: \{ x: startNode\.x, y: startNode\.y, z: startNode\.z \}/);
  assert.match(warp, /hydrogenMesh\.name = "ring-hydrogen-pickup"/);
  assert.match(warp, /hydrogenNode: start/);
  assert.match(warp, /g\.fillText\("H"/);
  assert.match(warp, /playerNode !== path\.hydrogenNode/);
  assert.match(warp, /new CustomEvent\("bcm:mission:hydrogen-shard-collected"/);
  assert.match(warp, /hydrogen: hydrogen \?/);
});


test("Astral Y-cells are seed-deterministic and alter movement without rebuilding the maze", async () => {
  const warp = await read("mini-sim/assets/js/deep-space-warp.js");
  assert.ok(warp.includes('const astralHash = hashSeed(String(maze.seed) + "|astral|" + cell.x + "|" + cell.y + "|" + cell.z)'));
  assert.match(warp, /astralMode: astral \? \["drift", "flux", "dense"\]\[astralHash % 3\] : "normal"/);
  assert.match(warp, /ringCurrent: worldState\.cellPath \? worldState\.cellPath\.current : null/);
  assert.match(warp, /player\.ringTurnQueued = true/);
  assert.match(warp, /const haveSeparateCells = !!\(p1\.ringCurrent && p2\.ringCurrent && p1\.ringCurrent !== p2\.ringCurrent\)/);
  assert.match(warp, /function nextDirectionTowardLarge\(startNode\)/);
  assert.match(warp, /routeDirection = path\.nextDirectionTowardLarge\(node\)/);
  assert.match(warp, /asteroid-crystal-pickup-impact/);
  assert.match(warp, /bcm:mission:hydrogen-shard-collected/);
  assert.doesNotMatch(warp, /nextDirection = path\.nextDirectionTowardLarge\(node\) \|\|/);
  assert.match(warp, /const verticalDirection = input\.down \? "yn" : "yp"/);
  assert.match(warp, /sealedWallRight\.visible = !node\.large && !rightDoor/);
  assert.match(warp, /ring-cell-vertical-portal/);
  assert.match(warp, /placeParty\(enterRingCell\(worldState, nextNode,[\s\S]*?player\), player\)/);
  assert.match(warp, /Two longitudinal guide-lines mark the safe opening/);
  assert.doesNotMatch(warp, /Broken radial bars instead of a circular hoop/);
  assert.doesNotMatch(warp, /placeParty\(enterRingCell\(worldState, right, "left"\)\);/);
  assert.ok(warp.includes('astralPhase: ((hashSeed(String(maze.seed) + "|phase|" + cell.x + "|" + cell.y + "|" + cell.z) / 0xffffffff) * Math.PI * 2)'));
  assert.match(warp, /gravity = 6\.0;[\s\S]*?jumpVelocity = 7\.8/);
  assert.match(warp, /gravity = 8\.0 \+ Math\.sin\(now \* 0\.0018 \+ \(astralNode\.astralPhase \|\| 0\)\) \* 1\.8/);
  assert.match(warp, /gravity = 14\.5;[\s\S]*?jumpVelocity = 10\.2/);
  assert.match(warp, /"ASTRAL · DRIFT", flux: "ASTRAL · GRAVITY FLUX", dense: "ASTRAL · DENSE GRAVITY"/);
  assert.match(warp, /drift: "≈", flux: "↕", dense: "◆"/);
  assert.match(warp, /const anomalies = \(maze\.cells \|\| \[\]\)\.filter\(\(cell\) => cell\.y !== 1\)/);
});


test("Tower handoff preserves the arrival ship snapshot and active Tower seed for later return", async () => {
  const mini = await read("mini-sim/assets/js/mini-sim.js");
  const warp = await read("mini-sim/assets/js/deep-space-warp.js");
  const tower = await read("mini-sim/tower/assets/js/tower.js");
  const towerPhp = await read("mini-sim/tower/bcm-tower.php");
  assert.match(mini, /function captureArrivalShipSnapshot\(\)/);
  assert.match(mini, /mission\.originShipSnapshot = snapshot/);
  assert.match(mini, /captureArrivalShipSnapshot\(\);[\s\S]*?ship\.velocity\.set\(0, 0, 0\)/);
  assert.match(mini, /originShipSnapshot:|mission\.originShipSnapshot/);
  assert.match(warp, /window\.BCMDeepSpaceWarpGetReturnSnapshot = \(\) =>/);
  assert.match(tower, /window\.BCMWorldMission\.towerSeed = seed/);
  assert.match(tower, /originShipSnapshot\.towerSeed = seed/);
  assert.match(towerPhp, /define\('BCM_TOWER_VERSION', '0\.2\.65'\)/);
  assert.match(tower, /const TOWER_VERSION = "0\.2\.65"/);
});
