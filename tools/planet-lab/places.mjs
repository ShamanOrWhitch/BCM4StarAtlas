#!/usr/bin/env node
// Planet Lab, places: the settlement of a planet seen from beside each of its houses and the castle
// (layout.ts). Output: .qa-artifacts/planet-lab/places/
//   BCM_QA_BROWSER_CHANNEL=msedge node tools/planet-lab/places.mjs [planet ...]
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const out = resolve(root, ".qa-artifacts/planet-lab/places");
const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".glb": "model/gltf-binary",
  ".mp4": "video/mp4", ".webp": "image/webp",
};

const server = createServer(async (req, res) => {
  const path = resolve(root, "." + decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!path.startsWith(root + sep)) { res.writeHead(403); return res.end(); }
  try {
    const body = await readFile(path);
    res.writeHead(200, { "content-type": types[extname(path).toLowerCase()] || "application/octet-stream", "cache-control": "no-store" });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/tools/planet-lab/index.html`;
await mkdir(out, { recursive: true });

const planets = process.argv.slice(2).length ? process.argv.slice(2) : ["opus"];
const browser = await chromium.launch({ channel: process.env.BCM_QA_BROWSER_CHANNEL || undefined });
const report = { pageErrors: [], planets: {} };
try {
  for (const planet of planets) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on("pageerror", (e) => report.pageErrors.push(`${planet}: ${e.message}`));
    await page.goto(`${base}?planet=${planet}&species=Human`);
    await page.waitForFunction(() => window.__planetLab.ready || window.__planetLab.error, null, { timeout: 180000 });
    await page.getByRole("button", { name: "Start" }).click();
    await page.waitForTimeout(2500);
    // Stand the pilot 11 m out from each place, on the side of the pad, facing it (forward is
    // (-sin yaw, -cos yaw)), and look.
    const spots = await page.evaluate(() => {
      const qa = window.__BCM_ISLAND_QA__;
      if (!qa || !qa.layout) return null;
      const L = qa.layout;
      const list = L.houses.map((h) => ({ id: h.id, x: h.x, z: h.z }));
      if (L.id === "opus") list.push({ id: "castle", x: -17, z: 43 });
      return list.map((p) => {
        const dx = 0 - p.x, dz = 38 - p.z, len = Math.hypot(dx, dz) || 1;
        const far = p.id === "archive" ? 24 : 11;
        const vx = p.x + (dx / len) * far, vz = p.z + (dz / len) * far;
        return { ...p, vx, vz, yaw: Math.atan2(-(p.x - vx), -(p.z - vz)) };
      });
    });
    report.planets[planet] = { layout: await page.evaluate(() => window.__BCM_ISLAND_QA__?.layout?.id ?? null), spots };
    for (const s of spots || []) {
      await page.evaluate((p) => {
        const sim = window.__BCM_ISLAND_QA__.sim;
        sim.x = p.vx; sim.z = p.vz; sim.yaw = p.yaw;
      }, s);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: resolve(out, `${planet}-${s.id}.png`) });
    }
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
  await writeFile(resolve(out, "report.json"), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 1).slice(0, 2000));
