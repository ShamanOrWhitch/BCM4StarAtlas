#!/usr/bin/env node
// BUG-028 browser probe ("разворот выглядит уродски"): each boss form, while it moves, must look where it
// goes (the art faces one way) and never show its bare extruded side (no turn about the vertical).
// Run: MINISIM_QA_CHILD=scripts/ring-boss-turn-probe.mjs BCM_QA_BROWSER_CHANNEL=msedge node scripts/minisim-standalone-qa.mjs
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = createRequire(resolve(root, "tools/minisim-qa/package.json"))("playwright");
const url = process.argv[process.argv.indexOf("--url") + 1];
const out = resolve(root, ".qa-artifacts/ring-boss-turn");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.BCM_QA_BROWSER_CHANNEL || undefined, args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const report = { errors: [], failedRequests: [], httpErrors: [], models: [], status: "FAIL" };
page.on("pageerror", (error) => report.errors.push(error.message));
page.on("requestfailed", (request) => report.failedRequests.push({ url: request.url(), error: request.failure()?.errorText || "failed" }));
page.on("response", (response) => { if (response.status() >= 400) report.httpErrors.push({ status: response.status(), url: response.url() }); });
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
  await cells.nth(pick).click();
  await page.locator("[data-warp-start]").click();
  await page.locator("[data-tube-abort]").waitFor({ state: "visible", timeout: 90000 });
  await page.waitForTimeout(5000);
  const beaconFound = await page.evaluate(() => {
    const runtime = window.BCMiniSimAPI.getRuntime();
    let beacon = null;
    runtime.scene.traverse((object) => { if (object.name === "return-warp-beacon") beacon = object; });
    if (!beacon) return false;
    const position = new runtime.ship.position.constructor();
    beacon.getWorldPosition(position);
    runtime.ship.position.copy(position);
    return true;
  });
  report.beaconFound = beaconFound;
  if (!beaconFound) throw new Error("Asteroid return-warp beacon not found");
  await page.waitForFunction(() => !!document.getElementById("bcm-ring-platformer"), null, { timeout: 60000 });
  await page.waitForTimeout(1000);
  await page.locator("#bcm-ring-platformer [data-ring-single]").click({ timeout: 10000 });
  await page.waitForTimeout(8000);
  // Where the snout points in each form as drawn in the arena (screenshots): -1 left, +1 right, 0 front.
  const ART_FACING = { 1: -1, 2: -1, 3: -1, 4: 0, 5: -1, 6: -1 };
  const rows = [];
  for (let phase = 1; phase <= 6; phase += 1) {
    await page.evaluate(() => window.__BCM_RING_BOSS_QA__.transition());
    await page.waitForFunction((p) => { const s = window.__BCM_RING_BOSS_QA__.snapshot(); return s.phaseIndex === p && s.phaseState !== "transition"; }, phase, { timeout: 20000 });
    if (phase === 5) continue; // the Runner is fought as a rear-view chase
    let prevX = null, moving = 0, backwards = 0, edgeOn = 0, frames = 0, right = 0, lastShown = 0;
    const home = (await page.evaluate(() => window.__BCM_RING_BOSS_QA__.snapshot())).homeX;
    for (let k = 0; k < 60; k += 1) {
      // Half the time the pilot stands left of the form, then right of it: the form must turn both ways.
      if (k === 0) await page.evaluate((x) => window.__BCM_RING_BOSS_QA__.placePilot(x, 0), home - 6);
      if (k === 30) { await page.evaluate((x) => window.__BCM_RING_BOSS_QA__.placePilot(x, 0), home + 6); prevX = null; }
      const s = await page.evaluate((p) => {
        let form = null;
        window.BCMiniSimAPI.getRuntime().scene.traverse((o) => { if (new RegExp("^ring-boss-phase-" + (p + 1) + "-[0-9]+$").test(o.name) && o.visible && o.parent.visible) form = o; });
        if (!form) return null;
        const v = new window.THREE.Vector3();
        form.getWorldPosition(v);
        return { x: v.x, rotY: form.rotation.y, sx: form.scale.x };
      }, phase);
      await page.waitForTimeout(100);
      if (!s) continue;
      frames += 1;
      if (ART_FACING[phase]) lastShown = ART_FACING[phase] * Math.sign(s.sx) * Math.sign(Math.cos(s.rotY));
      if (Math.abs(Math.cos(s.rotY)) < 0.6) edgeOn += 1;
      if (prevX !== null && Math.abs(s.x - prevX) > 0.04 && ART_FACING[phase]) {
        moving += 1;
        if (s.x > prevX) right += 1;
        const shown = ART_FACING[phase] * Math.sign(s.sx) * Math.sign(Math.cos(s.rotY));
        if (shown !== Math.sign(s.x - prevX)) backwards += 1;
      }
      prevX = s.x;
    }
    await page.screenshot({ path: resolve(out, "form-" + (phase + 1) + ".png") });
    rows.push({ form: phase + 1, frames, moving, right, backwards, edgeOn, lastShown });
  }
  report.rows = rows;
  report.status = rows.length === 5 && rows.every((r) => r.frames > 30 && r.edgeOn === 0 && r.backwards <= Math.max(1, r.moving * 0.15)) &&
    rows.some((r) => r.moving > 5) &&
    // At the end the pilot stands right of the form: the walking forms look right, at the pilot.
    rows.filter((r) => [2, 3, 7].includes(r.form)).every((r) => r.lastShown === 1) ? "PASS" : "FAIL";
} catch (error) {
  report.failure = String(error?.message || error).split("\n")[0];
  await page.screenshot({ path: resolve(out, "failure.png") }).catch(() => {});
} finally {
  await writeFile(resolve(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
  await browser.close();
}
console.log(JSON.stringify({ status: report.status, failure: report.failure,
  rows: (report.rows || []).map((r) => `form ${r.form}: moving ${r.moving} (right ${r.right}), backwards ${r.backwards}, looks ${r.lastShown > 0 ? "right" : r.lastShown < 0 ? "left" : "front"} at the end, side shown ${r.edgeOn} of ${r.frames}`) }, null, 1));
process.exitCode = report.status === "PASS" ? 0 : 1;
