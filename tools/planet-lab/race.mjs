#!/usr/bin/env node
// Planet Lab, race: the Shoal Race opened directly. Frames on the grid (engine
// off), a moment after the start and at speed: the road look taken from the
// track piece and the two forms of the ship.
//   BCM_QA_BROWSER_CHANNEL=msedge node tools/planet-lab/race.mjs
// BCM_PLANETS=fable — one planet only. Output: .qa-artifacts/planet-lab/race-<planet>-*.png (needs a fresh `npm run build:wordpress`)
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
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
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.BCM_QA_BROWSER_CHANNEL || undefined });
const errors = [];
const planets = (process.env.BCM_PLANETS || "first,fable,opus").split(",").map((p) => p.trim()).filter(Boolean);
const report = [];
try {
  // Each planet has its own form of the race (race-modes.ts): Twinsun laps, Fable slalom, Opus elimination.
  for (const planet of planets) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on("pageerror", (e) => errors.push(planet + ": " + e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/tools/planet-lab/index.html?planet=${planet}&mode=race`);
    await page.getByRole("button", { name: "Start" }).waitFor({ timeout: 180000 });
    await page.waitForTimeout(6000); // ship models and the track piece load in the background
    const title = await page.locator("[data-race-mode]").first().evaluate((el) => ({ mode: el.dataset.raceMode, title: el.textContent }));
    await page.screenshot({ path: resolve(out, `race-${planet}-0-gate.png`) });
    await page.getByRole("button", { name: "Start" }).click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: resolve(out, `race-${planet}-1-grid.png`) });
    await page.waitForTimeout(3800); // countdown
    await page.keyboard.down("KeyW");
    await page.waitForTimeout(2500);
    await page.screenshot({ path: resolve(out, `race-${planet}-2-running.png`) });
    await page.waitForTimeout(3500);
    await page.screenshot({ path: resolve(out, `race-${planet}-3-speed.png`) });
    await page.keyboard.up("KeyW");
    const hud = await page.evaluate(() => document.body.innerText.split("\n").filter((l) => /Круг|Штраф|Выбыли|ур\./.test(l)).slice(0, 4));
    report.push({ planet, ...title, hud });
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify({ report, pageErrors: errors }, null, 2));
if (errors.length) process.exitCode = 1;
