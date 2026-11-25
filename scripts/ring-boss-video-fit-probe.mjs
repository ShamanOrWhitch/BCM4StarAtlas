#!/usr/bin/env node
// BUG-028 browser probe: at the end of each transform clip the figure in the clip (its bounds measured
// from the clip by tools/ring-bosses/video-bounds.mjs) must stand where the new form stands as it takes over.
// Run: MINISIM_QA_CHILD=scripts/ring-boss-video-fit-probe.mjs BCM_QA_BROWSER_CHANNEL=msedge node scripts/minisim-standalone-qa.mjs
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = createRequire(resolve(root, "tools/minisim-qa/package.json"))("playwright");
const url = process.argv[process.argv.indexOf("--url") + 1];
const out = resolve(root, ".qa-artifacts/ring-boss-video-fit");
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
  await page.waitForTimeout(6000);
  // Last-frame figure bounds per clip, frame fractions [x0, y0, x1, y1], y from the top.
  const LAST = { 2: [0.106, 0.013, 0.87, 0.985], 3: [0.046, 0.017, 0.896, 0.933], 4: [0.088, 0.014, 0.906, 0.981],
    5: [0.05, 0.028, 0.981, 0.956], 6: [0.225, 0, 0.754, 1] };
  const figureAtEnd = (phase) => page.evaluate((box) => {
    const THREE = window.THREE;
    let mesh = null;
    window.BCMiniSimAPI.getRuntime().scene.traverse((o) => { if (o.name === "ring-boss-transform-video") mesh = o; });
    if (!mesh) return null;
    mesh.updateMatrixWorld(true);
    const a = new THREE.Vector3(box[0] - 0.5, 0.5 - box[3], 0).applyMatrix4(mesh.matrixWorld);
    const b = new THREE.Vector3(box[2] - 0.5, 0.5 - box[1], 0).applyMatrix4(mesh.matrixWorld);
    return { bottom: a.y, top: b.y, cx: (a.x + b.x) / 2 };
  }, LAST[phase]);
  const formNow = (phase) => page.evaluate((k) => {
    const THREE = window.THREE;
    let form = null;
    window.BCMiniSimAPI.getRuntime().scene.traverse((o) => { if (new RegExp("^ring-boss-phase-" + k + "-[0-9]+$").test(o.name) && o.visible && o.parent.visible) form = o; });
    if (!form) return null;
    form.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    let y0 = Infinity, y1 = -Infinity, x0 = Infinity, x1 = -Infinity;
    form.traverse((node) => {
      if (!node.isMesh) return;
      const pos = node.geometry.attributes.position;
      for (let i = 0; i < pos.count; i += 1) {
        v.fromBufferAttribute(pos, i);
        if (node.isSkinnedMesh) node.boneTransform(i, v);
        v.applyMatrix4(node.matrixWorld);
        y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x);
      }
    });
    return { bottom: y0, top: y1, cx: (x0 + x1) / 2 };
  }, phase + 1);
  const rows = [];
  for (let phase = 1; phase <= 6; phase += 1) {
    await page.evaluate(() => window.__BCM_RING_BOSS_QA__.transition());
    if (!LAST[phase]) {
      await page.waitForFunction((p) => { const s = window.__BCM_RING_BOSS_QA__.snapshot(); return s.phaseIndex === p && s.phaseState !== "transition"; }, phase, { timeout: 15000 });
      continue;
    }
    // The last figure the player sees: sampled until the transition hands over to the form.
    let fig = null, form = null, clipTime = 0;
    for (let i = 0; i < 120; i += 1) {
      const snap = await page.evaluate(() => window.__BCM_RING_BOSS_QA__.snapshot());
      if (snap.phaseState !== "transition") break;
      if (snap.transformVideo && snap.transformVideo.started) {
        const seen = await figureAtEnd(phase);
        const shown = await formNow(phase);
        if (seen && shown) { fig = seen; form = shown; clipTime = snap.transformVideo.time; }
        if (clipTime > 4.6 && i % 4 === 0) await page.screenshot({ path: resolve(out, "clip-end-" + (phase + 1) + ".png") });
      }
      await page.waitForTimeout(80);
    }
    if (!fig) throw new Error("no transform clip seen for form " + (phase + 1));
    await page.waitForFunction((p) => { const s = window.__BCM_RING_BOSS_QA__.snapshot(); return s.phaseIndex === p && s.phaseState !== "transition"; }, phase, { timeout: 15000 });
    await page.screenshot({ path: resolve(out, "form-" + (phase + 1) + ".png") });
    const h = (r) => r.top - r.bottom;
    const row = { phase: phase + 1, clipTime: +clipTime.toFixed(2), figure: fig, form,
      dBottom: +(form.bottom - fig.bottom).toFixed(2), heightRatio: +(h(form) / h(fig)).toFixed(2), dX: +(form.cx - fig.cx).toFixed(2) };
    row.ok = clipTime > 4.4 && Math.abs(row.dBottom) < 0.4 && Math.abs(row.heightRatio - 1) < 0.18 && Math.abs(row.dX) < 0.8;
    rows.push(row);
  }
  report.rows = rows;
  report.status = rows.length === 5 && rows.every((r) => r.ok) ? "PASS" : "FAIL";
} catch (error) {
  report.failure = String(error?.message || error).split("\n")[0];
  await page.screenshot({ path: resolve(out, "failure.png") }).catch(() => {});
} finally {
  await writeFile(resolve(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
  await browser.close();
}
console.log(JSON.stringify({ status: report.status, failure: report.failure,
  rows: (report.rows || []).map((r) => `form ${r.phase}: clip ${r.clipTime}s, bottom ${r.dBottom} m, height x${r.heightRatio}, x ${r.dX} m ${r.ok ? "ok" : "MISMATCH"}`) }, null, 1));
process.exitCode = report.status === "PASS" ? 0 : 1;
