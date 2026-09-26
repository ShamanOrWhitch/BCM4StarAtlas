export function assetUrl(path: string): string {
  if (!path || !path.startsWith("/")) return path;
  const base = typeof window !== "undefined" ? window.GALIA_ASSET : "";
  if (!base) return path;
  return base.replace(/\/$/, "") + path;
}
