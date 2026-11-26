// Owner 26.11.2026 (live check on Opus): "расположение города и всего остального идентично до сих пор всем
// остальным планетам … у каждой планеты свой дизайн … Opus для того чтобы Opus придумало ему свой дизайн";
// "с редизайна планет персонажей и квестов". Every place on the island was one module constant shared by all
// planets (terrain.ts: HOUSES, NPC, CRYSTALS, KEY_SPOT, BRAZIERS, CHEST, JOURNAL…), and the Opus lines were
// left from an old snow planet. A planet now lays out its own settlement, residents and quest places
// (layout.ts); ONI CSS's Fable and the other planets keep the classic layout until their own step.
import "./lib/first-planet-sim.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ISLAND = "../mini-sim/first-planet/src/game/island/";
const terrain = await import(ISLAND + "terrain.ts");
const { createSim } = await import(ISLAND + "sim.ts");
const { planetContent } = await import(ISLAND + "content.ts");
const { planetLook } = await import(ISLAND + "planet.ts");

function placesOf(planet) {
  terrain.setRelief(planetLook(planet).relief);
  createSim(0, planet);
  const pick = (p) => ({ x: p.x, z: p.z });
  return {
    houses: terrain.HOUSES.map((h) => ({ id: h.id, x: h.x, z: h.z })),
    npc: { sera: pick(terrain.NPC.sera), orr: pick(terrain.NPC.orr), bulb: pick(terrain.NPC.bulb) },
    crystals: terrain.CRYSTALS.map(pick),
    key: pick(terrain.KEY_SPOT),
    braziers: terrain.BRAZIERS.map(pick),
    chest: pick(terrain.CHEST),
    journal: pick(terrain.JOURNAL),
  };
}

const moved = (a, b) => Math.hypot(a.x - b.x, a.z - b.z) > 6;

test("Opus lays out its own settlement and quest places; the classic planets keep theirs", () => {
  const twinsun = placesOf("first");
  const opus = placesOf("opus");
  const fable = placesOf("fable");
  assert.deepEqual(fable, twinsun, "the start planet Fable lost the classic layout");
  const housesMoved = opus.houses.filter((h, i) => moved(h, twinsun.houses[i])).length;
  assert.ok(housesMoved >= 3, `Opus houses stand where Twinsun's do (${housesMoved} of ${opus.houses.length} moved)`);
  for (const slot of ["sera", "orr", "bulb"]) assert.ok(moved(opus.npc[slot], twinsun.npc[slot]), `Opus ${slot} stands on Twinsun's spot`);
  assert.ok(opus.crystals.every((c, i) => moved(c, twinsun.crystals[i])), "the Opus collect places are Twinsun's ridge");
  assert.ok(moved(opus.key, twinsun.key) && moved(opus.chest, twinsun.chest) && moved(opus.journal, twinsun.journal));
  assert.ok(opus.braziers.every((b, i) => moved(b, twinsun.braziers[i])));
});

test("every Opus place stands on dry ground, on its own terrace, and the quests spread over the planet", () => {
  const opus = placesOf("opus");
  const spots = [...opus.crystals, opus.key, ...opus.braziers, opus.chest, ...Object.values(opus.npc)];
  for (const s of spots) {
    const y = terrain.groundY(s.x, s.z);
    assert.ok(y > -0.3, `an Opus place at (${s.x}, ${s.z}) is under water (${y.toFixed(2)})`);
    // Not on a pillar shaft or a cliff: the ground around is walkable.
    const around = [[1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2]].map(([dx, dz]) => terrain.groundY(s.x + dx, s.z + dz));
    assert.ok(Math.max(...around) - Math.min(...around) < 2.2, `an Opus place at (${s.x}, ${s.z}) sits on a cliff`);
  }
  // Each house stands level on its own terrace, not dug down to a valley town.
  for (const h of terrain.HOUSES) {
    const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => terrain.groundY(h.x + sx * h.w * 0.35, h.z + sz * h.d * 0.35));
    assert.ok(Math.max(...corners) - Math.min(...corners) < 0.6, `Opus house ${h.id} stands on a slope`);
  }
  const observatory = terrain.HOUSES.find((h) => h.id === "archive");
  assert.ok(terrain.groundY(observatory.x, observatory.z) > 3.5, "the Opus observatory is not up on the ridge");
  const xs = spots.map((s) => s.x), zs = spots.map((s) => s.z);
  assert.ok(Math.max(...xs) - Math.min(...xs) > 70 && Math.max(...zs) - Math.min(...zs) > 70, "the Opus quests huddle in one valley");
});

test("the Opus residents and quests are Opus's own: limestone, pillars, the carpet and its castle — no old snow", () => {
  const c = planetContent("opus");
  const text = JSON.stringify(c, (k, v) => (typeof v === "function" ? v(2, "X") : v));
  assert.doesNotMatch(text, /снег|лавин|мороз|Заснеж/i, "the Opus lines are left from an old snow planet");
  assert.match(text, /ковёр|ковр/i, "no Opus resident tells about the carpet");
  assert.match(text, /замок|замк/i, "no Opus resident tells about the castle");
  const twinsun = planetContent("first");
  for (const slot of ["sera", "orr", "bulb"]) assert.notEqual(c.residents[slot].name, twinsun.residents[slot].name);
});

test("the castle on the Opus base grows with each upgrade", () => {
  const src = readFileSync(new URL(ISLAND + "opus-look.ts", import.meta.url), "utf8");
  assert.match(src, /castle/i, "the Opus base has no castle");
  assert.match(src, /carpet\.owned\.length/, "the castle does not follow the bought upgrades");
});
