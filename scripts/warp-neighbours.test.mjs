// Owner 26.11.2026: "перемещение в warp между секторами должно реально отображаться соседние локации,
// как сейчас из asteroid секторов видно как будто мы рядом с oni css … практически большинство
// секторов … это сектор asteroid". A Warp jump into an asteroid sector put back the ONI CSS home sky
// (dressSector(null)): the ONI landing screen stood there (browser probe scripts/warp-neighbours-probe.mjs
// before: gateShown true, no neighbours; after: no screen, no station, Twinsun / Opus / Fable in their
// direction two jumps off).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

function world() {
  const ctx = vm.createContext({ Math, Number, Array, Object, JSON, String, Map, Set, console });
  ctx.window = ctx;
  for (const file of ["sage-map.js", "galia-lore.js", "sage-map-core.js", "sector-look.js"]) {
    vm.runInContext(read("mini-sim/assets/js/" + file), ctx);
  }
  assert.ok(ctx.BCMSageMap && ctx.BCMSageMap.stars.length > 0, "the Galia map data did not load");
  return ctx;
}

test("an asteroid sector has its own look: no planet, no ONI station, no landing", () => {
  const { BCMSectorLook } = world();
  const look = BCMSectorLook.lookFor("asteroid");
  assert.ok(look, "an asteroid sector falls back to the ONI CSS home sky");
  assert.equal(look.planet, null);
  assert.equal(look.keepStation, false, "the ONI station stays in an asteroid sector");
  assert.ok(!look.landing, "an asteroid sector offers a landing");
});

test("the neighbours of a sector are what the Galia map holds one and two jumps around, in their direction", () => {
  const ctx = world();
  const { BCMSectorLook, BCMSageMapCore } = ctx;
  assert.equal(typeof BCMSectorLook.neighboursOf, "function", "a sector shows no neighbours");
  // One jump south-east of Twinsun [-40, 31] and Opus [-41, 30] lies ONI CSS [-40, 30]; from [-42, 32]:
  const list = BCMSectorLook.neighboursOf(-42, 32);
  const names = list.map((n) => n.name);
  assert.ok(names.some((n) => /Twinsun/.test(n)), "Twinsun two jumps east is not in the sky");
  assert.ok(names.some((n) => /Opus/.test(n)), "Opus is not in the sky");
  for (const n of list) {
    assert.ok(n.ring >= 1 && n.ring <= 2 && n.jumps === n.ring);
    assert.ok(BCMSageMapCore.sectorTitle(n.x, n.y).length > 0);
  }
  // From ONI CSS: Twinsun straight north (ahead, -z), Opus straight west (-x).
  const home = BCMSectorLook.neighboursOf(-40, 30);
  const tw = home.find((n) => /Twinsun/.test(n.name));
  const op = home.find((n) => /Opus/.test(n.name));
  assert.ok(tw && tw.dx === 0 && tw.dy === 1 && tw.jumps === 1);
  assert.ok(op && op.dx === -1 && op.dy === 0);
  const north = BCMSectorLook.neighbourDirection(0, 1, 1);
  const west = BCMSectorLook.neighbourDirection(-1, 0, 1);
  assert.ok(north.z < -0.9 && Math.abs(north.x) < 1e-9 && north.y > 0, "north is not ahead");
  assert.ok(west.x < -0.9 && Math.abs(west.z) < 1e-9, "west is not to the left");
  // Empty sectors stay empty.
  assert.ok(list.every((n) => ["station", "planet", "base", "star"].includes(n.kind)));
});

test("Warp dresses every arrival with its own sector and its neighbours", () => {
  const src = read("mini-sim/assets/js/deep-space-warp.js");
  assert.match(src, /dressSector\("asteroid", state\.target\);/, "an asteroid arrival still puts back the ONI CSS sky");
  assert.doesNotMatch(src, /dressSector\(null\);/, "an arrival still dresses no sector");
  assert.match(src, /look\.showNeighbours\(runtime, Number\(sector\.x\), Number\(sector\.y\)\);/);
  assert.match(src, /dressSector\(mark && mark\.planet, sector\);/);
  assert.match(src, /dressSector\(lore\.id, sector\);/);
  const look = read("mini-sim/assets/js/sector-look.js");
  // Owner 26.11.2026: "только не надо нам подписи оставлять у планет".
  assert.doesNotMatch(look.slice(look.indexOf("function showNeighbours"), look.indexOf("function followCamera")), /Sprite|label/i, "the neighbours carry names in the sky");
});
