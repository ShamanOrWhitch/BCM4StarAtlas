// Owner 24.11.2026 (BUG-028): "смех и выстрел заменены дешёвой потряской текстуры". Since D-088 the
// Brawler's charge, volley, drink and laugh were the model shaken and tilted (brawlerPose); the
// owner's clips had no place on screen at all (the HUD comic table was left uncalled).
// Owner 25.11.2026 chose "рамка на месте Бойца": the clips (a studio or a room behind, so they
// cannot be keyed out) play in the arena on the Brawler's spot and at its size, in a soft oval;
// the model hides under them and does not shake. Browser proof: scripts/ring-boss-arena-probe.mjs
// (before: model shown, no clip, shake 0.04-0.12 rad in charge and laugh; after: PASS).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../mini-sim/assets/js/ring-platformer.js", import.meta.url), "utf8");

test("each Brawler state with an owner clip plays it: cannon through the volley, drink, laugh", () => {
  const start = src.indexOf("const BRAWLER_FILMS = {");
  const end = src.indexOf("const BRAWLER_FILM_ASPECT");
  assert.ok(start > 0 && end > start, "the Brawler's clips have no place in the arena");
  const { films, byState } = new Function(src.slice(start, end) + "; return { films: BRAWLER_FILMS, byState: BRAWLER_FILM_BY_STATE };")();
  assert.equal(films[byState.taunt].file, "brawler-laugh.mp4");
  for (const s of ["charge", "aim", "fire", "recover"]) assert.equal(films[byState[s]].file, "brawler-attack-cannon.mp4", `${s} has no cannon clip`);
  assert.equal(films[byState.drink].file, "brawler-drink.mp4");
  for (const s of ["advance", "back"]) assert.equal(byState[s], undefined, `${s}: the walking Brawler is the model`);
});

test("the clip stands in the arena in place of the model, and the model never shakes", () => {
  assert.match(src, /boss\.group\.add\(mesh\);\s*boss\.brawlerFilm = /, "the clip is not in the arena");
  assert.match(src, /phaseGroup\.visible = !playBrawlerFilm\(boss, phaseGroup, out\);/, "the model is not hidden under its clip");
  assert.match(src, /smoothstep\(0\.7, 1\.0, bcmOvalR\)/, "the room around the Brawler is not faded to an oval");
  const pose = src.slice(src.indexOf("function brawlerPose("), src.indexOf("function runBossMoves("));
  assert.doesNotMatch(pose, /out\.state === "taunt"|out\.state === "fire"|out\.state === "charge"/, "the model still shakes for the laugh or the shot");
  assert.doesNotMatch(src, /bcm-ring-boss-comic/, "the HUD comic panel is back");
  assert.match(src, /hideBrawlerFilm\(boss\);\s*if \(boss\.phaseIndex === 4\) preloadBrawlerFilms\(boss\);/, "the clips are not hidden at a transition or not loaded before the Brawler");
});
