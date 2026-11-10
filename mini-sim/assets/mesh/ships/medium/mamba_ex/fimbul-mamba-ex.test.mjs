import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";

const dir = new URL("./", import.meta.url);
const readText = (p) => readFile(new URL(p, dir), "utf8");

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

const glb = readFileSync(new URL("fimbul_mamba_ex.glb", dir));
const G = glbParts(glb);

test("FBLMEX: 30 узлов — два клыка, кабина, две турели, отсек, аппарель, шесть стоек", () => {
  const names = G.json.nodes.map((n) => n.name);
  for (const need of ["pod_r", "pod_l", "gun_r", "gun_l", "center_hull", "canopy",
                      "rear_block", "engines", "thrusters",
                      "turret_base_r", "turret_r", "turret_base_l", "turret_l",
                      "rail_guns_r", "rail_guns_l", "missile_bay", "bay_door",
                      "greebles", "decals", "lights", "beacon", "ramp"]) {
    assert.ok(names.includes(need), "узел " + need);
  }
  for (let i = 0; i < 6; i++) assert.ok(names.includes("leg_" + i), "стойка leg_" + i);
  assert.equal(names.length, 30, "30 узлов");

  // турели стоят на клыках и каждая на своём узле: разворот не ломает общий бокс
  for (const tag of ["r", "l"]) {
    const t = G.json.nodes.find((n) => n.name === "turret_" + tag);
    const b = G.json.nodes.find((n) => n.name === "turret_base_" + tag);
    assert.ok(t && t.translation && Math.abs(t.translation[2]) > 5.0, "турель " + tag + " на клыке");
    assert.ok(b && b.translation && Math.abs(b.translation[2]) > 5.0, "погон " + tag + " на клыке");
    assert.ok(t.translation[1] > b.translation[1], "башня выше погона " + tag);
  }
  // носовые блоки стволов — на срезе клыков, узел свой у каждого борта
  for (const tag of ["r", "l"]) {
    const g = G.json.nodes.find((n) => n.name === "gun_" + tag);
    assert.ok(g && g.translation && g.translation[0] < -16.0, "блок стволов " + tag + " в носу");
  }
  // крышка ракетного отсека — подвижный узел со своим мешем
  for (const n of ["bay_door"]) {
    const node = G.json.nodes.find((x) => x.name === n);
    assert.ok(node && node.mesh != null, n + " — отдельный меш");
  }
  // цвета в вершинах, своих текстур нет
  const prim = G.json.meshes[0].primitives[0];
  assert.ok(prim.attributes.COLOR_0 != null, "цвета в вершинах");
  assert.ok(G.json.images == null || G.json.images.length === 0, "без текстур: цвета в вершинах");
  assert.ok(G.json.materials.length >= 5, "материалы: корпус / тёмный / стекло / свечение / олива");
});

test("FBLMEX: нос — только ферма и клыки, широкой палубы впереди нет", () => {
  // Правка пользователя дважды: «левая и правая панели в ровень с серединой»,
  // «средняя часть меньше в пол кузова». Инвариант по геометрии: широкие
  // вершины корпуса (|z| > 4.0 — борт скорлупы) не заходят вперёд x = 1.5;
  // впереди идёт только осевая ферма с раскосами к клыкам (|z| < 3.9).
  const pts = nodePositions(G, "center_hull");
  const wide = pts.filter((p) => Math.abs(p[2]) > 4.0);
  const wideMinX = wide.reduce((a, p) => Math.min(a, p[0]), Infinity);
  assert.ok(wideMinX > 1.5, "широкая часть корпуса начинается не раньше x = " +
    wideMinX.toFixed(2));
  const fwd = pts.filter((p) => p[0] < 1.5);
  const fwdMaxZ = fwd.reduce((a, p) => Math.max(a, Math.abs(p[2])), 0);
  assert.ok(fwdMaxZ < 3.9, "впереди только ферма, до клыка: |z| max " + fwdMaxZ.toFixed(2));
  const pod = G.json.nodes.find((n) => n.name === "pod_r");
  const pa = G.json.accessors[G.json.meshes[pod.mesh].primitives[0].attributes.POSITION];
  const podInner = Math.min(pa.min[2], pa.max[2]) < 0 ? Math.min(Math.abs(pa.min[2]), Math.abs(pa.max[2])) : pa.min[2];
  // раскосы ввариваются в клык на 0.12 м (это стык, а не накладка на палубу)
  assert.ok(fwdMaxZ <= podInner + 0.25,
    "ферма утоплена между клыками: |z| " + fwdMaxZ.toFixed(2) + " <= " + podInner.toFixed(2));
});

test("FBLMEX: симметрия по бортам (регресс «сзади нет симметрии»)", () => {
  // Зеркальная проверка: у каждой вершины бокового узла должна быть пара по
  // другой стороне. Правка пользователя: палубные настилы, люки, укладки и
  // сканер стояли по одному борту — сзади читалась асимметрия.
  const tol = 0.10;
  const key = (p) => [p[0], p[1], p[2]].map((v) => Math.round(v / tol));
  const set = (pts) => new Set(pts.map((p) => key(p).join(",")));
  const near = (s, p) => {
    const k = key(p);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++)
          if (s.has([k[0] + dx, k[1] + dy, k[2] + dz].join(","))) return true;
    return false;
  };
  // одиночные узлы, обязанные быть зеркальными сами себе
  for (const name of ["center_hull", "canopy", "rear_block", "engines",
                      "missile_bay", "bay_door", "greebles", "decals", "lights", "beacon", "ramp"]) {
    const pts = nodePositions(G, name);
    const s = set(pts);
    const side = pts.filter((p) => Math.abs(p[2]) > 0.5);
    const bad = side.filter((p) => !near(s, [p[0], p[1], -p[2]]));
    assert.ok(bad.length <= side.length * 0.02,
      name + ": непарных по бортам " + bad.length + " из " + side.length);
  }
  // парные узлы: правый и левый — зеркальные копии друг друга
  for (const [a, b] of [["pod_r", "pod_l"], ["gun_r", "gun_l"],
                        ["turret_r", "turret_l"], ["rail_guns_r", "rail_guns_l"],
                        ["wing_root_r", "wing_root_l"]]) {
    const A = nodePositions(G, a);
    const B = nodePositions(G, b);
    const sB = set(B);
    const bad = A.filter((p) => !near(sB, [p[0], p[1], -p[2]]));
    assert.ok(bad.length <= A.length * 0.02,
      a + "/" + b + ": непарных вершин " + bad.length + " из " + A.length);
  }
});

test("FBLMEX: фонарь стоит выше боковых панелей (обзор пилоту)", () => {
  const pts = nodePositions(G, "canopy");
  const top = pts.reduce((a, p) => Math.max(a, p[1]), -Infinity);
  const low = pts.reduce((a, p) => Math.min(a, p[1]), Infinity);
  assert.ok(low > 7.4, "основание фонаря выше палубы: " + low.toFixed(2));
  assert.ok(top > 8.5, "верх фонаря над панелями: " + top.toFixed(2));
  // кабина компактная: не длиннее четверти корабля
  const x = pts.map((p) => p[0]);
  const len = Math.max(...x) - Math.min(...x);
  assert.ok(len < 9.0, "длина фонаря: " + len.toFixed(2));
});

test("FBLMEX: габарит 39 × 23.6 × 9 м, стойки на Y = 0", () => {
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
  assert.ok(L <= 40.0 + 0.4 && L > 36.5, "длина в габарите: " + L.toFixed(1));
  assert.ok(H <= 9.0 + 0.4 && H > 8.0, "высота в габарите: " + H.toFixed(1));
  assert.ok(W <= 24.0 + 0.4 && W > 22.0, "ширина в габарите: " + W.toFixed(1));
  assert.ok(Math.abs(box[1]) < 0.25, "стойки на Y=0: " + box[1].toFixed(2));

  // клыки держат полную ширину, центральный корпус заметно уже
  const pod = G.json.nodes.find((n) => n.name === "pod_r");
  const pa = G.json.accessors[G.json.meshes[pod.mesh].primitives[0].attributes.POSITION];
  assert.ok(pa.max[2] > 10.0, "правый клык до борта: " + pa.max[2].toFixed(1));
  const hull = G.json.nodes.find((n) => n.name === "center_hull");
  const ha = G.json.accessors[G.json.meshes[hull.mesh].primitives[0].attributes.POSITION];
  assert.ok(ha.max[2] < 6.6 && ha.max[2] < pa.max[2] - 4.0,
    "центральный корпус уже клыков: " + ha.max[2].toFixed(1));
  assert.ok(pa.max[2] - ha.max[2] > 2.0,
    "клыки вынесены на борт относительно центра: " + (pa.max[2] - ha.max[2]).toFixed(1));
});

function meshTris(g, nodeName) {
  const node = g.json.nodes.find((n) => n.name === nodeName);
  assert.ok(node && node.mesh != null, "узел " + nodeName);
  const prim = g.json.meshes[node.mesh].primitives[0];
  const acc = g.json.accessors[prim.attributes.POSITION];
  const view = g.json.bufferViews[acc.bufferView];
  const start = (view.byteOffset || 0) + (acc.byteOffset || 0);
  const t = node.translation || [0, 0, 0];
  const P = [];
  for (let i = 0; i < acc.count; i++) {
    const o = start + i * 12;
    P.push([g.bin.readFloatLE(o) + t[0], g.bin.readFloatLE(o + 4) + t[1],
            g.bin.readFloatLE(o + 8) + t[2]]);
  }
  const ia = g.json.accessors[prim.indices];
  const iview = g.json.bufferViews[ia.bufferView];
  const istart = (iview.byteOffset || 0) + (ia.byteOffset || 0);
  const T = [];
  for (let i = 0; i < ia.count; i += 3) {
    const k = [];
    for (let j = 0; j < 3; j++) {
      const off = istart + (i + j) * (ia.componentType === 5125 ? 4 : 2);
      k.push(ia.componentType === 5125 ? g.bin.readUInt32LE(off) : g.bin.readUInt16LE(off));
    }
    T.push(k);
  }
  return { P, T };
}

// вертикальный луч вниз из точки (px, py, pz): максимальная Y металла под ней
function topBelow(hull, px, py, pz) {
  let top = -Infinity;
  const { P, T } = hull;
  for (const [a, b, c] of T) {
    const A = P[a], B = P[b], C = P[c];
    const x0 = Math.min(A[0], B[0], C[0]), x1 = Math.max(A[0], B[0], C[0]);
    if (px < x0 - 1e-6 || px > x1 + 1e-6) continue;
    const z0 = Math.min(A[2], B[2], C[2]), z1 = Math.max(A[2], B[2], C[2]);
    if (pz < z0 - 1e-6 || pz > z1 + 1e-6) continue;
    // барицентрика в плоскости XZ (без учёта ориентации грани)
    const d = (B[2] - C[2]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[2] - C[2]);
    if (Math.abs(d) < 1e-9) continue;
    const l1 = ((B[2] - C[2]) * (px - C[0]) + (C[0] - B[0]) * (pz - C[2])) / d;
    const l2 = ((C[2] - A[2]) * (px - C[0]) + (A[0] - C[0]) * (pz - C[2])) / d;
    const l3 = 1 - l1 - l2;
    if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
    const y = l1 * A[1] + l2 * B[1] + l3 * C[1];
    if (y <= py + 0.30 && y > top) top = y;
  }
  return top;
}

test("FBLMEX: остекление сидит на обшивке (регресс «стёкла не висят»)", () => {
  // Обязательная проверка на каждом корабле: каждая нижняя вершина стекла
  // должна опираться на металл центрального корпуса — не висеть в воздухе.
  // Луч вниз пересекаем с треугольниками обшивки (без отсечения по нормали:
  // фасетки пишутся с запечённым затенением и часть граней смотрит внутрь).
  const hull = meshTris(G, "center_hull");
  const report = {};
  for (const name of ["canopy"]) {
    const pts = nodePositions(G, name);
    const minY = pts.reduce((a, p) => Math.min(a, p[1]), Infinity);
    const maxY = pts.reduce((a, p) => Math.max(a, p[1]), -Infinity);
    const base = pts.filter((p) => p[1] < minY + 0.18);
    let worst = 0, hanging = 0;
    for (const p of base) {
      const top = topBelow(hull, p[0], p[1], p[2]);
      const gap = p[1] - top;
      if (gap > worst) worst = gap;
      if (gap > 0.25) hanging++;
    }
    report[name] = { base: base.length, worst: +worst.toFixed(2), hanging };
    assert.equal(hanging, 0, name + ": висящих вершин " + hanging +
      " (макс. просвет " + worst.toFixed(2) + " м)");
    assert.ok(worst <= 0.25, name + ": стекло оторвано от обшивки на " + worst.toFixed(2) + " м");
    // и при этом остекление поднимается над металлом, а не утоплено в него
    assert.ok(maxY >= minY + 0.55, name + ": свод поднимается над основанием");
  }
  console.log("остекление:", JSON.stringify(report));
});

test("FBLMEX: режимы modes.json — палуба / полёт / охота / бриг", async () => {
  const j = JSON.parse(await readText("modes.json"));
  assert.equal(j.pods, 2);
  assert.equal(j.legs, 6);
  assert.deepEqual(j.dims, { L: 40.0, W: 24.0, H: 9.0 });
  assert.ok(j.gun_elev_deg >= 10, "подъём носовых стволов: " + j.gun_elev_deg);
  assert.ok(j.turret_yaw_deg > 60, "разворот турелей: " + j.turret_yaw_deg);
  assert.ok(j.bay_open_deg > 40, "раскрытие ракетного отсека: " + j.bay_open_deg);
  assert.ok(j.leg_retract > 1.0, "уборка стоек: " + j.leg_retract);
  assert.ok(j.barrels_per_pod >= 4, "четыре ствола на клык: " + j.barrels_per_pod);

  for (const m of ["pad", "flight", "hunt", "load"]) {
    assert.ok(j.modes[m], "режим " + m);
    assert.equal(j.modes[m].brig, undefined, "в режимах нет поля брига");
  }
  assert.equal(j.modes.pad.legs, 1, "на палубе стойки выпущены");
  assert.equal(j.modes.pad.guns, 0, "на палубе стволы в походном");
  assert.equal(j.modes.pad.bay, 0, "на палубе отсек закрыт");
  assert.equal(j.modes.flight.legs, 0, "в полёте стойки убраны");
  assert.ok(j.modes.flight.thrust > 0.4, "в полёте есть тяга");
  assert.equal(j.modes.hunt.guns, 1, "в охоте стволы подняты");
  assert.equal(j.modes.hunt.turret, 1, "в охоте турели развёрнуты");
  assert.equal(j.modes.hunt.bay, 1, "в охоте отсек открыт");
  assert.ok(j.modes.hunt.thrust > j.modes.flight.thrust * 0.8, "в охоте тяга не ниже маршевой");
  assert.equal(j.modes.load.bay, 1, "в погрузке отсек открыт");
  assert.equal(j.modes.load.legs, 1, "в погрузке стойки выпущены");
  assert.ok(j.modes.load.interior > 0.8, "в погрузке интерьер подсвечен");
  assert.ok(j.modes.hunt.strobe >= j.modes.pad.strobe, "стробы в охоте ярче");
});

test("FBLMEX: контроллер/панель без внешних зависимостей, демка автономна", async () => {
  const ctrl = await readText("fimbul_mamba_ex_controls.js");
  const panel = await readText("fimbul_mamba_ex_panel.js");
  for (const src of [ctrl, panel]) {
    assert.ok(!/import\s|require\(/.test(src), "без import/require");
    assert.ok(!/https?:\/\//.test(src), "без сетевых ссылок");
  }
  assert.ok(ctrl.includes("MeshBasicMaterial"), "CPU-путь unlit");
  assert.ok(ctrl.includes("MeshLambertMaterial"), "шейдерный путь как опция");
  for (const m of ["pad", "flight", "hunt", "load"]) assert.ok(ctrl.includes(m), "режим " + m);
  assert.ok(ctrl.includes("'brig'") && ctrl.includes("'load'"),
    "старое имя режима принимается псевдонимом");
  assert.ok(!/getObjectByName\('brig_door'\)/.test(ctrl), "контроллер не ищет дверь брига");
  for (const setter of ["setLegs", "setGuns", "setTurret", "setBay",
                        "setThrust", "setStrobe", "setSpots", "setEngines",
                        "setShaderMode"]) {
    assert.ok(ctrl.includes(setter), "API " + setter);
  }
  assert.ok(panel.includes("createFimbulMambaPanel"), "панель управления");

  const html = await readText("fimbul_mamba_ex_demo.html");
  assert.ok(html.includes("REVISION"), "three встроен");
  assert.ok(html.includes("class GLTFLoader"), "GLTFLoader встроен");
  assert.ok(html.includes("createFimbulMambaControls") && html.includes("createFimbulMambaPanel"),
    "контроллер и панель");
  assert.ok(html.length > 1_500_000, "GLB вшит в base64: " + html.length);
  assert.ok(!/src="http/.test(html), "никаких внешних скриптов");
});
