# BCM Mini-Sim 0.16.0 — release candidate notes

## Base and scope

- Forward-only from current `main` `0.15.37`; verified base after the owner supplied the Ring boss pack: `27c99162364c47372fabde6389be8d972ce58ee3`.
- The older `0.15.9` package was not used as the runtime/code base. The Ring boss asset pack was read from current `main` and preserved.
- AUDIO FREEZE remains in force; no audio assets or behavior were changed by this release work.

## Ring changes

- Added a shared Crew Core intent for keyboard, touch, and gamepad, plus shared motion/pose states. Ring consumes `{moveX, moveY, jump, jumpEdge, fire, dash, activate, floor}`.
- Added vertical touch/keyboard/gamepad steering in the purple low-gravity fields, short high-gravity jumps in blue fields, jetpack flame/resource feedback, collectible air bubbles, and the short Panda objective hint.
- Preserved the existing Pig as combat phase 1, then connected the six front GLBs in the agreed order: Roller → Walker → Orbiter → Brawler → Runner → Stalker/Shadow. `idle`, `hit`, `transform_out`, and `transform_in` clips are played through the existing Three.js r128 loader/mixer. Procedural meshes remain a graceful fallback if a model fails to load.
- The asset README describes the supplied GLBs as textured reliefs with proxy clips, not full skeletal rigs. Rear-form GLBs are retained in the plugin but not yet selected by runtime camera direction. The current Ring entrance clip `ringgummy.mp4` is unchanged; boss form changes use GLB transform clips.

## Verification

- `node --check` passes for the three edited runtime JavaScript files.
- Focused Crew/Ring/model/asset tests: 34/34 pass.
- `npm run test:minisim`: 65/65 pass.
- Standalone Mini-Sim Chromium QA: PASS (repository fixture; not live WordPress).
- Ring browser probe: entered the Ring, found 18 model instances (six forms in each of three arenas), confirmed all six GLB URLs and all four clips per form; replayed all 24 clips through Three.js r128 without pose errors; no page errors or HTTP errors.
- A separate Ring navigation/controls probe passed through cell/floor changes with no page errors.

## Known limits

- The browser probes validate asset loading, clip playback, and basic Ring navigation. They do not complete a full seven-form boss fight, validate every combat/hitbox edge case, or establish final physical difficulty on a real device/live WordPress.
- Gravity, jump, jetpack/oxygen economy, bubble cadence, and boss HP/tell/recovery timings are iteration defaults, not a confirmed final balance. Adjust from gameplay evidence.
- The GLBs' documented limitations remain: they are relief meshes with proxy clips; articulated skeletal rigs and distinct attack choreography are a future art pass.

## Install/recovery

Install this plugin folder as `mini-sim/` using the generated single-level package artifact. Preserve a backup of the existing Mini-Sim plugin folder before replacing it. To roll back, restore that backup; do not restore an old `0.15.9` source tree over a newer `main` checkout.
