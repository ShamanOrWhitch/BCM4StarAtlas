import { meshUrl, propUrl } from "@/game/mesh-url";

/** Every ship the game asks for lives under mini-sim/assets/mesh/ships/. */
export function shipUrl(path: string) {
  const plugin = propUrl(path);
  if (plugin) return plugin;
  return meshUrl(path.split("/").map((part) => encodeURIComponent(part)).join("/"));
}

/** Racers that actually fit the desert track. One flight mesh each. */
export const RACE_SHIPS = [
  "ships/xxsmall/pearce x 4/spacebike_red_on.glb",
  "ships/xxsmall/fimbul Airbike/airbike_red_full.glb",
  "ships/xxsmall/opal_jet/opal_jet_teal_flight.glb",
  "ships/xsmall/jetjet/jetjet_red_flight.glb",
  "ships/xxsmall/solos/solos_blue_flight.glb",
  "ships/xxsmall/ruch/ruch_blue_flight.glb",
  "ships/xxsmall/busan_pulse/busan_pulse_blue_flight.glb",
  "ships/xsmall/scud/scud_orange_flight.glb",
  "ships/xsmall/Fimbul Lowbie/hovercar_red_off.glb",
];

/** Parked xsmall and xxsmall, off the race line. */
export const ISLAND_SHIPS = [
  "ships/xsmall/jetjet/jetjet_silver_parked.glb",
  "ships/xsmall/niruch/niruch_blue_off.glb",
  "ships/xsmall/maxhog/maxhog_red_rig.glb",
  "ships/xsmall/scud/scud_teal_off.glb",
  "ships/xsmall/pearce_x5/x5_blue_compact_off.glb",
  "ships/xxsmall/opal_jet/opal_jet_white_off.glb",
  "ships/xxsmall/solos/solos_silver_off.glb",
  "ships/xxsmall/ruch/ruch_white_off.glb",
  "ships/xxsmall/busan_pulse/busan_pulse_graphite_folded.glb",
  "ships/xxsmall/pearce x 4/spacebike_blue_off.glb",
];

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
