# Ring boss model pack

Durable project location for the Ring boss geometry and source artwork. Combat order remains **Pig → Roller → Walker → Orbiter → Brawler → Runner → Stalker/Shadow**. The in-game Pig is unchanged as the first form.

## Runtime model sequence

| Combat form | Front model used in game | Embedded rear art | Mesh depth (approx.) |
|---|---|---|---:|
| Pig | Existing procedural in-game form | — | Existing |
| Roller | `boss-1-roller.glb` | Roller rear reference | 0.54 × height |
| Walker | `phase-forms/phase-2-walker.glb` | Walker rear reference | 0.54 × height |
| Orbiter | `phase-forms/phase-3-orbiter.glb` | Orbiter rear reference | 0.54 × height |
| Brawler | `phase-forms/phase-4-brawler.glb` | Brawler rear reference | 0.54 × height |
| Runner | `phase-forms/phase-5-runner.glb` | Runner rear reference | 0.54 × height |
| Stalker / Shadow | `phase-forms/phase-6-stalker.glb` | Stalker rear reference | 0.54 × height |

Each runtime GLB is a closed, thick silhouette extrusion with separately textured front and back caps and a bevelled side wall. The back cap uses the matching rear illustration, oriented for a rear-facing view. This replaces the former shallow front-only relief (about 0.06 × height). It is **volumetric game geometry, not a fully sculpted or skeletal character rig**; the illustrated faces are still texture projections.

The separate `rear-forms/*.glb` files are retained as older reference assets. The runtime does not stack them over the front model; rear appearance is part of each single front GLB.

## Transformations and QA

`assets/js/ring-platformer.js` now runs a timed phase transition in the real boss update loop: outgoing form fades/scales away, the persistent boss halo is hidden, a cyan/violet particle-and-ring burst plays, the new form fades in, the old form is hidden, and vulnerability resumes only after the transition plus telegraph. The six forms remain in the original boss arena and HUD flow.

`tools/ring-bosses/to_mesh.py` regenerates both the six base GLBs and the five phase-art GLBs, including embedded rear references. Browser probe `scripts/ring-boss-model-probe.mjs` enters Ring gameplay, forces each transition through the actual boss damage/update path in a query-gated QA fixture, and asserts the outgoing form is removed and the next form fully revealed. Its last run recorded six successful scene transitions, 18 loaded model instances, 6 unique GLBs, 24 clip runs, and no page, console or HTTP errors. An aborted optional video request in the standalone fixture is expected during scene teardown.

Reports: `mesh-report.json` and `phase-forms/phase-mesh-report.json`.
