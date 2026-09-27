# BCM Tower Prototype

This WebGL mode lives inside the same WordPress mini-sim plugin but is kept separate from the current 6DOF labyrinth.

## Shortcodes

```
[bcm_tower]
[bcm_tower_texture_slicer]
```

## Tower assets

The tower module automatically scans the existing `mini-sim/assets/` directory.

Recognised first-pass names:

- `tower.mp4` — arrival / landing transition.
- `tower-wall.png` or `tower.png` — tower shell.
- `tower-platform.png` or `platform.png` — platform texture.
- `ship.png` / `ship.webp` — ship cutout.
- `planet*.png|webp|jpg|jpeg` — optional planet maps.

The ship uses its own texture matrix, independent of tower UVs.

## Procedural level

A seed creates a guaranteed route from the top to the bottom. Random side platforms and danger decoration are added after the route is built, so the decoration pass never removes the guaranteed route.

The next step is to replace the simple route guarantee with a reachability validator that simulates double-jetpack movement before accepting a generated seed.

## Controls

Desktop: A/D rotate, Space jetpack (up to 2), W/S vertical correction, mouse drag, R new seed.

Gamepad: left stick X rotate, left stick Y vertical trim, A jetpack, Y new seed.

Mobile: compact left / jet / right buttons.

## Texture sheet analyzer

The new `[bcm_tower_texture_slicer]` tool runs locally in the browser. It never uploads the source images.

Auto mode tries connected regions from alpha and background colour. Grid mode cuts a regular rows × columns sheet.

The next iteration can add sprite-frame grouping, automatic naming by detected object shape, and export of a manifest JSON for the tower generator.

## 0.2.0 — Single / Multi

The Tower now starts with SINGLE / MULTI. Multi uses one procedural seed for both players and renders split-screen views. P1 is keyboard A/D/W/S + Space/E; P2 uses arrows + Enter/Shift; gamepads 1/2 are mapped to P1/P2. Mouse drag controls the player in the selected screen half. Mobile gets separate P1/P2 left / jet / right controls.

## Current asset roles

Assets are classified by role instead of being mixed into one pool. The Tower landing video is read only from mini-sim/tower/assets.

- tower.mp4 → Tower landing / arrival video. `onicss.mp4` belongs to the existing mini-sim Deep Space exit and is not used as the Tower landing clip.
- Towerwall*.jpg + wall*.jpg → current JPG wall family only.
- Towerwall*.png → reserved separate future wall level; never mixed with JPG.
- platform* / legacy paltform* → normal walkable surfaces.
- platformlava* / paltformlava* → hot surfaces with limited safe time.
- platformice* → slippery surfaces.
- lava* → lethal surfaces.
- upperplatform* → upper/start platform family.
- rock* → climbable jump surfaces.
- lift* → moving platforms; liftlava / liftlice inherit hazard behaviour.
- box*, safebox*, dangerbox* → object classes.
- door* → paired map doors; walldoor.png → closed-door decoration.
- walldoorpiratebear*, walldoormetalbear*, firemetalbear* → NPC test sprites.
- fire* → fire hazard/effect.
- H* → retro landing/helipad markers.

The game keeps these pools separate so a future PNG wall level cannot accidentally contaminate the current JPG level.

## Controls 0.2.0

Single: A/D or arrows rotate; W/S or up/down correct height; Space jetpack ×2; E interaction; mouse drag; R new seed.

Multi: P1 uses A/D/W/S + Space/E, P2 uses arrows + Enter/Shift. The same tower seed is shared by both cameras. Gamepads 1 and 2 use the same analog mapping; A = jetpack, X = interaction, Y = new seed.
