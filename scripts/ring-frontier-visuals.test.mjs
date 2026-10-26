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

test("Pig bosses are visible in the three large arenas without new image assets", () => {
  const build = section(warp, "function buildRingWorld()", "function updateRoomSlice()");
  assert.match(build, /pigSphereGeometry/);
  assert.match(build, /pig\.name = "ring-pig-boss-" \+ \(index \+ 1\)/);
  assert.match(build, /pigSnout\.name = "ring-pig-boss-snout-/);
  assert.match(build, /core\.position\.set\(0, 2\.78, 1\.85\)/);
  assert.match(build, /ring-pig-boss-nostril/);
  assert.match(build, /ring-pig-boss-tusk/);
  assert.match(build, /ring-pig-boss-tail/);
  assert.match(build, /world\.add\(group\)/);
  assert.match(warp, /viewport\.h > viewport\.w \? 7\.1 : 5\.4/);
});

test("Large bosses and platforms keep their comic-style arena structure", () => {
  const build = section(warp, "function buildRingWorld()", "function updateRoomSlice()");
  assert.match(build, /bossOutlineGeometry/);
  assert.match(build, /bossArmorGeometry/);
  assert.match(build, /bossHornGeometry/);
  assert.match(build, /bossCoreGeometry/);
  assert.match(build, /Dark offset meshes create the thick inked silhouette/);
  assert.match(build, /A bright lip and dark support braces/);
  assert.match(warp, /viewport\.h > viewport\.w \? 7\.1 : 5\.4/);
});

test("Ring cell maze exposes a route to the large boss arena", () => {
  assert.match(warp, /function nextDirectionTowardLarge\(startNode\)/);
  assert.match(warp, /const firstStep = new Map\(\[\[startNode, null\]\]\)/);
  assert.match(warp, /path\.nextDirectionTowardLarge\(node\)/);
  assert.match(warp, /world\.group\.visible = !!node\.large/);
  assert.match(warp, /group\.name = "ring-boss-" \+ \(index \+ 1\)/);
});

test("Ring cell maze exposes a route to the large boss arena and fallback transitions", () => {
  assert.match(warp, /function nextDirectionTowardLarge\(startNode\)/);
  assert.match(warp, /const firstStep = new Map\(\[\[startNode, null\]\]\)/);
  assert.match(warp, /path\.nextDirectionTowardLarge\(node\)/);
  assert.doesNotMatch(warp, /nextDirection = path\.nextDirectionTowardLarge\(node\) \|\|/);
  assert.match(warp, /const verticalDirection = input\.down \? "yn" : "yp"/);
  assert.match(warp, /world\.group\.visible = !!node\.large/);
  assert.match(warp, /group\.name = "ring-boss-" \+ \(index \+ 1\)/);
});

test("Ring disposes generated backdrop textures when leaving the location", () => {
  const cleanup = section(warp, "state.ringPlatformerCleanup = () =>", "state.ringLastUpdate = 0");
  assert.match(cleanup, /worldState\.textures\.forEach\(\(texture\) => \{ try \{ texture\.dispose\(\); \} catch \(e\) \{\} \}\)/);
  assert.match(cleanup, /worldState\.specialGeometry\.forEach/);
});

test("Mini-Sim cache version is bumped for the Ring art update", () => {
  assert.match(plugin, /Version: 0\.11\.20/);
  assert.match(plugin, /define\('BCM_MINI_SIM_VERSION', '0\.11\.20'\)/);
});
