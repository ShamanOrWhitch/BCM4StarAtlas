# Ring / Hull Repair — handoff

Date: 2026-10-20.
Working branch: `feat/hull-ring-repair-loop`.
Draft PR: https://github.com/ShamanOrWhitch/BCM4StarAtlas/pull/44
Main soundtrack asset: `mini-sim/assets/ring.mp3`, added to main in commit `cb1f42ca0f789c26b9e3023bc3dab516068390c4`.

## Implemented in this branch

- Ring mode is a 2D top-down traversal of the exact active 3D maze: it reuses the same saved seed, cell graph, connected passages, entrance/exit and the same three crystal states. It does not generate a second maze or a separate side-scrolling platform course. Players choose Single or Multi (two Crew); selected Mini-Sim Crew images are reused when available. Movement respects the generated corridor links, including stairs between its three vertical layers. Finishing returns to the ship; the Hull Dive remains a separate interaction.
- Ring entry first plays `ringgummy.mp4` as a muted full-screen transition. `ring.mp3` is preloaded without playback, then starts on `requestVideoFrameCallback` for the first presented video frame; the 2D view of the same maze opens when the clip ends. Older WebViews fall back to `loadeddata`. If the intro video is missing or cannot play, the level opens directly and the soundtrack starts there. Audio uses the shared exclusive OST/mute API.
- Escape safely returns from an incomplete Ring attempt; the resize listener is properly removed when the level closes.
- Ring attraction is range-limited and gentler.
- Hull Dive uses transparent rendering so the existing 3D ring/ship scene remains visible through the cabin window; has a bounded pool of 60 smoke puffs and 84 water bubbles whose active density follows compartment levels; one gamepad is assigned to P2 to preserve keyboard P1, two pads can steer separate Crew; pointer dragging/holding supports Crew movement, pumping and seam repair.
- Asteroid/tube collisions damage the compartment model through the existing Hull Repair state/hooks.
- Tower gamepad polling and Tower OST are suppressed while its root is hidden or Hull Dive/Ring/Ring transition owns input.
- Cache versions are Mini-Sim 0.9.104 and Tower 0.2.63.

## Verified code and browser smoke

The Ring intro/audio timing and dense-bubble source-contract assertions passed on the current PR head, alongside Mini-Sim regression, Warp maze return, Warp course/portal first-frame and Tower top-cap checks. Browser smoke does not enter the Ring platformer or verify soundtrack timing, so live playback remains unverified.

- Mini-Sim regression checks: https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39395201677
- Tower top-cap regression: https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39395201840
- Warp maze return regression: https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39395201648
- Warp course / portal first-frame regression: https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39395201547
- Browser QA: https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39395201676
- Browser QA screenshots/diagnostics artifact: https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39395201676/artifacts/12250648913

The browser smoke confirms the test page served the branch's Warp JavaScript/CSS, used only one audible Warp OST, and restored ship position plus ordinary flight OST after cancelling Tube. The video-enabled QA step was skipped. This smoke does **not** enter the Ring platformer or exercise Hull Dive interactions, so those remain source-contract/syntax tested but not browser-played yet.

## Before marking live verified

1. Integrate PR #44 and deploy the updated plugin assets to WordPress; GitHub does not deploy them automatically.
2. On the live page, reach the asteroid maze and enter the gold Ring. Confirm the same seeded maze opens in 2D, Single/Multi selection works, the selected Crew appear, `ring.mp3` starts on the first video frame, obeys global mute and stops on exit. Collect remaining core shards in 2D and return to the maze entrance.
3. Separately test Hull Dive using U/R3 or its screen button; verify Escape returns safely from Ring, touch controls work, and gamepad input does not start Tower OST while the cabin/Ring/video overlays are open.
4. Repeat on a physical gamepad/Android device before marking those controls `VERIFIED-LIVE`.

## Protected areas

No modifications to `wordpress/galia-desk`, the scanner, pricing tables, marketplace pricing or shared price assets. No change to planet coordinates or the SAGE navigation adapter. Ring movement remains local simulation, not on-chain movement.
