import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Script } from "node:vm";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");
const [warp, mini, php, tower, towerPhp] = await Promise.all([
  read("mini-sim/assets/js/deep-space-warp.js"),
  read("mini-sim/assets/js/mini-sim.js"),
  read("mini-sim/bcm-mini-sim.php"),
  read("mini-sim/tower/assets/js/tower.js"),
  read("mini-sim/tower/bcm-tower.php")
]);

test("Hydrogen mission counter counts each unique shard once", () => {
  const start = mini.indexOf("function recordHydrogenShard(detail) {");
  const end = mini.indexOf("\n  window.BCMWorldMissionAPI =", start);
  assert.ok(start >= 0 && end > start, "authoritative mission recorder exists");
  const recorderSource = mini.slice(start, end);
  const events = [];
  const sandbox = {
    worldMission: {
      hydrogenUnlocked: true, medusaUnlocked: false, hydrogenCount: 0,
      hydrogenCollected: false, hydrogenCollectedIds: {}
    },
    window: { dispatchEvent: (event) => events.push(event) },
    CustomEvent: class { constructor(type, options = {}) { this.type = type; this.detail = options.detail || {}; } },
    interfaceLanguage: "en",
    labyrinthSeed: 909,
    updateHydrogenMissionLabel: () => {},
    showOperatorDialog: () => {}
  };
  const record = new Script(recorderSource + "\nrecordHydrogenShard;").runInNewContext(sandbox);
  const shard = (crystalId, x) => ({
    crystalId, asteroidSeed: 909, cell: { x, y: 1, z: 0 }, type: "asteroid-crystal"
  });
  record(shard("909:0,1,0", 0));
  assert.equal(sandbox.worldMission.hydrogenCount, 1);
  record(shard("909:0,1,0", 0));
  assert.equal(sandbox.worldMission.hydrogenCount, 1, "duplicate IDs must not increment Hydrogen");
  record(shard("909:1,1,0", 1));
  record(shard("909:2,1,0", 2));
  assert.equal(sandbox.worldMission.hydrogenCount, 3);
  assert.equal(sandbox.worldMission.hydrogenCollected, true);
  assert.equal(sandbox.worldMission.medusaUnlocked, true);
  assert.ok(events.some((event) => event.type === "bcm:mission:medusa-unlocked"));
});

test("Ring route-crystal state is independent from flight pickups and HUD reads mission count", () => {
  assert.match(warp, /const routeCrystals = \(maze\.crystals \|\| \[\]\)\.filter\(\(crystal\) => crystal && crystal\.cell\)\.map/);
  assert.match(warp, /taken: !!routeMission\.hydrogenCollectedIds\?\.\[id\]/);
  assert.match(warp, /objectiveNode, routeCrystals/);
  const start = warp.indexOf("function collectRouteCrystal(player)");
  const end = warp.indexOf("function collectAt(player)", start);
  const collect = warp.slice(start, end);
  assert.match(collect, /path\.routeCrystals/);
  assert.match(collect, /if \(!mission\.hydrogenUnlocked \|\| Number\(mission\.hydrogenCount \|\| 0\) >= 3\) return false/);
  assert.match(collect, /crystalId: crystal\.id/);
  assert.match(collect, /const count = Number\(window\.BCMWorldMission\?\.hydrogenCount \|\| 0\)/);
  assert.match(collect, /"HYDROGEN " \+ count \+ "\/3/);
  assert.match(warp, /\(path\.routeCrystals \|\| \[\]\)\.length \|\| !path\.hydrogenMesh/);
});

test("Ring jump is not a floor transition; E/R and gamepad LB have separate actions", () => {
  assert.match(warp, /const oneShotActions = new Set\(\["activate", "dash", "floor"\]\)/);
  assert.match(warp, /if \(action === "floor"\)/);
  assert.match(warp, /const preferred = player\.ringFloorDirection \|\|/);
  assert.match(warp, /const p1Floor = event\.code === "KeyR"/);
  assert.match(warp, /const p2Floor = event\.code === "KeyI"/);
  assert.match(warp, /statePad\.floor = !!button\(4\)/);
  assert.match(warp, /if \(statePad\.floor && !previousPad\[i\]\.floor\) triggerAction\(i, "floor"\)/);
  assert.match(warp, /data-ring-action="floor"/);
  assert.doesNotMatch(warp, /const verticalDirection = input\.down \? "yn" : "yp"/);
  assert.match(warp, /Space \/ W only jumps/);
});

test("Room 2 central return opening is passable without making side walls noclip", () => {
  assert.match(mini, /const centralFrontOpening = !!frontPoint &&[\s\S]{0,160}Math\.abs\(frontPoint\.x\) <= room\.xEdge - 0\.15[\s\S]{0,100}Math\.abs\(frontPoint\.y\) <= room\.yEdge - 0\.05/);
  assert.match(mini, /if \(pointOnCap\(frontPoint, room\) && !centralFrontOpening\)/);
  assert.match(mini, /const throughCentralReturn = crossingT >= 0 && crossingT <= 1 &&[\s\S]{0,150}Math\.abs\(crossingX\) <= 5\.85 && Math\.abs\(crossingY\) <= 3\.45/);
  assert.match(mini, /if \(crossedFront && inCorridorMouth && !centralFrontOpening\)/);
  assert.match(mini, /function pointOnSideWall\(point, room\)/);
});

test("Warp preserves 22 randomized obstacle layers and uses the faster shared 12x curve", () => {
  const start = warp.indexOf("const courseLayerCount = 22");
  const end = warp.indexOf("tubeTitle.textContent", start);
  assert.ok(start >= 0 && end > start, "22-layer Warp course exists");
  const create = warp.slice(start, end);
  assert.match(create, /const typeRoll = rng\(\)/);
  assert.match(create, /typeRoll < 0\.34 \? "gate"/);
  assert.match(create, /typeRoll < 0\.55 \? "sweeper"/);
  assert.match(create, /typeRoll < 0\.70 \? "spikes"/);
  assert.match(create, /typeRoll < 0\.86 \? "boost" : "launcher"/);
  assert.match(create, /gapHalf: type === "gate" \? 0\.94 : 0\.86/);
  assert.match(warp, /const t = Math\.pow\(warpNormalizedTime\(elapsed\), 0\.82\)/);
  assert.match(warp, /return Math\.pow\(12, t\)/);
  assert.match(warp, /return \(warpSpeedMultiplier\(elapsed\) - 1\) \/ 11/);
  assert.match(warp, /Math\.max\(1, Math\.min\(12,/);
  assert.match(warp, /state\.tubeTravel \+= dt \* speed \* 1\.48/);
});

test("Tower Panda dialogue describes real controls and the descent objective", () => {
  assert.match(mini, /Башня: A\/D — движение по площадке; W\/S — смещение; Space — прыжок; E — действие; R — новый спуск/);
  assert.match(mini, /Цель — добраться до низа/);
  assert.match(mini, /Tower: A\/D move around the platform; W\/S shift; Space jumps; E acts; R starts a new descent/);
  assert.match(mini, /Tower: left stick moves\/shifts; A jumps; X acts; Y starts a new descent/);
  assert.match(tower, /ПОРА СПУСТИТЬСЯ ВНИЗ/);
  assert.match(tower, /ОСТОРОЖНО: ПАДЕНИЕ НА 5 ПРОЛЁТОВ — ВОЗВРАТ В НАЧАЛО/);
});

test("Hidden Tower does not steal Ring's R floor action", () => {
  assert.match(tower, /function towerInputSuppressed\(\) \{[\s\S]*?bcm-ring-platformer[\s\S]*?bcm-ring-transition/);
  const keydownStart = tower.indexOf('window.addEventListener("keydown", (event) => {');
  const keyupStart = tower.indexOf('window.addEventListener("keyup", (event) => {');
  assert.ok(keydownStart >= 0 && keyupStart > keydownStart);
  const keydown = tower.slice(keydownStart, keyupStart);
  const keyupEnd = tower.indexOf('window.addEventListener("blur"', keyupStart);
  assert.ok(keyupEnd > keyupStart);
  const keyup = tower.slice(keyupStart, keyupEnd);
  assert.match(keydown, /if \(towerInputSuppressed\(\)\)/);
  assert.ok(keydown.indexOf("towerInputSuppressed()") < keydown.indexOf('if (event.code === "KeyR")'));
  assert.match(keyup, /if \(towerInputSuppressed\(\)\)/);
});

test("Mini-Sim 0.11.21 and Tower 0.2.67 versions agree across PHP and UI", () => {
  assert.match(php, /Version: 0\.11\.21/);
  assert.match(php, /define\('BCM_MINI_SIM_VERSION', '0\.11\.21'\)/);
  assert.match(php, /SPACE LABYRINTH — 0\.11\.21/);
  assert.match(mini, /КОСМИЧЕСКИЙ ЛАБИРИНТ — 0\.11\.21/);
  assert.match(mini, /SPACE LABYRINTH — 0\.11\.21/);
  assert.match(towerPhp, /define\('BCM_TOWER_VERSION', '0\.2\.67'\)/);
  assert.match(tower, /const TOWER_VERSION = "0\.2\.67"/);
});
