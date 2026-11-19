#!/usr/bin/env node
// Owner 19.11.2026: "ориентируйся по видео". The Tower backdrop of a planet is
// the last frame of its landing film, so the film ends on the picture the
// Tower stands in front of. Light JPEG (the owner wants the lightest textures).
//   BCM_QA_BROWSER_CHANNEL=msedge node tools/tower-bg-from-clip.mjs landing-fable.mp4=tower-bg-fable.jpg ...
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const pairs = process.argv.slice(2).map((arg) => arg.split("="));
const server = createServer(async (req, res) => {
  const name = decodeURIComponent(new URL(req.url, "http://x").pathname.slice(1));
  if (!name) { res.writeHead(200, { "content-type": "text/html" }); return res.end("<body style='margin:0'></body>"); }
  try { const body = await readFile(resolve(root, "mini-sim/assets", name)); res.writeHead(200, { "content-type": "video/mp4" }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ channel: process.env.BCM_QA_BROWSER_CHANNEL || undefined });
try {
  const page = await browser.newPage();
  await page.goto(base);
  for (const [clip, target] of pairs) {
    const data = await page.evaluate(async (src) => {
      const v = document.createElement("video");
      v.muted = true; v.src = src; v.preload = "auto";
      await new Promise((ok, bad) => { v.onloadeddata = ok; v.onerror = () => bad(new Error("decode " + src)); });
      // Seeking a fresh stream reports 0 in some builds: play it through and stop on its last frame.
      await new Promise((ok) => { v.onended = ok; v.play(); });
      const c = document.createElement("canvas");
      c.width = v.videoWidth; c.height = v.videoHeight;
      c.getContext("2d").drawImage(v, 0, 0);
      return { url: c.toDataURL("image/jpeg", 0.82), w: c.width, h: c.height, t: v.currentTime };
    }, base + encodeURIComponent(clip));
    const bytes = Buffer.from(data.url.split(",")[1], "base64");
    await writeFile(resolve(root, "mini-sim/tower/assets", target), bytes);
    console.log(`${clip} @ ${data.t.toFixed(2)}s -> ${target} ${data.w}x${data.h} ${(bytes.length / 1024).toFixed(0)} KB`);
  }
} finally {
  await browser.close();
  server.close();
}
