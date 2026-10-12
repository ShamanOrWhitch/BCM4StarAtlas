import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read=(path)=>readFile(new URL("../"+path,import.meta.url),"utf8");

test("Warp OST belongs to the whole Warp stage",async()=>{
  const s=await read("mini-sim/assets/js/deep-space-warp.js");
  assert.match(s,/warpAudio\.loop = false/);
  assert.match(s,/pauseLevelOst\(\);\s*startWarpAudio\(true\);\s*state\.nav = readNavigation\(\)/);
  const tube=s.slice(s.indexOf("function showTube()"),s.indexOf("function finishTube"));
  assert.doesNotMatch(tube,/startWarpAudio/);
  assert.match(s,/function enterAsteroidMaze\(\) \{\s*\/\/ Warp OST owns the whole Warp stage/);
});
test("Tube has forward road, floor panels, gates and controller steering",async()=>{
  const s=await read("mini-sim/assets/js/deep-space-warp.js");
  assert.match(s,/function roadY\(d\)/);
  assert.match(s,/Continuous floor panels and centre dashes/);
  assert.match(s,/Barrier gates leave visible passages/);
  assert.match(s,/navigator\.getGamepads\?navigator\.getGamepads\(\):\[\]/);
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
  assert.match(s,/wp-content\/plugins\/mini-sim/);
  assert.match(s,/05-after-cancel\.png/);
});
