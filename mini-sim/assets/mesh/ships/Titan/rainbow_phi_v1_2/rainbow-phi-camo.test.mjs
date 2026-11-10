import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const phiRoot = "mini-sim/assets/mesh/ships/titan/rainbow_phi_photoli/";
const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

async function glbJson() {
  const buf = Buffer.from(await readFile(new URL("../" + phiRoot + "rainbow_phi.glb", import.meta.url)));
  assert.equal(buf.readUInt32LE(0), 0x46546c67, "GLB magic 'glTF'");
  assert.equal(buf.readUInt32LE(4), 2, "GLB version 2");
  const jsonLen = buf.readUInt32LE(12);
  return JSON.parse(buf.slice(20, 20 + jsonLen).toString("utf8"));
}

test("Phi matches the Titan spec: triangle 3236 x 2863 m, 8 hovering sections", async () => {
  const g = await glbJson();
  const names = g.nodes.map((n) => n.name);
  for (const need of ["hull_ring", "terraces", "core_emblem", "edge_lights", "wall_plates",
                      "greebles", "hangar_deck", "docks", "gantries", "fleet",
                      "lower_hull", "keel", "engines"]) {
    assert.ok(names.includes(need), "node " + need);
  }
  for (let i = 0; i < 16; i++) assert.ok(names.includes("plates_" + i), "hovering section plates_" + i);
  // габариты: длина ~130, ширина ~38 (по доступу POSITION первого меша корпуса)
  const accessors = g.accessors;
  const rimMesh = g.meshes[g.nodes.find((n) => n.name === "hull_ring").mesh];
  const posAcc = accessors[rimMesh.primitives[0].attributes.POSITION];
  assert.ok(Math.abs((posAcc.max[0] - posAcc.min[0]) - 3236) < 80, "length ~3236 m: " + (posAcc.max[0] - posAcc.min[0]));
  assert.ok(Math.abs((posAcc.max[2] - posAcc.min[2]) - 2863) < 80, "width ~2863 m: " + (posAcc.max[2] - posAcc.min[2]));
  // плоский профиль: сам обод тонкий (по чертежу), высоту даёт киль
  assert.ok(posAcc.max[1] - posAcc.min[1] < 320, "rim is a thin plate: " + (posAcc.max[1] - posAcc.min[1]));
  // полная высота сцены ≈ 1583 м по паспорту — считаем по всем мешам
  let yMin = Infinity, yMax = -Infinity;
  for (const m of g.meshes) {
    const acc = accessors[m.primitives[0].attributes.POSITION];
    yMin = Math.min(yMin, acc.min[1]);
    yMax = Math.max(yMax, acc.max[1]);
  }
  const height = yMax - yMin;
  assert.ok(height > 1300 && height < 1900, "overall height ~1583 m: " + height.toFixed(0));
  // никаких шпилей/мастов: узлы именно эти, лишних вертикальных деталей нет
  assert.equal(names.includes("spires"), false, "no spires (not on the blueprint)");
});

test("Phi keeps four light-levitation poses with no drifting geometry", async () => {
  const controls = await read(phiRoot + "phi_controls.js");
  for (const mode of ["cruise", "levitation", "shield", "iris"]) {
    assert.ok(controls.includes('"' + mode + '"'), "pose " + mode);
  }
  assert.match(controls, /setMode/, "pose switch");
  assert.match(controls, /getMode/, "panel reads the pose back");
  assert.match(controls, /curOff\[i\]\.lerp\(target\[i\], k\)/, "sections ease to their targets");
  assert.match(controls, /panels\[i\]\.position\.copy\(curOff\[i\]\)/, "node offsets applied");
  // полная разборка: секции не только уезжают, но и разворачиваются
  assert.match(controls, /var ROTS = /, "per-section rotations table");
  assert.match(controls, /panels\[i\]\.rotation\.set\(curRot\[i\]\.x/, "sections tilt while flying apart");
  assert.match(controls, /targetRot = \(ROTS\[name\] \|\| MODES\[name\]\)\.map\(rad3\)/,
    "pose switch resets the rotations too");
});

test("Phi camouflage samples the environment ramp, tinted by its own steel", async () => {
  const controls = await read(phiRoot + "phi_controls.js");
  assert.match(controls, /setCamouflage/, "camouflage strength");
  assert.match(controls, /getCamouflage/, "value read back");
  assert.match(controls, /setEnvironment/, "environment colours");
  assert.match(controls, /envZ/, "three-stop ramp");
  assert.match(controls, /2 \* idn \* nx/, "view ray reflected off the normal");
  assert.match(controls, /camo \* \(0\.62 \+ 0\.38 \* fres\)/, "grazing angles first");
  assert.match(controls, /if \(wgt > 0\.9\) wgt = 0\.9;/, "colour pull capped at 0.9");
  assert.match(controls, /setMetalTint/, "own metal tint (the Arc is not chrome)");
  assert.match(controls, /0\.88 \* Math\.pow\(camo, 1\.5\)/, "alpha cloak, floor 0.12");
});

test("Phi cloak leaves the light seams, levitation field and engines lit", async () => {
  const controls = await read(phiRoot + "phi_controls.js");
  assert.match(controls, /var body = \[hull, bridge, wallPlates, greebles, lowerHull, keel\][\s\S]{0,40}\.filter\(Boolean\)\.concat\(panels\)/,
    "cloak applies to the whole hull and the 8 sections only");
  assert.doesNotMatch(controls, /seams\.material\.opacity/, "golden rim lights stay opaque");
  assert.doesNotMatch(controls, /lev\.material\.opacity/, "gold core triangle stays lit");
  assert.match(controls, /paintGlow/, "seams and field pulse instead");
  assert.match(controls, /\.transparent !== t/, "cloak toggles transparency");
  assert.match(controls, /depthWrite = !t/, "depthWrite off while cloaked");
});

test("Phi has both render paths: cheap CPU default and an opt-in shader", async () => {
  const controls = await read(phiRoot + "phi_controls.js");
  assert.match(controls, /setShaderMode/, "shader switch");
  assert.match(controls, /getShaderMode/, "state read back");
  assert.match(controls, /new THREE\.MeshPhongMaterial/, "lit material for the shader path");
  assert.match(controls, /onBeforeCompile/, "standard pipeline patch, no raw ShaderMaterial");
  assert.doesNotMatch(controls, /new THREE\.ShaderMaterial/, "no custom ShaderMaterial");
  assert.match(controls, /transformed\.y \+= ahW1 \* uAhAmp/, "hover is computed on the GPU");
  assert.match(controls, /update: function \(time, camera\)/, "camera in update() for the rays");
  const panel = await read(phiRoot + "phi_panel.js");
  for (const label of ["Крейсер", "Левитация", "Щит", "Ирис", "Разборка", "Маскировка"]) {
    assert.ok(panel.includes(label), "panel control " + label);
  }
  assert.match(panel, /Шейдерный режим/, "shader toggle in the panel");
});
