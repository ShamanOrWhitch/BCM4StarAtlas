import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

const [warp, php, standaloneRunner, localQa, gltfLoader, gltfLicense] = await Promise.all([
  read("mini-sim/assets/js/deep-space-warp.js"),
  read("mini-sim/bcm-mini-sim.php"),
  read("scripts/minisim-standalone-qa.mjs"),
  read("scripts/minisim-local-qa.mjs"),
  read("mini-sim/assets/js/GLTFLoader.js"),
  read("mini-sim/assets/js/GLTFLoader-LICENSE.txt")
]);

test("Separate Twinsun rock and color crystal parts are exposed as local GLB model assets", () => {
  assert.match(php, /'glb'\s*\)/);
  assert.match(php, /\$extension === 'glb'[\s\S]{0,80}\$type = 'model'/);
  assert.match(php, /'gltfLoaderUrl'\s*=>\s*BCM_MINI_SIM_URL\s*\.\s*'assets\/js\/GLTFLoader\.js/);
  assert.match(gltfLoader, /THREE\.GLTFLoader = GLTFLoader/);
  assert.match(gltfLicense, /Copyright © 2010-2021 three\.js authors/);
  assert.match(gltfLoader, /SPDX-License-Identifier: MIT/);
  assert.ok(warp.includes('const asteroidWallCrystalAssetRoot = "mesh/twinsun_pack01/twinsun_pack01/parts/"'));
  assert.ok(warp.includes('asteroidWallCrystalAssetRoot + "rock_cluster.glb"'));
  assert.ok(warp.includes('const assetName = asteroidWallCrystalAssetRoot + "crystal_" + part + "_" + selectedColor + ".glb"'));
  for (const part of ["main", "side", "small"]) {
    assert.ok(warp.includes('getPart("' + part + '")'), "loads a separate " + part + " crystal");
  }
  for (const color of ["cyan", "violet", "amber", "green"]) {
    assert.ok(warp.includes('"' + color + '"') || warp.includes("'" + color + "'"), "supports " + color + " crystals");
  }
});

test("wall crystal placement uses an independent seeded stream and existing vertical side panels only", () => {
  const start = warp.indexOf("function attachAsteroidWallCrystals()");
  const end = warp.indexOf("attachAsteroidWallCrystals();", start);
  assert.ok(start >= 0 && end > start, "wall crystal placement helper exists");
  const source = warp.slice(start, end);
  assert.ok(source.includes('randomFrom(hashSeed(String(seed) + "|wall-crystal-layout"))'), "wall decorations use a separate deterministic seed");
  assert.doesNotMatch(source, /\brng\s*\(/, "decoration must not consume the maze RNG stream");
  assert.match(source, /walls\.forEach\(/);
  assert.match(source, /cell\.y !== 1/, "first test decorates only the normal middle layer");
  assert.match(source, /wall\.sy <= Math\.min\(wall\.sx, wall\.sz\)/, "floor and ceiling panels are excluded");
  assert.match(source, /endpoint\(cell, maze\.startCell\)/);
  assert.match(source, /endpoint\(cell, maze\.exitCell\)/);
  assert.match(source, /group\.add\(decorationGroup\)/);
  assert.match(source, /wall\.sy <= Math\.min\(wall\.sx, wall\.sz\)/);
  assert.doesNotMatch(source, /walls\.(?:push|splice|pop|sort)\(/, "the collision wall array is read-only");
  assert.doesNotMatch(source, /maze\.walls\s*=|maze\.satellites\s*=/);
  assert.match(source, /wallThickness \* 0\.5 - 0\.08/, "model base is embedded into the wall face");
  assert.match(source, /template\.clone\(true\)/);
  assert.match(source, /model\.quaternion\.copy\(placement\.quaternion\)/);
  assert.match(source, /const tangent = up\.clone\(\)\.cross\(inward\)\.normalize\(\)/);
  assert.match(source, /makeBasis\(tangent, up, inward\)/, "new pack local +Z growth axis points out from the wall");
  assert.match(source, /model\.scale\.setScalar\(placement\.scale\)/);
  assert.match(source, /const paletteOffset = Math\.floor\(placementRng\(\) \* asteroidWallCrystalColors\.length\)/);
  assert.match(source, /asteroidWallCrystalColors\[\(index \+ paletteOffset\) % asteroidWallCrystalColors\.length\]/, "four deposits cycle through all four colours");
  assert.match(source, /state\.maze !== maze/, "late loader callbacks cannot attach to a disposed maze");
});

test("GLTFLoader is lazy and its template is cached without disposing shared geometry", () => {
  assert.match(warp, /function ensureAsteroidGltfLoader\(THREE\)/);
  assert.match(warp, /if \(THREE && THREE\.GLTFLoader\) return Promise\.resolve/);
  assert.match(warp, /document\.createElement\("script"\)/);
  assert.match(warp, /function loadAsteroidWallCrystalTemplate\(THREE, color\)/);
  assert.match(warp, /function loadAsteroidWallRockTemplate\(THREE\)/);
  assert.match(warp, /asteroidWallCrystalTemplatePromises/);
  assert.match(warp, /asteroidWallCrystalPartPromises/);
  assert.match(warp, /const deposit = new THREE.Group\(\)/);
  assert.match(warp, /\[rock, main, side, small\]\.forEach/);
  assert.match(warp, /const crystalGlow = \{/);
  assert.match(warp, /copy\.emissiveIntensity = 0\.42/);
  const disposeStart = warp.indexOf("function disposeMaze()");
  const disposeEnd = warp.indexOf("function nextWarpDestinationLabel()", disposeStart);
  const dispose = warp.slice(disposeStart, disposeEnd);
  assert.match(dispose, /maze\.group\.parent\.remove\(maze\.group\)/);
  assert.doesNotMatch(dispose, /wallCrystalGroup[\s\S]{0,200}geometry\.dispose/);
});

test("standalone QA serves the GLB and exercises the actual asteroid scene with Chromium", () => {
  assert.match(standaloneRunner, /"\.glb"/);
  assert.match(standaloneRunner, /"\.glb": "model\/gltf-binary"/);
  assert.match(standaloneRunner, /extension === "glb" \? "model"/);
  assert.match(standaloneRunner, /gltfLoaderUrl:/);
  assert.match(localQa, /"\.glb":"model\/gltf-binary"/);
  assert.match(localQa, /BCMDeepSpaceWarpEnterAsteroid/);
  assert.match(localQa, /asteroid-wall-crystal-decorations/);
  assert.match(localQa, /GLB mineral deposits load as real meshes on asteroid wall panels/);
  assert.match(localQa, /07-asteroid-wall-crystal-closeup\.png/);
  assert.match(localQa, /inspection camera can render a mounted crystal without moving the ship/);
});
