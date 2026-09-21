import {
  APTITUDES,
  CREW,
  displayName,
  flyOk,
  hasApt,
  mismatch,
  tensorTier,
  type Aptitude,
  type Crew,
  type OfficialRarity,
  type TensorTier,
} from "@/data/crew";

export type SortKey = "tensor" | "official" | "n" | "c" | "name";

export type CrewQuery = {
  q: string;
  aptitudes: Aptitude[];
  slot: "any" | "major" | "minor";
  official: OfficialRarity[];
  tensor: TensorTier[];
  species: Crew["species"][];
  nMax: number;
  cMin: number;
  flyOnly: boolean;
  mismatchOnly: boolean;
  house: string | null;
  sort: SortKey;
};

export const EMPTY_QUERY: CrewQuery = {
  q: "",
  aptitudes: [],
  slot: "any",
  official: [],
  tensor: [],
  species: [],
  nMax: 100,
  cMin: 0,
  flyOnly: false,
  mismatchOnly: false,
  house: null,
  sort: "tensor",
};

export const PRESETS: { id: string; label: string; apply: Partial<CrewQuery> }[] = [
  { id: "all", label: "Все", apply: EMPTY_QUERY },
  {
    id: "tensor-gold",
    label: "Tensor золото",
    apply: { ...EMPTY_QUERY, tensor: ["anomaly", "legendary"], sort: "tensor" },
  },
  {
    id: "command",
    label: "Command",
    apply: { ...EMPTY_QUERY, aptitudes: ["Command"], sort: "tensor" },
  },
  {
    id: "rare-gem",
    label: "Алмаз Rare",
    apply: { ...EMPTY_QUERY, official: ["Rare"], sort: "tensor" },
  },
  {
    id: "jetjet",
    label: "Jetjet dual",
    apply: { ...EMPTY_QUERY, aptitudes: ["Operator", "Flight"], sort: "n" },
  },
  {
    id: "medics",
    label: "Медики",
    apply: { ...EMPTY_QUERY, aptitudes: ["Medical"], sort: "n" },
  },
  {
    id: "stick",
    label: "Штурвал",
    apply: { ...EMPTY_QUERY, aptitudes: ["Flight"], flyOnly: true, nMax: 60, cMin: 30, sort: "n" },
  },
  {
    id: "gummi",
    label: "Гамми",
    apply: { ...EMPTY_QUERY, species: ["High Punaab", "Profound Punaab"], sort: "n" },
  },
  {
    id: "ops",
    label: "Операторы",
    apply: { ...EMPTY_QUERY, aptitudes: ["Operator"], sort: "n" },
  },
  {
    id: "floor",
    label: "Пол-раритет",
    apply: { ...EMPTY_QUERY, mismatchOnly: true, sort: "tensor" },
  },
];

const OFFICIAL_RANK: Record<OfficialRarity, number> = {
  Anomaly: 0,
  Legendary: 1,
  Epic: 2,
  Rare: 3,
  Uncommon: 4,
  Common: 5,
};

export function filterCrew(query: CrewQuery, list: Crew[] = CREW): Crew[] {
  const needle = query.q.trim().toLowerCase();
  const out = list.filter((c) => {
    if (needle) {
      const blob = `${displayName(c)} ${c.house ?? ""} ${c.university ?? ""} ${c.note ?? ""}`.toLowerCase();
      if (!blob.includes(needle)) return false;
    }
    if (query.aptitudes.length) {
      const ok = query.aptitudes.every((a) =>
        hasApt(c, a, query.slot === "any" ? undefined : query.slot),
      );
      if (!ok) return false;
    }
    if (query.official.length && !query.official.includes(c.official)) return false;
    if (query.tensor.length) {
      const t = tensorTier(c.tensorRank);
      if (t === "unknown" || !query.tensor.includes(t)) return false;
    }
    if (query.species.length && !query.species.includes(c.species)) return false;
    if (c.n > query.nMax) return false;
    if (c.c < query.cMin) return false;
    if (query.flyOnly && !flyOk(c)) return false;
    if (query.mismatchOnly && !mismatch(c)) return false;
    if (query.house && c.house !== query.house) return false;
    return true;
  });

  out.sort((a, b) => {
    switch (query.sort) {
      case "official":
        return OFFICIAL_RANK[a.official] - OFFICIAL_RANK[b.official] || (a.tensorRank ?? 9e9) - (b.tensorRank ?? 9e9);
      case "n":
        return a.n - b.n;
      case "c":
        return b.c - a.c;
      case "name":
        return displayName(a).localeCompare(displayName(b));
      default:
        return (a.tensorRank ?? 9e9) - (b.tensorRank ?? 9e9);
    }
  });
  return out;
}

export function houses() {
  return [...new Set(CREW.map((c) => c.house).filter(Boolean))] as string[];
}

export { APTITUDES };
