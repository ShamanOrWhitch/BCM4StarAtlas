import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Script } from "node:vm";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");
const [warp, mini, php, tower] = await Promise.all([
  read("mini-sim/assets/js/deep-space-warp.js"),
  read("mini-sim/assets/js/mini-sim.js"),
  read("mini-sim/bcm-mini-sim.php"),
  read("mini-sim/tower/assets/js/tower.js")
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

test("Warp course contains distinct obstacle families and avoids repeated gate barriers", () => {
  const start = warp.indexOf("function buildWarpObstacleTypes(rng, count = 16)");
  const end = warp.indexOf("\n    function warpObstacleProgress", start);
  assert.ok(start >= 0 && end > start, "obstacle family selector exists");
  const helper = new Script(warp.slice(start, end) + "\nbuildWarpObstacleTypes;").runInNewContext({});
  for (let seed = 1; seed <= 12; seed += 1) {
    let state = seed;
    const rng = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    const types = Array.from(helper(rng, 16));
    assert.equal(types.length, 16);
    assert.deepEqual(Array.from(new Set(types)).sort(), ["boost", "gate", "launcher", "spikes", "sweeper"].sort());
    assert.equal(types.filter((type) => type === "gate").length, 2);
    for (let i = 1; i < types.length; i += 1) {
      assert.notEqual(types[i], types[i - 1], "adjacent obstacle families must differ");
      if (types[i] === "gate") assert.ok(!types.slice(Math.max(0, i - 2), i).includes("gate"));
    }
  }
  assert.match(warp, /gapHalf: type === "gate" \? 0\.94 : 0\.86/);
});

test("Tower Panda dialogue describes real controls and the descent objective", () => {
  assert.match(mini, /Башня: A\/D — движение по площадке; W\/S — смещение; Space — прыжок; E — действие; R — новый спуск/);
  assert.match(mini, /Цель — добраться до низа/);
  assert.match(mini, /Tower: A\/D move around the platform; W\/S shift; Space jumps; E acts; R starts a new descent/);
  assert.match(mini, /Tower: left stick moves\/shifts; A jumps; X acts; Y starts a new descent/);
  assert.match(tower, /ПОРА СПУСТИТЬСЯ ВНИЗ/);
  assert.match(tower, /ОСТОРОЖНО: ПАДЕНИЕ НА 5 ПРОЛЁТОВ — ВОЗВРАТ В НАЧАЛО/);
});

test("Mini-Sim 0.11.21 versions agree across PHP and UI", () => {
  assert.match(php, /Version: 0\.11\.21/);
  assert.match(php, /define\('BCM_MINI_SIM_VERSION', '0\.11\.21'\)/);
  assert.match(php, /SPACE LABYRINTH — 0\.11\.21/);
  assert.match(mini, /КОСМИЧЕСКИЙ ЛАБИРИНТ — 0\.11\.21/);
  assert.match(mini, /SPACE LABYRINTH — 0\.11\.21/);
});
