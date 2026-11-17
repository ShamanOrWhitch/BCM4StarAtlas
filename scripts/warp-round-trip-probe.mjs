#!/usr/bin/env node
// Owner 17.11.2026: "варп работал в обе стороны, а потом сломалось". Browser
// probe: three full Warp jumps (no cancel) — ONI CSS -> neighbour -> back to
// ONI CSS -> neighbour again. After every arrival it records where the game
// says we are, whether the ship is drawn, and any page error.
//   BCM_QA_BROWSER_CHANNEL=msedge MINISIM_QA_CHILD=scripts/warp-round-trip-probe.mjs \
//     node scripts/minisim-standalone-qa.mjs --transitions-only
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const requireQa = createRequire(resolve(root, "tools/minisim-qa/package.json"));
const { chromium } = requireQa("playwright");
const url = process.argv[process.argv.indexOf("--url") + 1];
const out = resolve(root, ".qa-artifacts/warp-round-trip");
await mkdir(out, { recursive: true });

const browser = await chromium.launch({ channel: process.env.BCM_QA_BROWSER_CHANNEL || undefined, args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
const report = { jumps: [], errors };
const snap = (label) => page.evaluate((label) => {
  const runtime = window.BCMiniSimAPI?.getRuntime?.();
  const route = window.BCMDeepSpaceWarpGetRouteState?.() || null;
  const overlay = document.querySelector(".bcm-warp-overlay");
  return {
    label,
    overlayOpen: !!overlay && !overlay.hidden,
    place: window.BCMiniSimAPI?.getPlace?.() ?? null,
    route: route && { destination: route.destination?.id ?? null, current: route.currentLocation?.id ?? route.currentLocation ?? null, navCurrent: route.navCurrent ?? null },
    shipVisible: runtime?.ship?.visual ? runtime.ship.visual.visible : null,
    shipPos: runtime?.ship?.position ? [runtime.ship.position.x, runtime.ship.position.y, runtime.ship.position.z].map((v) => Math.round(v)) : null,
    tubeErrors: window.BCMWarpBridgeFlight?.drawErrors?.() ?? null,
  };
}, label);

async function jump(n, pickHome) {
  await page.keyboard.press("V");
  await page.locator(".bcm-warp-overlay:not([hidden])").first().waitFor({ state: "visible", timeout: 15000 });
  await page.waitForTimeout(400);
  const cells = page.locator("[data-warp-grid] .bcm-warp-grid-cell.is-connected");
  await cells.first().waitFor({ state: "visible", timeout: 15000 });
  const ids = await cells.evaluateAll((list) => list.map((el) => [el.getAttribute("data-sector-id"), el.textContent.replace(/\s+/g, " ").trim().slice(0, 60)]));
  let index = 0;
  if (pickHome) index = Math.max(0, ids.findIndex(([id, text]) => /-40.*30|ONI|NEUNO/i.test(id + " " + text)));
  await cells.nth(index).click();
  const before = await snap(`jump ${n}: selected ${ids[index]?.[0]} (${ids[index]?.[1]})`);
  await page.locator("[data-warp-start]").click();
  await page.locator('[data-warp-view="tube"]:not([hidden])').waitFor({ state: "visible", timeout: 10000 });
  await page.waitForTimeout(6000);
  const mid = await snap(`jump ${n}: in the tube`);
  await page.screenshot({ path: resolve(out, `jump-${n}-tube.png`) });
  // The result screen, then the game enters the sector by itself.
  await page.locator("[data-tube-abort]").waitFor({ state: "visible", timeout: 70000 });
  await page.waitForTimeout(4500);
  const after = await snap(`jump ${n}: after arrival`);
  await page.screenshot({ path: resolve(out, `jump-${n}-arrival.png`) });
  report.jumps.push({ choices: ids, before, mid, after });
}

try {
  await page.goto(url + (url.includes("?") ? "&" : "?") + "bcm_qa_warp_nodamage=1", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.locator(".bcm-mini-sim-start").first().click({ timeout: 20000 });
  await page.locator("[data-crew-start]").first().click({ timeout: 20000 });
  await page.waitForFunction(() => document.querySelector(".bcm-mini-sim")?.classList.contains("game-active") && !!window.BCMiniSimAPI, null, { timeout: 40000 });
  await page.waitForTimeout(1500);
  report.start = await snap("start");
  await jump(1, false);
  await jump(2, true);
  await jump(3, false);
} catch (error) {
  report.failure = String(error && error.message || error).split("\n")[0];
  await page.screenshot({ path: resolve(out, "failure.png") }).catch(() => {});
} finally {
  await writeFile(resolve(out, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify(report, null, 1).slice(0, 6000));
