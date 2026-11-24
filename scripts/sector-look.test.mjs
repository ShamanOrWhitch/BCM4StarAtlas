// Owner 24.11.2026: "неужели нельзя сделать простой космический оригинальный сектор … все сектора
// с планетами, проверенные мной, одинаковые". Every planet sector gets its own space: planet,
// surface, rings, moons, light, sky tint; outside ONI CSS the ONI station sphere and traffic hide.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ROOT = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");

test("every planet has its own sector look, and no two looks are the same", () => {
  const ctx = vm.createContext({ Math, Object, Array, Number, String });
  ctx.window = ctx;
  vm.runInContext(read("mini-sim/assets/js/sector-look.js"), ctx);
  const S = ctx.BCMSectorLook;
  const ids = ["fable", "first", "opus", "pearce", "ioki"];
  const looks = ids.map((id) => S.lookFor(id));
  looks.forEach((look, i) => assert.ok(look, `${ids[i]} has no sector look`));
  const sig = looks.map((l) => [l.surface.kind, l.surface.base, l.nebula, !!l.ring, l.moons.length, l.suns].join("|"));
  assert.equal(new Set(sig).size, ids.length, "two planet sectors look the same");
  assert.equal(new Set(looks.map((l) => l.surface.kind)).size, ids.length, "two planets share one kind of surface");
  assert.equal(S.lookFor("fable").surface.base.toLowerCase(), "#3a1f6e", "Fable is not the purple world");
  assert.equal(S.lookFor("first").suns, 2, "Twinsun has no second sun");
  assert.equal(S.lookFor("first").keepStation, false, "Twinsun keeps the ONI station in its sky");
  assert.equal(S.lookFor("opus").keepStation, false, "Opus keeps the ONI station in its sky");
});

test("the Warp dresses the sector on arrival, ONI CSS dresses Fable, the maze clears it; the page loads the module", () => {
  const warp = read("mini-sim/assets/js/deep-space-warp.js");
  const arrive = warp.slice(warp.indexOf("function arriveAtPlanetSector("), warp.indexOf("function returnToOniCss("));
  assert.match(arrive, /dressSector\(mark && mark\.planet\)/, "a planet sector arrival keeps the ONI CSS scene");
  const z = Number((arrive.match(/engine\.teleport\(\{ x: 0, y: 0, z: (-?[\d.]+)/) || [])[1]);
  assert.ok(z < -84.5, `a planet sector arrival puts the ship back in the start hangar (z ${z})`);
  const home = warp.slice(warp.indexOf("function returnToOniCss("), warp.indexOf("function returnToOniCss(") + 400);
  // 24.11.2026 (owner): ONI CSS keeps its own station and planet — the return clears the sector dress.
  assert.match(home, /dressSector\(null\)/);
  assert.match(warp, /function enterAsteroidMaze\(\) \{[\s\S]{0,200}dressSector\(null\)/);
  const sim = read("mini-sim/assets/js/mini-sim.js");
  assert.match(sim, /BCMSectorLook\.update\(dt\)/);
  assert.doesNotMatch(sim, /BCMSectorLook\.apply\(\{ scene, THREE: window\.THREE \}, "fable"\)/, "ONI CSS is dressed as Fable again");
  const php = read("mini-sim/bcm-mini-sim.php");
  assert.match(php, /'bcm-sector-look', BCM_MINI_SIM_URL \. 'assets\/js\/sector-look\.js'/);
  assert.match(read("tools/minisim-qa/standalone-shell.html"), /sector-look\.js/);
});

// Owner 24.11.2026: "зачем ты планету onicss подставляешь в каждый сектор". The landing gate was the
// ONI CSS video (onicss.mp4) in every sector. Outside ONI CSS the gate's ONI picture is hidden: a planet
// sector gets its own landing beacon and label; a lore sector without a landing planet gets no gate.
test("outside ONI CSS the ONI landing screen is gone: own beacon on planet sectors, no gate in lore sectors", () => {
  const ctx = vm.createContext({ Math, Object, Array, Number, String, Map });
  ctx.window = ctx;
  vm.runInContext(read("mini-sim/assets/js/galia-lore.js"), ctx);
  vm.runInContext(read("mini-sim/assets/js/sector-look.js"), ctx);
  const S = ctx.BCMSectorLook;
  assert.equal(S.lookFor("opus").landing, true, "Opus has no landing of its own");
  assert.equal(S.lookFor("first").landing, true, "Twinsun has no landing of its own");
  assert.equal(S.lookFor("fable").landing, undefined, "ONI CSS keeps its own screen");
  assert.equal(S.lookFor("segal").landing, false, "a lore sector without a planet lands on Fable");
  const src = read("mini-sim/assets/js/sector-look.js");
  assert.match(src, /userData\.facePlayer/, "the ONI landing screen is not found");
  assert.match(src, /sector-landing-beacon/, "no own landing beacon");
  assert.equal(typeof S.landingLabel, "function");
  const sim = read("mini-sim/assets/js/mini-sim.js");
  assert.match(sim, /BCMSectorLook\.landingLabel\(\)/, "the approach still says ONICSS in every sector");
});
