import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => readFileSync(resolve(root, name), "utf8");
const php = read("mini-sim/bcm-mini-sim.php");
const flight = read("mini-sim/assets/js/mini-sim.js");
const hull = read("mini-sim/assets/js/hull-dive.js");
const warp = read("mini-sim/assets/js/deep-space-warp.js");
const audit = read("mini-sim/assets/js/ui-layer-audit.js");

assert.match(php, /Version: 0\.11\.11/);
assert.match(php, /define\('BCM_MINI_SIM_VERSION', '0\.11\.11'\)/);
assert.match(php, /bcm-ui-layer-audit/);
assert.match(flight, /showUnderlyingScene = !externalPause[\s\S]{0,180}bcm-hull-interior-active/);
assert.match(hull, /let pilotMode = true/);
assert.match(hull, /\.sort\(\(a, b\) => a\.index - b\.index\)/);
assert.match(hull, /width:min\(450px,44vw\);height:min\(345px,40vh\)/);
assert.match(warp, /document\.body\.appendChild\(hullEnterButton\)/);
assert.match(warp, /document\.body\.appendChild\(ringEnterButton\)/);
assert.doesNotMatch(warp, /root\.appendChild\(hullEnterButton\)/);
assert.match(warp, /z-index:1001200[\s\S]{0,150}pointer-events:auto/);
assert.match(warp, /data-ring-single/);
assert.match(warp, /button\.style\.pointerEvents = "auto"/);
assert.match(warp, /ENTER RING LABYRINTH/);
assert.match(warp, /ringDistance >= 18/);
assert.match(warp, /ringPressed && state\.mode === "maze"/);
assert.match(warp, /transitionWatchdog = window\.setTimeout/);
assert.match(audit, /document\.elementFromPoint/);
assert.match(audit, /partially-covered/);
assert.match(audit, /getLastReport/);
assert.match(audit, /event\.ctrlKey[\s\S]{0,80}event\.altKey[\s\S]{0,80}KeyU/);

console.log("PASS Mini-Sim 0.11.11 UI layer regressions: pilot view, helm default, gamepad assignment, Ring entry and hit testing.");