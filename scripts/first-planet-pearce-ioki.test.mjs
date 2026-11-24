// Owner 24.11.2026: "на планетах всё одинаково, разница минимальна … планета это всегда что-то
// разное должно быть". Pearce and Ioki stood on the shared desert in other colours. Now Pearce is
// a lake country of green swells with islets off the coast, Ioki a rust crater field with a rift.
// The town, the pad, the bridge and every quest spot stay where they are, dry and reachable.
import { test } from "node:test";
import assert from "node:assert/strict";

const terrain = await import("../mini-sim/first-planet/src/game/island/terrain.ts");
const planets = await import("../mini-sim/first-planet/src/game/island/planet.ts");
const WATER = -0.45;

function sample(id) {
  terrain.setRelief(id);
  const out = [];
  for (let x = -70; x <= 70; x += 5) for (let z = -70; z <= 70; z += 5) out.push(terrain.groundY(x, z));
  return out;
}
function differ(a, b) {
  return a.reduce((s, h, i) => s + Math.abs(h - b[i]), 0) / a.length;
}
function anchors() {
  const t = terrain;
  return [t.SPAWN, t.BIKE_PARK, t.TOWER_GATE, t.KEY_SPOT, t.CHEST, t.JOURNAL, t.LETTER, t.RING, t.JAHMAN, t.STORY_BOX,
    t.BRAZIERS[0], ...t.CRYSTALS, ...Object.values(t.NPC), ...t.TAPES.filter((p) => p.x != null)];
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

test("Pearce and Ioki have their own reliefs, unlike each other and every other planet", () => {
  assert.equal(planets.planetLook("pearce").relief, "pearce", "Pearce stands on the shared desert");
  assert.equal(planets.planetLook("ioki").relief, "ioki", "Ioki stands on the shared desert");
  const all = Object.fromEntries(["desert", "fable", "twinsun", "opus", "pearce", "ioki"].map((id) => [id, sample(id)]));
  for (const id of ["pearce", "ioki"]) {
    for (const other of Object.keys(all)) {
      if (other === id) continue;
      const d = differ(all[id], all[other]);
      assert.ok(d > 0.5, `${id} differs from ${other} by only ${d.toFixed(2)} m on average`);
    }
  }
});

test("Pearce has inland lakes and islets; Ioki has raised crater rims and bowls", () => {
  terrain.setRelief("pearce");
  for (const l of terrain.PEARCE_LAKES) assert.ok(terrain.groundY(l.x, l.z) < WATER, `lake at ${l.x},${l.z} is dry`);
  const islets = terrain.PEARCE_ISLETS.filter(([x, z]) => terrain.groundY(x, z) > 0.4);
  assert.ok(islets.length >= 4, `islets above the sea: ${islets.length}`);
  assert.equal(terrain.regionName(terrain.PEARCE_LAKES[0].x, terrain.PEARCE_LAKES[0].z, 0), "Озёрный край");
  terrain.setRelief("ioki");
  for (const c of terrain.IOKI_CRATERS) {
    const rim = terrain.groundY(c.x + c.r, c.z);
    const bowl = terrain.groundY(c.x, c.z);
    assert.ok(rim - bowl > 1.2, `crater at ${c.x},${c.z}: rim ${rim.toFixed(1)} over bowl ${bowl.toFixed(1)}`);
    assert.ok(bowl > WATER, `crater at ${c.x},${c.z} is flooded`);
  }
  assert.equal(terrain.regionName(terrain.IOKI_CRATERS[0].x, terrain.IOKI_CRATERS[0].z, 0), "Кратерное поле");
});

test("on Pearce and Ioki every quest spot is dry and reachable on foot; the town keeps its level", () => {
  terrain.setRelief("desert");
  const built = [terrain.SPAWN, terrain.TOWER_GATE, terrain.CHEST, terrain.STORY_BOX].map((a) => terrain.groundY(a.x, a.z));
  for (const id of ["pearce", "ioki"]) {
    terrain.setRelief(id);
    const walk = reachable();
    for (const a of anchors()) {
      assert.ok(terrain.groundY(a.x, a.z) > WATER + 0.3, `${id}: ${a.name ?? a.id ?? a.x + "," + a.z} is in water`);
      assert.ok(walk(a.x, a.z), `${id}: ${a.name ?? a.id ?? a.x + "," + a.z} cannot be reached on foot`);
    }
    [terrain.SPAWN, terrain.TOWER_GATE, terrain.CHEST, terrain.STORY_BOX].forEach((a, i) => {
      assert.ok(Math.abs(terrain.groundY(a.x, a.z) - built[i]) < 0.25, `${id}: a built spot moved off its level`);
    });
  }
});
