# BCM Mini Space Simulation

Self-contained WordPress test of a Descent-style 6DOF space-labyrinth.

## Version

**0.4.0**

Three.js **r128** is bundled locally in:

```
assets/js/three.min.js
```

The plugin does not depend on the WordPress theme's Three.js file and does not use a CDN.

## Current test

The test is intentionally reduced to one readable gameplay flow:

**ROOM 1 → door → one portal → portal video → ROOM 2**

Room 2 keeps the same scale and flight model but uses a different assignment of the supplied wall textures and a different structural pattern.

The five supplied wall textures are loaded as actual WebGL textures. The loader keeps the original PNGs intact and uses a maximum 2048-pixel GPU copy only when an image is larger than that. It does not require power-of-two images.

## Portal

Only one portal is active in this test:

- point 1 = `portal.png`
- transition = `portal2.mp4`
- destination = Room 2

There are no competing point-2/point-3 portal controls in this build.

G on desktop, Y on gamepad, or the mobile G button activates the portal when the pilot is close and facing it. The 480p local MP4 plays full-screen, then the ship is placed inside Room 2.

The other original portal video/image files remain in the repository for later stages, but they are not active in this test.

## Desktop controls

- W/S — forward / reverse thrust
- A/D — strafe
- Space/Ctrl — vertical movement
- Mouse — pilot view
- Q/E — roll
- F — shield
- R / yellow ◆ — remote door
- G — portal transition

Mouse vertical sensitivity is slightly increased.

## Gamepad controls

- Left stick — thrust/reverse + strafe
- Right stick X — yaw
- Right stick Y — aircraft-style inverted pitch (down = up)
- LB/RB — roll left/right
- LT/RT — vertical down/up
- A — remote door
- X — shield
- Y — portal

Yaw and roll rates are slightly increased over the previous test.

## Android landscape controls

The game area is designed for **horizontal/landscape** use.

- Press TILT once while holding the device in the desired neutral position.
- Tilt forward/back — thrust/reverse.
- Tilt left/right — strafe.
- Rotate the device around its vertical axis — replaces the mouse's horizontal look.
- Small buttons stay at the left/right edges so the centre remains free for the game.
- Left edge: thrust, reverse, roll left, roll right.
- Right edge: up, down, yaw left, yaw right, shield, TILT, portal.
- Portrait mode shows a rotate-device warning.

Touch-drag is no longer used as the primary mobile movement method.

## Background music

The real project OST is:

```
mini-sim/assets/starbase ost.mp3
```

The same blob is also retained at repository root. The plugin copy is inside `mini-sim`, so the plugin ZIP contains the OST.

The browser may block autoplay until the first interaction; the plugin starts/retries playback from user interaction and provides a mute button.

## Textures

The existing PNGs are **not too large to keep** and are not removed.

For future optimized versions, same-base WebP/JPG/JPEG files can be placed beside them:

```
wall1.png
wall1.webp
```

The plugin will prefer the lighter variant.

For this project:

- ordinary repeating room artwork: 1024×1024 or similar square WebP/JPG when a tileable source exists;
- unique 720p 16:9 or 9:16 art: keeping the original PNG is acceptable for the source/master;
- 480p MP4 transitions are appropriate for the current test.

The current loader uses Clamp-to-edge textures and does not require power-of-two dimensions.

## Assets

Supported:

```
png, jpg, jpeg, webp, gif, mp4, webm, ogg, mp3, m4a, wav
```

Put plugin assets under:

```
mini-sim/assets/
```

## WordPress

1. Copy the complete `mini-sim` folder into `/wp-content/plugins/`.
2. Activate **BCM Mini Space Simulation**.
3. Keep `[bcm_mini_sim]` on the test page.
4. Replace the old plugin folder completely before testing.
5. Hard-refresh the page.

The plugin uses only its own local Three.js and media files.

## Next stages

1. Expand Room 2 into reusable room modules.
2. Connect the portal transition to mission state.
3. Build the procedural labyrinth.
4. Add additional portal/location routes only when each route gets its own physical station.
