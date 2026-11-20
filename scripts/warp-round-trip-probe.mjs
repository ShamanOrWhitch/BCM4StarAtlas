#!/usr/bin/env node
// Strict standalone browser gate for BUG-019.
// Current post-D-069 map: Fable = ONI CSS [-40,30], Opus = [-41,30],
// Twinsun = [-40,31]. The previous probe still treated [-40,31] as Fable.
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const requireQa = createRequire(resolve(root, "tools/minisim-qa/package.json"));
const { chromium } = requireQa("playwright");
const urlIndex = process.argv.indexOf("--url");
const url = urlIndex >= 0 ? process.argv[urlIndex + 1] : "";
const out = resolve(root, ".qa-artifacts/warp-round-trip");
await mkdir(out, { recursive: true });

const report = {
  status: "RUNNING",
  scenario: "ONI/Fable -> Opus -> ONI/Fable -> Twinsun -> ONI/Fable",
  expectedSectors: {
    opus: { x: -41, y: 30, planet: "opus", id: "coord--41-30" },
    fable: { x: -40, y: 30, planet: "fable" },
    twinsun: { x: -40, y: 31, planet: "first", id: "coord--40-31" }
  },
  jumps: [],
  planetArrivals: [],
  checks: [],
  errors: []
};

let browser;
let page;

function check(name, condition, actual) {
  const result = { name, ok: Boolean(condition) };
  if (actual !== undefined) result.actual = actual;
  report.checks.push(result);
  if (!condition) {
    throw new Error(name + "; actual=" + JSON.stringify(actual));
  }
}

const snap = (label) => page.evaluate((label) => {
  const runtime = window.BCMiniSimAPI?.getRuntime?.();
  const route = window.BCMDeepSpaceWarpGetRouteState?.() || null;
  const current = window.BCMDeepSpaceWarpGetReturnSnapshot?.()?.current ?? null;
  const overlay = document.querySelector(".bcm-warp-overlay");
  return {
    label,
    overlayOpen: !!overlay && !overlay.hidden,
    place: window.BCMiniSimAPI?.getPlace?.() ?? null,
    sector: current ? {
      id: current.id ?? null,
      x: Number.isFinite(Number(current.x)) ? Number(current.x) : null,
      y: Number.isFinite(Number(current.y)) ? Number(current.y) : null,
      name: current.name ?? current.title ?? null
    } : null,
    planet: window.BCMPlanetLanding?.planetId?.() ?? null,
    route: route && {
      destination: route.destination?.id ?? null,
      current: route.currentLocation?.id ?? route.currentLocation ?? null,
      navCurrent: route.navCurrent ?? null
    },
    shipVisible: runtime?.ship?.visual ? runtime.ship.visual.visible : null,
    shipPos: runtime?.ship?.position
      ? [runtime.ship.position.x, runtime.ship.position.y, runtime.ship.position.z].map((v) => Math.round(v))
      : null,
    tubeErrors: window.BCMWarpBridgeFlight?.drawErrors?.() ?? []
  };
}, label);

function expectPlanetArrival(label, snapshot, expected) {
  check(label + ": Warp return snapshot has the requested sector coordinates",
    snapshot.sector?.x === expected.x && snapshot.sector?.y === expected.y,
    snapshot.sector);
  check(label + ": planet identity is correct",
    snapshot.planet === expected.planet,
    { expected: expected.planet, actual: snapshot.planet });
  check(label + ": arrival is not inside the asteroid maze",
    snapshot.place === null,
    snapshot.place);
  check(label + ": arrival closes the Warp overlay",
    snapshot.overlayOpen === false,
    snapshot.overlayOpen);
  check(label + ": the ship remains visible after arrival",
    snapshot.shipVisible === true,
    snapshot.shipVisible);
  check(label + ": route records a current location",
    snapshot.route?.current != null,
    snapshot.route);
  const drawErrors = snapshot.tubeErrors;
  const noDrawErrors = !drawErrors || (typeof drawErrors === "object" && Object.keys(drawErrors).length === 0);
  check(label + ": Warp tube renderer has no draw errors", noDrawErrors, drawErrors);
}

async function jump(n, expected, pickHome = false) {
  await page.keyboard.press("V");
  await page.locator(".bcm-warp-overlay:not([hidden])").first().waitFor({ state: "visible", timeout: 15000 });
  await page.waitForTimeout(400);

  const cells = page.locator("[data-warp-grid] .bcm-warp-grid-cell.is-connected");
  await cells.first().waitFor({ state: "visible", timeout: 15000 });
  const choices = await cells.evaluateAll((list) => list.map((el) => [
    el.getAttribute("data-sector-id"),
    el.textContent.replace(/\s+/g, " ").trim().slice(0, 80)
  ]));

  let index = 0;
  if (pickHome) {
    index = choices.findIndex(([id, text]) => /-40.*30|ONI|NEUNO/i.test(id + " " + text));
    if (index < 0) throw new Error("Warp map has no ONI CSS / Fable return sector: " + choices.map((x) => x[0]).join(", "));
  } else if (expected.id) {
    index = choices.findIndex(([id]) => id === expected.id);
    if (index < 0) throw new Error("Warp map has no expected sector " + expected.id + ": " + choices.map((x) => x[0]).join(", "));
  }

  const selectedId = choices[index]?.[0];
  if (!selectedId) throw new Error("Warp map selection " + index + " is empty");
  await cells.nth(index).click();
  const before = await snap("jump " + n + ": selected " + selectedId);
  check("jump " + n + ": selected destination is committed to Warp state",
    before.route?.destination === selectedId,
    { selectedId, destination: before.route?.destination });

  await page.locator("[data-warp-start]").click();
  await page.locator('[data-warp-view="tube"]:not([hidden])').waitFor({ state: "visible", timeout: 10000 });
  await page.waitForTimeout(6000);
  const mid = await snap("jump " + n + ": in the tube");
  await page.screenshot({ path: resolve(out, "jump-" + n + "-tube.png") });

  await page.locator("[data-tube-abort]").waitFor({ state: "visible", timeout: 70000 });
  await page.waitForTimeout(4500);
  await page.waitForFunction(({ x, y }) => {
    const current = window.BCMDeepSpaceWarpGetReturnSnapshot?.()?.current;
    const overlay = document.querySelector(".bcm-warp-overlay");
    return !!current && Number(current.x) === x && Number(current.y) === y && (!overlay || overlay.hidden);
  }, { x: expected.x, y: expected.y }, { timeout: 30000 });

  const after = await snap("jump " + n + ": arrived at " + expected.planet);
  await page.screenshot({ path: resolve(out, "jump-" + n + "-arrival.png") });
  expectPlanetArrival("jump " + n + " -> " + expected.planet, after, expected);

  const record = { number: n, selectedId, choices, before, mid, after };
  report.jumps.push(record);
  report.planetArrivals.push({ planet: expected.planet, sector: after.sector, place: after.place });
  return record;
}

try {
  if (!url) throw new Error("Standalone QA runner did not pass --url");
  browser = await chromium.launch({
    channel: process.env.BCM_QA_BROWSER_CHANNEL || undefined,
    args: ["--autoplay-policy=no-user-gesture-required"]
  });
  page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (error) => report.errors.push("pageerror: " + error.message));
  page.on("console", (message) => {
    if (message.type() === "error") report.errors.push("console: " + message.text());
  });

  await page.goto(url + (url.includes("?") ? "&" : "?") + "bcm_qa_warp_nodamage=1", {
    waitUntil: "domcontentloaded",
    timeout: 60000
  });
  await page.locator(".bcm-mini-sim-start").first().click({ timeout: 20000 });
  await page.locator("[data-crew-start]").first().click({ timeout: 20000 });
  await page.waitForFunction(() =>
    document.querySelector(".bcm-mini-sim")?.classList.contains("game-active") &&
    !!window.BCMiniSimAPI &&
    !!window.BCMDeepSpaceWarpGetReturnSnapshot,
  null, { timeout: 40000 });
  await page.waitForTimeout(1500);
  report.start = await snap("start");

  // Opus is a real one-sector neighbour west of ONI CSS.
  await jump(1, report.expectedSectors.opus);
  // Returning to ONI CSS must resolve to Fable, not the old desert identity.
  await jump(2, report.expectedSectors.fable, true);
  // The north sector is now Twinsun / the original desert planet, not Fable.
  await jump(3, report.expectedSectors.twinsun);
  // The return trip must consistently restore the Fable start sector again.
  await jump(4, report.expectedSectors.fable, true);

  check("no browser page or console errors during all four Warp jumps",
    report.errors.length === 0,
    report.errors);
  report.status = "PASS";
} catch (error) {
  report.status = "FAIL";
  report.failure = String(error && error.message || error).split("\n")[0];
  await page?.screenshot({ path: resolve(out, "failure.png") }).catch(() => {});
} finally {
  report.finishedAt = new Date().toISOString();
  await browser?.close().catch(() => {});
  await writeFile(resolve(out, "report.json"), JSON.stringify(report, null, 2) + "\n", "utf8");
}

console.log(JSON.stringify({
  status: report.status,
  scenario: report.scenario,
  checks: report.checks,
  arrivals: report.planetArrivals,
  errors: report.errors,
  failure: report.failure,
  report: ".qa-artifacts/warp-round-trip/report.json"
}, null, 2));

if (report.status !== "PASS") process.exitCode = 1;
