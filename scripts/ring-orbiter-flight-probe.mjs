#!/usr/bin/env node
// Browser probe of the Orbiter flight (owner 22.11.2026 "Полёт в фазе Орбиты"):
// enter the Ring, skip to the Orbiter with the QA hook, tap jump about once a
// second (Balloon flight, ~62 BPM) and record height, jet, breath, flame, clots, bubbles.
//   BCM_QA_BROWSER_CHANNEL=msedge MINISIM_QA_CHILD=scripts/ring-orbiter-flight-probe.mjs \
//     node scripts/minisim-standalone-qa.mjs --transitions-only
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = createRequire(resolve(root, "tools/minisim-qa/package.json"))("playwright");
const url = process.argv[process.argv.indexOf("--url") + 1];
const out = resolve(root, ".qa-artifacts/ring-orbiter-flight");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.BCM_QA_BROWSER_CHANNEL || undefined, args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const report = { errors: [], samples: [], status: "FAIL" };
page.on("pageerror", (error) => report.errors.push(error.message));
try {
  await page.goto(url + (url.includes("?") ? "&" : "?") + "bcm_qa_warp_nodamage=1&bcm_qa_ring_boss=1", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.locator(".bcm-mini-sim-start").first().click({ timeout: 20000 });
  await page.locator("[data-crew-start]").first().click({ timeout: 20000 });
  await page.waitForFunction(() => document.querySelector(".bcm-mini-sim")?.classList.contains("game-active") && !!window.BCMiniSimAPI, null, { timeout: 40000 });
  await page.waitForTimeout(1000);
  await page.keyboard.press("V");
  await page.locator(".bcm-warp-overlay:not([hidden])").first().waitFor({ state: "visible", timeout: 15000 });
  const cells = page.locator("[data-warp-grid] .bcm-warp-grid-cell.is-connected");
  await cells.first().waitFor({ state: "visible", timeout: 15000 });
  const labels = await cells.evaluateAll((list) => list.map((el) => el.textContent.replace(/\s+/g, " ")));
  const pick = Math.max(0, labels.findIndex((text) => !/Fable|Opus|Twinsun|ONI|Pearce|Ioki/i.test(text)));
  await cells.nth(pick).click({ force: true });
  await page.locator("[data-warp-start]").click();
  await page.locator("[data-tube-abort]").waitFor({ state: "visible", timeout: 90000 });
  await page.waitForTimeout(5000);
  await page.evaluate(() => {
    const runtime = window.BCMiniSimAPI.getRuntime();
    let beacon = null;
    runtime.scene.traverse((object) => { if (object.name === "return-warp-beacon") beacon = object; });
    const position = new runtime.ship.position.constructor();
    beacon.getWorldPosition(position);
    runtime.ship.position.copy(position);
  });
  await page.waitForFunction(() => !!document.getElementById("bcm-ring-platformer"), null, { timeout: 60000 });
  await page.waitForTimeout(1000);
  await page.locator("#bcm-ring-platformer [data-ring-single]").click({ timeout: 10000 });
  await page.waitForTimeout(4000);
  for (let step = 1; step <= 3; step += 1) {
    await page.evaluate(() => window.__BCM_RING_BOSS_QA__.transition());
    await page.waitForTimeout(2700);
  }
  report.before = await page.evaluate(() => window.__BCM_RING_BOSS_QA__.snapshot());
  let shot = false;
  for (let i = 0; i < 12; i += 1) {
    await page.keyboard.down("Space");
    await page.waitForTimeout(90);
    const snap = await page.evaluate(() => window.__BCM_RING_BOSS_QA__.snapshot());
    await page.keyboard.up("Space");
    report.samples.push({ y: Math.round(snap.pilot.y * 100) / 100, jet: snap.pilot.jet, air: snap.pilot.air, flame: snap.pilot.flame,
      flight: snap.pilot.bossFlight, form: snap.moveForm, bubbles: snap.bubbles, zones: snap.zones });
    if (!shot && snap.pilot.y > 1.5) { await page.screenshot({ path: resolve(out, "orbiter-flight.png") }); shot = true; }
    await page.waitForTimeout(560);
  }
  if (!shot) await page.screenshot({ path: resolve(out, "orbiter-flight-ground.png") });
  const s = report.samples;
  report.maxY = Math.max(...s.map((x) => x.y));
  report.minJet = Math.min(...s.map((x) => x.jet));
  report.flameSeen = s.some((x) => x.flame);
  report.sparks = s.some((x) => x.zones.some((z) => z === "ring-boss-hazard-spark"));
  report.status = report.before.moveForm === "orbiter" && report.before.flight && s.every((x) => x.flight) &&
    report.maxY > 2.5 && report.minJet < 100 && report.flameSeen && report.sparks &&
    s.some((x) => x.bubbles >= 3) && report.errors.length === 0 ? "PASS" : "FAIL";
} catch (error) {
  report.failure = String(error && error.message || error).split("\n")[0];
  await page.screenshot({ path: resolve(out, "failure.png") }).catch(() => {});
} finally {
  await writeFile(resolve(out, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ status: report.status, failure: report.failure, maxY: report.maxY, minJet: report.minJet, flameSeen: report.flameSeen, sparks: report.sparks, errors: report.errors, form: report.before?.moveForm, samples: report.samples.map((x) => [x.y, Math.round(x.jet), Math.round(x.air), x.flame, x.bubbles]) }, null, 1));
