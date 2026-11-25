// Owner 24.11.2026 (BUG-028): "меш оказался меньше видео перехода; летающая голова появляется
// отдельно от ролика, в другом углу; размер следующего босса не совпал с переходом".
// The browser probe scripts/ring-boss-video-fit-probe.mjs compared the last figure the player sees
// in each transform clip with the form that takes over. Before: the clip was cut at 3.3-3.7 s of
// 5.04 (a fixed 5 s from a start ~1 s late); the Walker stood at 0.71 of the figure, the Orbiter
// 3.3 m higher and 2 m aside, the Brawler x1.85, the Runner 0.69. After: bottom within 0.17 m,
// height x0.95-1.01, centre within 0.04 m, clip played to 4.8-5.0 s.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../mini-sim/assets/js/ring-platformer.js", import.meta.url), "utf8");

function fitFn() {
  const start = src.indexOf("function ringBossVideoFit(");
  assert.ok(start >= 0, "the clip plane is a fixed 4.6 x 3.45 m whatever the form");
  const end = src.indexOf("\n    }\n", start);
  return new Function(src.slice(start, end + 6) + "; return ringBossVideoFit;")();
}

test("the clip plane puts the figure on the form: floor, height and centre", () => {
  const fit = fitFn();
  const box = [0.088, 0.014, 0.906, 0.981]; // last frame of the Orbiter-to-Brawler clip
  const form = { bottom: 0, height: 6.16, x: 0.5 }; // the Brawler, 2.2 times bigger
  const p = fit(box, form, 4 / 3);
  const yAt = (fy) => p.y + (0.5 - fy) * p.height;
  const xAt = (fx) => p.x + (fx - 0.5) * p.width;
  assert.ok(Math.abs(yAt(box[3]) - 0) < 1e-9, "the figure's feet are off the floor");
  assert.ok(Math.abs(yAt(box[1]) - yAt(box[3]) - 6.16) < 1e-9, "the figure is not the form's height");
  assert.ok(Math.abs((xAt(box[0]) + xAt(box[2])) / 2 - 0.5) < 1e-9, "the figure is beside the form");
  assert.ok(Math.abs(p.width / p.height - 4 / 3) < 1e-9, "the clip is stretched");
});

test("each clip has its measured figure, the transition lasts until the clip ends, the form appears where it moves", () => {
  const table = src.slice(src.indexOf("const RING_BOSS_VIDEO_FIGURE = {"), src.indexOf("const RING_BOSS_VIDEO_ASPECT"));
  for (const k of [2, 3, 4, 5, 6]) assert.ok(table.includes(`      ${k}: { first: [`) , `clip ${k} has no figure bounds`);
  assert.match(src, /boss\.phaseUntil = now \+ Math\.max\(0, clip\.duration - clip\.currentTime\) \* 1000;/, "the transition still cuts the clip at a fixed time");
  assert.match(src, /placeRingBossTransformVideo\(boss, progress\);/);
  assert.match(src, /const reveal = ringBossRevealPose\(boss, boss\.phaseIndex\);/, "the new form appears on the old spot and then jumps");
  assert.match(src, /phaseGroup\.position\.y = \(phaseGroup\.userData\.bcmGroundY \|\| 2\.1\) \+ \(boss\.revealY \|\| 0\);/);
  assert.doesNotMatch(src, /mesh\.scale\.set\(4\.6, 3\.45, 1\);/, "the clip plane is still one size for every form");
});
