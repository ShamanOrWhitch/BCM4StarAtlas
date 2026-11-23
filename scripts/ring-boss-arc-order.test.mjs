// Owner 23.11.2026: the Ring boss arc.
// - Only the last (farthest) Pig turns into the six forms; the first two Pigs are plain fights.
// - After the Pig is beaten its whole body leaves the stage: armour, horns, eyes, core and
//   halo were left standing behind every later form (screenshots of the forms show it).
// - The form GLBs read too dark: their painted art must show as drawn.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ring = readFileSync(new URL("../mini-sim/assets/js/ring-platformer.js", import.meta.url), "utf8");

test("only the last Pig carries the six forms", () => {
  assert.match(ring, /hasPhases:\s*index === bosses\.length - 1/, "every Pig turns into all six forms");
  assert.match(ring, /boss\.hasPhases && boss\.phaseIndex < 6/, "a Pig without forms still starts the form chain");
  assert.match(ring, /if \(!boss\.hasPhases\) return;/, "form models are loaded for every Pig");
});

test("the Pig's whole body leaves the stage after its defeat", () => {
  assert.match(ring, /pigShell:/, "only the pig face/body group is hidden; armour, eyes, core and halo stay");
  assert.match(ring, /boss\.pigShell\.forEach\(\(part\) => \{ part\.visible = false; \}\)/, "the Pig shell is never hidden after the transition");
  assert.doesNotMatch(ring, /if \(boss\.ring\) boss\.ring\.visible = true;/, "the Pig halo comes back over every form");
});

test("form models show their painted art as drawn", () => {
  assert.match(ring, /emissiveMap = material\.map/, "form GLBs are lit only by the arena lights and read dark");
});
