// Owner's live-site list, 16.11.2026 (Mini-Sim 0.15.5 inside Galia):
// BUG-013 ruins and a rock hang in the air, BUG-014 the tape "full screen"
// does not open, BUG-016 control hints stay on screen and never say that Q is
// down; the hovering ship keeps its flight form.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { playIsland } from "./lib/first-planet-sim.mjs";

const ROOT = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");

test("BUG-016: riding hints are said once and then leave the screen; flight names Q as down", () => {
  const { sim, hold, tap } = playIsland();
  // The scene seats the pilot the same way (sim.board in scene.ts).
  sim.mode = "bike";
  hold([], 0.2);
  assert.match(sim.prompt, /T — /, `no riding hint right after boarding: "${sim.prompt}"`);
  assert.match(sim.prompt, /F — спешиться/);
  hold([], 6);
  assert.equal(sim.prompt, "", `the riding hint is still on screen 6 s after boarding: "${sim.prompt}"`);
  tap("KeyT");
  assert.equal(sim.flightMode, true);
  hold([], 0.2);
  assert.match(sim.prompt, /Q — вниз/, `the flight hint does not say that Q is down: "${sim.prompt}"`);
  assert.match(sim.prompt, /Space — вверх/);
  hold([], 6);
  assert.equal(sim.prompt, "", `the flight hint is still on screen 6 s later: "${sim.prompt}"`);
  // Q really is down, Space really is up.
  hold(["Space"], 1.2);
  hold([], 1.5); // let the climb die out
  const high = sim.y;
  hold(["KeyQ"], 1.5);
  assert.ok(sim.y < high - 0.3, `Q did not lower the ship (${high.toFixed(2)} -> ${sim.y.toFixed(2)})`);
  // Back on foot other prompts are untouched.
  sim.mode = "foot";
  hold([], 0.1);
  assert.doesNotMatch(sim.prompt, /спешиться/);
});

test("BUG-016: a ship hovering still shows its rest form, a moving one its flight form", () => {
  const scene = read("mini-sim/first-planet/src/game/island/scene.ts");
  assert.doesNotMatch(scene, /const blazing = sim\.mode === "bike" && sim\.flightMode;\s*\n\s*if \(driveController\)/,
    "the flight form is shown for the whole flight mode, also while the ship hangs still");
  assert.match(scene, /const blazing = flying && shipMoving/);
});

test("BUG-014: the tape full-screen layer is above the First Planet host", () => {
  const scene = read("mini-sim/first-planet/src/game/island/scene.ts");
  const css = read("mini-sim/tower/assets/css/tower.css");
  const host = Number(css.match(/\.bcm-first-planet-host\s*\{[^}]*z-index:\s*(\d+)/)[1]);
  const fn = scene.slice(scene.indexOf("function toggleTapeScreen()"), scene.indexOf("sim.board = () =>"));
  const layer = Number(fn.match(/z-index:(\d+)/)[1]);
  assert.ok(layer > host, `the tape layer (z-index ${layer}) opens under the First Planet host (z-index ${host}): nothing is seen`);
  // With the game already full screen the layer must live inside that element.
  assert.match(fn, /document\.fullscreenElement \|\| document\.body/);
});

test("BUG-013: a prop sits on the lowest ground under its footprint, not on the height at its centre", () => {
  const scene = read("mini-sim/first-planet/src/game/island/scene.ts");
  const sit = scene.slice(scene.indexOf("function sit("), scene.indexOf("function solidify("));
  assert.match(sit, /lowestGround\(/, "props are seated by the ground height at their centre only: on a slope an edge hangs in the air");
  const terrain = read("mini-sim/first-planet/src/game/island/terrain.ts");
  assert.match(terrain, /export function lowestGround\(/);
});

test("BUG-013: lowestGround finds the low side of a slope", async () => {
  const { terrain } = playIsland();
  assert.equal(typeof terrain.lowestGround, "function", "terrain has no footprint query: props use one height sample");
  // The crystal ridge is steep: a 6 m footprint spans well over a metre of height.
  const x = -32, z = -8;
  const centre = terrain.surfaceY(x, z);
  const low = terrain.lowestGround(x - 3, x + 3, z - 3, z + 3);
  assert.ok(low < centre - 0.3, `on the ridge slope the footprint minimum (${low.toFixed(2)}) is not below the centre (${centre.toFixed(2)})`);
  const corners = [[x - 3, z - 3], [x + 3, z - 3], [x - 3, z + 3], [x + 3, z + 3]].map(([a, b]) => terrain.surfaceY(a, b));
  assert.ok(low <= Math.min(...corners) + 1e-9);
  // Flat ground: nothing changes.
  assert.ok(Math.abs(terrain.lowestGround(-1, 1, 37, 39) - terrain.surfaceY(0, 38)) < 0.05);
});
