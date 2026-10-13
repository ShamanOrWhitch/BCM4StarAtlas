import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const repoRoot = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, repoRoot), "utf8");

test("Mini-Sim physics reads look yaw through the input object, not an out-of-scope variable", async () => {
  const source = await read("mini-sim/assets/js/mini-sim.js");
  const inputStart = source.indexOf("function input()");
  const inputEnd = source.indexOf("function triggerCollisionImpact", inputStart);
  const physicsStart = source.indexOf("function updatePhysics(dt)");
  const physicsEnd = source.indexOf("function render(now)", physicsStart);

  assert.ok(inputStart >= 0 && inputEnd > inputStart, "input() function boundary exists");
  assert.ok(physicsStart >= 0 && physicsEnd > physicsStart, "updatePhysics() function boundary exists");

  const input = source.slice(inputStart, inputEnd);
  const physics = source.slice(physicsStart, physicsEnd);

  assert.match(input, /lookYaw:\\s*look\\.yaw/, "input() exposes the sensor/look yaw as a field");
  assert.match(physics, /inn\\.lookYaw/, "updatePhysics() reads look yaw from its input result");
  assert.doesNotMatch(physics, /\\blook\\.yaw\\b/, "updatePhysics() has no dangling reference to input()'s local variable");
});
