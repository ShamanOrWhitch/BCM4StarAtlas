# Ring boss model pack

This folder is the durable project location for Ring boss GLB assets. The existing in-game pig (combat phase 1) is intentionally not replaced by this pack.

## Combat-stage index

| Combat stage | Form | Front GLB | Rear GLB | State |
|---:|---|---|---|---|
| 1 | Existing in-game pig | existing game model; not duplicated here | — | Keep unchanged until defeated |
| 2 | Roller | `boss-1-roller.glb` | `rear-forms/phase-2-roller-rear.glb` | Textured relief meshes |
| 3 | Walker | `phase-forms/phase-2-walker.glb` | `rear-forms/phase-2-walker-rear.glb` | Textured relief meshes |
| 4 | Orbiter | `phase-forms/phase-3-orbiter.glb` | `rear-forms/phase-3-orbiter-rear.glb` | Textured relief meshes |
| 5 | Brawler | `phase-forms/phase-4-brawler.glb` | `rear-forms/phase-4-brawler-rear.glb` | Textured relief meshes |
| 6 | Runner | `phase-forms/phase-5-runner.glb` | `rear-forms/phase-5-runner-rear.glb` | Textured relief meshes |
| 7 | Stalker / Shadow | `phase-forms/phase-6-stalker.glb` | `rear-forms/phase-6-stalker-rear.glb` | Textured relief meshes |

Small maze replacement candidate: `maze/maze-shadow-minion.glb` (0.9 m high), based on the final Stalker silhouette. Not connected in gameplay yet.

## Important limitations

The front/rear GLBs are textured reliefs with proxy animation clips, **not full skeletal 3D rigs**. They are safe to retain as project blockouts/reference assets. The next modeling pass is to separate articulated parts, build rigs and author phase-specific telegraph/attack/recovery/transition clips. Do not treat PNG contact sheets as the model deliverable.

The file names keep historical form numbers. The table above is authoritative for **combat-stage numbering**. The current pig is stage 1; `boss-1-roller.glb` is the first new form, stage 2.
