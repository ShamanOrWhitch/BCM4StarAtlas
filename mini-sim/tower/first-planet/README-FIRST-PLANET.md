# First Planet

This folder contains the first-world module extracted from Grok's Desert Race
prototype. The Grok/TanStack preview scaffold is retained; WordPress uses a
separate lightweight React/Three bundle and does not load the Grok app shell.

## Shared assets

- GLB models live once in `mini-sim/assets/first-planet/mesh/`.
- The Grok Vite preview serves that shared directory through
  `firstPlanetMeshPlugin()`.
- WordPress resolves the same files through `BCMFirstPlanetConfig.meshBase`.
- Do not put a second copy in `public/mesh`.

The 29 model files are reused by Git blob SHA, not copied into a second asset
library.

## WordPress bundle

From this folder:

```sh
npm ci
npm run build:wordpress
```

This writes `wp-dist/first-planet.js` and
`wp-dist/first-planet.css`. The Tower loader fetches those files only when
the Tower level is completed.

## Tower handoff

1. SINGLE waits for its one player to finish.
2. MULTI waits until both players finish.
3. The existing `onicss.mp4` landing clip plays.
4. First Planet's JS bundle and models load behind the clip.
5. When the clip ends, Tower is hidden and First Planet is revealed.

Events: `bcm:tower:planet-preload`, `bcm:tower:planet-ready`.

The original Grok PWA, scripts, server middleware, `startup.sh`, preview
configuration and `AGENTS.md` remain in this folder.
