// Owner 23.11.2026: traps worth learning from (Prince of Persia: slicer gates after the
// third level, loose floor, spikes); "каждая локация это полигон для разных механик".
// The slicer (PoP chomper): two jaws at floor level snap shut for a moment on a beat; you
// pass while they are open. ring-panels.js places it ("G"), the Ring draws and times it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ROOT = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");

function panels() {
  const c = vm.createContext({ Math, Number, Array, Object, JSON, String });
  c.window = c;
  vm.runInContext(read("mini-sim/assets/js/ring-panels.js"), c);
  return c.BCMRingPanels;
}

test("panels can carry slicers: a beat, a short snap, mostly open, and the panel stays crossable", () => {
  const P = panels();
  assert.ok(Object.values(P.CHUNKS).some((rows) => rows.join("").includes("G")), "no slicer chunk: no PoP-style timing trap");
  let seen = 0;
  for (let seed = 1; seed <= 200 && seen < 12; seed += 1) {
    const panel = P.buildPanel(seed, { x: seed % 7, y: seed % 3, z: seed % 5 }, { run: seed });
    const slicers = panel.traps.filter((t) => t.kind === "slicer");
    if (!slicers.length) continue;
    seen += 1;
    assert.ok(P.crossable(panel.grid), `seed ${seed}: a slicer panel cannot be crossed`);
    for (const s of slicers) {
      assert.ok(s.period >= 1.6 && s.period <= 2.6, `slicer beat ${s.period} s`);
      assert.ok(s.closed >= 0.3 && s.closed <= 0.5, `slicer snap ${s.closed} s`);
      assert.ok(s.maxX - s.minX <= 1.01, "a slicer wider than one block");
      let open = 0;
      for (let t = 0; t < s.period; t += 0.01) if (!P.slicerClosedAt(s, t)) open += 1;
      assert.ok(open / (s.period / 0.01) >= 0.7, "the slicer is shut most of the time");
    }
  }
  assert.ok(seen >= 6, `only ${seen} panels with slicers in 200 seeds`);
});

test("the Ring draws the slicers, times them and they hurt with a comic ЧАК!", () => {
  const ring = read("mini-sim/assets/js/ring-platformer.js");
  assert.match(ring, /ring-cell-slicer/, "slicers are not drawn");
  assert.match(ring, /slicerClosedAt\(/, "slicers are not timed in the Ring");
  assert.match(ring, /"ЧАК!"/, "no comic word on a slicer snap");
});
