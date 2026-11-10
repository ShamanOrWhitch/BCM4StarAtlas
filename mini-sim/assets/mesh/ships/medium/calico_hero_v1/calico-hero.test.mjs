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

const glb = readFileSync(new URL("calico_hero.glb", dir));

test("CALCH: 28 узлов — турель, 2 плоскости, 2 VTOL-пилона, 2 отсека, трап, 4 стойки", () => {
  const g = glbJson(glb);
  const names = g.nodes.map((n) => n.name);
  for (const need of ["hull_fwd", "hull_mid", "hull_rear", "canopy", "bay_wells",
                      "engines", "thrusters", "cms", "greebles", "decals", "lights",
                      "beacon", "turret", "turret_guns", "ramp", "drone_port",
                      "fins_r", "fins_l", "winglets_r", "winglets_l", "vtol_r", "vtol_l",
                      "mbay_r", "mbay_l"]) {
    assert.ok(names.includes(need), "узел " + need);
  }
  for (let i = 0; i < 4; i++) assert.ok(names.includes("leg_" + i), "стойка leg_" + i);
  assert.equal(names.length, 28, "28 узлов");

  // турель и её стволы — разные узлы: кольцо вращается, стволы качаются
  const turret = g.nodes.find((n) => n.name === "turret");
  const guns = g.nodes.find((n) => n.name === "turret_guns");
  assert.ok(turret.mesh != null && turret.translation, "турель на своём узле");
  assert.ok(guns.mesh != null && guns.translation[1] > turret.translation[1], "стволы выше кольца");

  // трап висит на шарнире у днища, а не на уровне палубы: иначе при повороте
  // вокруг X он уходил вбок, в сопла (это и был дефект из демки)
  const ramp = g.nodes.find((n) => n.name === "ramp");
  assert.ok(ramp.translation[1] < 4.0, "шарнир трапа у днища: " + ramp.translation[1]);
  assert.ok(ramp.translation[0] > 19.0, "шарнир трапа у кормового среза");

  // плоскости и пилоны — повёрнутые узлы
  for (const n of ["fins_r", "fins_l", "winglets_r", "winglets_l"]) {
    const node = g.nodes.find((x) => x.name === n);
    assert.ok(node.translation && Math.abs(node.translation[2]) > 3.0, n + " стоит на борту");
  }

  // вершины с цветом, своих текстур нет
  const prim = g.meshes[0].primitives[0];
  assert.ok(prim.attributes.COLOR_0 != null, "цвета в вершинах");
  assert.ok(g.images == null || g.images.length === 0, "без текстур: цвета в вершинах");
  assert.ok(g.materials.length >= 5, "материалы: серебро / тёмный / винный / стекло / свечение");
});

test("CALCH: габарит 46.6 × 30.1 × 11.5 м и стойки на Y = 0", () => {
  const g = glbJson(glb);
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
  assert.ok(L <= 46.6 + 0.6 && L > 43, "длина в габарите: " + L.toFixed(1));
  assert.ok(H <= 11.5 + 0.6 && H > 9, "высота в габарите: " + H.toFixed(1));
  assert.ok(W <= 30.1 + 0.8 && W > 27, "ширина в габарите: " + W.toFixed(1));
  assert.ok(Math.abs(box[1]) < 0.5, "стойки на Y=0: " + box[1].toFixed(2));

  // точные границы по вершинам с поворотами узлов считают create.py (по файлу)
  // и calico_hero_load_check.js (через настоящий GLTFLoader r128)

  // остекление сидит на обшивке: его основание не выше палубы, а свод выше неё
  const canopy = g.nodes.find((n) => n.name === "canopy");
  const ca = acc[g.meshes[canopy.mesh].primitives[0].attributes.POSITION];
  const hullMid2 = g.nodes.find((n) => n.name === "hull_mid");
  const hm = acc[g.meshes[hullMid2.mesh].primitives[0].attributes.POSITION];
  assert.ok(ca.min[1] <= hm.max[1] + 0.25,
    "стекло не висит над палубой: низ " + ca.min[1].toFixed(2) + " vs палуба " + hm.max[1].toFixed(2));
  assert.ok(ca.max[1] >= hm.max[1] + 0.10, "купол поднимается над палубой");

  // боковые пилоны держат полную ширину — корпус сам по себе заметно уже
  const hullMid = g.nodes.find((n) => n.name === "hull_mid");
  const ha = acc[g.meshes[hullMid.mesh].primitives[0].attributes.POSITION];
  assert.ok(ha.max[2] < 7.0, "корпус уже пилонов: " + ha.max[2].toFixed(1));
  const wing = g.nodes.find((n) => n.name === "winglets_r");
  const wa = acc[g.meshes[wing.mesh].primitives[0].attributes.POSITION];
  assert.ok(wing.translation[2] + wa.max[2] <= 15.1, "законцовка пилона у габарита");
});

test("CALCH: режимы modes.json — палуба / полёт / бой / погрузка", async () => {
  const j = JSON.parse(await readText("modes.json"));
  assert.equal(j.fins, 2);
  assert.equal(j.winglets, 2);
  assert.equal(j.legs, 4);
  assert.equal(j.vtol, 3);
  assert.deepEqual(j.dims, { L: 46.6, W: 30.1, H: 11.5 });
  assert.ok(j.fin_sweep_deg > 40, "отклонение плоскостей: " + j.fin_sweep_deg);
  assert.ok(j.leg_retract > 1.0, "уборка стоек: " + j.leg_retract);
  assert.ok(j.ramp_open_deg >= 65, "опускание трапа: " + j.ramp_open_deg);
  assert.ok(j.ramp_hinge[1] < 4.0, "шарнир трапа у днища: " + j.ramp_hinge[1]);
  assert.ok(j.mbay_open_deg > 40, "раскрытие отсеков: " + j.mbay_open_deg);
  assert.ok(j.dport_slide > 1.0, "ход люка дрона: " + j.dport_slide);
  assert.ok(j.turret_yaw_deg > 60, "разворот турели: " + j.turret_yaw_deg);
  assert.ok(j.gun_pitch_deg > 10, "подъём стволов: " + j.gun_pitch_deg);

  for (const m of ["pad", "flight", "combat", "cargo"]) assert.ok(j.modes[m], "режим " + m);
  assert.equal(j.modes.pad.legs, 1, "на палубе стойки выпущены");
  assert.equal(j.modes.pad.fins, 0, "на палубе плоскости вертикально (A)");
  assert.equal(j.modes.flight.legs, 0, "в полёте стойки убраны");
  assert.equal(j.modes.flight.fins, 1, "в полёте плоскости отклонены (B)");
  assert.ok(j.modes.flight.thrust > 0.4, "в полёте есть тяга");
  assert.equal(j.modes.combat.mbay, 1, "в бою отсеки открыты");
  assert.equal(j.modes.combat.turret, 1, "в бою турель развёрнута");
  assert.equal(j.modes.combat.guns, 1, "в бою стволы подняты");
  assert.equal(j.modes.combat.cms, 1, "в бою контрмеры наготове");
  assert.equal(j.modes.cargo.ramp, 1, "в погрузке трап опущен");
  assert.equal(j.modes.cargo.dport, 1, "в погрузке люк дрона открыт");
  assert.ok(j.modes.cargo.vtol > 0.5, "в погрузке VTOL поддув");
  assert.ok(j.modes.combat.strobe >= j.modes.pad.strobe, "стробы в бою ярче");
});

test("CALCH: контроллер/панель без внешних зависимостей, демка автономна", async () => {
  const ctrl = await readText("calico_hero_controls.js");
  const panel = await readText("calico_hero_panel.js");
  for (const src of [ctrl, panel]) {
    assert.ok(!/import\s|require\(/.test(src), "без import/require");
    assert.ok(!/https?:\/\//.test(src), "без сетевых ссылок");
  }
  assert.ok(ctrl.includes("MeshBasicMaterial"), "CPU-путь unlit");
  assert.ok(ctrl.includes("MeshPhongMaterial"), "шейдерный путь как опция");
  for (const m of ["pad", "flight", "combat", "cargo"]) {
    assert.ok(ctrl.includes(m), "режим " + m);
  }
  for (const setter of ["setLegs", "setFins", "setRamp", "setMbays", "setDronePort",
                        "setVtol", "setTurret", "setGuns", "setCms", "setThrust",
                        "setStrobe", "setSpots", "setEngines", "setShaderMode"]) {
    assert.ok(ctrl.includes(setter), "API " + setter);
  }
  assert.ok(panel.includes("createCalicoHeroPanel"), "панель управления");

  const html = await readText("calico_hero_demo.html");
  assert.ok(html.includes("REVISION"), "three встроен");
  assert.ok(html.includes("class GLTFLoader"), "GLTFLoader встроен");
  assert.ok(html.includes("createCalicoHeroControls") && html.includes("createCalicoHeroPanel"),
    "контроллер и панель");
  assert.ok(html.length > 1_500_000, "GLB вшит в base64: " + html.length);
  assert.ok(!/src="http/.test(html), "никаких внешних скриптов");
});
