import SHIP_CATALOG from "../../../../assets/mesh/ships/catalog.json";
import { meshUrl, propUrl } from "@/game/mesh-url";

/** Every ship the game asks for lives under mini-sim/assets/mesh/ships/. */
export function shipUrl(path: string) {
  const plugin = propUrl(path);
  if (plugin) return plugin;
  return meshUrl(path.split("/").map((part) => encodeURIComponent(part)).join("/"));
}

type CatalogShip = {
  id: string;
  name: string;
  category: string;
  crew: string;
  size: string;
  flight: string;
  parked: string;
  planetDrive: boolean;
  planetRace: boolean;
  islandLength: number;
  raceLength: number;
  yardLength: number;
  showLength: number;
};

export type PilotShip = {
  id: string;
  name: string;
  /** Rest/parked form, when the family has a separate idle GLB. */
  file: string;
  /** Motion/flight form; single-model families intentionally reuse file. */
  flightFile: string;
  crew: string;
  island: number;
  race: number;
  show: number;
  planetRace: boolean;
};

const CATALOG = (SHIP_CATALOG as { families: CatalogShip[] }).families;
function toPilotShip(ship: CatalogShip): PilotShip {
  return {
    id: ship.id,
    name: ship.name,
    file: "ships/" + (ship.parked || ship.flight),
    flightFile: "ships/" + ship.flight,
    crew: ship.crew || "human",
    island: Number(ship.islandLength) || 6,
    race: Number(ship.raceLength) || 9,
    show: Number(ship.showLength) || 12,
    planetRace: Boolean(ship.planetRace),
  };
}

/** Small hulls can be boarded on the island; all other families live on the asteroid showcase. */
export const PILOT_SHIPS: PilotShip[] = CATALOG.filter((ship) => ship.planetDrive).map(toPilotShip);
export const ASTEROID_SHOW: PilotShip[] = CATALOG.filter((ship) => !ship.planetDrive).map(toPilotShip);

export function pilotShip(id: string) {
  return [...PILOT_SHIPS, ...ASTEROID_SHOW].find((ship) => ship.id === id) ?? PILOT_SHIPS[0];
}

export const ISLAND_SHIPS = PILOT_SHIPS.map((ship) => ship.file);

/** Only road-safe racers are used in Shoal Race. Combat and cargo hulls stay on the island/showcase. */
export const RACE_SHIPS = PILOT_SHIPS.filter((ship) => ship.planetRace).map((ship) => ship.flightFile);

export function raceLength(file: string) {
  return [...PILOT_SHIPS, ...ASTEROID_SHOW].find((ship) => ship.flightFile === file || ship.file === file)?.race ?? 9;
}

/** Stand-in height for the species. High stays short, Sogmian stays tall. */
export function characterHeight(species: string) {
  const key = species.toLowerCase();
  if (key.includes("sogmian")) return 2.05;
  if (key.includes("high")) return 1.55;
  if (key.includes("ustur")) return 1.7;
  if (key.includes("mierese")) return 1.66;
  if (key.includes("profound") || key.includes("punaab")) return 1.8;
  if (key.includes("victorn") || key.includes("dread")) return 1.84;
  return 1.78;
}
export function characterPath(species: string) {
  const key = species.toLowerCase();
  if (key.includes("ustur")) return "characters 3d/ustur/ustur_prototype.glb";
  if (key.includes("mierese")) return "characters 3d/mierese/mierese_prototype.glb";
  if (key.includes("sogmian")) return "characters 3d/sogmian/trandor_prototype.glb";
  if (key.includes("profound") || key.includes("punaab")) return "characters 3d/profound/profound_prototype.glb";
  if (key.includes("high")) return "characters 3d/high/high_prototype.glb";
  if (key.includes("victorn") || key.includes("dread")) return "characters 3d/human/ja_victorn_prototype.glb";
  return "characters 3d/human/hahnemann_prototype.glb";
}
