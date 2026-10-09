export type TokenQuote = {
  usd: number | null;
  change24h: number | null;
  circulating: number | null;
  totalSupply: number | null;
  lockedSupply: number | null;
};

export type Candle = { t: number; o: number; h: number; l: number; c: number };

export type BookLevel = { price: number; qty: number };

export type TapePoint = { t: number; asks: Record<string, number> };

export type MarketShip = {
  mint: string;
  name: string;
  image: string;
  gallery: string[];
  description: string;
  rarity: string;
  className: string;
  spec: string;
  make: string;
  crew: number;
  slots: string[];
  msrp: number | null;
  usdcAsks: BookLevel[];
  usdcBids: BookLevel[];
  atlasAsks: BookLevel[];
  atlasBids: BookLevel[];
};

export type ResourceRow = {
  mint: string;
  name: string;
  symbol: string;
  className: string;
  image: string;
  ask: number | null;
  bid: number | null;
  askQty: number;
  quote?: "ATLAS" | "USDC" | "POLIS";
  /** true when the displayed USDC value was calculated from an ATLAS book. */
  usdcDerived?: boolean;
  usdcAsk?: number | null;
  usdcBid?: number | null;
  atlasAsk?: number | null;
  atlasBid?: number | null;
  polisAsk?: number | null;
  polisBid?: number | null;
};

export type MarketPairQuotes = {
  /** Last daily close in USD. Not a USDC order book. */
  atlasUsdc: number | null;
  polisUsdc: number | null;
  polisAtlas: number | null;
  /** How many SOL one POLIS costs. */
  solPerPolis?: number | null;
  /** How many ATLAS one SOL buys. */
  atlasPerSol?: number | null;
};

export type MarketSnap = {
  at: number;
  orderCount: number;
  atlas: TokenQuote;
  polis: TokenQuote;
  resources: ResourceRow[];
  ships: ResourceRow[];
  marketShips: MarketShip[];
  candles: Candle[];
  /** POLIS/ATLAS candles kept for the ratio chart. */
  pairCandles: Candle[];
  /** POLIS/USDC candles. */
  polisUsdcCandles?: Candle[];
  pairQuotes?: MarketPairQuotes;
  /** ATLAS priced in SOL, from the two USD candles. */
  solAtlasCandles?: Candle[];
  /** POLIS priced in SOL, from the two USD candles. */
  solPolisCandles?: Candle[];
  tape: TapePoint[];
  note: string;
};

export type WalletTrait = { trait: string; value: string };

export type WalletItem = {
  mint: string;
  amount: number;
  name: string;
  kind: "resource" | "ship" | "crew" | "structure" | "nft" | "other";
  image: string;
  className: string;
  rarity: string;
  spec: string;
  traits: WalletTrait[];
  description?: string;
  gallery?: string[];
  make?: string;
  crew?: number;
  slots?: string[];
  msrp?: number | null;
};

export type FleetPeek = { name: string; faction: number };

export type ProfilePeek = { profile: string; keys: number; fleets: FleetPeek[] };

export type WalletScan = {
  owner: string;
  at: number;
  items: WalletItem[];
  skippedMeta: number;
  profiles: ProfilePeek[];
  rpcWarning: string;
  note: string;
};
