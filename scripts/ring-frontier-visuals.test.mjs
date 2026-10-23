import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const warp = await readFile(new URL("../mini-sim/assets/js/deep-space-warp.js", import.meta.url), "utf8");
const plugin = await readFile(new URL("../mini-sim/bcm-mini-sim.php", import.meta.url), "utf8");

function section(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `missing source marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `missing source marker: ${endMarker}`);
  return source.slice(start, end);
}

test("Ring Frontier builds three large side-scrolling arenas instead of using maze cells as the level", () => {
  const build = section(warp, "function buildRingWorld()", "function updateRoomSlice()");
  assert.match(build, /world\.name = "bcm-ring-frontier-side-scroll"/);
  assert.match(build, /const zones = \[/);
  assert.match(build, /arenaX: -16/);
  assert.match(build, /arenaX: 18/);
  assert.match(build, /arenaX: 58/);
  assert.match(build, /Each boss gets a framed arena/);
  assert.match(build, /function makeComicBackdrop\(zone\)/);
  assert.match(build, /new THREE\.CanvasTexture\(canvas\)/);
  assert.match(build, /Halftone dots and panel hatching/);
  assert.match(build, /new THREE\.PlaneGeometry\(zone\.x2 - zone\.x1, 11\.2\)/);
  assert.doesNotMatch(build, /maze\.cells/);
});

test("Large bosses and platforms have strong comic-style silhouettes", () => {
  const build = section(warp, "function buildRingWorld()", "function updateRoomSlice()");
  assert.match(build, /bossOutlineGeometry/);
  assert.match(build, /bossArmorGeometry/);
  assert.match(build, /bossHornGeometry/);
  assert.match(build, /bossCoreGeometry/);
  assert.match(build, /Dark offset meshes create the thick inked silhouette/);
  assert.match(build, /A bright lip and dark support braces/);
  assert.match(warp, /viewport\.h > viewport\.w \? 7\.1 : 5\.4/);
});

test("Ring disposes generated backdrop textures when leaving the location", () => {
  const cleanup = section(warp, "state.ringPlatformerCleanup = () =>", "state.ringLastUpdate = 0");
  assert.match(cleanup, /worldState\.textures\.forEach\(\(texture\) => \{ try \{ texture\.dispose\(\); \} catch \(e\) \{\} \}\)/);
  assert.match(cleanup, /worldState\.specialGeometry\.forEach/);
});

test("Mini-Sim cache version is bumped for the Ring art update", () => {
  assert.match(plugin, /Version: 0\.11\.5/);
  assert.match(plugin, /define\('BCM_MINI_SIM_VERSION', '0\.11\.5'\)/);
});
