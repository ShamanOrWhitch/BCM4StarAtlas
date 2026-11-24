// Owner 24.11.2026: "чувствительность в Tower на gamepad зашкаливает… информация по управлению, буквы
// забивают экран, достаточно дать время рассказать по управлению, не надо постоянно". The Tower stick is
// analog with a dead zone and a squared curve; the control line fades after a few seconds.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const tower = readFileSync(new URL("../mini-sim/tower/assets/js/tower.js", import.meta.url), "utf8");
const towerPhp = readFileSync(new URL("../mini-sim/tower/bcm-tower.php", import.meta.url), "utf8");

test("the Tower stick dead zone is shared by analog and digital movement", () => {
  const start = tower.indexOf("const TOWER_STICK_DEAD_ZONE");
  const end = tower.indexOf("function flashControlHelp(");
  assert.ok(start >= 0 && end > start, "the shared dead-zone curve is missing");
  const src = tower.slice(start, end);
  const curve = new Function(src + "; return towerStickCurve;")();

  assert.equal(curve(0), 0);
  assert.equal(curve(0.16), 0, "the old digital threshold must not cause full-speed motion");
  assert.equal(curve(0.21), 0);
  assert.equal(curve(0.22), 0, "the dead-zone boundary must remain still");
  assert.ok(curve(0.4) > 0 && curve(0.4) < 0.1, `a light push turns at ${curve(0.4).toFixed(2)}`);
  assert.equal(curve(1), 1);
  assert.equal(curve(-1), -1);

  assert.match(towerPhp, /define\('BCM_TOWER_VERSION', '0\.2\.91'\)/, "Tower assets must invalidate the old 0.2.90 cache");
  assert.match(tower, /const dead = TOWER_STICK_DEAD_ZONE;/, "digital directions use a different dead zone");
  assert.match(tower, /controls\[i\]\.left = lx < -dead;\s*controls\[i\]\.right = lx > dead;\s*controls\[i\]\.up = ly < -dead;\s*controls\[i\]\.down = ly > dead;/);
  assert.doesNotMatch(tower, /const dead = 0\.16;/, "stale 0.16 digital threshold remains");
  assert.match(tower, /if \(c\.gamepad && Number\.isFinite\(c\.stickX\)/, "the physics ignores the analog stick");
  assert.match(tower, /const manualInputScale = c\.gamepad \? 0\.78 : 0\.84;/);
});

test("the control line shows for a few seconds and fades", () => {
  assert.match(tower, /function flashControlHelp\(el\)[\s\S]{0,300}setTimeout\(\(\) => \{ el\.style\.opacity = "0"; \}, 6000\)/);
  assert.match(tower, /gamepadHelp\.textContent = gamepadLine;\s*flashControlHelp\(gamepadHelp\);/);
});
