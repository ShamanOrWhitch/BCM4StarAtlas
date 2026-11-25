// Owner 24.11.2026 (BUG-028): "персонаж после перехода ходит как бы в воздухе". A browser probe
// (scripts/ring-boss-feet-probe.mjs) measured the lowest vertex of each form in its animated pose
// after each of the six transitions: the Stalker crept and marked its target 2.6 m above the arena
// floor and touched it only after a leap. A form that walks stands on the floor; only the Orbiter
// flies, and the Stalker leaves the floor for its leap alone.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ROOT = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");
const FORMS = ["roller", "walker", "orbiter", "brawler", "runner", "stalker"];

function moves() {
  const c = vm.createContext({ Math, Number, Array, Object, JSON, String });
  c.window = c;
  vm.runInContext(read("mini-sim/assets/js/ring-boss-moves.js"), c);
  return c.BCMRingBossMoves;
}

test("every form but the flying Orbiter walks on the arena floor; the Stalker leaves it only to leap", () => {
  const M = moves();
  for (let phase = 1; phase <= 6; phase += 1) {
    const form = FORMS[phase - 1];
    if (form === "orbiter") continue;
    const boss = M.create(phase, { homeX: 18, seed: 11 });
    let peak = 0;
    for (let i = 0; i < 40 * 60; i += 1) {
      const out = boss.step(1 / 60, { targetX: 14 + Math.sin(i / 90) * 3, targetY: 0 });
      if (out.state === "leap") { peak = Math.max(peak, out.y); continue; }
      assert.ok(Math.abs(out.y) < 0.01, `${form} ${out.state} at ${out.y.toFixed(2)} m above the floor`);
    }
    if (form === "stalker") assert.ok(peak > 1.5, `the Stalker's leap rises only ${peak.toFixed(2)} m`);
  }
});

test("the arena puts the form's feet on the floor plus the move height", () => {
  const src = read("mini-sim/assets/js/ring-platformer.js");
  assert.match(src, /phaseGroup\.position\.y = \(phaseGroup\.userData\.bcmGroundY \|\| 2\.1\) \+ out\.y;/);
  assert.match(src, /phaseGroup\.userData\.bcmGroundY = \(size\.y \/ 2\) \* formScale;/);
});
