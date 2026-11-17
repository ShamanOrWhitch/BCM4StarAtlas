// IDEA-002 / IDEA-014 step 2: a second planet through a SAGE sector.
// The Warp sector picks the planet through the same Galia map Mini-Sim carries
// (sage-map.js + sage-map-core.js, run as on the page), and First Planet draws
// that planet. MUD CSS → Pearce (Earth-like), Ustur CSS → Ioki (red), elsewhere
// the desert stays.
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

test("the Warp sector chooses the planet through the Galia map", () => {
  assert.ok(planetModule, "First Planet has no planet profiles: every sector lands on the same desert");
  const { resolvePlanetId } = planetModule;
  const core = sageCore();
  const at = (x, y) => resolvePlanetId({ sector: { x, y }, systemForSector: core.systemForSector.bind(core) });
  const mud = core.data.css.find((c) => c.system === "mud");
  const ustur = core.data.css.find((c) => c.system === "ustur");
  const oni = core.data.css.find((c) => c.system === "oni");
  assert.equal(at(mud.x, mud.y), "pearce", "MUD CSS sector still lands on the desert");
  assert.equal(at(ustur.x, ustur.y), "ioki", "Ustur CSS sector still lands on the desert");
  assert.equal(at(oni.x, oni.y), "first", "ONI keeps First Planet");
  assert.equal(at(-39, 29), "first", "an empty sector keeps First Planet");
  assert.equal(resolvePlanetId({}), "first", "no Warp data keeps First Planet");
});

test("owner test switch and explicit context win over the sector", () => {
  assert.ok(planetModule);
  const { resolvePlanetId } = planetModule;
  const core = sageCore();
  const sys = core.systemForSector.bind(core);
  const ustur = { x: 40, y: 30 };
  assert.equal(resolvePlanetId({ search: "?bcm_planet=mud", sector: ustur, systemForSector: sys }), "pearce");
  assert.equal(resolvePlanetId({ contextPlanet: "ioki", search: "?bcm_planet=mud" }), "ioki");
  assert.equal(resolvePlanetId({ sessionPlanet: "ustur" }), "ioki");
  assert.equal(resolvePlanetId({ search: "?bcm_planet=nonsense" }), "first");
});

test("the three planets really look different", () => {
  assert.ok(planetModule);
  const { PLANETS } = planetModule;
  const ids = Object.keys(PLANETS);
  assert.deepEqual(ids.sort(), ["fable", "first", "ioki", "opus", "pearce"]);
  for (const key of ["background", "fog", "sky", "ground", "sea"]) {
    const values = new Set(ids.map((id) => JSON.stringify(PLANETS[id][key])));
    assert.equal(values.size, ids.length, `${key} is the same on two planets`);
  }
  // Pearce is Earth-like: a blue sky and sea, grass inland. Ioki has no water.
  const blue = (c) => (c & 0xff) > ((c >> 16) & 0xff);
  assert.ok(blue(PLANETS.pearce.sky.mid) && blue(PLANETS.pearce.sea.color), "Pearce sky/sea are not blue");
  assert.ok(PLANETS.pearce.ground.greenery > 0.3, "Pearce has no grass");
  assert.equal(PLANETS.ioki.sea.opacity, 1, "Ioki dust basin should not be water");
  assert.equal(PLANETS.first.sky.mid, 0xff7a3a, "First Planet desert sky changed");
});

test("the island draws the chosen planet, and the mount resolves it from the Warp", () => {
  const scene = read("mini-sim/first-planet/src/game/island/scene.ts");
  assert.match(scene, /planetLook\(context\.planet\)/, "scene ignores the planet");
  for (const hard of ["new THREE.Color(0xff7a3c)", "new THREE.Color(0x3d245c)", "new THREE.Color(0xe3924e)", "color: 0x6a3d78"]) {
    assert.ok(!scene.includes(hard), `scene still hard-codes the desert: ${hard}`);
  }
  const island = read("mini-sim/first-planet/src/components/desert-island.tsx");
  assert.match(island, /planet: look\.id/, "island does not pass the planet to the scene");
  assert.match(island, /\{look\.title\}/, "landing card still names the desert on every planet");
  const embed = read("mini-sim/first-planet/src/first-planet-embed.tsx");
  assert.match(embed, /BCMDeepSpaceWarpGetReturnSnapshot/, "mount does not read the Warp sector");
  assert.match(embed, /systemForSector/, "mount does not ask the Galia map which system this is");
  // Mini-Sim provides both on the page First Planet runs in.
  const warp = read("mini-sim/assets/js/deep-space-warp.js");
  assert.match(warp, /window\.BCMDeepSpaceWarpGetReturnSnapshot = /);
  assert.match(read("mini-sim/bcm-mini-sim.php"), /'bcm-sage-map-core'/);
});

// IDEA-002 step 2 (owner 16.11): Fable builds its own planet, with its own
// design, in another sector next to ONI CSS.
test("planet Fable sits one jump from ONI CSS and the Warp map names it", () => {
  const core = sageCore();
  const oni = core.data.css.find((c) => c.system === "oni");
  const fable = (core.landmarks || []).find((l) => l.planet === "fable");
  assert.ok(fable, "the map has no Fable planet sector");
  assert.equal(Math.max(Math.abs(fable.x - oni.x), Math.abs(fable.y - oni.y)), 1, "Fable is not a neighbour of ONI CSS");
  assert.equal(core.starAt(fable.x, fable.y), null, "Fable sits on a real SAGE star");
  assert.equal(core.cssAt(fable.x, fable.y), null, "Fable sits on a station");
  assert.match(core.sectorTitle(fable.x, fable.y), /Fable/, "the Warp map still calls the Fable sector empty");
  assert.equal(core.systemForSector(fable.x, fable.y), null, "Fable must not pose as a Galia system");
  assert.ok(planetModule);
  const { resolvePlanetId } = planetModule;
  const at = (x, y) => resolvePlanetId({
    sector: { x, y },
    systemForSector: core.systemForSector.bind(core),
    planetForSector: core.planetForSector.bind(core),
  });
  assert.equal(at(fable.x, fable.y), "fable", "the Fable sector still lands on the desert");
  assert.equal(at(oni.x, oni.y), "first");
  assert.equal(at(0, -39), "pearce", "MUD still lands on Pearce through planetForSector");
  assert.equal(resolvePlanetId({ search: "?bcm_planet=fable" }), "fable", "owner test switch does not know Fable");
});

test("planet Fable has a design of its own, not a recolour", () => {
  assert.ok(planetModule);
  const { PLANETS } = planetModule;
  const fable = PLANETS.fable;
  assert.ok(fable, "no Fable profile");
  assert.ok(fable.extras && fable.extras.stars > 0, "Fable has no night sky");
  assert.ok(fable.extras.aurora && fable.extras.motes && fable.extras.ring, "Fable has no aurora, light motes or ringed moon");
  assert.ok(fable.extras.seaGlow, "Fable sea does not glow");
  for (const id of ["first", "pearce", "ioki"]) assert.equal(PLANETS[id].extras, undefined, id + " must keep its 0.15.3 look");
  const scene = read("mini-sim/first-planet/src/game/island/scene.ts");
  assert.match(scene, /planet.extras/, "scene does not draw the planet extras");
  const embed = read("mini-sim/first-planet/src/first-planet-embed.tsx");
  assert.match(embed, /planetForSector/, "mount does not ask the map for landmark planets");
  const warp = read("mini-sim/assets/js/deep-space-warp.js");
  assert.match(warp, /sageCore.landmarks/, "Warp map does not draw the landmark");
});
