# WordPress test — BCM Mini Space Simulation

## Current version

**0.4.0**

## Install

1. Download the current repository ZIP.
2. Extract it.
3. Copy the complete `mini-sim` folder into `/wp-content/plugins/`.
4. Activate **BCM Mini Space Simulation**.
5. Keep `[bcm_mini_sim]` on the existing test page.
6. Hard-refresh after replacing the old plugin folder.

The plugin folder now contains the actual project OST:

`mini-sim/assets/starbase ost.mp3`

## Expected result

Before starting:

```
ENGINE READY · TEXTURE TEST · LOCAL r128
```

The menu shows `perference bg.png`.

Desktop:

- WASD + mouse flight
- Q/E roll
- R/◆ door
- G portal

Gamepad:

- left stick movement
- right stick look
- down on the right stick produces aircraft-style nose-up pitch
- LB/RB roll
- LT/RT vertical
- Y portal

Android:

- use landscape/horizontal orientation;
- press TILT to calibrate;
- tilt forward/back for thrust/reverse;
- tilt left/right for strafe;
- rotate the phone around its vertical axis for horizontal look;
- use the small controls at the screen edges for roll, yaw, vertical, shield and portal.

## Texture check

The status line should show texture loading progress.

The five wall images must visibly appear in Room 1.

The loader supports the supplied 720p PNGs without requiring power-of-two dimensions. Clamp-to-edge is used instead of repeat wrapping.

For lighter future assets, add same-base WebP/JPG/JPEG beside the PNG.

## Portal test

There is only one active portal.

Approach and face the portal, then press G (or gamepad Y / mobile G).

Expected sequence:

1. Portal image is visible.
2. `portal2.mp4` plays full-screen.
3. After the video finishes, the ship appears in Room 2.
4. Room 2 uses a different arrangement of the wall textures.

There is no competing point-2/point-3 selector in this test.

## Music test

Expected:

`mini-sim/assets/starbase ost.mp3`

The menu music button should be visible when the file is present.

Autoplay may be postponed until the first user interaction.

## If textures fail

The upper-right status line reports `TEXTURES loaded/total` and failed image names.

This build intentionally avoids RepeatWrapping for the supplied 720p images.

The original PNG files are not modified by the loader.

## If the engine does not start

Check:

```
mini-sim/assets/js/three.min.js
```

It must be the bundled Three.js r128 file.
