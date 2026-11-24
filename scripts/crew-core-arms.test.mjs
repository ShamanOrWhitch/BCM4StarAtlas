// Owner 25.11.2026: "я не знаю кто сделает кости рук к примеру" (BUG-032, IDEA-027 step 4).
// Tower and the Ring drew the Crew's arms as part of one still picture: only the shins stepped.
// crew-core now cuts each forearm at the elbow where the NFT art shows a see-through gap between
// the arm and the body, and swings it from the elbow with the walking rig — the same way the shins
// hang from the knee. Art with arms pressed to the body stays one piece (no torn torso).
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

// A 100×200 cut-out: torso, two legs, two arms that join the shoulders and hang free below.
function figure({ gap = true, tail = false } = {}) {
  const w = 100, h = 200;
  const px = new Uint8ClampedArray(w * h * 4);
  const fill = (x0, x1, y0, y1) => {
    for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) px[(y * w + x) * 4 + 3] = 255;
  };
  fill(42, 58, 4, 29);      // head
  fill(35, 65, 30, 150);    // torso
  fill(38, 48, 150, 199);   // left leg
  fill(52, 62, 150, 199);   // right leg
  fill(22, 30, 40, 112);    // left arm
  fill(70, 78, 40, 112);    // right arm
  fill(31, 34, 40, gap ? 62 : 112); // shoulder joins the arm; below it the arm hangs free
  fill(66, 69, 40, gap ? 62 : 112);
  if (tail) {
    for (let y = 40; y <= 112; y += 1) for (let x = 0; x < w; x += 1) if (x < 35 || x > 65) px[(y * w + x) * 4 + 3] = 0;
    fill(20, 28, 95, 125);  // a tail hanging free beside the hip, joined to nothing above
  }
  return { px, w, h };
}

test("crew-core finds a forearm where the art shows a gap between the arm and the body", () => {
  const C = core();
  assert.equal(typeof C.measureArmGaps, "function", "crew-core does not measure the arms");
  const { px, w, h } = figure();
  const arms = C.measureArmGaps(px, w, h, "Human");
  assert.equal(arms.length, 2);
  for (const [i, arm] of arms.entries()) {
    assert.ok(arm.splittable, `arm ${i} not cut although the gap is clear`);
    assert.ok(Math.abs(arm.elbowY - 63 / h) < 0.03, `arm ${i}: elbow at ${(arm.elbowY * h).toFixed(0)} px, the gap opens at 63`);
    assert.ok(arm.bottom >= 112 / h - 0.01, `arm ${i}: the hand is cut off at ${(arm.bottom * h).toFixed(0)} px`);
    const elbowX = arm.x0 + arm.pivotX * (arm.x1 - arm.x0);
    assert.ok(Math.abs(elbowX * w - (i ? 74.5 : 26.5)) < 1.5, `arm ${i}: turns about x=${(elbowX * w).toFixed(1)}, the arm is at ${i ? 74.5 : 26.5}`);
  }
  assert.ok(arms[0].x1 <= 35 / w && arms[0].x1 > 30 / w, `left cut at ${arms[0].x1 * w}px runs into the torso`);
  assert.ok(arms[1].x0 >= 65 / w && arms[1].x0 < 70 / w, `right cut at ${arms[1].x0 * w}px runs into the torso`);
});

test("a tail beside the hip is not an arm", () => {
  const C = core();
  const { px, w, h } = figure({ tail: true });
  const arms = C.measureArmGaps(px, w, h, "Human");
  assert.ok(!arms[0].splittable, "a tail that starts below the shoulder is cut as a forearm");
});

test("arms pressed to the body stay part of the body", () => {
  const C = core();
  const { px, w, h } = figure({ gap: false });
  const arms = C.measureArmGaps(px, w, h, "Human");
  assert.ok(arms.every((a) => !a.splittable), "a torso with no gap is torn into pieces");
});

class V { constructor() { this.x = 0; this.y = 0; this.z = 0; } set(x, y, z) { this.x = x; this.y = y; if (z !== undefined) this.z = z; return this; } }
function sprite() {
  return { position: new V(), scale: new V(), center: new V(), visible: true, renderOrder: 8, userData: {}, material: { map: null, rotation: 0, needsUpdate: false } };
}
function tex(w, h) { return { image: { width: w, height: h }, repeat: { x: 1 }, offset: { x: 0 }, wrapS: 0, userData: {} }; }
const THREE = {
  Sprite: class { constructor(material) { Object.assign(this, sprite()); this.material = material; } },
  SpriteMaterial: class { constructor(o) { Object.assign(this, { map: null, rotation: 0 }, o); } }
};

function rigged() {
  const full = tex(200, 400);
  full.image.getContext = () => null;
  const body = tex(200, 400);
  full.userData = { bcmCutoutReady: true, bcmLegParts: {
    image: full.image, splittable: true, kneeY: 0.73, shinTop: 0.7, bodyTexture: body, shinTextures: [tex(100, 120), tex(100, 120)],
    shinWidths: [0.5, 0.5], shinCenters: [-0.25, 0.25], shinHeight: 0.3,
    arms: [
      { texture: tex(20, 100), center: -0.36, width: 0.1, top: 0.3, height: 0.26, pivotX: 0.7 },
      { texture: tex(20, 100), center: 0.36, width: 0.1, top: 0.3, height: 0.26, pivotX: 0.3 }
    ] } };
  return { full, body };
}

test("the forearms swing from the elbow against each other while walking, and reach out in a fall", () => {
  const C = core();
  const { full } = rigged();
  const s = sprite();
  const scene = { children: [], add(o) { this.children.push(o); } };
  const legs = [sprite(), sprite()];
  legs.forEach((l) => scene.add(l));
  legs[0].parent = scene;
  const place = (along, y) => ({ x: 10 + along, y, z: 0.45 });
  const actor = { crew: { species: "Human" }, facing: 1, moving: true, grounded: true, vy: 0, speed: 3, index: 0 };
  const rot = [[], []];
  for (let i = 0; i < 40; i += 1) {
    C.applyCrewFigure(THREE, s, legs, actor, 1 / 30, { texture: full, height: 1.78, feetY: 2, place });
    rot[0].push(legs[2]?.material.rotation ?? 0);
    rot[1].push(legs[3]?.material.rotation ?? 0);
  }
  assert.equal(legs.length, 4, "crew-core does not add forearm sprites to the figure");
  assert.ok(scene.children.includes(legs[2]) && scene.children.includes(legs[3]), "the forearms are not in the scene");
  assert.ok(legs[2].visible && legs[3].visible, "forearms hidden");
  const swing = Math.max(...rot[0]) - Math.min(...rot[0]);
  assert.ok(swing > 0.4 && swing < 1.0, `the forearm swing is ${swing.toFixed(2)} rad: barely moves or flails`);
  // Front-facing art turns in the screen plane: opposite swings read as both hands flapping
  // out and in. The two forearms sway the same way, through both sides of the body.
  assert.ok(rot[0].every((r, i) => Math.abs(r - rot[1][i]) < 1e-9), "the forearms flap against each other");
  assert.ok(Math.min(...rot[0]) < -0.15 && Math.max(...rot[0]) > 0.15, "the sway goes only one way");
  assert.equal(legs[2].center.x, 0.7, "the left forearm does not turn about its elbow");
  assert.equal(legs[3].center.x, 0.3, "the right forearm does not turn about its elbow");
  assert.ok(legs[2].position.y > legs[0].position.y, "the elbow is not above the knee");
  assert.ok(legs[2].position.x < 10 && legs[3].position.x > 10, "the forearms are not at the sides of the body");

  for (let i = 0; i < 4; i += 1) C.applyCrewFigure(THREE, s, legs, { ...actor, moving: false, grounded: false, vy: -4 }, 1 / 30, { texture: full, height: 1.78, feetY: 2, place });
  assert.ok(legs[2].material.rotation < -0.4 && legs[3].material.rotation > 0.4,
    `falling, the hands do not reach out: ${legs[2].material.rotation.toFixed(2)} / ${legs[3].material.rotation.toFixed(2)}`);

  s.visible = false;
  C.applyCrewFigure(THREE, s, legs, actor, 1 / 30, { texture: full, height: 1.78, feetY: 2, place });
  assert.ok(!legs[2].visible && !legs[3].visible, "forearms stay on screen when the Crew is hidden");
});

test("the forearms are cut and laid out by crew-core for both Tower and the Ring", () => {
  const src = read("mini-sim/assets/js/crew-core.js");
  assert.match(src, /measureArmGaps\(pixels, w, h, species\)/, "crewLegParts does not cut the forearms");
  assert.match(src, /arms: parts\.arms \? \[forearm\(/, "crewFigureLayout does not lay out the forearms");
});
