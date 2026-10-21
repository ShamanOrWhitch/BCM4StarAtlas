import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../mini-sim/assets/js/deep-space-warp.js", import.meta.url), "utf8");
const ringStart = source.indexOf("function openRingPlatformer(");
const ringEnd = source.indexOf("function finishRingPlatformer(", ringStart);
assert.ok(ringStart >= 0 && ringEnd > ringStart, "Ring Frontier source block exists");
const ring = source.slice(ringStart, ringEnd);

test("Ring menu can be confirmed before a player is spawned", () => {
  const polling = ring.slice(ring.indexOf("function pollGamepads()"), ring.indexOf("function damagePlayer("));
  assert.match(polling, /if \(!gameStarted\)\s*\{\s*pollModeMenuGamepad\(\);\s*return;\s*\}/);
  assert.match(ring, /function confirmModeMenu\(\)[\s\S]*?startMode\(menuFocusIndex === 1 \? "multi" : "single"\)/);
});

test("Keyboard E/Enter/Space confirm; left/right chooses SINGLE or MULTI", () => {
  const keyboard = ring.slice(ring.indexOf("function keyboardMove("), ring.indexOf("function pollGamepads("));
  assert.match(keyboard, /event\.code === "KeyE" \|\| event\.code === "Enter" \|\| event\.code === "NumpadEnter" \|\| event\.code === "Space"/);
  assert.match(keyboard, /ArrowLeft/);
  assert.match(keyboard, /ArrowRight/);
  assert.match(keyboard, /focusModeMenu\(menuFocusIndex \+ 1\)/);
  assert.match(keyboard, /focusModeMenu\(menuFocusIndex - 1\)/);
  assert.match(keyboard, /if \(p1Activate \|\| p2Activate\)/, "E must remain the in-game weakpoint activation key after start");
});

test("Gamepad A confirms the focused menu option and D-pad/stick changes selection", () => {
  const menuPad = ring.slice(ring.indexOf("function pollModeMenuGamepad("), ring.indexOf("function resize2d("));
  assert.match(menuPad, /button\(0\) \|\| button\(9\)/);
  assert.match(menuPad, /button\(14\) \|\| axisX < -0\.55/);
  assert.match(menuPad, /button\(15\) \|\| axisX > 0\.55/);
  assert.match(menuPad, /confirm && !menuPadPrevious\.confirm/);
});

test("Touch/pointer and accessible click activate either visible mode button", () => {
  assert.match(ring, /button\.addEventListener\("pointerdown"/);
  assert.match(ring, /button\.addEventListener\("click", activate\)/);
  assert.match(ring, /menu\.addEventListener\("pointerdown"/);
  assert.match(ring, /const modeButtons = \[[\s\S]*data-ring-single[\s\S]*data-ring-multi/);
});

test("Mode confirmation is idempotent and does not disturb gameplay controls", () => {
  assert.match(ring, /function startMode\(nextMode\)\s*\{\s*if \(done \|\| gameStarted\) return;/);
  assert.match(ring, /statePad\.jump = !!\(button\(0\) \|\| button\(12\) \|\| axisY < -0\.68\)/);
  assert.match(ring, /statePad\.activate = !!button\(2\)/);
});
