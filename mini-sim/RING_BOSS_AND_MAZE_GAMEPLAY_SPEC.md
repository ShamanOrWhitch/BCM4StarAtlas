# Ring boss and maze gameplay — working design spec

**Status:** working design, not connected to gameplay. Verified implementation baseline: `main` Mini-Sim `0.15.37`, commit `0e7befbfb663189fc6309db692bc7a11dd6420e7`; target `0.16.0`, forward-only. Preserve the 0.15.37 Warp and Ring work; do not roll back to 0.15.9. This is the consolidated handoff for boss rules, attacks, animation needs and maze traversal. Numerical timings/damage are deliberately left for playtest rather than invented here. Active WORK LOCK #140 covers overlapping Ring input/locomotion integration; this design spec is not authorization to edit those runtime files. Boss-asset references in this document are not verified as present in the 0.15.37 checkout.

## Non-negotiable story order

1. **Current in-game pig boss** — unchanged model, behavior and normal defeat flow.
2. **Roller** (`boss-1-roller.glb`) — first new form, only after the pig is defeated.
3. **Walker** (`phase-2-walker.glb`).
4. **Orbiter** (`phase-3-orbiter.glb`).
5. **Brawler** (`phase-4-brawler.glb`).
6. **Runner** (`phase-5-runner.glb`).
7. **Stalker / Shadow** (`phase-6-stalker.glb`), final form.

The arena counts as one boss encounter. Defeating the current pig starts stage 2; the arena is cleared only after stage 7. Do not replace or alter the stage-1 pig as part of this arc.

## Shared boss combat contract

- Each new form has its own health/state, but damage is routed through one phase controller: `active → telegraph → attack → recovery/vulnerable → transition`.
- Every dangerous move needs a visible tell, a bounded active hitbox, a readable safe response, and a recovery window. No untelegraphed damage.
- A phase change locks damage during its transition; skipped/failed transition media must return to a playable state, not leave the boss invulnerable.
- Stage-specific controls teach one new response at a time. Keep the stage-1 pig's existing behavior outside the new controller until its ordinary defeat.
- Exact damage, durations and cooldowns remain tuneable parameters and must be set through playtesting.

## Phase attack and animation briefs

| Stage | Core pattern / player answer | Required animation beats |
|---:|---|---|
| 1 — current pig | Preserve the current encounter exactly. Its defeat triggers the new arc. | Reuse existing gameplay presentation; no replacement model/rig in this pass. |
| 2 — Roller | Clear roll/charge tell; roll across the arena. Evade with a jump or a suitable ledge/platform route. Wall impact stops the roll and exposes the core briefly; punish during recovery. | Idle/roll-up, charge tell, fast roll, collision/recoil, core-open, recovery, transform to Walker. |
| 3 — Walker | Leg lift signals a stomp. Jump/position away from the ground shockwave; punish when a foot/support is committed and the body recovers. | Gait, leg-lift tell, stomp/contact, shockwave cue, stagger/recovery, transform to Orbiter. |
| 4 — Orbiter | Low-gravity aerial traversal is the main response. Navigate between electric clusters, collect air bubbles, then attack the core during a clear armor-open window. | Ring orbit, armor close/open, electric attack tell/active/retract, exposed core, hit/recovery, transform to Brawler. |
| 5 — Brawler | Read a fist wind-up, dodge or move around the strike; a missed punch leaves the reactor open for a punish. | Guard, wind-up, punch, impact, miss/stuck recovery, reactor exposed/closed, transition to Runner. |
| 6 — Runner | Third-person rear-view chase. Avoid lane/height hazards and attacks; attack only during a clear overheat or failed-turn window. | Accelerate, steering, boost, telegraphed rear attack, skid/failed turn, overheat, transition to Stalker. |
| 7 — Stalker / Shadow | Tell the target area before a jump/grab; dodge the marked area and punish the landing/recovery. Final defeat clears the arena. | Shadow tell, leap/reposition, grab attempt, whiff/landing recovery, stagger, defeat. |

These are readable prototype patterns, not final timings. The current GLBs have generic proxy clips only; the above requires new authored animation or game-side rig animation.

## Ring maze traversal and collectibles

**Input/animation integration:** use the active [WORK LOCK #140](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/140) `BCMCrewCore` contract for Ring, not the older 0.15.9 bindings or a copied Ring input table. The normalized intent is `{moveX, moveY, jump, jumpEdge, fire, dash, activate, floor}`; Crew Core owns shared key/gamepad/touch normalization and Crew locomotion/animation states. Ring continues to own its own gravity, collisions and physics. Map flight pulses and boss interaction to this contract, and agree any genuinely new action in the Issue. Boss-stage and gravity-field code is additional Ring scope, not silently assumed to be covered by #140.

- At the user's marked key map locations, place **Hydrogen** pickups to find and collect. Use only user-confirmed marked points; do not infer extra coordinates. Hydrogen pickups in the maze are distinct from flight air-bubbles.
- Add ledge traversal inspired by classic platformers (Prince of Persia as a mechanics reference, not an asset source): **catch ledge → hang → move along ledge → pull up or drop**. This is hand-to-ledge interaction, not a grappling hook. Allow a catch only within a clear reach envelope; align hands/body to the ledge; the player chooses to climb or let go. Exact controls and co-op rules need playtest.
- **Purple rings/fields mean low gravity**: use the Balloon-style flight loop here. **Blue rings/fields mean high gravity**: jumps are lower and movement feels grounded. Keep the two color-to-gravity rules consistent and visibly readable; retain the comic presentation already present in 0.15.37.
- The low-gravity exterior corridor is a modestly longer, moderately harder route than the current 0.15.37 section—not a marathon. Reuse the already-loaded asteroid textures, keep floors/platforms rare, and populate the route with readable electric clusters and bubble lines so it is not empty.
- Keep rightward movement as normal. Repeated flight/jump presses apply lift and a visible jet flame; each impulse consumes both jetpack fuel and breathing reserve. Air bubbles refill both. The ~62 BPM music pulse is a pacing guide, not a strict timing test; allow more frequent taps for active correction. Up/down movement remains available; without lift the astronaut falls into the void.
- Apply the same Balloon/Balloon Kid-style flight loop as the central traversal response in the Orbiter phase. The Tower's existing second-jump flame effect is a visual reference to preserve, not a separate flight mode for this course.
- Near Panda and the pigs, replace the confusing long dialogue with a short, clear objective cue, e.g. **«Мы почти у цели! Осталось победить свиней!»** Show it briefly and do not let it cover controls or repeat continuously; choose the display duration in local playtest.
- Preserve the Warp behavior and comic/Ring mechanics already in 0.15.37. Verify them against that baseline; this task must not restore older Warp copies or revert work.

## Model/rig deliverables

The current front/rear GLBs are textured reliefs, not final full 3D skeletal models. Keep them in the project as blockouts. The next asset pass should produce rig-ready part sheets and distinct rigs for stages 2–7: Roller shell/core/limbs; Walker body and legs; Orbiter core/rings/armor plates; Brawler torso/arms/legs/reactor; Runner chassis/wheels/suspension; Stalker body/limbs/shadow elements. Player traversal also needs catch, hang, shimmy, pull-up, drop and landing clips. Every attack needs tell, active, recovery and hit/stagger beats.

## Project locations

- Boss models and stage mapping: `mini-sim/assets/ring-bosses/mesh/README_MODELS.md`.
- Current boss arc: `mini-sim/RING_PIG_BOSS_ARC.md`.
- Ring maze implementation handoff: `mini-sim/RING_REPAIR_HANDOFF.md`.

No gameplay code, Tower code, Warp code, audio or production site was changed for this design spec.
