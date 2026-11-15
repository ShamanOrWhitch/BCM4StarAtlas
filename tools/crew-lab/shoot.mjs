#!/usr/bin/env node
// Crew Lab screenshots: every race, cut out and posed by crew-core, at fixed
// walk phases and both directions. Output: .qa-artifacts/crew-lab/
//   node tools/crew-lab/shoot.mjs
// BCM_QA_BROWSER_CHANNEL=msedge uses an installed Edge instead of Playwright's Chromium.
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const out = resolve(root, ".qa-artifacts/crew-lab");
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png" };

const server = createServer(async (req, res) => {
  const path = resolve(root, "." + decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!path.startsWith(root + sep)) { res.writeHead(403); return res.end(); }
  try {
    const body = await readFile(path);
    res.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/tools/crew-lab/index.html`;
await mkdir(out, { recursive: true });

const browser = await chromium.launch({ channel: process.env.BCM_QA_BROWSER_CHANNEL || undefined });
const report = { shots: [], measurements: null, failed: [], consoleErrors: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 560 } });
  page.on("console", (m) => { if (m.type() === "error") report.consoleErrors.push(m.text()); });
  for (const [name, query] of [["walk-right-p00", "?phase=0"], ["walk-right-p25", "?phase=0.25"], ["walk-right-p50", "?phase=0.5"], ["walk-right-p75", "?phase=0.75"], ["walk-left-p25", "?phase=0.25&dir=-1"], ["one-piece-p25", "?phase=0.25&legs=0"]]) {
    await page.goto(base + query);
    try {
      await page.waitForFunction(() => window.__crewLab && window.__crewLab.ready && window.__crewLab.frames > 3, null, { timeout: 180000 });
    } catch (error) {
      const state = await page.evaluate(() => ({ lab: window.__crewLab, status: document.getElementById("status")?.textContent }));
      throw new Error(`Crew Lab not ready for ${name}: ${JSON.stringify(state).slice(0, 400)} | console: ${report.consoleErrors.slice(-3).join(" | ")}`);
    }
    await page.waitForTimeout(300);
    const file = resolve(out, name + ".png");
    await page.screenshot({ path: file });
    report.shots.push(file);
    if (!report.measurements) {
      const lab = await page.evaluate(() => window.__crewLab);
      report.measurements = lab.measurements;
      report.failed = lab.failed;
    }
  }
  // Close-ups at 2x so the knee seam and the shin swing can be judged by eye.
  const zoom = await browser.newPage({ viewport: { width: 1440, height: 560 }, deviceScaleFactor: 2 });
  for (const [name, query, clip] of [
    ["zoom-left-p25", "?phase=0.25", { x: 40, y: 290, width: 600, height: 235 }],
    ["zoom-right-p25", "?phase=0.25", { x: 560, y: 290, width: 860, height: 235 }],
    ["zoom-right-p75", "?phase=0.75", { x: 560, y: 290, width: 860, height: 235 }]
  ]) {
    await zoom.goto(base + query);
    await zoom.waitForFunction(() => window.__crewLab && window.__crewLab.ready && window.__crewLab.frames > 3, null, { timeout: 120000 });
    await zoom.waitForTimeout(300);
    const file = resolve(out, name + ".png");
    await zoom.screenshot({ path: file, clip });
    report.shots.push(file);
  }
} finally {
  await browser.close();
  server.close();
}
await writeFile(resolve(out, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ failed: report.failed, consoleErrors: report.consoleErrors.slice(0, 5), measurements: report.measurements }, null, 1));
