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
  assert.match(body,/layer\.type === "gate"/);
  assert.match(body,/layer\.type === "sweeper"/);
  assert.match(body,/layer\.type === "spikes"/);
  assert.match(body,/layer\.type === "boost"/);
  assert.match(body,/layer\.type === "launcher"/);
  assert.match(body,/g\.rotate\(craftAngle - Math\.PI \/ 2 \+ \(state\.steerBank \|\| 0\)\)/);
  assert.match(update,/state\.playerAngle = Number\(state\.playerAngle \|\| 0\) - steer \* dt \* 1\.85/);
  assert.match(update,/angleDifference\(playerAngle, layer\.safeAngle\)/);
  assert.match(update,/layer\.blockedAngles\.some/);
  assert.match(update,/layer\.sweepAngle \+ state\.elapsed \* layer\.sweepSpeed/);
  assert.doesNotMatch(update,/state\.playerX = nextX \/ radial \* 0\.78/);
  assert.doesNotMatch(body,/const roadY=d=>|const half=d=>|Continuous floor panels and centre dashes/);
});
test("Room 2 can already see the deep-space satellite and planet",async()=>{
  const s=await read("mini-sim/assets/js/mini-sim.js");
  const body=s.slice(s.indexOf("function updateSpaceSatelliteVisibility"),s.indexOf("function buildWorld"));
  assert.match(body,/zone === "ROOM2" \|\| zone === "DEEP_SPACE"/);
  assert.match(s,/metalness: 0\.82/);
  assert.match(s,/existing\.listeners\.push/);
  assert.match(s,/new THREE\.SphereGeometry\(11, 24, 16\)/);
  assert.match(s,/planet\.position\.set\(-26, 9, -190\)/);
  assert.doesNotMatch(s,/new THREE\.SphereGeometry\(28, 24, 16\)/);
  assert.doesNotMatch(s,/planet\.position\.set\(0, 16, -220\)/);
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


test("Mini-Sim and Tower displayed versions match their PHP asset-cache versions", async () => {
  const miniPhp = await read("mini-sim/bcm-mini-sim.php");
  const towerPhp = await read("mini-sim/tower/bcm-tower.php");
  const tower = await read("mini-sim/tower/assets/js/tower.js");
  assert.ok(miniPhp.includes("Version: 0.9.95"));
  assert.ok(miniPhp.includes("BCM_MINI_SIM_VERSION', '0.9.95'"));
  assert.ok(miniPhp.includes("SPACE LABYRINTH — 0.9.95"));
  assert.ok(towerPhp.includes("BCM_TOWER_VERSION', '0.2.59'"));
  assert.ok(tower.includes('const TOWER_VERSION = "0.2.59"'));
});
