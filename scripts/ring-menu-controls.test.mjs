import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../mini-sim/assets/js/deep-space-warp.js", import.meta.url), "utf8");
const ringStart = source.indexOf("function openRingPlatformer(");
const ringEnd = source.indexOf("function finishRingPlatformer(", ringStart);
assert.ok(ringStart >= 0 && ringEnd > ringStart, "Ring cutaway source block exists");
const ring = source.slice(ringStart, ringEnd);

test("Ring mode menu launches the same-maze cutaway only after a mode is chosen", () => {
  assert.match(ring, /function startMode\(nextMode\)/);
  assert.match(ring, /if \(done \|\| gameStarted\) return/);
  assert.match(ring, /root2d\.querySelector\("\[data-ring-single\]"\)\.addEventListener\("click", \(\) => startMode\("single"\)\)/);
  assert.match(ring, /root2d\.querySelector\("\[data-ring-multi\]"\)\.addEventListener\("click", \(\) => startMode\("multi"\)\)/);
  assert.match(ring, /world\.name = "bcm-ring-cutaway-world"/);
  assert.match(ring, /maze\.cells\.forEach\(\(cell\) =>/);
});

test("Keyboard can cycle SINGLE/MULTI and confirm before a player is spawned", () => {
  const keyboard = ring.slice(ring.indexOf("function keyboardMove("), ring.indexOf("function pollGamepads("));
  assert.match(keyboard, /if \(!gameStarted\)\s*\{/);
  assert.match(keyboard, /event\.code === "ArrowLeft" \|\| event\.code === "KeyA"/);
  assert.match(keyboard, /event\.code === "ArrowRight" \|\| event\.code === "KeyD"/);
  assert.match(keyboard, /event\.code === "Enter" \|\| event\.code === "NumpadEnter"[\s\S]*?event\.code === "KeyE"/);
  assert.match(keyboard, /startMode\(menuFocusIndex === 1 \? "multi" : "single"\)/);
  assert.match(ring, /function focusModeMenu\(nextIndex\)/);
});

test("Gamepad D-pad/stick selects a mode; A/Start confirms; Back exits", () => {
  const polling = ring.slice(ring.indexOf("function pollGamepads("), ring.indexOf("function mobWorldPosition("));
  const preStart = polling.slice(0, polling.indexOf("const assignment = mode === \"multi\""));
  assert.match(preStart, /if \(!gameStarted\)/);
  assert.match(preStart, /button\(14\) \|\| axisX < -0\.55/);
  assert.match(preStart, /button\(15\) \|\| axisX > 0\.55/);
  assert.match(preStart, /button\(0\) \|\| button\(9\)/);
  assert.match(preStart, /button\(8\)/);
  assert.match(preStart, /startMode\(menuFocusIndex === 1 \? "multi" : "single"\)/);
  assert.match(polling, /statePad\.fire = !!\(pad\.buttons\?\.\[2\]\?\.pressed\)/);
  assert.match(polling, /finishRingPlatformer\(maze, false\)/);
});

test("Crew uses X to fire; Y is not fire and the three-crystal return remains the objective", () => {
  assert.match(ring, /KeyX: "fire"/);
  assert.match(ring, /data-ring-action="fire" aria-label="Огонь · X"/);
  assert.match(ring, /function fireAtMob\(player\)/);
  assert.match(ring, /maze\.count < 3/);
  assert.match(ring, /if \(target\) \{\s*target\.alive = false;/);
  assert.doesNotMatch(ring, /data-ring-action="attack"|defeatedBosses|barrier\.unlockAfter|function updateBosses\(/);
});

test("Two-player cutaway keeps P1 above P2 on every screen orientation", () => {
  assert.match(source, /P1\/pilot always owns the upper horizontal half; P2 stays below on every aspect ratio/);
  assert.match(source, /const half = Math\.floor\(viewH \/ 2\)/);
  assert.match(source, /player: players\[0\], camera: cameraOne/);
  assert.match(source, /player: players\[1\], camera: cameraTwo/);
  assert.match(source, /splitDivider\.style\.borderTop = splitActive/);
  assert.match(source, /splitDivider\.style\.borderLeft = "0"/);
});
