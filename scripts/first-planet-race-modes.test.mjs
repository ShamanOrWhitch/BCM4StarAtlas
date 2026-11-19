// Owner 19.11.2026: "Виды гонок на планетах" — "разные игры вместо гонок, нужно
// вводить другие модификации по гонкам". Each First Planet planet gets its own
// form of the Shoal Race, on the real createRace:
//   Twinsun  — three laps with items and drift (the race as it was);
//   Fable    — a slalom through gates of light, a missed gate costs seconds;
//   Opus     — a narrow mountain road, after each lap the last car is out.
// And levels: a win on a planet opens the next level (faster rivals, tighter gates).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import "./lib/first-planet-sim.mjs"; // "@/..." imports, extensionless imports, localStorage

const ROOT = new URL("../", import.meta.url);
const SRC = new URL("mini-sim/first-planet/src/", ROOT).href;
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");
const sim = await import(SRC + "game/sim.ts");
const track = await import(SRC + "game/track.ts");
const modesFile = new URL("mini-sim/first-planet/src/game/race-modes.ts", ROOT);
const modes = existsSync(modesFile) ? await import(modesFile.href) : null;

const IDLE = { throttle: 0, brake: 0, steer: 0, drift: false, use: false };

/** Drive the player along the road; aim(race) gives the lateral line to hold. */
function pilot(race, aim) {
  const car = race.cars[0];
  const ahead = track.sampleAt(race.track, car.s + 14);
  const lat = aim ? aim(race, car) : 0;
  const want = Math.atan2(-(ahead.x + ahead.nx * lat - car.x), -(ahead.z + ahead.nz * lat - car.z));
  let err = want - car.yaw;
  while (err > Math.PI) err -= Math.PI * 2;
  while (err < -Math.PI) err += Math.PI * 2;
  return { throttle: car.speed < 27 ? 1 : 0.2, brake: 0, steer: Math.max(-1, Math.min(1, err / 0.5)), drift: false, use: false };
}

function run(race, seconds, drive) {
  for (let i = 0; i < seconds * 60; i += 1) {
    race.step(1 / 60, drive ? drive(race) : IDLE, true);
    if (race.cars[0].finished) break;
  }
}

const nextGateLat = (race, car) => {
  const gates = race.gates || [];
  let best = null;
  for (const g of gates) {
    const d = track.forwardDelta(car.s, g.s, race.track.length);
    if (d > -2 && d < 40 && (!best || d < best.d)) best = { d, lat: g.lat };
  }
  return best ? best.lat : 0;
};

test("every planet has its own form of the race", () => {
  assert.ok(modes, "no race modes: every planet runs the same three-lap Shoal Race");
  const first = modes.raceModeFor("first");
  const fable = modes.raceModeFor("fable");
  const opus = modes.raceModeFor("opus");
  assert.equal(first.kind, "laps");
  assert.equal(fable.kind, "slalom");
  assert.equal(opus.kind, "elimination");
  assert.equal(modes.raceModeFor(undefined).kind, "laps", "Galia without a planet keeps the old race");
  assert.equal(new Set([first.title, fable.title, opus.title]).size, 3);

  const twinsun = sim.createRace(7, "first");
  assert.equal(twinsun.laps, 3);
  assert.equal(twinsun.boxes.length, 6, "Twinsun keeps its item boxes");
  assert.equal((twinsun.gates || []).length, 0);
});

test("Fable: a slalom through gates, a missed gate costs seconds", () => {
  globalThis.localStorage.clear();
  const straight = sim.createRace(7, "fable");
  assert.ok(straight.gates && straight.gates.length >= 8, `Fable has ${(straight.gates || []).length} slalom gates`);
  assert.equal(straight.boxes.length, 0, "the slalom is clean driving, no item boxes");
  assert.ok(straight.gates.some((g) => Math.abs(g.lat) > g.half), "every gate sits on the centre line: nothing to steer for");
  run(straight, 200, (race) => pilot(race, null));
  const you = straight.cars[0];
  assert.ok(you.finished, "the player never finishes the slalom");
  assert.ok(you.missed > 0 && you.penalty > 0, `holding the centre missed ${you.missed} gates, penalty ${you.penalty}`);
  assert.ok(you.finishTime > straight.time - 0.1 + you.penalty - 0.2, "the penalty is not in the result");
  assert.equal(straight.hud().mode, "slalom");

  globalThis.localStorage.clear();
  const neat = sim.createRace(7, "fable");
  run(neat, 200, (race) => pilot(race, nextGateLat));
  assert.ok(neat.cars[0].missed < you.missed, `steering for the gates missed ${neat.cars[0].missed}, the centre line ${you.missed}`);
});

test("Opus: a narrow mountain road, the last car is out after each lap", () => {
  globalThis.localStorage.clear();
  const race = sim.createRace(7, "opus");
  assert.ok(race.track.halfWidth < sim.createRace(7, "first").track.halfWidth, "the Opus road is as wide as the Twinsun coast");
  run(race, 120, null); // the player stands still and ends up last
  const out = race.cars.filter((c) => c.out);
  assert.ok(out.length >= 1, "nobody is ever eliminated");
  assert.ok(race.cars[0].out && race.cars[0].finished, "the standing player is never eliminated");
  const hud = race.hud();
  assert.equal(hud.mode, "elimination");
  assert.ok(hud.out, "the HUD does not say the player is out");
  assert.equal(hud.place, race.cars.length, "the first one out is last");
});

test("levels: a win opens the next level, rivals get faster and gates tighter", () => {
  globalThis.localStorage.clear();
  assert.equal(modes.loadRaceLevel("fable"), 1);
  assert.equal(modes.recordRaceWin("fable"), 2);
  assert.equal(modes.loadRaceLevel("fable"), 2);
  assert.equal(modes.loadRaceLevel("opus"), 1, "levels are per planet");
  modes.recordRaceWin("fable");
  modes.recordRaceWin("fable");
  assert.equal(modes.loadRaceLevel("fable"), 3, "three levels");

  const one = sim.createRace(7, "fable", 1);
  const three = sim.createRace(7, "fable", 3);
  assert.equal(one.level, 1);
  assert.equal(three.level, 3);
  assert.ok(three.gates[0].half < one.gates[0].half, "gates are as wide on level 3");
  run(one, 20, null);
  run(three, 20, null);
  const at = (r, c) => c.lapsDone * r.track.length + (c.gate === 1 && c.s > r.track.length / 2 ? c.s - r.track.length : c.s);
  const lead = (r) => r.cars.slice(1).reduce((sum, c) => sum + at(r, c), 0) / (r.cars.length - 1);
  assert.ok(lead(three) > lead(one) + 15, `level 3 rivals are not faster on average (${lead(three).toFixed(0)} vs ${lead(one).toFixed(0)})`);
  assert.equal(three.hud().level, 3);
});

test("the planet reaches the race: embed -> ShoalRace -> createRace, gates on screen", () => {
  const embed = read("mini-sim/first-planet/src/first-planet-embed.tsx");
  assert.match(embed, /<ShoalRace[^\n]*planet=\{/, "the embed does not tell the race which planet it is on");
  const race = read("mini-sim/first-planet/src/components/shoal-race.tsx");
  assert.match(race, /createRace\(raceSeed, planet/);
  assert.match(race, /recordRaceWin\(/, "a win never opens the next level");
  assert.match(read("mini-sim/first-planet/src/game/world.ts"), /race\.gates/, "the slalom gates are never drawn");
});
