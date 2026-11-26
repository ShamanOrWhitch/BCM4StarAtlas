/**
 * Orbis — a whole sphere planet to fly over (owner 26.11.2026, IDEA-033: "разработка целого шарика
 * для полётов (планета) на основе magic carpet 2 … ресурсы вываливаются: доски, ящики, бочки,
 * рюкзаки … из этого будем строить базы … один уровень с несколькими точками интереса и улучшением
 * собственной базы … летать можно на кораблях, которые стоят вокруг, капитан должен разрешить нашему
 * герою взять любой корабль"). Magic Carpet 2 and Descent 3 are genre references only.
 *
 * One level, step 1:
 *   - the home base on the north pole: the captain and three parked ships; the captain lets the hero
 *     take any of them (each flies on ship-core.js with its own make);
 *   - six enemy towers over the sphere fire at a ship close by; a tower brought down spills loot —
 *     boards, crates, barrels, backpacks — on the ground; the ship takes it low over the ground;
 *   - over the home base the hold is unloaded; materials build the castle tier by tier;
 *   - two villages ask for help; the enemy fortress on the south pole is shielded while a tower
 *     stands, and gives the most loot when it falls (its inside — tunnels in every direction — is
 *     the next step).
 *
 * Pure: no THREE, no DOM; the scene draws it (sphere-scene.ts). Tested in node.
 */
// The one ship core is mini-sim/assets/js/ship-core.js (globalThis.BCMShipCore). The page loads it as
// a script before First Planet (bcm-mini-sim.php, the standalone shell, Planet Lab); the bundle does
// not copy it (the repository package marks modules side-effect free, so a bare import is dropped).

type Vec = { x: number; y: number; z: number };
type ShipCore = {
  create: (profile: string, opts: object) => Ship;
  step: (ship: Ship, intent: Intent, dt: number, world: World) => Ship;
  sphereWorld: (o: { radius: number; height: (n: Vec) => number }) => World;
  clearance: (ship: Ship, world: World) => number;
};
export type Ship = {
  position: Vec;
  velocity: Vec;
  forward: Vec;
  up: Vec;
  bank: number;
  speed: number;
  hold: number;
};
type World = { surface: (p: Vec) => number; up: (p: Vec) => Vec; radius: number; height: (n: Vec) => number };
export type Intent = { thrust?: number; strafe?: number; lift?: number; yaw?: number; boost?: number; fire?: boolean };

function shipCore(): ShipCore {
  const found = (globalThis as unknown as { BCMShipCore?: ShipCore }).BCMShipCore;
  if (!found) throw new Error("Orbis: ship-core.js is not loaded on the page");
  return found;
}

export type LootKind = "board" | "crate" | "barrel" | "backpack";
export const LOOT_NAMES: Record<LootKind, string> = { board: "доски", crate: "ящик", barrel: "бочка", backpack: "рюкзак" };

export const ORBIS = { radius: 140, homeRange: 14, pickRange: 4, pickClear: 5.5, towerRange: 48, boltSpeed: 46, boltLife: 1.3 };

/** The ships the captain keeps by the home base. */
/** The ships the captain keeps by the home base; model = a family of the ship catalogue (GLB). */
export const FLEET = [
  { id: "skiff", name: "Скиф", note: "быстрый, трюм на 4", speed: 1.3, hp: 4, cap: 4, fireEvery: 0.32, model: "jetjet", length: 6 },
  { id: "barge", name: "Баржа", note: "медленная, крепкая, трюм на 8", speed: 0.85, hp: 8, cap: 8, fireEvery: 0.4, model: "packlite", length: 11 },
  { id: "lancer", name: "Копьё", note: "боевой, частый огонь, трюм на 5", speed: 1.05, hp: 5, cap: 5, fireEvery: 0.16, model: "mamba", length: 9 },
] as const;
/** The pirates' gunship over each tower, from the ship catalogue. */
export const PIRATE_MODEL = "maxhog";
/** The captain: a human Crew model from mini-sim/assets/mesh/characters 3d. */
export const CAPTAIN_MODEL = "characters 3d/human/ja_victorn_prototype.glb";
export type FleetId = (typeof FLEET)[number]["id"];

/** The castle: what each next tier needs, in delivered materials. */
export const CASTLE_TIERS: Array<{ title: string; cost: Partial<Record<LootKind, number>> }> = [
  { title: "Стены", cost: { board: 4, crate: 2 } },
  { title: "Башни", cost: { barrel: 3, crate: 3, board: 2 } },
  { title: "Донжон", cost: { backpack: 2, board: 4, barrel: 2 } },
];

export const CAPTAIN = {
  name: "Капитан Ирма Сол",
  lines: [
    "Ты с ONI? Хорошо. Орбис держат пираты: шесть башен по всему шару и крепость на южном полюсе.",
    "Бери любой корабль — разрешаю. Сбивай башни, собирай, что из них вывалится: доски, ящики, бочки, рюкзаки.",
    "Вези на базу — из этого построим замок. Пока стоит хоть одна башня, крепость под щитом.",
  ],
};

const norm = (a: Vec): Vec => {
  const l = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};
const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const sph = (lat: number, lon: number): Vec => ({
  x: Math.cos(lat) * Math.sin(lon),
  y: Math.sin(lat),
  z: Math.cos(lat) * Math.cos(lon),
});

/** Rolling hills on the sphere: up to about 7 m, flat at the poles where the bases stand. */
export function orbisHeight(n: Vec) {
  const hills = 3.2 + 2.2 * Math.sin(n.x * 5.1 + 0.6) * Math.cos(n.z * 4.3 - 0.4) + 1.4 * Math.sin((n.x + n.y * 2 + n.z) * 7.3);
  const pole = Math.min(1, Math.max(0, (Math.abs(n.y) - 0.9) / 0.06));
  return hills * (1 - pole) + 1.2 * pole;
}

export const HOME: Vec = { x: 0, y: 1, z: 0 };
export const FORTRESS: Vec = { x: 0, y: -1, z: 0 };
export const TOWERS: Vec[] = [
  sph(0.55, 0.3), sph(0.4, 2.2), sph(0.25, 4.1), sph(-0.2, 1.1), sph(-0.35, 3.3), sph(-0.5, 5.3),
];
export const VILLAGES = [
  { name: "Посёлок Клин", n: sph(0.75, 1.4), ask: "Башня к югу от нас стреляет по крышам. Сбей её — и мы отдадим доски со склада." },
  { name: "Хутор Ржавый Ключ", n: sph(-0.05, 4.7), ask: "Пираты сидят в двух башнях на запад отсюда. Без них к нам не долетает ни один караван." },
];

export type Drop = { kind: LootKind; at: Vec; taken: boolean };
export type Tower = { n: Vec; at: Vec; hp: number; cool: number };
export type Bolt = { at: Vec; vel: Vec; life: number; enemy: boolean };

export function createOrbis(seed = 1) {
  const core = shipCore();
  const world = core.sphereWorld({ radius: ORBIS.radius, height: orbisHeight });
  const ground = (n: Vec, lift = 0) => {
    const u = norm(n);
    const r = ORBIS.radius + orbisHeight(u) + lift;
    return { x: u.x * r, y: u.y * r, z: u.z * r };
  };
  let rnd = (seed >>> 0) || 1;
  const rand = () => ((rnd = (rnd * 1664525 + 1013904223) >>> 0) / 4294967296);

  const state = {
    phase: "briefing" as "briefing" | "fly",
    world,
    ship: null as Ship | null,
    fleetId: null as FleetId | null,
    hp: 0,
    hold: [] as LootKind[],
    materials: { board: 0, crate: 0, barrel: 0, backpack: 0 } as Record<LootKind, number>,
    castle: 0,
    towers: TOWERS.map((n) => ({ n, at: ground(n, 4), hp: 4, cool: 1 + rand() * 2 })) as Tower[],
    fortress: { at: ground(FORTRESS, 6), hp: 12, open: false },
    drops: [] as Drop[],
    bolts: [] as Bolt[],
    fireCool: 0,
    note: "",
    noteFor: 0,
    downs: 0,
    ground,
  };

  const say = (text: string, seconds = 4) => {
    state.note = text;
    state.noteFor = seconds;
  };

  /** The captain lets the hero take a ship (FLEET id). */
  function takeShip(id: FleetId) {
    const make = FLEET.find((f) => f.id === id) ?? FLEET[0];
    const start = ground(norm({ x: 0.06, y: 1, z: 0.1 }), 3.2);
    state.ship = core.create("hover", { position: start, forward: { x: 0, y: 0, z: 1 }, tune: { speed: make.speed } });
    state.fleetId = make.id;
    state.hp = make.hp;
    state.hold = [];
    state.phase = "fly";
    say(`${make.name}: ${make.note}. Капитан машет с причала.`, 4);
  }

  const shieldUp = () => state.towers.some((t) => t.hp > 0);

  function spill(at: Vec, count: number) {
    const kinds: LootKind[] = ["board", "crate", "barrel", "backpack"];
    const n0 = norm(at);
    for (let i = 0; i < count; i++) {
      const jitter = norm({ x: n0.x + (rand() - 0.5) * 0.06, y: n0.y + (rand() - 0.5) * 0.06, z: n0.z + (rand() - 0.5) * 0.06 });
      state.drops.push({ kind: kinds[Math.floor(rand() * kinds.length)], at: ground(jitter, 0.4), taken: false });
    }
  }

  function canBuild() {
    const next = CASTLE_TIERS[state.castle];
    if (!next) return false;
    return (Object.keys(next.cost) as LootKind[]).every((k) => state.materials[k] >= (next.cost[k] ?? 0));
  }

  function step(dt: number, intent: Intent) {
    const d = Math.max(0, Math.min(0.1, dt));
    state.noteFor = Math.max(0, state.noteFor - d);
    if (state.phase !== "fly" || !state.ship) return;
    const ship = state.ship;
    const make = FLEET.find((f) => f.id === state.fleetId) ?? FLEET[0];
    core.step(ship, intent, d, world);

    // Fire: a bolt from the nose.
    state.fireCool = Math.max(0, state.fireCool - d);
    if (intent.fire && state.fireCool === 0) {
      state.fireCool = make.fireEvery;
      const f = ship.forward;
      state.bolts.push({
        at: { x: ship.position.x + f.x * 2, y: ship.position.y + f.y * 2, z: ship.position.z + f.z * 2 },
        vel: { x: f.x * ORBIS.boltSpeed, y: f.y * ORBIS.boltSpeed, z: f.z * ORBIS.boltSpeed },
        life: ORBIS.boltLife,
        enemy: false,
      });
    }

    // Towers fire at a ship close by.
    for (const t of state.towers) {
      if (t.hp <= 0) continue;
      t.cool -= d;
      if (dist(t.at, ship.position) < ORBIS.towerRange && t.cool <= 0) {
        t.cool = 2.2;
        const aim = norm({ x: ship.position.x - t.at.x, y: ship.position.y - t.at.y, z: ship.position.z - t.at.z });
        state.bolts.push({ at: { ...t.at }, vel: { x: aim.x * 20, y: aim.y * 20, z: aim.z * 20 }, life: 3, enemy: true });
      }
    }

    // Bolts fly and hit.
    for (const b of state.bolts) {
      b.at = { x: b.at.x + b.vel.x * d, y: b.at.y + b.vel.y * d, z: b.at.z + b.vel.z * d };
      b.life -= d;
      if (b.life <= 0) continue;
      if (b.enemy) {
        if (dist(b.at, ship.position) < 2.2) {
          b.life = 0;
          state.hp -= 1;
          if (state.hp <= 0) return shotDown();
          say("Попадание! Корпус " + state.hp + "/" + make.hp, 2);
        }
        continue;
      }
      for (const t of state.towers) {
        if (t.hp > 0 && dist(b.at, t.at) < 4) {
          b.life = 0;
          t.hp -= 1;
          if (t.hp <= 0) {
            spill(t.at, 4);
            const left = state.towers.filter((x) => x.hp > 0).length;
            say(left ? `Башня пала! Добыча на земле. Башен осталось: ${left}.` : "Последняя башня пала — щит крепости погас!", 4);
          }
        }
      }
      if (b.life > 0 && !state.fortress.open && dist(b.at, state.fortress.at) < 7) {
        b.life = 0;
        if (shieldUp()) say("Щит крепости держит, пока стоит хоть одна башня.", 2);
        else {
          state.fortress.hp -= 1;
          if (state.fortress.hp <= 0) {
            state.fortress.open = true;
            spill(state.fortress.at, 8);
            say("Крепость пала! Много добычи. Вход в недра открыт — это следующий рейс.", 5);
          }
        }
      }
    }
    state.bolts = state.bolts.filter((b) => b.life > 0);

    // Take loot low over the ground.
    const clear = core.clearance(ship, world);
    for (const drop of state.drops) {
      if (drop.taken || state.hold.length >= make.cap) continue;
      if (clear < ORBIS.pickClear && dist(drop.at, ship.position) < ORBIS.pickRange + clear) {
        drop.taken = true;
        state.hold.push(drop.kind);
        say(`В трюме: ${LOOT_NAMES[drop.kind]} (${state.hold.length}/${make.cap})`, 2);
      }
    }

    // Over the home base the hold is unloaded and the castle grows.
    const home = ground(HOME, 0);
    if (dist(ship.position, home) < ORBIS.homeRange && state.hold.length) {
      for (const k of state.hold) state.materials[k] += 1;
      state.hold = [];
      say("Трюм разгружен на базе.", 2);
    }
    while (dist(ship.position, home) < ORBIS.homeRange && canBuild()) {
      const next = CASTLE_TIERS[state.castle];
      (Object.keys(next.cost) as LootKind[]).forEach((k) => { state.materials[k] -= next.cost[k] ?? 0; });
      state.castle += 1;
      say(`Замок растёт: ${next.title}!`, 4);
    }
  }

  function shotDown() {
    state.downs += 1;
    state.hold = [];
    const id = state.fleetId ?? "skiff";
    takeShip(id);
    say("Корабль сбит. Груз потерян. Капитан выдал такой же — снова в бой.", 4);
  }

  /** The nearest village within reach, for its request on screen. */
  function villageNear() {
    if (!state.ship) return null;
    for (const v of VILLAGES) if (dist(ground(v.n, 0), state.ship.position) < 26) return v;
    return null;
  }

  return { state, step, takeShip, canBuild, villageNear, shieldUp };
}

export type Orbis = ReturnType<typeof createOrbis>;
