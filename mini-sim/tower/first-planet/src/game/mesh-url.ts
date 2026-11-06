import { previewPathPrefix } from "@/lib/preview-path-prefix";

type PlanetConfig = {
  meshBase?: string;
  propBase?: string;
};

function planetConfig(): PlanetConfig {
  if (typeof window === "undefined") return {};
  return (window as Window & { BCMFirstPlanetConfig?: PlanetConfig }).BCMFirstPlanetConfig || {};
}

export function meshUrl(file: string) {
  const sharedBase = planetConfig().meshBase;
  if (sharedBase) return `${sharedBase.replace(/\/?$/, "/")}${encodeURIComponent(file)}`;
  const prefix =
    typeof window === "undefined"
      ? ""
      : (previewPathPrefix(window.location.hostname, window.location.pathname) ?? "");
  return `${prefix}/mesh/${file}`;
}

/** Extra packs under mini-sim/assets/mesh/, not the shared blockout catalog. */
export function propUrl(path: string) {
  const base = planetConfig().propBase;
  if (!base) return "";
  return `${base.replace(/\/?$/, "/")}${path
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
}
