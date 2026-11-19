// Owner 19.11.2026: "в room 0 нужно более трудную систему трассы и также
// другие корабли, которые стараются летать по кругу". The Room 0 race gets a
// seeded course with more turns, narrow sections and pylons (always with a way
// through), three rival ships that fly the loop at their own pace and dodge the
// pylons, and a race position for the player.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import vm from "node:vm";

const ROOT = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");
const FILE = "mini-sim/assets/js/room0-race.js";

function api() {
  assert.ok(existsSync(new URL(FILE, ROOT)), "Room 0 has no race module: the old five-corridor loop, no rivals");
  const c = vm.createContext({ Math, Number, Array, Object, JSON });
  c.window = c;
  vm.runInContext(read(FILE), c);
  return c.BCMRoom0Race;
}

test("the course is harder than the old five-corridor loop, and the same seed gives the same course", () => {
  const race = api();
  for (const seed of [1, 7, 42, 9001, 123456]) {
    const course = race.buildCourse(seed);
    assert.ok(course.corners.length >= 8 && course.corners.length <= 11, `seed ${seed}: ${course.corners.length} corners`);
    const widths = course.segments.map((s) => s.halfW);
    assert.ok(Math.min(...widths) <= 7.5, `seed ${seed}: no narrow section (narrowest half-width ${Math.min(...widths).toFixed(1)})`);
    const heights = course.corners.map((p) => p.y);
    assert.ok(Math.max(...heights) - Math.min(...heights) >= 10, `seed ${seed}: the course is flat`);
    assert.ok(course.pylons.length >= 5, `seed ${seed}: only ${course.pylons.length} pylons`);
    // Every pylon leaves a way through of at least 4 m on one side.
    for (const p of course.pylons) {
      const seg = course.segments[p.segment];
      const left = seg.halfW + p.offset - p.radius;
      const right = seg.halfW - p.offset - p.radius;
      assert.ok(Math.max(left, right) >= 4, `seed ${seed}: pylon in segment ${p.segment} closes the corridor`);
    }
    assert.deepEqual(JSON.stringify(race.buildCourse(seed)), JSON.stringify(course), "the same seed must give the same course");
  }
  assert.notDeepEqual(JSON.stringify(race.buildCourse(1).corners), JSON.stringify(race.buildCourse(2).corners));
});

test("three rivals fly the loop at their own pace, dodge pylons and count laps", () => {
  const race = api();
  const course = race.buildCourse(7);
  const rivals = race.createRivals(course, 3, 7);
  assert.equal(rivals.length, 3);
  const maxSpeed = 30;
  let hits = 0;
  for (let i = 0; i < 60 * 60; i += 1) {
    race.stepRivals(rivals, course, 1 / 60, maxSpeed);
    for (const r of rivals) {
      const pos = race.positionOf(course, r);
      for (const p of course.pylons) if (Math.hypot(pos.x - p.x, pos.z - p.z) < p.radius && Math.abs(pos.y - p.y) < 4) hits += 1;
      const seg = course.segments[r.segment];
      assert.ok(Math.abs(r.lane) <= seg.halfW - 0.5, "a rival flew through the corridor wall");
    }
  }
  const laps = rivals.map((r) => r.laps);
  assert.ok(laps.every((n) => n >= 2), `rivals do not get round the loop in a minute: laps ${laps.join(", ")}`);
  assert.ok(new Set(rivals.map((r) => r.distance.toFixed(0))).size === 3, "the rivals fly in lockstep");
  assert.ok(hits < 60 * 3, `rivals keep flying into pylons (${hits} frames inside a pylon)`);
});

test("the player's race position counts laps and distance", () => {
  const race = api();
  const course = race.buildCourse(7);
  const rivals = race.createRivals(course, 3, 7);
  rivals.forEach((r, i) => { r.laps = 1; r.distance = (i + 1) * 30; });
  assert.equal(race.placeOf({ laps: 1, distance: 200 }, rivals), 1);
  assert.equal(race.placeOf({ laps: 1, distance: 45 }, rivals), 3);
  assert.equal(race.placeOf({ laps: 0, distance: 500 }, rivals), 4);
  assert.ok(race.progressOn(course, course.corners[0]).distance < 1);
});

test("Mini-Sim builds Room 0 from the race module, draws pylons and rivals, and shows the place", () => {
  const sim = read("mini-sim/assets/js/mini-sim.js");
  const build = sim.slice(sim.indexOf("function buildRoom0Labyrinth("), sim.indexOf("function updateRoom0Labyrinth("));
  assert.match(build, /BCMRoom0Race\.buildCourse\(/, "Room 0 still builds the old five-corridor loop");
  assert.match(build, /course\.pylons/);
  assert.match(sim, /BCMRoom0Race\.stepRivals\(/, "rival ships never move");
  assert.match(sim, /BCMRoom0Race\.placeOf\(/, "the race never tells the player their place");
  assert.match(sim, /МЕСТО /);
  const php = read("mini-sim/bcm-mini-sim.php");
  assert.match(php, /'bcm-room0-race'[\s\S]{0,120}room0-race\.js/);
  assert.match(read("tools/minisim-qa/standalone-shell.html"), /room0-race\.js[\s\S]*bcm-mini-sim-js|room0-race\.js/);
});
