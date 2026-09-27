import {
  APTITUDES,
  OFFICIAL,
  SPECIES,
  type Aptitude,
  type Crew,
  type OfficialRarity,
  type Species,
} from "@/data/crew";
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
    return {
      id: item.mint,
      given,
      family: species === "Ustur" ? "" : rest,
      ustur: species === "Ustur" ? rest : undefined,
      species,
      sex,
      official: rarityOf(item.rarity),
      tensorRank: null,
      aptitudes,
      o: ocean(item.traits, "Openness"),
      c: ocean(item.traits, "Conscientiousness"),
      e: ocean(item.traits, "Extraversion"),
      a: ocean(item.traits, "Agreeableness"),
      n: ocean(item.traits, "Neuroticism"),
      image: item.image || undefined,
      note: "Карточка с ключа. OCEAN и навык — из Galaxy /crew или метадаты NFT, не из старого списка.",
    } satisfies Crew;
  });
}
