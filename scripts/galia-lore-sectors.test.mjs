// Owner 24.11.2026: "особенно важно применить эти имена и названия секторов где-то внутри реальной
// карты, которая у нас сейчас разрабатывается… её сверху видно в меню Warp"; "нужно для нормальных
// квестов и диалогов". The Star Atlas lore places its sectors at coordinates that match the stars of
// our Galia map exactly. The Warp map names them from the lore instead of a star class.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ROOT = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");

function page() {
  const ctx = vm.createContext({ console, Math, Number, String, Array, Object, JSON, Map });
  ctx.window = ctx;
  vm.runInContext(read("mini-sim/assets/js/sage-map.js"), ctx);
  vm.runInContext(read("mini-sim/assets/js/galia-lore.js"), ctx);
  vm.runInContext(read("mini-sim/assets/js/sage-map-core.js"), ctx);
  return ctx;
}

test("every lore sector sits on a real star or station of our Galia map", () => {
  const w = page();
  const lore = w.BCMGaliaLore;
  assert.ok(lore && lore.sectors.length >= 14, "no lore sector registry");
  for (const s of lore.sectors) {
    const star = w.BCMSageMapCore.starAt(s.x, s.y);
    const css = w.BCMSageMapCore.cssAt(s.x, s.y);
    assert.ok(star || css, `${s.name} [${s.x}, ${s.y}] is not on the Galia map`);
    assert.ok(["ONI", "MUD", "Ustur", null].includes(s.faction), `${s.name}: unknown faction`);
    assert.ok(["SZ", "MRZ", "HRZ"].includes(s.zone), `${s.name}: unknown zone`);
    assert.ok(s.about && s.about.length > 20, `${s.name}: no description for quests and dialogue`);
  }
});

test("the Warp map names lore sectors by their lore names; stations and planets keep theirs", () => {
  const core = page().BCMSageMapCore;
  assert.equal(core.sectorTitle(-47, 30), "Night Window · ONI-5 [-47, 30]");
  assert.equal(core.sectorTitle(-38, 25), "Segal · ONI-4 [-38, 25]");
  assert.equal(core.sectorTitle(-18, 23), "Everstorm · MRZ-25 [-18, 23]");
  assert.equal(core.sectorTitle(31, -19), "Old Grove · MRZ-11 [31, -19]");
  assert.equal(core.sectorTitle(38, 25), "Azum · Francor [38, 25]");
  assert.equal(core.sectorTitle(-40, 30), "Fable · ONI Central Space Station");
  assert.match(core.sectorTitle(-40, 31), /Twinsun/);
  const night = core.loreAt(-47, 30);
  assert.equal(night.faction, "ONI");
  assert.match(night.about, /ночь/);
  assert.equal(core.loreAt(-39, 29), null);
});

test("the Warp galaxy map draws the lore names on its canvas", () => {
  const warp = read("mini-sim/assets/js/deep-space-warp.js");
  assert.ok(warp.includes("sageCore.loreAt(star.x, star.y)"), "the map canvas still shows only star classes");
  assert.ok(warp.includes("g.fillText(zoom >= 4 ? lore.name"), "the map does not write the lore name");
});

test("the page loads galia-lore.js before the map core; the lore notes are in the repo", () => {
  const php = read("mini-sim/bcm-mini-sim.php");
  assert.match(php, /'bcm-galia-lore', BCM_MINI_SIM_URL \. 'assets\/js\/galia-lore\.js'/);
  assert.match(read("tools/minisim-qa/standalone-shell.html"), /galia-lore\.js[\s\S]*sage-map-core\.js/);
  const notes = read("mini-sim/LORE_CORE.md");
  for (const word of ["Gyun", "Moda", "Timpo", "Osia", "Huricanno", "Mondra 7", "Seven Steps", "Iris"]) assert.match(notes, new RegExp(word));
});
