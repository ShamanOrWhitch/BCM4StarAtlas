#!/usr/bin/env node
// Browser probe of the Ring boss arc (owner 23.11.2026): only the last Pig turns into
// the forms, a first Pig dies plainly, nothing of the Pig stays over the forms and the
// form art is lit as drawn.
//   BCM_QA_BROWSER_CHANNEL=msedge MINISIM_QA_CHILD=scripts/ring-boss-arc-probe.mjs \
//     node scripts/minisim-standalone-qa.mjs --transitions-only
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = createRequire(resolve(root, "tools/minisim-qa/package.json"))("playwright");
const url = process.argv[process.argv.indexOf("--url") + 1];
const out = resolve(root, ".qa-artifacts/ring-boss-arc");
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
  const snap = () => page.evaluate(() => window.__BCM_RING_BOSS_QA__.snapshot());
  report.startBosses = (await snap()).bosses;
  // 1. A first Pig is a plain fight: one more hit and it is gone, no forms.
  report.firstPig = await page.evaluate(() => window.__BCM_RING_BOSS_QA__.strike(0));
  await page.waitForTimeout(600);
  // 2. The last Pig starts the forms; nothing of the Pig stays over the Roller.
  await page.evaluate(() => window.__BCM_RING_BOSS_QA__.transition());
  await page.waitForTimeout(3500);
  const roller = await snap();
  report.roller = { phase: roller.phaseIndex, form: roller.moveForm, pigVisible: roller.pigVisible, shellVisible: roller.shellVisible,
    ringVisible: roller.ringVisible, formArtLit: roller.formArtLit, bosses: roller.bosses };
  await page.screenshot({ path: resolve(out, "roller-after-pig.png") });
  for (let step = 2; step <= 3; step += 1) {
    await page.evaluate(() => window.__BCM_RING_BOSS_QA__.transition());
    await page.waitForTimeout(3500);
  }
  const orbiter = await snap();
  report.orbiter = { phase: orbiter.phaseIndex, shellVisible: orbiter.shellVisible, formArtLit: orbiter.formArtLit };
  await page.screenshot({ path: resolve(out, "orbiter.png") });
  const final = report.startBosses.length - 1;
  report.status = report.firstPig && report.firstPig.alive === false && report.firstPig.phaseIndex === 0 &&
    report.startBosses.every((b, i) => b.hasPhases === (i === final)) &&
    report.roller.phase === 1 && !report.roller.pigVisible && report.roller.shellVisible === 0 && !report.roller.ringVisible &&
    report.roller.formArtLit === 1 && report.orbiter.shellVisible === 0 && report.orbiter.formArtLit === 1 &&
    report.errors.length === 0 ? "PASS" : "FAIL";
} catch (error) {
  report.failure = String(error && error.message || error).split("\n")[0];
  await page.screenshot({ path: resolve(out, "failure.png") }).catch(() => {});
} finally {
  await writeFile(resolve(out, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify(report, null, 1).slice(0, 3000));
