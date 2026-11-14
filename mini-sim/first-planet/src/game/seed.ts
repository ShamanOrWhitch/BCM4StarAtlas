/**
 * Deterministic random streams for one local Mini-Sim journey.
 *
 * Each activity gets its own derived seed. A new decoration family should use
 * a salted stream instead of consuming another system's stream, so adding
 * assets never reshuffles the route, pickups or unrelated objects.
 */
export function deriveLocationSeed(sessionSeed: number, locationId: string): number {
  let hash = 2166136261 >>> 0;
  const input = String(Number(sessionSeed) >>> 0) + "|" + String(locationId || "");
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Mulberry32: small, deterministic and independent of Math.random(). */
export function createSeededRandom(seed: number, salt = ""): () => number {
  let state = (Number(seed) >>> 0) ^ deriveLocationSeed(Number(seed) >>> 0, salt);
  return () => {
    let value = (state += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededPick<T>(items: readonly T[], random: () => number): T | undefined {
  if (!items.length) return undefined;
  const index = Math.min(items.length - 1, Math.floor(random() * items.length));
  return items[index];
}

export function seededShuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.min(i, Math.floor(random() * (i + 1)));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
