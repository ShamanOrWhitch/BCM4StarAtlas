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
    spikes: ["......", "......", ".BB...", "CBBSS."],
    // Traps (owner 20.11, genre of precise platformers): K crumbling plates,
    // T floor spikes on a timer. The crossing never relies on them.
    crumble: ["......", "..KK..", "KK..KK", "...SS."],
    timed: ["......", "......", "......", "..TTT."],
    gauntlet: ["......", "......", ".KKKK.", "TT..TT"],
    // Slicers (owner 23.11.2026, Prince of Persia's chompers): G — jaws at floor level that
    // snap shut on a beat; you pass between snaps.
    blades: ["......", "......", "......", ".G..G."],
    mill: ["......", "..BB..", "......", "G.KK.G"]
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
        !solid(c, h) && !solid(c, h + 1) && !(h === 0 && (at(c, 0) === "S" || at(c, 0) === "T"));
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
    var runs = function (test) {
      var out = [];
      var from = -1;
      for (var x = 0; x <= COLS; x += 1) {
        var on = x < COLS && test(x);
        if (on && from < 0) from = x;
        if (!on && from >= 0) { out.push({ minX: from - half, maxX: x - half }); from = -1; }
      }
      return out;
    };
    var spikes = runs(function (x) { return at(x, 0) === "S"; });
    var traps = runs(function (x) { return at(x, 0) === "T"; }).map(function (t) {
      return { kind: "timed", minX: t.minX, maxX: t.maxX };
    });
    // Slicers: one per G column, a 2.0 s beat with a 0.4 s snap; neighbours are offset so
    // two in a row are not shut together.
    for (var gc = 0; gc < COLS; gc += 1) {
      if (at(gc, 0) !== "G") continue;
      traps.push({ kind: "slicer", minX: gc - half, maxX: gc + 1 - half, col: gc, period: 2.0, closed: 0.4, phase: (gc * 0.37) % 2.0 });
    }
    // Crumbling plates: each plate cell is its own platform, so one can fall alone.
    for (var pr = 0; pr < ROWS - 1; pr += 1) {
      for (var pc = 0; pc < COLS; pc += 1) {
        if (at(pc, pr) !== "K") continue;
        var plate = { minX: pc - half, maxX: pc + 1 - half, y: pr + 1, crumble: true, col: pc, row: pr };
        platforms.push(plate);
        traps.push({ kind: "crumble", minX: plate.minX, maxX: plate.maxX, y: plate.y, col: pc, row: pr });
      }
    }
    return { platforms: platforms, spikes: spikes, traps: traps };
  }

  var LABEL = {
    open: "ПУСТОШЬ", crates: "ЯЩИКИ", bunker: "БУНКЕР", stairs: "ЛЕСТНИЦА", pit: "ЯМА",
    cage: "КЛЕТКА", barrels: "БОЧКИ", ledges: "УСТУПЫ", tower: "ВЫШКА", spikes: "ШИПЫ",
    crumble: "ОСЫПЬ", timed: "ЗУБЬЯ", gauntlet: "ПОЛОСА", blades: "РУБИЛА", mill: "МЕЛЬНИЦА"
  };

  /** Is a slicer shut at time t (seconds)? Shut for `closed` s at the start of each beat. */
  function slicerClosedAt(trap, t) {
    var p = ((Number(t) || 0) + trap.phase) % trap.period;
    return p < trap.closed;
  }

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
      platforms: surf.platforms, spikes: surf.spikes, traps: surf.traps
    };
  }

  // ---- Flight panel (owner 23.11.2026) ------------------------------------------------
  // A purple cell is crossed on the jet, Balloon / DOS Jetpack style: a pit between two
  // door pads, energy gates whose gap drifts up and down, spikes under the ceiling, a
  // rest island and bubbles. One press (+impulse) a second about balances gravity, so the
  // crossing has a pulse (~62 BPM, RING_PIG_BOSS_ARC.md). x is panel-local (-half..+half).
  // The impulse ADDS to the vertical speed (a press while falling only slows the fall), as
  // in Balloon; the purple-cell jet (max(0, vy) + 4.1) made every press a 2 m hop.
  // Owner 24.11.2026: the jet is held, not tapped — thrust while the button is down, fuel burns
  // per second (a full tank ≈ 5 s of thrust). Holding about half the time hovers.
  var FLIGHT = { gravity: 3.0, thrust: 6.2, burn: 20, maxRise: 2.4, impulse: 3.0, cost: 12, bubble: 34, airSpeed: 3.0 };

  function makeFlight(rand, half, height, calm) {
    var pit = { minX: -half + 2.5, maxX: half - 2.5 };
    var ceilingY = height - 0.6;
    var count = rand() < 0.5 ? 2 : 3;
    var gates = [];
    var base = 2.4 + rand() * 0.6;
    for (var i = 0; i < count; i += 1) {
      var span = pit.maxX - pit.minX;
      // Gates about evenly spread, the next gap at most 0.45 m off the last one.
      var x = pit.minX + span * (i + 1) / (count + 1) + (rand() - 0.5) * 0.3;
      if (i > 0) base = Math.max(2.3, Math.min(3.1, base + (rand() - 0.5) * 0.9));
      gates.push({
        x: Math.round(x * 10) / 10, width: 0.8, gap: 3.2,
        base: calm ? 2.7 : base, amp: calm ? 0 : 0.15 + rand() * 0.25,
        period: 3.0 + rand() * 1.0, phase: rand() * Math.PI * 2,
        ceilingY: ceilingY
      });
    }
    // A rest island between the first two gates, a bubble over it and one on each pad.
    var ix = (gates[0].x + gates[1].x) / 2;
    var islands = [{ minX: ix - 0.8, maxX: ix + 0.8, y: 1.2 }];
    var bubbles = [{ x: ix, y: 2.4 }, { x: -half + 1.4, y: 1.2 }, { x: half - 1.4, y: 1.2 }];
    return {
      pit: pit, gates: gates, islands: islands, bubbles: bubbles, ceilingY: ceilingY,
      gravity: FLIGHT.gravity, thrust: FLIGHT.thrust, burn: FLIGHT.burn, impulse: FLIGHT.impulse, maxRise: FLIGHT.maxRise,
      cost: FLIGHT.cost, bubble: FLIGHT.bubble, airSpeed: FLIGHT.airSpeed
    };
  }

  /**
   * Is there a clean crossing, door pad to door pad, entering at time t0? A search over
   * what a player does every 0.25 s: press the jet or not, fly at 0 / 1.5 / 3 m/s (wait on
   * the pad, hover, go). The body keeps 0.15 m off the gate edges and the ceiling spikes.
   * Returns { ok, presses } (presses of the found crossing).
   */
  function flightCrossable(panel, t0, opts) {
    var o = opts || {};
    var F = panel.flight, half = panel.half;
    var W = 0.7, H = 1.7, M = 0.15, DT = 0.25, SUB = 4, h = DT / SUB;
    var frontier = [{ x: -half + 1, y: 0, vy: 0, fuel: o.fuel === undefined ? 100 : o.fuel, taken: 0, presses: 0 }];
    var speeds = [0, 1.5, F.airSpeed];
    for (var step = 0; step < 64; step += 1) {
      var next = {};
      for (var si = 0; si < frontier.length; si += 1) {
        var s0 = frontier[si];
        for (var press = 0; press < (o.noJet ? 1 : 2); press += 1) {
          for (var sp = 0; sp < speeds.length; sp += 1) {
            var s = { x: s0.x, y: s0.y, vy: s0.vy, fuel: s0.fuel, taken: s0.taken, presses: s0.presses };
            // press = the jet held through this 0.25 s step (thrust and burn per substep).
            if (press) {
              if (s.fuel <= 0) continue;
              s.presses += 1;
            }
            var dead = false;
            for (var k = 0; k < SUB && !dead; k += 1) {
              var t = (Number(t0) || 0) + step * DT + (k + 1) * h;
              s.x += speeds[sp] * h;
              var py = s.y;
              if (press && s.fuel > 0) {
                s.vy = Math.min(F.maxRise, s.vy + F.thrust * h);
                s.fuel = Math.max(0, s.fuel - F.burn * h);
              }
              s.vy -= F.gravity * h;
              s.y += s.vy * h;
              var inPit = s.x > F.pit.minX && s.x < F.pit.maxX;
              if (s.y <= 0 && !inPit) { s.y = 0; if (s.vy < 0) s.vy = 0; }
              for (var ii = 0; ii < F.islands.length; ii += 1) {
                var isl = F.islands[ii];
                if (s.vy <= 0 && py >= isl.y && s.y <= isl.y && s.x >= isl.minX && s.x <= isl.maxX) { s.y = isl.y; s.vy = 0; }
              }
              if (s.y < -0.5 || s.y + H > F.ceilingY - 0.05) { dead = true; break; }
              for (var gi = 0; gi < F.gates.length; gi += 1) {
                var g = F.gates[gi];
                if (Math.abs(s.x - g.x) > (g.width + W) / 2) continue;
                var gp = flightGapAt(g, t);
                if (s.y < gp.y0 + M || s.y + H > gp.y1 - M) { dead = true; break; }
              }
              for (var bi = 0; bi < F.bubbles.length; bi += 1) {
                var b = F.bubbles[bi];
                if (!(s.taken & (1 << bi)) && Math.abs(s.x - b.x) < 0.75 && Math.abs(s.y + 0.9 - b.y) < 0.95) {
                  s.taken |= 1 << bi; s.fuel = Math.min(100, s.fuel + F.bubble);
                }
              }
            }
            if (dead) continue;
            if (s.x >= half - 1) return { ok: true, presses: s.presses };
            var key = Math.round(s.x / 0.4) + "," + Math.round(s.y / 0.2) + "," + Math.round(s.vy / 0.4) + "," + s.taken;
            if (!next[key] || next[key].fuel < s.fuel) next[key] = s;
          }
        }
      }
      frontier = Object.keys(next).map(function (key) { return next[key]; });
      if (!frontier.length) return { ok: false, presses: 0 };
      if (frontier.length > 150) {
        frontier.sort(function (a, b) { return (b.x - a.x) || (b.fuel - a.fuel); });
        frontier.length = 150;
      }
    }
    return { ok: false, presses: 0 };
  }

  var FLIGHT_ENTRIES = [0, 1.1, 2.2, 3.3]; // entry moments checked (the gates are periodic)

  function buildFlightPanel(seed, cell, opts) {
    var o = opts || {};
    var half = COLS / 2;
    var height = Number(o.height) || ROWS;
    var rand = seeded(cellSeed(seed, cell, o.run) ^ 0x2f1e33);
    var panel = null;
    // Like the block panels: reroll until it can be crossed from any entry moment; the
    // last resort is a calm panel (gates that do not move).
    for (var attempt = 0; attempt < 6 && !panel; attempt += 1) {
      var tryIt = { half: half, flight: makeFlight(rand, half, height, attempt === 5) };
      if (FLIGHT_ENTRIES.every(function (t0) { return flightCrossable(tryIt, t0).ok; })) panel = tryIt;
    }
    if (!panel) panel = { half: half, flight: makeFlight(rand, half, height, true) };
    var F = panel.flight;
    return {
      cols: COLS, rows: ROWS, grid: null, chunks: ["flight"], kind: "flight",
      label: "ПРОПАСТЬ · ТОЛЬКО ДЖЕТПАК", carved: false, half: half, height: height,
      platforms: F.islands.map(function (s) { return { minX: s.minX, maxX: s.maxX, y: s.y, island: true }; }),
      spikes: [], traps: [], flight: F
    };
  }

  /** The open gap of a gate at time t (seconds): { y0, y1 }. */
  function flightGapAt(gate, t) {
    var c = gate.base + Math.sin((Number(t) || 0) * Math.PI * 2 / gate.period + gate.phase) * gate.amp;
    var h = gate.gap / 2;
    c = Math.max(0.4 + h, Math.min(gate.ceilingY - h, c));
    return { y0: c - h, y1: c + h };
  }

  /** True where a flight panel has no floor (panel-local x). */
  function flightPitAt(panel, x) {
    var f = panel && panel.flight;
    return !!f && x > f.pit.minX && x < f.pit.maxX;
  }

  root.BCMRingPanels = {
    buildPanel: buildPanel, cellSeed: cellSeed, crossable: crossable, CHUNKS: CHUNKS,
    slicerClosedAt: slicerClosedAt,
    buildFlightPanel: buildFlightPanel, flightGapAt: flightGapAt, flightPitAt: flightPitAt, flightCrossable: flightCrossable, FLIGHT: FLIGHT
  };
})(typeof window !== "undefined" ? window : globalThis);
