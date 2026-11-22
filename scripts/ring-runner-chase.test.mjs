// Owner 23.11.2026: "Погоня Гонщика". RING_PIG_BOSS_ARC.md, "Сцена Боец → Jetjet → гонка":
// after the Brawler the Runner is fought as a rear-view chase in Opal Jetjet — lanes,
// height hazards and telegraphed rear attacks to dodge; the boss is armoured most of
// the time and opens after a failed turn (skid) or an overheat. Laser hits in the
// window, boost closes the gap. One WebGL context: a group and a camera in the same scene.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import vm from "node:vm";

const ROOT = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");
const FILE = "mini-sim/assets/js/ring-runner-chase.js";

function api() {
  assert.ok(existsSync(new URL(FILE, ROOT)), "no chase: the Runner is fought like every other form in the 2.5D arena");
  const c = vm.createContext({ Math, Number, Array, Object, JSON, String });
  c.window = c;
  vm.runInContext(read(FILE), c);
  return c.BCMRingRunnerChase;
}

/** Run a chase with a pilot policy (out, t) -> input; returns frames and counted hits. */
function run(policy, seconds = 40, seed = 11) {
  const chase = api().create({ seed });
  const frames = [];
  let out = chase.step(0, {});
  let hits = 0;
  for (let i = 0; i < seconds * 60; i += 1) {
    out = chase.step(1 / 60, policy(out, i / 60) || {});
    hits += out.hits.length;
    frames.push(JSON.parse(JSON.stringify(out)));
  }
  return { chase, frames, hits };
}

/** A pilot that reads the road: leaves a lane with a gate or a marked mine, hops low walls. */
function dodger(out) {
  const p = out.player;
  const danger = (lane) => out.obstacles.some((o) => o.lane === lane && o.z > 0 && o.z < 16 && o.kind !== "low") ||
    (out.boss.tell && out.boss.tell.lane === lane);
  let steer = 0;
  if (danger(p.lane)) {
    const free = [0, 1, 2].filter((l) => !danger(l)).sort((a, b) => Math.abs(a - p.lane) - Math.abs(b - p.lane));
    if (free.length && free[0] !== p.lane) steer = Math.sign(free[0] - p.lane);
  }
  const low = out.obstacles.some((o) => o.lane === p.lane && o.kind === "low" && o.z > 0.5 && o.z < 4.5);
  return { steer, jumpEdge: low && p.y <= 0.01 };
}

test("the chase boards Opal Jetjet first, then runs on three lanes", () => {
  const { frames } = run(() => ({}), 6);
  assert.equal(frames[0].phase, "board", "no boarding beat before the chase");
  const boarding = frames.filter((f) => f.phase === "board").length / 60;
  assert.ok(boarding >= 0.8 && boarding <= 2, `boarding lasts ${boarding.toFixed(2)} s`);
  assert.ok(frames.some((f) => f.phase === "chase"));
  assert.deepEqual([...new Set(frames.flatMap((f) => f.obstacles.map((o) => o.lane)))].sort(), [0, 1, 2]);
  assert.ok(frames.at(-1).speed > 10, "no speed: the road does not move");
});

test("every obstacle and mine is seen in time: 1.5 s on the road, mines after a lane tell", () => {
  const { frames } = run(() => ({}), 40);
  const firstSeen = new Map();
  frames.forEach((f, i) => f.obstacles.forEach((o) => { if (!firstSeen.has(o.id)) firstSeen.set(o.id, { i, o }); }));
  for (const [id, { i, o }] of firstSeen) {
    const reach = frames.findIndex((f, k) => k > i && f.obstacles.some((x) => x.id === id && x.z <= 0));
    if (reach < 0) continue;
    const warned = (reach - i) / 60;
    if (o.kind === "mine") {
      let told = 0;
      for (let k = i - 1; k >= 0 && frames[k].boss.tell && frames[k].boss.tell.lane === o.lane; k -= 1) told += 1;
      assert.ok(told / 60 + warned >= 1.2, `mine ${id}: ${(told / 60).toFixed(2)} s tell + ${warned.toFixed(2)} s on the road`);
    } else {
      assert.ok(warned >= 1.5, `${o.kind} ${id} seen only ${warned.toFixed(2)} s before it reaches the pilot`);
    }
  }
  const kinds = new Set(frames.flatMap((f) => f.obstacles.map((o) => o.kind)));
  for (const k of ["low", "gate", "mine"]) assert.ok(kinds.has(k), `no ${k} in the chase`);
});

test("the chase can be driven clean, and standing still gets hit", () => {
  const clean = run(dodger, 40);
  const idle = run(() => ({}), 40);
  assert.ok(idle.hits >= 3, `a pilot who never steers is hit only ${idle.hits} times`);
  assert.ok(clean.hits <= 1, `a pilot who reads the road is still hit ${clean.hits} times`);
});

test("the Runner is armoured most of the time and opens after a skid or an overheat", () => {
  const { frames } = run(dodger, 60);
  const chase = frames.filter((f) => f.phase === "chase");
  const open = chase.filter((f) => f.boss.vulnerable);
  const share = open.length / chase.length;
  assert.ok(share > 0.1 && share < 0.4, `open ${(share * 100).toFixed(0)} % of the chase`);
  assert.deepEqual([...new Set(open.map((f) => f.boss.state))].sort(), ["overheat", "skid"]);
  const states = new Set(chase.map((f) => f.boss.state));
  for (const s of ["run", "rev", "drop", "turn"]) assert.ok(states.has(s), `the Runner never plays ${s}`);
});

test("laser lands only in the window and within range; boost closes the gap", () => {
  const moves = api();
  const chase = moves.create({ seed: 4 });
  let out = chase.step(0, {});
  let closed = false, armoured = false, farMiss = false;
  for (let i = 0; i < 60 * 60; i += 1) {
    const before = out.gap;
    out = chase.step(1 / 60, { boost: i % 120 === 0 });
    if (i % 120 === 0 && out.phase === "chase" && out.gap < before - 0.05) closed = true;
    if (!out.boss.vulnerable) { assert.equal(chase.canBeHit(), false, "the Runner takes a shot in its armour"); armoured = true; }
    if (out.boss.vulnerable && out.gap > out.range) { assert.equal(chase.canBeHit(), false); farMiss = true; }
    if (out.boss.vulnerable && out.gap <= out.range) assert.equal(chase.canBeHit(), true, "a shot in the window misses");
  }
  assert.ok(closed, "boost never closes the gap");
  assert.ok(armoured);
  assert.ok(out.range > 6 && out.range < out.maxGap, "laser range outside the chase gap");
  void farMiss;
});

test("the Ring runs the Runner as a rear-view chase in the same WebGL context", () => {
  const ring = read("mini-sim/assets/js/ring-platformer.js");
  assert.match(ring, /BCMRingRunnerChase\.create\(/, "the Runner phase never starts the chase");
  assert.match(ring, /new THREE\.PerspectiveCamera\(/, "no rear-view camera for the chase");
  assert.doesNotMatch(ring, /new THREE\.WebGLRenderer/, "a second WebGL context for the chase");
  assert.match(ring, /jetjet_[a-z]+_flight\.glb/, "Opal Jetjet is not loaded for the chase");
  assert.match(ring, /jetjet_[a-z]+_parked\.glb/, "no parked Jetjet for boarding");
  assert.match(ring, /phase-5-runner-rear\.glb/, "the Runner is not shown from behind");
  assert.match(ring, /ПОЛОСА[\s\S]{0,80}ПРЫЖОК[\s\S]{0,80}ЛАЗЕР[\s\S]{0,80}РЫВОК/, "the HUD does not show what the buttons do in the chase");
  assert.match(read("mini-sim/bcm-mini-sim.php"), /'bcm-ring-runner-chase'[\s\S]{0,140}ring-runner-chase\.js/);
  assert.match(read("tools/minisim-qa/standalone-shell.html"), /ring-runner-chase\.js/);
});
