// Owner 24.11.2026: "я не увидел доработку анимаций хотя бы как в Tower … я просил перебросить
// центральным управлением всё по rig и анимациям в crew-core, но нет этого, и движения и анимации
// в кольце до сих пор другие, изначальные, плохо проработанные, где вместо движения ног вверх-вниз
// движения картинки". crew-core now assembles the whole figure (body without shins + two stepping
// shins) for every level; the Ring and Tower only say where the feet are.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ROOT = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");

function core() {
  const ctx = vm.createContext({ console, Math, Number, String, Array, Object, JSON, Map, Set, Promise });
  ctx.window = ctx;
  vm.runInContext(read("mini-sim/assets/js/crew-rig.js"), ctx);
  vm.runInContext(read("mini-sim/assets/js/crew-core.js"), ctx);
  return ctx.BCMCrewCore;
}

class V { constructor() { this.x = 0; this.y = 0; this.z = 0; } set(x, y, z) { this.x = x; this.y = y; if (z !== undefined) this.z = z; return this; } }
function sprite() {
  return { position: new V(), scale: new V(), center: new V(), visible: true, userData: {}, material: { map: null, rotation: 0, needsUpdate: false } };
}
function tex(w, h) { return { image: { width: w, height: h }, repeat: { x: 1 }, offset: { x: 0 }, wrapS: 0, userData: {} }; }

test("crew-core assembles the figure: body without shins, two shins that step under it", () => {
  const C = core();
  assert.equal(typeof C.applyCrewFigure, "function", "crew-core has no figure assembler");
  assert.equal(typeof C.createCrewLegs, "function", "crew-core does not make the shin sprites");
  const full = tex(200, 400);
  const body = tex(200, 400);
  const shins = [tex(100, 120), tex(100, 120)];
  full.image.getContext = () => null;
  full.userData = { bcmCutoutReady: true, bcmLegParts: {
    image: full.image, splittable: true, kneeY: 0.73, shinTop: 0.7, bodyTexture: body, shinTextures: shins,
    shinWidths: [0.5, 0.5], shinCenters: [-0.25, 0.25], shinHeight: 0.3 } };
  const s = sprite();
  const legs = [sprite(), sprite()];
  const place = (along, y) => ({ x: 10 + along, y, z: 0.45 });
  const tops = [];
  const xs = [];
  for (let i = 0; i < 40; i += 1) {
    C.applyCrewFigure(null, s, legs, { crew: { species: "Human" }, facing: 1, moving: true, grounded: true, vy: 0, speed: 3, index: 0 },
      1 / 30, { texture: full, height: 1.78, feetY: 2, place });
    tops.push(legs[0].position.y - legs[1].position.y);
    xs.push(legs[0].material.rotation);
  }
  assert.equal(s.material.map, body, "the body keeps its own shins: legs are a moving picture");
  assert.equal(legs[0].material.map, shins[0]);
  assert.ok(legs.every((l) => l.visible), "shins hidden");
  assert.ok(Math.abs(s.position.y - 2) < 0.2, `the figure stands on its feet: body at ${s.position.y}`);
  assert.ok(legs[0].position.y < s.position.y + 1.78 * 0.4, "shins hang under the body");
  const swing = Math.max(...xs) - Math.min(...xs);
  assert.ok(swing > 0.15, `shins swing through the stride: ${swing.toFixed(2)} rad`);
  assert.ok(Math.max(...tops) - Math.min(...tops) > 0.005, "the feet lift in turn");
});

test("the Ring and Tower draw the Crew through crew-core's figure, not their own copies", () => {
  const ring = read("mini-sim/assets/js/ring-platformer.js");
  assert.match(ring, /BCMCrewCore\.applyCrewFigure\(/, "the Ring still bobs a single picture");
  assert.match(ring, /BCMCrewCore\.createCrewLegs\(/, "the Ring has no shins");
  const tower = read("mini-sim/tower/assets/js/tower.js");
  assert.match(tower, /BCMCrewCore\.applyCrewFigure\(/, "Tower keeps its own figure assembly");
  assert.doesNotMatch(tower, /crewFigureLayout\(legParts, crewPose\)/, "Tower still lays out the shins itself");
});
