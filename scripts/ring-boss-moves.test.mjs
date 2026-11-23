// Owner 22.11.2026: "Бои с боссами Ring". After the Pig, the six forms (Roller,
// Walker, Orbiter, Brawler, Runner, Stalker) all ran one pattern: tell 0.85 s,
// a torus shockwave, an open window — only the numbers differed. The design
// (RING_BOSS_AND_MAZE_GAMEPLAY_SPEC.md, #146) asks for an own move per form with
// a visible tell, a bounded hitbox, a readable answer and a recovery window.
// Step 1: ring-boss-moves.js plays each form; ring-platformer.js draws and applies it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import vm from "node:vm";

const ROOT = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");
const FILE = "mini-sim/assets/js/ring-boss-moves.js";
const FORMS = ["roller", "walker", "orbiter", "brawler", "runner", "stalker"];
const JUMP_PEAK = 1.84; // Ring jump: v 8.8, g 21

function api() {
  assert.ok(existsSync(new URL(FILE, ROOT)), "no boss moves: every form after the Pig fires the same shockwave");
  const c = vm.createContext({ Math, Number, Array, Object, JSON, String });
  c.window = c;
  vm.runInContext(read(FILE), c);
  return c.BCMRingBossMoves;
}

/** Play a form for `seconds` with a target that walks back and forth in the arena. */
function play(moves, phase, seconds, seed = 7) {
  const homeX = 18;
  const boss = moves.create(phase, { homeX, seed });
  const frames = [];
  const dt = 1 / 60;
  for (let i = 0; i < seconds * 60; i += 1) {
    const targetX = homeX - 4 + Math.sin(i / 90) * 3;
    const out = boss.step(dt, { targetX, targetY: 0 });
    frames.push(JSON.parse(JSON.stringify(out)));
  }
  return { boss, frames, homeX };
}

test("each of the six forms has its own move: states, hazard kinds and motion differ", () => {
  const moves = api();
  const signatures = new Set();
  for (let phase = 1; phase <= 6; phase += 1) {
    const { frames, homeX } = play(moves, phase, 30);
    assert.equal(frames[0].form, FORMS[phase - 1], `phase ${phase} plays ${frames[0].form}`);
    const states = [...new Set(frames.map((f) => f.state))].sort();
    const kinds = [...new Set(frames.flatMap((f) => f.hazards.map((h) => h.kind)))].sort();
    assert.ok(kinds.length >= 1, `${FORMS[phase - 1]} never attacks`);
    const xs = frames.map((f) => f.x);
    const travel = Math.max(...xs) - Math.min(...xs);
    signatures.add(states.join(",") + "|" + kinds.join(","));
    for (const f of frames) assert.ok(f.x >= homeX - 9.01 && f.x <= homeX + 9.01, `${f.form} leaves the arena (x ${f.x.toFixed(1)})`);
    if (["roller", "runner"].includes(FORMS[phase - 1])) assert.ok(travel > 10, `${FORMS[phase - 1]} does not cross the arena (travel ${travel.toFixed(1)} m)`);
  }
  assert.equal(signatures.size, 6, "two forms play the same pattern");
});

test("every attack comes after a tell of at least half a second", () => {
  const moves = api();
  for (let phase = 1; phase <= 6; phase += 1) {
    const { frames } = play(moves, phase, 30);
    const attackStates = new Set(frames.filter((f) => f.attacking).map((f) => f.state));
    for (let i = 1; i < frames.length; i += 1) {
      if (!frames[i].attacking || frames[i - 1].attacking) continue;
      // Count the tell frames right before the attack starts.
      let told = 0;
      for (let k = i - 1; k >= 0 && frames[k].tell; k -= 1) told += 1;
      assert.ok(told / 60 >= 0.5, `${frames[i].form}: ${frames[i].state} starts after only ${(told / 60).toFixed(2)} s of tell`);
    }
    assert.ok(attackStates.size >= 1, `${FORMS[phase - 1]} has no attack state`);
  }
});

test("the core opens in a window: vulnerable sometimes, never most of the time", () => {
  const moves = api();
  for (let phase = 1; phase <= 6; phase += 1) {
    const { frames } = play(moves, phase, 30);
    const open = frames.filter((f) => f.vulnerable).length / frames.length;
    assert.ok(open > 0.08 && open < 0.5, `${FORMS[phase - 1]} is open ${(open * 100).toFixed(0)} % of the time`);
    assert.ok(!frames.some((f) => f.vulnerable && f.attacking), `${FORMS[phase - 1]} is open while it attacks`);
  }
});

test("the answers work: low attacks can be jumped, the Stalker lands where it marked", () => {
  const moves = api();
  for (const phase of [1, 2, 5]) {
    const { frames } = play(moves, phase, 30);
    for (const f of frames) for (const h of f.hazards) {
      if (h.kind === "shard" || h.kind === "orb") continue;
      assert.ok(h.y1 <= JUMP_PEAK - 0.3, `${f.form}: ${h.kind} is ${h.y1} m high, a jump does not clear it`);
    }
  }
  const { frames } = play(moves, 6, 30);
  let lastMark = null;
  for (const f of frames) {
    if (f.tell && f.tell.kind === "landing") lastMark = f.tell;
    for (const h of f.hazards) if (h.kind === "landing") {
      assert.ok(lastMark, "the Stalker lands without marking the spot");
      assert.ok(Math.abs((h.x0 + h.x1) / 2 - (lastMark.x0 + lastMark.x1) / 2) < 0.01, "the Stalker lands away from its mark");
    }
  }
});

test("the Brawler is armoured in front: a shot from the back always lands", () => {
  const moves = api();
  const boss = moves.create(4, { homeX: 18, seed: 3 });
  let checkedFront = false, checkedBack = false;
  for (let i = 0; i < 60 * 20; i += 1) {
    const out = boss.step(1 / 60, { targetX: 14, targetY: 0 });
    const front = out.x + out.facing * 3;
    const back = out.x - out.facing * 3;
    if (!out.vulnerable) {
      assert.equal(boss.canBeHit(front), false, "the Brawler takes a shot in its armour");
      checkedFront = true;
    }
    // Owner 23.11.2026: while it drinks after the cannon, its shield covers the back too.
    if (!out.shielded) assert.equal(boss.canBeHit(back), true, "the Brawler's back is armoured");
    else assert.equal(boss.canBeHit(back), false, "the drinking shield lets a back shot through");
    checkedBack = true;
  }
  assert.ok(checkedFront && checkedBack);
});

test("the Ring plays the forms through the moves module and draws their tells and hazards", () => {
  const ring = read("mini-sim/assets/js/ring-platformer.js");
  assert.match(ring, /BCMRingBossMoves\.create\(/, "the Ring still fires one shockwave for every form");
  assert.match(ring, /boss\.moves\.step\(/);
  assert.match(ring, /boss\.moves\.canBeHit\(/, "armour ignores the side of the shot");
  assert.match(ring, /ring-boss-hazard/, "hazards are never drawn");
  assert.match(read("mini-sim/bcm-mini-sim.php"), /'bcm-ring-boss-moves'[\s\S]{0,120}ring-boss-moves\.js/);
  assert.match(read("tools/minisim-qa/standalone-shell.html"), /ring-boss-moves\.js/);
});
