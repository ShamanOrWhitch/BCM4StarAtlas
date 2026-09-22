# BCM Mini Sim — Design

## Current test version

**0.3.5**

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
- MP4/WebM video.
- MP3/M4A/WAV/OGG audio.

The resolver prefers a same-base WebP/JPG/JPEG variant when one exists, so heavy PNG textures can be replaced later without changing the scene code.

Current local assets include:

- wall1.png … wall5.png
- portal.png
- portal2.png
- portal3.png
- portal1.mp4
- portal2.mp4
- portal3.mp4
- perference bg.png
- optional background.mp3
- door.png

## Current visual test room

The first-person pilot starts in a textured test corridor.

The five station wall textures are deliberately visible on separate real surfaces:

- wall1 → floor
- wall2 → ceiling
- wall3 → left wall
- wall4 → right wall
- wall5 → structural/rear surfaces

The chamber reuses those loaded materials, so its floor, ceiling and walls are real textured geometry as well.

The current background image is the HTML menu backdrop. It sits above the WebGL canvas before gameplay starts, so it is visible under the menu while the engine is loading.

## Door

The test door is a two-leaf sliding door using the local `door.png`.

Remote activation:

- R key
- yellow crystal UI button
- only when the door is ahead and within range

Local activation also opens the door when the pilot approaches while facing it.

The current door movement is intentionally procedural. Future cinematic doors can use MP4 opening animations without changing the generic room architecture.

## Portals

The three portals are now front-facing physical station openings rather than side-mounted image planes.

Routing is unchanged:

- point 1 → 2 uses `portal2.mp4`.
- point 2 → 1 uses `portal1.mp4`.
- point 2 → 3 uses `portal3.mp4`.
- point 3 is an endpoint with no outbound route.

Portal images are loaded when the door begins opening, instead of waiting for an arbitrary camera Z threshold. The frames remain visible even if an image file fails.

At point 2, T/mobile ↕ cycles the selected route. G/mobile G activates it. The transition video is full-screen; after it ends, the pilot is placed at that route's specific destination and velocity is reset.

## Flight model

Single-player first:

- pilot only
- inertial linear movement
- free pitch/yaw from mouse
- touch drag pitch/yaw on mobile
- roll from Q/E or controller shoulder buttons
- local thrust / strafe / vertical thrust
- gentle linear drag
- speed cap
- shield toggle
- standard Gamepad API input

No weapon subsystem is required for the current test.

## Music

The plugin supports a local background track at:

`mini-sim/assets/background.mp3`

Playback is attempted immediately and is retried from a user gesture when browser autoplay policy rejects the first attempt. The same track remains active after gameplay starts.

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
