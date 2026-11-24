// Owner 23.11.2026: "по пути к босу должна быть локация, где мы ритмично пользуясь jet pack
// должны пролететь между участками, надо аккуратно жать" (Balloon on NES, old DOS Jetpack).
// RING_PIG_BOSS_ARC.md: ~62 BPM, one press about a second; jet and breath spent together;
// bubbles refill both; if the flight is not kept up the pilot falls into the abyss.
// ring-panels.js builds a purple cell as a flight panel: a pit between two door pads,
// energy gates whose gap drifts up and down, ceiling spikes, rest islands, bubbles.
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

const PILOT_H = 1.7;

test("a purple cell is a flight panel: a pit between two door pads, gates, ceiling spikes, bubbles", () => {
  const P = panels();
  assert.equal(typeof P.buildFlightPanel, "function", "purple cells have no flight panel: just low gravity in a normal room");
  const panel = P.buildFlightPanel(7, { x: 2, y: 1, z: 3 }, { run: 1 });
  const F = panel.flight;
  assert.ok(F.pit.maxX - F.pit.minX >= 10, "the abyss is too short to need the jet");
  assert.ok(F.pit.minX > -panel.half + 1.5 && F.pit.maxX < panel.half - 1.5, "no pad to stand on at the doors");
  assert.ok(F.gates.length >= 2, "nothing to fly between");
  assert.ok(F.bubbles.length >= 1, "no bubble to refill on the way");
  assert.ok(F.ceilingY <= panel.height, "no ceiling spikes: you can fly over everything");
  for (const g of F.gates) {
    for (let t = 0; t < 8; t += 0.05) {
      const gp = P.flightGapAt(g, t);
      assert.ok(gp.y1 - gp.y0 >= PILOT_H + 0.6, "a gate gap narrower than the pilot plus margin");
      assert.ok(gp.y0 >= 0.4 && gp.y1 <= F.ceilingY, "a gate gap outside the room");
    }
  }
});

// Owner 24.11.2026: "с прыжками на перелётных частях не должно быть ограничения в 2 прыжка — чем
// дольше жмёшь прыжок, тем больше он тратится, но в это время персонаж летит". The jet thrusts
// while the button is held and burns fuel per second; a full tank is seconds of flight, not presses.
test("the jet thrusts while held and burns fuel per second: holding about half the time hovers", () => {
  const F = panels().buildFlightPanel(7, { x: 2, y: 1, z: 3 }, { run: 1 }).flight;
  assert.ok(F.thrust > F.gravity * 1.5, `thrust ${F.thrust} m/s² must clearly beat gravity ${F.gravity}`);
  assert.ok(Math.abs(F.thrust / 2 - F.gravity) <= 0.6, "about half the time on the jet holds the altitude");
  const seconds = 100 / F.burn;
  assert.ok(seconds >= 4 && seconds <= 7, `a full tank is ${seconds.toFixed(1)} s of thrust`);
  assert.ok(F.airSpeed >= 2.4 && F.airSpeed <= 4, `air speed ${F.airSpeed} m/s: the crossing is not a rhythm`);
});

test("every generated flight panel can be crossed from any entry moment, and not without the jet", () => {
  const P = panels();
  // flightCrossable (ring-panels.js) searches what a player does every 0.25 s: jet or not,
  // wait / hover / go; 0.15 m clear of gate edges and the ceiling spikes.
  for (let seed = 1; seed <= 16; seed += 1) {
    const panel = P.buildFlightPanel(seed, { x: seed % 5, y: 1, z: seed % 3 }, { run: seed });
    for (const t0 of [0, 0.7, 1.9, 2.6]) {
      const run = P.flightCrossable(panel, t0);
      assert.ok(run.ok, `seed ${seed}, entering at ${t0} s: no clean crossing`);
      assert.ok(run.presses >= 3, `seed ${seed}: crossed with ${run.presses} presses — no flight needed`);
    }
    assert.ok(!P.flightCrossable(panel, 0, { noJet: true }).ok, `seed ${seed}: the abyss is crossed without the jet`);
  }
});

test("the Ring builds purple cells as flight panels and drops a pilot into their pit", () => {
  const ring = read("mini-sim/assets/js/ring-platformer.js");
  assert.match(ring, /BCMRingPanels\.buildFlightPanel\(/, "the Ring never builds a flight panel");
  assert.match(ring, /flightPanel && player\.worldX > path\.flight\.pitMinX && player\.worldX < path\.flight\.pitMaxX/, "the pit of a flight panel still has a floor");
  assert.match(ring, /input\.jump && lowGravity && player\.jetFuel > 0/, "the jet does not thrust while the jump is held");
  assert.match(ring, /player\.jetFuel = Math\.max\(0, player\.jetFuel - burn \* dt\)/, "the jet does not burn fuel per second");
  assert.doesNotMatch(ring, /input\.jumpEdge && lowGravity && player\.jetFuel >= 12/, "the jet is still a fixed hop per press");
  assert.match(ring, /function comicPop\(/, "no comic sound words on the way");
  assert.match(ring, /flightGapAt\(/, "the gates are not drawn or do not hurt");
  assert.match(ring, /ring-flight-gate/, "the gates are not drawn");
});

test("a pilot who dies in a flight panel comes back on a pad, not over the abyss", () => {
  // Edge probe 23.11.2026: after HP 0 in a flight panel the pilot reappeared at the cell's
  // checkpoint — the middle of the pit — and kept taking hits at floor level.
  const ring = read("mini-sim/assets/js/ring-platformer.js");
  const death = ring.slice(ring.indexOf("function damagePlayer("), ring.indexOf("function damagePlayer(") + 1400);
  assert.match(death, /player\.flightPanel && worldState\.cellPath && worldState\.cellPath\.flight/, "death in a flight panel respawns over the abyss");
  assert.match(death, /fl\.pitMinX - 0\.5/);
});
