import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const repoRoot=new URL("../",import.meta.url);
const read=(path)=>readFile(new URL(path,repoRoot),"utf8");

test("Warp OST belongs to the whole Warp stage and loops",async()=>{
  const s=await read("mini-sim/assets/js/deep-space-warp.js");
  assert.match(s,/warpAudio\.loop = true/);
  assert.match(s,/const WARP_DURATION = 48/);
  assert.match(s,/pauseLevelOst\(\);\s*startWarpAudio\(true\);\s*state\.nav = readNavigation\(\)/);
  const tube=s.slice(s.indexOf("function showTube()"),s.indexOf("function finishTube"));
  assert.doesNotMatch(tube,/startWarpAudio/);
  assert.match(s,/function enterAsteroidMaze\(\) \{\s*\/\/ Warp OST owns the whole Warp stage/);
});
test("Tube has forward road, rotation, varied sections, open gates and controller steering",async()=>{
  const s=await read("mini-sim/assets/js/deep-space-warp.js");
  assert.match(s,/const roadY=d=>/);
  assert.match(s,/Continuous floor panels and centre dashes/);
  assert.match(s,/g\.rotate\(roll\)/);
  assert.match(s,/const speedBySection = \[0\.76, 1\.24, 0\.84, 1\.34, 0\.68, 1\.14\]/);
  assert.match(s,/const gateCount = 14/);
  assert.match(s,/rng\(\) < 0\.38/);
  assert.match(s,/navigator\.getGamepads\?navigator\.getGamepads\(\):\[\]/);
});
test("Room 1 Home clears Room 0 constraints and restores Starbase OST",async()=>{
  const s=await read("mini-sim/assets/js/mini-sim.js");
  const home=s.slice(s.indexOf("function returnToStart"),s.indexOf("function resetCurrentRoom"));
  assert.match(home,/race\.active = false/);
  assert.match(home,/updateRoom0Labyrinth\(\)/);
  assert.match(home,/ship\.position\.set\(0, 0, 2\)/);
  assert.match(home,/startMusic\(\)/);
  assert.doesNotMatch(home,/stopMiniSimAudio\(\);[\s\S]*?setStatus/);
});
test("Note button shares one mute state across Starbase, Warp and Tower OSTs",async()=>{
  const mini=await read("mini-sim/assets/js/mini-sim.js");
  const warp=await read("mini-sim/assets/js/deep-space-warp.js");
  const tower=await read("mini-sim/tower/assets/js/tower.js");
  assert.match(mini,/window\.BCMGameAudio = Object\.assign/);
  assert.match(mini,/playExclusiveGameOst/);
  assert.match(mini,/musicButton\.classList\.toggle\("is-muted", cinema\.mute\)/);
  assert.match(warp,/playExclusive\(warpAudio, "warp"\)/);
  assert.match(tower,/playExclusive\(audio, "tower"\)/);
  assert.doesNotMatch(tower,/transitionStarted = true;\s*playTowerAudio\(\)/);
});
test("Vertical movement uses the ship's current local up axis and gamepad turning is faster",async()=>{
  const s=await read("mini-sim/assets/js/mini-sim.js");
  assert.match(s,/inn\.vertical \* ship\.verticalThrust,[\s\S]*?-inn\.thrust \* ship\.thrust[\s\S]*?\.applyQuaternion\(ship\.quaternion\)/);
  assert.match(s,/pad\.rx \* \(settings\.invertYaw \? 1 : -1\) \* 4\.4 \* dt/);
  assert.match(s,/pad\.ry \* psign \* 4\.2 \* dt/);
});
test("Back reset neither stops OST nor unloads loaded sources",async()=>{
  const s=await read("mini-sim/assets/js/mini-sim.js"),a=s.indexOf("function resetCurrentRoom"),b=s.indexOf("function finishTeleport",a);
  assert.ok(a>=0&&b>a);const reset=s.slice(a,b);
  assert.doesNotMatch(reset,/stopMiniSimAudio|pauseAllCinemaVideos|removeAttribute\(["']src/);
  assert.match(s,/if \(!keepLoadedMedia && item\.loaded/);
  assert.match(s,/edge\(8, resetCurrentRoom\)/);
  assert.match(s,/if \(e\.code === "Backspace"\)[\s\S]*?resetCurrentRoom\(\)/);
});
test("wall textures are stable and limited to four",async()=>{
  const s=await read("mini-sim/assets/js/mini-sim.js");
  assert.match(s,/const urls = allUrls\.slice\(0, 4\)/);
  assert.doesNotMatch(s,/updateBacksideCamouflage\(now\)/);
  assert.doesNotMatch(s,/function randomizeBackside\(now\)/);
});
test("Mini-Sim and Tower expose controller navigation",async()=>{
  const mini=await read("mini-sim/assets/js/mini-sim.js"),tower=await read("mini-sim/tower/assets/js/tower.js");
  const css=await read("mini-sim/assets/css/mini-sim.css"),tcss=await read("mini-sim/tower/assets/css/tower.css");
  assert.match(mini,/function pollGamepadMenu\(\)/);assert.match(css,/\.bcm-gamepad-focused/);
  assert.match(tower,/function focusTowerMode\(index\)/);assert.match(tower,/const up=button\(12\)/);
  assert.match(tcss,/button\.bcm-gamepad-focused/);
});
test("Playwright runner overrides plugin files from local checkout",async()=>{
  const s=await read("scripts/minisim-local-qa.mjs");
  assert.match(s,/import \{ mkdir, readFile, stat, writeFile \}/);
  assert.match(s,/createRequire/);
  assert.match(s,/wp-content\/plugins\/mini-sim/);
  assert.match(s,/05-after-cancel\.png/);
  const qaPackage=JSON.parse(await read("tools/minisim-qa/package.json"));
  assert.ok(qaPackage.devDependencies.playwright);
});
