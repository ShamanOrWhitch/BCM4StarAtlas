#!/usr/bin/env node
// BUG-008 (owner, live site 16.11.2026): in Desk "Флот для игры" the number
// of ships must be the fixed count read from the wallet, and the pick for the
// game fleet a separate number. Browser check of the Desk wallet panel as the
// plugin prints it (the PHP inserts are replaced by test values, the network
// by a fixed wallet).
//   BCM_QA_BROWSER_CHANNEL=msedge node scripts/galia-desk-fleet.qa.mjs [path/to/galia-desk.php]
// Default: the repository file. Not in CI (needs a browser).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const file = resolve(process.argv[2] || resolve(root, "wordpress/galia-desk/galia-desk.php"));
const php = readFileSync(file, "utf8");
const end = php.indexOf("</script>", php.indexOf("data-galia-ship-qty")) + "</script>".length;
const start = php.lastIndexOf("?>", php.indexOf("data-galia-wallet")) + 2;
const panel = php.slice(start, end)
  .replace(/<\?php echo galia_desk_roster_html\(\); \?>/, "")
  .replace(/<\?php echo wp_json_encode\(\$ajax\); \?>/, '"/no-ajax"')
  .replace(/<\?php echo wp_json_encode\(\$nonce\); \?>/, '"qa"');
if (/<\?php/.test(panel)) throw new Error("an unknown PHP insert is left in the panel");

const WALLET = {
  owner: "QA",
  note: "",
  profiles: [],
  items: [
    { kind: "crew", mint: "c1", name: "Aanothin Thalaramgroo", spec: "Profound Punaab", rarity: "Common", image: "", traits: [] },
    { kind: "crew", mint: "c2", name: "Crudzor Lexi Eko", spec: "Mierese", rarity: "Rare", image: "", traits: [] },
    { kind: "ship", mint: "s1", name: "Fimbul Airbike", amount: 6, crew: 1, rarity: "common", image: "" },
    { kind: "ship", mint: "s2", name: "Opal Jetjet", amount: 5, crew: 2, rarity: "uncommon", image: "" },
    { kind: "ship", mint: "s3", name: "Rainbow Om", amount: 1, crew: 4, rarity: "epic", image: "" },
  ],
};

const browser = await chromium.launch({ channel: process.env.BCM_QA_BROWSER_CHANNEL || undefined });
const failures = [];
const check = (ok, text) => { console.log((ok ? "ok   " : "FAIL ") + text); if (!ok) failures.push(text); };
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (url.includes("wallet-scan")) return route.fulfill({ contentType: "application/json", body: JSON.stringify(WALLET) });
    if (url.startsWith("http://qa.local/")) return route.fulfill({ contentType: "text/html; charset=utf-8", body: `<!doctype html><html><head><meta charset="utf-8"></head><body>${panel}</body></html>` });
    return route.fulfill({ status: 404, body: "" });
  });
  await page.goto("http://qa.local/");
  await page.fill('[data-galia-wallet] input[name="owner"]', "QA");
  await page.evaluate(() => document.querySelector("[data-galia-wallet]").requestSubmit());
  await page.waitForSelector("[data-galia-ship-qty]", { timeout: 15000 });

  const rows = () => page.evaluate(() => [...document.querySelectorAll(".galia-fleet-row")].map((row) => ({
    name: row.querySelector("strong").textContent,
    text: row.textContent.replace(/\s+/g, " "),
    value: row.querySelector("[data-galia-ship-qty]").value,
  })));
  let list = await rows();
  for (const [name, owned] of [["Fimbul Airbike", 6], ["Opal Jetjet", 5], ["Rainbow Om", 1]]) {
    const row = list.find((r) => r.name === name);
    check(new RegExp(`на кошельке: ?${owned}\\b`).test(row.text), `${name}: the row shows the fixed wallet count ${owned} (row: "${row.text.slice(0, 90)}")`);
  }
  // Take ships into the fleet; the wallet count must not move, the pick is capped by it.
  await page.fill('[data-galia-ship-qty][data-mint="s3"]', "5");
  await page.dispatchEvent('[data-galia-ship-qty][data-mint="s3"]', "change");
  await page.fill('[data-galia-ship-qty][data-mint="s2"]', "0");
  await page.dispatchEvent('[data-galia-ship-qty][data-mint="s2"]', "change");
  list = await rows();
  const om = list.find((r) => r.name === "Rainbow Om");
  check(om.value === "1", `Rainbow Om: asked for 5, only 1 on the wallet, the fleet takes 1 (field shows ${om.value})`);
  check(/на кошельке: ?1\b/.test(om.text), "Rainbow Om: the wallet count stays 1 after the pick");
  const summary = await page.evaluate(() => document.querySelector("[data-galia-fleet-summary]").textContent.replace(/\s+/g, " "));
  check(/во флоте: ?1 из 12 на кошельке/.test(summary), `the summary counts ships taken and ships owned ("${summary}")`);
  const fleet = await page.evaluate(() => window.GALIA_FLEET);
  check(Array.isArray(fleet?.ships) && fleet.ships.length === 1 && fleet.ships[0].name === "Rainbow Om" && fleet.ships[0].quantity === 1,
    `the fleet sent to the game is Rainbow Om x1 (${JSON.stringify(fleet?.ships)})`);
} finally {
  await browser.close();
}
if (failures.length) {
  console.error(`FAIL: ${failures.length} of the checks`);
  process.exit(1);
}
console.log("PASS");
