// Owner 18-19.11.2026: "везде свои персонажи, на каждой планете"; "имена и
// роли меняются, и системы квестов — больше разнообразия". Each planet brings
// its own residents (names, roles, lines) and hands out its quests through a
// different mix of quest kinds, including a new "relay" (carry something from
// one resident to another). Played on the real island sim by keys.
import { test } from "node:test";
import assert from "node:assert/strict";
import { playIsland } from "./lib/first-planet-sim.mjs";

const SRC = new URL("../mini-sim/first-planet/src/", import.meta.url).href;
const content = await import(SRC + "game/island/content.ts").catch(() => null);
const terrain = await import(SRC + "game/island/terrain.ts");

/** Walk the sim to a point (teleport the feet: the test is about quests, not paths). */
function at(sim, p) {
  sim.x = p.x;
  sim.z = p.z;
  sim.y = terrain.footY(p.x, p.z, 0);
}

function talkThrough(sim, hold, tap) {
  tap("KeyE");
  for (let i = 0; i < 8 && sim.dialogue; i += 1) tap("KeyE");
}

test("each planet has its own three residents, with names and roles", () => {
  assert.ok(content, "First Planet has no planet content: every planet has Sera, Orr and Lamp");
  const { planetContent } = content;
  const names = (id) => Object.values(planetContent(id).residents).map((r) => r.name);
  const twinsun = names("first");
  assert.deepEqual(twinsun, ["Сера Венн", "Орр-1", "Ламп"], "Twinsun must keep its residents");
  for (const id of ["fable", "opus"]) {
    const own = names(id);
    assert.equal(new Set(own).size, 3);
    for (const name of own) assert.ok(!twinsun.includes(name), `${id} copies the Twinsun resident ${name}`);
    for (const r of Object.values(planetContent(id).residents)) {
      assert.ok(r.role && r.role.length > 3, `${r.name} has no role`);
      assert.ok(r.title && r.offer.length && r.go.length && r.ready.length && r.done.length, `${r.name} has no full quest text`);
    }
  }
});

test("quest kinds are mixed differently on each planet, and the relay kind exists", () => {
  const { planetContent } = content;
  const mix = (id) => Object.values(planetContent(id).residents).map((r) => r.kind).join(",");
  const mixes = ["first", "fable", "opus"].map(mix);
  assert.equal(new Set(mixes).size, 3, `two planets hand out quests the same way: ${mixes.join(" | ")}`);
  const kinds = new Set(["first", "fable", "opus"].flatMap((id) => Object.values(planetContent(id).residents).map((r) => r.kind)));
  for (const k of ["collect", "fetch", "light", "relay"]) assert.ok(kinds.has(k), `no planet uses the quest kind ${k}`);
});

// 26.11.2026: Opus has its own residents and quests (layout.ts, D-115) and no relay quest any more;
// the relay is played on Fable, and Opus plays its beacon quest at its own places.
test("the relay quest is played by keys: offer, hand over to the other resident, turn in", () => {
  const { planetContent } = content;
  const { sim, hold, tap } = playIsland(7, "fable");
  const residents = planetContent("fable").residents;
  const [slot, giver] = Object.entries(residents).find(([, r]) => r.kind === "relay");
  const target = residents[giver.to];
  assert.ok(target, "the relay quest has no receiver");
  const spot = (s) => terrain.NPC[s];
  at(sim, spot(slot));
  talkThrough(sim, hold, tap);
  assert.equal(sim.quests[slot], "go", "talking to the relay giver does not start the quest");
  assert.equal(sim.ready(slot), false);
  at(sim, spot(giver.to));
  tap("KeyE");
  // The receiver names the thing in any case (карту / карта): match its stem.
  assert.match(sim.dialogue?.pages.join(" ") || "", new RegExp(giver.item.slice(0, 4), "i"), `${target.name} does not take the ${giver.item}`);
  talkThrough(sim, hold, tap);
  assert.equal(sim.ready(slot), true, "after the hand-over the relay quest is not ready to turn in");
  at(sim, spot(slot));
  talkThrough(sim, hold, tap);
  assert.equal(sim.quests[slot], "done");
  const hud = sim.hud();
  assert.ok(hud.quests.some((q) => q.title === giver.title), "the HUD lists another planet's quests");
});

test("on Opus the castle steward's beacons are lit by keys at Opus's own places, then the castle chest opens", () => {
  const { planetContent } = content;
  const { sim, hold, tap } = playIsland(7, "opus");
  const steward = planetContent("opus").residents.bulb;
  assert.equal(steward.kind, "light");
  at(sim, terrain.NPC.bulb);
  talkThrough(sim, hold, tap);
  assert.equal(sim.quests.bulb, "go", "talking to the steward does not start the beacons");
  // The beacons stand on the ridge path and the eastern plateau, far from the classic square.
  assert.ok(terrain.BRAZIERS.every((b) => Math.hypot(b.x, b.z - 8) > 12), "an Opus beacon stands on the classic square");
  terrain.BRAZIERS.forEach((b) => { at(sim, b); tap("KeyE"); talkThrough(sim, hold, tap); });
  assert.equal(sim.ready("bulb"), true, "two lit beacons do not finish the steward's quest");
  at(sim, terrain.NPC.bulb);
  talkThrough(sim, hold, tap);
  assert.equal(sim.quests.bulb, "done");
  at(sim, terrain.CHEST);
  tap("KeyE");
  assert.match(sim.dialogue?.pages.join(" ") || "", /замков/i, "the castle chest does not open");
  assert.ok(sim.hud().quests.some((q) => q.title === steward.title));
});

test("progress is kept per planet", () => {
  const a = playIsland(7, "opus");
  a.sim.quests.sera = "done";
  a.sim.persist();
  const b = playIsland(7, "fable", { keepSave: true });
  assert.equal(b.sim.quests.sera, "new", "finishing a quest on Opus finishes it on Fable too");
});
