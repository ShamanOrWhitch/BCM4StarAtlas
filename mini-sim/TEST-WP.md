# WordPress test — BCM Mini Space Simulation

## Current version

**0.5.0**

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

The wall images must visibly appear in all three rooms. Ceilings now use the new roof*.png set by segments; roofa*.png must appear at the first/last ceiling sections where each room terminates. This is the seam/junction test.

The loader supports the supplied 720p PNGs without requiring power-of-two dimensions. Clamp-to-edge is used instead of repeat wrapping.

For lighter future assets, add same-base WebP/JPG/JPEG beside the PNG.

## Portal test

Three physical portal squares must be visible:

1. portal.png + portal1.mp4 → Room 2.
2. portal2.png + portal2.mp4 → Room 3.
3. portal3.png + portal3.mp4 → Room 1.

Approach the active portal. When at least 69% of its projected square is visible and the ship is close/facing the gate, the transition starts automatically. G / gamepad Y / mobile G still provides manual activation.

Expected sequence:

1. The square portal texture is visible.
2. The matching MP4 opens inside the game and covers the flight view.
3. Flight input is locked and pointer lock is released during playback.
4. On ended, the ship is teleported to the next room and flight resumes.
5. No reverse portal animation is required; the static portal image is the pre-transition state.

## Door and pipe test

The door randomly chooses from door.png through door5.png and randomly selects an opening mode/speed. Reload the test page to get another random door variant.

Long pipe runs with different diameters/path shapes should be visible along the rooms.

## Video test

The plugin also provides a same-origin WordPress video-stream URL with explicit video MIME type and HTTP Range support. If direct MP4 playback fails because of server MIME/range handling, the transition should still use the stream URL.

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
