const KEY = "galia-price-tape-v1";
const FINE = 15 * 60 * 1000;

export type TapePoint = {
  t: number;
  asks: Record<string, number>;
  atlasUsd: number | null;
};

function compactTape(points: TapePoint[]): TapePoint[] {
  const sorted = [...points].filter((point) => point && typeof point.t === "number").sort((a, b) => a.t - b.t);
  const now = Date.now();
  const out: TapePoint[] = [];
  let last = 0;
  for (const point of sorted) {
    const age = now - point.t;
    const gap = age <= 6 * 60 * 60 * 1000 ? FINE : age <= 10 * 24 * 60 * 60 * 1000 ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    if (point.t - last >= gap * 0.9) {
      out.push(point);
      last = point.t;
    }
  }
  return out.slice(-900);
}

export function loadTape(): TapePoint[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TapePoint[];
    return Array.isArray(parsed) ? compactTape(parsed.filter((p) => p && typeof p.t === "number" && p.asks)) : [];
  } catch {
    return [];
  }
}

export function recordTape(asks: Record<string, number>, atlasUsd: number | null, force = false): TapePoint[] {
  const tape = loadTape();
  const last = tape.at(-1);
  const now = Date.now();
  const next = !force && last && now - last.t < FINE ? tape : compactTape([...tape, { t: now, asks, atlasUsd }]);
  if (typeof localStorage !== "undefined") localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function deltaPct(current: number | null, previous: number | undefined): number | null {
  if (current == null || previous == null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

const FLOOR_KEY = "galia-price-floor-v1";

export function loadFloors(): Record<string, number> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(FLOOR_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, number> = {};
    for (const [mint, price] of Object.entries(parsed)) {
      if (typeof price === "number" && price > 0) out[mint] = price;
    }
    return out;
  } catch {
    return {};
  }
}

/** Lowest ask this browser has recorded. A higher print never lifts the floor. */
export function rememberFloors(...sources: Array<Record<string, number> | undefined>): Record<string, number> {
  const floors = loadFloors();
  for (const source of sources) {
    if (!source) continue;
    for (const [mint, price] of Object.entries(source)) {
      if (!(price > 0)) continue;
      if (floors[mint] == null || price < floors[mint]) floors[mint] = price;
    }
  }
  if (typeof localStorage !== "undefined") localStorage.setItem(FLOOR_KEY, JSON.stringify(floors));
  return floors;
}
