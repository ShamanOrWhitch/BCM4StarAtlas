// Owner 26.11.2026: "По умолчанию дай нам Calico Evac" (in the menu, the choice stays); "к выбору нужно справа
// бы ещё модельку отобразить"; "Armstrong Imp семейство mining кораблей, а не Heavy combat". Browser check of
// the crew menu (standalone, Edge): default calico-evac with its picture; Armstrong Imp under "Mining" with its.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const catalog = JSON.parse(read("mini-sim/assets/mesh/ships/catalog.json"));

test("the IMP family of Armstrong is a mining family, not heavy combat", () => {
  const cat = (id) => catalog.families.find((f) => f.id === id).category;
  for (const id of ["armstrong", "imp-tap", "imp-tip"]) assert.match(cat(id), /^Mining/, `${id} is filed as ${cat(id)}`);
});

test("the crew menu picks Calico Evac first and the choice stays", () => {
  const src = read("mini-sim/assets/js/mini-sim.js");
  const pick = src.slice(src.indexOf("let chosenFlight = FLIGHT_SHIPS.find"), src.indexOf("chosenFlight = pickFleetFlight("));
  assert.ok(pick.indexOf('"calico-evac"') > 0 && pick.indexOf('"calico-evac"') < pick.indexOf('"opal"'), "the menu does not start on Calico Evac");
  assert.match(pick, /BCMMiniCrewSelection\.shipId/, "a chosen ship no longer wins over the default");
  assert.ok(catalog.families.some((f) => f.id === "calico-evac"));
});

test("a 3/4 picture of the chosen hull stands beside the list, without a second WebGL context", () => {
  const src = read("mini-sim/assets/js/mini-sim.js");
  assert.match(src, /data-flight-ship-preview/);
  assert.match(src, /assetUrl\("mesh\/ships\/previews\/" \+ chosenFlight\.id \+ "\.webp"\)/);
  const menu = src.slice(src.indexOf("data-flight-ship-preview"), src.indexOf("function parkDeepSpaceFleet"));
  assert.doesNotMatch(menu, /WebGLRenderer/, "the menu preview opens its own WebGL context");
  let pictures = 0;
  for (const fam of catalog.families) {
    const file = new URL(`../mini-sim/assets/mesh/ships/previews/${fam.id}.webp`, import.meta.url);
    if (!existsSync(file)) continue;
    pictures += 1;
    assert.ok(statSync(file).size < 40000, `${fam.id} preview is heavy`);
  }
  assert.ok(pictures >= catalog.families.length - 4, `only ${pictures} ships have a picture`);
  assert.ok(existsSync(new URL("../mini-sim/assets/mesh/ships/previews/calico-evac.webp", import.meta.url)), "the default ship has no picture");
});
