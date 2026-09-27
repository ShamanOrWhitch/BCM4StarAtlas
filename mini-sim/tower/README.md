# BCM Tower Prototype

This is a separate WebGL mode inside the same WordPress plugin as the current mini-sim.

## Current prototype

Shortcode:

```
[bcm_tower]
```

Assets are scanned from the same `mini-sim/assets/` tree. The first reserved filenames are:

- `tower.mp4` — optional ship-arrival / re-entry transition.
- `tower-wall.png` or `tower.png` — tower texture.
- `tower-platform.png` or `platform.png` — ledge texture.
- `ship.png` / `ship.webp` — ship cutout.
- `planet*.png|webp|jpg|jpeg` — optional planet maps for future procedural themes.

The tower generator builds a guaranteed route first and adds side platforms/obstacles afterwards. The route is never removed by the random decoration pass. The seed changes on each new run.

The visual mechanic deliberately follows the useful part of Tower Toppler/Nebulus: the player remains visually central while the cylindrical tower rotates around the vertical axis. The prototype is implemented with a real low-poly cylinder in WebGL rather than a fixed bitmap trick.

## Controls

Desktop:

- A / D — rotate the tower.
- Space — jetpack jump, up to two boosts before landing.
- W / S — fine vertical correction.
- Mouse drag — rotate and trim vertical movement.
- R — regenerate a new tower.

Gamepad:

- left stick X — rotate.
- left stick Y — vertical correction.
- A — jetpack.
- Y — regenerate.

Mobile:

- compact left / jet / right buttons.

## Next integration

The existing mini-sim can call:

```js
window.BCMTowerAPI.enter();
```

to run `tower.mp4` and enter the tower mode. The exact planet trigger should be connected only after the Planet map assets are supplied.

Crew visuals are intentionally a separate input. The shortcode accepts:

```
[bcm_tower crew_image="https://..." crew_name="Crew name"]
```

The existing project's wallet pipeline already represents a crew item with an `image` field. That data path is a better source for the character portrait than guessing a Galaxy API endpoint. The official Crew docs currently expose TypeScript program bindings; the Galaxy API documentation separately describes ecosystem metadata. The next step is to connect the wallet/crew image event into this mode rather than hard-code a new external metadata route.

Ship texture UVs use a separate texture matrix so later ship art can be scaled/offset without changing tower UVs.
