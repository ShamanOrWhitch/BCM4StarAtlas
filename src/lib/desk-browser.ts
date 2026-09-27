import type { MarketSnap, TokenQuote, WalletScan } from "./desk-types";

export type {
  MarketSnap,
  ResourceRow,
  TokenQuote,
  WalletItem,
  WalletScan,
  WalletTrait,
  Candle,
  TapePoint,
  FleetPeek,
  ProfilePeek,
} from "./desk-types";

type WpBridge = { ajax: string; nonce: string };

function bridge(): WpBridge {
  const wp = window.GALIA_WP;
  if (!wp?.ajax || !wp.nonce) throw new Error("Плагин не передал адрес запроса.");
  return wp;
}

async function post(action: string, fields?: Record<string, string>) {
  const wp = bridge();
  const body = new FormData();
  body.set("action", action);
  body.set("nonce", wp.nonce);
  if (fields) {
    for (const [key, value] of Object.entries(fields)) body.set(key, value);
  }
  const res = await fetch(wp.ajax, { method: "POST", body, credentials: "same-origin" });
  const json = (await res.json()) as { success?: boolean; data?: { message?: string } };
  if (!json.success) throw new Error(json.data?.message || "Запрос к сайту не прошёл");
  return json.data as Record<string, unknown>;
}

function quote(raw: unknown): TokenQuote {
  const row = raw && typeof raw === "object" ? (raw as Partial<TokenQuote>) : {};
  return {
    usd: row.usd ?? null,
    change24h: row.change24h ?? null,
    circulating: row.circulating ?? null,
    totalSupply: row.totalSupply ?? null,
    lockedSupply: row.lockedSupply ?? null,
  };
}

export async function loadMarket(): Promise<MarketSnap> {
  const data = await post("galia_desk_market");
  return {
    at: Number(data.at ?? 0),
    orderCount: Number(data.orderCount ?? 0),
    atlas: quote(data.atlas),
    polis: quote(data.polis),
    resources: Array.isArray(data.resources) ? (data.resources as MarketSnap["resources"]) : [],
    ships: Array.isArray(data.ships) ? (data.ships as MarketSnap["ships"]) : [],
    candles: Array.isArray(data.candles) ? (data.candles as MarketSnap["candles"]) : [],
    pairCandles: Array.isArray(data.pairCandles) ? (data.pairCandles as MarketSnap["pairCandles"]) : [],
    tape: Array.isArray(data.tape) ? (data.tape as MarketSnap["tape"]) : [],
    note:
      typeof data.note === "string"
        ? data.note
        : "Цифры с Galactic Marketplace через этот сайт. Валюта стакана — ATLAS. Снимки копятся в базе WordPress.",
  };
}

export async function scanDeskWallet({ data }: { data: { owner: string } }): Promise<WalletScan> {
  const scan = await post("galia_desk_wallet", { owner: data.owner });
  const profiles = Array.isArray(scan.profiles) ? scan.profiles : [];
  return {
    owner: String(scan.owner ?? data.owner),
    at: Number(scan.at ?? Date.now()),
    items: Array.isArray(scan.items) ? (scan.items as WalletScan["items"]) : [],
    skippedMeta: Number(scan.skippedMeta ?? 0),
    profiles: profiles as WalletScan["profiles"],
    rpcWarning: typeof scan.rpcWarning === "string" ? scan.rpcWarning : "",
    note: typeof scan.note === "string" ? scan.note : "",
  };
}
