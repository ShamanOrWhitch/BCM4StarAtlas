export function smooth(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Must match the ground mesh. Props and feet sample this, not the raw curve. */
export const TERRAIN_SPAN = 168;
export const TERRAIN_N = 96;

/**
 * Which island the ground functions describe. The scene sets it from the
 * planet profile before it builds the ground and the sim; everything else
 * (feet, props, houses, quests) keeps sampling groundY as before.
 *   desert  — Pearce, Ioki (unchanged since 0.15.4)
 *   fable   — planet Fable: capes and coves, the Crescent ridge, Table hill,
 *             sea stacks. Town, pad, pond and bridge stand where they stood.
 *   twinsun — Twinsun (owner 23.11.2026: its own level, not the shared desert):
 *             wind-laid dune crests, three flat-topped mesas, a ragged coast.
 *   opus    — planet Opus (owner 23.11.2026, IDEA-026 step 1): limestone terraces,
 *             a forest of karst pillars to weave the ship between, a dry canyon in
 *             the east. Built for flight low over the ground.
 *   pearce  — Pearce (MUD CSS, owner 24.11.2026 "планета это всегда что-то разное"): green
 *             rolling hills, a lake country inland, a chain of islets off the coast.
 *   ioki    — Ioki (Ustur CSS): a rust crater field with raised rims and a rift.
 */
export type ReliefId = "desert" | "fable" | "twinsun" | "opus" | "pearce" | "ioki";
let relief: ReliefId = "desert";

export function setRelief(id: unknown) {
  relief = id === "fable" || id === "twinsun" || id === "opus" || id === "pearce" || id === "ioki" ? id : "desert";
}

export function getRelief(): ReliefId {
  return relief;
}

/** Island height. Sea is below about -0.5; the pad and town are flattened. */
export function groundY(x: number, z: number) {
  if (relief === "fable") return fableGroundY(x, z);
  if (relief === "twinsun") return twinsunGroundY(x, z);
  if (relief === "opus") return opusGroundY(x, z);
  if (relief === "pearce") return pearceGroundY(x, z);
  if (relief === "ioki") return iokiGroundY(x, z);
  return desertGroundY(x, z);
}

/** Pearce lakes (inland water) and islets (off the coast). Clear of every quest spot. */
export const PEARCE_LAKES: Array<{ x: number; z: number; rx: number; rz: number }> = [
  { x: -44, z: 6, rx: 8, rz: 5 },
  { x: 38, z: -8, rx: 6, rz: 9 },
  { x: -20, z: -46, rx: 7, rz: 4 },
];
export const PEARCE_ISLETS: Array<[number, number, number]> = [
  [70, 12, 2.4], [74, -6, 1.8], [66, -22, 2.2], [-70, -10, 2.0], [-66, 26, 2.6],
];

function pearceGroundY(x: number, z: number) {
  const r = Math.hypot(x, z);
  const t = Math.atan2(z, x);
  const coast = 0.98 + 0.06 * Math.sin(4 * t + 0.3) + 0.03 * Math.sin(9 * t);
  const inland = smooth(74 * coast, 52 * coast, r);
  const wild = 1 - Math.exp(-(x * x) / 400 - ((z - 14) ** 2) / 640);
  // Long green swells, softer and wider than the desert, with a second gentle harmonic.
  let h = 0.9;
  h += (Math.sin(x * 0.06 + 0.4) * Math.sin(z * 0.05 - 0.8) * 1.9 + 0.6) * wild;
  h += Math.sin(x * 0.13 + 1.7) * Math.cos(z * 0.11) * 0.45 * wild;
  const ridge = Math.exp(-((x + 32) ** 2) / 70 - ((z + 18) ** 2) / 150);
  h += ridge * 5.6;
  const oasis = Math.exp(-((x - 2.4) ** 2) / 48 - ((z + 17) ** 2) / 52);
  h -= oasis * 2.5;
  for (const l of PEARCE_LAKES) {
    const d = ((x - l.x) / l.rx) ** 2 + ((z - l.z) / l.rz) ** 2;
    h = lerp(h, -1.2, smooth(1.6, 0.8, d));
  }
  let y = lerp(-1.7, settle(h, x, z), inland);
  for (const [ix, iz, top] of PEARCE_ISLETS) {
    y = Math.max(y, -1.7 + Math.exp(-((x - ix) ** 2 + (z - iz) ** 2) / 26) * (top + 1.7));
  }
  return y;
}

/** Ioki craters: centre, radius of the rim, rim height. Clear of every quest spot. */
export const IOKI_CRATERS: Array<{ x: number; z: number; r: number; rim: number }> = [
  { x: -44, z: 8, r: 9, rim: 2.6 },
  { x: 40, z: -14, r: 8, rim: 2.2 },
  { x: -20, z: -48, r: 6, rim: 1.8 },
  { x: 34, z: 44, r: 6.5, rim: 2.0 },
  { x: -46, z: 34, r: 5, rim: 1.6 },
];

function iokiGroundY(x: number, z: number) {
  const r = Math.hypot(x, z);
  const t = Math.atan2(z, x);
  const coast = 1.02 + 0.08 * Math.sin(2 * t - 0.7);
  const inland = smooth(78 * coast, 58 * coast, r);
  const wild = 1 - Math.exp(-(x * x) / 380 - ((z - 14) ** 2) / 620);
  // Flat rust plains broken by a rift from north-east to south-west.
  let h = 1.0 + 0.35 * Math.sin(x * 0.09) * Math.cos(z * 0.08) * wild;
  const across = (x * 0.7 + z * 0.7) / Math.SQRT2 - 8;
  const alongRift = (x * 0.7 - z * 0.7) / Math.SQRT2;
  const rift = Math.exp(-(across * across) / 10) * smooth(56, 30, Math.abs(alongRift)) * wild;
  h -= rift * 1.4;
  const ridge = Math.exp(-((x + 32) ** 2) / 70 - ((z + 18) ** 2) / 150);
  h += ridge * 6.0;
  const oasis = Math.exp(-((x - 2.4) ** 2) / 48 - ((z + 17) ** 2) / 52);
  h -= oasis * 2.5;
  for (const c of IOKI_CRATERS) {
    const d = Math.hypot(x - c.x, z - c.z) / c.r;
    // Raised rim, a bowl inside, an ejecta skirt outside.
    const rim = Math.exp(-((d - 1) ** 2) / 0.03) * c.rim;
    const bowl = smooth(1, 0.2, d) * (c.rim * 0.8);
    const skirt = Math.exp(-((d - 1.5) ** 2) / 0.2) * 0.4;
    h += (rim - bowl + skirt) * wild;
  }
  return lerp(-1.7, settle(Math.max(0.15, h), x, z), inland);
}

/**
 * Opus karst pillars: centre, radius of the steep shaft, top height. Clear of the
 * town, the pad, the oasis, the crystal ridge, the key, the ring and the sky deck.
 */
export const OPUS_PILLARS: Array<{ x: number; z: number; r: number; top: number }> = [
  { x: -50, z: 4, r: 3.0, top: 13 },
  { x: -44, z: -36, r: 2.6, top: 11 },
  { x: -18, z: -52, r: 2.4, top: 10 },
  { x: 38, z: -12, r: 2.8, top: 14 },
  { x: 52, z: 8, r: 2.4, top: 12 },
  { x: 44, z: -44, r: 3.0, top: 15 },
  { x: -54, z: 30, r: 2.6, top: 11 },
  { x: 32, z: 52, r: 2.2, top: 9.5 },
  { x: -26, z: 46, r: 2.4, top: 10.5 },
];
/** The dry canyon in the east: its axis x for a given z, from z0 to z1. */
export const OPUS_CANYON = { z0: -34, z1: 18, x: (z: number) => 24 + 7 * Math.sin(z * 0.075), half: 3.2 };
/** The Opus base: a spark store beside the landing pad (IDEA-026 step 1). */
export const OPUS_BASE = { x: -7, z: 40, r: 6 };

function opusGroundY(x: number, z: number) {
  const r = Math.hypot(x, z);
  const t = Math.atan2(z, x);
  // A rounder, wider coast than the desert: limestone does not crumble into bays.
  const coast = 1.04 + 0.04 * Math.sin(3 * t + 2.1);
  const inland = smooth(80 * coast, 60 * coast, r);
  const wild = 1 - Math.exp(-(x * x) / 420 - ((z - 16) ** 2) / 700);
  // Broad swells cut into terraces: each step a flat shelf and a short limestone wall.
  let swell = 1.1 + 2.6 * (0.5 + 0.5 * Math.sin(x * 0.045 - 1.2) * Math.cos(z * 0.05 + 0.7))
    + 0.8 * Math.sin((x + z) * 0.03 + 0.4);
  swell = Math.max(0, swell);
  const STEP = 1.3;
  const k = Math.floor(swell / STEP);
  const terraced = k * STEP + STEP * smooth(0.72, 1, swell / STEP - k);
  let h = 0.7 + terraced * wild;
  const ridge = Math.exp(-((x + 32) ** 2) / 70 - ((z + 18) ** 2) / 150);
  h += ridge * 5.2;
  const oasis = Math.exp(-((x - 2.4) ** 2) / 48 - ((z + 17) ** 2) / 52);
  h -= oasis * 2.5;
  // The canyon: a dry gully with a level floor, deeper in the middle of its run.
  if (z > OPUS_CANYON.z0 - 8 && z < OPUS_CANYON.z1 + 8) {
    const along = smooth(OPUS_CANYON.z0 - 8, OPUS_CANYON.z0 + 4, z) * smooth(OPUS_CANYON.z1 + 8, OPUS_CANYON.z1 - 4, z);
    const d = Math.abs(x - OPUS_CANYON.x(z));
    const cut = smooth(OPUS_CANYON.half + 2.2, OPUS_CANYON.half, d) * along;
    h = lerp(h, 0.15, cut);
  }
  let y = lerp(-1.7, settle(h, x, z), inland);
  for (const p of OPUS_PILLARS) {
    const d = Math.hypot(x - p.x, z - p.z);
    // A steep shaft with a little skirt of scree at its foot.
    const shaft = smooth(p.r + 1.1, p.r, d);
    const skirt = smooth(p.r + 5, p.r + 1.1, d) * 1.4;
    y = Math.max(y, -1.7 + shaft * (p.top + 1.7) + skirt);
  }
  return y;
}

/** Twinsun's mesas: centre, flat-top radius, top height. Clear of every quest spot. */
export const TWINSUN_MESAS: Array<{ x: number; z: number; r: number; top: number }> = [
  { x: -42, z: 24, r: 7, top: 5.4 },
  { x: 40, z: -24, r: 6, top: 4.6 },
  { x: 37, z: 33, r: 5.5, top: 4.9 },
];

function twinsunGroundY(x: number, z: number) {
  const r = Math.hypot(x, z);
  const t = Math.atan2(z, x);
  // A ragged desert coast: two long bays and small headlands.
  const coast = 1 + 0.07 * Math.sin(2 * t + 0.6) + 0.04 * Math.sin(7 * t + 1.1);
  const inland = smooth(78 * coast, 56 * coast, r);
  // Dunes laid by a wind from the south-west: long asymmetric crests, calm by the town.
  const along = x * 0.78 - z * 0.62;
  const across = x * 0.62 + z * 0.78;
  const wave = Math.sin(across * 0.32 + Math.sin(along * 0.06) * 1.4);
  const crest = Math.pow(Math.max(0, wave), 1.8) * 2.0;
  const wild = 1 - Math.exp(-(x * x) / 380 - ((z - 14) ** 2) / 640);
  let h = 0.7;
  h += crest * wild;
  h += Math.sin(x * 0.08) * Math.cos(z * 0.07) * 0.55 * wild;
  // The crystal ridge stays where the crystals are.
  const ridge = Math.exp(-((x + 32) ** 2) / 70 - ((z + 18) ** 2) / 150);
  h += ridge * 6.2;
  const oasis = Math.exp(-((x - 2.4) ** 2) / 48 - ((z + 17) ** 2) / 52);
  h -= oasis * 2.5;
  // Mesas: a flat top and steep walls.
  for (const m of TWINSUN_MESAS) {
    const d = Math.hypot(x - m.x, z - m.z);
    h = lerp(h, Math.max(h, m.top), smooth(m.r + 2.6, m.r, d));
  }
  return lerp(-1.7, settle(h, x, z), inland);
}

export const FABLE_CRESCENT = { x: 34, z: -4, r: 15 };
export const FABLE_TABLE = { x: -34, z: 24 };
/** Sea stacks off the coves: x, z, height above the sea bed, spread. */
export const FABLE_STACKS: Array<[number, number, number, number]> = [
  [60, 35, 4.6, 44],
  [66, 27, 3.4, 16],
  [-60, 36, 4.2, 40],
  [-52, 46, 3.2, 14],
  [5, -67, 4.8, 42],
  [-6, -72, 3.3, 14],
];

function fableGroundY(x: number, z: number) {
  const r = Math.hypot(x, z);
  const t = Math.atan2(z, x);
  // Three capes (pad, crystal ridge, south-east) and three coves between them.
  const coast = Math.min(1.05, 0.92 - 0.12 * Math.sin(3 * t) - 0.05 * Math.sin(5 * t));
  const inland = smooth(76 * coast, 54 * coast, r);
  // Long mossy swells in the wild; the town and the pad keep level ground.
  const wild = 1 - Math.exp(-(x * x) / 520 - ((z - 20) ** 2) / 760);
  let h = 0.7;
  h += (Math.sin(x * 0.055 + 0.9) * Math.cos(z * 0.062 - 0.4) * 1.15 + 0.25) * wild;
  h += Math.sin(x * 0.16 - 0.7) * Math.sin(z * 0.19 + 1.1) * 0.32 * wild;
  const ridge = Math.exp(-((x + 32) ** 2) / 70 - ((z + 18) ** 2) / 150);
  h += ridge * 6.2;
  // The Crescent: an arc of rock east of the town, open towards it.
  const cx = x - FABLE_CRESCENT.x;
  const cz = z - FABLE_CRESCENT.z;
  const cd = Math.hypot(cx, cz);
  const arc = Math.exp(-((cd - FABLE_CRESCENT.r) ** 2) / 16) * smooth(-0.35, 0.45, cx / Math.max(1, cd));
  h += arc * 5.4;
  // Table hill: two mossy terraces in the north-west.
  const td = Math.hypot(x - FABLE_TABLE.x, z - FABLE_TABLE.z);
  h = lerp(h, Math.max(h, 1.7), smooth(17, 13.5, td));
  h = lerp(h, Math.max(h, 3.1), smooth(9.5, 7, td));
  const oasis = Math.exp(-((x - 2.4) ** 2) / 48 - ((z + 17) ** 2) / 52);
  h -= oasis * 2.5;
  let y = lerp(-1.7, settle(h, x, z), inland);
  for (const [sx, sz, height, spread] of FABLE_STACKS) {
    y = Math.max(y, -1.7 + Math.exp(-((x - sx) ** 2 + (z - sz) ** 2) / spread) * height);
  }
  return y;
}

function desertGroundY(x: number, z: number) {
  const r = Math.hypot(x, z);
  const inland = smooth(76, 54, r);
  let h = 0.7;
  h += Math.sin(x * 0.08) * Math.cos(z * 0.07) * 1.35;
  h += Math.sin(x * 0.21 + 1.3) * Math.sin(z * 0.17 + 0.6) * 0.4;
  const ridge = Math.exp(-((x + 32) ** 2) / 70 - ((z + 18) ** 2) / 150);
  h += ridge * 6.2;
  const oasis = Math.exp(-((x - 2.4) ** 2) / 48 - ((z + 17) ** 2) / 52);
  h -= oasis * 2.5;
  return lerp(-1.7, settle(h, x, z), inland);
}

/** Built places: the pad, the town, four house plots and the bridge heads. */
function settle(h: number, x: number, z: number) {
  const pad = Math.exp(-(x * x) / 55 - ((z - 38) ** 2) / 42);
  h = lerp(h, 0.48, Math.min(1, pad * 1.05));
  const town = Math.exp(-(x * x) / 280 - ((z - 8) ** 2) / 360);
  h = lerp(h, 0.58, Math.min(1, town * 0.8));
  const plots: Array<[number, number]> = [
    [-11, 17],
    [11, 15],
    [-12.2, -1.2],
    [13, -5.5],
  ];
  for (const [px, pz] of plots) {
    const disk = Math.exp(-((x - px) ** 2) / 26 - ((z - pz) ** 2) / 20);
    h = lerp(h, 0.74, Math.min(1, disk * 1.4));
  }
  if (Math.abs(x - 2.2) < 2.4 && z <= -8.4 && z >= -10.4) h = Math.max(h, 0.42);
  if (Math.abs(x - 2.2) < 2.4 && z <= -23.2 && z >= -26.2) h = Math.max(h, 0.42);
  return h;
}

/** Height of the rendered ground triangle, so a stone cannot hover over a coarse face. */
export function surfaceY(x: number, z: number) {
  const n = TERRAIN_N;
  const span = TERRAIN_SPAN;
  const fx = (x / span + 0.5) * n;
  const fz = (z / span + 0.5) * n;
  const ix = Math.max(0, Math.min(n - 1, Math.floor(fx)));
  const iz = Math.max(0, Math.min(n - 1, Math.floor(fz)));
  const tx = Math.min(1, Math.max(0, fx - ix));
  const tz = Math.min(1, Math.max(0, fz - iz));
  const sample = (i: number, j: number) => {
    const cx = Math.max(0, Math.min(n, i));
    const cz = Math.max(0, Math.min(n, j));
    return groundY((cx / n - 0.5) * span, (cz / n - 0.5) * span);
  };
  const y00 = sample(ix, iz);
  const y10 = sample(ix + 1, iz);
  const y01 = sample(ix, iz + 1);
  const y11 = sample(ix + 1, iz + 1);
  return (y00 * (1 - tx) + y10 * tx) * (1 - tz) + (y01 * (1 - tx) + y11 * tx) * tz;
}

/**
 * Lowest rendered ground under a rectangle (BUG-013). A prop seated on the
 * height at its centre hangs an edge in the air on a slope; seated here it
 * touches the ground everywhere and only its uphill side sinks in.
 */
export function lowestGround(minX: number, maxX: number, minZ: number, maxZ: number) {
  return groundSpan(minX, maxX, minZ, maxZ).low;
}

export function groundSpan(minX: number, maxX: number, minZ: number, maxZ: number) {
  const nx = Math.max(1, Math.min(8, Math.ceil((maxX - minX) / 1.2)));
  const nz = Math.max(1, Math.min(8, Math.ceil((maxZ - minZ) / 1.2)));
  let low = Infinity;
  let high = -Infinity;
  for (let i = 0; i <= nx; i += 1) {
    for (let j = 0; j <= nz; j += 1) {
      const y = surfaceY(minX + ((maxX - minX) * i) / nx, minZ + ((maxZ - minZ) * j) / nz);
      if (y < low) low = y;
      if (y > high) high = y;
    }
  }
  return { low, high };
}

/**
 * The nearest spot where a square footprint of the given half-size lies on
 * ground no rougher than maxRange. A wide ruin asked for on a peak is moved to
 * the foot of the slope instead of being buried or left hanging.
 */
export function levelSpot(
  x: number,
  z: number,
  half: number,
  maxRange: number,
  reach = 14,
  allowed: (x: number, z: number) => boolean = () => true,
) {
  // Ground under water counts as the waterline: a landmark on the shore is not on a slope.
  const rough = (px: number, pz: number) => {
    const span = groundSpan(px - half, px + half, pz - half, pz + half);
    return span.high - Math.max(span.low, -0.45);
  };
  let best = { x, z, range: rough(x, z) };
  if (best.range <= maxRange) return best;
  for (let ring = 2; ring <= reach; ring += 2) {
    let found: typeof best | null = null;
    for (let k = 0; k < 12; k += 1) {
      const a = (k / 12) * Math.PI * 2;
      const px = x + Math.cos(a) * ring;
      const pz = z + Math.sin(a) * ring;
      if (!allowed(px, pz) || surfaceY(px, pz) < -0.2) continue; // not into the sea
      const range = rough(px, pz);
      if (range < best.range) best = { x: px, z: pz, range };
      if (range <= maxRange && (!found || range < found.range)) found = { x: px, z: pz, range };
    }
    if (found) return found;
  }
  return best;
}

export const SKY = { x: 24, z: -36, y: 14.2, r: 5.2 };
export const BRIDGE = { x: 2.2, z0: -24.2, z1: -8.8, half: 0.85, deck: 0.42 };

export function onBridge(x: number, z: number) {
  return Math.abs(x - BRIDGE.x) < BRIDGE.half && z > BRIDGE.z0 && z < BRIDGE.z1;
}

export function onSky(x: number, z: number) {
  return (x - SKY.x) ** 2 + (z - SKY.z) ** 2 < SKY.r * SKY.r;
}

/** Feet height for walking. Sky deck only counts if you are already up there. */
export function footY(x: number, z: number, currentY: number) {
  let y = surfaceY(x, z);
  if (onBridge(x, z)) y = Math.max(y, BRIDGE.deck);
  if (onSky(x, z) && currentY > SKY.y - 2) y = Math.max(y, SKY.y);
  return y;
}

export function hoverFloor(x: number, z: number, currentY: number) {
  let y = surfaceY(x, z) + 0.82;
  if (onBridge(x, z)) y = Math.max(y, BRIDGE.deck + 0.82);
  if (onSky(x, z) && currentY > SKY.y - 2.2) y = Math.max(y, SKY.y + 0.82);
  return y;
}

export type House = {
  id: string;
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  door: "n" | "s" | "e" | "w";
};

export const HOUSES: House[] = [
  { id: "sera", x: -11, z: 17, w: 8, d: 7, h: 3.45, door: "e" },
  { id: "home", x: 11, z: 15, w: 7.4, d: 6.6, h: 3.2, door: "w" },
  { id: "archive", x: -12.2, z: -1.2, w: 9, d: 7, h: 3.7, door: "e" },
  { id: "keeper", x: 13, z: -5.5, w: 7.2, d: 6.4, h: 3.15, door: "w" },
];

export type Aabb = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
};

const WALL = 0.4;
const GAP = 1.7;

export function houseAabbs(house: House, blockDoor: boolean): Aabb[] {
  const y0 = groundY(house.x, house.z);
  const y1 = y0 + house.h;
  const wallTop = y1;
  const x0 = house.x - house.w / 2;
  const x1 = house.x + house.w / 2;
  const z0 = house.z - house.d / 2;
  const z1 = house.z + house.d / 2;
  const boxes: Aabb[] = [];
  const add = (minX: number, maxX: number, minZ: number, maxZ: number, minY = y0, maxY = wallTop) => {
    if (maxX - minX < 0.05 || maxZ - minZ < 0.05) return;
    boxes.push({ minX, maxX, minY, maxY, minZ, maxZ });
  };
  add(x0 - 0.35, x1 + 0.35, z0 - 0.35, z1 + 0.35, y1 + 0.04, y1 + 0.28);
  const splitX = (minX: number, maxX: number, minZ: number, maxZ: number, along: "z" | "x") => {
    if (blockDoor) {
      add(minX, maxX, minZ, maxZ);
      return;
    }
    if (along === "z") {
      const c = house.z;
      add(minX, maxX, minZ, c - GAP / 2);
      add(minX, maxX, c + GAP / 2, maxZ);
    } else {
      const c = house.x;
      add(minX, c - GAP / 2, minZ, maxZ);
      add(c + GAP / 2, maxX, minZ, maxZ);
    }
  };
  if (house.door === "w") splitX(x0, x0 + WALL, z0, z1, "z");
  else add(x0, x0 + WALL, z0, z1);
  if (house.door === "e") splitX(x1 - WALL, x1, z0, z1, "z");
  else add(x1 - WALL, x1, z0, z1);
  if (house.door === "s") splitX(x0, x1, z0, z0 + WALL, "x");
  else add(x0, x1, z0, z0 + WALL);
  if (house.door === "n") splitX(x0, x1, z1 - WALL, z1, "x");
  else add(x0, x1, z1 - WALL, z1);
  return boxes;
}

export const SPAWN = { x: 1.4, z: 39.2, yaw: 0 };
export const BIKE_PARK = { x: 4.9, z: 38.5, yaw: 0.05 };

export const CRYSTALS = [
  { x: -30.5, z: -13.5 },
  { x: -35.2, z: -20.4 },
  { x: -27.4, z: -23.6 },
];

export const KEY_SPOT = { x: 25.6, z: 30.8 };
export const BRAZIERS = [
  { x: 3.5, z: 8.2 },
  { x: 2.2, z: -14.2 },
];
export const CHEST = { x: 0.2, z: 4.6 };
export const JOURNAL = { x: -14.4, z: -1.2 };
export const LETTER = { x: 11.1, z: 15 };
export const RING = { x: 0.2, z: -42 };
// ONICSS/Tower portal on the shared arrival pad.
export const TOWER_GATE = { x: 0.4, z: 32.6, radius: 3.3 };
export const SKY_NOTE = { x: SKY.x, z: SKY.z };
// JahMan stands west of the story box and faces its screen (+X). The floor note is gone.
export const JAHMAN = { x: 10.35, z: 16.35, yaw: Math.PI / 2, name: "Джаман" };
export const STORY_BOX = { x: 13.05, z: 16.35 };

/** VHS cassettes. Each one is a different file on the tale site. */
export const TAPES = [
  {
    id: "ded",
    title: "Дед",
    x: 11.55,
    z: 13.4,
    source: "ground",
    url: "https://walkingyog.com/wp-content/uploads/2026/10/remaster-ded.mp4",
  },
  {
    id: "invaders10",
    title: "Invaders 10",
    x: null,
    z: null,
    source: "chest",
    url: "https://walkingyog.com/wp-content/uploads/2026/11/lq-Invaders.mp4",
  },
] as const;

export const NPC = {
  sera: { x: -5.7, z: 17, yaw: Math.PI / 2, name: "Сера Венн" },
  orr: { x: -6.4, z: -1.2, yaw: Math.PI / 2, name: "Орр-1" },
  bulb: { x: 4.6, z: 9.4, yaw: Math.PI, name: "Ламп" },
};

export function regionName(x: number, z: number, y: number) {
  if (onSky(x, z) && y > SKY.y - 1) return "Висячий остров";
  if (relief === "fable") return fableRegionName(x, z);
  if (relief === "opus") return opusRegionName(x, z);
  if (relief === "pearce") {
    for (const l of PEARCE_LAKES) if (((x - l.x) / l.rx) ** 2 + ((z - l.z) / l.rz) ** 2 < 2.4) return "Озёрный край";
    if (Math.hypot(x, z) > 62) return "Островная гряда";
  }
  if (relief === "ioki") {
    for (const c of IOKI_CRATERS) if (Math.hypot(x - c.x, z - c.z) < c.r * 1.4) return "Кратерное поле";
  }
  if (relief === "twinsun") {
    for (const m of TWINSUN_MESAS) if (Math.hypot(x - m.x, z - m.z) < m.r + 3) return "Плато близнецов";
  }
  if (Math.hypot(x - 2.4, z + 17) < 9) return "Оазис";
  if (x < -22 && z < -6) return "Кристальная гряда";
  if (z > 30 && Math.abs(x) < 14) return "Посадочная";
  if (Math.hypot(x - JAHMAN.x, z - JAHMAN.z) < 5) return "Дом Джамана";
  if (Math.abs(x) < 18 && z > -10 && z < 26) return "Дюнный посад";
  if (Math.hypot(x - RING.x, z - RING.z) < 8) return "Северное кольцо";
  return "Дюны";
}

function opusRegionName(x: number, z: number) {
  for (const p of OPUS_PILLARS) if (Math.hypot(x - p.x, z - p.z) < p.r + 7) return "Карстовый лес";
  if (Math.hypot(x - OPUS_BASE.x, z - OPUS_BASE.z) < OPUS_BASE.r + 1) return "Накопитель";
  if (z > OPUS_CANYON.z0 && z < OPUS_CANYON.z1 && Math.abs(x - OPUS_CANYON.x(z)) < OPUS_CANYON.half + 3) return "Сухой каньон";
  if (Math.hypot(x - 2.4, z + 17) < 9) return "Оазис";
  if (x < -22 && z < -6) return "Кристальная гряда";
  if (z > 30 && Math.abs(x) < 14) return "Посадочная";
  if (Math.hypot(x - JAHMAN.x, z - JAHMAN.z) < 5) return "Дом Джамана";
  if (Math.abs(x) < 18 && z > -10 && z < 26) return "Известняковый посад";
  if (Math.hypot(x - RING.x, z - RING.z) < 8) return "Северное кольцо";
  return "Известняковые террасы";
}

function fableRegionName(x: number, z: number) {
  if (Math.hypot(x - 2.4, z + 17) < 9) return "Зеркальный пруд";
  if (x < -22 && z < -6) return "Кристальная гряда";
  if (z > 30 && Math.abs(x) < 14) return "Посадочная";
  if (Math.hypot(x - JAHMAN.x, z - JAHMAN.z) < 5) return "Дом Джамана";
  if (Math.abs(x) < 18 && z > -10 && z < 26) return "Мшистый посад";
  if (Math.hypot(x - RING.x, z - RING.z) < 8) return "Северное кольцо";
  const cd = Math.hypot(x - FABLE_CRESCENT.x, z - FABLE_CRESCENT.z);
  if (Math.abs(cd - FABLE_CRESCENT.r) < 6 && x > FABLE_CRESCENT.x - 6) return "Полумесяц";
  if (cd < FABLE_CRESCENT.r - 6) return "Чаша Полумесяца";
  if (Math.hypot(x - FABLE_TABLE.x, z - FABLE_TABLE.z) < 15) return "Столовый холм";
  for (const [sx, sz] of FABLE_STACKS) if (Math.hypot(x - sx, z - sz) < 9) return "Морские столбы";
  return "Мшистые холмы";
}
