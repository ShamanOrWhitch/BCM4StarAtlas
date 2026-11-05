import { activeKeys } from "@/game/input";
import {
  BIKE_PARK,
  BRAZIERS,
  CHEST,
  CRYSTALS,
  HOUSES,
  JOURNAL,
  KEY_SPOT,
  LETTER,
  NPC,
  RING,
  SKY_NOTE,
  SPAWN,
  footY,
  houseAabbs,
  hoverFloor,
  regionName,
  type Aabb,
} from "./terrain";

const SAVE_KEY = "desert-island-v1";

export type Quest = "new" | "go" | "done";

export type Dialogue = { who: string; pages: string[]; i: number; commit: Quest | null; quest: QuestId | null };

export type QuestId = "sera" | "orr" | "bulb";

type Save = {
  v: 1;
  crystals: boolean[];
  key: boolean;
  fires: boolean[];
  quests: Record<QuestId, Quest>;
  coins: number;
  chest: boolean;
};

export type IslandHud = {
  mode: "foot" | "bike";
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
};

function loadSave(): Save {
  const blank: Save = {
    v: 1,
    crystals: [false, false, false],
    key: false,
    fires: [false, false],
    quests: { sera: "new", orr: "new", bulb: "new" },
    coins: 0,
    chest: false,
  };
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return blank;
    const parsed = JSON.parse(raw) as Save;
    if (parsed.v !== 1 || parsed.crystals?.length !== 3) return blank;
    return { ...blank, ...parsed, quests: { ...blank.quests, ...parsed.quests } };
  } catch {
    return blank;
  }
}

const VEHICLES: Aabb[] = [
  { minX: 18.6, maxX: 24.4, minY: 0, maxY: 2.2, minZ: 28.4, maxZ: 33.6 },
  { minX: -10.4, maxX: -6.2, minY: 0, maxY: 1.8, minZ: 30.4, maxZ: 34.6 },
];

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

const SERA_OFFER = [
  "Ты с посадочной? Оранжевый байк ещё тёплый — значит, свой.",
  "Оазис гаснет без кристаллов с западной гряды. Принеси три. Не больше: остров считает.",
];
const SERA_GO = ["Гряда за архивом, на западе. Три камня, и лампа у воды проживёт ночь."];
const SERA_READY = ["Все три. Оставлю их у колодца — оазис это почувствует."];
const SERA_DONE = [
  "Если поднимешься выше дюн, увидишь висячий остров. Трассы туда ещё не положили, место уже наше.",
];

const ORR_OFFER = [
  "Архив закрыт. Ключ унесло к разбитому ховеру на восточном пляже.",
  "Принесёшь — открою створку. Внутри журнал посадки и сундук не мой, рыночный.",
];
const ORR_GO = ["Восток, у кромки воды. Корпус красный с синим, не перепутай с байком у входа."];
const ORR_READY = ["Ключ тёплый. Створка твоя. Журнал на столе, дом можно читать стоя."];
const ORR_DONE = ["Журнал на столе. Остальные двери посёлка и так без замка."];

const BULB_OFFER = [
  "Рынок спит, пока жаровни холодные. Я Ламп, я слежу за огнём.",
  "Зажги две: одну у скамьи, вторую у моста. Тогда сундук отпустит крышку.",
];
const BULB_GO = ["Две жаровни. Подойди и нажми E. Я не достаю до фитиля."];
const BULB_READY = ["Тепло пошло по площади. Сундук больше не держит."];
const BULB_DONE = ["Северное кольцо за оазисом — это уже гонка, не прогулка. Кольцо само просит E."];

function lines(id: QuestId, status: Quest, ready: boolean) {
  if (id === "sera") {
    if (status === "done") return { pages: SERA_DONE, commit: null as Quest | null };
    if (ready) return { pages: SERA_READY, commit: "done" as Quest };
    if (status === "new") return { pages: SERA_OFFER, commit: "go" as Quest };
    return { pages: SERA_GO, commit: null };
  }
  if (id === "orr") {
    if (status === "done") return { pages: ORR_DONE, commit: null };
    if (ready) return { pages: ORR_READY, commit: "done" as Quest };
    if (status === "new") return { pages: ORR_OFFER, commit: "go" as Quest };
    return { pages: ORR_GO, commit: null };
  }
  if (status === "done") return { pages: BULB_DONE, commit: null };
  if (ready) return { pages: BULB_READY, commit: "done" as Quest };
  if (status === "new") return { pages: BULB_OFFER, commit: "go" as Quest };
  return { pages: BULB_GO, commit: null };
}

export type Sim = ReturnType<typeof createSim>;

export function createSim() {
  const save = loadSave();
  const sim = {
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
    bikeX: BIKE_PARK.x,
    bikeZ: BIKE_PARK.z,
    bikeYaw: BIKE_PARK.yaw,
    crystals: save.crystals.slice(),
    key: save.key,
    fires: save.fires.slice(),
    quests: { ...save.quests },
    coins: save.coins,
    chest: save.chest,
    dialogue: null as Dialogue | null,
    prompt: "",
    depart: false,
    walls: [] as Aabb[],
    usePrev: false,
    respawnPrev: false,
    dirty: false,
    saveAt: 0,
    rebuild() {
      const walls: Aabb[] = [];
      for (const house of HOUSES) {
        walls.push(...houseAabbs(house, house.id === "archive" && this.quests.orr !== "done"));
      }
      walls.push(...VEHICLES);
      this.walls = walls;
    },
    persist() {
      const data: Save = {
        v: 1,
        crystals: this.crystals,
        key: this.key,
        fires: this.fires,
        quests: this.quests,
        coins: this.coins,
        chest: this.chest,
      };
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(data));
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
    ready(id: QuestId) {
      if (id === "sera") return this.crystalCount() >= 3;
      if (id === "orr") return this.key;
      return this.fireCount() >= 2;
    },
    openTalk(id: QuestId, who: string) {
      const pack = lines(id, this.quests[id], this.ready(id));
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
    },
    say(who: string, pages: string[]) {
      this.dialogue = { who, pages, i: 0, commit: null, quest: null };
    },
    interact() {
      if (this.dialogue) {
        this.advance();
        return;
      }
      const x = this.x;
      const z = this.z;
      const hit = (px: number, pz: number, r: number) => {
        const dx = x - px;
        const dz = z - pz;
        return dx * dx + dz * dz < r * r;
      };
      if (hit(NPC.sera.x, NPC.sera.z, 2.3)) return this.openTalk("sera", NPC.sera.name);
      if (hit(NPC.orr.x, NPC.orr.z, 2.3)) return this.openTalk("orr", NPC.orr.name);
      if (hit(NPC.bulb.x, NPC.bulb.z, 2.3)) return this.openTalk("bulb", NPC.bulb.name);
      for (let i = 0; i < CRYSTALS.length; i++) {
        if (this.crystals[i]) continue;
        if (hit(CRYSTALS[i].x, CRYSTALS[i].z, 2)) {
          this.crystals[i] = true;
          this.dirty = true;
          this.say("Кристалл", [
            this.crystalCount() >= 3
              ? "Третий. Сера у своего дома — ей можно нести."
              : `В сумке ${this.crystalCount()} из 3. Гряда ещё держит остальные.`,
          ]);
          return;
        }
      }
      if (!this.key && hit(KEY_SPOT.x, KEY_SPOT.z, 1.8)) {
        this.key = true;
        this.dirty = true;
        this.say("Ключ", ["Золото с синей головкой. Орр стоит у архива и делает вид, что не смотрит."]);
        return;
      }
      for (let i = 0; i < BRAZIERS.length; i++) {
        if (this.fires[i]) continue;
        if (hit(BRAZIERS[i].x, BRAZIERS[i].z, 1.8)) {
          this.fires[i] = true;
          this.dirty = true;
          this.say("Жаровня", [
            this.fireCount() >= 2 ? "Обе горят. Ламп на площади уже слышит треск." : "Одна горит. Вторая ещё холодная.",
          ]);
          return;
        }
      }
      if (hit(CHEST.x, CHEST.z, 1.8)) {
        if (this.quests.bulb !== "done") {
          this.say("Сундук", ["Крышка не шевелится. Ламп говорит: сперва две жаровни."]);
          return;
        }
        if (!this.chest) {
          this.chest = true;
          this.coins += 12;
          this.dirty = true;
          this.say("Сундук", ["Двенадцать монет посадочного сбора. Хватит на лампу и на молчание Орра."]);
          return;
        }
        this.say("Сундук", ["Пусто. Рынок честный ровно один раз."]);
        return;
      }
      if (hit(JOURNAL.x, JOURNAL.z, 1.8)) {
        if (this.quests.orr !== "done") {
          this.say("Журнал", ["Створка ещё держит. Снаружи это просто стена, изнутри — тоже, пока Орр не повернёт ключ."]);
          return;
        }
        this.say("Журнал посадки", [
          "«Дюнный посад. Вход с юга, байк оставлять на плите. Дома жилые. Квесты не декорация — жители ждут.»",
          "Ниже другим почерком: «Северное кольцо выводит на берег цитадели. Трассы висячего острова — следующим рейсом.»",
        ]);
        return;
      }
      if (hit(LETTER.x, LETTER.z, 1.7)) {
        this.say("Записка", ["«Ушёл к гряде. Оранжевый байк на плите — чужой, не трогать. В остальных домах двери открыты.»"]);
        return;
      }
      if (hit(SKY_NOTE.x, SKY_NOTE.z, 3) && this.y > 10) {
        this.say("Висячий остров", [
          "Плита без разметки. Здесь встанет трасса, когда пресеты станут сеткой. Пока это только край карты и ветер.",
        ]);
        return;
      }
      if (hit(RING.x, RING.z, 3.4)) {
        this.depart = true;
        return;
      }
      if (this.mode === "foot" && hit(this.bikeX, this.bikeZ, 3.8)) {
        this.mode = "bike";
        this.x = this.bikeX;
        this.z = this.bikeZ;
        this.yaw = this.bikeYaw;
        this.y = hoverFloor(this.x, this.z, this.y);
        this.vx = 0;
        this.vz = 0;
        this.speed = 0;
        return;
      }
      if (this.mode === "bike") {
        const land = footY(this.x, this.z, this.y);
        const water = land < -0.45 && !(this.y > 10 && hit(SKY_NOTE.x, SKY_NOTE.z, 5));
        if (water) {
          this.say("Байк", ["Подо мной вода. На дюну или на висячий остров — там есть куда встать."]);
          return;
        }
        this.mode = "foot";
        this.bikeX = this.x;
        this.bikeZ = this.z;
        this.bikeYaw = this.yaw;
        this.y = land;
        this.vy = 0;
        this.speed = 0;
        this.vx = 0;
        this.vz = 0;
      }
    },
    respawn() {
      this.mode = "foot";
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
      if (hit(NPC.sera.x, NPC.sera.z, 2.3)) this.prompt = "E — Сера Венн";
      else if (hit(NPC.orr.x, NPC.orr.z, 2.3)) this.prompt = "E — Орр-1";
      else if (hit(NPC.bulb.x, NPC.bulb.z, 2.3)) this.prompt = "E — Ламп";
      else if (CRYSTALS.some((c, i) => !this.crystals[i] && hit(c.x, c.z, 2))) this.prompt = "E — поднять кристалл";
      else if (!this.key && hit(KEY_SPOT.x, KEY_SPOT.z, 1.8)) this.prompt = "E — поднять ключ";
      else if (BRAZIERS.some((b, i) => !this.fires[i] && hit(b.x, b.z, 1.8))) this.prompt = "E — зажечь жаровню";
      else if (hit(CHEST.x, CHEST.z, 1.8)) this.prompt = "E — сундук";
      else if (hit(JOURNAL.x, JOURNAL.z, 1.8)) this.prompt = "E — журнал";
      else if (hit(LETTER.x, LETTER.z, 1.7)) this.prompt = "E — записка";
      else if (hit(SKY_NOTE.x, SKY_NOTE.z, 3) && this.y > 10) this.prompt = "E — плита трассы";
      else if (hit(RING.x, RING.z, 3.4)) this.prompt = "E — берег цитадели, гонка";
      else if (this.mode === "foot" && hit(this.bikeX, this.bikeZ, 3.8)) this.prompt = "E — сесть на байк";
      else if (this.mode === "bike") this.prompt = "E — спешиться";
      else this.prompt = "";
    },
    step(dt: number) {
      const keys = activeKeys();
      let steer = 0;
      if (keys.has("KeyA") || keys.has("ArrowLeft")) steer += 1;
      if (keys.has("KeyD") || keys.has("ArrowRight")) steer -= 1;
      const throttle = keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0;
      const brake = keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0;
      const use = keys.has("KeyE") || keys.has("KeyF");
      const respawn = keys.has("KeyR");
      if (use && !this.usePrev) this.interact();
      this.usePrev = use;
      if (respawn && !this.respawnPrev) this.respawn();
      this.respawnPrev = respawn;
      this.steer = steer;

      if (!this.dialogue) {
        const turn = this.mode === "foot" ? 2.45 : 1.65;
        this.yaw += steer * turn * dt;
        const fx = -Math.sin(this.yaw);
        const fz = -Math.cos(this.yaw);
        let forward = this.vx * fx + this.vz * fz;
        const wish = throttle - brake;
        const boost = keys.has("ShiftLeft") || keys.has("ShiftRight");
        const max = this.mode === "bike" ? (boost ? 28 : 16) : 6.1;
        const accel = this.mode === "bike" ? 16 : 24;
        const target = wish * (this.mode === "foot" && brake && !throttle ? 3.2 : max);
        const signedTarget = throttle ? target : brake ? - (this.mode === "foot" ? 3.2 : 7) : 0;
        const delta = Math.min(accel * dt, Math.max(-accel * dt, signedTarget - forward));
        forward += delta;
        if (!throttle && !brake) forward *= Math.exp((this.mode === "bike" ? -0.55 : -3.4) * dt);
        if (Math.abs(forward) < 0.02) forward = 0;
        this.vx = fx * forward;
        this.vz = fz * forward;
        this.speed = forward;

        let nx = this.x + this.vx * dt;
        let nz = this.z + this.vz * dt;
        if (this.mode === "foot") {
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
          this.y = footY(this.x, this.z, this.y);
          this.vy = 0;
        } else {
          const climb =
            (keys.has("Space") ? 1 : 0) - (keys.has("KeyC") || keys.has("KeyQ") ? 1 : 0);
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
      this.refreshPrompt();
      this.saveAt += dt;
      if (this.dirty && this.saveAt > 0.4) {
        this.saveAt = 0;
        this.persist();
      }
    },
    hud(): IslandHud {
      const quests: IslandHud["quests"] = [
        {
          id: "sera",
          title: "Свет оазиса",
          status:
            this.quests.sera === "done"
              ? "сдано"
              : this.ready("sera")
                ? "можно сдать"
                : this.quests.sera === "go"
                  ? `кристаллы ${this.crystalCount()}/3`
                  : "Сера ждёт у дома",
        },
        {
          id: "orr",
          title: "Ключ архива",
          status:
            this.quests.orr === "done"
              ? "створка открыта"
              : this.ready("orr")
                ? "отнести Орру"
                : this.quests.orr === "go"
                  ? "ключ на восточном пляже"
                  : "Орр у архива",
        },
        {
          id: "bulb",
          title: "Ночной рынок",
          status:
            this.quests.bulb === "done"
              ? this.chest
                ? "сундук пуст"
                : "сундук открыт"
              : this.ready("bulb")
                ? "сказать Лампу"
                : this.quests.bulb === "go"
                  ? `жаровни ${this.fireCount()}/2`
                  : "Ламп на площади",
        },
      ];
      return {
        mode: this.mode,
        speed: this.speed,
        alt: this.y,
        region: regionName(this.x, this.z, this.y),
        prompt: this.prompt,
        dialogue: this.dialogue
          ? { ...this.dialogue, pages: this.dialogue.pages.slice() }
          : null,
        quests,
        coins: this.coins,
        crystals: this.crystalCount(),
        fires: this.fireCount(),
        x: this.x,
        z: this.z,
        yaw: this.yaw,
        depart: this.depart,
      };
    },
  };
  sim.y = footY(sim.x, sim.z, 0);
  sim.rebuild();
  return sim;
}
