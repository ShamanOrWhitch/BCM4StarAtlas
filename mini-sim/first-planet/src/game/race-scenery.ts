// Race scenery per First Planet planet, after the owner's concept sheets in
// art/race-kits (19.11.2026): Twinsun desert, Fable lava, Opus ice; Galia without
// a planet keeps the coast. Pure data and placement, no THREE: world.ts builds the
// props from simple geometry until Dr Arena's GLB stand in the same spots.
import { createSeededRandom } from "./seed";
import type { Track } from "./track";

export type SceneryId = "coast" | "desert" | "lava" | "ice";
export type PropKind =
  | "palm" | "rock" | "buoy"
  | "pyramid" | "obelisk" | "cactus" | "dune"
  | "spire" | "vent" | "deadtree"
  | "pine" | "crystal" | "snow";

/** Colours are sRGB hex; road colours are sRGB 0..1 triples. */
export type RaceScenery = {
  id: SceneryId;
  /** The concept sheet this look follows (repository path). */
  sheet: string;
  /** Sky gradient: top, middle, horizon. */
  sky: [number, number, number];
  fog: number;
  hemi: [number, number];
  sun: number;
  /** The plane around the island (sea, dunes, lava lake, ice). */
  water: number;
  waterGlow: number;
  ground: number;
  island: number;
  grass: number;
  tower: [number, number];
  road: { surface: [number, number, number]; kerb: [number, number, number]; line: [number, number, number] };
  rails: [number, number];
  /** The coast red-white barrier models only suit the coast and the desert. */
  barriers: boolean;
  arch: { post: number; beam: number; flame: boolean };
  props: { kind: PropKind; weight: number; color: number; glow?: number }[];
};

const SCENERY: Record<SceneryId, RaceScenery> = {
  coast: {
    id: "coast",
    sheet: "art/race-kits/coast.webp",
    sky: [0x3d245c, 0xff7a3a, 0xffc48a],
    fog: 0xe56a3a,
    hemi: [0xffc4a0, 0x7a3a32],
    sun: 0xffb15a,
    water: 0x14748c,
    waterGlow: 0x000000,
    ground: 0xe6d3a3,
    island: 0xd2c09a,
    grass: 0x6f9a5c,
    tower: [0xd2c2a4, 0xe25b3a],
    road: { surface: [0.23, 0.25, 0.29], kerb: [0.89, 0.36, 0.23], line: [0.96, 0.82, 0.3] },
    rails: [0xf4efe4, 0xc4493a],
    barriers: true,
    arch: { post: 0xf4efe4, beam: 0xe4a322, flame: false },
    props: [
      { kind: "palm", weight: 5, color: 0x3f7d45 },
      { kind: "rock", weight: 3, color: 0x8d8478 },
      { kind: "buoy", weight: 2, color: 0xc4493a },
    ],
  },
  desert: {
    id: "desert",
    sheet: "art/race-kits/desert.webp",
    sky: [0x7a4a2a, 0xf0a04a, 0xffe0a0],
    fog: 0xe8b070,
    hemi: [0xffe2b0, 0x8a5a2a],
    sun: 0xffd08a,
    water: 0xd9a55a,
    waterGlow: 0x000000,
    ground: 0xe8c47a,
    island: 0xc89a5a,
    grass: 0x2fa39a,
    tower: [0xd8b47a, 0x2f8f8a],
    road: { surface: [0.62, 0.42, 0.22], kerb: [0.72, 0.3, 0.16], line: [0.98, 0.9, 0.7] },
    rails: [0xc98a4a, 0x2f8f8a],
    barriers: false,
    arch: { post: 0xb8864a, beam: 0x2f8f8a, flame: false },
    props: [
      { kind: "pyramid", weight: 2, color: 0xd8b067 },
      { kind: "obelisk", weight: 3, color: 0xc89a5a },
      { kind: "cactus", weight: 4, color: 0x5f9a3a },
      { kind: "dune", weight: 3, color: 0xd99a4a },
    ],
  },
  lava: {
    id: "lava",
    sheet: "art/race-kits/lava.webp",
    sky: [0x120a14, 0x4a1a1a, 0xb0401a],
    fog: 0x3a1410,
    hemi: [0xff8a5a, 0x2a1010],
    sun: 0xff7a3a,
    water: 0x5a1606,
    waterGlow: 0xff4a10,
    ground: 0x2e2622,
    island: 0x3a302a,
    grass: 0x1e1a18,
    tower: [0x3a3432, 0xb8862a],
    road: { surface: [0.17, 0.14, 0.13], kerb: [0.95, 0.42, 0.12], line: [1.0, 0.62, 0.18] },
    rails: [0x2a2422, 0xff6a1a],
    barriers: false,
    arch: { post: 0x2e2826, beam: 0xb8862a, flame: true },
    props: [
      { kind: "spire", weight: 5, color: 0x231d1b, glow: 0xff5a14 },
      { kind: "vent", weight: 3, color: 0x2b2320, glow: 0xff7a1a },
      { kind: "deadtree", weight: 2, color: 0x1a1412 },
      { kind: "rock", weight: 2, color: 0x3a2e28 },
    ],
  },
  ice: {
    id: "ice",
    sheet: "art/race-kits/ice.webp",
    sky: [0x1a2a5a, 0x6a8ad0, 0xd8ecff],
    fog: 0xb8d4f0,
    hemi: [0xe8f4ff, 0x5a7aa0],
    sun: 0xf0f8ff,
    water: 0x9cc8e8,
    waterGlow: 0x000000,
    ground: 0xeef6ff,
    island: 0xc8e0f4,
    grass: 0xf6fbff,
    tower: [0xd8ecfa, 0x3a6ab0],
    road: { surface: [0.55, 0.72, 0.88], kerb: [0.95, 0.98, 1.0], line: [0.25, 0.45, 0.8] },
    rails: [0xf4fbff, 0x4a7ac8],
    barriers: false,
    arch: { post: 0x9cc8ec, beam: 0x3a6ab0, flame: false },
    props: [
      { kind: "pine", weight: 5, color: 0x2f5a4a },
      { kind: "crystal", weight: 3, color: 0x8fd0ff, glow: 0x5ab8ff },
      { kind: "snow", weight: 3, color: 0xf6fbff },
    ],
  },
};

const BY_PLANET: Record<string, SceneryId> = { first: "desert", fable: "lava", opus: "ice" };

export function raceSceneryFor(planet?: string): RaceScenery {
  return SCENERY[(planet && BY_PLANET[planet]) || "coast"];
}

export type SceneryProp = { kind: PropKind; x: number; z: number; scale: number; turn: number };

/** Props along both sides of the road and in a ring round the island; none on the road. */
export function sceneryProps(track: Track, look: RaceScenery, seed = 0): SceneryProp[] {
  const random = createSeededRandom(Number(seed) >>> 0, "shoal-race-scenery-" + look.id);
  const total = look.props.reduce((sum, p) => sum + p.weight, 0);
  const pick = () => {
    let r = random() * total;
    for (const p of look.props) {
      r -= p.weight;
      if (r <= 0) return p.kind;
    }
    return look.props[0].kind;
  };
  const clearOf = (x: number, z: number, room: number) => {
    for (const s of track.samples) if ((s.x - x) ** 2 + (s.z - z) ** 2 < room * room) return false;
    return true;
  };
  const out: SceneryProp[] = [];
  const place = (x: number, z: number) => {
    const kind = pick();
    const scale = 0.8 + random() * 0.7;
    // A prop's footprint is about its scale in metres, plus a margin past the road edge.
    if (!clearOf(x, z, track.halfWidth + 2.6 + scale)) return;
    out.push({ kind, x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100, scale: Math.round(scale * 100) / 100, turn: Math.round(random() * 628) / 100 });
  };
  const along = 30;
  for (let i = 0; i < along; i++) {
    const s = track.samples[Math.floor((i / along) * track.samples.length) % track.samples.length];
    const side = i % 2 === 0 ? 1 : -1;
    const reach = track.halfWidth + 6 + random() * 12;
    place(s.x + s.nx * side * reach, s.z + s.nz * side * reach);
  }
  for (let a = 0; a < 16; a++) {
    const ang = (a / 16) * Math.PI * 2 + random() * 0.2;
    const r = 52 + random() * 10;
    place(Math.cos(ang) * r, Math.sin(ang) * r);
  }
  return out;
}
