# BCM Mini Sim — Design

## Current test version

**0.3.7**

The mini sim is a self-contained WordPress plugin test. Three.js r128 is bundled locally and is the fixed engine baseline because r128 is already proven working in the target site.

## Runtime dependency rule

The plugin must not require:

- the active WordPress theme's Three.js;
- jsDelivr;
- unpkg;
- another external runtime engine file.

Everything required for the current test belongs inside `mini-sim/`.

## Asset model

PHP scans `mini-sim/assets/` recursively.

Supported:

- PNG/JPG/JPEG/WebP/GIF images.
- MP4/WebM video.
- MP3/M4A/WAV/OGG audio.

Same-base WebP/JPG/JPEG files are preferred over PNG when available. Original PNG files remain valid.

For oversized images, the JS loader can create a downscaled **GPU-side copy** capped at 2048 px on the longest side. The repository files themselves are untouched.

## Current visual test room

The first-person pilot starts in a textured test corridor.

The five supplied wall textures are assigned to real geometry:

- wall1 → floor
- wall2 → ceiling
- wall3 → left wall
- wall4 → right wall
- wall5 → structural/rear surfaces

The chamber reuses those actual wall materials.

The menu background is `perference bg.png` as an HTML layer over the WebGL canvas before gameplay starts.

## Door

The test door is a two-leaf sliding door using the local `door.png`.

Remote activation:

- R key
- yellow ◆ UI button

The door also opens automatically when the pilot approaches while facing it.

Opening the door starts chamber-media loading immediately.

## Portals

There are three front-facing physical portal openings.

Routing is unchanged:

- point 1 → 2 = `portal2.mp4`
- point 2 → 1 = `portal1.mp4`
- point 2 → 3 = `portal3.mp4`
- point 3 has no outbound route

Point 2 has two selectable routes. T / mobile ↕ cycles the selected route; G / mobile G activates it.

The local MP4 is played full-screen and the pilot is moved to that route's specific destination after the video ends.

## Controls

Desktop:

- WASD + mouse flight
- Q/E roll
- F shield
- R/◆ door
- G portal
- T portal route

Gamepad:

- standard browser Gamepad API
- left stick flight
- right stick look
- shoulders roll
- triggers vertical
- face buttons for door/route/shield/portal

Android:

- device orientation controls thrust/reverse and strafe
- TILT button calibrates the current neutral position
- right-half touch drag controls look
- on-screen buttons provide remaining actions

## Music

Preferred file:

`mini-sim/assets/starbase ost.mp3`

Fallback names are also recognized. The same names are accepted beside `bcm-mini-sim.php`.

The current repository snapshot does not contain the Starbase OST file, so **MUSIC MISSING** is expected until it is added.

## Texture recommendation

The PNGs are not inherently a problem because of their storage size alone. The important runtime cost is decoded pixels and GPU texture memory.

For this game architecture, use two asset classes:

1. **Tileable room textures** — square 512×512 to 1024×1024 WebP/JPG for repeating metal, floor, ceiling and wall panels.
2. **Unique cinematic/portal/menu images** — roughly 1536–2048 px on the long side; PNG can be retained where lossless transparency/details matter.

The loader keeps PNG support and automatically picks lighter same-base formats.

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
