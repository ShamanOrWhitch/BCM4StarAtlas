// BUG-005: the 3D crew on First Planet must step, not slide.
// Integration on the real race models: every GLB that First Planet picks in
// characterPath() is rebuilt from its own node boxes (flat parts, as in the
// file), handed to the real island rig, and walked for one second by dt.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const ROOT = new URL("../", import.meta.url);
// The same three the island rig imports (mini-sim/first-planet/node_modules).
const fromPlanet = createRequire(new URL("mini-sim/first-planet/package.json", ROOT));
// require.resolve would give the CJS build; rig.ts gets the ESM module file.
const threeBuild = fromPlanet.resolve("three").replace(/[^\\/]+$/, "");
const THREE = await import(pathToFileURL(threeBuild + "three.module.js").href);
const shipsSource = readFileSync(new URL("mini-sim/first-planet/src/game/ships.ts", ROOT), "utf8");
const characterBody = shipsSource.slice(shipsSource.indexOf("export function characterPath"));
const MODELS = [...new Set([...characterBody.matchAll(/return "(characters 3d\/[^"]+\.glb)"/g)].map((m) => m[1]))];

function glbNodes(path) {
  const buf = readFileSync(new URL("mini-sim/assets/mesh/" + path, ROOT));
  const len = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + len).toString("utf8"));
  return json.nodes
    .filter((node) => node.mesh != null)
    .map((node) => {
      const prim = json.meshes[node.mesh].primitives[0];
      const acc = json.accessors[prim.attributes.POSITION];
      return { name: node.name, min: acc.min, max: acc.max };
    });
}

// The same object tree GLTFLoader gives: one scene group, one mesh per node.
function buildBody(path) {
  const root = new THREE.Group();
  for (const part of glbNodes(path)) {
    const size = part.max.map((v, i) => Math.max(0.001, v - part.min[i]));
    const geo = new THREE.BoxGeometry(size[0], size[1], size[2]);
    geo.translate(
      (part.min[0] + part.max[0]) / 2,
      (part.min[1] + part.max[1]) / 2,
      (part.min[2] + part.max[2]) / 2,
    );
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
    mesh.name = part.name;
    root.add(mesh);
  }
  root.rotation.y = Math.PI; // as wearCrew() does
  return root;
}

function feet(root) {
  root.updateMatrixWorld(true);
  const out = [];
  root.traverse((obj) => {
    if (!obj.isMesh || !/(^|_)(boot|paw|foot)(_|$)/.test(obj.name)) return;
    const c = new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3());
    out.push({ name: obj.name, x: c.x, y: c.y, z: c.z });
  });
  return out;
}

// On the page crew-rig.js is loaded before First Planet; load it the same way.
createRequire(import.meta.url)("../mini-sim/assets/js/crew-rig.js");
assert.ok(globalThis.BCMCrewRig, "crew-rig.js did not register BCMCrewRig");
const { bindCrewRig } = await import("../mini-sim/first-planet/src/game/island/rig.ts");

// Knee pivots and their feet, in the body's own space (toes towards +z).
function kneeBends(body) {
  body.updateMatrixWorld(true);
  const out = [];
  body.traverse((pivot) => {
    if (pivot.name !== "bcm_rig_pivot" || pivot.parent?.name !== "bcm_rig_pivot") return;
    const shin = pivot.children.find((c) => /shin|lower_leg/.test(c.name));
    const foot = pivot.children.find((c) => /(^|_)(boot|foot)(_|$)/.test(c.name));
    if (!shin || !foot) return;
    const local = (v) => body.worldToLocal(v);
    const hip = local(pivot.parent.getWorldPosition(new THREE.Vector3()));
    const knee = local(pivot.getWorldPosition(new THREE.Vector3()));
    const ankle = local(new THREE.Box3().setFromObject(foot).getCenter(new THREE.Vector3()));
    const thigh = knee.clone().sub(hip);
    const lower = ankle.clone().sub(knee);
    out.push(thigh.y * lower.z - thigh.z * lower.y);
  });
  return out;
}

test("First Planet maps every race to a model on disk", () => {
  assert.ok(MODELS.length >= 6, "characterPath lists the race models");
  for (const path of MODELS) assert.ok(glbNodes(path).length > 10, path + " has parts");
});

for (const path of MODELS) {
  const name = path.split("/").pop();
  const separateFeet = feet(buildBody(path)).length >= 2;
  test(`${name}: walking moves the feet apart along the stride`, { skip: !separateFeet && "no separate feet in this model" }, () => {
    const body = buildBody(path);
    const rest = feet(body);
    const rig = bindCrewRig(body, "");
    let widest = 0;
    let lift = 0;
    let folded = 0;
    // The toe sticks out past the knee even at rest, so compare with rest.
    const restBends = kneeBends(body);
    for (let i = 0; i < 60; i += 1) {
      rig.update(true, 1 / 60);
      kneeBends(body).forEach((bend, k) => {
        const d = bend - restBends[k];
        assert.ok(d >= -0.005, `knee bends forwards (${d.toFixed(3)})`);
        folded = Math.max(folded, d);
      });
      const now = feet(body);
      for (let k = 0; k < now.length; k += 1) {
        const r = rest.find((f) => f.name === now[k].name);
        if (r) lift = Math.max(lift, now[k].y - r.y);
      }
      const z = now.map((f) => f.z);
      widest = Math.max(widest, Math.max(...z) - Math.min(...z));
    }
    const restSpread = Math.max(...rest.map((f) => f.z)) - Math.min(...rest.map((f) => f.z));
    assert.ok(widest - restSpread > 0.08, `feet did not stride: front-back spread ${restSpread.toFixed(3)} -> ${widest.toFixed(3)}`);
    assert.ok(lift > 0.01, `no foot left the ground (max lift ${lift.toFixed(3)})`);
    if (restBends.length) assert.ok(folded > 0.02, `knees never fold (max ${folded.toFixed(3)})`);
  });

  test(`${name}: standing still keeps both feet planted`, { skip: !separateFeet && "no separate feet in this model" }, () => {
    const body = buildBody(path);
    const rest = feet(body);
    const rig = bindCrewRig(body, "");
    for (let i = 0; i < 60; i += 1) rig.update(false, 1 / 60);
    for (const f of feet(body)) {
      const r = rest.find((x) => x.name === f.name);
      assert.ok(Math.abs(f.z - r.z) < 0.02 && Math.abs(f.y - r.y) < 0.03, `${f.name} drifts while idle`);
    }
  });
}

// BUG-009 (owner, live 0.15.5): "анимации сломались после первой же остановки",
// "анимация покоя не переключается". A standing crew member must keep an idle
// pose (breathing), and the change between step and rest must not snap.
for (const path of MODELS) {
  const name = path.split("/").pop();
  const separateFeet = feet(buildBody(path)).length >= 2;
  test(`${name}: after a stop the body keeps breathing and the legs ease to rest`, { skip: !separateFeet && "no separate feet in this model" }, () => {
    const body = buildBody(path);
    const rest = feet(body);
    const rig = bindCrewRig(body, "");
    const top = () => new THREE.Box3().setFromObject(body).max.y;
    for (let i = 0; i < 45; i += 1) rig.update(1.5, 1 / 60);
    // The frame the player lets go of the key: legs must not jump to rest at once.
    const zBefore = feet(body).map((f) => f.z);
    rig.update(0, 1 / 60);
    const zAfter = feet(body).map((f) => f.z);
    const jump = Math.max(...zAfter.map((z, k) => Math.abs(z - zBefore[k])));
    const strideNow = Math.max(...zBefore) - Math.min(...zBefore);
    if (strideNow > 0.2) assert.ok(jump < strideNow * 0.5, `legs snap to rest in one frame (moved ${jump.toFixed(3)} of a ${strideNow.toFixed(3)} stride)`);
    // One second later the feet are home.
    for (let i = 0; i < 60; i += 1) rig.update(0, 1 / 60);
    for (const f of feet(body)) {
      const r = rest.find((x) => x.name === f.name);
      assert.ok(Math.abs(f.z - r.z) < 0.02 && Math.abs(f.y - r.y) < 0.03, `${f.name} is not back at rest after the stop`);
    }
    // Idle: the head rises and falls with the breath while the feet stay put.
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < 300; i += 1) {
      rig.update(0, 1 / 60);
      const y = top();
      lo = Math.min(lo, y);
      hi = Math.max(hi, y);
    }
    assert.ok(hi - lo > 0.004, `standing crew is frozen: no idle pose (head moves ${(hi - lo).toFixed(4)} m in 5 s)`);
    assert.ok(hi - lo < 0.06, `idle pose bounces like a walk (${(hi - lo).toFixed(3)} m)`);
    for (const f of feet(body)) {
      const r = rest.find((x) => x.name === f.name);
      assert.ok(Math.abs(f.z - r.z) < 0.02 && Math.abs(f.y - r.y) < 0.03, `${f.name} drifts in the idle pose`);
    }
  });
}

test("the island rig is paced by dt and shares the Crew pose generator", () => {
  const rig = readFileSync(new URL("mini-sim/first-planet/src/game/island/rig.ts", ROOT), "utf8");
  assert.doesNotMatch(rig, /performance\.now\(/, "rig phase still follows the wall clock");
  assert.match(rig, /BCMCrewRig/, "rig does not use the shared crew-rig.js pose");
  const scene = readFileSync(new URL("mini-sim/first-planet/src/game/island/scene.ts", ROOT), "utf8");
  assert.match(scene, /crewRig\?\.update\([^;]*,\s*dt\);/, "scene does not pass dt to the rig");
});
