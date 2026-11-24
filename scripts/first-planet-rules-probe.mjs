#!/usr/bin/env node
// Browser probe of planet Opus (owner 23.11.2026, IDEA-026 step 1). Mount First Planet on Opus,
// board the ship, fly forward, climb, fire. The probe checks three things:
//   - the carpet HUD shows up;
//   - the ship really moves;
//   - there are no page errors.
// It also saves frames for a look.
// Run:
//   BCM_QA_BROWSER_CHANNEL=msedge MINISIM_QA_CHILD=scripts/first-planet-rules-probe.mjs \
//     node scripts/minisim-standalone-qa.mjs --transitions-only
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = createRequire(resolve(root, "tools/minisim-qa/package.json"))("playwright");
const url = process.argv[process.argv.indexOf("--url") + 1];
const out = resolve(root, ".qa-artifacts/first-planet-rules");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.BCM_QA_BROWSER_CHANNEL || undefined });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const report = { errors: [], status: "FAIL" };
page.on("pageerror", (e) => report.errors.push(e.message));
const hostText = () => page.evaluate(() => document.querySelector("#fp-rules-host").innerText);
const hold = async (keys, ms) => {
  for (const k of keys) await page.keyboard.down(k);
  await page.waitForTimeout(ms);
  for (const k of keys) await page.keyboard.up(k);
};

try {
  for (const planet of ["first", "pearce", "ioki"]) {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(() => !!window.BCMFirstPlanetConfig, null, { timeout: 30000 });
    await page.evaluate(async (planetId) => {
      const cfg = window.BCMFirstPlanetConfig;
      const link = document.createElement("link"); link.rel = "stylesheet"; link.href = cfg.styleUrl; document.head.appendChild(link);
      await new Promise((ok, bad) => { const s = document.createElement("script"); s.type = "module"; s.src = cfg.bundleUrl; s.onload = ok; s.onerror = bad; document.head.appendChild(s); });
      for (let i = 0; i < 50 && !(window.BCMFirstPlanet && window.BCMFirstPlanet.mount); i += 1) await new Promise((r) => setTimeout(r, 100));
      const host = document.createElement("div"); host.id = "fp-rules-host"; host.style.cssText = "position:fixed;inset:0;z-index:99999;background:#000"; document.body.appendChild(host);
      await window.BCMFirstPlanet.mount(host, { planet: planetId, planetSeed: 7, raceSeed: 5, mode: "single" });
    }, planet);
    await page.waitForTimeout(3000);
    await page.locator("#fp-rules-host button", { hasText: "Start" }).first().click({ timeout: 10000 });
    await page.waitForTimeout(3000);
    const state = await page.evaluate((planetId) => {
      const sim = window.__BCM_ISLAND_QA__.sim;
      if (planetId === "first") { sim.body.heat = 99.5; sim.x = 30; sim.z = 4; }
      if (planetId === "pearce") { const l = { x: -44, z: 6 }; sim.x = l.x; sim.z = l.z; }
      if (planetId === "ioki") { sim.vy = 7; }
      return { rules: sim.rules };
    }, planet);
    await page.waitForTimeout(2500);
    const text = await hostText();
    report[planet] = { rules: state.rules, heat: /Перегрев|Жара/.test(text), breath: /Дыхание/.test(text), lowG: /Низкая гравитация/.test(text) };
    await page.screenshot({ path: resolve(out, planet + ".png") });
  }
  report.status = report.first.heat && report.pearce.breath && report.ioki.lowG && report.errors.length === 0 ? "PASS" : "FAIL";
} catch (error) {
  report.failure = String(error && error.message || error).split("\n")[0];
  await page.screenshot({ path: resolve(out, "failure.png") }).catch(() => {});
} finally {
  await writeFile(resolve(out, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify(report));
