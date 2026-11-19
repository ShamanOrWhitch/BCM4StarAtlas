#!/usr/bin/env node
// Cut the Ring cell tiles out of the owner's sheet art/tower-ring-kits/textures-grid.webp
// (16 columns x 8 rows of square tiles, 96 px apart) into one 512x512 atlas of
// 4x4 tiles, 128 px each: mini-sim/assets/textures/ring-tiles.webp.
// The order of TILES is the contract with deep-space-warp.js (RING_TILE_INDEX).
//   BCM_QA_BROWSER_CHANNEL=msedge node tools/ring-tiles/cut.mjs
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const { chromium } = createRequire(resolve(root, "tools/minisim-qa/package.json"))("playwright");

// [column, row] on the sheet, in atlas order.
export const TILES = [
  [0, 0], // 0 brick wall, red
  [1, 1], // 1 brick wall, worn
  [3, 2], // 2 brick wall, cracked
  [0, 6], // 3 brick floor: plain steel plate
  [12, 2], // 4 ice wall
  [14, 2], // 5 ice wall, veined
  [12, 3], // 6 ice floor
  [13, 3], // 7 ice floor, cracked
  [8, 4], // 8 lava wall, basalt cracks
  [10, 4], // 9 lava wall, glowing cracks
  [8, 5], // 10 lava floor, basalt
  [11, 5], // 11 lava glow
  [3, 4], // 12 door: grate in a red-white frame
  [2, 4], // 13 hazard stripes
  [7, 0], // 14 octagonal hatch
  [2, 7], // 15 diamond steel floor
];

const sheet = await readFile(resolve(root, "art/tower-ring-kits/textures-grid.webp"));
const browser = await chromium.launch({ channel: process.env.BCM_QA_BROWSER_CHANNEL || undefined });
try {
  const page = await browser.newPage();
  const dataUrl = await page.evaluate(async ({ src, tiles }) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const out = document.createElement("canvas");
    out.width = 512;
    out.height = 512;
    const ctx = out.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    const pitchX = img.width / 16;
    const pitchY = 96.3;
    const inset = 7; // past the black seams between tiles
    tiles.forEach(([col, row], i) => {
      const sx = col * pitchX + inset;
      const sy = row * pitchY + inset;
      const size = Math.min(pitchX, pitchY) - inset * 2;
      ctx.drawImage(img, sx, sy, size, size, (i % 4) * 128, Math.floor(i / 4) * 128, 128, 128);
    });
    return out.toDataURL("image/webp", 0.86);
  }, { src: "data:image/webp;base64," + sheet.toString("base64"), tiles: TILES });
  const target = resolve(root, "mini-sim/assets/textures/ring-tiles.webp");
  await mkdir(dirname(target), { recursive: true });
  const bytes = Buffer.from(dataUrl.split(",")[1], "base64");
  await writeFile(target, bytes);
  console.log(JSON.stringify({ target, bytes: bytes.length, tiles: TILES.length }));
} finally {
  await browser.close();
}
