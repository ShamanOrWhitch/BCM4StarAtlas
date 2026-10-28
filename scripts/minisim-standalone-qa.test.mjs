import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const repoRoot = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, repoRoot), "utf8");

test("standalone shell mirrors the shortcode contract required by Mini-Sim and Tower", async () => {
  const shell = await read("tools/minisim-qa/standalone-shell.html");
  const mini = await read("mini-sim/bcm-mini-sim.php");
  const tower = await read("mini-sim/tower/bcm-tower.php");
  for (const token of [
    'class="bcm-mini-sim"', 'class="bcm-mini-sim-canvas"', 'class="bcm-mini-sim-start"',
    'class="bcm-mini-sim-crew-preflight"', 'data-crew-slots', 'data-crew-start',
    'class="bcm-mini-sim-music-audio"', 'class="bcm-mini-sim-transition-video"',
    'class="bcm-tower bcm-tower-embedded"', 'class="bcm-tower-canvas"',
    'data-tower-mode="single"', 'class="bcm-tower-transition-video"'
  ]) {
    assert.ok(shell.includes(token), "standalone fixture contains " + token);
  }
  assert.ok(mini.includes('class="bcm-mini-sim"'));
  assert.ok(mini.includes('data-crew-start'));
  assert.ok(tower.includes('class="bcm-tower'));
  assert.ok(shell.includes("__BCM_MINI_SIM_CONFIG__"));
  assert.ok(shell.includes("__BCM_TOWER_CONFIG__"));
});

test("standalone runner preserves actual repository media and writes an explicitly scoped report", async () => {
  const runner = await read("scripts/minisim-standalone-qa.mjs");
  assert.match(runner, /createServer/);
  assert.match(runner, /scanAssets/);
  assert.match(runner, /crew-roster\.json/);
  assert.match(runner, /mini-sim\/assets/);
  assert.match(runner, /towerConfig/);
  assert.match(runner, /targetType = "standalone repository build/);
  assert.match(runner, /wpIntegrationVerified = false/);
  assert.match(runner, /scripts\/minisim-local-qa\.mjs/);
});

test("standalone browser QA workflow runs Playwright and uploads its report", async () => {
  const workflow = await read(".github/workflows/minisim-standalone-browser-qa.yml");
  assert.match(workflow, /workflow_dispatch/);
  assert.match(workflow, /npm run qa:minisim:standalone/);
  assert.match(workflow, /upload-artifact/);
  assert.match(workflow, /\.qa-artifacts/);
});


test("browser QA uses an explicit Tube result/cancel contract rather than Escape during active flight", async () => {
  const runner = await read("scripts/minisim-local-qa.mjs");
  assert.match(runner, /\[data-tube-abort\].*state:"visible",timeout:55000/);
  assert.match(runner, /Tube reaches its result screen and exposes the explicit cancel action/);
  assert.match(runner, /\[data-tube-abort\]"\)\.click\(\)/);
  assert.doesNotMatch(runner, /keyboard\.press\("Escape"\);await page\.waitForFunction\(\(\)=>!!document\.querySelector\("\.bcm-warp-overlay\[hidden\]"\)/);
});

test("standalone QA report labels its fixture honestly instead of calling it WordPress", async () => {
  const runner = await read("scripts/minisim-local-qa.mjs");
  assert.match(runner, /standalone\?"Standalone QA fixture responds successfully":"WordPress page responds successfully"/);
  assert.match(runner, /standalone\?"Mini-Sim fixture root is present":"Mini-Sim shortcode is present"/);
});


test("full Ring/Tower playthrough uses opt-in read-only telemetry and live game controls", async () => {
  const local = await read("scripts/minisim-local-qa.mjs");
  const journey = await read("scripts/minisim-ring-tower-playthrough.mjs");
  const warp = await read("mini-sim/assets/js/deep-space-warp.js");
  const tower = await read("mini-sim/tower/assets/js/tower.js");
  const standalone = await read("scripts/minisim-standalone-qa.mjs");
  assert.match(local, /argv\.includes\("--ring-tower"\)/);
  assert.match(local, /window\.__BCM_QA_ENABLED=!!qaEnabled/);
  assert.doesNotMatch(local, /requestPointerLock=function/);
  const mini = await read("mini-sim/assets/js/mini-sim.js");
  assert.match(mini, /window\.__BCM_QA_ENABLED === true/);
  assert.match(mini, /const hands = touchDevice \|\| pointerLocked \|\| pointerLockBlocked \|\| padLive \|\|/);
  assert.match(local, /runRingTowerPlaythrough\(\{page,report,shot\}\)/);
  assert.match(standalone, /"--ring-tower"/);
  assert.match(journey, /pilotFlightWaypoint/);
  assert.match(journey, /BCMDeepSpaceWarpQA/);
  assert.match(journey, /BCMTowerAPI\?\.getQAState/);
  assert.match(journey, /data-ring-single/);
  assert.match(journey, /data-tower-mode="single"/);
  assert.match(journey, /Flight physics reaches the Tower gate from ONI CSS without teleporting/);
  assert.match(warp, /if \(window\.__BCM_QA_ENABLED === true\)/);
  assert.match(warp, /window\.BCMDeepSpaceWarpQA = function/);
  assert.match(tower, /window\.BCMTowerAPI\.getQAState = \(\) =>/);
  assert.match(tower, /if \(window\.__BCM_QA_ENABLED === true\)/);
});
