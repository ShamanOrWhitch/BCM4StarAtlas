import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";

const source = await readFile(new URL("../mini-sim/assets/js/crew-core.js", import.meta.url), "utf8");
const context = { window: {}, console, Promise, Map, Set, Math, Number, String, Array, Object };
vm.runInNewContext(source, context, { filename: "crew-core.js" });
const core = context.window.BCMCrewCore;

test("Crew Core exposes one normalized intent for keyboard, touch and gamepad", () => {
  assert.equal(typeof core.createCrewControls, "function");
  const p1 = core.createCrewControls({ playerIndex: 0 });
  p1.key("KeyD", true, false);
  p1.key("ArrowUp", true, false);
  p1.key("Space", true, false);
  p1.key("KeyQ", true, false);
  const intent = p1.intent();
  assert.equal(intent.moveX, 1);
  assert.equal(intent.moveY, -1);
  assert.equal(intent.jump, true);
  assert.equal(intent.jumpEdge, true);
  assert.equal(intent.fire, true);
  assert.deepEqual([intent.dash, intent.activate, intent.floor], [false, false, false]);
  assert.equal(p1.intent().jumpEdge, false, "jump edge is emitted once while the key stays down");
});

test("P2 keyboard bindings normalize to the same action contract", () => {
  const p2 = core.createCrewControls({ playerIndex: 1 });
  p2.key("KeyL", true, false);
  p2.key("KeyT", true, false);
  p2.key("KeyP", true, false);
  p2.key("KeyO", true, false);
  const intent = p2.intent();
  assert.equal(intent.moveX, 1);
  assert.equal(intent.moveY, -1);
  assert.equal(intent.jumpEdge, true);
  assert.equal(intent.activate, true);
});

test("Gamepad axes provide analog moveX/moveY and button actions produce one-shot edges", () => {
  const controls = core.createCrewControls({ playerIndex: 0 });
  const pad = {
    connected: true,
    axes: [0.65, -0.72],
    buttons: Array.from({ length: 16 }, () => ({ pressed: false }))
  };
  pad.buttons[0].pressed = true;
  pad.buttons[3].pressed = true;
  controls.gamepad(pad);
  const first = controls.intent();
  assert.equal(first.moveX, 0.65);
  assert.equal(first.moveY, -0.72);
  assert.equal(first.jump, true);
  assert.equal(first.jumpEdge, true);
  assert.equal(first.fire, true);
  assert.equal(controls.intent().jumpEdge, false);
  pad.buttons[2].pressed = true;
  controls.gamepad(pad);
  assert.equal(controls.intent().activate, true);
  controls.gamepad(null);
  const released = controls.intent();
  assert.equal(released.moveX, 0);
  assert.equal(released.moveY, 0);
  assert.equal(released.fire, false);
});

test("Touch actions combine and a fast activation tap remains latched until read", () => {
  const controls = core.createCrewControls({ playerIndex: 0 });
  controls.touch("right", true);
  controls.touch("up", true);
  controls.touch("activate", true);
  controls.touch("activate", false);
  const intent = controls.intent();
  assert.equal(intent.moveX, 1);
  assert.equal(intent.moveY, -1);
  assert.equal(intent.activate, true);
  assert.equal(controls.intent().activate, false);
  controls.clear();
  assert.deepEqual([controls.intent().moveX, controls.intent().moveY], [0, 0]);
});

test("Crew Core reports shared locomotion states using level-supplied motion and dt", () => {
  const store = {};
  const pose = (actor, dt) => core.crewSpritePose(actor, dt, store);
  assert.equal(pose({ moving: false, grounded: true }, 0.016).state, "idle");
  assert.equal(pose({ moving: true, speed: 4, grounded: true }, 0.016).state, "walk");
  assert.equal(pose({ moving: true, speed: 9, grounded: true }, 0.016).state, "run");
  assert.equal(pose({ moving: true, grounded: false, vy: 3 }, 0.016).state, "jump-rise");
  assert.equal(pose({ moving: true, grounded: false, vy: -3 }, 0.016).state, "fall");
  assert.equal(pose({ moving: false, grounded: false, hanging: true }, 0.016).state, "hang");
  assert.equal(pose({ moving: false, grounded: true, climbing: true }, 0.016).state, "climb");
  const landingStore = { bcmWasGrounded: false };
  assert.equal(core.crewSpritePose({ moving: false, grounded: true }, 0.016, landingStore).state, "land");
});
