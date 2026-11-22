Ring boss volume and phase-transition patch — BCM Mini-Sim 0.16.0

Apply from the repository/plugin root. Replace the files under mini-sim/ in the archive. The tools/ and scripts/ files are developer/source tooling; they do not need to be copied into a WordPress plugin-only deployment.

Included runtime changes:
- mini-sim/assets/js/ring-platformer.js — phase swaps now perform the transition in the live boss update loop (outgoing fade/shrink, particle/ring burst, incoming fade, cleanup, invulnerability, then telegraph).
- mini-sim/assets/ring-bosses/mesh/*.glb and phase-forms/*.glb — closed, thick meshes with front and rear reference textures. The rear artwork is embedded in the model; no separate rear model is stacked in-game.
- mesh reports and README_MODELS.md.

Source regeneration: tools/ring-bosses/to_mesh.py. It requires NumPy, Pillow, SciPy, scikit-image, Shapely, and mapbox-earcut; it reads the already-present boss art and phase-art/phase-art-rear sources in mini-sim/assets/ring-bosses/.

QA: scripts/ring-boss-model-probe.mjs is a Chromium/Playwright probe against the repository standalone QA shell. The attached QA evidence reports six transitions through the actual Ring boss damage/update path and a rotated rear-view screenshot. The query-gated __BCM_RING_BOSS_QA__ hook is inactive unless bcm_qa_ring_boss is explicitly present in the URL.

This updates the 0.16.0 Ring runtime/assets only; it does not change the rest of the Mini-Sim package version or unrelated Warp/maze files.
