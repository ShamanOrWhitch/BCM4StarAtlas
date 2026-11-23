#!/usr/bin/env node
// Phone probe of First Planet and Shoal Race touch controls (owner 23.11.2026: "у нас нет
// никакого управления у телефонов ни у First Planet, ни у гонок"). A landscape Android
// phone (Pixel 7, touch): mount First Planet, walk with the stick, then race on the pad.
//   BCM_QA_BROWSER_CHANNEL=msedge MINISIM_QA_CHILD=scripts/first-planet-touch-probe.mjs \
//     node scripts/minisim-standalone-qa.mjs --transitions-only
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { chromium, devices } = createRequire(resolve(root, "tools/minisim-qa/package.json"))("playwright");
const url = process.argv[process.argv.indexOf("--url") + 1];
const out = resolve(root, ".qa-artifacts/first-planet-touch");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.BCM_QA_BROWSER_CHANNEL || undefined });
const ctx = await browser.newContext({ ...devices["Pixel 7"], viewport: { width: 915, height: 412 } });
const page = await ctx.newPage();
const report = { errors: [], status: "FAIL" };
page.on("pageerror", (e) => report.errors.push(e.message));

async function mount(planet) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => !!window.BCMFirstPlanetConfig, null, { timeout: 30000 });
  await page.evaluate(async (planetId) => {
    const cfg = window.BCMFirstPlanetConfig;
    const link = document.createElement("link"); link.rel = "stylesheet"; link.href = cfg.styleUrl; document.head.appendChild(link);
    await new Promise((ok, bad) => { const s = document.createElement("script"); s.type = "module"; s.src = cfg.bundleUrl; s.onload = ok; s.onerror = bad; document.head.appendChild(s); });
    for (let i = 0; i < 50 && !(window.BCMFirstPlanet && window.BCMFirstPlanet.mount); i += 1) await new Promise((r) => setTimeout(r, 100));
    const host = document.createElement("div");
    host.id = "fp-touch-host";
    host.style.cssText = "position:fixed;inset:0;z-index:99999;background:#000";
    document.body.appendChild(host);
    await window.BCMFirstPlanet.mount(host, { planet: planetId, planetSeed: 7, raceSeed: 5, mode: "single" });
  }, planet);
  await page.waitForTimeout(3000);
}
const speedText = () => page.evaluate(() => {
  const m = (document.querySelector("#fp-touch-host").innerText.match(/(-?\d+(?:[.,]\d+)?)\s*м\/с/) || [])[1];
  return m ? Number(m.replace(",", ".")) : null;
});

try {
  // 1. The island: pad shown, the stick walks the pilot.
  await mount("first");
  await page.locator("#fp-touch-host button", { hasText: "Start" }).first().click({ timeout: 10000 });
  await page.waitForTimeout(3500);
  report.island = {
    pad: await page.locator("#fp-touch-host [data-bcm-touch-pad]").count(),
    stick: await page.locator("#fp-touch-host [data-bcm-touch-stick]").count(),
    buttons: await page.locator("#fp-touch-host [data-bcm-touch-button]").count(),
    speedBefore: await speedText(),
  };
  const stick = await page.locator("#fp-touch-host [data-bcm-touch-stick]").boundingBox();
  const cx = stick.x + stick.width / 2, cy = stick.y + stick.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx, cy - 50, { steps: 4 });
  let best = 0;
  for (let i = 0; i < 10; i += 1) { await page.waitForTimeout(250); best = Math.max(best, (await speedText()) || 0); }
  await page.screenshot({ path: resolve(out, "island-stick.png") });
  await page.mouse.up();
  report.island.speedWhileStick = best;
  // 2. The race: pad shown, the throttle drives.
  await mount("first");
  await page.locator("#fp-touch-host button", { hasText: "Сразу к гонке" }).first().click({ timeout: 10000 });
  await page.waitForTimeout(2500);
  await page.locator("#fp-touch-host button", { hasText: "Start" }).first().click({ timeout: 15000 }); // the race gate
  await page.waitForFunction(() => !!document.querySelector("#fp-touch-host [data-bcm-touch-button='KeyW']"), null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(4500); // countdown
  const carSpeed = () => page.evaluate(() => (window.__controlsTest && window.__controlsTest.getSpeed ? window.__controlsTest.getSpeed() : null));
  report.race = { pad: await page.locator("#fp-touch-host [data-bcm-touch-pad]").count(), speedBefore: await carSpeed() };
  const gas = await page.locator("#fp-touch-host [data-bcm-touch-button='KeyW']").boundingBox();
  await page.mouse.move(gas.x + gas.width / 2, gas.y + gas.height / 2);
  await page.mouse.down();
  let raceBest = 0;
  for (let i = 0; i < 12; i += 1) { await page.waitForTimeout(250); raceBest = Math.max(raceBest, (await carSpeed()) || 0); }
  await page.screenshot({ path: resolve(out, "race-gas.png") });
  await page.mouse.up();
  report.race.speedWhileGas = raceBest;
  report.status = report.island.pad === 1 && report.island.stick === 1 && report.island.speedWhileStick > 0.5 &&
    report.race.pad === 1 && report.race.speedWhileGas > 1 && report.errors.length === 0 ? "PASS" : "FAIL";
} catch (error) {
  report.failure = String(error && error.message || error).split("\n")[0];
  await page.screenshot({ path: resolve(out, "failure.png") }).catch(() => {});
} finally {
  await writeFile(resolve(out, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify(report));
