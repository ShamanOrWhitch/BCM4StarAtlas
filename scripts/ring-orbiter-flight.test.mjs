// Owner 22.11.2026, "Полёт в фазе Орбиты" (RING_PIG_BOSS_ARC.md): the Orbiter phase
// is fought in the same Balloon flight as the purple cells — forward drift,
// impulses with the jet flame, jet fuel and breath spent together, air bubbles
// that refill both, electric clots to fly between; the core is hit in its window.
// Step 2 of D-079: ring-boss-moves.js gives the Orbiter flight, clots and bubbles;
// ring-platformer.js turns low gravity on for the pilots in its arena.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ROOT = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");
const PILOT_HEIGHT = 1.7;

function api() {
  const c = vm.createContext({ Math, Number, Array, Object, JSON, String });
  c.window = c;
  vm.runInContext(read("mini-sim/assets/js/ring-boss-moves.js"), c);
  return c.BCMRingBossMoves;
}

function play(boss, seconds, homeX = 18) {
  const frames = [];
  for (let i = 0; i < seconds * 60; i += 1) {
    frames.push(JSON.parse(JSON.stringify(boss.step(1 / 60, { targetX: homeX - 4 + Math.sin(i / 90) * 3, targetY: 2 }))));
  }
  return frames;
}

test("the Orbiter is a flight fight, the other forms are not", () => {
  const moves = api();
  for (let phase = 1; phase <= 6; phase += 1) {
    const boss = moves.create(phase, { homeX: 18, seed: 5 });
    const out = boss.step(1 / 60, { targetX: 14 });
    if (phase === 3) {
      assert.equal(boss.flight, true, "the Orbiter is fought on foot: no flight");
      assert.equal(out.flight, true);
      assert.ok(out.drift > 0 && out.drift < 3, `forward drift ${out.drift} m/s`);
      assert.ok(out.ceiling >= 7, `flight ceiling ${out.ceiling} m`);
    } else {
      assert.ok(!boss.flight && !out.flight, `${out.form} turns flight on`);
    }
  }
});

test("electric clots cross the arena and always leave a gap to fly through", () => {
  const moves = api();
  const boss = moves.create(3, { homeX: 18, seed: 5 });
  const frames = play(boss, 30);
  const sparks = frames.flatMap((f) => f.hazards.filter((h) => h.kind === "spark"));
  assert.ok(sparks.length > 0, "no electric clots in the Orbiter fight");
  const xs = sparks.map((h) => (h.x0 + h.x1) / 2);
  assert.ok(Math.max(...xs) - Math.min(...xs) > 10, "the clots stand still instead of crossing the arena");
  const heights = new Set(sparks.map((h) => Math.round((h.y0 + h.y1) * 5) / 10));
  assert.ok(heights.size >= 2, "all clots fly at one height");
  for (const f of frames) {
    for (let x = 18 - 9; x <= 18 + 9; x += 0.5) {
      const blocked = f.hazards
        .filter((h) => x + 0.35 > h.x0 && x - 0.35 < h.x1)
        .map((h) => [Math.max(0, h.y0), Math.min(f.ceiling, h.y1)])
        .sort((a, b) => a[0] - b[0]);
      let top = 0, gap = 0;
      for (const [y0, y1] of blocked) { gap = Math.max(gap, y0 - top); top = Math.max(top, y1); }
      gap = Math.max(gap, f.ceiling - top);
      assert.ok(gap >= PILOT_HEIGHT + 0.2, `x ${x}: only ${gap.toFixed(2)} m free between the clots (${f.state})`);
    }
  }
});

test("air bubbles float in the arena, a pilot takes one and it comes back", () => {
  const moves = api();
  const boss = moves.create(3, { homeX: 18, seed: 5 });
  const first = boss.step(1 / 60, { targetX: 14 });
  assert.ok(first.bubbles.length >= 3, `${first.bubbles.length} air bubbles in the Orbiter arena`);
  assert.ok(first.bubbles.some((b) => b.y <= 1.6), "no bubble low enough to reach with an empty jet");
  for (const b of first.bubbles) assert.ok(b.x >= 9 && b.x <= 27 && b.y > 0 && b.y < first.ceiling, "a bubble outside the arena");
  const b = first.bubbles[0];
  assert.equal(boss.collect(b.x + 20, b.y), false, "a bubble is taken from across the arena");
  assert.equal(boss.collect(b.x + 0.3, b.y - 0.2), true, "flying through a bubble does not take it");
  const after = boss.step(1 / 60, { targetX: 14 });
  assert.ok(!after.bubbles.some((x) => x.id === b.id), "a taken bubble is still drawn");
  play(boss, 8);
  const back = boss.step(1 / 60, { targetX: 14 });
  assert.ok(back.bubbles.some((x) => x.id === b.id), "a taken bubble never comes back");
});

test("the Ring flies the Orbiter fight: low gravity, jet impulses, bubbles and clots drawn", () => {
  const ring = read("mini-sim/assets/js/ring-platformer.js");
  assert.match(ring, /moves\.flight/, "the Ring ignores the Orbiter flight: pilots stay on foot");
  assert.match(ring, /bossFlight/, "boss flight does not switch the pilot to low gravity");
  assert.match(ring, /boss\.moves\.collect\(/, "bubbles in the boss arena cannot be taken");
  assert.match(ring, /ring-boss-bubble-/, "bubbles in the boss arena are never drawn");
  assert.match(ring, /"spark"/, "electric clots are drawn like any red hazard");
  assert.match(ring, /out\.drift/, "no forward drift in the flight");
});

test("the camera frames the whole arena in the flight: floor, Orbiter and ceiling", () => {
  // Before: the view centre sat 2.85 m above the pilot; at 8 m the floor tells and
  // the Orbiter (3.4 m) left the frame (probe: bottom 5.3 m at height 8).
  const ring = read("mini-sim/assets/js/ring-platformer.js");
  assert.match(ring, /flight: Math\.max\(Number\(player\.flightFrame\) \|\| 0, boss\)/, "the camera target ignores the flight");
  assert.match(ring, /const arenaY = -0\.6 \+ halfHeight;/, "the flight view does not stand on the arena floor");
  const landscapeHalf = 5.4;
  const arenaY = -0.6 + landscapeHalf;
  assert.ok(arenaY - landscapeHalf <= 0 && arenaY + landscapeHalf >= 8 + 1.7, "landscape frame misses the floor or a pilot at the ceiling");
});

// Owner 23.11.2026 "Пропасть в арене": the Orbiter floor goes away after a warning,
// two ledges stay by the walls; whoever stops flying falls, loses HP and comes back on a ledge.
test("the Orbiter floor gives way after a warning and leaves two ledges", () => {
  const moves = api();
  const boss = moves.create(3, { homeX: 18, seed: 5 });
  const frames = play(boss, 12);
  const firstPit = frames.findIndex((f) => f.pit);
  assert.ok(firstPit > 0, "no pit in the Orbiter arena: the floor stays under the pilot");
  const warned = frames.slice(0, firstPit).filter((f) => f.floorWarn).length / 60;
  assert.ok(warned >= 2, `the floor goes after ${warned.toFixed(2)} s of warning`);
  const f = frames[firstPit + 30];
  assert.ok(f.pit.x0 <= 18 - 8 && f.pit.x1 >= 18 + 8, "the pit does not cover the arena");
  assert.ok(f.ledges.length >= 2, "no ledges to stand on");
  for (const l of f.ledges) assert.ok(l.x1 - l.x0 >= 2.5 && l.x0 >= 18 - 9.5 && l.x1 <= 18 + 9.5, "a ledge is too narrow or out of the arena");
  assert.ok(f.ledges.some((l) => l.x0 < 18) && f.ledges.some((l) => l.x1 > 18), "both ledges on one side");
  const low = f.bubbles.find((b) => b.y <= 1.6) || frames[0].bubbles.find((b) => b.y <= 1.6);
  assert.ok(f.ledges.some((l) => low.x >= l.x0 && low.x <= l.x1), "the low bubble is not over a ledge");
  for (let phase = 1; phase <= 6; phase += 1) {
    if (phase === 3) continue;
    const other = play(moves.create(phase, { homeX: 18, seed: 5 }), 6);
    assert.ok(!other.some((x) => x.pit), `${other[0].form} opens a pit`);
  }
});

test("the Ring drops a pilot into the Orbiter pit and puts them back on a ledge", () => {
  const ring = read("mini-sim/assets/js/ring-platformer.js");
  assert.match(ring, /out\.pit|moves\.pitAt\(/, "the Ring ignores the pit: pilots land on the floor");
  assert.match(ring, /ring-boss-pit/, "the pit is never drawn");
  assert.match(ring, /nearestLedge/, "a fallen pilot is not put back on a ledge");
});
