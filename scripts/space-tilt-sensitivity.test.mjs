// Owner 23.11.2026: "поправить управление в космосе у андроид — чуть больше чувствительности".
// On a phone the flight is aimed by tilting it (tiltLook in mini-sim.js: dead zone, full
// response angle, gain). A small tilt must turn the ship noticeably, without a twitchy edge.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sim = readFileSync(new URL("../mini-sim/assets/js/mini-sim.js", import.meta.url), "utf8");

function tiltNumbers() {
  const body = sim.slice(sim.indexOf("function tiltLook()"), sim.indexOf("function tiltLook()") + 2200);
  const num = (name) => Number((body.match(new RegExp("const " + name + " = ([\\d.]+);")) || [])[1]);
  return { dead: num("dead"), response: num("response"), gain: num("gain") };
}

function shaped(t, angle) {
  if (Math.abs(angle) <= t.dead) return 0;
  return Math.min(1, (Math.abs(angle) - t.dead) / (t.response - t.dead)) * t.gain;
}

test("a phone tilt turns the ship more: 12° gives at least 0.2, the full turn comes by 25°", () => {
  const t = tiltNumbers();
  assert.ok(Number.isFinite(t.dead) && Number.isFinite(t.response) && Number.isFinite(t.gain), "tiltLook numbers not found");
  // Before (0.16.12): dead 4°, response 30°, gain 0.40 → 12° gave 0.12.
  assert.ok(shaped(t, 12) >= 0.2, `12° of tilt gives only ${shaped(t, 12).toFixed(3)}`);
  assert.ok(t.response <= 25, `full turn only at ${t.response}°`);
  assert.ok(t.dead >= 2.5 && t.dead <= 4, `dead zone ${t.dead}°: the ship drifts while the phone is held still`);
  assert.ok(t.gain <= 0.6, `gain ${t.gain}: too twitchy for a slight change`);
});
