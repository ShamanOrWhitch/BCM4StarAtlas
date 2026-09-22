# BCM Mini Space Simulation

Self-contained WordPress test of a Descent-style 6DOF space-labyrinth.

## Version

**0.3.5**

Three.js **r128** is bundled locally in:

```
assets/js/three.min.js
```

The plugin does not depend on the WordPress theme's Three.js file and does not use a CDN.

## Shortcode

```
[bcm_mini_sim]
```

Optional:

```
[bcm_mini_sim height="800px"]
```

## What the 0.3.5 test contains

- Real first-person 6DOF flight with inertia.
- Five supplied wall textures used on the test corridor and chamber.
- Current door texture used on a two-leaf test door.
- Three visible front-facing portal openings:
  - `portal.png` = point 1.
  - `portal2.png` = point 2.
  - `portal3.png` = point 3.
- Portal transition videos:
  - `portal2.mp4` = 1 → 2.
  - `portal1.mp4` = 2 → 1.
  - `portal3.mp4` = 2 → 3.
- `perference bg.png` as the full-screen menu background.
- Local background music support through `background.mp3`.
- Standard browser Gamepad API support.
- Android/mobile touch-look by dragging the play area plus on-screen flight controls.
- Automatic lighter image variants: WebP/JPG/JPEG can replace the same-base PNG without code changes.
- Local asset manifest generated automatically by PHP from `assets/`.

Portal G activates the mapped local MP4 as a full-screen transition and then moves the pilot to that route's own destination. Point 2 has both 2 → 1 and 2 → 3; T (or mobile ↕) changes the selected route.

## Controls

Desktop:

- W/S — forward / reverse thrust
- A/D — strafe
- Space/Ctrl — vertical movement
- Mouse — pilot view
- Q/E — roll
- F — shield ON/OFF
- R / yellow ◆ — remote door crystal
- G — activate the nearest portal
- T — change the selected route when a portal has more than one

Gamepad:

- Left stick — thrust / reverse + strafe
- Right stick — pilot look
- LB/RB — roll
- LT/RT — vertical down/up
- A — door crystal
- B — change portal route
- X — shield
- Y — portal

Android/mobile:

- Swipe/drag the play area — pilot look
- On-screen buttons — thrust, strafe, vertical, roll, shield, route and portal

The door also opens automatically when the pilot approaches it while facing it.

## Menu music

Put the existing project MP3 here:

```
mini-sim/assets/background.mp3
```

The plugin attempts autoplay. Browsers that block autoplay start the same music after the first user interaction, and it continues while the simulator runs. The music button in the upper-right toggles mute.

The current repository does not contain this MP3 yet; without it the simulator reports **MUSIC MISSING** and hides the music button.

## Adding more assets

Put new local media assets inside:

```
mini-sim/assets/
```

Supported automatically by the PHP asset scanner:

```
png, jpg, jpeg, webp, gif, mp4, webm, ogg, mp3, m4a, wav
```

For an existing texture such as `wall1.png`, a lighter `wall1.webp` is automatically preferred. This means the current PNG files do not need to be replaced just to test the scene.

## WordPress installation

1. Copy only the `mini-sim` directory into:
   `/wp-content/plugins/`
2. In WordPress → Plugins, activate **BCM Mini Space Simulation**.
3. Put `[bcm_mini_sim]` on the existing test page.
4. For music, place the existing MP3 at `mini-sim/assets/background.mp3`.
5. Hard-refresh the page after replacing the plugin folder.

The plugin enqueues its CSS and simulator loader locally. Three.js r128 is loaded from `mini-sim/assets/js/three.min.js`; no theme runtime and no CDN are required.

## Next stages

1. Convert reusable room modules into the procedural labyrinth.
2. Extend physical collision volumes to generated modules.
3. Connect the portal transition system to mission state.
4. Add future door animation assets, including optional MP4 opening sequences.
5. Add remaining station textures and room modules as local assets.
