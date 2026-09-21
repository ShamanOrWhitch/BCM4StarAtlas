export type Faction = "ONI" | "MUD" | "Ustur" | "ECOS" | "HRZ";

export type MarkerKind = "station" | "port" | "claim" | "core" | "yard";

export type Placement = "surface" | "orbit" | "hab";

export type Marker = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  kind: MarkerKind;
  placement: Placement;
  blurb: string;
  /** World offset from planet center. Only for orbit/hab. */
  orbit?: [number, number, number];
};

export type StarSystem = {
  id: string;
  name: string;
  planet: string;
  faction: Faction;
  texture: string;
  clouds?: string;
  atmosphere: string;
  sun: string;
  lore: string;
  markers: Marker[];
};

/** ONI CSS hangs off Akenat's limb from the default camera — not a surface pin. */
const ONI_CSS_ORBIT: [number, number, number] = [2.38, 0.78, 1.12];
const MUD_CSS_ORBIT: [number, number, number] = [2.32, 0.7, 1.18];
const USTUR_CSS_ORBIT: [number, number, number] = [2.28, 0.82, 1.05];

export const SYSTEMS: StarSystem[] = [
  {
    id: "oni",
    name: "ONI · Akenat",
    planet: "Akenat · Punaab homeworld",
    faction: "ONI",
    texture: "/textures/neptune.jpg",
    atmosphere: "#6ea8ff",
    sun: "#cfe4ff",
    lore: "SAGE C4: домашняя система ONI. Akenat — планета (гамми). ONI CSS — mothership 5+ км, висит на орбите, это не мир. Клеймы на грунт. Habs и крио — на станции.",
    markers: [
      {
        id: "oni-css",
        name: "ONI CSS",
        lat: 8,
        lng: 22,
        kind: "station",
        placement: "orbit",
        orbit: ONI_CSS_ORBIT,
        blurb: "Не планета — mothership 5+ км на орбите Akenat. Крио, верфь, habs. Лампа-1 отсюда.",
      },
      {
        id: "oni-uni",
        name: "UNI крио",
        lat: 8,
        lng: 22,
        kind: "station",
        placement: "hab",
        orbit: ONI_CSS_ORBIT,
        blurb: "Жилые отсеки на CSS, не на Akenat. Именные пакеты спят. Upkeep ноль, пока флот не выведен.",
      },
      {
        id: "oni-institute",
        name: "ONI Institute",
        lat: 8,
        lng: 24,
        kind: "yard",
        placement: "hab",
        orbit: ONI_CSS_ORBIT,
        blurb: "Универ на CSS. Koben, Seraimal, Tavia, Raurtawa. Не грунт планеты.",
      },
      {
        id: "oni-akenat",
        name: "Akenat",
        lat: 12,
        lng: -28,
        kind: "port",
        placement: "surface",
        blurb: "Планета под станцией. Родина Punaab. Порт и клеймы — сюда. CSS над ней, не вместо неё.",
      },
      {
        id: "oni-sz",
        name: "SZ кольцо",
        lat: 8,
        lng: 22,
        kind: "port",
        placement: "orbit",
        orbit: ONI_CSS_ORBIT,
        blurb: "Safe zone вокруг CSS, не вокруг планеты. Сюда лампа-1. Не MRZ.",
      },
      {
        id: "oni-rakh",
        name: "Rakhinit",
        lat: -48,
        lng: -90,
        kind: "claim",
        placement: "surface",
        blurb: "Руда на грунте. Radiation absorber. Клейм на станцию не ставится.",
      },
    ],
  },
  {
    id: "mud",
    name: "MUD · Pearce",
    planet: "Pearce analog · Mars",
    faction: "MUD",
    texture: "/textures/mars.jpg",
    atmosphere: "#ff8a5c",
    sun: "#ffd2a8",
    lore: "Домашняя система MUD. Планета внизу, MUD CSS висит отдельно. Люди: Shimadair, Takedaani, Elizondo, Estevess.",
    markers: [
      {
        id: "mud-css",
        name: "MUD CSS",
        lat: 16,
        lng: -40,
        kind: "station",
        placement: "orbit",
        orbit: MUD_CSS_ORBIT,
        blurb: "Хабы людей. Своя станция в своей системе. Не путать с ONI CSS.",
      },
      {
        id: "mud-pearce",
        name: "Pearce Yards",
        lat: 18.4,
        lng: -133,
        kind: "yard",
        placement: "surface",
        blurb: "X4. Скины ждут тел. Не первая цель.",
      },
      {
        id: "mud-academy",
        name: "MUD Academy",
        lat: 16,
        lng: -40,
        kind: "yard",
        placement: "hab",
        orbit: MUD_CSS_ORBIT,
        blurb: "На MUD CSS. Shimadair Xeny и Takedaani Elvira — лампа-2.",
      },
      {
        id: "mud-r4",
        name: "Claim R4",
        lat: -32,
        lng: -70,
        kind: "claim",
        placement: "surface",
        blurb: "T2 34 USDC — не с ядра. Клеймить раз в 4 дня или не брать.",
      },
    ],
  },
  {
    id: "ustur",
    name: "Ustur · Ioki",
    planet: "Ioki · Ustur homeworld",
    faction: "Ustur",
    texture: "/textures/venus.jpg",
    atmosphere: "#e8c07a",
    sun: "#ffe6b0",
    lore: "Ioki — родина роботов, не CSS. Ustur CSS на орбите. Season 0: вторжение Tufa на Ioki. Роботы не спят. Чинит инженер, не медик.",
    markers: [
      {
        id: "ustur-css",
        name: "Ustur CSS",
        lat: 10,
        lng: 20,
        kind: "station",
        placement: "orbit",
        orbit: USTUR_CSS_ORBIT,
        blurb: "Хабы роботов. Ночная смена патруля, пока гамми в крио. Не планета Ioki.",
      },
      {
        id: "ustur-ucu",
        name: "Ustur Central University",
        lat: 10,
        lng: 20,
        kind: "yard",
        placement: "hab",
        orbit: USTUR_CSS_ORBIT,
        blurb: "На CSS. Pricer .doer — Chi, когда гараж проснётся.",
      },
      {
        id: "ustur-ioki",
        name: "Ioki",
        lat: 41,
        lng: -72,
        kind: "port",
        placement: "surface",
        blurb: "Планета под CSS. Conquest: щит Ioki питают орбитальные станции.",
      },
      {
        id: "ustur-chi",
        name: "Chi dock",
        lat: -22,
        lng: 100,
        kind: "station",
        placement: "hab",
        orbit: USTUR_CSS_ORBIT,
        blurb: "Rainbow Chi в гараже CSS. Small, 1 экипаж, бак 4023.",
      },
    ],
  },
  {
    id: "ecos",
    name: "ECOS Greenhold",
    planet: "Garden moon · Luna",
    faction: "ECOS",
    texture: "/textures/moon.jpg",
    atmosphere: "#b7d4c2",
    sun: "#e8f0e4",
    lore: "Fimbul. 5 Airbike + Unibomba. Не Greenader. CSS сюда не ставится.",
    markers: [
      {
        id: "ecos-fimbul",
        name: "Fimbul sheds",
        lat: 20,
        lng: 4,
        kind: "yard",
        placement: "surface",
        blurb: "5 Airbike на кромке. Не в аренду.",
      },
      {
        id: "ecos-unibomba",
        name: "Unibomba",
        lat: -8,
        lng: -52,
        kind: "port",
        placement: "surface",
        blurb: "XX-Small epic. В сарае.",
      },
    ],
  },
  {
    id: "hrz",
    name: "HRZ · ядро",
    planet: "Storm giant · Jupiter",
    faction: "HRZ",
    texture: "/textures/jupiter.jpg",
    atmosphere: "#d9b48a",
    sun: "#ffe0b8",
    lore: "Треугольник трёх фракций. CSS сюда не едет. Скаут байками, не именными.",
    markers: [
      {
        id: "hrz-gate",
        name: "HRZ gate",
        lat: 12,
        lng: -24,
        kind: "core",
        placement: "surface",
        blurb: "Не слать Tiora + Arlinasija вместе. Сначала байки.",
      },
      {
        id: "hrz-storm",
        name: "Шторм",
        lat: -22,
        lng: -80,
        kind: "core",
        placement: "surface",
        blurb: "Центр треугольника. Выше добыча, выше потеря NFT.",
      },
    ],
  },
];

export const FACTION_TONE: Record<Faction, string> = {
  ONI: "#7f93c9",
  MUD: "#c45c4a",
  Ustur: "#c4a35a",
  ECOS: "#7fae8c",
  HRZ: "#9e8a70",
};

export function markerKey(systemId: string, markerId: string) {
  return `${systemId}:${markerId}`;
}

export function findMarker(systemId: string, markerId: string) {
  const sys = SYSTEMS.find((s) => s.id === systemId);
  return sys?.markers.find((m) => m.id === markerId) ?? null;
}

export function cssMarker(system: StarSystem) {
  return system.markers.find((m) => m.placement === "orbit" && m.kind === "station") ?? null;
}
