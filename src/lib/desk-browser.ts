import { directMarket, directWallet } from "./desk-direct";
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

const RENDER_MARKET = "https://bcm4staratlas.onrender.com/api/market";
const RENDER_WALLET = "https://bcm4staratlas.onrender.com/api/wallet-scan";

function withTimeout(work: Promise<Record<string, unknown>>, ms: number): Promise<Record<string, unknown> | null> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(null), ms);
    work.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      () => {
        window.clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

function snapFromPhp(data: Record<string, unknown>): MarketSnap {
  return {
    at: Number(data.at ?? 0),
    orderCount: Number(data.orderCount ?? 0),
    atlas: quote(data.atlas),
    polis: quote(data.polis),
    resources: Array.isArray(data.resources) ? (data.resources as MarketSnap["resources"]) : [],
    ships: Array.isArray(data.ships) ? (data.ships as MarketSnap["ships"]) : [],
    marketShips: Array.isArray(data.marketShips) ? (data.marketShips as MarketSnap["marketShips"]) : [],
    candles: Array.isArray(data.candles) ? (data.candles as MarketSnap["candles"]) : [],
    pairCandles: Array.isArray(data.pairCandles) ? (data.pairCandles as MarketSnap["pairCandles"]) : [],
    polisUsdcCandles: Array.isArray(data.polisUsdcCandles) ? (data.polisUsdcCandles as MarketSnap["polisUsdcCandles"]) : [],
    pairQuotes: data.pairQuotes && typeof data.pairQuotes === "object" ? data.pairQuotes as MarketSnap["pairQuotes"] : undefined,
    tape: Array.isArray(data.tape) ? (data.tape as MarketSnap["tape"]) : [],
    note:
      typeof data.note === "string"
        ? data.note
        : "Цифры с Galactic Marketplace через этот сайт. Валюта стакана — ATLAS. Снимки копятся в базе WordPress.",
  };
}

export async function loadMarket(): Promise<MarketSnap> {
  const remote = renderMarket();
  const local = directMarket().catch(() => null);
  const [fromRender, fromBrowser] = await Promise.all([remote, local]);
  if (fromRender && fromRender.resources.some((row) => row.ask != null || row.atlasAsk != null || row.usdcAsk != null)) {
    return fromRender;
  }
  if (fromBrowser) return fromBrowser;
  if (fromRender) return fromRender;
  const viaSite = await withTimeout(post("galia_desk_market"), 8000);
  if (viaSite && Array.isArray(viaSite.resources) && viaSite.resources.length) return snapFromPhp(viaSite);
  throw new Error("Рынок не открылся");
}

async function renderMarket(): Promise<MarketSnap | null> {
  try {
    const res = await fetch(RENDER_MARKET, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(22000),
    });
    const text = await res.text();
    if (!text.trim().startsWith("{")) return null;
    const json = JSON.parse(text) as MarketSnap;
    if (!Array.isArray(json.resources) || !json.resources.length) return null;
    return json;
  } catch {
    return null;
  }
}

async function renderWallet(owner: string): Promise<WalletScan> {
  const res = await fetch(RENDER_WALLET, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ owner }),
    signal: AbortSignal.timeout(45_000),
  });
  const json = (await res.json()) as WalletScan & { error?: string };
  if (!res.ok) throw new Error(json.error || `Render wallet API HTTP ${res.status}`);
  if (!json.owner || !Array.isArray(json.items)) throw new Error("Render wallet API вернул неполный ответ.");
  return {
    owner: String(json.owner),
    at: Number(json.at ?? Date.now()),
    items: json.items,
    skippedMeta: Number(json.skippedMeta ?? 0),
    profiles: Array.isArray(json.profiles) ? json.profiles : [],
    rpcWarning: String(json.rpcWarning ?? ""),
    note: String(json.note ?? "Кошелёк прочитан сервером."),
  };
}

export async function scanDeskWallet({ data }: { data: { owner: string } }): Promise<WalletScan> {
  let renderError: Error | null = null;
  try {
    return await renderWallet(data.owner);
  } catch (err) {
    renderError = err instanceof Error ? err : new Error("Render wallet scan failed");
  }

  const direct = await directWallet(data.owner);
  if (direct.items.length || !direct.rpcWarning) return direct;

  const viaSite = await withTimeout(post("galia_desk_wallet", { owner: data.owner }), 12_000);
  if (!viaSite) {
    throw new Error("Сейчас запускаем сервер чтения. Первый запуск может занять 1–3 минуты — повторите попытку позже.");
  }

  const profiles = Array.isArray(viaSite.profiles) ? viaSite.profiles : [];
  return {
    owner: String(viaSite.owner ?? data.owner),
    at: Number(viaSite.at ?? Date.now()),
    items: Array.isArray(viaSite.items) ? (viaSite.items as WalletScan["items"]) : direct.items,
    skippedMeta: Number(viaSite.skippedMeta ?? 0),
    profiles: profiles as WalletScan["profiles"],
    rpcWarning: typeof viaSite.rpcWarning === "string" ? viaSite.rpcWarning : direct.rpcWarning,
    note: typeof viaSite.note === "string" ? viaSite.note : direct.note,
  };
}
