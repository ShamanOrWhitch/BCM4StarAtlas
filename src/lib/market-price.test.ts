import assert from "node:assert/strict";
import test from "node:test";
import { bucketByMonth, CHART_PERIODS, ratioCandles, salePrice } from "./market-price.ts";
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

test("a converted USDC summary is not a USDC sale", () => {
  const converted = row({
    usdcDerived: true,
    usdcAsk: 4.2,
    usdcAsks: [],
    atlasAsk: 20000,
    atlasAsks: [{ price: 20000, qty: 3 }],
  });
  assert.equal(salePrice(converted, "USDC"), null);
  assert.equal(salePrice(converted, "ATLAS"), 20000);
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
