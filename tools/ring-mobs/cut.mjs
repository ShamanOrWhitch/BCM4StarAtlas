#!/usr/bin/env node
// Cut the nine pig mobs out of the owner's sheet art/ring-bosses/pig-mobs-sheet.png (3x3 on white)
// into one 1024x1024 atlas with alpha: mini-sim/assets/ring-bosses/mobs.webp. The white around
// each pig is removed by a flood fill from the cell border (white inside a pig stays), edges soft.
// Prints each pig's rectangle in the atlas, [x0, y0, x1, y1] in fractions with y from the top:
// the table RING_MOB_ART in ring-platformer.js. Order = the sheet, row by row.
//   BCM_QA_BROWSER_CHANNEL=msedge node tools/ring-mobs/cut.mjs
import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const { chromium } = createRequire(resolve(root, "tools/minisim-qa/package.json"))("playwright");
const sheet = await readFile(resolve(root, "art/ring-bosses/pig-mobs-sheet.png"));
const browser = await chromium.launch({ channel: process.env.BCM_QA_BROWSER_CHANNEL || undefined });
try {
  const page = await browser.newPage();
  const result = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const ATLAS = 1024, CELL = ATLAS / 3, PAD = 6;
    const out = document.createElement("canvas");
    out.width = ATLAS; out.height = ATLAS;
    const octx = out.getContext("2d");
    octx.imageSmoothingQuality = "high";
    const rects = [];
    const cw = img.width / 3, ch = img.height / 3;
    for (let k = 0; k < 9; k += 1) {
      const c = document.createElement("canvas");
      const w = Math.floor(cw), h = Math.floor(ch);
      c.width = w; c.height = h;
      const g = c.getContext("2d", { willReadFrequently: true });
      g.drawImage(img, (k % 3) * cw, Math.floor(k / 3) * ch, cw, ch, 0, 0, w, h);
      const data = g.getImageData(0, 0, w, h);
      const d = data.data;
      const far = (i) => Math.hypot(1 - d[i] / 255, 1 - d[i + 1] / 255, 1 - d[i + 2] / 255);
      // Background: near-white pixels reached from the border.
      const bg = new Uint8Array(w * h);
      const stack = [];
      for (let x = 0; x < w; x += 1) { stack.push(x, (h - 1) * w + x); }
      for (let y = 0; y < h; y += 1) { stack.push(y * w, y * w + w - 1); }
      while (stack.length) {
        const p = stack.pop();
        if (bg[p] || far(p * 4) > 0.3) continue;
        bg[p] = 1;
        const x = p % w, y = (p / w) | 0;
        if (x > 0) stack.push(p - 1); if (x < w - 1) stack.push(p + 1);
        if (y > 0) stack.push(p - w); if (y < h - 1) stack.push(p + w);
      }
      for (let p = 0; p < w * h; p += 1) {
        if (!bg[p]) continue;
        const t = Math.min(1, Math.max(0, (far(p * 4) - 0.08) / 0.22));
        const alpha = t * t * (3 - 2 * t);
        d[p * 4 + 3] = Math.round(255 * alpha);
        // A soft edge pixel is the pig's colour mixed with the white sheet: take the white out,
        // or the pig wears a pale rim in the dark cells.
        if (alpha > 0.02) for (let c = 0; c < 3; c += 1) d[p * 4 + c] = Math.max(0, Math.min(255, Math.round((d[p * 4 + c] - 255 * (1 - alpha)) / alpha)));
      }
      // Keep this cell's pig: its largest piece and big pieces off the cell border (smoke, a
      // wing); small pieces cut off at the border belong to the neighbouring pigs.
      const label = new Int32Array(w * h).fill(-1);
      const pieces = [];
      for (let p0 = 0; p0 < w * h; p0 += 1) {
        if (label[p0] >= 0 || d[p0 * 4 + 3] <= 40) continue;
        const id = pieces.length, piece = { size: 0, border: false };
        pieces.push(piece);
        const st = [p0]; label[p0] = id;
        while (st.length) {
          const p = st.pop();
          piece.size += 1;
          const x = p % w, y = (p / w) | 0;
          if (x === 0 || y === 0 || x === w - 1 || y === h - 1) piece.border = true;
          for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
            if (q >= 0 && label[q] < 0 && d[q * 4 + 3] > 40) { label[q] = id; st.push(q); }
          }
        }
      }
      const main = pieces.reduce((m, piece) => Math.max(m, piece.size), 0);
      const keep = pieces.map((piece) => piece.size === main || (!piece.border && piece.size > main * 0.003));
      let x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (let p = 0; p < w * h; p += 1) {
        if (d[p * 4 + 3] > 0 && !(label[p] >= 0 && keep[label[p]])) d[p * 4 + 3] = 0;
        if (d[p * 4 + 3] > 128) {
          const x = p % w, y = (p / w) | 0;
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
      g.putImageData(data, 0, 0);
      const fw = x1 - x0 + 1, fh = y1 - y0 + 1;
      const s = Math.min((CELL - PAD * 2) / fw, (CELL - PAD * 2) / fh);
      const dw = Math.round(fw * s), dh = Math.round(fh * s);
      const ox = (k % 3) * CELL + (CELL - dw) / 2, oy = Math.floor(k / 3) * CELL + CELL - PAD - dh;
      octx.drawImage(c, x0, y0, fw, fh, ox, oy, dw, dh);
      const r = (n) => Math.round(n / ATLAS * 10000) / 10000;
      rects.push([r(ox), r(oy), r(ox + dw), r(oy + dh)]);
    }
    return { url: out.toDataURL("image/webp", 0.86), rects };
  }, "data:image/png;base64," + sheet.toString("base64"));
  const target = resolve(root, "mini-sim/assets/ring-bosses/mobs.webp");
  const bytes = Buffer.from(result.url.split(",")[1], "base64");
  await writeFile(target, bytes);
  console.log(JSON.stringify({ target, bytes: bytes.length }));
  result.rects.forEach((r) => console.log("[" + r.join(", ") + "],"));
} finally {
  await browser.close();
}
