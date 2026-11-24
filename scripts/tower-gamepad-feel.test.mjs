// Owner 24.11.2026: "чувствительность в Tower на gamepad зашкаливает… информация по управлению, буквы
// забивают экран, достаточно дать время рассказать по управлению, не надо постоянно". The Tower stick is
// analog with a dead zone and a squared curve; the control line fades after a few seconds.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const tower = readFileSync(new URL("../mini-sim/tower/assets/js/tower.js", import.meta.url), "utf8");

test("the Tower stick is analog: a light push turns slowly, a full push turns fast", () => {
  const src = tower.slice(tower.indexOf("function towerStickCurve("), tower.indexOf("function flashControlHelp("));
  const curve = new Function(src + "; return towerStickCurve;")();
  assert.equal(curve(0.2), 0, "a resting stick turns");
  assert.ok(curve(0.4) < 0.1, `a light push turns at ${curve(0.4).toFixed(2)}`);
  assert.ok(curve(1) === 1 && curve(-1) === -1);
  assert.match(tower, /if \(c\.gamepad && Number\.isFinite\(c\.stickX\)/, "the physics ignores the analog stick");
  assert.match(tower, /const manualInputScale = c\.gamepad \? 0\.78 : 0\.84;/);
});

test("the control line shows for a few seconds and fades", () => {
  assert.match(tower, /function flashControlHelp\(el\)[\s\S]{0,300}setTimeout\(\(\) => \{ el\.style\.opacity = "0"; \}, 6000\)/);
  assert.match(tower, /gamepadHelp\.textContent = gamepadLine;\s*flashControlHelp\(gamepadHelp\);/);
});
