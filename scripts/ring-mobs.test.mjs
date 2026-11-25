// Owner 24.11.2026 (BUG-028): "мобы не проработаны". The Ring cells held 0.7 x 0.9 m boxes that all
// walked the same way (browser probe scripts/ring-mobs-probe.mjs before: 25 mobs, 25 boxes, no art,
// one gait). Now the owner's nine pig mobs (art/ring-bosses/pig-mobs-sheet.png -> assets/ring-bosses/
// mobs.webp), each kind with its own gait and toughness (ring-mobs.js), drawn by ring-platformer.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import vm from "node:vm";

const ROOT = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");

function mobs() {
  assert.ok(existsSync(new URL("mini-sim/assets/js/ring-mobs.js", ROOT)), "the Ring cells still hold boxes: no mob kinds");
  const c = vm.createContext({ Math, Number, Array, Object, JSON, String });
  c.window = c;
  vm.runInContext(read("mini-sim/assets/js/ring-mobs.js"), c);
  return c.BCMRingMobs;
}

function run(M, kind, opts, input, seconds = 12) {
  const mob = M.create(kind, { offset: -2, dir: 1, limit: 2.15, chargeLimit: 6.5, ...opts });
  const frames = [];
  for (let i = 0; i < seconds * 60; i += 1) frames.push(JSON.parse(JSON.stringify(mob.step(1 / 60, typeof input === "function" ? input(i) : input))));
  return { mob, frames };
}

test("nine kinds from the owner's sheet, each with its own picture in the atlas", () => {
  const M = mobs();
  assert.deepEqual([...M.KINDS], ["base", "spiky", "ice", "toxic", "drill", "tank", "spider", "angel", "amethyst"]);
  assert.equal(M.ART.length, 9);
  for (const r of M.ART) assert.ok(r[2] > r[0] && r[3] > r[1] && r[0] >= 0 && r[3] <= 1, "an atlas window is off the picture");
  const atlas = new URL("mini-sim/assets/ring-bosses/mobs.webp", ROOT);
  assert.ok(existsSync(atlas) && statSync(atlas).size < 400000, "the mob atlas is missing or heavy");
  const head = readFileSync(atlas).subarray(0, 30);
  assert.equal(head.toString("ascii", 8, 12), "WEBP");
  assert.equal(head.toString("ascii", 12, 16), "VP8X", "the atlas has no alpha (not an extended WebP)");
  assert.equal(head.readUIntLE(24, 3) + 1, 1024, "the atlas is not 1024 px wide");
});

test("each kind moves its own way", () => {
  const M = mobs();
  const idle = { near: false };
  const floor = (fr) => fr.every((f) => Math.abs(f.y) < 0.06);
  assert.ok(floor(run(M, "base", {}, idle).frames), "the base pig leaves the floor");
  // The angel flies in waves.
  const angel = run(M, "angel", {}, idle).frames.map((f) => f.y);
  assert.ok(Math.min(...angel) > 0.2 && Math.max(...angel) - Math.min(...angel) > 1.2, "the angel does not fly");
  // The spider hangs under the ceiling out of harm's way, drops on a pilot below and climbs back.
  const spider = run(M, "spider", {}, (i) => (i > 120 ? { near: true, targetOffset: 0, targetY: 0 } : idle)).frames;
  assert.ok(spider.slice(0, 100).every((f) => f.y > 3 && !f.hurts), "the spider does not hang harmless under the ceiling");
  assert.ok(spider.some((f) => f.state === "ground" && f.y === 0 && f.hurts), "the spider never drops on the pilot");
  assert.ok(spider.some((f) => f.state === "climb"), "the spider does not climb back");
  // The drill revs (the tell) when the pilot is ahead, then charges past its patrol and sticks.
  const drill = run(M, "drill", {}, { near: true, targetOffset: 3, targetY: 0 }).frames;
  const firstRev = drill.findIndex((f) => f.state === "rev");
  const firstCharge = drill.findIndex((f) => f.state === "charge");
  assert.ok(firstRev >= 0 && firstCharge - firstRev >= 30, "the drill charges without a half-second tell");
  assert.ok(Math.max(...drill.map((f) => Math.abs(f.offset))) > 6, "the drill charge stays inside the patrol");
  assert.ok(drill.some((f) => f.state === "stuck"), "the drill does not stick after its charge");
  // The ice pig is the fastest walker and glides past its turn.
  const ice = run(M, "ice", {}, idle).frames.map((f) => f.offset);
  assert.ok(Math.max(...ice) > 2.4, "the ice pig does not glide past the turn");
  const speed = (kind) => { const fr = run(M, kind, {}, idle, 3).frames; return Math.abs(fr[60].offset - fr[30].offset) * 2; };
  assert.ok(speed("tank") < speed("base") && speed("base") < speed("ice"), "the tank, base and ice pigs walk at one speed");
});

test("in a purple cell the walkers float a little and stay there, even while the drill revs", () => {
  const M = mobs();
  for (const kind of ["base", "drill", "tank"]) {
    const fr = run(M, kind, { astral: true }, { near: true, targetOffset: 3, targetY: 0 }, 10).frames;
    const top = Math.max(...fr.map((f) => f.y));
    assert.ok(top < 1.0, `${kind} drifts up to ${top.toFixed(1)} m in a purple cell`);
    assert.ok(Math.min(...fr.map((f) => f.y)) > 0.4, `${kind} does not float in a purple cell`);
  }
});

test("toughness: the tank and amethyst take three hits, the spiky two, the base one", () => {
  const M = mobs();
  const hits = (kind) => { const m = M.create(kind, {}); let n = 1; while (!m.hit()) n += 1; return n; };
  assert.equal(hits("base"), 1);
  assert.equal(hits("spiky"), 2);
  assert.equal(hits("tank"), 3);
  assert.equal(hits("amethyst"), 3);
  const m = M.create("tank", {});
  m.hit();
  assert.ok(m.step(1 / 60, { near: false }).flash > 0, "a hit does not flash the mob");
});

test("the Ring draws the mobs from the atlas, not boxes, and the beam and contact use each mob's box", () => {
  const src = read("mini-sim/assets/js/ring-platformer.js");
  assert.doesNotMatch(src, /const mobGeo = new THREE\.BoxGeometry\(0\.7, 0\.9, 0\.5\)/, "the mobs are still boxes");
  assert.match(src, /ringBossAssetUrl\("ring-bosses\/mobs\.webp"\)/);
  assert.match(src, /window\.BCMRingMobs\.create\(mob\.kind,/);
  assert.match(src, /if \(mob\.ai && !mob\.ai\.hit\(\)\) return;/, "one beam still downs every kind");
  assert.match(src, /mobArt\.byKind\[key\]\.image = loaded\.image;/, "the kinds made before the atlas arrived stay without a picture");
  const php = read("mini-sim/bcm-mini-sim.php");
  assert.match(php, /wp_enqueue_script\('bcm-ring-mobs'/);
  assert.match(php, /'bcm-ring-runner-chase', 'bcm-ring-mobs'\)/, "ring-platformer.js does not wait for ring-mobs.js");
  assert.match(read("tools/minisim-qa/standalone-shell.html"), /ring-mobs\.js/);
});
