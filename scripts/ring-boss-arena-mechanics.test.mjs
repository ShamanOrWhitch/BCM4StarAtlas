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

// Owner 23.11.2026: "это сам свин боец должен так атаковать, он большой, а игрок между
// платформами прыгает и убегает от выстрела". The cannon is a volley of three plasma balls
// that fly across the arena; each is aimed at the tier the pilot is on when its aim starts,
// so the pilot jumps floor ↔ 1.4 m ↔ 2.8 m to get out of the line.
const TIERS = [0, 1.4, 2.8];
const hitsBody = (feet, h) => feet + PILOT > h.y0 && feet < h.y1;

test("the Brawler fires a volley of three plasma balls, each aimed at the pilot's tier after a tell", () => {
  for (const targetY of TIERS) {
    const frames = playBrawler(targetY);
    const launches = [];
    for (let i = 1; i < frames.length; i += 1) {
      const now = frames[i].hazards.filter((h) => h.kind === "plasma").length;
      const before = frames[i - 1].hazards.filter((h) => h.kind === "plasma").length;
      if (now > before) launches.push(i);
    }
    assert.ok(launches.length >= 3, `only ${launches.length} plasma balls at a pilot on ${targetY} m`);
    for (const i of launches) {
      let told = 0, band = null;
      for (let k = i - 1; k >= 0 && frames[k].tell && frames[k].tell.kind === "aim"; k -= 1) { told += 1; band = frames[k].tell; }
      assert.ok(told / 60 >= 0.6, `a ball flies after ${(told / 60).toFixed(2)} s of aim`);
      const ball = frames[i].hazards.filter((h) => h.kind === "plasma").at(-1);
      assert.ok(Math.abs(ball.y0 - band.y0) < 1e-6 && Math.abs(ball.y1 - band.y1) < 1e-6, "the ball flies off the line it marked");
      assert.ok(hitsBody(targetY, ball), "the ball misses the tier it aimed at");
      for (const other of TIERS) if (other !== targetY) assert.ok(!hitsBody(other, ball), `a pilot on ${other} m is hit by a ball aimed at ${targetY} m`);
    }
    // The balls really fly: across most of the arena, at a speed a jump can beat.
    const first = launches[0];
    const xs = [];
    for (let k = first; k < Math.min(frames.length, first + 120); k += 1) {
      const b = frames[k].hazards.find((h) => h.kind === "plasma");
      if (b) xs.push((b.x0 + b.x1) / 2);
    }
    const travel = Math.max(...xs) - Math.min(...xs);
    assert.ok(travel > 12, `a ball travels only ${travel.toFixed(1)} m`);
  }
});

test("each ball of the volley re-aims: a pilot who changed tier is aimed at again", () => {
  // The pilot hops up one tier at every launch; the next aim must follow it.
  const boss = moves().create(4, { homeX: 18, seed: 3 });
  let tier = 0, lastBalls = 0;
  const aims = [];
  for (let i = 0; i < 60 * 40; i += 1) {
    const out = boss.step(1 / 60, { targetX: 13, targetY: TIERS[tier] });
    const balls = out.hazards.filter((h) => h.kind === "plasma").length;
    if (balls > lastBalls) tier = (tier + 1) % 3;
    lastBalls = balls;
    if (out.tell && out.tell.kind === "aim" && (!aims.length || aims.at(-1).y0 !== out.tell.y0)) aims.push(out.tell);
  }
  const bands = new Set(aims.map((a) => a.y0.toFixed(2)));
  assert.ok(bands.size >= 2, "every ball of the volley flies at the same height: no reason to jump");
});

// Owner 23.11.2026: "фаза где он пьёт с банки … когда восстанавливается после атаки, в это
// время щиты его защищают и атаковать бесполезно". The laugh after it is the window.
test("after the volley the Brawler drinks under its shield, then laughs: the laugh is the window", () => {
  const frames = playBrawler(1.4);
  const order = frames.map((f) => f.state).filter((s, i, a) => s !== a[i - 1]).join(",");
  assert.match(order, /charge,fire,aim,fire,aim,fire,recover,drink,taunt/, "the cannon cycle is not charge → 3 shots → recover → drink → laugh");
  assert.ok(frames.filter((f) => f.state === "drink").every((f) => f.shielded && !f.vulnerable), "the Brawler is open while it drinks");
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

test("the Ring plays the volley in the arena itself: charge glow, aim line, flying balls, body poses; no comic panel", () => {
  assert.match(ring, /ring-boss-charge/, "no charge glow at the Brawler's hand");
  assert.match(ring, /ring-boss-aim/, "no aim line along the tier");
  assert.match(ring, /ring-boss-plasma/, "the plasma balls are not drawn");
  assert.match(ring, /function brawlerPose\(/, "the Brawler does not move its body for charge, recoil, drink and laugh");
  assert.match(ring, /ring-boss-shield/, "the drinking shield is not drawn");
  assert.doesNotMatch(ring, /BOSS_COMIC_BY_STATE\[out\.state\]/, "the Brawler's attack still plays in a comic panel");
});


test("form art is drawn upright: the GLB v axis grows upwards, so the map is flipped once", () => {
  // Before: the Brawler hung upside down (owner screenshot); every form GLB has corr(y, v) = +1
  // while GLTFLoader keeps flipY off.
  assert.match(ring, /material\.map\.repeat\.set\(1, -1\)/, "the form art is left upside down");
  assert.match(ring, /material\.map\.offset\.set\(0, 1\)/);
  assert.doesNotMatch(ring, /map\.userData\.bcmUprightArt/, "three r128 textures have no userData: the model load throws");
  assert.match(ring, /bcmUprightArt/, "the flip is not guarded: a shared map could flip twice");
});

// Owner 23.11.2026: "Боса свина Бойца сделай больше в 2.2 раза".
test("the Brawler is 2.2 times bigger, every form stands on the floor, its fist misses the high ledge", () => {
  assert.match(ring, /const RING_BOSS_FORM_SCALE = \{ 3: 2\.2 \};/, "the Brawler keeps its old size");
  assert.match(ring, /phaseGroup\.userData\.bcmGroundY = \(size\.y \/ 2\) \* formScale;/, "forms hang at a fixed 2.1 m instead of standing on the floor");
  const boss = moves().create(4, { homeX: 18, seed: 3 });
  let fists = 0;
  for (let i = 0; i < 60 * 30; i += 1) {
    const out = boss.step(1 / 60, { targetX: 13, targetY: 0 });
    for (const h of out.hazards) if (h.kind === "fist") {
      fists += 1;
      assert.ok(h.y1 > 1.4 + 0.3 && h.y1 <= 2.8, `fist up to ${h.y1} m: the ledges do not matter`);
      assert.ok(Math.abs(h.x1 - h.x0) >= 3, "the big Brawler's fist is still a small one");
    }
  }
  assert.ok(fists > 0, "the Brawler never punches");
});

test("in a form fight the camera keeps the boss in the frame: toward the middle, pulled back", () => {
  // Edge probe 23.11.2026: the Brawler fired from the far wall 14 m away and was off screen.
  assert.match(ring, /player\.bossFrameX = \(player\.worldX \+ framedBoss\.x\) \/ 2/, "the camera stays on the pilot only");
  assert.match(ring, /zoom: 1 \+ 0\.18 \* boss/, "the camera does not pull back for a form fight");
  assert.match(ring, /\* \(Number\(center\.zoom\) \|\| 1\)/, "the zoom never reaches the view size");
});
