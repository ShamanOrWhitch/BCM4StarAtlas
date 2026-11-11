import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dir = new URL("./", import.meta.url);

function glbParts(buf) {
  assert.equal(buf.readUInt32LE(0), 0x46546c67, "GLB magic 'glTF'");
  assert.equal(buf.readUInt32LE(4), 2, "GLB version 2");
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString("utf8"));
  const binOff = 20 + jsonLen + 8;
  return { json, bin: buf.slice(binOff) };
}

function nodePositions(g, nodeName) {
  const node = g.json.nodes.find((n) => n.name === nodeName);
  assert.ok(node && node.mesh != null, "узел " + nodeName);
  const prim = g.json.meshes[node.mesh].primitives[0];
  const acc = g.json.accessors[prim.attributes.POSITION];
  const view = g.json.bufferViews[acc.bufferView];
  const start = (view.byteOffset || 0) + (acc.byteOffset || 0);
  const t = node.translation || [0, 0, 0];
  const out = [];
  for (let i = 0; i < acc.count; i++) {
    const o = start + i * 12;
    out.push([
      g.bin.readFloatLE(o) + t[0],
      g.bin.readFloatLE(o + 4) + t[1],
      g.bin.readFloatLE(o + 8) + t[2]
    ]);
  }
  return out;
}

const glb = readFileSync(new URL("calico_enforcer.glb", dir));
const G = glbParts(glb);

test("CALATS: 23 узла — корпус, кабина, крылья, кили, батареи, пушка, шасси", () => {
  const names = G.json.nodes.map((n) => n.name);
  for (const need of ["fuselage", "canopy", "spine_hump", "nozzle_block",
                      "capital_cannon", "thrusters", "greebles", "decals",
                      "lights", "beacon"]) {
    assert.ok(names.includes(need), "узел " + need);
  }
  for (const tag of ["r", "l"]) {
    for (const pre of ["wing_", "tail_fin_", "belly_fin_",
                       "missile_pod_", "missile_glow_"]) {
      assert.ok(names.includes(pre + tag), "узел " + pre + tag);
    }
  }
  for (let i = 0; i < 3; i++) assert.ok(names.includes("leg_" + i), "стойка leg_" + i);
  assert.equal(names.length, 23, "23 узла, найдено " + names.length);
});

test("CALATS: габарит по карточке 92 × 69 × 19 м, стойки на Y = 0", () => {
  let box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const node of G.json.nodes) {
    if (node.mesh == null) continue;
    const acc = G.json.accessors[G.json.meshes[node.mesh].primitives[0].attributes.POSITION];
    const t = node.translation || [0, 0, 0];
    box = [
      Math.min(box[0], acc.min[0] + t[0]), Math.min(box[1], acc.min[1] + t[1]),
      Math.min(box[2], acc.min[2] + t[2]), Math.max(box[3], acc.max[0] + t[0]),
      Math.max(box[4], acc.max[1] + t[1]), Math.max(box[5], acc.max[2] + t[2])
    ];
  }
  const L = box[3] - box[0], H = box[4] - box[1], W = box[5] - box[2];
  assert.ok(L <= 92.0 + 0.6 && L > 88.0, "длина в габарите: " + L.toFixed(1));
  assert.ok(W <= 69.0 + 0.4 && W > 66.0, "ширина в габарите: " + W.toFixed(1));
  assert.ok(H <= 19.0 + 0.6 && H > 17.0, "высота в габарите: " + H.toFixed(1));
  assert.ok(Math.abs(box[1]) < 0.25, "стойки на Y=0: " + box[1].toFixed(2));
});

test("CALATS: корпус-клин истребителя, крылья шире корпуса втрое", () => {
  const hull = G.json.accessors[G.json.meshes[
    G.json.nodes.find((n) => n.name === "fuselage").mesh].primitives[0].attributes.POSITION];
  const hl = hull.max[0] - hull.min[0], hw = hull.max[2] - hull.min[2];
  assert.ok(hl / hw > 5.0, "корпус вытянутый клин: " + (hl / hw).toFixed(2));
  // дельта-крыло: размах заметно больше корпуса
  const wspan = Math.max(...nodePositions(G, "wing_r").map((p) => p[2]));
  assert.ok(wspan > 2.2 * (hw / 2), "крыло-дельта шире корпуса: " + (wspan / (hw / 2)).toFixed(2));
  // нос в минусе X, корма в плюсе — как в игре
  assert.ok(hull.min[0] < -44.0 && hull.max[0] < 30.0, "нос по -X, корма по +X");
});

test("CALATS: два сопла-кольца + турбина, свечение внутри устьев", () => {
  const glow = nodePositions(G, "thrusters");
  const noz = nodePositions(G, "nozzle_block");
  const xMax = Math.max(...noz.map((p) => p[0]));
  assert.ok(Math.max(...glow.map((p) => p[0])) <= xMax + 1e-3,
    "свечение не торчит из среза");
  // два маршевых сопла симметричны по Z, турбина в центре
  const cy = 6.6;
  const near = glow.filter((p) => Math.abs(p[1] - cy) < 2.4);
  const zs = near.map((p) => p[2]);
  assert.ok(Math.max(...zs) > 2.0 && Math.min(...zs) < -2.0,
    "свечение в двух соплах по бортам");
  const centre = glow.filter((p) => Math.abs(p[1] - cy) < 0.9 && Math.abs(p[2]) < 0.9);
  assert.ok(centre.length > 0, "центральная турбина светится");
});

test("CALATS: capital-пушка под носом, стволы спарены по Z", () => {
  const can = nodePositions(G, "capital_cannon");
  const fus = nodePositions(G, "fuselage");
  const nose = Math.min(...fus.map((p) => p[0]));
  assert.ok(Math.min(...can.map((p) => p[0])) < nose + 2.0,
    "стволы доходят до носа: " + Math.min(...can.map((p) => p[0])).toFixed(1));
  const barrels = can.filter((p) => p[0] < -30.0);
  assert.ok(Math.max(...barrels.map((p) => p[2])) > 1.0 &&
            Math.min(...barrels.map((p) => p[2])) < -1.0, "спарка стволов по бортам");
  // пушка висит ПОД корпусом, а не поверх палубы
  const belly = Math.min(...fus.map((p) => p[1]));
  assert.ok(Math.max(...can.map((p) => p[1])) < belly + 1.6, "пушка под днищем");
});

test("CALATS: ракетные соты на бортах, в габарите по ширине", () => {
  for (const tag of ["r", "l"]) {
    const cells = nodePositions(G, "missile_glow_" + tag);
    const z = Math.max(...cells.map((p) => Math.abs(p[2])));
    assert.ok(z > 4.4, "соты " + tag + " на борту: |z| " + z.toFixed(1));
    const hull = G.json.accessors[G.json.meshes[
      G.json.nodes.find((n) => n.name === "fuselage").mesh].primitives[0].attributes.POSITION];
    assert.ok(z > Math.max(Math.abs(hull.min[2]), Math.abs(hull.max[2])) - 0.4,
      "соты выходят на обшивку, а не утоплены внутрь");
  }
});

test("CALATS: декор не вылезает за корпус по ширине", () => {
  const hull = G.json.accessors[G.json.meshes[
    G.json.nodes.find((n) => n.name === "fuselage").mesh].primitives[0].attributes.POSITION];
  const hullW = Math.max(Math.abs(hull.min[2]), Math.abs(hull.max[2]));
  const acc = G.json.accessors[G.json.meshes[
    G.json.nodes.find((n) => n.name === "decals").mesh].primitives[0].attributes.POSITION];
  // ливрея садится и на крыло (кант наплыва), поэтому сверяем с размахом
  const wingZ = Math.max(...nodePositions(G, "wing_r").map((p) => p[2]));
  assert.ok(Math.max(Math.abs(acc.min[2]), Math.abs(acc.max[2])) <= wingZ,
    "decals в пределах размаха: |z| " +
    Math.max(Math.abs(acc.min[2]), Math.abs(acc.max[2])).toFixed(2));
  // greebles заходят на крылья (пилоны подвески), но не за законцовку
  const gr = G.json.accessors[G.json.meshes[
    G.json.nodes.find((n) => n.name === "greebles").mesh].primitives[0].attributes.POSITION];
  assert.ok(Math.max(Math.abs(gr.min[2]), Math.abs(gr.max[2])) <= wingZ,
    "greebles в пределах размаха: |z| " +
    Math.max(Math.abs(gr.min[2]), Math.abs(gr.max[2])).toFixed(2));
  const podZ = Math.max(...nodePositions(G, "missile_pod_r").map((p) => p[2]));
  assert.ok(podZ <= wingZ, "пусковые блоки не выходят за законцовку: " + podZ.toFixed(2));
});

test("CALATS: крылья и кили симметричны, кили выше корпуса", () => {
  for (const pre of ["wing_", "tail_fin_", "belly_fin_", "missile_pod_"]) {
    const r = nodePositions(G, pre + "r");
    const l = nodePositions(G, pre + "l");
    assert.equal(r.length, l.length, pre + ": одинаковое число вершин");
    const zr = Math.max(...r.map((p) => p[2]));
    const zl = Math.min(...l.map((p) => p[2]));
    assert.ok(Math.abs(zr + zl) < 0.02, pre + ": зеркальность по Z " + zr.toFixed(2));
    const yr = Math.max(...r.map((p) => p[1]));
    const yl = Math.max(...l.map((p) => p[1]));
    assert.ok(Math.abs(yr - yl) < 0.02, pre + ": одинаковая высота");
  }
  const fin = nodePositions(G, "tail_fin_r");
  const fus = nodePositions(G, "fuselage");
  assert.ok(Math.max(...fin.map((p) => p[1])) > Math.max(...fus.map((p) => p[1])) + 5.0,
    "кили поднимаются над корпусом");
});

test("CALATS: контроллер и панель на месте, режимы лора объявлены", () => {
  const controls = readFileSync(new URL("ca_enforcer_controls.js", dir), "utf8");
  const panel = readFileSync(new URL("ca_enforcer_panel.js", dir), "utf8");
  assert.ok(controls.includes("createEnforcerControls"), "контроллер экспортирован");
  assert.ok(panel.includes("createEnforcerPanel"), "панель экспортирована");
  for (const m of ["pad", "flight", "patrol", "siege"]) {
    assert.ok(controls.includes(m + ":"), "режим " + m);
  }
  const code = controls.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  assert.ok(!/thrusters\.scale/.test(code), "thrusters.scale запрещён");
  assert.ok(controls.includes("thrusters.material.opacity"), "яркость через opacity");
  for (const fn of ["setMode", "getMode", "setLegs", "setGuns", "setWings", "setBay",
                    "setThrust", "setStrobe", "setSpots", "setEngines",
                    "setShaderMode", "update", "getState"]) {
    assert.ok(controls.includes(fn + ":"), "метод " + fn);
  }
  // пушка и крылья крутятся ВОКРУГ ПЕТЛИ, иначе улетают от корпуса
  assert.ok(controls.includes("function pivotSet"), "поворот вокруг петли");
});

test("CALATS: демка собрана и грузит именно эту модель", () => {
  const demo = readFileSync(new URL("calico_enforcer_demo.html", dir), "utf8");
  assert.ok(demo.includes("createEnforcerControls"), "демка зовёт контроллер");
  assert.ok(demo.includes("createEnforcerPanel"), "демка зовёт панель");
  assert.ok(demo.includes("atob("), "GLB вшит в base64");
  assert.ok(!demo.includes("createPackliteControls"), "не осталось кода Packlite");
  assert.ok(demo.length > 2_000_000, "демка с вшитым GLB");
});

test("CALATS: все куски геометрии вывернуты НАРУЖУ (не просвечивают)", () => {
  // Регресс: PB.box() строил 8 граней из 12 наизнанку — в браузере
  // (материал односторонний) стены отбрасывались и корпус просвечивал.
  const bin = G.bin;
  const readV = (prim) => {
    const acc = G.json.accessors[prim.attributes.POSITION];
    const view = G.json.bufferViews[acc.bufferView];
    const start = (view.byteOffset || 0) + (acc.byteOffset || 0);
    const out = new Float64Array(acc.count * 3);
    for (let i = 0; i < acc.count * 3; i++) out[i] = bin.readFloatLE(start + i * 4);
    return out;
  };
  const readT = (prim) => {
    const acc = G.json.accessors[prim.indices];
    const view = G.json.bufferViews[acc.bufferView];
    const start = (view.byteOffset || 0) + (acc.byteOffset || 0);
    const out = new Int32Array(acc.count);
    const u32 = acc.componentType === 5125;
    for (let i = 0; i < acc.count; i++) {
      out[i] = u32 ? bin.readUInt32LE(start + i * 4) : bin.readUInt16LE(start + i * 2);
    }
    return out;
  };
  let checked = 0, bad = [];
  for (const node of G.json.nodes) {
    if (node.mesh == null) continue;
    const prim = G.json.meshes[node.mesh].primitives[0];
    const V = readV(prim);
    const T = readT(prim);
    const nv = V.length / 3;
    const keyOf = (i) => [V[i * 3], V[i * 3 + 1], V[i * 3 + 2]]
      .map((v) => Math.round(v * 1000)).join(",");
    const id = new Map();
    const rep = new Int32Array(nv);
    for (let i = 0; i < nv; i++) {
      const k = keyOf(i);
      if (!id.has(k)) id.set(k, id.size);
      rep[i] = id.get(k);
    }
    const par = new Int32Array(id.size);
    for (let i = 0; i < par.length; i++) par[i] = i;
    const find = (a) => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
    const ntri = T.length / 3;
    for (let t = 0; t < ntri; t++) {
      const a = find(rep[T[t * 3]]), b = find(rep[T[t * 3 + 1]]), c = find(rep[T[t * 3 + 2]]);
      par[b] = a;
      if (find(c) !== a) par[find(c)] = a;
    }
    const vol = new Map();
    for (let t = 0; t < ntri; t++) {
      const i0 = T[t * 3] * 3, i1 = T[t * 3 + 1] * 3, i2 = T[t * 3 + 2] * 3;
      const ax = V[i0], ay = V[i0 + 1], az = V[i0 + 2];
      const bx = V[i1], by = V[i1 + 1], bz = V[i1 + 2];
      const cx = V[i2], cy = V[i2 + 1], cz = V[i2 + 2];
      const v = ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx);
      const root = find(rep[T[t * 3]]);
      vol.set(root, (vol.get(root) || 0) + v / 6);
    }
    for (const [root, v] of vol) {
      checked++;
      if (v < -1e-6) bad.push(node.name + " объём " + v.toFixed(3) + " м3");
    }
  }
  assert.deepEqual(bad, [], "вывернутые куски: " + bad.slice(0, 6).join("; "));
  assert.ok(checked > 250, "проверено кусков: " + checked);
});
