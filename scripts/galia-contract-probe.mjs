#!/usr/bin/env node
// Probe: a station contract (galia-quests.js) — take the ONI CSS one, dress Night Window, put the ship by
// its star base; the base is marked and the contract line shows on the space HUD; no page errors.
//   BCM_QA_BROWSER_CHANNEL=msedge MINISIM_QA_CHILD=scripts/galia-contract-probe.mjs \
//     node scripts/minisim-standalone-qa.mjs --transitions-only
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = createRequire(resolve(root, "tools/minisim-qa/package.json"))("playwright");
const url = process.argv[process.argv.indexOf("--url") + 1];
const out = resolve(root, ".qa-artifacts/galia-contract");
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
  await page.waitForTimeout(1500);
  report.accept = await page.evaluate(() => window.BCMGaliaQuests.arriveStation("oni"));
  await page.evaluate(() => {
    const rt = window.BCMiniSimAPI.getRuntime();
    window.BCMSectorLook.apply(rt, "night-window");
    let base = null;
    rt.scene.traverse((o) => { if (!base && o.name === "star-base") base = o; });
    const p = base.getWorldPosition(new rt.THREE.Vector3());
    window.BCMiniSimAPI.teleport({ x: p.x + 30, y: p.y, z: p.z + 30, yaw: 0 }, null);
  });
  await page.waitForTimeout(2500);
  report.state = await page.evaluate(() => ({ active: window.BCMGaliaQuests.active(), line: (document.querySelector("[data-galia-contract]") || {}).textContent || "" }));
  await page.screenshot({ path: resolve(out, "contract.png") });
  report.status = report.accept === "accepted" && report.state.active && report.state.active.seen.includes("night-window") &&
    /Night Window|1\/3/.test(report.state.line) && report.errors.length === 0 ? "PASS" : "FAIL";
} catch (error) {
  report.failure = String(error && error.message || error).split("\n")[0];
  await page.screenshot({ path: resolve(out, "failure.png") }).catch(() => {});
} finally {
  await writeFile(resolve(out, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify(report));
