#!/usr/bin/env node
// Probe: every planet sector has its own space (owner 24.11.2026). Start at ONI CSS (Fable look),
// warp to Opus and to Twinsun, take a frame in each; check that the sector look changed, that the
// ONI station sphere hides outside ONI CSS, and that there are no page errors.
//   BCM_QA_BROWSER_CHANNEL=msedge MINISIM_QA_CHILD=scripts/sector-look-probe.mjs \
//     node scripts/minisim-standalone-qa.mjs --transitions-only
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = createRequire(resolve(root, "tools/minisim-qa/package.json"))("playwright");
const url = process.argv[process.argv.indexOf("--url") + 1];
const out = resolve(root, ".qa-artifacts/sector-look");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.BCM_QA_BROWSER_CHANNEL || undefined, args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const report = { errors: [], sectors: [], status: "FAIL" };
page.on("pageerror", (e) => report.errors.push(e.message));

const look = () => page.evaluate(() => {
  const runtime = window.BCMiniSimAPI.getRuntime();
  let station = null;
  let planet = null;
  runtime.scene.traverse((o) => {
    if (o.name === "space-satellite") station = o.visible;
    if (/^sector-planet-/.test(o.name)) planet = o.name;
  });
  return { current: window.BCMSectorLook ? window.BCMSectorLook.current() : null, station, planet };
});
// Turn the ship toward the sector's planet so the frame shows it.
const facePlanet = () => page.evaluate(() => {
  const runtime = window.BCMiniSimAPI.getRuntime();
  let planet = null;
  runtime.scene.traverse((o) => { if (/^sector-planet-/.test(o.name)) planet = o; });
  if (!planet) return false;
  const T = runtime.THREE;
  const target = planet.getWorldPosition(new T.Vector3());
  const eye = new T.Vector3(26, 8, -110); // open space beside the station, before the landing gate
  const m = new T.Matrix4().lookAt(eye, target, new T.Vector3(0, 1, 0));
  const q = new T.Quaternion().setFromRotationMatrix(m);
  window.BCMiniSimAPI.teleport({ x: eye.x, y: eye.y, z: eye.z }, q);
  return true;
});

async function warpTo(label) {
  await page.keyboard.press("V");
  await page.locator(".bcm-warp-overlay:not([hidden])").first().waitFor({ state: "visible", timeout: 15000 });
  const cells = page.locator("[data-warp-grid] .bcm-warp-grid-cell.is-connected");
  await cells.first().waitFor({ state: "visible", timeout: 15000 });
  const labels = await cells.evaluateAll((list) => list.map((el) => el.textContent.replace(/\s+/g, " ")));
  const pick = labels.findIndex((text) => new RegExp(label, "i").test(text));
  if (pick < 0) throw new Error("no Warp cell for " + label + ": " + labels.slice(0, 12).join(" | "));
  await cells.nth(pick).click({ force: true });
  await page.locator("[data-warp-start]").click();
  for (let i = 0; i < 90; i += 1) {
    await page.waitForTimeout(1000);
    const s = await look();
    if (s.current && s.current !== (report.sectors[report.sectors.length - 1] || {}).current) return s;
  }
  return look();
}

try {
  await page.goto(url + (url.includes("?") ? "&" : "?") + "bcm_qa_warp_nodamage=1", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.locator(".bcm-mini-sim-start").first().click({ timeout: 20000 });
  await page.locator("[data-crew-start]").first().click({ timeout: 20000 });
  await page.waitForFunction(() => document.querySelector(".bcm-mini-sim")?.classList.contains("game-active") && !!window.BCMiniSimAPI, null, { timeout: 40000 });
  await page.waitForTimeout(4000);
  await facePlanet();
  await page.waitForTimeout(1200);
  const start = await look();
  await page.screenshot({ path: resolve(out, "01-fable-oni.png") });
  report.sectors.push({ at: "start", ...start });
  for (const [label, id, file] of [["Opus", "opus", "02-opus.png"], ["Twinsun", "first", "03-twinsun.png"]]) {
    const s = await warpTo(label);
    await page.waitForTimeout(1500);
    await facePlanet();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: resolve(out, file) });
    report.sectors.push({ at: label, want: id, ...s, ...(await look()) });
  }
  const [first, opus, twin] = report.sectors;
  report.status = first.current === "fable" && first.station === true && first.planet === "sector-planet-fable" &&
    opus.current === "opus" && opus.station === false && opus.planet === "sector-planet-opus" && twin && twin.current === "first" && twin.planet === "sector-planet-first" &&
    report.errors.length === 0 ? "PASS" : "FAIL";
} catch (error) {
  report.failure = String(error && error.message || error).split("\n")[0];
  await page.screenshot({ path: resolve(out, "failure.png") }).catch(() => {});
} finally {
  await writeFile(resolve(out, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify(report));
