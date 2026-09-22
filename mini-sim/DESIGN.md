# BCM Mini Sim — Design

## Current test version

**0.3.4**

The mini sim is a self-contained WordPress plugin test. Three.js r128 is bundled locally and is the fixed engine baseline because r128 is already proven working in the target site.

## Runtime dependency rule

The plugin must not require:

- the active WordPress theme's Three.js;
- jsDelivr;
- unpkg;
- another external runtime engine file.

Everything required for the current test belongs inside `mini-sim/`.

## Asset model

PHP scans `mini-sim/assets/` recursively and exposes supported media as a local manifest.

Supported:

- PNG/JPG/JPEG/WebP/GIF images.
- MP4/WebM/OGG video.

The simulator uses local URLs from this manifest. This makes future asset additions extendable without adding another PHP mapping block.

Current local assets include:

- wall1.png … wall5.png
- portal.png
- portal2.png
- portal3.png
- portal1.mp4
- portal2.mp4
- portal3.mp4
- perference bg.png
- door.png

## Current visual test room

The first-person pilot starts in a textured test corridor.

The five station wall textures are deliberately visible on separate real surfaces instead of merely being preloaded:

- wall1 → floor
- wall2 → ceiling
- wall3 → left wall
- wall4 → right wall
- wall5 → structural/rear surfaces

A chamber behind the door repeats these materials so texture mapping can be inspected at different angles.

The current background image is displayed on a station monitor in the chamber.

## Door

The test door is a two-leaf sliding door using the local `door.png`.

Remote activation:

- R key
- yellow crystal UI button
- only when the door is ahead and within range

Local activation also opens the door when the pilot approaches while facing it.

The current door movement is intentionally procedural. Future cinematic doors can use MP4 opening animations without changing the generic room architecture.

## Portals

Existing routing is preserved exactly:

- portal point 1 uses `portal.png`; transition 1 → 2 uses `portal2.mp4`.
- portal point 2 uses `portal2.png`; transitions 2 → 1 and 2 → 3 use `portal1.mp4` and `portal3.mp4`.
- portal point 3 uses `portal3.png`.

In version 0.3.4 the pilot activates the matching local MP4 with G as a full-screen transition. When the video finishes, the pilot is placed at the mapped destination point and velocity is reset. The routing remains 1 → 2 via portal2.mp4, 2 → 1 via portal1.mp4 and 2 → 3 via portal3.mp4.

## Flight model

Single-player first:

- pilot only
- inertial linear movement
- free pitch/yaw from mouse
- roll from Q/E
- local thrust / strafe / vertical thrust
- gentle linear drag
- speed cap
- shield toggle

No weapon subsystem is required for the current test.

## Collision scope

The current collision volume is intentionally limited to the corridor and portal chamber. It is the control-test shell, not yet the final procedural labyrinth collision system.

## Later procedural map

Target reusable module set:

- 6 square rooms
- 7 circular transitions
- 3 ventilation turns with straight pipe
- 15 random dead ends
- key door
- airlock/docking room
- mission objectives and return/drop loop

The final generator should consume the same local wall/door/portal asset registry rather than hard-coding filenames into game logic.
