#!/usr/bin/env node
import { createServer } from "node:http";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { extname, resolve, sep, dirname } from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const shellPath = resolve(root, "tools/minisim-qa/standalone-shell.html");
const allowedExt = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".mp4", ".webm", ".ogg", ".mp3", ".m4a", ".wav"]);
const mime = (file) => ({
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".gif": "image/gif", ".mp4": "video/mp4",
  ".webm": "video/webm", ".ogg": "audio/ogg", ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4", ".wav": "audio/wav",
}[extname(file).toLowerCase()] || "application/octet-stream");

async function scanAssets(directory, urlPrefix) {
  const output = [];
  async function walk(current, relative = "") {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const absolute = resolve(current, entry.name);
      const rel = relative ? relative + "/" + entry.name : entry.name;
      if (entry.isDirectory()) await walk(absolute, rel);
      else if (entry.isFile() && allowedExt.has(extname(entry.name).toLowerCase())) {
        const extension = extname(entry.name).slice(1).toLowerCase();
        const type = ["mp4", "webm"].includes(extension) ? "video"
          : ["mp3", "m4a", "wav", "ogg"].includes(extension) ? "audio" : "image";
        const encoded = rel.split("/").map(encodeURIComponent).join("/");
        output.push({ name: rel.replaceAll("\\", "/"), type, extension, url: urlPrefix + "/" + encoded });
      }
    }
  }
  await walk(directory);
  return output.sort((a, b) => a.name.localeCompare(b.name));
}
function pickAsset(assets, names, type) {
  for (const wanted of names.map((x) => String(x).toLowerCase())) {
    const exact = assets.find((a) => a.type === type && a.name.toLowerCase() === wanted);
    if (exact) return exact.url;
  }
  for (const asset of assets) {
    if (asset.type !== type) continue;
    const base = asset.name.split("/").pop().toLowerCase().replace(/\.[^.]+$/, "");
    if (names.some((wanted) => base === String(wanted).toLowerCase().replace(/\.[^.]+$/, ""))) return asset.url;
  }
  return "";
}
const miniPhp = await readFile(resolve(root, "mini-sim/bcm-mini-sim.php"), "utf8");
const towerPhp = await readFile(resolve(root, "mini-sim/tower/bcm-tower.php"), "utf8");
const miniVersion = miniPhp.match(/define\('BCM_MINI_SIM_VERSION',\s*'([^']+)'/i)?.[1] || "unknown";
const towerVersion = towerPhp.match(/define\('BCM_TOWER_VERSION',\s*'([^']+)'/i)?.[1] || "unknown";
function encodeConfig(value) { return JSON.stringify(value).replace(/</g, "\\u003c"); }

const server = createServer(async (req, res) => {
  try {
    const request = new URL(req.url || "/", "http://127.0.0.1");
    if (request.pathname === "/__qa-health") {
      res.writeHead(200, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
      res.end("ok");
      return;
    }
    if (request.pathname === "/") {
      const origin = "http://127.0.0.1:" + server.address().port;
      const miniAssets = await scanAssets(resolve(root, "mini-sim/assets"), origin + "/wp-content/plugins/mini-sim/assets");
      const towerAssetsRaw = await scanAssets(resolve(root, "mini-sim/tower/assets"), origin + "/wp-content/plugins/mini-sim/tower/assets");
      const towerAssets = towerAssetsRaw.map((a) => ({ ...a, name: "tower/" + a.name }));
      const allAssets = miniAssets.concat(towerAssets);
      const base = origin + "/wp-content/plugins/mini-sim";
      const assetUrl = (name) => base + "/" + String(name).split("/").map(encodeURIComponent).join("/");
      const pick = (names, type, assets = miniAssets) => pickAsset(assets, names, type);
      const backsideTextures = miniAssets.filter((a) => a.type === "image" && /^back.*\.png$/i.test(a.name.split("/").pop())).map((a) => a.url);

      const miniConfig = {
        crewServerAjax: origin + "/wp-admin/admin-ajax.php",
        crewServerNonce: "standalone-qa-no-wallet",
        threeUrl: assetUrl("assets/js/three.min.js"),
        towerApproach: { x: 0, y: -2, z: -260, preloadRadius: 150, coverageThreshold: 0.69, uiRadius: 200, gateAutoProgress: 0.85, portalCoverageThreshold: 0.60, backPortalDistance: 8.5 },
        towerJsUrl: assetUrl("tower/assets/js/tower.js") + "?ver=" + encodeURIComponent(towerVersion),
        towerCssUrl: assetUrl("tower/assets/css/tower.css") + "?ver=" + encodeURIComponent(towerVersion),
        towerLandingUrl: pick(["tower.mp4"], "video"),
        towerFallbackUrl: "",
        doorTexture: pick(["door1.png", "door.png"], "image"),
        menuBackgroundUrl: pick(["perference bg.png"], "image"),
        musicUrl: pick(["starbase ost.mp3", "starbase-ost.mp3", "ost.mp3"], "audio"),
        warpMusicUrl: pick(["warp.mp3"], "audio"),
        spaceVideoZones: [
          { url: pick(["onicss.mp4"], "video"), x: 0, y: -2, z: -260, radius: 36, preloadRadius: 80, maxWidth: 13, maxHeight: 8, preloadWhenStarted: true, towerGate: true },
          { url: pick(["portal1.mp4"], "video"), x: -4.2, y: 1.4, z: -42, radius: 9, maxWidth: 7.2, maxHeight: 4.5 },
          { url: pick(["portal2.mp4"], "video"), x: -18, y: 7, z: -105, radius: 16, maxWidth: 8, maxHeight: 5 },
          { url: pick(["portal3.mp4"], "video"), x: 18, y: -6, z: -135, radius: 18, maxWidth: 8.5, maxHeight: 5.2 }
        ],
        capdoorVideo: pick(["capdoor.mp4"], "video"),
        room1WallVideo: pick(["Wall.mp4"], "video"),
        room2RightVideo: pick(["doorwallbotright.mp4"], "video"),
        backsideTextures,
        crewRosterUrl: assetUrl("assets/crew-roster.json") + "?ver=" + encodeURIComponent(miniVersion),
        crewRosterDefaultCount: 96,
        galiaAssetBase: "",
        assets: miniAssets,
        version: miniVersion
      };

      const byBase = (pattern) => allAssets.filter((a) => a.type === "image" && pattern.test(a.name.split("/").pop())).map((a) => a.url);
      const towerConfig = {
        threeUrl: assetUrl("assets/js/three.min.js"),
        transition: pick(["tower.mp4"], "video", allAssets),
        transitionFallbacks: [],
        towerAudio: pick(["tower.mp3"], "audio", allAssets),
        towerWallJpgPool: byBase(/^(towerwall|wall)[^/]*\.(jpg|jpeg)$/i),
        towerWallPngPool: byBase(/^towerwall[^/]*\.png$/i),
        platformPool: byBase(/^(platform|paltform)(?!lava|ice)[^/]*\.(png|jpg|jpeg|webp)$/i),
        platformLavaPool: byBase(/^(platformlava|paltformlava)[^/]*\.(png|jpg|jpeg|webp)$/i),
        platformIcePool: byBase(/^platformice[^/]*\.(png|jpg|jpeg|webp)$/i),
        upperPlatformPool: byBase(/^upperplatform[^/]*\.(png|jpg|jpeg|webp)$/i),
        rockPool: byBase(/^rock[^/]*\.(png|jpg|jpeg|webp)$/i),
        liftPool: byBase(/^lift[^/]*\.(png|jpg|jpeg|webp)$/i),
        boxPool: byBase(/^box[^/]*\.(png|jpg|jpeg|webp)$/i),
        safeBoxPool: byBase(/^safebox[^/]*\.(png|jpg|jpeg|webp)$/i),
        dangerBoxPool: byBase(/^dangerbox[^/]*\.(png|jpg|jpeg|webp)$/i),
        firePool: byBase(/^fire(?!metalbear)[^/]*\.(png|jpg|jpeg|webp)$/i),
        lavaPool: byBase(/^lava[^/]*\.(png|jpg|jpeg|webp)$/i),
        landingPool: byBase(/^h\d*\.(png|jpg|jpeg|webp)$/i),
        doorPool: byBase(/^door[^/]*\.(png|jpg|jpeg|webp)$/i),
        wallDoorPool: byBase(/^walldoor\.(png|jpg|jpeg|webp)$/i),
        npcPool: byBase(/^(walldoorpiratebear|walldoormetalbear|firemetalbear)[^/]*\.(png|jpg|jpeg|webp)$/i),
        backgroundMenu: pick(["backgroundmenu.png", "backgroundmenu.jpg", "backgroundmenu.webp", "perference bg.png"], "image", allAssets),
        shipTexture: pick(["ship.png", "ship.webp", "ship.jpg", "ship.jpeg"], "image", allAssets),
        planetMaps: byBase(/^planet[^/]*\.(png|webp|jpg|jpeg)$/i),
        version: towerVersion
      };
      let html = await readFile(resolve(root, "tools/minisim-qa/standalone-shell.html"), "utf8");
      html = html.replace("__BCM_MINI_SIM_CONFIG__", encodeConfig(miniConfig)).replace("__BCM_TOWER_CONFIG__", encodeConfig(towerConfig));
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      res.end(html);
      return;
    }
    const marker = "/wp-content/plugins/mini-sim/";
    if (request.pathname.startsWith(marker)) {
      const relative = decodeURIComponent(request.pathname.slice(marker.length));
      const baseDir = resolve(root, "mini-sim");
      const file = resolve(baseDir, relative);
      if (file.startsWith(baseDir + sep) && (await stat(file)).isFile()) {
        res.writeHead(200, { "content-type": mime(file), "cache-control": "no-store" });
        res.end(await readFile(file));
        return;
      }
    }
    if (request.pathname === "/favicon.ico") { res.writeHead(204); res.end(); return; }
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  } catch (error) {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end(String(error?.stack || error));
  }
});
await new Promise((resolveListen, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolveListen);
});
const origin = "http://127.0.0.1:" + server.address().port;
const targetUrl = origin + "/";
const flags = process.argv.slice(2).filter((x) => ["--headed", "--full-media"].includes(x));
console.log("[standalone-qa] Serving current repository build at " + targetUrl);
console.log("[standalone-qa] This fixture tests the repository browser runtime, not live WordPress integration or physical hardware.");
const child = spawn(process.execPath, [resolve(root, "scripts/minisim-local-qa.mjs"), "--url", targetUrl, ...flags], {
  cwd: root, env: { ...process.env, MINISIM_QA_TARGET_KIND: "standalone-repository-build" }, stdio: "inherit"
});
const childCode = await new Promise((resolveExit) => {
  child.once("error", (error) => { console.error(error); resolveExit(2); });
  child.once("exit", (code, signal) => resolveExit(signal ? 1 : (code ?? 1)));
});
try {
  const reportPath = resolve(root, ".qa-artifacts/minisim-qa-report.json");
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  report.targetType = "standalone repository build (not live WordPress integration)";
  report.wpIntegrationVerified = false;
  try { report.repositoryCommit = process.env.GITHUB_SHA || execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(); }
  catch { report.repositoryCommit = process.env.GITHUB_SHA || null; }
  report.fixture = "tools/minisim-qa/standalone-shell.html";
  report.execution = "Playwright Chromium against a local HTTP fixture; JavaScript/CSS/media assets are routed from this checkout.";
  await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({
    targetType: report.targetType, repositoryCommit: report.repositoryCommit,
    status: report.status, checks: report.checks, screenshots: report.screenshots,
    report: ".qa-artifacts/minisim-qa-report.json"
  }, null, 2));
} catch (error) {
  console.error("[standalone-qa] Could not annotate the QA report:", error);
}
await new Promise((resolveClose) => server.close(resolveClose));
process.exitCode = childCode;
