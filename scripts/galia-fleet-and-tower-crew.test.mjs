// Owner's live-site list, 16.11.2026 (Mini-Sim inside Galia):
// BUG-011 the ship chosen in the Galia fleet is not the ship the player flies,
// BUG-012 Tower inside Galia gets no NFT crew (a blue ball instead),
// BUG-017 the mouse does not turn the ship when the browser refuses pointer lock.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ROOT = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");
const mini = read("mini-sim/assets/js/mini-sim.js");
const tower = read("mini-sim/tower/assets/js/tower.js");

/** One named function cut out of a script, run as written. */
function cut(source, name, context = {}) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name}() is not in the script`);
  let depth = 0;
  let end = -1;
  for (let i = source.indexOf("{", start); i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  const box = vm.createContext({ ...context });
  vm.runInContext(source.slice(start, end) + `;this.${name} = ${name};`, box);
  return box[name];
}

const catalog = JSON.parse(read("mini-sim/assets/mesh/ships/catalog.json")).families;
const FLIGHT = catalog.filter((s) => s.id && s.flight).map((s) => ({ id: s.id, name: s.name }));

test("BUG-011: the first chosen fleet ship that has a model becomes the ship of the flight", () => {
  assert.match(mini, /addEventListener\("galia-fleet-config"/, "Mini-Sim does not listen to the fleet chosen in Galia Desk: the player keeps Opal Jet");
  const shipKey = cut(mini, "shipKey");
  const pickFleetFlight = cut(mini, "pickFleetFlight", { shipKey });
  // The owner's fleet from the screenshot: Opal Jetjet 0, Rainbow Om 1.
  const fleet = [
    { name: "Fimbul Airbike", quantity: 0 },
    { name: "Opal Jetjet", quantity: 0 },
    { name: "Rainbow Om", quantity: 1 },
  ];
  assert.equal(pickFleetFlight(fleet, FLIGHT)?.id, "rainbow-om");
  // Order is the priority.
  assert.equal(pickFleetFlight([{ name: "Opal Jetjet", quantity: 2 }, { name: "Rainbow Om", quantity: 1 }], FLIGHT)?.id, "jetjet");
  // "Opal Jetjet" must not fall onto "Opal Jet".
  assert.equal(pickFleetFlight([{ name: "Opal Jet", quantity: 1 }], FLIGHT)?.id, "opal");
  // A ship without a model, or an empty fleet, changes nothing.
  assert.equal(pickFleetFlight([{ name: "Pearce C9", quantity: 1 }], FLIGHT), null);
  assert.equal(pickFleetFlight([], FLIGHT), null);
  assert.equal(pickFleetFlight(null, FLIGHT), null);
  // Galia "Играть" sends the whole wallet without quantities: the first owned ship with a model.
  assert.equal(pickFleetFlight([{ name: "Unknown Hull" }, { name: "Ogrika Ruch" }], FLIGHT)?.id, "ruch");
  // The Galia launch and the Desk fleet both go through it.
  const handler = mini.slice(mini.indexOf("function handleGaliaPlayRequest("), mini.indexOf("async function connectCrewWallet("));
  assert.match(handler, /applyFleetShip\(/, "a Galia launch still ignores the fleet ships for the hull");
});

test("BUG-012: Tower takes one crew member, and the crew Galia launched with", () => {
  const body = tower.slice(tower.indexOf("function syncCrewSelectionFromMiniSim("), tower.indexOf("const renderer = new THREE.WebGLRenderer("));
  assert.doesNotMatch(body, /selected\.length < 2/, "Tower drops the crew when only one is chosen: the player is a blue ball");
  const nft = { id: "m1", given: "Aanothin", family: "Thalaramgroo", species: "Profound Punaab", image: "https://cdn.staratlas.com/crew/v1/1010495_full.jpeg" };
  const source = (window) => cut(tower, "towerCrewSource", { window })();
  assert.equal(source({}), null);
  assert.deepEqual(source({ BCMMiniCrewSelection: { players: [nft] } }), [nft], "one crew chosen in Mini-Sim is ignored");
  assert.deepEqual(source({ GALIA_PLAY_STATE: { crew: [nft, { id: "m2" }] } })?.[0], nft, "the crew Galia launched with is ignored");
  // Mini-Sim's own committed selection wins over the Galia launch state.
  assert.equal(source({ BCMMiniCrewSelection: { players: [{ id: "a" }] }, GALIA_PLAY_STATE: { crew: [nft] } })[0].id, "a");
  assert.match(body, /towerCrewSource\(\)/);
});

test("BUG-017: without pointer lock the mouse still turns the ship while the button is held", () => {
  const start = mini.indexOf('document.addEventListener("mousemove", (e) => {', mini.indexOf('document.addEventListener("pointerlockerror"'));
  const handler = mini.slice(start, mini.indexOf("const helmPanel = document.createElement", start));
  assert.ok(handler.includes("ship.angularVelocity.y -= e.movementX"));
  assert.doesNotMatch(handler, /if \(!pointerLocked\) return;/, "mouse look needs pointer lock: a browser that refuses it leaves the ship without a mouse");
  assert.match(handler, /e\.buttons & 1/);
  const steer = cut(mini, "mouseSteers");
  assert.equal(steer(true, 0, true), true, "locked pointer steers");
  assert.equal(steer(false, 1, true), true, "held button steers without the lock");
  assert.equal(steer(false, 0, true), false, "a bare mouse move over the page must not steer");
  assert.equal(steer(false, 1, false), false, "dragging outside the flight must not steer");
});
