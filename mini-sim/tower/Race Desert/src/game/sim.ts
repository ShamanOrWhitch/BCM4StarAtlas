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
};

export type Box = {
  s: number;
  lat: number;
  x: number;
  z: number;
  alive: boolean;
  cooldown: number;
};

export type Slick = { x: number; z: number; life: number; owner: number };

export type DriveInput = {
  throttle: number;
  brake: number;
  steer: number;
  drift: boolean;
  use: boolean;
};

export type StandingsRow = {
  name: string;
  you: boolean;
  place: number;
  done: boolean;
  time: number;
  color: number;
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
  drift: number;
  boosting: boolean;
  wrong: boolean;
  rows: StandingsRow[];
  go: number;
};

const BEST_KEY = "galia-shoal-v1";

export function loadStoredBest() {
  try {
    const raw = JSON.parse(localStorage.getItem(BEST_KEY) || "");
    return typeof raw.bestLap === "number" && raw.bestLap > 0 ? raw.bestLap : 0;
  } catch {
    return 0;
  }
}

export function saveStoredBest(bestLap: number) {
  if (!(bestLap > 0)) return;
  const prev = loadStoredBest();
  if (prev > 0 && prev <= bestLap) return;
  localStorage.setItem(BEST_KEY, JSON.stringify({ v: 1, bestLap }));
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
  };
}

function rollItem(nudge: number): ItemKind {
  const r = Math.abs(Math.sin(nudge * 12.9898) * 43758.5453) % 1;
  if (r < 0.42) return "solar";
  if (r < 0.74) return "slick";
  return "pulse";
}

export type Race = {
  track: Track;
  cars: Car[];
  boxes: Box[];
  slicks: Slick[];
  time: number;
  go: number;
  storedBest: number;
  step: (dt: number, input: DriveInput, live: boolean) => void;
  hud: () => Hud;
  reset: () => void;
  respawnYou: () => void;
};

function layoutBoxes(track: Track): Box[] {
  const marks = [0.12, 0.27, 0.41, 0.55, 0.7, 0.86];
  return marks.map((fraction, i) => {
    const s = fraction * track.length;
    const p = sampleAt(track, s);
    const lat = i % 2 === 0 ? 2.4 : -2.4;
    return { s, lat, x: p.x + p.nx * lat, z: p.z + p.nz * lat, alive: true, cooldown: 0 };
  });
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
}

function progress(car: Car, length: number) {
  return car.lapsDone * length + car.s;
}

function rank(cars: Car[], length: number) {
  const order = cars.map((_, i) => i);
  order.sort((ia, ib) => {
    const a = cars[ia];
    const b = cars[ib];
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
  const ahead = sampleAt(track, car.s + look);
  const desired = Math.atan2(
    -(ahead.x + ahead.nx * car.aiOffset - car.x),
    -(ahead.z + ahead.nz * car.aiOffset - car.z),
  );
  let err = desired - car.yaw;
  while (err > Math.PI) err -= Math.PI * 2;
  while (err < -Math.PI) err += Math.PI * 2;
  const steer = Math.min(1, Math.max(-1, err / 0.55));
  const curve = sampleAt(track, car.s + 20).curvature;
  const you = race.cars[0];
  let target = 33.5 - curve * 150;
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
    drift: Math.abs(err) > 0.5 && car.speed > 20,
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
  const wantDrift = input.drift && sp > 9 && Math.abs(input.steer) > 0.15 && !car.finished;
  car.yaw += input.steer * (wantDrift ? 2.45 : 2.05) * speedFactor * reverse * dt;

  if (wantDrift) {
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
    const gateS = track.checkpoints[car.gate];
    if (!car.finished && crossedForward(prev, car.s, gateS, track.length)) {
      if (car.gate === 0) {
        const lapT = race.time - car.lapStart;
        if (lapT > 1 && (car.bestLap === 0 || lapT < car.bestLap)) car.bestLap = lapT;
        car.lapStart = race.time;
        car.lapsDone += 1;
        car.gate = 1;
        if (car.lapsDone >= LAPS) {
          car.finished = true;
          car.finishTime = race.time;
          if (car.you) {
            saveStoredBest(car.bestLap);
            race.storedBest = loadStoredBest();
          }
        }
      } else {
        car.gate += 1;
        if (car.gate >= track.checkpoints.length) car.gate = 0;
      }
    }
  }

  if (sp < 2.5 && !car.finished) car.stuck += dt;
  else car.stuck = 0;
  if (car.ai && car.stuck > 3.2) respawnCar(car, track);
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

export function createRace(): Race {
  const track = buildTrack();
  const race: Race = {
    track,
    cars: ROSTER.map((spec, i) => makeCar(track, i, spec)),
    boxes: layoutBoxes(track),
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
    },
    hud() {
      const you = this.cars[0];
      return {
        lap: Math.min(LAPS, you.lapsDone + 1),
        time: this.time,
        lapTime: this.time - you.lapStart,
        bestLap: you.bestLap,
        storedBest: this.storedBest,
        speed: Math.abs(you.speed),
        place: you.place,
        total: this.cars.length,
        item: you.item,
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
          })),
        go: this.go,
      };
    },
    reset() {
      const next = createRace();
      this.cars = next.cars;
      this.boxes = next.boxes;
      this.slicks = [];
      this.time = 0;
      this.go = 0.85;
      this.storedBest = next.storedBest;
    },
    respawnYou() {
      respawnCar(this.cars[0], this.track);
    },
  };
  if (typeof window !== "undefined") race.storedBest = loadStoredBest();
  return race;
}
