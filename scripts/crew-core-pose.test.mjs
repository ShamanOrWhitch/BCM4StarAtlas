// WORK LOCK #117: crew-core assembles the Crew — facing (BUG-001) and the walking
// rig. Levels pass direction and dt only.
// CREW_CORE_SOURCE=<file> runs the behaviour tests against another crew-core
// (used to show the red state on the previous commit).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const read = (p) => readFile(new URL(`../${p}`, import.meta.url), "utf8");
const coreSource = () => (process.env.CREW_CORE_SOURCE ? readFile(process.env.CREW_CORE_SOURCE, "utf8") : read("mini-sim/assets/js/crew-core.js"));

async function loadCore({ clock = { now: 0 } } = {}) {
  const window = {};
  const context = vm.createContext({ window, console, Math, Number, String, Array, Map, Set, Promise, Error, Object, JSON, performance: { now: () => clock.now } });
  window.globalThis = window;
  // crew-rig attaches to globalThis; crew-core reads window.BCMCrewRig.
  vm.runInContext(await read("mini-sim/assets/js/crew-rig.js"), context);
  window.BCMCrewRig = context.BCMCrewRig;
  vm.runInContext(await coreSource(), context);
  return { core: window.BCMCrewCore, clock };
}

function sprite() {
  return { scale: { x: 1.2, y: 1.8 }, position: { y: 0 }, material: { rotation: 0, map: { repeat: { x: 1 }, offset: { x: 0 } } }, userData: {} };
}

const crew = (species, sex = "Male") => ({ species, sex, image: "" });

test("crew-rig.js: valid poses for every race and sex (Dr Fable selfTest)", async () => {
  const context = vm.createContext({});
  vm.runInContext(await read("mini-sim/assets/js/crew-rig.js"), context);
  assert.equal(JSON.stringify(context.BCMCrewRig.selfTest()), "[]");
});

test("BUG-001: Ring/Hull mirror Mierese and other races differently, like Tower", async () => {
  const { core } = await loadCore();
  const flip = (species, facing) => {
    const s = sprite();
    core.applyPlatformSprite(s, { crew: crew(species), facing, moving: true, grounded: true, vy: 0, index: 0, y: 0 }, 1 / 60);
    return s.material.map.repeat.x;
  };
  // Tower rule (tower.js updatePlayerVisual): visualFacing = (right ? -1 : 1) * facingFactor.
  const tower = (species, facing) => ((facing > 0 ? -1 : 1) * core.facingFactor(species) < 0 ? -1 : 1);
  for (const species of ["Mierese", "Profound Punaab", "High Punaab", "Sogmian", "Ustur", "Human"]) {
    for (const facing of [1, -1]) {
      assert.equal(flip(species, facing), tower(species, facing), `${species} moving ${facing > 0 ? "right" : "left"} is mirrored unlike Tower`);
    }
  }
  assert.notEqual(flip("Mierese", 1), flip("Profound Punaab", 1), "Mierese and Punaab flip the same way (BUG-001)");
});

test("walk phase comes from dt: a paused frame holds the pose whatever the clock says", async () => {
  const { core, clock } = await loadCore();
  const s = sprite();
  const actor = { crew: crew("Ustur"), facing: 1, moving: true, grounded: true, vy: 0, index: 0, y: 0 };
  core.applyPlatformSprite(s, actor, 0.1);
  const before = [s.material.rotation, s.scale.x, s.scale.y, s.position.y];
  clock.now += 777;
  core.applyPlatformSprite(s, actor, 0);
  assert.deepEqual([s.material.rotation, s.scale.x, s.scale.y, s.position.y], before, "pose moved with performance.now() while dt = 0");
  core.applyPlatformSprite(s, actor, 0.12);
  assert.notDeepEqual([s.material.rotation, s.scale.x, s.scale.y, s.position.y], before, "pose did not advance with dt");
});

test("walk cadence is the rig's: idle breathes slower than walking, races differ", async () => {
  const { core } = await loadCore();
  const phaseAfter = (species, moving) => {
    const state = {};
    core.crewSpritePose({ crew: crew(species), facing: 1, moving, grounded: true, vy: 0, index: 0 }, 0.5, state);
    return state.bcmWalkPhase;
  };
  assert.ok(phaseAfter("Ustur", false) < phaseAfter("Ustur", true), "idle advances as fast as walking");
  assert.notEqual(phaseAfter("Profound Punaab", true), phaseAfter("Human", true), "Punaab and Human walk at the same cadence");
  const pose = core.crewSpritePose({ crew: crew("Human"), facing: 1, moving: true, index: 0 }, 0.01, {}).pose;
  assert.ok(pose && Number.isFinite(pose.spreadL), "rig pose (legs) is exposed for the leg split");
});

test("levels only pass direction and dt; crew-rig loads before crew-core everywhere", async () => {
  const tower = await read("mini-sim/tower/assets/js/tower.js");
  const visual = tower.slice(tower.indexOf("function updatePlayerVisual("), tower.indexOf("function updateCamera("));
  assert.match(visual, /function updatePlayerVisual\(index, dt\)/);
  assert.match(visual, /window\.BCMCrewCore\.crewSpritePose\(/);
  assert.doesNotMatch(visual, /performance\.now\(\) \* motion\.speed/, "Tower still drives the walk from the wall clock");
  assert.doesNotMatch(tower, /updatePlayerVisual\(1\);\s*\}/, "player 2 is posed twice per frame");
  const warp = await read("mini-sim/assets/js/deep-space-warp.js");
  assert.match(warp, /function updatePlayerSprite\(player, dt\)/);
  assert.match(warp, /applyPlatformSprite\(player\.sprite, \{[\s\S]{0,400}\}, dt\)/);
  const hull = await read("mini-sim/assets/js/hull-dive.js");
  assert.match(hull, /applyPlatformSprite\(player\.sprite, \{[\s\S]{0,400}\}, dt\)/);
  const core = await read("mini-sim/assets/js/crew-core.js");
  assert.doesNotMatch(core, /performance\.now\(\)/, "crew-core still reads the wall clock");

  const miniPhp = await read("mini-sim/bcm-mini-sim.php");
  assert.match(miniPhp, /wp_enqueue_script\('bcm-crew-rig', BCM_MINI_SIM_URL \. 'assets\/js\/crew-rig\.js'/);
  assert.match(miniPhp, /wp_enqueue_script\('bcm-crew-core', [^;]*array\('bcm-crew-rig'\)/);
  const towerPhp = await read("mini-sim/tower/bcm-tower.php");
  assert.match(towerPhp, /'bcm-crew-rig',\s*plugins_url\('assets\/js\/crew-rig\.js'/, "Tower plugin does not enqueue crew-rig");
  assert.match(towerPhp, /'bcm-crew-core',\s*plugins_url\('assets\/js\/crew-core\.js'[^;]*array\('bcm-crew-rig'\)/, "Tower plugin: crew-core does not depend on crew-rig");
  assert.match(towerPhp, /BCM_TOWER_URL \. 'assets\/js\/tower\.js',\s*array\('bcm-crew-core'\)/, "tower.js does not depend on crew-core");
  const shell = await read("tools/minisim-qa/standalone-shell.html");
  assert.ok(shell.indexOf("crew-rig.js") > 0 && shell.indexOf("crew-rig.js") < shell.indexOf("crew-core.js"), "standalone shell does not load crew-rig before crew-core");
});
