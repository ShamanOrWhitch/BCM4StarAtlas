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
