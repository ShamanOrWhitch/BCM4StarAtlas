import {
  APTITUDES,
  CREW,
  OFFICIAL,
  SPECIES,
  displayName,
  type Aptitude,
  type Crew,
  type OfficialRarity,
  type Species,
} from "@/data/crew";
import { SHIPS } from "@/data/ships";
import type { WalletItem, WalletTrait } from "@/lib/desk-types";

function trait(traits: WalletTrait[], name: string): string {
  const hit = traits.find((row) => row.trait.toLowerCase() === name.toLowerCase());
  return hit?.value ?? "";
}

function ocean(traits: WalletTrait[], name: string): number {
  const raw = Number(trait(traits, name));
  if (!Number.isFinite(raw)) return 50;
  const n = raw <= 1 ? raw * 100 : raw;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function speciesOf(value: string): Species {
  const hit = SPECIES.find((item) => item.toLowerCase() === value.toLowerCase());
  if (hit) return hit;
  if (/high/i.test(value) && /punaab/i.test(value)) return "High Punaab";
  if (/punaab/i.test(value)) return "Profound Punaab";
  if (/ustur/i.test(value)) return "Ustur";
  if (/sogm/i.test(value)) return "Sogmian";
  if (/miere/i.test(value)) return "Mierese";
  if (/human/i.test(value)) return "Human";
  return "Human";
}

function keyOf(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

const KNOWN = CREW.map((crew) => ({
  crew,
  name: keyOf(displayName(crew)),
  given: keyOf(crew.given),
  rest: keyOf(crew.family || crew.ustur || ""),
}));

function knownCrew(name: string) {
  const key = keyOf(name);
  return KNOWN.find((row) => row.name === key || (row.given.length > 3 && row.rest.length > 1 && key.includes(row.given) && key.includes(row.rest)))?.crew;
}
function rarityOf(value: string): OfficialRarity {
  const hit = OFFICIAL.find((item) => item.toLowerCase() === value.toLowerCase());
  return hit ?? "Common";
}

export function walletCrew(items: WalletItem[]): Crew[] {
  return items.filter((item) => item.kind === "crew").map((item) => {
    const species = speciesOf(trait(item.traits, "Species") || item.spec);
    const aptitudes = item.traits
      .filter((row) => APTITUDES.some((name) => name.toLowerCase() === row.trait.toLowerCase()))
      .map((row) => {
        const name = APTITUDES.find((apt) => apt.toLowerCase() === row.trait.toLowerCase()) as Aptitude;
        const xp = /minor|25/i.test(row.value) ? 25 : 50;
        return { name, xp } as const;
      });
    const parts = item.name.trim().split(/\s+/);
    const given = parts[0] || item.name;
    const rest = parts.slice(1).join(" ");
    const sexRaw = trait(item.traits, "Sex");
    const sex = sexRaw === "Female" || sexRaw === "Male" || sexRaw === "Body 1" || sexRaw === "Body 2" ? sexRaw : species === "Ustur" ? "Body 1" : "Male";
    const known = knownCrew(item.name);
    return {
      id: item.mint,
      given,
      family: species === "Ustur" ? "" : rest,
      ustur: species === "Ustur" ? rest : undefined,
      species,
      sex,
      official: rarityOf(item.rarity),
      tensorRank: known?.tensorRank ?? null,
      house: known?.house,
      university: known?.university,
      aptitudes,
      o: ocean(item.traits, "Openness"),
      c: ocean(item.traits, "Conscientiousness"),
      e: ocean(item.traits, "Extraversion"),
      a: ocean(item.traits, "Agreeableness"),
      n: ocean(item.traits, "Neuroticism"),
      image: item.image || undefined,
      note: known?.tensorRank != null ? `Tensor #${known.tensorRank}. Цифры OCEAN с карточки на ключе.` : "Карточка с ключа.",
    } satisfies Crew;
  });
}

const SLOT_APT: Array<[RegExp, Aptitude]> = [
  [/pilot|flight|helm/i, "Flight"],
  [/nav|operator|scan/i, "Operator"],
  [/capt|command/i, "Command"],
  [/eng/i, "Engineering"],
  [/med/i, "Medical"],
  [/hosp|steward/i, "Hospitality"],
  [/scien/i, "Science"],
  [/fit|marine|gunner/i, "Fitness"],
];

function slotApt(type: string): Aptitude | null {
  return SLOT_APT.find(([pattern]) => pattern.test(type))?.[1] ?? null;
}

export type FleetHold = {
  name: string;
  count: number;
  listed: number;
  need: string;
  have: string;
  ok: boolean;
};

export function walletFleet(items: WalletItem[], crew: Crew[]): FleetHold[] {
  const out: FleetHold[] = [];
  for (const line of SHIPS) {
    const owned = items.filter((item) => item.kind === "ship" && item.className !== "order" && keyOf(item.name).includes(keyOf(line.name)));
    const listed = items.filter((item) => item.kind === "ship" && item.className === "order" && keyOf(item.name).includes(keyOf(line.name)));
    const count = owned.reduce((sum, item) => sum + item.amount, 0);
    const onBook = listed.reduce((sum, item) => sum + item.amount, 0);
    if (count + onBook <= 0) continue;
    const hulls = count + onBook;
    const parts = line.crewSlots
      .map((slot) => {
        const apt = slotApt(slot.type);
        if (!apt) return null;
        const need = slot.n * hulls;
        const have = crew.filter((member) => member.aptitudes.some((row) => row.name === apt)).length;
        return { apt, need, have };
      })
      .filter((part): part is { apt: Aptitude; need: number; have: number } => part != null);
    out.push({
      name: line.name,
      count,
      listed: onBook,
      need: parts.map((part) => `${part.apt} ${part.need}`).join(", "),
      have: parts.map((part) => `${part.apt} ${part.have}`).join(", "),
      ok: parts.every((part) => part.have >= part.need),
    });
  }
  return out;
}
