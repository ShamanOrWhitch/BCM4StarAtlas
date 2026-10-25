import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");
const [mini, warp, hull, css, php, qa, browserWorkflow, regressionWorkflow] = await Promise.all([
  read("mini-sim/assets/js/mini-sim.js"),
  read("mini-sim/assets/js/deep-space-warp.js"),
  read("mini-sim/assets/js/hull-dive.js"),
  read("mini-sim/assets/css/mini-sim.css"),
  read("mini-sim/bcm-mini-sim.php"),
  read("scripts/minisim-local-qa.test.mjs"),
  read(".github/workflows/minisim-browser-qa.yml"),
  read(".github/workflows/minisim-regression.yml")
]);

test("RU/EN menu and Enter language toggle are wired to a persistent selection", () => {
  assert.match(mini, /const uiText = \{\s*ru:/);
  assert.match(mini, /en:\s*\{/);
  assert.match(mini, /data-language-option="ru"/);
  assert.match(mini, /data-language-option="en"/);
  assert.match(mini, /localStorage\.setItem\("bcm-mini-sim-language", language\)/);
  assert.match(mini, /if \(!running\)\s*\{\s*setInterfaceLanguage\(interfaceLanguage === "ru" \? "en" : "ru"\)/);
  assert.match(mini, /applyLanguage\(\)/);
});

test("Panda dialogue carries flight and Warp controls without a separate right-side panel", () => {
  assert.match(mini, /id = "bcm-comic-dialogs"/);
  assert.match(mini, /data-dialog-box="operator"/);
  assert.doesNotMatch(mini, /data-dialog-box="controls"|bcm-comic-dialog-controls/);
  assert.match(mini, /window\.BCMDialogue = \{/);
  assert.match(mini, /showControls\("flight"\)/);
  assert.match(mini, /showControls\("tower"\)/);
  assert.match(warp, /showControls\("ring"\)/);
  assert.match(warp, /showControls\("hull"\)/);
  assert.match(warp, /showControls\("warp"\)/);
  assert.match(mini, /WASD — полёт; U — трюм/);
  assert.match(mini, /колёсико \(среднюю кнопку\), чтобы освободить курсор/);
  assert.match(mini, /V — открыть карту; на геймпаде — Y/);
  assert.match(mini, /START WARP/);
  assert.match(mini, /showOperatorDialog\("ПАНДА", message, null, "panda\.mp4"\)/);
  assert.match(css, /\.bcm-comic-dialog-operator/);
  assert.doesNotMatch(css, /\.bcm-comic-dialog-controls/);
  assert.match(css, /width:min\(720px,calc\(72vw - 18px\)\)/);
  assert.match(css, /width:min\(640px,calc\(100vw - 16px\)\)/);
  assert.match(css, /\.bcm-comic-dialog-avatar\{display:flex;flex:0 0 36px/);
  assert.match(css, /\.bcm-mini-sim\.game-active \.bcm-mini-sim-hud[\s\S]*?visibility:hidden/);
});

test("Crew chooser displays the selected image and uses wider cards with visible character portraits", () => {
  assert.match(mini, /crew\?\.image[\s\S]*?bcm-mini-sim-crew-slot-image/);
  assert.match(css, /width: min\(94vw, 900px\)/);
  assert.match(css, /\.bcm-mini-sim-crew-slot-image\{[\s\S]*?width:70px[\s\S]*?height:70px[\s\S]*?object-fit:contain/);
  assert.match(css, /\.bcm-mini-sim-crew-slot-card\{[\s\S]*?grid-template-columns:58px minmax\(0,1fr\)/);
});

test("Hull Dive is an inset cabin, leaves pilot screen space, and keeps bounded visible smoke/bubbles", () => {
  assert.match(hull, /width:min\(450px,44vw\)/);
  assert.match(hull, /height:min\(345px,40vh\)/);
  assert.match(hull, /new ResizeObserver\(resizeCabinView\)/);
  assert.match(hull, /if \(viewResizeObserver\)\s*\{\s*try \{ viewResizeObserver\.disconnect\(\)/);
  assert.match(hull, /const puffCount = 54/);
  assert.match(hull, /const bubbleCount = 96/);
  assert.match(hull, /level > 0\.012 \? Math\.min\(puff\.particleCount/);
  assert.match(hull, /level > 0\.01 \? Math\.min\(bubble\.particleCount/);
  assert.match(warp, /root\.classList\.add\("bcm-hull-interior-active"\)/);
  assert.match(warp, /root\.classList\.remove\("bcm-hull-interior-active"\)/);
  assert.match(css, /\.bcm-mini-sim\.bcm-hull-interior-active \.bcm-mini-sim-canvas[\s\S]*?height:100%/);
  assert.match(css, /\.bcm-helm-instruments/);
});

test("Ring weapon prototypes include laser pointer, pulse and spectrum, with operator choices and test upgrades", () => {
  assert.match(warp, /data-ring-action="fire"/);
  assert.match(warp, /statePad\.fire = !!button\(3\)/);
  assert.match(warp, /event\.code === "KeyQ" \|\| \(mode === "multi" && event\.code === "KeyK"\)/);
  assert.match(warp, /function currentWeaponProfile\(player\)/);
  assert.match(warp, /if \(type === "pulse"\)/);
  assert.match(warp, /if \(type === "spectrum"\)/);
  assert.match(warp, /new THREE\.CylinderGeometry\(profile\.width/);
  assert.match(warp, /window\.BCMDialogue\?\.showOperator\(lang === "en" \? "WEAPON MASTER" : "МАСТЕР ОРУЖИЯ"/);
  assert.match(warp, /"Spectrum · rainbow"/);
  assert.match(warp, /"Спектр · радуга"/);
  assert.match(warp, /progress\.completedRuns >= progress\.nextUpgradeAt/);
  assert.match(warp, /weaponProgress\.nextUpgradeAt = weaponProgress\.completedRuns \+ 2/);
  assert.match(warp, /offerWeaponChoice\(true\)/);
  assert.match(warp, /if \(worldState\.defeatedBosses === 1 && !masterOfferedThisRun\)/);
});

test("Ring two-player split is top/bottom; caption clutter is removed", () => {
  assert.match(warp, /P1\/pilot always owns the upper horizontal half/);
  assert.match(warp, /const half = Math\.floor\(viewH \/ 2\)/);
  assert.match(warp, /splitDivider\.style\.background = splitActive[\s\S]*?linear-gradient\(to bottom/);
  assert.doesNotMatch(warp, /fillText\("ПРОГРЕСС ПО ЗОНАМ"/);
});

test("ONICSS keeps its station poster during preload, X releases camera focus, and Bearhead is optional", () => {
  assert.ok(mini.includes("const posterMaterial = null;"));
  assert.ok(mini.includes("zone.preloadRadius > 0"));
  assert.ok(mini.includes('video.addEventListener("loadeddata", () => {'));
  assert.ok(mini.includes('video.addEventListener("playing", () => {'));
  assert.ok(mini.includes("item.mesh.material = item.videoMaterial"));
  assert.ok(mini.includes("video.pause();"));
  assert.ok(mini.includes('assetUrl("panda.mp4")'));
  assert.ok(mini.includes('speakerName.includes("medusa")'));
  assert.ok(mini.includes('video data-operator-avatar-video hidden muted autoplay playsinline loop preload="auto"'));
  assert.ok(mini.includes('e.code === "KeyX" && cinema.focus'));
  assert.ok(css.includes(".bcm-comic-dialog-avatar video{display:block;width:100%;height:100%;object-fit:cover;border-radius:inherit}"));
});

test("Hydrogen mission unlocks only after required screens really play and is anchored to the first Ring cell", () => {
  assert.match(mini, /window\.BCMWorldMissionAPI = \{/);
  assert.match(mini, /function registerMissionScreen\(screenId, required = true\)/);
  assert.match(mini, /function markMissionScreenActive\(screenId\)/);
  assert.match(mini, /required\.every\(\(id\) => worldMission\.screenVisited\[id\]\)/);
  assert.match(mini, /video\.addEventListener\("playing", \(\) => markMissionScreenActive\(item\.screenId\)\)/);
  assert.match(mini, /registerMissionScreen\(item\.screenId, !item\.towerGate\)/);
  assert.match(warp, /cell: \{ x: startNode\.x, y: startNode\.y, z: startNode\.z \}/);
  assert.match(warp, /hydrogenMesh\.name = "ring-hydrogen-pickup"/);
  assert.match(warp, /hydrogenNode: start/);
  assert.match(warp, /g\.fillText\("H"/);
  assert.match(warp, /function collectHydrogenAt\(player\)/);
  assert.match(warp, /playerNode !== path\.hydrogenNode/);
  assert.match(warp, /new CustomEvent\("bcm:mission:hydrogen-shard-collected"/);
});

test("ONICSS uses the paused video frame at distance and never a duplicate station-textured planet", () => {
  assert.ok(mini.includes("spacePlanet.mesh = null"));
  assert.ok(mini.includes('const posterMaterial = null;'));
  assert.ok(mini.includes('video.addEventListener("loadeddata", () => {'));
  assert.ok(mini.includes('if (item.towerGate && item.url)'));
  assert.ok(mini.includes('video.pause();'));
  assert.ok(warp.includes('copy.image = tex.image;'));
});

test("Hydrogen requires three unique shards and switches from Panda to Medusa", () => {
  assert.match(mini, /hydrogenRequired = 3/);
  assert.match(mini, /hydrogenCollectedIds\[id\]/);
  assert.match(mini, /worldMission\.hydrogenCount = Math\.min\(3, worldMission\.hydrogenCount \+ 1\)/);
  assert.match(mini, /"panda\.mp4"/);
  assert.match(mini, /"medusa\.mp4"/);
  assert.match(mini, /bcm:mission:medusa-unlocked/);
  assert.match(warp, /asteroid-crystal-pickup-impact/);
});

test("Explicit screen focus persists until its own radius expires and mission progress stays visible", () => {
  assert.ok(mini.includes("const focusedZone = cinema.focus && cinema.zones.includes(cinema.focus)"));
  assert.ok(mini.includes("const focusedPanel = cinema.focus && !cinema.zones.includes(cinema.focus)"));
  assert.ok(mini.includes("const nearest = focusedZone || (focusedPanel ? null"));
  assert.ok(mini.includes("A nearby different video must not steal focus."));
  assert.ok(mini.includes("if (!cinema.zones.length) {"));
  const noZones = mini.slice(mini.indexOf("if (!cinema.zones.length) {"), mini.indexOf("const candidates = [];"));
  assert.doesNotMatch(noZones, /cinema\.focus = null/);
  assert.ok(mini.includes('label.textContent = interfaceLanguage === "en"'));
  assert.ok(mini.includes("SCREENS ONLINE: "));
  assert.ok(mini.includes("RETURN TO ONI CSS · X -40 / Y 30"));
});

test("SafeMode, animated faces, readable dialog timing and flight pointer-lock handoff are wired", () => {
  assert.ok(php.includes('data-setting="safeMode"'));
  assert.ok(mini.includes('localStorage.setItem("bcm-mini-sim-safe-mode"'));
  assert.ok(mini.includes('if (safeModeEnabled)'));
  assert.ok(mini.includes('video data-operator-avatar-video hidden muted autoplay playsinline loop preload="auto"'));
  assert.ok(mini.includes("window.setTimeout(hideOperatorDialog, 26000)"));
  assert.ok(mini.includes("requestFlightPointerLock"));
  assert.ok(mini.includes("releaseFlightPointerLock"));
  assert.match(css, /width:min\(720px,calc\(72vw - 18px\)\)/);
  assert.match(css, /font-size:15px/);
});

test("0.11.11 asset version, regression assertions and long-operation timeout budgets are synchronized", () => {
  assert.match(php, /Version: 0\.11\.11/);
  assert.match(php, /BCM_MINI_SIM_VERSION', '0\.11\.11'/);
  assert.match(php, /SPACE LABYRINTH — 0\.11\.11/);
  assert.match(qa, /Version: 0\.11\.11/);
  assert.match(qa, /BCM_MINI_SIM_VERSION', '0\.11\.11'/);
  assert.match(qa, /SPACE LABYRINTH — 0\.11\.11/);
  assert.match(browserWorkflow, /timeout-minutes: 45/);
  assert.match(browserWorkflow, /timeout-minutes: 20/);
  assert.match(browserWorkflow, /timeout-minutes: 25/);
  assert.match(regressionWorkflow, /timeout-minutes: 25/);
});
