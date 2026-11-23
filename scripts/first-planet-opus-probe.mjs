#!/usr/bin/env node
// Browser probe of planet Opus (owner 23.11.2026, IDEA-026 step 1). Mount First Planet on Opus,
// board the ship, fly forward, climb, fire. The probe checks three things:
//   - the carpet HUD shows up;
//   - the ship really moves;
//   - there are no page errors.
// It also saves frames for a look.
// Run:
//   BCM_QA_BROWSER_CHANNEL=msedge MINISIM_QA_CHILD=scripts/first-planet-opus-probe.mjs \
//     node scripts/minisim-standalone-qa.mjs --transitions-only
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = createRequire(resolve(root, "tools/minisim-qa/package.json"))("playwright");
const url = process.argv[process.argv.indexOf("--url") + 1];
const out = resolve(root, ".qa-artifacts/first-planet-opus");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.BCM_QA_BROWSER_CHANNEL || undefined });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const report = { errors: [], status: "FAIL" };
page.on("pageerror", (e) => report.errors.push(e.message));
const hostText = () => page.evaluate(() => document.querySelector("#fp-opus-host").innerText);
const hold = async (keys, ms) => {
  for (const k of keys) await page.keyboard.down(k);
  await page.waitForTimeout(ms);
  for (const k of keys) await page.keyboard.up(k);
};

try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => !!window.BCMFirstPlanetConfig, null, { timeout: 30000 });
  await page.evaluate(async () => {
    const cfg = window.BCMFirstPlanetConfig;
    const link = document.createElement("link"); link.rel = "stylesheet"; link.href = cfg.styleUrl; document.head.appendChild(link);
    await new Promise((ok, bad) => { const s = document.createElement("script"); s.type = "module"; s.src = cfg.bundleUrl; s.onload = ok; s.onerror = bad; document.head.appendChild(s); });
    for (let i = 0; i < 50 && !(window.BCMFirstPlanet && window.BCMFirstPlanet.mount); i += 1) await new Promise((r) => setTimeout(r, 100));
    const host = document.createElement("div");
    host.id = "fp-opus-host";
    host.style.cssText = "position:fixed;inset:0;z-index:99999;background:#000";
    document.body.appendChild(host);
    await window.BCMFirstPlanet.mount(host, { planet: "opus", planetSeed: 7, raceSeed: 5, mode: "single" });
  });
  await page.waitForTimeout(3000);
  await page.locator("#fp-opus-host button", { hasText: "Start" }).first().click({ timeout: 10000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: resolve(out, "01-pad.png") });
  report.region = (await hostText()).split("\n")[0];
  await hold(["KeyF"], 150);
  await page.waitForTimeout(1500);
  const boarded = await hostText();
  report.boarded = /Корабль/.test(boarded);
  report.hud = /Энергия/.test(boarded);
  await hold(["KeyW"], 14000);
  await page.screenshot({ path: resolve(out, "02-forward.png") });
  report.qa = await page.evaluate(() => {
    const sim = window.__BCM_ISLAND_QA__ && window.__BCM_ISLAND_QA__.sim;
    if (!sim) return null;
    const near = sim.walls.filter((b) => Math.abs((b.minX + b.maxX) / 2 - sim.x) < 6 && Math.abs((b.minZ + b.maxZ) / 2 - sim.z) < 6);
    return { x: sim.x, y: sim.y, z: sim.z, yaw: sim.yaw, speed: sim.speed, mode: sim.mode, near };
  });
  const flying = await hostText();
  report.speedText = (flying.match(/(\d+) м\/с · (-?\d+) м/) || []).slice(1).map(Number);
  await hold(["KeyW", "KeyA"], 4000);
  await page.screenshot({ path: resolve(out, "03-bank.png") });
  await hold(["Space"], 9000);
  const climbed = await hostText();
  report.altAfterClimb = Number((climbed.match(/м\/с · (-?\d+) м/) || [])[1]);
  report.energyAfterClimb = Number((climbed.match(/Энергия (\d+)/) || [])[1]);
  await page.screenshot({ path: resolve(out, "04-high.png") });
  await hold(["KeyX"], 120);
  await page.waitForTimeout(200);
  await page.screenshot({ path: resolve(out, "05-fire.png") });
  report.status = report.boarded && report.hud && report.qa && report.qa.speed > 3 && report.altAfterClimb > report.speedText[1] && report.errors.length === 0 ? "PASS" : "FAIL";
} catch (error) {
  report.failure = String(error && error.message || error).split("\n")[0];
  await page.screenshot({ path: resolve(out, "failure.png") }).catch(() => {});
} finally {
  await writeFile(resolve(out, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify(report));
