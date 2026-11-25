// Owner 24.11.2026: "сектора со звёздными базами в стиле Descent ко всем системам; наработки
// построения Seed в астероидах уже есть, просто нужны сектора с разными звёздными базами… в DOS ещё
// на слабых ПК работало всё без лагов". star-base.js plans a modular base from the sector's seed,
// in its faction's style, from a few plain shapes (Descent is a genre reference only).
// The lore sectors arrive in open space with their own sky and their own base.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ROOT = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");

function load(...files) {
  const ctx = vm.createContext({ Math, Object, Array, Number, String, JSON, Map, console });
  ctx.window = ctx;
  for (const f of files) vm.runInContext(read(f), ctx);
  return ctx;
}

test("a base is planned from the sector seed: same seed same base, another seed another base", () => {
  const B = load("mini-sim/assets/js/star-base.js").BCMStarBase;
  assert.ok(B && typeof B.plan === "function", "no star base planner");
  const a = JSON.stringify(B.plan(B.seedFor(-47, 30), "ONI"));
  const b = JSON.stringify(B.plan(B.seedFor(-47, 30), "ONI"));
  const c = JSON.stringify(B.plan(B.seedFor(-38, 25), "ONI"));
  assert.equal(a, b, "the same sector builds a different base on another visit");
  assert.notEqual(a, c, "two sectors of one faction build the same base");
});

test("each faction has its own silhouette; a base stays light for a weak PC", () => {
  const B = load("mini-sim/assets/js/star-base.js").BCMStarBase;
  const kinds = (style) => {
    const counts = {};
    for (let s = 1; s <= 12; s += 1) for (const p of B.plan(s * 7919, style).parts) counts[p.shape] = (counts[p.shape] || 0) + 1;
    return counts;
  };
  const oni = kinds("ONI"), mud = kinds("MUD"), ustur = kinds("Ustur"), mrz = kinds(null);
  assert.ok((oni.torus || 0) + (oni.sphere || 0) > (oni.box || 0), "ONI is not rounded");
  assert.ok((mud.box || 0) > (mud.torus || 0) + (mud.sphere || 0), "MUD is not blocky");
  assert.ok((ustur.octa || 0) > 0 && (ustur.ring || 0) > 0, "Ustur has no star crown");
  assert.ok((mrz.box || 0) > 0 && (mrz.cylinder || 0) > 0, "the MRZ base is not patched from mixed parts");
  for (const style of ["ONI", "MUD", "Ustur", null]) {
    for (let s = 1; s <= 30; s += 1) {
      const plan = B.plan(s * 104729, style);
      assert.ok(plan.parts.length >= 8 && plan.parts.length <= 48, `${style} seed ${s}: ${plan.parts.length} parts`);
      assert.ok(plan.lights >= 2, `${style} seed ${s}: a base without lights`);
    }
  }
});

test("lore sectors have their own sky and base; stations keep theirs; the Warp arrives there in open space", () => {
  const w = load("mini-sim/assets/js/galia-lore.js", "mini-sim/assets/js/sector-look.js");
  const S = w.BCMSectorLook;
  const named = w.BCMGaliaLore.sectors.filter((s) => !/CSS/.test(s.code));
  assert.ok(named.length >= 11);
  const sig = new Set();
  for (const s of named) {
    const look = S.lookFor(s.id);
    assert.ok(look, `${s.name} has no sector look`);
    assert.ok(look.base, `${s.name} has no star base`);
    assert.equal(look.base.faction, s.faction, `${s.name}: base of the wrong faction`);
    sig.add([look.surface.kind, look.surface.base, look.nebula, look.suns].join("|"));
  }
  assert.equal(sig.size, named.length, "two lore sectors look the same");
  assert.equal(S.lookFor("night-window").suns, 0, "Night Window has a sun: its star went out");
  const warp = read("mini-sim/assets/js/deep-space-warp.js");
  const confirm = warp.slice(warp.indexOf("function confirmTubeArrival()"), warp.indexOf("function arriveAtPlanetSector("));
  assert.match(confirm, /else if \(loreSectorFor\(state\.target\)\) arriveAtLoreSector\(state\.target\);/, "a lore sector still opens the asteroid maze");
  assert.match(warp, /function arriveAtLoreSector\([\s\S]{0,1200}dressSector\(lore\.id, sector\)/);
  const php = read("mini-sim/bcm-mini-sim.php");
  assert.match(php, /'bcm-star-base', BCM_MINI_SIM_URL \. 'assets\/js\/star-base\.js'/);
  assert.match(read("tools/minisim-qa/standalone-shell.html"), /star-base\.js/);
});
