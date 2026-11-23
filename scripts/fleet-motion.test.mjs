// Owner 23.11.2026: "в космосе у некоторых кораблей должна быть жизнь, ну кто-то прилетает,
// кто-то улетает". WORK LOCK #144 plan: a small local fleet-motion module with a seed and a
// fixed step; bounded volume, speed/acceleration limits, no teleports, spacing between ships,
// keep clear of the player. fleet-motion.js: ships arrive from far, hold at a berth by the
// station, then depart and leave; the cycle repeats. Local simulation only (no SAGE).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import vm from "node:vm";

const ROOT = new URL("../", import.meta.url);
const FILE = "mini-sim/assets/js/fleet-motion.js";

function api() {
  assert.ok(existsSync(new URL(FILE, ROOT)), "no fleet-motion.js: every ship in space stands still");
  const c = vm.createContext({ Math, Number, Array, Object, JSON, String });
  c.window = c;
  vm.runInContext(readFileSync(new URL(FILE, ROOT), "utf8"), c);
  return c.BCMFleetMotion;
}

const OPTS = { seed: 11, count: 4, spawnRadius: 170, maxSpeed: 22 };

function run(fleet, seconds, dt, avoid) {
  const frames = [];
  for (let t = 0; t < seconds; t += dt) frames.push(JSON.parse(JSON.stringify(fleet.step(dt, avoid ? { avoid } : {}))));
  return frames;
}

test("ships arrive, hold at a berth and depart; the cycle repeats", () => {
  const frames = run(api().create(OPTS), 120, 1 / 30);
  for (let i = 0; i < OPTS.count; i += 1) {
    const order = frames.map((f) => f[i].state).filter((s, k, a) => s !== a[k - 1]).join(",");
    assert.match(order, /arrive,hold,depart/, `ship ${i} never arrives, holds and departs: ${order}`);
  }
  const visible = frames.map((f) => f.filter((s) => s.visible).length);
  assert.ok(Math.max(...visible) >= 2, "never more than one ship in sight");
  const holding = frames.map((f) => f.filter((s) => s.state === "hold").length);
  assert.ok(Math.max(...holding) >= 1, "no ship ever waits at the station");
});

test("same seed, same traffic; the result does not depend on the frame rate", () => {
  const a = run(api().create(OPTS), 20, 1 / 60);
  const b = run(api().create(OPTS), 20, 1 / 60);
  assert.deepEqual(a.at(-1), b.at(-1), "the same seed gave different traffic");
  const fast = run(api().create(OPTS), 20, 1 / 120).at(-1);
  const slow = run(api().create(OPTS), 20, 1 / 20).at(-1);
  fast.forEach((s, i) => {
    assert.ok(Math.hypot(s.x - slow[i].x, s.y - slow[i].y, s.z - slow[i].z) < 0.5, `ship ${i} drifts with the frame rate`);
  });
});

test("ships stay in the volume, never jump, keep apart and keep clear of the player", () => {
  const avoid = { x: 0, y: 0, z: 30, r: 14 };
  const frames = run(api().create(OPTS), 120, 1 / 30, avoid);
  const step = OPTS.maxSpeed / 30 + 1e-6;
  for (let k = 1; k < frames.length; k += 1) {
    frames[k].forEach((s, i) => {
      const p = frames[k - 1][i];
      assert.ok(Math.hypot(s.x, s.y, s.z) <= OPTS.spawnRadius + 6, `ship ${i} left the volume`);
      if (s.visible && p.visible) {
        assert.ok(Math.hypot(s.x - p.x, s.y - p.y, s.z - p.z) <= step * 1.01, `ship ${i} jumped`);
        assert.ok(Math.hypot(s.x - avoid.x, s.y - avoid.y, s.z - avoid.z) >= avoid.r - 1, `ship ${i} flew into the player`);
      }
      // Heading follows the motion (no snaps): yaw changes at most ~3 rad/s.
      if (s.visible && p.visible && s.state === p.state) {
        const dy = Math.abs(Math.atan2(Math.sin(s.yaw - p.yaw), Math.cos(s.yaw - p.yaw)));
        assert.ok(dy <= 3 / 30 + 1e-6, `ship ${i} snaps its heading (${dy.toFixed(3)} rad in one step)`);
      }
    });
    const vis = frames[k].filter((s) => s.visible);
    for (let i = 0; i < vis.length; i += 1) for (let j = i + 1; j < vis.length; j += 1) {
      assert.ok(Math.hypot(vis[i].x - vis[j].x, vis[i].y - vis[j].y, vis[i].z - vis[j].z) >= 6, "two ships collide");
    }
  }
});

test("Mini-Sim flies the traffic around ONI CSS (local simulation, labelled)", () => {
  const sim = readFileSync(new URL("mini-sim/assets/js/mini-sim.js", ROOT), "utf8");
  assert.match(sim, /BCMFleetMotion\.create\(/, "the space scene never starts the traffic");
  assert.match(sim, /space-traffic/, "no traffic group in the scene");
  assert.match(readFileSync(new URL("mini-sim/bcm-mini-sim.php", ROOT), "utf8"), /'bcm-fleet-motion'[\s\S]{0,120}fleet-motion\.js/);
  assert.match(readFileSync(new URL("tools/minisim-qa/standalone-shell.html", ROOT), "utf8"), /fleet-motion\.js/);
});
