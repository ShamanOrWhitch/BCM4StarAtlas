/**
 * Planet Opus flight and loop (owner 23.11.2026: "Думаю стоит начать с новой планеты по имени
 * Opus"; IDEA-026 step 1). Magic Carpet (1994) is a genre reference only: no code, art or names
 * from it. The ship is ours and is flown, not walked.
 *
 * Flight: the ship hangs over the ground and lifts itself over a rise (looking ahead along its
 * course), banks into a turn with lag, follows the slope with part of its nose, can stop and hover.
 * Order each step: horizontal motion first, then the ground at the NEW point, then the height —
 * otherwise a fast ship sinks into a hill.
 *
 * Loop (one base, one resource, one threat):
 *   - sparks lie over the island; they are taken only low over the ground;
 *   - height costs energy: above the preferred height it drains, low it comes back;
 *   - wardens (our own units) sit on the spark nodes and fire at a ship close by;
 *     the ship's bolt puts a warden down for a while;
 *   - over the base the hold is unloaded; the store buys upgrades that change the route
 *     (a bigger hold = a longer run, a bigger tank = over the pillars).
 * Pure: no THREE, no DOM. The ground function comes from terrain.ts.
 */

import { OPUS_BASE } from "./terrain";

export const CARPET = {
  bankMax: 0.55, // rad, roll in a full turn (~32°)
  bankLag: 4.5, // 1/s, how fast the roll follows
  pitchFollow: 0.65, // share of the ground slope given to the nose
  liftLag: 7.0, // 1/s, rising over a rise
  sinkLag: 2.4, // 1/s, settling down again
  hoverAmp: 0.035, // m, the hull's live tremor
  hoverHz: 1.7,
  minClear: 1.4, // m, lowest height over the ground
  floorClear: 0.6, // m, hard floor
  preferred: 3.2, // m, above this height energy drains, at or below it comes back
  maxClear: 16, // m, ceiling with the basic tank
  climbRate: 5, // m/s, the height setting moves this fast
  maxSpeed: 15,
  boostSpeed: 24,
  accel: 11,
  stopDrag: 1.6, // 1/s, letting go stops the ship
  turnRate: 1.5, // rad/s
  water: -0.45, // the ship hangs over the sea surface, not the sea bed
  edge: 92, // m from the centre: the world's soft wall
};

export const LOOP = {
  collectR: 2.4,
  collectClear: 2.6,
  energyMax: 100,
  drainPerM: 0.9, // per second per metre above the preferred height
  climbCost: 6, // per second while climbing
  boostCost: 9,
  regen: 7,
  holdCap: 4,
  respawn: 45,
  baseClear: 8,
  wardenRange: 24,
  wardenEvery: 2.2,
  wardenHp: 3,
  wardenDown: 30,
  boltSpeed: 13,
  boltLife: 3,
  hitR: 1.5,
  hitCost: 18,
  shotSpeed: 42,
  shotLife: 1.1,
  shotEvery: 0.25,
  shotHitR: 1.9,
  aimCone: 0.45, // rad
  aimRange: 38,
};

export type Upgrade = { id: "hold" | "tank" | "hold2"; title: string; cost: number };
export const UPGRADES: Upgrade[] = [
  { id: "hold", title: "Трюм на 7", cost: 6 },
  { id: "tank", title: "Бак: выше столбов", cost: 10 },
  { id: "hold2", title: "Трюм на 10", cost: 14 },
];

export type Spark = { x: number; z: number; taken: boolean; back: number; guarded: number | null };
export type Warden = { x: number; z: number; y: number; hp: number; down: number; cool: number; aim: number };
export type Bolt = { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number };

export type CarpetInput = {
  steer: number;
  throttle: number;
  brake: number;
  climb: number;
  boost: boolean;
  fire: boolean;
};

export type CarpetBody = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  vx: number;
  vz: number;
  vy: number;
  speed: number;
};

/** Spark nodes: a warden stands on each, four sparks around it. Free sparks lie near the base. */
export const OPUS_NODES = [
  { x: -46, z: -12 },
  { x: 40, z: -28 },
  { x: -38, z: 22 },
];
const FREE_SPARKS: Array<[number, number]> = [
  [-16, 36], [-22, 28], [14, 44], [20, 34], [-4, 26], [8, 24],
];

const SAVE = "opus-carpet-v1";

function loadSaved(): { store: number; owned: string[] } {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(SAVE) : null;
    const data = raw ? JSON.parse(raw) : null;
    if (data && typeof data.store === "number" && Array.isArray(data.owned)) return { store: data.store, owned: data.owned };
  } catch {
    /* private mode */
  }
  return { store: 0, owned: [] };
}

export function createCarpet(ground: (x: number, z: number) => number) {
  const saved = loadSaved();
  const sparks: Spark[] = FREE_SPARKS.map(([x, z]) => ({ x, z, taken: false, back: 0, guarded: null }));
  OPUS_NODES.forEach((node, index) => {
    for (let k = 0; k < 4; k += 1) {
      const a = (k / 4) * Math.PI * 2 + index;
      sparks.push({ x: node.x + Math.cos(a) * 5, z: node.z + Math.sin(a) * 5, taken: false, back: 0, guarded: index });
    }
  });
  const wardens: Warden[] = OPUS_NODES.map((node, index) => ({
    x: node.x,
    z: node.z,
    y: ground(node.x, node.z) + 1.2,
    hp: LOOP.wardenHp,
    down: 0,
    cool: 1 + index * 0.6,
    aim: 0,
  }));
  const c = {
    ground,
    roll: 0,
    pitch: 0,
    bob: 0,
    clock: 0,
    target: CARPET.preferred,
    energy: LOOP.energyMax,
    energyMax: LOOP.energyMax,
    maxClear: CARPET.maxClear,
    hold: 0,
    holdCap: LOOP.holdCap,
    store: saved.store,
    owned: saved.owned.filter((id) => UPGRADES.some((u) => u.id === id)),
    sparks,
    wardens,
    enemyBolts: [] as Bolt[],
    shots: [] as Bolt[],
    shotCool: 0,
    firePrev: false,
    hit: 0,
    atBase: false,
    note: "",
    noteFor: 0,
  };
  for (const id of c.owned) applyUpgrade(c, id);
  return c;
}

export type CarpetState = ReturnType<typeof createCarpet>;

function applyUpgrade(c: CarpetState, id: string) {
  if (id === "hold") c.holdCap = Math.max(c.holdCap, 7);
  if (id === "hold2") c.holdCap = Math.max(c.holdCap, 10);
  if (id === "tank") {
    c.energyMax = 150;
    c.maxClear = 24;
  }
}

export function nextUpgrade(c: CarpetState) {
  return UPGRADES.find((u) => !c.owned.includes(u.id)) ?? null;
}

function persist(c: CarpetState) {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(SAVE, JSON.stringify({ store: c.store, owned: c.owned }));
  } catch {
    /* private mode */
  }
}

/** At the base: buy the next upgrade if the store has the sparks. Returns its title or null. */
export function buyUpgrade(c: CarpetState) {
  const next = nextUpgrade(c);
  if (!next || !c.atBase) return null;
  if (c.store < next.cost) {
    say(c, `Нужно искр: ${next.cost}, в накопителе ${c.store}`);
    return null;
  }
  c.store -= next.cost;
  c.owned.push(next.id);
  applyUpgrade(c, next.id);
  persist(c);
  say(c, `Куплено: ${next.title}`);
  return next.title;
}

function say(c: CarpetState, text: string) {
  c.note = text;
  c.noteFor = 2.6;
}

/** Floor under the ship: the ground, or the sea surface over the sea. */
export function carpetFloor(c: CarpetState, x: number, z: number) {
  return Math.max(c.ground(x, z), CARPET.water);
}

export function stepCarpet(
  c: CarpetState,
  body: CarpetBody,
  input: CarpetInput,
  dt: number,
  collide?: (nx: number, nz: number, y: number) => { x: number; z: number },
  /** Top of a building or prop standing at (x, z), or -Infinity: the ship lifts over it too. */
  obstacle?: (x: number, z: number) => number,
) {
  c.clock += dt;
  c.noteFor = Math.max(0, c.noteFor - dt);
  c.hit = Math.max(0, c.hit - dt);
  const hasEnergy = c.energy > 0.5;

  // 1. Heading and speed. The ship turns in place too: hovering is a decision, not a stall.
  body.yaw += input.steer * CARPET.turnRate * dt;
  const fx = -Math.sin(body.yaw);
  const fz = -Math.cos(body.yaw);
  let forward = body.vx * fx + body.vz * fz;
  const wish = input.throttle - input.brake * 0.6;
  const boosting = input.boost && hasEnergy && wish > 0;
  const top = boosting ? CARPET.boostSpeed : CARPET.maxSpeed;
  if (wish !== 0) {
    const goal = wish * top;
    forward += Math.max(-CARPET.accel * dt, Math.min(CARPET.accel * dt, goal - forward));
  } else {
    forward *= Math.exp(-CARPET.stopDrag * dt);
    if (Math.abs(forward) < 0.03) forward = 0;
  }
  body.vx = fx * forward;
  body.vz = fz * forward;
  body.speed = forward;

  // 2. Horizontal motion first.
  let nx = body.x + body.vx * dt;
  let nz = body.z + body.vz * dt;
  const r = Math.hypot(nx, nz);
  if (r > CARPET.edge) {
    nx *= CARPET.edge / r;
    nz *= CARPET.edge / r;
  }
  if (collide) {
    const hit = collide(nx, nz, body.y);
    nx = hit.x;
    nz = hit.z;
  }
  body.x = nx;
  body.z = nz;

  // 3. The ground at the new point, and ahead along the course (a roof counts as ground ahead).
  const here = carpetFloor(c, nx, nz);
  const roofAt = (x: number, z: number) => Math.max(carpetFloor(c, x, z), obstacle ? obstacle(x, z) : -Infinity);
  let ahead = roofAt(nx, nz);
  const moving = Math.abs(forward) > 0.5 ? Math.sign(forward) : 0;
  if (moving || wish !== 0) {
    const dir = moving || Math.sign(wish);
    for (const d of [1.5, 3, 6, 9, 12]) ahead = Math.max(ahead, roofAt(nx + fx * d * dir, nz + fz * d * dir));
  }

  // 4. Height: the setting moves with Space / Q; without energy the ship settles to the preferred height.
  if (input.climb > 0 && hasEnergy) c.target += CARPET.climbRate * dt;
  if (input.climb < 0) c.target -= CARPET.climbRate * dt;
  if (!hasEnergy) c.target = Math.min(c.target, CARPET.preferred);
  c.target = Math.max(CARPET.minClear, Math.min(c.maxClear, c.target));
  const want = Math.max(here + c.target, ahead + CARPET.minClear);
  const lag = want > body.y ? CARPET.liftLag : CARPET.sinkLag;
  const prevY = body.y;
  body.y += (want - body.y) * (1 - Math.exp(-lag * dt));
  body.y = Math.max(body.y, here + CARPET.floorClear);
  body.vy = (body.y - prevY) / Math.max(dt, 1e-4);

  // 5. Roll and pitch with lag: the weight of the hull.
  const pace = Math.min(1, 0.35 + Math.abs(forward) / CARPET.maxSpeed);
  const targetRoll = -input.steer * CARPET.bankMax * pace;
  c.roll += (targetRoll - c.roll) * (1 - Math.exp(-CARPET.bankLag * dt));
  const front = carpetFloor(c, nx + fx * 12, nz + fz * 12);
  const slope = (front - here) / 12;
  const targetPitch = Math.atan(slope) * CARPET.pitchFollow * (moving ? 1 : 0.3);
  c.pitch += (targetPitch - c.pitch) * (1 - Math.exp(-CARPET.bankLag * dt));
  c.bob = Math.sin(c.clock * Math.PI * 2 * CARPET.hoverHz) * CARPET.hoverAmp;

  // 6. Energy: height above the preferred one drains it, low flight restores it.
  const clearance = body.y - here;
  let drain = Math.max(0, clearance - CARPET.preferred) * LOOP.drainPerM;
  if (input.climb > 0 && hasEnergy) drain += LOOP.climbCost;
  if (boosting) drain += LOOP.boostCost;
  if (clearance <= CARPET.preferred + 0.3 && !boosting) drain -= LOOP.regen;
  c.energy = Math.max(0, Math.min(c.energyMax, c.energy - drain * dt));

  // 7. Sparks: taken only low over the ground, while the hold has room.
  for (const s of c.sparks) {
    if (s.taken) {
      s.back -= dt;
      if (s.back <= 0) s.taken = false;
      continue;
    }
    if (c.hold >= c.holdCap) continue;
    if ((s.x - nx) ** 2 + (s.z - nz) ** 2 > LOOP.collectR ** 2) continue;
    if (body.y - carpetFloor(c, s.x, s.z) > LOOP.collectClear) continue;
    s.taken = true;
    s.back = LOOP.respawn;
    c.hold += 1;
    if (c.hold >= c.holdCap) say(c, "Трюм полон — к накопителю");
  }

  // 8. The base: unload, refill.
  const base = OPUS_BASE;
  c.atBase = (nx - base.x) ** 2 + (nz - base.z) ** 2 < base.r * base.r && clearance < LOOP.baseClear;
  if (c.atBase) {
    if (c.hold > 0) {
      c.store += c.hold;
      say(c, `Сдано искр: ${c.hold}`);
      c.hold = 0;
      persist(c);
    }
    c.energy = c.energyMax;
  }

  // 9. Wardens fire at a ship close by; their bolts fly straight.
  for (const w of c.wardens) {
    if (w.down > 0) {
      w.down -= dt;
      if (w.down <= 0) w.hp = LOOP.wardenHp;
      continue;
    }
    const dx = nx - w.x;
    const dz = nz - w.z;
    w.aim = Math.atan2(dx, dz);
    w.cool -= dt;
    if (w.cool > 0 || dx * dx + dz * dz > LOOP.wardenRange ** 2) continue;
    w.cool = LOOP.wardenEvery;
    // Lead the ship by half the flight time: moving dodges, hanging still does not.
    const dist = Math.hypot(dx, body.y - w.y, dz);
    const lead = (dist / LOOP.boltSpeed) * 0.5;
    const tx = nx + body.vx * lead - w.x;
    const ty = body.y - w.y;
    const tz = nz + body.vz * lead - w.z;
    const n = Math.hypot(tx, ty, tz) || 1;
    c.enemyBolts.push({ x: w.x, y: w.y + 0.6, z: w.z, vx: (tx / n) * LOOP.boltSpeed, vy: (ty / n) * LOOP.boltSpeed, vz: (tz / n) * LOOP.boltSpeed, life: LOOP.boltLife });
  }
  for (const b of c.enemyBolts) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;
    b.life -= dt;
    if ((b.x - nx) ** 2 + (b.y - body.y) ** 2 + (b.z - nz) ** 2 < LOOP.hitR ** 2) {
      b.life = 0;
      c.hit = 0.6;
      c.energy = Math.max(0, c.energy - LOOP.hitCost);
      if (c.hold > 0) {
        c.hold -= 1;
        say(c, "Попадание! Потеряна искра");
      } else say(c, "Попадание!");
    }
  }
  c.enemyBolts = c.enemyBolts.filter((b) => b.life > 0);

  // 10. The ship's bolt: forward, aimed at a warden inside the cone.
  c.shotCool = Math.max(0, c.shotCool - dt);
  if (input.fire && !c.firePrev && c.shotCool <= 0) {
    c.shotCool = LOOP.shotEvery;
    let dir = { x: fx, y: 0, z: fz };
    let best = LOOP.aimCone;
    for (const w of c.wardens) {
      if (w.down > 0) continue;
      const dx = w.x - nx;
      const dy = w.y - body.y;
      const dz = w.z - nz;
      const d = Math.hypot(dx, dy, dz);
      if (d > LOOP.aimRange || d < 0.1) continue;
      const angle = Math.acos(Math.max(-1, Math.min(1, (dx * fx + dz * fz) / Math.max(0.01, Math.hypot(dx, dz)))));
      if (angle < best) {
        best = angle;
        dir = { x: dx / d, y: dy / d, z: dz / d };
      }
    }
    c.shots.push({ x: nx, y: body.y, z: nz, vx: dir.x * LOOP.shotSpeed, vy: dir.y * LOOP.shotSpeed, vz: dir.z * LOOP.shotSpeed, life: LOOP.shotLife });
  }
  c.firePrev = input.fire;
  for (const s of c.shots) {
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.z += s.vz * dt;
    s.life -= dt;
    for (const w of c.wardens) {
      if (w.down > 0 || s.life <= 0) continue;
      if ((s.x - w.x) ** 2 + (s.y - w.y) ** 2 + (s.z - w.z) ** 2 > LOOP.shotHitR ** 2) continue;
      s.life = 0;
      w.hp -= 1;
      if (w.hp <= 0) {
        w.down = LOOP.wardenDown;
        say(c, "Страж выведен из строя");
      }
    }
  }
  c.shots = c.shots.filter((s) => s.life > 0);
}
