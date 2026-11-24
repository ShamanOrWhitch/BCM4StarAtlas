#!/usr/bin/env node
// Probe: the Warp map shows the Star Atlas lore names of the sectors (owner 24.11.2026).
//   BCM_QA_BROWSER_CHANNEL=msedge MINISIM_QA_CHILD=scripts/warp-lore-names-probe.mjs \
//     node scripts/minisim-standalone-qa.mjs --transitions-only
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = createRequire(resolve(root, "tools/minisim-qa/package.json"))("playwright");
const url = process.argv[process.argv.indexOf("--url") + 1];
const out = resolve(root, ".qa-artifacts/warp-lore");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.BCM_QA_BROWSER_CHANNEL || undefined, args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const report = { errors: [], status: "FAIL" };
page.on("pageerror", (e) => report.errors.push(e.message));
try {
  await page.goto(url + (url.includes("?") ? "&" : "?") + "bcm_qa_warp_nodamage=1", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.locator(".bcm-mini-sim-start").first().click({ timeout: 20000 });
  await page.locator("[data-crew-start]").first().click({ timeout: 20000 });
  await page.waitForFunction(() => document.querySelector(".bcm-mini-sim")?.classList.contains("game-active") && !!window.BCMiniSimAPI, null, { timeout: 40000 });
  await page.waitForTimeout(1000);
  await page.keyboard.press("V");
  await page.locator(".bcm-warp-overlay:not([hidden])").first().waitFor({ state: "visible", timeout: 15000 });
  await page.waitForTimeout(1500);
  const text = await page.locator(".bcm-warp-overlay:not([hidden])").first().innerText();
  report.lore = ["Night Window", "Segal", "Evernat", "Glowhaven", "Free Harbors", "Everstorm", "Coral Nebula"].filter((n) => text.includes(n));
  report.coreLore = await page.evaluate(() => window.BCMSageMapCore.sectorTitle(-47, 30));
  await page.screenshot({ path: resolve(out, "warp-map.png") });
  report.status = report.coreLore === "Night Window · ONI-5 [-47, 30]" && report.errors.length === 0 ? "PASS" : "FAIL";
} catch (error) {
  report.failure = String(error && error.message || error).split("\n")[0];
  await page.screenshot({ path: resolve(out, "failure.png") }).catch(() => {});
} finally {
  await writeFile(resolve(out, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify(report));
