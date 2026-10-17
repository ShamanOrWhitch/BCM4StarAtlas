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

  assert.match(input, /lookYaw:\s*look\.yaw/, "input() exposes the sensor/look yaw as a field");
  assert.match(physics, /inn\.lookYaw/, "updatePhysics() reads look yaw from its input result");
  assert.doesNotMatch(physics, /\blook\.yaw\b/, "updatePhysics() has no dangling reference to input()'s local variable");
});


test("startup requests nearby wall textures before right-wall video and portal media", async () => {
  const source = await read("mini-sim/assets/js/mini-sim.js");
  const priorityStart = source.indexOf("function textureRequestPriority(name)");
  const priorityEnd = source.indexOf("function queueLowPriorityImage", priorityStart);
  const armStart = source.indexOf("const armLevelMedia = () =>");
  const armEnd = source.indexOf("armLevelMedia();", armStart);
  assert.ok(priorityStart >= 0 && priorityEnd > priorityStart);
  assert.ok(armStart >= 0 && armEnd > armStart);
  const priorities = source.slice(priorityStart, priorityEnd);
  const arm = source.slice(armStart, armEnd);
  assert.match(priorities, /wall\[1-5\].*return 1/);
  assert.match(priorities, /roof\[0-9\].*return 2/);
  assert.match(priorities, /back.*return 9/);
  assert.ok(arm.indexOf("startBackgroundTextureLoading()") < arm.indexOf("warmInteriorVideo(room1RightWall)"));
  assert.ok(arm.indexOf("warmInteriorVideo(room1RightWall)") < arm.indexOf('primePortalVideo("FORWARD", "high")'));
  assert.match(source, /img\.fetchPriority = job\.priority <= 1 \? "high"/);
});

test("dragging a locked Deep Space screen orbits around it instead of applying generic look", async () => {
  const source = await read("mini-sim/assets/js/mini-sim.js");
  const orbitStart = source.indexOf("function orbitFocusedScreenByDrag(dx, dy)");
  const orbitEnd = source.indexOf("function orbitFocusedScreen(dt)", orbitStart);
  const pointerStart = source.indexOf('canvas.addEventListener("pointermove"');
  const pointerEnd = source.indexOf("const endDrag = ", pointerStart);
  assert.ok(orbitStart >= 0 && orbitEnd > orbitStart);
  assert.ok(pointerStart >= 0 && pointerEnd > pointerStart);
  const orbit = source.slice(orbitStart, orbitEnd);
  const pointer = source.slice(pointerStart, pointerEnd);
  assert.match(orbit, /cinema\.focus\.mesh/);
  assert.match(orbit, /offset\.applyAxisAngle/);
  assert.match(orbit, /ship\.position\.copy\(target\)\.add\(offset\)/);
  assert.match(pointer, /if \(cinema\.focus && mobileLandscape\(\)\)\s*\{\s*orbitFocusedScreenByDrag\(dx, dy\)/);
  assert.match(pointer, /else\s*\{\s*ship\.angularVelocity\.y -= dx/);
});

test("Tower mobile jump uses one input event path on modern phones and softer tilt", async () => {
  const source = await read("mini-sim/tower/assets/js/tower.js");
  const css = await read("mini-sim/tower/assets/css/tower.css");
  const start = source.indexOf("const pointerEventsAvailable =");
  const end = source.indexOf("function towerButtonAt", start);
  assert.ok(start >= 0 && end > start);
  const controls = source.slice(start, end);
  assert.match(controls, /if \(!pointerEventsAvailable\) return/);
  assert.match(controls, /button\.addEventListener\("pointerdown", down\)/);
  assert.doesNotMatch(controls, /button\.addEventListener\("touchstart"/);
  assert.match(source, /if \(!pointerEventsAvailable\)\s*\{\s*root\.addEventListener\("touchstart"/);
  assert.match(source, /const dead = 2\.0;[\s\S]*?\) \/ 10,/);
  assert.match(css, /\.bcm-tower-mobile-player\[hidden\][\s\S]*?display: none !important/);
});
