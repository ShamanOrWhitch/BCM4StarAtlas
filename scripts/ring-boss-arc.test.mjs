import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const warp = await readFile(new URL("../mini-sim/assets/js/deep-space-warp.js", import.meta.url), "utf8");
const core = await readFile(new URL("../mini-sim/assets/js/crew-core.js", import.meta.url), "utf8");
const sim = await readFile(new URL("../mini-sim/assets/js/mini-sim.js", import.meta.url), "utf8");

test("The existing Pig remains phase one; new Ring forms follow the agreed order", () => {
  const start = warp.indexOf("const phaseSpecs = [");
  const end = warp.indexOf("const phaseGroups = phaseSpecs.map", start);
  const source = warp.slice(start, end);
  const names = ["КАТОК", "ШАГОХОД", "ОРБИТА", "БОЕЦ", "ГОНЩИК", "ТЕНЬ"];
  let previous = -1;
  for (const name of names) {
    const index = source.indexOf('name: "' + name + '"');
    assert.ok(index > previous, "phase order must include " + name);
    previous = index;
  }
  assert.match(warp, /phaseIndex: 0, phaseState: "pig", vulnerable: true/);
  assert.match(warp, /if \(!boss\.phaseIndex\)\s*\{\s*\/\/ Preserve the existing Pig's attack timing and ordinary first defeat/);
});

test("Every new form locks damage outside recovery and the arena clears only after Stalker", () => {
  assert.match(warp, /if \(boss\.phaseIndex > 0 && !boss\.vulnerable\)/);
  assert.match(warp, /if \(boss\.phaseIndex < 6\)\s*\{/);
  assert.match(warp, /finishBossArena\(boss\)/);
  assert.match(warp, /phaseState = "recovery";[\s\S]*?boss\.vulnerable = true/);
  assert.match(warp, /boss\.phaseState === "telegraph"/);
  assert.match(warp, /worldState\.defeatedBosses = Math\.min\(3, worldState\.defeatedBosses \+ 1\)/);
});

test("Purple fields provide low-gravity lift/resources; blue fields use short high-gravity jumps", () => {
  assert.match(warp, /const lowGravity = astralMode === "drift" \|\| astralMode === "flux"/);
  assert.match(warp, /const highGravity = astralMode === "dense"/);
  assert.match(warp, /player\.jetFuel -= 12/);
  assert.match(warp, /player\.breathReserve -= 12/);
  assert.match(warp, /player\.jetFlameRemaining = 0\.21/);
  assert.match(warp, /player\.jetFuel = Math\.min\(100, player\.jetFuel \+ 34\)/);
  assert.match(warp, /player\.breathReserve = Math\.min\(100, player\.breathReserve \+ 34\)/);
  assert.match(warp, /highGravity\) \{ gravity = 27\.0; jumpVelocity = 5\.7; \}/);
});

test("Ring consumes Crew Core's shared intent and Crew Core returns shared locomotion states", () => {
  assert.match(core, /function createCrewControls\(options\)/);
  assert.match(warp, /window\.BCMCrewCore\.createCrewControls\(\{ playerIndex \}\)/);
  assert.match(warp, /const input = getInput\(player\)/);
  assert.match(warp, /const direction = Math\.sign\(moveX\)/);
  assert.match(core, /state: motionState/);
});

test("Panda objective hint is concise and has a short local timeout", () => {
  assert.match(warp, /Мы почти у цели! Осталось победить свиней!/);
  assert.match(warp, /"panda\.mp4", 4500/);
  assert.match(sim, /function showOperatorDialog\(speaker, message, choices, avatarAsset, durationMs\)/);
});
