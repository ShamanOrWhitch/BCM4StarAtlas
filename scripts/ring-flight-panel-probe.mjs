#!/usr/bin/env node
// Browser probe of the flight panel (owner 23.11.2026: a jetpack crossing on the way to the
// boss): enter a purple cell, walk into the abyss and come back on the pad, then fly with a
// tap about a second.
//   BCM_QA_BROWSER_CHANNEL=msedge MINISIM_QA_CHILD=scripts/ring-flight-panel-probe.mjs \
//     node scripts/minisim-standalone-qa.mjs --transitions-only
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = createRequire(resolve(root, "tools/minisim-qa/package.json"))("playwright");
const url = process.argv[process.argv.indexOf("--url") + 1];
const out = resolve(root, ".qa-artifacts/ring-flight-panel");
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
  const fsnap = () => page.evaluate(() => window.__BCM_RING_BOSS_QA__.flightSnapshot());
  report.enter = await page.evaluate(() => window.__BCM_RING_BOSS_QA__.enterFlightCell());
  await page.waitForTimeout(600);
  await page.screenshot({ path: resolve(out, "flight-panel-enter.png") });
  // 1. Walk into the abyss without the jet: the pilot falls and comes back on the pad.
  const pad = await fsnap();
  await page.keyboard.down("ArrowRight");
  let fell = null;
  for (let i = 0; i < 30 && !fell; i += 1) {
    await page.waitForTimeout(120);
    const s = await fsnap();
    if (s.y < -0.3) fell = s;
  }
  await page.keyboard.up("ArrowRight");
  await page.waitForTimeout(1200);
  const back = await fsnap();
  report.fall = { padHp: pad.hp, fell: !!fell, backX: back.x, backY: back.y, hp: back.hp, pops: back.pops };
  // 2. Fly: hold right and hold the jet in pulses; record height and gates.
  await page.waitForTimeout(1200);
  const before = await fsnap();
  report.flight = { start: before, samples: [] };
  await page.keyboard.down("ArrowRight");
  let shot = false;
  for (let i = 0; i < 24; i += 1) {
    // 24.11.2026: the jet is held — hold it two thirds of each second, let go for one third.
    if (i % 3 === 0) await page.keyboard.down("Space");
    if (i % 3 === 2) await page.keyboard.up("Space");
    await page.waitForTimeout(330);
    const s = await fsnap();
    report.flight.samples.push({ x: Math.round(s.x * 10) / 10, y: Math.round(s.y * 100) / 100, vy: Math.round(s.vy * 100) / 100, jet: s.jet, hp: s.hp, inPanel: s.inPanel });
    if (!shot && s.x > -4 && s.y > 0.8) { await page.screenshot({ path: resolve(out, "flight-panel-air.png") }); shot = true; }
  }
  await page.keyboard.up("ArrowRight");
  const fs2 = report.flight.samples;
  // inPanel is set by the next game frame; the flight samples below check it.
  report.status = report.enter && report.enter.flight && report.enter.gates.length >= 2 &&
    report.fall.fell && report.fall.backY > -0.05 && report.fall.backX < report.enter.pit[0] && report.fall.hp < report.fall.padHp &&
    fs2.some((s) => s.y > 1) && fs2.every((s) => s.inPanel) && Math.min(...fs2.map((s) => s.jet)) < 100 &&
    report.errors.length === 0 ? "PASS" : "FAIL";
} catch (error) {
  report.failure = String(error && error.message || error).split("\n")[0];
  await page.screenshot({ path: resolve(out, "failure.png") }).catch(() => {});
} finally {
  await writeFile(resolve(out, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ status: report.status, failure: report.failure, errors: report.errors, enter: report.enter, fall: report.fall,
  flight: report.flight && report.flight.samples.map((s) => [s.x, s.y, s.jet, s.hp].join(" ")) }, null, 1).slice(0, 3500));
