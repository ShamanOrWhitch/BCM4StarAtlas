# WordPress test — BCM Mini Space Simulation

## Current version

**0.3.3**

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

```
/wp-content/plugins/
```

4. In WordPress → Plugins, activate **BCM Mini Space Simulation**.
5. Keep the existing test page and shortcode:

```
[bcm_mini_sim]
```

6. Hard-refresh the page after replacing the old folder.

## What should appear

Before starting:

```
ENGINE READY · LOCAL THREE.JS r128
```

and a local asset counter.

After clicking **ИГРАТЬ**:

- first-person 6DOF flight starts;
- five wall textures are visible in the corridor/chamber;
- the textured two-part door is ahead;
- portal point 1/2/3 surfaces are visible in the chamber;
- the local station background is visible;
- G previews the nearest mapped portal transition video;
- R or the yellow crystal remotely opens the door.

## Portal mapping

The test keeps the existing mapping:

- 1 → 2 = `portal2.mp4`
- 2 → 1 = `portal1.mp4`
- 2 → 3 = `portal3.mp4`

The video preview does not teleport the pilot yet.

## If the engine does not start

The first check is that the installed plugin contains:

```
mini-sim/assets/js/three.min.js
```

It must be the current bundled r128 file.

The page must report:

```
ERROR: Local Three.js file missing/unavailable
```

only when that file was not successfully loaded.

If the error does not match this text, the browser is probably still receiving an older cached copy of the plugin.

## Asset rule

Add future textures/media under:

```
mini-sim/assets/
```

The plugin scans the folder automatically for:

```
png, jpg, jpeg, webp, gif, mp4, webm, ogg
```

New images are automatically eligible for the test gallery without another hard-coded PHP list.
