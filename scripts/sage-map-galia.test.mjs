// IDEA-014: one SAGE map for Galia and Mini-Sim. Galia src/data is the source;
// Mini-Sim's Warp map names real sectors from it and opens the CSS system the
// way Galia does (ONI CSS → Akenat with the station on orbit).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import vm from "node:vm";

const read = (p) => readFile(new URL(`../${p}`, import.meta.url), "utf8");

test("sage-map.js is generated from Galia and in sync", () => {
  const out = execFileSync(process.execPath, ["--experimental-strip-types", "--no-warnings", "scripts/build-sage-map.mjs", "--check"], { encoding: "utf8" });
  assert.match(out, /in sync/);
});

async function sageCore() {
  const context = vm.createContext({ console, Math, Number, String, Array, Object, JSON });
  context.window = context;
  vm.runInContext(await read("mini-sim/assets/js/sage-map.js"), context);
  vm.runInContext(await read("mini-sim/assets/js/galia-lore.js"), context); // the page loads it first
  context.Map = Map;
  vm.runInContext(await read("mini-sim/assets/js/sage-map-core.js"), context);
  return context.BCMSageMapCore;
}

test("sector names and system lookup come from the Galia map", async () => {
  const core = await sageCore();
  // Owner 23.11.2026: the menus name the planet that stands in a station sector (Fable at ONI).
  assert.equal(core.sectorTitle(-40, 30), "Fable · ONI Central Space Station");
  assert.equal(core.sectorTitle(0, -39), "Pearce · MUD Central Space Station");
  assert.equal(core.sectorTitle(40, 30), "Ioki · Ustur Central Space Station");
  // 24.11.2026: lore sectors carry their Star Atlas names; other stars keep their class.
  assert.equal(core.sectorTitle(-38, 25), "Segal · ONI-4 [-38, 25]");
  assert.match(core.sectorTitle(-36, -7), /^(White Dwarf|Red Dwarf|Solar|Hot Blue|Red Giant) \[-36, -7\]$/);
  assert.equal(core.sectorTitle(-39, 29), "[-39, 29] · пустой сектор");
  const oni = core.systemForSector(-40, 30);
  assert.equal(oni.id, "oni");
  assert.match(oni.planet, /Akenat/);
  assert.ok(oni.markers.some((m) => m.id === "oni-css" && m.placement === "orbit"), "ONI CSS is a station on orbit");
  assert.equal(core.systemForSector(-38, 25), null);
  assert.equal(core.starColor(core.starAt(-38, 25)), core.data.kindColor[core.starAt(-38, 25).kind]);
});

test("Mini-Sim Warp map uses the Galia map, not test cells and hard-coded points", async () => {
  const warp = await read("mini-sim/assets/js/deep-space-warp.js");
  assert.doesNotMatch(warp, /NEIGHBOR CELLS ARE TEST ONLY/, "local navigation still labelled as test-only");
  assert.doesNotMatch(warp, /ЛОКАЛЬНЫЙ ТЕСТ · ONI \/ NEUNO/, "map status still says local test");
  assert.match(warp, /BCMSageMapCore\.sectorTitle\(/, "ring cells are not named after real sectors");
  assert.match(warp, /BCMSageMapCore\.systemForSector\(/, "selecting a CSS does not open its Galia system");
  assert.match(warp, /bcm-warp-system-card/, "no system card in the sector panel");
  const php = await read("mini-sim/bcm-mini-sim.php");
  assert.match(php, /'bcm-sage-map', BCM_MINI_SIM_URL \. 'assets\/js\/sage-map\.js'/);
  assert.match(php, /'bcm-sage-map-core', BCM_MINI_SIM_URL \. 'assets\/js\/sage-map-core\.js'/);
  assert.match(php, /'bcm-deep-space-warp', [^;]*'bcm-sage-map-core'/, "Warp does not depend on the SAGE map");
  const shell = await read("tools/minisim-qa/standalone-shell.html");
  assert.ok(shell.indexOf("sage-map-core.js") > 0, "standalone QA shell does not load the SAGE map");
});
