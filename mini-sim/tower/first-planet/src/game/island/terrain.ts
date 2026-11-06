export function smooth(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Desert island height. Sea is below about -0.5; the pad and town are flattened. */
export function groundY(x: number, z: number) {
  const r = Math.hypot(x, z);
  const inland = smooth(76, 54, r);
  let h = 0.7;
  h += Math.sin(x * 0.08) * Math.cos(z * 0.07) * 1.35;
  h += Math.sin(x * 0.21 + 1.3) * Math.sin(z * 0.17 + 0.6) * 0.4;
  const ridge = Math.exp(-((x + 32) ** 2) / 70 - ((z + 18) ** 2) / 150);
  h += ridge * 6.2;
  const oasis = Math.exp(-((x - 2.4) ** 2) / 48 - ((z + 17) ** 2) / 52);
  h -= oasis * 2.5;
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
  return lerp(-1.7, h, inland);
}

export const SKY = { x: 24, z: -36, y: 14.2, r: 5.2 };
export const BRIDGE = { x: 2.2, z0: -24.2, z1: -8.8, half: 0.85, deck: 0.42 };

export function onBridge(x: number, z: number) {
  return Math.abs(x - BRIDGE.x) < BRIDGE.half && z > BRIDGE.z0 && z < BRIDGE.z1;
}

export function onSky(x: number, z: number) {
  const dx = x - SKY.x;
  const dz = z - SKY.z;
  return dx * dx + dz * dz < SKY.r * SKY.r;
}

/** Feet height for walking. Sky deck only counts if you are already up there. */
export function footY(x: number, z: number, currentY: number) {
  let y = groundY(x, z);
  if (onBridge(x, z)) y = Math.max(y, BRIDGE.deck);
  if (onSky(x, z) && currentY > SKY.y - 2) y = Math.max(y, SKY.y);
  return y;
}

export function hoverFloor(x: number, z: number, currentY: number) {
  let y = groundY(x, z) + 0.82;
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

export const NPC = {
  sera: { x: -5.7, z: 17, yaw: Math.PI / 2, name: "Сера Венн" },
  orr: { x: -6.4, z: -1.2, yaw: Math.PI / 2, name: "Орр-1" },
  bulb: { x: 4.6, z: 9.4, yaw: Math.PI, name: "Ламп" },
};

export function regionName(x: number, z: number, y: number) {
  if (onSky(x, z) && y > SKY.y - 1) return "Висячий остров";
  if (Math.hypot(x - 2.4, z + 17) < 9) return "Оазис";
  if (x < -22 && z < -6) return "Кристальная гряда";
  if (z > 30 && Math.abs(x) < 14) return "Посадочная";
  if (Math.abs(x) < 18 && z > -10 && z < 26) return "Дюнный посад";
  if (Math.hypot(x - RING.x, z - RING.z) < 8) return "Северное кольцо";
  return "Дюны";
}
