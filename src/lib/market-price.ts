import type { Candle, ResourceRow } from "./desk-types";

/** Sale price is the first seller's limit. A bid is never that price. */
export type QuoteId = "USDC" | "ATLAS" | "POLIS";

export const CHART_PERIODS = [
  { id: "15m", label: "15м", kraken: 15, ms: 15 * 60 * 1000, bucketMs: 15 * 60 * 1000 },
  { id: "1h", label: "1ч", kraken: 60, ms: 60 * 60 * 1000, bucketMs: 60 * 60 * 1000 },
  { id: "4h", label: "4ч", kraken: 240, ms: 4 * 60 * 60 * 1000, bucketMs: 4 * 60 * 60 * 1000 },
  { id: "1d", label: "1д", kraken: 1440, ms: 24 * 60 * 60 * 1000, bucketMs: 24 * 60 * 60 * 1000 },
  { id: "1w", label: "1н", kraken: 10080, ms: 7 * 24 * 60 * 60 * 1000, bucketMs: 7 * 24 * 60 * 60 * 1000 },
  { id: "1mo", label: "1м", kraken: 1440, ms: 30 * 24 * 60 * 60 * 1000, bucketMs: 0 },
] as const;

export type ChartPeriodId = (typeof CHART_PERIODS)[number]["id"];

function positive(n: number | null | undefined): number | null {
  return n != null && n > 0 ? n : null;
}

/** Ladder wins. An empty ladder means "no orders", so a lone summary is ignored. A missing ladder may use the summary, unless that summary was converted from another book. */
export function bookTop(
  levels: { price: number }[] | undefined,
  summary: number | null | undefined,
  converted: boolean,
): number | null {
  const top = positive(levels?.[0]?.price);
  if (top != null) return top;
  if (converted) return null;
  if (levels && levels.length === 0) return null;
  return positive(summary);
}

export function salePrice(row: ResourceRow, quote: QuoteId): number | null {
  if (quote === "ATLAS") return bookTop(row.atlasAsks, row.atlasAsk, false);
  if (quote === "POLIS") return bookTop(undefined, row.polisAsk, false);
  return bookTop(row.usdcAsks, row.usdcAsk, Boolean(row.usdcDerived));
}

export type UsdcSegment = {
  /** Best seller, in USDC. An ATLAS ask is converted. A bid is never used. */
  usd: number | null;
  /** Which order book the number came from. The buy link must open this book. */
  book: "USDC" | "ATLAS" | null;
};

export function usdcSegment(row: ResourceRow, atlasUsd: number | null): UsdcSegment {
  return usdFromBooks(row, atlasUsd);
}

/** One USDC figure. A real USDC seller wins. Otherwise the best ATLAS ask times the ATLAS/USDC rate. A bid is never the price. */
export function usdFromBooks(
  row: {
    usdcAsk?: number | null;
    usdcAsks?: { price: number }[];
    atlasAsk?: number | null;
    atlasAsks?: { price: number }[];
    usdcDerived?: boolean;
  },
  atlasUsd: number | null,
): UsdcSegment {
  const usdcLadder = positive(row.usdcAsks?.[0]?.price);
  if (!row.usdcDerived) {
    const usdc = usdcLadder ?? positive(row.usdcAsk);
    if (usdc != null) return { usd: usdc, book: "USDC" };
  }
  const atlas = positive(row.atlasAsks?.[0]?.price) ?? positive(row.atlasAsk);
  if (atlas != null && atlasUsd != null && atlasUsd > 0) return { usd: atlas * atlasUsd, book: "ATLAS" };
  const stored = positive(row.usdcAsk);
  if (row.usdcDerived && stored != null) return { usd: stored, book: "ATLAS" };
  return { usd: null, book: null };
}

export function fmtUsd(n: number | null): string {
  if (n == null || !(n > 0)) return "—";
  if (n >= 1) return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const digits = Math.min(10, Math.max(4, Math.ceil(-Math.log10(n)) + 2));
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: digits })}`;
}

export function marketHref(mint: string, book: "USDC" | "ATLAS" | null): string {
  const symbol = book === "ATLAS" ? "ATLAS" : "USDC";
  return `https://play.staratlas.com/market/${mint}/?symbol=${symbol}`;
}

export function bidPrice(row: ResourceRow, quote: QuoteId): number | null {
  if (quote === "ATLAS") return bookTop(row.atlasBids, row.atlasBid, false);
  if (quote === "POLIS") return bookTop(undefined, row.polisBid, false);
  return bookTop(row.usdcBids, row.usdcBid, Boolean(row.usdcDerived));
}

function stamp(t: number): number {
  return t > 0 && t < 1e12 ? t * 1000 : t;
}

export function bucketByMonth(rows: Candle[]): Candle[] {
  const groups = new Map<number, Candle>();
  for (const row of rows) {
    const ms = stamp(row.t);
    const d = new Date(ms);
    const key = d.getUTCFullYear() * 12 + d.getUTCMonth();
    const prev = groups.get(key);
    if (!prev) groups.set(key, { t: ms, o: row.o, h: row.h, l: row.l, c: row.c });
    else {
      prev.h = Math.max(prev.h, row.h);
      prev.l = Math.min(prev.l, row.l);
      prev.c = row.c;
      prev.t = ms;
    }
  }
  return [...groups.values()];
}

export function ratioCandles(base: Candle[], quote: Candle[], bucketMs: number): Candle[] {
  const keyOf = (t: number) => {
    const ms = stamp(t);
    if (!bucketMs) {
      const d = new Date(ms);
      return d.getUTCFullYear() * 12 + d.getUTCMonth();
    }
    return Math.floor(ms / bucketMs);
  };
  const by = new Map(quote.map((row) => [keyOf(row.t), row]));
  return base.flatMap((row) => {
    const other = by.get(keyOf(row.t));
    if (!other || other.o <= 0 || other.c <= 0 || other.l <= 0 || other.h <= 0) return [];
    return [{ t: stamp(row.t), o: row.o / other.o, h: row.h / other.l, l: row.l / other.h, c: row.c / other.c }];
  });
}
