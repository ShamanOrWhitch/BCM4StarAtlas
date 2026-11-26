// Owner 26.11.2026 (live site): "в некоторых красных локациях слишком сильная гравитация, что нельзя даже
// бочки перепрыгнуть". The Ring cells are built of 1 m tiles (ring-panels.js: 18 x 6 tiles, the
// crossing check climbs one tile at a time). The blue "ВЫСОКАЯ G" cells set gravity 27 and jump 5.7 m/s:
// the jump rose 5.7^2 / 54 = 0.60 m, so a one-tile barrel could not be cleared. Heavy gravity keeps a
// short, fast jump, but every mode must still clear one tile with room for the feet.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../mini-sim/assets/js/ring-platformer.js", import.meta.url), "utf8");
const panels = readFileSync(new URL("../mini-sim/assets/js/ring-panels.js", import.meta.url), "utf8");
const TILE = 1.0;
const peak = (v, g) => (v * v) / (2 * g);

function mode(re, name) {
  const m = src.match(re);
  assert.ok(m, `the ${name} gravity is not where it was`);
  return { g: Number(m[1]), v: Number(m[2]) };
}

test("the Ring cells are 1 m tiles and the crossing check climbs one tile", () => {
  assert.match(panels, /var COLS = 18;/);
  assert.match(panels, /var ROWS = 6;/);
  assert.match(panels, /var half = COLS \/ 2;/);
});

test("every gravity mode jumps over a one-tile barrel; heavy gravity still jumps lower than normal", () => {
  const normal = mode(/let gravity = ([\d.]+), jumpVelocity = ([\d.]+);/, "normal");
  const heavy = mode(/else if \(highGravity\) \{ gravity = ([\d.]+); jumpVelocity = ([\d.]+); \}/, "heavy");
  const drift = mode(/if \(astralMode === "drift"\) \{ gravity = ([\d.]+); jumpVelocity = ([\d.]+); \}/, "drift");
  for (const [name, m] of Object.entries({ normal, heavy, drift })) {
    const h = peak(m.v, m.g);
    assert.ok(h >= TILE + 0.15, `${name}: the jump rises ${h.toFixed(2)} m, a ${TILE} m barrel cannot be cleared`);
  }
  assert.ok(peak(heavy.v, heavy.g) < peak(normal.v, normal.g) - 0.3, "heavy gravity no longer feels heavy");
  assert.ok(heavy.g > normal.g, "heavy gravity is not heavier");
});
