import MEDIA from "./ship-media.json";

export const SHIP_SIZES = ["XX-Small", "X-Small", "Small", "Medium", "Large"] as const;
export type ShipSize = (typeof SHIP_SIZES)[number];

export const SIZE_SPAN: Record<ShipSize, string> = {
  "XX-Small": "4–8 м",
  "X-Small": "8–14 м",
  Small: "30–35 м",
  Medium: "42–55 м",
  Large: "60–130 м",
};

export const SIZE_ABBR: Record<ShipSize, string> = {
  "XX-Small": "XXS",
  "X-Small": "XS",
  Small: "SML",
  Medium: "MED",
  Large: "LRG",
};

const SIZE_FROM: Record<string, ShipSize> = {
  "xx-small": "XX-Small",
  "x-small": "X-Small",
  small: "Small",
  medium: "Medium",
  large: "Large",
};

export type ShipStatus = "owned" | "garage" | "project" | "rent" | "watch";

export type Hull = {
  id: string;
  label: string;
  seats: { role: string; crewId: string | null }[];
};

export type CrewSlot = { type: string; n: number };

export type ShipLine = {
  id: string;
  name: string;
  size: ShipSize;
  spec: string;
  rarity: string;
  maker: string;
  status: ShipStatus;
  crew: number;
  crewSlots: CrewSlot[];
  length: number | null;
  supply: number | null;
  fuel: number | null;
  cargo: number | null;
  scan: number | null;
  count: number;
  images: string[];
  note: string;
  hulls: Hull[];
};

type Overlay = {
  status: ShipStatus;
  count: number;
  supply?: number | null;
  fuel?: number | null;
  cargo?: number | null;
  scan?: number | null;
  note: string;
  hulls?: Hull[];
};

const JETJETS: Hull[] = [
  {
    id: "jetjet-1",
    label: "Outro-1",
    seats: [
      { role: "кэп", crewId: "koben" },
      { role: "штурвал", crewId: "seraimal" },
    ],
  },
  {
    id: "jetjet-2",
    label: "MUD мед",
    seats: [
      { role: "штурвал", crewId: "shimadair" },
      { role: "медик", crewId: "takedaani" },
    ],
  },
  {
    id: "jetjet-3",
    label: "Гамми патруль",
    seats: [
      { role: "штурвал", crewId: "uusathar" },
      { role: "оператор", crewId: "urtelaorilve" },
    ],
  },
  {
    id: "jetjet-4",
    label: "Проба-1",
    seats: [
      { role: "штурвал", crewId: "viurneca" },
      { role: "оператор", crewId: "yarrindilpho" },
    ],
  },
  {
    id: "jetjet-5",
    label: "Ooniseth",
    seats: [
      { role: "оператор", crewId: "ooniseth" },
      { role: "штурвал", crewId: "arsamehafa" },
    ],
  },
  {
    id: "jetjet-6",
    label: "Резерв",
    seats: [
      { role: "штурвал", crewId: null },
      { role: "второй", crewId: null },
    ],
  },
];

const OVERLAY: Record<string, Overlay> = {
  airbike: {
    status: "owned",
    count: 5,
    supply: 375_000,
    fuel: 450,
    cargo: 86,
    scan: 4,
    note: "Глаза кромки. Не сдавать. Enyavana — высадка, не дрейф.",
    hulls: Array.from({ length: 5 }, (_, i) => ({
      id: `airbike-${i + 1}`,
      label: `Airbike ${i + 1}`,
      seats: [{ role: "пилот", crewId: i === 0 ? "enyavana" : null }],
    })),
  },
  unibomba: {
    status: "owned",
    count: 1,
    supply: 275_000,
    fuel: 801,
    cargo: 2143,
    scan: 11,
    note: "Лёгкий бомбер в сарае. Не Greenader.",
    hulls: [{ id: "unibomba-1", label: "Unibomba", seats: [{ role: "пилот", crewId: null }] }],
  },
  ruch: {
    status: "watch",
    count: 0,
    supply: 375_000,
    note: "Гамми-гонщик Akenat. Не Niruch — Ruch, XX-Small common, 1 пилот.",
  },
  x4: {
    status: "watch",
    count: 0,
    supply: 116_508,
    note: "Maglev patrol COP. XX-Small fighter. Не лампа кромки.",
  },
  jetjet: {
    status: "owned",
    count: 6,
    supply: 18_805,
    fuel: 1797,
    cargo: 863,
    scan: 22,
    note: "Кромка UNI/ONI CSS. Не в аренду. Лампа-1 — проба слабых. Шесть бортов.",
    hulls: JETJETS,
  },
  chi: {
    status: "garage",
    count: 1,
    supply: 8_000,
    fuel: 4023,
    cargo: 2464,
    scan: 82,
    note: "Лимитка в гараже. Fighter, не data runner. Не срывать.",
    hulls: [{ id: "chi-1", label: "Chi", seats: [{ role: "пилот", crewId: "pricer" }] }],
  },
  tufa: {
    status: "project",
    count: 0,
    supply: 7_000,
    fuel: 3193,
    cargo: 3214,
    scan: 161,
    note: "Epic fighter. Засада/дрейф. Оператор главный. Не с ядра.",
    hulls: [
      {
        id: "tufa-1",
        label: "Outro-наука",
        seats: [
          { role: "оператор", crewId: "deceon" },
          { role: "наука", crewId: "tavia" },
        ],
      },
    ],
  },
  om: {
    status: "rent",
    count: 0,
    supply: 2_122,
    fuel: 18661,
    cargo: 39332,
    scan: 64,
    note: "Конверт. В собственность не брать. Аренда только на жирный рейс >5k груза. 4 слота, не 5.",
    hulls: [
      {
        id: "om-rent",
        label: "Прокат",
        seats: [
          { role: "пилот", crewId: "deceon" },
          { role: "навигатор", crewId: "tavia" },
          { role: "орудия", crewId: null },
          { role: "орудия", crewId: null },
        ],
      },
    ],
  },
  "mamba-ex": {
    status: "watch",
    count: 0,
    supply: 5_081,
    note: "Medium bounty hunter, 5 экипаж. Не large. Не в мини-флот кромки.",
  },
  compakt: {
    status: "watch",
    count: 0,
    supply: 1_233,
    note: "Calico Compakt Hero. Medium multi-role, 4 экипаж, 9 пассажиров.",
  },
  arc: {
    status: "watch",
    count: 0,
    supply: 820,
    note: "Большой Rainbow-фрейтер. Архитектура, 14 экипаж. Не дом гамми — это Sunpaa.",
  },
  sunpaa: {
    status: "watch",
    count: 0,
    supply: 1_400,
    note: "Любимый большой корабль гамми. Ogrika luxury freighter, 19 экипаж.",
  },
  r8: {
    status: "watch",
    count: 0,
    supply: 1_200,
    note: "Заправщик/ремонт Pearce. Два бака + руки. 15 экипаж.",
  },
  bitboat: {
    status: "watch",
    count: 0,
    supply: 1_600,
    note: "Кит-доставщик. Large transport, 21 слот, 65 пассажиров. Виды, не бой.",
  },
  greenader: {
    status: "watch",
    count: 0,
    supply: 772,
    note: "Большой момбер. Чиловый дом. Не Unibomba и не в мини-флот.",
  },
};

const ORDER = [
  "airbike",
  "unibomba",
  "ruch",
  "x4",
  "jetjet",
  "chi",
  "tufa",
  "om",
  "mamba-ex",
  "compakt",
  "arc",
  "sunpaa",
  "r8",
  "bitboat",
  "greenader",
];

function titleSpec(s: string) {
  if (s === "refuel/repair") return "Refuel / Repair";
  if (s === "bounty hunter") return "Bounty Hunter";
  if (s === "multi-role") return "Multi-Role";
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function titleWord(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export const SHIPS: ShipLine[] = ORDER.map((id) => {
  const m = MEDIA.find((x) => x.id === id);
  const o = OVERLAY[id];
  if (!m || !o) throw new Error(`ship ${id}`);
  return {
    id,
    name: m.name,
    size: SIZE_FROM[m.size],
    spec: titleSpec(m.spec),
    rarity: titleWord(m.rarity),
    maker: m.maker,
    status: o.status,
    crew: m.crew,
    crewSlots: m.crewSlots,
    length: m.length,
    supply: o.supply ?? null,
    fuel: o.fuel ?? null,
    cargo: o.cargo ?? null,
    scan: o.scan ?? null,
    count: o.count,
    images: m.images,
    note: o.note,
    hulls: o.hulls ?? [],
  };
});

export const STATUS_LABEL: Record<ShipStatus, string> = {
  owned: "в ангаре",
  garage: "гараж / лимитка",
  project: "проект",
  rent: "только аренда",
  watch: "витрина",
};

export function formatSupply(n: number | null) {
  if (n == null) return "—";
  return n.toLocaleString("ru-RU");
}
