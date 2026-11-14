import { previewPathPrefix } from "@/lib/preview-path-prefix";

type PlanetConfig = {
  meshBase?: string;
  meshLibraryBase?: string;
  propBase?: string;
};

function planetConfig(): PlanetConfig {
  if (typeof window === "undefined") return {};
  return (window as Window & { BCMFirstPlanetConfig?: PlanetConfig }).BCMFirstPlanetConfig || {};
}

function encodePath(path: string) {
  return path.split("/").filter(Boolean).map((part) => encodeURIComponent(part)).join("/");
}

function appendPath(base: string, path: string) {
  return `${base.replace(/\/?$/, "/")}${encodePath(path)}`;
}

function previewPrefix() {
  return typeof window === "undefined"
    ? ""
    : (previewPathPrefix(window.location.hostname, window.location.pathname) ?? "");
}

export function meshUrl(file: string) {
  const base = planetConfig().meshBase;
  if (base) return appendPath(base, file);
  return `${previewPrefix()}/mesh/${encodePath(file)}`;
}

/** First Planet's own scenery/prop library, kept inside mini-sim/first-planet/mesh/library/. */
export function libraryUrl(path: string) {
  const base = planetConfig().meshLibraryBase;
  if (base) return appendPath(base, path);
  return `${previewPrefix()}/mesh/library/${encodePath(path)}`;
}

/** Shared Mini-Sim models (ships, Crew and other reusable assets) stay in mini-sim/assets/mesh/. */
export function propUrl(path: string) {
  const base = planetConfig().propBase;
  if (!base) return "";
  return appendPath(base, path);
}
