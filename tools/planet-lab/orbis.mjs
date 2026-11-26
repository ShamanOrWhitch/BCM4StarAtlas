#!/usr/bin/env node
// Planet Lab, Orbis (IDEA-033): the sphere planet — the captain's briefing, the flight, a tower under fire,
// the loot, the shielded fortress and the castle. Output: .qa-artifacts/planet-lab/orbis/
//   BCM_QA_BROWSER_CHANNEL=msedge node tools/planet-lab/orbis.mjs
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const out = resolve(root, ".qa-artifacts/planet-lab/orbis");
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

const browser = await chromium.launch({ channel: process.env.BCM_QA_BROWSER_CHANNEL || undefined });
const report = { pageErrors: [], consoleErrors: [], shots: [] };
const shot = async (page, name) => { await page.screenshot({ path: resolve(out, name + ".png") }); report.shots.push(name); };
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (e) => report.pageErrors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") report.consoleErrors.push(m.text()); });
  await page.goto(`${base}?planet=orbis&species=Human`);
  await page.waitForFunction(() => window.__planetLab.ready || window.__planetLab.error, null, { timeout: 60000 }).catch((e) => { report.readyTimeout = String(e).slice(0, 80); });
  if (report.readyTimeout) throw new Error("not ready: " + JSON.stringify(report.pageErrors.concat(report.consoleErrors)).slice(0, 900));
  report.labError = await page.evaluate(() => window.__planetLab.error || null);
  const start = page.getByRole("button", { name: "Start" });
  if (await start.count()) await start.click().catch(() => {});
  await page.locator("[data-orbis-briefing]").waitFor({ timeout: 30000 });
  await page.waitForTimeout(800);
  await shot(page, "01-briefing");
  await page.locator('[data-orbis-ship="lancer"]').click();
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(2500);
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(900);
  await page.keyboard.up("KeyD");
  await page.waitForTimeout(1200);
  await page.keyboard.up("KeyW");
  await shot(page, "02-flight");
  // QA: stand the ship 22 m from the first tower, nose on it, and fire.
  const placeBy = (targetPath, back, height) => page.evaluate(({ targetPath, back, height }) => {
    const g = window.__BCM_ORBIS_QA__.game;
    const s = g.state;
    const target = targetPath === "fortress" ? s.fortress.at : targetPath === "home" ? s.ground({ x: 0, y: 1, z: 0 }, 0) : s.towers[0].at;
    const r = Math.hypot(target.x, target.y, target.z);
    const n = { x: target.x / r, y: target.y / r, z: target.z / r };
    // A point "back" metres away over the surface, towards the north (or the south for home).
    const ref = targetPath === "home" ? { x: 0.3, y: 0.9, z: 0.3 } : { x: 0, y: 1, z: 0 };
    let t = { x: ref.x - n.x * (ref.x * n.x + ref.y * n.y + ref.z * n.z), y: ref.y - n.y * (ref.x * n.x + ref.y * n.y + ref.z * n.z), z: ref.z - n.z * (ref.x * n.x + ref.y * n.y + ref.z * n.z) };
    const tl = Math.hypot(t.x, t.y, t.z) || 1; t = { x: t.x / tl, y: t.y / tl, z: t.z / tl };
    const a = back / 140;
    const m = { x: n.x * Math.cos(a) + t.x * Math.sin(a), y: n.y * Math.cos(a) + t.y * Math.sin(a), z: n.z * Math.cos(a) + t.z * Math.sin(a) };
    const p = s.ground(m, height);
    s.ship.position = p;
    s.ship.velocity = { x: 0, y: 0, z: 0 };
    const pr = Math.hypot(p.x, p.y, p.z);
    const up = { x: p.x / pr, y: p.y / pr, z: p.z / pr };
    let f = { x: target.x - p.x, y: target.y - p.y, z: target.z - p.z };
    const fd = f.x * up.x + f.y * up.y + f.z * up.z;
    f = { x: f.x - up.x * fd, y: f.y - up.y * fd, z: f.z - up.z * fd };
    const fl = Math.hypot(f.x, f.y, f.z) || 1;
    s.ship.forward = { x: f.x / fl, y: f.y / fl, z: f.z / fl };
    s.ship.up = up;
    s.ship.hold = height;
    return true;
  }, { targetPath, back, height });
  await placeBy("tower", 22, 3.2);
  await page.waitForTimeout(300);
  await page.keyboard.down("Space");
  await page.waitForTimeout(700);
  await shot(page, "03-tower-fire");
  await page.waitForTimeout(2500);
  await page.keyboard.up("Space");
  await shot(page, "04-tower-down-loot");
  report.afterTower = await page.evaluate(() => { const s = window.__BCM_ORBIS_QA__.game.state; return { towerHp: s.towers[0].hp, drops: s.drops.length, hold: s.hold.length }; });
  await placeBy("fortress", 60, 9);
  await page.waitForTimeout(900);
  await shot(page, "05-fortress-shield");
  await page.evaluate(() => Object.assign(window.__BCM_ORBIS_QA__.game.state.materials, { board: 10, crate: 10, barrel: 10, backpack: 10 }));
  await placeBy("home", 30, 8);
  await page.waitForTimeout(1200);
  await shot(page, "06-castle");
  report.castle = await page.evaluate(() => window.__BCM_ORBIS_QA__.game.state.castle);
  await page.close();
} finally {
  await browser.close();
  server.close();
  await writeFile(resolve(out, "report.json"), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 1));
