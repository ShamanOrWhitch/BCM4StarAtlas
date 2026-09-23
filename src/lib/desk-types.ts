export type TokenQuote = {
  usd: number | null;
  change24h: number | null;
  circulating: number | null;
  totalSupply: number | null;
  lockedSupply: number | null;
};

export type Candle = { t: number; o: number; h: number; l: number; c: number };

export type TapePoint = { t: number; asks: Record<string, number> };

export type ResourceRow = {
  mint: string;
  name: string;
  symbol: string;
  className: string;
  image: string;
  ask: number | null;
  bid: number | null;
  askQty: number;
};

export type MarketSnap = {
  at: number;
  orderCount: number;
  atlas: TokenQuote;
  polis: TokenQuote;
  resources: ResourceRow[];
  candles: Candle[];
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
