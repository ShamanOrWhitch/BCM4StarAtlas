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


const glb = readFileSync(new URL("pearce_f4.glb", dir));
const G = glbParts(glb);

test("PF4: 30 узлов — балки, фонарь, отсек, аппарель, крылья, шасси", () => {
  const names = G.json.nodes.map((n) => n.name);
  for (const need of ["center_hull", "canopy", "rear_block", "missile_bay", "scanner",
                      "thrusters", "greebles", "decals", "lights", "beacon",
                      "boom_r", "boom_l", "engine_r", "engine_l",
                      "wing_r", "wing_l",
                      "gun_r", "gun_l", "cm_pod_r", "cm_pod_l",
                      "bay_door_r", "bay_door_l", "ramp_ext_r", "ramp_ext_l",
                      "bay_lid_r", "bay_lid_l",
                      "cargo_bay"]) {
    assert.ok(names.includes(need), "узел " + need);
  }
  for (let i = 0; i < 3; i++) assert.ok(names.includes("leg_" + i), "стойка leg_" + i);
  assert.equal(names.length, 30, "30 узлов");
  // аппарель и створки ракетного отсека — свои подвижные узлы с мешами
  for (const tag of ["r", "l"]) {
    for (const prefix of ["bay_door_", "ramp_ext_", "bay_lid_"]) {
      const d = G.json.nodes.find((n) => n.name === prefix + tag);
      assert.ok(d && d.mesh != null, prefix + tag + " — отдельный меш");
    }
  }
  assert.ok(G.json.images == null || G.json.images.length === 0, "без текстур: цвета в вершинах");
  assert.ok(G.json.materials.length >= 5, "материалы: корпус / тёмный / стекло / свечение / дюза");
  const prim = G.json.meshes[0].primitives[0];
  assert.ok(prim.attributes.COLOR_0 != null, "цвета в вершинах");
});

test("PF4: две двигательные балки уходят в КОРМУ, форштевень тупой в носу", () => {
  for (const tag of ["r", "l"]) {
    const pts = nodePositions(G, "boom_" + tag);
    const x = pts.map((p) => p[0]);
    assert.ok(Math.max(...x) > 28.0 && Math.max(...x) < 29.4,
      "балка " + tag + " идёт во всю длину: " + Math.max(...x).toFixed(1));
    assert.ok(Math.min(...x) < 2.5, "балка " + tag + " врастает в корпус: " +
      Math.min(...x).toFixed(1));
    const zc = pts.reduce((a, p) => a + Math.abs(p[2]), 0) / pts.length;
    assert.ok(zc > 4.5, "балка " + tag + " на своём борту: |z| " + zc.toFixed(2));
  }
  // нос — тупой форштевень: ширина корпуса в носу заметно больше нуля
  const hull = nodePositions(G, "center_hull");
  const nose = hull.filter((p) => p[0] < -28.0);
  const noseW = nose.reduce((a, p) => Math.max(a, Math.abs(p[2])), 0);
  assert.ok(noseW > 0.4, "форштевень не игла: |z| " + noseW.toFixed(2));
  // корпус глубокий, а не «плоский блин»: высота борта заметно больше прежней
  const hb = nodePositions(G, "center_hull");
  const hbot = hb.reduce((a, p) => Math.min(a, p[1]), Infinity);
  const htop = hb.reduce((a, p) => Math.max(a, p[1]), -Infinity);
  assert.ok(htop - hbot > 3.4, "глубина корпуса (борт): " + (htop - hbot).toFixed(2));
  const bm = nodePositions(G, "boom_r");
  const bbot = bm.reduce((a, p) => Math.min(a, p[1]), Infinity);
  const btop = bm.reduce((a, p) => Math.max(a, p[1]), -Infinity);
  assert.ok(btop - bbot > 3.9, "глубина двигательной балки: " + (btop - bbot).toFixed(2));
  const bz = bm.reduce((a, p) => Math.max(a, Math.abs(p[2])), 0);
  assert.ok(bz > 8.4, "балка толще: полуширина " + bz.toFixed(2));
  // кабина в носовой половине, балки — в кормовой
  const can = nodePositions(G, "canopy").map((p) => p[0]);
  const canMid = (Math.min(...can) + Math.max(...can)) / 2;
  assert.ok(canMid < 0, "фонарь в носовой половине: " + canMid.toFixed(1));
});

test("PF4: симметрия по бортам (регресс «сзади нет симметрии»)", () => {
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
  for (const name of ["center_hull", "canopy", "rear_block", "missile_bay", "scanner",
                      "greebles", "decals", "lights", "beacon"]) {
    const pts = nodePositions(G, name);
    const s = set(pts);
    const side = pts.filter((p) => Math.abs(p[2]) > 0.5);
    const bad = side.filter((p) => !near(s, [p[0], p[1], -p[2]]));
    assert.ok(bad.length <= side.length * 0.02,
      name + ": непарных по бортам " + bad.length + " из " + side.length);
  }
  for (const [a, b] of [["boom_r", "boom_l"], ["engine_r", "engine_l"],
                        ["gun_r", "gun_l"], ["cm_pod_r", "cm_pod_l"],
                        ["bay_door_r", "bay_door_l"]]) {
    const A = nodePositions(G, a);
    const sB = set(nodePositions(G, b));
    const bad = A.filter((p) => !near(sB, [p[0], p[1], -p[2]]));
    assert.ok(bad.length <= A.length * 0.02,
      a + "/" + b + ": непарных вершин " + bad.length + " из " + A.length);
  }
});

test("PF4: фонарь на броневом горбе — выше палубы, компактный", () => {
  const pts = nodePositions(G, "canopy");
  const top = pts.reduce((a, p) => Math.max(a, p[1]), -Infinity);
  const low = pts.reduce((a, p) => Math.min(a, p[1]), Infinity);
  const x = pts.map((p) => p[0]);
  const x0 = Math.min(...x), x1 = Math.max(...x);
  // верх обшивки под фонарём — это свод горба кабины
  const hull = nodePositions(G, "center_hull");
  const under = hull.filter((p) => p[0] > x0 - 0.5 && p[0] < x1 + 0.5 &&
                                   Math.abs(p[2]) < 2.2);
  const humpTop = under.reduce((a, p) => Math.max(a, p[1]), -Infinity);
  const deck = under.reduce((a, p) => Math.min(a, p[1]), Infinity);
  assert.ok(low <= humpTop + 0.10, "основание фонаря не выше свода горба: " +
    low.toFixed(2) + " <= " + humpTop.toFixed(2));
  assert.ok(low > deck + 0.6, "фонарь поднят над палубой: " + low.toFixed(2));
  assert.ok(top > humpTop + 0.5, "свод поднимается над горбом: " + top.toFixed(2) +
    " / " + humpTop.toFixed(2));
  assert.ok(x1 - x0 < 13.0, "фонарь компактный");
});

test("PF4: габарит 58 × 40 × 16 м, стойки на Y = 0", () => {
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
  assert.ok(L <= 58.0 + 1.5 && L > 52.0, "длина в габарите: " + L.toFixed(1));
  assert.ok(W <= 40.0 + 0.8 && W > 17.0, "ширина в габарите: " + W.toFixed(1));
  assert.ok(H <= 16.0 + 0.6 && H > 8.0, "высота в габарите: " + H.toFixed(1));
  assert.ok(Math.abs(box[1]) < 0.25, "стойки на Y=0: " + box[1].toFixed(2));
  // размах даёт крыло, а не корпус: корпус заметно уже
  const hull = G.json.accessors[G.json.meshes[
    G.json.nodes.find((n) => n.name === "center_hull").mesh].primitives[0].attributes.POSITION];
  assert.ok(hull.max[2] < 8.6, "корпус уже крыла: " + hull.max[2].toFixed(1));
  // лопасти-крылья вернулись по разметке; малых передних плоскостей нет
  for (const need of ["wing_r", "wing_l"]) {
    assert.ok(G.json.nodes.find((n) => n.name === need), "узел " + need + " на месте");
  }
  for (const gone of ["canard_r", "canard_l"]) {
    assert.equal(G.json.nodes.find((n) => n.name === gone), undefined,
      "узла " + gone + " быть не должно");
  }
  const rear = nodePositions(G, "rear_block");
  assert.ok(Math.max(...rear.map((p) => p[1])) < 7.6,
    "кормового хвоста-киля нет: " + Math.max(...rear.map((p) => p[1])).toFixed(2));
  // размах дают лопасти-крылья; они заметно шире балок (19.3 м), но в 40 м
  assert.ok(W > 24.0 && W < 34.0, "размах с лопастями: " + W.toFixed(1));
});

test("PF4: остекление сидит на обшивке (регресс «стёкла не висят»)", () => {
  const hull = meshTris(G, "center_hull");
  const pts = nodePositions(G, "canopy");
  const minY = pts.reduce((a, p) => Math.min(a, p[1]), Infinity);
  const maxY = pts.reduce((a, p) => Math.max(a, p[1]), -Infinity);
  const base = pts.filter((p) => p[1] < minY + 0.20);
  let worst = 0, hanging = 0;
  for (const p of base) {
    const top = topBelow(hull, p[0], p[1], p[2]);
    const gap = p[1] - top;
    if (gap > worst) worst = gap;
    if (gap > 0.25) hanging++;
  }
  assert.equal(hanging, 0, "висящих вершин " + hanging + " (макс. просвет " + worst.toFixed(2) + " м)");
  assert.ok(worst <= 0.25, "стекло оторвано от обшивки на " + worst.toFixed(2) + " м");
  assert.ok(maxY >= minY + 1.0, "свод поднимается над основанием");
  console.log("остекление: базовых вершин", base.length, "| макс. просвет", worst.toFixed(3));
});

test("PF4: режимы modes.json — палуба / полёт / охота / погрузка", async () => {
  const j = JSON.parse(await readText("modes.json"));
  assert.equal(j.pods, 2);
  assert.equal(j.guns, 2);
  assert.equal(j.legs, 3);
  assert.deepEqual(j.dims, { L: 58.0, W: 40.0, H: 16.0 });
  assert.ok(j.gun_elev_deg >= 10, "подъём орудий: " + j.gun_elev_deg);
  assert.ok(j.bay_open_deg > 60 && j.bay_open_deg <= 90, "раскрытие створок отсека: " + j.bay_open_deg);
  // аппарель закрыта вертикально в проёме; полное раскрытие — «ещё 90°+»
  assert.ok(j.ramp_open_deg >= 130 && j.ramp_open_deg <= 160,
    "раскрытие кормовой аппарели (из вертикали вниз-назад): " + j.ramp_open_deg);
  assert.ok(j.ramp_ext_len > 1.5, "выдвижная ступень трапа: " + j.ramp_ext_len);
  assert.ok(j.leg_retract > 1.0, "уборка стоек: " + j.leg_retract);
  assert.ok(j.barrels_per_pod >= 2, "стволы в пере: " + j.barrels_per_pod);
  for (const m of ["pad", "flight", "hunt", "load"]) {
    assert.ok(j.modes[m], "режим " + m);
    assert.equal(j.modes[m].turret, undefined, "турелей нет — поле не нужно");
  }
  assert.equal(j.modes.pad.legs, 1, "на палубе стойки выпущены");
  assert.equal(j.modes.pad.bay, 0, "на палубе аппарель закрыта");
  assert.equal(j.modes.pad.lid, 0, "на палубе створки отсека закрыты");
  assert.equal(j.modes.flight.legs, 0, "в полёте стойки убраны");
  assert.ok(j.modes.flight.thrust > 0.4, "в полёте есть тяга");
  assert.equal(j.modes.hunt.guns, 1, "в охоте орудия подняты");
  assert.equal(j.modes.hunt.lid, 1, "в охоте створки ракетного отсека открыты");
  assert.equal(j.modes.hunt.bay, 0, "в бою кормовая аппарель закрыта");
  assert.equal(j.modes.load.bay, 1, "в погрузке аппарель опущена");
  assert.equal(j.modes.load.lid, 0, "в погрузке створки отсека закрыты");
  assert.ok(j.modes.load.interior > 0.8, "в погрузке интерьер подсвечен");
});

test("PF4: корма срезана, аппарель закрывает проём, трап достаёт палубу", async () => {
  const j = JSON.parse(await readText("modes.json"));
  // корпус укорочен: корма заканчивается на x ≈ 17.6 (между балками — пусто)
  const hull = nodePositions(G, "center_hull");
  const hullMax = Math.max(...hull.map((p) => p[0]));
  assert.ok(hullMax > 15.0 && hullMax < 16.4, "корпус срезан на x " + hullMax.toFixed(1));
  // задняя середина заметно короче: между балками за срезом корпуса пусто
  const inside = hull.filter((p) => p[0] > 16.0 && p[0] < 22.0 &&
    Math.abs(p[2]) < 1.8 && p[1] > 3.4 && p[1] < 5.6);
  assert.equal(inside.length, 0, "вырез в корме сквозной, без заглушки");

  // «закрылки наверху» убраны: в зоне бывшей плиты с жалюзи (x ≈ 13.2) пусто
  for (const node of G.json.nodes) {
    if (node.mesh == null) continue;
    const bad = nodePositions(G, node.name).filter((p) => p[0] > 12.4 && p[0] < 14.0 &&
      p[1] > 4.2 && p[1] < 5.8 && Math.abs(p[2]) < 1.3);
    assert.equal(bad.length, 0, "плита с жалюзи на палубе вернулась: " + node.name);
  }

  // аппарель: петля в пороге кормового проёма
  const node = G.json.nodes.find((n) => n.name === "bay_door_r");
  const hinge = node.translation || [0, 0, 0];
  assert.ok(hinge[0] > 15.0 && hinge[0] < 15.7, "петля аппарели: x " + hinge[0].toFixed(1));
  assert.ok(hinge[1] > 3.0 && hinge[1] < 4.4, "петля в плоскости днища: " + hinge[1].toFixed(2));
  // полотно растёт вверх от петли: закрытая поза = вертикально в проёме
  const pts = nodePositions(G, "bay_door_r");
  const leafLen = Math.max(...pts.map((p) => p[1])) - hinge[1];
  assert.ok(leafLen > 2.0 && leafLen < 2.6, "длина полотна: " + leafLen.toFixed(2));
  const leafTop = hinge[1] + leafLen;
  assert.ok(leafTop > 5.85 && leafTop < 6.25,
    "закрытая аппарель закрывает проём до притолоки: Y " + leafTop.toFixed(2));

  // выдвижная ступень спрятана ЗА полотном (в покое не видна снаружи)
  const ext = nodePositions(G, "ramp_ext_r");
  assert.ok(Math.max(...ext.map((p) => p[0])) < hinge[0] - 0.17,
    "ступень убрана за полотно");
  const extLen = Math.max(...ext.map((p) => p[1])) - hinge[1];

  // раскрытие 148° из вертикали: трап уходит вниз-назад, пятка на палубе (Y ≈ 0)
  const below = j.ramp_open_deg - 90;                  // угол ниже горизонта
  const reach = leafLen + extLen - 0.15;               // полотно + выдвижная ступень
  const rad = below * Math.PI / 180;
  const footY = hinge[1] - reach * Math.sin(rad);
  assert.ok(Math.abs(footY) < 0.55, "пятка трапа на палубе: Y " + footY.toFixed(2));
  const footX = hinge[0] + reach * Math.cos(rad);
  assert.ok(footX < 19.5, "трап не вытягивает корму: x " + footX.toFixed(1));

  // задняя середина укорочена: корпус кончается раньше двигательных балок
  assert.ok(hullMax < 16.4, "кормовой обрез корпуса: x " + hullMax.toFixed(1));
  const booms = nodePositions(G, "boom_r").map((p) => p[0]);
  assert.ok(Math.max(...booms) - hullMax > 12.5 && Math.max(...booms) - hullMax < 14.5,
    "балки длиннее середины на: " + (Math.max(...booms) - hullMax).toFixed(1) + " м");
  // балки вынесены наружу: внешняя кромка заметно дальше борта корпуса
  const boomZ = Math.max(...nodePositions(G, "boom_r").map((p) => Math.abs(p[2])));
  assert.ok(boomZ > 9.0, "балки выпирают наружу: |z| " + boomZ.toFixed(2));
});

test("PF4: контроллер/панель без внешних зависимостей, демка автономна", async () => {
  const ctrl = await readText("pearce_f4_controls.js");
  const panel = await readText("pearce_f4_panel.js");
  for (const src of [ctrl, panel]) {
    assert.ok(!/import\s|require\(/.test(src), "без import/require");
    assert.ok(!/https?:\/\//.test(src), "без сетевых ссылок");
  }
  assert.ok(ctrl.includes("MeshBasicMaterial"), "CPU-путь unlit");
  assert.ok(ctrl.includes("MeshLambertMaterial"), "шейдерный путь как опция");
  for (const m of ["pad", "flight", "hunt", "load"]) assert.ok(ctrl.includes(m), "режим " + m);
  for (const setter of ["setLegs", "setGuns", "setBay", "setThrust", "setStrobe",
                        "setSpots", "setEngines", "setShaderMode"]) {
    assert.ok(ctrl.includes(setter), "API " + setter);
  }
  assert.ok(ctrl.includes("gun_") && ctrl.includes("bay_door_") && ctrl.includes("leg_"),
    "имена узлов прежние");
  assert.ok(panel.includes("createPearceF4Panel"), "панель управления");

  const html = await readText("pearce_f4_demo.html");
  assert.ok(html.includes("REVISION"), "three встроен");
  assert.ok(html.includes("class GLTFLoader"), "GLTFLoader встроен");
  assert.ok(html.includes("createPearceF4Controls") && html.includes("createPearceF4Panel"),
    "контроллер и панель");
  assert.ok(html.length > 1_500_000, "GLB вшит в base64: " + html.length);
  assert.ok(!/src="http/.test(html), "никаких внешних скриптов");
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


test("PF4: кормовой торец корпуса смотрит НАРУЖУ (регресс «дыра у входа»)", () => {
  // Раньше крышка лофта получалась вывернутой внутрь (−X): с отсечением
  // граней её не было видно, и забранная плоскость кормы читалась дырой.
  const node = G.json.nodes.find((n) => n.name === "center_hull");
  const prim = G.json.meshes[node.mesh].primitives[0];
  const acc = G.json.accessors[prim.attributes.POSITION];
  const view = G.json.bufferViews[acc.bufferView];
  const start = (view.byteOffset || 0) + (acc.byteOffset || 0);
  const P = [];
  for (let i = 0; i < acc.count; i++) {
    const o = start + i * 12;
    P.push([G.bin.readFloatLE(o), G.bin.readFloatLE(o + 4), G.bin.readFloatLE(o + 8)]);
  }
  const ia = G.json.accessors[prim.indices];
  const iv = G.json.bufferViews[ia.bufferView];
  const io = (iv.byteOffset || 0) + (ia.byteOffset || 0);
  // плоскость кормового торца корпуса — последняя станция лофта
  const plane = 15.40;
  let out = 0, inn = 0;
  for (let i = 0; i < ia.count; i += 3) {
    const a = P[G.bin.readUInt32LE(io + i * 4)];
    const b = P[G.bin.readUInt32LE(io + (i + 1) * 4)];
    const c = P[G.bin.readUInt32LE(io + (i + 2) * 4)];
    const inPlane = Math.abs(a[0] - plane) < 0.005 && Math.abs(b[0] - plane) < 0.005 &&
      Math.abs(c[0] - plane) < 0.005;
    if (!inPlane) continue;
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const nx = u[1] * v[2] - u[2] * v[1];
    const area = Math.hypot(nx, u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2;
    if (nx > 0) out += area; else inn += area;
  }
  assert.ok(out > 1.0, "площадь торца, смотрящая наружу: " + out.toFixed(2) + " м²");
  assert.equal(inn, 0, "вывернутых граней на торце нет");
});

test("PF4: решётка сопла сидит ВНУТРИ устья (регресс «детали мимо друг друга»)", () => {
  // Ячейки свечения обязаны лежать внутри круглого устья сопла и быть
  // утоплены за плоскость среза — раньше сетка свисала за кромку обоймы.
  const boom = nodePositions(G, "boom_r");
  const xEnd = Math.max(...boom.map((p) => p[0]));
  const glow = nodePositions(G, "thrusters").filter((p) => p[0] > xEnd - 0.8 && p[2] > 0);
  assert.ok(glow.length > 100, "ячейки сопла на месте: " + glow.length);
  // центр и полуразмеры сечения балки на срезе
  const yc = (Math.min(...glow.map((p) => p[1])) + Math.max(...glow.map((p) => p[1]))) / 2;
  const zc = (Math.min(...glow.map((p) => p[2])) + Math.max(...glow.map((p) => p[2]))) / 2;
  const hh = (Math.max(...boom.map((p) => p[1])) - Math.min(...boom.map((p) => p[1]))) / 2;
  const hw = (Math.max(...boom.map((p) => p[2])) - Math.min(...boom.map((p) => p[2]))) / 2;
  let worst = 0;
  for (const p of glow) {
    const dy = Math.abs(p[1] - 5.51) / hh;
    const dz = Math.abs(p[2] - zc) / hw;
    worst = Math.max(worst, Math.hypot(dy, dz));
    assert.ok(p[0] < xEnd + 0.05, "решётка не торчит из среза: x " + p[0].toFixed(2));
  }
  assert.ok(worst < 0.80, "решётка в пределах устья (0.78): " + worst.toFixed(2));
});

test("PF4: лопасти-крылья на месте (малые, свип вперёд-наружу)", () => {
  for (const tag of ["r", "l"]) {
    const w = nodePositions(G, "wing_" + tag);
    const xs = w.map((p) => p[0]);
    const span = Math.max(...w.map((p) => Math.abs(p[2])));
    assert.ok(span > 12.0 && span < 16.0, "размах лопасти: |z| " + span.toFixed(1));
    // СВИП НАЗАД: законцовка отведена в КОРМУ (+X), а не вперёд
    const tipX = Math.max(...w.filter((p) => Math.abs(p[2]) > span - 0.6).map((p) => p[0]));
    const rootX = Math.min(...w.filter((p) => Math.abs(p[2]) < 9.0).map((p) => p[0]));
    // лопасть посажена НИЗКО и БЛИЖЕ К НОСУ (по разметке на демке)
    const rootY = Math.max(...w.filter((p) => Math.abs(p[2]) < 9.0).map((p) => p[1]));
    assert.ok(rootY < 4.7, "корень лопасти низко по борту: y " + rootY.toFixed(2));
    assert.ok(rootX < -9.0, "корень ближе к носу: x " + rootX.toFixed(1));
    assert.ok(tipX > rootX + 4.0,
      "лопасть уходит в корму: корень x " + rootX.toFixed(1) + " → законцовка x " + tipX.toFixed(1));
    assert.ok(tipX > 3.0, "законцовка в кормовой части: x " + tipX.toFixed(1));
    // тонкая, а не плита (толщина вместе с ливреей и законцовкой)
    const ys = w.map((p) => p[1]);
    assert.ok(Math.max(...ys) - Math.min(...ys) < 2.2, "толщина лопасти: " + (Math.max(...ys) - Math.min(...ys)).toFixed(2));
  }
});

test("PF4: декор и крылья посажены на обшивку, а не парят", () => {
  // все вершины декора должны быть внутри габарита корпуса по Y и |Z|
  const hull = G.json.accessors[G.json.meshes[
    G.json.nodes.find((n) => n.name === "center_hull").mesh].primitives[0].attributes.POSITION];
  const hullW = Math.max(Math.abs(hull.min[2]), Math.abs(hull.max[2]));
  const hullY = [hull.min[1], hull.max[1]];
  for (const name of ["greebles", "decals", "lights", "beacon"]) {
    const acc = G.json.accessors[G.json.meshes[
      G.json.nodes.find((n) => n.name === name).mesh].primitives[0].attributes.POSITION];
    assert.ok(acc.min[1] >= hullY[0] - 0.9 && acc.max[1] <= hullY[1] + 0.6,
      name + " по высоте в обшивке: y " + acc.min[1].toFixed(2) + "…" + acc.max[1].toFixed(2));
    assert.ok(Math.max(Math.abs(acc.min[2]), Math.abs(acc.max[2])) <= hullW + 0.6,
      name + " не вылезает за борт: |z| " + Math.max(Math.abs(acc.min[2]), Math.abs(acc.max[2])).toFixed(2));
  }
  // корень лопасти касается обшивки
  for (const tag of ["r", "l"]) {
    const w = nodePositions(G, "wing_" + tag).filter((p) => Math.abs(p[2]) < 9.0);
    assert.ok(Math.min(...w.map((p) => Math.abs(p[2]))) < 8.3,
      "корень лопасти у борта: |z| " + Math.min(...w.map((p) => Math.abs(p[2]))).toFixed(2));
  }
});
