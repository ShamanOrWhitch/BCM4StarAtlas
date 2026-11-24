// Owner 23.11.2026: "уровень Twinsun (first planet) не поменялся с Fable". Fable got its own
// relief and sky (IDEA-002 step 3); Twinsun kept the 0.15.4 desert island it shares with
// Pearce and Ioki. Twinsun now has its own level: wind-laid dune crests, three flat-topped
// mesas, a ragged coast, a second sun and drifting sand. Town, pad, bridge and every quest
// spot stay where they are, dry and reachable on foot. (Pearce and Ioki got their own levels in 0.16.18.)
import { test } from "node:test";
import assert from "node:assert/strict";

const terrain = await import("../mini-sim/first-planet/src/game/island/terrain.ts");
const planets = await import("../mini-sim/first-planet/src/game/island/planet.ts");

const N = terrain.TERRAIN_N;
const SPAN = terrain.TERRAIN_SPAN;
const WATER = -0.45;

function land(id) {
  const look = planets.planetLook(id);
  terrain.setRelief(look.relief ?? "desert");
  return look;
}
function grid() {
  const out = [];
  for (let iz = 0; iz <= N; iz++) for (let ix = 0; ix <= N; ix++) out.push(terrain.groundY((ix / N - 0.5) * SPAN, (iz / N - 0.5) * SPAN));
  return out;
}
function anchors() {
  const t = terrain;
  const list = [
    ["spawn", t.SPAWN], ["bike", t.BIKE_PARK], ["tower gate", t.TOWER_GATE], ["key", t.KEY_SPOT],
    ["chest", t.CHEST], ["journal", t.JOURNAL], ["letter", t.LETTER], ["ring", t.RING],
    ["JahMan", t.JAHMAN], ["story box", t.STORY_BOX], ["brazier 0", t.BRAZIERS[0]], // brazier 1 stands at the pond under the bridge
    ...t.CRYSTALS.map((c, i) => [`crystal ${i}`, c]),
    ...Object.entries(t.NPC).map(([id, p]) => [`npc ${id}`, p]),
    ...t.HOUSES.map((h) => [`house ${h.id}`, h]),
    ...t.TAPES.filter((p) => p.x != null).map((p) => [`tape ${p.id}`, p]),
  ];
  return list.map(([name, p]) => ({ name, x: p.x, z: p.z }));
}
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
      const nx = cx + dx, nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= size || nz >= size || seen[nz * size + nx] || !dry(nx, nz)) continue;
      seen[nz * size + nx] = 1;
      queue.push([nx, nz]);
    }
  }
  return (x, z) => seen[cell(z) * size + cell(x)] === 1;
}

test("Twinsun has its own relief: it is not the shared desert any more", () => {
  terrain.setRelief("desert");
  const desert = grid();
  const twinsun = land("first");
  assert.equal(twinsun.relief, "twinsun", "Twinsun still uses the shared desert relief");
  const g = grid();
  let wild = 0, changed = 0;
  for (let iz = 0; iz <= N; iz++) for (let ix = 0; ix <= N; ix++) {
    const x = (ix / N - 0.5) * SPAN, z = (iz / N - 0.5) * SPAN;
    if (Math.hypot(x, z - 12) < 30) continue;
    wild++;
    if (Math.abs(g[iz * (N + 1) + ix] - desert[iz * (N + 1) + ix]) > 0.5) changed++;
  }
  assert.ok(changed / wild > 0.3, `only ${(100 * changed / wild).toFixed(1)}% of the wild ground differs from the desert`);
});

test("Twinsun has three flat-topped mesas and dune crests away from the town", () => {
  land("first");
  assert.ok(Array.isArray(terrain.TWINSUN_MESAS) && terrain.TWINSUN_MESAS.length >= 3, "no mesas");
  for (const m of terrain.TWINSUN_MESAS) {
    const top = [0, 1.5, 3].map((r) => terrain.groundY(m.x + r, m.z));
    assert.ok(top.every((y) => y > 3), `mesa at ${m.x},${m.z} is not raised: ${top.map((y) => y.toFixed(1))}`);
    assert.ok(Math.max(...top) - Math.min(...top) < 0.6, `mesa at ${m.x},${m.z} has no flat top`);
    const foot = terrain.groundY(m.x + m.r + 5, m.z);
    assert.ok(top[0] - foot > 2.5, `mesa at ${m.x},${m.z} has no cliff (${(top[0] - foot).toFixed(1)} m)`);
  }
  // Dune crests: along a line across the wind the ground rises and falls several times.
  const crests = [];
  for (let s = -40; s <= 40; s += 0.5) crests.push(terrain.groundY(40 + s * 0.62, -12 + s * 0.78));
  let peaks = 0;
  for (let i = 1; i < crests.length - 1; i++) if (crests[i] > crests[i - 1] && crests[i] > crests[i + 1] && crests[i] > 0.9) peaks++;
  assert.ok(peaks >= 3, `only ${peaks} dune crests across the wind`);
});

test("on Twinsun every quest spot, house and resident is dry, level and reachable on foot", () => {
  terrain.setRelief("desert");
  const desertAt = new Map(anchors().map((a) => [a.name, terrain.groundY(a.x, a.z)]));
  land("first");
  const canWalk = reachable();
  for (const a of anchors()) {
    const y = terrain.groundY(a.x, a.z);
    assert.ok(y > WATER + 0.3, `${a.name} is in the sea on Twinsun (y ${y.toFixed(2)})`);
    assert.ok(canWalk(a.x, a.z), `${a.name} cannot be reached on foot from the pad on Twinsun`);
  }
  for (const name of ["spawn", "tower gate", ...terrain.HOUSES.map((h) => `house ${h.id}`), "story box", "chest"]) {
    const a = anchors().find((p) => p.name === name);
    const d = Math.abs(terrain.groundY(a.x, a.z) - desertAt.get(name));
    assert.ok(d < 0.2, `${name} sits ${d.toFixed(2)} m off its built height on Twinsun`);
  }
  const mid = (terrain.BRIDGE.z0 + terrain.BRIDGE.z1) / 2;
  assert.ok(terrain.groundY(terrain.BRIDGE.x, mid) < terrain.BRIDGE.deck, "the pond under the bridge is filled in on Twinsun");
  const m = terrain.TWINSUN_MESAS[0];
  assert.match(terrain.regionName(m.x, m.z, 5), /Плато/, "the mesas have no place name");
});

test("Twinsun's sky has two suns and drifting sand; the scene draws the second sun", async () => {
  const look = planets.planetLook("first");
  assert.ok(look.extras && look.extras.twinSun, "Twinsun has one sun");
  assert.ok(look.extras.motes, "no sand drifting over Twinsun");
  const { readFileSync } = await import("node:fs");
  const scene = readFileSync(new URL("../mini-sim/first-planet/src/game/island/scene.ts", import.meta.url), "utf8");
  assert.match(scene, /extras\.twinSun/, "the scene never draws the second sun");
});
