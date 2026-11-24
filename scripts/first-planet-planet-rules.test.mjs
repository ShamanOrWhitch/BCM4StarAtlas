// Owner 24.11.2026: "прорабатывай разные механики на планетах". Each planet plays differently on foot:
// Twinsun — heat under two suns (shade and the oasis cool you, overheating slows you down);
// Ioki — low gravity (high jumps, slow fall); Pearce — you can swim the lakes and to the islets, on a
// breath meter. Fable and the shared desert keep the old rules; Opus keeps its carpet flight.
import { test } from "node:test";
import assert from "node:assert/strict";
import "./lib/first-planet-sim.mjs";

const terrain = await import("../mini-sim/first-planet/src/game/island/terrain.ts");
const planets = await import("../mini-sim/first-planet/src/game/island/planet.ts");
const input = await import("../mini-sim/first-planet/src/game/input.ts");
const { createSim } = await import("../mini-sim/first-planet/src/game/island/sim.ts");
const DT = 1 / 60;

function sim(id) {
  terrain.setRelief(planets.planetLook(id).relief ?? "desert");
  return createSim(0, id);
}
function run(s, keys, seconds, each) {
  input.setForced(keys);
  for (let t = 0; t < seconds; t += DT) { s.step(DT); if (each) each(s); }
  input.setForced(null);
}

test("Twinsun: heat builds in the open sun, the oasis cools it, overheating slows the walk", () => {
  const s = sim("first");
  assert.ok(s.rules && s.rules.heat, "Twinsun has no heat");
  s.x = 30; s.z = 4; s.y = terrain.footY(30, 4, 0);
  run(s, [], 30);
  assert.ok(s.body.heat >= 99, `heat in the open sun after 30 s: ${s.body.heat.toFixed(0)}`);
  assert.equal(s.body.overheated, true);
  s.yaw = 0;
  let hot = 0;
  run(s, ["KeyW"], 1.5, (x) => { hot = Math.max(hot, Math.abs(x.speed)); });
  assert.ok(hot < 4, `an overheated pilot walks slowly: ${hot.toFixed(1)} m/s`);
  s.x = 2.4; s.z = -14; s.y = terrain.footY(2.4, -14, 0); s.vx = 0; s.vz = 0;
  run(s, [], 8);
  assert.ok(s.body.heat < 40, `the oasis cools: ${s.body.heat.toFixed(0)}`);
  assert.equal(s.body.overheated, false);
  assert.ok(s.hud().rules && s.hud().rules.heat !== undefined, "no heat on the HUD");
});

test("Ioki: low gravity — a jump goes far higher and lasts longer than on the desert", () => {
  const apex = (id) => {
    const s = sim(id);
    s.x = terrain.SPAWN.x; s.z = terrain.SPAWN.z; s.y = terrain.footY(s.x, s.z, 0);
    const base = s.y;
    let top = base, air = 0;
    run(s, ["Space"], DT * 2);
    run(s, [], 4, (x) => { top = Math.max(top, x.y); if (x.y > base + 0.05) air += DT; });
    return { h: top - base, air };
  };
  const desert = apex("fable");
  const ioki = apex("ioki");
  assert.ok(ioki.h > desert.h * 1.8, `Ioki jump ${ioki.h.toFixed(2)} m vs ${desert.h.toFixed(2)} m`);
  assert.ok(ioki.air > desert.air * 1.8, `Ioki air time ${ioki.air.toFixed(2)} s vs ${desert.air.toFixed(2)} s`);
});

test("Pearce: the lake is not a wall — the pilot swims on a breath meter and is washed ashore when it runs out", () => {
  const s = sim("pearce");
  assert.ok(s.rules && s.rules.swim, "Pearce has no swimming");
  const lake = terrain.PEARCE_LAKES[0];
  s.x = lake.x + lake.rx + 6; s.z = lake.z; s.y = terrain.footY(s.x, s.z, 0);
  s.yaw = Math.PI / 2; // facing -x, into the lake
  let swam = false;
  run(s, ["KeyW"], 6, (x) => { if (x.body.swimming) swam = true; });
  assert.ok(swam, "the pilot never entered the water");
  assert.ok(s.x < lake.x + lake.rx, `the pilot is in the lake: x ${s.x.toFixed(1)}`);
  assert.ok(s.body.breath < 100, "swimming does not cost breath");
  run(s, [], 20);
  assert.equal(s.body.swimming, false, "out of breath the pilot stays in the water");
  assert.ok(terrain.footY(s.x, s.z, 0) > -0.45, "washed ashore onto dry land");
});

test("planets without these rules keep the old walk: the sea is still a wall on Fable", () => {
  const s = sim("fable");
  assert.ok(!s.rules.swim && !s.rules.heat && s.rules.gravity === 1);
  s.x = 0; s.z = 60; s.y = terrain.footY(0, 60, 0); s.yaw = Math.PI; // facing +z, toward the sea
  let swam = false;
  run(s, ["KeyW"], 8, (x) => { if (x.body.swimming) swam = true; });
  assert.equal(swam, false, "the pilot swims on Fable");
  assert.equal(s.body.breath, 100, "breath is spent on Fable");
  assert.equal(s.body.heat, 0, "heat builds on Fable");
});
