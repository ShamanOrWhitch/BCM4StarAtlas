const KEY = "galia-price-tape-v1";
const MAX = 36;
const GAP = 15 * 60 * 1000;

export type TapePoint = {
  t: number;
  asks: Record<string, number>;
  atlasUsd: number | null;
};

export function loadTape(): TapePoint[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TapePoint[];
    return Array.isArray(parsed) ? parsed.filter((p) => p && typeof p.t === "number").slice(-MAX) : [];
  } catch {
    return [];
  }
}

export function recordTape(asks: Record<string, number>, atlasUsd: number | null, force = false): TapePoint[] {
  const tape = loadTape();
  const last = tape.at(-1);
  const now = Date.now();
  if (!force && last && now - last.t < GAP) return tape;
  const next = [...tape, { t: now, asks, atlasUsd }].slice(-MAX);
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function deltaPct(current: number | null, previous: number | undefined): number | null {
  if (current == null || previous == null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}
