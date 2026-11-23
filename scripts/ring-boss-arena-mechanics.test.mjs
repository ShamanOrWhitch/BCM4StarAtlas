// Owner 23.11.2026: "передняя платформа вечно загораживает глаза моба, кроме того они
// бесполезны, потому что до них нельзя допрыгнуть. Прорабатывай атаки и механики боссов".
// 1. Arena ledges: two tiers a pilot can reach (floor → 1.4 m → 2.8 m), drawn behind the boss.
// 2. The Brawler's plasma cannon (owner video): a charge marks a band at the pilot's
//    height, the shot crosses the arena; the answer is to change tier. Then it laughs and
//    sits down to drink (owner video) — the open window. Both videos as a comic inset.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ROOT = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");
const ring = read("mini-sim/assets/js/ring-platformer.js");
const JUMP_PEAK = (8.8 * 8.8) / (2 * 21); // 1.84 m, Ring jump on the arena floor
const PILOT = 1.7;

function arenaLedges() {
  const m = ring.match(/addPlatform\(-51, 84, 0, 0x142936\);[^[]*\[([\s\S]*?)\]\.forEach\(\(ledge, i\) => addPlatform/);
  assert.ok(m, "arena ledge list not found");
  return [...m[1].matchAll(/\[(-?[\d.]+), (-?[\d.]+), ([\d.]+)\]/g)].map((x) => ({ x0: +x[1], x1: +x[2], y: +x[3] }));
}

test("every arena ledge can be reached: from the floor or from a lower ledge next to it", () => {
  const ledges = arenaLedges();
  assert.ok(ledges.length >= 8);
  for (const l of ledges) {
    const fromFloor = l.y <= JUMP_PEAK - 0.25;
    const fromLedge = ledges.some((o) => o !== l && o.y < l.y && l.y - o.y <= JUMP_PEAK - 0.25 &&
      o.x1 >= l.x0 - 2.5 && o.x0 <= l.x1 + 2.5);
    assert.ok(fromFloor || fromLedge, `ledge ${l.x0}..${l.x1} at ${l.y} m cannot be reached (jump peak ${JUMP_PEAK.toFixed(2)} m)`);
  }
  assert.ok(ledges.some((l) => l.y > 2), "only one tier: nothing to climb to");
});

test("arena ledges are drawn behind the boss, not over its face", () => {
  const z = ring.match(/const LEDGE_Z = (-?[\d.]+), LEDGE_DEPTH = ([\d.]+);/);
  assert.ok(z, "ledges are 3.8 m boxes centred on the stage: their front face covers the boss");
  const front = Number(z[1]) + Number(z[2]) / 2;
  assert.ok(front < 0, `ledge front face at z ${front}, the boss stands at z 0.1`);
});

function moves() {
  const c = vm.createContext({ Math, Number, Array, Object, JSON, String });
  c.window = c;
  vm.runInContext(read("mini-sim/assets/js/ring-boss-moves.js"), c);
  return c.BCMRingBossMoves;
}

function playBrawler(targetY, seconds = 40) {
  const boss = moves().create(4, { homeX: 18, seed: 3 });
  const frames = [];
  for (let i = 0; i < seconds * 60; i += 1) frames.push(JSON.parse(JSON.stringify(boss.step(1 / 60, { targetX: 13, targetY }))));
  return frames;
}

test("the Brawler fires its plasma cannon after a long charge; the band can be left by changing tier", () => {
  for (const targetY of [0, 1.4]) {
    const frames = playBrawler(targetY);
    const fires = frames.filter((f) => f.hazards.some((h) => h.kind === "beam"));
    assert.ok(fires.length > 0, `the Brawler never fires its cannon at a pilot at ${targetY} m`);
    for (let i = 1; i < frames.length; i += 1) {
      const beam = frames[i].hazards.find((h) => h.kind === "beam");
      if (!beam || frames[i - 1].hazards.some((h) => h.kind === "beam")) continue;
      let told = 0;
      for (let k = i - 1; k >= 0 && frames[k].tell && frames[k].tell.kind === "beam"; k -= 1) told += 1;
      assert.ok(told / 60 >= 1.5, `cannon fires after ${(told / 60).toFixed(2)} s of charge`);
      assert.ok(beam.x1 - beam.x0 > 16, "the shot does not cross the arena");
      // Standing at the marked height is hit; one tier up or down is clear.
      const hits = (feet) => feet + PILOT > beam.y0 && feet < beam.y1;
      assert.ok(hits(targetY), "the band misses the pilot it marked");
      const other = targetY < 1 ? 1.4 : 0;
      assert.ok(!hits(other), `a pilot at ${other} m is hit too: changing tier does not help`);
    }
  }
});

// Owner 23.11.2026: "фаза где он пьёт с банки … когда восстанавливается после атаки, в это
// время щиты его защищают и атаковать бесполезно". The laugh after it is the window.
test("after the shot the Brawler drinks under its shield, then laughs: the laugh is the window", () => {
  const frames = playBrawler(1.4);
  const states = new Set(frames.map((f) => f.state));
  for (const s of ["charge", "fire", "drink", "taunt"]) assert.ok(states.has(s), `the Brawler never plays ${s}`);
  const order = frames.map((f) => f.state).filter((s, i, a) => s !== a[i - 1]).join(",");
  assert.match(order, /charge,fire,recover,drink,taunt/, "the cannon cycle is not charge → fire → recover → drink → laugh");
  const drink = frames.filter((f) => f.state === "drink");
  assert.ok(drink.every((f) => f.shielded && !f.vulnerable), "the Brawler is open while it drinks");
  assert.ok(frames.filter((f) => f.state === "taunt").every((f) => f.vulnerable), "the laugh is not the open window");
  const boss = moves().create(4, { homeX: 18, seed: 3 });
  for (let i = 0; i < 60 * 40; i += 1) {
    const out = boss.step(1 / 60, { targetX: 13, targetY: 1.4 });
    if (out.state === "drink") {
      assert.equal(boss.canBeHit(out.x - out.facing * 3), false, "a shot in the back passes the drinking shield");
      assert.equal(boss.canBeHit(out.x + out.facing * 3), false);
    }
  }
  const ground = playBrawler(0, 40).filter((f) => f.state === "charge").length;
  const ledge = frames.filter((f) => f.state === "charge").length;
  assert.ok(ledge > ground, "the cannon is not the answer to a pilot hiding up on a ledge");
});

test("the Ring shows the Brawler's videos as a comic inset and draws the cannon band", () => {
  assert.match(ring, /brawler-attack-cannon\.mp4/, "the cannon video is not used");
  assert.match(ring, /drink: \["brawler-drink\.mp4", 0\]/, "the owner's drink clip is not on the drink");
  assert.match(ring, /taunt: \["brawler-laugh\.mp4", 0\]/, "the owner's laugh clip is not on the laugh");
  assert.match(ring, /ring-boss-shield/, "the drinking shield is not drawn");
  assert.match(ring, /bcm-ring-boss-comic/, "no comic inset for the boss videos");
  assert.match(ring, /comicVideo\.muted = true/, "the inset video may play sound (AUDIO FREEZE)");
  assert.match(ring, /z\.kind === "beam"/, "the cannon band is not drawn");
});

test("form art is drawn upright: the GLB v axis grows upwards, so the map is flipped once", () => {
  // Before: the Brawler hung upside down (owner screenshot); every form GLB has corr(y, v) = +1
  // while GLTFLoader keeps flipY off.
  assert.match(ring, /material\.map\.repeat\.set\(1, -1\)/, "the form art is left upside down");
  assert.match(ring, /material\.map\.offset\.set\(0, 1\)/);
  assert.doesNotMatch(ring, /map\.userData\.bcmUprightArt/, "three r128 textures have no userData: the model load throws");
  assert.match(ring, /bcmUprightArt/, "the flip is not guarded: a shared map could flip twice");
});
