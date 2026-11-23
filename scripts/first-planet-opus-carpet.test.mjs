// Owner 23.11.2026: "Думаю стоит начать с новой планеты по имени Opus" — the first step of
// IDEA-026 (Magic Carpet as a genre reference, flown on our own ship). Opus gets its own relief
// (limestone terraces, karst pillars, a canyon) and its own flight: the ship hangs over the ground,
// lifts itself over a rise, banks into a turn with lag, can stop and hover. One loop: one base on the
// pad, one resource (sparks, taken only low over the ground), one threat (wardens on the spark nodes),
// height costs energy. Other planets keep the bike flight they have.
import { test } from "node:test";
import assert from "node:assert/strict";

import "./lib/first-planet-sim.mjs"; // "@/..." imports, extensionless imports, localStorage
const terrain = await import("../mini-sim/first-planet/src/game/island/terrain.ts");
const planets = await import("../mini-sim/first-planet/src/game/island/planet.ts");
const input = await import("../mini-sim/first-planet/src/game/input.ts");
const { createSim } = await import("../mini-sim/first-planet/src/game/island/sim.ts");

const DT = 1 / 60;

function opusSim() {
  terrain.setRelief(planets.planetLook("opus").relief);
  const sim = createSim(0, "opus");
  return sim;
}
function fly(sim, keys, seconds, each) {
  input.setForced(keys);
  for (let t = 0; t < seconds; t += DT) {
    sim.step(DT);
    if (each) each(sim);
  }
  input.setForced(null);
}
function boardShip(sim) {
  sim.x = terrain.BIKE_PARK.x;
  sim.z = terrain.BIKE_PARK.z;
  sim.board = () => {
    sim.mode = "bike";
    return true;
  };
  fly(sim, ["KeyF"], DT * 2);
  sim.step(DT);
}

test("Opus has its own relief, not the shared desert and not Fable's or Twinsun's", () => {
  const look = planets.planetLook("opus");
  assert.equal(look.relief, "opus", "planet Opus names its own relief");
  const sample = (id) => {
    terrain.setRelief(id);
    const out = [];
    for (let x = -70; x <= 70; x += 7) for (let z = -70; z <= 70; z += 7) out.push(terrain.groundY(x, z));
    return out;
  };
  const opus = sample("opus");
  for (const other of ["desert", "fable", "twinsun"]) {
    const o = sample(other);
    const diff = opus.reduce((s, h, i) => s + Math.abs(h - o[i]), 0) / opus.length;
    assert.ok(diff > 0.8, `Opus differs from ${other} by ${diff.toFixed(2)} m on average`);
  }
  terrain.setRelief("opus");
  const tall = terrain.OPUS_PILLARS.filter((p) => terrain.groundY(p.x, p.z) > 8);
  assert.ok(tall.length >= 5, `karst pillars stand tall: ${tall.length}`);
  // The pad and the town keep level ground; quest spots stay dry.
  assert.ok(Math.abs(terrain.groundY(0, 38) - 0.48) < 0.25, "the landing pad is level");
  for (const c of terrain.CRYSTALS) assert.ok(terrain.groundY(c.x, c.z) > -0.3, "crystals stay on dry land");
  assert.equal(terrain.regionName(terrain.OPUS_PILLARS[0].x, terrain.OPUS_PILLARS[0].z, 2), "Карстовый лес");
});

test("on Opus the ship flies as a carpet: it lifts over rises, never digs in, banks with lag, can hover", () => {
  const sim = opusSim();
  assert.ok(sim.carpet, "Opus sim has the carpet loop");
  boardShip(sim);
  assert.equal(sim.mode, "bike");
  assert.equal(sim.flightMode, true, "on Opus the ship is airborne at once");
  // Fly at the first pillar: the ship must climb over it, never sink into the ground.
  const p = terrain.OPUS_PILLARS[0];
  sim.yaw = Math.atan2(-(p.x - sim.x), -(p.z - sim.z));
  let minClear = Infinity;
  let maxRoll = 0;
  fly(sim, ["KeyW"], 6, (s) => {
    minClear = Math.min(minClear, s.y - terrain.surfaceY(s.x, s.z));
  });
  assert.ok(minClear > 0.5, `clearance stays above 0.5 m: ${minClear.toFixed(2)}`);
  // Bank: the roll grows over time, not in one frame.
  const before = sim.carpet.roll;
  fly(sim, ["KeyW", "KeyA"], DT);
  const firstFrame = Math.abs(sim.carpet.roll - before);
  fly(sim, ["KeyW", "KeyA"], 0.8, (s) => { maxRoll = Math.max(maxRoll, Math.abs(s.carpet.roll)); });
  assert.ok(firstFrame < 0.05, `bank comes with lag: ${firstFrame.toFixed(3)} rad on the first frame`);
  assert.ok(maxRoll > 0.3, `banks into the turn: ${maxRoll.toFixed(2)} rad`);
  // Let go: the ship stops and hangs.
  fly(sim, [], 5);
  assert.ok(Math.abs(sim.speed) < 0.3, `hovers in place: speed ${sim.speed.toFixed(2)}`);
  const hang = sim.y - terrain.surfaceY(sim.x, sim.z);
  assert.ok(hang > 1 && hang < 12, `hangs over the ground: ${hang.toFixed(2)} m`);
});

test("Opus loop: sparks only low, height costs energy, the base takes sparks and sells an upgrade", () => {
  const sim = opusSim();
  boardShip(sim);
  const c = sim.carpet;
  const spark = c.sparks.find((s) => s.guarded === null);
  assert.ok(spark, "there are free sparks near the base");
  // High over a spark: not taken.
  sim.x = spark.x; sim.z = spark.z; sim.y = terrain.surfaceY(spark.x, spark.z) + 9; sim.vy = 0;
  c.target = 9;
  fly(sim, [], 0.2);
  assert.equal(spark.taken, false, "a spark is not taken from high up");
  // Climb high: energy drains. Stay low: it comes back.
  c.energy = 60;
  fly(sim, ["Space"], 3);
  const high = c.energy;
  assert.ok(high < 60, `climbing high drains energy: ${high.toFixed(1)}`);
  fly(sim, ["KeyQ"], 4);
  fly(sim, [], 2);
  assert.ok(c.energy > high, `low flight restores energy: ${c.energy.toFixed(1)}`);
  // Low over the spark: taken into the hold.
  sim.x = spark.x; sim.z = spark.z; sim.y = terrain.surfaceY(spark.x, spark.z) + 1.6;
  fly(sim, [], 0.2);
  assert.equal(spark.taken, true, "a spark is taken low over the ground");
  assert.equal(c.hold, 1);
  // Over the base: the hold is unloaded into the store.
  c.hold = c.holdCap;
  sim.x = terrain.OPUS_BASE.x; sim.z = terrain.OPUS_BASE.z;
  fly(sim, [], 0.3);
  assert.equal(c.hold, 0, "the base takes the hold");
  assert.ok(c.store >= 4, `the base stores sparks: ${c.store}`);
  const cap = c.holdCap;
  c.store = 20;
  fly(sim, ["KeyE"], DT * 2);
  assert.ok(c.holdCap > cap, `an upgrade bought at the base: hold ${cap} → ${c.holdCap}`);
  assert.ok(c.store < 20, "the upgrade is paid in sparks");
});

test("Opus wardens guard the spark nodes: they fire at a close ship, the ship's bolt puts them down", () => {
  const sim = opusSim();
  boardShip(sim);
  const c = sim.carpet;
  assert.ok(c.wardens.length >= 3, "three spark nodes, each with a warden");
  const w = c.wardens[0];
  assert.ok(c.sparks.some((s) => s.guarded === 0), "the first warden guards sparks");
  // Hang near the warden: it fires, a hit costs a spark and energy.
  c.hold = 3;
  c.energy = 100;
  sim.x = w.x + 10; sim.z = w.z; sim.y = terrain.surfaceY(sim.x, sim.z) + 2;
  let fired = 0;
  fly(sim, [], 6, (s) => { fired = Math.max(fired, s.carpet.enemyBolts.length); });
  assert.ok(fired > 0, "the warden fires at a ship close by");
  assert.ok(c.hold < 3 || c.energy < 100, `a hit costs sparks or energy: hold ${c.hold}, energy ${c.energy.toFixed(0)}`);
  // Face the warden and fire: it goes down for a while.
  sim.yaw = Math.atan2(-(w.x - sim.x), -(w.z - sim.z));
  for (let i = 0; i < 6 && w.down <= 0; i += 1) {
    fly(sim, ["KeyX"], DT * 2);
    fly(sim, [], 0.5);
  }
  assert.ok(w.down > 0, "the ship's bolts put the warden down");
  const bolts = c.enemyBolts.length;
  fly(sim, [], 3);
  assert.ok(c.enemyBolts.length <= bolts, "a downed warden does not fire");
});

test("other planets keep the bike flight: no carpet loop on Fable, Twinsun or Pearce", () => {
  for (const id of ["fable", "first", "pearce"]) {
    terrain.setRelief(planets.planetLook(id).relief);
    assert.equal(createSim(0, id).carpet, null, `${id} has no carpet loop`);
  }
});

test("Opus on foot: every quest spot is dry and reachable from the pad; the ship clears a pillar", () => {
  terrain.setRelief("opus");
  const t = terrain;
  const spots = [
    t.SPAWN, t.BIKE_PARK, t.TOWER_GATE, t.KEY_SPOT, t.CHEST, t.JOURNAL, t.LETTER, t.RING, t.JAHMAN, t.STORY_BOX,
    t.BRAZIERS[0], ...t.CRYSTALS, ...Object.values(t.NPC), ...t.TAPES.filter((p) => p.x != null), t.OPUS_BASE,
  ];
  const size = 161;
  const cell = (v) => Math.round(v) + 80;
  const seen = new Uint8Array(size * size);
  const ok = (cx, cz) => {
    const x = cx - 80, z = cz - 80;
    if (t.footY(x, z, 0) <= -0.45) return false;
    // Too steep to walk: a pillar shaft.
    return Math.abs(t.footY(x + 1, z, 0) - t.footY(x, z, 0)) < 1.6 && Math.abs(t.footY(x, z + 1, 0) - t.footY(x, z, 0)) < 1.6;
  };
  const queue = [[cell(t.SPAWN.x), cell(t.SPAWN.z)]];
  seen[queue[0][1] * size + queue[0][0]] = 1;
  while (queue.length) {
    const [cx, cz] = queue.pop();
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= size || nz >= size || seen[nz * size + nx] || !ok(nx, nz)) continue;
      seen[nz * size + nx] = 1;
      queue.push([nx, nz]);
    }
  }
  for (const p of spots) assert.equal(seen[cell(p.z) * size + cell(p.x)], 1, `reachable on foot: ${p.name ?? p.id ?? JSON.stringify(p)}`);
  // The ship flown at a pillar goes over its top, not through it.
  const sim = opusSim();
  boardShip(sim);
  const pillar = t.OPUS_PILLARS[3];
  sim.x = pillar.x; sim.z = pillar.z + 30; sim.yaw = 0; // facing -z, at the pillar
  let peak = 0;
  let passed = false;
  fly(sim, ["KeyW"], 4, (s) => {
    peak = Math.max(peak, s.y);
    if (Math.hypot(s.x - pillar.x, s.z - pillar.z) < pillar.r) passed = true;
  });
  assert.ok(passed, "the course crosses the pillar");
  assert.ok(peak > pillar.top + 1, `the ship rises over the pillar top ${pillar.top} m: peak ${peak.toFixed(1)} m`);
});

test("Opus: the ship lifts over the lighthouse and houses instead of sticking to them (probe 23.11.2026)", () => {
  const sim = opusSim();
  boardShip(sim);
  // The scene adds the lighthouse as a prop; the test adds a box of the same size on the course.
  const g = terrain.TOWER_GATE;
  sim.addProp({ minX: g.x - 1.6, maxX: g.x + 1.6, minY: 0, maxY: 9, minZ: g.z - 1.6, maxZ: g.z + 1.6 });
  sim.x = g.x; sim.z = g.z + 8; sim.yaw = 0;
  fly(sim, ["KeyW"], 2.5);
  assert.ok(sim.z < g.z - 4, `the ship got past the lighthouse: z ${sim.z.toFixed(1)} (lighthouse at ${g.z})`);
  for (const h of terrain.HOUSES) {
    const s2 = opusSim();
    boardShip(s2);
    s2.x = h.x; s2.z = h.z + 14; s2.yaw = 0;
    fly(s2, ["KeyW"], 2.5);
    assert.ok(s2.z < h.z - 4, `over house ${h.id}: z ${s2.z.toFixed(1)}`);
  }
});

test("Opus step 2–3: a downed warden's node is captured with E; the module earns sparks picked up low", () => {
  const sim = opusSim();
  boardShip(sim);
  const c = sim.carpet;
  const node = c.nodes[1];
  assert.equal(node.owner, "warden", "nodes start held by wardens");
  sim.x = node.x; sim.z = node.z; sim.y = terrain.surfaceY(node.x, node.z) + 3;
  fly(sim, ["KeyE"], DT * 2);
  assert.equal(node.owner, "warden", "a node with a live warden cannot be taken");
  c.wardens[1].down = 20;
  fly(sim, [], 0.1);
  fly(sim, ["KeyE"], DT * 2);
  assert.equal(node.owner, "ship", "E over a node whose warden is down plants our module");
  fly(sim, [], 30);
  assert.equal(c.wardens[1].down > 0 || c.wardens[1].gone, true, "the warden does not come back to a captured node");
  assert.ok(node.bank >= 2, `the module earns sparks: ${node.bank}`);
  c.hold = 0;
  sim.x = node.x; sim.z = node.z; c.target = 1.4;
  fly(sim, [], 1);
  assert.ok(c.hold >= 2 && node.bank === 0, `low over the module its bank goes to the hold: hold ${c.hold}`);
});

test("Opus step 3: a raider flies at a captured node and takes it back unless shot down", () => {
  const sim = opusSim();
  boardShip(sim);
  const c = sim.carpet;
  const node = c.nodes[0];
  node.owner = "ship";
  c.wardens[0].gone = true;
  sim.x = 0; sim.z = 40; // far away at the base
  c.raidIn = 0.1;
  fly(sim, [], 0.3);
  assert.ok(c.raider, "a raid starts");
  assert.equal(c.raider.node, 0);
  fly(sim, [], 40);
  assert.equal(node.owner, "warden", "left alone, the raider takes the node back");
  assert.equal(c.wardens[0].gone, false, "the warden is back");
  // Second raid: shot down on the way.
  node.owner = "ship"; c.wardens[0].gone = true;
  c.raidIn = 0.1;
  fly(sim, [], 0.3);
  const r = c.raider;
  sim.x = r.x; sim.z = r.z + 12; sim.y = r.y; sim.yaw = 0;
  for (let i = 0; i < 12 && c.raider; i += 1) {
    sim.x = c.raider.x; sim.z = c.raider.z + 10; sim.y = c.raider.y; sim.yaw = 0;
    fly(sim, ["KeyX"], DT * 2);
    fly(sim, [], 0.3);
  }
  assert.equal(c.raider, null, "the raider is shot down");
  assert.equal(node.owner, "ship", "the node stays ours");
});
