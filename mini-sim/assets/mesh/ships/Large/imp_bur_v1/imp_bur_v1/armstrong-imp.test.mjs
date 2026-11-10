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

const glb = readFileSync(new URL("armstrong_imp.glb", dir));

test("IMP: 26 узлов, 6 рук, 4 пилона, вращаемый измельчитель", () => {
  const g = glbJson(glb);
  const names = g.nodes.map((n) => n.name);
  for (const need of ["hull_mid", "hull_bow", "hull_rear", "dorsal", "prow_plates",
                      "visor_ring", "crusher", "jaws", "hangar", "gantry", "engines",
                      "thrusters", "greebles", "lights", "fins_l", "fins_r"]) {
    assert.ok(names.includes(need), "node " + need);
  }
  for (const tag of ["r", "l"]) for (let i = 0; i < 3; i++) {
    assert.ok(names.includes("arm_" + i + tag), "arm_" + i + tag);
  }
  for (let i = 0; i < 4; i++) assert.ok(names.includes("pylon_" + i), "pylon_" + i);
  assert.equal(names.length, 26, "26 узлов");

  // узел барабана стоит на оси головы, а его геометрия — вокруг нуля
  const crusher = g.nodes.find((n) => n.name === "crusher");
  assert.ok(Math.abs(crusher.translation[1] - 54) < 0.01, "crusher on its axis: " + crusher.translation);
  const acc = g.accessors[g.meshes[crusher.mesh].primitives[0].attributes.POSITION];
  assert.ok(Math.abs(acc.min[1] + acc.max[1]) < 0.5, "crusher mesh centred on its axis");

  // руки повёрнуты узлами (кватернион), поворот не нулевой
  const arm = g.nodes.find((n) => n.name === "arm_0r");
  assert.ok(arm.rotation && Math.abs(arm.rotation[1]) > 0.05, "arms are rotated by their nodes");

  // вершины с цветом, своих текстур нет
  const prim = g.meshes[0].primitives[0];
  assert.ok(prim.attributes.COLOR_0 != null, "vertex colours");
  assert.ok(g.images == null || g.images.length === 0, "без текстур: цвета в вершинах");
  assert.ok(g.materials.length >= 5, "материалы: сильвер / корпус / тёмный / визор / тяга");
});

test("IMP: габарит 443 × 262 × 121 м и ступни пилонов на Y = 0", () => {
  const g = glbJson(glb);
  const acc = g.accessors;
  // оси-ориентированные узлы (корпус, рёбра): проверяем по их габаритам
  let box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const node of g.nodes) {
    if (node.mesh == null || /^arm_/.test(node.name)) continue;   // руки считаем отдельно
    const a = acc[g.meshes[node.mesh].primitives[0].attributes.POSITION];
    const t = node.translation || [0, 0, 0];
    box = [
      Math.min(box[0], a.min[0] + t[0]), Math.min(box[1], a.min[1] + t[1]),
      Math.min(box[2], a.min[2] + t[2]), Math.max(box[3], a.max[0] + t[0]),
      Math.max(box[4], a.max[1] + t[1]), Math.max(box[5], a.max[2] + t[2])
    ];
  }
  const L = box[3] - box[0], H = box[4] - box[1], W = box[5] - box[2];
  assert.ok(L <= 443 + 0.6 && L > 420, "длина в габарите: " + L.toFixed(1));
  assert.ok(H <= 121 + 0.6 && H > 110, "высота в габарите: " + H.toFixed(1));
  assert.ok(W <= 262 + 0.6 && W > 240, "ширина без рук: " + W.toFixed(1));
  assert.ok(Math.abs(box[1]) < 0.5, "пилоны на Y=0: " + box[1].toFixed(2));

  // точные границы по вершинам с поворотами узлов проверяет create.py (по файлу)
  // и imp_load_check.js (через GLTFLoader r128); здесь — запас по AABB-углам
  const armNode = g.nodes.find((n) => n.name === "arm_0r");
  const aa = acc[g.meshes[armNode.mesh].primitives[0].attributes.POSITION];
  const q = armNode.rotation;
  const ang = 2 * Math.atan2(Math.hypot(q[0], q[1], q[2]), q[3]);
  assert.ok(Math.abs(ang - Math.PI / 18) < 0.02, "руки отведены на 10°: " + (ang * 57.3).toFixed(1));
  assert.ok(armNode.translation[2] + Math.abs(aa.max[2]) <= 133.5,
    "законцовка руки у габарита: " + (armNode.translation[2] + aa.max[2]).toFixed(1));
});

test("IMP: режимы в modes.json", async () => {
  const j = JSON.parse(await readText("modes.json"));
  assert.equal(j.arms, 6);
  assert.equal(j.pylons, 4);
  assert.deepEqual(j.dims, { L: 443, W: 262, H: 121 });
  for (const m of ["docked", "mining", "transit", "warp"]) assert.ok(j.modes[m], "режим " + m);
  assert.equal(j.modes.docked.arms, 0, "в стыковке руки развёрнуты");
  assert.equal(j.modes.transit.arms, 1, "в переходе руки задвинуты");
  assert.ok(j.modes.mining.crusher > 0, "добыча крутит барабан");
  assert.equal(j.modes.warp.crusher, 0, "в варпе барабан стоит");
  assert.ok(j.modes.warp.thrust > j.modes.transit.thrust, "тяга варпа выше переходной");
  assert.ok(j.arm_retract > 0, "есть ход уборки рук");
});

test("IMP: контроллер/панель без внешних зависимостей, демка автономна", async () => {
  const ctrl = await readText("imp_controls.js");
  const panel = await readText("imp_panel.js");
  for (const src of [ctrl, panel]) {
    assert.ok(!/import\s|require\(/.test(src), "без import/require");
    assert.ok(!/https?:\/\//.test(src), "без сетевых ссылок");
  }
  assert.ok(ctrl.includes("MeshBasicMaterial"), "CPU-путь unlit");
  assert.ok(ctrl.includes("MeshPhongMaterial"), "шейдерный путь как опция");
  for (const m of ["docked", "mining", "transit", "warp"]) {
    assert.ok(ctrl.includes(m), "режим " + m);
  }
  assert.ok(panel.includes("createImpPanel"), "панель управления");

  const html = await readText("imp_demo.html");
  assert.ok(html.includes("REVISION"), "three встроен");
  assert.ok(html.includes("class GLTFLoader"), "GLTFLoader встроен");
  assert.ok(html.includes("createImpControls") && html.includes("createImpPanel"), "контроллер и панель");
  assert.ok(html.length > 2_000_000, "GLB вшит в base64: " + html.length);
  assert.ok(!/src="http/.test(html), "никаких внешних скриптов");
});
