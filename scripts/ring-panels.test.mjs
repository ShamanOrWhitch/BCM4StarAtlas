// Owner 19.11.2026: "Ring-комикс" — the Ring cell is an empty box; every cell
// of the asteroid should become a comic panel with its own level, from a random
// generator (IDEA-024, BUG-021 p.5). Step 1: a seeded panel generator (tiers,
// bridges over spikes, steps) whose every platform and both doors can be reached
// with the Ring jump, and a wider, taller cell that is built from it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import vm from "node:vm";

const ROOT = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");
const FILE = "mini-sim/assets/js/ring-panels.js";
const JUMP_UP = 1.6; // Ring jump peak is ~1.84 m (v 8.8, g 21); keep a margin
const JUMP_ACROSS = 2.4;

function api() {
  assert.ok(existsSync(new URL(FILE, ROOT)), "no panel generator: every Ring cell is the same empty box");
  const c = vm.createContext({ Math, Number, Array, Object, JSON, String });
  c.window = c;
  vm.runInContext(read(FILE), c);
  return c.BCMRingPanels;
}

const CELL = (x, y, z) => ({ x, y, z, open: { xn: true, xp: true } });

/** Surfaces the player can stand on: floor parts without spikes, then platforms reached by jumps. */
function reachable(panel) {
  const safeFloor = [];
  let from = -panel.half;
  for (const s of [...panel.spikes].sort((a, b) => a.minX - b.minX)) {
    if (s.minX > from) safeFloor.push({ minX: from, maxX: s.minX, y: 0 });
    from = Math.max(from, s.maxX);
  }
  if (from < panel.half) safeFloor.push({ minX: from, maxX: panel.half, y: 0 });
  const surfaces = [...safeFloor, ...panel.platforms];
  const gap = (a, b) => Math.max(0, Math.max(a.minX, b.minX) - Math.min(a.maxX, b.maxX));
  const seen = new Set([0]); // start: the left end of the floor (left door)
  let grew = true;
  while (grew) {
    grew = false;
    surfaces.forEach((s, i) => {
      if (seen.has(i)) return;
      for (const j of seen) {
        const t = surfaces[j];
        const up = s.y - t.y;
        if ((up <= JUMP_UP && gap(s, t) <= JUMP_ACROSS) || (up < 0 && gap(s, t) <= JUMP_ACROSS + 1)) { seen.add(i); grew = true; break; }
      }
    });
  }
  return { surfaces, seen, safeFloor };
}

test("each cell gets its own panel: tiers, spikes, and the same seed gives the same panel", () => {
  const panels = api();
  const kinds = new Set();
  for (let i = 0; i < 40; i += 1) {
    const cell = CELL(i % 7, i % 3, Math.floor(i / 7));
    const p = panels.buildPanel(1234, cell, { half: 9, height: 6 });
    kinds.add(p.kind);
    assert.ok(p.platforms.length >= 3, `cell ${i}: ${p.platforms.length} platforms`);
    assert.ok(Math.max(...p.platforms.map((x) => x.y)) >= 3, `cell ${i}: no upper tier`);
    for (const pl of p.platforms) {
      assert.ok(pl.minX >= -p.half + 0.3 && pl.maxX <= p.half - 0.3, `cell ${i}: platform outside the cell`);
      assert.ok(pl.y <= p.height - 1.9, `cell ${i}: platform under the ceiling (y ${pl.y})`);
    }
    assert.equal(JSON.stringify(panels.buildPanel(1234, cell, { half: 9, height: 6 })), JSON.stringify(p));
  }
  assert.ok(kinds.size >= 3, `only ${kinds.size} panel kinds: ${[...kinds].join(", ")}`);
  assert.notEqual(JSON.stringify(panels.buildPanel(1234, CELL(1, 1, 1), { half: 9, height: 6 })), JSON.stringify(panels.buildPanel(1234, CELL(2, 1, 1), { half: 9, height: 6 })));
});

test("every platform and both doors can be reached with the Ring jump; spikes never seal a door", () => {
  const panels = api();
  for (let seed = 1; seed <= 25; seed += 1) {
    for (let i = 0; i < 12; i += 1) {
      const p = panels.buildPanel(seed * 7919, CELL(i, i % 3, seed % 5), { half: 9, height: 6 });
      const { surfaces, seen, safeFloor } = reachable(p);
      surfaces.forEach((s, k) => assert.ok(seen.has(k), `seed ${seed} cell ${i}: ${p.kind} surface at y ${s.y} x ${s.minX.toFixed(1)}..${s.maxX.toFixed(1)} cannot be reached`));
      assert.ok(safeFloor[0].minX <= -p.half + 0.01 && safeFloor[0].maxX >= -p.half + 1.6, `seed ${seed} cell ${i}: spikes at the left door`);
      const last = safeFloor[safeFloor.length - 1];
      assert.ok(last.maxX >= p.half - 0.01 && last.minX <= p.half - 1.6, `seed ${seed} cell ${i}: spikes at the right door`);
    }
  }
});

test("the Ring cell is wider and taller and is built from the panel", () => {
  const warp = read("mini-sim/assets/js/deep-space-warp.js");
  assert.match(warp, /const ROOM_HALF = 9;/, "the cell is still 12 m wide");
  assert.match(warp, /BCMRingPanels\.buildPanel\(/, "the cell never asks for a panel");
  assert.match(warp, /cellPanel: true/, "panel platforms are not marked, a new cell cannot replace them");
  assert.match(warp, /ring-cell-spikes/, "spikes are never drawn");
  assert.match(warp, /onSpikes|spikeHit/, "spikes do not hurt");
  assert.match(read("mini-sim/bcm-mini-sim.php"), /'bcm-ring-panels'[\s\S]{0,120}ring-panels\.js/);
  assert.match(read("tools/minisim-qa/standalone-shell.html"), /ring-panels\.js/);
});
