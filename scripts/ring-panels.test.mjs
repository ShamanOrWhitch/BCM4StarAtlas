// Owner 19-20.11.2026: Ring cells are comic panels; "у нас строится случайный
// уровень, и это хорошо… главное проходимость, перестройки всегда хорошо для
// реиграбельности". Stage A.1 (mini-sim/RING_REDESIGN.md): a panel is a grid of
// blocks (18 x 6) assembled from 6 x 4 chunks — bunker, stairs, spike pit, cage,
// barrels, ledges — mirrored by the seed; every panel can be crossed door to door
// with the Ring jump; a new Ring entry rebuilds the panels.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import vm from "node:vm";

const ROOT = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");
const FILE = "mini-sim/assets/js/ring-panels.js";

function api() {
  assert.ok(existsSync(new URL(FILE, ROOT)), "no panel generator");
  const c = vm.createContext({ Math, Number, Array, Object, JSON, String });
  c.window = c;
  vm.runInContext(read(FILE), c);
  return c.BCMRingPanels;
}

const CELL = (x, y, z) => ({ x, y, z, open: { xn: true, xp: true } });
const SOLID = new Set(["B", "M", "C", "R"]);

/**
 * Door-to-door crossing with the Ring jump, checked independently of the
 * generator: walk, fall, jump up one block, jump across up to 4 open columns
 * (2 when climbing). The body is 2 cells tall; floor spikes cannot be stood on.
 */
function crossable(p) {
  const W = p.cols, H = p.rows;
  const at = (c, r) => (r < 0 || r >= H || c < 0 || c >= W ? "." : p.grid[H - 1 - r][c]);
  const solid = (c, r) => (r < 0 ? true : SOLID.has(at(c, r)));
  // Traps never carry the crossing: crumbling plates (K) are not ground, timed spikes (T) are spikes.
  const stand = (c, h) => c >= 0 && c < W && h >= 0 && h <= H - 2 && solid(c, h - 1) && !solid(c, h) && !solid(c, h + 1) && !(h === 0 && (at(c, 0) === "S" || at(c, 0) === "T"));
  const seen = new Set();
  const queue = [[0, 0]];
  if (!stand(0, 0)) return false;
  seen.add("0,0");
  while (queue.length) {
    const [c, h] = queue.shift();
    if (c === W - 1 && h === 0) return true;
    const push = (nc, nh) => {
      const k = nc + "," + nh;
      if (!seen.has(k) && stand(nc, nh)) { seen.add(k); queue.push([nc, nh]); }
    };
    for (const d of [-1, 1]) {
      push(c + d, h);
      for (let nh = h - 1; nh >= 0; nh -= 1) {
        let clear = true;
        for (let r = nh; r <= h + 1; r += 1) if (solid(c + d, r)) clear = false;
        if (clear) push(c + d, nh);
        if (!clear) break;
      }
      for (let dist = 1; dist <= 4; dist += 1) {
        let open = true;
        for (let k = 1; k < dist; k += 1) if (solid(c + d * k, h + 1) || solid(c + d * k, h + 2)) open = false;
        if (!open || h + 3 > H) break;
        for (let nh = 0; nh <= h + (dist <= 2 ? 1 : 0); nh += 1) push(c + d * dist, nh);
      }
    }
  }
  return false;
}

test("a panel is a block grid from seeded chunks, and a new Ring entry rebuilds it", () => {
  const panels = api();
  const names = new Set();
  for (let i = 0; i < 40; i += 1) {
    const cell = CELL(i % 7, i % 3, Math.floor(i / 7));
    const p = panels.buildPanel(1234, cell, { half: 9, height: 6 });
    assert.equal(p.cols, 18);
    assert.equal(p.rows, 6);
    assert.equal(p.grid.length, 6);
    p.chunks.forEach((n) => names.add(n));
    for (const row of p.grid.slice(0, 2)) assert.ok(!/[BMCR]/.test(row), "blocks above row 4 leave no headroom");
    for (const r of [0, 1]) {
      assert.equal(p.grid[5 - r][0], ".", "the left door is blocked");
      assert.equal(p.grid[5 - r][17], ".", "the right door is blocked");
    }
    assert.equal(JSON.stringify(panels.buildPanel(1234, cell, { half: 9, height: 6 })), JSON.stringify(p), "the same seed must give the same panel");
  }
  assert.ok(names.size >= 5, `only ${names.size} chunk kinds: ${[...names].join(", ")}`);
  let rebuilt = 0;
  for (let i = 0; i < 10; i += 1) {
    const cell = CELL(i, 1, 2);
    const a = panels.buildPanel(77, cell, { half: 9, height: 6, run: 1 });
    const b = panels.buildPanel(77, cell, { half: 9, height: 6, run: 2 });
    if (JSON.stringify(a.grid) !== JSON.stringify(b.grid)) rebuilt += 1;
  }
  assert.ok(rebuilt >= 8, `a new run rebuilt only ${rebuilt}/10 cells`);
});

test("every panel can be crossed door to door; the carved fallback is rare", () => {
  const panels = api();
  let carved = 0, total = 0;
  for (let seed = 1; seed <= 25; seed += 1) {
    for (let i = 0; i < 12; i += 1) {
      for (const run of [0, 1, 2]) {
        const p = panels.buildPanel(seed * 7919, CELL(i, i % 3, seed % 5), { half: 9, height: 6, run });
        total += 1;
        if (p.carved) carved += 1;
        assert.ok(crossable(p), `seed ${seed} cell ${i} run ${run}: ${p.chunks.join("+")} cannot be crossed\n${p.grid.join("\n")}`);
      }
    }
  }
  assert.ok(carved / total < 0.1, `fallback carving used in ${carved}/${total} panels`);
});

test("the panel surfaces and spikes follow the grid", () => {
  const panels = api();
  const p = panels.buildPanel(5, CELL(1, 1, 1), { half: 9, height: 6 });
  for (const s of p.platforms) assert.ok(Number.isInteger(s.y) && s.y >= 1 && s.y <= 4 && s.maxX > s.minX);
  for (const s of p.spikes) assert.ok(s.minX >= -9 && s.maxX <= 9);
});

test("the Ring cell builds the block grid, and blocks stop the pilot from the side", () => {
  const warp = read("mini-sim/assets/js/deep-space-warp.js") + "\n" + read("mini-sim/assets/js/ring-platformer.js");
  assert.match(warp, /const ROOM_HALF = 9;/);
  assert.match(warp, /BCMRingPanels\.buildPanel\([^)]*run/, "a new Ring entry does not rebuild the panels");
  assert.match(warp, /cellPanel: true/);
  assert.match(warp, /ring-cell-blocks/, "the block grid is never drawn");
  assert.match(warp, /path\.solidAt\(/, "blocks do not stop the pilot from the side");
  assert.match(warp, /onSpikes/);
  assert.match(read("mini-sim/bcm-mini-sim.php"), /'bcm-ring-panels'[\s\S]{0,120}ring-panels\.js/);
});

test("Ring panels have traps: crumbling plates and timed spikes", () => {
  const panels = api();
  let plates = 0, timed = 0;
  for (let i = 0; i < 120; i += 1) {
    const p = panels.buildPanel(4242, CELL(i % 7, i % 3, Math.floor(i / 21)), { half: 9, height: 6, run: i });
    const all = p.grid.join("");
    if (all.includes("K")) plates += 1;
    if (all.includes("T")) timed += 1;
    for (const t of p.traps || []) assert.ok(["crumble", "timed"].includes(t.kind));
  }
  assert.ok(plates >= 10, `crumbling plates in only ${plates}/120 panels`);
  assert.ok(timed >= 10, `timed spikes in only ${timed}/120 panels`);
});

test("the pilot grabs a ledge, hangs and climbs; plates crumble, spikes rise on a timer", () => {
  const warp = read("mini-sim/assets/js/deep-space-warp.js") + "\n" + read("mini-sim/assets/js/ring-platformer.js");
  assert.match(warp, /ledgeAt\(/, "no ledge grab: a block two high is a wall");
  assert.match(warp, /player\.hang/, "the pilot never hangs on a ledge");
  assert.match(warp, /crumble/, "crumbling plates never fall");
  assert.match(warp, /timedSpikes/, "timed spikes never rise");
});

// Owner 20.11.2026: "разработку движений и анимаций всю переместить в crew core".
// The ledge grab is a Crew motion: crew-core.js owns it, the Ring only asks.
test("crew-core owns the ledge grab: grab in the air, hang, climb with a jump, drop away", () => {
  const window = {};
  const context = vm.createContext({ window, console, Math, Number, String, Array, Map, Set, Promise, Error, Object, JSON, performance: { now: () => 0 } });
  window.globalThis = window;
  vm.runInContext(read("mini-sim/assets/js/crew-rig.js"), context);
  window.BCMCrewRig = context.BCMCrewRig;
  vm.runInContext(read("mini-sim/assets/js/crew-core.js"), context);
  const core = window.BCMCrewCore;
  assert.equal(typeof core.crewLedgeStep, "function", "crew-core has no ledge grab");
  // A block column at x 3..4 with its top at y 2; the pilot jumps at it from the left.
  const ledgeAt = (x, footY) => (x >= 3 && x < 4 && 2 >= footY + 0.9 && 2 <= footY + 2.2 ? { top: 2, edgeX: 3 } : null);
  const air = { x: 2.6, y: 0.6, vy: -0.4, facing: 1, grounded: false, hang: null };
  const grab = core.crewLedgeStep(air, { jumpEdge: false, dir: 1 }, ledgeAt);
  assert.ok(grab && grab.hang, "the pilot falls past the ledge instead of grabbing it");
  assert.ok(Math.abs(grab.y - (2 - 1.62)) < 0.01 && grab.x < 3);
  const hold = core.crewLedgeStep({ ...air, ...grab }, { jumpEdge: false, dir: 0 }, ledgeAt);
  assert.ok(hold.hang && hold.vy === 0, "the pilot does not hold on");
  const climb = core.crewLedgeStep({ ...air, ...grab }, { jumpEdge: true, dir: 0 }, ledgeAt);
  assert.ok(!climb.hang && climb.grounded && climb.y === 2 && climb.x > 3, "a jump does not climb onto the ledge");
  const drop = core.crewLedgeStep({ ...air, ...grab }, { jumpEdge: false, dir: -1 }, ledgeAt);
  assert.ok(!drop.hang && !drop.grounded, "stepping away does not let go");
  assert.equal(core.crewLedgeStep({ ...air, grounded: true }, { dir: 1 }, ledgeAt), null, "a grounded pilot grabs");
  const pose = core.crewSpritePose({ facing: 1, hanging: true, grounded: false, vy: 0 }, 0.016, {});
  assert.equal(pose.hanging, true, "the sprite has no hanging pose");
  const warp = read("mini-sim/assets/js/deep-space-warp.js") + "\n" + read("mini-sim/assets/js/ring-platformer.js");
  assert.match(warp, /BCMCrewCore\.crewLedgeStep\(/, "the Ring keeps its own ledge code instead of crew-core");
});
