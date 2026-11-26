/**
 * Where each planet builds (owner 26.11.2026: "свой дизайн всех планет кроме onicss стартовой
 * локации"; on Opus: "расположение города и всего остального идентично всем остальным планетам …
 * Opus для того чтобы Opus придумало ему свой дизайн").
 *
 * Every place on the island used to be one module constant shared by all planets (terrain.ts).
 * A planet now lays out its own settlement, its residents' spots and its quest places. The scene
 * and the sim keep importing the same names from terrain.ts; applyLayout() moves them in place
 * before the island is built, so nothing else learns a new name.
 *
 *   classic — the valley town of the first planets. Fable (the start at ONI CSS) and the planets
 *             not redesigned yet keep it, exactly as before.
 *   opus    — an observatory monastery on the limestone terraces, by Opus (step 1).
 *
 * Pure: no DOM, no THREE.
 */
import {
  BRAZIERS,
  CHEST,
  CRYSTALS,
  HOUSES,
  JAHMAN,
  JOURNAL,
  KEY_SPOT,
  LETTER,
  NPC,
  RING,
  STORY_BOX,
  TAPES,
  TOWN,
  TOWN_PATH,
  groundY,
  type House,
} from "./terrain";
import { planetLook, type PlanetId } from "./planet";

type Spot = { x: number; z: number };
type Npc = Spot & { yaw: number };

export type Layout = {
  id: "classic" | "opus";
  /** The valley town levelled around a square, or null: build on the terraces as they are. */
  town: { x: number; z: number; level: number } | null;
  /** Houses; a house without a level is levelled at the height of the ground under it. */
  houses: House[];
  npc: { sera: Npc; orr: Npc; bulb: Npc };
  /** collect: three things. */
  crystals: Spot[];
  /** fetch: one thing. */
  key: Spot;
  /** light: two lamps. */
  braziers: Spot[];
  chest: Spot;
  journal: Spot;
  letter: Spot;
  ring: Spot;
  jahman: Npc;
  storyBox: Spot;
  /** The cassette on the floor of JahMan's home. */
  tape: Spot;
  path: Array<[number, number]>;
  /** How the houses look: wall and roof colours, and a dome on one house. */
  style: { wall: number; roof: number; floor: number; dome: string | null };
};

const classicPath: Array<[number, number]> = [];
for (let z = 30; z >= -6; z -= 4) classicPath.push([0, z]);

export const LAYOUTS: Record<Layout["id"], Layout> = {
  classic: {
    id: "classic",
    town: { x: 0, z: 8, level: 0.58 },
    houses: [
      { id: "sera", x: -11, z: 17, w: 8, d: 7, h: 3.45, door: "e" },
      { id: "home", x: 11, z: 15, w: 7.4, d: 6.6, h: 3.2, door: "w" },
      { id: "archive", x: -12.2, z: -1.2, w: 9, d: 7, h: 3.7, door: "e" },
      { id: "keeper", x: 13, z: -5.5, w: 7.2, d: 6.4, h: 3.15, door: "w" },
    ],
    npc: {
      sera: { x: -5.7, z: 17, yaw: Math.PI / 2 },
      orr: { x: -6.4, z: -1.2, yaw: Math.PI / 2 },
      bulb: { x: 4.6, z: 9.4, yaw: Math.PI },
    },
    crystals: [{ x: -30.5, z: -13.5 }, { x: -35.2, z: -20.4 }, { x: -27.4, z: -23.6 }],
    key: { x: 25.6, z: 30.8 },
    braziers: [{ x: 3.5, z: 8.2 }, { x: 2.2, z: -14.2 }],
    chest: { x: 0.2, z: 4.6 },
    journal: { x: -14.4, z: -1.2 },
    letter: { x: 11.1, z: 15 },
    ring: { x: 0.2, z: -42 },
    jahman: { x: 10.35, z: 16.35, yaw: Math.PI / 2 },
    storyBox: { x: 13.05, z: 16.35 },
    tape: { x: 11.55, z: 13.4 },
    path: classicPath,
    style: { wall: 0xe0c7a2, roof: 0x8d5340, floor: 0xc9ae84, dome: null },
  },

  /*
   * Opus — "the observatory on the terraces". No valley town: the monastery climbs the limestone.
   *   - The observatory crowns the western ridge (the high point, 6 m): its keeper, Нон-Ай, and the
   *     journal of the sky. Its roof is a white dome.
   *   - The lens workshop stands on the eastern plateau beyond the dry canyon, under a karst pillar.
   *   - The cells of the monastery sit on the north-west terrace; JahMan's home on the south terrace
   *     above the pad.
   *   - The castle steward waits by the carpet base beside the pad, with the chest of the castle.
   *   - The quests send the pilot across the whole planet: lens shards at the feet of the three
   *     northern pillars, a keystone on the floor of the dry canyon, two beacons — one on the ridge
   *     path, one on the eastern plateau.
   */
  opus: {
    id: "opus",
    town: null,
    houses: [
      { id: "sera", x: 44, z: -2, w: 8, d: 7, h: 3.45, door: "w" },
      { id: "home", x: 18, z: 44, w: 7.4, d: 6.6, h: 3.2, door: "w" },
      { id: "archive", x: -32, z: -18, w: 9, d: 7, h: 4.2, door: "e" },
      { id: "keeper", x: -40, z: 26, w: 7.2, d: 6.4, h: 3.15, door: "e" },
    ],
    npc: {
      sera: { x: 38.4, z: -2, yaw: -Math.PI / 2 },
      orr: { x: -26.1, z: -18, yaw: Math.PI / 2 },
      bulb: { x: -13.2, z: 34.6, yaw: Math.PI / 2 },
    },
    crystals: [{ x: -39.8, z: -32.6 }, { x: -16.3, z: -47.1 }, { x: 39.9, z: -39.9 }],
    key: { x: 17, z: -20 },
    braziers: [{ x: -22, z: 4 }, { x: 40, z: 16 }],
    chest: { x: -7, z: 32.6 },
    journal: { x: -34.2, z: -18 },
    letter: { x: 18.1, z: 44 },
    ring: { x: 28, z: -50 },
    jahman: { x: 17.35, z: 45.35, yaw: Math.PI / 2 },
    storyBox: { x: 20.05, z: 45.35 },
    tape: { x: 18.55, z: 42.4 },
    path: [
      // From the pad up the western terraces to the observatory.
      [-2, 30], [-6, 24], [-10, 18], [-14, 12], [-18, 6], [-21, 0], [-23, -6], [-24.5, -12],
      // From the pad across the canyon to the lens workshop.
      [4, 26], [9, 20], [14, 14], [19, 9], [24, 5], [29, 2], [34, 0],
      // To the cells on the north-west terrace.
      [-16, 22], [-22, 23], [-28, 24], [-33, 25],
    ],
    style: { wall: 0xe8decb, roof: 0x8f8574, floor: 0xd6cbb4, dome: "archive" },
  },
};

/** Which layout a planet builds. Fable (the start at ONI CSS) keeps the classic town. */
export function layoutFor(planet: unknown): Layout {
  const id = planetLook(planet).id as PlanetId;
  return id === "opus" ? LAYOUTS.opus : LAYOUTS.classic;
}

let applied: Layout | null = null;
/** The layout applied last (the scene reads its style and path). */
export function currentLayout(): Layout {
  return applied ?? LAYOUTS.classic;
}

const put = (target: Spot, from: Spot) => {
  target.x = from.x;
  target.z = from.z;
};

/**
 * Move every place of the island to the planet's layout. Call after setRelief (a house levels to the
 * ground of its own planet) and before the island is built and the sim reads a place.
 */
export function applyLayout(planet: unknown): Layout {
  const layout = layoutFor(planet);
  // Measure the bare ground under each house: no town and no other plot levels it yet.
  TOWN.on = false;
  HOUSES.splice(0, HOUSES.length);
  const houses = layout.houses.map((h) => ({ ...h, level: h.level ?? (layout.town ? undefined : groundY(h.x, h.z)) }));
  HOUSES.push(...houses);
  if (layout.town) {
    TOWN.on = true;
    TOWN.x = layout.town.x;
    TOWN.z = layout.town.z;
    TOWN.level = layout.town.level;
  }
  (["sera", "orr", "bulb"] as const).forEach((slot) => {
    put(NPC[slot], layout.npc[slot]);
    NPC[slot].yaw = layout.npc[slot].yaw;
  });
  CRYSTALS.forEach((c, i) => put(c, layout.crystals[i]));
  put(KEY_SPOT, layout.key);
  BRAZIERS.forEach((b, i) => put(b, layout.braziers[i]));
  put(CHEST, layout.chest);
  put(JOURNAL, layout.journal);
  put(LETTER, layout.letter);
  put(RING, layout.ring);
  put(JAHMAN, layout.jahman);
  JAHMAN.yaw = layout.jahman.yaw;
  put(STORY_BOX, layout.storyBox);
  const ded = TAPES.find((t) => t.id === "ded") as unknown as Spot | undefined;
  if (ded) put(ded, layout.tape);
  TOWN_PATH.splice(0, TOWN_PATH.length, ...layout.path);
  applied = layout;
  return layout;
}
