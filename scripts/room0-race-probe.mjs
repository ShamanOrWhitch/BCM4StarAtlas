#!/usr/bin/env node
// Browser probe of the Room 0 race (IDEA-021): fly back through the capdoor,
// enter the race, and record the course, the rivals and the status line.
//   BCM_QA_BROWSER_CHANNEL=msedge MINISIM_QA_CHILD=scripts/room0-race-probe.mjs \
//     node scripts/minisim-standalone-qa.mjs --transitions-only
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = createRequire(resolve(root, "tools/minisim-qa/package.json"))("playwright");
const url = process.argv[process.argv.indexOf("--url") + 1];
const out = resolve(root, ".qa-artifacts/room0-race");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.BCM_QA_BROWSER_CHANNEL || undefined });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const report = { errors: [], frames: [] };
page.on("pageerror", (e) => report.errors.push(e.message));
const snap = async (label) => {
  const s = await page.evaluate(() => {
    const scene = window.BCMiniSimAPI?.getRuntime?.()?.scene;
    let pylons = 0, rivals = 0;
    const rivalPos = [];
    scene?.traverse((o) => {
      if (o.name === "room0-pylon" && o.parent?.visible !== false) pylons += 1;
      if (o.name === "room0-rival") { rivals += 1; rivalPos.push([o.position.x, o.position.y, o.position.z].map((v) => Math.round(v))); }
    });
    return { status: document.querySelector(".bcm-mini-sim-status")?.textContent || "", pylons, rivals, rivalPos };
  });
  await page.screenshot({ path: resolve(out, label + ".png") });
  report.frames.push({ label, ...s });
};
try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.locator(".bcm-mini-sim-start").first().click({ timeout: 20000 });
  await page.locator("[data-crew-start]").first().click({ timeout: 20000 });
  await page.waitForFunction(() => document.querySelector(".bcm-mini-sim")?.classList.contains("game-active"), null, { timeout: 40000 });
  await page.waitForTimeout(1500);
  await page.keyboard.down("KeyS");
  await page.waitForFunction(() => /ROOM 0|ТРАССА|SLIPSTREAM/.test(document.querySelector(".bcm-mini-sim-status")?.textContent || ""), null, { timeout: 30000 });
  await page.keyboard.up("KeyS");
  await page.waitForTimeout(1500);
  await snap("01-start");
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(3000);
  await snap("02-racing");
  await page.waitForTimeout(3000);
  await snap("03-racing");
  await page.keyboard.up("KeyW");
} catch (error) {
  report.failure = String(error && error.message || error).split("\n")[0];
  await page.screenshot({ path: resolve(out, "failure.png") }).catch(() => {});
} finally {
  await writeFile(resolve(out, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify(report, null, 1).slice(0, 3000));
