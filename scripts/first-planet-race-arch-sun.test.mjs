// Owner 24.11.2026 (BUG-029): "отблеск солнца на воде смещён… флажок финиша висит неправильно
// относительно трассы". The checkered banner was turned a quarter more than the beam, so it hung along
// the road instead of across it. The sun sprites stood 170-200 m from the centre while their light is
// directional: as the camera followed the car the visible sun slid away from the glint on the water.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "./lib/first-planet-sim.mjs";

const ROOT = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");
const world = await import("../mini-sim/first-planet/src/game/world.ts");

test("the finish banner hangs across the road, along the beam", () => {
  assert.equal(typeof world.archBannerYaw, "function", "the arch has no banner rule");
  for (const deg of [0, 37, 90, 151, 222, 300]) {
    const a = (deg * Math.PI) / 180;
    const start = { tx: Math.sin(a), tz: Math.cos(a) };
    const yaw = world.archBannerYaw(start);
    // A plane's width runs along its local x; after a turn about y it points along (cos, 0, -sin).
    const along = Math.cos(yaw) * start.tx - Math.sin(yaw) * start.tz;
    assert.ok(Math.abs(along) < 1e-9, `at ${deg}° the banner runs ${along.toFixed(2)} along the road`);
  }
  const src = read("mini-sim/first-planet/src/game/world.ts");
  assert.doesNotMatch(src, /banner\.rotation\.y = Math\.atan2\(start\.tx, start\.tz\) \+ Math\.PI \/ 2/, "the banner is still turned along the road");
  assert.match(src, /banner\.rotation\.y = archBannerYaw\(start\)/);
});

test("each sun is seen exactly where its light comes from, wherever the camera is", () => {
  assert.ok(world.RACE_SUNS && typeof world.skySunAt === "function", "the suns are fixed props, not on the sky");
  for (const key of ["gold", "rose"]) {
    const s = world.RACE_SUNS[key];
    const light = { x: s.light[0], y: s.light[1] - 0.2, z: s.light[2] };
    const n = Math.hypot(light.x, light.y, light.z);
    for (const cam of [{ x: 0, y: 48, z: 120 }, { x: -90, y: 6, z: 40 }, { x: 110, y: 5, z: -100 }]) {
      const at = world.skySunAt(cam, key);
      const d = { x: at.x - cam.x, y: at.y - cam.y, z: at.z - cam.z };
      const m = Math.hypot(d.x, d.y, d.z);
      const cos = (d.x * light.x + d.y * light.y + d.z * light.z) / (m * n);
      assert.ok(cos > 0.9999, `${key} sun from (${cam.x}, ${cam.z}) is ${(Math.acos(Math.min(1, cos)) * 180 / Math.PI).toFixed(1)}° off its light`);
      assert.ok(m < 520 && m > 300, `${key} sun at ${m.toFixed(0)} m: outside the sky dome or close enough to parallax`);
    }
  }
  const src = read("mini-sim/first-planet/src/game/world.ts");
  assert.match(src, /goldSun\.position\.copy\(skySunAt\(camera\.position, "gold"\)\)/, "the gold sun does not follow the sky");
  assert.match(src, /roseSun\.position\.copy\(skySunAt\(camera\.position, "rose"\)\)/, "the rose sun does not follow the sky");
});
