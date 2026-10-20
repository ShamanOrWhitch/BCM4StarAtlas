# Ring / Hull Repair — handoff

Date: 2026-10-20.
Working branch: `feat/hull-ring-repair-loop`.
Draft PR: https://github.com/ShamanOrWhitch/BCM4StarAtlas/pull/44
Main soundtrack asset: `mini-sim/assets/ring.mp3`, added to main in commit `cb1f42ca0f789c26b9e3023bc3dab516068390c4`.

## Implemented in this branch

- The side-scrolling 2D Ring level uses three local core collectibles and a randomized seven-stage deck/platform layout. Its objective no longer borrows already-collected shards from the 3D asteroid maze.
- Ring audio resolves the exact `ring.mp3` asset name from the existing asset manifest, lazy-loads only when the player enters the level, and uses the shared exclusive OST/mute API.
- Escape safely returns from an incomplete Ring attempt; the resize listener is properly removed when the level closes.
- Ring attraction is range-limited and gentler.
- Hull Dive uses transparent rendering so the existing 3D ring/ship scene remains visible through the cabin window; has a bounded pool of 60 smoke puffs and 84 water bubbles whose active density follows compartment levels; one gamepad is assigned to P2 to preserve keyboard P1, two pads can steer separate Crew; pointer dragging/holding supports Crew movement, pumping and seam repair.
- Asteroid/tube collisions damage the compartment model through the existing Hull Repair state/hooks.
- Tower gamepad polling and Tower OST are suppressed while its root is hidden or Hull Dive/Ring owns input.
- Cache versions are Mini-Sim 0.9.103 and Tower 0.2.63.

## Verified code and browser smoke

All successful Action runs use runtime/test code at `e0add2edc6f6bf369c907b6f8aef9b35eff0c40f` (the following handoff-file commit is documentation-only):

- Mini-Sim regression checks: https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39394732814
- Tower top-cap regression: https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39394732803
- Warp maze return regression: https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39394732796
- Warp course / portal first-frame regression: https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39394732899
- Browser QA: https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39394732800
- Browser QA screenshots/diagnostics artifact: https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39394732800/artifacts/12251321168

The browser smoke confirms the test page served the branch's Warp JavaScript and CSS, used only one audible Warp OST, and restored ship position plus ordinary flight OST after cancelling Tube. The video-enabled QA step was skipped. This smoke does **not** enter the Ring platformer or exercise Hull Dive interactions, so those remain source-contract/syntax tested but not browser-played yet.

## Before marking live verified

1. Integrate PR #44 and deploy the updated plugin assets to WordPress; GitHub does not deploy them automatically.
2. On the live page, reach the asteroid maze and enter the gold Ring. Confirm `ring.mp3` starts only for that level, obeys the global mute button and stops on exit; gather all 3 Ring cores, return through the exit and confirm the 3D ring is visible through the Hull window.
3. Verify Escape returns safely before finishing, pointer-drag and hold actions work in Hull Dive, and gamepad input does not start Tower OST while the cabin/Ring overlays are open.
4. Repeat on a physical gamepad/Android device before marking those controls `VERIFIED-LIVE`.

## Protected areas

No modifications to `wordpress/galia-desk`, the scanner, pricing tables, marketplace pricing or shared price assets. No change to planet coordinates or the SAGE navigation adapter. Ring movement remains local simulation, not on-chain movement.
