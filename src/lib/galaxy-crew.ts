import type { WalletItem, WalletTrait } from "./desk-types";

/**
 * Real crew names and portraits from the Galaxy crew catalogue (BUG-007).
 *
 * On chain a crew NFT is only "CREW #1010495"; the person ("Aanothin
 * Thalaramgroo"), the portrait (cdn.staratlas.com/crew/v1/<n>_full.jpeg),
 * species, sex, OCEAN and aptitudes live in Galaxy. Galaxy /crew without a
 * filter returns only the first 100 crew, so a wallet's own crew is asked for
 * by mint, in batches: /crew?dasID=<mint>&dasID=<mint>…
 *
 * Shared by the Render wallet scan (desk.impl.ts) and the browser reader
 * (desk-direct.ts). Mini-Sim does the same in PHP
 * (bcm_mini_sim_galaxy_crew_for_mints).
 */
export const GALAXY_CREW = "https://galaxy.staratlas.com/crew";
const BATCH = 40;

export type GalaxyCrewRow = Record<string, unknown>;

export async function galaxyCrewByMint(
  mints: string[],
  getJson: (url: string) => Promise<unknown>,
): Promise<Map<string, GalaxyCrewRow>> {
  const out = new Map<string, GalaxyCrewRow>();
  const wanted = [...new Set(mints.filter(Boolean))];
  const batches: string[][] = [];
  for (let i = 0; i < wanted.length; i += BATCH) batches.push(wanted.slice(i, i + BATCH));
  const answers = await Promise.all(
    batches.map((batch) => {
      const query = batch.map((mint) => "dasID=" + encodeURIComponent(mint)).join("&");
      return getJson(GALAXY_CREW + "?" + query).catch(() => null);
    }),
  );
  for (const rows of answers) {
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      const mint = row && typeof row === "object" ? String((row as GalaxyCrewRow).dasID ?? "") : "";
      if (mint) out.set(mint, row as GalaxyCrewRow);
    }
  }
  return out;
}

function ocean(value: unknown): string | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return String(n <= 1 ? Math.round(n * 100) / 100 : n);
}

/** The person's name, never the chain number. */
export function galaxyCrewName(row: GalaxyCrewRow): string {
  const name = String(row.name ?? "").trim();
  return name && !/^crew\s*#?\s*\d*$/i.test(name) ? name : "";
}

/** Fill a wallet crew item from its Galaxy row; chain data stays where Galaxy has none. */
export function withGalaxyCrew(item: WalletItem, row: GalaxyCrewRow | undefined): WalletItem {
  if (!row) return item;
  // The chain "name" trait is the number again; the person comes from Galaxy.
  const traits: WalletTrait[] = item.traits
    .filter((t) => t.trait.toLowerCase() !== "name")
    .map((t) => ({ ...t }));
  const set = (trait: string, value: string | null, keep = false) => {
    if (value == null || value === "") return;
    const hit = traits.find((t) => t.trait.toLowerCase() === trait.toLowerCase());
    if (hit) {
      if (!keep) hit.value = value;
    } else traits.push({ trait, value });
  };
  // OCEAN: each reader keeps its own scale (the server shows 0–100); Galaxy only fills gaps.
  set("Openness", ocean(row.openness), true);
  set("Conscientiousness", ocean(row.conscientiousness), true);
  set("Extraversion", ocean(row.extraversion), true);
  set("Agreeableness", ocean(row.agreeableness), true);
  set("Neuroticism", ocean(row.neuroticism), true);
  if (row.aptitudes && typeof row.aptitudes === "object") {
    for (const [name, level] of Object.entries(row.aptitudes as Record<string, unknown>)) set(name, String(level ?? "major"));
  }
  set("Species", row.species ? String(row.species) : null);
  set("Sex", row.sex ? String(row.sex) : null);
  return {
    ...item,
    name: galaxyCrewName(row) || item.name,
    image: typeof row.imageUrl === "string" && row.imageUrl ? row.imageUrl : item.image,
    rarity: row.rarity ? String(row.rarity) : item.rarity,
    spec: row.species ? String(row.species) : item.spec,
    traits,
  };
}

/** Name and portrait every crew item in a scan from Galaxy (one or a few requests). */
export async function nameWalletCrew(items: WalletItem[], getJson: (url: string) => Promise<unknown>): Promise<WalletItem[]> {
  const crew = items.filter((item) => item.kind === "crew");
  if (!crew.length) return items;
  const rows = await galaxyCrewByMint(
    crew.map((item) => item.mint),
    getJson,
  );
  return items.map((item) => (item.kind === "crew" ? withGalaxyCrew(item, rows.get(item.mint)) : item));
}
