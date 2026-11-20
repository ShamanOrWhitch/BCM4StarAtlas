/*
 * BCMRingPanels — a Ring cell as a comic panel: a small destructible-looking
 * mini-location (owner 19-20.11.2026, IDEA-024, mini-sim/RING_REDESIGN.md).
 *
 * Pure maths, no THREE: deep-space-warp.js draws what this returns.
 *   buildPanel(seed, cell, { half, height, run }) -> {
 *     cols, rows, grid,            // grid: rows strings, top row first; "." open,
 *                                  //   B brick, M metal, C crate, R barrel, S floor spikes
 *     chunks, kind, carved,        // chunk names; carved = the fallback was needed
 *     half, height, platforms: [{ minX, maxX, y }], spikes: [{ minX, maxX }] }
 * x runs from -half (left door) to +half (right door), y from the floor (0).
 *
 * Three 6 x 4 chunks side by side, each maybe mirrored. Every panel is checked
 * door to door with the Ring jump (walk, fall, up one block, across four open
 * columns); after 12 rerolls the lower two rows are carved open. `run` changes
 * every Ring entry, so the panels are rebuilt for each run.
 */
(function (root) {
  "use strict";

  var COLS = 18;
  var ROWS = 6;
  var SOLID = { B: true, M: true, C: true, R: true };

  // Rows top to bottom; the lowest row stands on the floor.
  var CHUNKS = {
    open: ["......", "......", "......", "......"],
    crates: ["......", "......", "....C.", "..C.CC"],
    bunker: ["......", "......", ".BBBB.", "CB..B."],
    stairs: ["......", "....MM", "...BMM", "..CBMM"],
    pit: ["......", "......", "......", "MSSSSM"],
    cage: ["......", "..MMM.", ".BM.M.", "CBMRM."],
    barrels: ["......", "......", "...R..", "..RRR."],
    ledges: ["......", "BB....", "....BB", "...C.."],
    tower: ["...M..", "..BM..", ".BBM..", "CBBMS."],
    spikes: ["......", "......", ".BB...", "CBBSS."]
  };
  var NAMES = Object.keys(CHUNKS);

  function seeded(seed) {
    var s = (Number(seed) >>> 0) || 1;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function cellSeed(seed, cell, run) {
    var c = cell || {};
    var h = (Number(seed) >>> 0) ^ 0x5bd1e995;
    [c.x, c.y, c.z, run].forEach(function (v) {
      h = Math.imul(h ^ ((Number(v) || 0) + 0x9e3779b9), 0x85ebca6b) >>> 0;
      h ^= h >>> 13;
    });
    return h >>> 0;
  }

  function mirror(rows) {
    return rows.map(function (r) { return r.split("").reverse().join(""); });
  }

  /** grid[top..bottom] -> cell char at column c, row r counted from the floor. */
  function makeAt(grid) {
    return function (c, r) {
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return ".";
      return grid[ROWS - 1 - r][c];
    };
  }

  function crossable(grid) {
    var at = makeAt(grid);
    var solid = function (c, r) { return r < 0 ? true : !!SOLID[at(c, r)]; };
    var stand = function (c, h) {
      return c >= 0 && c < COLS && h >= 0 && h <= ROWS - 2 && solid(c, h - 1) &&
        !solid(c, h) && !solid(c, h + 1) && !(h === 0 && at(c, 0) === "S");
    };
    if (!stand(0, 0)) return false;
    var seen = { "0,0": true };
    var queue = [[0, 0]];
    while (queue.length) {
      var cur = queue.shift();
      var c = cur[0], h = cur[1];
      if (c === COLS - 1 && h === 0) return true;
      var push = function (nc, nh) {
        var k = nc + "," + nh;
        if (!seen[k] && stand(nc, nh)) { seen[k] = true; queue.push([nc, nh]); }
      };
      [-1, 1].forEach(function (d) {
        push(c + d, h);
        for (var nh = h - 1; nh >= 0; nh -= 1) {
          var clear = true;
          for (var r = nh; r <= h + 1; r += 1) if (solid(c + d, r)) clear = false;
          if (!clear) break;
          push(c + d, nh);
        }
        for (var dist = 1; dist <= 4; dist += 1) {
          var open = true;
          for (var k = 1; k < dist; k += 1) if (solid(c + d * k, h + 1) || solid(c + d * k, h + 2)) open = false;
          if (!open || h + 3 > ROWS) break;
          for (var th = 0; th <= h + (dist <= 2 ? 1 : 0); th += 1) push(c + d * dist, th);
        }
      });
    }
    return false;
  }

  function assemble(rand) {
    var picks = [];
    var rows = ["", "", "", ""];
    for (var i = 0; i < 3; i += 1) {
      var name = NAMES[Math.floor(rand() * NAMES.length)];
      var part = CHUNKS[name];
      if (rand() < 0.5) part = mirror(part);
      picks.push(name);
      for (var r = 0; r < 4; r += 1) rows[r] += part[r];
    }
    // Two empty rows on top (headroom under the ceiling), the chunks below.
    var grid = ["." .repeat(COLS), ".".repeat(COLS)].concat(rows);
    // The doors and the spot where the pilot steps in (1.6 m from the door): the two
    // outer columns on each side stay open for the lower two rows.
    grid = grid.map(function (row, i) {
      if (i < ROWS - 2) return row;
      return ".." + row.slice(2, COLS - 2) + "..";
    });
    return { grid: grid, chunks: picks };
  }

  function carve(grid) {
    // Fallback: clear the lower two rows (blocks and spikes) into a plain walk.
    return grid.map(function (row, i) { return i >= ROWS - 2 ? ".".repeat(COLS) : row; });
  }

  function surfaces(grid, half) {
    var at = makeAt(grid);
    var platforms = [];
    for (var r = 0; r < ROWS - 1; r += 1) {
      var start = -1;
      for (var c = 0; c <= COLS; c += 1) {
        var top = c < COLS && SOLID[at(c, r)] && !SOLID[at(c, r + 1)];
        if (top && start < 0) start = c;
        if (!top && start >= 0) {
          platforms.push({ minX: start - half, maxX: c - half, y: r + 1 });
          start = -1;
        }
      }
    }
    var spikes = [];
    var s0 = -1;
    for (var x = 0; x <= COLS; x += 1) {
      var sp = x < COLS && at(x, 0) === "S";
      if (sp && s0 < 0) s0 = x;
      if (!sp && s0 >= 0) { spikes.push({ minX: s0 - half, maxX: x - half }); s0 = -1; }
    }
    return { platforms: platforms, spikes: spikes };
  }

  var LABEL = {
    open: "ПУСТОШЬ", crates: "ЯЩИКИ", bunker: "БУНКЕР", stairs: "ЛЕСТНИЦА", pit: "ЯМА",
    cage: "КЛЕТКА", barrels: "БОЧКИ", ledges: "УСТУПЫ", tower: "ВЫШКА", spikes: "ШИПЫ"
  };

  function buildPanel(seed, cell, opts) {
    var o = opts || {};
    var half = COLS / 2;
    var rand = seeded(cellSeed(seed, cell, o.run));
    var built = null;
    for (var attempt = 0; attempt < 12; attempt += 1) {
      var tryIt = assemble(rand);
      if (crossable(tryIt.grid)) { built = tryIt; built.carved = false; break; }
      built = tryIt;
      built.carved = true;
    }
    if (built.carved) built.grid = carve(built.grid);
    var surf = surfaces(built.grid, half);
    return {
      cols: COLS, rows: ROWS, grid: built.grid, chunks: built.chunks,
      kind: built.chunks.join("+"),
      label: built.chunks.map(function (n) { return LABEL[n] || n; }).join(" · "),
      carved: !!built.carved,
      half: half, height: Number(o.height) || ROWS,
      platforms: surf.platforms, spikes: surf.spikes
    };
  }

  root.BCMRingPanels = { buildPanel: buildPanel, cellSeed: cellSeed, crossable: crossable, CHUNKS: CHUNKS };
})(typeof window !== "undefined" ? window : globalThis);
