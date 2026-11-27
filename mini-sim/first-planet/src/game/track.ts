export type Sample = {
  x: number;
  z: number;
  tx: number;
  tz: number;
  nx: number;
  nz: number;
  s: number;
  curvature: number;
};

export type Track = {
  seed: number;
  samples: Sample[];
  length: number;
  halfWidth: number;
  checkpoints: number[];
};

export const ROAD_Y = 1.52;

const RAW: [number, number][] = [
  [8, 100],
  [48, 104],
  [86, 78],
  [108, 36],
  [104, -8],
  [82, -46],
  [46, -72],
  [22, -64],
  [4, -92],
  [-40, -100],
  [-82, -74],
  [-108, -28],
  [-104, 18],
  [-78, 62],
  [-36, 92],
];

function cr(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

function densify(raw: [number, number][]) {
  const n = raw.length;
  const pts: { x: number; z: number }[] = [];
  const steps = 10;
  for (let i = 0; i < n; i++) {
    const p0 = raw[(i - 1 + n) % n];
    const p1 = raw[i];
    const p2 = raw[(i + 1) % n];
    const p3 = raw[(i + 2) % n];
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      pts.push({
        x: cr(p0[0], p1[0], p2[0], p3[0], t),
        z: cr(p0[1], p1[1], p2[1], p3[1], t),
      });
    }
  }
  return pts;
}

function resample(pts: { x: number; z: number }[], spacing: number) {
  const cum = [0];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    cum.push(cum[cum.length - 1] + Math.hypot(b.x - a.x, b.z - a.z));
  }
  const length = cum[cum.length - 1];
  const count = Math.max(16, Math.round(length / spacing));
  const out: { x: number; z: number }[] = [];
  for (let k = 0; k < count; k++) {
    const target = (k / count) * length;
    let i = 0;
    while (i < pts.length - 1 && cum[i + 1] < target) i++;
    const span = cum[i + 1] - cum[i] || 1;
    const t = (target - cum[i]) / span;
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
  }
  return { pts: out, length };
}

function mixSeed(seed: number, planet: string, level: number) {
  let h = (seed >>> 0) ^ 0x9e3779b9;
  const tag = planet + "#" + level;
  for (let i = 0; i < tag.length; i++) h = Math.imul(h ^ tag.charCodeAt(i), 16777619);
  return (h >>> 0) || 1;
}

type Family = {
  lobes: number;
  lobeSpan: number;
  base: number;
  baseSpan: number;
  amp: number;
  ampSpan: number;
  squash: number;
  squashSpan: number;
  harmonic: number;
};

// Closed laps stay a positive radius, so a seed cannot cross itself.
// The numbers are the character of the place, not a copied circuit.
const FAMILIES: Record<string, Family> = {
  first: { lobes: 3, lobeSpan: 2, base: 102, baseSpan: 16, amp: 18, ampSpan: 12, squash: 0.7, squashSpan: 0.12, harmonic: 0.28 },
  fable: { lobes: 7, lobeSpan: 2, base: 68, baseSpan: 10, amp: 16, ampSpan: 10, squash: 0.92, squashSpan: 0.06, harmonic: 0.72 },
  opus: { lobes: 8, lobeSpan: 2, base: 64, baseSpan: 8, amp: 12, ampSpan: 8, squash: 0.5, squashSpan: 0.08, harmonic: 0.9 },
  coast: { lobes: 5, lobeSpan: 2, base: 84, baseSpan: 12, amp: 8, ampSpan: 8, squash: 0.86, squashSpan: 0.08, harmonic: 0.22 },
};

function familyFor(planet?: string): Family {
  if (planet === "fable" || planet === "opus" || planet === "first") return FAMILIES[planet];
  return FAMILIES.coast;
}

function controlPoints(seed: number, planet?: string, level = 1): [number, number][] {
  const nSeed = Number(seed) >>> 0;
  if (!nSeed && !planet) return RAW;
  const lv = Math.min(3, Math.max(1, Math.floor(Number(level)) || 1));
  const family = familyFor(planet);
  let state = mixSeed(nSeed, planet || "coast", lv);
  const rand = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const lobes = family.lobes + Math.floor(rand() * (family.lobeSpan + 1)) + (lv - 1);
  const base = family.base + rand() * family.baseSpan + (lv - 1) * 4;
  const amp = (family.amp + rand() * family.ampSpan) * (1 + (lv - 1) * 0.18);
  const phase = rand() * Math.PI * 2;
  const phase2 = rand() * Math.PI * 2;
  const squash = family.squash + rand() * family.squashSpan;
  const harmonic = family.harmonic * (1 + (lv - 1) * 0.35);
  const pinch = (lv - 1) * (0.1 + rand() * 0.08);
  const pinchAt = rand() * Math.PI * 2;
  const count = 18;
  const pts: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    let delta = Math.abs(angle - pinchAt);
    if (delta > Math.PI) delta = Math.PI * 2 - delta;
    const pinchMul = 1 - pinch * Math.exp(-(delta * delta) / 0.2);
    const rawWave =
      Math.sin(angle * lobes + phase) * amp +
      Math.sin(angle * (lobes + 3) + phase2) * amp * harmonic;
    const wave = Math.max(-base * 0.42, Math.min(base * 0.42, rawWave));
    const radius = Math.max(40, (base + wave) * pinchMul);
    pts.push([Math.cos(angle) * radius, Math.sin(angle) * radius * squash]);
  }
  return pts;
}

export function buildTrack(seed = 0, planet?: string, level = 1): Track {
  const nSeed = Number(seed) >>> 0;
  const lv = Math.min(3, Math.max(1, Math.floor(Number(level)) || 1));
  const dense = densify(controlPoints(nSeed, planet, lv));
  const { pts, length } = resample(dense, 2.4);
  const n = pts.length;
  const samples: Sample[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n];
    const b = pts[(i + 1) % n];
    let tx = b.x - a.x;
    let tz = b.z - a.z;
    const mag = Math.hypot(tx, tz) || 1;
    tx /= mag;
    tz /= mag;
    samples.push({
      x: pts[i].x,
      z: pts[i].z,
      tx,
      tz,
      nx: -tz,
      nz: tx,
      s: (i / n) * length,
      curvature: 0,
    });
  }
  const spacing = length / n;
  for (let i = 0; i < n; i++) {
    const prev = samples[(i - 1 + n) % n];
    const next = samples[(i + 1) % n];
    const dot = Math.min(1, Math.max(-1, prev.tx * next.tx + prev.tz * next.tz));
    samples[i].curvature = Math.acos(dot) / (spacing * 2);
  }
  const gates = 8;
  const checkpoints = Array.from({ length: gates }, (_, i) => (i / gates) * length);
  return { seed: nSeed, samples, length, halfWidth: 7.4, checkpoints };
}

export function sampleAt(track: Track, s: number): Sample {
  const n = track.samples.length;
  let u = (s / track.length) * n;
  u = ((u % n) + n) % n;
  const i = Math.floor(u) % n;
  const t = u - Math.floor(u);
  const a = track.samples[i];
  const b = track.samples[(i + 1) % n];
  const lerp = (p: number, q: number) => p + (q - p) * t;
  let tx = lerp(a.tx, b.tx);
  let tz = lerp(a.tz, b.tz);
  const mag = Math.hypot(tx, tz) || 1;
  tx /= mag;
  tz /= mag;
  return {
    x: lerp(a.x, b.x),
    z: lerp(a.z, b.z),
    tx,
    tz,
    nx: -tz,
    nz: tx,
    s: ((s % track.length) + track.length) % track.length,
    curvature: lerp(a.curvature, b.curvature),
  };
}

export type Projection = {
  s: number;
  lat: number;
  nx: number;
  nz: number;
  x: number;
  z: number;
  index: number;
  tx: number;
  tz: number;
};

export function project(track: Track, x: number, z: number, hint: number): Projection {
  const samples = track.samples;
  const n = samples.length;
  let best = ((hint % n) + n) % n;
  let bestD = Infinity;
  const span = 24;
  for (let k = -span; k <= span; k++) {
    const i = (best + k + n) % n;
    const s = samples[i];
    const d = (x - s.x) ** 2 + (z - s.z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  if (bestD > 50 * 50) {
    for (let i = 0; i < n; i++) {
      const s = samples[i];
      const d = (x - s.x) ** 2 + (z - s.z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
  }
  const a = samples[best];
  const b = samples[(best + 1) % n];
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const ab2 = abx * abx + abz * abz || 1;
  const t = Math.min(1, Math.max(0, ((x - a.x) * abx + (z - a.z) * abz) / ab2));
  const px = a.x + abx * t;
  const pz = a.z + abz * t;
  const lat = (x - px) * a.nx + (z - pz) * a.nz;
  const seg = Math.hypot(abx, abz);
  let s = a.s + seg * t;
  if (s >= track.length) s -= track.length;
  return { s, lat, nx: a.nx, nz: a.nz, x: px, z: pz, index: best, tx: a.tx, tz: a.tz };
}

export function yawFromTangent(tx: number, tz: number) {
  return Math.atan2(-tx, -tz);
}

export function forwardDelta(prev: number, curr: number, length: number) {
  let d = curr - prev;
  if (d > length / 2) d -= length;
  if (d < -length / 2) d += length;
  return d;
}

export function crossedForward(prev: number, curr: number, gate: number, length: number) {
  const d = forwardDelta(prev, curr, length);
  if (d <= 0.001 || d > length * 0.25) return false;
  let rel = gate - prev;
  rel = ((rel % length) + length) % length;
  return rel <= d + 0.04;
}
