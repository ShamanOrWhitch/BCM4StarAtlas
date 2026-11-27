import assert from "node:assert/strict";
import test from "node:test";
import { bucketByMonth, CHART_PERIODS, fmtUsd, marketHref, ratioCandles, salePrice, usdcSegment } from "./market-price.ts";
import type { ResourceRow } from "./desk-types.ts";

function row(patch: Partial<ResourceRow>): ResourceRow {
  return {
    mint: "titan",
    name: "Anomalous Titan",
    symbol: "TITAN",
    className: "ship",
    image: "",
    ask: null,
    bid: 1,
    askQty: 0,
    ...patch,
  };
}

test("a 1 USDC bid is not the sale price", () => {
  const titan = row({
    usdcAsks: [],
    usdcBids: [{ price: 1, qty: 1 }],
    usdcAsk: null,
    usdcBid: 1,
    atlasAsks: [{ price: 9000, qty: 1 }],
    atlasAsk: 9000,
  });
  assert.equal(salePrice(titan, "USDC"), null);
  assert.equal(salePrice(titan, "ATLAS"), 9000);
});

test("the first seller on the ladder is today's price", () => {
  const listed = row({
    usdcAsks: [
      { price: 120, qty: 1 },
      { price: 400, qty: 2 },
    ],
    usdcAsk: 1,
  });
  assert.equal(salePrice(listed, "USDC"), 120);
});

test("no USDC sellers: the ATLAS ask is shown in USDC, and a lone bid is not", () => {
  const onlyAtlas = row({
    usdcAsks: [],
    usdcBids: [{ price: 1, qty: 1 }],
    usdcBid: 1,
    atlasAsks: [{ price: 10000, qty: 4 }],
    atlasAsk: 10000,
  });
  const segment = usdcSegment(onlyAtlas, 0.0002);
  assert.equal(segment.usd, 2);
  assert.equal(segment.book, "ATLAS");
  assert.equal(marketHref(onlyAtlas.mint, segment.book), "https://play.staratlas.com/market/titan/?symbol=ATLAS");

  const both = row({
    usdcAsks: [{ price: 3.5, qty: 2 }],
    usdcAsk: 3.5,
    atlasAsks: [{ price: 10000, qty: 4 }],
    atlasAsk: 10000,
  });
  const preferred = usdcSegment(both, 0.0002);
  assert.equal(preferred.usd, 3.5);
  assert.equal(preferred.book, "USDC");
  assert.equal(marketHref(both.mint, preferred.book), "https://play.staratlas.com/market/titan/?symbol=USDC");

  const bidOnly = row({ usdcBids: [{ price: 1, qty: 1 }], usdcBid: 1, usdcAsks: [], atlasAsks: [] });
  assert.equal(usdcSegment(bidOnly, 0.0002).usd, null);
});

test("a stored ATLAS conversion still shows in dollars when the client has no rate", () => {
  const aerogel = row({
    usdcDerived: true,
    usdcAsk: 9.776160504773803e-7,
    usdcAsks: [],
    atlasAsk: 0.009988,
    atlasAsks: [{ price: 0.009988, qty: 100 }],
  });
  const fresh = usdcSegment(aerogel, 0.0000978790599196416);
  assert.equal(fresh.book, "ATLAS");
  assert.ok(fresh.usd != null && Math.abs(fresh.usd - 0.009988 * 0.0000978790599196416) < 1e-15);
  const stored = usdcSegment(aerogel, null);
  assert.equal(stored.usd, aerogel.usdcAsk);
  assert.equal(stored.book, "ATLAS");
  assert.equal(fmtUsd(fresh.usd), "$0.00");
  assert.equal(fmtUsd(1.2), "$1.20");
});

test("a ship USDC ladder is the dollar price", () => {
  const ship = row({
    usdcAsk: 1850,
    usdcAsks: [{ price: 1850, qty: 1 }],
    usdcBids: [{ price: 1, qty: 1 }],
    atlasAsks: [],
    usdcDerived: false,
  });
  const segment = usdcSegment(ship, 0.0001);
  assert.equal(segment.usd, 1850);
  assert.equal(segment.book, "USDC");
  assert.equal(fmtUsd(1850), "$1,850.00");
});

test("chart periods are the desk switches, including 1h and 1 month", () => {
  assert.deepEqual(
    CHART_PERIODS.map((item) => item.label),
    ["15м", "1ч", "4ч", "1д", "1н", "1м"],
  );
});

test("a month folds daily candles and a ratio stays on that bucket", () => {
  const march = Date.UTC(2026, 2, 2);
  const marchLate = Date.UTC(2026, 2, 20);
  const april = Date.UTC(2026, 3, 3);
  const folded = bucketByMonth([
    { t: march, o: 2, h: 3, l: 1, c: 2.5 },
    { t: marchLate, o: 2.5, h: 4, l: 2, c: 3 },
    { t: april, o: 3, h: 3.5, l: 2.8, c: 3.2 },
  ]);
  assert.equal(folded.length, 2);
  assert.equal(folded[0]?.o, 2);
  assert.equal(folded[0]?.h, 4);
  assert.equal(folded[0]?.c, 3);
  const ratio = ratioCandles(
    [{ t: march, o: 10, h: 12, l: 8, c: 11 }],
    [{ t: marchLate, o: 2, h: 2, l: 2, c: 2 }],
    0,
  );
  assert.equal(ratio.length, 1);
  assert.equal(ratio[0]?.c, 5.5);
});
