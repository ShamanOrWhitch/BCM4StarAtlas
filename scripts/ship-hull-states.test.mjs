import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const shipRoot = fileURLToPath(new URL("../mini-sim/assets/mesh/ships/", import.meta.url));

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
    "medium/calico_enforcer/ca_enforcer_controls.js",
    "medium/calico_enforcer/ca_enforcer_panel.js",
    "medium/fimbull packlite/packlite_controls.js",
    "medium/fimbull packlite/packlite_panel.js",
    "medium/mamba/fimbul_mamba_controls.js",
    "medium/mamba/fimbul_mamba_panel.js",
    "medium/mamba_ex/fimbul_mamba_ex_controls.js",
    "medium/mamba_ex/fimbul_mamba_ex_panel.js",
    "medium/pearce_f4/pearce_f4_controls.js",
    "medium/pearce_f4/pearce_f4_panel.js",
    "xsmall/maxhog/maxhog_controls.js",
  ];
  for (const relative of required) await access(resolve(shipRoot, relative));
  const panels = required.filter((relative) => relative.endsWith("_panel.js"));
  for (const relative of panels) {
    const panel = await read("mini-sim/assets/mesh/ships/" + relative);
    assert.equal(panel.includes("sliders.forEach"), false, relative + " has no slider renderer");
    assert.equal(panel.includes("controller.setMode(mo.id)"), true, relative + " keeps discrete modes");
  }
  const mini = await read("mini-sim/assets/js/mini-sim.js");
  assert.match(mini, /attachShipScripts\(hull, spec\.file, spec\.controlsFile\)/);
  assert.match(mini, /setMode\("flight"\)/);
  assert.match(mini, /testRearCamera/);
  assert.match(mini, /e.code === "F8"/);
  assert.match(mini, /shipRig.api.setThrust/);
  assert.match(mini, /shipControllerFactories\[leaf\]/);
  assert.match(mini, /function parkCurrentFlightHull\(\)/);
  assert.match(mini, /pivot: current/);
  assert.match(mini, /ship\.visual = null/);
  assert.match(mini, /shipRig.api.setFlightMotion/);
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
  assert.match(mini, /mountFlightHull\(transfer\)/);
  assert.match(mini, /title: "КОСМИЧЕСКИЙ ЛАБИРИНТ — 0\.12\.13"/);
  assert.match(php, /Version: 0\.12\.13/);
});

test("First Planet TV tapes persist in inventory and own exclusive spatial audio", async () => {
  const terrain = await read("mini-sim/tower/first-planet/src/game/island/terrain.ts");
  const sim = await read("mini-sim/tower/first-planet/src/game/island/sim.ts");
  const scene = await read("mini-sim/tower/first-planet/src/game/island/scene.ts");
  const island = await read("mini-sim/tower/first-planet/src/components/desert-island.tsx");
  const embed = await read("mini-sim/tower/first-planet/src/first-planet-embed.tsx");
  assert.match(terrain, /id: "invaders10"/);
  assert.match(terrain, /lq-Invaders\.mp4/);
  assert.match(sim, /tapes: string\[\]/);
  assert.match(sim, /selectedTape: string/);
  assert.match(sim, /selectTape\(id: string\)/);
  assert.match(sim, /this\.tapes\.push\("invaders10"\)/);
  assert.match(sim, /parsed\.chest && !tapes\.includes\("invaders10"\)/);
  assert.match(island, /hud\.tapes\.map/);
  assert.match(scene, /bcm:tape-focus/);
  assert.match(scene, /document\.addEventListener\("fullscreenchange"/);
  assert.match(scene, /const distanceToTape = Math\.hypot\(sim\.x - STORY_BOX\.x/);
  assert.match(embed, /window\.addEventListener\("bcm:tape-focus", focus\)/);
  assert.match(embed, /tapeFocused \? 0 : 0\.42/);
});

test("First Planet uses parked forms at berths and flight forms when the craft moves", async () => {
  const ships = await read("mini-sim/tower/first-planet/src/game/ships.ts");
  const scene = await read("mini-sim/tower/first-planet/src/game/island/scene.ts");
  const sim = await read("mini-sim/tower/first-planet/src/game/island/sim.ts");
  const island = await read("mini-sim/tower/first-planet/src/components/desert-island.tsx");
  const config = await read("mini-sim/tower/first-planet/tsconfig.json");
  assert.match(config, /"resolveJsonModule": true/);
  assert.match(ships, /import SHIP_CATALOG from "\.\.\/\.\.\/\.\.\/\.\.\/assets\/mesh\/ships\/catalog\.json"/);
  assert.match(ships, /CATALOG\.filter\(\(ship\) => ship\.planetDrive\)/);
  assert.match(ships, /CATALOG\.filter\(\(ship\) => !ship\.planetDrive\)/);
  assert.match(ships, /ship\.flight/);
  assert.match(ships, /ship\.parked/);
  assert.match(ships, /PILOT_SHIPS\.filter\(\(ship\) => ship\.planetRace\)/);
  assert.match(ships, /pearce4: "pearce-x4"/);
  assert.match(ships, /busan: "busan-pulse"/);
  assert.match(ships, /x5: "pearce-x5"/);
  assert.match(ships, /arc: "rainbow-arc"/);
  assert.match(ships, /om: "rainbow-om"/);

  assert.match(scene, /parkedFile: spec\.file, flightFile: spec\.flightFile/);
  assert.match(scene, /\.\.\.ASTEROID_SHOW\.map/);
  assert.match(scene, /if \(spec\.flightFile && spec\.flightFile !== spec\.file\)/);
  assert.match(scene, /boarded\.hull\.visible = !blazing \|\| !boarded\.flightHull/);
  assert.match(scene, /boarded\.flightHull\.visible = blazing/);
  const maxhog = await read("mini-sim/assets/mesh/ships/xsmall/maxhog/maxhog_controls.js");
  assert.match(scene, /createMaxhogController/);
  assert.match(scene, /driveController\.setMode\(blazing \? "flight" : "pad"\)/);
  assert.match(scene, /driveController\.setFlightMotion\(sim\.engineForward, sim\.engineVertical\)/);
  assert.match(maxhog, /scope\.createMaxhogControls/);
  assert.match(maxhog, /wheel_" \+ side/);
  assert.match(maxhog, /flame_" \+ side/);
  assert.match(maxhog, /setGroundSpeed: function/);
  assert.match(maxhog, /setFlightMotion: function/);
  assert.match(sim, /flightMode: false/);
  assert.match(sim, /toggleFlightMode\(\)/);
  assert.match(sim, /keys.has\("KeyT"\)/);
  assert.match(sim, /this.engineForward/);
  assert.match(island, /hud.flightMode \? "ЗЕМЛЯ" : "ПОЛЁТ"/);
  assert.match(scene, /loader\.loadAsync\(shipUrl\(near\.flightFile\)\)/);
});


test("ship sidecars load, generic controls exist, and Rainbow settings are isolated per hull", async () => {
  const mini = await read("mini-sim/assets/js/mini-sim.js");
  assert.match(mini, /createGenericShipControls\(hull\)/);
  assert.match(mini, /createGenericShipPanel\(api\)/);
  assert.match(mini, /syncCamoPanel\(hull\)/);
  assert.match(mini, /root\.userData\.bcmCamo/);
  assert.match(mini, /state\.dirty = true/);
  assert.match(mini, /gameOstTracks\.forEach\(\(audio\) => \{[\s\S]*audio\.muted = silent/);
  assert.match(mini, /zone\.el\.muted = silent/);
  assert.doesNotMatch(mini, /const camo = \{/);
  assert.match(mini, /e\.code === "KeyF".*tryTransferDock/s);
  assert.match(mini, /if \(shipId === "opal"\) root\.translateZ\(0\.55\)/);
  assert.match(mini, /i <= 30[\s\S]*api\.dispose/);
});

test("Max Hog starts idle and repeated flight-mode updates do not restart exhaust", async () => {
  const controls = await read("mini-sim/assets/mesh/ships/xsmall/maxhog/maxhog_controls.js");
  assert.match(controls, /var targetThrust = 0;/);
  assert.match(controls, /if \(mode === nextMode\) return api/);
  assert.doesNotMatch(controls, /targetThrust = 0\.7/);
});

test("First Planet separates E/F/V, opens the chest after both fires, and tracks item hand-ins", async () => {
  const sim = await read("mini-sim/tower/first-planet/src/game/island/sim.ts");
  const scene = await read("mini-sim/tower/first-planet/src/game/island/scene.ts");
  const ui = await read("mini-sim/tower/first-planet/src/components/desert-island.tsx");
  assert.match(sim, /const use = keys\.has\("KeyE"\);/);
  assert.match(sim, /const boardKey = keys\.has\("KeyF"\);/);
  assert.match(sim, /const ejectKey = keys\.has\("KeyV"\);/);
  assert.match(sim, /this\.quests\.bulb !== "done" && this\.fireCount\(\) < 2/);
  assert.match(sim, /ejectTape\(\)/);
  assert.match(sim, /kind: "crystal" as const/);
  assert.match(sim, /this\.quests\.sera !== "done"/);
  assert.match(sim, /this\.key && this\.quests\.orr !== "done"/);
  assert.match(ui, /СУМКА/);
  assert.match(ui, /hud\.inventory\.map/);
  assert.match(ui, /V · Извлечь кассету/);
  assert.match(scene, /driveController = boarded \? boarded\.driveController : bikeDriveController/);
  assert.match(scene, /Math\.abs\(sim\.engineForward\)/);
  assert.match(scene, /distanceToTape - 2\) \/ 17\.5/);
  assert.match(scene, /lastTapePhase !== "spent"/);
});
