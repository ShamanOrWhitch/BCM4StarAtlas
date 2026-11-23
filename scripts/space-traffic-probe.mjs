#!/usr/bin/env node
// Browser probe of the space traffic (owner 23.11.2026: "кто-то прилетает, кто-то улетает";
// WORK LOCK #144): park the ship in front of ONI CSS, watch the non-player ships move,
// arrive, hold and depart, and take a frame.
//   BCM_QA_BROWSER_CHANNEL=msedge MINISIM_QA_CHILD=scripts/space-traffic-probe.mjs \
//     node scripts/minisim-standalone-qa.mjs --transitions-only
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = createRequire(resolve(root, "tools/minisim-qa/package.json"))("playwright");
const url = process.argv[process.argv.indexOf("--url") + 1];
const out = resolve(root, ".qa-artifacts/space-traffic");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.BCM_QA_BROWSER_CHANNEL || undefined });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const report = { errors: [], samples: [], status: "FAIL" };
page.on("pageerror", (e) => report.errors.push(e.message));
try {
  await page.goto(url + (url.includes("?") ? "&" : "?") + "bcm_qa_warp_nodamage=1", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.locator(".bcm-mini-sim-start").first().click({ timeout: 20000 });
  await page.locator("[data-crew-start]").first().click({ timeout: 20000 });
  await page.waitForFunction(() => document.querySelector(".bcm-mini-sim")?.classList.contains("game-active") && !!window.BCMiniSimAPI, null, { timeout: 40000 });
  await page.waitForTimeout(1500);
  const park = () => page.evaluate(() => {
    const rt = window.BCMiniSimAPI.getRuntime();
    rt.ship.position.set(0, 6, -100);
    rt.ship.velocity.set(0, 0, 0);
    rt.ship.quaternion.set(0, 0, 0, 1);
  });
  for (let i = 0; i < 22; i += 1) {
    await park();
    await page.waitForTimeout(1000);
    const s = await page.evaluate(() => {
      const rt = window.BCMiniSimAPI.getRuntime();
      const list = [];
      let groupVisible = null;
      rt.scene.traverse((o) => {
        if (o.name === "space-traffic") groupVisible = o.parent ? o.parent.visible : null;
        if (/^space-traffic-/.test(o.name)) list.push({ id: o.name, vis: o.visible, state: o.userData.trafficState, x: Math.round(o.position.x), z: Math.round(o.position.z), loaded: !!o.userData.loaded });
      });
      return { groupVisible, ships: list };
    });
    report.samples.push(s);
    if (i === 14) await page.screenshot({ path: resolve(out, "space-traffic.png") });
  }
  const all = report.samples.flatMap((s) => s.ships);
  const ids = [...new Set(all.map((s) => s.id))];
  const moved = ids.filter((id) => new Set(all.filter((s) => s.id === id && s.vis).map((s) => s.x + "," + s.z)).size > 2);
  report.ids = ids; report.moved = moved;
  report.states = [...new Set(all.filter((s) => s.vis).map((s) => s.state))];
  report.loaded = ids.filter((id) => all.some((s) => s.id === id && s.loaded));
  report.status = ids.length >= 3 && report.loaded.length >= 3 && moved.length >= 2 &&
    report.states.includes("arrive") && report.states.includes("hold") && report.errors.length === 0 ? "PASS" : "FAIL";
} catch (error) {
  report.failure = String(error && error.message || error).split("\n")[0];
  await page.screenshot({ path: resolve(out, "failure.png") }).catch(() => {});
} finally {
  await writeFile(resolve(out, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ status: report.status, failure: report.failure, errors: report.errors, ids: report.ids, loaded: report.loaded, moved: report.moved, states: report.states, groupVisible: report.samples.map((s) => s.groupVisible).slice(-3) }));
