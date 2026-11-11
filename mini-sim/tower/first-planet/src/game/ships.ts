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
  /** Parked on the desert, beside a person. Big enough to read, not a house. */
  island: number;
  /** Open track. The road is ~15 m wide, so a racer has to read at speed. */
  race: number;
  /** Showcase hulls beside the hanging asteroid. A step up from the desert prop. */
  show: number;
};

/** Real files on disk. Missing colorways were why every kart became a red Pearce. */
export const PILOT_SHIPS: PilotShip[] = [
  { id: "pearce4", name: "Pearce X4", file: "ships/xxsmall/pearce x 4/spacebike_red_on.glb", crew: "human", island: 3.6, race: 6.6, show: 11 },
  { id: "pearce4-blue", name: "Pearce X4 синий", file: "ships/xxsmall/pearce x 4/spacebike_blue_off.glb", crew: "high", island: 3.6, race: 6.6, show: 11 },
  { id: "airbike", name: "Fimbul Airbike", file: "ships/xxsmall/fimbul Airbike/airbike_red_full.glb", crew: "ustur", island: 3.4, race: 6.2, show: 10 },
  { id: "opal", name: "Opal Jet", file: "ships/xxsmall/opal_jet/opal_jet_teal_flight.glb", crew: "mierese", island: 5.4, race: 7.8, show: 13 },
  { id: "jetjet", name: "Jetjet", file: "ships/xsmall/jetjet/jetjet_red_flight.glb", crew: "victorn", island: 5.6, race: 8.8, show: 15 },
  { id: "solos", name: "Solos", file: "ships/xxsmall/solos/solos_blue_flight.glb", crew: "sogmian", island: 4.2, race: 7.4, show: 12 },
  { id: "ruch", name: "Ruch", file: "ships/xxsmall/ruch/ruch_blue_flight.glb", crew: "profound", island: 4.2, race: 7.4, show: 12 },
  { id: "busan", name: "Busan Pulse", file: "ships/xxsmall/busan_pulse/busan_pulse_blue_flight.glb", crew: "high", island: 4.0, race: 7.2, show: 12 },
  { id: "scud", name: "Scud", file: "ships/xsmall/scud/scud_orange_flight.glb", crew: "mierese", island: 5.8, race: 9.0, show: 16 },
  { id: "lowbie", name: "Fimbul Lowbie", file: "ships/xsmall/Fimbul Lowbie/hovercar_red_off.glb", crew: "human", island: 6.0, race: 9.2, show: 16 },
  { id: "niruch", name: "Niruch", file: "ships/xsmall/niruch/niruch_blue_off.glb", crew: "ustur", island: 5.2, race: 8.4, show: 14 },
  { id: "x5", name: "Pearce X5", file: "ships/xsmall/pearce_x5/x5_blue_compact_off.glb", crew: "victorn", island: 5.0, race: 8.2, show: 14 },
  { id: "maxhog", name: "Max Hog", file: "ships/xsmall/maxhog/maxhog_red_rig.glb", crew: "sogmian", island: 6.2, race: 9.6, show: 16 },
  { id: "opal-white", name: "Opal Jet белый", file: "ships/xxsmall/opal_jet/opal_jet_white_off.glb", crew: "profound", island: 5.4, race: 7.8, show: 13 },
  { id: "mik", name: "Mik Ogrika", file: "ships/small/mik/mik_pearl_flight.glb", crew: "human", island: 6.4, race: 9, show: 16 },
  { id: "feist", name: "Feist Tufa", file: "ships/small/feist_darker_gray/feist_gray_flight.glb", crew: "high", island: 6.6, race: 9.2, show: 16 },
  { id: "arma", name: "Vzus Arma", file: "ships/small/arma/arma_teal_flight.glb", crew: "ustur", island: 6.4, race: 9, show: 16 },
  { id: "ambwe", name: "VZUS Ambwe", file: "ships/small/ambwe/ambwe_black_flight.glb", crew: "mierese", island: 6.4, race: 9, show: 16 },
];

export function pilotShip(id: string) {
  return PILOT_SHIPS.find((ship) => ship.id === id) ?? PILOT_SHIPS[0];
}

/** Class hulls parked on the hanging asteroid. Too big for a desert pad. */
export const ASTEROID_SHOW: PilotShip[] = [
  { id: "arc", name: "Rainbow Arc", file: "ships/Large/rainbow_arc_v1/rainbow_arc.glb", crew: "human", island: 8, race: 12, show: 16 },
  { id: "armstrong", name: "Armstrong Imp", file: "ships/Large/imp_bur_v1/imp_bur_v1/armstrong_imp.glb", crew: "high", island: 8, race: 12, show: 18 },
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
