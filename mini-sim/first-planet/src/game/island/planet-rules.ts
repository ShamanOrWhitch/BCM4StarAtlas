/**
 * Planet rules on foot (owner 24.11.2026: "прорабатывай разные механики на планетах"). Each planet
 * plays differently, not just looks different:
 *   Twinsun (first) — heat under two suns: it builds in the open, falls in shade (houses, mesas,
 *                     the oasis); overheated you walk slowly until you cool down.
 *   Ioki            — low gravity: a much higher jump and a slow fall.
 *   Pearce          — water is not a wall: you swim (slowly) on a breath meter; out of breath the
 *                     current washes you ashore.
 *   Fable, Opus, the desert — the old rules (Opus has its carpet flight).
 * Pure: no THREE, no DOM. The sim calls these from its foot step.
 */
import { HOUSES, TWINSUN_MESAS, groundY } from "./terrain";

export type PlanetRules = {
  id: string;
  gravity: number; // multiplier on the foot gravity
  jump: number; // multiplier on the jump speed
  fallCap: number; // fastest fall, m/s
  swim: boolean;
  heat: boolean;
  hint: string;
};

const BASE: PlanetRules = { id: "", gravity: 1, jump: 1, fallCap: 60, swim: false, heat: false, hint: "" };

const RULES: Record<string, Partial<PlanetRules>> = {
  first: { heat: true, hint: "Два солнца: держись тени — домов, плато, оазиса" },
  ioki: { gravity: 0.32, jump: 1.08, fallCap: 6, hint: "Низкая гравитация: прыжок через вал кратера" },
  pearce: { swim: true, hint: "Озёра можно переплыть — следи за дыханием" },
};

export function rulesFor(planet?: string): PlanetRules {
  const id = String(planet || "");
  return { ...BASE, ...(RULES[id] || {}), id };
}

export const WATER_LINE = -0.45;
export const HEAT = { gain: 4.2, cool: 14, coolBike: 6, overheat: 100, recover: 45, slow: 0.45 };
export const BREATH = { drain: 9, regen: 30, max: 100, afterRescue: 40 };

export type PlanetBody = {
  heat: number;
  overheated: boolean;
  breath: number;
  swimming: boolean;
  shoreX: number;
  shoreZ: number;
  note: string;
  noteFor: number;
};

export function createBody(x: number, z: number): PlanetBody {
  return { heat: 0, overheated: false, breath: BREATH.max, swimming: false, shoreX: x, shoreZ: z, note: "", noteFor: 0 };
}

/** Twinsun shade: inside or right beside a house, at the foot of a mesa, in the oasis. */
export function inShade(x: number, z: number) {
  for (const h of HOUSES) {
    if (Math.abs(x - h.x) < h.w / 2 + 1.6 && Math.abs(z - h.z) < h.d / 2 + 1.6) return true;
  }
  for (const m of TWINSUN_MESAS) if (Math.hypot(x - m.x, z - m.z) < m.r + 4) return true;
  if (Math.hypot(x - 2.4, z + 17) < 9) return true; // the oasis
  return false;
}

function say(body: PlanetBody, text: string) {
  body.note = text;
  body.noteFor = 2.6;
}

/** Heat for this step. walking: on foot (riding cools in the wind). */
export function stepHeat(body: PlanetBody, x: number, z: number, onFoot: boolean, dt: number) {
  const shade = inShade(x, z);
  if (onFoot && !shade) body.heat = Math.min(HEAT.overheat, body.heat + HEAT.gain * dt);
  else body.heat = Math.max(0, body.heat - (shade ? HEAT.cool : HEAT.coolBike) * dt);
  if (!body.overheated && body.heat >= HEAT.overheat) {
    body.overheated = true;
    say(body, "Перегрев! Ищи тень — дом, плато или оазис");
  } else if (body.overheated && body.heat <= HEAT.recover) {
    body.overheated = false;
    say(body, "Остыл — можно идти дальше");
  }
  return shade;
}

/**
 * Water for this step: where the pilot floats, and whether the breath ran out. Returns the feet
 * height to use (the water surface minus the body) or null when the pilot is on dry ground.
 */
export function stepWater(body: PlanetBody, x: number, z: number, ground: number, dt: number) {
  const wet = ground < WATER_LINE - 0.05;
  if (!wet) {
    if (body.swimming) say(body, "На берегу");
    body.swimming = false;
    body.breath = Math.min(BREATH.max, body.breath + BREATH.regen * dt);
    body.shoreX = x;
    body.shoreZ = z;
    return { floatY: null as number | null, rescued: false };
  }
  if (!body.swimming) say(body, "Плывёшь — дыхание тратится");
  body.swimming = true;
  body.breath = Math.max(0, body.breath - BREATH.drain * dt);
  if (body.breath <= 0) {
    body.swimming = false;
    body.breath = BREATH.afterRescue;
    say(body, "Выдохся — течение вынесло на берег");
    return { floatY: null, rescued: true };
  }
  return { floatY: Math.max(ground, WATER_LINE - 0.95), rescued: false };
}

/** A dry spot to wash ashore on: the last dry footstep, nudged off the water if needed. */
export function shoreFor(body: PlanetBody) {
  let x = body.shoreX;
  let z = body.shoreZ;
  for (let i = 0; i < 20 && groundY(x, z) < WATER_LINE; i += 1) {
    x *= 0.95;
    z *= 0.95;
  }
  return { x, z };
}
