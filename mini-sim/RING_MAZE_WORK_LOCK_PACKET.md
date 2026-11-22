# WORK LOCK packet — Mini-Sim Ring Maze integration

**Status: DRAFT — not an opened GitHub Issue.** This file is the copy-ready scope for the team. No gameplay-code edits are authorized until the owner creates the WORK LOCK Issue and shares its number. Keep it under `mini-sim/` so the task and assets survive independently of chat memory.

## Goal

Deliver one install-ready Mini-Sim update for Ring Maze: a focused Ring runtime module, boss models/resources beside it, and maze/boss gameplay. Package the replacement JS and assets in one non-nested ZIP, with the GLB files as separate files (do not embed binary models into a monolithic JS string). Preserve the existing Mini-Sim outside this Ring scope.

## Accepted gameplay order

1. Existing in-game pig boss — keep its current model, behavior, and ordinary defeat unchanged.
2. Roller — first new form after the pig is defeated.
3. Walker.
4. Orbiter.
5. Brawler.
6. Runner.
7. Stalker / Shadow — final form.

One arena encounter is counted once; the encounter ends only after stage 7. Historical file phase numbers are not combat-stage numbers; use `story_stage` and `mini-sim/assets/ring-bosses/mesh/README_MODELS.md`.

## Boss behavior and animation scope

- One phase state machine with telegraph → active attack → recovery/vulnerable window → transition; no damage without a readable tell and bounded hitbox.
- Preserve the current pig's existing code path until it is defeated; then initialize Roller as combat stage 2.
- Use the detailed per-stage behavior/animation briefs in `RING_BOSS_AND_MAZE_GAMEPLAY_SPEC.md` as the implementation checklist. Keep attack numbers tuneable and do not invent final timings before playtesting.
- Current GLBs are textured relief blockouts, not completed skeletal rigs. The asset pass must separate articulated parts and add phase-specific clips; do not claim the current relief clips are production rigs.
- Replace the orange cube mini-boss only after the small Shadow GLB is integrated and tested at maze scale.

## Ring Maze mechanics

- Hydrogen pickups belong at the user's marked key map cells. Do not guess extra cells or coordinates. The green-circled cell's row/column still needs to be confirmed from the current map before coding. Hydrogen is distinct from flight air bubbles.
- Add ledge traversal inspired by classic Prince of Persia: catch → hang → shimmy → pull up or drop. It is a hand/ledge interaction, not a grappling hook. Establish contact alignment and a clear catch reach; playtest controls/co-op behavior.
- Red low-gravity corridor becomes a modestly longer, moderately harder exterior asteroid route using the already stored asteroid textures. Keep forward/right movement, scarce platforms, electric clusters and collectible air bubbles; make it meaningfully populated, not a marathon.
- Balloon/Balloon Kid-style flight is the core control loop: repeated presses lift the astronaut and show a flame; each impulse consumes jetpack fuel and breathing reserve; air bubbles replenish both. About 62 BPM is a musical pacing guide, not a strict timing test; allow more frequent presses. Vertical up/down motion remains available; missed lift can lead to a fall.
- Use the same flight loop in the Orbiter phase, with attack windows tied to its exposed core. Do not change Tower gameplay as part of this Ring task.

## Asset inventory / durable project paths

- Front/rear boss relief GLBs and small maze Shadow: `mini-sim/assets/ring-bosses/mesh/`.
- Model index: `mini-sim/assets/ring-bosses/mesh/README_MODELS.md`.
- Convenience package: `mini-sim/assets/ring-bosses/mesh/ring-boss-models-v1.zip` (13 GLBs + index; source GLBs also remain individually in the project).
- Gameplay specification: `mini-sim/RING_BOSS_AND_MAZE_GAMEPLAY_SPEC.md`.
- Design/story arc: `mini-sim/RING_PIG_BOSS_ARC.md`.
- Maze handoff: `mini-sim/RING_REPAIR_HANDOFF.md`.

## Intended code and package shape

- New isolated Ring module under `mini-sim/assets/js/` with a narrow call from the existing host. Keep Ring behavior out of general Warp systems; do not replace all of `deep-space-warp.js` wholesale.
- Ring meshes/resources stay under `mini-sim/assets/ring-bosses/mesh/` with a manifest/readme and relative paths.
- One root-level update ZIP overlays the Mini-Sim files; no ZIP inside another ZIP. Include install/rollback notes and a checksum.
- Before fixes, add/confirm a red source test for phase ordering, first-pig preservation, Hydrogen key cells, and asset manifest loading; then implementation and focused regressions.

## Coordination / protection rules

- Repository writer: one at a time. Owner's standing direction: work directly on `main`; no feature branch or PR. Verify the active WORK LOCK and repository state before writing. Do not overwrite another writer's work.
- This packet does not replace the required GitHub WORK LOCK Issue; create that Issue first and record its number here.
- AUDIO FREEZE: add no sound, voice, music, OST or audio systems.
- Do not edit `wordpress/galia-desk/**`, scanner/pricing, firewall/security, production WordPress, wallet writes, or SAGE transactions.
- Live WordPress QA remains off; do not bypass 403. Use local/source tests and report their boundaries honestly.
- Preserve the separate Ring-module architecture. Do not refactor Warp or Tower beyond a specifically approved narrow Ring hook; Tower's second-jump behavior remains unchanged.

## Acceptance checklist

- [ ] GitHub WORK LOCK Issue opened; baseline and exact paths recorded.
- [ ] Existing pig unchanged and demonstrably remains combat stage 1.
- [ ] Six new forms load in order 2–7 with transitions and one arena completion count.
- [ ] Each new attack has visible tell, active window, recovery/vulnerability, and a counterplay.
- [ ] Ledge catch/hang/shimmy/pull-up/drop aligns with platforms and has tested controls.
- [ ] Hydrogen cells come only from owner-marked coordinates; Hydrogen and air bubbles remain distinct.
- [ ] Low-gravity flight spends both fuel and breath, bubbles restore both, rightward course is modestly longer and populated, 62 BPM is not a strict test.
- [ ] GLBs have valid paths and all displayed models/rigs have honest status labels; current reliefs are not called skeletal rigs.
- [ ] Red test fails before implementation and passes after; focused Mini-Sim regression passes.
- [ ] One install-ready ZIP (not nested), with separate model files, manifest, README, checksum and rollback notes.
- [ ] No production deployment, live-site QA, audio, protected-scope, or unrelated Warp/Tower changes.

## Team roles for this packet

- **Owner:** approves story order, visual references, marked Hydrogen cells, and final feel.
- **Arena Agent (this assistant):** prepares/revises model assets, project documentation, implementation checklist, and local asset validation; does not claim rigging or integration until completed.
- **Dr Fable / Lead Orchestrator:** decomposes and reviews the work against the packet.
- **Repo Operator:** the single active writer for code and package integration after the Issue is opened. No parallel edits to the same files.

## Start condition

The packet is ready for an Issue, but **not a substitute for one**. Begin game-code edits only after the owner provides the WORK LOCK Issue number and the writer confirms the authorized scope.
