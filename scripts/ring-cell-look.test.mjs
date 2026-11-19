// Owner 19.11.2026: "лабиринт в кольце на астероиде в стадии никакущей" and the
// texture sheets for Tower and Ring (art/tower-ring-kits); "Да, шаг 1" — the look
// of a Ring cell. Today every cell is wrapped in the asteroid's own near-black
// rock (maze.textures), doors are the same rock, nothing tells floors apart.
// Step 1: tiles from the owner's sheet in one atlas, a theme per cell floor
// (brick, ice, lava), a door tile, a light in the cell. The cell's own wallAsset
// still picks the variant (the Ring is built from the asteroid's cells).
// The browser side is checked by scripts/ring-maze-probe.mjs (cell materials).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const ROOT = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");
const ATLAS = new URL("mini-sim/assets/textures/ring-tiles.webp", ROOT);

function webpSize(buf) {
  assert.equal(buf.toString("ascii", 0, 4), "RIFF");
  assert.equal(buf.toString("ascii", 8, 12), "WEBP");
  const kind = buf.toString("ascii", 12, 16);
  if (kind === "VP8 ") return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
  if (kind === "VP8L") {
    const b = buf.readUInt32LE(21);
    return [(b & 0x3fff) + 1, ((b >> 14) & 0x3fff) + 1];
  }
  if (kind === "VP8X") return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)];
  throw new Error("unknown webp " + kind);
}

const cellBlock = () => {
  const warp = read("mini-sim/assets/js/deep-space-warp.js");
  const from = warp.indexOf('room.name = "bcm-asteroid-cell-room"');
  return { warp, build: warp.slice(from - 8000, from + 6000), look: warp.slice(warp.indexOf("function applyRingCellLook("), warp.indexOf("function enterRingCell(")) };
};

test("the Ring tiles atlas is cut from the owner's sheet and stays light", () => {
  assert.ok(existsSync(ATLAS), "no Ring tile atlas: the cells wear the asteroid's own rock");
  const buf = readFileSync(ATLAS);
  assert.deepEqual(webpSize(buf), [512, 512]);
  assert.ok(buf.length < 120 * 1024, `atlas is ${Math.round(buf.length / 1024)} KB`);
  assert.ok(existsSync(new URL("tools/ring-tiles/cut.mjs", ROOT)), "the atlas cannot be cut again");
});

test("a Ring cell takes its walls, floor and door from the tiles, by the cell's floor", () => {
  const { build, look } = cellBlock();
  assert.match(build, /ring-tiles\.webp/, "the Ring cell never loads the tile atlas");
  assert.match(build, /RING_CELL_THEMES\s*=\s*\[/, "no themes for the Ring cell floors");
  for (const id of ["brick", "ice", "lava"]) assert.match(build, new RegExp(`id: "${id}"`), `no ${id} theme`);
  assert.match(build, /doorMaterial/, "doors are still the wall rock");
  assert.match(build, /PointLight\(/, "the cell has no light of its own");
  assert.match(look, /RING_CELL_THEMES\[/, "applyRingCellLook does not pick a theme");
  assert.match(look, /node\.y/, "the theme does not follow the cell's floor");
  assert.match(look, /node\.wallAsset/, "the cell's wallAsset no longer picks the variant");
});
