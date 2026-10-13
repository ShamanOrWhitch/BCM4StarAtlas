import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const tower = await readFile(new URL("../mini-sim/tower/assets/js/tower.js", import.meta.url), "utf8");

test("H1 top cap is lifted above the cylinder rim without changing the wall or bottom cap", () => {
  assert.match(tower, /topCap\.position\.y = towerTopY \+ 0\.2/);
  assert.match(tower, /const towerTopY = 6/);
  assert.match(tower, /wallMesh\.position\.y = \(towerBottomY \+ towerTopY\) \* 0\.5/);
  assert.match(tower, /bottomCap\.position\.y = towerBottomY/);
});
