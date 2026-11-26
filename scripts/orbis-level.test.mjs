// Owner 26.11.2026 (IDEA-033): a whole sphere planet to fly over (Magic Carpet 2 as a genre only), "ресурсы
// вываливаются: доски, ящики, бочки, рюкзаки … из этого будем строить базы … один уровень с несколькими
// точками интереса и улучшением собственной базы … капитан должен разрешить нашему герою взять любой
// корабль". The level Orbis plays on the one ship core (ship-core.js). This test flies it by intents.
import "./lib/first-planet-sim.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";

// The page loads the one ship core before First Planet; so does the test.
await import("../mini-sim/assets/js/ship-core.js");
const orbisMod = await import("../mini-sim/first-planet/src/game/sphere/orbis.ts");
const { createOrbis, FLEET, CASTLE_TIERS, ORBIS, TOWERS, HOME, CAPTAIN } = orbisMod;

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const len = (a) => Math.hypot(a.x, a.y, a.z);

/** Steer the ship over the sphere towards a point: yaw by which side of the nose the target lies. */
function steer(ship, target) {
  const to = sub(target, ship.position);
  const up = ship.up;
  const flat = sub(to, { x: up.x * dot(to, up), y: up.y * dot(to, up), z: up.z * dot(to, up) });
  const side = dot(cross(ship.forward, flat), up);
  const ahead = dot(ship.forward, flat) / (len(flat) || 1);
  return { yaw: side > 0 ? -Math.min(1, Math.abs(side) / 20 + 0.2) : Math.min(1, Math.abs(side) / 20 + 0.2), ahead, d: len(to) };
}

function flyTo(game, target, { stopAt = 6, low = false, fire = false, seconds = 120 } = {}) {
  for (let i = 0; i < seconds * 60; i += 1) {
    const ship = game.state.ship;
    const s = steer(ship, target);
    if (s.d < stopAt) return true;
    game.step(1 / 60, { thrust: s.ahead > 0.3 ? 1 : 0.3, yaw: s.yaw, lift: low ? -1 : 0, fire: fire && s.ahead > 0.97 && s.d < 26 });
  }
  return false;
}

test("the captain lets the hero take any of the parked ships, and each flies its own way", () => {
  const game = createOrbis(5);
  assert.equal(game.state.phase, "briefing", "the hero takes a ship without the captain's word");
  assert.ok(CAPTAIN.lines.join(" ").match(/корабль/i));
  assert.ok(FLEET.length >= 3);
  const speeds = FLEET.map((make) => {
    const g = createOrbis(5);
    g.takeShip(make.id);
    for (let i = 0; i < 240; i += 1) g.step(1 / 60, { thrust: 1 });
    return g.state.ship.speed;
  });
  assert.ok(new Set(speeds.map((v) => v.toFixed(1))).size === FLEET.length, "the captain's ships all fly the same");
  game.takeShip("lancer");
  assert.equal(game.state.phase, "fly");
});

test("a tower brought down spills boards, crates, barrels and backpacks; the fortress keeps its shield while a tower stands", () => {
  const game = createOrbis(5);
  game.takeShip("lancer");
  const tower = game.state.towers[0];
  assert.ok(flyTo(game, tower.at, { stopAt: 4.5, fire: true, seconds: 200 }) || tower.hp <= 0, "the ship cannot reach the tower");
  for (let i = 0; i < 600 && tower.hp > 0; i += 1) {
    const s = steer(game.state.ship, tower.at);
    game.step(1 / 60, { thrust: s.d > 14 ? 0.6 : 0, yaw: s.yaw, fire: s.ahead > 0.95 });
  }
  assert.ok(tower.hp <= 0, "the tower does not fall to the ship's fire");
  // Flying over the spill already takes some of it (as a carpet does): count everything that fell.
  const drops = game.state.drops;
  assert.ok(drops.length >= 3, "the fallen tower spills no loot");
  for (const d of drops) assert.ok(["board", "crate", "barrel", "backpack"].includes(d.kind));
  assert.equal(game.shieldUp(), true, "the fortress shield falls with one tower down");
});

test("loot taken low over the ground goes home in the hold and builds the castle", () => {
  const game = createOrbis(9);
  game.takeShip("barge");
  // Bring two towers down, take all their loot, fly home.
  for (const tower of game.state.towers.slice(0, 3)) {
    for (let i = 0; i < 260 * 60 && tower.hp > 0; i += 1) {
      const s = steer(game.state.ship, tower.at);
      game.step(1 / 60, { thrust: s.d > 14 ? 1 : 0, yaw: s.yaw, fire: s.ahead > 0.95 && s.d < 26 });
    }
    for (const drop of game.state.drops) {
      if (drop.taken || game.state.hold.length >= 8) continue;
      flyTo(game, drop.at, { stopAt: 2.5, low: true, seconds: 60 });
    }
  }
  const carried = game.state.hold.length;
  assert.ok(carried >= 4, `the hold carries ${carried} things: loot is not taken low over the ground`);
  const home = game.state.ground(HOME, 0);
  assert.ok(flyTo(game, home, { stopAt: ORBIS.homeRange * 0.6, seconds: 200 }), "the ship cannot fly home");
  for (let i = 0; i < 30; i += 1) game.step(1 / 60, {});
  assert.equal(game.state.hold.length, 0, "the hold is not unloaded over the base");
  const delivered = Object.values(game.state.materials).reduce((a, b) => a + b, 0)
    + CASTLE_TIERS.slice(0, game.state.castle).reduce((a, t) => a + Object.values(t.cost).reduce((x, y) => x + y, 0), 0);
  assert.ok(delivered >= carried, "the delivered loot is lost");
  // Enough materials build the next tier over the base.
  Object.assign(game.state.materials, { board: 10, crate: 10, barrel: 10, backpack: 10 });
  for (let i = 0; i < 10; i += 1) game.step(1 / 60, {});
  assert.equal(game.state.castle, CASTLE_TIERS.length, "the castle does not grow from the delivered materials");
  assert.equal(TOWERS.length, 6);
});
