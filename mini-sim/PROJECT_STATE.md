## Hotfix — Tower 0.2.91: общая мёртвая зона геймпада (24 ноября 2026)

- **WORK LOCK:** [#170](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/170). **Decision:** D-105.
- **Baseline:** Mini-Sim 0.16.28 / Tower 0.2.90.
- **Причина:** аналоговая кривая Tower обнуляла наклон до 0.22, но цифровые направления включались от 0.16. В диапазоне 0.16–0.22 игрок получал полный цифровой поворот вместо нуля.
- **Исправление:** `tower.js` использует один `TOWER_STICK_DEAD_ZONE = 0.22` для кривой и цифровых флагов; focused test проверяет 0.16 / 0.21 / 0.22 и сам стык с polling.
- **Кеш:** `bcm-tower.php` поднят до Tower 0.2.91: WordPress enqueue для Tower JS/CSS использует `BCM_TOWER_VERSION`, не filemtime.
- **Main:** [75b0506](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/75b05060bf2a60a596536724320ccc67b041808c) (runtime [f5fa4f4](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/f5fa4f471ca43b314cd922082c46abeda0c83c3a), cache [23d7cda](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/23d7cda2ed5741243fade968a557476018c45e62)).
- **Проверка:** тест усилен; итоговый CI после hotfix ещё не подтверждён. Физический геймпад и production WordPress не проверялись.
- Mini-Sim остаётся 0.16.28; Ring, Warp, Race, Crew Core и AUDIO FREEZE не менялись.

---

## Patch — Mini-Sim 0.16.30: race finish banner across the road; race suns ride the sky along their light (25 November 2026)

- **WORK LOCK:** [#172](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/172). Decision D-107, BUG-029.
- **Checks:** regression 356/356; Planet Lab race shots on Twinsun, Fable and Opus.

---

## Patch — Mini-Sim 0.16.29 / Tower 0.2.92: forearm bones from the NFT cut-out (25 November 2026)

- **WORK LOCK:** [#171](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/171). Decision D-106. Bug: BUG-032 (arms).
- **Change:** crew-core cuts forearms where the art shows a gap and swings them from the elbow in Tower and the Ring.
- **Checks:** regression 354/354; Crew Lab on real NFTs (Ustur both arms, Human and Profound Punaab one arm, the others one-piece).

---

## Patch — Mini-Sim 0.16.28: gamepad via crew-core schemes; Tower analog stick; ONI CSS restored; Twinsun two suns (24 November 2026)

- **WORK LOCK:** [#169](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/169). Decision D-104.
- **Bugs:** BUG-025…033 logged.
- **Checks:** regression 349/349, UI layer PASS.

---

## Patch — Mini-Sim 0.16.26: Core lore read; Pearce and Ioki quests; station contracts (24 November 2026)

- **WORK LOCK:** [#168](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/168). Decision D-102.
- **`content.ts`:** `PEARCE` and `IOKI` packs — residents, items and quests from the lore.
- **`galia-quests.js` (new):** contracts for ONI, MUD and Ustur over the lore sectors.
  - The ship's distance to the sector's star base comes from `mini-sim.js` every frame.
  - A Warp arrival at a CSS takes or hands in a contract (`deep-space-warp.js`).
- **`LORE_CORE.md`:** Act 1 page by page.
- **Checks:** regression 342/342, Edge contract probe PASS.

---

## Patch — Mini-Sim 0.16.25: Fable, the living planet (24 November 2026)

- **WORK LOCK:** [#167](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/167). Decision D-101.
- **`planet-rules.ts`:** new `living` rule — planet attention, vines, the immune push and spores.
- **`fable-look.ts` (new):** spore pods and vines.
- **HUD:** attention bar.
- **Checks:** regression 339/339, Edge probe PASS.

---

## Patch — Mini-Sim 0.16.24: planet rules on foot (24 November 2026)

- **WORK LOCK:** [#166](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/166). Decision D-100.
- **`island/planet-rules.ts` (new):**
  - Twinsun: heat and shade;
  - Ioki: low gravity;
  - Pearce: swimming on a breath meter.
- **Sim and HUD:** `sim.ts` and the HUD are wired to the rules; `wp-dist` is rebuilt.
- **Checks:**
  - regression 337/337;
  - Edge probe PASS.

---

## Patch — Mini-Sim 0.16.23: no ONI CSS screen outside ONI CSS (24 November 2026)

- **Decision:** D-099.
- **Gate:** the ONI landing screen is hidden outside ONI CSS. Twinsun and Opus get their own landing beacon and approach label; lore sectors have no gate.
- **Checks:** regression 333/333, Edge probes PASS.

---

## Patch — Mini-Sim 0.16.22: seeded star bases by faction; own space for lore sectors (24 November 2026)

- **WORK LOCK:** [#165](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/165). Decision D-098.
- **`star-base.js` (new):** seeded modular bases in ONI, MUD, Ustur and MRZ styles.
- **`sector-look.js`:** 12 lore sector looks, each with its own base.
- **`deep-space-warp.js`:** lore sectors arrive in open space; unnamed stars keep the maze.
- **Checks:** regression 332/332, UI layer PASS, `test:minisim` 65/65, Edge probe PASS.

---

## Patch — Mini-Sim 0.16.21: Star Atlas lore sectors on the Warp map; Core lore notes (24 November 2026)

- **WORK LOCK:** [#164](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/164). Decision D-097.
- **`galia-lore.js` (new):** 15 lore sectors whose coordinates match our Galia stars.
- **Map core:** `loreAt` in `sage-map-core.js`; `sectorTitle` uses the lore names.
- **Warp map canvas:** draws the lore names at every zoom.
- **`LORE_CORE.md`:** crew, Act 1–2 turns, races, sectors, sources.
- **Checks:** regression 328/328, Warp lore Edge probe PASS.

---

## Patch — Mini-Sim 0.16.20: videos 93 → 15 MB; Pearce's own MUD landing (24 November 2026)

- **WORK LOCK:** [#163](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/163). Decision D-096.
- **Videos:** all 25 re-encoded with ffmpeg (H.264 CRF 27, 854/640 px); audio streams copied.
- **Pearce:** `landing-pearce.mp4` (was the unused `mud planet.mp4`) is now `planetTransitions.pearce`.
- **Checks:** regression 325/325, transitions PASS.

---

## Patch — Mini-Sim 0.16.19: textures capped at 1024 px (24 November 2026)

- **WORK LOCK:** [#163](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/163). Decision D-095.
- **Change:** 80 images downscaled; same names and formats; 120 MB → 81 MB.
- **Pending:** videos and audio — need ffmpeg (download needs owner OK); audio edit deny in settings.
- **Checks:** regression 325/325, transitions PASS.

---

## Patch — Mini-Sim 0.16.18: own space for every planet sector; Pearce and Ioki reliefs (24 November 2026)

- **WORK LOCK:** [#162](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/162). Decision D-094.
- **`sector-look.js` (new):** per-planet planet, rings, moons, light, sky tint. Outside ONI CSS the station is hidden.
- **`deep-space-warp.js`:**
  - `dressSector` runs on arrival, on the return to ONI and on the maze;
  - a planet-sector arrival lands in open space at z −140, not in the start hangar.
- **`terrain.ts`:** Pearce has the `pearce` relief (lakes, islets), Ioki has `ioki` (craters, rift).
- **Checks:** regression 325/325, UI layer PASS, `test:minisim` 65/65, sector-look Edge probe PASS.

---

## Patch — Mini-Sim 0.16.17: Ring route to the bosses, held jetpack, crew-core figure; landing before the Tower menu (24 November 2026)

- Decision D-093, BUG-024.
- **ring-platformer.js:**
  - the route leads to the boss arena while a boss lives;
  - the jet thrusts while held and burns fuel per second;
  - the pilot is drawn by `BCMCrewCore.applyCrewFigure`.
- **ring-panels.js:** `FLIGHT.thrust` / `burn`; `flightCrossable` searches held-jet steps.
- **crew-core.js:** `createCrewLegs`, `applyCrewFigure` (Tower and Ring).
- **tower.js:**
  - the entry plays the planet's own landing film;
  - the handoff plays no film and keeps a cover until First Planet is live;
  - `loader.js` drops the cover on a failed load.
- **Checks:** regression 320/320, UI layer PASS, `test:minisim` 65/65, Edge Ring flight probe PASS, transitions PASS.

---

## Patch — Mini-Sim 0.16.16: Opus — capture nodes, module income, raiders (IDEA-026 steps 2–3) (24 November 2026)

- **WORK LOCK:** [#161](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/161). Decision D-092.
- **`island/carpet.ts`:** `nodes` (warden / ship), `captureNode`, module income, raids (`raider`, `raidIn`). The ship's aim includes the raider.
- **`island/opus-look.ts`:** shows our module and its bank crystals, and the raider; the warden is hidden on a captured node; minimap marks.
- **HUD:** shows owned nodes and a raid warning.
- **`wp-dist`:** rebuilt.
- **Checks:** tests 8–9 (CI), Edge probe PASS, regression 318/318.

---

## Patch — Mini-Sim 0.16.15: Opus, the carpet planet (IDEA-026 step 1) (23 November 2026)

- **WORK LOCK:** [#160](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/160). Decision D-091.
- **First Planet / Opus:** relief `opus` (terraces, karst pillars, canyon); `island/carpet.ts` flight controller (terrain-following hover, banked turns with lag, slope pitch, auto-lift over roofs, hover stop) and loop (store at the pad, sparks taken low, energy for height, wardens, three upgrades); `island/opus-look.ts` visuals; carpet camera; HUD panel and phone buttons. `window.__BCM_ISLAND_QA__` exposes the island sim to probes. `wp-dist` rebuilt.
- **Checks:** `first-planet-opus-carpet.test.mjs` (CI), Edge probe PASS, regression 316/316, UI layer PASS, `test:minisim` 65/65.

---

## Patch — Mini-Sim 0.16.14: First Planet cache busting, planet names in the Warp menu, dead duplicates removed (23 November 2026)

- **WORK LOCK:** [#159](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/159). Decision D-090, IDEA-028.
- **`tower/bcm-tower.php`:** `bcm_tower_file_version()` — the First Planet bundle, style and loader URLs follow the Mini-Sim release and the file's time and size (they carried only Tower 0.2.90, so sites kept the old bundle).
- **`sage-map-core.js`:** station sectors are named with their planet (Fable · ONI CSS, Pearce · MUD CSS, Ioki · Ustur CSS).
- **Removed:** 36 dead files (WARP SPACE kit leftovers, `replace/`, `repo-drop/`, root `Wall.mp4` duplicate, old patch zips, an old QA report) — see D-090 for the list and how to restore.
- **Checks:** regression 308/308, UI layer PASS, `test:minisim` 65/65.

---

## Patch — Mini-Sim 0.16.13: phone controls, Twinsun's own level, space traffic at ONI CSS (23 November 2026)

- **WORK LOCK:** [#158](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/158). Decision D-089.
- **Space tilt (Android):** dead 3°, full 24°, gain 0.55.
- **First Planet / Shoal Race:** `touch-pad.tsx` — shown on touch devices by code; stick + round buttons; race pad raised over the HUD panels. `wp-dist` rebuilt.
- **Twinsun:** relief `twinsun` (dunes, three mesas, ragged coast), second sun, drifting sand; Pearce / Ioki unchanged.
- **Space traffic:** `fleet-motion.js` + `space-traffic` group in the ONI station group (local simulation, #144 plan).
- **Tests / probes:** see D-089. Regression 308/308, UI layer PASS, standalone transitions QA PASS.

---

## Patch — Mini-Sim 0.16.12: the Brawler fires a volley itself; the pilot hops ledges; boss camera (23 November 2026)

- **WORK LOCK:** [#157](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/157). Decision D-088.
- **`ring-boss-moves.js`:** Brawler cannon = back to the far wall → charge 1.6 s → three plasma balls (11 m/s across the arena), each re-aimed at the pilot's current tier after a 0.7 s aim → recover → shielded drink → laugh window. Output: `charge`, `muzzle`, `balls`.
- **`ring-platformer.js`:** charge glow, aim line, glowing balls with halo and tail; `brawlerPose` (lean, tremble, recoil, squat, laugh shake); no comic panel for the Brawler; boss camera (toward the middle, ×1.18 pull-back, floor-based height); boss wake range 20 m; QA snapshot: aim band, balls, camera left/right.
- **Tests:** arena mechanics (volley, re-aim, cycle, scene, camera) in CI. Edge: `ring-boss-volley-probe.mjs` PASS. Regression 297/297; arena, fight, Orbiter flight, chase, flight panel, boss arc probes and UI layer PASS.
- **Not yet:** a real rig for arms and cannon; the attack video cut out in the world.

---

## Patch — Mini-Sim 0.16.11: the way to the bosses — jetpack crossing, slicers, comic words; Brawler ×2.2 (23 November 2026)

- **WORK LOCK:** [#156](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/156). Decision D-087, IDEA-027 step 1.
- **`ring-panels.js`:** `buildFlightPanel` (pit, drifting energy gates, ceiling spikes, rest island, bubbles; additive Balloon jet g 3 / +3 m/s; air speed ≤ 3 m/s), `flightCrossable` (search proof from four entry moments; rerolls; calm fallback), slicer chunks `blades` / `mill` and `slicerClosedAt`.
- **`ring-platformer.js`:** purple cells are flight panels (look, physics, pit fall back to the pad, gate and spike hits, bubbles); death in a flight panel respawns on a pad; slicers drawn, timed and hurting; comic sound words (ФЬЮУ! ВЖЖ! БУЛЬ! КРАК! ЧАК!); every form stands on the floor; the Brawler ×2.2 with a bigger fist (low ledge in reach, high not); Brawler clips preloaded, one video element per clip.
- **Tests:** `ring-flight-panel.test.mjs`, `ring-traps.test.mjs`, Brawler size test — in CI. Regression 295/295; boss arc, Orbiter flight, chase, fight probes and UI layer PASS.
- **Browser (Edge):** `ring-flight-panel-probe.mjs` PASS (walk into the pit → back on the pad −1 HP with ФЬЮУ!, a tapped flight with JET spent); `ring-boss-arena-probe.mjs` PASS (big Brawler, ledge, cannon, shielded drink, laugh window, comic clip from the first frame).
- **Not yet:** Tower-like shafts and links between rings, parkour and the arm rig, plate-and-gate traps, the pig mobs sheet.

---

## Patch — Mini-Sim 0.16.10: arena tiers behind the boss; the Brawler's cannon, laugh and drink (23 November 2026)

- **WORK LOCK:** [#155](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/155). Decision D-086, BUG-022.
- **`ring-platformer.js`:** arena ledges in two reachable tiers (1.4 / 2.8 m) set behind the boss (`LEDGE_Z`, `LEDGE_DEPTH`); form art upright (uv transform flip, once per texture); the cannon band drawn; the Brawler's videos as a comic panel in the HUD (cannon on the charge, the owner's `brawler-drink.mp4` on the shielded drink, `brawler-laugh.mp4` on the laugh); transformation video start grace 3 s; QA snapshot reports the comic, model up axis and clip.
- **`ring-boss-moves.js`:** the Brawler's cannon at the pilot's tier (charge 2.0 s, fire, recover), then it drinks under a shield (closed even from behind, mends 1 HP), then laughs — the open window.
- **Red before / after:** `ring-boss-arena-mechanics.test.mjs` (6, in CI); Edge `ring-boss-arena-probe.mjs` PASS; fight probe frames upright.
- **Not yet:** the cannon attack cut out and played in the world; rig motion; tier-aware moves for the other forms.

---

## Patch — Mini-Sim 0.16.9: form transformations play the owner's videos (23 November 2026)

- **WORK LOCK:** [#154](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/154). Decision D-085.
- **Assets:** `mini-sim/assets/ring-bosses/video/` — five transformation videos (Roller→Walker … Runner→Stalker) and the Brawler's cannon attack, taunt/drink and pose sheet (≈25.9 MB).
- **`ring-platformer.js`:** transitions into forms 2–6 play their video in place of the boss (muted VideoTexture, white keyed out in the shader), 5 s; models fade out early and in at the end; the particle transition stays for Pig→Roller and as the fallback. QA snapshot reports the playing video.
- **Red before:** `transform-roller-walker.mp4 is missing`, `phase 2 has no transformation video`. After 2/2 (in CI). Edge: `ring-boss-arc-probe.mjs` sees the right video mid-transition and none after (PASS). Regression 281/281.
- **Not yet:** the Brawler's own videos in its attack (comic inset), authored attacks.

---

## Patch — Mini-Sim 0.16.8: forms only on the last Pig, Pig shell leaves, forms lit (23 November 2026)

- **WORK LOCK:** [#153](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/153). Decision D-084.
- **`ring-platformer.js`:** `hasPhases` only on the last Pig (the first two are plain fights; their form GLBs are not loaded); `pigShell` (armour, horns, eyes, core, halo, pig) shrinks in the transition and stays hidden; the halo no longer returns over the forms; form art drives the emissive channel; the chase shows the Runner's own back cap from `phase-forms`. QA: `strike(index)`, snapshot `shellVisible`, `bosses`, `formArtLit`; QA transition picks the form-carrying Pig and refills HP.
- **Red before:** source test 3/3 failing; Edge probe: first Pig became the Roller, 13 shell meshes and the halo over the form, art lit 0. After: `ring-boss-arc-order.test.mjs` 3/3 (in CI), `ring-boss-arc-probe.mjs` PASS; fight, Orbiter flight and chase probes PASS. Regression 279/279, UI layer PASS.
- **Not yet:** transitions from the owner's videos (≈25 MB, decision pending), authored attack motion, hand tuning.

---

## Patch — Mini-Sim 0.16.7: the Runner is fought as a rear-view chase in Opal Jetjet (23 November 2026)

- **WORK LOCK:** [#152](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/152). Decision D-083.
- **`ring-runner-chase.js`** (new, rules only): boarding 1.2 s, three lanes, low walls (hop), two-lane gates (steer), lane-marked mines from the Runner; armoured except skid (failed turn) and overheat; laser range 12 m, boost −5 m.
- **`ring-platformer.js`:** phase 5 starts the chase instead of arena moves — a road group far below the arena in the same scene, Jetjet parked/flight and the Runner rear GLB, a perspective camera behind the Jetjet, HUD button help, single/co-op roles; beating the Runner ends the chase and the Stalker starts in the 2.5D arena. Enqueued in PHP and the standalone shell.
- **Red before:** `no chase: the Runner is fought like every other form in the 2.5D arena`, `the Runner phase never starts the chase`. After 6/6 (`scripts/ring-runner-chase.test.mjs`, in CI).
- **Browser:** `scripts/ring-runner-chase-probe.mjs` in Edge — boarding, camera behind, obstacles, lane steps, a skid window with 3 laser hits after a boost, then the Stalker back in the arena; page errors 0 (PASS). Regression 276/276; UI layer PASS.
- **Not yet:** boarding film/hatch, reverse driving, hand tuning, touch layout on a phone.

---

## Patch — Mini-Sim 0.16.6: a pit in the Orbiter arena (23 November 2026)

- **WORK LOCK:** [#151](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/151). Decision D-082.
- **`ring-boss-moves.js`:** Orbiter floor warns 2.5 s, then gives way across the arena; two 3 m ledges by the walls stay; `pitAt(x)`, `nearestLedge(x)`, outputs `floorWarn`, `pit`, `ledges`.
- **`ring-platformer.js`:** no floor landing over the open pit (raised platforms stay); a fall below −2.5 m returns the pilot to the nearest ledge, −1 HP, jet and breath at least 50; pit and ledges drawn; QA hook `placePilot(x, y)`, snapshot reports pit, ledges, homeX, pilot HP.
- **Red before:** `no pit in the Orbiter arena: the floor stays under the pilot`, `the Ring ignores the pit: pilots land on the floor`. After 7/7. Edge probe: pilot over the pit falls, comes back on the right ledge, HP 2 → 1 (PASS). Regression 270/270.
- **Not yet:** the pit reads weakly in the frame (dark strip at the very bottom, thin ledges).

---

## Patch — Mini-Sim 0.16.5: camera frames the Orbiter flight (22 November 2026)

- **WORK LOCK:** [#150](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/150). Decision D-081.
- **`ring-platformer.js`:** in the Orbiter flight the camera eases into a whole-arena frame standing on the floor (bottom −0.6 m, top 10.2 m in landscape) and eases back after the form; X still follows the pilot. QA snapshot reports the camera's bottom and top.
- **Red before (browser):** at height 8 m the view bottom was 5.3 m — floor tells and the Orbiter out of frame. After: bottom −0.55, top 10.25, probe PASS in Edge. Source check added to `ring-orbiter-flight.test.mjs` (5/5). Regression 268/268.
- **Correction:** D-080 said the camera did not follow height; it did, it only kept the pilot low in the frame.

---

## Patch — Mini-Sim 0.16.4: the Orbiter phase is flown (22 November 2026)

- **WORK LOCK:** [#149](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/149). Decision D-080.
- **`ring-boss-moves.js`:** the Orbiter is a flight form — two electric clots cross its arena (low and high, opposite ways), four air bubbles respawn after 6 s, ceiling 8 m; `collect(x, y)` takes a bubble.
- **`ring-platformer.js`:** pilots in the Orbiter arena get purple-cell low gravity: jump = jet impulse with flame (12 jet + 12 breath), forward drift 1.2 m/s in the air, bubbles +34 to both, both full at the start of the form; clots drawn as white sparks, bubbles as spheres; QA snapshot reports flight, bubbles and the pilot's height, jet, breath, flame.
- **Red before:** `the Orbiter is fought on foot: no flight`, `no electric clots in the Orbiter fight`, bubbles missing, `the Ring ignores the Orbiter flight: pilots stay on foot`. After 4/4 (`scripts/ring-orbiter-flight.test.mjs`, added to CI).
- **Browser:** `scripts/ring-orbiter-flight-probe.mjs` in Edge — Orbiter with flight on, 12 jump taps about one per second: height up to the 8 m ceiling, jet and breath 100 → 4 together, flame seen, sparks and 4 bubbles drawn, page errors 0 (PASS). Regression 267/267.
- **Not yet:** pit under the arena, the low-G route content, hand tuning (camera: 0.16.5).

---

## Patch — Mini-Sim 0.16.3: Ring boss forms fight with their own moves (22 November 2026)

- **WORK LOCK:** [#148](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/148). Decision D-079.
- **`ring-boss-moves.js`** (new): Roller, Walker, Orbiter, Brawler, Runner, Stalker — each its own cycle of tell → attack → open window; the Brawler takes shots in the back.
- **`ring-platformer.js`:** forms run the module after their transition; tells (yellow) and hazards (red / blue) drawn as zones; hazards hurt the pilot; armour checks the side of the shot. QA snapshot reports the form, move and zones. The standalone shell now loads `ring-platformer.js` (it was missing since the module split) and `ring-boss-moves.js`.
- **Red before:** `no boss moves: every form after the Pig fires the same shockwave`, `the Ring still fires one shockwave for every form`. After 6/6 (`scripts/ring-boss-moves.test.mjs`).
- **Browser:** `scripts/ring-boss-fight-probe.mjs` in Edge — six transitions give roller, walker, orbiter, brawler, runner, stalker in order, each with its own moves and zones, page errors 0 (PASS). Regression 263/263; UI layer PASS; Tower set 19/19; transitions QA PASS.
- **Not yet:** tuning by hand, authored attack clips (the GLBs have proxy clips), Runner chase view and Orbiter flight loop from the spec, Pig and arena counter unchanged.

---

## Patch — Mini-Sim 0.16.2: 0.16.1 reconciled with 0.15.36 (22 November 2026)

- **WORK LOCK:** [#147](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/147). Decision D-078.
- **Base:** 0.16.1 (`8b66872`, owner gameplay pass USER-CONFIRMED) kept as is: Ring in `ring-platformer.js`, boss models and phases, crew-core controls, jump tuning.
- **Returned to 0.15.36** (files that 0.16.1 carried as byte-exact old copies, no new work in them): First Planet sources (Opus, planet swap, residents and quests, race modes, race scenery), `tower.js` + `bcm-tower.php` (Tower 0.2.90: backdrops and clips per planet), `planet-landing.js`, `sage-map-core.js`. First Planet bundle rebuilt.
- **Journals restored:** `DECISIONS.md` (D-067…D-077 were gone), `JOURNAL_BUGS.md` (BUG-021 was gone), `WORK_COORDINATION.md`, `PROJECT_STATE.md` history; the 0.16.1 sections are kept.
- **Tests:** source checks follow the module split (Warp + `ring-platformer.js`, key/pad layout in `crew-core.js`, new jump numbers and anomaly labels).
- **Local:** regression 257/257 (was 199/257 on 0.16.1); Tower CI set 34/34; `npm run test:minisim` 65/65; standalone browser smoke PASS; transitions QA PASS.
- **Still red:** the strict Warp round-trip probe (`--warp-round-trip`, WORK LOCK #141) has never passed since it was added on 20.11 — first `route records a current location`, now the first map click times out. Not caused by this merge; left to #141.
- **Owner sheets saved:** `art/oni-asteroids/` (asteroids near ONI CSS), `art/retro-stickers/` (stickers, break-dance poses).

---

## Current checkpoint — Mini-Sim 0.16.1 (22 November 2026; refreshed after owner uploads)
## Owner gameplay acceptance — 22 November 2026

- **USER-CONFIRMED on Mini-Sim 0.16.1 / current `main`:** owner reports completing the gameplay test, flying the route out and back, and testing Ring. Objects and gameplay elements appeared in their expected positions; the tested behavior was as expected.
- This is a **manual owner gameplay check**, separate from automated source assertions and CI. The report does not claim a full physical-device/gamepad matrix, live WordPress QA, or deployment verification.
- No additional defect was reported in this test pass. Keep the historical test failures and remaining WORK LOCK records visible; this user confirmation does not retroactively turn old failed automated assertions into PASS.


- **Purpose:** 0.16.1 is the current-main development/test checkpoint. This is a version marker and installable package baseline, not a claim that every gameplay path is fully integrated or every scenario has been certified. The limited owner-confirmed manual pass is recorded immediately above.
- **Source baseline before version synchronization:** `7300695702d2c592413525ed847c7844f9351716`. It is the exact latest owner-uploaded `main` snapshot, including the Dr Arena 0.16.0 patch 1.2 payload. The upload chain is `7d681590` (0.16.0 patch 1), `9703cd33` (patch 1.1), and `73006957` (patch 1.2). The previous checkpoint at `475bebc5521c4e544dbd7f064e31e6a3eac9d6c1` is superseded as the source baseline by these three later commits.
- **Version synchronization:** PHP plugin header, `BCM_MINI_SIM_VERSION`, PHP embedded title and the three runtime title/fallback strings are synchronized to `0.16.1`. Version-only commits: `3226f6c8` (PHP) and `19a2b7c2` (runtime labels). No gameplay behavior was changed by these marker edits.
- **Tower:** current-main Tower remains `0.2.88`; this checkpoint does not change its version.
- **Preserve today's work:** the uploaded Dr Arena Ring changes, `ring-platformer.js`, boss phase models/forms, maze assets, Crew Core changes, Warp/background changes, tests and supporting journals remain on the same linear `main` history. Do not restore older Warp files, roll back to 0.15.36, remove assets, or split this snapshot into feature branches.
- **Historical backup/reference:** Mini-Sim `0.15.36` at `7bfd923a37e96b72220afbe52680ab7ace23f2e9`; package `bcm-mini-sim-0.15.36-test`, Actions run `44660860898`, artifact `14596260520`. This remains a read-only progress/reference point, not the runtime baseline.
- **Earlier 0.16.1 test results are not current results:** the package artifact `14755085442` and test figures recorded for SHA `475bebc` belong to the superseded pre-patch-1.2 snapshot. That checkpoint reported Mini-Sim regression 214/257 PASS (43 FAIL), Tower source-contract 32/34 PASS (2 FAIL), and standalone browser source assertions 58/65 PASS (7 FAIL). Do not copy those outcomes forward as verification of the present source snapshot.
- **Current validation rule:** use the repository's existing main-triggered regression, package, Tower/UI and standalone browser workflows against the final version-sync/project-state commit. Record exact run IDs and outcomes there. A package pass alone does not mean gameplay QA passed.
- **Not performed by this checkpoint:** live WordPress QA, physical gamepad/device QA, a complete manual playthrough, production deployment, or any new cleanup/refactor. The engineer receiving this baseline must perform the personal gameplay test and report it separately.
- **Coordination:** WORK LOCKs `#140–#142` remain visible/open. The owner-uploaded files are already part of this baseline; version synchronization above did not implement their gameplay requirements or close those locks.

---


## Patch — Mini-Sim 0.15.36: ledge grab in crew-core, traps in Ring panels (20 November 2026)

- **WORK LOCK:** [#139](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/139). Stage A.2, decision D-077.
- **`crew-core.js`:** `crewLedgeStep` (grab, hang, climb, drop) and the hanging pose — owner: movement and animation live in crew core.
- **`ring-panels.js`:** trap chunks — crumbling plates (K), timed spikes (T); crossing never relies on them.
- **`deep-space-warp.js`:** `path.ledgeAt` for the grab, plates crumble and return, timed spikes rise and sink.
- **Red before:** `crumbling plates in only 0/120 panels`, `no ledge grab: a block two high is a wall`, `crew-core has no ledge grab`. After 7/7.
- **Browser:** Ring probe in Edge, page errors 0; transitions QA PASS; regression 256/256. The grab itself was not played by hand in the browser.

---

## Patch — Mini-Sim 0.15.35: Ring panels as block grids with a crossing check, rebuilt every run (20 November 2026)

- **WORK LOCK:** [#138](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/138). Stage A.1 of `RING_REDESIGN.md`, decision D-076.
- **`ring-panels.js`:** 18 × 6 grid from three 6 × 4 chunks (10 kinds, mirrored), door-to-door solver, 12 rerolls then carve, rebuild per Ring entry (`run`).
- **`deep-space-warp.js`:** instanced blocks per kind, block tops as platforms, side walls (`path.solidAt`), caption from chunk names.
- **Red before:** the old panel had no grid (`Cannot read properties of undefined (reading 'join')`) and `a new Ring entry does not rebuild the panels`. After 4/4.
- **Browser:** Ring probe in Edge, panel «ПУСТОШЬ · ЯЩИКИ · УСТУПЫ», page errors 0; transitions QA PASS; regression 253/253.
- **Not yet:** destructible blocks, ledge grab, traps, mobs aware of blocks (stage B).

---

## Patch — Mini-Sim 0.15.34: Ring cells as comic panels from the seed (19 November 2026)

- **WORK LOCK:** [#137](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/137). IDEA-024 step 1, decision D-075.
- **`ring-panels.js`** (new): seeded panel per cell — steps, bridge over spikes, tower, gallery; every platform and both doors reachable with the Ring jump.
- **`deep-space-warp.js`:** cell 18 × 6 m; panel platforms (`cellPanel`) replaced on each cell; spikes hurt; comic frame and caption. PHP and standalone shell load the module.
- **Red before:** `no panel generator: every Ring cell is the same empty box`, `the cell is still 12 m wide`. After 3/3.
- **Browser:** Ring probe in Edge — panel «СТУПЕНИ» with tiers and spikes on ice and lava floors, page errors 0. Transitions QA PASS. Regression 252/252.
- **Not yet:** ladders, crates, enemies as characters, walk animation; the boss arena keeps the old layout.

---

## Patch — Mini-Sim 0.15.33: Ring cell look from the owner's tiles (19 November 2026)

- **WORK LOCK:** [#136](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/136). Decision D-074, step 1 of the Ring rework.
- **Owner 19.11:** «лабиринт в кольце на астероиде в стадии никакущей»; texture sheets in `art/tower-ring-kits/`; «Да, шаг 1».
- **Atlas:** `mini-sim/assets/textures/ring-tiles.webp` (4×4 tiles, 47 KB) cut from `textures-grid.webp` by `tools/ring-tiles/cut.mjs` (Edge canvas).
- **`deep-space-warp.js`:** Ring cell themes by the cell's floor — brick, ice, lava; `wallAsset` still picks the tile; walls, back wall, floor and ceiling from the tiles; doors with a grate doorway on the back wall and a hazard lintel; a cell light tinted by the theme. Fallback to the asteroid rock until the atlas loads.
- **Red before:** `no Ring tile atlas: the cells wear the asteroid's own rock`, then `the Ring cell never loads the tile atlas`. After 2/2 (`scripts/ring-cell-look.test.mjs`).
- **Browser:** `scripts/ring-maze-probe.mjs` in Edge (jump to an asteroid, ship onto the gold ring): cell maps `ring-tile-*`, door `ring-tile-12-door`, floor change at the hatch gives brick → lava lights; page errors 0. Transitions standalone QA PASS. Regression 249/249.
- **Not yet (step 2):** platforms, ladders, crates and spikes inside a cell; enemies are still orange boxes.

---

## Patch — Mini-Sim 0.15.32: race scenery per planet after the owner's sheets (19 November 2026)

- **WORK LOCK:** [#135](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/135). IDEA-021 (races), decision D-073.
- **Owner 19.11:** six concept sheets (`art/race-kits/`: coast, desert, ice, lava, jungle, sky; references outside the plugin) and «Да, делай так» on the mapping Twinsun desert / Fable lava / Opus ice / Galia coast.
- **`first-planet/src/game/race-scenery.ts`** (new): sky, fog, light, the plane round the island, island and tower, road / kerb / line colours, weighted props, finish arch per theme; `sceneryProps` places 30+ props off the road (seeded).
- **`world.ts`:** theme from `race.planet`; props from simple geometry (pyramids, obelisks, cacti; basalt spires, fire vents, dead trees; pines, crystals, snow; palms, rocks, buoys); finish arch with a checkered banner, fire bowls on lava; coast barrier models only on the coast. Track props live in one `race-decor-*` group — a road rebuild used to add a second set.
- **Twinsun race texts:** «Пески Twinsun»; Fable map «Тёмная гора ONI».
- **Red before:** `no race scenery: every planet races on the same desert coast`. After 3/3 (`scripts/first-planet-race-scenery.test.mjs`).
- **Local:** regression 247/247. Planet Lab race in Edge, three planets: desert / lava / ice scenery, page errors 0.
- **Not yet:** GLB props from the sheets (Dr Arena); the mini-map keeps its sand colours.

---

## Patch — Mini-Sim 0.15.31: a form of the race per planet, levels 1–3 (19 November 2026)

- **WORK LOCK:** [#134](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/134). IDEA-021 (races), decision D-072.
- **Owner 19.11:** «Виды гонок на планетах»; «разные игры вместо гонок»; multi-level races.
- **`first-planet/src/game/race-modes.ts`** (new): Twinsun laps (3 laps, items, drift — as before), Fable slalom (2 laps, gates of light, miss = +3…5 s), Opus elimination (narrow mountain road, last car out after each lap). Levels 1–3 per planet: a first place opens the next (faster rivals, tighter gates).
- **`sim.ts`:** `createRace(seed, planet, level)`; gates are judged one at a time in order; rivals steer for the gates and lift off before them; eliminated cars rank by when they went out; `reset()` keeps seed and planet (it used to rebuild the cars on the seed-0 road). Grid fix: a car before the line no longer ranks as a lap ahead.
- **UI:** start screen, HUD (penalty / eliminated / level) and finish («Выбыл», «Открыт уровень N») from the mode; the embed passes the planet; `world.ts` draws the gates.
- **Red before:** `no race modes: every planet runs the same three-lap Shoal Race`, `Fable has 0 slalom gates`, `the Opus road is as wide as the Twinsun coast`. After: 5/5 (`scripts/first-planet-race-modes.test.mjs`, on the real createRace).
- **Local:** regression 244/244. Planet Lab race in Edge (`tools/planet-lab/race.mjs`, all three planets): modes laps / slalom / elimination, gates on the Fable road, page errors 0.
- **Not yet:** the race scenery is the same desert coast on every planet; a live play-through of a full slalom and an elimination race by a person.

---

## Patch — Mini-Sim 0.15.30: Room 0 race — harder course, rival ships, race place (19 November 2026)

- **WORK LOCK:** [#133](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/133). IDEA-021 (races), decision D-071.
- **Owner 19.11:** «в room 0 нужно более трудную систему трассы и также другие корабли, которые стараются летать по кругу».
- **`mini-sim/assets/js/room0-race.js`** (no THREE): seeded course with 8–11 corners, height 10+ m, every third segment narrow (half-width 6.2–7.4 m), 5+ pylons each with a 4 m way through; three rivals with their own pace (slower in tight sections) dodging pylons and counting laps; race place.
- **`mini-sim.js`:** Room 0 builds from the module (old 5-corridor loop is the fallback), draws pylons and rival ships, pylons are solid (bounce and lose speed), status shows «МЕСТО N/4».
- **Red before:** `Room 0 has no race module: the old five-corridor loop, no rivals`. After 4/4. Browser probe `scripts/room0-race-probe.mjs` in Edge: 10 pylons, 3 rivals moving along the loop, «МЕСТО 4/4», page errors 0.
- **Local:** regression 239/239.
- **Not yet:** rival models are simple hulls (ship GLBs from the catalogue later); different race forms on each planet.

---

## Patch — Mini-Sim 0.15.29: own residents, roles and quest kinds per planet (19 November 2026)

- **WORK LOCK:** [#132](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/132). IDEA-021 step 1, decision D-070.
- **Content packs** (`first-planet/src/game/island/content.ts`): Twinsun keeps Sera Venn, Orr-1, Lamp and their lines; Fable — Vela Noktis (aurora keeper, light), Kobalt-7 (robot cartographer, relay), Mirra Olkh (spore gatherer, collect); Opus — Tesser Li (arcade master, fetch: the cartridge board, the planet's rare artifact), Non-Ai (observatory, collect), Al Varn (mountain postman, relay).
- **Quest kinds:** collect, fetch, light and the new relay (carry an item to another resident and come back). Each planet mixes them differently. The square chest follows the square resident's quest (Twinsun: two braziers, as before); the archive follows the archive resident's.
- **Progress per planet:** save key gets `-<planet>`; Twinsun keeps the old key.
- **Red before:** `First Planet has no planet content: every planet has Sera, Orr and Lamp`. After: 4/4 (`scripts/planet-content.test.mjs`, relay played by keys on Opus).
- **Local:** regression 235/235; Planet Lab Opus/Fable page errors 0.
- **Not yet:** resident models are the same on every planet (Dr Arena); props and race per planet — next steps of IDEA-021.

---

## Release — Mini-Sim 0.15.28 / Tower 0.2.90: package for the site with the three Tower backdrops (19 November 2026)

- Fable start at ONI CSS (D-069), Twinsun north, Opus west; landing films by planet, Opus departure film; Tower backdrop per planet (Fable dark mountain, Opus snowy mountain, Twinsun desert). Version bump only on top of `6c9d0f8`.
- **Local:** regression 231/231.

---

## Patch — Mini-Sim 0.15.27 / Tower 0.2.89: a Tower backdrop per planet (19 November 2026)

- **Owner 19.11:** `76ba2f5b…` (`landing-fable.mp4`) is the descent into the Tower level of Fable, a dark mountain. «Задний фон у всех трёх башен в разных планетах свой … background в Tower — основа ощущения планеты». Three Towers: Fable — dark mountain, Opus — snowy mountain, Twinsun — the desert tower.
- **Tower:** `towerBackgrounds` — `tower-bg-fable`, `tower-bg-opus`, `tower-bg-twinsun` (`.webp/.jpg/.png` in the plugin assets); set on entering and on the ascent; a planet without one keeps `perference bg.png`. **Twinsun picture in** (owner 19.11, SYNTX, 888×500 JPEG, 83 KB): `mini-sim/tower/assets/tower-bg-twinsun.jpg` — desert at sunset; given for «сектор Fable», which holds Twinsun since D-069. Fable and Opus (owner: «ориентируйся по видео»): the last frame of each landing film — `tower-bg-fable.jpg` (dark mountain, 41 KB), `tower-bg-opus.jpg` (snowy mountain, 42 KB), made by `tools/tower-bg-from-clip.mjs`, so the film ends on the Tower backdrop. Browser check `scripts/tower-background-probe.mjs`: Twinsun shows it, Fable and Opus fall back to the menu art.
- **Local:** regression 231/231, transitions in Edge 24/24.
- **Not verified:** CI for this SHA, live site.

---

## Patch — Mini-Sim 0.15.26: Opus departure film (19 November 2026)

- **Owner 19.11:** `4706288d…` is the departure from Opus, `07ff607e…` the descent onto Opus as a snowy mountain (already `landing-opus.mp4`).
- **Tower:** `planetAscents` — a planet's own departure film plays forward on the way up (Opus: `departure-opus.mp4`, label «ОТЛЁТ · OPUS»); a planet without one reverses its landing clip as before. Stall guard: duration + 3 s.
- **0.15.25 CI:** the standalone transitions check expected `onicss.mp4` on the ascent from the start; the start is Fable now (D-069), so it plays `landing-fable.mp4`. Check updated; Edge 24/24.
- **Local:** regression 230/230, transitions in Edge 24/24.
- **Not verified:** the Opus ascent in a browser (the transition check rises from the start planet), live site. Approach clip `d745673d…` not placed yet.

---

## Patch — Mini-Sim 0.15.25: Fable at the start, Twinsun north; clips by planet (19 November 2026)

- **Decision D-069.** ONI CSS lands on Fable; the desert island (Twinsun) lies at `[-40, 31]`. The hundred-year swap is told on the planet cards and in the Warp map hints.
- **Clips (owner 19.11, matched by first frame):** hurricane Earth → Fable (`landing-fable.mp4`), snowy mountain → Opus (`landing-opus.mp4`); Pearce keeps `onicss.mp4`. Planet pictures in `mini-sim/assets/planets/`.
- **Recorded from the owner's list:** IDEA-021 (each sector its own characters, quests, races, room0 circuit, rare cartridge artifact), IDEA-022 (B-boy mini-game), IDEA-023 (Opus is Claude Code's), BUG-020 (Brave animation glitch, needs details).
- **Local:** regression 227/227.
- **Not verified yet:** CI for this SHA; live site; the new approach and Tower-exit clips (`d745673d…`, `4706288d…`) are not in the repository yet.

---

## Release — Mini-Sim 0.15.23 on the live site (18 November 2026)

- **Package:** `bcm-mini-sim-0.15.23-test` from `5b4907e`, all CI green (regression 226/226, Tower, standalone Chromium, package). Replaces the Arena-built `0.15.22` on the site.
- **USER-CONFIRMED:** owner installed it and confirmed Warp passes there and back (BUG-018).
- **In it:** BUG-018 (ship on the second jump), Fable straight north of ONI CSS and planet Opus west (D-068), Fable's location-walk branch, Galia Desk 0.8.20 PHP (app bundle still old: `wordpress/galia-desk` write is closed), race track look from the mesh piece, Warp round-trip browser probe.
- **Not verified on the site yet:** Opus and Fable landings through Tower, the race look.

---

## Patch — Mini-Sim 0.15.10: the warp menu names Fable (17 November 2026)

- **There is no 0.15 line before 0.15.0 and no 0.14.9.** The line is `0.14.8` (crew facing) then `0.15.0` … `0.15.9`, this note is `0.15.10`.
- **Where Fable is:** SAGE X **-39**, Y **31**. ONI CSS is X **-40**, Y **30**. One step north-east. Purple diamond on the warp map. Not a Galia system, so the Desk cartograph does not list it (D-061).
- **This patch:** after a local warp the menu no longer says the SAGE coordinates are disconnected. The open and the return footnotes name Fable. Arrival on the local map keeps the Galia sector title.
- **Commit:** `20daa59`. **Test:** `scripts/location-walk.test.mjs` 3/3. Live site not confirmed.
- **Not this patch:** splitting `deep-space-warp.js` into a bridge file and an asteroid file; sewing the warp canvas into Galia Desk; merging to `main`.

### Location line, 0.14.8 through 0.15.9 (what each step did)

| Version | What it did for walking the places |
|---|---|
| 0.14.8 | Crew faces the way she walks. Not a new place. |
| 0.15.0 | Crew legs, Crew Lab, the 0.15 rules line. Tower 0.2.83. |
| 0.15.1 | Mierese faces her move. Asteroid field in open space. |
| 0.15.2 | One SAGE map: Warp draws the Galia stars and the ONI CSS card. |
| 0.15.3 | Sector picks the planet: MUD CSS → Pearce, Ustur CSS → Ioki, else the desert. |
| 0.15.4 | Fable added at [-39, 31], own sky, still the desert ground. |
| 0.15.5 | Fable gets its own relief. |
| 0.15.6 | Tower → planet clip: Fable and Pearce have their own film, others keep onicss.mp4. |
| 0.15.7 | Crew names and portraits from Galaxy by mint. |
| 0.15.8 | Live-site list: idle pose, fleet ship, nose axis, tape layer, mouse without pointer lock. |
| 0.15.9 | Asteroid field follows the asteroid place. Crew column scrolls. |

---

## Patch — Galia Desk 0.8.20: fleet count is a pick, wallet count stays put (16 November 2026)

- **Commit:** `3d1942a` on `fix/galia-desk-0.8.20`. Base: original `main` `a4bf459`, plugin header was `0.8.18`. Not the outside zip and not the timeout-only branch.
- **BUG-008:** ship row shows `на кошельке: N` (fixed) and `во флот: M` (the field). A pick above the wallet count is cut back. Summary: `во флоте: X из Y на кошельке`.
- **Also kept:** 50-second abort on the desk price and wallet fetches, so this file does not drop what live `0.8.19` already had.
- **Test:** `scripts/galia-desk-fleet.qa.mjs` — repository `0.8.18` FAIL 7/7; this file PASS 7/7. PHP `php -l` was not run here (no PHP binary).
- **Not done:** not merged to `main`. Live site not confirmed. Vite `app/` bundle was not rebuilt.

---

## Patch — Mini-Sim 0.15.9: asteroid field follows the place; crew menu scrolls (16 November 2026)

- **BUG-004 hole:** arrival writes `simPlace.id === "asteroid"` and does not set `exteriorFlight`. The field gate now accepts either. Density unchanged. Red before the edit: `asteroid arrival leaves exteriorFlight off, so the field stays off (BUG-004)`.
- **BUG-010:** crew column on a short screen clipped the card list. The stack above the cards scrolls and is capped at 46% of the column. Source is `src/components/crew/bay.tsx`, not the WordPress desk. Live Galia still needs a Render deploy.
- **Not done:** BUG-008, protected `wordpress/galia-desk`.
- **Not verified:** this SHA's CI, a Warp arrival in a browser, the crew page on a phone.

---

## Журналы с 15 ноября 2026

Рабочая память разделена. Идеи: `JOURNAL_IDEAS.md`. Баги: `JOURNAL_BUGS.md`. Комплектация мини-игр: `JOURNAL_KIT.md`.
Проверка больше не замораживает правки. Версия игры от этого не менялась: Mini-Sim `0.14.6`, Tower `0.2.80`, HEAD на момент записи журналов `129ad52`.

## Warp tube — owner uploads of 16 November 2026 (reconciled, not written by Claude Code)

- **Commits:** `c3006dd`, `97b77e5` («Add files via upload», `mini-sim/assets/js/deep-space-warp.js`, +834 lines, Dr Arena's Warp work). IDEA-012 → `IMPLEMENTED`, live status unknown.
- **Brings:** rocks on the tube wall with baked sprites inside the file, anomaly «half-enemies», gamepad vibration on a near pass, PHATOLI shimmer switch, effect level by ship class, dissolve cell cap by device tier.
- **CI on `97b77e5`:** all five workflows success. No version bump came with the uploads: the file is still served as `?ver=0.15.9`.

---

## Galia — crew menu scroll; Desk 0.8.20 test package (16 November 2026)

- **WORK LOCK:** [#129](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/129). BUG-010 was fixed by another writer in `a47ee04` (Mini-Sim `0.15.9`); Claude Code's browser check passes on it at four window sizes, so the second layout change was dropped. BUG-008 only in the Desk test package `galia-desk-0.8.20-test.zip` (built outside `wordpress/galia-desk`; the folder in `main` is still `0.8.18`).
- **Browser checks (Edge, not in CI):** `scripts/galia-crew-scroll.qa.mjs` PASS at four window sizes; `scripts/galia-desk-fleet.qa.mjs` 7/7 red on the repository Desk, PASS on the package copy.
- **CI on `ceafccd` (Mini-Sim 0.15.8):** regression [43868839505](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43868839505) 209/209, Tower 43868839574, standalone Chromium 43868839456, UI Layer 43868839326 — success. Package `bcm-mini-sim-0.15.8-test`: [artifact](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43868839388/artifacts/14227690038).
- **Other writers on 16.11, kept as they are:** `a47ee04` (0.15.9: BUG-004 asteroid field at the Warp arrival, BUG-010), owner uploads `c3006dd` and `97b77e5` of `deep-space-warp.js`. A local copy of that file, byte-identical to `c3006dd`, was set aside in `git stash` before the rebase. `.claude/launch.json` is untracked and not Claude Code's.
- **Not verified:** Desk 0.8.20 inside WordPress; live site.

---

## Patch — Mini-Sim 0.15.8: owner's live-site bug list (16 November 2026)

- **WORK LOCK:** [#128](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/128), `613385c`. Decision D-065. Tower `0.2.88`.
- **Fixed (TESTED-CODE):** BUG-009 idle pose and eased stop (regression of 0.15.3), BUG-011 fleet ship becomes the flight ship, BUG-012 Tower takes one crew member and the Galia launch crew, BUG-013 props seated by their footprint, BUG-014 tape full-screen layer above the First Planet host, BUG-015 nose axis in the ship catalogue (Ambwe, Meditech, Feist, Arma drove sideways), BUG-016 riding hints once and rest form while hovering, BUG-017 mouse steering without pointer lock.
- **Open:** BUG-008 (Desk ship count, protected zone), BUG-010 (Galia crew menu scroll on a small screen).
- **Local:** regression 209/209 (13/13 syntax), `tsc` only the two old errors; standalone transitions QA in Edge PASS 24/24; Planet Lab first + Fable page errors 0; ship sheet shot before and after.
- **Not verified yet:** CI for this SHA; in a browser with Galia: fleet ship, Tower NFT crew, tape full screen, mouse without pointer lock; live site.
- **Work map by sector:** `WORK_COORDINATION.md`, section «Направления работ».

---

## Patch — Mini-Sim 0.15.7: real Crew names and portraits (16 November 2026)

- **WORK LOCK:** [#127](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/127), `d1452a7`. Decision D-064. BUG-007 fixed; BUG-008 (Desk ship count, protected zone), BUG-009 (animation after stop, not reproduced), BUG-010 (crew menu scroll) recorded; IDEA-016, IDEA-017 recorded.
- **Owner report on the live site** (Mini-Sim `0.15.5`, Desk `0.8.19`, Tower `0.2.86`): crew numbered and with chain pictures, ship count, animation after stop, modes, camera, crew menu scroll, Galia map.
- **Red before:** `crew is named by its chain number: "CREW #1010495"`. After 3/3. Owner's wallet read-only: 104 crew, 0 numbered, 104 Galaxy portraits.
- **Local:** regression 190/190 (13/13 syntax).
- **Not verified yet:** CI for this SHA (first run of `php -l`); Desk names wait for a Render deploy (#120).

---

## Patch — Mini-Sim 0.15.6: planet landing clips on the Tower → planet bridge (16 November 2026)

- **WORK LOCK:** [#126](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/126), `e38fba3`. Decision D-063. Tower `0.2.87`.
- **Clips:** owner's Seedance clips (7 s, 854×480) `mini-sim/assets/landing-fable.mp4`, `landing-pearce.mp4`. Fable and Pearce play their own clip on landing and reversed on ascent; other planets keep `onicss.mp4`.
- **Red before:** `Tower has one bridge clip for every planet: only 'planetTransition' => onicss.mp4`; `every planet lands with onicss.mp4`; `the landing still plays onicss.mp4 on every planet`. After 4/4 (`scripts/tower-planet-landing-clip.test.mjs`, in CI). Tower and First Planet agree on the planet for all 10 201 sectors.
- **Local:** regression 187/187; standalone transitions QA in Edge PASS 24/24 (default ONI path); both clips decode and play 7.04 s in Edge.
- **Galia Desk 0.8.19 (#125):** test package `galia-desk-0.8.19-test.zip` given to the owner, built outside `wordpress/galia-desk` (the folder stays 0.8.18 in `main`).
- **Not verified yet:** CI for this SHA; the landing handoff with the Fable/Pearce clip in a browser (the transitions QA advances the planet step by event, not by Tower descent); live site.

---

## Patch — Mini-Sim 0.15.5: planet Fable has its own relief (16 November 2026)

- **WORK LOCK:** [#124](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/124), `d598f72`. Decision D-062. IDEA-002 step 3. Tower `0.2.86` is a version bump only.
- **Relief:** `terrain.ts` `setRelief("fable")` — three capes and three coves, the Crescent ridge east of the town, two-tier Table hill, six sea stacks, long mossy swells, Fable place names. Town, pad, pond, bridge and quest spots stand where they stood.
- **Red before:** `Fable ground equals the desert island: only 0.0% of the wild nodes differ by more than 0.5 m`; `Fable still names desert places: Кристальная гряда, Дюны, Дюнный посад, …, Оазис, …`. After: 3/3 (`scripts/first-planet-fable-relief.test.mjs`, added to the CI regression).
- **Local:** regression 183/183, `tsc` only the two old errors. Planet Lab in Edge on Fable: page errors 0, frames from the ground and from the air.
- **Not verified yet:** CI for this SHA, live site, Warp ONI → Fable → Tower → planet in one run, frame rate on a weak device, a full walk of the Fable quests by a player. Desert cacti and rocks still stand on Fable (props are Dr Arena's work). Some of the parked ships may stand elsewhere or be skipped on Fable: their pads are chosen by slope.

---

## Patch — Mini-Sim 0.15.4: planet Fable next to ONI CSS (16 November 2026)

- **WORK LOCK:** [#123](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/123), `f397eb5`. Decision D-061. Tower `0.2.85` is a version bump only.
- **Planet Fable:** sector `[-39, 31]`, Mini-Sim landmark (`BCMSageMapCore.landmarks`, `planetForSector`), named and drawn on the Warp map, own design through `PlanetLook.extras`. Red before: `the map has no Fable planet sector`, `no Fable profile`; after 6/6.
- **SYNTX chats (all five) re-read 16.11:** no planet code there; owner wishes not yet in the journals recorded as IDEA-015. Already covered: Ring 2.5D (IDEA-004), landing cutscene (IDEA-005), desert/crabs (IDEA-006), sector graph (IDEA-011).
- **Second look at 0.15.3:** mote/ring sprites and texture disposal fixed while building Fable; the three older planets render as before. Known and not done: Profound skirt and mantle do not follow the leg; one planet per page load; `scene.ts:946` old `prefer-const` lint error left as is.
- **Local:** regression 180/180 (12/12 syntax), Tower suites 34/34, `tsc` no new errors. Planet Lab in Edge: 4 planets, page errors 0.
- **CI on `4bec042`:** regression [43775907011](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43775907011), Tower 43775906978, standalone Chromium 43775906999, UI Layer 43775906959 — success. Package `bcm-mini-sim-0.15.4-test`: [artifact](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43775906933/artifacts/14185958445).
- **Not verified yet:** live site, Warp ONI → Fable → Tower → planet in one run, frame rate with the Fable effects on a weak device.

---

## Patch — Mini-Sim 0.15.3: First Planet crew steps; planet by SAGE sector (16 November 2026)

- **WORK LOCK:** [#122](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/122), `cd75cfe`. Decision D-060. Tower `0.2.84` is a version bump only (First Planet bundle cache key).
- **BUG-005 fixed:** island rig poses hip/knee/shoulder pivots built from the race GLB parts with `BCMCrewRig.walkPose`, phase by dt. Red before: `feet did not stride: front-back spread 0.000 -> 0.000`; after 16/16.
- **BUG-006 fixed:** `hoverFloor` was not imported in `scene.ts`; the CI-built bundle threw on boarding the bike. Red: `called but not imported: hoverFloor`.
- **IDEA-002 step 1:** MUD CSS sector → Pearce (Earth-like), Ustur CSS → Ioki (red), elsewhere the desert. Red before: `First Planet has no planet profiles` / `scene ignores the planet`; after 4/4.
- **Local:** regression 178/178 (12/12 syntax), Tower suites 34/34, `tsc` no new errors (3 old), eslint 0 errors. Planet Lab in Edge (`tools/planet-lab/shoot.mjs`): 3 planets × Human/Profound/Mierese, page errors 0.
- **CI PASS on `b1b8d24`:** regression 178/178 [#43772520482](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43772520482), Tower [#43772520423](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43772520423), standalone Chromium [#43772520449](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43772520449), UI Layer [#43772520440](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43772520440), package → [bcm-mini-sim-0.15.3-test](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43772520426/artifacts/14185390490). `minisim-browser-qa.yml` red = disabled on purpose.
- **Not verified yet:** live site, Warp → MUD/Ustur → Tower → planet in one run, the owner by eye.
- **Galia (Render, #120):** still serves `index-CTMgKAKL.js` after `b1b8d24` too — Render is not redeploying on push; owner check of the Render dashboard needed.

---

## Patch — Mini-Sim 0.15.2: Galia SAGE map inside Mini-Sim; Galia Fleet cold start (15 November 2026)

- **WORK LOCKs:** [#120](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/120) Galia Fleet (`e7cd90c`), [#121](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/121) SAGE map (`a6f1ee3`). Decision D-059.
- **Galia (Render):** Fleet was empty after a cold start — Galaxy catalogue 10 s timeout and a market without ships cached for 2 min. Fixed: 30 s + last good catalogue, no caching of a ship-less market, loading/retry on the page. **Render still served the old bundle 30+ min after the push** (old text present, new absent) — Render deploy needs the owner's check.
- **Mini-Sim:** Warp map from Galia data; red before: `local navigation still labelled as test-only`; after 3/3. Local Edge frames: ONI · Akenat card with the station on orbit, stars named and coloured.
- **Local:** regression 157/157 (12/12 syntax), Tower suites 39/39.
- **CI PASS on `683826e`:** regression [#43761527398](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43761527398), Tower [#43761527361](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43761527361), standalone Chromium [#43761527318](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43761527318), UI Layer, package → [bcm-mini-sim-0.15.2-test](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43761527379/artifacts/14180696666).
- **Render after this push:** still `index-CTMgKAKL.js`, Fleet fix absent — the Render service is not redeploying; #120 stays open.
- **Not verified:** live site, MUD/Ustur cards by eye.

---

## Patch — Mini-Sim 0.15.1: Mierese facing, asteroid field in open space (15 November 2026)

- **WORK LOCK:** [#119](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/119). Fix `acd8b21`. Decision D-058. BUG-001 fixed again, BUG-004 `FIXED`; new BUG-005 (First Planet 3D character), IDEA-013 (desert entry video).
- **Owner flight on live 0.15.0 before this patch:** live page verified as 0.15.0 / Tower 0.2.83; deep-space field with red impact glow USER-CONFIRMED; rocks missing at the asteroid landing; Mierese mirrored wrong; walk of the First Planet 3D body weak.
- **Local:** regression 154/154, Tower suites 34/34. Edge transitions QA: 1 PASS, 2 timeouts in different steps (baseline 9b08f8f: 1 PASS) — CI decides.
- **CI PASS on `fd5bad9`:** regression [#43753138179](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43753138179), Tower [#43753138208](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43753138208), standalone Chromium [#43753138267](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43753138267), UI Layer, package → [bcm-mini-sim-0.15.1-test](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43753138113/artifacts/14177180954).
- **Not verified:** Warp arrival flown in a browser, live site, Mierese by eye.

---

## Release — Mini-Sim 0.15.0 / Tower 0.2.83: crew legs, Crew Lab, Dr Fable automation, 0.15 rules line (15 November 2026)

- **WORK LOCK:** [#118](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/118). Legs `56be8d6`; automation `6512a33`; release `b91f368`. Decision D-057. BUG-003 `FIXED`.
- Tower Crew walk on two shins assembled by `crew-core.js` from the NFT cut-out; robes stay whole.
- `tools/crew-lab`: six races, real NFT art, crew-core cutout + rig; phase screenshots and leg-gap measurements (local Edge).
- Dr Fable automation: `/fable` (SYNTX bridge), `/packet` (work packet → WORK LOCK), `/accept` + `.claude/tools/evidence.mjs`.
- **Local:** regression 151/151 (10/10 syntax), Tower suites 41/41; standalone transitions QA in Edge PASS (crew not seated there — markers).
- **CI PASS on `91cc5ef`:** Mini-Sim regression 151/151 [#43746283034](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43746283034); Tower top-cap 34/34 [#43746283065](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43746283065); standalone Chromium [#43746283058](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43746283058); UI Layer [#43746283072](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43746283072); **test package `bcm-mini-sim-0.15.0-test`** [artifact #14174057237](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43746282982/artifacts/14174057237) (401.2 MB).
- **Not verified:** Tower with a selected NFT Crew in a browser, live site, manual play.

---

## Completed implementation — Mini-Sim 0.14.8 / Tower 0.2.82: Crew facing and walking rig in crew-core (15 November 2026)

- **WORK LOCK:** [#117](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/117). Implementation `99b224a`. Decision D-056. BUG-001 `FIXED`.
- New `mini-sim/assets/js/crew-rig.js` (from the SYNTX Dr Fable chat, unchanged, `selfTest() == []`), loaded before `crew-core.js` in both plugins and the standalone shell.
- `crew-core.js`: `crewFace` (one mirror rule), `crewSpritePose` (phase from dt through the rig). Tower, Ring, Hull Dive pass direction and dt only.
- **Red on `3177740`:** `Mierese moving right is mirrored unlike Tower: 1 !== -1`; `pose moved with performance.now() while dt = 0`.
- **Local (Windows):** `regression.mjs` syntax 10/10, tests 148/148 (CI list now includes the crew-core tests); Tower suites 34/34.
- **CI PASS on `a576241`:** Mini-Sim regression (incl. crew-core tests) [#43740565330](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43740565330); Tower top-cap [#43740565283](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43740565283); standalone Chromium [#43740565240](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43740565240); UI Layer [#43740565313](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43740565313); package [#43740565325](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43740565325).
- **Not verified:** the walk by eye in Tower/Ring/Hull, Mierese facing in Ring/Hull on the live site.

---

## Completed implementation — Mini-Sim 0.14.7 / Tower 0.2.81: Crew cutout in crew-core (15 November 2026)

- **WORK LOCK:** [#116](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/116). Red test `952f861`, implementation `4e8d931`. Decision D-055.
- `crew-core.js` now cuts the NFT background and assembles the Crew; Tower, Ring and Hull Dive only display. Hull Dive's duplicate pipeline removed; Ring no longer needs Tower (BUG-002 `FIXED`).
- **Local (Windows, LF clone):** `.claude/tools/regression.mjs` (= CI Mini-Sim regression) syntax 8/8, tests 139/139; Tower top-cap + local-qa + hull + standalone-qa source suites 43/43; `scripts/crew-core-cutout.test.mjs` 4/4 (red before: cutout found in `tower.js`, `hull-dive.js`; Ring depends on `BCMTowerAPI`).
- **CI PASS on `14d400c`:** Mini-Sim regression 139/139 [#43738978945](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43738978945); Tower top-cap 34/34 [#43738978967](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43738978967); standalone Chromium PASS [#43738978969](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43738978969); UI Layer [#43738979006](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43738979006); package [#43738978947](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43738978947).
- **Not verified:** the Chromium fixture does not cut a real NFT card through ISNet; live WordPress and manual play of Tower/Ring/Hull Dive with a selected Crew not checked.

---

## Completed implementation — Mini-Sim 0.14.6: volumetric Warp asteroid field (15 November 2026)

- **WORK LOCK:** [#114](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/114). Runtime implementation [bfe7486](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/bfe7486b9b2e02beaf700a70c3956e2e37922b86); offset-rock collision broadphase fix [7d2bdfc](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/7d2bdfc79c2ad86c39a2f3fbe57b535faa432e15); Node VM test correction [e5efcad](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/e5efcadbee379a4867a7a7dce7224a278aa832e9); standalone First Planet path fix [3f9eecb](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/3f9eecb0660705cbbba028997e14e673a3e0849e); actual GLB scene smoke [7431360](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/74313602ee3368857f800187c5276541d60fbe3a); standalone loader dependencies [73c540c](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/73c540c161b9ec1a1c8a7dd0d9c251f9eb9bff9c). Mini-Sim is 0.14.6; Tower remains 0.2.80.
- Preserved the 0.14.5 CPU odometer, signed projection, absolute sector derivation, positive-modulo eight-slot ring and 5% hysteresis. Changed only sector contents/window distribution: three trailing + current + four ahead, still exactly eight slots.
- Volumetric layout: each sector has eight cluster instances. Each transform is derived from run seed + absolute sector number, not physical slot; it stores `axial ∈ [0,180)`, full-circle `angle`, radial `radius`, deterministic rotation and scale. Sampling is stratified around the circumference and split into inner/middle/outer radial bands, without reserving an empty central corridor.
- Tube radius derives from the loaded ship bounding sphere with a bounded fallback. The radial maximum includes the largest component-sphere extent of the selected cluster, maximum scale, ship clearance and wall margin. Cluster/component bounds are calculated on CPU.
- Component collision proxies are reconstructed from disconnected triangle islands in each existing GLB. Collision performs axial/depth broadphase first, then swept-sphere distance in the full tube frame. The broadphase includes the entire scaled parent-cluster extent, so an offset rock protruding across a sector boundary is not missed. All intersected resident sectors are checked; teleports larger than two sectors are not treated as continuous physical sweeps.
- The scene root stays at ONICSS; its tube frame uses the route axis and a cross-section basis aligned with ship roll. CPU computes transforms, matrices and collision math; existing local Three.js r128 renders one InstancedMesh per sector (maximum eight field draw calls). Slot eviction disposes only slot-owned instance buffers; shared GLB geometry/materials/textures survive until manager shutdown.
- Existing Canvas Warp `tubeTravel`, `obstacleDepth`, course layers, angular obstacle collision, controls, OST, `three.min.js`, Tower gameplay, Galia Desk, security, SAGE and wallet operations were not changed.
- **Mini-Sim regression PASS:** 139/139 tests and all JS syntax checks, [run #43709102788](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43709102788), exact tested HEAD `73c540c`. **Tower source-contract PASS:** 34/34, [#43709102843](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43709102843).
- **Standalone Chromium PASS:** [run #43709102790](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43709102790), exact tested HEAD `73c540c`. Source assertions 62/62, real browser smoke PASS, Tower → First Planet → same-seed ascent → return-state cycle PASS. The added GLB scene probe loaded all six cluster templates, reached READY in all eight sector slots, confirmed exactly eight InstancedMesh nodes, eight instances per slot, and at least seven per-component collision spheres per sector. Plugin HTTP errors, serious console/page errors and failed requests were all empty.
- **PACKAGE PASS:** First Planet WordPress bundle build and single-level package validation passed [run #43708447649](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43708447649). Artifact `bcm-mini-sim-0.14.6-test`: [artifact #14159361983](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43708447649/artifacts/14159361983), 401,159,088 bytes, SHA-256 `ce7c8f53760f852ff798a834adcf5dd3ae718511b90a3019be91040c53057b3d`.
- The browser test validates actual GLB loading and 3D scene construction, but it does not make the player ship deliberately hit each rock or judge collision feel during a manual flight. No live WordPress deployment, production URL QA, phone/controller playtest or manual collision-tuning confirmation is claimed. Odometer persistence across full page reload remains out of scope.

---


---

## Completed implementation — Mini-Sim 0.14.5: CPU Warp sector streaming (15 November 2026)

- **WORK LOCK:** [#113](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/113). Runtime code commit [a179209](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/a179209e89466e73d6170f62b1a0f2f089fd2530); version-assertion correction [5531d75](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/5531d75995ac618038ba87bf1ac26607036cb22e). Mini-Sim PHP/runtime version: 0.14.5; Tower remains 0.2.80.
- Added `warp-sector-core.js`: browser- and THREE-independent CPU odometer, signed along-track projection, sector derivation `floor(traveled / 180)`, positive modulo, deterministic per-sector seeds, fixed eight-slot planner and 5% cache-window hysteresis. `origin` is sampled from the existing ONICSS station mesh; `drift` comes from actual ship position minus origin. `traveled` is signed projection of drift onto the route axis, so backing up decreases it and crossing the origin can produce negative sector numbers.
- Added `warp-sector-scene.js`: one resident ring of eight sector slots, two behind and five ahead. CPU builds positions and instance matrices; the existing local Three.js r128 renderer only draws them. Each sector uses one `InstancedMesh` containing three instances of one deterministic asteroid-cluster template selected from the six existing `asteroid_clusters_v2` GLBs.
- Shared template geometry, materials and embedded textures survive slot eviction. Only slot-owned `InstancedMesh` instance buffers are disposed on eviction. Manager shutdown releases its shared templates before the host's generic scene cleanup.
- Integrated the sector manager in the Mini-Sim host render loop after physics/collision resolution, sampling the actual `ship.position`. It is active for exterior Deep Space flight; it does not use or change Canvas Warp `tubeTravel`, obstacle timing, controls, entry/exit, audio, Tower, SAGE or wallet code. The existing renderer and r128 engine are reused.
- **TESTED-CODE:** Mini-Sim regression 132/132 PASS [run #43706031614](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43706031614) on code/test tree `5531d759`; Tower source-contract 34/34 PASS [#43706031601](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43706031601); UI Layer Regression PASS [#43705950468](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43705950468); Tower top-cap regression PASS [#43705950444](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43705950444). Both new JS files passed `node --check`.
- **PACKAGE PASS:** WordPress package/First Planet bundle build and single-layer package validation passed [run #43705950523](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43705950523). Artifact: `bcm-mini-sim-0.14.5-test`, [artifact #14158154252](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43705950523/artifacts/14158154252), 401,145,886 bytes, SHA-256 `c55a128d96e2e2c9d40b042e6350517a58ad05e2c1fb6c9616796fe64aef7619`.
- **BROWSER QA LIMITATION:** standalone Chromium run [#43705950483](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43705950483) ended FAIL because the fixture logged one HTTP 500 console resource error. Its 24 functional assertions all reported `ok: true`; serious JavaScript/page errors and Playwright failed requests were empty. This existing smoke did not activate the new 3D sector manager during a real Deep Space flight, so sector-scene runtime visual behavior remains unverified.
- No odometer snapshot persistence across a full page reload was added; on reload the manager is reconstructed from the ship position supplied by the engine and the ONICSS station origin. No live WordPress deployment, production URL QA or manual/device flight confirmation is claimed. The existing full `npm run test:minisim` audio-related known failure was not modified or hidden.

---

## Completed implementation — Mini-Sim 0.14.0 first gameplay corrections (14 November 2026)

- **Base:** owner-played Mini-Sim `0.12.13`; starting main SHA `7cb00b4870a18f805883cc00569e8598d8bb90b4`. Target release is `0.14.0`; Tower remains `0.2.79`.
- Warp's opening speed curve is stronger while keeping the same 1× start and 12× finish; the exponent changed from `0.82` to `0.60`. Course density increased from 22 to 24 layers; safe gate widths, steering and collision rules are unchanged.
- The corridor's visible roll increased from 45% to 72%, with slightly stronger axial sway. Class II reverses corridor visual travel, roll and shimmer; obstacle timing still runs forward.
- Successful Warp now auto-enters the chosen destination after a 700 ms arrival beat; Continue is removed. Failed Warp still exposes Retry and Cancel.
- Ship mode/system panels no longer cover the opening flight view: they start hidden and are reopened using a small gear control.
- PHP/plugin version, visible PHP title, RU/EN UI titles and runtime fallback are synchronized at `0.14.0`.
- Existing asteroid GLB asset packs are present in main but not yet connected to the active sector scene; the next work item is a seeded, performance-bounded integration, not another upload.
- No audio, Tower logic, SAGE writes, wallet operations, Galia Desk, firewall or production WordPress was changed. Live-page QA was not run.
- **Final 0.14.0 verification (14 Nov 2026):** Mini-Sim source/regression PASS [run #43582745712](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43582745712); Tower top-cap source-contract PASS [#43582745636](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43582745636); standalone Chromium smoke plus Tower → First Planet → same-seed ascent → return-state cycle PASS [#43582745647](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43582745647). Browser report/screenshots artifact: [#14109426036](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43582745647/artifacts/14109426036). PHP/First Planet package build PASS [#43582543868](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43582543868); UI Layer Regression PASS [#43582173529](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43582173529). Package and UI tests ran on the same 0.14.0 runtime source tree; later commits only adjusted test expectations, test slogan, and documentation. All checks are repository/local only; production WordPress/live URL was not accessed and deployment status is not claimed.


---

- **Verification after follow-up assertion updates (14 Nov 2026):** Mini-Sim regression PASS, 118 tests / 0 failures, [run #43582405254](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43582405254); Tower top-cap source-contract PASS, [run #43582405244](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43582405244). UI Layer Regression PASS [#43582173529](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43582173529); First Planet/package build PASS [#43582173546](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43582173546) on runtime source commit `784be9d`. Standalone browser QA is triggered again by this documentation sync; no production/live-page QA has run.

## Completed implementation — WORK LOCK #111: DOS attract mode and read-only console copy (14 November 2026)

- **Issue:** [#111](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/111). Final main HEAD: `3a32edf26bb33d0c301d5f3301008d1d0a58cc1e`.
- Start HUD now carries a DOS-style scrolling slogan: `INSPIRED BY STAR ATLAS // POWERED FOR ALL CREATURES // BCM4SA`, followed by read-only Crew/ship-console and no-signature copy.
- Crew preflight explains BCM4SA in RU/EN, distinguishes manual public-address scan from optional Phantom public-key retrieval, and labels blockchain access as read-only. Crew card and roster slots use restrained CSS entrance motion; reduced-motion preferences are honored.
- `mini-sim/PRODUCT.md` records current capabilities, no-signature/no-transaction boundaries, independent-project status and future-only integrations. Market-price valuation and guild member/join monitoring are explicitly marked not implemented.
- **PASS:** Mini-Sim regression [run #43540219879](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43540219879), Tower top cap [#43540219904](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43540219904), standalone Chromium [#43540219884](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43540219884). UI Layer [#43539971584](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43539971584) and package / First Planet bundle [#43539971511](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43539971511) passed on implementation commit `a592211`; later commits only corrected a case-sensitive test matcher and enabled the local-browser push trigger.
- Standalone browser run checks ticker visibility/marquee, Crew copy/entrance, existing local smoke, and transition persistence. Artifact: [screenshots + JSON](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43540219884/artifacts/14092040539).
- No audio, wallet/RPC, gameplay, pricing, guild events, SAGE or protected Galia Desk code changed. Local browser test only; no live WordPress, production or hardware verification claimed.

---

## Merged implementation — WORK LOCK #107: ship parked/flight forms (11 November 2026)

- **Issue:** [#107](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/107). **Merged:** [PR #108](https://github.com/ShamanOrWhitch/BCM4StarAtlas/pull/108), main commit [`c4754e019dc4a45a00aa26a4b0c3675c11d77931`](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/c4754e019dc4a45a00aa26a4b0c3675c11d77931). Mini-Sim: `0.12.10`.
- Added `mini-sim/assets/mesh/ships/catalog.json`: one entry per 37 ship families, referencing all 240 existing GLB files. Every family has explicit flight and parked choices; a single-file family reuses that same GLB for both states.
- Mini-Sim first-person space receives `BCMMiniSimConfig.shipCatalog`, exposes the complete family picker grouped by class, displays each family's parked form in the deep-space yard, and loads its flight form on transfer/boarding.
- First Planet derives island/showcase/race lists from the same catalog. 26 small / extra-small hull families use island berths; 11 medium / large / Titan families use the orbital showcase. A boarded ship switches to its paired flight mesh while moving and returns to its parked mesh when stopped/dismounted.
- Legacy saved ship IDs (Pearce X4, Busan Pulse, Pearce X5, Rainbow Chi/Om/Arc, Calico Hero) map to the new family IDs so the selection does not reset after catalog migration.
- Existing four medium demo rigs (Packlite, Mamba, Mamba EX, Pearce F4) keep their original controls, panels and mechanical modes. Rainbow camouflage code is unchanged; 2D rendering remains out of scope.
- **Verification:** ship-hull catalog/path + space/planet source tests passed in Mini-Sim regression [run #43036179836](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43036179836). UI Layer, Tower top cap, Warp visual tiers/return and Hull Dive RU/EN checks passed on PR head `13f0d764`. First Planet WordPress bundle build and package verification passed in [run #43036179805](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43036179805); test artifact `bcm-mini-sim-0.12.10-test`, artifact ID `13862878299`. Two browser smoke runs and main post-merge CI were still running at the time of this entry: [standalone browser](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43036180023), [GitHub browser QA](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43036180029).
- **Verification boundary:** no live WordPress upload/deployment, manual playthrough on `walkingyog.com/bcm4sa/`, or user device confirmation is claimed.
- **Coordination:** PR [#105](https://github.com/ShamanOrWhitch/BCM4StarAtlas/pull/105) / issue [#104](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/104) scenery work remains separate. This lock does not alter its island decoration, route or Shoal Race physics. Galia Desk, scanner/pricing, firewall, wallet writes and SAGE transactions remain excluded.

---

## Active implementation — WORK LOCK #107: ship parked/flight forms (11 November 2026)

- **Issue:** [#107](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/107). **Branch:** `feat/minisim-ship-hull-states`. **Base:** main `a7d6d6918c06818a1e8a968fb940d19ed0333042` (Mini-Sim 0.12.9). Candidate Mini-Sim version: `0.12.10`.
- Added `mini-sim/assets/mesh/ships/catalog.json`: one entry per 37 ship families and references to all 240 existing GLB files. Every family has an explicit flight and parked choice; a single-file family intentionally uses the same GLB for both.
- Mini-Sim first-person space now receives the catalog through `BCMMiniSimConfig.shipCatalog`, exposes the complete family picker grouped by ship class, displays each family's parked form in the deep-space yard, and loads its flight form on transfer/boarding.
- First Planet now derives island/showcase/race lists from the same JSON catalog. Small / extra-small craft park on the island; medium / large / Titan craft use the orbital showcase. A boarded ship switches from its parked mesh to the paired flight mesh once moving; single-file families remain unchanged.
- Existing four medium demo rigs (Packlite, Mamba, Mamba EX, Pearce F4) keep their original controls, panels and mechanical modes. Rainbow camouflage code has not been modified; 2D rendering is out of scope.
- Added `scripts/ship-hull-states.test.mjs` to verify all catalog paths, paired-state references, the four demo controllers, first-person wiring and planet wiring. It is now included in the Mini-Sim regression workflow.
- **Status:** source implementation is on the feature branch; GitHub PR checks and First Planet WordPress bundle build are pending. No live WordPress upload, production deployment, manual browser playtest or device confirmation is claimed.
- **Coordination:** PR [#105](https://github.com/ShamanOrWhitch/BCM4StarAtlas/pull/105) / issue [#104](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/104) scenery work remains separate. This lock does not alter its island decoration, route or Shoal Race physics. Galia Desk, scanner/pricing, firewall, wallet writes and SAGE transactions remain excluded.

---

## Completed — Mini-Sim 0.12.2 package delivery correction (6 November 2026)

- Gameplay source was already merged through [PR #100](https://github.com/ShamanOrWhitch/BCM4StarAtlas/pull/100), merge commit [`8753eaceb69b3608408f728d4fd76ca7dad6a073`](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/8753eaceb69b3608408f728d4fd76ca7dad6a073). Mini-Sim: `0.12.2`; Tower: `0.2.71`.
- The user's supplied workflow [#42221013821](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/42221013821) succeeded on that main commit, but its artifact was nested (plugin ZIP uploaded as an Actions artifact).
- Packaging correction merged via [PR #102](https://github.com/ShamanOrWhitch/BCM4StarAtlas/pull/102), commit [`f6903fcb7b67663b8bece272baafd78a230ebb74`](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/f6903fcb7b67663b8bece272baafd78a230ebb74). WORK LOCK [#101](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/101) is complete.
- The package workflow uploads the `mini-sim/` directory directly through `actions/upload-artifact`; GitHub makes the only ZIP. The artifact root retains `mini-sim/`. No inner ZIP is generated or unpacked, and no user-machine `%TEMP%` / `C:\\Temp` staging is used. A guard fails if any `.zip` is present inside the package tree.
- **PR CI:** 5/5 checks PASS on PR head `528152ca3887c3f9884e1f497736d4db0874a68e`: package, Mini-Sim regression, standalone Chromium browser smoke, Tower top cap and Hull Dive RU/EN copy.
- **Post-merge main CI:** package [run #42226266489](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/42226266489) PASS; artifact ID `13505538107`, name `bcm-mini-sim-0.12.2-test`, size 336,967,592 bytes. Mini-Sim regression [#42226266351](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/42226266351) and Tower top cap [#42226266396](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/42226266396) PASS.
- CI found two stale hard-coded version assertions in `scripts/asteroid-tower-hull-controls.test.mjs` (0.12.0 / Tower 0.2.69). They now read the versions from PHP headers and validate the visible Mini-Sim title and Tower JS/PHP synchronization.
- **Verification boundary:** this confirms source tests, the separate standalone browser smoke, and package creation. It does not confirm WordPress installation, the live `walkingyog.com/bcm4sa/` page, or a manual Tower → First Planet → return playthrough. No production upload/deployment is claimed.
## Active — Mini-Sim 0.12.1 local transition loop (5 November 2026)

- **WORK LOCK:** [#97](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/97). Branch: `feat/minisim-0.12.1-planet-bundle`, merged toward `main`. The 0.12.0 draft was [#98](https://github.com/ShamanOrWhitch/BCM4StarAtlas/pull/98).
- Product scope is **local one-browser play only** for 0.12.1. Preserve offline Single and current local split-screen Multi. No remote sockets, matchmaking, auth or online session service in this version. Issue #48 remains the later whole-Mini-Sim network architecture.
- Mini-Sim PHP/JS version: `0.12.1`; Tower PHP/JS version: `0.2.70`.
- Adds `window.BCMMiniSimSession` as a local session context with a stable session seed and separate deterministic seeds for Space Labyrinth, Warp, asteroid, Ring, Tower, First Planet and Shoal Race. First Planet's island save and Shoal Race pickup placements consume their location seed; the existing track topology and Tower generator/physics remain unchanged.
- Tower entry keeps its existing ONICSS forward landing handoff. The arrival snapshot carries ship position/quaternion/velocity, Crew roster, Tower seed/mode, Warp navigation context, session and mission state. The internal Hull Repair compartment snapshot is preserved.
- After completing First Planet, a visible Tower portal is available on the landing area and uses the local E interaction. The planet unmounts before Tower is brought back to avoid keeping two WebGL worlds active. Tower rebuilds the exact saved seed from its bottom, in the opposite traversal direction. Reaching the upper exit uses the existing ONICSS clip in reverse (native reverse playback with frame-seek fallback), then returns to the original Space Labyrinth page/session.
- Warp return snapshot now stores a compact current-sector/neighbor context and attempts to rebind to the SAGE adapter after reload. Saved preview coordinates remain identified as local preview data and are not promoted to real SAGE sectors.
- First Planet accepts an optional `FP.mp3` URL; one audio element belongs to the Planet parent and can continue across island/race view switches. It is lazily loaded and starts only after user interaction. The absence of `FP.mp3` is allowed until the user uploads the soundtrack.
- The test-package workflow now builds the First Planet WordPress bundle and verifies `wp-dist/first-planet.js` + `wp-dist/first-planet.css` are included in the installable ZIP.
- **TESTED-CODE on head `b6aa387`:** Mini-Sim regression, Tower top cap, Ring menu controls, Warp maze return, Warp visual tiers, Warp course/portal, Hull copy, UI Layer and UI/weapons/cabin have PASS results in GitHub Actions. A focused test file `scripts/minisim-012-local-transitions.test.mjs` is included in the main Mini-Sim regression workflow.
- **Latest runs still in progress at note time:** [standalone Chromium](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/42080691734), [test package / First Planet bundle ZIP](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/42080691417), [live-page browser smoke](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/42080691415). An earlier live-page smoke on this PR failed before gameplay because the host returned HTTP 403 before `.bcm-mini-sim`; treat this as BLOCKED-ENVIRONMENT, not a game failure.
- **Not yet VERIFIED-LIVE / USER-CONFIRMED:** no WordPress upload, no physical phone/gamepad test, and no end-to-end manual playthrough of Tower → Planet → same-seed ascent → reverse video → restored Space Labyrinth has been done by the user. The existing standalone Chromium smoke exercises the earlier local Space Labyrinth/Warp path; it does not yet prove the new cross-world journey visually. Keep PR #98 draft until final CI and user's manual local journey are checked.
- Do not touch `wordpress/galia-desk`, scanner/pricing, firewall, wallet writes or SAGE transaction paths in this lock.

---

## Completed — Mini-Sim 0.11.22 Twinsun wall minerals (1 November 2026)

- **Merged:** [PR #94](https://github.com/ShamanOrWhitch/BCM4StarAtlas/pull/94), main commit [`6d5d475`](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/6d5d4757d30e5f21a2e1e1046756db939e469e33). Closed work lock [#93](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/93). Mini-Sim is now `0.11.22`; Tower remains `0.2.67`.
- **Geometry:** use the new `twinsun_pack01` models already uploaded to main. Each wall deposit is a parent with four separately addressable parts: a rock cluster plus main, side and small crystal GLBs. Four variants are supported (cyan, violet, amber, green); a seeded palette rotation displays all four on a full four-deposit run.
- **Placement:** at most four small mineral deposits are attached to existing vertical side panels in the middle maze layer, prioritizing early route cells. The rock base is partially embedded; crystal growth points into free cell space. A subtle emissive tint applies to crystal parts only. No new colliders.
- **Preserved:** decoration uses a dedicated seed stream. Existing topology/seed, route cells, wall array and transforms, wall textures, Hydrogen pickups, collision and flight physics are unchanged. No edits to Ring/Tower/Onicss/Warp/Hull/Crew mechanics, Galia Desk, scanner/pricing or WP layout.
- **TESTED-CODE:** 9/9 source/regression workflows passed on PR head `b4145672fa99b68deefe07a06fd73d8f14cae282`. The repository's own standalone Chromium run [41349618593](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/41349618593) passed 19/19 checks, including asset loads, four distinct child parts, all four colours, and a close-up render from the same scene without moving the ship. Browser metrics: 4 deposits, 36 mesh objects, 3,144 triangles; no serious console/page errors or local plugin HTTP errors. Screenshots + JSON report are attached to the workflow run artifact (14-day retention).
- **BLOCKED-ENVIRONMENT, not a game failure:** separate live-page runner [41349618506](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/41349618506) received HTTP 403 from `https://walkingyog.com/bcm4sa/` before `.bcm-mini-sim` appeared. No firewall bypass or repeat of the identical route.
- **Not deployed / not VERIFIED-LIVE:** PR merge changed GitHub main only. No WordPress plugin upload, production-page verification, phone or gamepad test is claimed.

---

## Standalone Playwright QA harness — WORK LOCK #90 (28 October 2026)

- Branch: `feat/minisim-standalone-browser-qa`, baseline `e940be64f2e280dcab321c2f0f739974e1b7bce9`.
- Added `tools/minisim-qa/standalone-shell.html`, a browser fixture mirroring the Mini-Sim/Tower shortcode DOM contract while using the existing repository assets.
- `scripts/minisim-standalone-qa.mjs` builds the test config from the current Mini-Sim/Tower PHP version constants and scans the checked-out assets; it serves the fixture on localhost and delegates to the existing Playwright interaction test. The existing runner intercepts plugin asset requests and serves current JS/CSS/media from the checkout, so the test does not need live `walkingyog.com/bcm4sa/` access.
- New command: `npm run qa:minisim:standalone`. `npm run qa:minisim -- --url "https://your-wp-page/"` remains the separate live-WordPress path.
- Added `.github/workflows/minisim-standalone-browser-qa.yml`: PR/manual browser run on GitHub Actions, and screenshot/JSON artifacts under `.qa-artifacts/`.
- **VERIFIED standalone browser PASS:** [GitHub Actions run #40724817635](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40724817635), PR head `17cd69fee55a9463e32ed5b34d22dcce69c66eb3` (the PR run executed merge tree `fc6438baa61f930f213c58a492bdbbea9d588021`). 14/14 browser checks PASS: local fixture and current repo JS/CSS are served, flight starts from Crew preflight, Warp map opens, only `warp.mp3` plays on the map and Tube, OST continues without reset, the result/cancel UI opens, cancel restores ship coordinates and Starbase OST. No serious page errors or plugin HTTP errors. [Screenshots + JSON report artifact](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40724817635) (14-day retention).
- **TESTED-CODE PASS:** [Mini-Sim regression workflow #40724818031](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40724818031) passed on PR head `17cd69fee55a9463e32ed5b34d22dcce69c66eb3`. The separate live WordPress browser run remains **BLOCKED-ENVIRONMENT** because the host returns HTTP 403 before the app; it is not a gameplay failure. The standalone fixture does not verify PHP shortcode rendering, active `walkingyog-theme`, remote API availability, actual Ring gameplay, Tower gameplay, or physical phone/gamepad behavior. It does not bypass the firewall.
- Exclusions preserved: `wordpress/galia-desk`, scanner/pricing, shared assets, firewall and gameplay logic unchanged.

---

## Merged fix — Warp reverse flow + Tower P2 Right Ctrl (27 October 2026)

- **Main:** [PR #88 merged](https://github.com/ShamanOrWhitch/BCM4StarAtlas/pull/88) as [`dee7ae399c3023dd3f3861e3414f185ee5550e67`](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/dee7ae399c3023dd3f3861e3414f185ee5550e67). Source change: [`196dddb`](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/196dddb345ba04a53b2d3e3ef24689b2744d1953). Not deployed to WordPress.
- **Warp:** no axial streak overlay. Existing 14 circumferential wall bands now have stronger contrast and faster motion (phase coefficient 0.052; opacity 0.56/0.30; widths 1.55/1.0). Class II reverses the phase to move away from the ship into depth; Classes I/III move toward the ship. The 12 longitudinal seams and Warp course/collision rules are preserved.
- **Tower keyboard:** P2 arrows move, Right Ctrl jumps, Right Shift acts. The old X jump is removed; physics remains unchanged.
- **Galaxy map:** existing 2D SAGE XY overview and separate sector-local locations from PR #85 remain unchanged. No fictitious sector coordinates are added.
- **TESTED-CODE:** all 8 source/regression workflows passed on `2b71e3b601a12477aa8dd4a6ed0a29149d3b2838`: [Warp visual](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40575342798), [Warp route/return](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40575342746), [Tower cap](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40575342760), [Warp portal](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40575342909), [UI layer](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40575342741), [Mini-Sim regression](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40575342749), [Ring controls](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40575342725), [UI/weapons/cabin](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40575342986).
- **Not verified live:** browser smoke [40575342708](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40575342708) failed; do not count it as gameplay validation. No WordPress deployment and no manual device test are claimed. Issue #70 remains open for in-game confirmation after deploy.

## Merged follow-up — Mini-Sim 0.11.22 Warp flow visual correction (27 October 2026)

- **Main:** [PR #87 merged](https://github.com/ShamanOrWhitch/BCM4StarAtlas/pull/87); merge commit [204636e72b94df954829fd739d050434e22ba28b](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/204636e72b94df954829fd739d050434e22ba28b).
- **Warp visuals:** removed the extra short axial motion streaks. Fourteen low-contrast horizontal/circumferential bands now wrap the full tube wall. Class II moves deeper into the tunnel; Classes I and III move toward the ship. Band motion follows the existing accelerated `tubeTravel` clock.
- **Preserved:** the original 12 longitudinal surface seams, 22 randomized obstacle layers, hazard placement, collision timing, route progress, Ring behavior and Tower physics.
- **Galaxy map:** the practical 2D SAGE XY overview is in main from PR #85, with known star/CSS landmarks, adapter-provided sector coordinates, zoom, eight adjacent local destinations and a separate sector-location layer. The available snapshot does not contain all 8,177 sector coordinates; missing topology is not fabricated.
- **TESTED-CODE:** 8/8 source workflows PASS on PR head `b4ec426c2e3b39eacd99f341fafbf2abb3d353ee`: [Warp visual tiers](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40501631728), [Warp course/portal first frame](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40501631810), [Warp maze return](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40501631727), [Ring menu controls](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40501631577), [Mini-Sim regression](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40501631578), [UI layer](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40501631604), [Tower top cap](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40501631929) and [UI/weapons/cabin](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40501631732). JS and regression-test syntax checks pass.
- **BLOCKED-ENVIRONMENT, not browser PASS:** [browser run 40501631745](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40501631745) failed because `https://walkingyog.com/bcm4sa/` returned HTTP 403 and the runner could not find `.bcm-mini-sim`. No firewall bypass was attempted.
- **NOT VERIFIED-LIVE:** no WordPress deployment, production-browser check or physical phone/gamepad test is claimed.


---

## Previous main baseline — Mini-Sim 0.11.20 / Tower 0.2.66 (26 October 2026)

- First Panda dialog is flight and screen approach. The Warp button (V, or WARP on a phone) is the second dialog, after the screens.
- Ring entry plays the landing clip, then the menu. The 2s abort stays gone. The side view uses the asteroid seed's wall textures. The forward door follows Hydrogen, then the return to the landing cell, including vertical floors.
- Mini-Sim/cache/title version: `0.11.20`; Tower version: `0.2.66`. No WordPress deployment from `cd75cfe`.

## Previous state — Mini-Sim 0.11.19 / Tower 0.2.66 (26 October 2026)

- Ring level opens on approach and stays open. The 0.11.18 two-second video abort is gone. The crash was `portalMaterial.emissive.setHex` on a basic material, plus a maze-frame ReferenceError that skipped the approach check.
- Warp cancel on the asteroid keeps that locale and those coordinates. Place label is `ASTEROID · X / Y`, not Room 1.
- Flight radius is 160 so the asteroid can be flown around. Wall damping remains the 0.11.2 contact rule (0.15). V = Warp, U = hold, X = helm.
- Mini-Sim/cache/title version: `0.11.19`; Tower version: `0.2.66`. No WordPress deployment from `cd75cfe`. 0.11.18 was already merged as PR #81.

## Previous state — Mini-Sim 0.11.18 / Tower 0.2.66 (26 October 2026)

- Ring entrance is a tappable door above Panda, and the cell maze renders in the flight canvas with the first opening aimed at the large arena.
- Phone flight copy is tilt, tilt reset, and tap-to-fix music screens. Keyboard Warp is a V button on the same action as the V key; phones get WARP.
- Mini-Sim/cache/title version: `0.11.18`; Tower version: `0.2.66`. No WordPress deployment. Asteroid physics and backside doors stay on the 0.11.16 contract.

## Previous state — Mini-Sim 0.11.17 / Tower 0.2.66 (26 October 2026)

- Merged via [PR #80](https://github.com/ShamanOrWhitch/BCM4StarAtlas/pull/80), commit `d821764610890e84970ba20b354e90e41d1cc6cf`.
- **Ring handoff:** the asteroid and ship remain visible until Ring's world, controls, renderer and cleanup routine are ready. Entry snapshots the old scene. If initialization throws or returns false, partial Ring state is cleaned up and the original asteroid visibility, ship visibility, background and scene children are restored; the Ring button remains retryable. The post-video failure path now displays a status instead of silently leaving empty space.
- **Tower text:** keyboard/mouse, touch/tilt and gamepad each have short device-specific instructions. Gamepad help adapts to Single/Multi and the number of connected controllers. Single objective is `ПОРА СПУСТИТЬСЯ ВНИЗ`; Multi is `КТО ПЕРВЫМ СПУСТИТСЯ ВНИЗ?`. Persistent warning: falling five landings returns to the start.
- Mini-Sim/cache/title version: `0.11.17`; Tower version: `0.2.66`. No WordPress deployment.
- Source CI on PR head `1097fe4b528cfc7695e4df85b76812f545e00803`: Ring, Mini-Sim, UI, Tower, Warp, Hull Dive and portal regressions PASS. Browser smoke was still running when this state note was written; it is not counted as a live pass. Manual game/video/device testing remains unverified.
- The preceding 0.11.16 section is historical and describes the prior asteroid rollback/door fix.

## Superseded state — Mini-Sim 0.11.16 (25 October 2026)

- Merged via [PR #79](https://github.com/ShamanOrWhitch/BCM4StarAtlas/pull/79) as commit `07ed389df12a491d987d47507bc42a1d97559af5`; this supersedes the 0.11.15 asteroid-contact and shell-door behavior documented below.
- **Asteroid rollback:** only the asteroid collision / exterior flight-radius block was restored to the 0.11.2 baseline. It uses the previous two-pass overlap resolver, damps the contacting velocity component by 0.15, retains the 43.2 flight-radius limit and the historical radial-boundary slowdown. Newer Warp, Ring, Hydrogen pickup, route generation, and unrelated Tower code remain in place.
- **Backside doors:** every outer-shell tile carrying a `backside*` texture now responds to the ship approaching its own footprint. Adjacent tiles open together when their clearance areas overlap; collision passage is allowed only when every overlapping panel is fully open. Doors close after the ship moves away.
- **Room 2 remains a solid corridor:** its side and front walls are not doors. The rear cap allows entry and exit only through the matching open `backside*` door; the former unconditional inside-to-space bypass is removed.
- Mini-Sim code/header/cache/title version is `0.11.16`. No WordPress deployment was performed.
- Source CI on tested PR head `a0049580e560babea5d9284ccafbc73e55574e48`: 9 source regression workflows PASS. Browser smoke FAILED because the site returned HTTP 403; Playwright then timed out waiting for `.bcm-mini-sim`. This does **not** establish a live game pass, and no manual phone/gamepad test was performed.
- The previous 0.11.15 description below is historical and is superseded by this rollback.

## Superseded state — Mini-Sim 0.11.15 (25 October 2026)

- Merged via [PR #78](https://github.com/ShamanOrWhitch/BCM4StarAtlas/pull/78) as commit `1b00a801f62506917f533ead12d0524f06159802`; issue [#77](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/77) is closed.
- The only dynamic door candidates are the outer starbase-shell panels built from `backside*` textures. Room 2 interior walls and asteroid maze walls are explicitly excluded. Room 2 does not become generally passable.
- The external shell collider accepts a crossing only if the matching selected backside panel is fully OPEN and the ship crosses within that panel's aperture.
- Asteroid maze collisions zero only the wall-normal component instead of leaving residual impact velocity; tangential motion remains. Exterior radius cap is widened to 58 and removes only outward radial velocity, not all ship speed.
- Crystal pickups show a stronger pickup flash plus floating `H +1` (or `CORE +1` outside the Hydrogen stage). The existing mission event synchronously advances the Hydrogen count; duplicate crystal IDs remain ignored.
- New regression cases cover shell-only door selection/opening, solid Room 2 corridor bounds, low-kickback tangential motion and the actual Hydrogen mission counter.
- Source suites passed on the merged PR head: Mini-Sim regression, Warp maze return, Warp visual tiers, UI layer, Ring controls, Tower top-cap, bilingual copy, UI/weapons/cabin and Warp course/portal first-frame. Browser smoke did not reach gameplay because the runner was still installing isolated Playwright; no visual/device pass or WordPress deployment is claimed.

---

## Main state — Mini-Sim 0.11.14 merged (25 October 2026)

- Merged via [PR #76](https://github.com/ShamanOrWhitch/BCM4StarAtlas/pull/76) as main commit `65df7b29b7e0ab7a139cbf691f41ad103b0d8ba2`; issue [#74](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/74) is closed.
- Retains main's 0.11.13 Warp depth staging, real frame-start collision sampling, swept asteroid collision, Ring entry recovery, and Panda presentation.
- Changes: Room 1/Room 2 collision planes only block at the actual finite wall/cap intersection; Room 1 recovery is limited to the physical corridor cross-section; Room 2 rear exit remains open; asteroid exit-to-map keeps the current ship pose and V opens next-destination navigation; cache version 0.11.14.
- Added source regression cases for free-space X/Y/Z crossings, solid corridor wall/cap crossings, Room 2 rear exit, and asteroid -> map pose handoff.
- **CI status:** Mini-Sim regression, Warp maze return, Warp visual tiers, UI layer, Ring controls, Tower top-cap, bilingual copy, UI/weapons/cabin, and packaged test build passed on the merged commit. Browser smoke remains unverified: the runner has stalled in Playwright setup; earlier runs got HTTP 403 before the game root. No visual PASS or production deployment is claimed.

---

## Mini-Sim 0.11.13 repair candidate — 25 October 2026

- **Branch:** `fix/minisim-0.11.13-warp-depth-room-collision-ring-entry`, based on main `ab7c3d91c9932d3363375036bb07bbcbd6ad67ad` (0.11.12 / Tower 0.2.65).
- Warp: revert the visible obstacle window from 0.68 to 0.36 of the remaining course and restore the prior perspective projection so nearby gates are staged instead of crowding the screen; the HUD now reports the actual speed multiplier used by tube travel, not the abstract ramp.
- Room 1/2: collision now receives the true frame-start ship position. Previously `collide()` cloned the position only after integration, so its before/after crossing checks compared the same coordinates and could not catch a fast wall crossing. Wall-correction flags compare the attempted post-step position against the corrected position.
- Asteroid/Ring: do not permanently unset the shared Warp frame/poll/render handlers after one transient exception (that also removes asteroid collision); Ring entry failures are caught, the overlay is cleaned up, and a manual retry is made available without automatic retry spam.
- Panda dialogue enlarged further: 900px desktop cap, 80px avatar, 19px message; mobile keeps a large avatar and readable message.
- **Not deployed.** CI/source checks pending. Live browser remains blocked by HTTP 403 before `.bcm-mini-sim`. Do not claim visual PASS or bypass the firewall. `wordpress/galia-desk` is out of scope.

## Historical Mini-Sim 0.11.12 repair candidate — 25 October 2026

- **Branch:** `fix/minisim-0.11.12-warp-speed-collision-ring`, based on main `9caba968636610a2413a23177bd9d64f20fe0900` (Mini-Sim 0.11.11 / Tower 0.2.65).
- Focused repairs: Warp multiplier corrected to 1×→8× and displayed in the tunnel HUD; the initial Panda flight prompt explicitly includes `V — карта Warp`; Panda's bubble is wider, right-aligned, with 15–17px message text; asteroid swept collision resolves a frame beginning inside the expanded wall AABB; Ring entry stays armed if engine runtime is unavailable.
- User reports 0.11.8 is still the best-feeling build. This candidate preserves later mission and Ring content while attempting targeted repairs instead of silently rolling back the whole plugin.
- **Not deployed.** CI/source checks pending. Live browser verification is blocked by HTTP 403 before the game container; do not call this a visual pass or bypass the firewall.

## Candidate Mini-Sim 0.11.11 — Warp visibility and Panda controls (25 October 2026)

- **Branch:** `fix/minisim-0.11.11-warp-panda-prompt`; **WORK LOCK:** [Issue #70](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/70).
- **Baseline:** main `bc77614564aa7bf1f2a211c945006fc258d6aeff` (Mini-Sim 0.11.10 / Tower 0.2.65). The original candidate PR #71 was merged into main; it was not deployed to live WordPress.
- Warp regression reported by the user: in 0.11.10, some hazards were no longer readable after their rendering was reduced to two faint longitudinal guide-lines; the tunnel had 24 base strips and Class II extra rails/pulse dots. The candidate returns to 12 base strips, applies modest depth skew, removes the extra Class II rails, keeps decorative circumferential wall rings/chevrons absent, and draws visible segmented gates (with the collision-safe opening), sweepers and spike teeth. The obstacle display window is extended; `updateTube` collision formulas, Warp duration/speed ramp, shimmer timing, soundtrack, navigation and Tower physics are not changed.
- Panda controls: widen the operator bubble to the right; keep Panda visible down to 420px; remove the independent right-side controls card. First-flight copy says WASD, U, mouse look, middle-click release and gamepad sticks. Warp copy says V / gamepad Y and explains mouse drag, A/D/arrows and left-stick steering.
- **TESTED-CODE: PASS** on branch HEAD `dbca3b10bbd5f8598a914527bfe481a38cf59a87`: Mini-Sim regression [run 40198934822](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40198934822), UI layer [run 40198934821](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40198934821), Warp visuals [run 40198934806](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40198934806), Warp course/portal [run 40198934805](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40198934805), Warp maze [run 40198934800](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40198934800), Ring controls [run 40198934803](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40198934803), Hull RU/EN [run 40198934801](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40198934801), Tower cap [run 40198934804](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40198934804). These are code/CI tests, not live visual or hardware verification. Candidate browser QA [run 40198934895](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40198934895) **FAILED/BLOCKED**: the runner received HTTP 403 for `https://walkingyog.com/bcm4sa/` and timed out waiting for `.bcm-mini-sim`; it never reached the game UI. This is not a code/visual FAIL and must not be recorded as a browser PASS. The protection still blocks this GitHub Actions browser request; do not bypass it. No bypass attempt, no production deployment; `wordpress/galia-desk`, scanner and pricing data remain untouched.

## Main baseline before this candidate — Mini-Sim 0.11.10 (25 October 2026)

- Main SHA: `bc77614564aa7bf1f2a211c945006fc258d6aeff`. The latest commit repaired a pointer-lock API name used by a test; Mini-Sim regression and Tower top-cap regression passed on that SHA.
- Browser QA against `https://walkingyog.com/bcm4sa/` still failed with HTTP 403; this is a blocked test, not a visual test of the game.
- No production WordPress deployment or physical phone/gamepad test is recorded.

## Кандидат Mini-Sim 0.11.5 — детерминированная астральная физика
- Основа: кандидат 0.11.4 / Hydrogen mission (PR #66), исправления 0.11.3 (PR #65); Tower обновлён до 0.2.65, чтобы сбрасывать кэш seed-снимка. Ветка minisim-0.11.5-astral-phase, не слита и не развёрнута.
- Для каждой клетки Y-слоя режим вычисляется отдельно от RNG маршрута — по seed астероида и координатам клетки. Одинаковый seed даёт тот же режим и фазу.
- Три режима: Drift (низкая гравитация), Flux (ограниченный пульс гравитации без инверсии), Dense (более сильная гравитация). Карта и HUD показывают различия. Двери, проходы, позиции кристаллов и порядок случайного генератора не меняются; существующие текстуры переиспользуются.
- 0.11.4: после фактического воспроизведения всех настроенных экранов оператор открывает задачу Hydrogen; сбор находится в первой малой клетке того же Ring seed.
- Для будущего возврата: перед freeze Tower сохраняется снимок корабля, а активный Tower seed записывается в `BCMWorldMission`; это основа, не готовый возврат. Tower-часть теперь 0.2.65.
- Не готово: город под Tower + возврат вверх по тому же Tower seed (issue #67); более глубокие взаимодействия астральной фазы (issue #68 — первый слой физики реализован здесь, нужны тесты и доработка по результатам игры).
- Camera: явно выбранный экран сохраняет приоритет над другими роликами и не теряет фокус только потому, что нет ближайшего внешнего видео. Фокус снимается при выходе цели из радиуса/недоступности; HUD показывает прогресс экранов и сбор Hydrogen.
- CI: после открытия PR должны пройти исходные и регрессионные тесты. Production Browser QA получает 403 от firewall; физическое управление и видимый рендер на телефоне не подтверждены.

## Historical snapshot — Mini-Sim 0.11.8 (24 October 2026; superseded by main 0.11.10)

This entry supersedes the older 0.11.3–0.11.5 candidate notes below; those sections remain as history, not as the current state. Current code is on `main`; Tower remains `0.2.65`. **Nothing has been deployed to the website.**

- Warp: Class II has subdued visuals; Class III has a distinct purple shell and ribs; Class IV is disabled. Solid circular obstacle hoops were removed, along with the extra `>` chevron and launcher loop marker. Tube collision and steering should remain independent of visual class.
- Ring: the room graph has a BFS route to the large arena. At blocked doorways a transition selects an available step toward the arena; the action control uses the route hint. Each player retains a separate logical room, with split-screen when they occupy different cells.
- All three bosses now have recognisable pig silhouettes built from existing Three.js primitives (body, snout, ears, nostrils, tusks, legs and tail); no new image or texture assets were added. The weakpoint is in front of the head so the snout does not hide it.
- Source/regression checks, UI-layer checks, Tower top-cap checks, and the test ZIP build passed on the current code. Browser QA did not verify rendering: `https://walkingyog.com/bcm4sa/` returns HTTP 403 before the game container appears. Do not bypass the firewall or report this run as a visual test.
- `wordpress/galia-desk` is untouched. No production deployment was made.

## Предыдущий кандидат Mini-Sim 0.11.4 — Hydrogen mission
- Основа: PR #65 / candidate 0.11.3 поверх main 0.11.2, Tower остаётся 0.2.64. Ветка `minisim-0.11.4-hydrogen-mission`, не слита и не развёрнута.
- Диалоги оператора учитывают экраны только после реального `playing`; каждый настроенный экран засчитывается один раз. После последнего экранного триггера появляется цель: найти Hydrogen в первой маленькой ячейке Ring.
- Hydrogen размещается в ячейке `maze.startCell` того же seed-графа, отмечается буквой H на карте, собирается один раз; событие обновляет журнал миссии и операторский диалог.
- Bearhead пока опционален: если `mini-sim/assets/bearhead.mp4` нет, используется ✦.
- Не сделаны в этом патче: anomalous astral phase beyond current Y-layer gravity/tint, город под Tower и обратный подъём по тому же Tower seed к исходному кораблю. Сцена Mini-Sim сейчас уничтожается на Tower handoff; сначала нужна отдельная схема park/resume или сохранения состояния.
- Кодовые CI проверки нужно выполнить на актуальном коммите. Удалённый браузер сайта получает 403 от firewall; production-визуальная проверка недоступна без нормального доступа.

## Предыдущий кандидат — Mini-Sim 0.11.3 (bugfix branch)
- База: main Mini-Sim 0.11.2, Tower 0.2.64. Ветка `minisim-0.11.3-ring-texture-focus`; пока не влита и не развёрнута на WordPress.
- Ring: у каждой стены астероида теперь сохраняется владеющая клетка; 3D-стены и 2.5D-карта используют `wallAsset` и `wallTurn` этой клетки. Выбор внешнего вида детерминирован отдельным потоком от seed, который строит маршрут и кристаллы.
- Crew: общая `BCMCrewCore` исправляет разворот не-Mierese, сохраняя ориентацию Mierese. Ветка ещё требует регрессионного теста/визуального подтверждения.
- ONICSS: загружает `onicss.mp4` в пределах настроенного preload radius; пока видео не начало воспроизводиться или при ошибке видна `OniStation.png`, а не пустая чёрная плоскость. X снимает фокус камеры, если он активен и не открыт Ring/Hull.
- Диалог оператора может использовать `mini-sim/assets/bearhead.mp4`, когда файл появится; до этого остаётся значок ✦.
- Ещё не реализованы: Hydrogen в стартовой клетке и цель после посещения всех экранов; полноценное астральное измерение; город под Tower и возврат по тому же seed. Это следующие этапы, не часть текущего патча.
- Проверки GitHub/WordPress: статические и CI проверки ожидают запуска после открытия PR. Живой Browser QA через сайт сейчас блокируется ответом 403 от firewall; визуальное поведение на телефоне не подтверждено.

## Предыдущий этап — Mini-Sim 0.11.1
- База: 0.11.0 (Room 1, механики 0.9.113). Кэш **0.11.1**.
- Снаружи: V — Warp, U — трюм. В трюме штурвал — X, кнопки без букв. Полёт клавиатурой на десктопе только вместе с захватом мыши.
- Кольцо строится из клеток астероида и его текстур. Арена боссов — одна большая клетка. Метки кристаллов ставит пролёт корабля. Респавн мобов 4 минуты. Спрайты — вырез `BCMCrewCutout`.
- Это не деплой WordPress и не физический тест телефона.

## Предыдущий этап — Mini-Sim 0.11.0
- База кода: механики **0.9.113** (PR #59, коммит `c9d90ec`). Старт снова **Room 1** `(0, 0, 2)`, без автотелепорта в астероид. Версия кэша **0.11.0**.
- 0.9.114 (cutaway Ring и переназначение кнопок) снята с роли рабочей базы. Ручной прогон той линии не прошёл: V не открывал Warp, U не вёл в трюм.
- Снаружи трюма: V — Warp, U — трюм. Корабль ведёт тот, кто у штурвала; трюм полёт не паузит.

## История этапа 0.9.114 — не база
- Main baseline: Mini-Sim 0.9.113 / Tower 0.2.64 (PR #59). Candidate branch: fix/minisim-0.9.114-ring-cutaway-controls. Flight start remains normal; the ship is not auto-teleported into the asteroid maze.
- Ring Maze is restored from the active 3D maze graph: cells/open passages/stairs, the same seed, entry/exit and three crystals. Linear boss arenas and generated comic backdrops are removed.
- Ring surfaces clone existing maze materials and reuse their texture maps. Cleanup may dispose cloned materials but not textures owned by the active asteroid maze.
- Objective: collect the three crystals and return to the entry. Small seeded mobs patrol cells and can be shot; they do not block completion.
- Controller: X/button 2 fires, Y/button 3 does not. Back/Select exits Ring and returns home outside gameplay overlays. B does not return home; it resets the current room outside overlays, and its Hull Dive action remains available inside.
- Hull Dive releases Pointer Lock on open so mouse interactions work; exterior ship physics continue. CI and code checks are not a physical controller or WordPress test.

## История состояния — 21 октября 2026

- **Актуальный main:** Mini-Sim **0.9.112**, Tower **0.2.64**. Merge commit PR [#57](https://github.com/ShamanOrWhitch/BCM4StarAtlas/pull/57): 443cd4f1cd388d020f1811908f1d31ad53809334. Asset/cache version и стартовые заголовки синхронизированы на 0.9.112. Hull Dive оставляет внешний космический вид работающим под inset, стартует с активным штурвалом; кнопка входа в кабину вынесена на верхний слой документа. Отдельная кнопка Ring доступна рядом с маяком, меню уровня принимает мышь/касание, клавиатуру и gamepad A. Добавлен hit-test аудитор: Ctrl+Alt+U.
- **Проверки PR #57 — PASS:** Mini-Sim regression [39602967437](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39602967437), Ring menu [39602967350](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39602967350), UI layer audit [39602967364](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39602967364), Hull RU/EN [39602967454](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39602967454), Warp visuals [39602967418](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39602967418), Warp return [39602967560](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39602967560), browser smoke [39602967382](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39602967382). Это TESTED-CODE, не физический тест телефона/gamepad и не подтверждение WordPress deploy.
- **Управление Ring:** PR #46 исправил подтверждение SINGLE/MULTI до создания персонажа: клавиатура E/Enter/Space, стрелки/A-D, D-pad/стик и A/Start на gamepad, касание на телефоне. Автотест прошёл; физический контроллер ещё не подтверждён.
- **Warp visual classes:** X-Small/default — стандартная труба; XX-Small — спиральные бирюзово-янтарные рельсы; III/IV — отдельные визуальные прототипы. I/II/III/IV доступны в мини-селекторе Tube. Реальный Warp Drive slot из Galaxy API пока не подключён — класс не является достоверно прочитанным NFT-компонентом.
- **UI и Hull Dive:** два прозрачных диалога-комикса оператора/управления RU/EN; Crew-портреты увеличены. В 0.9.112 Hull Dive немного увеличен, но остаётся адаптивным для узкого viewport; космический рендер продолжает работать сверху, а штурвал активен для Crew 1 при старте у пилотского места. Gamepads назначаются по индексу: один контроллер — P2, два контроллера отдельно управляют P1/P2. Не подтверждено физическим контроллером или телефоном. Дым/пузырьки работают из ограниченных пулов и становятся заметнее по уровню опасности. Графика пробоины/энергии использует холодные космические цвета.
- **Ring weapons:** прототипы — быстрый тонкий laser pointer, более толстый pulse и меняющий цвет spectrum. Мастер предлагает выбор после первого побеждённого босса; тест улучшения предлагается после каждых двух успешных завершённых пробегов между предложениями. Прогресс хранится в памяти вкладки и пока не переживает перезагрузку. Баланс и попадания требуют игрового теста.
- **Split-screen:** в Ring раздельные виды горизонтальные: P1 сверху, P2 снизу, когда игроки достаточно разошлись. Локальная игра не зависит от сети.
- **Network prototype:** PR #52 добавил серверный in-memory room registry и ограничения памяти/клиентов с независимыми локациями. Это **не live multiplayer**: WebSocket, аутентификация, scheduler, RTT и reconnect ещё не реализованы. Следующий этап — Issue #48.
- **CI на коде PR #55:** Mini-Sim regression PASS — [39567055498](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39567055498); Hull RU/EN copy PASS — [39567055354](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39567055354); Warp visual tiers PASS — [39567055312](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39567055312); UI/weapons/cabin PASS — [39567055331](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39567055331); Tower top cap PASS — [39567055392](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39567055392); browser smoke PASS — [39567055334](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39567055334). Browser QA did not run the video-enabled step; no physical Android/gamepad validation or production WordPress deployment is implied by these checks.
- **Таймауты:** browser QA job — 45 минут; отдельные install/media steps — 20–25 минут; regression/source jobs — 25–30 минут; page navigation wait — до 60 секунд.
- **Жёсткое исключение:** не трогать wordpress/galia-desk, scanner, marketplace/pricing data и их общие assets. Не менять расположение планеты, SAGE navigation adapter или глобальный микшер без воспроизводимого регресса.

**Важно:** версия 0.9.112 уже в main, но файлы необходимо проверить/обновить на реальном WordPress. Browser QA не заменяет игру с реальными контроллерами.

Исторические записи и причины предыдущих исправлений ниже сохранены.

 Их наличие в журнале не означает, что они остаются открытыми задачами.

## Закрытый дефект: внешний shell / liquid-metal texture cycle (Issue #32)

- Репорт пользователя 2026-10-14: периодически меняющаяся внешняя оболочка снова перестала менять текстуры; оптимизация не должна убирать задуманное визуальное поведение жидкого металла.
- Baseline main: `c01cec1e6776b53192c15b3027e0240f3ed27a45`; WORK LOCK: [Issue #32](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/32); branch: `fix/exterior-shell-texture-cycle`.
- Root cause в main: shell использовал `allUrls.slice(0, 4)` и удалённые вызовы `randomizeBackside()` / `updateBacksideCamouflage()`; source-contract тест требовал отсутствия циклирования. Историческая рабочая реализация имеется в commit `0fc809c2597debee629fecb0c25dd4ab370d65f9`.
- В текущей ветке desktop снова использует весь набор внешних `back*.png`; touch-landscape сохраняет limit 4 и существующее уменьшение изображений. Материалы внешних панелей меняются индивидуально по таймерам около 0.8–3.0 s, с повторным stagger при появлении оболочки. Цикл исполняется только при видимой внешней оболочке. Интерьер Room 1/2, геометрия и физика не меняются.
- Mini-Sim cache version в main: 0.9.86. Статус: MERGED / TESTED-CODE. Post-merge regression run 38471956269 прошёл. Предыдущий browser smoke с тем же runtime-кодом прошёл в run 38471671934; run 38471956003 был ещё в процессе при последней сверке. Ни один из этих smoke tests не доказывает визуальную правильность текстурного цикла. VERIFIED-LIVE / USER-CONFIRMED не утверждать до установки файлов на WordPress и визуального теста.

## Проверенные факты репозитория

- WordPress shortcode симулятора — [bcm_mini_sim]; для Tower используется отдельный PHP-модуль. Three.js r128 уже встроен в Mini-Sim: не добавлять второй WebGL-контекст или CDN.
- Перенос коммита в GitHub не развёртывает плагин на walkingyog.com. После merge отдельно подтвердить фактическую cache-версию сайта.
- GitHub Actions browser QA подменяет JS/CSS выбранного коммита в сессии тестовой страницы. Это полезная проверка нового кода, но не доказательство production deploy или проверки батареи на Android.
- Mini-Sim использует реальный элемент VideoTexture для внутреннего видео. Не добавлять дублирующие видеодекодеры без необходимости.
- Warp/Tube и астероидный лабиринт остаются локальной аркадной симуляцией: сами по себе не перемещают настоящий флот в SAGE и не меняют блокчейн-состояние.

## Непереговорные требования пользователя

### Музыка

- `starbase` — soundtrack всей первой локации у ONI CSS, включая Room0 и Room1.
- `tower` — только во время уровней Tower.
- `warp` — экран Warp, труба и астероидный лабиринт. Пока отдельный трек астероидов не предоставлен, Warp OST продолжается на всём этом участке. Не придумывать новый OST и не дробить его без запроса.
- **Никогда не проигрывать два OST одновременно.** Переход зоны обязан сначала снять активность с предыдущего трека, затем включить нужный.
- Кнопка-нотка — единый глобальный переключатель музыки. В состоянии OFF все игровые OST остаются выключены; кнопка должна показывать перечёркнутую нотку/понятное состояние. Переход в другую зону не должен игнорировать mute.
- Нажатие A само по себе не должно запускать Tower OST. Проверить обработчики кнопки и состояния переходов.

### Возврат и переходы

- **USER-CONFIRMED, 2026-10-17:** возврат из астероидного лабиринта к карте текущего сектора работает. Это закрытая задача; не возвращать прежний сектор и не выполнять автоматический сброс на ONI CSS.
- Не объединять возврат к карте, возвращение домой, перезапуск текущей зоны и выключение музыки в одну операцию.
- Обычный возврат из Room0 к началу Room1 и Starbase OST считать существующей реализацией; не менять его в рамках 0.9.93 без нового воспроизводимого сбоя.
- Отмена Warp должна сохранять точку вылета и не переносить остаточный ввод/вращение.

### Управление полётом

- Поворот на gamepad должен быть существенно более отзывчивым, но без дрожания/самопроизвольного вращения.
- В коридоре вертикальное движение должно учитывать локальную систему коридора: его текущие пол и потолок, а не только мировую или стартовую ось.
- Не допускать прилипания/магнитной фиксации к полу или потолку. При смене участка не должно быть скачка осей, неконтролируемого roll или сохранённого ввода, который раскручивает корабль после Warp.
- Не менять управление открытого космоса случайным образом ради настройки коридора; тестировать отдельно коридор, астероидный лабиринт и выход в космос.

### Геометрия и материалы Room0/Room1

- Полезное изменение из прошлой итерации: текстура левой стены больше не должна случайно заменяться другой 2–3 раза. Не возвращать таймерную/случайную смену этой текстуры.
- Не менять текстуры первой локации без прямого запроса. Правая стена Room1 с её существующим MP4-поведением — отдельный намеренный случай; не переносить его на левую стену.
- Не менять геометрию комнат ради исправления текстуры.
- Не восстанавливать предложенную ранее модель внешней обшивки: пользователь отдельно уточнил, что именно ту модель возвращать не нужно. Состояние других внешних поверхностей не считать согласованным на новую переделку — сначала исследовать, что именно менялось, и ограничить патч.

## План этапов — актуально 2026-10-17

### P0 — Контекст и рабочий процесс
**Завершено.** Сверять Git историю, версии, WORK LOCK и Actions перед изменениями. Не считать старые упоминания задачи признаком того, что она всё ещё открыта.

### P1 — Возврат и soundtrack
**Функционально закрыто по пользовательскому подтверждению.** Текущий сектор возвращается корректно; не менять реализацию в мобильной ветке. Отдельные проверки исходников/тестового workflow не превращать в повторное пользовательское требование.

### P2 — Мобильное управление и загрузка
**В main, TESTED-CODE + browser smoke; физический тест Android ещё нужен.**
- Загрузка: ближайшие стены → видео правой стены → портал; soundtrack сохраняет высокий приоритет.
- Warp Tube: компактный HUD, управление наклоном телефона с перекалибровкой, умеренное осевое вращение.
- Deep Space: drag вокруг зафиксированного экрана.
- Tower: единый Pointer Events путь на современных телефонах, скрытый P2 не перехватывает экран, tilt P1 немного снижен.
- Автоматические проверки не доказывают работу прыжка и P2 на физическом телефоне; не считать их live-verified до проверки пользователем.

### P3 — Карта SAGE для Warp
**Реализовано в main через PR #85; полное покрытие галактики ограничено данными адаптера.** В меню Warp есть 2D-плоскость SAGE X/Y (−50…50), ориентиры из реального snapshot, текущий сектор, доступные по данным адаптера переходы, выбранный маршрут и масштаб 1×/2×/4×/8×.
Локальный 3×3 preview содержит все 8 направлений, включая диагонали, и явно маркируется как test-only. Слой локаций различает реализованный астероидный комплекс у ONI CSS, планеты с незавершённой привязкой запуска и категорию Deep Space.
Issue #28 остаётся открытым только для полной географии всех секторов: 8,177 — число аккаунтов, а не набор координат; отсутствующие координаты/связи не выдумывать.
### P4 — Warp / Tube
Текущая трасса длится 48 секунд, имеет несколько типов препятствий и явное подтверждение прохождения. В рамках P2 исправляются только свежие отчёты о roll/HUD/phone tilt. Не переделывать повторно геометрию кольца, навигацию или возврат без новых доказательств.

### P5 — Проверка и развёртывание
- Source regression workflows — быстрый шлюз для проверок кода. На известном неизменившемся маршруте Browser QA, который получает HTTP 403 до игрового контейнера, фиксировать BLOCKED-ENVIRONMENT, а не PASS/FAIL игры; не повторять без изменения условий доступа или альтернативного маршрута.
- Слияние исходников и проверка production — разные статусы. Зелёный CI не означает WordPress deployment или проверку на телефоне. Не обходить firewall; подтверждение live/device отмечать только после фактического теста.
## Активные и закрытые направления

- **Активно:** Issue #28 — полноценная SAGE карта.
- **Закрыто после merge PR #38:** Issue #30 (медиа-приоритеты, вращение Warp Tube и новые мобильные исправления).
- **Закрыты как выполненные:** Issue #21 (глобальный mute), #22 (переход Tower SINGLE на весь экран), #24 (возврат к карте текущего сектора), #26 (крышка H1).
- Issue #17 остаётся отдельной задачей автоматизации браузерного сценария Room0 → B → Room1 + global mute; это пробел тестового покрытия, не заявление о текущей поломке функций.
- Пользователь подтвердил, что остальные прежние функции работают; единственная крупная отсутствующая функция — полная карта SAGE.
- Историю Crew names, глобального soundtrack/mute, planetary placement, shell texture cycle и Warp collision не реализовывать заново без конкретного воспроизводимого регресса.

## Шаблон передачи следующему агенту

```text
Прочитай mini-sim/AGENTS.md и mini-sim/PROJECT_STATE.md.
Работай только над активным этапом: [ID].
Симптом/цель: [одна конкретная задача].
До изменения найди точные обработчики и перечисли файлы, которые нужны.
Не исправляй соседние этапы и не меняй согласованное поведение.
Добавь/обнови проверку, сделай минимальный патч, выполни доступные тесты.
После теста обнови PROJECT_STATE.md: результат, SHA, что проверено и что нет.
```

## PR and test tracking
- PR #60: https://github.com/ShamanOrWhitch/BCM4StarAtlas/pull/60
- CI results are pending; do not label 0.9.114 live-verified until the required Actions and a manual WordPress/device test complete.


## Текущий статус после merge PR #85 — 2026-10-27

- **Интеграция:** PR [#85](https://github.com/ShamanOrWhitch/BCM4StarAtlas/pull/85) слит в main. Merge commit: [fa88cb0ae06ab0d534994cc3df6420075db902e9](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/fa88cb0ae06ab0d534994cc3df6420075db902e9). Файлы на GitHub main проверены повторным чтением; WordPress не развёрнут.
- **Карта:** настоящая координатная плоскость SAGE, известные snapshot-звёзды и три CSS, текущая позиция, доступные переходы из навигационного адаптера, выбранный маршрут, zoom 1×/2×/4×/8×. Секторный preview содержит все восемь направлений. Location layer объединяет и дедуплицирует поддерживаемые массивы адаптера; ONI asteroid complex помечен реализованным, Akenat/Pearce/Ioki требуют привязки запуска, Deep Space показан отдельным типом. Полная отрисовка всех 8,177 секторов возможна только после получения фактических координат.
- **Остальные изменения PR #85:** Ring crystal progress guard, возврат к цели перед завершением лабиринта, исправления Warp-меню и pointer lock, Room 2 passage, разгон Warp до 12× с 22 слоями препятствий и обратный поток Class II. Tower physics не менялась.
- **TESTED-CODE:** 9/9 source regression workflows PASS на PR code head [4e4841a912377856a274eb089e9965e7e6c79996](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/4e4841a912377856a274eb089e9965e7e6c79996). Результаты: [Warp visual tiers](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40488604832), [Warp maze return](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40488604529), [Mini-Sim regression](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40488604765), [UI layer](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40488604772).
- **BLOCKED-ENVIRONMENT, не browser PASS:** [browser run 40488604679](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40488604679) получил HTTP 403 и не обнаружил .bcm-mini-sim. Это недоступность страницы для данного runner, а не проверка поведения игры. Известный тот же путь повторно не запускать без изменения условий доступа; firewall не обходить.
- **Не VERIFIED-LIVE:** нет подтверждения WordPress deployment, визуальной проверки на реальном production-браузере или ручного теста на телефоне/геймпаде. Эти статусы не назначаются автоматически по результатам CI и не требуют повторять тот же заблокированный маршрут.

### Протокол отсечения ложных путей
1. До теста определить, какой факт он должен подтвердить и что будет достаточным результатом.
2. После детерминированного HTTP 403 на том же URL не повторять идентичный browser smoke. Продолжать через source, локальные контракты и CI; повторять remote QA только при изменении доступа или тестового маршрута.
3. После 404 NOT_FOUND проверить имя владельца/repository, branch и path один раз; исправить найденную опечатку вместо перебора внешних путей.
4. При таймауте пометить TIMEOUT, записать, что именно не завершилось, и перейти к следующей независимой проверке. Не ждать рецензента/агента сверх рабочего лимита; ставить SKIPPED/TIMEOUT, а не PASS.
5. Не завершать работу только передачей задачи в новый чат. Перед handoff зафиксировать фактические изменения, проверки, блокеры и следующий конкретный шаг.
6. Разделять IMPLEMENTED, TESTED-CODE, BLOCKED-ENVIRONMENT, VERIFIED-LIVE и USER-CONFIRMED. Source CI не доказывает production deployment или проверку на физическом устройстве.


## 2026-11-02 — свежая библиотека Twinsun и follow-up Warp / asteroid

### Новые пользовательские ассеты (только библиотека прототипов)
- Upload commit [8104ec2](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/8104ec2fbfb2317493d776704f791768778d47ca) добавил три статичных character blockout в `mini-sim/assets/mesh/twinsun_characters_test/`: `spherical_robot_blockout.glb` (1,360 tris / 17 parts), `hooded_traveller_blockout.glb` (1,036 / 12), `one_eye_robot_blockout.glb` (512 / 14). Итого 2,908 tris / 43 parts. Нет skeleton/skin/animation, UV/textures, colliders или игровых настроек.
- `twinsun_pack02/`: восемь прототипов — грибы (teal/violet), сундук, пьедестал кристаллов, кнопка, монета, рунический камень, синее зелье; 4,930 tris суммарно. Части отдельные; крышка и кнопка без анимации/шарниров.
- `twinsun_pack03/`: семнадцать пропов — ключ, рычаг, нажимная плита, парящий травяной остров, сфера, забор, скамья, фонарь, растение в горшке, папоротник, кувшинки, коралл, дерево, жаровня, светящийся бутон, мост, раковина; 5,382 tris суммарно. Y-up, vertex colors; без UV/textures, animation или collisions.
- Отдельный upload [011b843](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/011b84324db4d27a44beb76b6b6b0a2b68cdead0) добавил `twinsun_crystal.glb/.obj` для планетного камня. Предыдущий [pack01](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/ba623558525a7f5cbe9a21cbcc2e640ab898ce89) содержит отдельные скальные и кристаллические детали.
- **Решение:** перечисленные наборы пока являются test/prototype asset library для будущих планетарных поверхностей. Не размещать эти пропы и blockout-персонажей в астероидном коридоре. До массового размещения проверить импорт в Three.js r128, материалы/оси, draw calls, оптимизацию, анимацию и коллизии по конкретному gameplay-сценарию.

### Выполнено — Issue #95 (2026-11-02)
- Work branch: `fix/warp-original-frame-flow-map-labels-crystal-visibility`; baseline main после upload: `8104ec2fbfb2317493d776704f791768778d47ca`. Issue [#95](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/95).
- Warp: направленный поток переводится на существующие 12 продольных линий обрамления через движущийся цветовой импульс в градиенте той же линии, без второго штриха или слоя; Class II разворачивает направление. Отдельные 14 поперечных flow bands удалены. Course, obstacle progress и collisions не меняются.
- Карта: видимые названия MUD / ONI / Ustur очищены от суффикса CSS; координаты, reference IDs и nav adapter остаются прежними.
- Asteroid: декоративные wall deposits увеличены до scale 0.60–0.67, количество — до 12; сначала используются eligible панели основного маршрута, при нехватке — другие eligible вертикальные панели на любых высотах. Отдельный RNG; collision wall list / topology / Hydrogen / flight physics не меняются.
- Версия в `main`: Mini-Sim 0.11.23; Tower остаётся 0.2.67 без изменений.
- **Статус:** PR #95 merged, squash commit `2bdc86b60bb1e464a4c136347e64b5373a7e901d`; issue #95 закрыт. Source CI — 9/9 PASS; standalone Chromium — 20/20 PASS (run `41444615060`, tested code SHA `c04a634eeb51698b7a92fc5dde2ddb110e308e78`). В сцене — 12 GLB deposits, 108 mesh objects, 9,432 triangles, 4 authored colours; scale 0.60–0.67, размещение по первым 13 route cells на разных высотах. В обычном ship POV видны минералы; console/page errors и локальных HTTP ошибок нет. Live WordPress browser QA `41444792311` — **BLOCKED-ENVIRONMENT**: `https://walkingyog.com/bcm4sa/` вернул HTTP 403 до появления `.bcm-mini-sim`; firewall не менялся, production не развёрнут. Это не VERIFIED-LIVE и не USER-CONFIRMED.


## Direct-main update — vehicle ground / flight behavior (12 November 2026)

- Mini-Sim version `0.12.11`. First Planet has an explicit vehicle mode toggle: **T / on-screen button = Ground or Flight**. Ground mode follows sampled terrain height, blocks entry into water, and disables vertical controls. Flight mode enables Space/Q lift and descent; switching back to Ground starts a gravity-driven landing rather than teleporting to the surface.
- Max Hog uses the four existing GLB wheel-pod pivots and four flame nodes. Ground mode hides blue flames and spins tire / hub / tread meshes; flight mode directs each pod's exhaust downward for lift / hover or backward for forward thrust. No new mesh assets or glTF animations were added.
- Space first-person remains the default. F8 temporarily switches the ordinary ship renderer to a rear test camera; Ring's custom camera renderer is not overridden. The setting is runtime-only and starts off each load.
- Removed generic numeric sliders and independent engine / shader switches from the five medium demo panels. Discrete ship modes and cargo / ramp actions remain. Space demo thruster intensity follows actual ship velocity, except pad / load modes. Rainbow camouflage and its sliders are unchanged.
- Source-only change. CI and live WordPress / device playtesting must be recorded separately; no website deployment is implied.



## Direct-main update — shared Max Hog, tape inventory, TV audio focus and ship transfer (12 November 2026)

- Mini-Sim version `0.12.12`. Max Hog's shared `maxhog_controls.js` now drives the same four thruster/wheel pods in space and First Planet. Island ground/flight physics supply ground speed and the forward/vertical motion vector to that shared controller; it is no longer a duplicate scene-only animation.
- Space ship controller attachment uses deterministic sidecar factory names and cached script-load promises, so a controller is reattached after a ship change even when its script was loaded earlier. Ship transfer preserves the currently active hull as a parked world object at the exact exit position and orientation before mounting the destination ship.
- TV proximity is calculated from the character/vehicle position with a wider smooth falloff. A dedicated fullscreen audio-focus event mutes island/race ambience while the tape is in fullscreen and restores it on close or Escape.
- Cassette inventory is saved in localStorage schema v2. The chest grants `Invaders 10`; old saves with an already-open chest receive the new tape during migration. The player can select any owned tape near the TV. The original ground cassette remains a pickup.
- CI and source checks are added for shared Max Hog controls, ship transfer, cassette migration, and exclusive TV audio. Site deployment and hands-on browser testing remain separate; the site's 403 response to external GitHub runners is not treated as a gameplay verdict.


## Retired — live WordPress browser QA (12 November 2026)

- **User direction:** remove the automated browser test that opens `https://walkingyog.com/bcm4sa/`; the site's anti-bot protection blocks automated requests and causes long, irrelevant waits.
- **IMPLEMENTED on branch** `chore/disable-live-wordpress-minisim-qa-20261112`: `.github/workflows/minisim-browser-qa.yml` has no event triggers (`on: []`) and its job is additionally guarded by `if: false`. It no longer installs Chromium, fetches the live page, or gates Mini-Sim pushes / pull requests.
- Keep source/regression checks and `minisim-standalone-browser-qa.yml`: that standalone browser run uses a local HTTP fixture and repository assets, not the public WordPress site. Do not change the shared Playwright runner used by that local workflow.
- WORK LOCK #17 (remote website QA) is retired at the user's request. No firewall bypass or further live-site probe is authorized. This change itself did not request `/bcm4sa`.
- Status: **IMPLEMENTED on branch**; CI/merge status is recorded in the pull request. No live gameplay result is claimed.


## 15 November 2026 — First Planet standalone directory

- **IMPLEMENTED on main:** [`2ada830`](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/2ada830da0e9eeeb25ed418d137e75db13e22376).
- First Planet now has one canonical owner directory: `mini-sim/first-planet/`. The former `mini-sim/tower/first-planet/` and `mini-sim/assets/first-planet/` locations are removed.
- Moved the First Planet app, WordPress bundle, loader, 29 original GLBs, desert/coastal scenery libraries, `FP.mp3` and `desertrace.mp3` into that directory.
- Tower remains in `mini-sim/tower/`; it now loads the First Planet loader/bundle from the independent folder and keeps only Tower-specific assets.
- Shared ship/Crew models and `assets/mesh/ships/catalog.json` intentionally remain in the common `mini-sim/assets/mesh/` library.
- Updated WordPress URLs, Vite recursive mesh serving/build output, package workflow and local transition regression paths.
- **Verification at documentation time:** GitHub Actions for Mini-Sim regression (#43648203311), Tower top-cap (#43648203342), standalone Chromium (#43648203304) and package build (#43648203293) were still running. Do not mark TESTED-CODE or VERIFIED-LIVE until final results are read.


## First Planet relocation — verification update (15 November 2026)

- Follow-up test/QA adjustments landed on main: `bedfb946`, `5a2b9ed`, `a785b913`; ship-path encoding correction: `7d0bb64`.
- **TESTED-CODE:** Mini-Sim regression PASS [run #43648574782](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43648574782); Tower top-cap regression PASS [run #43648574834](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43648574834), both on head `7d0bb64`.
- **First Planet package:** bundle dependency install, WordPress build, JS/CSS verification and single-level package-content verification all PASS in [run #43648574879](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43648574879); artifact upload was still in progress at this note.
- **Standalone Chromium:** source assertions PASS in [run #43648574823](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/43648574823); real browser smoke and Tower → First Planet → Tower cycle were still in progress.
- No WordPress production deployment or live website verification is claimed.


## 17 November 2026 — Warp bridge and independent asteroid-maze location (WORK LOCK #131)

- Baseline `main` `a4bf459659555b33ab5c0852f811fbd518cd36cc`, Mini-Sim `0.15.9`.
- Split scope: separate Warp transit, route bridge and seeded asteroid-maze location. Preserve the tube, controls, route navigation, volume field manager (`warp-sector-core.js` / `warp-sector-scene.js`) and Ring gameplay.
- `warp-bridge.js` maintains separate `destination` (SAGE node X/Y only) and `currentLocation` (committed local place). Menu hover is read-only; explicit selection sets destination; only successful arrival commits the asteroid place. Clearing the next destination does not clear the current asteroid location.
- `asteroid-maze-location.js` owns the existing seeded 7×3×7 maze build/update/disposal, wall GLB assets, crystals, Hydrogen events and chart publishing. The existing generator and collision behavior are moved, not redesigned.
- `deep-space-warp.js` keeps the menu, tube, controls, course and Ring activity and calls the location through an adapter. `BCMiniSimAPI.setPlace/getPlace` stays compatible. Existing BUG-004 place gate is unchanged.
- Mini-Sim cache version is raised to `0.15.10` so WordPress/browser caches request the extracted modules.
- Verification at source commit: syntax and static extraction checks performed by writer; GitHub Actions source and standalone Chromium results are recorded separately. No live WordPress deployment or physical-device verification is implied.


## 17 November 2026 — WORK LOCK #131 verification complete, Mini-Sim 0.15.10

- **Code refactor:** `2b3eee78463b1308b168ef4ba9e19f64406e60f7`. **Final QA head:** `6443827c239b231af8d1f4c83e3dd8ce79de5250`.
- `deep-space-warp.js` is reduced from 9,371 to 8,431 lines. The Warp menu/tube remains in that controller; the seeded 7×3×7 asteroid-maze construction, GLB wall assets, collision/update, crystal/Hydrogen chart and disposal live in `asteroid-maze-location.js`. `warp-bridge.js` keeps selected SAGE destination X/Y separate from committed in-world `currentLocation`.
- **Mini-Sim regression:** PASS, 213/213 — [Actions #44038525359](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/44038525359).
- **Tower source-contract:** PASS, 34/34 — [Actions #44038525312](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/44038525312).
- **Standalone Chromium:** PASS — [Actions #44038525455](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/44038525455). Source assertions 65/65; rendered Warp/asteroid smoke PASS; Tower → First Planet → same-seed ascent → return-state cycle PASS. No plugin HTTP errors, failed requests or uncaught page errors.
- The standalone browser smoke explicitly checks: confirmed sector selection writes `destination`; cancellation before arrival clears the pending destination without inventing a place; Asteroid entry commits `currentLocation` and the existing `BCMiniSimAPI.getPlace()`; returning to the Warp map clears the next destination while preserving the Asteroid location.
- **Package verification:** PASS in [Actions #44001852425](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/44001852425) on `2740b8aea344f82fa8ecf222644e6e4c8fc7edcb`. The runtime/PHP/package files were unchanged between that package-tested SHA and final QA head; subsequent commits only adjusted regression and browser tests.
- **Test boundary:** the browser fixture exercises map selection, Tube entry/cancel, the real Asteroid module entry, scene assets and return-to-map state. It does not claim a successful full-duration Tube arrival; the bridge's successful `commitArrival` contract is covered by the Node unit test.
- **Not VERIFIED-LIVE:** no production WordPress deployment, live-site browser QA, phone or physical gamepad test. The live site remains a separate owner-confirmed state; this GitHub `0.15.10` change does not silently update it.
