## D-035 — Mini-Sim 0.11.14: finite room boundaries and asteroid Warp continuation

**Status:** Candidate branch `fix/minisim-0.11.14-space-boundaries-asteroid-warp`; source-level regression cases added; CI pending. Not merged or deployed. Based on main `dd82b03a0cdbe232d2a02fa54ef5ece5d630d913` and preserves the accepted 0.11.13 Warp-depth/collision/Ring work.

- Corridor walls and caps collide only at real finite surfaces; X/Y planes no longer extend through unbounded open space. Room 1 recovery needs both Z overlap and proximity to the room cross-section.
- Keep actual Room 1/Room 2 collision boundaries and Room 2's normal rear exit.
- The asteroid-to-map action stores the current live position and full quaternion, never sends the ship to the pre-Warp launch position, and V opens the next-destination map while in normal asteroid flight.
- Ring platformer/transition/Hull interior are excluded from the V handler to avoid stealing controls.
- Do not touch `wordpress/galia-desk`, scanner, pricing, Tower or shared assets. Browser QA blocked at HTTP 403 before game UI; no visual PASS inference.

---

## D-034 — Mini-Sim 0.11.13: restore Warp depth staging and real room collision

**Status:** candidate on `fix/minisim-0.11.13-warp-depth-room-collision-ring-entry`, based on main `ab7c3d91c9932d3363375036bb07bbcbd6ad67ad`. Tests pending; not deployed.

- Restore Warp's visible obstacle window to the known-good 0.11.8 value (0.36 instead of 0.68) and the previous reciprocal near-field projection; keep decorative circumferential rings and chevrons removed. HUD speed uses the actual `speed` calculated by `updateTube`.
- Fix Room 1/2 collision by passing the ship's frame-start position to `collide`. Compare collision corrections against a separate post-integration position.
- Preserve the asteroid collision callback through transient exceptions. Ring entry exceptions recover the ship, clean partial Ring overlays, display a retry prompt, and prevent repeated automatic retries.
- Further enlarge Panda.
- Browser tests can reach only HTTP 403 on the live page, before `.bcm-mini-sim`; no visual/device pass or production deployment is claimed.

## Historical D-033 — Mini-Sim 0.11.12: restore sane Warp speed display and unblock collisions / Ring entry

**Status:** repair candidate on `fix/minisim-0.11.12-warp-speed-collision-ring`, based on main `9caba968636610a2413a23177bd9d64f20fe0900`. Tests pending at authoring time; not deployed.

- Correct the Warp multiplier from the contradictory 8×→64× formula to the intended 1×→8× ramp and show it beside time/steering angle.
- Put `V — карта Warp` in the flight prompt shown before opening the map; enlarge and right-align Panda's single dialogue; keep the avatar visible at 44px and message at 15px on small phones.
- If asteroid collision starts within a ship-expanded wall AABB, resolve toward its nearest face rather than discarding the collision because entry time is zero. Keep the existing sweep and slow-contact resolver.
- Disarm Ring entry only after `runtime.ship`, `runtime.THREE`, and `runtime.scene` validate; a failed attempt must not hide the entry until the ship moves away.
- Live browser test still returns HTTP 403 before the game container; no live visual pass or deployment is claimed.

## D-032 — Mini-Sim 0.11.11: visible Warp hazards and one Panda controls bubble

**Status:** IMPLEMENTED / **TESTED-CODE PASS** on `dbca3b10bbd5f8598a914527bfe481a38cf59a87`; PR #71 was merged to main, but the files were not deployed to live WordPress. Mini-Sim regression, UI layer, Warp visual tiers, Warp course/portal, Warp maze return, Ring controls, Hull RU/EN and Tower top-cap CI checks passed. Candidate browser QA [run 40198934895](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40198934895) finished **FAILED/BLOCKED**: HTTP 403 on the target page and timeout waiting for `.bcm-mini-sim`, so the runner never reached the game UI. Do not bypass the firewall or label this a visual code failure. Live visual/device behavior remains unverified.

- User reopened Warp after 0.11.10: several obstacles were visually missing, strips read as vertical, and Class II had distracting secondary rails. Compared with the previous renderer, gate obstacles had been reduced to two guide-lines and the base strip count had grown from 12 to 24.
- The candidate restores segmented high-contrast gates while preserving the safe-angle gap, clear sweeper bars and inward-pointing spike teeth; returns to 12 depth-skewed longitudinal strips and removes extra Class II rails/pulse dots. Decorative circumferential wall hoops and chevrons remain removed.
- Only drawing geometry/visibility changes. `updateTube` hit logic, speed ramp/64x cap, shimmer clock, OST, route and Tower physics remain unchanged.
- The separate right-side controls dialog is removed; flight and Warp guidance is shown in the wider Panda operator bubble, whose face remains visible at 420px. Flight copy includes WASD/U/mouse-middle-click/gamepad sticks; Warp copy includes V/gamepad Y and tunnel steering.
- WORK LOCK: [Issue #70](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/70). Baseline main SHA `bc77614564aa7bf1f2a211c945006fc258d6aeff`. The most recent repeat of remote browser QA still receives HTTP 403 before the game container; do not bypass the firewall and do not call that a visual test. Galia Desk and pricing/scanner files stay untouched.

## D-031 — Mini-Sim 0.11.5: snapshot before Tower freezes flight

**Status:** candidate source contract; city/return implementation still pending.

- Save the incoming ship pose, quaternion, velocity, angular velocity, navigation metadata and mission-session seed just before the Tower handoff zeroes velocity and disposes the Mini-Sim scene.
- Every built Tower stores its active seed on the same session mission object; city exit must rebuild that exact seed, not call makeSeed().
- The current patch records data for a future resume path; it does not yet restore flight or add the city. Tower cache/version is bumped to 0.2.65.

## D-030 — Mini-Sim 0.11.5: explicit camera focus is a playback lease

**Status:** candidate, source tests added.

- F/X focus selects one video target. A selected exterior screen remains the nearest/playback owner while within its active radius; an explicitly focused interior panel/live wall is not cancelled just because no exterior video is nearest.
- Clear focus when the selected target becomes unavailable or leaves its own radius. Don't let another nearby video steal focus.
- The mission HUD exposes visited screen progress and switches to Hydrogen objective/completion text.

## D-029 — Mini-Sim 0.11.5: deterministic astral movement rules

**Status:** candidate on minisim-0.11.5-astral-phase; CI and visual play pending.

- For each Y-layer cell, derive astralMode and phase from the existing asteroid seed plus cell coordinates. Never consume the route/crystal RNG stream for decoration/physics. Same seed => same cell graph and same anomaly pattern.
- Drift = low gravity; Flux = bounded gravity oscillation that remains downward; Dense = heavier gravity and a different jump impulse. Existing cell walls, texture indices, quarter-turns, doors and crystal locations remain untouched.
- The minimap uses distinct colors/glyphs and the HUD names the active rule, so unusual movement is legible rather than random/opaque.
- Next: validate feel in browser/device after normal site access is possible, then design more anomalous interactions (issue #68). The Tower city and same-seed trip back to the arriving ship remain a separate lifecycle task (#67).
- Keep wordpress/galia-desk locked; no generated textures.

## D-028 — Mini-Sim 0.11.4: screen-discovery quest and first-cell Hydrogen

**Status:** candidate on `minisim-0.11.4-hydrogen-mission`; requires CI review and live play.

- Register only configured screens, count the first successful playback once, and unlock the Hydrogen objective only when all required screens have been visited.
- Hydrogen lives in Ring's first small cell, using the same existing `maze.startCell` and texture/topology map; it does not introduce a duplicate maze or image assets.
- The 2.5D cell shows a pickup and H map marker when unlocked; collecting it fires `bcm:mission:hydrogen-collected` and triggers operator feedback.
- Keep `bearhead.mp4` optional until the user uploads it.
- City below Tower / return to original ship stays out of this patch. Tower handoff calls Mini-Sim scene disposal; same-seed return needs a deliberate park/resume or save/rebuild contract before adding city portals.

## D-027 — Mini-Sim 0.11.3: per-cell textures, safe ONICSS fallback, common Crew facing

**Status:** candidate on `minisim-0.11.3-ring-texture-focus`; tests and visual review pending.

- Each physical asteroid wall retains the cell that created it. Seed-derived `wallAsset` and `wallTurn` select a batched material variant for 3D walls; the 2.5D Ring path uses the same cell data. Keep the topology/crystal RNG stream separate from decorative wall selection.
- Non-Mierese cut-outs get the requested facing correction in the shared core; Mierese remains unchanged. Do not clone the walk/fall animation table per game mode.
- ONICSS plane keeps `OniStation.png` until `onicss.mp4` actually starts; loading honors the configured preload radius, while only the nearest eligible zone plays. X releases active camera focus only when no modal gameplay overlay owns input.
- The operator dialog uses `bearhead.mp4` only if it exists in the recursive Assets list and gracefully keeps the glyph otherwise.
- Not in this patch: Hydrogen/visited-screen quest, astral dimension interactions, city below Tower and deterministic same-seed return trip. Those require separate world-state contracts so the same cell/tower seeds persist between representations.

## D-026 — Mini-Sim 0.11.2: one helm, one crew core

**Status:** the live base.

- Helm mouse and keyboard stay one control while the hold mini-game is open. Do not crop the flight view to make room for the hold; use the instrument cluster.
- Crew facing, race motion, walk and fall go through `window.BCMCrewCore`. Do not copy that table into the next level.
- Warp class I is the readable default. Classes II and III are alternates, not a stack. Do not decorate the tunnel with stripe fans.
- The asteroid generator stays. Corridors may be roomier than the rock, and extra rocks may differ in size.

## D-025 — Mini-Sim 0.11.1: helm on X, asteroid chart, paired hands

**Status:** the live base. Keeps D-024's Room 1 start. Overrides only the hold helm key.

- Helm engage/leave inside the hold is X. V stays Warp and is not swallowed by the hold. U / R3 still opens the hold. Hold buttons are icons.
- Desktop flight keys apply only while the pointer is locked, so mouse and keyboard are one two-handed control. Touch and a live gamepad are unchanged.
- Ring path cells come from the asteroid seed, with that cell's wall texture and quarter-turn. The pig/ring side-scroller is the exit cell only. Scouted crystals are marks on the 2D chart. Y-layer rooms are astral, not a fake third axis. Mobs enter from open sides and respawn after 240000 ms.
- Exterior crew sprites use `window.BCMCrewCutout`, the same cutout cache as the hold and the tower.

## D-024 — Mini-Sim 0.11.0: Room 1 start on the 0.9.113 mechanics

**Status:** kept for the Room 1 start. Helm key inside the hold is superseded by D-025.

- Keep Grok's 0.9.113 hold, helm and Ring-menu fixes.
- Flight begins in Room 1 at `(0, 0, 2)`. Do not auto-enter the asteroid; that start fails the first-location test because some objects come from the site.
- Outside the hold, V opens Warp and U opens the hold. Inside the hold, X leaves or retakes the helm (was V in 0.11.0).
- Draw platformer crew with the existing background-cutout helper. Do not invent a second chibi pipeline.
- 0.9.114's Ring rewrite is not the base.

## D-023 — Mini-Sim 0.9.114: Ring uses the existing maze

**Status:** superseded by D-024. Not the running game. Manual play of that line failed.

- Reuse the active maze graph, seed, entry/exit and the same three crystals in the cutaway view. Do not replace it with a linear arena, comic panels or mandatory boss gates.
- Clone materials from the active maze so its original asteroid-wall texture maps are reused. Do not dispose shared maps when the Ring session closes.
- Goal: collect three crystals and return to the entry. Minor mobs are optional hazards and targets, never gates to completion.
- Gamepad X/button 2 fires; Y/button 3 is not fire. Back/Select exits Ring or returns home outside overlays. B stays available for local in-level/Hull Dive actions, while global navigation callbacks are suppressed when Ring/Hull Dive owns input.
- Opening Hull Dive releases Pointer Lock so the mouse can interact with cabin controls; exterior flight is not paused. Manual device QA remains outstanding.

## D-022 — Mini-Sim 0.9.112: reliable Ring entry, UI hit-testing and live pilot view

**Status:** merged in PR [#57](https://github.com/ShamanOrWhitch/BCM4StarAtlas/pull/57). Main merge SHA 443cd4f1cd388d020f1811908f1d31ad53809334; Mini-Sim 0.9.112 / Tower 0.2.64.

- Fixed the Hull Dive render gate so the outside-space scene continues drawing behind the inset while the compartment simulation owns input.
- Hull Dive begins with Crew 1 at the active pilot helm. A single gamepad is assigned to P2 so keyboard P1 remains usable; two controllers are assigned separately in stable index order.
- The lower-right inset is slightly enlarged and remains responsive on small viewports.
- Attached the ship-interior button to document.body so its z-index is not trapped in the Mini-Sim stacking context. Added an explicit high-layer Ring entry button near the beacon. Mouse/touch and gamepad A can start Ring; keyboard arrows + Enter/Space select SINGLE/MULTI.
- Raised Ring overlay hit-test priority, removed the duplicate root append, and added a 15-second media watchdog for stalled Ring transitions.
- Added mini-sim/assets/js/ui-layer-audit.js: Ctrl+Alt+U scans visible controls using elementFromPoint, reports full/partial occlusion and names the blocking element. This validates hit-testing, not the semantic outcome of every click.
- Asset/cache version and PHP fallback title are synchronized to 0.9.112.
- CI PASS: Mini-Sim regression [39602967437](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39602967437), Ring menu [39602967350](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39602967350), UI layer [39602967364](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39602967364), Hull RU/EN [39602967454](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39602967454), Warp visuals [39602967418](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39602967418), Warp return [39602967560](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39602967560), browser smoke [39602967382](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39602967382).
- CI/browser smoke is not physical Android/gamepad verification and does not deploy files to production WordPress.
- No changes to Galia Desk, scanner, marketplace/pricing, planet placement, SAGE adapter, global OST mixer or Tower physics.
- PRs #14/#18 remain open but are not mergeable with the latest main; do not merge those stale branches wholesale. Reconcile only independently useful diff on current main.

---
## D-021 — Mini-Sim 0.9.111: complete bilingual Hull Dive UI

**Status:** merged in PR [#55](https://github.com/ShamanOrWhitch/BCM4StarAtlas/pull/55). Main SHA `51553e78bec6c7ecfb20cc69610c89d9225222c7`, Mini-Sim 0.9.111 / Tower 0.2.64. Hull RU/EN source test [PASS](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39567055354), Mini-Sim regression [PASS](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39567055498), UI/weapons/cabin [PASS](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39567055331), Warp tier [PASS](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39567055312), Tower top cap [PASS](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39567055392), browser smoke [PASS](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39567055334). Video-enabled QA step was skipped; no physical Android/gamepad or production deployment claim.

- The inset Hull Dive derives language from `window.BCMDialogue.language` and localizes its fixed labels, controls, texture-rendered station captions, telemetry, and repair/ammo/oxygen status. Cache version is bumped to 0.9.111.
- Preserves the lower-right inset, top pilot view and bounded particle pools; no new renderer or per-frame particle allocation.
- No changes to Galia Desk, scanner, marketplace/pricing, planet placement, navigation adapter or global OST mixer.

---

## D-020 — Mini-Sim 0.9.110 dialogs/weapons/inset cabin and network room prototype

**Status:** merged. Main SHA 9b4e7b8a2fe842de9418772c33499b63a79c1e18, Mini-Sim 0.9.110 / Tower 0.2.64. PR [#51](https://github.com/ShamanOrWhitch/BCM4StarAtlas/pull/51); source/UI suite [PASS](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39565526244), Warp tier [PASS](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39565526252), Mini-Sim regression [PASS](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39565685006), Tower top cap [PASS](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39565684968), browser smoke on the code-identical PR assets [PASS](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39565526302). These checks are not a physical Android/controller playtest or a production WordPress deployment.

- Enter toggles RU/EN in the start menu. Two body-level translucent dialog bubbles own operator text and controls by device/level so the main HUD's permanent instructional copy can be hidden.
- Crew cards display larger complete portrait thumbnails. Hull Dive opens in the lower-right as a compact inset while the main pilot canvas uses the upper region. Smoke/bubble pools are bounded and more visible with rising hazard levels; breach/energy colors are cool sci-fi cyan/blue rather than fire-like graphics.
- Ring weapon profiles: laser pointer (thin and fast), pulse (thicker/heavier), spectrum (cycles colors). Master offers the initial choice after the first defeated boss; an upgrade test is offered after two successful completed runs between offers. This is a prototype for player balance feedback. Progress is only stored in tab memory, not across reloads.
- Ring split screen is top/bottom (P1 above, P2 below) after players separate sufficiently. Local multiplayer remains independent of the remote network prototype.
- Asset-cache version is 0.9.110 to avoid stale 0.9.109 script URLs.
- Long QA jobs have increased limits: browser job 45 min; media/load steps 20–25 min; regression jobs 25–30 min; Playwright navigation wait 60 s.
- PR #52 merged the bounded in-memory SimRoomRegistry and network design. It does not add a WebSocket endpoint, authentication, scheduled authoritative ticking, RTT exchange or persistent reconnect. Keep Issue #48 open for the next phase; don't label network mode available yet.
- Strict exclusion maintained: no galia-desk, scanner, pricing/marketplace/shared assets, planet placement, SAGE adapter or global OST mixer changes.

---

## D-019 — fix Crew/gamepad controls, preserve return anchors and enrich Warp/repair feedback

**Статус:** committed directly to main; current syntax/source-contract/regression checks passed on `1a4f78f3`: [Mini-Sim regression](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39329898587), [Tower regression](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39329898516). Browser smoke passed on code commit `8d602f3c`: [browser smoke](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39329892540). Physical gamepad/Android and production site testing are still pending. Mini-Sim 0.9.102 / Tower 0.2.62. WORK LOCK [Issue #43](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/43).

- Hull Dive starts in visibly controllable Crew-movement mode so the gamepad left stick moves a character. LB/V switches to helm controls. Cached Crew art is decoded through the same image-to-canvas path as fresh cut-outs and uses explicit `flipY` normalization.
- The current interior leak loop now also has per-compartment smoke/fire levels, bounded smoke particles and a pulsing fire indicator. E pumps water and extinguishes. `window.BCMHullRepairState` stores per-compartment integrity, external-hole, water, smoke and fire values; external impact opens a hole at zero integrity and the patch hook clears it while restoring integrity to 10. A proper exterior EVA scene is not yet implemented.
- Warp keeps the 8×→64× course speed. Tube geometry advances 12% faster while a separate shimmer clock preserves its old rate. Hazard progress uses a 0.86 power curve; layer count increases from 15 to 22, each run gets a fresh seed, adjacent safe lanes are limited to 1.18 radians and gamepad steer rate rises to 2.2.
- Keep the original launch pose distinct from the asteroid-comeback cancellation anchor. On cancellation, restore the launch sector while preserving the ship's physical asteroid-zone anchor, and do so before unpausing physics. Each newly started Tube run snapshots a fresh sector and pose. Browser smoke is passed, but production and physical-controller behavior remain unverified.
- Strict exclusion: do not edit `galia-desk`, scanner, price tables, marketplace price data, or their shared PHP/assets. No changes to planet placement, navigation adapter, global OST, Tower mechanics, or Crew segmentation model in this lock.

---

## D-018 — isolate Hull Dive input, preserve asteroid return, accelerate Warp and add Tower boosts

**Статус: committed directly to main; JavaScript syntax, source-contract and Mini-Sim regression passed on `8ee3a76a` (runs [39228505118](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39228505118), [39228505182](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39228505182)). Browser/phone tests and deploy not yet performed.** Mini-Sim 0.9.101 / Tower 0.2.62.

- Hull Dive captures keyboard input across keyboard layouts via physical key codes; the global Mini-Sim handler returns while the Hull Dive overlay is open, so V does not also toggle Warp. Lost focus clears held controls; Warp pause and teleport also clear remembered keyboard, touch and stale gamepad-axis input. Hull Dive finish explicitly releases the browser pointer lock, including Escape close. Leaving pilot mode remains possible if the Crew sprite drifts away from the helm.
- Entering the asteroid ring resets ship pitch/roll and angular momentum. Returning to the Warp map saves the current asteroid position and a yaw-only orientation before disposing the maze, so subsequent cancellation restores that location instead of the old Room 1 launch point.
- Warp travel starts at 8× and accelerates to 64× over the same 42-second course. Course progress is normalized to that new range. Tunnel shimmer/sweeper timing calculations are unchanged.
- Tower platform width is 3.23, reducing platform width by about 3.5% while retaining the expanded foot-contact reach. Generated optional side-platform crates grant JET (stronger second jump plus twin jet flames), SHIELD (restore protection), or SPRING (stronger next ground jump). Lids display the corresponding symbol and label.
- Mini-Sim cache/version: 0.9.101; Tower: 0.2.62. Source contracts were updated. Do not claim browser QA, phone controls, or WordPress deployment without a real run.

---

## D-017 — use every asteroid wall texture and improve Tower foothold

**Статус: committed directly to main; automated CI for these latest commits not confirmed.** Mini-Sim 0.9.97 / Tower 0.2.60.

- Remove the four-texture cap for asteroid walls. Use every image asset matching `asterwall*` in the manifest; shuffle the full pool per generated maze and distribute wall batches among all loaded textures. Keep the procedural fallback for missing/failed texture files.
- Tower bird count increases from 36 to 38, exactly two additional birds.
- Increase platform box width from 2.65 to 3.35 and radial depth from 1.65 to 1.9. Neighboring same-level platform edges overlap slightly, reducing visual/physical gaps.
- Surface landing uses `atan2(platformHalfWidth + footContactReach, surfaceRadius)` rather than the body-center-only fixed angular threshold. Expand radial contact tolerance from 0.72 to 0.88 so a near foot may still make contact at an edge.
- Update source-contract tests and cache-version assertions. This is not yet manually verified on a real phone or deployed WordPress site.
- Keep the established Warp/sector return paths, audio, Hull Dive, and planet placement unchanged.

---

## D-016 — slower ship launch, 1×→8× Warp ramp, Tower Crew art and Hull Dive stations

**Статус: MERGED / TESTED-CODE.** Squash merge [e6e39a60](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/e6e39a60da7063e7bd43423e89395bbf31924171), PR [#42](https://github.com/ShamanOrWhitch/BCM4StarAtlas/pull/42), [WORK LOCK Issue #41](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/41). Mini-Sim 0.9.96 / Tower 0.2.59. All five PR workflows succeeded.

- Ship thrust/top speed lowered in all three modes; Room 0 still temporarily selects mode 3 and restores the previous setting.
- Warp Tube accelerates exponentially from 1× to 8× across 42 seconds. Course progress and obstacle progression use the same normalized curve; boost is capped by 8×.
- Hull Dive uses selected Crew art from `BCMMiniCrewSelection`, the Tower `bcm-tower-crew-cutouts-v8` browser cache and the Star Atlas official cut-out URL convention. ISNet segmentation is used only when no alpha/cached cut-out exists; selected Crew is not replaced with hand-drawn avatars.
- The side texture marks pilot/navigation, weapon/ammunition and engineer/repair stations. V toggles helm mode; W/S control thrust, A/D heading. Shooting consumes ammo; per-character reload progress runs independently at the central magazine. Water, oxygen, leak/repair and pump remain playable.
- This is not network co-op and adds no true FPS helm view, suits, zero-G vacuum flow, blockchain writes or real SAGE fleet movement.
- Do not touch the confirmed sector/return path or planet location for this change. The merge does not deploy to walkingyog.com; visual production/Android testing remains manual.

---

---

## D-015 — asteroid textures, gentler Tower, Warp baseline and Hull Dive Crew input

**Статус:** MERGED / TESTED-CODE. Main commit [ef04168e](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/ef04168e69cdc46a7f9f92c63f8e81bec35c2340), PR [#40](https://github.com/ShamanOrWhitch/BCM4StarAtlas/pull/40), WORK LOCK [Issue #39](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/39). Post-merge regression passed in [run 39170229815](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39170229815). VERIFIED-LIVE not claimed; no WordPress deploy or physical Android test.

- Астероидные стены берут текстуры из семейства `mini-sim/assets/asterwall*`. В одном входе лабиринта выбираются максимум четыре варианта, затем панели распределяются по ним; при ошибке загрузки остаётся процедурная fallback-текстура. Ограничение удерживает загрузку разумной для старых телефонов.
- Tower: более короткие прыжки между секторами, меньше боковых опасностей и объектов. Keyboard/touch/mouse/tilt реагируют спокойнее; когда подключён gamepad, его масштаб ввода остаётся 1.0.
- Warp Tube baseline: перемещение/прокрутка ускорены коэффициентом 1.25, boost — 1.4; длительность составляет 42 секунды вместо 48. Следующий патч (D-016) добавляет нарастание до 8×.
- Room 0 временно использует speed level 3. В последующем патче D-016 абсолютные значения всех режимов снижены; предыдущий режим по-прежнему запоминается и восстанавливается при возврате с трассы либо Home.
- Hull Dive у базового PR #40: управляемые выбранные места/движение экипажа и водный цикл. Следующим этапом D-016 заменяет процедурных фигур выбранной Crew artwork и добавляет оружие/боезапас/штурвал.
- Это не сетевой мультиплеер: роли пилота/стрелка/инженера, FPS у штурвала, скафандры, вакуумное вытягивание и zero-G — следующий отдельный дизайн/реализационный этап. Для инкрементального подхода к маленькому игровому прототипу как вдохновение просмотрен [studioigor/ref2game](https://github.com/studioigor/ref2game); репозиторий не устанавливается как runtime dependency.
- Не менять подтверждённый пользователем переход обратно к карте текущего сектора, SAGE навигацию/сектор, порядок мультимедийной загрузки, глобальный OST mixer или Crew segmentation workflow. Никаких on-chain команд/транзакций не добавляется.

Результаты CI, commit SHA и живой статус дописать после проверок.

---

## D-014 — 0.9.93 mobile controls, media priority and return status

**Статус: MERGED / TESTED-CODE + BROWSER-SMOKE; физический Android-тест ещё нужен.** Mini-Sim 0.9.93 / Tower 0.2.58 merged by [09c0a955](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/09c0a9553daa6406302c3e54cd0bca1aaeff6702) from [PR #38](https://github.com/ShamanOrWhitch/BCM4StarAtlas/pull/38). All five Actions checks passed on the tested PR head `962cb6267012232bfa4dd866b4af1ef5a07f3e43`; documentation reconciliation was validated on the later PR head. Browser QA on code head [39023846140](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39023846140) also succeeded. These checks do not prove input on a physical Android phone and do not deploy to WordPress.

- Загрузка: запуск очереди текстур ближайших стен до видео правой стены; реальное видео портала запрашивается после правого видео; наружные и декоративные текстуры сохраняют низкий приоритет.
- Warp Tube: компактный HUD на touch-экранах; управление наклоном устройства с запросом разрешения iOS и кнопкой перекалибровки; осевое вращение восстановлено с коэффициентом 0.45 от прежнего чрезмерного темпа при сохранении текущего кольцевого курса и углов коллизий.
- Deep Space: drag при зафиксированном видеэкране меняет позицию корабля по орбите вокруг выбранного экрана вместо общей скорости обзора.
- Tower: современные телефоны используют один путь Pointer Events, чтобы одно нажатие не запускало и pointer-, и touch-прыжок; старый touch-handler оставлен только как fallback; скрытые P2-кнопки явно display:none; чувствительность наклона P1 снижена немного. Версия/кэш Tower — 0.2.58, Mini-Sim — 0.9.93.
- Пользователь подтвердил, что возврат из астероидного лабиринта к карте текущего сектора работает. Не менять текущий сектор, адаптер или логику возврата.
- Тесты обновляются под новый порядок запросов и номера версий. Не считать функцию проверенной на живом WordPress/Android до прохождения CI и ручного теста. GitHub не развёртывает плагин автоматически.

---

# BCM Mini-Sim — журнал решений и выполненной работы

## D-013 — Mobile Warp render pacing for 0.9.92

**Статус: TESTED-CODE on [46dea0e](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/46dea0ed32cebac7636f8c2522ccb6fe4348ddda).** Regression check [38841425206](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/38841425206) succeeded. Browser smoke [38841425219](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/38841425219) succeeded with video media disabled; the video-enabled scenario was skipped. Android battery use is not yet VERIFIED-LIVE.

Integrated Grok's `fix/warp-angle-and-room2-view` code into `main` as Mini-Sim 0.9.92. Warp canvas animation is capped at 30 FPS on touch/mobile devices and at 60 FPS on desktop; mobile canvas backing resolution is capped at device-pixel-ratio 1. The Tube duration remains 48 seconds and its elapsed time remains timestamp-based. This reduces repeated canvas work but is not proof of measured battery savings. Verify on Android before calling battery use fixed.

Tower's visible JS version label is synchronized with its existing PHP/cache version 0.2.57; no Tower gameplay or input logic changed in this release.

---


Этот файл — долговременная инженерная память, а не список пожеланий. Его нужно читать до новых исправлений. Записи не удаляются при смене этапа: обновляется статус, добавляются доказательства и новые коммиты. Если позднее пользователь захочет применить готовую технологию заново, используйте её как существующий строительный блок, а не разрабатывайте повторно.

## Как читать статусы

- **IMPLEMENTED** — изменение присутствует в указанном коммите и, после сверки, в текущей ветке.
- **TESTED-CODE** — автоматические тесты/линтеры прошли на указанном SHA. Не означает runtime или live verification.
- **VERIFIED-LIVE** — поведение проверено в браузере на названном окружении/версии.
- **USER-CONFIRMED** — пользователь явно подтвердил работоспособность конкретного сценария.
- **OPEN** — исправления нет либо есть действующее свидетельство дефекта.
- **NEEDS-USER-STATUS** — нужен краткий ответ пользователя, потому что фактическое поведение сайта нельзя вывести из кода, а от ответа зависит дальнейшая работа.
- **BLOCKED** — есть конкретный недостающий доступ, файл, источник или воспроизводимый вход.
- **REOPENED** — прежнее исправление имеет новое свидетельство регрессии; ссылка на прежнее решение сохраняется.
- **SUPERSEDED** — решение заменено более новым. Не возвращать его без нового обоснования.

Никогда не подменять один статус другим. Например, зелёный тест исходников не равен тому, что сайт уже получил файлы, а отсутствие жалобы не является подтверждением. Но отсутствие подтверждения также не является причиной бесконечно переделывать уже реализованный код.

---

## D-012 — Планета остаётся снаружи Room 2 и видна из коридора

**Статус: IMPLEMENTED; целевые проверки исходника и JavaScript parse check пройдены. Полный Node suite не запускался; VERIFIED-LIVE нет.**

После версии 0.9.89 пользователь сообщил, что планета стала выглядеть как объект внутри Room 2. Причина — радиус был увеличен с 11 до 28, а позиция смещена с `(-26, 9, -190)` на `(0, 16, -220)`. Хотя координата Z всё ещё находится за пределами Room 2, увеличенная сфера оказалась прямо на оси прохода.

Восстановлено прежнее внешнее положение: `SphereGeometry(11, 24, 16)` и `position.set(-26, 9, -190)`. При этом `updateSpaceSatelliteVisibility()` продолжает показывать космические объекты как в `ROOM2`, так и в `DEEP_SPACE`. Коллизии, геометрия комнат, материалы спутника, media queue и Warp не менялись. Кэш-версия Mini-Sim — 0.9.90.

Связанные изменения: `9b37c93` (позиция/размер), `a8355a7` (cache version), `af8608b` (source-contract test). Целевые проверки координат/размера/видимости и согласованности версии прошли; полный Node suite не запускался, потому что в этом окружении недоступно клонирование репозитория. На WordPress ничего не загружалось.

---

## D-013 — Труба не растягивает препятствия, обшивка видна из полости

**Статус: IMPLEMENTED в 0.9.91. TESTED-CODE — 31 source-contract pass. VERIFIED-LIVE нет. Планета и сфера станции не сдвигались.**

Скрин 0.9.90: кольца уходили спиралью, шипы при глубине больше 1 рисовались жёлтым клином за пределами трубы, удар не совпадал с видимым проёмом, потому что поворот препятствия по глубине был большим. Глубина препятствия теперь не больше 1, ближнее кольцо остаётся в центре экрана, поворот по глубине маленький.

Обшивку `back*.png` не удаляли. Панели смотрели только внутрь и скрывались, пока `exteriorFlight` был ложью, поэтому снаружи переливов не было. Теперь материал двусторонний и оболочка видна везде, кроме внутренности коридора. Полость между стенами Room 2 и обшивкой пролетается. Рот коридора после телепорта остаётся твёрдым. Сквозной выход через всю заднюю крышку убран: наружу выпускает только створ коридора. Невидимый захват на 8 единиц вокруг корпуса уменьшен до 1.2.

---

## D-011 — Warp: один угол крена, отмена без автопереноса, объекты космоса видны из Room 2

**Статус: IMPLEMENTED в 0.9.89 на ветке `fix/warp-angle-and-room2-view`. TESTED-CODE — 31 source-contract pass. VERIFIED-LIVE нет.**

Уточнение пользователя после 0.9.88: крен трубы уже читается, но влево/вправо перепутаны, крутиться должен корабль, а не труба, препятствия зависают у камеры. Спутник стал плоским, потому что 0.9.88 заменил металлический материал на Basic. Планета была в стороне от оси коридора. Счётчик TEX останавливался, потому что повторный запрос того же файла выбрасывал callback.

0.9.89: корабль едет по стенке, вправо уменьшает угол и визуально уходит вправо; труба от стика не крутится; глубина препятствия 1/z, без стоянки у носа. Каркас спутника снова MeshStandardMaterial. Планета на оси коридора, крупнее. Очередь текстур вызывает все callback одного файла и через 20 с отпускает зависший запрос. Папка `scripts` по-прежнему не ставится ни на WordPress, ни на Render.

Свидетельство пользователя на 0.9.87 (2026-10-14): вправо крутит то вправо, то влево; после сдвига вправо кнопка вверх продолжает тот же поворот, затем управление расходится. Это не поломка джойстика. Код двигал точку по X/Y и снова клал её на окружность, поэтому направление стика зависело от того, где корабль уже стоял на круге.

Решение, без копирования кода tube64:
- Влево/вправо меняют только `playerAngle` с постоянной скоростью.
- Корабль рисуется внизу экрана, туннель крутится в обратную сторону.
- Вверх/вниз больше не участвуют в крене.
- Успешный Warp не уводит в ONICSS сам. «Продолжить» идёт дальше, «Отмена» возвращает сохранённую точку вылета.
- Спутник и планета видны уже в Room 2, не только после пересечения границы Deep Space. Каркас спутника — `MeshBasicMaterial`, чтобы он не гас вне короткого радиуса точечного света.

Не трогались: переход Room 2, сдача Tower, микшер музыки, карта SAGE.

Условие переоткрытия: на сайте с версией 0.9.88 вправо всё ещё меняет направление само, либо спутник по-прежнему отсутствует в коридоре Room 2.

---

## D-001 — Имя Crew вместо обобщённого «Crew #...»

**Статус: IMPLEMENTED в коде; live/user confirmation не записаны для последней версии. Не начинать заново без нового свидетельства.**

Проблема обсуждалась и повторно исправлялась несколькими коммитами 10–11 октября. История особенно важна: ранние исправления меняли fallback и регулярные выражения, после чего нормализация имён неоднократно уточнялась. Текущий код содержит нормализацию и несколько источников настоящего имени.

Связанные коммиты:
- [8ad3e72 — Preserve Crew display names from metadata](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/8ad3e727743522d69634296b1554c224624a74a3)
- [892ea3a — Resolve real Crew names and bump Mini Sim assets](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/892ea3abb6d538e4d6570e40d70ef448154394a2)
- [ec01831 — Fix Crew names in character selection](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/ec01831e54bdc3b8af71782e6304cd25f096911e)
- [b3b2148 — Fix Tower Crew segmentation and shield alignment / normalize names](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/b3b214865caf74aa47f8dd3b693c8e15baf01c54)
- [0e7c65b — Fix Crew wallet metadata parsing and names](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/0e7c65b3a37f28b596ceedcda3c20a39ecb4d854)

Текущие релевантные файлы:
- mini-sim/assets/js/crew-wallet.js: traitsOf(), trait(), crewRecord() — обрабатывает несколько форм метаданных и варианты display/person/given/family name.
- mini-sim/assets/js/mini-sim.js: crewPersonName() — нормализует имя в Mini-Sim.

Правило для следующих агентов:
- Не писать очередной resolver и не переделывать имя «на всякий случай».
- Если перед работой над именами это важно, сначала проверить текущие функции и все последующие коммиты.
- Если остаётся неизвестным, работает ли последнее исправление на сайте, задать пользователю один короткий вопрос или попросить только конкретный пример, если это действительно блокирует текущую задачу.
- Повторно открыть только при свежем воспроизводимом примере/логе/скриншоте или подтверждении пользователя, что имена снова выводятся как «Crew»/номер.

## D-002 — Единый микшер OST, mute и кнопка-нотка

**Статус: IMPLEMENTED в коде. Source-contract на 7489982 был красным из-за слишком широкого утверждения и выровнен без изменения микшера. Browser QA с подменой ассетов подтвердил непрерывность Warp OST и возврат обычного OST после отмены Warp; mute-кнопка и Room0 → B этим прогоном не нажимались. Немодифицированный сайт всё ещё на 0.9.82 / 0.2.53.**

Основной коммит:
- [3196d8d — Fix shared OST control and Room 1 home reset](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/3196d8d9a07dc08fcf930973cecd7dc395c94ce2)

Продолжения:
- [962a5d0 — Route Tower OST through shared mixer](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/962a5d05f0879db26d0f372310ce9ba36a13abba)
- [f6afd57 — Show muted state on music note](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/f6afd5728f25f0b49a8f28eba3a0061573c08300)
- [f1b1064 — Test shared audio, Home reset and rotating Warp course](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/f1b1064a2f7fbec7551ddafe3e940f81a1addd75)

Current intended behavior:
- starbase for the first ONI CSS location, including Room0 and Room1.
- tower only while Tower gameplay is active.
- warp from Warp map/Tube into the asteroid maze until the pilot exits; there is no separate asteroid OST yet.
- One OST at a time through window.BCMGameAudio.playExclusive.
- Note button toggles global mute; CSS .is-muted shows a strike-through; zone changes should respect mute.
- Gamepad A must not trigger Tower OST unless the Tower mode-selection/gameplay action actually starts Tower.

Useful code:
- mini-sim/assets/js/mini-sim.js: registerGameOst(), playExclusiveGameOst(), setAudioMute(), syncMusicButton(), startMusic().
- mini-sim/assets/js/deep-space-warp.js: uses shared Warp channel.
- mini-sim/tower/assets/js/tower.js: playTowerAudio() uses shared Tower channel.

Regression tests in scripts/minisim-local-qa.test.mjs:
- “Note button shares one mute state across Starbase, Warp and Tower OSTs”.
- “Room 1 Home clears Room 0 constraints and restores Starbase OST”.
- Warp tests assert Warp OST remains continuous across the Warp stage.

**Do not blindly rewrite the mixer.** `returnToStart()` still calls `stopMiniSimAudio()` and then `startMusic()`. The f1b1064 assertion forbade any `stopMiniSimAudio()` before `setStatus` and failed CI from that commit through `7489982` (run 38368355012: 8 pass / 1 fail). The assertion now requires `startMusic()` after that stop and before the Room 1 status. Audio handlers were not edited.

On 2026-10-13 a local run of `scripts/minisim-local-qa.mjs` against https://walkingyog.com/bcm4sa/ with commit assets substituted for both plugin URLs and Autoptimize handles passed the existing Warp map → Tube → cancel checks, including a single Warp OST that continues into Tube and a non-Warp OST after cancel. That is not a Room0 B test and not proof that an unmodified visitor receives these files.

## D-003 — B / Home returns from Room0 to the start of Room1

**Статус: IMPLEMENTED в коде; live Room0 → B на текущем деплое не подтверждён. Browser runner этот сценарий пока не выполняет.**

Commit: [3196d8d — Fix shared OST control and Room 1 home reset](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/3196d8d9a07dc08fcf930973cecd7dc395c94ce2).

The current handler returnToStart() deactivates the Room0 race, resets its race state and hides its group, moves the ship to (0, 0, 2), clears linear/angular velocity, resets orientation/doors, and calls startMusic(). In the gamepad input mapping, button index 1 calls returnToStart; keyboard H also calls it. The separate gamepad Back/Select button index 8 calls resetCurrentRoom().

Regression test:
- “Room 1 Home clears Room 0 constraints and restores Starbase OST” in scripts/minisim-local-qa.test.mjs.

If B still returns the player to Room0, do not immediately rewrite this same handler: confirm which PHP/JS version the live WordPress page actually serves, then trace the button event and next physics frame. This code-level fix may not yet be deployed or may have a new regression.

## D-004 — Responsive gamepad turning and ship-local vertical input

**Статус: PARTIALLY IMPLEMENTED; physical behavior still needs gameplay verification.**

Commit: [3196d8d — Fix shared OST control and Room 1 home reset](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/3196d8d9a07dc08fcf930973cecd7dc395c94ce2).

The current source increases gamepad yaw/pitch multipliers and applies vertical acceleration along the ship's quaternion-rotated local axis. The contract test checks these source patterns.

Important distinction: using the ship's local up axis is not by itself proof that movement is correctly aligned to the current tunnel/corridor floor and ceiling. The player has reported sticking to the floor/ceiling and vertical controls referring to the wrong axis. This remains a real open physical/gameplay question, not a closed issue. Do not mark it solved solely due to the source assertion.

Next work after current deployment is confirmed: test corridor, maze, and open-space separately; adjust corridor-frame handling without adding an attracting/adhesive force; clear residual angular velocity/inputs on Warp transition.

## D-005 — Warp length, looping OST and rolling/variable Tube prototype

**Статус: PARTIALLY IMPLEMENTED в коде; gameplay quality remains OPEN.**

Commits:
- [14f9c8b — Extend Warp Tube with rolling varied one-pass course](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/14f9c8b0537d952e29f821f7e725baeef2948e33)
- [f1b1064 — Test shared audio, Home reset and rotating Warp course](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/f1b1064a2f7fbec7551ddafe3e940f81a1addd75)

Current source has:
- WARP_DURATION = 48 (48 seconds, twice the previous 24-second course).
- Warp OST loops and is intended to continue from map through Tube and asteroid maze.
- A Canvas tunnel scene with a roll transform, changing speed multipliers by section, and spaced gates.
- Controller/touch/keyboard steering.

The user previously reported that the obstacles still cover too much of the view, the course is repetitive, and the craft can spin uncontrollably after exiting Warp. These concerns remain active until a current build is tested and/or further variety/physics is implemented. Source checks confirm only selected code contracts, not that the scene visually feels like Bullfrog's Tube or that roll/transition control works well.

Do not describe the current Tube as finished. The remaining design goal is a tube-racing route with varied curves, rolling orientation, loops/wall/ceiling travel, clear passable openings, some speed variation or gating obstacles, and collision geometry that matches what is drawn.

## D-006 — Room1 left wall material stability

**Статус: IMPLEMENTED in code as a texture-stability change; shell/model appearance is not user-confirmed.**

The current Mini-Sim source and regression test intentionally restrict/back off periodic random wall texture changes. Do not re-add random switching to the left wall without explicit request.

This does not authorize restoring the earlier proposed outer-shell model or changing other external surfaces. The user specifically said not to restore that model. If visuals are reported as broken, isolate which renderer/material/mesh disappeared and make a narrow fix.

## D-007 — SAGE map / galaxy-wide route planner

**Статус: OPEN.**

The current Warp navigation reads an optional BCM_SAGE_NAVIGATION / GALIA_SAGE_NAVIGATION adapter and otherwise generates a local 3x3 test preview around ONI CSS. It does not show the full galaxy map and does not execute real fleet movement.

Task when this phase becomes active:
- inspect actual available SAGE map assets/API and verify completeness; do not infer full regional count from a filename;
- display the entire map for planning, mark current sector, destination, and only real connections;
- in-game movement remains one connected cell per jump;
- don't force a pilot in an asteroid sector to return to base by default.

## D-008 — Browser testing without downloading/uploading the whole project repeatedly

**Статус: browser workflow PASS на `dc8a08e` после исправления Autoptimize mapping. Покрыт только текущий Warp map → Tube → cancel сценарий. Room0 → B, mute и интерактивная ручная проверка остаются OPEN; непереписанный production не обновлён этим тестом.**

Проверено 2026-10-13 по `main` `748998250d39ac9ed163b84caa1f7178da920d9a` и трём runs workflow `minisim-browser-qa.yml`:
- run 38365777216, SHA `ec70ed5`, failure, артефактов нет;
- run 38366096126, SHA `e8cbd54`, failure, артефакт есть;
- run 38366114002, SHA `7ae46c4`, failure, артефакт `11796367897` доступен до 2026-10-20.

Страница https://walkingyog.com/bcm4sa/ содержит `id="bcm-deep-space-warp-js"` со `src` вида `/wp-content/cache/autoptimize/autoptimize_single_….php?ver=0.9.82`. Тот же кэш у `bcm-mini-sim-css`, `bcm-tower-css`, `bcm-crew-wallet-js`. Поэтому старый runner не считал Warp JS файлом коммита и выходил до кликов. Runner теперь читает HTML и подменяет URL этих id файлами checkout. Видео по-прежнему блокируются в лёгком режиме; 404 темы `core.css` и 502 `admin-ajax.php` остаются в отчёте, но не валят Mini-Sim, если игровые checks прошли и файлы плагина не отдали HTTP-ошибку. Ошибка прелоадера темы `wy-preloader` (inline base64) тоже не относится к игре.

Это не разрешение подключать произвольный JS с raw GitHub на публичный сайт.

---

## Reconciliation history

### Baseline before the agent-context documentation
The most recent relevant game commits already present on main before these documentation files were added included:

- 0e7c65b3a37f28b596ceedcda3c20a39ecb4d854 — Crew wallet metadata/name parsing.
- 3196d8d9a07dc08fcf930973cecd7dc395c94ce2 — shared OST control and Room1 Home reset.
- 14f9c8b0537d952e29f821f7e725baeef2948e33 — 48-second rolling/varied Warp course.
- 962a5d05f0879db26d0f372310ce9ba36a13abba — Tower OST routed through shared mixer.
- 4030d30f59cfd7e5525beb899c5775e5219e5ae3 — Mini-Sim cache version bumped to 0.9.83.
- e0a9e21e99e045744113663000db66eb640b337d — Tower cache version bumped to 0.2.54.
- f6afd5728f25f0b49a8f28eba3a0061573c08300 — visual muted state for note button.
- f1b1064a2f7fbec7551ddafe3e940f81a1addd75 — regression tests for music, Home and Tube.

The latest scripts/minisim-local-qa.test.mjs contains source-contract checks for shared music, Home reset, 48-second rotating Tube, vertical input, Back reset, stable wall textures, controller navigation and the local browser runner. The presence of assertions is not proof that they passed on the current SHA, and neither is proof of live WordPress behavior. A CI status lookup for the recent commits returned no individual commit statuses; do not claim a green CI run for those SHAs unless a current Actions run can be verified.

After this reconciliation, agents should append new commit SHAs and update each decision's status rather than relying on this baseline forever.

### 2026-10-13 — P1 reconcile against Actions and the live page

HEAD at the start of the session was `748998250d39ac9ed163b84caa1f7178da920d9a` (docs only after `7ae46c4`). No later commit changed OST, Home, or the runner. Regression workflow on that HEAD failed one Home source assertion; browser workflow had already failed three times before gameplay. The game mixer was left as implemented. The runner and the Home assertion landed in [d42818a](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/d42818adec98adc77d8a4e471f8e57984fcbe494). GitHub Actions on the following journal commit [dc8a08e](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/dc8a08e35b5e457c4a18cf437cbe9661e58e56d6), which contains that runner, both succeeded: regression run [38369594418](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/38369594418) and browser QA run [38369594467](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/38369594467). The browser job uploaded artifact `minisim-browser-qa-dc8a08e35b5e457c4a18cf437cbe9661e58e56d6` (id 11798337294, expires 2026-10-20). That remote pass uses asset substitution on the live page. It is not unmodified-live verification and it does not cover Room0 → B or the mute button.


## D-009 — Постоянная координация нескольких агентов и лабораторий

**Статус: описан в ветке `docs/shared-agent-coordination`; ожидает ревью/интеграции.**  
Резервирующая задача: [Issue #15](https://github.com/ShamanOrWitch/BCM4StarAtlas/issues/15).

Контекст: агенты могут работать параллельно в раздельных песочницах и не видеть чужие незакоммиченные изменения. Ссылка на чат или Markdown не является блокировкой. В `WORK_COORDINATION.md` описан общий протокол: сначала сверить HEAD, коммиты, Issues и PR; затем зарегистрировать `WORK LOCK` Issue с baseline SHA, branch, scope files, критериями и проверками; работать в отдельной ветке; публиковать контрольные коммиты; после существенной работы обновлять PROJECT_STATE и DECISIONS.

Ограничение: GitHub Issues не являются атомарным mutex. Поэтому повторно проверяй пересечения перед первой записью и интеграцией. При конфликте не перезаписывай чужие файлы и не используй force-push; согласуй владельца/границы через Issue. Открытый PR — свидетельство незавершённой ветки, но его области надо определить по diff, а не по одному заголовку.

Статусы должны различать IMPLEMENTED, TESTED-CODE, VERIFIED-LIVE и USER-CONFIRMED. Молчание пользователя не подтверждает исправность и не доказывает регрессию. Если факт live-поведения влияет на текущую задачу и его нельзя вывести из кода/тестов, задавай один узкий вопрос, иначе сохраняй статус и продолжай доступную проверку.

Источники:
- [WORK_COORDINATION.md](WORK_COORDINATION.md)
- [AGENTS.md](AGENTS.md)
- [PROJECT_STATE.md](PROJECT_STATE.md)


## D-010 — Восстановить периодическое изменение текстур внешней оболочки

**Статус: MERGED в main; TESTED-CODE PASS; визуальная проверка сайта не выполнена.**  
Репорт пользователя: 2026-10-14 — внешняя оболочка потеряла периодически меняющиеся текстуры, несмотря на то что оптимизация не должна была удалять эффект жидкого металла, ассоциированный с Photoli / Rainbow Chi.

- Baseline main: `c01cec1e6776b53192c15b3027e0240f3ed27a45`; issue [#32](https://github.com/ShamanOrWitch/BCM4StarAtlas/issues/32); branch `fix/exterior-shell-texture-cycle`.
- Root cause: desktop-набор был насильно ограничен первыми четырьмя `back*.png`; функции `randomizeBackside()` и `updateBacksideCamouflage()`, рендер-вызов и stagger по таймерам убрали, а source-contract test прямо требовал отсутствия цикла. Историческая рабочая версия: [`0fc809c`](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/0fc809c2597debee629fecb0c25dd4ab370d65f9).
- Восстановлено: полный доступный пул текстур для desktop; до четырёх текстур в touch-landscape; существующий mobile downscaling в `makeTextureSource()` сохранён. Внешние shell-панели получают индивидуальные периоды смены около 0.8–3.0 s; при повторном появлении оболочки таймеры сдвигаются друг относительно друга. Смена обновляет только `backside.panels` и не запускается для интерьерных стен.
- Изменены: `mini-sim/assets/js/mini-sim.js`, `scripts/minisim-local-qa.test.mjs`, cache version в `mini-sim/bcm-mini-sim.php` → 0.9.86.
- Ограничение: source-contract и CI подтверждают кодовые инварианты, но не визуальный вид материала в настоящем браузере; branch assets не выкладывались на WordPress. Не отмечать как VERIFIED-LIVE до установки/проверки на сайте.
- Повторное открытие допустимо, если после установки панели не меняются, desktop всё ещё использует только часть текстур или shell цикл влияет на интерьерные стены.

- Merge commit: [ad4d8cf](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/ad4d8cf8cdf261cecb30b95ddbf85ceaf7514f02); pull request [#33](https://github.com/ShamanOrWhitch/BCM4StarAtlas/pull/33).
- Post-merge Mini-Sim regression: PASS — [run 38471956269](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/38471956269). Warp source-contract: PASS on PR SHA `c92c16d` — [run 38471847602](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/38471847602). Browser smoke passed on code-identical runtime SHA `be2adbd` — [run 38471671934](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/38471671934); post-merge browser QA run `38471956003` remained in progress when the record was updated. None of these tests visually verifies liquid-metal appearance.
