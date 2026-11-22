#!/usr/bin/env node
// Browser integration probe: enter the existing asteroid Ring and confirm the
// owner-provided boss GLBs and transition clips load through the Mini-Sim r128 runtime.
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = createRequire(resolve(root, "tools/minisim-qa/package.json"))("playwright");
const url = process.argv[process.argv.indexOf("--url") + 1];
const out = resolve(root, ".qa-artifacts/ring-boss-models");
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
  const runtimeReport = await page.evaluate(async () => {
    const scene = window.BCMiniSimAPI.getRuntime().scene;
    const models = [];
    scene.traverse((object) => {
      if (object.userData?.bcmRingBossAsset) models.push({ asset: object.userData.bcmRingBossAsset, clips: object.userData.bcmRingBossClips || [], name: object.name });
    });
    const uniqueAssets = [...new Set(models.map((item) => item.asset))];
    const clipRuns = [];
    const loader = new window.THREE.GLTFLoader();
    for (const relative of uniqueAssets) {
      const entry = (window.BCMMiniSimConfig.assets || []).find((asset) => asset.name === relative);
      if (!entry?.url) throw new Error("Missing configured GLB URL: " + relative);
      const gltf = await new Promise((resolve, reject) => loader.load(entry.url, resolve, undefined, reject));
      const mixer = new window.THREE.AnimationMixer(gltf.scene);
      for (const clip of gltf.animations || []) {
        mixer.stopAllAction();
        const action = mixer.clipAction(clip);
        action.reset();
        action.setLoop(window.THREE.LoopOnce, 1);
        action.play();
        mixer.update(Math.min(clip.duration || 0.12, 0.12));
        const node = gltf.scene.children[0] || gltf.scene;
        if (![node.position.x, node.position.y, node.position.z, node.scale.x, node.scale.y, node.scale.z].every(Number.isFinite)) {
          throw new Error("Non-finite pose after " + clip.name + " in " + relative);
        }
        clipRuns.push({ asset: relative, clip: clip.name, seconds: clip.duration });
      }
    }
    return { models, uniqueAssets, clipRuns };
  });
  report.models = runtimeReport.models;
  const transitionChecks = [];
  for (let step = 0; step < 6; step += 1) {
    const start = await page.evaluate(() => window.__BCM_RING_BOSS_QA__?.transition());
    if (!start || start.phaseState !== "transition" || !start.vfxActive || start.ringVisible) {
      throw new Error("Ring phase transition did not start with live VFX at step " + (step + 1));
    }
    await page.waitForTimeout(1050);
    const middle = await page.evaluate(() => window.__BCM_RING_BOSS_QA__?.snapshot());
    if (!middle || middle.phaseState !== "transition" || !middle.vfxActive || middle.ringVisible || middle.visiblePhases.length < 1) {
      throw new Error("Ring transition mid-state was not active at step " + (step + 1));
    }
    if (step === 0) await page.screenshot({ path: resolve(out, "ring-boss-transform-in-scene.png") });
    await page.waitForFunction((phase) => {
      const snap = window.__BCM_RING_BOSS_QA__?.snapshot();
      return snap && snap.phaseState === "telegraph" && snap.phaseIndex === phase && !snap.vfxActive;
    }, step + 1, { timeout: 6000 });
    const end = await page.evaluate(() => window.__BCM_RING_BOSS_QA__?.snapshot());
    if (end.visiblePhases.length !== 1 || end.visiblePhases[0] !== step + 1 ||
        end.opacities[step] < 0.99 || !end.ringVisible || end.transitionFromIndex !== 0) {
      throw new Error("Old form remained or new form was not fully revealed at transition " + (step + 1));
    }
    transitionChecks.push({ step: step + 1, start, middle, end });
  }
  report.transitionChecks = transitionChecks;
  const rearViewChecked = await page.evaluate(() => window.__BCM_RING_BOSS_QA__?.setRearView(true));
  if (!rearViewChecked) throw new Error("Ring rear-view model check could not orient the final form");
  await page.waitForTimeout(250);
  await page.screenshot({ path: resolve(out, "ring-boss-rear-view.png") });
  await page.evaluate(() => window.__BCM_RING_BOSS_QA__?.setRearView(false));
  report.rearViewScreenshot = "ring-boss-rear-view.png";
  const uniqueAssets = runtimeReport.uniqueAssets;
  report.uniqueAssetCount = uniqueAssets.length;
  report.uniqueAssets = uniqueAssets;
  report.clipRuns = runtimeReport.clipRuns;
  report.status = report.errors.length === 0 && report.httpErrors.length === 0 && uniqueAssets.length === 6 && report.models.length === 18 &&
    report.models.every((model) => ["idle", "hit", "transform_out", "transform_in"].every((clip) => model.clips.includes(clip))) &&
    report.clipRuns.length === 24 && report.transitionChecks?.length === 6 && report.rearViewScreenshot === "ring-boss-rear-view.png" &&
    report.transitionChecks.every((check) => check.middle.vfxActive && check.end.visiblePhases.length === 1) ? "PASS" : "FAIL";
  await page.screenshot({ path: resolve(out, "ring-boss-models-loaded.png") });
} catch (error) {
  report.failure = String(error?.message || error).split("\n")[0];
  await page.screenshot({ path: resolve(out, "ring-boss-models-failure.png") }).catch(() => {});
} finally {
  await writeFile(resolve(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
  await browser.close();
}
console.log(JSON.stringify(report, null, 2).slice(0, 5000));
process.exitCode = report.status === "PASS" ? 0 : 1;
