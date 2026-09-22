# BCM Mini Sim — Design

## Current test version

**0.4.0**

The current test is intentionally a minimal proof:

**one portal station and two rooms**

The aim is to verify textures, portal media, controller input and mobile orientation before multiplying locations.

## Texture rule

Original PNG files are preserved.

The runtime does not use RepeatWrapping for the supplied 720p images. This is important because ordinary 1280×720 images are non-power-of-two textures.

Textures use ClampToEdge with no mipmap generation. An image larger than 2048 px can be downscaled into a temporary canvas for the GPU copy only. The repository source remains unchanged.

Same-base WebP/JPG/JPEG files are accepted as lighter variants.

## Room 1

The first room is a 12×8 flight corridor with:

- wall1 on floor
- wall2 on ceiling
- wall3 on left wall
- wall4 on right wall
- wall5 on the structural/portal surround

The room contains one sliding door and one portal.

## Room 2

Room 2 is the same general scale but visually distinct through:

- different wall-texture assignment
- different structural colour
- different support pattern
- independent arrival zone

The portal transition places the pilot at the start of Room 2 with zero velocity.

## Portal

Only:

- `portal.png`
- `portal2.mp4`

are active in version 0.4.0.

The physical station is front-facing and sits at the far end of Room 1.

The old `portal2.png`, `portal3.png`, `portal1.mp4` and `portal3.mp4` remain stored for later development but are deliberately inactive to avoid ambiguous player routing.

## Flight controls

Desktop:

- WASD movement
- mouse pitch/yaw
- Q/E roll

Gamepad:

- left stick movement
- right stick yaw/pitch
- inverted vertical pitch
- shoulder-button roll
- trigger vertical thrust

Rotation rate is slightly higher than the previous 0.3.x test.

## Android

Landscape is the target orientation.

Device orientation has three responsibilities:

- beta/gamma, remapped for the current landscape angle, control thrust and strafe;
- alpha controls yaw relative to the calibrated neutral direction;
- the TILT button requests sensor permission where required and calibrates the current device position.

Touch buttons are compact edge controls instead of a large virtual joystick.

The browser landscape lock is requested after user interaction where supported.

## Media

The active menu/game OST is `starbase ost.mp3`.

The active portal transition is `portal2.mp4`.

The transition video is not muted so an existing soundtrack/dialogue track in the MP4 can play after the player action that starts the transition.

## Collision

The current shell covers the test corridor and both rooms. The door remains a blocking gate until opened.

## Later procedural map

Target reusable module set:

- 6 square rooms
- 7 circular transitions
- 3 ventilation turns with straight pipe
- 15 random dead ends
- key door
- airlock/docking room
- mission objectives and return/drop loop

This is deliberately postponed until the 1→2 test is visually and interactively stable.
