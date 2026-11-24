/**
 * Planet rules on foot (owner 24.11.2026: "прорабатывай разные механики на планетах"). Each planet
 * plays differently, not just looks different:
 *   Twinsun (first) — heat under two suns: it builds in the open, falls in shade (houses, mesas,
 *                     the oasis); overheated you walk slowly until you cool down.
 *   Ioki            — low gravity: a much higher jump and a slow fall.
 *   Pearce          — water is not a wall: you swim (slowly) on a breath meter; out of breath the
 *                     current washes you ashore.
 *   Fable           — a living planet (Neuno in the Star Atlas lore: sentient, with an "immune
 *                     system"): running over wild ground draws its attention, a quiet (stealth) step
 *                     calms it; at 60 vines tug at the feet, at 100 it pushes the pilot back to the
 *                     pad. Six glowing spores calm it and are gathered.
 *   Opus, the desert — the old rules (Opus has its carpet flight).
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
  living: boolean;
  hint: string;
};

const BASE: PlanetRules = { id: "", gravity: 1, jump: 1, fallCap: 60, swim: false, heat: false, living: false, hint: "" };

const RULES: Record<string, Partial<PlanetRules>> = {
  first: { heat: true, hint: "Два солнца: держись тени — домов, плато, оазиса" },
  ioki: { gravity: 0.32, jump: 1.08, fallCap: 6, hint: "Низкая гравитация: прыжок через вал кратера" },
  pearce: { swim: true, hint: "Озёра можно переплыть — следи за дыханием" },
  fable: { living: true, hint: "Планета живая: не беги по дикой земле, иди тихо (C — скрытно)" },
};

export function rulesFor(planet?: string): PlanetRules {
  const id = String(planet || "");
  return { ...BASE, ...(RULES[id] || {}), id };
}

export const WATER_LINE = -0.45;
export const HEAT = { gain: 4.2, cool: 14, coolBike: 6, overheat: 100, recover: 45, slow: 0.45 };
export const BREATH = { drain: 9, regen: 30, max: 100, afterRescue: 40 };

export const LIVING = { run: 9, walk: 1.5, quiet: 10, still: 6, town: 8, vines: 60, push: 100, afterPush: 35, spore: 30, vineSlow: 0.6, sporeR: 1.6 };

/** Fable spores: glowing pods on dry wild ground, clear of the town, the pad and every quest spot. */
export const FABLE_SPORES: Array<[number, number]> = [
  [-36, 4], [44, -30], [-22, -46], [28, 44], [-50, -22], [46, 10],
];

export type PlanetBody = {
  heat: number;
  overheated: boolean;
  breath: number;
  swimming: boolean;
  shoreX: number;
  shoreZ: number;
  note: string;
  noteFor: number;
  attention: number;
  vines: boolean;
  spores: Array<{ x: number; z: number; taken: boolean }>;
};

export function createBody(x: number, z: number): PlanetBody {
  return {
    heat: 0, overheated: false, breath: BREATH.max, swimming: false, shoreX: x, shoreZ: z, note: "", noteFor: 0,
    attention: 0, vines: false, spores: [],
  };
}

export function placeSpores(body: PlanetBody) {
  body.spores = FABLE_SPORES.map(([x, z]) => ({ x, z, taken: false }));
}

/** The settled places the living planet tolerates: the town and the pad. */
export function tamed(x: number, z: number) {
  return (Math.abs(x) < 18 && z > -10 && z < 26) || (z > 30 && Math.abs(x) < 14);
}

/**
 * Fable's attention for this step. mood/speed of the pilot on foot. Returns "push" when the planet
 * throws the pilot out (the sim moves them to the pad).
 */
export function stepLiving(body: PlanetBody, x: number, z: number, onFoot: boolean, mood: string, speed: number, dt: number) {
  const moving = Math.abs(speed) > 0.4;
  let rate: number;
  if (!onFoot || tamed(x, z)) rate = -LIVING.town;
  else if (mood === "stealth") rate = -LIVING.quiet;
  else if (!moving) rate = -LIVING.still;
  else if (mood === "sport" || Math.abs(speed) > 6.5) rate = LIVING.run;
  else rate = LIVING.walk;
  body.attention = Math.max(0, Math.min(LIVING.push, body.attention + rate * dt));
  const vines = onFoot && body.attention >= LIVING.vines;
  if (vines && !body.vines) say(body, "Вьюны тянутся к ногам — иди тише");
  body.vines = vines;
  for (const sp of body.spores) {
    if (sp.taken || (sp.x - x) ** 2 + (sp.z - z) ** 2 > LIVING.sporeR ** 2) continue;
    sp.taken = true;
    body.attention = Math.max(0, body.attention - LIVING.spore);
    say(body, `Спора собрана — планета затихает (${body.spores.filter((s) => s.taken).length}/${body.spores.length})`);
  }
  if (body.attention >= LIVING.push) {
    body.attention = LIVING.afterPush;
    body.vines = false;
    say(body, "Иммунный ответ: планета вытолкнула тебя к посадочной");
    return "push";
  }
  return "";
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
