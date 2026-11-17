/**
 * The look of a race road, read from a track piece in mini-sim/assets/mesh
 * (coast_straight.glb, desert_straight.glb, ice_straight.glb).
 *
 * Owner 16.11.2026: "текстуры трассы не подключены, хотя они там есть, ищи в
 * mesh". The pieces are 2 m wide tiles with the colours in their vertices: a
 * slab (the road surface), two kerbs on its edges and, on the coast piece, a
 * dashed centre line. The race track is a free curve, so the tiles cannot be
 * laid end to end; instead their colours and proportions are carried onto the
 * curve. Everything is measured in road widths, so the look scales with the
 * track.
 *
 * Pure data and maths: no THREE, no DOM, so node --test can run it.
 */
export type Rgb = [number, number, number];

export type TrackSkin = {
  surface: Rgb;
  kerb: Rgb;
  /** Centre line colour, or null when the piece has none (desert, ice). */
  line: Rgb | null;
  /** In road widths. */
  kerbWidth: number;
  kerbHeight: number;
  lineHalfWidth: number;
  dashLength: number;
  dashPeriod: number;
};

type Group = { color: Rgb; min: number[]; max: number[]; count: number; points: number[][] };

/** position: xyz per vertex. color: colorSize (3 or 4) values per vertex, 0..1. */
export function readTrackSkin(position: ArrayLike<number>, color: ArrayLike<number>, colorSize = 3): TrackSkin {
  const count = Math.floor(position.length / 3);
  const groups = new Map<string, Group>();
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < count; i += 1) {
    const p = [position[i * 3], position[i * 3 + 1], position[i * 3 + 2]];
    const c: Rgb = [color[i * colorSize], color[i * colorSize + 1], color[i * colorSize + 2]];
    const key = c.map((v) => Math.round(v * 255)).join(",");
    let group = groups.get(key);
    if (!group) {
      group = { color: c, min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity], count: 0, points: [] };
      groups.set(key, group);
    }
    group.count += 1;
    group.points.push(p);
    for (let k = 0; k < 3; k += 1) {
      group.min[k] = Math.min(group.min[k], p[k]);
      group.max[k] = Math.max(group.max[k], p[k]);
      lo[k] = Math.min(lo[k], p[k]);
      hi[k] = Math.max(hi[k], p[k]);
    }
  }
  if (!groups.size) throw new Error("track piece has no vertices");
  // The piece's own axes: longest = along the road, shortest = up, the third = across.
  const size = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
  const order = [0, 1, 2].sort((a, b) => size[b] - size[a]);
  const [along, across, up] = order;
  const width = size[across] || 1;
  const centre = (lo[across] + hi[across]) / 2;
  const list = [...groups.values()];
  // The slab reaches the bottom of the piece; the kerb is the highest part.
  const slab = list.reduce((best, g) => (g.min[up] < best.min[up] - 1e-6 ? g : best), list[0]);
  const rest = list.filter((g) => g !== slab);
  const kerb = rest.length ? rest.reduce((best, g) => (g.max[up] > best.max[up] ? g : best), rest[0]) : slab;
  const lineGroup = rest.find((g) => g !== kerb && Math.max(Math.abs(g.min[across] - centre), Math.abs(g.max[across] - centre)) < width * 0.15) ?? null;
  const top = slab.max[up];
  const inner = Math.min(...kerb.points.map((p) => Math.abs(p[across] - centre)));
  let dashLength = 0;
  let dashPeriod = 0;
  if (lineGroup) {
    const marks = [...new Set(lineGroup.points.map((p) => Math.round(p[along] * 1000) / 1000))].sort((a, b) => a - b);
    const dashes: Array<[number, number]> = [];
    for (let i = 0; i + 1 < marks.length; i += 2) dashes.push([marks[i], marks[i + 1]]);
    if (dashes.length) {
      dashLength = dashes.reduce((sum, d) => sum + (d[1] - d[0]), 0) / dashes.length / width;
      dashPeriod = (size[along] || 1) / dashes.length / width;
    }
  }
  return {
    surface: slab.color,
    kerb: kerb.color,
    line: lineGroup && dashLength > 0 ? lineGroup.color : null,
    kerbWidth: kerb === slab ? 0 : (width / 2 - inner) / width,
    kerbHeight: kerb === slab ? 0 : (kerb.max[up] - top) / width,
    lineHalfWidth: lineGroup ? Math.max(Math.abs(lineGroup.min[across] - centre), Math.abs(lineGroup.max[across] - centre)) / width : 0,
    dashLength,
    dashPeriod,
  };
}

export type RoadSample = { x: number; z: number; nx: number; nz: number; s: number };
export type RoadTrack = { samples: RoadSample[]; length: number; halfWidth: number };
export type RoadMesh = { position: Float32Array; color: Float32Array; index: number[] };

/**
 * Turn every flat triangle in a range so that it faces up. The track normal is
 * the tangent turned left, which winds a left-to-right strip face down: seen
 * from above (the only way a road is seen) it was culled, and the race showed
 * bare sand where the road is.
 */
export function faceUp(position: ArrayLike<number>, index: number[], start = 0, end = index.length) {
  for (let t = start; t + 2 < end; t += 3) {
    const a = index[t] * 3;
    const b = index[t + 1] * 3;
    const c = index[t + 2] * 3;
    const ny =
      (position[b + 2] - position[a + 2]) * (position[c] - position[a]) -
      (position[b] - position[a]) * (position[c + 2] - position[a + 2]);
    if (ny < 0) {
      index[t + 1] = c / 3;
      index[t + 2] = b / 3;
    }
  }
}

/** A kerb taller than this reads as a wall on a 13 m road; the proportion is kept below it. */
const KERB_MAX = 0.24;

/**
 * The race road in the look of a track piece: the surface strip, a raised kerb
 * inside each edge and centre dashes, as one vertex-coloured mesh.
 * paintSurface may recolour the surface at a distance s (the start line).
 */
export function skinnedRoad(
  track: RoadTrack,
  skin: TrackSkin,
  y: number,
  paintSurface?: (s: number) => Rgb | null,
): RoadMesh {
  const pos: number[] = [];
  const col: number[] = [];
  const index: number[] = [];
  const n = track.samples.length;
  const roadWidth = track.halfWidth * 2;
  const push = (x: number, py: number, z: number, c: Rgb) => {
    pos.push(x, py, z);
    col.push(c[0], c[1], c[2]);
    return pos.length / 3 - 1;
  };
  /**
   * A closed strip between two offsets from the centre line, at two heights.
   * A flat strip faces up; a wall (both edges at one offset) faces the centre line.
   */
  const strip = (left: number, right: number, yLeft: number, yRight: number, paint: (s: number) => Rgb) => {
    const first = pos.length / 3;
    const firstIndex = index.length;
    for (let i = 0; i < n; i += 1) {
      const sample = track.samples[i];
      const c = paint(sample.s);
      push(sample.x + sample.nx * left, yLeft, sample.z + sample.nz * left, c);
      push(sample.x + sample.nx * right, yRight, sample.z + sample.nz * right, c);
    }
    for (let i = 0; i < n; i += 1) {
      const a = first + i * 2;
      const c = first + ((i + 1) % n) * 2;
      index.push(a, c, a + 1, a + 1, c, c + 1);
    }
    if (yLeft === yRight) {
      faceUp(pos, index, firstIndex);
      return;
    }
    // Wall: its normal must point from the wall towards the centre line.
    for (let t = firstIndex; t + 2 < index.length; t += 3) {
      const a = index[t] * 3;
      const b = index[t + 1] * 3;
      const c = index[t + 2] * 3;
      const e1 = [pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]];
      const e2 = [pos[c] - pos[a], pos[c + 1] - pos[a + 1], pos[c + 2] - pos[a + 2]];
      const nx = e1[1] * e2[2] - e1[2] * e2[1];
      const nz = e1[0] * e2[1] - e1[1] * e2[0];
      const sample = track.samples[Math.floor((index[t] - first) / 2) % n];
      const inward = (sample.x - pos[a]) * nx + (sample.z - pos[a + 2]) * nz;
      if (inward < 0) {
        index[t + 1] = c / 3;
        index[t + 2] = b / 3;
      }
    }
  };
  const kerbWidth = skin.kerbWidth * roadWidth;
  const kerbHeight = Math.min(KERB_MAX, skin.kerbHeight * roadWidth);
  const edge = track.halfWidth;
  strip(-edge, edge, y, y, (s) => paintSurface?.(s) ?? skin.surface);
  if (kerbWidth > 0 && kerbHeight > 0) {
    for (const side of [-1, 1]) {
      const outer = side * edge;
      const inner = side * (edge - kerbWidth);
      // Top, then the inner face down to the road, so the kerb reads as a solid edge.
      strip(Math.min(inner, outer), Math.max(inner, outer), y + kerbHeight, y + kerbHeight, () => skin.kerb);
      strip(inner, inner, side < 0 ? y + kerbHeight : y, side < 0 ? y : y + kerbHeight, () => skin.kerb);
    }
  }
  if (skin.line && skin.dashPeriod > 0 && skin.dashLength > 0) {
    const period = skin.dashPeriod * roadWidth;
    const length = skin.dashLength * roadWidth;
    const half = Math.max(0.09, skin.lineHalfWidth * roadWidth);
    const dashes = Math.max(1, Math.round(track.length / period));
    const step = track.length / dashes; // whole dashes: no half dash at the lap seam
    const at = pointAt(track);
    const lift = y + 0.03;
    for (let d = 0; d < dashes; d += 1) {
      const s0 = d * step;
      const parts = Math.max(3, Math.ceil(length / 1.5));
      const first = pos.length / 3;
      for (let k = 0; k <= parts; k += 1) {
        const p = at(s0 + (length * k) / parts);
        push(p.x - p.nx * half, lift, p.z - p.nz * half, skin.line);
        push(p.x + p.nx * half, lift, p.z + p.nz * half, skin.line);
      }
      const firstIndex = index.length;
      for (let k = 0; k < parts; k += 1) {
        const a = first + k * 2;
        index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
      faceUp(pos, index, firstIndex);
    }
  }
  return { position: new Float32Array(pos), color: new Float32Array(col), index };
}

/** Point and normal of the centre line at a distance s along the closed track. */
function pointAt(track: RoadTrack) {
  const samples = track.samples;
  const n = samples.length;
  return (distance: number) => {
    const s = ((distance % track.length) + track.length) % track.length;
    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (samples[mid].s <= s) lo = mid;
      else hi = mid - 1;
    }
    const a = samples[lo];
    const b = samples[(lo + 1) % n];
    const span = (lo + 1 < n ? b.s : track.length) - a.s || 1;
    const t = Math.min(1, Math.max(0, (s - a.s) / span));
    const nx = a.nx + (b.nx - a.nx) * t;
    const nz = a.nz + (b.nz - a.nz) * t;
    const nl = Math.hypot(nx, nz) || 1;
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, nx: nx / nl, nz: nz / nl };
  };
}
