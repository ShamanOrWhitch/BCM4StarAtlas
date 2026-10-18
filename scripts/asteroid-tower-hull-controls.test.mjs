import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("Asteroid walls are resolved from the prepared asterwall asset family", async () => {
  const warp = await read("mini-sim/assets/js/deep-space-warp.js");
  assert.match(warp, /function asteroidWallAssetPool\(\)/);
  assert.match(warp, /asterwall/);
  assert.match(warp, /chosenWallAssets\.slice\(0, 4\)/);
  assert.match(warp, /wallMesh\.name = "asteroid-maze-wall-panels-" \+ index/);
  assert.match(warp, /wallMaterials\[index\]\.map = fallbackTexture/);
  assert.match(warp, /for \(const texture of new Set\(maze\.textures/);
});

test("Room 0 uses speed level 3 temporarily and restores its previous setting", async () => {
  const mini = await read("mini-sim/assets/js/mini-sim.js");
  assert.match(mini, /3: \{ thrust: 24, maxSpeed: 60 \}/);
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
  assert.match(tower, /controls\[i\]\.gamepad = true/);
  assert.match(tower, /p\.angle \+= dx \* 0\.0065/);
  assert.match(tower, /\/ 11, -1, 1\)/);
});

test("Warp Tube scrolls faster while retaining shared scene and soundtrack state", async () => {
  const warp = await read("mini-sim/assets/js/deep-space-warp.js");
  assert.match(warp, /const WARP_DURATION = 42/);
  assert.match(warp, /value \* 1\.25 \* \(boosted \? 1\.4 : 1\)/);
  assert.match(warp, /const runtime = engine\.getRuntime\(\)/);
  assert.match(warp, /if \(engine\.setSpeedMode\) engine\.setSpeedMode\(2\)/);
});

test("Hull Dive supplies two chibi crew members and keyboard, touch and gamepad controls", async () => {
  const hull = await read("mini-sim/assets/js/hull-dive.js");
  assert.match(hull, /window\.BCMMiniCrewSelection\?\.players/);
  assert.match(hull, /function makeChibiTexture\(THREE, suitColor, accentColor\)/);
  assert.match(hull, /new THREE\.Sprite\(new THREE\.SpriteMaterial/);
  assert.match(hull, /const players = \[/);
  assert.match(hull, /data-hull-control="repair"/);
  assert.match(hull, /data-hull-control="pump"/);
  assert.match(hull, /function readGamepad\(\)/);
  assert.match(hull, /navigator\.getGamepads/);
  assert.match(hull, /repair: !!keys\.enter/);
  assert.match(hull, /pump: !!keys\.shift/);
  assert.match(hull, /submergedRooms/);
  assert.match(hull, /const repairers = nearBreach\.reduce/);
  assert.match(hull, /BCMHullDive = \{ open: open \}/);
});
