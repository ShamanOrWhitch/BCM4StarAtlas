// Location walk for the owner, Mini-Sim 0.15.10.
// One coordinate grid: SAGE X/Y from the Galia map. Warp starts at ONI CSS.
// Fable is the north-east neighbour. The asteroid ring is not a second map.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ROOT = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");

function sageCore() {
  const context = vm.createContext({ console, Math, Number, String, Array, Object, JSON });
  context.window = context;
  vm.runInContext(read("mini-sim/assets/js/sage-map.js"), context);
  vm.runInContext(read("mini-sim/assets/js/sage-map-core.js"), context);
  return context.BCMSageMapCore;
}

const planetModule = await import("../mini-sim/first-planet/src/game/island/planet.ts").catch(() => null);

const ROUTE = [
  { name: "ONI CSS", x: -40, y: 30, planet: "first" },
  { name: "Fable", x: -40, y: 31, planet: "fable" },
  { name: "Opus", x: -41, y: 30, planet: "opus" },
  { name: "MUD CSS", x: 0, y: -39, planet: "pearce" },
  { name: "Ustur CSS", x: 40, y: 30, planet: "ioki" },
];

test("the location walk uses one SAGE grid and lands on the named planet", () => {
  assert.ok(planetModule, "First Planet has no planet profiles");
  const { resolvePlanetId } = planetModule;
  const core = sageCore();
  const at = (x, y) => resolvePlanetId({
    sector: { x, y },
    systemForSector: core.systemForSector.bind(core),
    planetForSector: core.planetForSector.bind(core),
  });
  for (const stop of ROUTE) {
    assert.equal(at(stop.x, stop.y), stop.planet, `${stop.name} [${stop.x}, ${stop.y}] did not land on ${stop.planet}`);
  }
  const oni = ROUTE[0];
  const fable = ROUTE[1];
  // Owner 17.11.2026 (D-068): Fable straight north of ONI CSS, no longer on the diagonal.
  assert.equal(fable.x - oni.x, 0, "Fable is not straight north of ONI CSS");
  assert.equal(fable.y - oni.y, 1, "Fable is not one step north of ONI CSS");
  assert.match(core.sectorTitle(fable.x, fable.y), /Fable/);
  assert.equal(core.systemForSector(fable.x, fable.y), null, "Fable must stay a Mini-Sim landmark, not a Galia system");
});

test("the warp menu tells the owner where Fable is when the Galia map is loaded", () => {
  const warp = read("mini-sim/assets/js/deep-space-warp.js");
  assert.match(warp, /Планета Fable — сосед на севере, X -40, Y 31/);
  assert.match(warp, /Планета Fable — один шаг на север: X -40, Y 31/);
  assert.match(warp, /SAGE · КАРТА GALIA · локальная симуляция/);
  assert.doesNotMatch(
    warp,
    /coordsKnown: current\.x != null[\s\S]{0,400}SAGE DATA UNAVAILABLE/,
    "a local arrival with the Galia map still says SAGE data is unavailable"
  );
});

test("warp, asteroid and the ring keep separate seeds", () => {
  const sim = read("mini-sim/assets/js/mini-sim.js");
  assert.match(sim, /deriveLocalLocationSeed\(labyrinthSeed, "warp"\)/);
  assert.match(sim, /deriveLocalLocationSeed\(labyrinthSeed, "asteroid"\)/);
  assert.match(sim, /deriveLocalLocationSeed\(labyrinthSeed, "ring"\)/);
  const labels = ["warp", "asteroid", "ring"];
  assert.equal(new Set(labels).size, labels.length);
});
