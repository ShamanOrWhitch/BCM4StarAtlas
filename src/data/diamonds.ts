import type { OfficialRarity } from "./crew";

export const DIAMOND_ROWS: {
  rarity: OfficialRarity;
  recipe: string;
  trees: string;
  xp: string;
}[] = [
  { rarity: "Common", recipe: "1 major", trees: "1", xp: "+50%" },
  { rarity: "Uncommon", recipe: "1 major + 1 minor", trees: "2", xp: "+50 / +25" },
  { rarity: "Rare", recipe: "1 major + 2 minor", trees: "3", xp: "+50 / +25 / +25" },
  { rarity: "Epic", recipe: "2 major + 1 minor", trees: "3", xp: "+50 / +50 / +25" },
  { rarity: "Legendary", recipe: "3 major", trees: "3", xp: "+50 × 3" },
  { rarity: "Anomaly", recipe: "все minor или 2 major + 1 anomalous", trees: "много / 3", xp: "+25 все или +100" },
];

export const XP_RATES = [
  { slot: "нет слота", rate: "×1.00", note: "база" },
  { slot: "minor", rate: "×1.25", note: "+25% XP" },
  { slot: "major", rate: "×1.50", note: "+50% XP" },
  { slot: "anomalous", rate: "×2.00", note: "+100% XP · только алмаз Anomaly" },
];

export const STATIONS: { apt: string; seats: string }[] = [
  { apt: "Command", seats: "Admiral / Commander / Captain" },
  { apt: "Flight", seats: "Navigator / Pilot" },
  { apt: "Operator", seats: "орудия, дроны, риги" },
  { apt: "Engineering", seats: "Engineering Officer" },
  { apt: "Medical", seats: "Medical Officer" },
  { apt: "Science", seats: "Science Officer" },
  { apt: "Hospitality", seats: "камбуз, бар, сцена" },
  { apt: "Fitness", seats: "выносливость / пехота (слот позже)" },
];

export function diamondRecipe(rarity: OfficialRarity) {
  return DIAMOND_ROWS.find((r) => r.rarity === rarity)!;
}
