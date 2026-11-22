# First Planet

This is the **only First Planet module directory**: `mini-sim/first-planet/`.
It owns the game source, preview/build configuration, WordPress loader and bundle,
screenshots, scripts, audio and all First Planet-specific GLB assets.

## Asset layout

- `mesh/*.glb` — the 29 original First Planet models.
- `mesh/library/` — desert, oasis, desert-next-stage and coastal GLB packs used by the island and Shoal Race.
- `audio/FP.mp3` and `audio/desertrace.mp3` — the two optional First Planet soundtracks.
- Shared ship/Crew models and the ship catalogue remain in `mini-sim/assets/mesh/` because other Mini-Sim locations also use them; they are not copied into First Planet.

The preview Vite plugin serves the complete `mesh/` tree recursively and emits the same paths into the WordPress build. WordPress receives `meshBase`, `meshLibraryBase` and `propBase` from `BCMFirstPlanetConfig`. Do not create another model copy in `public/mesh` or under Tower.

## WordPress bundle

From this folder:

```sh
npm ci
npm run build:wordpress
```

This writes `wp-dist/first-planet.js` and `wp-dist/first-planet.css`.
Tower loads the independent module only when the descent is completed.

## Tower handoff

1. SINGLE waits for its one player to finish.
2. MULTI waits until both players finish.
3. Tower plays the existing `onicss.mp4` landing clip.
4. Tower loads `mini-sim/first-planet/loader.js`; the planet bundle and models load behind the clip.
5. When the clip ends, Tower is hidden and First Planet is revealed.

Events: `bcm:tower:planet-preload`, `bcm:tower:planet-ready`.

The original Grok PWA, scripts, server middleware, `startup.sh`, preview configuration and `AGENTS.md` remain alongside the game inside this single folder.
