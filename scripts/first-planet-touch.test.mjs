// Owner 23.11.2026: "у нас нет никакого управления у телефонов ни у First Planet, ни у гонок".
// The island and the race had touch buttons gated only by CSS: `hidden` + `max-md:grid` /
// `[@media(pointer:coarse)]:grid`. A WordPress theme's `.hidden{display:none!important}`
// wins over that, and where it showed (standalone, phone emulation) it was a wall of 12 big
// tiles over the game. Now a shared TouchPad: shown by code on a touch device, a stick on
// the left, a few round action buttons on the right, rare actions small.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const ROOT = new URL("../mini-sim/first-planet/src/", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");

test("a shared TouchPad: shown by code on touch devices, stick on the left, round buttons on the right", () => {
  assert.ok(existsSync(new URL("components/touch-pad.tsx", ROOT)), "no touch pad component");
  const pad = read("components/touch-pad.tsx");
  assert.match(pad, /export function isTouchDevice\(/);
  assert.match(pad, /ontouchstart/);
  assert.match(pad, /maxTouchPoints/);
  assert.match(pad, /\(pointer: coarse\)/);
  assert.match(pad, /data-bcm-touch-stick/, "no stick");
  assert.match(pad, /data-bcm-touch-button/, "no action buttons");
  assert.match(pad, /setPointerCapture/, "a finger sliding off a button leaves it held");
  assert.doesNotMatch(pad, /className="[^"]*\bhidden\b/, "the pad is gated by the `hidden` class a WordPress theme can force");
});

test("the island and the race use the TouchPad, not the CSS-gated tile wall", () => {
  for (const file of ["components/desert-island.tsx", "components/shoal-race.tsx"]) {
    const src = read(file);
    assert.match(src, /<TouchPad\b/, `${file} has no touch pad`);
    assert.match(src, /isTouchDevice\(\)|useTouchDevice\(\)/, `${file} does not decide by the device`);
    assert.doesNotMatch(src, /\[@media\(pointer:coarse\)\]:grid/, `${file} still shows its tile wall by CSS only`);
  }
  const race = read("components/shoal-race.tsx");
  assert.match(race, /code: "KeyW"[\s\S]{0,80}Газ/, "no throttle on the race pad");
});
