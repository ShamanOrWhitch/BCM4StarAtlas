# BCM Mini Space Simulation

Playable first test of a Descent-inspired 6DOF space-labyrinth shell for WordPress.

## Shortcode

```
[bcm_mini_sim]
```

Optional:

```
[bcm_mini_sim height="800px"]
```

## Playable test

Insert the shortcode into a WordPress page:

```
[bcm_mini_sim]
```

The test opens behind the **ИГРАТЬ** button.

Desktop controls:

- W/S — thrust / reverse
- A/D — strafe
- Space/Ctrl — vertical movement
- Mouse — pilot view
- Q/E — roll
- F — shield ON/OFF
- R / yellow crystal — remote door activation when the door is in front of the ship and within range
- approaching a closed door while facing it also opens it automatically

The ship starts stationary so the first thing being tested is the control model itself: acceleration, inertia, 6DOF orientation and drift.

The current test door is deliberately simple: two sliding leaves, four-frame rails, local proximity opening and a remote yellow-crystal activator. No weapon subsystem is required for this interaction.

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

The current prototype uses the local files already present in the repository:

```
assets/wall1.png
assets/wall2.png
assets/wall3.png
assets/wall4.png
assets/wall5.png
```

For the first prototype the texture URLs can be mapped to the five supplied station images.

## Next stages

1. Extend collision volumes from the test tunnel to generated room modules.
2. Door → room/sector transition.
3. Procedural module generator using reusable rooms and connections.
4. Mobile device-orientation controls with permission handling.
5. Gamepad API support.
6. Optional Star Atlas ship GLB models.
7. Quality presets for low/medium/high devices.
8. Package as a self-contained installable WordPress plugin.
