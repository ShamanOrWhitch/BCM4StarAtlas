# Ring Frontier — Mini-Sim 0.9.108

## Current main state — Mini-Sim 0.11.8 (24 October 2026)

This entry supersedes the older 0.11.3–0.11.5 candidate notes below; those sections remain as history, not as the current state. Current code is on `main`; Tower remains `0.2.65`. **Nothing has been deployed to the website.**

- Warp: Class II has subdued visuals; Class III has a distinct purple shell and ribs; Class IV is disabled. Solid circular obstacle hoops were removed, along with the extra `>` chevron and launcher loop marker. Tube collision and steering should remain independent of visual class.
- Ring: the room graph has a BFS route to the large arena. At blocked doorways a transition selects an available step toward the arena; the action control uses the route hint. Each player retains a separate logical room, with split-screen when they occupy different cells.
- All three bosses now have recognisable pig silhouettes built from existing Three.js primitives (body, snout, ears, nostrils, tusks, legs and tail); no new image or texture assets were added. The weakpoint is in front of the head so the snout does not hide it.
- Source/regression checks, UI-layer checks, Tower top-cap checks, and the test ZIP build passed on the current code. Browser QA did not verify rendering: `https://walkingyog.com/bcm4sa/` returns HTTP 403 before the game container appears. Do not bypass the firewall or report this run as a visual test.
- `wordpress/galia-desk` is untouched. No production deployment was made.

Updated: 2026-10-20. Branch: `main`.

## Direction

Ring gameplay is now designed as a **continuous 2D side-scrolling platform action location rendered inside the existing Three.js scene**, closer in structure to a platform-action game with large arenas than to a room-by-room map.

The asteroid maze is only the story/entry trigger. Ring's actual game world does not read or traverse `maze.cells`; it builds its own wide side-scrolling course with three connected themed zones, large background structures, platforms at different heights, checkpoints and arena gates.

## Visual update in 0.9.108

- Zone backdrops are now generated as original comic-book industrial panels with halftone, reactor rings, inked silhouettes, pipes and high-contrast frames. The three backdrops use separate palettes and drift at a slower rate than the action plane.
- Boss arenas have large entrance pylons, overhead frames and lit edges; platforms have edge accents and visible supports. Bosses have a heavy dark silhouette, wider armor arms, horns and a bright weak core.
- The camera framing is tighter around the Crew and boss arena. The small upper-right strip remains progress telemetry only.
- Art is generated at runtime with CanvasTexture and uses the existing Three.js renderer; textures and geometry are disposed on exit. No external image download or second WebGL renderer is used.

## Current prototype

- **Three continuous zones** across one long side-scrolling level.
- **Three bosses** with separate health totals. The first and second energy barriers open after the previous boss is cleared.
- **Platform movement and jumping** on a continuous X/Y side plane; the camera follows the active player.
- **Boss interaction** uses a close-range weakpoint activation rather than a player projectile. Bosses produce low energy shockwaves that can be avoided by jumping or using the dash.
- **Energy pickups** restore one point of Crew health. Damage and falling return the Crew to the last zone checkpoint.
- **Mini-map** is a small progress strip with the three boss markers and player position; it is navigation feedback, not the gameplay level.
- **Single / Multi** remains. The two players share a camera while near each other, and split screen when sufficiently far apart.
- The active Crew images are still obtained from the existing Crew selection and Tower's cutout texture helper.

## Controls in the current prototype

Player 1: Left/Right or A/D to run, Space/W/Up to jump, E to activate a nearby boss weakpoint, Shift/C to dash.

Player 2 in Multi: J/L to run, P to jump, O to activate, I to dash.

Gamepad: left stick/D-pad to move, A/up to jump, B to dash, X to activate a nearby weakpoint. Mobile touch controls expose direction, jump, activation and dash buttons.

## Rendering and scope

- Ring uses the existing Mini-Sim renderer through `window.BCMDeepSpaceWarpRender`; it does not create a second WebGL renderer.
- The ordinary Warp navigation, Tube collision/steering, soundtrack system, Hull Dive entry/exit, asteroid-maze movement and planet/SAGE coordinate handling are outside this redesign.
- Ring still starts from the existing ring-approach trigger and intro video/music. Exiting Ring returns to the asteroid field as before.
- No wallet writes or on-chain state are involved.

## Verification status

Mini-Sim is labelled **0.9.108**. Source checks now target the continuous side-scroll world, three boss arenas, adaptive shared/split camera, navigation-only minimap, and the existing renderer/Hull integration.

The new gameplay implementation still requires browser testing, especially jumps and platform landings, boss collision timing, gamepad mapping and mobile controls. Source-level assertions alone do not mean the Ring is fully play-tested. Legacy assertions in the earlier maze-specific test file may need to be migrated to the new design; do not report the full existing regression suite as green until it passes.

## Next iterations

1. Run and adjust the first zone on desktop and mobile.
2. Improve boss patterns and animation once movement/landing is verified.
3. Add richer zone art only after the basic route is playable.
4. Expand the shared/split co-op test pass, then polish the larger boss arenas.
