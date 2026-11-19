#!/usr/bin/env node
// Owner 19.11.2026: "background в Tower — основа ощущения планеты". Browser
// probe: for each planet open the game with ?bcm_planet=<id>, let the Tower
// take its landing state, and read the Tower backdrop it shows.
//   BCM_QA_BROWSER_CHANNEL=msedge MINISIM_QA_CHILD=scripts/tower-background-probe.mjs \
//     node scripts/minisim-standalone-qa.mjs --transitions-only
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = createRequire(resolve(root, "tools/minisim-qa/package.json"))("playwright");
const url = process.argv[process.argv.indexOf("--url") + 1];
const out = resolve(root, ".qa-artifacts/tower-background");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.BCM_QA_BROWSER_CHANNEL || undefined });
const report = { planets: {}, errors: [] };
try {
  for (const planet of ["first", "fable", "opus"]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on("pageerror", (e) => report.errors.push(`${planet}: ${e.message}`));
    await page.goto(url + (url.includes("?") ? "&" : "?") + "bcm_planet=" + planet, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(() => window.BCMTowerAPI && typeof window.BCMTowerAPI.enter === "function", null, { timeout: 60000 });
    report.planets[planet] = await page.evaluate(() => {
      window.BCMTowerAPI.enter({ deferHandoff: true });
      const tower = document.querySelector(".bcm-tower");
      return {
        planet: window.BCMPlanetLanding?.planetId?.() ?? null,
        towerPlanet: tower?.dataset?.bcmTowerPlanet ?? null,
        background: tower ? getComputedStyle(tower).getPropertyValue("--bcm-tower-background-image").trim() : null,
      };
    });
    await page.close();
  }
} catch (error) {
  report.failure = String(error && error.message || error).split("\n")[0];
} finally {
  await writeFile(resolve(out, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify(report, null, 1));
if (report.failure || report.errors.length) process.exitCode = 1;
