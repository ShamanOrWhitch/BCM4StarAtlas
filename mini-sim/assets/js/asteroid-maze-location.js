/* BCM4SA asteroid-maze location. Owns the seeded asteroid locale only. */
(function (window) {
  "use strict";
  function create(context) {
    const state = context.state;
    const api = context.api;
    const config = context.config || {};
    const root = context.root;
    const overlay = context.overlay;
    const exitButton = context.exitButton;
    const launchButton = context.launchButton;
    const hashSeed = context.hashSeed;
    const randomFrom = context.randomFrom;
    const commitArrival = context.commitArrival;
    const setMazeStatus = context.setMazeStatus;
    const syncHullButtonVisibility = context.syncHullButtonVisibility;
    const syncRingButtonVisibility = context.syncRingButtonVisibility;
    const attemptOpenRingPlatformer = context.attemptOpenRingPlatformer;
    const asteroidPlace = context.asteroidPlace;
    const nextWarpDestinationLabel = context.nextWarpDestinationLabel;

    // The GLTF loader and crystal scene are lazy, shared page-level resources.
    // They are requested only when an asteroid maze is actually constructed.
    let asteroidGltfLoaderPromise = null;
    let asteroidWallRockTemplatePromise = null;
    const asteroidWallCrystalPartPromises = new Map();
    const asteroidWallCrystalTemplatePromises = new Map();
    const asteroidWallCrystalColors = ["cyan", "violet", "amber", "green"];
    const asteroidWallCrystalAssetRoot = "mesh/twinsun_pack01/twinsun_pack01/parts/";

    function ensureAsteroidGltfLoader(THREE) {
      if (THREE && THREE.GLTFLoader) return Promise.resolve(THREE.GLTFLoader);
      if (asteroidGltfLoaderPromise) return asteroidGltfLoaderPromise;
      const loaderUrl = String(config.gltfLoaderUrl || "").trim();
      if (!loaderUrl) return Promise.reject(new Error("Local GLTFLoader URL is not configured"));

      asteroidGltfLoaderPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = loaderUrl;
        script.async = true;
        script.dataset.bcmR128GltfLoader = "1";
        script.onload = () => {
          if (THREE && THREE.GLTFLoader) resolve(THREE.GLTFLoader);
          else reject(new Error("Local GLTFLoader loaded without registering THREE.GLTFLoader"));
        };
        script.onerror = () => reject(new Error("Local GLTFLoader request failed"));
        document.head.appendChild(script);
      }).catch((error) => {
        asteroidGltfLoaderPromise = null;
        throw error;
      });
      return asteroidGltfLoaderPromise;
    }

    function loadAsteroidWallAssetTemplate(THREE, assetName, cache, cacheKey) {
      if (cache.has(cacheKey)) return cache.get(cacheKey);
      const assets = Array.isArray(config.assets) ? config.assets : [];
      const wanted = String(assetName || "").toLowerCase();
      const asset = assets.find((item) =>
        item && item.type === "model" &&
        String(item.name || "").toLowerCase() === wanted &&
        typeof item.url === "string" && item.url
      );
      if (!asset) return Promise.reject(new Error("Missing local GLB model asset: " + assetName));

      const promise = ensureAsteroidGltfLoader(THREE)
        .then(() => new Promise((resolve, reject) => {
          const loader = new THREE.GLTFLoader();
          loader.load(asset.url, (gltf) => {
            const root = gltf && (gltf.scene || (Array.isArray(gltf.scenes) ? gltf.scenes[0] : null));
            let meshes = 0;
            if (root && typeof root.traverse === "function") {
              root.traverse((node) => {
                if (!node || !node.isMesh) return;
                meshes += 1;
                node.castShadow = false;
                node.receiveShadow = false;
              });
            }
            if (!root || meshes === 0) {
              reject(new Error("GLB contains no renderable meshes: " + assetName));
              return;
            }
            resolve(root);
          }, undefined, reject);
        }))
        .catch((error) => {
          cache.delete(cacheKey);
          throw error;
        });
      cache.set(cacheKey, promise);
      return promise;
    }

    function loadAsteroidWallRockTemplate(THREE) {
      if (asteroidWallRockTemplatePromise) return asteroidWallRockTemplatePromise;
      const assetName = asteroidWallCrystalAssetRoot + "rock_cluster.glb";
      asteroidWallRockTemplatePromise = loadAsteroidWallAssetTemplate(
        THREE, assetName, new Map(), "wall-rock"
      ).catch((error) => {
        asteroidWallRockTemplatePromise = null;
        throw error;
      });
      return asteroidWallRockTemplatePromise;
    }

    function loadAsteroidWallCrystalTemplate(THREE, color) {
      const selectedColor = asteroidWallCrystalColors.includes(String(color).toLowerCase())
        ? String(color).toLowerCase()
        : "cyan";
      if (asteroidWallCrystalTemplatePromises.has(selectedColor)) {
        return asteroidWallCrystalTemplatePromises.get(selectedColor);
      }

      const getPart = (part) => {
        const assetName = asteroidWallCrystalAssetRoot + "crystal_" + part + "_" + selectedColor + ".glb";
        const cacheKey = selectedColor + ":" + part;
        return loadAsteroidWallAssetTemplate(THREE, assetName, asteroidWallCrystalPartPromises, cacheKey);
      };

      const promise = Promise.all([
        loadAsteroidWallRockTemplate(THREE),
        getPart("main"),
        getPart("side"),
        getPart("small")
      ]).then(([rock, main, side, small]) => {
        // The four GLBs deliberately retain one shared authoring coordinate
        // system. Keep the stone and all three crystals as separate child nodes.
        const deposit = new THREE.Group();
        deposit.name = "twinsun-crystal-deposit-" + selectedColor;
        const crystalGlow = {
          cyan: 0x22cbd4,
          violet: 0xa45be5,
          amber: 0xe38a25,
          green: 0x61c83e
        }[selectedColor] || 0x22cbd4;
        [rock, main, side, small].forEach((part) => {
          const child = part.clone(true);
          child.userData = child.userData || {};
          child.userData.bcmDepositPart = part === rock ? "rock" : part === main ? "crystal-main" :
            part === side ? "crystal-side" : "crystal-small";
          if (part !== rock) {
            // Subtle per-colour emission keeps the crystals readable against dark
            // asteroid textures without adding lights or affecting the rock base.
            child.traverse((node) => {
              if (!node || !node.isMesh || !node.material) return;
              const brighten = (material) => {
                const copy = material.clone();
                if (copy.emissive) copy.emissive.setHex(crystalGlow);
                copy.emissiveIntensity = 0.42;
                copy.needsUpdate = true;
                return copy;
              };
              node.material = Array.isArray(node.material)
                ? node.material.map(brighten)
                : brighten(node.material);
            });
          }
          deposit.add(child);
        });
        return deposit;
      }).catch((error) => {
        asteroidWallCrystalTemplatePromises.delete(selectedColor);
        throw error;
      });
      asteroidWallCrystalTemplatePromises.set(selectedColor, promise);
      return promise;
    }

    function makeMazeTexture(THREE) {
      const c = document.createElement("canvas");
      c.width = 64;
      c.height = 64;
      const g = c.getContext("2d");
      g.fillStyle = "#18232d";
      g.fillRect(0, 0, 64, 64);
      g.strokeStyle = "#344b5b";
      g.lineWidth = 2;
      g.strokeRect(3, 3, 58, 58);
      g.strokeStyle = "#263b49";
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(32, 4); g.lineTo(32, 60);
      g.moveTo(4, 32); g.lineTo(60, 32);
      g.stroke();
      g.fillStyle = "#5a8396";
      g.fillRect(7, 7, 4, 4);
      g.fillRect(53, 53, 4, 4);
      g.fillStyle = "#1a99ad";
      g.fillRect(28, 28, 8, 2);
      g.fillRect(31, 25, 2, 8);
      const texture = new THREE.CanvasTexture(c);
      texture.generateMipmaps = false;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      if (THREE.SRGBColorSpace !== undefined) texture.colorSpace = THREE.SRGBColorSpace;
      else if (THREE.sRGBEncoding !== undefined) texture.encoding = THREE.sRGBEncoding;
      return texture;
    }

    function asteroidWallAssetPool() {
      return (Array.isArray(config.assets) ? config.assets : [])
        .filter((asset) => {
          if (!asset || typeof asset.url !== "string" || !asset.url) return false;
          if (asset.type && asset.type !== "image") return false;
          const base = String(asset.name || "").split(/[\\/]/).pop();
          return /^asterwall[^.]*\.(?:png|jpe?g|webp)$/i.test(base);
        })
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    }

    function publishAsteroidChart(maze) {
      if (!maze) return;
      const marks = (maze.crystals || []).filter((crystal) => crystal.scouted || crystal.taken).map((crystal) => ({
        x: crystal.cell.x, y: crystal.cell.y, z: crystal.cell.z, taken: !!crystal.taken
      }));
      const anomalies = (maze.cells || []).filter((cell) => cell.y !== 1).map((cell) => ({
        x: cell.x, y: cell.y, z: cell.z,
        mode: ["drift", "flux", "dense"][hashSeed(String(maze.seed) + "|astral|" + cell.x + "|" + cell.y + "|" + cell.z) % 3]
      }));
      const hydrogen = maze.hydrogen || null;
      window.BCMAsteroidChart = {
        seed: maze.seed,
        dimensions: maze.dimensions,
        marks,
        anomalies,
        hydrogen: hydrogen ? {
          x: hydrogen.cell.x, y: hydrogen.cell.y, z: hydrogen.cell.z,
          unlocked: !!hydrogen.unlocked,
          taken: !!hydrogen.taken
        } : null
      };
    }

    function enterAsteroidMaze() {
      // Warp OST owns the whole Warp stage, including the asteroid maze.
      // A committed arrival replaces the previous rock. Opening the map must
      // not dispose it; only this handoff and a return to ONI CSS do.
      if (state.maze) disposeMaze();
      const engine = api();
      if (!engine || !engine.getRuntime) return;
      const runtime = engine.getRuntime();
      const THREE = runtime.THREE;
      const scene = runtime.scene;
      if (!THREE || !scene || !runtime.ship) return;

      // The asteroid is already built. Starting here must not depend on
      // flying to the Ring or climbing into the hold first.
      if (!state.nav || !state.nav.current) {
        state.nav = {
          current: { id: "asteroid-berth", name: "ASTEROID COMPLEX", x: -40, y: 30, raw: null },
          targets: [],
          live: false,
          localPreview: true,
          label: "ASTEROID COMPLEX",
          coordsKnown: true,
          adapter: null
        };
      }
      if (!state.target) {
        state.target = { id: "asteroid-complex", name: "ASTEROID COMPLEX", x: -39, y: 30, raw: null };
      }

      const NX = 7, NY = 3, NZ = 7, CELL = 6.8, WALL = 0.46;
      // Keep the test maze off-axis and away from the old negative-Z texture-preload trigger.
      const center = new THREE.Vector3(230, 0, 150);
      const localSession = window.BCMMiniSimSession || null;
      const locationSeeds = localSession && localSession.locationSeeds
        ? localSession.locationSeeds
        : {};
      const runCounters = localSession
        ? (localSession.runCounters || (localSession.runCounters = {}))
        : {};
      const asteroidRun = Number(runCounters.asteroid || 0) + 1;
      runCounters.asteroid = asteroidRun;
      const asteroidBaseSeed = Number.isSafeInteger(Number(locationSeeds.asteroid))
        ? Number(locationSeeds.asteroid) >>> 0
        : hashSeed(String(state.nav.current.id) + "|asteroid");
      const seed = hashSeed(asteroidBaseSeed + "|" + asteroidRun + "|" +
        state.nav.current.id + "->" + state.target.id + ":" + state.target.x + ":" + state.target.y);
      if (localSession) {
        localSession.activeSeeds = localSession.activeSeeds || {};
        localSession.activeSeeds.asteroid = seed;
      }
      const rng = randomFrom(seed);
      const cells = [];
      function idx(x, y, z) { return (z * NY + y) * NX + x; }
      function at(x, y, z) { return cells[idx(x, y, z)]; }
      function cellX(x) { return center.x + (x - (NX - 1) / 2) * CELL; }
      function cellY(y) { return center.y + (y - (NY - 1) / 2) * CELL; }
      function cellZ(z) { return center.z + ((NZ - 1) / 2 - z) * CELL; }
      function cellPosition(x, y, z) { return new THREE.Vector3(cellX(x), cellY(y), cellZ(z)); }
      const dirs = [
        { x: 1, y: 0, z: 0, key: "xp", opposite: "xn" },
        { x: -1, y: 0, z: 0, key: "xn", opposite: "xp" },
        { x: 0, y: 1, z: 0, key: "yp", opposite: "yn" },
        { x: 0, y: -1, z: 0, key: "yn", opposite: "yp" },
        { x: 0, y: 0, z: 1, key: "zp", opposite: "zn" },
        { x: 0, y: 0, z: -1, key: "zn", opposite: "zp" }
      ];
      for (let z = 0; z < NZ; z += 1) {
        for (let y = 0; y < NY; y += 1) {
          for (let x = 0; x < NX; x += 1) {
            cells.push({ x, y, z, visited: false, open: { xp: false, xn: false, yp: false, yn: false, zp: false, zn: false } });
          }
        }
      }

      // Seeded depth-first carve guarantees a connected route through every level of the maze.
      const start = at(0, 1, 0);
      const stack = [start];
      start.visited = true;
      while (stack.length) {
        const here = stack[stack.length - 1];
        const possible = [];
        dirs.forEach((d) => {
          const x = here.x + d.x, y = here.y + d.y, z = here.z + d.z;
          if (x < 0 || x >= NX || y < 0 || y >= NY || z < 0 || z >= NZ) return;
          const next = at(x, y, z);
          if (!next.visited) possible.push({ d, next });
        });
        if (!possible.length) {
          stack.pop();
        } else {
          const pick = possible[Math.floor(rng() * possible.length)];
          here.open[pick.d.key] = true;
          pick.next.open[pick.d.opposite] = true;
          pick.next.visited = true;
          stack.push(pick.next);
        }
      }

      // Add a few extra links so routes can loop rather than forcing one long chain.
      cells.forEach((cell) => {
        if (cell.x < NX - 1 && !cell.open.xp && rng() < 0.14) {
          cell.open.xp = true; at(cell.x + 1, cell.y, cell.z).open.xn = true;
        }
        if (cell.y < NY - 1 && !cell.open.yp && rng() < 0.12) {
          cell.open.yp = true; at(cell.x, cell.y + 1, cell.z).open.yn = true;
        }
        if (cell.z < NZ - 1 && !cell.open.zp && rng() < 0.16) {
          cell.open.zp = true; at(cell.x, cell.y, cell.z + 1).open.zn = true;
        }
      });

      const group = new THREE.Group();
      group.name = "bcm-procedural-asteroid-maze";
      const walls = [];
      function addWall(x, y, z, sx, sy, sz, cell) {
        walls.push({ x, y, z, sx, sy, sz, cell });
      }
      cells.forEach((cell) => {
        const x = cellX(cell.x), y = cellY(cell.y), z = cellZ(cell.z);
        if (cell.x === 0) addWall(x - CELL / 2, y, z, WALL, CELL, CELL, cell);
        if (cell.x === NX - 1) addWall(x + CELL / 2, y, z, WALL, CELL, CELL, cell);
        else if (!cell.open.xp) addWall(x + CELL / 2, y, z, WALL, CELL, CELL, cell);
        if (cell.y === 0) addWall(x, y - CELL / 2, z, CELL, WALL, CELL, cell);
        if (cell.y === NY - 1) addWall(x, y + CELL / 2, z, CELL, WALL, CELL, cell);
        else if (!cell.open.yp) addWall(x, y + CELL / 2, z, CELL, WALL, CELL, cell);
        if (cell.z === 0) {
          // Leave one clean entrance into the first central cell.
          if (!(cell.x === 0 && cell.y === 1)) addWall(x, y, z + CELL / 2, CELL, CELL, WALL, cell);
        } else if (!cell.open.zn) {
          addWall(x, y, z + CELL / 2, CELL, CELL, WALL, cell);
        }
        if (cell.z === NZ - 1) {
          // Far exit is opened only at the last cell. Internal Z-planes are emitted once
          // from the adjacent cell's positive face, avoiding overlapping double walls.
          if (!(cell.x === NX - 1 && cell.y === 1)) addWall(x, y, z - CELL / 2, CELL, CELL, WALL, cell);
        }
      });

      // Use every prepared asterwall variant. The files are small, and a full
      // shuffle means the entire asteroid run can display the whole texture family.
      let maze = null;
      const fallbackTexture = makeMazeTexture(THREE);
      const availableWallAssets = asteroidWallAssetPool();
      // Asset ordering is decorative too: do not consume the topology/crystal RNG.
      const wallAssetOrderRng = randomFrom(hashSeed(String(seed) + "|wall-assets"));
      for (let i = availableWallAssets.length - 1; i > 0; i -= 1) {
        const j = Math.floor(wallAssetOrderRng() * (i + 1));
        [availableWallAssets[i], availableWallAssets[j]] = [availableWallAssets[j], availableWallAssets[i]];
      }
      const chosenWallAssets = availableWallAssets;
      const wallMaterials = [];
      const wallTextures = [];
      const wallVariantTextures = [];
      const wallVariantMaterials = [];
      const wallVariantsByAsset = Array.from({ length: Math.max(1, chosenWallAssets.length) }, () => []);
      const wallTextureCopiesByAsset = Array.from({ length: Math.max(1, chosenWallAssets.length) }, () => []);
      if (chosenWallAssets.length) {
        const loader = new THREE.TextureLoader();
        chosenWallAssets.forEach((asset, index) => {
          const texture = loader.load(asset.url, (loadedTexture) => {
            // Clones created before TextureLoader decodes the image keep image=null.
            // Sync that decoded image into all existing wall and Ring texture copies.
            const syncImage = (copy) => {
              if (!copy) return;
              copy.image = loadedTexture.image;
              copy.needsUpdate = true;
            };
            (wallVariantsByAsset[index] || []).forEach((variant) => syncImage(variant.texture));
            (wallTextureCopiesByAsset[index] || []).forEach(syncImage);
          }, undefined, () => {
            // Keep both the 3D maze and Ring's 2D cutaway on the same fallback.
            wallTextures[index] = fallbackTexture;
            if (maze?.textures && maze.textures[index] !== undefined) maze.textures[index] = fallbackTexture;
            (wallTextureCopiesByAsset[index] || []).forEach((copy) => {
              copy.image = fallbackTexture.image;
              copy.needsUpdate = true;
            });
            if (wallMaterials[index]) {
              wallMaterials[index].map = fallbackTexture;
              wallMaterials[index].needsUpdate = true;
            }
            (wallVariantsByAsset[index] || []).forEach((variant) => {
              const replacement = fallbackTexture.clone();
              replacement.wrapS = THREE.RepeatWrapping;
              replacement.wrapT = THREE.RepeatWrapping;
              replacement.center.set(0.5, 0.5);
              replacement.rotation = variant.turn * (Math.PI / 2);
              replacement.needsUpdate = true;
              try { variant.texture.dispose(); } catch (e) {}
              variant.texture = replacement;
              variant.material.map = replacement;
              variant.material.needsUpdate = true;
              wallVariantTextures.push(replacement);
            });
            try { texture.dispose(); } catch (e) {}
          });
          texture.generateMipmaps = false;
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          texture.repeat.set(1, 1);
          if (THREE.SRGBColorSpace !== undefined) texture.colorSpace = THREE.SRGBColorSpace;
          else if (THREE.sRGBEncoding !== undefined) texture.encoding = THREE.sRGBEncoding;
          const maxAnisotropy = runtime.renderer?.capabilities?.getMaxAnisotropy?.() || 1;
          texture.anisotropy = Math.min(4, maxAnisotropy);
          wallTextures.push(texture);
          wallMaterials.push(new THREE.MeshStandardMaterial({
            map: texture, color: 0xffffff, roughness: 0.82, metalness: 0.24, emissive: 0x07121a
          }));
        });
      } else {
        wallTextures.push(fallbackTexture);
        wallMaterials.push(new THREE.MeshStandardMaterial({
          map: fallbackTexture, color: 0xa9bec8, roughness: 0.82, metalness: 0.24, emissive: 0x07121a
        }));
      }

      // Texture selection is deterministic for this maze seed but does not consume
      // the route/crystal RNG stream. Each cell's wall choice now drives both views.
      const wallLookRng = randomFrom(hashSeed(seed + "|wall-map"));
      cells.forEach((cell) => {
        cell.wallTurn = Math.floor(wallLookRng() * 4);
        cell.wallAsset = wallTextures.length > 1 ? Math.floor(wallLookRng() * wallTextures.length) : 0;
      });

      const wallVariantByKey = new Map();
      function wallVariant(cell) {
        const assetIndex = Math.max(0, Math.min(wallTextures.length - 1, Math.floor(Number(cell?.wallAsset) || 0)));
        const turn = ((Math.floor(Number(cell?.wallTurn) || 0) % 4) + 4) % 4;
        const key = assetIndex + ":" + turn;
        if (wallVariantByKey.has(key)) return { key, entry: wallVariantByKey.get(key) };
        const source = wallTextures[assetIndex] || fallbackTexture;
        const variantTexture = source.clone();
        variantTexture.wrapS = THREE.RepeatWrapping;
        variantTexture.wrapT = THREE.RepeatWrapping;
        variantTexture.center.set(0.5, 0.5);
        variantTexture.rotation = turn * (Math.PI / 2);
        variantTexture.needsUpdate = true;
        const variantMaterial = new THREE.MeshStandardMaterial({
          map: variantTexture, color: 0xffffff, roughness: 0.82, metalness: 0.24, emissive: 0x07121a
        });
        const entry = { assetIndex, turn, texture: variantTexture, material: variantMaterial };
        wallVariantByKey.set(key, entry);
        wallVariantsByAsset[assetIndex].push(entry);
        wallVariantTextures.push(variantTexture);
        wallVariantMaterials.push(variantMaterial);
        return { key, entry };
      }

      const unit = new THREE.BoxGeometry(1, 1, 1);
      const wallBatches = new Map();
      walls.forEach((wall) => {
        const resolved = wallVariant(wall.cell);
        if (!wallBatches.has(resolved.key)) wallBatches.set(resolved.key, { entry: resolved.entry, walls: [] });
        wallBatches.get(resolved.key).walls.push(wall);
      });
      const wallMeshes = Array.from(wallBatches.entries()).map(([key, batch]) => {
        const wallMesh = new THREE.InstancedMesh(unit, batch.entry.material, batch.walls.length);
        wallMesh.name = "asteroid-maze-wall-panels-" + key.replace(":", "-");
        wallMesh.frustumCulled = false;
        const matrix = new THREE.Matrix4();
        const rotation = new THREE.Quaternion();
        batch.walls.forEach((wall, instanceIndex) => {
          matrix.compose(
            new THREE.Vector3(wall.x, wall.y, wall.z),
            rotation,
            new THREE.Vector3(wall.sx, wall.sy, wall.sz)
          );
          wallMesh.setMatrixAt(instanceIndex, matrix);
        });
        wallMesh.instanceMatrix.needsUpdate = true;
        group.add(wallMesh);
        return wallMesh;
      });
      const wallMesh = wallMeshes[0] || null;
      const material = wallMaterials[0];
      const texture = wallTextures[0];
      const shell = new THREE.Mesh(
        new THREE.SphereGeometry(46, 18, 14),
        new THREE.MeshBasicMaterial({ color: 0x254050, transparent: true, opacity: 0.08, side: THREE.BackSide, depthWrite: false })
      );
      shell.name = "asteroid-inner-shell";
      shell.visible = false;
      shell.position.copy(center);
      group.add(shell);

      const crystalMaterial = new THREE.MeshBasicMaterial({ color: 0x66ffed });
      const crystalGeometry = new THREE.OctahedronGeometry(0.92, 1);
      const beaconMaterial = new THREE.MeshBasicMaterial({ color: 0xdbc17a });
      const beaconGeometry = new THREE.TorusGeometry(1.1, 0.12, 6, 20);
      const startNode = at(0, 1, 0);
      const exitNode = at(NX - 1, 1, NZ - 1);

      const routeParent = new Map([[startNode, null]]);
      const routeQueue = [startNode];
      for (let cursor = 0; cursor < routeQueue.length && !routeParent.has(exitNode); cursor += 1) {
        const here = routeQueue[cursor];
        dirs.forEach((dir) => {
          if (!here.open[dir.key]) return;
          const next = at(here.x + dir.x, here.y + dir.y, here.z + dir.z);
          if (routeParent.has(next)) return;
          routeParent.set(next, here);
          routeQueue.push(next);
        });
      }
      const routeCells = [];
      for (let node = exitNode; node && routeParent.has(node); node = routeParent.get(node)) routeCells.unshift(node);
      const isEndpoint = (cell) =>
        (cell.x === startNode.x && cell.y === startNode.y && cell.z === startNode.z) ||
        (cell.x === exitNode.x && cell.y === exitNode.y && cell.z === exitNode.z);
      let coreCandidates = routeCells.filter((cell) => !isEndpoint(cell));
      const middleRoute = coreCandidates.filter((cell) => cell.y === 1);
      if (middleRoute.length >= 3) coreCandidates = middleRoute;
      const crystalCells = [];
      [0.22, 0.50, 0.78].forEach((fraction) => {
        if (coreCandidates.length < 3) return;
        let index = Math.max(0, Math.min(coreCandidates.length - 1, Math.round((coreCandidates.length - 1) * fraction)));
        while (crystalCells.includes(coreCandidates[index]) && index < coreCandidates.length - 1) index += 1;
        if (crystalCells.includes(coreCandidates[index])) index = coreCandidates.findIndex((cell) => !crystalCells.includes(cell));
        if (index >= 0) crystalCells.push(coreCandidates[index]);
      });
      const fallbackCandidates = cells.filter((cell) => !isEndpoint(cell) && !crystalCells.includes(cell));
      while (crystalCells.length < 3 && fallbackCandidates.length) {
        crystalCells.push(fallbackCandidates.splice(Math.floor(rng() * fallbackCandidates.length), 1)[0]);
      }
      const crystals = [];
      crystalCells.slice(0, 3).forEach((cell, index) => {
        const mesh = new THREE.Mesh(crystalGeometry, crystalMaterial);
        mesh.position.copy(cellPosition(cell.x, cell.y, cell.z));
        mesh.position.y += 0.35;
        mesh.name = "core-shard-" + index;
        mesh.scale.setScalar(1.18);
        group.add(mesh);
        crystals.push({ mesh, taken: false, scouted: true, phase: rng() * Math.PI * 2, cell: { x: cell.x, y: cell.y, z: cell.z } });
      });
      const beacon = new THREE.Mesh(beaconGeometry, beaconMaterial);
      beacon.position.copy(cellPosition(exitNode.x, exitNode.y, exitNode.z));
      beacon.rotation.x = Math.PI / 2;
      beacon.scale.set(1.65, 1.65, 1.65);
      beacon.name = "return-warp-beacon";
      group.add(beacon);

      const satellites = [
        { offset: new THREE.Vector3(34, 3, 10), radius: 6.4 },
        { offset: new THREE.Vector3(-30, -7, 16), radius: 3.6 }
      ].map((rock, index) => {
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(rock.radius, 12, 9),
          wallMaterials[index % wallMaterials.length]
        );
        mesh.position.copy(center).add(rock.offset);
        mesh.name = "asteroid-satellite-" + index;
        group.add(mesh);
        return { position: mesh.position, radius: rock.radius, mesh: mesh };
      });

      scene.add(group);
      maze = {
        active: true,
        group,
        center,
        // The 2D Ring mode reuses this exact maze instance and topology, not a second RNG.
        seed,
        dimensions: { nx: NX, ny: NY, nz: NZ },
        startCell: { x: startNode.x, y: startNode.y, z: startNode.z },
        exitCell: { x: exitNode.x, y: exitNode.y, z: exitNode.z },
        cells,
        walls,
        wallMesh,
        wallMeshes,
        shell,
        crystals,
        beacon,
        start: cellPosition(startNode.x, startNode.y, startNode.z),
        exit: cellPosition(exitNode.x, exitNode.y, exitNode.z),
        count: 0,
        sinceStatus: 0,
        texture,
        textures: wallTextures.concat(fallbackTexture === texture ? [] : [fallbackTexture]),
        wallTextureCopiesByAsset,
        material,
        materials: wallMaterials,
        wallVariantMaterials,
        wallVariantTextures,
        geometry: unit,
        crystalGeometry,
        crystalMaterial,
        beaconGeometry,
        beaconMaterial,
        satellites,
        // Wide enough to fly around the asteroid and its satellites.
        // Wall-contact damping stays the 0.11.2 baseline; only the envelope grew.
        flyRadius: 160,
        lastPosition: null,
        lastImpactAt: 0,
        ringCompleted: false,
        hydrogen: {
          cell: { x: startNode.x, y: startNode.y, z: startNode.z },
          unlocked: !!window.BCMWorldMission?.hydrogenUnlocked,
          taken: !!window.BCMWorldMission?.hydrogenCollected,
          scouted: false
        }
      };
      if (window.BCMWorldMission) {
        window.BCMWorldMission.asteroidSeed = seed;
      }
      state.savedSpeedMode = engine.getSpeedMode ? engine.getSpeedMode() : 1;
      if (engine.setSpeedMode) engine.setSpeedMode(2);
      state.maze = maze;
      maze.pickupEffects = [];

      // Wall-mounted crystal deposits are purely decorative. Their placement
      // uses a separate seed stream so it cannot alter maze topology, exits,
      // Hydrogen cells, wall textures or the existing collision list.
      function attachAsteroidWallCrystals() {
        const decorationGroup = new THREE.Group();
        decorationGroup.name = "asteroid-wall-crystal-decorations";
        maze.wallCrystalGroup = decorationGroup;
        group.add(decorationGroup);

        const placementRng = randomFrom(hashSeed(String(seed) + "|wall-crystal-layout"));
        const endpoint = (cell, point) => !!cell && !!point &&
          cell.x === point.x && cell.y === point.y && cell.z === point.z;
        const byCell = new Map();

        walls.forEach((wall) => {
          const cell = wall && wall.cell;
          if (!cell || endpoint(cell, maze.startCell) || endpoint(cell, maze.exitCell)) return;

          // Only the vertical side panels are decorated. Floor/ceiling panels
          // and passage openings stay visually clear.
          if (wall.sy <= Math.min(wall.sx, wall.sz)) return;
          const key = cell.x + ":" + cell.y + ":" + cell.z;
          if (!byCell.has(key)) byCell.set(key, []);
          byCell.get(key).push(wall);
        });

        // Prefer the first traversable route cells across all heights so the pilot can
        // see a deposit early in the asteroid run. This only ranks the existing
        // wall list; route generation and its seeded RNG are not modified.
        const routeIndexByCell = new Map();
        routeCells.forEach((cell, index) => {
          routeIndexByCell.set(cell.x + ":" + cell.y + ":" + cell.z, index);
        });
        const candidates = [];
        byCell.forEach((cellWalls, key) => {
          const routeIndex = routeIndexByCell.get(key);
          if (Number.isFinite(routeIndex) && routeIndex <= 0) return;
          if (!cellWalls.length) return;
          const pick = Math.floor(placementRng() * cellWalls.length);
          const onRoute = Number.isFinite(routeIndex);
          candidates.push({
            wall: cellWalls[pick],
            routeIndex: onRoute ? routeIndex : null,
            routePriority: onRoute ? 0 : 1,
            sortSalt: placementRng()
          });
        });
        // Use the main route first, then fill other eligible cells across the maze
        // if it has fewer than twelve panels. The wall list remains read-only.
        candidates.sort((a, b) =>
          a.routePriority - b.routePriority ||
          (a.routeIndex ?? Number.MAX_SAFE_INTEGER) - (b.routeIndex ?? Number.MAX_SAFE_INTEGER) ||
          a.sortSalt - b.sortSalt
        );

        const placementCount = Math.min(12, candidates.length);
        // Rotate the four-colour palette by one seeded offset. A full set of
        // four deposits therefore shows all four authored variants, while the
        // asteroid seed still changes which colour appears first.
        const paletteOffset = Math.floor(placementRng() * asteroidWallCrystalColors.length);
        const placements = candidates.slice(0, placementCount).map((candidate, index) => {
          const wall = candidate.wall;
          const routeIndex = candidate.routeIndex;
          const cellCenter = cellPosition(wall.cell.x, wall.cell.y, wall.cell.z);
          const inward = cellCenter.sub(new THREE.Vector3(wall.x, wall.y, wall.z));
          inward.y = 0;
          if (inward.lengthSq() < 1e-6) return null;
          inward.normalize();

          const up = new THREE.Vector3(0, 1, 0);
          // The separate crystal GLBs retain their shared source coordinates.
          // Their growth axis is local +Z; map it out from the wall and keep +Y vertical.
          const tangent = up.clone().cross(inward).normalize();
          const basis = new THREE.Matrix4().makeBasis(tangent, up, inward);
          const quaternion = new THREE.Quaternion().setFromRotationMatrix(basis);
          const wallThickness = Math.min(wall.sx, wall.sz);
          const scale = 0.60 + placementRng() * 0.07;
          const color = asteroidWallCrystalColors[(index + paletteOffset) % asteroidWallCrystalColors.length];
          const position = new THREE.Vector3(wall.x, wall.y, wall.z)
            .addScaledVector(inward, wallThickness * 0.5 - 0.08)
            .addScaledVector(tangent, (placementRng() - 0.5) * 2.4)
            .addScaledVector(up, (placementRng() - 0.5) * 1.6);
          return { wall, position, quaternion, scale, routeIndex, color, index };
        }).filter(Boolean);

        maze.wallCrystalPlacementCount = placements.length;
        maze.wallCrystalPlacements = placements.map((placement) => ({
          cell: { x: placement.wall.cell.x, y: placement.wall.cell.y, z: placement.wall.cell.z },
          routeIndex: placement.routeIndex,
          color: placement.color
        }));
        if (!placements.length) {
          group.remove(decorationGroup);
          maze.wallCrystalGroup = null;
          return;
        }

        Promise.all(placements.map((placement) =>
          loadAsteroidWallCrystalTemplate(THREE, placement.color)
            .then((template) => ({ placement, template }))
        )).then((loaded) => {
          // A load may finish after the pilot has left and disposed this maze.
          if (!maze.active || state.maze !== maze || decorationGroup.parent !== group) return;
          loaded.forEach(({ placement, template }) => {
            const model = template.clone(true);
            model.name = "asteroid-wall-crystal-" + placement.index;
            model.position.copy(placement.position);
            model.quaternion.copy(placement.quaternion);
            model.scale.setScalar(placement.scale);
            model.userData.bcmWallDecoration = true;
            model.userData.bcmWallColor = placement.color;
            model.userData.bcmWallCell = { x: placement.wall.cell.x, y: placement.wall.cell.y, z: placement.wall.cell.z };
            model.userData.bcmWallRouteIndex = placement.routeIndex;
            model.userData.bcmWallScale = placement.scale;
            model.traverse((node) => {
              if (!node || !node.isMesh) return;
              node.frustumCulled = true;
              node.castShadow = false;
              node.receiveShadow = false;
            });
            decorationGroup.add(model);
          });
          maze.wallCrystalCount = loaded.length;
        }).catch((error) => {
          if (decorationGroup.parent === group) group.remove(decorationGroup);
          if (maze.wallCrystalGroup === decorationGroup) maze.wallCrystalGroup = null;
          maze.wallCrystalCount = 0;
          try { console.warn("[BCM] Asteroid wall crystal model was skipped:", error); } catch (e) {}
        });
      }

      attachAsteroidWallCrystals();
      publishAsteroidChart(maze);
      function spawnCrystalPickupEffect(position, pickupLabel) {
        const effect = new THREE.Group();
        effect.name = "asteroid-crystal-pickup-impact";
        effect.position.copy(position);
        const glowMaterial = new THREE.MeshBasicMaterial({
          color: 0xbafcff, transparent: true, opacity: 0.98,
          blending: THREE.AdditiveBlending, depthWrite: false
        });
        const ringMaterial = new THREE.MeshBasicMaterial({
          color: 0x5befff, transparent: true, opacity: 0.92,
          blending: THREE.AdditiveBlending, depthWrite: false
        });
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), glowMaterial);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.055, 6, 24), ringMaterial);
        ring.rotation.x = Math.PI * 0.34;
        effect.add(core, ring);
        const light = new THREE.PointLight(0x74f6ff, 3.8, 12, 2);
        effect.add(light);

        // A world-space label makes mission pickups obvious even when the HUD is small.
        const labelCanvas = document.createElement("canvas");
        labelCanvas.width = 320;
        labelCanvas.height = 112;
        const ctx = labelCanvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, labelCanvas.width, labelCanvas.height);
          ctx.font = "bold 64px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.lineJoin = "round";
          ctx.lineWidth = 14;
          ctx.strokeStyle = "rgba(2, 15, 26, 0.95)";
          ctx.strokeText(pickupLabel || "CORE +1", 160, 56);
          ctx.fillStyle = pickupLabel === "H +1" ? "#bafff1" : "#a9f5ff";
          ctx.fillText(pickupLabel || "CORE +1", 160, 56);
        }
        const labelTexture = new THREE.CanvasTexture(labelCanvas);
        labelTexture.needsUpdate = true;
        const labelMaterial = new THREE.SpriteMaterial({
          map: labelTexture, transparent: true, depthWrite: false, opacity: 1
        });
        const labelSprite = new THREE.Sprite(labelMaterial);
        labelSprite.position.set(0, 1.55, 0);
        labelSprite.scale.set(3.6, 1.25, 1);
        effect.add(labelSprite);

        scene.add(effect);
        maze.pickupEffects.push({
          group: effect, core, ring, light, glowMaterial, ringMaterial,
          labelSprite, labelMaterial, labelTexture, age: 0, duration: 1.15
        });
      }
      function updateCrystalPickupEffects(dt) {
        maze.pickupEffects = maze.pickupEffects.filter((effect) => {
          effect.age += dt;
          const t = Math.min(1, effect.age / effect.duration);
          effect.ring.scale.setScalar(0.55 + t * 6.6);
          effect.ring.rotation.z += dt * 4.0;
          effect.core.scale.setScalar(0.6 + (1 - t) * 2.8);
          effect.glowMaterial.opacity = Math.max(0, (1 - t) * 0.98);
          effect.ringMaterial.opacity = Math.max(0, (1 - t) * 0.96);
          effect.light.intensity = Math.max(0, (1 - t) * 3.8);
          if (effect.labelSprite) {
            effect.labelSprite.position.y = 1.55 + t * 2.2;
            effect.labelMaterial.opacity = Math.max(0, 1 - t * 0.92);
            effect.labelSprite.scale.set(3.6 + t * 0.75, 1.25 + t * 0.22, 1);
          }
          if (t >= 1) {
            scene.remove(effect.group);
            effect.group.traverse((child) => { if (child.geometry) child.geometry.dispose(); });
            effect.glowMaterial.dispose();
            effect.ringMaterial.dispose();
            if (effect.labelMaterial) effect.labelMaterial.dispose();
            if (effect.labelTexture) effect.labelTexture.dispose();
            return false;
          }
          return true;
        });
      }
      maze.spawnCrystalPickupEffect = spawnCrystalPickupEffect;
      maze.updateCrystalPickupEffects = updateCrystalPickupEffects;
      state.ringApproachArmed = true;
      root.classList.add("bcm-warp-maze-active");
      exitButton.textContent = nextWarpDestinationLabel();
      exitButton.hidden = false;
      overlay.hidden = true;
      root.classList.remove("bcm-warp-open");
      launchButton.classList.remove("is-active");

      // The main physics resumes in this scene. The seeded maze uses a small number of
      // instanced wall batches and up to four asterwall textures, with a tiny procedural fallback.
      // Cell +Z index is world −Z, the ship's forward at yaw 0. Face whichever
      // side the carve actually opened, including up/down, so spawn is not a wall.
      const spawn = maze.start.clone();
      const look = new THREE.Quaternion();
      if (startNode.open.zp) {
        spawn.z -= 0.45;
      } else if (startNode.open.xp) {
        look.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2);
        spawn.x += 0.45;
      } else if (startNode.open.xn) {
        look.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
        spawn.x -= 0.45;
      } else if (startNode.open.yp) {
        look.setFromEuler(new THREE.Euler(1.05, 0, 0, "YXZ"));
        spawn.y += 0.45;
      } else if (startNode.open.yn) {
        look.setFromEuler(new THREE.Euler(-1.05, 0, 0, "YXZ"));
        spawn.y -= 0.45;
      } else if (startNode.open.zn) {
        look.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
        spawn.z += 0.45;
      }
      engine.teleport({ x: spawn.x, y: spawn.y, z: spawn.z }, look);
      engine.pauseForWarp(false);
      commitArrival(asteroidPlace(state.target), state.target);
      engine.setExternalHUD(state.place.label, "EXPEDITION · CORE SHARDS 0/3 · U / R3 OPENS THE HOLD");
      maze.lastPosition = runtime.ship.position.clone();
      state.mode = "maze";
      state.lastStatusAt = 0;
      window.BCMDeepSpaceWarpFrame = updateMazeFrame;
    }

    function updateMazeFrame(frame) {
      const maze = state.maze;
      if (!maze || !maze.active || !frame || !frame.ship) return;
      const ship = frame.ship;
      const pos = ship.position;
      const radius = 0.7;

      // Ring gameplay replaces the flight view. The hold does not: the helm
      // keeps flying the same ship, so maze collision stays active.
      if (state.ringPlatformer || state.ringTransitionActive) {
        if (frame.camera) {
          frame.camera.position.copy(pos);
          frame.camera.quaternion.copy(ship.quaternion);
        }
        if (ship.visual) {
          ship.visual.position.copy(pos);
          ship.visual.quaternion.copy(ship.quaternion);
        }
        maze.lastPosition.copy(pos);
        return;
      }

      // Only test wall panels close to the craft; distant cells cost almost nothing per frame.
      for (let pass = 0; pass < 2; pass += 1) {
        for (let i = 0; i < maze.walls.length; i += 1) {
          const w = maze.walls[i];
          const hx = w.sx / 2 + radius, hy = w.sy / 2 + radius, hz = w.sz / 2 + radius;
          if (Math.abs(pos.x - w.x) > hx + 1.2 || Math.abs(pos.y - w.y) > hy + 1.2 || Math.abs(pos.z - w.z) > hz + 1.2) continue;
          const px = hx - Math.abs(pos.x - w.x);
          const py = hy - Math.abs(pos.y - w.y);
          const pz = hz - Math.abs(pos.z - w.z);
          if (px <= 0 || py <= 0 || pz <= 0) continue;
          const impactSpeed = ship.velocity.length();
          const impactNow = performance.now();
          if (impactSpeed > 3.0 && impactNow - maze.lastImpactAt > 650) {
            maze.lastImpactAt = impactNow;
            const compartmentId = pos.x < maze.center.x - 5.4 ? 1 : (pos.x > maze.center.x + 5.4 ? 3 : 2);
            const damage = Math.max(4, Math.min(24, Math.round((impactSpeed - 2.0) * 4.4)));
            const damaged = window.BCMHullRepairState?.triggerExternalImpact?.(compartmentId, damage);
            if (damaged) {
              setMazeStatus("IMPACT · " + damaged.name + " · INTEGRITY " + Math.round(damaged.integrity) + "% · HIT " + damage);
            }
          }
          if (px <= py && px <= pz) {
            pos.x = w.x + (pos.x >= w.x ? 1 : -1) * (hx + 0.015);
            ship.velocity.x *= 0.15;
          } else if (py <= pz) {
            pos.y = w.y + (pos.y >= w.y ? 1 : -1) * (hy + 0.015);
            ship.velocity.y *= 0.15;
          } else {
            pos.z = w.z + (pos.z >= w.z ? 1 : -1) * (hz + 0.015);
            ship.velocity.z *= 0.15;
          }
        }
      }

      const fromCenter = pos.clone().sub(maze.center);
      const flyRadius = Number(maze.flyRadius) || 160;
      if (fromCenter.length() > flyRadius) {
        fromCenter.setLength(flyRadius);
        pos.copy(maze.center).add(fromCenter);
        ship.velocity.multiplyScalar(0.25);
      }
      (maze.satellites || []).forEach((rock) => {
        const away = pos.clone().sub(rock.position);
        const limit = rock.radius + 1.05;
        if (away.length() >= limit) return;
        if (away.lengthSq() < 1e-6) away.set(1, 0, 0);
        away.setLength(limit);
        pos.copy(rock.position).add(away);
        ship.velocity.multiplyScalar(0.45);
      });

      // Local artificial gravity activates near the gold ring, with a smooth falloff.
      const ringVector = maze.beacon.position.clone().sub(pos);
      const approachDistance = ringVector.length();
      state.ringDistance = approachDistance;
      if (approachDistance < 22 && approachDistance > 2.65) {
        const falloff = Math.max(0, 1 - approachDistance / 22);
        ringVector.normalize();
        ship.velocity.addScaledVector(ringVector, (frame.dt || 0.016) * (0.25 + falloff * falloff * 1.8));
      }

      maze.crystals.forEach((crystal) => {
        if (crystal.taken) return;
        crystal.mesh.rotation.y += Math.min(frame.dt || 0.016, 0.04) * 1.35;
        crystal.mesh.position.y += Math.sin(performance.now() * 0.002 + crystal.phase) * 0.001;
        if (!crystal.scouted && pos.distanceTo(crystal.mesh.position) < 8) {
          crystal.scouted = true;
          publishAsteroidChart(maze);
          setMazeStatus("CHART MARK · CORE SHARD " + (crystal.cell.x + 1) + "." + (crystal.cell.z + 1));
        }
        if (pos.distanceTo(crystal.mesh.position) < 2.0) {
          const pickupPosition = crystal.mesh.position.clone();
          crystal.taken = true;
          crystal.scouted = true;
          crystal.mesh.visible = false;
          maze.count += 1;
          publishAsteroidChart(maze);
          const mission = window.BCMWorldMission || {};
          const isHydrogenPickup = !!mission.hydrogenUnlocked &&
            Number(mission.hydrogenCount || 0) < 3;
          maze.spawnCrystalPickupEffect(pickupPosition, isHydrogenPickup ? "H +1" : "CORE +1");
          if (isHydrogenPickup) {
            window.dispatchEvent(new CustomEvent("bcm:mission:hydrogen-shard-collected", {
              detail: {
                crystalId: String(maze.seed) + ":" + crystal.cell.x + "," + crystal.cell.y + "," + crystal.cell.z,
                asteroidSeed: maze.seed,
                cell: { ...crystal.cell },
                type: "asteroid-crystal"
              }
            }));
            const count = Number(window.BCMWorldMission?.hydrogenCount || 0);
            setMazeStatus("HYDROGEN " + count + "/3 · " + Math.max(0, 3 - count) + " LEFT");
          } else {
            setMazeStatus("CORE SHARDS " + maze.count + "/3 · " + (maze.count === 3 ? "GOLD RING IS OPEN" : "SEARCH THE CONNECTED CORRIDORS"));
          }
        }
      });
      maze.updateCrystalPickupEffects(Math.min(frame.dt || 0.016, 0.04));
      maze.beacon.rotation.z += Math.min(frame.dt || 0.016, 0.04) * 0.4;
      const ringDistance = pos.distanceTo(maze.beacon.position);
      state.ringDistance = ringDistance;
      syncHullButtonVisibility();
      syncRingButtonVisibility();
      // Require the ship to leave the beacon's capture radius after exiting Ring
      // before accepting another approach; the same level can still be re-entered.
      if (ringDistance > 4.2) {
        state.ringApproachArmed = true;
        state.ringEntryFailed = false;
      }
      if (state.ringApproachArmed && !state.ringEntryFailed && !state.ringPlatformer &&
          !maze.ringCompleted && ringDistance < 2.6) {
        attemptOpenRingPlatformer(maze);
        return;
      }

      if (frame.camera) {
        frame.camera.position.copy(pos);
        frame.camera.quaternion.copy(ship.quaternion);
      }
      if (ship.visual) {
        ship.visual.position.copy(pos);
        ship.visual.quaternion.copy(ship.quaternion);
      }
      maze.lastPosition.copy(pos);
      if (performance.now() - maze.sinceStatus > 1300) {
        maze.sinceStatus = performance.now();
        const message = state.ringDistance < 22
          ? "RING AHEAD · THE LEVEL IS OPTIONAL · HELM STILL FLIES THE SHIP"
          : "EXPEDITION · CORE SHARDS " + maze.count + "/3 · ASTEROID COMPLEX";
        setMazeStatus(message);
      }
    }

    function disposeMaze() {
      const maze = state.maze;
      if (!maze) return;
      maze.active = false;
      if (maze.group && maze.group.parent) maze.group.parent.remove(maze.group);
      for (const mesh of maze.wallMeshes || [maze.wallMesh]) {
        try { mesh?.dispose?.(); } catch (e) {}
      }
      try { maze.geometry.dispose(); } catch (e) {}
      for (const material of new Set([...(maze.materials || [maze.material]), ...(maze.wallVariantMaterials || [])])) {
        try { material?.dispose?.(); } catch (e) {}
      }
      for (const texture of new Set([...(maze.textures || [maze.texture]), ...(maze.wallVariantTextures || [])])) {
        try { texture?.dispose?.(); } catch (e) {}
      }
      try { maze.shell.geometry.dispose(); } catch (e) {}
      try { maze.shell.material.dispose(); } catch (e) {}
      try { maze.crystalGeometry.dispose(); } catch (e) {}
      try { maze.crystalMaterial.dispose(); } catch (e) {}
      try { maze.beaconGeometry.dispose(); } catch (e) {}
      try { maze.beaconMaterial.dispose(); } catch (e) {}
      state.maze = null;
    }


    return { enter: enterAsteroidMaze, update: updateMazeFrame,
      dispose: disposeMaze, publishChart: publishAsteroidChart };
  }
  window.BCMAsteroidMazeLocation = Object.freeze({ create });
})(window);
