import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");
const [hull, php, qa, uiTests] = await Promise.all([
  read("mini-sim/assets/js/hull-dive.js"),
  read("mini-sim/bcm-mini-sim.php"),
  read("scripts/minisim-local-qa.test.mjs"),
  read("scripts/minisim-ui-dialogue.test.mjs")
]);

test("Hull Dive selects language from the shared RU/EN dialogue API", () => {
  assert.match(hull, /const en = window\.BCMDialogue\?\.language === "en"/);
  assert.match(hull, /const say = \(ru, english\) => en \? english : ru/);
  assert.match(hull, /function makeHullSideTexture\(THREE, english = false\)/);
  assert.match(hull, /makeHullSideTexture\(THREE, en\)/);
});

test("Rendered cabin station labels and controls have English and Russian copy", () => {
  for (const pair of [
    ['say("ОТСЕК · РЕМОНТ", "COMPARTMENT · REPAIR")', "compartment"],
    ['say("ПРОВЕРЬ ВОДУ И КОРПУС", "CHECK WATER AND HULL")', "status"],
    ['say("НАЗАД В ПОЛЁТ", "BACK TO FLIGHT")', "exit"],
    ['say("Штурвал", "Helm")', "helm"],
    ['say("Орудие", "Gun")', "gun"],
    ['say("Боезапас", "Ammo")', "ammo"],
    ['say("Ремонт", "Repair")', "repair"],
    ['say("Насос", "Pump")', "pump"],
    ['"PILOT / NAVIGATION"', "pilot panel"],
    ['"GUN / AMMO"', "gun panel"],
    ['"ENGINEERING / REPAIR"', "engineering panel"]
  ]) {
    assert.ok(hull.includes(pair[0]), "missing bilingual " + pair[1] + " copy");
  }
});

test("Cabin runtime feedback also follows the selected language", () => {
  for (const phrase of [
    "Could not prepare the selected Crew portrait",
    "Out of ammo. Hold the ammo control at the rack to reload",
    "Target destroyed. Reload to engage the next asteroid",
    "Helm released. Crew can pump water and repair the hull.",
    "The exterior breach is still open; patch it from outside first",
    "Patch the exterior breach first; the inner seam is still locked",
    "Oxygen depleted. Press the pump control while keeping your head above water.",
    "Compartment dry. You can return to the Ring.",
    "Hold the repair control beside the breach. Pressure "
  ]) assert.ok(hull.includes(phrase), "missing English runtime feedback: " + phrase);
  assert.match(hull, /say\("шов ", "SEAM "\)/);
  assert.match(hull, /say\("ТЯГА ", "THRUST "\)/);
  assert.match(hull, /say\("КУРС ", "HEADING "\)/);
  assert.doesNotMatch(hull, /Out of ammo\. Hold R at the rack to reload|Helm: W\/S controls thrust, A\/D heading|Oxygen depleted\. Use E \(or gamepad B\)|Repair: F \/ Enter or gamepad A/);
});

test("The cabin remains compact and sci-fi visuals use cool energy colors", () => {
  assert.match(hull, /width:min\(450px,44vw\)/);
  assert.match(hull, /height:min\(345px,40vh\)/);
  assert.match(hull, /const puffCount = 54/);
  assert.match(hull, /const bubbleCount = 96/);
  assert.match(hull, /new THREE\.MeshBasicMaterial\(\{ color: 0x72dcf7 \}\)/);
  assert.match(hull, /color: 0x68bfff, transparent: true, opacity: 0\.9/);
  assert.doesNotMatch(hull, /0xffb15a|0xff6b55/);
});

test("Mini-Sim 0.11.21 cache and all source-contract tests use the same version", () => {
  assert.match(php, /Version: 0\.11\.20/);
  assert.match(php, /BCM_MINI_SIM_VERSION', '0\.11\.20'/);
  assert.match(php, /SPACE LABYRINTH — 0\.11\.20/);
  assert.match(qa, /Version: 0\.11\.20/);
  assert.match(qa, /BCM_MINI_SIM_VERSION', '0\.11\.20'/);
  assert.match(qa, /SPACE LABYRINTH — 0\.11\.20/);
  assert.ok(uiTests.includes("Version: 0\\.11\\.20"));
  assert.ok(uiTests.includes("BCM_MINI_SIM_VERSION', '0\\.11\\.20'"));
  assert.ok(uiTests.includes("SPACE LABYRINTH — 0\\.11\\.20"));
});
