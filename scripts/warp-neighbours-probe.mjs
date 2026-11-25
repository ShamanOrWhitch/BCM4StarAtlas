#!/usr/bin/env node
// Owner 26.11.2026 browser probe: after a Warp jump into an asteroid sector the sky shows that
// sector, not ONI CSS (no landing screen, no station), and its real neighbours stand in their direction.
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = createRequire(resolve(root, "tools/minisim-qa/package.json"))("playwright");
const url = process.argv[process.argv.indexOf("--url") + 1];
const out = resolve(root, ".qa-artifacts/warp-neighbours");
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
  report.picked = labels[pick];
  const seen = await page.evaluate(() => {
    const runtime = window.BCMiniSimAPI.getRuntime();
    const THREE = window.THREE;
    let gate = null, station = null;
    const markers = [];
    runtime.scene.traverse((o) => {
      if (o.userData && o.userData.facePlayer && !gate) gate = o;
      if (o.name === "onicss-companion-sphere") station = o;
      if (/^sector-neighbour-/.test(o.name) && o.userData.neighbour) markers.push(o);
    });
    const shown = (o) => { let v = !!o; for (let p = o; p; p = p.parent) if (!p.visible) v = false; return v; };
    const cam = new THREE.Vector3(); runtime.camera.getWorldPosition(cam);
    const at = window.BCMSectorLook && window.BCMSectorLook.neighboursAt ? window.BCMSectorLook.neighboursAt() : null;
    const expected = at && window.BCMSectorLook.neighboursOf ? window.BCMSectorLook.neighboursOf(at[0], at[1]).length : null;
    const gatePos = gate ? gate.getWorldPosition(new THREE.Vector3()) : null;
    return {
      look: window.BCMSectorLook ? window.BCMSectorLook.current() : null,
      gateShown: shown(gate) && !!gatePos && gatePos.distanceTo(cam) < 2000,
      stationShown: shown(station),
      at, expected,
      markers: markers.filter(shown).map((m) => {
        const w = m.getWorldPosition(new THREE.Vector3()).sub(cam);
        const n = m.userData.neighbour;
        // East (+dx) is +x, north (+dy) is ahead (-z).
        const agrees = (n.dx === 0 || Math.sign(w.x) === Math.sign(n.dx)) && (n.dy === 0 || Math.sign(-w.z) === Math.sign(n.dy));
        return { name: n.name, kind: n.kind, jumps: n.jumps, dist: Math.round(w.length()), agrees };
      })
    };
  });
  report.seen = seen;
  await page.screenshot({ path: resolve(out, "asteroid-sector-sky.png") });
  // The sky towards each neighbour, drawn from the ship's place with the walls of the maze hidden for this
  // one frame (QA only: the picture of what stands out there, not a game view).
  const views = await page.evaluate(() => {
    const rt = window.BCMiniSimAPI.getRuntime();
    const THREE = window.THREE;
    const shots = [];
    const markers = [];
    rt.scene.traverse((o) => { if (/^sector-neighbour-/.test(o.name) && o.userData.neighbour) markers.push(o); });
    const cam = rt.camera.clone();
    rt.camera.getWorldPosition(cam.position);
    cam.far = 400; cam.aspect = rt.renderer.domElement.width / rt.renderer.domElement.height; cam.updateProjectionMatrix();
    const hidden = [];
    rt.scene.traverse((o) => { if (o.isMesh && o.visible && !/^sector-/.test(o.name) && !(o.parent && /^sector-neighbour/.test(o.parent.name)) && !(o.parent && o.parent.parent && /^sector-neighbour/.test(o.parent.parent.name))) { const p = o.getWorldPosition(new THREE.Vector3()); if (p.distanceTo(cam.position) < 120) { o.visible = false; hidden.push(o); } } });
    markers.slice(0, 3).forEach((m) => {
      cam.lookAt(m.getWorldPosition(new THREE.Vector3()));
      rt.renderer.render(rt.scene, cam);
      shots.push(rt.renderer.domElement.toDataURL("image/jpeg", 0.8));
    });
    hidden.forEach((o) => { o.visible = true; });
    return shots;
  });
  const fsMod = await import("node:fs/promises");
  for (const [i, url] of views.entries()) await fsMod.writeFile(resolve(out, "neighbour-" + i + ".jpg"), Buffer.from(url.split(",")[1], "base64"));
  // Look around: the camera turned to each side of the sky.
  report.status = !seen.gateShown && !seen.stationShown && seen.markers.length > 0 && seen.markers.length === seen.expected &&
    seen.markers.every((m) => m.agrees && m.dist < 400) ? "PASS" : "FAIL";
} catch (error) {
  report.failure = String(error?.message || error).split("\n")[0];
  await page.screenshot({ path: resolve(out, "failure.png") }).catch(() => {});
} finally {
  await writeFile(resolve(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
  await browser.close();
}
console.log(JSON.stringify({ status: report.status, failure: report.failure, picked: report.picked, seen: report.seen && { ...report.seen, markers: (report.seen.markers || []).map((m) => m.name + " " + m.jumps + "j " + m.dist + "m " + (m.agrees ? "ok" : "WRONG SIDE")) } }, null, 1));
process.exitCode = report.status === "PASS" ? 0 : 1;
