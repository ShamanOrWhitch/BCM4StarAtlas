#!/usr/bin/env node
// Browser probe of the Ring maze (the platformer inside the asteroid's gold ring):
// one Warp jump to an asteroid sector, the ship is set at the gold ring beacon
// (the way a pilot enters), and frames of the Ring level are taken while the
// crew member walks. For looking at the level, not a pass/fail test.
//   BCM_QA_BROWSER_CHANNEL=msedge MINISIM_QA_CHILD=scripts/ring-maze-probe.mjs \
//     node scripts/minisim-standalone-qa.mjs --transitions-only
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = createRequire(resolve(root, "tools/minisim-qa/package.json"))("playwright");
const url = process.argv[process.argv.indexOf("--url") + 1];
const out = resolve(root, ".qa-artifacts/ring-maze");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.BCM_QA_BROWSER_CHANNEL || undefined, args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const report = { errors: [], frames: [] };
page.on("pageerror", (e) => report.errors.push(e.message));
const shot = async (label) => {
  await page.screenshot({ path: resolve(out, label + ".png") });
  report.frames.push({ label, ring: await page.evaluate(() => !!document.getElementById("bcm-ring-platformer")) });
};
try {
  await page.goto(url + (url.includes("?") ? "&" : "?") + "bcm_qa_warp_nodamage=1", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.locator(".bcm-mini-sim-start").first().click({ timeout: 20000 });
  await page.locator("[data-crew-start]").first().click({ timeout: 20000 });
  await page.waitForFunction(() => document.querySelector(".bcm-mini-sim")?.classList.contains("game-active") && !!window.BCMiniSimAPI, null, { timeout: 40000 });
  await page.waitForTimeout(1500);
  // One jump to a sector without a planet: the arrival is an asteroid.
  await page.keyboard.press("V");
  await page.locator(".bcm-warp-overlay:not([hidden])").first().waitFor({ state: "visible", timeout: 15000 });
  const cells = page.locator("[data-warp-grid] .bcm-warp-grid-cell.is-connected");
  await cells.first().waitFor({ state: "visible", timeout: 15000 });
  const ids = await cells.evaluateAll((list) => list.map((el) => el.textContent.replace(/\s+/g, " ")));
  const pick = Math.max(0, ids.findIndex((t) => !/Fable|Opus|Twinsun|ONI|Pearce|Ioki/i.test(t)));
  await cells.nth(pick).click();
  await page.locator("[data-warp-start]").click();
  await page.locator("[data-tube-abort]").waitFor({ state: "visible", timeout: 90000 });
  await page.waitForTimeout(5000);
  await shot("01-asteroid");
  // Fly onto the gold ring beacon.
  const placed = await page.evaluate(() => {
    const runtime = window.BCMiniSimAPI.getRuntime();
    let beacon = null;
    runtime.scene.traverse((o) => { if (o.name === "return-warp-beacon") beacon = o; });
    if (!beacon) return false;
    const p = new runtime.ship.position.constructor();
    beacon.getWorldPosition(p);
    runtime.ship.position.copy(p);
    return true;
  });
  report.beacon = placed;
  await page.waitForFunction(() => !!document.getElementById("bcm-ring-platformer"), null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(4000);
  await shot("02-ring-start");
  await page.getByRole("button", { name: /SINGLE/ }).first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.locator("#bcm-ring-platformer button[aria-label*=close i], .bcm-dialogue button").first().click({ timeout: 1500 }).catch(() => {});
  await shot("03-ring-cell");
  // The start cell has the glowing hatch: E there goes to another floor (another theme).
  await page.keyboard.press("KeyE");
  await page.waitForTimeout(2500);
  await shot("03b-floor-change");
  report.floorLight = await page.evaluate(() => window.BCMiniSimAPI.getRuntime().scene.getObjectByName("ring-cell-light")?.color?.getHexString());
  await page.keyboard.down("KeyD");
  for (let i = 0; i < 4; i++) { await page.waitForTimeout(700); await page.keyboard.press("Space"); }
  await shot("04-ring-walk");
  await page.keyboard.press("KeyE");
  await page.waitForTimeout(2000);
  await shot("05-ring-door");
  await page.waitForTimeout(3000);
  await shot("06-ring-further");
  await page.keyboard.up("KeyD");
  await page.keyboard.down("KeyA");
  await page.waitForTimeout(3000);
  await page.keyboard.up("KeyA");
  await shot("07-ring-back");
  // Another floor of the asteroid: another theme.
  for (let i = 0; i < 3; i++) { await page.keyboard.press("KeyR"); await page.waitForTimeout(1500); }
  await shot("08-other-floor");
  report.floors = await page.evaluate(() => window.BCMiniSimAPI.getRuntime().scene.getObjectByName("bcm-asteroid-cell-room")?.getObjectByName("ring-cell-light")?.color?.getHexString());
  // The cell look (scripts/ring-cell-look.test.mjs): tiles from the atlas, a theme per floor, the cell light.
  report.cell = await page.evaluate(() => {
    const scene = window.BCMiniSimAPI.getRuntime().scene;
    const room = scene.getObjectByName("bcm-asteroid-cell-room");
    if (!room) return null;
    const map = (name) => room.getObjectByName(name)?.material?.map?.name || null;
    return {
      back: map("ring-cell-asteroid-face"),
      wall: map("ring-cell-sealed-wall-left") || map("ring-cell-sealed-wall-right"),
      door: map("ring-cell-door-left") || map("ring-cell-door-right"),
      light: room.getObjectByName("ring-cell-light")?.color?.getHexString() || null,
    };
  });
  report.text = await page.evaluate(() => (document.getElementById("bcm-ring-platformer")?.innerText || "").slice(0, 600));
} catch (error) {
  report.failure = String(error && error.message || error).split("\n")[0];
  await page.screenshot({ path: resolve(out, "failure.png") }).catch(() => {});
} finally {
  await writeFile(resolve(out, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify(report, null, 1).slice(0, 2500));
