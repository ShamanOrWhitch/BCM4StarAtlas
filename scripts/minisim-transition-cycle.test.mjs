import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("standalone transition-cycle Playwright runner is loopback-only and disables audio", async () => {
  const runner = await read("scripts/minisim-local-transitions-playwright.mjs");
  const standalone = await read("scripts/minisim-standalone-qa.mjs");
  const shell = await read("tools/minisim-qa/standalone-shell.html");
  assert.match(runner, /127\.0\.0\.1/);
  assert.match(runner, /audio requests are blocked/i);
  assert.match(runner, /requestUrl\.origin !== target\.origin/);
  assert.match(standalone, /--transitions-only/);
  assert.match(standalone, /const firstPlanetConfig/);
  assert.match(standalone, /audioUrl: transitionsOnly \? ""/);
  assert.match(shell, /__BCM_FIRST_PLANET_CONFIG__/);
  assert.match(shell, /bcm-first-planet-host/);
  assert.match(shell, /first-planet\/loader\.js/);
  assert.doesNotMatch(runner, /https:\/\/walkingyog\.com|https:\/\/raw\.githubusercontent\.com/i);
});

test("transition-cycle browser check is wired to the real Tower, First Planet and return contracts", async () => {
  const runner = await read("scripts/minisim-local-transitions-playwright.mjs");
  const mini = await read("mini-sim/assets/js/mini-sim.js");
  const tower = await read("mini-sim/tower/assets/js/tower.js");
  const loader = await read("mini-sim/tower/first-planet/loader.js");
  const warp = await read("mini-sim/assets/js/deep-space-warp.js");
  assert.match(runner, /BCMiniSimAPI\.teleport/);
  assert.match(runner, /BCMDeepSpaceWarpGetReturnSnapshot/);
  assert.match(runner, /bcm:tower:planet-ready/);
  assert.match(runner, /page\.keyboard\.press\("e"\)/);
  assert.match(runner, /currentLocation === "tower-ascent"/);
  assert.match(runner, /bcm:tower:space-return/);
  assert.match(runner, /page\.waitForNavigation/);
  assert.match(runner, /restored\.savedNavigationId === baseline\.navigationId/);
  assert.match(mini, /function captureArrivalShipSnapshot\(\)/);
  assert.match(mini, /window\.BCMPrepareMiniSimReturn = \(\) =>/);
  assert.match(mini, /function restoreShipFromLocalReturn\(\)/);
  assert.match(mini, /function resumeLocalSessionAfterReturn\(\)/);
  assert.match(tower, /window\.BCMTowerAPI\.beginAscent = \(options = \{\}\) =>/);
  assert.match(tower, /buildTower\(wantedSeed >>> 0\)/);
  assert.match(loader, /window\.BCMPrepareMiniSimReturn\(\)/);
  assert.match(loader, /window\.location\.reload\(\)/);
  assert.match(warp, /window\.BCMDeepSpaceWarpRestoreReturnSnapshot = \(snapshot\) =>/);
});
