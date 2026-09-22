# WordPress test — BCM Mini Space Simulation

## Current version

**0.3.7**

## Install

1. Download the current repository ZIP.
2. Extract it.
3. Copy the complete `mini-sim` folder into `/wp-content/plugins/`.
4. Activate **BCM Mini Space Simulation**.
5. Put `[bcm_mini_sim]` on the existing test page.
6. Put the real Starbase OST at `mini-sim/assets/starbase ost.mp3`.
7. Hard-refresh after replacing the plugin.

## Expected result

Before starting:

```
ENGINE READY · LOCAL THREE.JS r128
```

The menu shows `perference bg.png` as the full-screen background.

After **ИГРАТЬ**:

- desktop WASD + mouse flight works;
- Q/E roll works;
- five wall textures appear on corridor/chamber surfaces;
- the textured two-part door is ahead;
- opening the door loads the chamber media;
- three front-facing portal openings show their PNG artwork;
- G activates the nearest portal;
- T / mobile ↕ changes the selected route at point 2;
- portal MP4 ends by moving the pilot to the mapped destination;
- gamepad controls flight/actions;
- Android TILT provides movement from device inclination;
- right-half touch drag controls look.

## Texture check

The asset line reports local asset counts and failed loads.

The loader accepts PNG and can automatically prefer a same-base WebP/JPG/JPEG.

For heavy source PNGs, the current loader can create a 2048 px maximum GPU copy without replacing the repository file.

Recommended room texture source for future additions:

```
wallX.webp
```

with a tileable square image around 1024×1024.

## Music check

Expected:

`mini-sim/assets/starbase ost.mp3`

The PHP resolver also recognizes common Starbase OST/background names and checks beside `bcm-mini-sim.php`.

If no file is present, the status line says **MUSIC MISSING**.

Browser autoplay restrictions can delay actual playback until the first interaction.

## Portal mapping

- 1 → 2 = `portal2.mp4`
- 2 → 1 = `portal1.mp4`
- 2 → 3 = `portal3.mp4`

This mapping must not be changed while testing.

## If textures still do not appear

The important diagnostic is the **FAILED** count in the upper-right asset status line and the browser console error for the named image. The current loader has a separate image decode path specifically to avoid silently failing large-image WebGL uploads.

## If the engine does not start

Check:

```
mini-sim/assets/js/three.min.js
```

It must be the bundled r128 file.
