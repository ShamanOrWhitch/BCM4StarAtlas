// IDEA-002 step 3: planet Fable has its own relief, not the desert island in
// other colours. The town, the pad, the bridge and every quest spot keep their
// place and stay reachable on foot, and the three older planets keep the
// desert relief exactly.
import { test } from "node:test";
import assert from "node:assert/strict";

const terrain = await import("../mini-sim/first-planet/src/game/island/terrain.ts");
const planets = await import("../mini-sim/first-planet/src/game/island/planet.ts");

const N = terrain.TERRAIN_N;
const SPAN = terrain.TERRAIN_SPAN;
const WATER = -0.45; // sim.ts: feet below this are in the sea

function land(planetId) {
  // The scene does the same before it builds the ground and the sim.
  const look = planets.planetLook(planetId);
  if (typeof terrain.setRelief === "function") terrain.setRelief(look.relief ?? "desert");
  return look;
}

function grid() {
  const out = new Float64Array((N + 1) * (N + 1));
  for (let iz = 0; iz <= N; iz++) {
    for (let ix = 0; ix <= N; ix++) {
      out[iz * (N + 1) + ix] = terrain.groundY((ix / N - 0.5) * SPAN, (iz / N - 0.5) * SPAN);
    }
  }
  return out;
}

/** Distance from the island centre to the sea along each of 72 bearings. */
function shore() {
  const radii = [];
  for (let a = 0; a < 72; a++) {
    const t = (a / 72) * Math.PI * 2;
    // The shore is where six metres of sea begin; a puddle inland is not a shore.
    const wet = (r) => terrain.groundY(Math.cos(t) * r, Math.sin(t) * r) <= WATER;
    let r = 30;
    while (r < 84 && !(wet(r) && wet(r + 2) && wet(r + 4) && wet(r + 6))) r += 0.5;
    radii.push(r);
  }
  return radii;
}

function anchors() {
  const t = terrain;
  const list = [
    ["spawn", t.SPAWN], ["bike", t.BIKE_PARK], ["tower gate", t.TOWER_GATE], ["key", t.KEY_SPOT],
    ["chest", t.CHEST], ["journal", t.JOURNAL], ["letter", t.LETTER], ["ring", t.RING],
    ["JahMan", t.JAHMAN], ["story box", t.STORY_BOX], ["brazier 0", t.BRAZIERS[0]],
    ...t.CRYSTALS.map((c, i) => [`crystal ${i}`, c]),
    ...Object.entries(t.NPC).map(([id, p]) => [`npc ${id}`, p]),
    ...t.HOUSES.map((h) => [`house ${h.id}`, h]),
    ...t.TAPES.filter((p) => p.x != null).map((p) => [`tape ${p.id}`, p]),
  ];
  return list.map(([name, p]) => ({ name, x: p.x, z: p.z }));
}

/** Cells a walker can reach from the landing spot, by the sim's own water rule. */
function reachable() {
  const size = 161;
  const cell = (v) => Math.round(v) + 80;
  const seen = new Uint8Array(size * size);
  const dry = (cx, cz) => terrain.footY(cx - 80, cz - 80, 0) > WATER;
  const queue = [[cell(terrain.SPAWN.x), cell(terrain.SPAWN.z)]];
  seen[queue[0][1] * size + queue[0][0]] = 1;
  while (queue.length) {
    const [cx, cz] = queue.pop();
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx;
      const nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= size || nz >= size || seen[nz * size + nx] || !dry(nx, nz)) continue;
      seen[nz * size + nx] = 1;
      queue.push([nx, nz]);
    }
  }
  return (x, z) => seen[cell(z) * size + cell(x)] === 1;
}

test("the shared desert relief itself is unchanged", () => {
  // Sum and weighted sum of the 97 x 97 ground nodes, measured on 0.15.4. Twinsun (0.16.13),
  // Pearce and Ioki (0.16.18, owner 24.11.2026) have their own levels; the desert stays the base.
  for (const id of ["desert"]) {
    terrain.setRelief(id);
    const g = grid();
    let sum = 0;
    let weighted = 0;
    for (let i = 0; i < g.length; i++) {
      sum += g[i];
      weighted += g[i] * ((i % 13) + 1);
    }
    assert.ok(Math.abs(sum - BASE.sum) < 1e-6, `${id}: ground changed, sum ${sum} instead of ${BASE.sum}`);
    assert.ok(Math.abs(weighted - BASE.weighted) < 1e-5, `${id}: ground changed, weighted ${weighted} instead of ${BASE.weighted}`);
  }
});

test("planet Fable has its own relief, shoreline and sea stacks", () => {
  terrain.setRelief("desert"); // the shared desert (Pearce has its own relief since 0.16.18)
  const desert = grid();
  const desertShore = shore();
  land("fable");
  const fable = grid();
  const fableShore = shore();
  let wild = 0;
  let changed = 0;
  for (let iz = 0; iz <= N; iz++) {
    for (let ix = 0; ix <= N; ix++) {
      const x = (ix / N - 0.5) * SPAN;
      const z = (iz / N - 0.5) * SPAN;
      if (Math.hypot(x, z - 12) < 30) continue; // town and pad stay as they are
      wild++;
      const i = iz * (N + 1) + ix;
      if (Math.abs(fable[i] - desert[i]) > 0.5) changed++;
    }
  }
  const share = changed / wild;
  assert.ok(share > 0.3, `Fable ground equals the desert island: only ${(share * 100).toFixed(1)}% of the wild nodes differ by more than 0.5 m`);
  // The desert has its own bays, so compare the two shores bearing by bearing.
  const drift = fableShore.reduce((sum, r, i) => sum + Math.abs(r - desertShore[i]), 0) / fableShore.length;
  assert.ok(drift >= 5, `Fable has the desert shoreline: the shores differ by ${drift.toFixed(1)} m on average, need 5`);
  const spread = Math.max(...fableShore) - Math.min(...fableShore);
  assert.ok(spread >= 14, `Fable shore has no capes and coves: they differ by ${spread} m, need 14`);
  // Sea stacks: dry ground beyond the shore on at least three bearings.
  let stacks = 0;
  for (let a = 0; a < 72; a++) {
    const t = (a / 72) * Math.PI * 2;
    for (let r = fableShore[a] + 3; r < 82; r += 1) {
      if (terrain.groundY(Math.cos(t) * r, Math.sin(t) * r) > 0.3) { stacks++; break; }
    }
  }
  assert.ok(stacks >= 3, `Fable has no islets off the shore: dry ground beyond the shore on ${stacks} bearings`);
});

test("on Fable every quest spot, house and resident is dry, level and reachable on foot", () => {
  terrain.setRelief("desert"); // the shared desert (Pearce has its own relief since 0.16.18)
  const desertAt = new Map(anchors().map((a) => [a.name, terrain.groundY(a.x, a.z)]));
  land("fable");
  const canWalk = reachable();
  for (const a of anchors()) {
    const y = terrain.groundY(a.x, a.z);
    assert.ok(y > WATER + 0.3, `${a.name} is in the sea on Fable (y ${y.toFixed(2)})`);
    assert.ok(canWalk(a.x, a.z), `${a.name} cannot be reached on foot from the landing pad on Fable`);
  }
  // Built places stand on the same flattened ground: walls and doors are placed by it.
  for (const name of ["spawn", "tower gate", ...terrain.HOUSES.map((h) => `house ${h.id}`), "story box", "chest"]) {
    const a = anchors().find((p) => p.name === name);
    const d = Math.abs(terrain.groundY(a.x, a.z) - desertAt.get(name));
    assert.ok(d < 0.2, `${name} sits ${d.toFixed(2)} m off its built height on Fable`);
  }
  // The bridge still spans water-level ground and its deck is the walking height.
  const mid = (terrain.BRIDGE.z0 + terrain.BRIDGE.z1) / 2;
  assert.ok(terrain.groundY(terrain.BRIDGE.x, mid) < terrain.BRIDGE.deck, "the pond under the bridge is filled in on Fable");
  assert.equal(terrain.footY(terrain.BRIDGE.x, mid, 0), terrain.BRIDGE.deck);
  // Places have Fable names, not dunes.
  const names = new Set();
  for (let x = -60; x <= 60; x += 4) for (let z = -60; z <= 60; z += 4) names.add(terrain.regionName(x, z, 0));
  assert.ok(![...names].some((n) => /Дюн|Оазис/.test(n)), `Fable still names desert places: ${[...names].join(", ")}`);
  terrain.setRelief("desert"); // the shared desert (Pearce has its own relief since 0.16.18)
  assert.equal(terrain.regionName(40, 40, 0), "Дюны", "the desert keeps its place names");
});

const BASE = { sum: -5043.754253878074, weighted: -35281.01027595123 };
