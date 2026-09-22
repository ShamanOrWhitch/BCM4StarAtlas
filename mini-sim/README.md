# BCM Mini Space Simulation

Self-contained WordPress test of a Descent-style 6DOF space-labyrinth.

## Version

**0.3.0**

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

## What the 0.3 test contains

- Real first-person 6DOF flight with inertia.
- Five supplied wall textures used on the test corridor/chamber.
- Current door texture used on a two-leaf test door.
- Portal point images:
  - `portal.png` = point 1.
  - `portal2.png` = point 2.
  - `portal3.png` = point 3.
- Portal transition videos:
  - `portal2.mp4` = 1 → 2.
  - `portal1.mp4` = 2 → 1.
  - `portal3.mp4` = 2 → 3.
- `perference bg.png` shown on the local station display.
- Local asset manifest generated automatically by PHP from `assets/`.
- Missing image files are reported without stopping the whole simulator.

The current portal test **previews the mapped transition video but does not teleport the pilot**. This leaves the existing 1 → 2, 2 → 1 and 2 → 3 routing unchanged while the 6DOF control model is being tested.

## Controls

Desktop:

- W/S — forward / reverse thrust
- A/D — strafe
- Space/Ctrl — vertical movement
- Mouse — pilot view
- Q/E — roll
- F — shield ON/OFF
- R / yellow ◆ — remote door crystal
- G — preview the nearest portal route

The door also opens automatically when the pilot approaches it while facing it.

## Adding more assets

Put new local visual assets inside:

```
mini-sim/assets/
```

Supported automatically by the PHP asset scanner:

```
png, jpg, jpeg, webp, gif, mp4, webm, ogg
```

Image assets that are not one of the currently reserved station textures are automatically placed in the test gallery, so future textures can be checked without adding another hard-coded filename list.

## WordPress installation

Copy only the `mini-sim` directory into:

```
/wp-content/plugins/
```

Activate **BCM Mini Space Simulation**, then put:

```
[bcm_mini_sim]
```

on the test page.

The plugin enqueues its CSS, local Three.js r128 and simulator JS from the plugin directory itself. It does not require `wp_footer()` for startup.

## Next stages

1. Convert reusable room modules into the procedural labyrinth.
2. Extend physical collision volumes to generated modules.
3. Turn portal preview into the actual mission transition layer.
4. Add future door animation assets, including optional MP4 opening sequences.
5. Add remaining station textures and room modules as local assets.
