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

const glb = readFileSync(new URL("calico_evac.glb", dir));

test("CALEV: 31 узел — 2 крыла, 2 руки, 2 капсулы, 4 дрона, 4 лыжи, лебёдка", () => {
  const g = glbJson(glb);
  const names = g.nodes.map((n) => n.name);
  for (const need of ["hull_mid", "hull_fwd", "hull_rear", "spine", "tail", "engines",
                      "thrusters", "bay", "winch", "greebles", "decals", "lights", "beacon",
                      "wings_r", "wings_l", "arms_r", "arms_l", "pods_r", "pods_l"]) {
    assert.ok(names.includes(need), "узел " + need);
  }
  for (const tag of ["r", "l"]) for (let i = 0; i < 2; i++) {
    assert.ok(names.includes("drone_" + i + tag), "drone_" + i + tag);
  }
  for (let i = 0; i < 4; i++) assert.ok(names.includes("skid_" + i), "skid_" + i);
  assert.equal(names.length, 31, "31 узел");

  // капсулы и дроны — отдельные узлы со своими нулями (их двигает контроллер)
  const pod = g.nodes.find((n) => n.name === "pods_r");
  assert.ok(pod.mesh != null, "капсула — свой меш");
  const winch = g.nodes.find((n) => n.name === "winch");
  assert.ok(winch.mesh != null && winch.translation, "лебёдка на своём узле");

  // крылья и руки повёрнуты узлами (кватернион), поворот не нулевой
  for (const n of ["wings_r", "wings_l", "arms_r", "arms_l"]) {
    const node = g.nodes.find((x) => x.name === n);
    assert.ok(node.rotation && Math.abs(node.rotation[1]) > 0.02, n + " повёрнут узлом");
  }

  // вершины с цветом, своих текстур нет
  const prim = g.meshes[0].primitives[0];
  assert.ok(prim.attributes.COLOR_0 != null, "цвета в вершинах");
  assert.ok(g.images == null || g.images.length === 0, "без текстур: цвета в вершинах");
  assert.ok(g.materials.length >= 5, "материалы: сильвер / красный / тёмный / стекло / свечение");
});

test("CALEV: габарит 53 × 30 × 13 м и лыжи на Y = 0", () => {
  const g = glbJson(glb);
  const acc = g.accessors;
  // узлы без поворотов считаем по AABB с переносом; повёрнутые (крылья/руки) — грубо
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
  assert.ok(L <= 53 + 0.6 && L > 50, "длина в габарите: " + L.toFixed(1));
  assert.ok(H <= 13 + 0.6 && H > 10, "высота в габарите: " + H.toFixed(1));
  assert.ok(W <= 30 + 0.8 && W > 27, "ширина в габарите: " + W.toFixed(1));
  assert.ok(Math.abs(box[1]) < 0.5, "лыжи на Y=0: " + box[1].toFixed(2));

  // точные границы по вершинам с поворотами узлов считают create.py (по файлу)
  // и calico_load_check.js (через настоящий GLTFLoader r128)

  // капсулы стоят внутри шахт, а не торчат по бортам
  const pod = g.nodes.find((n) => n.name === "pods_r");
  const pa = acc[g.meshes[pod.mesh].primitives[0].attributes.POSITION];
  assert.ok(Math.abs(pa.max[2]) < 6.0, "капсула компактна по Z: " + pa.max[2].toFixed(2));
  assert.ok(pa.min[1] + (pod.translation || [0, 0, 0])[1] > 0.5, "капсула не ниже днища");
});

test("CALEV: режимы в modes.json — палуба / вылет / спасение / эвакуация", async () => {
  const j = JSON.parse(await readText("modes.json"));
  assert.equal(j.pods, 2);
  assert.equal(j.drones, 4);
  assert.equal(j.skids, 4);
  assert.deepEqual(j.dims, { L: 53, W: 30, H: 13 });
  assert.ok(j.pod_drop >= 5.0, "ход спуска капсул: " + j.pod_drop);
  assert.ok(j.pod_spread > 1.0, "разведение капсул: " + j.pod_spread);
  assert.ok(j.wing_fold_deg >= 45, "угол складки крыла: " + j.wing_fold_deg);
  assert.ok(j.skid_retract > 0.5, "уборка лыж: " + j.skid_retract);
  assert.ok(j.drone_slots.length === 4, "четыре гнезда дронов");

  for (const m of ["pad", "launch", "rescue", "evac"]) assert.ok(j.modes[m], "режим " + m);
  assert.equal(j.modes.pad.skids, 1, "на палубе лыжи выпущены");
  assert.equal(j.modes.pad.pods, 0, "на палубе капсулы в шахтах");
  assert.equal(j.modes.launch.skids, 0, "в вылете лыжи убраны");
  assert.ok(j.modes.launch.thrust === 1, "в вылете полная тяга");
  assert.equal(j.modes.rescue.arms, 1, "в спасении руки вынесены");
  assert.equal(j.modes.rescue.pods, 1, "в спасении капсулы спущены");
  assert.equal(j.modes.rescue.drones, 1, "в спасении дроны выпущены");
  assert.ok(j.modes.rescue.winch > 0, "в спасении крюк lowered");
  assert.equal(j.modes.evac.pods, 1, "в эвакуации капсулы отделены");
  assert.equal(j.modes.evac.arms, 0, "в эвакуации руки убраны");
  assert.ok(j.modes.rescue.strobe >= j.modes.pad.strobe, "стробоскопы в спасении ярче");
});

test("CALEV: контроллер/панель без внешних зависимостей, демка автономна", async () => {
  const ctrl = await readText("calico_evac_controls.js");
  const panel = await readText("calico_evac_panel.js");
  for (const src of [ctrl, panel]) {
    assert.ok(!/import\s|require\(/.test(src), "без import/require");
    assert.ok(!/https?:\/\//.test(src), "без сетевых ссылок");
  }
  assert.ok(ctrl.includes("MeshBasicMaterial"), "CPU-путь unlit");
  assert.ok(ctrl.includes("MeshPhongMaterial"), "шейдерный путь как опция");
  for (const m of ["pad", "launch", "rescue", "evac"]) {
    assert.ok(ctrl.includes(m), "режим " + m);
  }
  for (const setter of ["setWings", "setArms", "setPods", "setDrones", "setSkids", "setWinch",
                        "setThrust", "setStrobe", "setSpots", "setEngines", "setShaderMode"]) {
    assert.ok(ctrl.includes(setter), "API " + setter);
  }
  assert.ok(panel.includes("createCalicoEvacPanel"), "панель управления");

  const html = await readText("calico_evac_demo.html");
  assert.ok(html.includes("REVISION"), "three встроен");
  assert.ok(html.includes("class GLTFLoader"), "GLTFLoader встроен");
  assert.ok(html.includes("createCalicoEvacControls") && html.includes("createCalicoEvacPanel"),
    "контроллер и панель");
  assert.ok(html.length > 2_000_000, "GLB вшит в base64: " + html.length);
  assert.ok(!/src="http/.test(html), "никаких внешних скриптов");
});
