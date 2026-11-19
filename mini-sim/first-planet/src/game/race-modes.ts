// Forms of the Shoal Race per First Planet planet (owner 19.11.2026: "Виды гонок
// на планетах", "разные игры вместо гонок"). The same road maths, other rules:
//   laps         — Twinsun: three laps, item boxes and drift (the race as it was);
//   slalom       — Fable: gates of light down the road, a missed gate costs seconds;
//   elimination  — Opus: a narrow mountain road, the last car is out after each lap.
// Levels 1..3 per planet: a win opens the next level (faster rivals, tighter gates).

export type RaceKind = "laps" | "slalom" | "elimination";

export type RaceMode = {
  kind: RaceKind;
  planet: string;
  level: number;
  title: string;
  map: string;
  kicker: string;
  blurb: string;
  rules: string;
  laps: number;
  items: boolean;
  halfWidth: number;
  /** Added to the rivals' target speed (m/s). */
  rivalPace: number;
  /** Slalom: gates per lap, half-width of a gate, seconds for a miss. */
  gatesPerLap: number;
  gateHalf: number;
  penalty: number;
};

export const MAX_RACE_LEVEL = 3;

const LEVEL_KEY = "galia-shoal-level-v1";

function clampLevel(level: unknown) {
  const n = Math.floor(Number(level));
  return Number.isFinite(n) ? Math.min(MAX_RACE_LEVEL, Math.max(1, n)) : 1;
}

function readLevels(): Record<string, number> {
  try {
    const raw = JSON.parse(localStorage.getItem(LEVEL_KEY) || "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

/** The level open on this planet (1 until the first win). */
export function loadRaceLevel(planet?: string) {
  return clampLevel(readLevels()[planet || "first"] || 1);
}

/** A first place on this planet opens the next level; returns the level now open. */
export function recordRaceWin(planet?: string) {
  const levels = readLevels();
  const key = planet || "first";
  const next = clampLevel((Number(levels[key]) || 1) + 1);
  levels[key] = next;
  try {
    localStorage.setItem(LEVEL_KEY, JSON.stringify(levels));
  } catch {
    /* private window: the level just is not remembered */
  }
  return next;
}

export function raceModeFor(planet?: string, level?: number): RaceMode {
  const lv = clampLevel(level ?? 1);
  const up = lv - 1;
  if (planet === "fable") {
    return {
      kind: "slalom",
      planet,
      level: lv,
      title: "Слалом сияния",
      map: "Ночной берег ONI",
      kicker: "Fable · ONI CSS",
      blurb:
        "Ночью над ураганами Fable дорогу отмечают ворота сияния. Пройти надо каждые: промах — штраф ко времени. Предметов нет, только линия и дрифт.",
      rules: "ворота сияния, промах +" + (3 + up) + " с",
      laps: 2,
      items: false,
      halfWidth: 7.4,
      rivalPace: up * 2.2,
      gatesPerLap: 10 + up,
      gateHalf: 3.3 - up * 0.4,
      penalty: 3 + up,
    };
  }
  if (planet === "opus") {
    return {
      kind: "elimination",
      planet,
      level: lv,
      title: "Серпантин на выбывание",
      map: "Снежный серпантин Opus",
      kicker: "Opus · планета фокуса",
      blurb:
        "Узкая горная дорога под снежной вершиной. После каждого круга последний сходит с трассы — до финиша доезжают двое. Импульс и масло помогают удержаться.",
      rules: "после круга последний выбывает",
      laps: 3,
      items: true,
      halfWidth: 5.9,
      rivalPace: 0.8 + up * 2,
      gatesPerLap: 0,
      gateHalf: 0,
      penalty: 0,
    };
  }
  return {
    kind: "laps",
    planet: planet || "first",
    level: lv,
    title: "Спуск с Башни",
    map: "Берег Цитадели",
    kicker: "Galia · Tower exit",
    blurb:
      "Башня отпустила на воду. Внизу берег цитадели под двумя солнцами: три круга, предметы и дрифт.",
    rules: "предметы и дрифт",
    laps: 3,
    items: true,
    halfWidth: 7.4,
    rivalPace: up * 2,
    gatesPerLap: 0,
    gateHalf: 0,
    penalty: 0,
  };
}
