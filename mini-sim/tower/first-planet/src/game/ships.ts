import { meshUrl, propUrl } from "@/game/mesh-url";

/** Every ship the game asks for lives under mini-sim/assets/mesh/ships/. */
export function shipUrl(path: string) {
  const plugin = propUrl(path);
  if (plugin) return plugin;
  return meshUrl(path.split("/").map((part) => encodeURIComponent(part)).join("/"));
}

export type PilotShip = {
  id: string;
  name: string;
  file: string;
  /** Species key for characterPath — the pilot that ships with this hull. */
  crew: string;
  /** Parked on the desert, next to a person. Pearce X4 was a house; this is a bike. */
  island: number;
  /** Open-track size. A little larger than the island prop, still a racer. */
  race: number;
  /** Showcase hulls beside the hanging asteroid. A step up from the desert prop. */
  show: number;
};

/** Real files on disk. Missing colorways were why every kart became a red Pearce. */
export const PILOT_SHIPS: PilotShip[] = [
  { id: "pearce4", name: "Pearce X4", file: "ships/xxsmall/pearce x 4/spacebike_red_on.glb", crew: "human", island: 1.32, race: 2.7, show: 6.6 },
  { id: "pearce4-blue", name: "Pearce X4 синий", file: "ships/xxsmall/pearce x 4/spacebike_blue_off.glb", crew: "high", island: 1.32, race: 2.7, show: 6.6 },
  { id: "airbike", name: "Fimbul Airbike", file: "ships/xxsmall/fimbul Airbike/airbike_red_full.glb", crew: "ustur", island: 1.7, race: 2.85, show: 6.9 },
  { id: "opal", name: "Opal Jet", file: "ships/xxsmall/opal_jet/opal_jet_teal_flight.glb", crew: "mierese", island: 1.85, race: 3.05, show: 7.3 },
  { id: "jetjet", name: "Jetjet", file: "ships/xsmall/jetjet/jetjet_red_flight.glb", crew: "victorn", island: 2.15, race: 3.25, show: 7.8 },
  { id: "solos", name: "Solos", file: "ships/xxsmall/solos/solos_blue_flight.glb", crew: "sogmian", island: 1.8, race: 2.95, show: 7.1 },
  { id: "ruch", name: "Ruch", file: "ships/xxsmall/ruch/ruch_blue_flight.glb", crew: "profound", island: 1.8, race: 2.95, show: 7.1 },
  { id: "busan", name: "Busan Pulse", file: "ships/xxsmall/busan_pulse/busan_pulse_blue_flight.glb", crew: "high", island: 1.75, race: 2.9, show: 7.1 },
  { id: "scud", name: "Scud", file: "ships/xsmall/scud/scud_orange_flight.glb", crew: "mierese", island: 2.2, race: 3.3, show: 8 },
  { id: "lowbie", name: "Fimbul Lowbie", file: "ships/xsmall/Fimbul Lowbie/hovercar_red_off.glb", crew: "human", island: 2.25, race: 3.35, show: 8 },
  { id: "niruch", name: "Niruch", file: "ships/xsmall/niruch/niruch_blue_off.glb", crew: "ustur", island: 2.15, race: 3.2, show: 7.6 },
  { id: "x5", name: "Pearce X5", file: "ships/xsmall/pearce_x5/x5_blue_compact_off.glb", crew: "victorn", island: 2.05, race: 3.15, show: 7.6 },
  { id: "maxhog", name: "Max Hog", file: "ships/xsmall/maxhog/maxhog_red_rig.glb", crew: "sogmian", island: 2.2, race: 3.25, show: 7.8 },
  { id: "opal-white", name: "Opal Jet белый", file: "ships/xxsmall/opal_jet/opal_jet_white_off.glb", crew: "profound", island: 1.85, race: 3.05, show: 7.3 },
];

export function pilotShip(id: string) {
  return PILOT_SHIPS.find((ship) => ship.id === id) ?? PILOT_SHIPS[0];
}

/** Class hulls parked on the hanging asteroid. Too big for a desert pad. */
export const ASTEROID_SHOW: PilotShip[] = [
  { id: "arc", name: "Rainbow Arc", file: "ships/Large/rainbow_arc_v1/rainbow_arc.glb", crew: "human", island: 4, race: 8, show: 15 },
  { id: "armstrong", name: "Armstrong Imp", file: "ships/Large/imp_bur_v1/imp_bur_v1/armstrong_imp.glb", crew: "high", island: 4.4, race: 9, show: 18 },
];

export const ISLAND_SHIPS = PILOT_SHIPS.map((ship) => ship.file);

/** One flight mesh per hull. The race shuffles these so a grid is not four copies. */
export const RACE_SHIPS = [
  "ships/xxsmall/pearce x 4/spacebike_red_on.glb",
  "ships/xxsmall/fimbul Airbike/airbike_red_full.glb",
  "ships/xxsmall/opal_jet/opal_jet_teal_flight.glb",
  "ships/xsmall/jetjet/jetjet_red_flight.glb",
  "ships/xxsmall/solos/solos_blue_flight.glb",
  "ships/xxsmall/ruch/ruch_blue_flight.glb",
  "ships/xxsmall/busan_pulse/busan_pulse_blue_flight.glb",
  "ships/xsmall/scud/scud_orange_flight.glb",
  "ships/xsmall/maxhog/maxhog_red_rig.glb",
  "ships/xsmall/Fimbul Lowbie/hovercar_red_off.glb",
  "ships/xxsmall/pearce x 4/spacebike_blue_off.glb",
  "ships/xsmall/niruch/niruch_blue_off.glb",
  "ships/xsmall/pearce_x5/x5_blue_compact_off.glb",
  "ships/xxsmall/opal_jet/opal_jet_white_off.glb",
];

export function raceLength(file: string) {
  return pilotShip(PILOT_SHIPS.find((ship) => ship.file === file)?.id ?? "").race;
}

/** Closest rigged stand-in for the crew the player actually picked. */
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
