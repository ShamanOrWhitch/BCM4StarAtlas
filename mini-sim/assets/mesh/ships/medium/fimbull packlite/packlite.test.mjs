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

const glb = readFileSync(new URL("packlite.glb", dir));
const G = glbParts(glb);

test("PL: 40 узлов — рубка, палуба, контейнеры, ферма, сопла, гондолы", () => {
  const names = G.json.nodes.map((n) => n.name);
  for (const need of ["center_hull", "bridge", "canopy", "intake_r", "intake_l",
                      "cargo_deck", "cargo_hold", "radar_tower", "deck_crane", "engine_frame",
                      "nozzle_cluster", "pod_r0", "pod_r1", "pod_l0", "pod_l1",
                      "cm_pod_r", "cm_pod_l", "thrusters", "greebles", "decals",
                      "lights", "beacon", "turret_r", "turret_l",
                      "cargo_lid_r", "cargo_lid_l"]) {
    assert.ok(names.includes(need), "узел " + need);
  }
  for (let i = 0; i < 4; i++) assert.ok(names.includes("leg_" + i), "лыжа leg_" + i);
  for (const tag of ["r", "l"]) {
    for (let i = 0; i < 5; i++) {
      assert.ok(names.includes("container_" + tag + i), "контейнер " + tag + i);
    }
  }
  // подвижные узлы — отдельные меши с собственной геометрией
  for (const n of ["turret_r", "turret_l", "cargo_lid_r", "cargo_lid_l"]) {
    const d = G.json.nodes.find((x) => x.name === n);
    assert.ok(d && d.mesh != null, n + " — отдельный меш");
  }
  assert.equal(names.length, 40, "39 узлов, найдено " + names.length);
});

test("PL: габарит по карточке 67.1 × 26.5 × 21.6 м, лыжи на Y = 0", () => {
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
  assert.ok(L <= 67.1 + 1.0 && L > 60.0, "длина в габарите: " + L.toFixed(1));
  assert.ok(W <= 26.5 + 0.6 && W > 20.0, "ширина в габарите: " + W.toFixed(1));
  assert.ok(H <= 21.6 + 0.8 && H > 17.0, "высота в габарите: " + H.toFixed(1));
  assert.ok(Math.abs(box[1]) < 0.25, "лыжи на Y=0: " + box[1].toFixed(2));
});

test("PL: корпус — вытянутая баржа (длина сильно больше ширины корпуса)", () => {
  const hull = G.json.accessors[G.json.meshes[
    G.json.nodes.find((n) => n.name === "center_hull").mesh].primitives[0].attributes.POSITION];
  const hl = hull.max[0] - hull.min[0], hw = hull.max[2] - hull.min[2];
  assert.ok(hl / hw > 3.2, "корпус вытянутый: " + (hl / hw).toFixed(2));
  // без центрального киля и шпилей: ничего выше мачты
  const tower = nodePositions(G, "radar_tower");
  assert.ok(Math.max(...tower.map((p) => p[1])) < 21.6, "мачта в габарите");
});

test("PL: пять сопел — свечение в своих устьях, не за срезом", () => {
  const glow = nodePositions(G, "thrusters");
  const noz = nodePositions(G, "nozzle_cluster");
  const xMax = Math.max(...noz.map((p) => p[0]));
  assert.ok(Math.max(...glow.map((p) => p[0])) <= xMax + 1e-3,
    "свечение не торчит из среза");
  // центры пяти струй: одно в центре, четыре по углам
  const cy = (Math.min(...noz.map((p) => p[1])) + Math.max(...noz.map((p) => p[1]))) / 2;
  const cz = (Math.min(...noz.map((p) => p[2])) + Math.max(...noz.map((p) => p[2]))) / 2;
  const near = (v, t, tol) => Math.abs(v - t) <= tol;
  let center = 0, corners = 0;
  for (const p of glow) {
    if (near(p[1], cy, 1.2) && near(p[2], cz, 1.2)) center++;
    else if (Math.abs(p[1] - cy) > 1.0 && Math.abs(p[2] - cz) > 1.0) corners++;
  }
  assert.ok(center > 0, "есть центральная струя");
  assert.ok(corners > 0, "есть угловые струи");
});

test("PL: контейнеры лежат на палубе (низ на уровне настила)", () => {
  // уровень настила берём по обшивке корпуса, а не по ограждению палубы
  const hull = nodePositions(G, "center_hull").filter((p) => p[0] > -18 && p[0] < 12);
  const deckTop = Math.max(...hull.map((p) => p[1]));
  for (const tag of ["r", "l"]) {
    for (let i = 0; i < 5; i++) {
      const c = nodePositions(G, "container_" + tag + i);
      const y0 = Math.min(...c.map((p) => p[1]));
      assert.ok(y0 > deckTop - 0.9 && y0 < deckTop + 0.6,
        "контейнер " + tag + i + " на палубе: низ " + y0.toFixed(2) +
        " при палубе " + deckTop.toFixed(2));
    }
  }
});

test("PL: гондолы вынесены на борт, внутри габарита по ширине", () => {
  for (const tag of ["r", "l"]) {
    for (let i = 0; i < 2; i++) {
      const p = nodePositions(G, "pod_" + tag + i);
      const z = Math.max(...p.map((q) => Math.abs(q[2])));
      assert.ok(z > 9.0 && z <= 13.3, "гондола " + tag + i + " на борту: |z| " + z.toFixed(1));
    }
  }
});

test("PL: декор в габарите обшивки (не висит по бокам)", () => {
  const hull = G.json.accessors[G.json.meshes[
    G.json.nodes.find((n) => n.name === "center_hull").mesh].primitives[0].attributes.POSITION];
  const hullW = Math.max(Math.abs(hull.min[2]), Math.abs(hull.max[2]));
  for (const name of ["greebles", "decals", "lights", "beacon"]) {
    const acc = G.json.accessors[G.json.meshes[
      G.json.nodes.find((n) => n.name === name).mesh].primitives[0].attributes.POSITION];
    assert.ok(Math.max(Math.abs(acc.min[2]), Math.abs(acc.max[2])) <= hullW + 0.7,
      name + " не вылезает за борт: |z| " +
      Math.max(Math.abs(acc.min[2]), Math.abs(acc.max[2])).toFixed(2));
  }
});

test("PL: рубка в носу, ферма и сопла в корме", () => {
  const br = nodePositions(G, "bridge");
  const fr = nodePositions(G, "engine_frame");
  const noz = nodePositions(G, "nozzle_cluster");
  assert.ok(Math.max(...br.map((p) => p[0])) < -18.0, "рубка в носовой части");
  assert.ok(Math.min(...fr.map((p) => p[0])) > 12.0, "ферма в кормовой части");
  assert.ok(Math.min(...noz.map((p) => p[0])) > 28.0, "сопла на самом срезе кормы");
});

test("PL: контроллер и панель на месте, режимы объявлены", () => {
  const controls = readFileSync(new URL("packlite_controls.js", dir), "utf8");
  const panel = readFileSync(new URL("packlite_panel.js", dir), "utf8");
  assert.ok(controls.includes("createPackliteControls"), "контроллер экспортирован");
  assert.ok(panel.includes("createPacklitePanel"), "панель экспортирована");
  for (const m of ["pad", "flight", "hunt", "load"]) {
    assert.ok(controls.includes(m + ":"), "режим " + m);
  }
  // никакого масштабирования узла свечения — только непрозрачность
  // (в комментарии-пояснении старое `thrusters.scale` упоминаться может)
  const code = controls.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  assert.ok(!/thrusters\.scale/.test(code), "thrusters.scale запрещён");
  assert.ok(controls.includes("thrusters.material.opacity"), "яркость через opacity");
  // совместимость со старым API контроллера
  for (const fn of ["setMode", "getMode", "setLegs", "setGuns", "setLid", "setThrust",
                    "setStrobe", "setSpots", "setEngines", "setShaderMode", "update",
                    "getState"]) {
    assert.ok(controls.includes(fn + ":"), "метод " + fn);
  }
});

test("PL: демка собрана и грузит именно эту модель", () => {
  const demo = readFileSync(new URL("packlite_demo.html", dir), "utf8");
  assert.ok(demo.includes("createPackliteControls"), "демка зовёт контроллер");
  assert.ok(demo.includes("createPacklitePanel"), "демка зовёт панель");
  assert.ok(demo.includes("atob("), "GLB вшит в base64");
  assert.ok(!demo.includes("createPearceF4Controls"), "не осталось кода PF4");
  assert.ok(demo.length > 2_000_000, "демка с вшитым GLB");
});

test("PL: все куски геометрии вывернуты НАРУЖУ (не просвечивают)", () => {
  // Регресс: PB.box() строил 8 граней из 12 наизнанку — в браузере
  // (материал односторонний) стены отбрасывались и контейнеры «просвечивали».
  // Теперь генератор сам чинит ориентацию, а тест это стережёт: знаковый
  // объём каждого замкнутого куска обязан быть положительным.
  const bin = G.bin;
  const readV = (prim) => {
    const acc = G.json.accessors[prim.attributes.POSITION];
    const view = G.json.bufferViews[acc.bufferView];
    const start = (view.byteOffset || 0) + (acc.byteOffset || 0);
    const out = new Float64Array(acc.count * 3);
    for (let i = 0; i < acc.count * 3; i++) {
      out[i] = bin.readFloatLE(start + i * 4);
    }
    return out;
  };
  const readT = (prim) => {
    const acc = G.json.accessors[prim.indices];
    const view = G.json.bufferViews[acc.bufferView];
    const start = (view.byteOffset || 0) + (acc.byteOffset || 0);
    const out = new Int32Array(acc.count);
    // индексы бывают и uint16, и uint32 — читаем по фактическому типу
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
    // сварка вершин по позиции, чтобы куски считались связными
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
      // a · (b × c)
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
  assert.ok(checked > 400, "проверено кусков: " + checked);
});
