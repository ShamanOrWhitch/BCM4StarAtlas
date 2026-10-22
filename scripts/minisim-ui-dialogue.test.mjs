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

test("Two dismissible comic bubbles replace the persistent in-game HUD/control wall", () => {
  assert.match(mini, /id = "bcm-comic-dialogs"/);
  assert.match(mini, /data-dialog-box="operator"/);
  assert.match(mini, /data-dialog-box="controls"/);
  assert.match(mini, /window\.BCMDialogue = \{/);
  assert.match(mini, /showControls\("flight"\)/);
  assert.match(mini, /showControls\("tower"\)/);
  assert.match(warp, /showControls\("ring"\)/);
  assert.match(warp, /showControls\("hull"\)/);
  assert.match(warp, /showControls\("warp"\)/);
  assert.match(css, /\.bcm-comic-dialog-operator/);
  assert.match(css, /\.bcm-comic-dialog-controls/);
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
  assert.match(css, /\.bcm-mini-sim\.bcm-hull-interior-active \.bcm-mini-sim-canvas[\s\S]*?height:68%/);
});

test("Ring optional mobs use X-button laser; collecting crystals, not boss kills, completes the route", () => {
  assert.match(warp, /data-ring-action="fire" aria-label="Огонь · X"/);
  assert.match(warp, /statePad\.fire = !!\(pad\.buttons\?\.\[2\]\?\.pressed\)/);
  assert.doesNotMatch(warp, /statePad\.fire = .*buttons\?\.\[3\]/);
  assert.match(warp, /KeyX: "fire"/);
  assert.match(warp, /function fireAtMob\(player\)/);
  assert.match(warp, /function updateMobPatrol\(dt\)/);
  assert.match(warp, /maze\.count < 3/);
  assert.match(warp, /if \(target\) \{\s*target\.alive = false;/);
  const ring = warp.slice(warp.indexOf("function openRingPlatformer("), warp.indexOf("function finishRingPlatformer("));
  assert.doesNotMatch(ring, /defeatedBosses|barrier\.unlockAfter|function updateBosses\(|offerWeaponChoice\(/);
});

test("Ring two-player split is always top/bottom; caption clutter is removed", () => {
  assert.match(warp, /P1\/pilot always owns the upper horizontal half; P2 stays below on every aspect ratio/);
  assert.match(warp, /const half = Math\.floor\(viewH \/ 2\)/);
  assert.match(warp, /player: players\[0\], camera: cameraOne/);
  assert.match(warp, /player: players\[1\], camera: cameraTwo/);
  assert.match(warp, /splitDivider\.style\.borderTop = splitActive/);
  assert.match(warp, /splitDivider\.style\.borderLeft = "0"/);
  assert.doesNotMatch(warp, /fillText\("ПРОГРЕСС ПО ЗОНАМ"/);
});

test("0.9.114 asset version, regression assertions and long-operation timeout budgets are synchronized", () => {
  assert.match(php, /Version: 0\.9\.114/);
  assert.match(php, /BCM_MINI_SIM_VERSION', '0\.9\.114'/);
  assert.match(php, /SPACE LABYRINTH — 0\.9\.114/);
  assert.match(qa, /Version: 0\.9\.114/);
  assert.match(qa, /BCM_MINI_SIM_VERSION', '0\.9\.114'/);
  assert.match(qa, /SPACE LABYRINTH — 0\.9\.114/);
  assert.match(browserWorkflow, /timeout-minutes: 45/);
  assert.match(browserWorkflow, /timeout-minutes: 20/);
  assert.match(browserWorkflow, /timeout-minutes: 25/);
  assert.match(regressionWorkflow, /timeout-minutes: 25/);
});
