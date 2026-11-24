// Owner 23.11.2026: "важно подключить красивые трансформации и переходы". The owner's
// videos show each form turning into the next on a white background:
//   Roller → Walker, Walker → Orbiter, Orbiter → Brawler, Brawler → Runner, Runner → Stalker.
// They play in place of the boss during its transition, white keyed out in the shader,
// muted (AUDIO FREEZE); without the video the old particle transition stays.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";

const ROOT = new URL("../", import.meta.url);
const ring = readFileSync(new URL("mini-sim/assets/js/ring-platformer.js", ROOT), "utf8");
const VIDEOS = ["transform-roller-walker", "transform-walker-orbiter", "transform-orbiter-brawler",
  "transform-brawler-runner", "transform-runner-stalker"];

test("the owner's transformation videos are in the plugin", () => {
  for (const name of VIDEOS) {
    const file = new URL("mini-sim/assets/ring-bosses/video/" + name + ".mp4", ROOT);
    assert.ok(existsSync(file), name + ".mp4 is missing");
    // 24.11.2026: videos re-encoded lighter (D-096) — a real MP4 header, not a size threshold.
    assert.ok(statSync(file).size > 50000, name + ".mp4 is not a video");
    assert.equal(readFileSync(file).subarray(4, 8).toString("latin1"), "ftyp", name + ".mp4 has no MP4 header");
  }
});

test("each form transition plays its video in place of the boss", () => {
  VIDEOS.forEach((name, i) => {
    assert.match(ring, new RegExp((i + 2) + ':\\s*"ring-bosses/video/' + name + '\\.mp4"'), "phase " + (i + 2) + " has no transformation video");
  });
  assert.match(ring, /new THREE\.VideoTexture\(/, "the videos are never drawn in the scene");
  assert.match(ring, /distance\(diffuseColor\.rgb, vec3\(1\.0\)\)/, "the white background of the videos is not keyed out");
  assert.match(ring, /video\.muted = true/, "a transformation video may play sound (AUDIO FREEZE)");
  assert.match(ring, /beginRingBossTransitionVfx\(boss\)/, "the old transition is gone as a fallback");
});
