import { createServerFn } from "@tanstack/react-start";
import type { MarketSnap, WalletScan } from "./desk-types";

export type { MarketSnap, ResourceRow, TokenQuote, WalletItem, WalletScan, WalletTrait, Candle, TapePoint, FleetPeek, ProfilePeek } from "./desk-types";

export const loadMarket = createServerFn({ method: "GET" }).handler(async (): Promise<MarketSnap> => {
  const { buildMarket } = await import("./desk.impl.ts");
  return buildMarket();
});

export const scanDeskWallet = createServerFn({ method: "POST" })
  .validator((input: { owner: string }) => {
    const owner = String(input?.owner ?? "").trim();
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(owner)) {
      throw new Error("Нужен публичный ключ Solana. Подпись и перевод не требуются.");
    }
    return { owner };
  })
  .handler(async ({ data }): Promise<WalletScan> => {
    const { scanWallet } = await import("./desk.impl.ts");
    return scanWallet(data.owner);
  });
