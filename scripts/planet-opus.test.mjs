// Owner 17.11.2026: "планету Фейбл надо принести на какой-то ближайший к нам
// сектор ... сделай и свою планету тоже, начни с Tower ... Планета Опус Фокус".
// Fable moves from the diagonal [-39, 31] to the sector straight north of
// ONI CSS [-40, 31]; planet Opus takes the sector straight west [-41, 30].
// The Warp map, Tower and First Planet name the same planet in each sector.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import "./lib/first-planet-sim.mjs";

const ROOT = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");

function page() {
  const c = vm.createContext({ console, Math, Number, String, Array, Object, JSON, Map, Set, URLSearchParams });
  c.window = c;
  vm.runInContext(read("mini-sim/assets/js/sage-map.js"), c);
  vm.runInContext(read("mini-sim/assets/js/sage-map-core.js"), c);
  vm.runInContext(read("mini-sim/assets/js/planet-landing.js"), c);
  return c;
}

test("Fable and Opus sit in the sectors straight next to ONI CSS", () => {
  const w = page();
  const core = w.BCMSageMapCore;
  const oni = core.data.css.find((c) => c.system === "oni");
  const at = (x, y) => w.BCMPlanetLanding.planetId({ sector: { x, y }, core });
  // Owner 18.11.2026 (D-069): Fable took the start at ONI CSS; the desert (Twinsun) lies north.
  assert.equal(at(oni.x, oni.y + 1), "first", "Twinsun is not straight north of ONI CSS");
  assert.equal(at(oni.x, oni.y), "fable", "ONI CSS does not land on Fable");
  assert.equal(at(oni.x - 1, oni.y), "opus", "there is no planet Opus straight west of ONI CSS");
  assert.equal(at(-39, 31), "fable", "the old diagonal sector is an empty sector (start planet)");
  assert.equal(core.systemForSector(oni.x - 1, oni.y), null, "Opus must not pretend to be a SAGE system");
  assert.match(core.sectorTitle(oni.x - 1, oni.y), /Opus/);
});

test("First Planet has an own look for Opus and agrees with Tower on every sector", async () => {
  const planets = await import("../mini-sim/first-planet/src/game/island/planet.ts");
  const look = planets.planetLook("opus");
  assert.equal(look.id, "opus", "First Planet has no Opus profile: Opus lands on the desert");
  assert.notEqual(look.sky.top, planets.planetLook("first").sky.top);
  assert.notEqual(look.sky.top, planets.planetLook("fable").sky.top);
  assert.equal(planets.planetIdFrom("opus"), "opus");
  const w = page();
  const core = w.BCMSageMapCore;
  const lookups = { systemForSector: core.systemForSector.bind(core), planetForSector: core.planetForSector.bind(core) };
  for (let x = -45; x <= -35; x++) for (let y = 25; y <= 35; y++) {
    assert.equal(w.BCMPlanetLanding.planetId({ sector: { x, y }, core }), planets.resolvePlanetId({ sector: { x, y }, ...lookups }), `[${x}, ${y}]`);
  }
});

test("Tower names the Opus landing; the Warp map knows the planet id", () => {
  assert.match(read("mini-sim/tower/assets/js/tower.js"), /opus: "OPUS"/, "Tower lands on Opus as FIRST PLANET");
  assert.match(read("mini-sim/assets/js/deep-space-warp.js"), /opus: "opus"/);
});

test("a Warp arrival in a planet sector does not build the asteroid maze", () => {
  // Owner 18.11.2026: "у позиции Fable тот же астероид со случайным лабиринтом".
  // Browser proof: scripts/warp-round-trip-probe.mjs (jump 5 lands on Fable, planet "fable").
  const warp = read("mini-sim/assets/js/deep-space-warp.js");
  const confirm = warp.slice(warp.indexOf("function confirmTubeArrival()"), warp.indexOf("function arriveAtPlanetSector("));
  assert.match(confirm, /else if \(planetLandmarkFor\(state\.target\)\) arriveAtPlanetSector\(state\.target\);\s*else enterAsteroidMaze\(\);/,
    "every non-ONI sector still opens the asteroid maze, planets included");
});
