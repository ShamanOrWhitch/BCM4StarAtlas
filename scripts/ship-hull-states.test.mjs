import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const shipRoot = resolve(new URL("../mini-sim/assets/mesh/ships/", import.meta.url).pathname);

test("ship catalog contains every uploaded family and each real GLB path resolves", async () => {
  const catalog = JSON.parse(await read("mini-sim/assets/mesh/ships/catalog.json"));
  assert.equal(catalog.families.length, 37, "all 37 ship families are represented");
  assert.equal(
    catalog.families.reduce((sum, ship) => sum + ship.variants.length, 0),
    240,
    "catalog covers all 240 uploaded GLB variants",
  );

  const ids = new Set();
  for (const ship of catalog.families) {
    assert.ok(ship.id && ship.name && ship.flight && ship.parked, "family has identity and both render states");
    assert.ok(!ids.has(ship.id), `duplicate family id: ${ship.id}`);
    ids.add(ship.id);
    assert.ok(ship.variants.includes(ship.flight), `${ship.id} flight form belongs to its family`);
    assert.ok(ship.variants.includes(ship.parked), `${ship.id} parked form belongs to its family`);
    assert.ok(ship.variants.length > 0, `${ship.id} has at least one model`);
    assert.ok(Number(ship.islandLength) > 0 && Number(ship.raceLength) > 0 && Number(ship.yardLength) > 0);
    assert.ok(["xxsmall", "xsmall", "small", "medium", "Large", "Titan"].includes(ship.size));

    for (const relative of ship.variants) {
      await access(resolve(shipRoot, relative));
    }
    for (const stateFiles of Object.values(ship.states || {})) {
      for (const relative of stateFiles) await access(resolve(shipRoot, relative));
    }
  }

  const x5 = catalog.families.find((ship) => ship.id === "pearce-x5");
  assert.equal(x5.flight, "xsmall/pearce_x5/x5_blue_compact_flight.glb");
  assert.equal(x5.parked, "xsmall/pearce_x5/x5_blue_compact_off.glb");

  const racerIds = catalog.families.filter((ship) => ship.planetRace).map((ship) => ship.id);
  assert.equal(racerIds.length, 13, "only road-safe racing hulls enter Shoal Race");
  assert.ok(catalog.families.filter((ship) => !ship.planetDrive).every((ship) => ship.size === "medium" || ship.size === "Large" || ship.size === "Titan"));
});

test("all four medium demo rigs keep their existing controls and panels", async () => {
  const required = [
    "medium/fimbull packlite/packlite_controls.js",
    "medium/fimbull packlite/packlite_panel.js",
    "medium/mamba/fimbul_mamba_controls.js",
    "medium/mamba/fimbul_mamba_panel.js",
    "medium/mamba_ex/fimbul_mamba_ex_controls.js",
    "medium/mamba_ex/fimbul_mamba_ex_panel.js",
    "medium/pearce_f4/pearce_f4_controls.js",
    "medium/pearce_f4/pearce_f4_panel.js",
  ];
  for (const relative of required) await access(resolve(shipRoot, relative));
  const mini = await read("mini-sim/assets/js/mini-sim.js");
  assert.match(mini, /attachShipScripts\(hull, spec\.file\)/);
  assert.match(mini, /setMode\("flight"\)/);
});

test("first-person space picker and orbital yard use paired catalog forms", async () => {
  const mini = await read("mini-sim/assets/js/mini-sim.js");
  const php = await read("mini-sim/bcm-mini-sim.php");
  assert.match(php, /assets\/mesh\/ships\/catalog\.json/);
  assert.match(php, /'shipCatalog'\s*=>\s*\$ship_catalog/);
  assert.match(mini, /Array\.isArray\(config\.shipCatalog\)/);
  assert.match(mini, /createElement\("optgroup"\)/);
  assert.match(mini, /const yard = FLIGHT_SHIPS\.map/);
  assert.match(mini, /assetUrl\(spec\.parkedFile\)/);
  assert.match(mini, /dockedShips\.push\(\{[\s\S]*?id: spec\.id,[\s\S]*?file: spec\.file/);
  assert.match(mini, /mountFlightHull\(\{ id: dock\.id, name: dock\.name, file: dock\.file/);
  assert.match(mini, /title: "КОСМИЧЕСКИЙ ЛАБИРИНТ — 0\.12\.10"/);
  assert.match(php, /Version: 0\.12\.10/);
});

test("First Planet uses parked forms at berths and flight forms when the craft moves", async () => {
  const ships = await read("mini-sim/tower/first-planet/src/game/ships.ts");
  const scene = await read("mini-sim/tower/first-planet/src/game/island/scene.ts");
  const config = await read("mini-sim/tower/first-planet/tsconfig.json");
  assert.match(config, /"resolveJsonModule": true/);
  assert.match(ships, /import SHIP_CATALOG from "\.\.\/\.\.\/\.\.\/\.\.\/assets\/mesh\/ships\/catalog\.json"/);
  assert.match(ships, /CATALOG\.filter\(\(ship\) => ship\.planetDrive\)/);
  assert.match(ships, /CATALOG\.filter\(\(ship\) => !ship\.planetDrive\)/);
  assert.match(ships, /ship\.flight/);
  assert.match(ships, /ship\.parked/);
  assert.match(ships, /PILOT_SHIPS\.filter\(\(ship\) => ship\.planetRace\)/);

  assert.match(scene, /parkedFile: spec\.file, flightFile: spec\.flightFile/);
  assert.match(scene, /\.\.\.ASTEROID_SHOW\.map/);
  assert.match(scene, /if \(spec\.flightFile && spec\.flightFile !== spec\.file\)/);
  assert.match(scene, /boarded\.hull\.visible = !blazing \|\| !boarded\.flightHull/);
  assert.match(scene, /boarded\.flightHull\.visible = blazing/);
  assert.match(scene, /loader\.loadAsync\(shipUrl\(near\.flightFile\)\)/);
});
