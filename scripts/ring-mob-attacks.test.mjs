// Owner 25.11.2026: "Атаки мобов" (BUG-028, after D-111). In 0.16.34 the pig mobs only walked and hurt
// by touch. Each look now attacks its own way, after a visible tell, with a bounded zone and an answer:
//   toxic  — leaves poison puddles on the floor (jump over them, they dry up);
//   tank   — aims, then fires a shell along the floor (jump it);
//   spiky  — its back is all spikes: a shot from behind glances off (shoot it in the face);
//   angel  — swoops down on a pilot below, then climbs back (step aside during the tell).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

function mobs() {
  const c = vm.createContext({ Math, Number, Array, Object, JSON, String });
  c.window = c;
  vm.runInContext(read("mini-sim/assets/js/ring-mobs.js"), c);
  return c.BCMRingMobs;
}

function play(M, kind, input, seconds = 12, opts = {}) {
  const mob = M.create(kind, { offset: -2, dir: 1, limit: 2.15, chargeLimit: 6.5, ...opts });
  const frames = [];
  for (let i = 0; i < seconds * 60; i += 1) frames.push(JSON.parse(JSON.stringify(mob.step(1 / 60, typeof input === "function" ? input(i) : input))));
  return { mob, frames };
}
const hazards = (frames, kind) => frames.flatMap((f, i) => (f.hazards || []).filter((h) => h.kind === kind).map((h) => ({ ...h, i })));

test("the toxic pig leaves poison puddles on the floor that dry up", () => {
  const M = mobs();
  const { frames } = play(M, "toxic", { near: true, targetOffset: 1, targetY: 0 });
  const puddles = hazards(frames, "puddle");
  assert.ok(puddles.length > 0, "the toxic pig leaves no puddle");
  for (const p of puddles) {
    assert.ok(p.y0 === 0 && p.y1 <= 0.35, "a puddle reaches above ankle height: it cannot be jumped");
    assert.ok(p.x1 - p.x0 <= 1.3, "a puddle is wider than a jump");
  }
  assert.ok(Math.max(...frames.map((f) => (f.hazards || []).filter((h) => h.kind === "puddle").length)) <= 3, "the floor fills with puddles");
});

test("the tank aims for half a second, then a shell flies along the floor", () => {
  const M = mobs();
  const { frames } = play(M, "tank", { near: true, targetOffset: 3, targetY: 0 });
  const shells = hazards(frames, "shell");
  assert.ok(shells.length > 0, "the tank never fires");
  const firstShell = shells[0].i;
  const aimFrom = frames.findIndex((f) => f.state === "aim");
  assert.ok(aimFrom >= 0 && firstShell - aimFrom >= 30, "the tank fires without a half-second aim");
  for (const s of shells) assert.ok(s.y1 <= 0.9 && s.x1 - s.x0 <= 0.6, "the shell is too tall or too long to jump");
  const xs = shells.filter((s) => s.i < firstShell + 40).map((s) => (s.x0 + s.x1) / 2);
  assert.ok(Math.abs(xs[xs.length - 1] - xs[0]) > 2, "the shell does not fly");
});

test("the spiky pig's back is all spikes: a shot from behind glances off, a shot in the face counts", () => {
  const M = mobs();
  const mob = M.create("spiky", { offset: 0, dir: 1, limit: 2.15 });
  mob.step(1 / 60, { near: false }); // it walks right (facing +1)
  assert.equal(mob.hit(-3), false, "a shot in the back does not glance off");
  assert.equal(mob.hp, 2, "a shot in the back still hurts the spiky pig");
  mob.hit(3);
  assert.equal(mob.hp, 1, "a shot in the face does not count");
});

test("the angel swoops on a pilot below after a tell, then climbs back", () => {
  const M = mobs();
  const { frames } = play(M, "angel", (i) => ({ near: true, targetOffset: frames0(i), targetY: 0 }));
  function frames0() { return 0; }
  const tell = frames.findIndex((f) => f.state === "swoop-tell");
  const dive = frames.findIndex((f) => f.state === "swoop");
  assert.ok(tell >= 0 && dive - tell >= 24, "the angel dives without a tell");
  assert.ok(Math.min(...frames.slice(dive, dive + 90).map((f) => f.y)) < 0.5, "the angel does not come down to the pilot");
  assert.ok(frames.slice(dive).some((f) => f.state === "fly" && f.y > 1), "the angel does not climb back");
});

test("the Ring draws and applies the mob attacks", () => {
  const src = read("mini-sim/assets/js/ring-platformer.js");
  assert.match(src, /ring-mob-puddle/, "the puddles are not drawn");
  assert.match(src, /ring-mob-shell/, "the shell is not drawn");
  assert.match(src, /mob\.ai\.hit\(player\.worldX - worldState\.cellPath\.homeX\)/, "the laser does not tell the mob where the shot comes from");
  assert.match(src, /\(out\.hazards \|\| \[\]\)\.forEach/, "the mob attacks do not hurt the pilot");
});
