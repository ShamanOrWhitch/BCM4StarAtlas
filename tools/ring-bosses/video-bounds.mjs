#!/usr/bin/env node
// BUG-028: where the figure stands in the first and last frame of each Ring transform clip.
// The clips are drawn on white; a pixel counts as figure where the Ring's white key keeps it
// (distance from white > 0.21, the middle of smoothstep(0.10, 0.32)). Prints frame fractions,
// y from the top: [x0, y0, x1, y1] — the table RING_BOSS_VIDEO_FIGURE in ring-platformer.js.
// Run: BCM_QA_BROWSER_CHANNEL=msedge node tools/ring-bosses/video-bounds.mjs
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const dir = resolve(root, "mini-sim/assets/ring-bosses/video");
const { chromium } = createRequire(resolve(root, "tools/minisim-qa/package.json"))("playwright");
const clips = ["transform-roller-walker", "transform-walker-orbiter", "transform-orbiter-brawler", "transform-brawler-runner", "transform-runner-stalker"];
const server = createServer(async (req, res) => {
  try {
    const name = decodeURIComponent(req.url.slice(1));
    if (!/^[\w-]+\.mp4$/.test(name)) throw new Error("bad");
    const body = await readFile(resolve(dir, name));
    res.writeHead(200, { "content-type": "video/mp4", "access-control-allow-origin": "*" });
    res.end(body);
  } catch { res.writeHead(200, { "content-type": "text/html" }); res.end("<!doctype html><body></body>"); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = "http://127.0.0.1:" + server.address().port;
const browser = await chromium.launch({ channel: process.env.BCM_QA_BROWSER_CHANNEL || undefined });
const page = await browser.newPage();
await page.goto(origin + "/");
const out = {};
for (const clip of clips) {
  out[clip] = await page.evaluate(async (src) => {
    const v = document.createElement("video");
    v.muted = true; v.preload = "auto";
    v.src = URL.createObjectURL(await (await fetch(src)).blob()); // a blob seeks; the plain server sends no ranges
    await new Promise((r, j) => { v.onloadeddata = r; v.onerror = () => j(new Error("load " + src)); });
    const w = v.videoWidth, h = v.videoHeight;
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d", { willReadFrequently: true });
    const box = async (t) => {
      v.currentTime = t;
      await new Promise((r) => { v.onseeked = r; });
      g.drawImage(v, 0, 0, w, h);
      const d = g.getImageData(0, 0, w, h).data;
      let x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
        const i = (y * w + x) * 4;
        const dist = Math.hypot(1 - d[i] / 255, 1 - d[i + 1] / 255, 1 - d[i + 2] / 255);
        if (dist > 0.21) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      const r3 = (n) => Math.round(n * 1000) / 1000;
      return [r3(x0 / w), r3(y0 / h), r3((x1 + 1) / w), r3((y1 + 1) / h)];
    };
    const dur = v.duration;
    return { w, h, duration: Math.round(dur * 100) / 100, first: await box(0.04), mid: await box(dur / 2), last: await box(Math.max(0, dur - 0.08)),
      track: await Promise.resolve().then(async () => { const t = []; for (let k = 0; k <= 10; k += 1) t.push(await box(Math.min(dur - 0.08, (dur * k) / 10))); return t; }) };
  }, origin + "/" + clip + ".mp4");
}
await browser.close();
server.close();
console.log(JSON.stringify(out, null, 1));
