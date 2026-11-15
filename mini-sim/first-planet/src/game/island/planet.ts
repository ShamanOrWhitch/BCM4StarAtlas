/**
 * Which planet the island stands on (IDEA-002 / IDEA-014, owner 14.11.2026:
 * "построить через сектор ещё одной планеты для личных тестов, проработка
 * Ustur и MUD сектора по лору").
 *
 * The planet follows the SAGE sector the Warp left the ship in, through the
 * same Galia map Mini-Sim already carries (BCMSageMapCore.systemForSector):
 *   MUD CSS   [0, -39] → Pearce, Earth-like (owner: "MUD = Земля NASA")
 *   Ustur CSS [40, 30] → Ioki, the robots' red homeworld
 *   anywhere else      → First Planet, today's desert
 *   Fable    [-39, 31] → planet Fable, a Mini-Sim landmark with its own design
 * Step 1 changes sky, light, ground, sea and names. The island layout,
 * collisions and quests stay the same on every planet.
 *
 * Pure data and logic: no DOM, no THREE, so node --test can run it.
 */
export type PlanetId = "first" | "pearce" | "ioki" | "fable";

/**
 * Things only a planet with its own design draws (planet Fable). The three
 * 0.15.3 planets have no extras and must render exactly as before.
 */
export type PlanetExtras = {
  /** Number of stars on the sky dome (one Points draw call). */
  stars: number;
  /** Two colours of the aurora curtains, or null. */
  aurora: { low: number; high: number } | null;
  /** Drifting light motes over the island (one Points draw call). */
  motes: { color: number; count: number } | null;
  /** Colour of the ring drawn around the moon sprite, or null. */
  ring: string | null;
  /** Glowing veins painted into the ground colours. */
  veins: number | null;
  /** Emissive colour of the sea. */
  seaGlow: number | null;
};

export type PlanetLook = {
  id: PlanetId;
  /** Galia system id, or null for First Planet. */
  system: "mud" | "ustur" | null;
  kicker: string;
  title: string;
  blurb: string;
  sky: { top: number; mid: number; low: number };
  background: number;
  fog: { color: number; near: number; far: number };
  hemi: { sky: number; ground: number; intensity: number };
  sunSprite: { color: string; size: number };
  moonSprite: { color: string; size: number };
  sun: { color: number; intensity: number };
  fill: number;
  ground: { sand: number; wet: number; rock: number; grass: number; greenery: number };
  sea: { color: number; opacity: number; roughness: number };
  exposure: number;
  extras?: PlanetExtras;
};

export const PLANETS: Record<PlanetId, PlanetLook> = {
  /*
   * Planet Fable — designed by Claude Fable 5.2 at the owner's invitation
   * (16.11.2026: "строить свою планету со своим дизайном в другом секторе
   * рядом с ONI CSS"). Sector [-39, 31], one jump from the station.
   * A storybook night: violet zenith over a teal horizon, a pale ringed moon,
   * aurora curtains, a sea that glows from below, moss with luminous veins
   * and slow light motes. Lit brightly enough to read the crew and the houses.
   */
  fable: {
    id: "fable",
    system: null,
    kicker: "Fable · сектор [-39, 31] · посадочная",
    title: "Fable",
    blurb: "Тестовая планета рядом с ONI CSS. Здесь всегда поздний вечер: луна с кольцом, сияние над островом, светящееся море и огоньки над мхом.",
    sky: { top: 0x140a33, mid: 0x3a2a7a, low: 0x2fb7a6 },
    background: 0x1b1446,
    fog: { color: 0x2a2f6e, near: 42, far: 210 },
    hemi: { sky: 0x9fb4ff, ground: 0x1f4a48, intensity: 1.05 },
    sunSprite: { color: "#f3ecff", size: 40 },
    moonSprite: { color: "#7ef0d8", size: 16 },
    sun: { color: 0xcfd6ff, intensity: 1.05 },
    fill: 0x56e0c8,
    ground: { sand: 0x4a5f7a, wet: 0x2c8f8a, rock: 0x3a2f63, grass: 0x2f9c7c, greenery: 0.62 },
    sea: { color: 0x123a66, opacity: 0.92, roughness: 0.22 },
    exposure: 1.18,
    extras: {
      stars: 520,
      aurora: { low: 0x3affc0, high: 0x9a6bff },
      motes: { color: 0xbfffe6, count: 140 },
      ring: "#d9ccff",
      veins: 0x58ffd0,
      seaGlow: 0x0f6f8f,
    },
  },
  first: {
    id: "first",
    system: null,
    kicker: "Desert Island · посадочная",
    title: "Остров пустыни",
    blurb: "",
    sky: { top: 0x3d245c, mid: 0xff7a3a, low: 0xffc48a },
    background: 0xff7a3c,
    fog: { color: 0xe56a3a, near: 48, far: 200 },
    hemi: { sky: 0xffc4a0, ground: 0x7a3a32, intensity: 0.95 },
    sunSprite: { color: "#ffe08a", size: 58 },
    moonSprite: { color: "#ff6a4a", size: 30 },
    sun: { color: 0xffb15a, intensity: 1.35 },
    fill: 0xffc4a0,
    ground: { sand: 0xe3924e, wet: 0xc46a45, rock: 0x8a4038, grass: 0x3f7d68, greenery: 0 },
    sea: { color: 0x6a3d78, opacity: 0.86, roughness: 0.42 },
    exposure: 1.12,
  },
  pearce: {
    id: "pearce",
    system: "mud",
    kicker: "MUD · Pearce · посадочная",
    title: "Pearce",
    blurb: "Домашний мир MUD — аналог Земли: голубое небо, трава в глубине острова, синее море. MUD CSS висит отдельно на орбите.",
    sky: { top: 0x173a7a, mid: 0x6aa6e6, low: 0xdcebf5 },
    background: 0x8dbde6,
    fog: { color: 0xb4d0e4, near: 60, far: 240 },
    hemi: { sky: 0xd4e8ff, ground: 0x4e5a38, intensity: 0.92 },
    sunSprite: { color: "#fff6dc", size: 46 },
    moonSprite: { color: "#e6edf7", size: 18 },
    sun: { color: 0xfff1d6, intensity: 1.3 },
    fill: 0xbcd6ff,
    ground: { sand: 0xdac89c, wet: 0x9c8c6a, rock: 0x707066, grass: 0x4c8a3a, greenery: 0.72 },
    sea: { color: 0x1f6aa6, opacity: 0.9, roughness: 0.3 },
    exposure: 1.02,
  },
  ioki: {
    id: "ioki",
    system: "ustur",
    kicker: "Ustur · Ioki · посадочная",
    title: "Ioki",
    blurb: "Родина роботов Ustur. Сухой ржавый грунт, пыльное небо, на месте моря — пылевая котловина. Season 0: Tufa вторглись на Ioki.",
    sky: { top: 0x2a1a20, mid: 0xc4875a, low: 0xe9c79c },
    background: 0xc4875a,
    fog: { color: 0xb37249, near: 34, far: 160 },
    hemi: { sky: 0xf0c9a2, ground: 0x5c2a1c, intensity: 0.86 },
    sunSprite: { color: "#fff0d2", size: 30 },
    moonSprite: { color: "#d6c4b2", size: 12 },
    sun: { color: 0xffe0b4, intensity: 1.22 },
    fill: 0xe8b088,
    ground: { sand: 0xb4552f, wet: 0x7a3322, rock: 0x5a2a20, grass: 0x8a5c3c, greenery: 0 },
    sea: { color: 0x6e3424, opacity: 1, roughness: 1 },
    exposure: 1.05,
  },
};

const ALIASES: Record<string, PlanetId> = {
  first: "first",
  desert: "first",
  akenat: "first",
  oni: "first",
  pearce: "pearce",
  mud: "pearce",
  earth: "pearce",
  ioki: "ioki",
  ustur: "ioki",
  mars: "ioki",
  fable: "fable",
};

export function planetIdFrom(value: unknown): PlanetId | null {
  const key = String(value ?? "").trim().toLowerCase();
  return key && key in ALIASES ? ALIASES[key] : null;
}

export type PlanetInputs = {
  /** Explicit choice in the mount context (Tower can pass it later). */
  contextPlanet?: unknown;
  /** Owner test switch: ?bcm_planet=mud | ustur | first. */
  search?: string;
  /** window.BCMMiniSimSession.planetId, set by a test or a future landing menu. */
  sessionPlanet?: unknown;
  /** Sector the Warp left the ship in (BCMDeepSpaceWarpGetReturnSnapshot().current). */
  sector?: { x?: number | null; y?: number | null } | null;
  /** BCMSageMapCore.systemForSector, from the Galia map. */
  systemForSector?: ((x: number, y: number) => { id?: string } | null) | null;
  /** BCMSageMapCore.planetForSector: Mini-Sim landmark planets (Fable) and Galia systems. */
  planetForSector?: ((x: number, y: number) => { id?: string } | null) | null;
};

/** Order: context, URL test switch, session, then the Warp sector. */
export function resolvePlanetId(inputs: PlanetInputs): PlanetId {
  const direct = planetIdFrom(inputs.contextPlanet);
  if (direct) return direct;
  if (inputs.search) {
    try {
      const fromUrl = planetIdFrom(new URLSearchParams(inputs.search).get("bcm_planet"));
      if (fromUrl) return fromUrl;
    } catch {
      /* malformed query: ignore */
    }
  }
  const fromSession = planetIdFrom(inputs.sessionPlanet);
  if (fromSession) return fromSession;
  const s = inputs.sector;
  const lookup = inputs.planetForSector || inputs.systemForSector;
  if (s && s.x != null && s.y != null && Number.isFinite(Number(s.x)) && Number.isFinite(Number(s.y)) && lookup) {
    const system = lookup(Number(s.x), Number(s.y));
    const fromSector = planetIdFrom(system?.id);
    if (fromSector) return fromSector;
  }
  return "first";
}

export function planetLook(id: unknown): PlanetLook {
  return PLANETS[planetIdFrom(id) ?? "first"];
}
