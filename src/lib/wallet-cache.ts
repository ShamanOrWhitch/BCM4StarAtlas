import type { WalletScan } from "./desk-types";

const KEY = "galia-wallet-scan";
let memory: WalletScan | null = null;

export function rememberWalletScan(scan: WalletScan) {
  memory = scan;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(scan));
  } catch {
    /* the scan can be large; the tab still keeps it in memory */
  }
  try {
    localStorage.setItem("galia-owner", scan.owner);
  } catch {
    /* ignore */
  }
}

export function rememberedWalletScan(): WalletScan | null {
  if (memory?.owner && Array.isArray(memory.items)) return memory;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const scan = JSON.parse(raw) as WalletScan;
    if (!scan?.owner || !Array.isArray(scan.items)) return null;
    memory = scan;
    return scan;
  } catch {
    return null;
  }
}
