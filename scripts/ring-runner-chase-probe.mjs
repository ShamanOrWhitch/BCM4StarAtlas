#!/usr/bin/env node
// Browser probe of the Runner chase (owner 23.11.2026 "Погоня Гонщика"): skip to the
// Runner with the QA hook; the chase must board Opal Jetjet, run lanes and obstacles
// behind the Jetjet, and take laser shots in its windows.
//   BCM_QA_BROWSER_CHANNEL=msedge MINISIM_QA_CHILD=scripts/ring-runner-chase-probe.mjs \
//     node scripts/minisim-standalone-qa.mjs --transitions-only
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = createRequire(resolve(root, "tools/minisim-qa/package.json"))("playwright");
const url = process.argv[process.argv.indexOf("--url") + 1];
const out = resolve(root, ".qa-artifacts/ring-runner-chase");
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
  // Pig -> Roller -> Walker -> Orbiter -> Brawler -> Runner: five transitions.
  for (let step = 1; step <= 5; step += 1) {
    await page.evaluate(() => window.__BCM_RING_BOSS_QA__.transition());
    await page.waitForFunction(() => window.__BCM_RING_BOSS_QA__.snapshot().phaseState !== "transition", null, { timeout: 20000 }); await page.waitForTimeout(400); // transformation video (up to 5 s)
  }
  const snap = () => page.evaluate(() => window.__BCM_RING_BOSS_QA__.snapshot());
  await page.waitForFunction(() => !!window.__BCM_RING_BOSS_QA__.snapshot().chase, null, { timeout: 10000 });
  report.start = await snap();
  await page.screenshot({ path: resolve(out, "chase-boarding.png") });
  await page.waitForTimeout(1600);
  // Drive: step lanes, hop, boost and fire in the windows for about 25 s.
  const lanes = new Set();
  let shot = false;
  for (let i = 0; i < 70; i += 1) {
    const s = await snap();
    if (!s.chase) { report.endedAt = i; break; }
    report.samples.push({ phase: s.chase.phase, lane: s.chase.lane, gap: Math.round(s.chase.gap * 10) / 10, boss: s.chase.bossState,
      open: s.chase.vulnerable, obstacles: s.chase.obstacles, hits: s.chase.hits, shots: s.chase.shots, landed: s.chase.landed, hp: s.hp });
    lanes.add(s.chase.lane);
    if (i % 9 === 3) await page.keyboard.press(i % 18 === 3 ? "ArrowLeft" : "ArrowRight");
    if (i % 7 === 0) await page.keyboard.press("Space");
    if (s.chase.vulnerable) { await page.keyboard.press("ShiftLeft"); await page.keyboard.press("KeyQ"); }
    if (!shot && s.chase.phase === "chase" && s.chase.obstacles > 1) {
      await page.screenshot({ path: resolve(out, "chase-road.png") });
      shot = true;
    }
    await page.waitForTimeout(300);
  }
  // Beating the Runner ends the chase: the Stalker starts back in the 2.5D arena.
  await page.evaluate(() => window.__BCM_RING_BOSS_QA__.transition());
  await page.waitForFunction(() => window.__BCM_RING_BOSS_QA__.snapshot().phaseState !== "transition", null, { timeout: 20000 }); await page.waitForTimeout(400); // Runner -> Stalker video
  report.end = await snap();
  await page.screenshot({ path: resolve(out, "after-chase-stalker.png") });
  report.backInArena = !report.end.chase && report.end.phaseIndex === 6 && report.end.moveForm === "stalker";
  const last = report.samples.at(-1) || {};
  report.lanes = [...lanes];
  report.status = report.start.chase && report.start.chase.phase === "board" && report.start.chase.cameraBehind &&
    report.samples.some((x) => x.phase === "chase" && x.obstacles > 0) && lanes.size >= 2 &&
    report.samples.some((x) => x.open) && (last.shots || 0) > 0 && (last.landed || 0) > 0 && report.backInArena && report.errors.length === 0 ? "PASS" : "FAIL";
} catch (error) {
  report.failure = String(error && error.message || error).split("\n")[0];
  await page.screenshot({ path: resolve(out, "failure.png") }).catch(() => {});
} finally {
  await writeFile(resolve(out, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ status: report.status, failure: report.failure, errors: report.errors, start: report.start && report.start.chase,
  end: report.end && { phase: report.end.phaseIndex, form: report.end.moveForm, chase: report.end.chase }, lanes: report.lanes,
  samples: report.samples.map((x) => [x.phase[0], x.lane, x.gap, x.boss, x.open ? "OPEN" : "", x.obstacles, x.hits, x.shots, x.landed].join(" ")) }, null, 1));
