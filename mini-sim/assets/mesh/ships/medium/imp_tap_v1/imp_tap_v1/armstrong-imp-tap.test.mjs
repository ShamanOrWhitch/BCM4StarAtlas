import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";

const dir = new URL("./", import.meta.url);
const readText = (p) => readFile(new URL(p, dir), "utf8");

function glbJson(buf) {
  assert.equal(buf.readUInt32LE(0), 0x46546c67, "GLB magic 'glTF'");
  assert.equal(buf.readUInt32LE(4), 2, "GLB version 2");
  const jsonLen = buf.readUInt32LE(12);
  return JSON.parse(buf.slice(20, 20 + jsonLen).toString("utf8"));
}

const glb = readFileSync(new URL("imp_tap.glb", dir));

test("IMP Tap: 15 узлов, 6 лап, вращаемые барабаны, габарит 47.8 × 48.5 × 19", () => {
  const g = glbJson(glb);
  const names = g.nodes.map((n) => n.name);
  for (const need of ["hull", "shell", "armor", "machinery", "drill_mount", "drills",
                      "engines", "thrusters", "lights"]) {
    assert.ok(names.includes(need), "node " + need);
  }
  for (let i = 0; i < 6; i++) assert.ok(names.includes("leg_" + i), "leg_" + i);

  // габарит по всем мешам с учётом трансформаций узлов (лапы в шарнирах)
  const acc = g.accessors;
  let box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const node of g.nodes) {
    if (node.mesh == null) continue;
    const a = acc[g.meshes[node.mesh].primitives[0].attributes.POSITION];
    const t = node.translation || [0, 0, 0];
    box = [
      Math.min(box[0], a.min[0] + t[0]), Math.min(box[1], a.min[1] + t[1]),
      Math.min(box[2], a.min[2] + t[2]), Math.max(box[3], a.max[0] + t[0]),
      Math.max(box[4], a.max[1] + t[1]), Math.max(box[5], a.max[2] + t[2])
    ];
  }
  const L = box[3] - box[0], H = box[4] - box[1], W = box[5] - box[2];
  assert.ok(L <= 47.8 + 0.1 && L > 45, "длина в габарите: " + L.toFixed(2));
  assert.ok(W <= 48.5 + 0.1 && W > 46, "ширина в габарите: " + W.toFixed(2));
  assert.ok(H <= 19.0 + 0.1 && H > 18, "высота в габарите: " + H.toFixed(2));
  assert.ok(Math.abs(box[1]) < 0.05, "ступни лап на Y=0: " + box[1].toFixed(3));

  // вершины с цветом: материал unlit-пути, без текстур
  const prim = g.meshes[0].primitives[0];
  assert.ok(prim.attributes.COLOR_0 != null, "vertex colours");
  assert.ok(g.images == null || g.images.length === 0, "свои цвета в вершинах, без текстур");
  assert.ok(g.materials.length >= 3, "материалы: корпус / броня / сталь / свечение");
});

test("IMP Tap: режимы и поза лап в modes.json", async () => {
  const j = JSON.parse(await readText("modes.json"));
  assert.equal(j.legs, 6);
  assert.equal(j.hip_fold_deg, 96);
  for (const m of ["landed", "mining", "flight", "transit"]) {
    assert.ok(j.modes[m], "режим " + m);
    assert.ok(j.modes[m].legs === 0 || j.modes[m].legs === 1, "legs 0..1 в " + m);
  }
  assert.equal(j.modes.landed.legs, 0, "посадка — лапы выпущены");
  assert.equal(j.modes.flight.legs, 1, "полёт — лапы убраны");
  assert.ok(j.modes.mining.drills > 0, "добыча крутит барабаны");
  assert.equal(j.modes.landed.drills, 0, "на посадке барабаны стоят");
  assert.ok(j.modes.flight.thrust > j.modes.transit.thrust, "тяга полёта выше переходной");
  assert.equal(j.hip_z.length, 6, "шесть шарниров");
  assert.deepEqual(j.dims, { L: 47.8, W: 48.5, H: 19 });
});

test("IMP Tap: контроллер и панель не тянут внешних зависимостей", async () => {
  const ctrl = await readText("imp_controls.js");
  const panel = await readText("imp_panel.js");
  for (const src of [ctrl, panel]) {
    assert.ok(!/import\s|require\(/.test(src), "без import/require");
    assert.ok(!/https?:\/\//.test(src), "без сетевых ссылок");
  }
  assert.ok(ctrl.includes("MeshBasicMaterial"), "CPU-путь unlit");
  assert.ok(ctrl.includes("MeshPhongMaterial"), "шейдерный путь как опция");
  assert.ok(ctrl.includes("FOLD_DEG = 96.0"), "складка лап 96°");
  assert.ok(panel.includes("createImpTapPanel"), "панель управления");
  for (const m of ["landed", "mining", "flight", "transit"]) {
    assert.ok(ctrl.includes(m), "режим " + m + " в контроллере");
  }
});

test("IMP Tap: демка автономна (three r128 + GLB внутри одного файла)", async () => {
  const html = await readText("imp_demo.html");
  assert.ok(html.includes("REVISION"), "three встроен");
  assert.ok(html.includes("class GLTFLoader"), "GLTFLoader встроен");
  assert.ok(html.includes("createImpTapControls"), "контроллер встроен");
  assert.ok(html.includes("createImpTapPanel"), "панель встроена");
  assert.ok(html.length > 2_000_000, "GLB вшит в base64: " + html.length);
  assert.ok(!/src="http/.test(html), "никаких внешних скриптов");
});
