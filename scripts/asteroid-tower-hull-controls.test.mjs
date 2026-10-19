import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("Asteroid walls are resolved from the prepared asterwall asset family", async () => {
  const warp = await read("mini-sim/assets/js/deep-space-warp.js");
  assert.match(warp, /function asteroidWallAssetPool\(\)/);
  assert.match(warp, /asterwall/);
  assert.ok(warp.includes("asterwall[^.]*"), "include every asterwall filename suffix");
  assert.match(warp, /const chosenWallAssets = availableWallAssets;/);
  assert.doesNotMatch(warp, /availableWallAssets\.slice\(0, 4\)/);
  assert.match(warp, /wallMesh\.name = "asteroid-maze-wall-panels-" \+ index/);
  assert.match(warp, /wallMaterials\[index\]\.map = fallbackTexture/);
  assert.match(warp, /for \(const texture of new Set\(maze\.textures/);
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
  assert.match(warp, /const rampMultiplier = warpSpeedMultiplier\(state\.elapsed\)/);
  assert.match(warp, /Math\.max\(8, Math\.min\(64,/);
  assert.match(warp, /layer\.sweepAngle \+ state\.elapsed \* layer\.sweepSpeed/);
  assert.match(warp, /const runtime = engine\.getRuntime\(\)/);
  assert.match(warp, /if \(engine\.setSpeedMode\) engine\.setSpeedMode\(2\)/);
});

test("Hull Dive exclusively owns key input and handles V across keyboard layouts", async () => {
  const hull = await read("mini-sim/assets/js/hull-dive.js");
  const mini = await read("mini-sim/assets/js/mini-sim.js");
  assert.match(hull, /KeyV: "v"/);
  assert.match(hull, /down && !event\.repeat/);
  assert.match(hull, /event\.stopImmediatePropagation\(\)/);
  assert.match(mini, /document\.getElementById\("bcm-hull-dive"\)/);
  assert.match(mini, /Hull Dive owns keyboard input while its overlay is open/);
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
  assert.match(hull, /pilotMode = true/);
  assert.match(hull, /KeyV: "v"/);
  assert.match(hull, /down && !event\.repeat/);
  assert.match(hull, /\"KeyV\"/);
  assert.match(hull, /event\.stopImmediatePropagation\(\)/);
  assert.match(hull, /let helmTogglePending = false/);
  assert.match(hull, /Leaving the helm must always be possible/);
  assert.match(hull, /window\.addEventListener\(\"blur\", clearHeldKeys\)/);
  const mini = await read("mini-sim/assets/js/mini-sim.js");
  assert.match(mini, /document\.getElementById\(\"bcm-hull-dive\"\)/);
  assert.match(hull, /enginePower = Math\.max\(0, Math\.min\(1, enginePower \+ input\.dy \* dt \* 0\.7\)\)/);
  assert.match(hull, /function makeHullSideTexture\(THREE\)/);
  assert.match(hull, /PИЛОТ \/ НАВИГАЦИЯ|ПИЛОТ \/ НАВИГАЦИЯ/);
  assert.match(hull, /ОРУДИЕ \/ БОЕЗАПАС/);
  assert.match(hull, /function fireWeapon\(player\)/);
  assert.match(hull, /const maxAmmo = 6/);
  assert.match(hull, /reloadProgress\[index\] >= 1\.05/);
  assert.match(hull, /window\.caches\.open\("bcm-tower-crew-cutouts-v8"\)/);
  assert.match(hull, /function readGamepad\(\)/);
  assert.match(hull, /navigator\.getGamepads/);
  assert.match(hull, /shoot: !!\(keys\.space \|\| pad\.shoot\)/);
  assert.match(hull, /repair: !!keys\.period/);
  assert.match(hull, /pump: !!keys\.shift/);
  assert.match(hull, /submergedRooms/);
  assert.match(hull, /const repairers = nearBreach\.reduce/);
  assert.match(hull, /BCMHullDive = \{ open: open \}/);
});
