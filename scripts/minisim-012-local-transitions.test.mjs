import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("Mini-Sim 0.12.0 and Tower 0.2.69 versions stay synchronized", async () => {
  const miniPhp = await read("mini-sim/bcm-mini-sim.php");
  const miniJs = await read("mini-sim/assets/js/mini-sim.js");
  const towerPhp = await read("mini-sim/tower/bcm-tower.php");
  const towerJs = await read("mini-sim/tower/assets/js/tower.js");
  assert.match(miniPhp, /Version: 0\.12\.0/);
  assert.match(miniPhp, /BCM_MINI_SIM_VERSION\', \'0\.12\.0\'/);
  assert.match(miniJs, /SPACE LABYRINTH — 0\.12\.0/);
  assert.match(towerPhp, /BCM_TOWER_VERSION\', \'0\.2\.69\'/);
  assert.match(towerJs, /const TOWER_VERSION = "0\.2\.69"/);
});

test("one persistent local session derives independent deterministic location seeds", async () => {
  const mini = await read("mini-sim/assets/js/mini-sim.js");
  const seed = await read("mini-sim/tower/first-planet/src/game/seed.ts");
  assert.match(mini, /function deriveLocalLocationSeed\(baseSeed, label\)/);
  assert.match(mini, /localOnly: true/);
  assert.match(mini, /spaceLabyrinth: labyrinthSeed/);
  assert.match(mini, /warp: deriveLocalLocationSeed\(labyrinthSeed, "warp"\)/);
  assert.match(mini, /asteroid: deriveLocalLocationSeed\(labyrinthSeed, "asteroid"\)/);
  assert.match(mini, /ring: deriveLocalLocationSeed\(labyrinthSeed, "ring"\)/);
  assert.match(mini, /firstPlanet: deriveLocalLocationSeed\(labyrinthSeed, "first-planet"\)/);
  assert.match(mini, /shoalRace: deriveLocalLocationSeed\(labyrinthSeed, "first-planet\|shoal-race"\)/);
  assert.match(seed, /export function deriveLocationSeed\(sessionSeed: number, locationId: string\)/);
  assert.match(seed, /export function createSeededRandom\(seed: number, salt = ""\)/);
  assert.match(seed, /export function seededShuffle/);
  const warp = await read("mini-sim/assets/js/deep-space-warp.js");
  assert.match(warp, /const warpRun = Number\(runCounters\.warp \|\| 0\) \+ 1/);
  assert.match(warp, /const warpBaseSeed = Number\.isSafeInteger\(Number\(locationSeeds\.warp\)\)/);
  assert.match(warp, /localSession\.activeSeeds\.warp = warpRunSeed/);
  assert.match(warp, /const asteroidRun = Number\(runCounters\.asteroid \|\| 0\) \+ 1/);
  assert.match(warp, /const asteroidBaseSeed = Number\.isSafeInteger\(Number\(locationSeeds\.asteroid\)\)/);
  assert.match(warp, /localSession\.activeSeeds\.asteroid = seed/);
});

test("Tower returns through the original same-seed layout from bottom to top", async () => {
  const tower = await read("mini-sim/tower/assets/js/tower.js");
  assert.match(tower, /window\.BCMTowerAPI\.beginAscent = \(options = \{\}\) =>/);
  assert.match(tower, /const wantedSeed = Number\(options\.seed \?\? window\.BCMWorldMission\?\.towerSeed \?\? seed\)/);
  assert.match(tower, /ascentMode = true/);
  assert.match(tower, /buildTower\(wantedSeed >>> 0\)/);
  assert.match(tower, /const startLevel = ascentMode \? 0 : tower\.levels - 1/);
  assert.match(tower, /const topSector = ascentMode \? tower\.path\[tower\.path\.length - 1\] : tower\.path\[0\]/);
  assert.match(tower, /const reachedExit = ascentMode \? p\.y > topY \+ 4\.2 : p\.y < bottomY - 4\.2/);
  assert.match(tower, /ВОСХОЖДЕНИЕ · ТОТ ЖЕ SEED/);
  assert.match(tower, /window\.BCMWorldMission\.towerSeed = seed/);
  assert.match(tower, /window\.BCMMiniSimSession\.locationSeeds\.tower = seed/);
  assert.match(tower, /const sessionTowerSeed = Number\(window\.BCMWorldMission\?\.towerSeed \?\?/);
  assert.match(tower, /buildTower\(initialTowerSeed\)/);
  assert.match(tower, /function startNewTower\(\) \{\s*if \(!gameStarted\) return;\s*ascentMode = false/);
});

test("Tower reverse ONICSS transition reuses the existing landing clip and has a seek fallback", async () => {
  const tower = await read("mini-sim/tower/assets/js/tower.js");
  const loader = await read("mini-sim/tower/first-planet/loader.js");
  assert.match(tower, /function beginReverseSpaceLabyrinthReturn\(\)/);
  assert.match(tower, /const url = String\(CONFIG\.planetTransition \|\| ""\)/);
  assert.match(tower, /transitionVideo\.playbackRate = -1/);
  assert.match(tower, /transitionVideo\.currentTime - dt/);
  assert.match(tower, /bcm:tower:space-return/);
  assert.match(loader, /bcm:tower:space-return/);
  assert.match(loader, /window\.location\.reload\(\)/);
});

test("First Planet is a seeded local location with a walk-up same-seed Tower gate", async () => {
  const terrain = await read("mini-sim/tower/first-planet/src/game/island/terrain.ts");
  const island = await read("mini-sim/tower/first-planet/src/game/island/sim.ts");
  const scene = await read("mini-sim/tower/first-planet/src/game/island/scene.ts");
  const component = await read("mini-sim/tower/first-planet/src/components/desert-island.tsx");
  const loader = await read("mini-sim/tower/first-planet/loader.js");
  assert.match(terrain, /export const TOWER_GATE =/);
  assert.match(island, /export function createSim\(seed = 0\)/);
  assert.match(island, /const storageKey = locationSeed \? SAVE_KEY \+ "-"/);
  assert.match(island, /this\.towerEnter = true/);
  assert.match(island, /E — войти в Tower/);
  assert.match(scene, /createSim\(Number\(context\.planetSeed\) >>> 0\)/);
  assert.match(scene, /TOWER · ВХОД/);
  assert.match(component, /next\.towerEnter/);
  assert.match(loader, /api\.unmount\(mount\)/);
  assert.match(loader, /towerApi\.beginAscent\(/);
  assert.match(loader, /seed: Number\(detail\.seed/);
});

test("Shoal Race receives its own seed without changing the established track route", async () => {
  const race = await read("mini-sim/tower/first-planet/src/game/sim.ts");
  const track = await read("mini-sim/tower/first-planet/src/game/track.ts");
  const component = await read("mini-sim/tower/first-planet/src/components/shoal-race.tsx");
  const embed = await read("mini-sim/tower/first-planet/src/first-planet-embed.tsx");
  assert.match(race, /export function createRace\(seed = 0\)/);
  assert.match(race, /layoutBoxes\(track, locationSeed\)/);
  assert.match(race, /createSeededRandom\(seed, "shoal-race-boxes"\)/);
  assert.match(track, /export function buildTrack\(seed = 0\)/);
  assert.match(component, /createRace\(raceSeed\)/);
  assert.match(embed, /<ShoalRace seed=\{Number\(context\.raceSeed\) >>> 0\}/);
});

test("First Planet soundtrack is optional, starts on a user gesture and survives island/race switching", async () => {
  const php = await read("mini-sim/tower/bcm-tower.php");
  const embed = await read("mini-sim/tower/first-planet/src/first-planet-embed.tsx");
  const component = await read("mini-sim/tower/first-planet/src/components/desert-island.tsx");
  assert.match(php, /bcm_tower_pick_asset\(\$assets, array\(\'FP\.mp3\'\), \'audio\'\)/);
  assert.match(php, /\'audioUrl\' => bcm_tower_pick_asset/);
  assert.match(embed, /const audioUrl = String\(context\.audioUrl \|\| ""\)/);
  assert.match(embed, /audio\.preload = "none"/);
  assert.match(embed, /const result = audio\.play\(\)/);
  assert.match(embed, /audio\.pause\(\)/);
  assert.match(component, /onStartAudioRef\.current\(\)/);
});

test("return snapshot preserves Crew, ship pose, mission, local seeds and internal repair compartments", async () => {
  const mini = await read("mini-sim/assets/js/mini-sim.js");
  const loader = await read("mini-sim/tower/first-planet/loader.js");
  assert.match(mini, /mission\.originShipSnapshot = snapshot/);
  assert.match(mini, /crew: Array\.isArray\(window\.BCMMiniCrewSelection\?\.players\)/);
  assert.match(mini, /hullRepair: \{/);
  assert.match(mini, /window\.BCMHullRepairState\?\.compartments/);
  assert.match(mini, /window\.BCMPrepareMiniSimReturn = \(\) =>/);
  assert.match(mini, /sessionStorage\.setItem\(LOCAL_RETURN_STORAGE_KEY/);
  assert.match(mini, /function restoreShipFromLocalReturn\(\)/);
  assert.match(mini, /function resumeLocalSessionAfterReturn\(\)/);
  assert.match(mini, /currentRepair\.compartments = JSON\.parse/);
  assert.match(mini, /BCMDeepSpaceWarpRestoreReturnSnapshot\(snapshot\.navigation\)/);
  const warp = await read("mini-sim/assets/js/deep-space-warp.js");
  assert.match(warp, /current: compactSector\(state\.nav\?\.current\)/);
  assert.match(warp, /targets: \(state\.nav\?\.targets \|\| \[\]\)\.map\(compactSector\)/);
  assert.match(warp, /window\.BCMDeepSpaceWarpRestoreReturnSnapshot = \(snapshot\) =>/);
  assert.match(warp, /state\.sectorProgressed = !!snapshot\.sectorProgressed/);
  assert.match(warp, /live: !!snapshot\.live && !!adapter && !!current\.raw/);
  assert.match(loader, /window\.BCMPrepareMiniSimReturn\(\)/);
});

test("0.12.0 package workflow builds and includes the First Planet WordPress bundle", async () => {
  const workflow = await read(".github/workflows/minisim-test-package.yml");
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /npm ci/);
  assert.match(workflow, /npm run build:wordpress/);
  assert.match(workflow, /first-planet\/wp-dist\/first-planet\.js/);
  assert.match(workflow, /first-planet\/wp-dist\/first-planet\.css/);
});
