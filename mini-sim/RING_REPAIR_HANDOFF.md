# Ring / Hull Interior — Mini-Sim 0.9.105

Updated: 2026-10-20.
Main branch: `main`.
Entry point: `mini-sim/assets/js/deep-space-warp.js`.
Shared renderer extension: `mini-sim/assets/js/mini-sim.js`.
Tower Crew cutout texture helper: `mini-sim/tower/assets/js/tower.js`.

## Intended modes

- **Ring** is no longer the top-down map as the main view or the old side-scrolling platform course. It builds a 3D cutaway/room view from the *existing active asteroid maze*: the same seed, cell graph, doors, floor links, entrance/exit and the same three crystal objects. Controls are 2D within each room. Edge transitions and door triggers move along the same graph; door turns rotate the view between axes; E/Q or the floor buttons use existing vertical links.
- Players choose Single or Multi at Ring entry. Crew image sprites go through Tower's existing cached alpha-cleaned texture path when available. Multi shares one camera while both Crew occupy the same floor/facing and remain close; it switches to two viewports when the players are far apart or in different room orientations/floors, then merges again after they regroup.
- The little top-right 2D map remains as a minimap; it is not the gameplay level.
- `ringgummy.mp4` remains the intro. `ring.mp3` is prepared silently and starts on the first presented video frame. Ring audio uses the shared mute/exclusive-OST API.
- **Hull Dive** is a separate ship-interior view. The button `ВНУТРЬ КОРАБЛЯ · U / R3` is intended to be available during ordinary first-person flight, not only beside the gold Ring. It preserves the ship's current pose rather than teleporting to the Ring. The visible button and U key call the same action; R3 is edge-triggered by the shared Mini-Sim frame loop. Hull Dive exits back to the flight and should not label itself as a Ring-only scene.
- Tower input/audio should remain suppressed when the Ring, transition video, or Hull Dive owns the screen.

## Shared renderer and performance

Ring uses the existing Mini-Sim Three.js renderer and scene; it does not create another WebGL renderer. Geometry is instanced/batched. When split, the shared renderer draws separate viewports sequentially with per-player camera orientation. The cutaway view hides the wall plane facing the camera. Keep this cheap on older Android devices.

## Status / verification

Version labels are Mini-Sim **0.9.105** and Tower **0.2.64** after the rendering and Crew-texture interface changes.

Source-contract coverage checks:
- same-seed maze metadata and shared crystal state;
- 3D cutaway geometry, door turn and floor triggers;
- Crew texture reuse and Single/Multi;
- adaptive shared/split camera;
- first-person Hull entry via on-screen button/U/R3;
- Tower input/audio and shared renderer integration.

Automated CI must pass on the current `main` commit before treating the update as regression-clean. The existing browser smoke covers main Mini-Sim/Warp navigation but does not yet play the Ring route end-to-end. Manual browser/gamepad and Android checks are still needed to validate physical traversal and camera merge/split feel.

## Scope preserved

No changes to `wordpress/galia-desk`, its scanner, pricing tables, marketplace/pricing assets, planet coordinates or the SAGE navigation adapter. All Ring movement stays local simulation; no on-chain fleet state is changed.
