# WordPress test — BCM Mini Space Simulation

## Current version

**0.3.5**

This test is self-contained.

Three.js **r128** is shipped inside the plugin:

```
mini-sim/assets/js/three.min.js
```

No CDN is required and the theme's Three.js file is not used.

## Install

1. Download the current repository ZIP from GitHub.
2. Extract it.
3. Copy only the complete `mini-sim` folder to:
   `/wp-content/plugins/`
4. In WordPress → Plugins, activate **BCM Mini Space Simulation**.
5. Put `[bcm_mini_sim]` on the existing test page.
6. For menu music, place the existing MP3 at `mini-sim/assets/background.mp3`.
7. Hard-refresh the page after replacing the old folder.

## What should appear

Before starting:

```
ENGINE READY · LOCAL THREE.JS r128
```

and a local asset counter.

The menu should show `perference bg.png` as the full-screen background under the menu controls.

After clicking **ИГРАТЬ**:

- first-person 6DOF flight starts;
- five wall textures are visible in corridor/chamber;
- the textured two-part door is ahead;
- three front-facing portal openings are visible after the door;
- G activates the nearest mapped portal transition;
- T or mobile ↕ changes the selected route at point 2;
- R or the yellow crystal remotely opens the door;
- desktop gamepad axes/buttons control flight and actions;
- Android touch drag controls pilot view.

## Portal mapping

The test keeps the existing mapping:

- 1 → 2 = `portal2.mp4`
- 2 → 1 = `portal1.mp4`
- 2 → 3 = `portal3.mp4`

After the local MP4 finishes, the pilot is moved to that route's mapped destination and flight resumes with zeroed velocity.

## Music

Expected file:

`mini-sim/assets/background.mp3`

Without it the asset/status line reports **MUSIC MISSING** and the music button is hidden. Browser autoplay restrictions can delay playback until the first page interaction.

## Texture formats

The existing PNG files remain supported. No conversion is required for the current code.

For lighter future assets, place a same-base WebP/JPG/JPEG variant beside the PNG:

```
wall1.png
wall1.webp
```

The simulator prefers the lighter variant automatically.

## If the engine does not start

The first check is that the installed plugin contains:

```
mini-sim/assets/js/three.min.js
```

It is the current bundled r128 file.

If the page reports an old version after replacing the folder, hard-refresh again so the versioned CSS/JS URLs invalidate WordPress/browser caches.
