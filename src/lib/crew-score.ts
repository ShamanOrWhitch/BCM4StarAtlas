import { APTITUDES, type Aptitude, type Crew } from "@/data/crew";

export type Influence = {
  helm: number;
  hull: number;
  scan: number;
  mission: number;
  hair: string | null;
  skin: string | null;
  ocean: boolean;
  line: string;
};

const LINE =
  "Мерка симулятора, не скрытая формула SAGE. Штурвал = Flight × (100−N) × C. Корпус = Engineering × C. Сенсор = Operator × (O и спокойствие). Задание собирает командование, штурвал, корпус, сенсор и медика; E и A чуть поднимают команду. Высокий N режет точные слоты.";

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function pct(n: number): number {
  return Math.round(clamp01(n) * 100);
}

function xpOf(slots: { name: string; xp: number }[], name: Aptitude): number {
  const hit = slots.find((slot) => slot.name === name);
  if (!hit) return 0;
  return hit.xp >= 50 ? 1 : hit.xp >= 25 ? 0.5 : clamp01(hit.xp / 50);
}

function score(slots: { name: string; xp: number }[], ocean: { o: number; c: number; e: number; a: number; n: number } | null): Omit<Influence, "hair" | "skin" | "line"> {
  const stability = ocean ? clamp01((100 - ocean.n) / 100) : 0.7;
  const focus = ocean ? clamp01(ocean.c / 100) : 0.5;
  const adapt = ocean ? clamp01(ocean.o / 100) : 0.5;
  const team = ocean ? clamp01((ocean.e + ocean.a) / 200) : 0.5;
  const helm = xpOf(slots, "Flight") * stability * (0.55 + 0.45 * focus);
  const hull = xpOf(slots, "Engineering") * (0.45 + 0.55 * focus);
  const scan = xpOf(slots, "Operator") * (0.5 * adapt + 0.5 * stability);
  const command = xpOf(slots, "Command");
  const medical = xpOf(slots, "Medical");
  const mission = (command * 0.34 + helm * 0.24 + hull * 0.18 + scan * 0.12 + medical * 0.12) * (0.82 + 0.18 * team);
  return { helm: pct(helm), hull: pct(hull), scan: pct(scan), mission: pct(mission), ocean: Boolean(ocean) };
}

export function influenceFromRoster(crew: Pick<Crew, "o" | "c" | "e" | "a" | "n" | "aptitudes">): Influence {
  return {
    ...score(crew.aptitudes, { o: crew.o, c: crew.c, e: crew.e, a: crew.a, n: crew.n }),
    hair: null,
    skin: null,
    line: LINE,
  };
}

function asNumber(value: string): number | null {
  const n = Number(String(value).replace("%", "").trim());
  return Number.isFinite(n) ? n : null;
}

export function influenceFromTraits(traits: { trait: string; value: string }[]): Influence | null {
  const slots: { name: string; xp: number }[] = [];
  const ocean = { o: NaN, c: NaN, e: NaN, a: NaN, n: NaN };
  let hair: string | null = null;
  let skin: string | null = null;
  for (const row of traits) {
    const trait = row.trait.trim();
    const value = row.value.trim();
    const apt = APTITUDES.find((name) => name.toLowerCase() === trait.toLowerCase());
    if (apt) {
      const raw = asNumber(value);
      const xp = raw == null ? (/major|50/i.test(value) ? 50 : 25) : raw > 1 ? raw : raw * 100;
      slots.push({ name: apt, xp });
      continue;
    }
    const key = trait.toLowerCase();
    const n = asNumber(value);
    if (n != null && n >= 0 && n <= 100) {
      if (/^o$|openness|открыт/.test(key)) ocean.o = n;
      else if (/^c$|conscient|дисцип|чеклист/.test(key)) ocean.c = n;
      else if (/^e$|extraver|экстра/.test(key)) ocean.e = n;
      else if (/^a$|agreeab|соглас/.test(key)) ocean.a = n;
      else if (/^n$|neurot|нерв/.test(key)) ocean.n = n;
    }
    if (/hair|причес|волос/.test(key)) hair = value;
    if (/skin|body|suit|costume|шкур/.test(key)) skin = value;
  }
  const hasOcean = [ocean.o, ocean.c, ocean.e, ocean.a, ocean.n].every((n) => Number.isFinite(n));
  if (!slots.length && !hasOcean && !hair && !skin) return null;
  return {
    ...score(slots, hasOcean ? ocean : null),
    hair,
    skin,
    line: LINE,
  };
}
