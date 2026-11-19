// Owner 19.11.2026: the race scenery per planet from the concept sheets in
// art/race-kits ("Да, делай так"): Twinsun desert, Fable lava, Opus ice, Galia
// without a planet keeps the coast. Until Dr Arena's GLB exist the props are
// simple geometry, placed off the road.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import "./lib/first-planet-sim.mjs"; // "@/..." imports, extensionless imports, localStorage

const ROOT = new URL("../", import.meta.url);
const SRC = new URL("mini-sim/first-planet/src/", ROOT).href;
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");
const sim = await import(SRC + "game/sim.ts");
const file = new URL("mini-sim/first-planet/src/game/race-scenery.ts", ROOT);
const scenery = existsSync(file) ? await import(file.href) : null;

const PLANETS = { first: "desert", fable: "lava", opus: "ice", undefined: "coast" };

test("each planet's race has its own scenery, after its concept sheet", () => {
  assert.ok(scenery, "no race scenery: every planet races on the same desert coast");
  const seen = new Map();
  for (const [planet, id] of Object.entries(PLANETS)) {
    const look = scenery.raceSceneryFor(planet === "undefined" ? undefined : planet);
    assert.equal(look.id, id, `${planet} races on ${look.id}`);
    assert.ok(existsSync(new URL(look.sheet, ROOT)), `${look.sheet} is missing`);
    seen.set(id, look);
  }
  const roads = new Set([...seen.values()].map((l) => l.road.surface.join(",")));
  const skies = new Set([...seen.values()].map((l) => l.sky.join(",")));
  assert.equal(roads.size, 4, "two planets share a road colour");
  assert.equal(skies.size, 4, "two planets share a sky");
});

test("the props fit the planet and stand off the road", () => {
  const want = { desert: ["pyramid", "obelisk", "cactus"], lava: ["spire", "vent"], ice: ["pine", "crystal"], coast: ["palm"] };
  for (const [planet, id] of Object.entries(PLANETS)) {
    const p = planet === "undefined" ? undefined : planet;
    const race = sim.createRace(7, p, 1);
    const props = scenery.sceneryProps(race.track, scenery.raceSceneryFor(p), race.seed);
    assert.ok(props.length >= 16, `${id}: only ${props.length} props`);
    const kinds = new Set(props.map((x) => x.kind));
    for (const k of want[id]) assert.ok(kinds.has(k), `${id} has no ${k}`);
    for (const prop of props) {
      let near = Infinity;
      for (const s of race.track.samples) near = Math.min(near, Math.hypot(s.x - prop.x, s.z - prop.z));
      assert.ok(near > race.track.halfWidth + 2 + prop.scale, `${id}: a ${prop.kind} stands on the road (${near.toFixed(1)} m from the centre line)`);
    }
    assert.equal(JSON.stringify(scenery.sceneryProps(race.track, scenery.raceSceneryFor(p), race.seed)), JSON.stringify(props), "the same seed must give the same scenery");
  }
});

test("the race world dresses itself from the planet", () => {
  const world = read("mini-sim/first-planet/src/game/world.ts");
  assert.match(world, /raceSceneryFor\(race\.planet\)/, "the world never asks which planet the race is on");
  assert.match(world, /sceneryProps\(/, "the props are not placed from the scenery");
  assert.match(world, /decor/, "the track props are not kept in one group: a road rebuild doubles them");
});
