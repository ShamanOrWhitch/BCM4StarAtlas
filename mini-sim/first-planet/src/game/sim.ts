import { createSeededRandom } from "./seed";
import { loadRaceLevel, raceModeFor, type RaceKind, type RaceMode } from "./race-modes";
import {
  buildTrack,
  crossedForward,
  forwardDelta,
  project,
  sampleAt,
  yawFromTangent,
  type Track,
} from "./track";

export const LAPS = 3;

export type ItemKind = "solar" | "slick" | "pulse";

export type Car = {
  name: string;
  you: boolean;
  ai: boolean;
  color: number;
  x: number;
  z: number;
  yaw: number;
  speed: number;
  lat: number;
  s: number;
  hint: number;
  gate: number;
  lapsDone: number;
  lapStart: number;
  bestLap: number;
  finished: boolean;
  finishTime: number;
  place: number;
  item: ItemKind | null;
  useHeld: boolean;
  boost: number;
  slick: number;
  drift: number;
  drifting: boolean;
  wrongT: number;
  stuck: number;
  aiOffset: number;
  aiClock: number;
  /** Elimination: off the course; outOrder 1 = the first one out. */
  out: boolean;
  outOrder: number;
  /** Slalom: seconds added for missed gates, and how many were missed. */
  penalty: number;
  missed: number;
  /** Slalom: index of the gate this car meets next (-1: find it again after a respawn). */
  gateNext: number;
  /** Seconds until the next trap or mob can hit this car again. */
  hazardCd: number;
  hit: "trap" | "mob" | null;
};

/** A slalom gate: where along the lap, its centre across the road and its half-width. */
export type Gate = { s: number; lat: number; half: number };

export type Box = {
  s: number;
  lat: number;
  x: number;
  z: number;
  alive: boolean;
  cooldown: number;
};

export type Slick = { x: number; z: number; life: number; owner: number };

export type Trap = { s: number; x: number; z: number };

export type Mob = {
  s: number;
  lat: number;
  amp: number;
  phase: number;
  rate: number;
  x: number;
  z: number;
};

export type DriveInput = {
  throttle: number;
  brake: number;
  steer: number;
  drift: boolean;
  handbrake: boolean;
  use: boolean;
};

export type StandingsRow = {
  name: string;
  you: boolean;
  place: number;
  done: boolean;
  time: number;
  color: number;
  out: boolean;
};

export type Hud = {
  lap: number;
  time: number;
  lapTime: number;
  bestLap: number;
  storedBest: number;
  speed: number;
  place: number;
  total: number;
  item: ItemKind | null;
  hazard: "trap" | "mob" | null;
  drift: number;
  boosting: boolean;
  wrong: boolean;
  rows: StandingsRow[];
  go: number;
  mode: RaceKind;
  title: string;
  map: string;
  rules: string;
  level: number;
  laps: number;
  penalty: number;
  missed: number;
  out: boolean;
  /** Slalom: the next gate is this far ahead (m), -1 when there is none. */
  nextGate: number;
};

const BEST_KEY = "galia-shoal-v1";

const bestKey = (planet?: string) => (planet && planet !== "first" ? BEST_KEY + "-" + planet : BEST_KEY);

export function loadStoredBest(planet?: string) {
  try {
    const raw = JSON.parse(localStorage.getItem(bestKey(planet)) || "");
    return typeof raw.bestLap === "number" && raw.bestLap > 0 ? raw.bestLap : 0;
  } catch {
    return 0;
  }
}

export function saveStoredBest(bestLap: number, planet?: string) {
  if (!(bestLap > 0)) return;
  const prev = loadStoredBest(planet);
  if (prev > 0 && prev <= bestLap) return;
  localStorage.setItem(bestKey(planet), JSON.stringify({ v: 1, bestLap }));
}

function makeCar(
  track: Track,
  index: number,
  spec: { name: string; you: boolean; color: number; offset: number },
): Car {
  const s = track.length - 16 - index * 9;
  const p = sampleAt(track, s);
  return {
    name: spec.name,
    you: spec.you,
    ai: !spec.you,
    color: spec.color,
    x: p.x + p.nx * spec.offset,
    z: p.z + p.nz * spec.offset,
    yaw: yawFromTangent(p.tx, p.tz),
    speed: 0,
    lat: 0,
    s,
    hint: Math.floor((s / track.length) * track.samples.length) % track.samples.length,
    gate: 1,
    lapsDone: 0,
    lapStart: 0,
    bestLap: 0,
    finished: false,
    finishTime: 0,
    place: index + 1,
    item: null,
    useHeld: false,
    boost: 0,
    slick: 0,
    drift: 0,
    drifting: false,
    wrongT: 0,
    stuck: 0,
    aiOffset: spec.offset,
    aiClock: index * 1.7,
    out: false,
    outOrder: 0,
    penalty: 0,
    missed: 0,
    gateNext: 0,
    hazardCd: 0,
    hit: null,
  };
}

function rollItem(nudge: number): ItemKind {
  const r = Math.abs(Math.sin(nudge * 12.9898) * 43758.5453) % 1;
  if (r < 0.42) return "solar";
  if (r < 0.74) return "slick";
  return "pulse";
}

export type Race = {
  seed: number;
  planet?: string;
  mode: RaceMode;
  level: number;
  laps: number;
  gates: Gate[];
  eliminated: number;
  track: Track;
  cars: Car[];
  boxes: Box[];
  traps: Trap[];
  mobs: Mob[];
  slicks: Slick[];
  time: number;
  go: number;
  storedBest: number;
  step: (dt: number, input: DriveInput, live: boolean) => void;
  hud: () => Hud;
  reset: () => void;
  respawnYou: () => void;
};

function layoutBoxes(track: Track, seed: number): Box[] {
  const marks = [0.12, 0.27, 0.41, 0.55, 0.7, 0.86];
  const random = createSeededRandom(seed, "shoal-race-boxes");
  return marks.map((fraction, i) => {
    // Keep the established six pickup zones; seed only their small offsets.
    const s = (fraction + (random() - 0.5) * 0.018) * track.length;
    const p = sampleAt(track, s);
    const side = i % 2 === 0 ? 1 : -1;
    const lat = side * (2.15 + random() * 0.5);
    return { s, lat, x: p.x + p.nx * lat, z: p.z + p.nz * lat, alive: true, cooldown: 0 };
  });
}

/** Slalom gates down the lap, alternating sides; the same gates every lap. */
function layoutGates(track: Track, seed: number, mode: RaceMode): Gate[] {
  if (mode.kind !== "slalom" || mode.gatesPerLap <= 0) return [];
  const random = createSeededRandom(seed, "shoal-race-gates");
  const half = mode.gateHalf;
  const gates: Gate[] = [];
  for (let i = 0; i < mode.gatesPerLap; i++) {
    const fraction = 0.06 + (i / mode.gatesPerLap) * 0.9 + (random() - 0.5) * 0.02;
    const side = i % 2 === 0 ? 1 : -1;
    const reach = Math.min(track.halfWidth - half * 0.6, track.halfWidth * 0.34 + random() * 1.7);
    gates.push({ s: fraction * track.length, lat: side * reach, half });
  }
  return gates;
}

/** Traps sit on the road. Mobs walk across it. Both come from the seed, the planet and the level. */
function layoutHazards(track: Track, seed: number, planet: string | undefined, level: number) {
  const random = createSeededRandom(seed, "shoal-race-hazards-" + (planet || "coast"));
  const lv = Math.min(3, Math.max(1, Math.floor(level) || 1));
  const trapCount = 2 + lv;
  const mobCount = 1 + lv;
  const traps: Trap[] = [];
  for (let i = 0; i < trapCount; i++) {
    const s = ((i + 0.65) / (trapCount + 1)) * track.length;
    const p = sampleAt(track, s);
    const lat = (random() < 0.5 ? -1 : 1) * (0.6 + random() * track.halfWidth * 0.4);
    traps.push({ s, x: p.x + p.nx * lat, z: p.z + p.nz * lat });
  }
  const mobs: Mob[] = [];
  for (let i = 0; i < mobCount; i++) {
    const s = ((i + 1) / (mobCount + 1)) * track.length;
    const amp = track.halfWidth * (0.32 + random() * 0.38);
    const p = sampleAt(track, s);
    mobs.push({
      s,
      lat: 0,
      amp,
      phase: random() * Math.PI * 2,
      rate: 0.65 + random() * 0.7,
      x: p.x,
      z: p.z,
    });
  }
  return { traps, mobs };
}

function strike(car: Car, kind: "trap" | "mob") {
  if (car.finished || car.hazardCd > 0) return;
  car.hazardCd = 1.15;
  car.hit = kind;
  if (kind === "trap") {
    car.speed *= 0.7;
    car.slick = Math.max(car.slick, 0.55);
    return;
  }
  car.speed *= 0.52;
  car.lat += (car.lat >= 0 ? 1 : -1) * 3;
}

/** Slalom: the gate the car meets next and how far ahead it is. */
function nextGate(race: Race, car: Car) {
  let best: { gate: Gate; d: number } | null = null;
  for (const gate of race.gates) {
    const d = forwardDelta(car.s, gate.s, race.track.length);
    if (d >= 0 && (!best || d < best.d)) best = { gate, d };
  }
  return best;
}

function respawnS(car: Car, track: Track) {
  if (car.lapsDone === 0 && car.gate <= 1) return track.length - 16;
  if (car.gate === 0) return track.checkpoints[track.checkpoints.length - 1];
  return track.checkpoints[car.gate - 1];
}

function respawnCar(car: Car, track: Track) {
  const s = respawnS(car, track);
  const p = sampleAt(track, s);
  car.x = p.x;
  car.z = p.z;
  car.yaw = yawFromTangent(p.tx, p.tz);
  car.speed = 16;
  car.lat = 0;
  car.s = s;
  car.hint = Math.floor((s / track.length) * track.samples.length) % track.samples.length;
  car.wrongT = 0;
  car.stuck = 0;
  car.drifting = false;
  car.drift = 0;
  car.gateNext = -1;
}

function progress(car: Car, length: number) {
  // Next checkpoint 1 with s near the end of the lap: the car is on the grid, or on
  // the very frame it took the line. That is behind the line, not a lap more. A slalom penalty also counts on the
  // way: about 20 m a second.
  const s = car.gate === 1 && car.s > length * 0.5 ? car.s - length : car.s;
  return car.lapsDone * length + s - car.penalty * 20;
}

function rank(cars: Car[], length: number) {
  const order = cars.map((_, i) => i);
  // Finished first, then the ones still racing, then the ones out (last out = best of them).
  const tier = (c: Car) => (c.out ? 2 : c.finished ? 0 : 1);
  order.sort((ia, ib) => {
    const a = cars[ia];
    const b = cars[ib];
    if (tier(a) !== tier(b)) return tier(a) - tier(b);
    if (a.out && b.out) return b.outOrder - a.outOrder;
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    if (a.finished) return -1;
    if (b.finished) return 1;
    return progress(b, length) - progress(a, length);
  });
  order.forEach((carIndex, place) => {
    cars[carIndex].place = place + 1;
  });
}

function applyItem(race: Race, index: number) {
  const car = race.cars[index];
  const kind = car.item;
  if (!kind) return;
  car.item = null;
  if (kind === "solar") {
    car.boost = Math.max(car.boost, 1.15);
    return;
  }
  if (kind === "slick") {
    const fx = -Math.sin(car.yaw);
    const fz = -Math.cos(car.yaw);
    race.slicks.push({ x: car.x - fx * 2.2, z: car.z - fz * 2.2, life: 7, owner: index });
    return;
  }
  const mine = progress(car, race.track.length);
  race.cars.forEach((other, i) => {
    if (i === index || other.finished) return;
    if (progress(other, race.track.length) > mine) {
      other.slick = Math.max(other.slick, 0.85);
      other.speed *= 0.62;
    }
  });
}

function aiDrive(car: Car, race: Race): DriveInput {
  const track = race.track;
  const look = 12 + Math.min(14, Math.max(0, car.speed) * 0.32);
  let ahead = sampleAt(track, car.s + look);
  // Slalom: steer straight for the centre of the next gate.
  let line = car.aiOffset;
  let gateClose = false;
  if (race.gates.length) {
    const next = nextGate(race, car);
    if (next && next.d < 60) {
      // Lead the gate: look a little short of it and over-aim its side, so the
      // car is already across when it gets there.
      line = Math.max(-track.halfWidth + 1, Math.min(track.halfWidth - 1, next.gate.lat * 1.35));
      ahead = sampleAt(track, car.s + Math.min(look, Math.max(4, next.d - 2)));
    }
    gateClose = Boolean(next && next.d < 34);
  }
  for (const mob of race.mobs) {
    const aheadOf = forwardDelta(car.s, mob.s, track.length);
    if (aheadOf > 0 && aheadOf < 28 && Math.abs(mob.lat - line) < 2.4) {
      line += mob.lat > line ? -2.6 : 2.6;
    }
  }
  const desired = Math.atan2(
    -(ahead.x + ahead.nx * line - car.x),
    -(ahead.z + ahead.nz * line - car.z),
  );
  let err = desired - car.yaw;
  while (err > Math.PI) err -= Math.PI * 2;
  while (err < -Math.PI) err += Math.PI * 2;
  const steer = Math.min(1, Math.max(-1, err / 0.55));
  const curve = sampleAt(track, car.s + 20).curvature;
  const you = race.cars[0];
  let target = 33.5 + race.mode.rivalPace - curve * 150;
  // A slalom pilot lifts off before a gate to make the line.
  if (gateClose) target = Math.min(target, 27 + race.mode.rivalPace * 0.3);
  const gap = progress(you, track.length) - progress(car, track.length);
  if (gap > 70) target += 4.5;
  if (gap < -90) target -= 3;
  if (car.slick > 0) target -= 8;
  car.aiClock += 0.016;
  const use = Boolean(car.item) && car.aiClock > 4.2 && Math.abs(err) < 0.4;
  if (use) car.aiClock = 0;
  return {
    throttle: car.speed < target ? 1 : 0.2,
    brake: car.speed > target + 7 ? 0.85 : 0,
    steer,
    // No drift through the slalom: the slide carries the car past the gate.
    drift: !race.gates.length && Math.abs(err) > 0.5 && car.speed > 20,
    handbrake: false,
    use,
  };
}

function stepCar(car: Car, input: DriveInput, dt: number, race: Race) {
  const track = race.track;
  if (car.finished) {
    car.speed *= Math.exp(-1.4 * dt);
    car.lat *= Math.exp(-6 * dt);
  }
  if (car.boost > 0) {
    car.boost -= dt;
    if (!car.finished) car.speed += 34 * dt;
  }
  if (car.slick > 0) {
    car.slick -= dt;
    car.speed *= Math.exp(-1.5 * dt);
  }
  if (!car.finished) {
    car.speed += (input.throttle * 26 - input.brake * 48) * dt;
    const coast = input.throttle < 0.05 && input.brake < 0.05;
    car.speed *= Math.exp(-(coast ? 0.42 : 0.18) * dt);
    car.speed = Math.min(car.boost > 0 ? 56 : 40, Math.max(-12, car.speed));
  }

  const sp = Math.abs(car.speed);
  const speedFactor =
    Math.min(1, Math.max(0.22, sp / 15)) * (1 - Math.min(0.4, Math.max(0, (sp - 34) / 50)));
  const reverse = car.speed >= 0 ? 1 : -1;
  const handbrake = !!(input.handbrake && sp > 8 && Math.abs(input.steer) > 0.12 && !car.finished);
  const wantDrift = !handbrake && input.drift && sp > 9 && Math.abs(input.steer) > 0.15 && !car.finished;
  car.yaw += input.steer * (handbrake ? 3.6 : wantDrift ? 2.45 : 2.05) * speedFactor * reverse * dt;

  if (handbrake) {
    // A handbrake turns the nose and dumps speed. It does not store a drift boost.
    car.drifting = false;
    car.drift = 0;
    car.lat += input.steer * 26 * dt;
    car.lat *= Math.exp(-2.2 * dt);
    car.speed *= Math.exp(-1.8 * dt);
  } else if (wantDrift) {
    car.drifting = true;
    car.drift = Math.min(1.35, car.drift + dt * (0.7 + Math.abs(input.steer) * 0.8));
    car.lat += input.steer * 18 * dt;
    car.lat *= Math.exp(-1.5 * dt);
  } else {
    if (car.drifting && car.drift > 0.42) {
      car.boost = Math.max(car.boost, car.drift > 0.95 ? 0.72 : 0.42);
    }
    car.drifting = false;
    car.drift = Math.max(0, car.drift - dt * 1.8);
    car.lat *= Math.exp(-8.5 * dt);
  }

  const fx = -Math.sin(car.yaw);
  const fz = -Math.cos(car.yaw);
  car.x += (fx * car.speed + Math.cos(car.yaw) * car.lat) * dt;
  car.z += (fz * car.speed + -Math.sin(car.yaw) * car.lat) * dt;

  const proj = project(track, car.x, car.z, car.hint);
  car.hint = proj.index;
  let fell = false;
  if (Math.abs(proj.lat) > track.halfWidth) {
    const sign = Math.sign(proj.lat) || 1;
    const overflow = Math.abs(proj.lat) - track.halfWidth;
    car.x -= proj.nx * sign * overflow;
    car.z -= proj.nz * sign * overflow;
    car.lat *= 0.15;
    car.speed *= Math.max(0.82, 1 - overflow * 0.04);
    if (overflow > 5.5) {
      respawnCar(car, track);
      fell = true;
    }
  }

  if (!fell) {
    const prev = car.s;
    car.s = proj.s;
    const d = forwardDelta(prev, car.s, track.length);
    if (d < -0.2 && sp > 7) car.wrongT += dt;
    else car.wrongT = Math.max(0, car.wrongT - dt * 2);
    if (!car.finished) {
      // One gate at a time, in order: weaving across a gate line never counts twice.
      const gates = race.gates;
      if (gates.length && car.gateNext < 0) {
        const ahead = gates.findIndex((g) => g.s >= car.s);
        car.gateNext = ahead < 0 ? 0 : ahead;
      }
      const gate = gates[car.gateNext];
      if (gate && crossedForward(prev, car.s, gate.s, track.length)) {
        if (Math.abs(proj.lat - gate.lat) > gate.half) {
          car.missed += 1;
          car.penalty += race.mode.penalty;
        }
        car.gateNext = (car.gateNext + 1) % gates.length;
      }
    }
    const gateS = track.checkpoints[car.gate];
    if (!car.finished && crossedForward(prev, car.s, gateS, track.length)) {
      if (car.gate === 0) {
        const lapT = race.time - car.lapStart;
        if (lapT > 1 && (car.bestLap === 0 || lapT < car.bestLap)) car.bestLap = lapT;
        car.lapStart = race.time;
        car.lapsDone += 1;
        car.gate = 1;
        if (car.lapsDone >= race.laps) {
          car.finished = true;
          car.finishTime = race.time + car.penalty;
          if (car.you) {
            saveStoredBest(car.bestLap, race.planet);
            race.storedBest = loadStoredBest(race.planet);
          }
        }
      } else {
        car.gate += 1;
        if (car.gate >= track.checkpoints.length) car.gate = 0;
      }
    }
  }

  if (sp < 2.5 && !car.finished && (car.ai || input.throttle > 0.2)) car.stuck += dt;
  else car.stuck = 0;
  if (car.ai && car.stuck > 3.2) respawnCar(car, track);
  if (car.you && car.stuck > 2.4) respawnCar(car, track);
  if (car.you && car.wrongT > 1.7) respawnCar(car, track);

  const pressed = input.use && !car.useHeld;
  car.useHeld = input.use;
  if (pressed && car.item) applyItem(race, race.cars.indexOf(car));
}

const ROSTER = [
  { name: "Ты", you: true, color: 0xe4a322, offset: 0 },
  { name: "Kestrel", you: false, color: 0x5ec8c5, offset: 2.2 },
  { name: "Brine", you: false, color: 0xe25b3a, offset: -2.2 },
  { name: "Halo", you: false, color: 0xd7d2c8, offset: 0.4 },
];

/** Elimination: once the leader has done n laps, n cars are out (two reach the finish). */
function eliminate(race: Race) {
  if (race.mode.kind !== "elimination") return;
  const racing = race.cars.filter((c) => !c.out && !c.finished);
  const leadLaps = Math.max(0, ...race.cars.filter((c) => !c.out).map((c) => c.lapsDone));
  const allowed = Math.min(leadLaps, race.cars.length - 2);
  if (race.eliminated >= allowed || racing.length < 2) return;
  const last = racing.reduce((a, b) => (b.place > a.place ? b : a));
  race.eliminated += 1;
  last.out = true;
  last.outOrder = race.eliminated;
  last.finished = true;
  last.finishTime = race.time;
  rank(race.cars, race.track.length);
}

/** planet: the First Planet the race is on (its form of the race); level: 1..3. */
export function createRace(seed = 0, planet?: string, level?: number): Race {
  const locationSeed = Number(seed) >>> 0;
  const mode = raceModeFor(planet, level ?? loadRaceLevel(planet));
  const track = buildTrack(locationSeed, planet, mode.level);
  track.halfWidth = mode.halfWidth;
  const hazards = layoutHazards(track, locationSeed, planet, mode.level);
  const race: Race = {
    seed: locationSeed,
    planet,
    mode,
    level: mode.level,
    laps: mode.laps,
    gates: layoutGates(track, locationSeed, mode),
    eliminated: 0,
    track,
    cars: ROSTER.map((spec, i) => makeCar(track, i, spec)),
    boxes: mode.items ? layoutBoxes(track, locationSeed) : [],
    traps: hazards.traps,
    mobs: hazards.mobs,
    slicks: [],
    time: 0,
    go: 0,
    storedBest: 0,
    step(dt, input, live) {
      if (!live) return;
      this.time += dt;
      this.go = Math.max(0, this.go - dt);
      for (const car of this.cars) stepCar(car, car.you ? input : aiDrive(car, this), dt, this);
      for (const box of this.boxes) {
        if (!box.alive) {
          box.cooldown -= dt;
          if (box.cooldown <= 0) box.alive = true;
          continue;
        }
        for (const car of this.cars) {
          if (car.item || car.finished) continue;
          const dx = car.x - box.x;
          const dz = car.z - box.z;
          if (dx * dx + dz * dz < 9.6) {
            car.item = rollItem(box.s + this.time);
            box.alive = false;
            box.cooldown = 11;
            break;
          }
        }
      }
      for (const mob of this.mobs) {
        mob.phase += dt * mob.rate;
        mob.lat = Math.sin(mob.phase) * mob.amp;
        const p = sampleAt(this.track, mob.s);
        mob.x = p.x + p.nx * mob.lat;
        mob.z = p.z + p.nz * mob.lat;
      }
      for (const car of this.cars) {
        if (car.hazardCd > 0) car.hazardCd = Math.max(0, car.hazardCd - dt);
        if (car.hazardCd === 0) car.hit = null;
        if (car.finished) continue;
        for (const trap of this.traps) {
          const dx = car.x - trap.x;
          const dz = car.z - trap.z;
          if (dx * dx + dz * dz < 7.2) strike(car, "trap");
        }
        for (const mob of this.mobs) {
          const dx = car.x - mob.x;
          const dz = car.z - mob.z;
          if (dx * dx + dz * dz < 5.8) strike(car, "mob");
        }
      }
      this.slicks = this.slicks.filter((slick) => {
        slick.life -= dt;
        if (slick.life <= 0) return false;
        this.cars.forEach((car, index) => {
          if (index === slick.owner && slick.life > 6.4) return;
          const dx = car.x - slick.x;
          const dz = car.z - slick.z;
          if (dx * dx + dz * dz < 10.9) car.slick = Math.max(car.slick, 1.15);
        });
        return true;
      });
      rank(this.cars, this.track.length);
      eliminate(this);
    },
    hud() {
      const you = this.cars[0];
      const gate = this.gates.length ? nextGate(this, you) : null;
      return {
        mode: this.mode.kind,
        title: this.mode.title,
        map: this.mode.map,
        rules: this.mode.rules,
        level: this.level,
        laps: this.laps,
        penalty: you.penalty,
        missed: you.missed,
        out: you.out,
        nextGate: gate ? gate.d : -1,
        lap: Math.min(this.laps, you.lapsDone + 1),
        time: this.time,
        lapTime: this.time - you.lapStart,
        bestLap: you.bestLap,
        storedBest: this.storedBest,
        speed: Math.abs(you.speed),
        place: you.place,
        total: this.cars.length,
        item: you.item,
        hazard: you.hazardCd > 0 ? you.hit : null,
        drift: Math.min(1, you.drift / 1.05),
        boosting: you.boost > 0,
        wrong: you.wrongT > 0.35,
        rows: [...this.cars]
          .sort((a, b) => a.place - b.place)
          .map((car) => ({
            name: car.name,
            you: car.you,
            place: car.place,
            done: car.finished,
            time: car.finished ? car.finishTime : this.time,
            color: car.color,
            out: car.out,
          })),
        go: this.go,
      };
    },
    reset() {
      // Same seed and planet; the level may have opened up after a win.
      const next = createRace(this.seed, this.planet);
      this.track = next.track;
      this.mode = next.mode;
      this.level = next.level;
      this.laps = next.laps;
      this.gates = next.gates;
      this.eliminated = 0;
      this.cars = next.cars;
      this.boxes = next.boxes;
      this.traps = next.traps;
      this.mobs = next.mobs;
      this.slicks = [];
      this.time = 0;
      this.go = 0.85;
      this.storedBest = next.storedBest;
    },
    respawnYou() {
      respawnCar(this.cars[0], this.track);
    },
  };
  if (typeof window !== "undefined") race.storedBest = loadStoredBest(planet);
  return race;
}
