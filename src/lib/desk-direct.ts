import type { BookLevel, Candle, MarketShip, MarketSnap, ResourceRow, WalletItem, WalletScan, WalletTrait } from "./desk-types";

const ATLAS = "ATLASXmbPQxBUYbxPsV97usA3fPQYEqzQBUHgiFCUsXx";
const POLIS = "poLisWXnNRwC6oBu1vHiuKQzFjGL4XDSu4g9qjz9qVk";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const GM = "traderDnaR5w6Tcoi3NFm53i48FTDNbGjBSZwWXDRrg";
const TOKEN = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_22 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const RPCS = [
  "https://api.mainnet.solana.com",
  "https://api.mainnet-beta.solana.com",
  "https://solana-rpc.publicnode.com",
];
const KEEP = new Set(["consumable", "raw material", "component", "compound material", "material bundle", "contracts", "data"]);
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

type Cat = {
  mint: string;
  name: string;
  symbol: string;
  kind: WalletItem["kind"];
  className: string;
  rarity: string;
  spec: string;
  image: string;
  thumb: string;
  description: string;
  gallery: string[];
  make: string;
  crew: number;
  slots: string[];
  msrp: number | null;
};

function b58(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros += 1;
  const digits = [0];
  for (let i = zeros; i < bytes.length; i += 1) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j += 1) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  return "1".repeat(zeros) + digits.reverse().map((digit) => B58[digit]).join("");
}

function u64(raw: Uint8Array, offset: number): number {
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  return Number(view.getBigUint64(offset, true));
}

async function getJson<T>(url: string, ms = 20000): Promise<T> {
  const res = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(ms) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return (await res.json()) as T;
}

async function rpc<T>(method: string, params: unknown, ms = 14000): Promise<T> {
  let last = "RPC не ответил";
  for (const url of RPCS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(ms),
      });
      const json = (await res.json()) as { result?: T; error?: { message?: string } };
      if (json.error) {
        last = json.error.message || last;
        continue;
      }
      if (json.result !== undefined) return json.result;
    } catch (err) {
      last = err instanceof Error ? err.message : last;
    }
  }
  throw new Error(last);
}

async function catalog(): Promise<Cat[]> {
  const rows = await getJson<Array<Record<string, unknown>>>("https://galaxy.staratlas.com/nfts");
  return rows.flatMap((row) => {
    const mint = String(row.mint ?? "");
    if (!mint) return [];
    const attrs = (row.attributes ?? {}) as Record<string, unknown>;
    const itemType = String(attrs.itemType ?? "");
    const kind = itemType === "resource" || itemType === "ship" || itemType === "crew" || itemType === "structure" ? itemType : "other";
    const media = (row.media ?? {}) as { gallery?: unknown; thumbnailUrl?: unknown };
    const slots = ((row.slots ?? {}) as { crewSlots?: Array<{ type?: string; quantity?: number }> }).crewSlots ?? [];
    const gallery = Array.isArray(media.gallery) ? media.gallery.filter((item): item is string => typeof item === "string").slice(0, 8) : [];
    const full = String(row.image ?? "");
    const thumb = typeof media.thumbnailUrl === "string" && media.thumbnailUrl ? media.thumbnailUrl : full;
    const msrp = (row.tradeSettings as { msrp?: { value?: number } } | undefined)?.msrp?.value;
    return [{
      mint,
      name: String(row.name ?? mint.slice(0, 4)),
      symbol: String(row.symbol ?? ""),
      kind,
      className: String(attrs.class ?? "").toLowerCase(),
      rarity: String(attrs.rarity ?? ""),
      spec: String(attrs.spec ?? ""),
      image: full,
      thumb,
      description: String(row.description ?? "").replace(/\s+/g, " ").slice(0, 420),
      gallery,
      make: String(attrs.make ?? ""),
      crew: slots.reduce((sum, slot) => sum + (Number(slot.quantity) || 0), 0),
      slots: slots.flatMap((slot) => Array.from({ length: Math.max(1, Number(slot.quantity) || 1) }, () => String(slot.type ?? "слот"))),
      msrp: typeof msrp === "number" ? msrp : null,
    } satisfies Cat];
  });
}

type Side = { ask: number | null; bid: number | null; asks: BookLevel[]; bids: BookLevel[] };

async function book(currency: string, decimals: number, retries = currency === USDC ? 4 : 1): Promise<Map<string, Side>> {
  const params = [
    GM,
    {
      encoding: "base64",
      dataSlice: { offset: 40, length: 153 },
      filters: [{ dataSize: 201 }, { memcmp: { offset: 40, bytes: currency } }],
    },
  ];
  let result: Array<{ account?: { data?: [string, string] } }> = [];
  for (let pass = 0; pass < retries; pass += 1) {
    try {
      result = await rpc<Array<{ account?: { data?: [string, string] } }>>("getProgramAccounts", params);
      if (result.length > 0 || currency !== USDC) break;
    } catch {
      if (pass + 1 >= retries) {
        throw new Error("USDC orderbook RPC не ответил после нескольких попыток");
      }
    }
    if (currency === USDC && pass + 1 < retries) {
      await new Promise((resolve) => setTimeout(resolve, 350 * (pass + 1)));
    }
  }
  const bags = new Map<string, { asks: BookLevel[]; bids: BookLevel[] }>();
  const scale = 10 ** decimals;
  for (const row of result) {
    const b64 = row.account?.data?.[0];
    if (!b64) continue;
    const raw = Uint8Array.from(atob(b64), (char) => char.charCodeAt(0));
    if (raw.length < 153) continue;
    const asset = b58(raw.subarray(32, 64));
    const side = raw[128];
    const price = u64(raw, 129) / scale;
    const qty = u64(raw, 145);
    if (price <= 0 || qty <= 0) continue;
    const bag = bags.get(asset) ?? { asks: [], bids: [] };
    if (side === 1) bag.asks.push({ price, qty });
    else if (side === 0) bag.bids.push({ price, qty });
    bags.set(asset, bag);
  }
  const out = new Map<string, Side>();
  for (const [mint, bag] of bags) {
    const asks = bag.asks.sort((a, b) => a.price - b.price).slice(0, 8);
    const bids = bag.bids.sort((a, b) => b.price - a.price).slice(0, 8);
    out.set(mint, { ask: asks[0]?.price ?? null, bid: bids[0]?.price ?? null, asks, bids });
  }
  return out;
}

async function candles(pair: string): Promise<Candle[]> {
  const data = await getJson<{ result?: Record<string, unknown> }>(`https://api.kraken.com/0/public/OHLC?pair=${pair}&interval=1440`);
  const rows = Object.values(data.result ?? {}).find((value) => Array.isArray(value)) as unknown[][] | undefined;
  if (!rows) return [];
  return rows
    .slice(-180)
    .map((row) => ({ t: Number(row[0]) * 1000, o: Number(row[1]), h: Number(row[2]), l: Number(row[3]), c: Number(row[4]) }))
    .filter((row) => row.c > 0);
}

function ratio(base: Candle[], quote: Candle[]): Candle[] {
  const by = new Map(quote.map((row) => [Math.floor(row.t / 86_400_000), row]));
  return base.flatMap((row) => {
    const other = by.get(Math.floor(row.t / 86_400_000));
    if (!other || other.c <= 0 || other.o <= 0) return [];
    return [{ t: row.t, o: row.o / other.o, h: row.h / other.l, l: row.l / other.h, c: row.c / other.c }];
  });
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T | null> {
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

export async function directMarket(): Promise<MarketSnap> {
  const booksPromise = Promise.race([
    Promise.all([
      book(USDC, 6, 2).catch(() => null),
      book(ATLAS, 8, 1).catch(() => null),
      book(POLIS, 8, 1).catch(() => null),
    ]),
    new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 4000)),
  ]);
  const [rows, prices, atlasCandles, polisCandles, solCandles] = await Promise.all([
    catalog(),
    getJson<Record<string, { usdPrice?: number; priceChange24h?: number }>>(
      `https://lite-api.jup.ag/price/v3?ids=${ATLAS},${POLIS}`,
    ).catch(() => ({}) as Record<string, { usdPrice?: number; priceChange24h?: number }>),
    candles("ATLASUSD").catch(() => []),
    candles("POLISUSD").catch(() => []),
    candles("SOLUSD").catch(() => []),
  ]);
  const books = await booksPromise;
  const usdcBook = books?.[0] ?? null;
  const atlasBook = books?.[1] ?? null;
  const polisBook = books?.[2] ?? null;
  const resources: ResourceRow[] = [];
  const ships: ResourceRow[] = [];
  const marketShips: MarketShip[] = [];
  for (const item of rows) {
    if (item.kind !== "resource" && item.kind !== "ship") continue;
    if (item.kind === "resource" && item.className && !KEEP.has(item.className)) continue;
    const usdc = usdcBook?.get(item.mint);
    const atlas = atlasBook?.get(item.mint);
    const polis = polisBook?.get(item.mint);
    const row: ResourceRow = {
      mint: item.mint,
      name: item.name,
      symbol: item.symbol,
      className: item.className,
      image: item.thumb || item.image,
      usdcAsk: usdc?.ask ?? null,
      usdcBid: usdc?.bid ?? null,
      atlasAsk: atlas?.ask ?? null,
      atlasBid: atlas?.bid ?? null,
      polisAsk: polis?.ask ?? null,
      polisBid: polis?.bid ?? null,
      ask: usdc?.ask ?? atlas?.ask ?? null,
      bid: usdc?.bid ?? atlas?.bid ?? null,
      askQty: usdc?.asks[0]?.qty ?? atlas?.asks[0]?.qty ?? 0,
      quote: usdc?.ask != null || usdc?.bid != null ? "USDC" : atlas?.ask != null || atlas?.bid != null ? "ATLAS" : "USDC",
    };
    if (item.kind === "resource") resources.push(row);
    else {
      ships.push(row);
      marketShips.push({
        mint: item.mint,
        name: item.name,
        image: item.thumb || item.image,
        gallery: [item.image, ...item.gallery].filter((src, index, all) => Boolean(src) && all.indexOf(src) === index),
        description: item.description,
        rarity: item.rarity,
        className: item.className,
        spec: item.spec,
        make: item.make,
        crew: item.crew,
        slots: item.slots,
        msrp: item.msrp,
        usdcAsks: usdc?.asks ?? [],
        usdcBids: usdc?.bids ?? [],
        atlasAsks: atlas?.asks ?? [],
        atlasBids: atlas?.bids ?? [],
      });
    }
  }
  resources.sort((a, b) => a.name.localeCompare(b.name));
  const quote = (mint: string) => ({
    usd: prices[mint]?.usdPrice ?? null,
    change24h: prices[mint]?.priceChange24h ?? null,
    circulating: null,
    totalSupply: null,
    lockedSupply: null,
  });
  const closeOf = (series: Candle[]) => (series.length ? series[series.length - 1].c : null);
  const atlasUsd = closeOf(atlasCandles) ?? prices[ATLAS]?.usdPrice ?? null;
  const polisUsd = closeOf(polisCandles) ?? prices[POLIS]?.usdPrice ?? null;
  const pairCandles = ratio(polisCandles, atlasCandles);
  const solPerPolis = ratio(polisCandles, solCandles);
  const atlasPerSol = ratio(solCandles, atlasCandles);
  return {
    at: Date.now(),
    orderCount: (usdcBook?.size ?? 0) + (atlasBook?.size ?? 0) + (polisBook?.size ?? 0),
    atlas: quote(ATLAS),
    polis: quote(POLIS),
    resources,
    ships,
    marketShips,
    candles: atlasCandles,
    polisUsdcCandles: polisCandles,
    pairCandles,
    solAtlasCandles: atlasPerSol,
    solPolisCandles: solPerPolis,
    pairQuotes: {
      atlasUsdc: atlasUsd,
      polisUsdc: polisUsd,
      polisAtlas: closeOf(pairCandles),
      solPerPolis: closeOf(solPerPolis),
      atlasPerSol: closeOf(atlasPerSol),
    },
    tape: [],
    note: atlasBook || usdcBook
      ? "Стакан Galactic Marketplace ответил из браузера. Графики — дневные свечи в USD, не стакан USDC."
      : "Графики — дневные свечи Kraken в USD. Это не стакан USDC. Заявки ресурсов и кораблей браузер сам не читает: Solana закрывает getProgramAccounts.",
  };
}

function traitsOf(meta: Record<string, unknown>): WalletTrait[] {
  const raw = meta.attributes;
  if (!Array.isArray(raw)) return [];
  const out: WalletTrait[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const trait = String((row as { trait_type?: string }).trait_type ?? "");
    const value = (row as { value?: unknown }).value;
    if (!trait || value == null || typeof value === "object") continue;
    out.push({ trait, value: String(value) });
  }
  const important = (row: WalletTrait) => /rarity|^name$|species|sex|openness|conscient|extraver|agreeab|neurot|flight|command|engineer|medical|science|fitness|hospital|operator/i.test(row.trait);
  return [...out.filter(important), ...out.filter((row) => !important(row))].slice(0, 48);
}

function isCrew(name: string, symbol: string, traits: WalletTrait[]): boolean {
  if (/crew/i.test(name) || /crew/i.test(symbol)) return true;
  return /flight|command|engineering|hospitality|operator|medical|science|fitness|openness|species|ustur|punaab|sogmian|mierese|hair/i.test(
    traits.map((row) => `${row.trait} ${row.value}`).join(" "),
  );
}

export async function directWallet(owner: string): Promise<WalletScan> {
  const warnings: string[] = [];
  const items: WalletItem[] = [];
  const seen = new Set<string>();
  try {
    for (let page = 1; page <= 4; page += 1) {
      const result = await rpc<{ total?: number; items?: Array<Record<string, unknown>> }>("getAssetsByOwner", {
        ownerAddress: owner,
        page,
        limit: 100,
        displayOptions: { showFungible: false, showZeroBalance: false },
      });
      const chunk = result.items ?? [];
      for (const asset of chunk) {
        const id = String(asset.id ?? "");
        if (!id || seen.has(id)) continue;
        const content = (asset.content ?? {}) as Record<string, unknown>;
        const meta = (content.metadata ?? {}) as Record<string, unknown>;
        const links = (content.links ?? {}) as Record<string, unknown>;
        const traits = traitsOf(meta);
        const name = String(meta.name ?? "");
        const symbol = String(meta.symbol ?? "");
        if (!isCrew(name, symbol, traits)) continue;
        seen.add(id);
        const named = traits.find((row) => row.trait.toLowerCase() === "name")?.value;
        items.push({
          mint: id,
          amount: 1,
          name: named && !/^crew\b/i.test(named) ? named : name || id.slice(0, 4),
          kind: "crew",
          image: typeof links.image === "string" ? links.image : "",
          className: "crew",
          rarity: traits.find((row) => row.trait.toLowerCase() === "rarity")?.value ?? "",
          spec: traits.find((row) => /species/i.test(row.trait))?.value ?? "",
          traits,
        });
      }
      if (!chunk.length || items.length >= (result.total ?? items.length)) break;
    }
  } catch (err) {
    warnings.push(err instanceof Error ? err.message : "Реестр NFT не ответил");
  }
  try {
    for (const program of [TOKEN, TOKEN_22]) {
      const result = await rpc<{ value?: Array<{ account?: { data?: { parsed?: { info?: { mint?: string; tokenAmount?: { uiAmount?: number; decimals?: number } } } } } }> }>(
        "getTokenAccountsByOwner",
        [owner, { programId: program }, { encoding: "jsonParsed" }],
      );
      for (const row of result.value ?? []) {
        const info = row.account?.data?.parsed?.info;
        const mint = info?.mint ?? "";
        const amount = info?.tokenAmount?.uiAmount ?? 0;
        if (!mint || amount <= 0 || seen.has(mint)) continue;
        if (mint === ATLAS || mint === POLIS) {
          seen.add(mint);
          items.push({
            mint,
            amount,
            name: mint === ATLAS ? "ATLAS" : "POLIS",
            kind: "resource",
            image: "",
            className: "currency",
            rarity: "",
            spec: mint === ATLAS ? "ATLAS" : "POLIS",
            traits: [],
          });
        }
      }
    }
  } catch (err) {
    warnings.push(err instanceof Error ? err.message : "Токены ключа не прочитались");
  }
  return {
    owner,
    at: Date.now(),
    items,
    skippedMeta: 0,
    profiles: [],
    rpcWarning: warnings.join(". "),
    note: items.length
      ? "Экипаж прочитан браузером напрямую из реестра Solana, без PHP."
      : "Реестр по этому адресу вернул пустой список. Это ответ сети, не пустой путь плагина.",
  };
}
