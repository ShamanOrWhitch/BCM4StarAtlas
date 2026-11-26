import { activeKeys, readTilt } from "@/game/input";
import {
  BIKE_PARK,
  BRAZIERS,
  CHEST,
  CRYSTALS,
  HOUSES,
  JOURNAL,
  JAHMAN,
  KEY_SPOT,
  NPC,
  RING,
  SKY_NOTE,
  SPAWN,
  STORY_BOX,
  TAPES,
  TOWER_GATE,
  footY,
  houseAabbs,
  hoverFloor,
  regionName,
  surfaceY,
  type Aabb,
} from "./terrain";
import { HEAT, LIVING, createBody, placeSpores, rulesFor, shoreFor, stepHeat, stepLiving, stepWater, type PlanetBody } from "./planet-rules";
import { buyUpgrade, captureNode, createCarpet, nextUpgrade, stepCarpet, type CarpetState } from "./carpet";
import { applyLayout } from "./layout";
import { planetContent, type PlanetContent, type QuestKind } from "./content";

const SAVE_KEY = "desert-island-v1";

export type Quest = "new" | "go" | "done";

export type Dialogue = { who: string; pages: string[]; i: number; commit: Quest | null; quest: QuestId | null };

export type QuestId = "sera" | "orr" | "bulb";

type Save = {
  v: 2;
  crystals: boolean[];
  key: boolean;
  fires: boolean[];
  quests: Record<QuestId, Quest>;
  coins: number;
  chest: boolean;
  tapes: string[];
  selectedTape: string;
  /** relay quests whose item was handed over (IDEA-021). */
  relay?: Partial<Record<QuestId, boolean>>;
};

export type IslandHud = {
  mode: "foot" | "bike";
  flightMode: boolean;
  speed: number;
  alt: number;
  region: string;
  prompt: string;
  dialogue: Dialogue | null;
  quests: { id: QuestId; title: string; status: string }[];
  coins: number;
  crystals: number;
  fires: number;
  x: number;
  z: number;
  yaw: number;
  depart: boolean;
  towerEnter: boolean;
  mood: "walk" | "sport" | "fight" | "stealth";
  tape: "floor" | "held" | "playing" | "paused" | "spent";
  tapes: { id: string; title: string }[];
  inventory: { id: string; title: string; kind: "tape" | "crystal" | "key"; count: number }[];
  selectedTape: string;
  nearTapeDeck: boolean;
  /** Planet Opus flight loop (IDEA-026 step 1); null on other planets. */
  /** Planet rules on foot (planet-rules.ts): heat on Twinsun, breath on Pearce. */
  rules: { hint: string; heat: number | null; breath: number | null; overheated: boolean; swimming: boolean; lowGravity: boolean; attention: number | null; vines: boolean; spores: string };
  carpet: null | {
    energy: number;
    energyMax: number;
    hold: number;
    holdCap: number;
    store: number;
    next: { title: string; cost: number } | null;
    atBase: boolean;
    hit: boolean;
    wardensUp: number;
    note: string;
    nodesOurs: number;
    nodes: number;
    raid: boolean;
  };
};

function loadSave(storageKey = SAVE_KEY): Save {
  const blank: Save = {
    v: 2,
    crystals: [false, false, false],
    key: false,
    fires: [false, false],
    quests: { sera: "new", orr: "new", bulb: "new" },
    coins: 0,
    chest: false,
    tapes: [],
    selectedTape: "",
    relay: {},
  };
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return blank;
    const parsed = JSON.parse(raw) as Partial<Save> & { v?: number };
    if ((parsed.v !== 1 && parsed.v !== 2) || parsed.crystals?.length !== 3) return blank;
    const tapes = Array.isArray(parsed.tapes)
      ? parsed.tapes.filter((id): id is string => typeof id === "string" && TAPES.some((tape) => tape.id === id))
      : [];
    // Older saves may already have opened the chest before cassette inventory
    // existed. Keep that progress and grant the new chest tape retroactively.
    if (parsed.chest && !tapes.includes("invaders10")) tapes.push("invaders10");
    const selectedTape = typeof parsed.selectedTape === "string" && tapes.includes(parsed.selectedTape)
      ? parsed.selectedTape
      : "";
    return {
      ...blank,
      ...parsed,
      v: 2,
      tapes: [...new Set(tapes)],
      selectedTape,
      quests: { ...blank.quests, ...parsed.quests },
      relay: { ...(parsed.relay || {}) },
    };
  } catch {
    return blank;
  }
}

const VEHICLES: Aabb[] = [];

function collide(x: number, z: number, y: number, walls: Aabb[]) {
  const radius = 0.38;
  let px = x;
  let pz = z;
  for (let pass = 0; pass < 3; pass++) {
    for (const box of walls) {
      if (y > box.maxY - 0.02 || y + 1.55 < box.minY) continue;
      const cx = Math.min(Math.max(px, box.minX), box.maxX);
      const cz = Math.min(Math.max(pz, box.minZ), box.maxZ);
      let dx = px - cx;
      let dz = pz - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) continue;
      if (d2 < 1e-8) {
        const left = px - box.minX;
        const right = box.maxX - px;
        const south = pz - box.minZ;
        const north = box.maxZ - pz;
        const m = Math.min(left, right, south, north);
        if (m === left) px = box.minX - radius;
        else if (m === right) px = box.maxX + radius;
        else if (m === south) pz = box.minZ - radius;
        else pz = box.maxZ + radius;
      } else {
        const d = Math.sqrt(d2) || 1;
        const push = radius - d;
        px += (dx / d) * push;
        pz += (dz / d) * push;
      }
    }
  }
  return { x: px, z: pz };
}

const JAHMAN_LINES = [
  "Я Джаман. Ящик — видеомагнитофон. Сказка живёт на кассете, не в эфире.",
  "Найденные и добытые кассеты хранятся в инвентаре. Подойди к ящику, выбери ленту и нажми E. E ставит на паузу, G открывает на весь экран. Музыка острова возле экрана почти затихает.",
];

const TALES: { title: string; pages: string[] }[] = [
  {
    title: "Два солнца",
    pages: [
      "Большое солнце пекло дюны, малое только смотрело. Жители решили, что малое — лампа, и попытались его задуть.",
      "Оно не погасло. Зато в ту ночь оазис запомнил их имена и больше не пускал к воде тех, кто приходит с пустыми руками.",
    ],
  },
  {
    title: "Колодец имён",
    pages: [
      "На гряде стоял колодец без верёвки. Кто бросал камень, слышал своё имя снизу, только на день старше.",
      "Сера перестала бросать. Она говорит: остров и так считает кристаллы, второму счёту здесь не место.",
    ],
  },
  {
    title: "Дверь назад",
    pages: [
      "Маяк на берегу открывается не ключом, а тем, что ты уже спускался. Кто пришёл сверху, видит только стену.",
      "Джаман оставляет эту сказку без конца. Подъём, говорит он, всегда начинается с площадки, которую ты ещё не видел.",
    ],
  },
  {
    title: "Монета, которую остров не берёт",
    pages: [
      "Рыночный сундук однажды вернул монету. Не сдачу — ту же самую, тёплую, с царапиной в виде байка.",
      "Ламп клянётся, что остров не вор. Он просто не понимает, зачем платить за место, на котором ты уже стоишь.",
    ],
  },
];

function lines(content: PlanetContent, id: QuestId, status: Quest, ready: boolean) {
  const r = content.residents[id];
  if (status === "done") return { pages: r.done, commit: null as Quest | null };
  if (ready) return { pages: r.ready, commit: "done" as Quest };
  if (status === "new") return { pages: r.offer, commit: "go" as Quest };
  return { pages: r.go, commit: null as Quest | null };
}

function capital(text: string) {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

export type Sim = ReturnType<typeof createSim>;

export function createSim(seed = 0, planet?: string) {
  const locationSeed = Number(seed) >>> 0;
  // Each planet stands its residents and quest things in its own places (layout.ts).
  applyLayout(planet);
  // Each planet has its own residents and its own progress (IDEA-021). Twinsun
  // (the desert, "first") keeps the old save key, so old saves stay.
  const content = planetContent(planet);
  const planetKey = planet && planet !== "first" ? "-" + planet : "";
  const storageKey = (locationSeed ? SAVE_KEY + "-" + locationSeed.toString(16) : SAVE_KEY) + planetKey;
  const save = loadSave(storageKey);
  const initialTape = TAPES.find((tape) => tape.id === save.selectedTape && save.tapes.includes(tape.id));
  const sim = {
    seed: locationSeed,
    x: SPAWN.x,
    y: footY(SPAWN.x, SPAWN.z, 0),
    z: SPAWN.z,
    yaw: SPAWN.yaw,
    vx: 0,
    vz: 0,
    vy: 0,
    speed: 0,
    steer: 0,
    mode: "foot" as "foot" | "bike",
    flightMode: false,
    engineForward: 0,
    engineVertical: 0,
    bikeX: BIKE_PARK.x,
    bikeZ: BIKE_PARK.z,
    bikeYaw: BIKE_PARK.yaw,
    crystals: save.crystals.slice(),
    key: save.key,
    fires: save.fires.slice(),
    quests: { ...save.quests },
    relay: { ...(save.relay || {}) } as Partial<Record<QuestId, boolean>>,
    content,
    /** Opus: the ship flies as a carpet over the ground (IDEA-026 step 1). Other planets: null. */
    carpet: (planet === "opus" ? createCarpet(surfaceY) : null) as CarpetState | null,
    /** Owner 24.11.2026: each planet plays differently on foot (planet-rules.ts). */
    rules: rulesFor(planet),
    body: createBody(SPAWN.x, SPAWN.z) as PlanetBody,
    coins: save.coins,
    chest: save.chest,
    tapes: save.tapes.slice(),
    selectedTape: save.selectedTape,
    dialogue: null as Dialogue | null,
    prompt: "",
    depart: false,
    towerEnter: false,
    mood: "walk" as "walk" | "sport" | "fight" | "stealth",
    walls: [] as Aabb[],
    props: [] as Aabb[],
    usePrev: false,
    boardPrev: false,
    ejectPrev: false,
    board: null as null | (() => boolean),
    respawnPrev: false,
    jumpPrev: false,
    flightTogglePrev: false,
    /** Seconds the riding hint stays on screen; set when the ride or its mode changes (BUG-016). */
    rideHint: 0,
    rideHintKey: "",
    moodPrev: false,
    dash: 0,
    tale: 0,
    tapeUrl: initialTape?.url || "",
    tapeTitle: initialTape?.title || "",
    tapePhase: initialTape ? "held" as "floor" | "held" | "playing" | "paused" | "spent" : "floor" as "floor" | "held" | "playing" | "paused" | "spent",
    tapePlay: 0,
    dirty: false,
    saveAt: 0,
    rebuild() {
      const walls: Aabb[] = this.props.slice();
      for (const house of HOUSES) {
        walls.push(...houseAabbs(house, house.id === "archive" && this.quests.orr !== "done"));
      }
      walls.push(...VEHICLES);
      this.walls = walls;
    },
    addProp(box: Aabb) {
      this.props.push(box);
      this.walls.push(box);
    },
    selectTape(id: string) {
      if (!this.tapes.includes(id)) return false;
      const tape = TAPES.find((item) => item.id === id);
      if (!tape) return false;
      this.selectedTape = id;
      this.tapeUrl = tape.url;
      this.tapeTitle = tape.title;
      this.tapePhase = "held";
      this.persist();
      this.refreshPrompt();
      return true;
    },
    ejectTape() {
      if (this.tapePhase !== "playing" && this.tapePhase !== "paused") return false;
      if (Math.hypot(this.x - STORY_BOX.x, this.z - STORY_BOX.z) > 6.5) return false;
      this.tapePhase = "spent";
      this.dirty = true;
      this.refreshPrompt();
      return true;
    },
    persist() {
      const data: Save = {
        v: 2,
        crystals: this.crystals,
        key: this.key,
        fires: this.fires,
        quests: this.quests,
        coins: this.coins,
        chest: this.chest,
        tapes: this.tapes,
        selectedTape: this.selectedTape,
        relay: this.relay,
      };
      try {
        localStorage.setItem(storageKey, JSON.stringify(data));
      } catch {
        /* private mode */
      }
      this.dirty = false;
    },
    crystalCount() {
      return this.crystals.filter(Boolean).length;
    },
    fireCount() {
      return this.fires.filter(Boolean).length;
    },
    /** The resident (slot) who gives the quest of this kind on this planet. */
    giverOf(kind: QuestKind): QuestId | null {
      const slots = Object.keys(this.content.residents) as QuestId[];
      return slots.find((slot) => this.content.residents[slot].kind === kind) ?? null;
    },
    giverName(kind: QuestKind) {
      const slot = this.giverOf(kind);
      return slot ? this.content.residents[slot].name : "";
    },
    ready(id: QuestId) {
      const kind = this.content.residents[id].kind;
      if (kind === "collect") return this.crystalCount() >= 3;
      if (kind === "fetch") return this.key;
      if (kind === "light") return this.fireCount() >= 2;
      return !!this.relay[id];
    },
    openTalk(id: QuestId, who: string) {
      // Relay: this resident may be the receiver of another resident's item.
      for (const giver of Object.keys(this.content.residents) as QuestId[]) {
        const r = this.content.residents[giver];
        if (r.kind !== "relay" || r.to !== id || this.quests[giver] !== "go" || this.relay[giver]) continue;
        this.relay[giver] = true;
        this.dirty = true;
        this.dialogue = { who, pages: (r.handover || [r.item]).slice(), i: 0, commit: null, quest: null };
        return;
      }
      const pack = lines(this.content, id, this.quests[id], this.ready(id));
      this.dialogue = { who, pages: pack.pages, i: 0, commit: pack.commit, quest: id };
    },
    advance() {
      const talk = this.dialogue;
      if (!talk) return;
      if (talk.i < talk.pages.length - 1) {
        talk.i += 1;
        return;
      }
      if (talk.commit && talk.quest) this.quests[talk.quest] = talk.commit;
      this.dialogue = null;
      this.dirty = true;
      this.rebuild();
      this.persist();
    },
    say(who: string, pages: string[]) {
      this.dialogue = { who, pages, i: 0, commit: null, quest: null };
    },
    interact() {
      if (this.dialogue) {
        this.advance();
        return;
      }
      if (this.mode !== "foot") return;
      const x = this.x;
      const z = this.z;
      const hit = (px: number, pz: number, r: number) => {
        const dx = x - px;
        const dz = z - pz;
        return dx * dx + dz * dz < r * r;
      };
      const people = this.content.residents;
      if (hit(NPC.sera.x, NPC.sera.z, 2.3)) return this.openTalk("sera", people.sera.name);
      if (hit(NPC.orr.x, NPC.orr.z, 2.3)) return this.openTalk("orr", people.orr.name);
      if (hit(NPC.bulb.x, NPC.bulb.z, 2.3)) return this.openTalk("bulb", people.bulb.name);
      if (hit(JAHMAN.x, JAHMAN.z, 1.45)) return this.say("Джаман", JAHMAN_LINES);
      for (const tape of TAPES) {
        if (tape.x === null || tape.z === null || this.tapes.includes(tape.id)) continue;
        if (hit(tape.x, tape.z, 1.25)) {
          this.tapes.push(tape.id);
          this.selectedTape = tape.id;
          this.tapeUrl = tape.url;
          this.tapeTitle = tape.title;
          this.tapePhase = "held";
          this.persist();
          return this.say("Кассета", [`«${tape.title}» добавлена в инвентарь. Выбери её у видеоящика и нажми E.`]);
        }
      }
      if (hit(STORY_BOX.x, STORY_BOX.z, 1.55)) {
        if (this.tapePhase === "playing") {
          this.tapePhase = "paused";
          return;
        }
        if (this.tapePhase === "paused") {
          this.tapePhase = "playing";
          return;
        }
        if ((this.tapePhase === "held" || this.tapePhase === "spent") && this.tapeUrl && this.selectedTape) {
          this.tapePlay += 1;
          this.tapePhase = "playing";
          return;
        }
        this.say("Ящик", [this.tapes.length
          ? "Выбери кассету в инвентаре рядом с экраном. Каждая лента остаётся в коллекции после просмотра."
          : "Лоток пуст. Сначала найди кассету или открой сундук у Лампа."]);
        return;
      }
      for (let i = 0; i < CRYSTALS.length; i++) {
        if (this.crystals[i]) continue;
        if (hit(CRYSTALS[i].x, CRYSTALS[i].z, 2)) {
          this.crystals[i] = true;
          this.dirty = true;
          this.say(capital(this.content.residents[this.giverOf("collect") ?? "sera"].item), [
            this.content.pickup(this.crystalCount(), this.giverName("collect")),
          ]);
          return;
        }
      }
      if (!this.key && hit(KEY_SPOT.x, KEY_SPOT.z, 1.8)) {
        this.key = true;
        this.dirty = true;
        this.say(capital(this.content.residents[this.giverOf("fetch") ?? "orr"].item), [this.content.found(this.giverName("fetch"))]);
        return;
      }
      for (let i = 0; i < BRAZIERS.length; i++) {
        if (this.fires[i]) continue;
        if (hit(BRAZIERS[i].x, BRAZIERS[i].z, 1.8)) {
          this.fires[i] = true;
          this.dirty = true;
          this.say("Жаровня", [
            this.content.lit(this.fireCount(), this.giverName("light")),
          ]);
          return;
        }
      }
      if (hit(CHEST.x, CHEST.z, 2.55)) {
        // The market chest belongs to the resident on the square (slot "bulb").
        // Open once the square resident's quest is done or ready (Twinsun: both braziers lit).
        if (this.quests.bulb !== "done" && !this.ready("bulb")) {
          this.say("Сундук", [this.content.chestLocked(this.content.residents.bulb.name)]);
          return;
        }
        if (!this.chest) {
          this.chest = true;
          this.coins += 12;
          if (!this.tapes.includes("invaders10")) this.tapes.push("invaders10");
          this.dirty = true;
          this.persist();
          this.say("Сундук", [this.content.chestReward]);
          return;
        }
        this.say("Сундук", ["Пусто. Рынок честный ровно один раз."]);
        return;
      }
      if (hit(JOURNAL.x, JOURNAL.z, 1.8)) {
        if (this.quests.orr !== "done") {
          this.say("Журнал", [this.content.journalLocked(this.content.residents.orr.name)]);
          return;
        }
        this.say("Журнал посадки", this.content.journal.slice());
        return;
      }
      if (hit(SKY_NOTE.x, SKY_NOTE.z, 3) && this.y > 10) {
        this.say("Висячий остров", [
          "Плита без разметки. Здесь встанет трасса, когда пресеты станут сеткой. Пока это только край карты и ветер.",
        ]);
        return;
      }
      if (hit(TOWER_GATE.x, TOWER_GATE.z, TOWER_GATE.radius)) {
        this.towerEnter = true;
        return;
      }
      if (hit(RING.x, RING.z, 3.4)) {
        this.depart = true;
        return;
      }
    },
    dismount() {
      if (this.mode !== "bike") return false;
      const land = footY(this.x, this.z, this.y);
      const water = land < -0.45 && !(this.y > 10 && Math.hypot(this.x - SKY_NOTE.x, this.z - SKY_NOTE.z) < 5);
      if (water) {
        this.say("Байк", ["Подо мной вода. На дюну или на висячий остров — там есть куда встать."]);
        return false;
      }
      this.mode = "foot";
      this.flightMode = false;
      this.engineForward = 0;
      this.engineVertical = 0;
      this.bikeX = this.x;
      this.bikeZ = this.z;
      this.bikeYaw = this.yaw;
      this.y = land;
      this.vy = 0;
      this.speed = 0;
      this.vx = 0;
      this.vz = 0;
      return true;
    },
    toggleFlightMode() {
      if (this.mode !== "bike") return false;
      if (this.carpet) return true; // on Opus the ship is always airborne
      this.flightMode = !this.flightMode;
      this.vy = this.flightMode ? 0 : Math.min(0, this.vy);
      this.engineForward = 0;
      this.engineVertical = 0;
      if (this.flightMode) this.y = hoverFloor(this.x, this.z, this.y);
      return this.flightMode;
    },
    respawn() {
      this.towerEnter = false;
      this.mode = "foot";
      this.flightMode = false;
      this.flightTogglePrev = false;
      this.engineForward = 0;
      this.engineVertical = 0;
      this.x = SPAWN.x;
      this.z = SPAWN.z;
      this.yaw = SPAWN.yaw;
      this.y = footY(SPAWN.x, SPAWN.z, 0);
      this.vx = 0;
      this.vz = 0;
      this.vy = 0;
      this.speed = 0;
      this.bikeX = BIKE_PARK.x;
      this.bikeZ = BIKE_PARK.z;
      this.bikeYaw = BIKE_PARK.yaw;
      this.dialogue = null;
    },
    refreshPrompt() {
      if (this.dialogue) {
        this.prompt = "";
        return;
      }
      const x = this.x;
      const z = this.z;
      const hit = (px: number, pz: number, r: number) => (x - px) ** 2 + (z - pz) ** 2 < r * r;
      if (hit(NPC.sera.x, NPC.sera.z, 2.3)) this.prompt = "E — " + this.content.residents.sera.name;
      else if (hit(NPC.orr.x, NPC.orr.z, 2.3)) this.prompt = "E — " + this.content.residents.orr.name;
      else if (hit(NPC.bulb.x, NPC.bulb.z, 2.3)) this.prompt = "E — " + this.content.residents.bulb.name;
      else if (hit(JAHMAN.x, JAHMAN.z, 1.45)) this.prompt = "E — Джаман";
      else if (TAPES.some((tape) => tape.x !== null && tape.z !== null && !this.tapes.includes(tape.id) && hit(tape.x, tape.z, 1.25))) this.prompt = "E — взять кассету";
      else if (hit(STORY_BOX.x, STORY_BOX.z, 1.55)) {
        this.prompt = this.tapePhase === "playing" ? "E — пауза · G — весь экран · V — извлечь"
          : this.tapePhase === "paused" ? "E — дальше · V — извлечь"
          : this.selectedTape ? `E — вставить «${this.tapeTitle}»`
          : this.tapes.length ? "Выбери кассету в инвентаре"
          : "E — ящик пуст";
      }
      else if (CRYSTALS.some((c, i) => !this.crystals[i] && hit(c.x, c.z, 2))) this.prompt = "E — поднять кристалл";
      else if (!this.key && hit(KEY_SPOT.x, KEY_SPOT.z, 1.8)) this.prompt = "E — поднять ключ";
      else if (BRAZIERS.some((b, i) => !this.fires[i] && hit(b.x, b.z, 1.8))) this.prompt = "E — зажечь жаровню";
      else if (hit(CHEST.x, CHEST.z, 1.8)) this.prompt = "E — сундук";
      else if (hit(JOURNAL.x, JOURNAL.z, 1.8)) this.prompt = "E — журнал";
      else if (hit(SKY_NOTE.x, SKY_NOTE.z, 3) && this.y > 10) this.prompt = "E — плита трассы";
      else if (hit(TOWER_GATE.x, TOWER_GATE.z, TOWER_GATE.radius)) this.prompt = "E — маяк · подъём в Tower";
      else if (hit(RING.x, RING.z, 3.4)) this.prompt = "E — берег цитадели, гонка";
      else if (this.mode === "foot" && hit(this.bikeX, this.bikeZ, 3.8)) this.prompt = "F — сесть на байк";
      else if (this.mode === "foot" && this.body && this.body.noteFor > 0) this.prompt = this.body.note;
      // Owner 16.11.2026: "быстро сказал управление и всё" — the keys are said
      // once when the ride or its mode changes, then the hint leaves the screen.
      else if (this.mode === "bike" && this.carpet?.atBase) {
        const next = nextUpgrade(this.carpet);
        this.prompt = next ? `E — ${next.title} · ${next.cost} искр (в накопителе ${this.carpet.store})` : "Накопитель: всё куплено";
      }
      else if (this.mode === "bike" && this.carpet && this.carpet.noteFor > 0) this.prompt = this.carpet.note;
      else if (this.mode === "bike" && this.carpet) {
        const c = this.carpet;
        const i = c.nodes.findIndex((n) => (n.x - x) ** 2 + (n.z - z) ** 2 < 16);
        if (i >= 0 && c.nodes[i].owner === "warden") this.prompt = c.wardens[i].down > 0 ? "E — поставить модуль, узел станет нашим" : "Узел держит страж — X, огонь";
        else if (i >= 0) this.prompt = `Наш модуль · искр ${c.nodes[i].bank} — пролети низко`;
        else if (this.rideHint > 0) this.prompt = "Space — выше · Q — ниже · X — огонь · искры берутся низко";
        else this.prompt = "";
      }
      else if (this.mode === "bike" && this.rideHint > 0) this.prompt = this.flightMode
        ? "Space — вверх · Q — вниз · T — земля · F — спешиться"
        : "T — полёт · F — спешиться";
      else this.prompt = "";
    },
    step(dt: number) {
      const keys = activeKeys();
      let steer = 0;
      if (keys.has("KeyA") || keys.has("ArrowLeft")) steer += 1;
      if (keys.has("KeyD") || keys.has("ArrowRight")) steer -= 1;
      steer = Math.max(-1, Math.min(1, steer - readTilt()));
      const throttle = keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0;
      const brake = keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0;
      const use = keys.has("KeyE");
      const boardKey = keys.has("KeyF");
      const ejectKey = keys.has("KeyV");
      const respawn = keys.has("KeyR");
      if (this.mode === "foot" && keys.has("KeyC") && !this.moodPrev && !this.dialogue) {
        const order = ["walk", "sport", "fight", "stealth"] as const;
        const index = order.indexOf(this.mood);
        this.mood = order[(index + 1) % order.length];
      }
      this.moodPrev = this.mode === "foot" && keys.has("KeyC");
      if (use && !this.usePrev && this.mode === "foot") this.interact();
      if (use && !this.usePrev && this.mode === "bike" && this.carpet && !captureNode(this.carpet, this)) buyUpgrade(this.carpet);
      this.usePrev = use;
      if (boardKey && !this.boardPrev && !this.dialogue) {
        if (this.mode === "foot") this.board?.();
        else this.dismount();
      }
      this.boardPrev = boardKey;
      if (ejectKey && !this.ejectPrev) this.ejectTape();
      this.ejectPrev = ejectKey;
      if (respawn && !this.respawnPrev) this.respawn();
      this.respawnPrev = respawn;
      const rideKey = this.mode === "bike" ? (this.flightMode ? "flight" : "ground") : "";
      if (rideKey !== this.rideHintKey) {
        this.rideHintKey = rideKey;
        this.rideHint = rideKey ? 4.5 : 0;
      } else if (this.rideHint > 0) {
        this.rideHint = Math.max(0, this.rideHint - dt);
      }
      const flightToggle = this.mode === "bike" && keys.has("KeyT");
      if (flightToggle && !this.flightTogglePrev) this.toggleFlightMode();
      this.flightTogglePrev = flightToggle;
      this.steer = steer;
      // Opus: boarding the ship takes it straight into the air.
      if (this.carpet && this.mode === "bike" && !this.flightMode) {
        this.flightMode = true;
        this.y = Math.max(this.y, hoverFloor(this.x, this.z, this.y));
      }

      if (!this.dialogue && this.carpet && this.mode === "bike") {
        const climb = (keys.has("Space") ? 1 : 0) - (keys.has("KeyQ") ? 1 : 0);
        stepCarpet(this.carpet, this, {
          steer,
          throttle,
          brake,
          climb,
          boost: keys.has("ShiftLeft") || keys.has("ShiftRight"),
          fire: keys.has("KeyX"),
        }, dt, (nx, nz, y) => collide(nx, nz, y, this.walls), (x, z) => {
          let topY = -Infinity;
          for (const box of this.walls) {
            if (x > box.minX - 1 && x < box.maxX + 1 && z > box.minZ - 1 && z < box.maxZ + 1) topY = Math.max(topY, box.maxY);
          }
          return topY;
        });
        this.engineForward = Math.abs(this.speed) > 0.45 ? Math.sign(this.speed) : throttle - brake;
        this.engineVertical = climb || (this.vy > 0.35 ? 1 : this.vy < -0.35 ? -1 : 0);
        this.bikeX = this.x;
        this.bikeZ = this.z;
        this.bikeYaw = this.yaw;
      } else if (!this.dialogue) {
        const turn = this.mode === "foot" ? 2.45 : 1.65;
        this.yaw += steer * turn * dt;
        const fx = -Math.sin(this.yaw);
        const fz = -Math.cos(this.yaw);
        let forward = this.vx * fx + this.vz * fz;
        const wish = throttle - brake;
        const boost = keys.has("ShiftLeft") || keys.has("ShiftRight");
        const pace =
          this.mood === "sport" ? 9.4 : this.mood === "stealth" ? 2.7 : this.mood === "fight" ? 6.6 : 5.6;
        // Overheated (Twinsun) or swimming (Pearce): a slower walk.
        const footFactor = (this.body.overheated ? HEAT.slow : 1) * (this.body.swimming ? 0.5 : 1) * (this.body.vines ? LIVING.vineSlow : 1);
        const max = this.mode === "bike" ? (boost ? 28 : 16) : pace * footFactor;
        const accel = this.mode === "bike" ? 16 : 24;
        const target = wish * (this.mode === "foot" && brake && !throttle ? 3.2 : max);
        const signedTarget = throttle ? target : brake ? - (this.mode === "foot" ? 3.2 : 7) : 0;
        const delta = Math.min(accel * dt, Math.max(-accel * dt, signedTarget - forward));
        forward += delta;
        if (!throttle && !brake) forward *= Math.exp((this.mode === "bike" ? -0.55 : -3.4) * dt);
        if (Math.abs(forward) < 0.02) forward = 0;
        if (this.mode === "foot" && this.dash > 0) {
          forward += 8.5;
          this.dash = Math.max(0, this.dash - dt);
        }
        this.vx = fx * forward;
        this.vz = fz * forward;
        this.speed = forward;
        this.engineForward = this.mode === "bike" && this.flightMode
          ? (Math.abs(forward) > 0.45 ? Math.sign(forward) : wish)
          : 0;

        let nx = this.x + this.vx * dt;
        let nz = this.z + this.vz * dt;
        // Pearce: on foot the water is not a wall — the pilot swims (planet-rules.ts).
        if ((this.mode === "foot" && !this.rules.swim) || (this.mode === "bike" && !this.flightMode)) {
          const nextH = footY(nx, nz, this.y);
          const hereH = footY(this.x, this.z, this.y);
          if (nextH < -0.48 && nextH < hereH - 0.02) {
            nx = this.x;
            nz = this.z;
            this.vx = 0;
            this.vz = 0;
            this.speed = 0;
          }
        }
        const hit = collide(nx, nz, this.y, this.walls);
        this.x = hit.x;
        this.z = hit.z;
        if (this.mode === "foot") {
          const ground = footY(this.x, this.z, this.y);
          const airborne = this.y > ground + 0.08;
          if (keys.has("Space") && !this.jumpPrev && !airborne && this.mood !== "stealth") {
            if (this.mood === "fight") {
              this.dash = 0.22;
              this.vy = 3.4;
            } else {
              this.vy = (this.mood === "sport" ? 8.6 : 6.4) * this.rules.jump;
            }
          }
          // Ioki: low gravity and a slow fall (planet-rules.ts).
          this.vy = Math.max(-this.rules.fallCap, this.vy - 24 * this.rules.gravity * dt);
          let ny = this.y + this.vy * dt;
          let landed = footY(this.x, this.z, ny);
          if (this.rules.swim) {
            const water = stepWater(this.body, this.x, this.z, landed, dt);
            if (water.rescued) {
              const shore = shoreFor(this.body);
              this.x = shore.x;
              this.z = shore.z;
              this.vx = 0;
              this.vz = 0;
              landed = footY(this.x, this.z, ny);
              ny = landed;
            } else if (water.floatY !== null) {
              landed = Math.max(landed, water.floatY);
            }
          }
          if (ny <= landed) {
            ny = landed;
            if (this.vy < 0) this.vy = 0;
          }
          this.y = ny;
          this.engineForward = 0;
          this.engineVertical = 0;
        } else if (!this.flightMode) {
          const floor = hoverFloor(this.x, this.z, this.y);
          if (this.y > floor + 0.04) {
            this.vy = Math.max(-12, this.vy - 18 * dt);
            this.y = Math.max(floor, this.y + this.vy * dt);
            if (this.y <= floor) this.vy = 0;
          } else {
            this.y = floor;
            this.vy = 0;
          }
          this.engineForward = 0;
          this.engineVertical = 0;
          this.bikeX = this.x;
          this.bikeZ = this.z;
          this.bikeYaw = this.yaw;
        } else {
          const climb = (keys.has("Space") ? 1 : 0) - (keys.has("KeyQ") ? 1 : 0);
          this.engineVertical = climb || (this.vy > 0.35 ? 1 : this.vy < -0.35 ? -1 : 0);
          if (climb !== 0) this.vy += climb * 26 * dt;
          else this.vy *= Math.exp(-2.4 * dt);
          this.vy = Math.min(12, Math.max(-12, this.vy));
          this.y += this.vy * dt;
          const floor = hoverFloor(this.x, this.z, this.y);
          if (this.y < floor) {
            this.y = floor;
            this.vy = 0;
          }
          const ceil = floor + 28;
          if (this.y > ceil) {
            this.y = ceil;
            this.vy = 0;
          }
          this.bikeX = this.x;
          this.bikeZ = this.z;
          this.bikeYaw = this.yaw;
        }
      } else {
        this.vx = 0;
        this.vz = 0;
        this.speed = 0;
        this.steer = 0;
      }
      // Twinsun: heat under two suns, on foot in the open (planet-rules.ts).
      if (this.rules.heat) stepHeat(this.body, this.x, this.z, this.mode === "foot", dt);
      // Fable: the living planet watches the pilot (planet-rules.ts).
      if (this.rules.living && stepLiving(this.body, this.x, this.z, this.mode === "foot", this.mood, this.speed, dt) === "push") {
        this.x = SPAWN.x;
        this.z = SPAWN.z;
        this.yaw = SPAWN.yaw;
        this.y = footY(SPAWN.x, SPAWN.z, 0);
        this.vx = 0;
        this.vz = 0;
        this.vy = 0;
        this.speed = 0;
      }
      this.body.noteFor = Math.max(0, this.body.noteFor - dt);
      this.jumpPrev = keys.has("Space");
      this.refreshPrompt();
      this.saveAt += dt;
      if (this.dirty && this.saveAt > 0.4) {
        this.saveAt = 0;
        this.persist();
      }
    },
    hud(): IslandHud {
      const quests: IslandHud["quests"] = (["sera", "orr", "bulb"] as QuestId[]).map((id) => {
        const r = this.content.residents[id];
        const progress =
          r.kind === "collect" ? `${r.item} ${this.crystalCount()}/3`
          : r.kind === "fetch" ? `${r.item}: восточный берег`
          : r.kind === "light" ? `${r.item} ${this.fireCount()}/2`
          : `отнести ${r.item}: ${r.to ? this.content.residents[r.to].name : ""}`;
        const status = this.quests[id] === "done" ? r.closed
          : this.ready(id) ? r.turnIn
          : this.quests[id] === "go" ? progress
          : r.wait;
        return { id, title: r.title, status };
      });
      return {
        mode: this.mode,
        flightMode: this.flightMode,
        speed: this.speed,
        alt: this.y,
        region: regionName(this.x, this.z, this.y),
        prompt: this.prompt,
        dialogue: this.dialogue
          ? { ...this.dialogue, pages: this.dialogue.pages.slice() }
          : null,
        quests,
        coins: this.coins,
        crystals: this.quests[this.giverOf("collect") ?? "sera"] === "done" ? 0 : this.crystalCount(),
        fires: this.fireCount(),
        x: this.x,
        z: this.z,
        yaw: this.yaw,
        mood: this.mood,
        depart: this.depart,
        towerEnter: this.towerEnter,
        tape: this.tapePhase,
        tapes: TAPES.filter((tape) => this.tapes.includes(tape.id)).map((tape) => ({ id: tape.id, title: tape.title })),
        inventory: [
          ...TAPES.filter((tape) => this.tapes.includes(tape.id)).map((tape) => ({ id: tape.id, title: tape.title, kind: "tape" as const, count: 1 })),
          ...(this.quests[this.giverOf("collect") ?? "sera"] !== "done" && this.crystalCount() > 0
            ? [{ id: "crystals", title: capital(this.content.residents[this.giverOf("collect") ?? "sera"].item), kind: "crystal" as const, count: this.crystalCount() }]
            : []),
          ...(this.key && this.quests[this.giverOf("fetch") ?? "orr"] !== "done"
            ? [{ id: "key", title: capital(this.content.residents[this.giverOf("fetch") ?? "orr"].item), kind: "key" as const, count: 1 }]
            : []),
        ],
        selectedTape: this.selectedTape,
        nearTapeDeck: Math.hypot(this.x - STORY_BOX.x, this.z - STORY_BOX.z) < 6.5,
        rules: {
          hint: this.rules.hint,
          heat: this.rules.heat ? this.body.heat : null,
          breath: this.rules.swim ? this.body.breath : null,
          overheated: this.body.overheated,
          swimming: this.body.swimming,
          lowGravity: this.rules.gravity < 1,
          attention: this.rules.living ? this.body.attention : null,
          vines: this.body.vines,
          spores: this.rules.living ? `${this.body.spores.filter((s) => s.taken).length}/${this.body.spores.length}` : "",
        },
        carpet: this.carpet
          ? {
              energy: this.carpet.energy,
              energyMax: this.carpet.energyMax,
              hold: this.carpet.hold,
              holdCap: this.carpet.holdCap,
              store: this.carpet.store,
              next: nextUpgrade(this.carpet),
              atBase: this.carpet.atBase,
              hit: this.carpet.hit > 0,
              wardensUp: this.carpet.wardens.filter((w) => w.down <= 0 && !w.gone).length,
              nodesOurs: this.carpet.nodes.filter((n) => n.owner === "ship").length,
              nodes: this.carpet.nodes.length,
              raid: !!this.carpet.raider,
              note: this.carpet.noteFor > 0 ? this.carpet.note : "",
            }
          : null,
      };
    },
  };
  sim.y = footY(sim.x, sim.z, 0);
  if (sim.rules.living) placeSpores(sim.body);
  sim.rebuild();
  return sim;
}
