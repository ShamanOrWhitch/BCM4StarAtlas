# BCM Mini Space Simulation — current design

This file records the latest agreed direction for the playable prototype so the implementation does not drift between iterations.

## Core feel

The star-base mission uses a first-person 6DOF pilot simulator inspired by the feeling of older space maze games:

- inertial movement rather than instant stopping;
- free pitch / yaw / roll;
- small hand-built room modules assembled into a procedural route;
- old-school compact scenes rather than one huge world;
- doors and cinematic transitions can hide loading between mission sections.

The prototype is a control test first. It does not need final art, final balancing or a complete mission yet.

## Player

There is one active role: the pilot.

The pilot controls the ship directly. In a future two-controller mode there is still no separate shield operator or separate aiming/operator role.

Current controls:

- W/S — forward / reverse thrust;
- A/D — strafe;
- Space/Ctrl — vertical movement;
- mouse — pilot view;
- Q/E — roll;
- F — shield ON/OFF;
- R / yellow crystal — remote door activation when the door is in front of the ship and within range.

The ship starts stationary so the control model can be judged directly.

## Shield and crew

Shield management is deliberately simple at this stage: ON/OFF.

Crew health is represented by hearts. The state supports whole and half-heart values for later mission logic; the prototype does not yet implement crew loss, wounds or rescue missions.

## Door test

The first real interaction is a test door:

- four separate frame rails leave a real passage;
- two leaves slide apart;
- a local close-range opening is available;
- a yellow crystal provides a remote activation;
- the remote activation requires the door to be in front of the ship and inside a limited range;
- the test tunnel has simple collision boundaries;
- the door behaves as a blocker until it is mostly open.

The yellow crystal is an interaction device, not a weapon subsystem.

## Labyrinth

The current shell contains six generated sectors around a hub as a cheap prototype of a larger modular labyrinth.

The long-term module vocabulary discussed so far:

- square rooms;
- circular transitions;
- ventilation turns / straight pipe sections;
- random dead ends;
- a key-locked door;
- an airlock / docking room;
- mission-specific rooms for cargo drop, exit and system objectives.

Procedural generation should choose compatible connection points while story-critical objectives remain guaranteed.

## Mission logic later

The same labyrinth can host different objectives rather than becoming a collection of unrelated mini-games:

- find a keycard and reach the exit;
- restore systems with required components;
- find fuel and return to the ship;
- collect materials and unload them at a cargo/elevator room;
- reach an airlock / docking room;
- transition through a short cinematic into the next mission mode.

Crew composition can later affect ship characteristics, but that is not part of the current control test.

## Portal / cinematic direction

Portal assets and their existing relationships are kept unchanged.

The intended architecture is:

1. approach the special passage;
2. start a short pre-rendered transition;
3. load the next small scene while the transition hides the swap;
4. finish on a stable closed-door / arrival frame;
5. continue the next gameplay mode.

PNG/static images are preferred for ordinary surfaces. MP4 is reserved for cinematic transitions and other genuinely animated surfaces.

## Current implementation status

Implemented:

- WordPress shortcode entry point;
- PLAY / ИГРАТЬ button;
- Three.js WebGL scene;
- inertial 6DOF movement;
- mouse look and roll;
- shield toggle;
- procedural sector shell;
- test corridor;
- test door with two sliding leaves;
- local door opening;
- remote yellow-crystal door activation;
- simple test-tunnel collision;
- mobile control buttons;
- local wall textures;
- low-cost renderer settings.

Not yet final:

- full room-to-room collision;
- proper module socket generator;
- mission objectives and inventory;
- docking / airlock transition;
- gamepad support;
- device-orientation support;
- final ship model and cockpit;
- quality presets;
- installable plugin packaging as a finished release.
