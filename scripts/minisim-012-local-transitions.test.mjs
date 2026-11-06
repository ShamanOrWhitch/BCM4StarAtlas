import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("Mini-Sim 0.12.3 and Tower 0.2.72 versions stay synchronized", async () => {
  const miniPhp = await read("mini-sim/bcm-mini-sim.php");
  const miniJs = await read("mini-sim/assets/js/mini-sim.js");
  const towerPhp = await read("mini-sim/tower/bcm-tower.php");
  const towerJs = await read("mini-sim/tower/assets/js/tower.js");
  assert.match(miniPhp, /Version: 0\.12\.3/);
  assert.match(miniPhp, /BCM_MINI_SIM_VERSION\', \'0\.12\.3\'/);
  assert.match(miniJs, /SPACE LABYRINTH — 0\.12\.3/);
  assert.match(towerPhp, /BCM_TOWER_VERSION\', \'0\.2\.72\'/);
  assert.match(towerJs, /const TOWER_VERSION = "0\.2\.72"/);
});

test("one persistent local session derives independent deterministic location seeds", async () => {
  const mini = await read("mini-sim/assets/js/mini-sim.js");
  const seed = await read("mini-sim/tower/first-planet/src/game/seed.ts");
  assert.match(mini, /function deriveLocalLocationSeed\(baseSeed, label\)/);
  const seedFactory = mini.slice(mini.indexOf("function makeLabyrinthSeed()"), mini.indexOf("const labyrinthSeed = makeLabyrinthSeed()"));
  assert.ok(seedFactory.indexOf("fromReturn") < seedFactory.indexOf("fromUrl"), "the saved session seed outranks the URL seed on a return");
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
  assert.match(tower, /function getSessionTowerSeed\(\)/);
  assert.match(tower, /const candidate = Number\(window\.BCMWorldMission\?\.towerSeed \?\?/);
  assert.match(tower, /buildTower\(getSessionTowerSeed\(\)\)/);
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

test("FP and Desert Race soundtracks are separate, optional and resume across location switches", async () => {
  const php = await read("mini-sim/tower/bcm-tower.php");
  const loader = await read("mini-sim/tower/first-planet/loader.js");
  const embed = await read("mini-sim/tower/first-planet/src/first-planet-embed.tsx");
  const island = await read("mini-sim/tower/first-planet/src/components/desert-island.tsx");
  const race = await read("mini-sim/tower/first-planet/src/components/shoal-race.tsx");
  assert.ok(php.includes("'firstPlanetAudio' => bcm_tower_pick_asset"));
  assert.ok(php.includes("'desertRaceAudio' => bcm_tower_pick_asset"));
  assert.ok(php.includes("'audioUrl' => bcm_tower_pick_asset"));
  assert.ok(php.includes("'raceAudioUrl' => bcm_tower_pick_asset"));
  assert.ok(php.includes("assets/FP.mp3"));
  assert.ok(php.includes("assets/desertrace.mp3"));
  assert.ok(loader.includes('audioUrl: config.audioUrl || ""'));
  assert.ok(loader.includes('raceAudioUrl: config.raceAudioUrl || ""'));
  assert.ok(embed.includes("const planetMusicRef = useRef"));
  assert.ok(embed.includes("const raceMusicRef = useRef"));
  assert.ok(embed.includes('audio.preload = "none"'));
  assert.ok(embed.includes("audio.loop = true"));
  assert.ok(embed.includes("const startPlanetMusic = () =>"));
  assert.ok(embed.includes("const startRaceMusic = () =>"));
  assert.ok(embed.includes("raceMusicRef.current?.pause()"));
  assert.ok(embed.includes("planetMusicRef.current?.pause()"));
  assert.ok(embed.includes("const leaveRace = () =>"));
  assert.ok(embed.includes("onStartAudio={startRaceMusic}"));
  assert.ok(race.includes("onStartAudio?.()"));
  assert.ok(island.includes("onStartAudioRef.current()"));
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

test("0.12.3 package workflow builds and includes the First Planet WordPress bundle", async () => {
  const workflow = await read(".github/workflows/minisim-test-package.yml");
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /npm ci/);
  assert.match(workflow, /npm run build:wordpress/);
  assert.match(workflow, /first-planet\/wp-dist\/first-planet\.js/);
  assert.match(workflow, /first-planet\/wp-dist\/first-planet\.css/);
  assert.match(workflow, /Require the committed First Planet bundle/);
});

test("Tower preloads First Planet during the descent and the bundle exports mount", async () => {
  const tower = await read("mini-sim/tower/assets/js/tower.js");
  const loader = await read("mini-sim/tower/first-planet/loader.js");
  const embed = await read("mini-sim/tower/first-planet/src/first-planet-embed.tsx");
  const vite = await read("mini-sim/tower/first-planet/vite.wordpress.config.ts");
  const start = tower.slice(tower.indexOf("function startMode(nextMode)"), tower.indexOf("function showMenu()"));
  assert.match(tower, /function queuePlanetPreload\(\)/);
  assert.match(start, /queuePlanetPreload\(\)/);
  assert.match(tower, /bcm:tower:planet-preload/);
  assert.match(loader, /context\.preload === true/);
  assert.match(loader, /BCMFirstPlanet\.setLive\(mount, true\)/);
  assert.match(embed, /export default api/);
  assert.match(embed, /setLive\(target: HTMLElement, live: boolean\)/);
  assert.match(vite, /external: \[\]/);
  assert.match(vite, /exports: "default"/);
});

test("Shoal Race populates the coastal course from the shared mesh library without changing race geometry", async () => {
  const world = await read("mini-sim/tower/first-planet/src/game/world.ts");
  const component = await read("mini-sim/tower/first-planet/src/components/shoal-race.tsx");
  const track = await read("mini-sim/tower/first-planet/src/game/track.ts");
  const vite = await read("mini-sim/tower/first-planet/vite.config.ts");
  assert.match(world, /new GLTFLoader\(\)/);
  assert.match(world, /meshLibraryBase\?: string/);
  assert.match(world, /mesh-library/);
  assert.match(world, /new THREE\.InstancedMesh\(source\.geometry, source\.material, fractions\.length\)/);
  assert.match(world, /createSeededRandom\(worldSeed, salt\)/);
  assert.match(world, /loadCoastalScenery\(track\)/);
  assert.match(world, /coastalRoot/);
  assert.match(world, /place\("lighthouse"/);
  assert.match(world, /place\("dock"/);
  assert.match(world, /scatter\("palm"/);
  assert.match(world, /scatter\("barrierRed"/);
  assert.match(component, /createWorld\(canvas, raceSeed\)/);
  assert.match(vite, /FIRST_PLANET_COASTAL_MESH_FILES/);
  assert.match(vite, /coastal_environment\/coastal_environment\/race_finish_gate\.glb/);
  assert.match(track, /halfWidth: 7\.4/);
  assert.match(world, /ROAD_Y/);

  const coastalBinaries = [
    "mini-sim/assets/mesh/coastal_environment/coastal_environment/lighthouse.glb",
    "mini-sim/assets/mesh/coastal_environment/coastal_environment/navigation_buoy_red.glb",
    "mini-sim/assets/mesh/coastal_environment/coastal_environment/palm_tree.glb",
    "mini-sim/assets/mesh/coastal_environment/coastal_environment/race_finish_gate.glb",
    "mini-sim/assets/mesh/coastal_pack02/coastal_pack02/shore_rocks.glb",
    "mini-sim/assets/mesh/coastal_pack02/coastal_pack02/sea_rock_arch.glb",
    "mini-sim/assets/mesh/coastal_pack02/coastal_pack02/dock_straight.glb",
    "mini-sim/assets/mesh/coastal_pack02/coastal_pack02/dock_platform.glb",
    "mini-sim/assets/mesh/coastal_pack02/coastal_pack02/barrier_sandstone.glb",
    "mini-sim/assets/mesh/coastal_pack02/coastal_pack02/barrier_redwhite.glb",
    "mini-sim/assets/mesh/coastal_pack02/coastal_pack02/buoy_yellow.glb",
    "mini-sim/assets/mesh/coastal_pack02/coastal_pack02/buoy_green.glb",
    "mini-sim/assets/mesh/coastal_pack02/coastal_pack02/small_sand_islet.glb",
    "mini-sim/assets/mesh/coastal_pack02/coastal_pack02/wooden_boat.glb",
    "mini-sim/assets/mesh/coastal_pack02/coastal_pack02/driftwood.glb",
  ];
  for (const path of coastalBinaries) {
    const data = await readFile(new URL(path, root));
    assert.ok(data.byteLength > 1000, path + " must be present as a real GLB");
  }
});

test("First Planet populates the desert from the shared nested mesh library without changing gameplay geometry", async () => {
  const scene = await read("mini-sim/tower/first-planet/src/game/island/scene.ts");
  const terrain = await read("mini-sim/tower/first-planet/src/game/island/terrain.ts");
  const bake = await read("mini-sim/tower/first-planet/src/game/island/bake.ts");
  const vite = await read("mini-sim/tower/first-planet/vite.config.ts");
  const towerPhp = await read("mini-sim/tower/bcm-tower.php");
  assert.ok(towerPhp.includes("'meshLibraryBase' => BCM_MINI_SIM_URL . 'assets/mesh/'"));
  assert.match(scene, /meshLibraryBase\?: string/);
  assert.match(scene, /file\.split\("\/"\)\.map\(\(part\) => encodeURIComponent\(part\)\)/);
  assert.match(scene, /mesh-library/);
  assert.match(scene, /\["desert_pack01\/cactus_tall\.glb", 2\.9, "y"\]/);
  assert.match(scene, /\["desert_oasis_pack\/desert_oasis_pack\/oasis_orchid_palms\.glb", 11\.8, "xz"\]/);
  assert.match(scene, /createSeededRandom\(planetSeed, salt\)/);
  assert.match(scene, /new THREE\.InstancedMesh/);
  assert.match(scene, /instances\.computeBoundingSphere\(\)/);
  assert.match(scene, /for \(let i = 0; i < desertRequests\.length; i \+= 4\)/);
  assert.match(scene, /desert-shrub-green/);
  assert.match(scene, /desert-race-banners/);
  assert.match(bake, /mergeGeometries\(parts, false\)/);
  assert.match(vite, /FIRST_PLANET_DESERT_MESH_FILES/);
  assert.match(vite, /mesh-library/);
  assert.match(vite, /relative\(root, file\)/);

  const binaries = [
    "mini-sim/assets/mesh/desert_pack01/cactus_tall.glb",
    "mini-sim/assets/mesh/desert_pack01/cactus_cluster.glb",
    "mini-sim/assets/mesh/desert_pack01/barrel_cactus_flower.glb",
    "mini-sim/assets/mesh/desert_pack01/sandstone_boulders.glb",
    "mini-sim/assets/mesh/desert_pack01/sandstone_arch.glb",
    "mini-sim/assets/mesh/desert_pack01/stepped_desert_temple.glb",
    "mini-sim/assets/mesh/desert_pack01/desert_market_awning.glb",
    "mini-sim/assets/mesh/desert_pack01/dead_desert_tree.glb",
    "mini-sim/assets/mesh/desert_pack01/small_oasis.glb",
    "mini-sim/assets/mesh/desert_pack01/sandstone_column.glb",
    "mini-sim/assets/mesh/desert_pack01/desert_race_banner.glb",
    "mini-sim/assets/mesh/desert_details/shrub_dry.glb",
    "mini-sim/assets/mesh/desert_details/shrub_green.glb",
    "mini-sim/assets/mesh/desert_details/shrub_sage.glb",
    "mini-sim/assets/mesh/desert_details/cairn_wide.glb",
    "mini-sim/assets/mesh/desert_details/cairn_tall.glb",
    "mini-sim/assets/mesh/desert_details/cactus_branching.glb",
    "mini-sim/assets/mesh/desert_details/rocks_gray.glb",
    "mini-sim/assets/mesh/desert_oasis_pack/desert_oasis_pack/oasis_orchid_palms.glb",
    "mini-sim/assets/mesh/desert_oasis_pack/desert_oasis_pack/oasis_flower_garden.glb",
    "mini-sim/assets/mesh/desert_oasis_pack/desert_oasis_pack/rare_turquoise_bloom.glb",
    "mini-sim/assets/mesh/desert_oasis_pack/desert_oasis_pack/orchid_pink.glb",
    "mini-sim/assets/mesh/desert_oasis_pack/desert_oasis_pack/orchid_white.glb",
  ];
  for (const path of binaries) {
    const data = await readFile(new URL(path, root));
    assert.ok(data.byteLength > 1000, path + " must be present as a real GLB");
  }

  const scenery = scene.slice(scene.indexOf("// The village square"), scene.indexOf("isle.geometry.computeBoundingBox"));
  assert.doesNotMatch(scenery, /sim\.walls|houseAabbs|collision/);
  assert.match(terrain, /export const TOWER_GATE =/);
  assert.match(terrain, /export const CRYSTALS =/);
});

