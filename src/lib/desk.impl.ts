import { Connection, PublicKey } from "@solana/web3.js";
import type { BookLevel, Candle, FleetPeek, MarketShip, MarketSnap, ProfilePeek, ResourceRow, TapePoint, TokenQuote, WalletItem, WalletScan, WalletTrait } from "./desk-types";

const RPC_URL = "https://api.mainnet-beta.solana.com";
const GM = "traderDnaR5w6Tcoi3NFm53i48FTDNbGjBSZwWXDRrg";
const ATLAS = "ATLASXmbPQxBUYbxPsV97usA3fPQYEqzQBUHgiFCUsXx";
const POLIS = "poLisWXnNRwC6oBu1vHiuKQzFjGL4XDSu4g9qjz9qVk";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const TOKEN = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_22 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const META = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

const CLASS_KEEP = new Set([
  "consumable",
  "raw material",
  "component",
  "compound material",
  "material bundle",
  "contracts",
  "data",
]);

type BookSide = { ask: number | null; bid: number | null; askQty: number; asks: BookLevel[]; bids: BookLevel[] };
type CatItem = {
  mint: string;
  name: string;
  symbol: string;
  kind: WalletItem["kind"];
  className: string;
  rarity: string;
  spec: string;
  image: string;
  description: string;
  gallery: string[];
  make: string;
  crew: number;
  slots: string[];
  msrp: number | null;
};

let marketCache: { at: number; data: MarketSnap } | null = null;
let catalogCache: { at: number; byMint: Map<string, CatItem> } | null = null;
const MARKET_TTL = 120_000;
const CATALOG_TTL = 10 * 60_000;

const RPCS = [RPC_URL, "https://solana-rpc.publicnode.com"];
const PROFILE = "pprofELXjL5Kck7Jn5hCpwAL82DpTkSYBENzahVtbc9";
const SAGE = "SAGE2HAwep459SNq61LHvjxPk4pLPEJLoMETef7f7EE";
const GAME = "GAMEzqJehF8yAnKiTARUuhZMvLvkZVAsCVri5vSfemLr";
const KNOWN_FUNGIBLE: Record<string, { name: string; symbol: string }> = {
  [ATLAS]: { name: "ATLAS", symbol: "ATLAS" },
  [POLIS]: { name: "POLIS", symbol: "POLIS" },
};

const connection = new Connection(RPC_URL, "confirmed");
const marketConnections = [
  connection,
  new Connection("https://api.mainnet.solana.com", "confirmed"),
  new Connection("https://solana-rpc.publicnode.com", "confirmed"),
];
const serverTape: TapePoint[] = [];

async function marketProgramAccounts(
  mint: string,
  maxPasses = mint === USDC ? 3 : 1,
): Promise<Awaited<ReturnType<Connection["getProgramAccounts"]>>[number][]> {
  const args = {
    commitment: "confirmed" as const,
    dataSlice: { offset: 40, length: 153 },
    filters: [{ dataSize: 201 }, { memcmp: { offset: 40, bytes: mint } }],
  };

  // USDC is the slow side of the book on some RPCs. Keep the extra attempts,
  // but stagger them and run them together so one slow endpoint cannot delay
  // the entire market response for 20+ seconds.
  const timeoutMs = mint === USDC ? 4500 : 6000;
  const attempts: Promise<Awaited<ReturnType<Connection["getProgramAccounts"]>>>[] = [];

  for (let pass = 0; pass < maxPasses; pass += 1) {
    for (const client of marketConnections) {
      attempts.push(
        (async () => {
          if (pass > 0) {
            await new Promise((resolve) => setTimeout(resolve, pass * 250));
          }
          return Promise.race([
            client.getProgramAccounts(new PublicKey(GM), args),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("market RPC timeout")), timeoutMs),
            ),
          ]);
        })(),
      );
    }
  }

  const results = await Promise.allSettled(attempts);

  const nonEmpty = results.find(
    (result): result is PromiseFulfilledResult<Awaited<ReturnType<Connection["getProgramAccounts"]>>> =>
      result.status === "fulfilled" && result.value.length > 0,
  );
  if (nonEmpty) return nonEmpty.value;

  const emptyAllowed = results.find(
    (result): result is PromiseFulfilledResult<Awaited<ReturnType<Connection["getProgramAccounts"]>>> =>
      result.status === "fulfilled",
  );
  return emptyAllowed ? emptyAllowed.value : [];
}

async function getJson<T>(url: string, timeoutMs = 10000): Promise<T> {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return (await response.json()) as T;
}

function mediaUrl(value: string): string {
  let next = String(value || "").trim();
  if (!next) return "";
  if (next.startsWith("ipfs://")) {
    return "https://ipfs.io/ipfs/" + next.slice(7).replace(/^ipfs\\//, "");
  }
  if (next.startsWith("ar://")) {
    return "https://arweave.net/" + next.slice(5);
  }
  return next;
}

function emptyQuote(): TokenQuote {
  return { usd: null, change24h: null, circulating: null, totalSupply: null, lockedSupply: null };
}

function kindOf(itemType: string): WalletItem["kind"] {
  const value = String(itemType || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/s$/, "");
  if (value === "resource") return "resource";
  if (value === "ship") return "ship";
  if (value === "crew") return "crew";
  if (value === "structure") return "structure";
  return "other";
}

async function loadCatalog(): Promise<Map<string, CatItem>> {
  if (catalogCache && Date.now() - catalogCache.at < CATALOG_TTL) return catalogCache.byMint;
  const rows = await getJson<Array<Record<string, unknown>>>("https://galaxy.staratlas.com/nfts");
  const byMint = new Map<string, CatItem>();
  for (const row of rows) {
    const mint = String(row.mint ?? "");
    if (!mint) continue;
    const attrs = (row.attributes ?? {}) as Record<string, unknown>;
    const itemType = String(
      attrs.itemType ??
      attrs.type ??
      row.itemType ??
      row.type ??
      "",
    );
    const media = (row.media ?? {}) as { gallery?: unknown };
    const slots = (row.slots ?? {}) as { crewSlots?: Array<{ type?: string; quantity?: number }> };
    const crewSlots = Array.isArray(slots.crewSlots) ? slots.crewSlots : [];
    const trade = (row.tradeSettings ?? {}) as { msrp?: { value?: number } };
    const gallery = Array.isArray(media.gallery)
      ? media.gallery
          .filter((item): item is string => typeof item === "string")
          .slice(0, 8)
          .map(mediaUrl)
      : [];
    byMint.set(mint, {
      mint,
      name: String(row.name ?? mint.slice(0, 4)),
      symbol: String(row.symbol ?? ""),
      kind: kindOf(itemType),
      className: String(attrs.class ?? "").toLowerCase(),
      rarity: String(attrs.rarity ?? ""),
      spec: String(attrs.spec ?? ""),
      image: mediaUrl(String(row.image ?? "")),
      description: String(row.description ?? "").replace(/\s+/g, " ").slice(0, 420),
      gallery,
      make: String(attrs.make ?? ""),
      crew: crewSlots.reduce((sum, slot) => sum + (Number(slot.quantity) || 0), 0),
      slots: crewSlots.flatMap((slot) => Array.from({ length: Math.max(1, Number(slot.quantity) || 1) }, () => String(slot.type ?? "слот"))),
      msrp: typeof trade.msrp?.value === "number" ? trade.msrp.value : null,
    });
  }
  catalogCache = { at: Date.now(), byMint };
  return byMint;
}

function readBook(
  rows: ReadonlyArray<{ account: { data: Uint8Array } }>,
  mintHex: string,
  decimals: number,
): Map<string, BookSide> {
  const bags = new Map<string, { asks: BookLevel[]; bids: BookLevel[] }>();
  const scale = 10 ** decimals;
  for (const row of rows) {
    const raw = Buffer.from(row.account.data);
    if (raw.length < 153) continue;
    if (raw.subarray(0, 32).toString("hex") !== mintHex) continue;
    const asset = new PublicKey(raw.subarray(32, 64)).toBase58();
    const side = raw[128];
    const price = Number(raw.readBigUInt64LE(129)) / scale;
    const qty = Number(raw.readBigUInt64LE(145));
    if (!Number.isFinite(price) || price <= 0 || qty <= 0) continue;
    let bag = bags.get(asset);
    if (!bag) {
      bag = { asks: [], bids: [] };
      bags.set(asset, bag);
    }
    if (side === 1) bag.asks.push({ price, qty });
    else if (side === 0) bag.bids.push({ price, qty });
  }
  const book = new Map<string, BookSide>();
  for (const [asset, bag] of bags) {
    const asks = bag.asks.sort((a, b) => a.price - b.price).slice(0, 8);
    const bids = bag.bids.sort((a, b) => b.price - a.price).slice(0, 8);
    book.set(asset, {
      ask: asks[0]?.price ?? null,
      bid: bids[0]?.price ?? null,
      askQty: asks[0]?.qty ?? 0,
      asks,
      bids,
    });
  }
  return book;
}

async function krakenCandles(pair: string): Promise<Candle[]> {
  try {
    const data = await getJson<{ result?: Record<string, unknown> }>(
      `https://api.kraken.com/0/public/OHLC?pair=${pair}&interval=1440`,
    );
    const rows = Object.values(data.result ?? {}).find((value) => Array.isArray(value)) as unknown[][] | undefined;
    if (!rows) return [];
    return rows
      .slice(-180)
      .map((row) => ({
        t: Number(row[0]) * 1000,
        o: Number(row[1]),
        h: Number(row[2]),
        l: Number(row[3]),
        c: Number(row[4]),
      }))
      .filter((candle) => Number.isFinite(candle.c) && candle.c > 0);
  } catch {
    return [];
  }
}

async function poolCandles(pool: string): Promise<Candle[]> {
  try {
    const data = await getJson<{ data?: { attributes?: { ohlcv_list?: number[][] } } }>(
      `https://api.geckoterminal.com/api/v2/networks/solana/pools/${pool}/ohlcv/day?aggregate=1&limit=180`,
    );
    const rows = data.data?.attributes?.ohlcv_list ?? [];
    return rows
      .map((row) => ({ t: Number(row[0]), o: Number(row[1]), h: Number(row[2]), l: Number(row[3]), c: Number(row[4]) }))
      .filter((row) => Number.isFinite(row.c) && row.c > 0)
      .reverse();
  } catch {
    return [];
  }
}

function ratioCandles(base: Candle[], quote: Candle[]): Candle[] {
  const byDay = new Map(quote.map((row) => [Math.floor(row.t / 86_400), row]));
  return base.flatMap((row) => {
    const other = byDay.get(Math.floor(row.t / 86_400));
    if (!other || other.o <= 0 || other.c <= 0) return [];
    return [{ t: row.t, o: row.o / other.o, h: row.h / other.l, l: row.l / other.h, c: row.c / other.c }];
  });
}

async function atlasCandles(): Promise<Candle[]> {
  const kraken = await krakenCandles("ATLASUSD");
  if (kraken.length > 2) return kraken;
  try {
    const rows = await getJson<unknown[][]>("https://api.mexc.com/api/v3/klines?symbol=ATLASUSDT&interval=4h&limit=48");
    return rows
      .map((row) => ({
        t: Number(row[0]),
        o: Number(row[1]),
        h: Number(row[2]),
        l: Number(row[3]),
        c: Number(row[4]),
      }))
      .filter((candle) => Number.isFinite(candle.c) && candle.c > 0);
  } catch {
    return [];
  }
}

function pushTape(resources: ResourceRow[]): TapePoint[] {
  const asks: Record<string, number> = {};
  for (const row of resources) {
    if (row.ask != null) asks[row.mint] = row.ask;
  }
  const last = serverTape.at(-1);
  const now = Date.now();
  if (!last || now - last.t >= 90_000) {
    serverTape.push({ t: now, asks });
    if (serverTape.length > 48) serverTape.shift();
  }
  return serverTape.map((point) => ({ t: point.t, asks: { ...point.asks } }));
}

export async function buildMarket(): Promise<MarketSnap> {
  if (marketCache && Date.now() - marketCache.at < MARKET_TTL) return marketCache.data;

  const atlasHex = new PublicKey(ATLAS).toBuffer().toString("hex");
  const usdcHex = new PublicKey(USDC).toBuffer().toString("hex");
  const polisHex = new PublicKey(POLIS).toBuffer().toString("hex");

  const settled = await Promise.allSettled([
    loadCatalog(),
    getJson<Record<string, number | string>>("https://galaxy.staratlas.com/tokens/atlas"),
    getJson<Record<string, number | string>>("https://galaxy.staratlas.com/tokens/polis"),
    getJson<Record<string, { usdPrice?: number; priceChange24h?: number }>>(
      `https://lite-api.jup.ag/price/v3?ids=${ATLAS},${POLIS}`,
    ),
    marketProgramAccounts(ATLAS),
    marketProgramAccounts(USDC, 3),
    marketProgramAccounts(POLIS),
    atlasCandles(),
    krakenCandles("POLISUSD"),
    poolCandles("2bnZ1edbvK3CK3LTNZ5jH9anvXYCmzPR4W2HQ6Ngsv5K"),
    poolCandles("9xyCzsHi1wUWva7t5Z8eAvZDRmUCVhRrbaFfm3VbU4Mf"),
  ]);

  const valueOr = <T,>(index: number, fallback: T): T => {
    const result = settled[index];
    return result.status === "fulfilled" ? (result.value as T) : fallback;
  };

  const nfts = valueOr(0, new Map<string, CatItem>());
  const atlasTok = valueOr<Record<string, number | string> | null>(1, null);
  const polisTok = valueOr<Record<string, number | string> | null>(2, null);
  const prices = valueOr<Record<string, { usdPrice?: number; priceChange24h?: number }>>(3, {});
  const orders = valueOr(4, []);
  const usdcOrders = valueOr(5, []);
  const polisOrders = valueOr(6, []);
  const atlasFallbackCandles = valueOr(7, []);
  const polisFallbackCandles = valueOr(8, []);
  const atlasPool = valueOr(9, []);
  const polisPool = valueOr(10, []);

  const book = readBook(orders, atlasHex, 8);
  const usdcBook = readBook(usdcOrders, usdcHex, 6);
  const polisBook = readBook(polisOrders, polisHex, 8);

  const atlasUsd = num(prices[ATLAS]?.usdPrice);
  const polisUsd = num(prices[POLIS]?.usdPrice);

  const atlas: TokenQuote = {
    ...emptyQuote(),
    usd: atlasUsd,
    change24h: prices[ATLAS]?.priceChange24h ?? null,
    circulating: num(atlasTok?.circulating),
    totalSupply: num(atlasTok?.totalSupply),
    lockedSupply: num(atlasTok?.lockedSupply),
  };
  const polis: TokenQuote = {
    ...emptyQuote(),
    usd: polisUsd,
    change24h: prices[POLIS]?.priceChange24h ?? null,
    circulating: num(polisTok?.circulating),
    totalSupply: num(polisTok?.totalSupply),
    lockedSupply: num(polisTok?.lockedSupply),
  };

  const resources: ResourceRow[] = [];
  const ships: ResourceRow[] = [];

  for (const item of nfts.values()) {
    if (item.kind !== "resource" && item.kind !== "ship") continue;
    if (item.kind === "resource" && !CLASS_KEEP.has(item.className)) continue;

    const atlasSide = book.get(item.mint);
    const usdcSide = usdcBook.get(item.mint);
    const polisSide = polisBook.get(item.mint);

    const hasDirectUsdc = usdcSide?.ask != null || usdcSide?.bid != null;
    const derivedAsk =
      usdcSide?.ask ??
      (atlasSide?.ask != null && atlasUsd != null && atlasUsd > 0 ? atlasSide.ask * atlasUsd : null);
    const derivedBid =
      usdcSide?.bid ??
      (atlasSide?.bid != null && atlasUsd != null && atlasUsd > 0 ? atlasSide.bid * atlasUsd : null);

    const row: ResourceRow = {
      mint: item.mint,
      name: item.name,
      symbol: item.symbol,
      className: item.className,
      image: item.image,
      ask: derivedAsk ?? atlasSide?.ask ?? polisSide?.ask ?? null,
      bid: derivedBid ?? atlasSide?.bid ?? polisSide?.bid ?? null,
      askQty: usdcSide?.askQty ?? atlasSide?.askQty ?? polisSide?.askQty ?? 0,
      quote: derivedAsk != null || derivedBid != null ? "USDC" : atlasSide?.ask != null || atlasSide?.bid != null ? "ATLAS" : "POLIS",
      usdcDerived: !hasDirectUsdc && (atlasSide?.ask != null || atlasSide?.bid != null),
      usdcAsk: derivedAsk,
      usdcBid: derivedBid,
      atlasAsk: atlasSide?.ask ?? null,
      atlasBid: atlasSide?.bid ?? null,
      polisAsk: polisSide?.ask ?? null,
      polisBid: polisSide?.bid ?? null,
    };

    if (item.kind === "resource") resources.push(row);
    else ships.push(row);
  }

  resources.sort((a, b) => a.name.localeCompare(b.name, "en"));
  ships.sort(
    (a, b) =>
      (a.usdcAsk == null ? 1 : 0) -
        (b.usdcAsk == null ? 1 : 0) ||
      a.name.localeCompare(b.name, "en"),
  );

  const marketShips: MarketShip[] = [];
  for (const item of nfts.values()) {
    if (item.kind !== "ship") continue;
    marketShips.push({
      mint: item.mint,
      name: item.name,
      image: item.image,
      gallery: item.gallery,
      description: item.description,
      rarity: item.rarity,
      className: item.className,
      spec: item.spec,
      make: item.make,
      crew: item.crew,
      slots: item.slots,
      msrp: item.msrp,
      usdcAsks: usdcBook.get(item.mint)?.asks ?? [],
      usdcBids: usdcBook.get(item.mint)?.bids ?? [],
      atlasAsks: book.get(item.mint)?.asks ?? [],
      atlasBids: book.get(item.mint)?.bids ?? [],
    });
  }
  marketShips.sort((a, b) => a.className.localeCompare(b.className) || a.name.localeCompare(b.name, "en"));

  const atlasUsdcCandles = atlasPool.length > 20 ? atlasPool : atlasFallbackCandles;
  const polisUsdcCandles = polisPool.length > 20 ? polisPool : polisFallbackCandles;
  const pairCandles = ratioCandles(polisUsdcCandles, atlasUsdcCandles);

  const pairQuotes = {
    atlasUsdc: atlasUsd,
    polisUsdc: polisUsd,
    polisAtlas:
      atlasUsd != null && atlasUsd > 0 && polisUsd != null
        ? polisUsd / atlasUsd
        : null,
  };

  const data: MarketSnap = {
    at: Date.now(),
    orderCount: orders.length + usdcOrders.length + polisOrders.length,
    atlas,
    polis,
    resources,
    ships,
    marketShips,
    candles: atlasUsdcCandles,
    pairCandles,
    polisUsdcCandles,
    pairQuotes,
    tape: pushTape([...resources, ...ships]),
    note:
      "Рынок читается сервером. Ресурсы и корабли сначала ищутся в USDC; если прямого USDC-ордера нет, цена ATLAS переводится в USDC по текущему курсу ATLAS/USDC. Отдельно сохраняются стаканы ATLAS и POLIS. Графики: ATLAS/USDC, POLIS/USDC и POLIS/ATLAS.",
  };

  const hasUsefulMarketData =
    nfts.size > 0 ||
    orders.length > 0 ||
    usdcOrders.length > 0 ||
    polisOrders.length > 0 ||
    atlasUsdcCandles.length > 1 ||
    polisUsdcCandles.length > 1;

  if (hasUsefulMarketData) {
    marketCache = { at: Date.now(), data };
  }
  return data;
}

function num(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

type ParsedToken = { mint: string; amount: number; decimals: number };

type CrewCard = { mint: string; name: string; image: string; rarity: string; species: string; traits: WalletTrait[] };

let crewCache: { at: number; byMint: Map<string, CrewCard> } | null = null;

function oceanTrait(label: string, value: unknown): WalletTrait | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return { trait: label, value: String(n <= 1 ? Math.round(n * 100) : Math.round(n)) };
}

async function loadCrewCards(): Promise<Map<string, CrewCard>> {
  if (crewCache && Date.now() - crewCache.at < CATALOG_TTL) return crewCache.byMint;
  const rows = await getJson<Array<Record<string, unknown>>>("https://galaxy.staratlas.com/crew").catch(() => []);
  const byMint = new Map<string, CrewCard>();
  for (const row of rows) {
    const mint = String(row.dasID ?? "");
    if (!mint) continue;
    const traits = [
      oceanTrait("Openness", row.openness),
      oceanTrait("Conscientiousness", row.conscientiousness),
      oceanTrait("Extraversion", row.extraversion),
      oceanTrait("Agreeableness", row.agreeableness),
      oceanTrait("Neuroticism", row.neuroticism),
    ].filter((trait): trait is WalletTrait => trait != null);
    const aptitudes = row.aptitudes;
    if (aptitudes && typeof aptitudes === "object") {
      for (const [name, level] of Object.entries(aptitudes as Record<string, unknown>)) {
        traits.push({ trait: name, value: String(level ?? "major") });
      }
    }
    if (row.species) traits.push({ trait: "Species", value: String(row.species) });
    byMint.set(mint, {
      mint,
      name: String(row.name ?? mint.slice(0, 4)),
      image: String(row.imageUrl ?? ""),
      rarity: String(row.rarity ?? ""),
      species: String(row.species ?? ""),
      traits,
    });
  }
  crewCache = { at: Date.now(), byMint };
  return byMint;
}

function crewItem(card: CrewCard, amount: number, image = "", traits: WalletTrait[] = []): WalletItem {
  const layers = traits.filter((row) => /rarity/i.test(row.trait) || row.trait.toLowerCase() === "name");
  const base = (card.traits.length ? card.traits : traits).filter((row) => !/rarity/i.test(row.trait) && row.trait.toLowerCase() !== "name");
  const named = traits.find((row) => row.trait.toLowerCase() === "name")?.value;
  const name = named && !/^crew\b/i.test(named) ? named : card.name;
  return {
    mint: card.mint,
    amount,
    name,
    kind: "crew",
    image: card.image || image,
    className: "crew",
    rarity: card.rarity,
    spec: card.species,
    traits: [...base, ...layers],
  };
}

async function assetsOf(owner: string): Promise<Array<{ id: string; name: string; image: string; symbol: string; traits: WalletTrait[] }>> {
  const out: Array<{ id: string; name: string; image: string; symbol: string; traits: WalletTrait[] }> = [];
  for (let page = 1; page <= 3; page += 1) {
    let result: { total?: number; items?: Array<Record<string, unknown>> };
    try {
      result = await rpc("getAssetsByOwner", {
        ownerAddress: owner,
        page,
        limit: 100,
        displayOptions: { showFungible: false, showZeroBalance: false },
      });
    } catch {
      break;
    }
    const items = result.items ?? [];
    for (const asset of items) {
      const content = (asset.content ?? {}) as Record<string, unknown>;
      const meta = (content.metadata ?? {}) as Record<string, unknown>;
      const links = (content.links ?? {}) as Record<string, unknown>;
      const id = String(asset.id ?? "");
      if (!id) continue;
      out.push({
        id,
        name: String(meta.name ?? ""),
        image: typeof links.image === "string" ? links.image : "",
        symbol: String(meta.symbol ?? ""),
        traits: traitsFrom(meta),
      });
    }
    if (!items.length || out.length >= (result.total ?? out.length)) break;
  }
  return out;
}

async function rpc<T>(method: string, params: unknown): Promise<T> {
  let last = "RPC не ответил";
  for (const url of RPCS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(18_000),
      });
      const json = (await res.json()) as { result?: T; error?: { message?: string } };
      if (json.error) {
        last = json.error.message || "RPC ошибка";
        continue;
      }
      if (json.result !== undefined) return json.result;
    } catch (err) {
      last = err instanceof Error ? err.message : last;
    }
  }
  throw new Error(last);
}

async function tokensOf(owner: PublicKey, programId: string): Promise<ParsedToken[]> {
  const result = await rpc<{
    value?: Array<{ account: { data: { parsed?: { info?: { mint?: string; tokenAmount?: { uiAmount?: number; decimals?: number } } } } } }>;
  }>("getTokenAccountsByOwner", [owner.toBase58(), { programId }, { encoding: "jsonParsed" }]);
  const out: ParsedToken[] = [];
  for (const row of result.value ?? []) {
    const info = row.account.data.parsed?.info;
    const mint = info?.mint;
    const ui = info?.tokenAmount?.uiAmount;
    if (!mint || ui == null || ui <= 0) continue;
    out.push({ mint, amount: ui, decimals: info?.tokenAmount?.decimals ?? 0 });
  }
  return out;
}

function labelOf(raw: Buffer): string {
  const text = raw.toString("utf8").replace(/\0/g, "").trim();
  return text || "флот";
}

async function fleetsOf(profile: string): Promise<FleetPeek[]> {
  const rows = await rpc<Array<{ account: { data: [string, string] } }>>("getProgramAccounts", [
    SAGE,
    {
      encoding: "base64",
      dataSlice: { offset: 169, length: 33 },
      filters: [
        { memcmp: { offset: 9, bytes: GAME } },
        { memcmp: { offset: 41, bytes: profile } },
      ],
    },
  ]);
  const fleets: FleetPeek[] = [];
  for (const row of rows.slice(0, 12)) {
    const buf = Buffer.from(row.account.data[0] ?? "", "base64");
    if (buf.length < 2) continue;
    fleets.push({ faction: buf[0] ?? 0, name: labelOf(buf.subarray(1)) });
  }
  return fleets;
}

async function profilesOf(owner: string): Promise<{ profiles: ProfilePeek[]; warning: string }> {
  const found = new Map<string, number>();
  let warning = "";
  await Promise.all(
    [30, 110, 190].map(async (offset) => {
      try {
        const rows = await rpc<Array<{ pubkey: string; account: { data: [string, string] } }>>("getProgramAccounts", [
          PROFILE,
          {
            encoding: "base64",
            dataSlice: { offset: 28, length: 2 },
            filters: [{ memcmp: { offset, bytes: owner } }],
          },
        ]);
        for (const row of rows) {
          const buf = Buffer.from(row.account.data[0] ?? "", "base64");
          const keys = buf.length >= 2 ? buf.readUInt16LE(0) : 0;
          found.set(row.pubkey, keys);
        }
      } catch (err) {
        warning = err instanceof Error ? err.message : "Профиль не прочитался";
      }
    }),
  );
  const profiles: ProfilePeek[] = [];
  for (const [profile, keys] of [...found.entries()].slice(0, 4)) {
    let fleets: FleetPeek[] = [];
    try {
      fleets = await fleetsOf(profile);
    } catch (err) {
      warning = err instanceof Error ? err.message : warning;
    }
    profiles.push({ profile, keys, fleets });
  }
  return { profiles, warning };
}

function readBorshString(buf: Buffer, offset: number): { value: string; next: number } {
  const len = buf.readUInt32LE(offset);
  const start = offset + 4;
  const value = buf.subarray(start, start + len).toString("utf8").replace(/\0/g, "").trim();
  return { value, next: start + len };
}

function parseMeta(buf: Buffer): { name: string; symbol: string; uri: string } | null {
  if (buf.length < 70 || buf[0] !== 4) return null;
  try {
    const name = readBorshString(buf, 65);
    const symbol = readBorshString(buf, name.next);
    const uri = readBorshString(buf, symbol.next);
    return { name: name.value, symbol: symbol.value, uri: uri.value };
  } catch {
    return null;
  }
}

function safeHttps(uri: string): string | null {
  let next = uri.trim();
  if (next.startsWith("ipfs://")) {
    next = `https://ipfs.io/ipfs/${next.slice(7).replace(/^ipfs\//, "")}`;
  } else if (next.startsWith("ar://")) {
    next = `https://arweave.net/${next.slice(5)}`;
  }
  try {
    const url = new URL(next);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local") || host === "0.0.0.0") return null;
    if (/^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function traitsFrom(json: unknown): WalletTrait[] {
  if (!json || typeof json !== "object") return [];
  const record = json as Record<string, unknown>;
  const raw = record.attributes;
  const out: WalletTrait[] = [];
  if (Array.isArray(raw)) {
    for (const row of raw) {
      if (!row || typeof row !== "object") continue;
      const trait = String((row as { trait_type?: string; trait?: string }).trait_type ?? (row as { trait?: string }).trait ?? "");
      const value = (row as { value?: unknown }).value;
      if (!trait || value == null) continue;
      out.push({ trait, value: String(value) });
    }
    return rankTraits(out);
  }
  if (raw && typeof raw === "object") {
    for (const [trait, value] of Object.entries(raw as Record<string, unknown>)) {
      if (value == null || typeof value === "object") continue;
      out.push({ trait, value: String(value) });
    }
  }
  return rankTraits(out);
}

function rankTraits(out: WalletTrait[]): WalletTrait[] {
  const important = (row: WalletTrait) => /rarity|^name$|species|sex|openness|conscient|extraver|agreeab|neurot|flight|command|engineer|medical|science|fitness|hospital|operator|university/i.test(row.trait);
  return [...out.filter(important), ...out.filter((row) => !important(row))].slice(0, 48);
}

function isCrew(name: string, symbol: string, traits: WalletTrait[]): boolean {
  if (/crew/i.test(symbol) || /crew/i.test(name)) return true;
  const blob = traits.map((trait) => `${trait.trait} ${trait.value}`).join(" ").toLowerCase();
  return /flight|command|engineering|hospitality|operator|medical|science|fitness|openness|conscient|extraver|agreeab|neurot|hair|species|aptitude|ustur|punaab|sogmian|mierese/.test(
    blob,
  );
}

async function metaJson(uri: string): Promise<{ image: string; traits: WalletTrait[]; name: string } | null> {
  const safe = safeHttps(uri);
  if (!safe) return null;
  const res = await fetch(safe, { signal: AbortSignal.timeout(7000), headers: { accept: "application/json" } });
  if (!res.ok) return null;
  const text = (await res.text()).slice(0, 200_000);
  const json = JSON.parse(text) as Record<string, unknown>;
  return {
    image: typeof json.image === "string" ? json.image : "",
    traits: traitsFrom(json),
    name: typeof json.name === "string" ? json.name : "",
  };
}

async function ownOrders(owner: string, catalog: Map<string, CatItem>): Promise<WalletItem[]> {
  const rows = await rpc<Array<{ account?: { data?: [string, string] } }>>("getProgramAccounts", [
    GM,
    {
      encoding: "base64",
      dataSlice: { offset: 8, length: 160 },
      filters: [{ dataSize: 201 }, { memcmp: { offset: 8, bytes: owner } }],
    },
  ]);
  const out: WalletItem[] = [];
  for (const row of rows) {
    const raw = Buffer.from(row.account?.data?.[0] ?? "", "base64");
    if (raw.length < 145) continue;
    const asset = new PublicKey(raw.subarray(64, 96)).toBase58();
    const side = raw[120];
    const rem = Number(raw.readBigUInt64LE(137));
    if (side !== 1 || rem <= 0) continue;
    const known = catalog.get(asset);
    if (known?.kind !== "ship") continue;
    out.push({
      mint: asset,
      amount: rem,
      name: known.name,
      kind: "ship",
      image: known.image,
      className: "order",
      rarity: known.rarity,
      spec: "мой ордер",
      traits: [],
      description: known.description,
      gallery: known.gallery,
      make: known.make,
      crew: known.crew,
      slots: known.slots,
      msrp: known.msrp,
    });
  }
  return out;
}

export async function scanWallet(ownerText: string): Promise<WalletScan> {
  let owner: PublicKey;
  try {
    owner = new PublicKey(ownerText);
  } catch {
    throw new Error("Это не публичный ключ Solana.");
  }
  const [catalog, crewCards] = await Promise.all([loadCatalog(), loadCrewCards()]);
  const [heldPair, game] = await Promise.all([
    Promise.all([tokensOf(owner, TOKEN), tokensOf(owner, TOKEN_22)]),
    profilesOf(owner.toBase58()),
  ]);
  const held = [...heldPair[0], ...heldPair[1]];
  const items: WalletItem[] = [];
  const pending: ParsedToken[] = [];

  for (const token of held) {
    const card = crewCards.get(token.mint);
    if (card) {
      items.push(crewItem(card, token.amount));
      continue;
    }
    const known = catalog.get(token.mint);
    if (known && known.kind !== "other") {
      items.push({
        mint: token.mint,
        amount: token.amount,
        name: known.name,
        kind: known.kind,
        image: known.image,
        className: known.className,
        rarity: known.rarity,
        spec: known.spec,
        traits: [],
        description: known.description,
        gallery: known.gallery,
        make: known.make,
        crew: known.crew,
        slots: known.slots,
        msrp: known.msrp,
      });
      continue;
    }
    const fungible = KNOWN_FUNGIBLE[token.mint];
    if (fungible) {
      items.push({
        mint: token.mint,
        amount: token.amount,
        name: fungible.name,
        kind: "resource",
        image: "",
        className: "currency",
        rarity: "",
        spec: fungible.symbol,
        traits: [],
      });
      continue;
    }
    if (token.decimals === 0 && token.amount <= 20) pending.push(token);
  }

  const metaTargets = pending.slice(0, 32);
  const skippedMeta = Math.max(0, pending.length - metaTargets.length);
  if (metaTargets.length) {
    const pdas = metaTargets.map((token) => {
      const mint = new PublicKey(token.mint);
      return PublicKey.findProgramAddressSync([Buffer.from("metadata"), META.toBuffer(), mint.toBuffer()], META)[0];
    });
    const infos = await connection.getMultipleAccountsInfo(pdas);
    const enriched = await Promise.all(
      metaTargets.map(async (token, index) => {
        const info = infos[index];
        const parsed = info ? parseMeta(Buffer.from(info.data)) : null;
        let image = "";
        let traits: WalletTrait[] = [];
        let name = parsed?.name || token.mint.slice(0, 4) + "…" + token.mint.slice(-4);
        const symbol = parsed?.symbol || "";
        if (parsed?.uri) {
          try {
            const extra = await metaJson(parsed.uri);
            if (extra) {
              image = extra.image;
              traits = extra.traits;
              if (extra.name) name = extra.name;
            }
          } catch {
            /* metadata host failed; name from chain still stands */
          }
        }
        const known = catalog.get(token.mint);
        const kind: WalletItem["kind"] = known?.kind && known.kind !== "other" ? known.kind : traits.length || parsed ? "nft" : "nft";
        const crewish = isCrew(name, symbol, traits);
        return {
          mint: token.mint,
          amount: token.amount,
          name,
          kind: crewish ? "crew" : kind === "nft" ? "nft" : kind,
          image: image || known?.image || "",
          className: known?.className || "",
          rarity: known?.rarity || traits.find((t) => /rarity/i.test(t.trait))?.value || "",
          spec: known?.spec || "",
          traits,
        } satisfies WalletItem;
      }),
    );
    items.push(...enriched);
  }

  const seen = new Set(items.map((item) => item.mint));
  const assets = await assetsOf(owner.toBase58()).catch(() => []);
  for (const asset of assets) {
    const card = crewCards.get(asset.id);
    const crewAsset = !!card || isCrew(asset.name, asset.symbol, asset.traits);
    const known = catalog.get(asset.id);

    if (!crewAsset && (!known || known.kind === "other")) continue;

    const row: WalletItem = crewAsset
      ? card
        ? crewItem(card, 1, asset.image, asset.traits)
        : {
            mint: asset.id,
            amount: 1,
            name: asset.name || asset.id.slice(0, 4) + "…" + asset.id.slice(-4),
            kind: "crew",
            image: asset.image,
            className: "crew",
            rarity: asset.traits.find((trait) => trait.trait.toLowerCase() === "rarity")?.value || "",
            spec: asset.traits.find((trait) => /species/i.test(trait.trait))?.value || "",
            traits: asset.traits,
          }
      : {
          mint: asset.id,
          amount: 1,
          name: known?.name || asset.name || asset.id.slice(0, 4) + "…" + asset.id.slice(-4),
          kind: known?.kind || "other",
          image: known?.image || asset.image,
          className: known?.className || "",
          rarity: known?.rarity || asset.traits.find((trait) => trait.trait.toLowerCase() === "rarity")?.value || "",
          spec: known?.spec || asset.traits.find((trait) => /spec|class/i.test(trait.trait))?.value || "",
          traits: asset.traits,
          description: known?.description || "",
          gallery: known?.gallery || [],
          make: known?.make || "",
          crew: known?.crew || 0,
          slots: known?.slots || [],
          msrp: known?.msrp ?? null,
        };

    const existing = items.find((item) => item.mint === asset.id);
    if (existing) {
      existing.kind = row.kind;
      existing.name = row.name || existing.name;
      existing.image = row.image || existing.image;
      existing.traits = row.traits.length ? row.traits : existing.traits;
      existing.rarity = row.rarity || existing.rarity;
      existing.spec = row.spec || existing.spec;
      existing.className = row.className || existing.className;
      if (row.kind === "ship" || row.kind === "resource" || row.kind === "structure") {
        existing.description = row.description || existing.description;
        existing.gallery = row.gallery?.length ? row.gallery : existing.gallery;
        existing.make = row.make || existing.make;
        existing.crew = row.crew || existing.crew;
        existing.slots = row.slots?.length ? row.slots : existing.slots;
        existing.msrp = row.msrp ?? existing.msrp;
      }
    } else if (!seen.has(asset.id)) {
      items.push(row);
      seen.add(asset.id);
    }
  }

  const listed = await ownOrders(owner.toBase58(), catalog).catch(() => []);
  items.push(...listed);
  const order = { crew: 0, ship: 1, structure: 2, resource: 3, nft: 4, other: 5 };
  items.sort((a, b) => order[a.kind] - order[b.kind] || a.name.localeCompare(b.name, "en"));

  return {
    owner: owner.toBase58(),
    at: Date.now(),
    items,
    skippedMeta,
    profiles: game.profiles,
    rpcWarning: game.warning,
    note: "Экипаж с ключа собирается из инвентаря: карточки /crew по dasID и NFT, которые реестр Solana отдаёт как активы. OCEAN в каталоге — доля, здесь она приведена к 0–100. Если человек уже в Starbase, на адресе его нет.",
  };
}
