// Owner 16.11.2026: "2 videos landing on 2 planets — connect them as the
// bridge to the planet, like the ONI CSS landing". The Tower → planet bridge
// plays the clip of the planet the ship lands on: Fable → landing-fable.mp4,
// Pearce (MUD) → landing-pearce.mp4, every other planet keeps onicss.mp4.
// The ascent back to space plays the same clip reversed, and First Planet
// receives the same planet, so the clip and the island always match.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import vm from "node:vm";

const ROOT = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");
const has = (p) => existsSync(new URL(p, ROOT));

const CONFIG = {
  planetTransition: "assets/onicss.mp4",
  planetTransitions: { fable: "assets/landing-fable.mp4", pearce: "assets/landing-pearce.mp4" },
};

/** The page as Mini-Sim builds it: Galia map, map core, then the landing picker. */
function page(extra = {}) {
  const context = vm.createContext({ console, Math, Number, String, Array, Object, JSON, URLSearchParams, ...extra });
  context.window = context;
  vm.runInContext(read("mini-sim/assets/js/sage-map.js"), context);
  vm.runInContext(read("mini-sim/assets/js/sage-map-core.js"), context);
  if (has("mini-sim/assets/js/planet-landing.js")) vm.runInContext(read("mini-sim/assets/js/planet-landing.js"), context);
  return context;
}

test("Tower config carries a landing clip for Fable and Pearce; ONI keeps onicss.mp4", () => {
  const php = read("mini-sim/tower/bcm-tower.php");
  assert.match(php, /'planetTransition'\s*=>[^\n]*onicss\.mp4/, "the ONI CSS clip must stay the default bridge");
  const block = php.match(/'planetTransitions'\s*=>\s*array_filter\(array\(([\s\S]*?)\)\)/);
  assert.ok(block, "Tower has one bridge clip for every planet: only 'planetTransition' => onicss.mp4");
  assert.match(block[1], /'fable'\s*=>[^\n]*landing-fable\.mp4/);
  assert.match(block[1], /'pearce'\s*=>[^\n]*landing-pearce\.mp4/);
  for (const file of ["landing-fable.mp4", "landing-pearce.mp4"]) {
    assert.ok(has(`mini-sim/assets/${file}`), `${file} is not in the plugin assets`);
  }
  // The picker loads before Tower, on the Tower page and in the standalone QA shell.
  assert.match(php, /'bcm-planet-landing'[\s\S]{0,200}planet-landing\.js/);
  assert.match(php, /'bcm-tower',\s*BCM_TOWER_URL \. 'assets\/js\/tower\.js',\s*array\([^)]*'bcm-planet-landing'/);
  const qa = read("scripts/minisim-standalone-qa.mjs");
  assert.match(qa, /planetTransitions:\s*\{[\s\S]{0,200}landing-fable\.mp4/);
  assert.match(read("tools/minisim-qa/standalone-shell.html"), /planet-landing\.js[\s\S]*bcm-tower-js/);
});

test("the bridge clip follows the planet the Warp sector picks", () => {
  const w = page();
  const landing = w.BCMPlanetLanding;
  assert.ok(landing, "Tower picks the bridge clip without knowing the planet: every planet lands with onicss.mp4");
  const at = (x, y) => landing.clipFor(CONFIG, landing.planetId({ sector: { x, y }, core: w.BCMSageMapCore }));
  const mud = w.BCMSageMapCore.data.css.find((c) => c.system === "mud");
  const ustur = w.BCMSageMapCore.data.css.find((c) => c.system === "ustur");
  const oni = w.BCMSageMapCore.data.css.find((c) => c.system === "oni");
  assert.equal(at(-40, 31), CONFIG.planetTransitions.fable, "Fable sector lands with the ONI CSS clip");
  assert.equal(at(mud.x, mud.y), CONFIG.planetTransitions.pearce, "MUD CSS sector lands with the ONI CSS clip");
  assert.equal(at(ustur.x, ustur.y), CONFIG.planetTransition, "Ioki has no own clip yet and keeps the ONI CSS one");
  assert.equal(at(oni.x, oni.y), CONFIG.planetTransition);
  assert.equal(landing.clipFor(CONFIG, landing.planetId({})), CONFIG.planetTransition, "no Warp data keeps the ONI CSS clip");
  assert.equal(landing.clipFor({ planetTransition: "x.mp4" }, "fable"), "x.mp4", "an old Tower config without planetTransitions keeps working");
  // Owner test switch, as on First Planet.
  assert.equal(landing.planetId({ search: "?bcm_planet=fable", sector: { x: oni.x, y: oni.y }, core: w.BCMSageMapCore }), "fable");
  // On the page the picker reads the same globals First Planet reads.
  const live = page({
    location: { search: "" },
    BCMMiniSimSession: {},
    BCMDeepSpaceWarpGetReturnSnapshot: () => ({ current: { x: -40, y: 31 } }),
  });
  assert.equal(live.BCMPlanetLanding.planetId(), "fable", "on the page the picker ignores the Warp sector");
});

test("Tower and First Planet choose the same planet for every input", async () => {
  const { resolvePlanetId } = await import("../mini-sim/first-planet/src/game/island/planet.ts");
  const w = page();
  const landing = w.BCMPlanetLanding;
  assert.ok(landing);
  const core = w.BCMSageMapCore;
  const lookups = {
    systemForSector: core.systemForSector.bind(core),
    planetForSector: core.planetForSector.bind(core),
  };
  const mismatches = [];
  for (let x = -50; x <= 50; x++) {
    for (let y = -50; y <= 50; y++) {
      const a = landing.planetId({ sector: { x, y }, core });
      const b = resolvePlanetId({ sector: { x, y }, ...lookups });
      if (a !== b) mismatches.push(`[${x}, ${y}] Tower ${a}, First Planet ${b}`);
    }
  }
  for (const search of ["?bcm_planet=mud", "?bcm_planet=ustur", "?bcm_planet=fable", "?bcm_planet=oni", "?bcm_planet=nope"]) {
    const a = landing.planetId({ search, sector: { x: 40, y: 30 }, core });
    const b = resolvePlanetId({ search, sector: { x: 40, y: 30 }, ...lookups });
    if (a !== b) mismatches.push(`${search}: Tower ${a}, First Planet ${b}`);
  }
  for (const session of ["fable", "earth", "", "mars"]) {
    const a = landing.planetId({ sessionPlanet: session, core });
    const b = resolvePlanetId({ sessionPlanet: session, ...lookups });
    if (a !== b) mismatches.push(`session ${session}: Tower ${a}, First Planet ${b}`);
  }
  assert.deepEqual(mismatches.slice(0, 8), [], `${mismatches.length} inputs land on a different planet than the clip shows`);
});

test("Tower plays the planet clip on landing, reversed on ascent, and tells First Planet the planet", () => {
  const tower = read("mini-sim/tower/assets/js/tower.js");
  const handoff = tower.slice(tower.indexOf("function beginFirstPlanetHandoff()"), tower.indexOf("function updateHud()"));
  assert.ok(handoff.length > 100);
  assert.doesNotMatch(handoff, /String\(CONFIG\.planetTransition \|\| ""\)/, "the landing still plays onicss.mp4 on every planet");
  assert.match(handoff, /landingClip\(/);
  const reverse = tower.slice(tower.indexOf("function beginReverseSpaceLabyrinthReturn()"), tower.indexOf("function currentPlanetDetail("));
  assert.ok(reverse.length > 100);
  assert.doesNotMatch(reverse, /String\(CONFIG\.planetTransition \|\| ""\)/, "the ascent still plays onicss.mp4 reversed on every planet");
  assert.match(reverse, /landingClip\(/);
  const detail = tower.slice(tower.indexOf("function currentPlanetDetail("), tower.indexOf("function queuePlanetPreload("));
  assert.match(detail, /planet:\s*landingPlanet\(\)/, "First Planet is not told which planet the clip showed");
  const ascent = tower.slice(tower.indexOf("window.BCMTowerAPI.beginAscent"), tower.indexOf("window.BCMTowerAPI.mount"));
  assert.doesNotMatch(ascent, /transitionVideo\.src = CONFIG\.planetTransition/, "the ascent preloads the ONI CSS clip instead of the planet's");
});
