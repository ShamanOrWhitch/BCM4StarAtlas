// Owner 23.11.2026: "Fable был фиолетовым миром и я не вижу его"; Twinsun "не поменялся";
// no touch pad on the phone. The First Planet bundle URL carried only the Tower version
// (?ver=0.2.90, unchanged since 0.15.36), so browsers and WordPress caches kept serving the
// old first-planet.js after every rebuild. The version must change with the bundle itself.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const php = readFileSync(new URL("../mini-sim/tower/bcm-tower.php", import.meta.url), "utf8");

test("the First Planet bundle, style and loader URLs change with the built files", () => {
  assert.doesNotMatch(php, /first-planet\.js\?ver=' \. BCM_TOWER_VERSION/, "the bundle is versioned by the Tower only: caches keep the old bundle");
  assert.doesNotMatch(php, /first-planet\.css\?ver=' \. BCM_TOWER_VERSION/, "the style is versioned by the Tower only");
  assert.match(php, /function bcm_tower_file_version\(/, "no per-file version");
  assert.match(php, /filemtime\(/, "the version does not follow the file");
  assert.match(php, /'bundleUrl' => [^\n]*bcm_tower_file_version\('first-planet\/wp-dist\/first-planet\.js'\)/);
  assert.match(php, /'styleUrl' => [^\n]*bcm_tower_file_version\('first-planet\/wp-dist\/first-planet\.css'\)/);
  assert.match(php, /first-planet\/loader\.js',\s*array\('bcm-tower'\),\s*bcm_tower_file_version\('first-planet\/loader\.js'\)/);
});
