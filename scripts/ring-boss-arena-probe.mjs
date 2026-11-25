#!/usr/bin/env node
// Browser probe of the Ring arena tiers and the Brawler (owner 23.11.2026): a low ledge
// is reached with a jump; a pilot on it gets the cannon at its tier (comic inset of the
// owner video), then the laugh and drink window.
//   BCM_QA_BROWSER_CHANNEL=msedge MINISIM_QA_CHILD=scripts/ring-boss-arena-probe.mjs \
//     node scripts/minisim-standalone-qa.mjs --transitions-only
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = createRequire(resolve(root, "tools/minisim-qa/package.json"))("playwright");
const url = process.argv[process.argv.indexOf("--url") + 1];
const out = resolve(root, ".qa-artifacts/ring-boss-arena");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.BCM_QA_BROWSER_CHANNEL || undefined, args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const report = { errors: [], samples: [], status: "FAIL" };
page.on("pageerror", (error) => report.errors.push(error.message));
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
  await cells.nth(pick).click({ force: true });
  await page.locator("[data-warp-start]").click();
  await page.locator("[data-tube-abort]").waitFor({ state: "visible", timeout: 90000 });
  await page.waitForTimeout(5000);
  await page.evaluate(() => {
    const runtime = window.BCMiniSimAPI.getRuntime();
    let beacon = null;
    runtime.scene.traverse((object) => { if (object.name === "return-warp-beacon") beacon = object; });
    const position = new runtime.ship.position.constructor();
    beacon.getWorldPosition(position);
    runtime.ship.position.copy(position);
  });
  await page.waitForFunction(() => !!document.getElementById("bcm-ring-platformer"), null, { timeout: 60000 });
  await page.waitForTimeout(1000);
  await page.locator("#bcm-ring-platformer [data-ring-single]").click({ timeout: 10000 });
  await page.waitForTimeout(4000);
  // BUG-028: read the arena itself — is the Brawler model shown and shaken, does a clip play in the world.
  const snap = () => page.evaluate(() => {
    const s = window.__BCM_RING_BOSS_QA__.snapshot();
    let model = null, film = null;
    window.BCMiniSimAPI.getRuntime().scene.traverse((o) => {
      if (/^ring-boss-phase-5-[0-9]+$/.test(o.name) && o.parent && o.parent.visible) model = o;
      if (o.name === "ring-boss-brawler-film") film = o;
    });
    s.arena = { modelShown: !!(model && model.visible), shake: model ? Math.abs(model.rotation.z) + Math.abs(model.scale.y - model.scale.z) : 0,
      filmInWorld: !!(film && film.visible && film.material && film.material.map && film.material.map.image && !film.material.map.image.error),
      filmFile: film && film.visible && film.material.map ? String(film.material.map.image.currentSrc || film.material.map.image.src).split("/").pop().split("?")[0] : "" };
    return s;
  });
  const WAIT_FORM = () => page.waitForFunction(() => window.__BCM_RING_BOSS_QA__.snapshot().phaseState !== "transition", null, { timeout: 20000 });
  // Pig -> Roller -> Walker -> Orbiter -> Brawler.
  for (let step = 1; step <= 4; step += 1) {
    await page.evaluate(() => window.__BCM_RING_BOSS_QA__.transition());
    await WAIT_FORM();
    await page.waitForTimeout(300);
  }
  const start = await snap();
  report.form = start.moveForm;
  // 1. A low ledge is reached with an ordinary jump from the floor.
  const home = start.homeX;
  const lowLedge = home - 8 + 1.5; // [home-8, home-5] at 1.4 m
  await page.evaluate((x) => window.__BCM_RING_BOSS_QA__.placePilot(x, 0), lowLedge - 1.6);
  await page.waitForTimeout(400);
  await page.keyboard.down("ArrowRight");
  await page.keyboard.press("Space");
  await page.waitForTimeout(260);
  await page.keyboard.up("ArrowRight");
  await page.waitForTimeout(900);
  const climbed = await snap();
  report.climb = { x: climbed.pilot.x, y: climbed.pilot.y };
  // 2. Stay on the ledge: the Brawler answers with the cannon at the ledge tier.
  report.trace = [];
  let chargeShot = false, drinkShot = false;
  for (let i = 0; i < 110; i += 1) { // the big Brawler's cycle is long and headless Edge frames are slow
    const s = await snap();
    report.trace.push({ arena: s.arena, cv: s.comicVideo, up: s.modelUp, clip: s.modelClips, state: s.moveState, open: s.vulnerable, shielded: s.shielded, bossHp: s.bossHp, comic: s.comic, zones: s.zones.filter((z) => /beam|aim/.test(z)), y: Math.round(s.pilot.y * 10) / 10, hp: s.pilot.hp });
    if (!chargeShot && s.moveState === "charge") { await page.waitForTimeout(500); await page.screenshot({ path: resolve(out, "brawler-charge.png") }); chargeShot = true; }
    if (!drinkShot && s.moveState === "drink") { await page.screenshot({ path: resolve(out, "brawler-drink.png") }); drinkShot = true; }
    if (!report.laughShot && s.moveState === "taunt") { await page.waitForTimeout(400); await page.screenshot({ path: resolve(out, "brawler-laugh.png") }); report.laughShot = true; }
    if (drinkShot && i > 10 && s.moveState === "advance") break;
    await page.waitForTimeout(250);
  }
  const t = report.trace;
  const states = [...new Set(t.map((x) => x.state))];
  report.states = states;
  report.status = report.form === "brawler" && t.slice(3, 8).every((x) => Math.abs(x.y - 1.4) < 0.05) &&
    ["charge", "fire", "taunt", "drink"].every((x) => states.includes(x)) &&
    // 0.16.12: the Brawler fires itself in the arena (aim line, plasma balls). Since 0.16.33 its
    // clip plays in the arena too (`comic` names that clip); there is no panel in the HUD.
    t.some((x) => x.state === "charge" && x.zones.includes("ring-boss-tell-aim")) &&
    t.some((x) => x.state === "fire") &&
    // Drink under the shield, then the laugh is the window.
    t.some((x) => x.state === "drink" && x.shielded && !x.open) &&
    t.some((x) => x.state === "taunt" && x.open) &&
    // BUG-028 (owner 24.11.2026: "смех и выстрел заменены дешёвой потряской текстуры"): the owner's
    // clips play in the arena on the Brawler's spot while the model hides; the model never shakes.
    t.some((x) => x.state === "charge" && x.arena.filmInWorld && /attack-cannon/.test(x.arena.filmFile) && !x.arena.modelShown) &&
    t.some((x) => x.state === "taunt" && x.arena.filmInWorld && /laugh/.test(x.arena.filmFile) && !x.arena.modelShown) &&
    t.every((x) => x.arena.shake < 0.01) &&
    report.errors.length === 0 ? "PASS" : "FAIL";
} catch (error) {
  report.failure = String(error && error.message || error).split("\n")[0];
  await page.screenshot({ path: resolve(out, "failure.png") }).catch(() => {});
} finally {
  await writeFile(resolve(out, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
const seen = (state) => (report.trace || []).filter((x) => x.state === state).map((x) => (x.arena.modelShown ? "model" : "-") + "/" + (x.arena.filmInWorld ? x.arena.filmFile : "noclip") + "/shake " + x.arena.shake.toFixed(3));
console.log(JSON.stringify({ charge: [...new Set(seen("charge"))].slice(0, 4), taunt: [...new Set(seen("taunt"))].slice(0, 4) }));
console.log(JSON.stringify({ status: report.status, failure: report.failure, errors: report.errors, form: report.form, climb: report.climb, states: report.states }));
