#!/usr/bin/env node
// Browser probe of the Brawler volley (owner 23.11.2026: the big Brawler fires itself and the
// pilot jumps between the ledges to get out of the line): the probe pilot changes tier
// whenever the aim line lies on its tier.
//   BCM_QA_BROWSER_CHANNEL=msedge MINISIM_QA_CHILD=scripts/ring-boss-volley-probe.mjs \
//     node scripts/minisim-standalone-qa.mjs --transitions-only
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = createRequire(resolve(root, "tools/minisim-qa/package.json"))("playwright");
const url = process.argv[process.argv.indexOf("--url") + 1];
const out = resolve(root, ".qa-artifacts/ring-boss-volley");
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
  for (let step = 1; step <= 4; step += 1) {
    await page.evaluate(() => window.__BCM_RING_BOSS_QA__.transition());
    await page.waitForFunction(() => window.__BCM_RING_BOSS_QA__.snapshot().phaseState !== "transition", null, { timeout: 20000 });
    await page.waitForTimeout(300);
  }
  const start = await snap();
  report.form = start.moveForm;
  // The pilot stands on the low ledge right under the high one (both at home-8…-5 / -6.5…-3.5).
  const home = start.homeX;
  const spot = home - 5.6;
  await page.evaluate((x) => window.__BCM_RING_BOSS_QA__.placePilot(x, 1.6), spot);
  await page.waitForTimeout(800);
  report.trace = [];
  const tiers = new Set();
  let balls = 0, lastBallCount = 0, shot = false, dodges = 0;
  for (let i = 0; i < 260; i += 1) {
    const s = await snap();
    const y = s.pilot.y, x = s.pilot.x;
    const tier = y < 0.7 ? 0 : y < 2.1 ? 1.4 : 2.8;
    if (s.pilot.y > -0.1 && Math.abs(s.pilot.vy || 0) < 0.01) tiers.add(tier);
    if (s.balls.length > lastBallCount) balls += s.balls.length - lastBallCount;
    lastBallCount = s.balls.length;
    report.trace.push({ cam: s.camera && [Math.round(s.camera.left - home), Math.round(s.camera.right - home)], bossX: Math.round((s.bossX - home) * 10) / 10, state: s.moveState, y: Math.round(y * 10) / 10, x: Math.round((x - home) * 10) / 10, hp: s.pilot.hp, aim: s.aimBand && Math.round(s.aimBand.y0 * 100) / 100, balls: s.balls.length });
    if (!shot && s.balls.length >= 1) { await page.screenshot({ path: resolve(out, "brawler-volley.png") }); shot = true; }
    // Dodge: the aim line lies on my tier → change tier.
    if (s.aimBand && y + 1.7 > s.aimBand.y0 && y < s.aimBand.y1) {
      dodges += 1;
      if (tier === 2.8) {
        // Step off the high ledge to the left, land on the low one.
        await page.keyboard.down("ArrowLeft"); await page.waitForTimeout(260); await page.keyboard.up("ArrowLeft");
      } else if (tier === 1.4) {
        // Back under the high ledge and jump straight up onto it.
        if (x - home < -6.3) { await page.keyboard.down("ArrowRight"); await page.waitForTimeout(220); await page.keyboard.up("ArrowRight"); }
        await page.keyboard.press("Space");
      } else {
        await page.keyboard.press("Space");
      }
    }
    if (s.moveState === "taunt") { report.sawTaunt = true; }
    if (report.sawTaunt && s.moveState === "advance") break;
    await page.waitForTimeout(110);
  }
  const t = report.trace;
  // Launches = entries into "fire" (a ball leaving the arena as the next one flies keeps the count flat).
  report.balls = t.filter((x, i) => x.state === "fire" && (i === 0 || t[i - 1].state !== "fire")).length;
  report.ballsSeen = balls; report.tiers = [...tiers]; report.dodges = dodges;
  report.hpLost = t.length ? t[0].hp - Math.min(...t.map((x) => x.hp)) : null;
  report.states = [...new Set(t.map((x) => x.state))];
  report.bossInFrame = t.filter((x) => ["charge", "aim", "fire"].includes(x.state)).every((x) => x.cam && x.bossX > x.cam[0] && x.bossX < x.cam[1]);
  report.status = report.form === "brawler" && report.balls >= 3 && tiers.size >= 2 && report.bossInFrame &&
    ["back", "charge", "fire", "aim", "recover", "drink", "taunt"].every((x) => report.states.includes(x)) &&
    report.errors.length === 0 ? "PASS" : "FAIL";
} catch (error) {
  report.failure = String(error && error.message || error).split("\n")[0];
  await page.screenshot({ path: resolve(out, "failure.png") }).catch(() => {});
} finally {
  await writeFile(resolve(out, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ status: report.status, failure: report.failure, errors: report.errors, balls: report.balls, tiers: report.tiers, dodges: report.dodges, hpLost: report.hpLost, states: report.states }));
