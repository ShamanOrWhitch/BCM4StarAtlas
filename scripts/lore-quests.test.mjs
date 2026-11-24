// Owner 24.11.2026: "Прочитать весь лор из комиксов и добавить предметы и квесты всех планет и звёздных
// станций и другие сектора". Star Atlas Core Act 1 was read page by page (notes in mini-sim/LORE_CORE.md).
// Every planet has its own residents, items and quests (Pearce and Ioki fell back to Twinsun's); the three
// stations give contracts that send the pilot to the star bases of the lore sectors and back.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import "./lib/first-planet-sim.mjs";

const ROOT = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");
const { planetContent } = await import("../mini-sim/first-planet/src/game/island/content.ts");

test("every planet has its own residents and quests; none borrows Twinsun's", () => {
  const ids = ["first", "fable", "opus", "pearce", "ioki"];
  const names = new Map();
  for (const id of ids) {
    const c = planetContent(id);
    for (const slot of ["sera", "orr", "bulb"]) {
      const r = c.residents[slot];
      assert.ok(!names.has(r.name), `${id}: ${r.name} also lives on ${names.get(r.name)}`);
      names.set(r.name, id);
    }
  }
  const ioki = planetContent("ioki");
  const relay = Object.values(ioki.residents).find((r) => r.kind === "relay");
  assert.ok(relay && /куб/i.test(relay.item), "Ioki has no data cube to carry to the Elders");
  assert.ok(Object.values(ioki.residents).some((r) => /\.(bod|iddt|lrnr|doer|tchr|soul|eldr)$/.test(r.name)), "Ioki's Ustur carry no Seven Steps suffix");
  const pearce = planetContent("pearce");
  assert.ok(Object.values(pearce.residents).some((r) => /MUD|полиц|следоват/i.test(r.role)), "Pearce has no MUD people");
});

function quests() {
  const store = new Map();
  const ctx = vm.createContext({ Math, Object, Array, Number, String, JSON, Map, console,
    localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) } });
  ctx.window = ctx;
  vm.runInContext(read("mini-sim/assets/js/galia-lore.js"), ctx);
  vm.runInContext(read("mini-sim/assets/js/galia-quests.js"), ctx);
  return ctx.BCMGaliaQuests;
}

test("each station gives a contract over the lore sectors; visiting the bases and returning completes it", () => {
  const Q = quests();
  assert.ok(Q, "no station contracts");
  for (const station of ["oni", "mud", "ustur"]) {
    const c = Q.contractFor(station);
    assert.ok(c && c.steps.length >= 2, `${station}: no contract`);
    for (const step of c.steps) assert.ok(Q.loreSector(step.sector), `${station}: step at an unknown sector ${step.sector}`);
  }
  const c = Q.accept("mud");
  assert.equal(Q.active().id, c.id);
  assert.match(Q.hudLine(), /\d\/\d/, "no progress on the HUD");
  for (const step of c.steps) {
    assert.equal(Q.visit(step.sector, 999), false, "a far pass counts as a visit");
    assert.equal(Q.visit(step.sector, 40), true, `the base of ${step.sector} is not marked`);
  }
  assert.equal(Q.active().ready, true, "all bases visited but the contract is not ready to hand in");
  assert.equal(Q.returnTo("oni"), false, "the contract is handed in at the wrong station");
  assert.equal(Q.returnTo("mud"), true);
  assert.equal(Q.active(), null);
  assert.ok(Q.done().includes(c.id));
});

test("the space scene feeds the contracts: base distance each frame, station on return", () => {
  const sim = read("mini-sim/assets/js/mini-sim.js");
  assert.match(sim, /BCMGaliaQuests\.tick\(/, "the frame never checks the bases");
  const php = read("mini-sim/bcm-mini-sim.php");
  assert.match(php, /'bcm-galia-quests', BCM_MINI_SIM_URL \. 'assets\/js\/galia-quests\.js'/);
  assert.match(read("tools/minisim-qa/standalone-shell.html"), /galia-quests\.js/);
  const notes = read("mini-sim/LORE_CORE.md");
  for (const w of ["NC7-503-426", "Calico Seeker", "Genesium", "Scarlet Core", "Summit of the Elders", "Sound of Light"]) assert.match(notes, new RegExp(w));
});
