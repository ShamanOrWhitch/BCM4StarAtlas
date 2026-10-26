import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const repoRoot=new URL("../",import.meta.url);
const read=(path)=>readFile(new URL(path,repoRoot),"utf8");

test("Warp OST belongs to the whole Warp stage and loops",async()=>{
  const s=await read("mini-sim/assets/js/deep-space-warp.js");
  assert.match(s,/warpAudio\.loop = true/);
  assert.match(s,/const WARP_DURATION = 42/);
  assert.match(s,/pauseLevelOst\(\);\s*startWarpAudio\(true\);\s*state\.nav = readNavigation\(\)/);
  const tube=s.slice(s.indexOf("function showTube()"),s.indexOf("function finishTube"));
  assert.doesNotMatch(tube,/startWarpAudio/);
  assert.match(s,/function enterAsteroidMaze\(\) \{\s*\/\/ Warp OST owns the whole Warp stage/);
});
test("Warp uses a rolling circular wall and angular obstacle course",async()=>{
  const s=await read("mini-sim/assets/js/deep-space-warp.js");
  const body=s.slice(s.indexOf("function drawTubeTunnel"),s.indexOf("function drawBackdrop"));
  const update=s.slice(s.indexOf("function updateTube(dt, now)"),s.indexOf("window.BCMDeepSpaceWarpToggle"));
  assert.match(s,/const WARP_DURATION = 42/);
  assert.match(body,/const twistAt = \(d\) => courseTwist\(d\)/);
  assert.match(body,/for \(let panel = 0; panel < panelCount; panel \+= 1\)/);
  assert.match(body,/for \(let seam = 0; seam < 12; seam \+= 1\)/);
  assert.match(body,/theta \+ \(d - 0\.92\) \* 0\.36/);
  assert.doesNotMatch(body,/for \(let ring = 0; ring < 17/);
  assert.doesNotMatch(body,/railCount|railSpin|pulseDepth/);
  assert.match(body,/distance > 0\.36/);
  assert.match(body,/return Math\.min\(1, 0\.055 \/ \(distance \+ 0\.05\)\)/);
  assert.match(body,/const pieces = 32/);
  assert.match(body,/angleDifference\(\(from \+ to\) \* 0\.5, layer\.safeAngle\)/);
  assert.match(body,/rgba\(255,112,86,0\.98\)/);
  assert.match(body,/Bright inward-pointing hazard teeth/);
  assert.match(update,/layer\.type === "gate"/);
  assert.match(update,/layer\.type === "sweeper"/);
  assert.match(update,/layer\.type === "spikes"/);
  assert.match(update,/layer\.type === "boost"/);
  assert.match(update,/layer\.type === "launcher"/);
  assert.match(body,/g\.rotate\(craftAngle - Math\.PI \/ 2 \+ \(state\.steerBank \|\| 0\)\)/);
  assert.match(update,/state\.playerAngle = Number\(state\.playerAngle \|\| 0\) - steer \* dt \* 2\.2/);
  assert.match(update,/angleDifference\(playerAngle, layer\.safeAngle\)/);
  assert.match(update,/layer\.blockedAngles\.some/);
  assert.match(update,/layer\.sweepAngle \+ state\.elapsed \* layer\.sweepSpeed/);
  assert.doesNotMatch(update,/state\.playerX = nextX \/ radial \* 0\.78/);
  assert.doesNotMatch(body,/const roadY=d=>|const half=d=>|Continuous floor panels and centre dashes/);
});
test("Room 2 keeps the station separate and shows a real paused ONICSS video frame",async()=>{
  const s=await read("mini-sim/assets/js/mini-sim.js");
  const body=s.slice(s.indexOf("function updateSpaceSatelliteVisibility"),s.indexOf("function buildWorld"));
  assert.match(body,/zone === "ROOM2" \|\| zone === "DEEP_SPACE"/);
  assert.match(s,/metalness: 0\.82/);
  assert.match(s,/existing\.listeners\.push/);
  assert.match(s,/spacePlanet\.mesh = null/);
  assert.doesNotMatch(s,/new THREE\.SphereGeometry\(11, 24, 16\)/);
  assert.doesNotMatch(s,/planet\.position\.set\(-26, 9, -190\)/);
  const zones=s.slice(s.indexOf("const videoZones = Array.isArray(config.spaceVideoZones)"),s.indexOf("// Room 1 rear wall"));
  assert.match(zones,/video\.addEventListener\("loadeddata"/);
  assert.match(zones,/item\.mesh\.material = item\.videoMaterial/);
  assert.match(zones,/if \(item\.towerGate && item\.url\)/);
  assert.match(zones,/video\.preload = "auto"/);
  assert.match(zones,/video\.src = item\.url/);
  assert.match(zones,/video\.load\(\)/);
  assert.match(zones,/video\.pause\(\)/);
  assert.doesNotMatch(zones,/textured\("OniStation\.png", 0x496b8f, THREE\.DoubleSide\)/);
});
test("Room 1 Home clears Room 0 constraints and restores Starbase OST",async()=>{
  const s=await read("mini-sim/assets/js/mini-sim.js");
  const home=s.slice(s.indexOf("function returnToStart"),s.indexOf("function resetCurrentRoom"));
  assert.match(home,/race\.active = false/);
  assert.match(home,/updateRoom0Labyrinth\(\)/);
  assert.match(home,/ship\.position\.set\(0, 0, 2\)/);
  assert.match(home,/startMusic\(\)/);
  assert.match(home,/setStatus\("ROOM 1 · HOME · ONI CSS"\)/);
  const stopAt=home.indexOf("stopMiniSimAudio()");
  const startAt=home.indexOf("startMusic()");
  const statusAt=home.indexOf('setStatus("ROOM 1 · HOME · ONI CSS")');
  assert.ok(startAt>=0&&statusAt>startAt,"Home restarts Starbase before the Room 1 status");
  if(stopAt>=0)assert.ok(startAt>stopAt,"stopMiniSimAudio in Home must be followed by startMusic");
});
test("Note button shares one mute state across Starbase, Warp and Tower OSTs",async()=>{
  const mini=await read("mini-sim/assets/js/mini-sim.js");
  const warp=await read("mini-sim/assets/js/deep-space-warp.js");
  const tower=await read("mini-sim/tower/assets/js/tower.js");
  assert.match(mini,/window\.BCMGameAudio = Object\.assign/);
  assert.match(mini,/playExclusiveGameOst/);
  assert.match(mini,/musicButton\.classList\.toggle\("is-muted", cinema\.mute\)/);
  assert.match(warp,/playExclusive\(warpAudio, "warp"\)/);
  assert.match(tower,/playExclusive\(audio, "tower"\)/);
  assert.match(tower,/transitionVideo\.onplaying = \(\) => \{[\s\S]*?playTowerAudio\(\)/);
  assert.doesNotMatch(tower,/transitionStarted = true;\s*playTowerAudio\(\)/);
});

test("startup prioritizes Starbase OST, initial room textures, right-wall video and the actual portal element",async()=>{
  const mini=await read("mini-sim/assets/js/mini-sim.js");
  const boot=mini.slice(mini.indexOf("const config = window.BCMMiniSimConfig"),mini.indexOf("let miniSimReleased"));
  assert.match(boot,/musicAudio\.preload = "auto"/);
  assert.match(boot,/musicAudio\.fetchPriority = "high"/);
  assert.match(boot,/musicAudio\.src = config\.musicUrl/);
  const textured=mini.slice(mini.indexOf("function textured(name, fallback, side)"),mini.indexOf("function deferredTextured"));
  assert.match(textured,/img\.fetchPriority = textureRequestPriority\(name\) <= 1 \? "auto" : "low"/);
  const arm=mini.slice(mini.indexOf("let levelMediaArmed = false"),mini.indexOf("updateLiveWall();"));
  assert.ok(arm.indexOf("startBackgroundTextureLoading()") < arm.indexOf("room1-right-wall-live"));
  assert.ok(arm.indexOf("room1-right-wall-live") < arm.indexOf("primePortalVideo(\"FORWARD\", \"high\")"));
  assert.match(arm,/room1RightWall\.el\.fetchPriority = "high"/);
  assert.match(mini,/queueLowPriorityImage\(url, finish, \(\) => \{[\s\S]*?\}, 9\)/);
  assert.match(mini,/function addRoofCorners\([\s\S]*?const corner = deferredTextured\(/);
  assert.ok(mini.includes('if (/^roofa[0-9]*\\.png$/.test(base)) return 4;'));
  assert.ok(mini.includes('if (/^wall[1-5]\\.png$/.test(base)) return 1;'));
  const zones=mini.slice(mini.indexOf("const videoZones = Array.isArray(config.spaceVideoZones)"),mini.indexOf("// Room 1 rear wall"));
  assert.match(zones,/if \(item\.towerGate && item\.url\)/);
  assert.match(zones,/video\.preload = "auto";\s*video\.src = item\.url;\s*video\.load\(\)/);
  assert.doesNotMatch(zones,/video\.src = zone\.url;\s*video\.load\(\)/);
});

test("portal buffering leaves flight live until the transition video actually plays",async()=>{
  const mini=await read("mini-sim/assets/js/mini-sim.js");
  const portal=mini.slice(mini.indexOf("function playPortalVideo(direction)"),mini.indexOf("function tryPortal()"));
  const activation=portal.indexOf("const activateTransition = () =>");
  assert.ok(activation>0);
  assert.doesNotMatch(portal.slice(0,activation),/transitionBusy = true|ship\.velocity\.set\(0, 0, 0\)|ship\.angularVelocity\.set\(0, 0, 0\)/);
  assert.match(portal,/transitionVideo\.onloadeddata = requestPlayback/);
  assert.match(portal,/transitionVideo\.onplaying = activateTransition/);
  assert.match(portal,/const result = transitionVideo\.play\(\)/);
  assert.match(portal,/transitionVideo\.onerror = \(\) => \{\s*transitionLoading = false;\s*transitionBusy = false/);
});

test("ONICSS keeps the scene until Tower API is ready and tower.mp4 is playing",async()=>{
  const mini=await read("mini-sim/assets/js/mini-sim.js");
  const tower=await read("mini-sim/tower/assets/js/tower.js");
  const handoff=mini.slice(mini.indexOf("function handoffToTower()"),mini.indexOf("function enterTowerFromGate()"));
  const callback=handoff.indexOf("api.beginLanding((success) =>");
  const dispose=handoff.indexOf("disposeMiniSimResources()");
  assert.ok(callback>0 && dispose>callback);
  assert.match(handoff,/Promise\.resolve\(ensureTowerJsLoaded\(\)\)/);
  assert.match(handoff,/pauseAllCinemaVideos\(\)/);
  assert.match(tower,/window\.BCMTowerAPI\.preloadLanding = \(\) => primeTransitionVideo\(\)/);
  assert.match(tower,/window\.BCMTowerAPI\.beginLanding = \(onFirstFrame\)/);
  assert.match(tower,/transitionVideo\.onplaying = \(\) => \{[\s\S]*?playTowerAudio\(\)[\s\S]*?resolveLandingFirstFrame\(true\)/);
  assert.match(tower,/canvas\.style\.visibility = "hidden"/);
  assert.match(tower,/landingFirstFrameCallback = typeof onFirstFrame === "function"/);
  const boot=tower.slice(tower.indexOf("// The landing clip is deliberately not fetched on page boot"));
  assert.match(boot,/if \(!root\.classList\.contains\("bcm-tower-embedded"\)\) showMenu\(\)/);
  assert.doesNotMatch(boot,/primeTransitionVideo\(\);/);
  assert.doesNotMatch(boot,/status\.textContent = "TOWER STANDBY";\s*showMenu\(\)/);
});
test("Vertical movement uses the ship's current local up axis and gamepad turning is faster",async()=>{
  const s=await read("mini-sim/assets/js/mini-sim.js");
  assert.match(s,/inn\.vertical \* ship\.verticalThrust,[\s\S]*?-inn\.thrust \* ship\.thrust[\s\S]*?\.applyQuaternion\(ship\.quaternion\)/);
  assert.match(s,/pad\.rx \* \(settings\.invertYaw \? 1 : -1\) \* 4\.4 \* dt/);
  assert.match(s,/pad\.ry \* psign \* 4\.2 \* dt/);
});
test("Back reset neither stops OST nor unloads loaded sources",async()=>{
  const s=await read("mini-sim/assets/js/mini-sim.js"),a=s.indexOf("function resetCurrentRoom"),b=s.indexOf("function finishTeleport",a);
  assert.ok(a>=0&&b>a);const reset=s.slice(a,b);
  assert.doesNotMatch(reset,/stopMiniSimAudio|pauseAllCinemaVideos|removeAttribute\(["']src/);
  assert.match(s,/if \(!keepLoadedMedia && item\.loaded/);
  assert.match(s,/edge\(8, resetCurrentRoom\)/);
  assert.match(s,/if \(e\.code === "Backspace"\)[\s\S]*?resetCurrentRoom\(\)/);
});
test("exterior shell keeps periodic texture morphing while mobile texture use stays limited",async()=>{
  const s=await read("mini-sim/assets/js/mini-sim.js");
  assert.ok(s.includes("const urls = isMobileTextureMode() ? allUrls.slice(0, 4) : allUrls"));
  assert.ok(s.includes("function randomizeBackside(now)"));
  assert.ok(s.includes("function updateBacksideCamouflage(now)"));
  assert.ok(s.includes("item.nextAt = now + 800 + Math.random() * 2200"));
  assert.ok(s.includes("if (!backside.group || !backside.group.visible"));
  assert.ok(s.includes("if (exterior && !wasVisible)"));
  assert.ok(s.includes("updateBacksideCamouflage(now)"));
  const room=s.slice(s.indexOf("function buildRoom(parent"),s.indexOf("function buildStarbaseExterior(parent)"));
  assert.doesNotMatch(room,/randomizeBackside|updateBacksideCamouflage/);
});

test("Mini-Sim and Tower expose controller navigation",async()=>{
  const mini=await read("mini-sim/assets/js/mini-sim.js"),tower=await read("mini-sim/tower/assets/js/tower.js");
  const css=await read("mini-sim/assets/css/mini-sim.css"),tcss=await read("mini-sim/tower/assets/css/tower.css");
  assert.match(mini,/function pollGamepadMenu\(\)/);assert.match(css,/\.bcm-gamepad-focused/);
  assert.match(tower,/function focusTowerMode\(index\)/);assert.match(tower,/const up=button\(12\)/);
  assert.match(tcss,/button\.bcm-gamepad-focused/);
});
test("Playwright runner overrides plugin files from local checkout",async()=>{
  const s=await read("scripts/minisim-local-qa.mjs");
  assert.match(s,/import \{ mkdir, readFile, stat, writeFile \}/);
  assert.match(s,/createRequire/);
  assert.match(s,/wp-content\/plugins\/mini-sim/);
  assert.match(s,/bcm-deep-space-warp-js/);
  assert.match(s,/bcm-mini-sim-css/);
  assert.match(s,/wordpressHandleMap/);
  assert.match(s,/pluginHttpErrors/);
  assert.match(s,/wy-preloader/);
  assert.match(s,/05-after-cancel\.png/);
  const qaPackage=JSON.parse(await read("tools/minisim-qa/package.json"));
  assert.ok(qaPackage.devDependencies.playwright);
});


test("Warp hazards preserve depth separation, the 1x–8x ramp, and actual speed telemetry", async () => {
  const warp = await read("mini-sim/assets/js/deep-space-warp.js");
  assert.match(warp, /const t = Math\.pow\(warpNormalizedTime\(elapsed\), 0\.82\)/);
  assert.match(warp, /return \(warpSpeedMultiplier\(elapsed\) - 1\) \/ 11/);
  assert.match(warp, /Math\.max\(1, Math\.min\(12,/);
  assert.match(warp, /if \(distance > 0\.36 \|\| distance <= 0\) return null/);
  assert.match(warp, /return Math\.min\(1, 0\.055 \/ \(distance \+ 0\.05\)\)/);
  assert.doesNotMatch(warp, /if \(distance > 0\.68 \|\| distance <= 0\) return null/);
  assert.match(warp, /layer\.sweepAngle \+ state\.elapsed \* layer\.sweepSpeed/);
  assert.match(warp, /state\.tubeTravel \+= dt \* speed \* 1\.48/);
  assert.match(warp, /state\.tubeShimmerTime = Number\(state\.tubeShimmerTime \|\| 0\) \+ dt \* speed/);
  assert.match(warp, /const courseLayerCount = 22/);
  assert.match(warp, /tubeMeta\.textContent[\s\S]{0,180}"SPEED " \+ speed\.toFixed\(1\)/);
});

test("Room 1 and Room 2 wall collisions use the true pre-movement position", async () => {
  const sim = await read("mini-sim/assets/js/mini-sim.js");
  const physics = sim.slice(sim.indexOf("function updatePhysics(dt)"), sim.indexOf("function render(now)"));
  assert.match(physics, /const collisionStart = ship\.position\.clone\(\);[\s\S]{0,160}ship\.position\.addScaledVector\(ship\.velocity, dt\);[\s\S]{0,100}collide\(collisionStart\);/);
  const collision = sim.slice(sim.indexOf("function collide(previousPosition)"), sim.indexOf("function updatePhysics(dt)"));
  assert.match(collision, /const before = previousPosition[\s\S]{0,130}ship\.position\.clone\(\)/);
  assert.match(collision, /const attempted = ship\.position\.clone\(\)/);
  assert.match(collision, /const blockedX = attempted\.x !== ship\.position\.x/);
  assert.match(collision, /const blockedY = attempted\.y !== ship\.position\.y/);
  assert.match(collision, /const blockedZ = attempted\.z !== ship\.position\.z/);
});

test("Warp pause and teleport clear retained ship input", async () => {
  const s = await read("mini-sim/assets/js/mini-sim.js");
  assert.match(s, /function clearStoredInputState\(\)/);
  assert.match(s, /if \(externalPause\) clearStoredInputState\(\)/);
  const api = s.slice(s.indexOf("window.BCMiniSimAPI.pauseForWarp"), s.indexOf("window.BCMiniSimAPI.setExternalHUD"));
  assert.match(api, /clearStoredInputState\(\)/);
  assert.ok(api.includes("window.BCMiniSimAPI.teleport ="));
});

test("Mini-Sim and Tower displayed versions match their PHP asset-cache versions", async () => {
  const miniPhp = await read("mini-sim/bcm-mini-sim.php");
  const towerPhp = await read("mini-sim/tower/bcm-tower.php");
  const tower = await read("mini-sim/tower/assets/js/tower.js");
  assert.ok(miniPhp.includes("Version: 0.11.21"));
  assert.ok(miniPhp.includes("BCM_MINI_SIM_VERSION', '0.11.21'"));
  assert.ok(miniPhp.includes("SPACE LABYRINTH — 0.11.21"));
  assert.ok(towerPhp.includes("BCM_TOWER_VERSION', '0.2.67'"));
  assert.ok(tower.includes('const TOWER_VERSION = "0.2.67"'));
});


test("Asteroid collision keeps the 0.11.2 baseline and visible core shards on a connected route", async () => {
  const warp = await read("mini-sim/assets/js/deep-space-warp.js");
  const body = warp.slice(warp.indexOf("function updateMazeFrame(frame)"), warp.indexOf("function openHullInterior"));
  assert.match(body, /for \(let pass = 0; pass < 2; pass \+= 1\)/);
  assert.match(body, /ship\.velocity\.x \*= 0\.15/);
  assert.match(body, /ship\.velocity\.y \*= 0\.15/);
  assert.match(body, /ship\.velocity\.z \*= 0\.15/);
  assert.doesNotMatch(body, /Sweep the ship's previous-to-current segment/);
  assert.match(warp, /flyRadius: 160/);
  assert.match(body, /ship\.velocity\.multiplyScalar\(0\.25\)/);
  assert.match(warp, /const routeParent = new Map\(\[\[startNode, null\]\]\)/);
  assert.match(warp, /scouted: true/);
  assert.match(warp, /pos\.distanceTo\(crystal\.mesh\.position\) < 2\.0/);
  assert.match(warp, /shell\.visible = false/);
});

test("Warp travel motion increases while shimmer rate stays on its own previous clock", async () => {
  const warp = await read("mini-sim/assets/js/deep-space-warp.js");
  assert.match(warp, /state\.tubeTravel \+= dt \* speed \* 1\.48/);
  assert.match(warp, /state\.tubeShimmerTime = Number\(state\.tubeShimmerTime \|\| 0\) \+ dt \* speed/);
  assert.match(warp, /Math\.sin\(shimmerTime \* 1\.35/);
  assert.match(warp, /Math\.floor\(shimmerTime \* 8\)/);
  assert.match(warp, /Math\.pow\(warpCourseProgress\(elapsed\), 0\.86\)/);
  assert.match(warp, /const courseLayerCount = 22/);
});
