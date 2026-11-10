import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const arcRoot = "mini-sim/assets/mesh/ships/large/rainbow_arc_photoli/";
const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

async function glbJson() {
  const buf = Buffer.from(await readFile(new URL("../" + arcRoot + "rainbow_arc.glb", import.meta.url)));
  assert.equal(buf.readUInt32LE(0), 0x46546c67, "GLB magic 'glTF'");
  assert.equal(buf.readUInt32LE(4), 2, "GLB version 2");
  const jsonLen = buf.readUInt32LE(12);
  return JSON.parse(buf.slice(20, 20 + jsonLen).toString("utf8"));
}

test("Arc model matches the blueprint: 130 x 38 m, 10 hovering sections", async () => {
  const g = await glbJson();
  const names = g.nodes.map((n) => n.name);
  for (const need of ["hull_core", "bridge", "cargo_bay", "light_seams", "levitation", "engines"]) {
    assert.ok(names.includes(need), "node " + need);
  }
  for (let i = 0; i < 10; i++) assert.ok(names.includes("panel_" + i), "hovering section panel_" + i);
  // габариты: длина ~130, ширина ~38 (по доступу POSITION первого меша корпуса)
  const accessors = g.accessors;
  const hullMesh = g.meshes[g.nodes.find((n) => n.name === "hull_core").mesh];
  const posAcc = accessors[hullMesh.primitives[0].attributes.POSITION];
  assert.ok(Math.abs((posAcc.max[0] - posAcc.min[0]) - 130) < 4, "length ~130 m: " + (posAcc.max[0] - posAcc.min[0]));
  assert.ok(Math.abs((posAcc.max[2] - posAcc.min[2]) - 38) < 3, "width ~38 m: " + (posAcc.max[2] - posAcc.min[2]));
  assert.ok(posAcc.max[1] >= 29, "height reaches ~30 m");
});

test("Arc keeps four light-levitation poses with no drifting geometry", async () => {
  const controls = await read(arcRoot + "arc_controls.js");
  for (const mode of ["flight", "load", "shield", "lift"]) {
    assert.ok(controls.includes('"' + mode + '"'), "pose " + mode);
  }
  assert.match(controls, /setMode/, "pose switch");
  assert.match(controls, /getMode/, "panel reads the pose back");
  assert.match(controls, /curOff\[i\]\.lerp\(target\[i\], k\)/, "sections ease to their targets");
  assert.match(controls, /panels\[i\]\.position\.copy\(curOff\[i\]\)/, "node offsets applied");
});

test("Arc camouflage samples the environment ramp, tinted by its own steel", async () => {
  const controls = await read(arcRoot + "arc_controls.js");
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

test("Arc cloak leaves the light seams, levitation field and engines lit", async () => {
  const controls = await read(arcRoot + "arc_controls.js");
  assert.match(controls, /var body = \[hull, bridge\]\.concat\(panels\)/,
    "cloak applies to hull / bridge / panels only");
  assert.doesNotMatch(controls, /seams\.material\.opacity/, "golden seams stay opaque");
  assert.doesNotMatch(controls, /lev\.material\.opacity/, "levitation glow stays opaque");
  assert.match(controls, /paintGlow/, "seams and field pulse instead");
  assert.match(controls, /\.transparent !== t/, "cloak toggles transparency");
  assert.match(controls, /depthWrite = !t/, "depthWrite off while cloaked");
});

test("Arc has both render paths: cheap CPU default and an opt-in shader", async () => {
  const controls = await read(arcRoot + "arc_controls.js");
  assert.match(controls, /setShaderMode/, "shader switch");
  assert.match(controls, /getShaderMode/, "state read back");
  assert.match(controls, /new THREE\.MeshPhongMaterial/, "lit material for the shader path");
  assert.match(controls, /onBeforeCompile/, "standard pipeline patch, no raw ShaderMaterial");
  assert.doesNotMatch(controls, /new THREE\.ShaderMaterial/, "no custom ShaderMaterial");
  assert.match(controls, /transformed\.y \+= ahW1 \* uAhAmp/, "hover is computed on the GPU");
  assert.match(controls, /update: function \(time, camera\)/, "camera in update() for the rays");
  const panel = await read(arcRoot + "arc_panel.js");
  for (const label of ["Крейсер", "Погрузка", "Щит", "Подъём", "Маскировка", "Левитация"]) {
    assert.ok(panel.includes(label), "panel control " + label);
  }
  assert.match(panel, /Шейдерный режим/, "shader toggle in the panel");
});
