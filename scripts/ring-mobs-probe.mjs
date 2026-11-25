#!/usr/bin/env node
// BUG-028 browser probe ("мобы не проработаны"): the mobs in the Ring cells, as drawn and as they move.
// They must be the owner's pig mobs (art/ring-bosses/pig-mobs-sheet.png), of more than one kind and gait.
// Run: MINISIM_QA_CHILD=scripts/ring-mobs-probe.mjs BCM_QA_BROWSER_CHANNEL=msedge node scripts/minisim-standalone-qa.mjs
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = createRequire(resolve(root, "tools/minisim-qa/package.json"))("playwright");
const url = process.argv[process.argv.indexOf("--url") + 1];
const out = resolve(root, ".qa-artifacts/ring-mobs");
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
  const look = () => page.evaluate(() => {
    const seen = [];
    window.BCMiniSimAPI.getRuntime().scene.traverse((o) => {
      if (o.name !== "ring-cell-mob" || !o.visible) return;
      const box = new window.THREE.Box3().setFromObject(o);
      seen.push({ id: o.uuid.slice(0, 8), geometry: o.geometry ? o.geometry.type : o.type, kind: o.userData.bcmMobKind || "",
        art: !!(o.material && o.material.map), x: +o.position.x.toFixed(2), y: +o.position.y.toFixed(2),
        bottom: +box.min.y.toFixed(2), height: +(box.max.y - box.min.y).toFixed(2) });
    });
    return seen;
  });
  const mobs = new Map();
  let cellCount = 0;
  for (let n = 0; n < 14; n += 1) {
    const cell = await page.evaluate((k) => window.__BCM_RING_BOSS_QA__.enterCell(k), n);
    if (!cell) throw new Error("no cell with mobs to enter");
    cellCount = cell.cells;
    await page.waitForTimeout(400);
    for (let k = 0; k < 8; k += 1) {
      for (const m of await look()) {
        const rec = mobs.get(m.id) || { geometry: m.geometry, kind: m.kind, art: m.art, xs: [], ys: [], bottoms: [], height: m.height, astral: cell.astral };
        rec.xs.push(m.x); rec.ys.push(m.y); rec.bottoms.push(m.bottom);
        mobs.set(m.id, rec);
      }
      await page.waitForTimeout(150);
    }
    if (n === 1) await page.screenshot({ path: resolve(out, "cell-mobs.png") });
    if (n === 5) await page.screenshot({ path: resolve(out, "cell-mobs-2.png") });
  }
  // Frames with the pilot near the middle of the cell, where the mobs patrol.
  for (const n of [0, 2, 4, 6]) {
    await page.evaluate((k) => window.__BCM_RING_BOSS_QA__.enterCell(k), n);
    await page.waitForTimeout(300);
    const seen = await look();
    if (!seen.length) continue;
    const middle = seen.reduce((sum, m) => sum + m.x, 0) / seen.length;
    await page.evaluate((x) => window.__BCM_RING_BOSS_QA__.placePilot(x, 0), middle - 3.2);
    await page.waitForTimeout(900);
    await page.screenshot({ path: resolve(out, "mobs-" + n + ".png") });
  }
  // The attacks (owner 25.11.2026 "Атаки мобов"): a toxic pig's puddle and a tank's shell in the cell.
  report.attacks = { puddle: 0, shell: 0 };
  for (let n = 0; n < Math.max(14, cellCount) && !(report.attacks.puddle && report.attacks.shell); n += 1) {
    await page.evaluate((k) => window.__BCM_RING_BOSS_QA__.enterCell(k), n);
    await page.waitForTimeout(300);
    const seen = await look();
    seen.forEach((m) => { if (m.kind === "toxic") report.attacks.toxic = true; if (m.kind === "tank") report.attacks.tank = true; });
    if (!seen.some((m) => /toxic|tank/.test(m.kind))) continue;
    const middle = seen.reduce((sum, m) => sum + m.x, 0) / seen.length;
    await page.evaluate((x) => window.__BCM_RING_BOSS_QA__.placePilot(x, 0), middle - 3.2);
    for (let k = 0; k < 16; k += 1) {
      const counts = await page.evaluate(() => {
        const c = { puddle: 0, shell: 0 };
        window.BCMiniSimAPI.getRuntime().scene.traverse((o) => {
          if (!o.visible) return;
          if (o.name === "ring-mob-puddle") c.puddle += 1;
          if (o.name === "ring-mob-shell") c.shell += 1;
        });
        return c;
      });
      report.attacks.puddle = Math.max(report.attacks.puddle, counts.puddle);
      if (counts.shell && !report.attacks.shell) await page.screenshot({ path: resolve(out, "attack-shell.png") });
      if (counts.puddle && !report.attacks.puddleShot) { report.attacks.puddleShot = true; await page.screenshot({ path: resolve(out, "attack-puddle.png") }); }
      report.attacks.shell = Math.max(report.attacks.shell, counts.shell);
      await page.waitForTimeout(220);
    }
  }
  // The laser: a floor mob in line goes down after as many shots as its kind takes.
  report.laser = null;
  for (let n = 0; n < 14 && !report.laser; n += 1) {
    await page.evaluate((k) => window.__BCM_RING_BOSS_QA__.enterCell(k), n);
    await page.waitForTimeout(300);
    const target = (await look()).find((m) => !/angel|spider/.test(m.kind) && m.bottom < 0.3);
    if (!target) continue;
    const shots = [];
    for (let k = 0; k < 6; k += 1) {
      const now = (await look()).find((m) => m.id === target.id);
      if (!now) break;
      await page.evaluate((x) => window.__BCM_RING_BOSS_QA__.placePilot(x, 0), now.x - 2.4);
      await page.keyboard.down("ArrowRight"); await page.waitForTimeout(60); await page.keyboard.up("ArrowRight");
      await page.keyboard.press("q");
      shots.push(now.kind);
      await page.waitForTimeout(700);
    }
    const left = (await look()).find((m) => m.id === target.id);
    report.laser = { kind: target.kind, shots: shots.length, down: !left };
  }
  const list = [...mobs.values()].map((m) => ({ geometry: m.geometry, kind: m.kind, art: m.art, astral: m.astral, height: m.height,
    travel: +(Math.max(...m.xs) - Math.min(...m.xs)).toFixed(2), rise: +(Math.max(...m.ys) - Math.min(...m.ys)).toFixed(2),
    lowest: +Math.min(...m.bottoms).toFixed(2), highest: +Math.max(...m.bottoms).toFixed(2) }));
  report.cells = cellCount;
  report.mobs = list;
  const kinds = new Set(list.map((m) => m.kind).filter(Boolean));
  const boxes = list.filter((m) => m.geometry === "BoxGeometry").length;
  const gaits = new Set(list.map((m) => (m.rise > 0.3 ? "air" : m.highest > 1.5 ? "ceiling" : "floor") + ":" + Math.round(m.travel)));
  report.summary = { seen: list.length, boxes, art: list.filter((m) => m.art).length, kinds: [...kinds], gaits: [...gaits] };
  report.status = list.length >= 6 && boxes === 0 && list.every((m) => m.art) && kinds.size >= 4 &&
    list.some((m) => m.rise > 0.3 || m.highest > 1.5) && gaits.size >= 3 &&
    // Walkers stay on the floor (or float under 1 m in a purple cell); only the angel and spider go up.
    list.filter((m) => !/angel|spider/.test(m.kind)).every((m) => m.highest < 1.0) &&
    !!(report.laser && report.laser.down) && // The kinds come from the maze seed: an attack is required when its mob is in the maze.
    (report.attacks.puddle > 0 || !report.attacks.toxic) && (report.attacks.shell > 0 || !report.attacks.tank) &&
    !!(report.attacks.toxic || report.attacks.tank) ? "PASS" : "FAIL";
} catch (error) {
  report.failure = String(error?.message || error).split("\n")[0];
  await page.screenshot({ path: resolve(out, "failure.png") }).catch(() => {});
} finally {
  await writeFile(resolve(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
  await browser.close();
}
console.log(JSON.stringify({ status: report.status, failure: report.failure, summary: report.summary, laser: report.laser, attacks: report.attacks }, null, 1));
process.exitCode = report.status === "PASS" ? 0 : 1;
