# BCM Mini Space Simulation

Lightweight Descent-style 6DOF space-flight prototype for WordPress.

## Shortcode

```
[bcm_mini_sim]
```

Optional:

```
[bcm_mini_sim height="800px"]
```

## Current prototype

- WebGL / Three.js
- free 6DOF orientation
- inertial movement
- acceleration and linear drag
- mouse look
- keyboard thrust / strafe / vertical movement / roll
- touch control buttons
- low-cost geometry
- five station texture slots
- mobile-friendly renderer pixel-ratio cap

## Textures

The production plugin should contain local copies in:

```
assets/textures/wall-1.png
assets/textures/wall-2.png
assets/textures/wall-3.png
assets/textures/wall-4.png
assets/textures/wall-5.png
```

For the first prototype the texture URLs can be mapped to the five supplied station images.

## Next stages

1. Proper corridor/room collision volumes.
2. Procedural labyrinth generator.
3. Better 6DOF angular dynamics.
4. Mobile device-orientation controls with permission handling.
5. Gamepad API support.
6. Optional Star Atlas ship GLB models.
7. Quality presets for low/medium/high devices.
8. Package as a self-contained installable WordPress plugin.
