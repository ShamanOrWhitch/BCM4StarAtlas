// BUG-015 (owner, live 0.15.5): "корабль едет боком". VZUS Ambwe, Meditech,
// Feist and VZUS Arma drove sideways: their GLBs carry no nose/tail part names,
// so the game guessed the nose from the bounding box (+x unless clearly
// z-long). The small-ship family is modelled nose to +z. The nose is data in
// the ship catalogue now; both the island and the space flight read it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const ROOT = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");
const catalog = JSON.parse(read("mini-sim/assets/mesh/ships/catalog.json")).families;
const bakeSource = read("mini-sim/first-planet/src/game/island/bake.ts");

// The game's own nose/tail part names (aimNose in bake.ts).
const [, frontSrc] = bakeSource.match(/const front = namedPoint\(root, \/(.+?)\/i\)/);
const [, rearSrc] = bakeSource.match(/const rear = namedPoint\(root, \/(.+?)\/i\)/);
const FRONT = new RegExp(frontSrc, "i");
const REAR = new RegExp(rearSrc, "i");

function glbParts(path) {
  const buf = readFileSync(new URL("mini-sim/assets/mesh/ships/" + path, ROOT));
  const json = JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString("utf8"));
  const parts = [];
  const walk = (index, offset) => {
    const node = json.nodes[index];
    const t = node.translation || [0, 0, 0];
    const at = [offset[0] + t[0], offset[1] + t[1], offset[2] + t[2]];
    if (node.mesh != null) {
      const acc = json.accessors[json.meshes[node.mesh].primitives[0].attributes.POSITION];
      parts.push({ name: node.name || "", z: at[2] + (acc.min[2] + acc.max[2]) / 2, x: at[0] + (acc.min[0] + acc.max[0]) / 2 });
    }
    for (const child of node.children || []) walk(child, at);
  };
  for (const r of json.scenes[json.scene || 0].nodes) walk(r, [0, 0, 0]);
  return parts;
}

test("every drivable ship without nose or tail parts has its nose in the catalogue", () => {
  const guessed = [];
  for (const ship of catalog.filter((s) => s.planetDrive)) {
    const parts = glbParts(ship.flight);
    const named = parts.some((p) => FRONT.test(p.name)) || parts.some((p) => REAR.test(p.name));
    if (!named && !/^[+-][xz]$/.test(String(ship.nose || ""))) guessed.push(ship.id);
  }
  assert.deepEqual(guessed, [], `the game guesses the nose of these ships from their bounding box (they can drive sideways): ${guessed.join(", ")}`);
});

test("the catalogue nose agrees with the cockpit and the engines where a model names them", () => {
  const ahead = /cockpit|canopy|gun/i;
  const behind = /engine|nozzle|jet/i;
  let checked = 0;
  for (const ship of catalog.filter((s) => /^[+-][xz]$/.test(String(s.nose || "")))) {
    const parts = glbParts(ship.flight);
    const f = parts.filter((p) => ahead.test(p.name));
    const r = parts.filter((p) => behind.test(p.name));
    if (!f.length || !r.length) continue;
    const axis = ship.nose[1];
    const mean = (list) => list.reduce((sum, p) => sum + p[axis], 0) / list.length;
    const sign = Math.sign(mean(f) - mean(r));
    assert.equal(sign, ship.nose[0] === "+" ? 1 : -1, `${ship.id}: nose ${ship.nose} in the catalogue, but the cockpit is on the other side of the engines`);
    checked += 1;
  }
  assert.ok(checked >= 2, "no named model confirmed the catalogue nose");
});

test("the island turns a hull by its catalogue nose, and still guesses when there is none", async () => {
  const fromPlanet = createRequire(new URL("mini-sim/first-planet/package.json", ROOT));
  const THREE = await import(pathToFileURL(fromPlanet.resolve("three").replace(/[^\\/]+$/, "") + "three.module.js").href);
  const { aimNose } = await import("../mini-sim/first-planet/src/game/island/bake.ts");
  // An unnamed hull, a little wider than long, like VZUS Ambwe (x 4.7, z 4.4).
  const hull = () => {
    const root = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(4.7, 1.3, 4.4), new THREE.MeshBasicMaterial());
    mesh.name = "material";
    root.add(mesh);
    return root;
  };
  // The island drives towards -z; the nose (+z of the model) must end up there.
  const forward = (root) => {
    root.updateMatrixWorld(true);
    return new THREE.Vector3(0, 0, 1).applyQuaternion(root.quaternion);
  };
  const guessed = aimNose(hull());
  assert.ok(Math.abs(forward(guessed).x) > 0.9, "the bounding-box guess changed");
  const told = aimNose(hull(), "+z");
  const f = forward(told);
  assert.ok(f.z < -0.99, `with nose +z the hull still drives sideways (model +z points to ${f.x.toFixed(2)}, ${f.z.toFixed(2)})`);
});

test("the island and the space flight both read the catalogue nose", () => {
  const ships = read("mini-sim/first-planet/src/game/ships.ts");
  assert.match(ships, /nose: String\(ship\.nose \|\| ""\)/);
  const scene = read("mini-sim/first-planet/src/game/island/scene.ts");
  assert.doesNotMatch(scene, /settleNose\((hull|parkedHull|flightHull)\);/, "a hull on the island is still turned without its catalogue nose");
  const mini = read("mini-sim/assets/js/mini-sim.js");
  assert.match(mini, /nose: String\(ship\.nose \|\| ""\)/);
  assert.doesNotMatch(mini, /aimFlightNose\(root\);/, "the space flight still turns the hull without its catalogue nose");
});
