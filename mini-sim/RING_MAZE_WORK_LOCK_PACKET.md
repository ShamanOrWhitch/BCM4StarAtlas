# Ring Maze integration packet — Mini-Sim 0.16.0

**Verified base:** `main` at Mini-Sim `0.15.37`, commit `27c99162364c47372fabde6389be8d972ce58ee3` (includes owner-provided `assets/ring-bosses/` pack).
**Target:** `0.16.0`, forward-only. Preserve all 0.15.37 work. **No rollback/reset to 0.15.9 and no restoring old Warp copies.**

## Current Work Lock coordination

The repository has active [WORK LOCK #140 — crew-core controls and animation; Ring first](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/140). For this task, the owner explicitly authorized continuing Ring runtime changes despite the overlap; use its current intent contract and keep one writer. GitHub write credentials were unavailable, so #140 was not updated online. This packet records that task-specific authorization and implementation status; it does not imply issue coordination was posted.

Use the #140 normalized action intent: `{moveX, moveY, jump, jumpEdge, fire, dash, activate, floor}`. The 0.16.0 working tree adds Crew Core keyboard/gamepad/touch normalization and shared motion states, with Ring consuming that contract; it does not copy old 0.15.9 input tables. Ring retains ownership of gravity, collision and flight physics. Exact numerical gravity/jump/resource/boss tuning is not specified by design and the prototype defaults remain unapproved until owner/playtest.

## Accepted combat order

1. Current in-game pig boss — unchanged model, behavior and ordinary defeat.
2. Roller — first new form after the pig is defeated.
3. Walker.
4. Orbiter.
5. Brawler.
6. Runner.
7. Stalker / Shadow — final form.

The arena counts once and clears only after stage 7. A model index is referenced at `mini-sim/assets/ring-bosses/mesh/README_MODELS.md` by the design notes, but neither that file nor the referenced GLBs exist in the verified checkout. Treat the mesh descriptions as design provenance, not verified available assets; do not claim finished rigs.

## Ring gameplay scope

- Add boss forms 2–7 with stage-specific tells, active hitboxes, counterplay, recovery/vulnerability and animation/transition states. Preserve current pig stage 1.
- Purple rings/fields = low gravity and Balloon-style flight. Blue rings/fields = high gravity and short low jumps. Retain the comic-book visual mechanics already present in 0.15.37.
- In the low-gravity corridor, keep normal rightward travel and vertical steering; repeated use of the existing jump/flight action produces lift/flame and spends both jetpack fuel and breathing reserve. Air bubbles refill both. Approximately 62 BPM is a music/pacing guide, not a strict timing test. Make the route modestly longer/harder, not a marathon, with sparse platforms and readable electric clusters.
- Reuse the same flight loop in Orbiter; tie boss hits to open-core windows.
- Place Hydrogen only at owner-marked maze-map cells; do not infer unconfirmed coordinates. Hydrogen is distinct from flight air bubbles.
- Add ledge catch → hang → shimmy → pull-up/drop, using Crew Core's hang/climb locomotion contract. No grappling hook. Agree the input semantics in the issue before implementing any action not represented by the current intent.
- Near Panda and the pigs, replace confusing long dialogue with a brief goal hint, e.g. «Мы почти у цели! Осталось победить свиней!»; tune display time locally and keep controls unobscured.
- Verify Warp against the 0.15.37 baseline; no Warp behavior changes are in this Ring scope.

## Assets and package

- Owner provided asset commit `27c99162364c47372fabde6389be8d972ce58ee3`; full front/rear GLB, image references and reports are present in `mini-sim/assets/ring-bosses/`. `README_MODELS.md` clarifies these are textured reliefs with proxy clips, not full skeletal rigs.
- The runtime loads six front forms and plays the included `idle`, `hit`, `transform_out`, `transform_in` clips; the existing Pig remains stage 1. Rear GLBs, separate form-specific transition videos, and rigged action clips are not yet used. The entrance clip `ringgummy.mp4` remains the existing Ring transition.
- Specs: `RING_PIG_BOSS_ARC.md`, `RING_BOSS_AND_MAZE_GAMEPLAY_SPEC.md`, and `RING_REPAIR_HANDOFF.md`.
- Final deliverable after implementation: one install-ready Mini-Sim `0.16.0` ZIP from the verified 0.15.37 base, with Ring JS module, separate GLBs/resources, manifest, README, checksum and install/recovery notes. No nested ZIP.

## Boundaries and acceptance

- One writer; do not overlap active #140 files without coordinating in that Issue. Stay on `main` as directed by the owner.
- AUDIO FREEZE. No changes to `wordpress/galia-desk/**`, scanner/pricing, firewall/security, production WordPress, wallet writes or SAGE transactions. Live WordPress QA remains off.
- Add/confirm red tests before behavior fixes; then test phase order, first-pig preservation, asset loading, Crew Core input mapping, gravity/flight resource loop, ledge states, Panda hint, and Warp non-regression. Run focused tests and Mini-Sim regression; report visual/device QA only if actually run.
- Do not call current relief meshes final rigs; build/verify articulated rigs and clips as separate deliverables.

## Current checkout audit

- Working tree is fast-forwarded to current `main` commit `27c99162364c47372fabde6389be8d972ce58ee3`, Mini-Sim version still `0.15.37`; target package/version `0.16.0` has not been set/built.
- Implemented in the working tree: normalized Crew Core input + pose contract; Ring input/touch vertical steering and gravity/jetpack/bubble behavior; short Panda hint; six GLB model loads with `idle`/`hit`/transform animations, procedural fallback, and boss tells/recovery after existing Pig. Assets came from owner-provided `main` commit; no Hydrogen coordinates changed.
- Focused Crew/Ring tests were **31/31 PASS** before the latest asset-load changes; owner asset GLB parsing/order/clip checks are **3/3 PASS** after those changes. `npm run test:minisim` was **65/65 PASS** before GLB integration; rerun full tests after current changes. Syntax check passed after loader integration. These are TESTED-CODE/static asset results, not current-runtime browser/device/live QA. The bundled `mesh/lab-report.json` records a previous model-lab PASS, not this current runtime.
- Numerical physics/resources/boss values remain iteration defaults; owner authorized selecting and testing them. Use available engine/browser lab for gameplay tuning if the tester is available; do not claim tuning passed without an actual run.
- Remaining: run end-to-end browser/engine test for Ring GLB loading/transitions and tune values where possible; verify Pig-first behavior and final arena clear; finish package build, version bump and installable artifact after regressions pass.
