#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const requireQa = createRequire(resolve(root, "tools/minisim-qa/package.json"));
const argv = process.argv.slice(2);
const arg = (name) => {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : "";
};
const targetUrl = arg("--url") || process.env.MINISIM_URL || "";
const outputDir = resolve(root, ".qa-artifacts");
const reportPath = resolve(outputDir, "minisim-transition-cycle-report.json");
const report = {
  targetUrl,
  targetType: "standalone repository build served from a loopback HTTP fixture",
  audioPolicy: "Audio URLs are empty; audio requests are blocked; HTML audio play() is suppressed; transition videos are forced muted.",
  status: "RUNNING",
  startedAt: new Date().toISOString(),
  checks: [],
  stages: [],
  screenshots: [],
  audioRequests: [],
  audioPlayAttempts: [],
  blockedExternalRequests: [],
  externalResponses: [],
  consoleErrors: [],
  pageErrors: [],
  simulationBoundaries: [
    "The actual Mini-Sim ONICSS proximity handoff and muted tower.mp4 playback are exercised.",
    "Tower-to-First-Planet completion is advanced by dispatching the real loader checkpoint event bcm:tower:planet-ready; platform-by-platform Tower descent is not played in this test.",
    "The First Planet beacon is reached by player movement and activated with E; the real loader calls BCMTowerAPI.beginAscent with the saved Tower seed and mode.",
    "The final Tower upper-exit checkpoint is dispatched as bcm:tower:space-return after validating same-seed ascent and the local reverse-clip URL; platform-by-platform ascent and reverse-video playback are not claimed as tested.",
    "The loader's real save-token, page-reload, Mini-Sim rebuild, Crew restore, mission restore, ship restore and Warp-navigation restore paths are exercised."
  ]
};
const check = (name, ok, detail = "") => {
  report.checks.push({ name, ok: !!ok, detail: detail || undefined });
  if (!ok) throw new Error(name + (detail ? ": " + detail : ""));
};
const screenshot = async (page, name) => {
  const path = resolve(outputDir, name);
  await page.screenshot({ path, fullPage: false });
  report.screenshots.push(".qa-artifacts/" + name);
};
let chromium;
try {
  ({ chromium } = requireQa("playwright"));
} catch {
  console.error("Playwright is not installed. Run the Mini-Sim standalone browser QA workflow.");
  process.exit(2);
}
if (!targetUrl) {
  console.error('Usage: node scripts/minisim-local-transitions-playwright.mjs --url "http://127.0.0.1:<port>/"');
  process.exit(2);
}
const target = new URL(targetUrl);
if (!["127.0.0.1", "localhost"].includes(target.hostname)) {
  console.error("Transition QA only accepts a local loopback URL; live/external targets are forbidden.");
  process.exit(2);
}

await mkdir(outputDir, { recursive: true });
let browser;
let page;
try {
  browser = await chromium.launch({ headless: !argv.includes("--headed") });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: false
  });
  await context.addInitScript(() => {
    try {
      window.__BCM_QA_INITIAL_RETURN = JSON.parse(
        sessionStorage.getItem("bcm-minisim-local-return-v1") || "null"
      );
    } catch {
      window.__BCM_QA_INITIAL_RETURN = null;
    }
    window.__BCM_QA_AUDIO_PLAY_ATTEMPTS = [];
    const nativePlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (this instanceof HTMLAudioElement) {
        window.__BCM_QA_AUDIO_PLAY_ATTEMPTS.push(this.currentSrc || this.src || "");
        this.pause();
        return Promise.resolve();
      }
      this.muted = true;
      this.defaultMuted = true;
      return nativePlay.apply(this, arguments);
    };
  });
  page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.setDefaultNavigationTimeout(60000);
  page.on("console", (message) => {
    if (message.type() === "error") report.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => report.pageErrors.push(String(error && error.stack ? error.stack : error)));
  page.on("request", (request) => {
    let requestUrl;
    try { requestUrl = new URL(request.url()); } catch { return; }
    if (/\.(mp3|wav|ogg|m4a|aac|flac)(?:$|\?)/i.test(requestUrl.pathname)) {
      report.audioRequests.push(request.url());
    }
    if (requestUrl.origin !== target.origin &&
        !["data:", "blob:"].includes(requestUrl.protocol)) {
      report.blockedExternalRequests.push(request.url());
    }
  });
  page.on("response", (response) => {
    let responseUrl;
    try { responseUrl = new URL(response.url()); } catch { return; }
    if (responseUrl.origin !== target.origin &&
        !["data:", "blob:"].includes(responseUrl.protocol)) {
      report.externalResponses.push(response.url());
    }
  });
  await page.route("**/*", async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.origin !== target.origin &&
        !["data:", "blob:"].includes(requestUrl.protocol)) {
      await route.abort("blockedbyclient");
      return;
    }
    if (/\.(mp3|wav|ogg|m4a|aac|flac)(?:$|\?)/i.test(requestUrl.pathname)) {
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });

  await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.locator(".bcm-mini-sim-start").waitFor({ state: "visible", timeout: 30000 });
  check("local fixture has Mini-Sim start control", true);
  check("local fixture includes First Planet host and loader",
    await page.locator(".bcm-first-planet-host .bcm-first-planet-root").count() === 1 &&
    await page.locator("#bcm-first-planet-loader-js").count() === 1);
  check("test target is loopback-only", ["127.0.0.1", "localhost"].includes(target.hostname));
  await screenshot(page, "transition-01-local-menu.png");

  await page.locator(".bcm-mini-sim-start").click();
  await page.locator(".bcm-mini-sim-crew-preflight:not([hidden])").waitFor({ state: "visible", timeout: 15000 });
  await page.locator("[data-crew-start]").click();
  await page.waitForFunction(() => {
    const simRoot = document.querySelector(".bcm-mini-sim");
    const players = window.BCMMiniCrewSelection && window.BCMMiniCrewSelection.players;
    const runtime = window.BCMiniSimAPI?.getRuntime?.();
    return !!simRoot && simRoot.classList.contains("game-active") &&
      !!runtime?.running && Array.isArray(players) && players.length >= 2;
  }, null, { timeout: 30000 });

  const baseline = await page.evaluate(() => {
    const session = window.BCMMiniSimSession;
    const mission = window.BCMWorldMission;
    const crew = window.BCMMiniCrewSelection.players;
    const crewIds = crew.map((row, index) =>
      String(row.id || row.mint || row.name || ("crew-" + index))
    );
    if (!session || !mission || crewIds.length < 2) {
      throw new Error("Standalone flight did not produce a local session and two selected Crew.");
    }

    const towerSeed = 1296255059;
    session.mode = "multi";
    session.locationSeeds = session.locationSeeds || {};
    session.locationSeeds.tower = towerSeed;
    mission.towerSeed = towerSeed;
    mission.towerMode = "multi";
    mission.qaTransitionMarker = "bcm-transition-cycle-qa";
    mission.hydrogenUnlocked = true;
    mission.hydrogenCount = 2;
    mission.hydrogenCollected = false;
    mission.hydrogenCollectedIds = {
      "qa-hydrogen-a": true,
      "qa-hydrogen-b": true
    };
    mission.screenVisited = {
      "qa-screen-a": true,
      "qa-screen-b": false
    };
    mission.requiredScreens = {
      "qa-screen-a": true,
      "qa-screen-b": true
    };

    if (typeof window.BCMDeepSpaceWarpToggle !== "function" ||
        typeof window.BCMDeepSpaceWarpGetReturnSnapshot !== "function") {
      throw new Error("Warp return-snapshot API is unavailable.");
    }
    window.BCMDeepSpaceWarpToggle();
    const navigation = window.BCMDeepSpaceWarpGetReturnSnapshot();
    if (!navigation || !navigation.currentSectorId) {
      throw new Error("The local Warp map did not expose a current sector.");
    }
    return {
      sessionSeed: Number(session.sessionSeed) >>> 0,
      sessionId: String(session.sessionId || ""),
      locationSeeds: { ...session.locationSeeds },
      towerSeed,
      crewIds,
      navigationId: String(navigation.currentSectorId),
      navigationLabel: String(navigation.label || ""),
      missionMarker: mission.qaTransitionMarker,
      gatePosition: { x: 4, y: -2, z: -260 }
    };
  });
  report.expected = baseline;
  check("standalone Crew selection has at least two identities", baseline.crewIds.length >= 2, baseline.crewIds.join(", "));
  check("local Warp snapshot contains the ONI/NEUNO start sector",
    baseline.navigationId === "oni-css-neuno--40-30", baseline.navigationLabel);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => {
    const overlay = document.querySelector(".bcm-warp-overlay");
    return !!overlay && overlay.hidden;
  }, null, { timeout: 10000 });
  report.stages.push("Space Labyrinth flight, two Crew and local Warp sector snapshot prepared");
  await screenshot(page, "transition-02-flight-and-warp-snapshot.png");

  await page.evaluate((position) => {
    if (!window.BCMiniSimAPI.teleport(position)) throw new Error("Mini-Sim test teleport failed.");
  }, baseline.gatePosition);
  await page.waitForFunction(() =>
    !!window.BCMWorldMission?.originShipSnapshot?.ship?.position &&
    window.BCMMiniSimSession?.currentLocation === "tower",
  null, { timeout: 90000 });

  const arrival = await page.evaluate(() => {
    const snapshot = window.BCMWorldMission.originShipSnapshot;
    return {
      ship: snapshot.ship,
      navigation: snapshot.navigation,
      towerSeed: Number(window.BCMWorldMission.towerSeed) >>> 0,
      towerMode: window.BCMWorldMission.towerMode,
      crewIds: (snapshot.crew || []).map((row, index) =>
        String(row.id || row.mint || row.name || ("crew-" + index))
      )
    };
  });
  report.arrival = arrival;
  check("real ONICSS approach handoff captured ship pose and orientation",
    !!arrival.ship?.position && !!arrival.ship?.quaternion);
  check("arrival snapshot includes selected Crew identities",
    baseline.crewIds.every((id) => arrival.crewIds.includes(id)), arrival.crewIds.join(", "));
  check("arrival snapshot includes the pre-Tower Warp sector",
    arrival.navigation?.currentSectorId === baseline.navigationId);
  check("arrival snapshot carries requested Tower seed and MULTI mode",
    arrival.towerSeed === baseline.towerSeed && arrival.towerMode === "multi");
  await screenshot(page, "transition-03-tower-landing.png");

  await page.locator('.bcm-tower-menu [data-tower-mode="multi"]').waitFor({ state: "visible", timeout: 90000 });
  await page.locator('.bcm-tower-menu [data-tower-mode="multi"]').click();
  await page.waitForFunction((expectedSeed) =>
    window.BCMMiniSimSession?.mode === "multi" &&
    Number(window.BCMMiniSimSession?.locationSeeds?.tower) === expectedSeed &&
    Number(window.BCMWorldMission?.towerSeed) === expectedSeed &&
    window.BCMWorldMission?.towerMode === "multi",
  baseline.towerSeed, { timeout: 20000 });
  report.stages.push("Tower landing → MULTI selection → same seeded Tower build");

  await page.waitForFunction(() =>
    !!window.BCMFirstPlanet?.mount &&
    !!window.BCMFirstPlanetConfig?.bundleUrl,
  null, { timeout: 90000 });
  const planetContext = await page.evaluate(() => ({
    mode: window.BCMMiniSimSession.mode,
    seed: Number(window.BCMWorldMission.towerSeed) >>> 0,
    sessionSeed: Number(window.BCMMiniSimSession.sessionSeed) >>> 0,
    planetSeed: Number(window.BCMMiniSimSession.locationSeeds.firstPlanet) >>> 0,
    raceSeed: Number(window.BCMMiniSimSession.locationSeeds.shoalRace) >>> 0,
    sessionId: String(window.BCMMiniSimSession.sessionId || ""),
    players: (window.BCMMiniCrewSelection.players || []).map((row) => ({
      id: String(row.id || row.mint || ""),
      name: String(row.name || ""),
      image: String(row.image || ""),
      species: String(row.species || row.spec || "")
    })),
    preload: false
  }));
  await page.evaluate((detail) => {
    const towerRoot = document.querySelector(".bcm-tower");
    if (!towerRoot) throw new Error("Embedded Tower root is missing.");
    towerRoot.dispatchEvent(new CustomEvent("bcm:tower:planet-ready", { detail }));
  }, planetContext);
  await page.waitForFunction(() => {
    const towerRoot = document.querySelector(".bcm-tower");
    const host = document.querySelector(".bcm-first-planet-host");
    return !!host && !host.hidden && !!towerRoot?.hidden &&
      !!window.__controlsTest?.setKeys;
  }, null, { timeout: 90000 });
  check("First Planet mounted using the local WordPress bundle from the repository", true);
  check("First Planet received original Tower seed and local MULTI mode",
    planetContext.seed === baseline.towerSeed && planetContext.mode === "multi");
  report.stages.push("First Planet bundle mounted after the Tower-bottom checkpoint event");
  await screenshot(page, "transition-04-first-planet.png");

  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.evaluate(() => window.__controlsTest.setKeys(["KeyW"]));
  await page.waitForTimeout(1250);
  await page.evaluate(() => window.__controlsTest.setKeys([]));
  await page.waitForFunction(() =>
    document.querySelector(".bcm-first-planet-host")?.innerText.includes("маяк · подъём в Tower"),
  null, { timeout: 15000 });
  await page.keyboard.press("e");
  await page.waitForFunction((expectedSeed) =>
    window.BCMMiniSimSession?.currentLocation === "tower-ascent" &&
    !document.querySelector(".bcm-tower")?.hidden &&
    Number(window.BCMMiniSimSession?.locationSeeds?.tower) === expectedSeed &&
    Number(window.BCMWorldMission?.towerSeed) === expectedSeed &&
    window.BCMMiniSimSession?.mode === "multi",
  baseline.towerSeed, { timeout: 30000 });

  const ascent = await page.evaluate(() => ({
    location: window.BCMMiniSimSession.currentLocation,
    mode: window.BCMMiniSimSession.mode,
    sessionSeed: Number(window.BCMMiniSimSession.sessionSeed) >>> 0,
    towerSeed: Number(window.BCMMiniSimSession.locationSeeds.tower) >>> 0,
    missionTowerSeed: Number(window.BCMWorldMission.towerSeed) >>> 0,
    reverseClip: String(window.BCMTowerConfig?.planetTransition || ""),
    reverseVideoSource: document.querySelector(".bcm-tower-transition-video")?.getAttribute("src") || ""
  }));
  report.ascent = ascent;
  check("the real First Planet beacon prompt and E interaction starts Tower ascent",
    ascent.location === "tower-ascent");
  check("Tower ascent reuses exact seed, session and MULTI mode",
    ascent.mode === "multi" &&
    ascent.sessionSeed === baseline.sessionSeed &&
    ascent.towerSeed === baseline.towerSeed &&
    ascent.missionTowerSeed === baseline.towerSeed);
  check("local ONICSS reverse-transition clip is configured for ascent",
    /onicss\.mp4/i.test(ascent.reverseClip) &&
    /onicss\.mp4/i.test(ascent.reverseVideoSource),
    ascent.reverseClip || ascent.reverseVideoSource);
  report.stages.push("Actual First Planet beacon movement + E → beginAscent(same seed and mode)");
  await screenshot(page, "transition-05-same-seed-tower-ascent.png");

  report.audioPlayAttempts.push(...await page.evaluate(() => window.__BCM_QA_AUDIO_PLAY_ATTEMPTS || []));
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }),
    page.evaluate(() => {
      const towerRoot = document.querySelector(".bcm-tower");
      if (!towerRoot) throw new Error("Tower root missing at the return checkpoint.");
      towerRoot.dispatchEvent(new CustomEvent("bcm:tower:space-return", {
        detail: {
          mode: window.BCMMiniSimSession.mode,
          seed: Number(window.BCMWorldMission.towerSeed) >>> 0,
          sessionSeed: Number(window.BCMWorldMission.sessionSeed) >>> 0
        }
      }));
    })
  ]);

  await page.waitForFunction((expectedSeed) => {
    const simRoot = document.querySelector(".bcm-mini-sim");
    const runtime = window.BCMiniSimAPI?.getRuntime?.();
    return !!simRoot?.classList.contains("game-active") &&
      !!runtime?.running &&
      window.BCMMiniSimSession?.currentLocation === "space-labyrinth" &&
      window.BCMWorldMission?.returnedToSpaceLabyrinth === true &&
      Number(window.BCMMiniSimSession?.sessionSeed) === expectedSeed &&
      !!window.__BCM_QA_INITIAL_RETURN?.mission?.originShipSnapshot;
  }, baseline.sessionSeed, { timeout: 90000 });

  const restored = await page.evaluate(() => {
    const mission = window.BCMWorldMission;
    const session = window.BCMMiniSimSession;
    const runtime = window.BCMiniSimAPI?.getRuntime?.();
    const currentShip = runtime?.ship;
    const savedPayload = window.__BCM_QA_INITIAL_RETURN;
    const savedSnapshot = savedPayload?.mission?.originShipSnapshot;
    const navigation = window.BCMDeepSpaceWarpGetReturnSnapshot?.();
    return {
      currentLocation: session?.currentLocation,
      sessionSeed: Number(session?.sessionSeed) >>> 0,
      sessionId: String(session?.sessionId || ""),
      mode: session?.mode,
      locationSeeds: session?.locationSeeds || {},
      missionMarker: mission?.qaTransitionMarker,
      hydrogenUnlocked: !!mission?.hydrogenUnlocked,
      hydrogenCount: Number(mission?.hydrogenCount),
      hydrogenCollectedIds: Object.keys(mission?.hydrogenCollectedIds || {}).sort(),
      returnedToSpaceLabyrinth: !!mission?.returnedToSpaceLabyrinth,
      returnShipAvailable: !!mission?.returnShipAvailable,
      crewIds: (window.BCMMiniCrewSelection?.players || []).map((row, index) =>
        String(row.id || row.mint || row.name || ("crew-" + index))
      ),
      savedCrewIds: (savedSnapshot?.crew || []).map((row, index) =>
        String(row.id || row.mint || row.name || ("crew-" + index))
      ),
      savedShip: savedSnapshot?.ship || null,
      currentShip: currentShip ? {
        position: {
          x: currentShip.position.x,
          y: currentShip.position.y,
          z: currentShip.position.z
        },
        quaternion: {
          x: currentShip.quaternion.x,
          y: currentShip.quaternion.y,
          z: currentShip.quaternion.z,
          w: currentShip.quaternion.w
        }
      } : null,
      savedNavigationId: savedSnapshot?.navigation?.currentSectorId || null,
      restoredNavigationId: navigation?.currentSectorId || null,
      returnTokenWasPresent: !!savedPayload,
      returnStorageConsumed: sessionStorage.getItem("bcm-minisim-local-return-v1") === null,
      audioAttempts: window.__BCM_QA_AUDIO_PLAY_ATTEMPTS || []
    };
  });
  report.restored = restored;
  report.audioPlayAttempts.push(...restored.audioAttempts);
  check("page reload restored the original local session ID, seed and MULTI mode",
    restored.sessionSeed === baseline.sessionSeed &&
    restored.sessionId === baseline.sessionId &&
    restored.mode === "multi");
  check("the original ship pose is restored (allowing the Tower-gate push-off)",
    !!restored.savedShip?.position && !!restored.currentShip?.position &&
    Math.hypot(
      restored.currentShip.position.x - restored.savedShip.position.x,
      restored.currentShip.position.y - restored.savedShip.position.y,
      restored.currentShip.position.z - restored.savedShip.position.z
    ) < 54 &&
    ["x", "y", "z", "w"].every((axis) =>
      Math.abs(restored.currentShip.quaternion[axis] - restored.savedShip.quaternion[axis]) < 0.002
    ));
  check("selected Crew identities survive save, reload and roster reconstruction",
    baseline.crewIds.every((id) => restored.crewIds.includes(id)) &&
    baseline.crewIds.every((id) => restored.savedCrewIds.includes(id)));
  check("Tower, Warp, asteroid, Ring, First Planet and Shoal Race seed context survives",
    ["warp", "asteroid", "ring", "tower", "firstPlanet", "shoalRace"].every((key) =>
      Number(restored.locationSeeds[key]) === Number(baseline.locationSeeds[key])
    ));
  check("mission marker and Hydrogen progress survive the return",
    restored.missionMarker === baseline.missionMarker &&
    restored.hydrogenUnlocked &&
    restored.hydrogenCount === 2 &&
    restored.hydrogenCollectedIds.includes("qa-hydrogen-a") &&
    restored.hydrogenCollectedIds.includes("qa-hydrogen-b") &&
    restored.returnedToSpaceLabyrinth &&
    !restored.returnShipAvailable);
  check("Warp current-sector navigation is restored after page reload",
    restored.savedNavigationId === baseline.navigationId &&
    restored.restoredNavigationId === baseline.navigationId,
    String(restored.restoredNavigationId || ""));
  check("return snapshot exists and is consumed after the rebuilt flight resumes",
    restored.returnTokenWasPresent && restored.returnStorageConsumed);
  check("no audio requests or HTML audio playback attempts occurred",
    report.audioRequests.length === 0 && report.audioPlayAttempts.length === 0,
    JSON.stringify({ requests: report.audioRequests, attempts: report.audioPlayAttempts }));
  check("external asset requests were blocked before any response was received",
    report.externalResponses.length === 0,
    JSON.stringify({ blocked: report.blockedExternalRequests, responses: report.externalResponses }));
  check("no uncaught JavaScript page errors occurred",
    report.pageErrors.length === 0,
    report.pageErrors.join("\n"));

  report.stages.push("Return checkpoint event + page reload + Space Labyrinth/Crew/mission/ship/Warp restoration");
  report.status = report.checks.every((item) => item.ok) ? "PASS" : "FAIL";
} catch (error) {
  report.status = "FAIL";
  report.error = String(error && error.stack ? error.stack : error);
  if (page) {
    try { await screenshot(page, "transition-cycle-failure.png"); } catch {}
  }
} finally {
  report.finishedAt = new Date().toISOString();
  try {
    await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  } catch (error) {
    console.error("Could not write transition-cycle report:", String(error));
  }
  if (browser) await browser.close().catch(() => {});
}
console.log(JSON.stringify({
  status: report.status,
  targetType: report.targetType,
  audioPolicy: report.audioPolicy,
  checks: report.checks,
  stages: report.stages,
  simulationBoundaries: report.simulationBoundaries,
  audioRequests: report.audioRequests,
  audioPlayAttempts: report.audioPlayAttempts,
  blockedExternalRequests: report.blockedExternalRequests,
  externalResponses: report.externalResponses,
  pageErrors: report.pageErrors,
  screenshots: report.screenshots,
  report: ".qa-artifacts/minisim-transition-cycle-report.json",
  error: report.error
}, null, 2));
if (report.status !== "PASS") process.exitCode = 1;
