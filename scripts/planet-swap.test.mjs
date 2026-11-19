// Owner 18.11.2026: "Fable ... полностью поменять местами со стартовой локацией
// OniCSS, чтобы у нас были новейшие разработки в эпицентре ... Твинсан пусть
// полежит в секторе Fable ... раз в сто лет есть послание о том, что планеты
// меняются местами в секторах".
// The start (ONI CSS, and any page without Warp data) lands on Fable; the old
// desert island (Twinsun) lies in the sector north of ONI CSS. Warp, Tower and
// First Planet agree, and the swap is told in the planets' own words.
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

test("ONI CSS and the start land on Fable; the desert lies north of ONI CSS", async () => {
  const w = page();
  const core = w.BCMSageMapCore;
  const oni = core.data.css.find((c) => c.system === "oni");
  const tower = (x, y) => w.BCMPlanetLanding.planetId({ sector: { x, y }, core });
  assert.equal(tower(oni.x, oni.y), "fable", "ONI CSS still lands on the desert");
  assert.equal(w.BCMPlanetLanding.planetId({}), "fable", "a page without Warp data still lands on the desert");
  assert.equal(tower(oni.x, oni.y + 1), "first", "the desert (Twinsun) is not in the sector north of ONI CSS");
  assert.match(core.sectorTitle(oni.x, oni.y + 1), /Twinsun/);
  assert.equal(tower(oni.x - 1, oni.y), "opus", "Opus must stay west of ONI CSS");
  const { resolvePlanetId } = await import("../mini-sim/first-planet/src/game/island/planet.ts");
  const lookups = { systemForSector: core.systemForSector.bind(core), planetForSector: core.planetForSector.bind(core) };
  assert.equal(resolvePlanetId({}), "fable");
  assert.equal(resolvePlanetId({ sector: { x: oni.x, y: oni.y }, ...lookups }), "fable");
  assert.equal(resolvePlanetId({ sector: { x: oni.x, y: oni.y + 1 }, ...lookups }), "first");
  // The owner's test switch still opens any planet by name.
  assert.equal(resolvePlanetId({ search: "?bcm_planet=first" }), "first");
  assert.equal(resolvePlanetId({ search: "?bcm_planet=twinsun" }), "first");
});

test("the planets tell the hundred-year swap", async () => {
  const { planetLook } = await import("../mini-sim/first-planet/src/game/island/planet.ts");
  assert.match(planetLook("fable").blurb, /сто лет/, "Fable does not tell why it is at ONI CSS now");
  assert.match(planetLook("first").blurb, /сто лет/, "the desert does not tell why it moved");
  assert.match(planetLook("first").title, /Twinsun/);
});
