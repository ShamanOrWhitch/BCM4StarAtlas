# BCM Mini Space Simulation

Self-contained WordPress test of a Descent-style 6DOF space-labyrinth.

## Version

**0.3.7**

Three.js **r128** is bundled locally in:

```
assets/js/three.min.js
```

The plugin does not depend on the WordPress theme's Three.js file and does not use a CDN.

## Current test

- First-person 6DOF flight with inertia.
- WASD + mouse remain the primary desktop controls.
- Q/E roll.
- Standard browser Gamepad API support.
- Android/mobile device-tilt movement: lean forward/back for thrust/reverse and left/right for strafe.
- Mobile touch-look is optional and limited to the right half of the play area.
- Five supplied wall textures are assigned to real corridor/chamber geometry.
- Textures are loaded through an image-to-Three texture path that can downscale only the GPU copy to 2048 px when needed; original files are never modified.
- Same-base WebP/JPG/JPEG variants are preferred automatically when supplied.
- Three visible front-facing portal openings.
- Portal routing:
  - 1 → 2 = `portal2.mp4`
  - 2 → 1 = `portal1.mp4`
  - 2 → 3 = `portal3.mp4`
- Point 2 has two selectable routes; T / mobile ↕ changes the route.
- `perference bg.png` is the full-screen menu background.
- Background OST support for `starbase ost.mp3`.
- Local media manifest is generated automatically from `mini-sim/assets/`.

## Controls

Desktop:

- W/S — forward / reverse thrust
- A/D — strafe
- Space/Ctrl — vertical movement
- Mouse — pilot view
- Q/E — roll
- F — shield
- R / yellow ◆ — remote door crystal
- G — activate portal
- T — change route at point 2

Gamepad:

- Left stick — thrust/reverse + strafe
- Right stick — pilot look
- LB/RB — roll
- LT/RT — vertical down/up
- A — door crystal
- B — change portal route
- X — shield
- Y — portal

Android:

- Tap **TILT** while holding the phone in the desired neutral position.
- Lean forward/back — thrust/reverse.
- Lean left/right — strafe.
- Drag the right half of the play area — pilot look.
- Bottom controls — vertical, roll, shield, route and portal actions.

## Menu music

Preferred filename:

```
mini-sim/assets/starbase ost.mp3
```

Also accepted:

```
starbase-ost.mp3
starbase_ost.mp3
background.mp3
music.mp3
menu.mp3
ost.mp3
```

The plugin also checks for these names beside `bcm-mini-sim.php`.

The repository currently does **not** contain `starbase ost.mp3`. The simulator therefore shows **MUSIC MISSING** until the real file is present. Browser autoplay policy can postpone playback until the first user interaction; the plugin retries from that gesture.

## Textures: recommended format

Do not throw away the original PNG files.

For repeating room materials such as walls/floor/ceiling, the practical format is:

```
wall1.webp
wall2.webp
wall3.webp
wall4.webp
wall5.webp
```

Use tileable square images around **1024×1024** for ordinary room panels. For large one-shot portal/menu artwork, use **1536–2048 px on the long side**. PNG remains accepted for source/master assets.

The current plugin automatically prefers a same-base WebP/JPG/JPEG when available and otherwise uses the PNG.

## Assets

Put local media in:

```
mini-sim/assets/
```

Supported:

```
png, jpg, jpeg, webp, gif, mp4, webm, ogg, mp3, m4a, wav
```

## WordPress installation

1. Copy the complete `mini-sim` folder into `/wp-content/plugins/`.
2. Activate **BCM Mini Space Simulation**.
3. Put `[bcm_mini_sim]` on the test page.
4. Add the OST as `mini-sim/assets/starbase ost.mp3`.
5. Hard-refresh after replacing the plugin folder.

No theme Three.js file and no CDN are required.

## Next stages

1. Convert reusable room modules into the procedural labyrinth.
2. Extend collision volumes to generated modules.
3. Connect portal transitions to mission state.
4. Add future door/cinematic media.
5. Add the remaining room textures and geometry modules.
