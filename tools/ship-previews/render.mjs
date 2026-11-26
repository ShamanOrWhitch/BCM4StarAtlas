#!/usr/bin/env node
// Owner 26.11.2026: "было бы интересно увидеть модельки кораблей, когда я в меню на него навожусь …
// к выбору нужно справа бы ещё модельку отобразить". One small 3/4 picture per ship family of the
// catalogue (384x216 WebP), rendered once here, so the crew menu shows it without a second WebGL
// context in the game. Output: mini-sim/assets/mesh/ships/previews/<id>.webp
//   BCM_QA_BROWSER_CHANNEL=msedge node tools/ship-previews/render.mjs
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const { chromium } = createRequire(resolve(root, "tools/minisim-qa/package.json"))("playwright");
const out = resolve(root, "mini-sim/assets/mesh/ships/previews");
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".glb": "model/gltf-binary", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".bin": "application/octet-stream" };
const server = createServer(async (req, res) => {
  const path = resolve(root, "." + decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!path.startsWith(root + sep)) { res.writeHead(403); return res.end(); }
  try { const body = await readFile(path); res.writeHead(200, { "content-type": types[extname(path).toLowerCase()] || "application/octet-stream" }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
await mkdir(out, { recursive: true });
const catalog = JSON.parse(await readFile(resolve(root, "mini-sim/assets/mesh/ships/catalog.json"), "utf8"));
const browser = await chromium.launch({ channel: process.env.BCM_QA_BROWSER_CHANNEL || undefined });
const done = [], failed = [];
try {
  const page = await browser.newPage({ viewport: { width: 400, height: 240 } });
  await page.goto(base + "/tools/ship-previews/index.html");
  await page.waitForFunction(() => typeof window.renderShip === "function");
  for (const fam of catalog.families) {
    const url = base + "/mini-sim/assets/mesh/ships/" + fam.flight.split("/").map(encodeURIComponent).join("/");
    try {
      // The first frames of a fresh WebGL canvas can come out empty: render again until the picture
      // holds an image (an empty 384x216 WebP is a few hundred bytes).
      let data = "";
      for (let attempt = 0; attempt < 4 && data.length < 1200; attempt += 1) {
        data = await page.evaluate(({ url, nose }) => window.renderShip(url, nose), { url, nose: fam.nose || "" });
        if (data.length < 1200) await page.waitForTimeout(400);
      }
      if (data.length < 1200) throw new Error("empty picture");
      await writeFile(resolve(out, fam.id + ".webp"), Buffer.from(data.split(",")[1], "base64"));
      done.push(fam.id);
    } catch (e) { failed.push(fam.id + ": " + String(e).slice(0, 80)); }
  }
} finally { await browser.close(); server.close(); }
console.log(JSON.stringify({ done: done.length, failed }, null, 1));
