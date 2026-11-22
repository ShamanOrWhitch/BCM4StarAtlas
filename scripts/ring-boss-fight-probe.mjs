#!/usr/bin/env node
// Browser probe of the Ring boss fight (owner 22.11.2026 "Бои с боссами Ring"):
// enter the Ring, skip the Pig with the QA hook, and for each of the six forms
// record its moves (ring-boss-moves.js), the drawn tells/hazards and a frame.
//   BCM_QA_BROWSER_CHANNEL=msedge MINISIM_QA_CHILD=scripts/ring-boss-fight-probe.mjs \
//     node scripts/minisim-standalone-qa.mjs --transitions-only
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = createRequire(resolve(root, "tools/minisim-qa/package.json"))("playwright");
const url = process.argv[process.argv.indexOf("--url") + 1];
const out = resolve(root, ".qa-artifacts/ring-boss-fight");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.BCM_QA_BROWSER_CHANNEL || undefined, args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const report = { errors: [], forms: [], status: "FAIL" };
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
  for (let step = 1; step <= 6; step += 1) {
    await page.evaluate(() => window.__BCM_RING_BOSS_QA__.transition());
    await page.waitForTimeout(2700); // the transition film of the form
    const samples = [];
    let shot = false;
    for (let i = 0; i < 16; i += 1) {
      const snap = await page.evaluate(() => window.__BCM_RING_BOSS_QA__.snapshot());
      samples.push({ state: snap.moveState, vulnerable: snap.vulnerable, x: Math.round(snap.bossX * 10) / 10, zones: snap.zones, form: snap.moveForm, phase: snap.phaseIndex });
      if (!shot && snap.zones.length) {
        await page.screenshot({ path: resolve(out, `form-${step}-${snap.moveForm}.png`) });
        shot = true;
      }
      await page.waitForTimeout(450);
    }
    if (!shot) await page.screenshot({ path: resolve(out, `form-${step}-noshot.png`) });
    const form = samples.find((s) => s.form)?.form || null;
    report.forms.push({
      step, form,
      states: [...new Set(samples.map((s) => s.state).filter(Boolean))],
      zones: [...new Set(samples.flatMap((s) => s.zones))],
      opened: samples.some((s) => s.vulnerable),
      travel: Math.round((Math.max(...samples.map((s) => s.x)) - Math.min(...samples.map((s) => s.x))) * 10) / 10,
    });
  }
  const forms = report.forms.map((f) => f.form);
  report.status = forms.join(",") === "roller,walker,orbiter,brawler,runner,stalker" &&
    report.forms.every((f) => f.states.length >= 2 && f.zones.length >= 1) && report.errors.length === 0 ? "PASS" : "FAIL";
} catch (error) {
  report.failure = String(error && error.message || error).split("\n")[0];
  await page.screenshot({ path: resolve(out, "failure.png") }).catch(() => {});
} finally {
  await writeFile(resolve(out, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify(report, null, 1).slice(0, 4000));
