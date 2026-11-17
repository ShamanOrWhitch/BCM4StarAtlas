// Owner, live site 16.11.2026, Shoal Race: "текстуры трассы не подключены, хотя
// они там есть, ищи в mesh" and "нету вариантов: двигатель работает или нет".
// The track pieces in mini-sim/assets/mesh (coast_straight.glb: dark asphalt, a
// dashed yellow centre line, kerbs; colours in the vertices) define the look of
// the race road, and a race ship has a running form and a rest form.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import "./lib/first-planet-sim.mjs"; // resolves "@/..." and extensionless imports

const ROOT = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");
const SKIN = new URL("mini-sim/first-planet/src/game/track-skin.ts", ROOT);

/** POSITION and COLOR_0 of the piece, as the file stores them (colours 0..1). */
function piece(name) {
  const buf = readFileSync(new URL(`mini-sim/assets/mesh/${name}.glb`, ROOT));
  const jsonLength = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLength).toString("utf8"));
  const bin = buf.subarray(20 + jsonLength + 8);
  const prim = json.meshes[0].primitives[0];
  const read = (index) => {
    const acc = json.accessors[index];
    const view = json.bufferViews[acc.bufferView];
    const size = { 5126: 4, 5123: 2, 5121: 1 }[acc.componentType];
    const n = { VEC3: 3, VEC4: 4 }[acc.type];
    const stride = view.byteStride || n * size;
    const base = (view.byteOffset || 0) + (acc.byteOffset || 0);
    const out = new Float32Array(acc.count * n);
    for (let i = 0; i < acc.count; i += 1) {
      for (let c = 0; c < n; c += 1) {
        const o = base + stride * i + c * size;
        out[i * n + c] = size === 4 ? bin.readFloatLE(o) : size === 2 ? bin.readUInt16LE(o) / 65535 : bin.readUInt8(o) / 255;
      }
    }
    return { data: out, size: n };
  };
  return { position: read(prim.attributes.POSITION), color: read(prim.attributes.COLOR_0) };
}

/** A closed oval, sampled like track.ts samples a track. */
function oval(halfWidth = 6.5, turn = 1) {
  const samples = [];
  const n = 240;
  const rx = 80;
  const rz = 50;
  let s = 0;
  let px = rx;
  let pz = 0;
  for (let i = 0; i < n; i += 1) {
    const a = turn * (i / n) * Math.PI * 2;
    const x = Math.cos(a) * rx;
    const z = Math.sin(a) * rz;
    if (i) s += Math.hypot(x - px, z - pz);
    px = x;
    pz = z;
    const tx = -Math.sin(a) * rx * turn;
    const tz = Math.cos(a) * rz * turn;
    const tl = Math.hypot(tx, tz);
    // Same frame as track.ts: the normal is the tangent turned left (nx = -tz, nz = tx).
    samples.push({ x, z, nx: -tz / tl, nz: tx / tl, s });
  }
  const last = samples[n - 1];
  return { samples, length: s + Math.hypot(samples[0].x - last.x, samples[0].z - last.z), halfWidth };
}

test("the race road takes its look from the coast track piece in the mesh folder", () => {
  const world = read("mini-sim/first-planet/src/game/world.ts");
  assert.match(world, /coast_straight\.glb/, "the race draws its own road: the track pieces in assets/mesh are never loaded");
  assert.match(world, /readTrackSkin\(/);
  assert.match(world, /skinnedRoad\(/);
});

test("the coast piece reads as dark asphalt with kerbs and a dashed yellow centre line", async () => {
  assert.ok(existsSync(SKIN), "there is no reader for the track pieces");
  const { readTrackSkin } = await import(SKIN.href);
  const { position, color } = piece("coast_straight");
  const skin = readTrackSkin(position.data, color.data, color.size);
  const rgb = (c) => c.map((v) => Math.round(v * 255));
  assert.deepEqual(rgb(skin.surface), [54, 58, 58]);
  assert.deepEqual(rgb(skin.kerb), [180, 156, 113]);
  assert.deepEqual(rgb(skin.line), [238, 218, 151]);
  // Proportions in road widths (the piece is 2 m wide and 4 m long).
  assert.ok(Math.abs(skin.kerbWidth - 0.06) < 0.005, `kerb width ${skin.kerbWidth}`);
  assert.ok(Math.abs(skin.kerbHeight - 0.045) < 0.005, `kerb height ${skin.kerbHeight}`);
  assert.ok(Math.abs(skin.dashLength - 0.225) < 0.01, `dash length ${skin.dashLength}`);
  assert.ok(Math.abs(skin.dashPeriod - 0.5) < 0.01, `dash period ${skin.dashPeriod}`);
  // The desert piece has no centre line; that is a look too, not an error.
  const desert = piece("desert_straight");
  const sand = readTrackSkin(desert.position.data, desert.color.data, desert.color.size);
  assert.equal(sand.line, null);
  assert.deepEqual(rgb(sand.surface), [200, 151, 85]);
});

test("the skinned road has asphalt, two raised kerbs and centre dashes along the whole lap", async () => {
  assert.ok(existsSync(SKIN), "there is no reader for the track pieces");
  const { readTrackSkin, skinnedRoad } = await import(SKIN.href);
  const { position, color } = piece("coast_straight");
  const skin = readTrackSkin(position.data, color.data, color.size);
  const track = oval();
  const road = skinnedRoad(track, skin, 1.52);
  assert.equal(road.position.length, road.color.length);
  assert.ok(road.index.length % 3 === 0 && Math.max(...road.index) < road.position.length / 3);
  const near = (i, c) => Math.abs(road.color[i * 3] - c[0]) < 0.004 && Math.abs(road.color[i * 3 + 1] - c[1]) < 0.004 && Math.abs(road.color[i * 3 + 2] - c[2]) < 0.004;
  const count = road.position.length / 3;
  let asphalt = 0;
  let line = 0;
  let kerbLeft = 0;
  let kerbRight = 0;
  let kerbTop = -Infinity;
  for (let i = 0; i < count; i += 1) {
    const x = road.position[i * 3];
    const y = road.position[i * 3 + 1];
    const z = road.position[i * 3 + 2];
    if (near(i, skin.surface)) asphalt += 1;
    if (near(i, skin.line)) {
      line += 1;
      // Dashes lie on the centre line of the oval: (x/80)^2 + (z/50)^2 = 1.
      assert.ok(Math.abs((x / 80) ** 2 + (z / 50) ** 2 - 1) < 0.02, "a dash is off the centre line");
    }
    if (near(i, skin.kerb)) {
      kerbTop = Math.max(kerbTop, y);
      if ((x / 80) ** 2 + (z / 50) ** 2 > 1) kerbRight += 1;
      else kerbLeft += 1;
    }
  }
  assert.ok(asphalt > 400, "no asphalt surface");
  assert.ok(kerbLeft > 400 && kerbRight > 400, `kerbs must run on both sides (inner ${kerbLeft}, outer ${kerbRight} vertices)`);
  assert.ok(kerbTop > 1.52 + 0.1 && kerbTop < 1.52 + 0.4, `kerb top at ${(kerbTop - 1.52).toFixed(2)} m above the road`);
  // Dashes cover the lap: about one per 6.5 m on a 13 m road.
  const dashes = line / 8; // each dash is drawn with 8 vertices or more
  assert.ok(dashes >= track.length / (skin.dashPeriod * 13) * 0.8, `only about ${dashes.toFixed(0)} dashes on a ${track.length.toFixed(0)} m lap`);
});

test("the road faces up whichever way the lap runs (a road facing down is invisible from above)", async () => {
  const { readTrackSkin, skinnedRoad } = await import(SKIN.href);
  const { position, color } = piece("coast_straight");
  const skin = readTrackSkin(position.data, color.data, color.size);
  const forward = oval(6.5, 1);
  const back = oval(6.5, -1);
  for (const [name, track] of [["as sampled", forward], ["reversed", back]]) {
    const road = skinnedRoad(track, skin, 1.52);
    let up = 0;
    let down = 0;
    for (let t = 0; t < road.index.length; t += 3) {
      const [a, b, c] = [road.index[t], road.index[t + 1], road.index[t + 2]].map((i) => [road.position[i * 3], road.position[i * 3 + 1], road.position[i * 3 + 2]]);
      const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const ny = e1[2] * e2[0] - e1[0] * e2[2];
      const flat = Math.abs(a[1] - b[1]) < 1e-6 && Math.abs(a[1] - c[1]) < 1e-6;
      if (!flat) continue; // kerb faces are checked by eye in Planet Lab
      if (ny > 0) up += 1;
      else if (ny < 0) down += 1;
    }
    assert.ok(up > 400, `${name}: no road surface faces up`);
    assert.equal(down, 0, `${name}: ${down} road triangles face down and cannot be seen from above (${up} face up)`);
  }
  // The plain ribbon used before the piece loads must face up too.
  const world = read("mini-sim/first-planet/src/game/world.ts");
  assert.match(world, /faceUp\(/,"the plain road ribbon is built without checking which way it faces");
});

test("a race ship has a running form and a rest form", async () => {
  const ships = await import(new URL("mini-sim/first-planet/src/game/ships.ts", ROOT).href);
  assert.ok(Array.isArray(ships.RACE_SHIP_FORMS), "the race loads one form per ship: the engine never reads as off");
  assert.ok(ships.RACE_SHIP_FORMS.length >= 3);
  let twoForms = 0;
  for (const form of ships.RACE_SHIP_FORMS) {
    assert.ok(existsSync(new URL("mini-sim/assets/mesh/" + form.running, ROOT)), form.running + " is missing");
    assert.ok(existsSync(new URL("mini-sim/assets/mesh/" + form.rest, ROOT)), form.rest + " is missing");
    if (form.rest !== form.running) twoForms += 1;
  }
  assert.ok(twoForms >= 3, `only ${twoForms} race ships have a separate rest model`);
  const world = read("mini-sim/first-planet/src/game/world.ts");
  assert.match(world, /engineOn/, "the race never switches a ship between its running and rest forms");
});
