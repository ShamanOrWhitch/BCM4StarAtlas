// Owner 24.11.2026 (BUG-028): "разворот выглядит уродски". The boss forms are extruded silhouettes:
// art on the front and back caps, a bare wall on the sides. The Orbiter spun about the vertical and
// showed that wall and its back; the other forms never turned and walked backwards. Browser probe
// scripts/ring-boss-turn-probe.mjs before: Orbiter 33 of 33 moving frames backwards, bare side in 28
// of 60; after: no bare side, the walking forms look at the pilot on either side.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../mini-sim/assets/js/ring-platformer.js", import.meta.url), "utf8");

test("no form turns about the vertical: the Orbiter sways instead of spinning", () => {
  assert.doesNotMatch(src, /phaseGroup\.rotation\.y \+= dt \* 1\.1/, "the Orbiter spins and shows its bare side and back");
  assert.match(src, /if \(phaseIndex === 3\) phaseGroup\.rotation\.y = Math\.sin\(now \* 0\.0016\) \* 0\.28;/);
});

function turnApi() {
  const start = src.indexOf("const RING_BOSS_FORM_SCALE");
  const end = src.indexOf("\n    }\n", src.indexOf("function turnRingBossForm(")) + 6;
  assert.ok(start > 0 && end > start, "the forms have no turn");
  return new Function(src.slice(start, end) + "; return { turn: turnRingBossForm, ART: RING_BOSS_ART_FACING };")();
}

test("a form turns to where it goes like drawn art: a quick flip through a thin edge, then the mirror image", () => {
  const { turn, ART } = turnApi();
  const group = { scale: { x: 1 }, rotation: { y: 0 }, userData: { bcmBaseScale: 1 } };
  const boss = {};
  const phase = 2; // the Walker, drawn facing left
  assert.equal(ART[phase], -1);
  turn(boss, group, phase, -1, 1 / 60);
  assert.ok(group.scale.x > 0.99, "the Walker going left is mirrored");
  const xs = [];
  for (let i = 0; i < 30; i += 1) { turn(boss, group, phase, 1, 1 / 60); xs.push(group.scale.x); }
  assert.ok(group.scale.x < -0.99, "the Walker going right still looks left");
  const firstMirror = xs.findIndex((x) => x < -0.99);
  assert.ok(firstMirror >= 8 && firstMirror <= 16, `the flip takes ${firstMirror} frames: a jump cut or a slow turn`);
  assert.ok(xs.every((x) => Math.abs(x) >= 0.12 - 1e-9), "the form vanishes to a line during the flip");
  assert.equal(group.rotation.y, 0, "the turn rotates the form and shows its side");
  // The Brawler is drawn from the front: it does not flip.
  const brawler = { scale: { x: 2.2 }, rotation: { y: 0 }, userData: { bcmBaseScale: 2.2 } };
  for (let i = 0; i < 30; i += 1) turn({}, brawler, 4, i % 2 ? 1 : -1, 1 / 60);
  assert.equal(brawler.scale.x, 2.2);
});

test("the arena turns each form by where it really goes, or toward the pilot when it stands", () => {
  assert.match(src, /const look = Math\.abs\(moved\) > 0\.4 \? Math\.sign\(moved\) : \(target \? Math\.sign\(target\.worldX - out\.x\) \|\| out\.facing : out\.facing\);/);
  assert.match(src, /turnRingBossForm\(boss, phaseGroup, boss\.phaseIndex, look, dt\);/);
  assert.match(src, /phaseGroup\.userData\.bcmBaseScale = formScale;/);
});
