#!/usr/bin/env node
// BUG-028 browser probe: through six real boss transitions, measure the lowest vertex of the visible
// form in its animated pose against the arena floor. Walking forms must stand on it.
// Run: MINISIM_QA_CHILD=scripts/ring-boss-feet-probe.mjs BCM_QA_BROWSER_CHANNEL=msedge node scripts/minisim-standalone-qa.mjs
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = createRequire(resolve(root, "tools/minisim-qa/package.json"))("playwright");
const url = process.argv[process.argv.indexOf("--url") + 1];
const out = resolve(root, ".qa-artifacts/ring-boss-feet");
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
  const measure = () => page.evaluate(() => {
    const THREE = window.THREE;
    const scene = window.BCMiniSimAPI.getRuntime().scene;
    const v = new THREE.Vector3();
    let form = null, bossGroup = null;
    const names = [];
    scene.traverse((o) => { if (/^ring-boss-phase/.test(o.name)) names.push(o.name + ":" + o.visible + ":" + (o.parent && o.parent.visible)); if (/^ring-boss-phase-\d-\d+$/.test(o.name) && o.visible && o.parent.visible) form = o; });
    if (!form) return { names };
    bossGroup = form.parent;
    form.updateMatrixWorld(true);
    let minY = Infinity, maxY = -Infinity;
    form.traverse((node) => {
      if (!node.isMesh || !node.visible) return;
      const pos = node.geometry.attributes.position;
      for (let i = 0; i < pos.count; i += 1) {
        v.fromBufferAttribute(pos, i);
        if (node.isSkinnedMesh) node.boneTransform(i, v);
        v.applyMatrix4(node.matrixWorld);
        if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y;
      }
    });
    const floor = bossGroup.getWorldPosition(new THREE.Vector3()).y;
    return { form: form.name, floor, minY, maxY, gap: minY - floor, height: maxY - minY, groundY: form.userData.bcmGroundY };
  });
  const rows = [];
  for (let step = 0; step < 6; step += 1) {
    await page.evaluate(() => window.__BCM_RING_BOSS_QA__.transition());
    await page.waitForFunction((phase) => { const s = window.__BCM_RING_BOSS_QA__.snapshot(); return s.phaseIndex === phase && s.phaseState !== "transition"; }, step + 1, { timeout: 15000 });
    await page.waitForTimeout(600);
    const m = await measure();
    rows.push({ step: step + 1, state: (await page.evaluate(() => window.__BCM_RING_BOSS_QA__.snapshot())).phaseState, ...m });
    await page.screenshot({ path: resolve(out, "phase-" + (step + 2) + ".png") });
    const series = [];
    for (let k = 0; k < 16; k += 1) {
      await page.waitForTimeout(400);
      const m2 = await measure();
      const s2 = await page.evaluate(() => window.__BCM_RING_BOSS_QA__.snapshot());
      series.push((s2.moveState || s2.phaseState) + "@" + (m2.gap ?? NaN).toFixed(2) + (m2.clip ? "/" + m2.clip : "") + "/" + (s2.modelClips || ""));
      if (k === 8) await page.screenshot({ path: resolve(out, "phase-" + (step + 2) + "-later.png") });
    }
    rows[rows.length - 1].series = series.join(" ");
  }
  report.rows = rows;
  const airborne = rows.filter((r) => !/phase-4-/.test(r.form || "")).flatMap((r) => r.series.split(" ").filter((x) => !/^leap@/.test(x) && Number(x.split("@")[1].split("/")[0]) > 0.45).map((x) => r.form + " " + x));
  report.airborne = airborne;
  report.status = airborne.length ? "FAIL" : "PASS";
} catch (error) {
  report.failure = String(error?.message || error).split("\n")[0];
  await page.screenshot({ path: resolve(out, "failure.png") }).catch(() => {});
} finally {
  await writeFile(resolve(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
  await browser.close();
}
console.log(JSON.stringify({ status: report.status, failure: report.failure, airborne: report.airborne }, null, 1));
process.exitCode = report.status === "PASS" ? 0 : 1;
