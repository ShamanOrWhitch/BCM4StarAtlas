// Owner, live site 0.15.22, 17.11.2026: "на второй прыжок игра не показывает
// кораблик, при том уровень проходится". The tube panel showed
// "Failed to execute 'arc' on 'CanvasRenderingContext2D'".
//
// The tube clock (state.elapsed * 1000) starts at 0 on every jump, but the
// bridge kept the impact flash of the last hit of the previous jump. A hit at
// 20 s of jump 1 leaves flashUntil = 20 240 ms; at 1 s of jump 2 the flash
// "has 80 frames left", its ring radius goes far below zero, arc() throws and
// the rest of the frame — the ship — is never drawn.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ROOT = new URL("../", import.meta.url);

/** A 2D context that fails like a browser does on a negative radius. */
function canvas() {
  const calls = { arcs: 0 };
  const noop = () => {};
  const g = new Proxy({}, {
    get(_, key) {
      if (key === "arc") {
        return (x, y, r) => {
          calls.arcs += 1;
          if (!(r >= 0)) throw new Error(`Failed to execute 'arc' on 'CanvasRenderingContext2D': The radius provided (${r}) is negative.`);
        };
      }
      if (key === "createRadialGradient" || key === "createLinearGradient") return () => ({ addColorStop: noop });
      return noop;
    },
    set() { return true; },
  });
  return { g, calls };
}

function bridge() {
  const context = vm.createContext({ console, Math, Number, String, Array, Object, JSON, isFinite, Date });
  context.window = context;
  // The tube core with no drawing layers: only the bridge's own flash and hits run.
  context.BCMWarpSpace = {};
  vm.runInContext(readFileSync(new URL("mini-sim/assets/js/warp-bridge.js", ROOT), "utf8"), context);
  return context.BCMWarpBridgeFlight;
}

const point = (d, a) => ({ x: 400 + Math.cos(a) * 200 * (1 - d), y: 300 + Math.sin(a) * 200 * (1 - d) });

test("a hit at the end of one jump does not break the frames of the next jump", () => {
  const flight = bridge();
  assert.ok(flight && typeof flight.drawArt === "function");
  // Jump 1: the ship is hit at 20 s on the tube clock.
  const hit = flight.hitShip({ x: 400, y: 520, px: 10, damage: 6, depth: 0.9, size: "small" }, { x: 400, y: 520, size: 28 }, 20000);
  assert.ok(hit, "the test hit did not register");
  // Jump 2 starts: the tube clock is back at zero.
  const { g } = canvas();
  const errors = [];
  for (let frame = 0; frame < 120; frame += 1) {
    const t = 1000 + frame * 16;
    const stats = flight.drawArt(g, { point, maxRadius: 300, elapsed: t / 1000, w: 800, h: 600, t, ship: { x: 400, y: 520, size: 28 } });
    const text = String((stats && (stats.errors || stats.error)) || '');
    if (/radius|arc/i.test(text)) errors.push(text);
  }
  assert.deepEqual(errors.slice(0, 2), [], `frames of jump 2 fail: ${errors[0]}`);
});

test("the impact flash never draws a negative radius, whatever the clock does", () => {
  const flight = bridge();
  flight.hitShip({ x: 10, y: 10, px: 10, damage: 6, depth: 0.9, size: "small" }, { x: 10, y: 10, size: 28 }, 5000);
  const { g } = canvas();
  for (const t of [5000, 5100, 4000, 0, 4999, 5200, 9000]) {
    const stats = flight.drawArt(g, { point, maxRadius: 300, elapsed: t / 1000, w: 200, h: 200, t, ship: { x: 10, y: 10, size: 28 } });
    const text = String((stats && (stats.errors || stats.error)) || '');
    assert.doesNotMatch(text, /radius|arc/i, `t=${t}: ${text}`);
  }
});
