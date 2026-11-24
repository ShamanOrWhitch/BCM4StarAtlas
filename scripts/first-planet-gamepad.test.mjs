// Owner 24.11.2026: "в этом меню я gamepad ничего не могу выбрать, и управление на планете gamepad
// отсутствует… гонка на джойстике не работает"; "управление должно быть прописано не для каждой планеты
// отдельно, а для разных игр в crew-core и подгружено нужное по форме уровня". The schemes live in
// crew-core.js by game form; First Planet's gamepad.ts only reads the pad and asks crew-core.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import "./lib/first-planet-sim.mjs";

const ROOT = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");

// crew-core on the page, as on the Tower / Mini-Sim pages.
const ctx = vm.createContext({ console, Math, Number, String, Array, Object, JSON, Map, Set, Promise });
ctx.window = ctx;
vm.runInContext(read("mini-sim/assets/js/crew-rig.js"), ctx);
vm.runInContext(read("mini-sim/assets/js/crew-core.js"), ctx);
globalThis.BCMCrewCore = ctx.BCMCrewCore;

const pad = await import("../mini-sim/first-planet/src/game/gamepad.ts");
const input = await import("../mini-sim/first-planet/src/game/input.ts");

function gp({ axes = [0, 0, 0, 0], pressed = [], values = {} } = {}) {
  const buttons = Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i), value: values[i] ?? (pressed.includes(i) ? 1 : 0) }));
  return { axes, buttons, connected: true };
}

test("crew-core holds the schemes by game form; the stick and d-pad walk in every form", () => {
  const C = globalThis.BCMCrewCore;
  for (const form of ["island", "race"]) assert.ok(C.controlScheme(form).hint, `no ${form} scheme`);
  assert.deepEqual([...pad.padKeys(gp({ axes: [0, -0.9] }), "island")], ["KeyW"]);
  assert.deepEqual([...pad.padKeys(gp({ axes: [-0.8, 0] }), "race")], ["KeyA"]);
  assert.deepEqual([...pad.padKeys(gp({ axes: [0.2, 0.2] }), "island")], [], "a resting stick presses nothing");
  assert.ok(pad.padKeys(gp({ pressed: [15] }), "island").has("KeyD"), "d-pad right");
});

test("the island and the race forms map the buttons differently", () => {
  const island = pad.padKeys(gp({ pressed: [0, 2, 3, 5] }), "island");
  for (const code of ["Space", "KeyE", "KeyF", "ShiftLeft"]) assert.ok(island.has(code), `island: ${code} not mapped`);
  const race = pad.padKeys(gp({ values: { 7: 0.8, 6: 0 } }), "race");
  assert.ok(race.has("KeyW"), "race: RT is not the throttle");
  assert.ok(pad.padKeys(gp({ values: { 6: 0.8 } }), "race").has("KeyS"), "race: LT is not the brake");
  assert.ok(!pad.padKeys(gp({ pressed: [3] }), "race").has("KeyF"), "race: Y still boards a bike");
});

test("pad keys reach the game together with the keyboard", () => {
  input.held.clear();
  input.held.add("KeyE");
  pad.padHeld.clear();
  pad.padHeld.add("KeyW");
  const keys = input.activeKeys();
  assert.ok(keys.has("KeyW") && keys.has("KeyE"), "the pad and the keyboard do not add up");
  pad.padHeld.clear();
  input.held.clear();
});

test("menu focus moves to the nearest button in the pushed direction (crew-core's rule)", () => {
  const rects = [
    { x: 100, y: 100, w: 200, h: 40 },
    { x: 100, y: 160, w: 200, h: 40 },
    { x: 100, y: 220, w: 95, h: 60 },
    { x: 205, y: 220, w: 95, h: 60 },
  ];
  assert.equal(pad.nextFocus(rects, 0, "down"), 1);
  assert.equal(pad.nextFocus(rects, 1, "down"), 2);
  assert.equal(pad.nextFocus(rects, 2, "right"), 3);
  assert.equal(pad.nextFocus(rects, 3, "up"), 1);
  assert.equal(pad.nextFocus(rects, 0, "up"), 0, "nothing above: focus stays");
});

test("the island and the race bind the pad by their form; menus are marked; no per-game key table", () => {
  assert.match(read("mini-sim/first-planet/src/components/desert-island.tsx"), /bindGamepad\(window, "island"\)/);
  assert.match(read("mini-sim/first-planet/src/components/shoal-race.tsx"), /bindGamepad\(window, "race"\)/);
  for (const file of ["desert-island.tsx", "shoal-race.tsx"]) assert.match(read("mini-sim/first-planet/src/components/" + file), /data-gamepad-menu/);
  const own = read("mini-sim/first-planet/src/game/gamepad.ts");
  assert.doesNotMatch(own, /\[\s*\d+\s*,\s*"Key[A-Z]"\s*\]/, "gamepad.ts keeps its own key table instead of crew-core's");
});
