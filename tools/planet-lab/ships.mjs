#!/usr/bin/env node
// Planet Lab, ships: every island-drivable ship from the catalogue, boarded and
// driven forward, seen from the chase camera. One contact sheet shows at a
// glance which hull drives sideways or backwards (BUG-015).
//   BCM_QA_BROWSER_CHANNEL=msedge node tools/planet-lab/ships.mjs [id ...]
// Output: .qa-artifacts/planet-lab/ships/<id>.png and ships-sheet.png
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const out = resolve(root, ".qa-artifacts/planet-lab/ships");
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

const catalog = JSON.parse(readFileSync(resolve(root, "mini-sim/assets/mesh/ships/catalog.json"), "utf8")).families;
const wanted = process.argv.slice(2);
const ships = catalog.filter((s) => (wanted.length ? wanted.includes(s.id) : s.planetDrive));
const mode = process.env.BCM_SHIP_MODE || "drive"; // drive | hover
const browser = await chromium.launch({ channel: process.env.BCM_QA_BROWSER_CHANNEL || undefined });
const errors = [];
const shots = [];
try {
  for (const ship of ships) {
    const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
    page.on("pageerror", (e) => errors.push(`${ship.id}: ${e.message}`));
    await page.goto(`${base}?planet=first&species=Human&ship=${encodeURIComponent(ship.id)}`);
    await page.waitForFunction(() => window.__planetLab.ready || window.__planetLab.error, null, { timeout: 180000 });
    await page.getByRole("button", { name: "Start" }).click();
    await page.waitForTimeout(3500);
    await page.keyboard.press("KeyF");
    await page.waitForTimeout(700);
    if (mode === "hover") {
      await page.keyboard.press("KeyT");
      await page.keyboard.down("Space");
      await page.waitForTimeout(1500);
      await page.keyboard.up("Space");
      await page.waitForTimeout(2500);
    } else {
      await page.keyboard.down("KeyW");
      await page.waitForTimeout(1300);
    }
    const file = resolve(out, `${ship.id}${mode === "hover" ? "-hover" : ""}.png`);
    await page.screenshot({ path: file, clip: { x: 230, y: 150, width: 500, height: 380 } });
    await page.keyboard.up("KeyW");
    shots.push({ id: ship.id, name: ship.name, file });
    await page.close();
  }
  const sheet = await browser.newPage({ viewport: { width: 1260, height: Math.ceil(shots.length / 5) * 215 + 10 } });
  const cells = shots.map((s) => `<div style="width:250px"><img style="width:250px;height:190px" src="data:image/png;base64,${readFileSync(s.file).toString("base64")}"><div>${s.id}</div></div>`).join("");
  await sheet.setContent(`<body style="margin:0;background:#111;color:#fff;font:13px sans-serif;display:flex;flex-wrap:wrap;gap:2px">${cells}</body>`);
  await sheet.screenshot({ path: resolve(out, `ships-sheet${mode === "hover" ? "-hover" : ""}.png`), fullPage: true });
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify({ ships: shots.length, errors }, null, 2));
if (errors.length) process.exitCode = 1;
