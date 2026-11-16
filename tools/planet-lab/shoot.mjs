#!/usr/bin/env node
// Planet Lab: First Planet on each planet profile, the crew standing and
// mid-stride. Output: .qa-artifacts/planet-lab/
//   BCM_QA_BROWSER_CHANNEL=msedge node tools/planet-lab/shoot.mjs [species ...]
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const out = resolve(root, ".qa-artifacts/planet-lab");
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

const speciesList = process.argv.slice(2).length ? process.argv.slice(2) : ["Human"];
const browser = await chromium.launch({ channel: process.env.BCM_QA_BROWSER_CHANNEL || undefined });
const report = { shots: [], pageErrors: [], consoleErrors: [], planets: {} };
try {
  for (const planet of (process.env.BCM_PLANETS || "first,pearce,ioki,fable").split(",")) {
    for (const species of speciesList) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      page.on("pageerror", (e) => report.pageErrors.push(`${planet}/${species}: ${e.message}`));
      page.on("console", (m) => { if (m.type() === "error") report.consoleErrors.push(`${planet}/${species}: ${m.text()}`); });
      await page.goto(`${base}?planet=${planet}&species=${encodeURIComponent(species)}`);
      await page.waitForFunction(() => window.__planetLab.ready || window.__planetLab.error, null, { timeout: 180000 });
      const tag = `${planet}-${species.toLowerCase()}`;
      report.planets[tag] = await page.evaluate(() => ({
        error: window.__planetLab.error,
        title: document.querySelector("[data-bcm-planet]")?.textContent || "",
        id: document.querySelector("[data-bcm-planet]")?.getAttribute("data-bcm-planet") || "",
      }));
      await page.screenshot({ path: resolve(out, `${tag}-gate.png`) });
      await page.getByRole("button", { name: "Start" }).click();
      await page.waitForTimeout(2500);
      await page.screenshot({ path: resolve(out, `${tag}-stand.png`) });
      await page.keyboard.down("KeyW");
      for (const ms of [450, 230, 230]) {
        await page.waitForTimeout(ms);
        const file = resolve(out, `${tag}-walk-${report.shots.filter((s) => s.includes(tag + "-walk")).length}.png`);
        await page.screenshot({ path: file });
        report.shots.push(file);
      }
      await page.keyboard.up("KeyW");
      // Board the bike: BUG-006 threw "hoverFloor is not defined" here.
      await page.keyboard.press("KeyF");
      await page.waitForTimeout(400);
      // Relief from the air: T switches the bike to flight, Space climbs.
      await page.keyboard.press("KeyT");
      await page.keyboard.down("Space");
      await page.waitForTimeout(2600);
      await page.keyboard.up("Space");
      await page.screenshot({ path: resolve(out, `${tag}-air-0.png`) });
      await page.keyboard.down("KeyA");
      await page.waitForTimeout(1500);
      await page.keyboard.up("KeyA");
      await page.keyboard.down("KeyW");
      await page.waitForTimeout(1800);
      await page.keyboard.up("KeyW");
      await page.screenshot({ path: resolve(out, `${tag}-air-1.png`) });
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}
await writeFile(resolve(out, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ planets: report.planets, pageErrors: report.pageErrors, consoleErrors: report.consoleErrors.slice(0, 8) }, null, 2));
if (report.pageErrors.length) process.exitCode = 1;
