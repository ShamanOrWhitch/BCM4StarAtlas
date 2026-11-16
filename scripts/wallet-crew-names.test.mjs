// BUG-007 (owner, live site 16.11.2026): the wallet shows "CREW #1010495" and
// a chain picture instead of the crew member's name and portrait. On chain the
// name is only the number; the person ("Aanothin Thalaramgroo") and the
// portrait live in the Galaxy crew catalogue. Galaxy /crew without a filter
// returns only the first 100 crew, so a wallet's own crew must be asked for by
// mint: /crew?dasID=<mint>&dasID=<mint>.
//
// Integration: the real browser wallet reader (desk-direct.ts directWallet)
// with the network answering the way Solana DAS and Galaxy answer.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";

// Galia sources import siblings without ".ts" (Vite resolves them); do the same here.
register(
  "data:text/javascript," +
    encodeURIComponent(
      "export async function resolve(s, c, next) { try { return await next(s, c); } catch (e) {" +
        " if (/^\\.\\.?\\//.test(s) && !/\\.[a-z]+$/i.test(s)) return next(s + '.ts', c); throw e; } }",
    ),
);

const ROOT = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");

const MINT = "4S34N22aaaaaaaaaaaaaaaaaaaaaaaaaaaaayefgW72";
const MINT2 = "3Cx8b78bbbbbbbbbbbbbbbbbbbbbbbbbbbbbJKNpooK";
const REAL = {
  [MINT]: { dasID: MINT, mintOffset: 1010495, name: "Aanothin Thalaramgroo", species: "Profound Punaab", sex: "Female", rarity: "Common",
    imageUrl: "https://cdn.staratlas.com/crew/v1/1010495_full.jpeg", openness: 0.01, conscientiousness: 0.4, extraversion: 0.56, agreeableness: 0.05, neuroticism: 0.51, aptitudes: { Medical: "major" } },
  [MINT2]: { dasID: MINT2, mintOffset: 1011784, name: "Crudzor Lexi Eko", species: "Mierese", sex: "Male", rarity: "Rare",
    imageUrl: "https://cdn.staratlas.com/crew/v1/1011784_full.jpeg", openness: 0.06, conscientiousness: 0.41, extraversion: 0.84, agreeableness: 0.02, neuroticism: 0.12, aptitudes: { Flight: "major" } },
};
const FIRST_PAGE = Array.from({ length: 100 }, (_, i) => ({ dasID: "other" + i, mintOffset: i, name: "Other " + i, imageUrl: "x" }));

function chainAsset(mint, number) {
  return {
    id: mint,
    content: {
      metadata: { name: `CREW #${number}`, symbol: "CREW", attributes: [{ trait_type: "Species", value: "Profound Punaab" }] },
      links: { image: `https://chain.example/${number}.png` },
    },
  };
}

function fakeNetwork() {
  const asked = [];
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    asked.push(u);
    const json = (body) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) });
    if (init.method === "POST") {
      const { method } = JSON.parse(init.body);
      if (method === "getAssetsByOwner") return json({ result: { total: 2, items: [chainAsset(MINT, 1010495), chainAsset(MINT2, 1011784)] } });
      return json({ result: { value: [] } });
    }
    if (u.startsWith("https://galaxy.staratlas.com/crew")) {
      const q = new URL(u).searchParams;
      const ids = q.getAll("dasID");
      if (!ids.length) return json(FIRST_PAGE);
      return json(ids.map((id) => REAL[id]).filter(Boolean));
    }
    return json([]);
  };
  return asked;
}

test("the browser wallet reader names the crew and shows their portrait from Galaxy", async () => {
  fakeNetwork();
  const { directWallet } = await import("../src/lib/desk-direct.ts");
  const scan = await directWallet("6p5qiitHPQN3iK5boUAxCXdYoZQCoBY1UdBKgT4jZfNY");
  const crew = scan.items.filter((item) => item.kind === "crew");
  assert.equal(crew.length, 2);
  const a = crew.find((item) => item.mint === MINT);
  assert.equal(a.name, "Aanothin Thalaramgroo", `crew is named by its chain number: "${a.name}"`);
  assert.equal(a.image, REAL[MINT].imageUrl, `crew shows the chain picture, not its portrait: ${a.image}`);
  assert.equal(a.spec, "Profound Punaab");
  assert.equal(a.rarity, "Common");
  const traits = Object.fromEntries(a.traits.map((t) => [t.trait, t.value]));
  assert.equal(traits.Medical, "major", "aptitudes from Galaxy are missing");
  assert.equal(traits.Sex, "Female");
  const b = crew.find((item) => item.mint === MINT2);
  assert.equal(b.name, "Crudzor Lexi Eko");
});

test("Galaxy is asked by mint, in batches, not one request per crew", async () => {
  const { galaxyCrewByMint } = await import("../src/lib/galaxy-crew.ts").catch(() => ({}));
  assert.ok(galaxyCrewByMint, "wallet readers still rely on the unfiltered first 100 Galaxy crew");
  const asked = [];
  const mints = Array.from({ length: 95 }, (_, i) => "m" + i);
  const rows = await galaxyCrewByMint(mints, async (url) => {
    asked.push(url);
    return new URL(url).searchParams.getAll("dasID").map((id) => ({ dasID: id, name: "N " + id }));
  });
  assert.equal(rows.size, 95);
  assert.ok(asked.length <= 3, `${asked.length} Galaxy requests for 95 crew`);
  assert.ok(asked.every((url) => url.length < 4000), "a Galaxy request URL is too long");
});

test("every wallet reader asks Galaxy by mint: Render server, browser, Mini-Sim", () => {
  const server = read("src/lib/desk.impl.ts");
  assert.match(server, /nameWalletCrew\(items/,"Render /api/wallet-scan names crew from the first 100 Galaxy rows only");
  const browser = read("src/lib/desk-direct.ts");
  assert.match(browser, /nameWalletCrew\(items/);
  const mini = read("mini-sim/bcm-mini-sim.php");
  assert.match(mini, /function bcm_mini_sim_galaxy_crew_for_mints\(/, "Mini-Sim names its crew from the first 100 Galaxy rows only");
  assert.match(mini, /bcm_mini_sim_galaxy_crew_for_mints\(\$/, "Mini-Sim does not ask Galaxy for the wallet's own crew");
  assert.match(mini, /crew\?'\s*\.\s*implode\('&'/);
});
