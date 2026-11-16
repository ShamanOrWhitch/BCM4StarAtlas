#!/usr/bin/env node
// BUG-010 (owner, live site 16.11.2026): "меню экипаж при маленьком экране
// невозможно пролистать ниже". Browser check on the built Galia app (the same
// build the WordPress Desk ships): on a short window every crew card must be
// reachable by scrolling.
//   BCM_QA_BROWSER_CHANNEL=msedge node scripts/galia-crew-scroll.qa.mjs
// Not in CI: it needs a browser and a Vite build (about 10 s).
import { createServer } from "node:http";
import { readFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { resolve, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const out = process.env.GALIA_BUILD_DIR || (await mkdtemp(join(tmpdir(), "galia-wp-")));
if (!process.env.GALIA_BUILD_DIR) {
  execFileSync(process.execPath, [resolve(root, "node_modules/vite/bin/vite.js"), "build", "--config", "wordpress/galia-desk/vite.wp.config.ts", "--outDir", out], { cwd: root, stdio: "ignore" });
}
const types = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".jpg": "image/jpeg", ".png": "image/png" };
const server = createServer(async (req, res) => {
  const path = new URL(req.url, "http://x").pathname;
  if (path === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end(`<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/app.css"><style>html,body{margin:0;height:100%}</style></head><body><div id="galia-root"></div><script>window.GALIA_WP = { ajax: "/no-ajax", nonce: "qa" };</script><script type="module" src="/app.js"></script></body></html>`);
  }
  try {
    const body = await readFile(join(out, path));
    res.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ channel: process.env.BCM_QA_BROWSER_CHANNEL || undefined });
const failures = [];
try {
  // The owner's pane (about 1050 x 520), a phone in landscape, a wide but short window, and a normal desktop.
  for (const [width, height] of [[1050, 520], [740, 360], [1440, 500], [1440, 900]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));
    page.on("console", (m) => { if (m.type() === "error") pageErrors.push(m.text()); });
    await page.goto(url);
    await page.waitForSelector("#galia-root ul li button", { timeout: 30000, state: "attached" }).catch(() => {
      throw new Error("Galia did not render the crew list: " + (pageErrors.slice(0, 3).join(" | ") || "no page errors"));
    });
    const result = await page.evaluate(async () => {
      const cards = [...document.querySelectorAll("#galia-root ul li button")].filter((b) => b.querySelector("p"));
      const last = cards[cards.length - 1];
      last.scrollIntoView({ block: "center" });
      await new Promise((r) => setTimeout(r, 200));
      const box = last.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + Math.min(box.height / 2, 20));
      return {
        cards: cards.length,
        seen: box.height > 20 && box.top >= 0 && box.bottom <= window.innerHeight + 1 && !!hit && last.contains(hit),
        top: Math.round(box.top), bottom: Math.round(box.bottom), pageScroll: document.documentElement.scrollHeight > window.innerHeight + 2,
      };
    });
    const line = `${width}x${height}: ${result.cards} crew cards, last card ${result.seen ? "reachable" : "NOT reachable"} (top ${result.top}, bottom ${result.bottom})`;
    console.log(line);
    if (!result.seen) failures.push(`the crew list cannot be scrolled to its last card at ${width}x${height} (card at ${result.top}..${result.bottom} of ${height})`);
    if (result.pageScroll) failures.push(`the page itself scrolls at ${width}x${height}: the app no longer fits its window`);
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
if (failures.length) {
  console.error("FAIL\n" + failures.join("\n"));
  process.exit(1);
}
console.log("PASS");
