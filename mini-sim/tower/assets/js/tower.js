(() => {
  "use strict";

  const CONFIG = window.BCMTowerConfig || {};
  if (!Array.isArray(CONFIG.assets) && Array.isArray(window.BCMMiniSimConfig?.assets)) CONFIG.assets = window.BCMMiniSimConfig.assets;
  const TOWER_VERSION = "0.2.24";
  const THREE_URL = CONFIG.threeUrl || "";

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (window.THREE) return resolve();
      if (!src) return reject(new Error("Three.js URL missing"));
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error("Three.js load failed"));
      document.head.appendChild(script);
    });
  }

  function mulberry32(seed) {
    return function () {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeSeed() {
    const a = new Uint32Array(3);
    if (window.crypto?.getRandomValues) {
      window.crypto.getRandomValues(a);
      return (a[0] ^ a[1] ^ a[2]) >>> 0;
    }
    return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function wrapSector(s, count) {
    return ((s % count) + count) % count;
  }

  function configAssets() {
    const list = Array.isArray(CONFIG.assets)
      ? CONFIG.assets
      : Array.isArray(CONFIG.assetList)
        ? CONFIG.assetList
        : [];
    return list.filter((item) => item && typeof item === "object");
  }

  function assetPool(name) {
    const explicit = Array.isArray(CONFIG[name]) ? CONFIG[name].filter(Boolean) : [];
    if (explicit.length) return explicit;

    const aliases = {
      upperPlatformPool: /(^|\/)upperplatform(?:\d+)?\.(?:jpe?g|png)$/i,
      hMarkerPool: /(^|\/)H1?(?:\d*)\.png$/i,
      landingPool: /(^|\/)H1?(?:\d*)\.png$/i
    };
    const re = aliases[name];
    if (!re) return [];
    return configAssets()
      .filter((item) => re.test(String(item.name || item.url || "")))
      .map((item) => String(item.url || ""))
      .filter(Boolean);
  }

  function rasterUrl(url) {
    return /\.(?:png|jpe?g|webp)(?:[?#].*)?$/i.test(String(url || ""));
  }

  function pick(pool, rand) {
    if (!pool.length) return "";
    return pool[Math.floor(rand() * pool.length)];
  }

  function angleDelta(a, b) {
    let d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  function assetTexture(url, renderer, options = {}) {
    if (!url || !window.THREE) return null;
    options = options && typeof options === "object" ? options : {};

    const cleanKey = options.removeWhite ? "|whitekey" : "";
    const cacheKey = String(url) + cleanKey;
    const cache = assetTexture.cache || (assetTexture.cache = new Map());
    if (cache.has(cacheKey)) return cache.get(cacheKey);

    let tex;

    if (options.removeWhite && rasterUrl(url)) {
      // Some of the supplied PNG cards contain an opaque white matte instead
      // of real alpha. Remove only near-white pixels and preserve antialiased
      // edges so doors, NPCs and landing cards behave as cut-outs.
      const canvas = document.createElement("canvas");
      canvas.width = 2;
      canvas.height = 2;
      tex = new THREE.CanvasTexture(canvas);

      const image = new Image();
      image.crossOrigin = "anonymous";
      image.decoding = "async";
      image.onload = () => {
        try {
          canvas.width = image.naturalWidth || image.width;
          canvas.height = image.naturalHeight || image.height;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) return;

          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

          const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const pixels = frame.data;
          for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            const a = pixels[i + 3];

            if (!a) continue;

            const nearWhite = Math.min(r, g, b) >= 246 && Math.max(r, g, b) <= 255;
            const softWhite = Math.min(r, g, b) >= 232;
            if (nearWhite) {
              pixels[i + 3] = 0;
            } else if (softWhite) {
              const fade = Math.max(0, Math.min(1, (246 - Math.min(r, g, b)) / 14));
              pixels[i + 3] = Math.round(a * fade);
            }
          }

          ctx.putImageData(frame, 0, 0);
          tex.needsUpdate = true;
        } catch (error) {
          console.warn("Tower PNG alpha cleanup failed", url, error);
        }
      };
      image.src = url;
    } else {
      tex = new THREE.TextureLoader().load(url);
    }

    if ("colorSpace" in tex && THREE.SRGBColorSpace !== undefined) {
      tex.colorSpace = THREE.SRGBColorSpace;
    } else if (THREE.sRGBEncoding !== undefined) {
      tex.encoding = THREE.sRGBEncoding;
    }

    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapS = options.repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    tex.wrapT = options.repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;

    if (options.repeat) {
      tex.repeat.set(options.repeatX || 1, options.repeatY || 1);
    }

    cache.set(cacheKey, tex);
    return tex;
  }

  function makeMaterial(tex, color = 0xffffff, transparent = false, alphaTest = 0.0) {
    return new THREE.MeshStandardMaterial({
      map: tex || null,
      color: tex ? 0xffffff : color,
      roughness: 0.84,
      metalness: 0.08,
      transparent,
      alphaTest,
      depthWrite: !transparent,
      side: transparent ? THREE.DoubleSide : THREE.FrontSide
    });
  }

  function generateTower(seed, options = {}) {
    const rand = mulberry32(seed);
    const sectors = options.sectors || 18;
    const levels = options.levels || 46;
    const stepY = options.stepY || 4;
    const cells = new Map();
    const path = [];
    const doors = [];

    function key(level, sector) {
      return level + ":" + wrapSector(sector, sectors);
    }

    function setCell(level, sector, patch) {
      const s = wrapSector(sector, sectors);
      const k = key(level, s);
      const old = cells.get(k) || {
        level,
        sector: s,
        surface: "platform",
        object: null,
        phase: rand() * Math.PI * 2
      };
      const next = Object.assign(old, patch);
      cells.set(k, next);
      return next;
    }

    let sector = Math.floor(rand() * sectors);
    path.push(sector);
    setCell(levels - 1, sector, {
      surface: "upper",
      object: "landing"
    });

    for (let level = levels - 2; level >= 0; level--) {
      const maxDelta = level % 5 === 0 ? 2 : 1;
      let delta = 0;
      if (rand() < 0.78) {
        const signs = rand() < 0.5 ? -1 : 1;
        delta = signs * (1 + Math.floor(rand() * maxDelta));
      }
      sector = wrapSector(sector + delta, sectors);
      path.push(sector);

      // Guaranteed route never gets a lethal surface.
      const routeSurface = rand() < 0.13 ? "ice" : "platform";
      setCell(level, sector, {
        surface: level < 2 ? "upper" : routeSurface,
        object: level === 0 ? "landing" : null
      });
    }

    for (let level = 0; level < levels; level++) {
      const routeSector = path[levels - 1 - level];
      const sideCount = 1 + Math.floor(rand() * 3);

      for (let i = 0; i < sideCount; i++) {
        const delta = (rand() < 0.5 ? -1 : 1) * (1 + Math.floor(rand() * 4));
        const s = wrapSector(routeSector + delta, sectors);
        const k = key(level, s);
        if (cells.has(k)) continue;

        const roll = rand();
        let surface = "platform";
        if (roll < 0.13) surface = "rock";
        else if (roll < 0.25) surface = "ice";
        else if (roll < 0.33) surface = "hot";
        else if (roll < 0.38) surface = "lava";
        else if (roll < 0.49) surface = "lift";

        setCell(level, s, { surface });
      }

      // Boxes, doors and test NPCs are objects placed on existing surfaces.
      const objectRoll = rand();
      if (level > 2 && level < levels - 3 && objectRoll < 0.30) {
        const objectSector = wrapSector(routeSector + (rand() < 0.5 ? -2 : 2), sectors);
        const target = cells.get(key(level, objectSector));
        if (target) {
          if (objectRoll < 0.09) target.object = "dangerbox";
          else if (objectRoll < 0.18) target.object = "safebox";
          else if (objectRoll < 0.24) target.object = "fire";
          else target.object = "npc";
        }
      }

      if (level > 4 && level < levels - 6 && rand() < 0.055) {
        // Each door is paired with a real door on the opposite side of the
        // tower at the same level, creating a passage through the cylinder.
        const doorSector = wrapSector(
          routeSector + (rand() < 0.5 ? -3 : 3),
          sectors
        );
        const oppositeSector = wrapSector(
          doorSector + Math.floor(sectors / 2),
          sectors
        );
        const target = cells.get(key(level, doorSector));
        let opposite = cells.get(key(level, oppositeSector));
        if (!opposite) {
          opposite = setCell(level, oppositeSector, { surface: "platform" });
        }
        if (target && !target.object && opposite && !opposite.object) {
          target.object = "door";
          opposite.object = "door";
          doors.push(target, opposite);
        }
      }

      if (level > 5 && level < levels - 5 && rand() < 0.04) {
        const wallDoorSector = wrapSector(routeSector + (rand() < 0.5 ? -4 : 4), sectors);
        const target = cells.get(key(level, wallDoorSector));
        if (target && !target.object) target.object = "walldoor";
      }
    }

    // Guarantee visible, reachable opposite doors at several depths.
    // They sit on the generated safe path, so the player can actually discover
    // the passage instead of waiting for a rare side-cell roll.
    for (const forcedLevel of [8, 18, 28, 38]) {
      if (forcedLevel <= 4 || forcedLevel >= levels - 3) continue;

      const routeSector = path[levels - 1 - forcedLevel];
      if (routeSector == null) continue;

      const oppositeSector = wrapSector(routeSector + Math.floor(sectors / 2), sectors);
      const from = setCell(forcedLevel, routeSector, {
        surface: cells.get(key(forcedLevel, routeSector))?.surface || "platform",
        object: "door"
      });
      const to = setCell(forcedLevel, oppositeSector, {
        surface: "platform",
        object: "door"
      });

      from.doorPair = to;
      to.doorPair = from;
      if (!doors.includes(from)) doors.push(from);
      if (!doors.includes(to)) doors.push(to);
    }

    if (doors.length >= 2) {
      for (let i = 0; i + 1 < doors.length; i += 2) {
        if (!doors[i].doorPair) doors[i].doorPair = doors[i + 1];
        if (!doors[i + 1].doorPair) doors[i + 1].doorPair = doors[i];
      }
    }

    const planetMap = Array.isArray(CONFIG.planetMaps) && CONFIG.planetMaps.length
      ? CONFIG.planetMaps[Math.floor(rand() * CONFIG.planetMaps.length)]
      : "";

    return {
      seed,
      sectors,
      levels,
      stepY,
      cells,
      path,
      doors,
      planetMap
    };
  }

  function boot(root) {
    if (root.dataset.bcmTowerBooted === "1") return;
    root.dataset.bcmTowerBooted = "1";

    const canvas = root.querySelector(".bcm-tower-canvas");
    const menu = root.querySelector(".bcm-tower-menu");
    const modeButtons = [...root.querySelectorAll("[data-tower-mode]")];
    const status = root.querySelector(".bcm-tower-status");
    const levelEl = root.querySelector(".bcm-tower-level");
    const modeEl = root.querySelector(".bcm-tower-mode");
    const crewEl = root.querySelector(".bcm-tower-crew");
    const restartButton = root.querySelector(".bcm-tower-restart");
    const transition = root.querySelector(".bcm-tower-transition");
    const transitionVideo = root.querySelector(".bcm-tower-transition-video");
    const transitionClose = root.querySelector(".bcm-tower-transition-close");
    const mobile = root.querySelector(".bcm-tower-mobile");
    const divider = root.querySelector(".bcm-tower-split-divider");
    const p1Label = root.querySelector(".bcm-tower-split-p1");
    const p2Label = root.querySelector(".bcm-tower-split-p2");
    const inline = root.querySelector(".bcm-tower-inline-config");

    if (!canvas || !window.THREE) return;

    let doorTransitLayers = [0, 1].map((index) => {
      const layer = document.createElement("div");
      layer.className = "bcm-tower-door-transition bcm-tower-door-p" + (index + 1);
      layer.hidden = true;
      layer.innerHTML = '<div class="bcm-tower-door-transition-card"></div><div class="bcm-tower-door-transition-text">ПЕРЕХОД</div>';
      root.appendChild(layer);
      return layer;
    });

    let inlineConfig = {};
    try {
      inlineConfig = JSON.parse(inline?.textContent || "{}");
    } catch (e) {}

    function syncCrewSelectionFromMiniSim() {
      const selected = window.BCMMiniCrewSelection?.players;
      if (!Array.isArray(selected) || selected.length < 2) return false;

      crewRoster = selected.slice(0, 2).map((crew, index) => ({
        id: String(crew.id || crew.mint || ("crew-" + index)),
        mint: String(crew.mint || ""),
        name: String(crew.name || ("Crew " + (index + 1))),
        image: String(crew.image || ""),
        source: crew.source || "mini-sim",
        traits: Array.isArray(crew.traits) ? crew.traits : [],
        characteristics: crew.characteristics && typeof crew.characteristics === "object" ? crew.characteristics : {},
        raw: crew.raw && typeof crew.raw === "object" ? crew.raw : null,
        seats: String(crew.seats || ""),
        ocean: String(crew.ocean || ""),
        mission: String(crew.mission || "")
      }));

      for (let i = 0; i < 2; i++) {
        if (crewRoster[i]) crewSlots[i].crewId = crewRoster[i].id;
      }

      return true;
    }

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      powerPreference: "high-performance"
    });

    if (CONFIG.backgroundMenu) {
      root.style.setProperty(
        "--bcm-tower-background-image",
        'url("' + String(CONFIG.backgroundMenu).replace(/"/g, "\\\"") + '")'
      );
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.autoClear = false;

    if ("outputColorSpace" in renderer && THREE.SRGBColorSpace !== undefined) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    } else if ("outputEncoding" in renderer && THREE.sRGBEncoding !== undefined) {
      renderer.outputEncoding = THREE.sRGBEncoding;
    }

    const scene = new THREE.Scene();
    // Transparent WebGL clear lets the diagnostic CSS background remain visible
    // even when Tower geometry/textures fail.
    scene.background = null;
    scene.fog = new THREE.Fog(0x02050a, 70, 190);

    scene.add(new THREE.HemisphereLight(0xaad8ff, 0x061018, 1.25));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(5, 22, 12);
    scene.add(keyLight);

    let towerRoot = new THREE.Group();
    scene.add(towerRoot);

    let tower = null;
    let seed = null;
    let mode = null;
    let gameStarted = false;
    let transitionStarted = false;
    let towerAudio = null;

    let wallMesh = null;
    let platformMeshes = [];
    let objectMeshes = [];
    let wallCapMeshes = [];
    let playerMarkers = [];
    let playerSprites = [];
    let playerTextures = [null, null];
    let birds = [];

    const radius = 8.4;
    // Tower gameplay is on the OUTSIDE skin of the cylinder. The player stays
    // on the circumference while the camera follows just outside it.
    const playerWallRadius = radius + 1.05;
    const cameraRadius = radius + 8.0;
    const gravity = 28;
    // One jump must reach the next 4-unit level. The second jump remains
    // slightly weaker so it extends the first jump without turning the game
    // into unrestricted vertical flight.
    const jumpVelocity = 15.0;
    const doubleJumpVelocity = 11.25;
    const fallResetSpeed = 23.0;
    const baseTurnSpeed = 2.2;
    const trimPower = 10.5;
    const sectorWidth = () => tower ? Math.PI * 2 / tower.sectors : Math.PI / 9;

    const controls = [
      { left: false, right: false, up: false, down: false, jump: false, interact: false },
      { left: false, right: false, up: false, down: false, jump: false, interact: false }
    ];

    const edgeState = [
      { jump: false, interact: false, restart: false },
      { jump: false, interact: false, restart: false }
    ];
    const gamepadPresent = [false, false];

    const players = [
      {
        y: 0, vy: 0, angle: 0, radial: 0, jumps: 0, grounded: false,
        currentCell: null, liftRide: null, hazard: 0, slide: 0, finished: false,
        doorCooldown: 0, collected: 0, jumpStarted: false, fallStartY: null,
        maxFallSpeed: 0, birdHitCooldown: 0, visualFacing: 1, visualAngle: 0
      },
      {
        y: 0, vy: 0, angle: 0, radial: 0, jumps: 0, grounded: false,
        currentCell: null, liftRide: null, hazard: 0, slide: 0, finished: false,
        doorCooldown: 0, collected: 0, jumpStarted: false, fallStartY: null,
        maxFallSpeed: 0, birdHitCooldown: 0, visualFacing: 1, visualAngle: 0
      }
    ];

    const cameras = [
      new THREE.PerspectiveCamera(62, 1, 0.1, 260),
      new THREE.PerspectiveCamera(62, 1, 0.1, 260)
    ];

    // Normalized crew state shared by the game and future wallet/JSON loaders.
    // The first prototype keeps the requested default pair.
    let crewRoster = [
      { id: "default-crew-1", name: "Default Crew 1", source: "fallback" },
      { id: "default-crew-2", name: "Default Crew 2", source: "fallback" }
    ];
    const crewSlots = [
      { slot: 0, crewId: crewRoster[0].id, location: "ship", level: null },
      { slot: 1, crewId: crewRoster[1].id, location: "ship", level: null }
    ];
    const doorTransit = [null, null];

    function crewById(id) {
      return crewRoster.find((crew) => crew.id === id) || null;
    }

    function updateCrewMatrix() {
      crewSlots.forEach((slot, i) => {
        const p = players[i];
        if (!p || !gameStarted) {
          slot.location = "ship";
          slot.level = null;
          return;
        }
        slot.location = "tower";
        const bottomY = -((tower.levels - 1) * tower.stepY);
        slot.level = clamp(
          Math.round((p.y - bottomY) / tower.stepY),
          0,
          tower.levels - 1
        );
      });
    }

    function exposeCrewMatrix() {
      window.BCMTowerCrewMatrix = {
        mode,
        crew: crewSlots.map((slot) => ({
          slot: slot.slot,
          crewId: slot.crewId,
          crew: crewById(slot.crewId),
          location: slot.location,
          level: slot.level,
          finished: !!players[slot.slot]?.finished
        }))
      };
    }

    function safeDispose(obj) {
      if (!obj) return;
      if (obj.geometry?.dispose) obj.geometry.dispose();
      if (Array.isArray(obj.material)) {
        obj.material.forEach(m => m?.dispose?.());
      } else {
        obj.material?.dispose?.();
      }
    }

    function replaceTowerRoot() {
      towerRoot.traverse((obj) => {
        if (obj.isMesh) safeDispose(obj);
      });
      scene.remove(towerRoot);
      towerRoot = new THREE.Group();
      scene.add(towerRoot);
      wallMesh = null;
      wallCapMeshes = [];
      platformMeshes = [];
      objectMeshes = [];
    }

    function cellBaseY(cell) {
      return cell.level * tower.stepY - ((tower.levels - 1) * tower.stepY);
    }

    function cellWorldY(cell) {
      if (cell.runtimeY !== undefined) return cell.runtimeY;
      return cellBaseY(cell);
    }

    function cellWorldPosition(cell, extraRadius = 0) {
      const angle = (cell.sector / tower.sectors) * Math.PI * 2;
      const r = radius + extraRadius;
      return new THREE.Vector3(Math.sin(angle) * r, cellWorldY(cell), Math.cos(angle) * r);
    }

    function makeSurface(cell) {
      const p = cellWorldPosition(cell, 0.4);
      let geometry;
      let texUrl = "";
      let color = 0x8eb0c9;
      let height = 0.55;
      let depth = 1.00;
      let width = 1.90;

      if (cell.surface === "rock") {
        geometry = new THREE.DodecahedronGeometry(1.0, 0);
        texUrl = pick(assetPool("rockPool"), mulberry32(seed ^ cell.level ^ cell.sector));
        color = 0x7d8790;
        height = 1.1;
      } else {
        geometry = new THREE.BoxGeometry(width, height, depth);
        if (cell.surface === "lava") {
          texUrl = pick(assetPool("lavaPool").concat(assetPool("platformLavaPool")), mulberry32(seed ^ 0x5511 ^ cell.level));
          color = 0xd63b27;
        } else if (cell.surface === "hot") {
          texUrl = pick(assetPool("platformLavaPool"), mulberry32(seed ^ 0x5522 ^ cell.level));
          color = 0xb54628;
        } else if (cell.surface === "ice") {
          texUrl = pick(assetPool("platformIcePool"), mulberry32(seed ^ 0x9922 ^ cell.level));
          color = 0x9ddcff;
        } else if (cell.surface === "lift") {
          texUrl = pick(assetPool("liftPool"), mulberry32(seed ^ 0x7744 ^ cell.sector));
          color = 0x9a8e75;
        } else if (cell.surface === "upper") {
          texUrl = pick(assetPool("upperPlatformPool"), mulberry32(seed ^ 0x3344 ^ cell.sector));
          color = 0xaaa078;
        } else {
          texUrl = pick(assetPool("platformPool"), mulberry32(seed ^ cell.level * 31 + cell.sector));
        }
      }

      const tex = assetTexture(texUrl, renderer, {
        removeWhite: rasterUrl(texUrl),
        repeat: cell.surface === "platform" || cell.surface === "ice" || cell.surface === "lava",
        repeatX: 1,
        repeatY: 1
      });

      const transparentSurface =
        cell.surface === "lift" ||
        /\\.png(?:[?#].*)?$/i.test(String(texUrl));
      const mesh = new THREE.Mesh(
        geometry,
        makeMaterial(tex, color, transparentSurface, transparentSurface ? 0.04 : 0)
      );
      mesh.position.copy(p);
      mesh.rotation.y = (cell.sector / tower.sectors) * Math.PI * 2;
      mesh.userData.cell = cell;
      mesh.userData.baseX = p.x;
      mesh.userData.baseZ = p.z;

      if (cell.surface === "rock") {
        mesh.scale.set(1.0, 0.72, 1.15);
      }

      if (cell.surface === "lift") {
        cell.motion = ["vertical", "radial", "orbit", "retract"][cell.sector % 4];
        cell.motionSpeed = 0.55 + ((cell.level + cell.sector) % 3) * 0.15;
        cell.motionAmp = 0.8 + ((cell.level + cell.sector) % 2) * 0.7;
        cell.carryPlayer = cell.motion !== "retract";
      }

      towerRoot.add(mesh);
      platformMeshes.push(mesh);
      return mesh;
    }

    function makeObject(cell) {
      if (!cell.object) return null;

      const objectRandom = mulberry32(seed ^ 0x6f41 ^ (cell.level * 97) ^ cell.sector);
      let url = "";
      let w = 1.9;
      let h = 2.2;

      const isBoxObject =
        cell.object === "safebox" ||
        cell.object === "box" ||
        cell.object === "dangerbox";

      if (cell.object === "landing") {
        url = pick(assetPool("landingPool"), objectRandom);
        w = 2.2; h = 2.2;
      } else if (isBoxObject) {
        url = pick(
          cell.object === "dangerbox"
            ? assetPool("dangerBoxPool")
            : assetPool("safeBoxPool").concat(assetPool("boxPool")),
          objectRandom
        );
        w = 1.6; h = 1.4;
      } else if (cell.object === "fire") {
        url = pick(assetPool("firePool"), objectRandom);
        w = 1.45; h = 1.75;
      } else if (cell.object === "door") {
        url = pick(assetPool("doorPool"), objectRandom);
        w = 2.0; h = 3.0;
      } else if (cell.object === "walldoor") {
        url = pick(assetPool("wallDoorPool"), objectRandom);
        w = 2.35; h = 3.25;
      } else if (cell.object === "npc") {
        url = pick(assetPool("npcPool"), objectRandom);
        w = 2.0; h = 2.7;
      }

      if (!url) return null;
      const tex = assetTexture(url, renderer, { removeWhite: true });
      if (!tex) return null;

      const sectorAngle = (cell.sector / tower.sectors) * Math.PI * 2;

      if (isBoxObject) {
        // Real 3D crate/container instead of a flat PNG card.
        const depth = 1.15;
        const radial = radius + depth * 0.5;
        const material = makeMaterial(tex, 0xffffff, true, 0.02);
        const materials = [material, material, material, material, material, material];
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(w, h, depth),
          materials
        );
        mesh.position.set(
          Math.sin(sectorAngle) * radial,
          cellWorldY(cell) + h * 0.5,
          Math.cos(sectorAngle) * radial
        );
        mesh.rotation.y = sectorAngle;
        mesh.userData.cell = cell;
        mesh.userData.objectType = cell.object;
        mesh.userData.assetUrl = url;
        mesh.userData.liftBound = cell.surface === "lift";
        towerRoot.add(mesh);
        objectMeshes.push(mesh);
        return mesh;
      }

      const extraRadius =
        cell.object === "fire" ? 0.10 :
        cell.object === "walldoor" ? 0.30 :
        0.85;

      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshStandardMaterial({
          map: tex,
          transparent: true,
          alphaTest: 0.06,
          depthWrite: false,
          roughness: 0.92,
          metalness: 0.04,
          side: THREE.DoubleSide
        })
      );

      // Face each card outward from the cylindrical wall. Fire is deliberately
      // almost flush with the tower skin instead of floating in front of it.
      mesh.position.set(
        Math.sin(sectorAngle) * (radius + extraRadius),
        cellWorldY(cell) + h * 0.45,
        Math.cos(sectorAngle) * (radius + extraRadius)
      );
      mesh.rotation.y = sectorAngle;
      mesh.userData.cell = cell;
      mesh.userData.objectType = cell.object;
      mesh.userData.assetUrl = url;
      mesh.userData.liftBound = cell.surface === "lift";
      towerRoot.add(mesh);
      objectMeshes.push(mesh);
      return mesh;
    }

    function buildBirds() {
      birds = [];
      const rand = mulberry32(seed ^ 0xB17D5EED);
      const count = 7 + Math.floor(rand() * 4);

      for (let i = 0; i < count; i++) {
        const group = new THREE.Group();
        const bodyMat = new THREE.MeshStandardMaterial({
          color: 0x263441,
          roughness: 0.78,
          metalness: 0.05
        });
        const beakMat = new THREE.MeshBasicMaterial({ color: 0xd7b35a });

        const body = new THREE.Mesh(
          new THREE.SphereGeometry(0.28, 7, 5),
          bodyMat
        );
        body.scale.set(1.45, 0.72, 0.9);
        group.add(body);

        const head = new THREE.Mesh(
          new THREE.SphereGeometry(0.19, 7, 5),
          bodyMat
        );
        head.position.set(0, 0.08, -0.23);
        group.add(head);

        const beak = new THREE.Mesh(
          new THREE.ConeGeometry(0.07, 0.22, 5),
          beakMat
        );
        beak.rotation.x = Math.PI / 2;
        beak.position.set(0, 0.05, -0.42);
        group.add(beak);

        const wingGeo = new THREE.BoxGeometry(0.62, 0.06, 0.34);
        const leftWing = new THREE.Mesh(wingGeo, bodyMat);
        const rightWing = new THREE.Mesh(wingGeo, bodyMat);
        leftWing.position.set(-0.34, 0.02, 0);
        rightWing.position.set(0.34, 0.02, 0);
        group.add(leftWing, rightWing);

        const centerAngle = rand() * Math.PI * 2;
        const state = {
          group,
          leftWing,
          rightWing,
          angle: centerAngle,
          baseY: -8 + rand() * (towerHeight() - 18),
          radius: radius + 2.5 + rand() * 4.0,
          speed: 0.30 + rand() * 0.30,
          phase: rand() * Math.PI * 2,
          flap: 5.0 + rand() * 2.5
        };

        group.userData.bird = true;
        towerRoot.add(group);
        birds.push(state);
      }
    }

    function updateBirds(time) {
      if (!birds.length) return;
      const t = time * 0.001;

      for (const bird of birds) {
        const a = bird.angle + t * bird.speed;
        const y = bird.baseY + Math.sin(t * 0.8 + bird.phase) * 1.1;
        const r = bird.radius + Math.sin(t * 0.47 + bird.phase) * 0.8;

        bird.group.position.set(
          Math.sin(a) * r,
          y,
          Math.cos(a) * r
        );
        bird.group.rotation.y = a + Math.PI;
        const flap = Math.sin(t * bird.flap + bird.phase) * 0.52;
        bird.leftWing.rotation.z = flap;
        bird.rightWing.rotation.z = -flap;

        for (let i = 0; i < players.length; i++) {
          const p = players[i];
          p.birdHitCooldown = Math.max(0, (p.birdHitCooldown || 0) - 0.016);
          if (p.finished || p.birdHitCooldown > 0) continue;
          const dx = p.radial * Math.sin(p.angle) - bird.group.position.x;
          const dy = (p.y + 0.9) - bird.group.position.y;
          const dz = p.radial * Math.cos(p.angle) - bird.group.position.z;
          const birdHitRadius = 2.6;
          if (dx * dx + dy * dy + dz * dz > birdHitRadius * birdHitRadius) continue;

          p.birdHitCooldown = 0.9;
          p.grounded = false;
          p.liftRide = null;
          p.currentCell = null;
          p.jumps = 1;
          p.jumpStarted = false;
          p.fallStartY = p.y;
          p.vy = Math.min(p.vy, 0) - 8.5;
          p.angle += dx >= 0 ? 0.10 : -0.10;
          status.textContent = "ПТИЦА СБИЛА ИГРОКА " + (i + 1);
        }
      }
    }

    function buildTower(nextSeed) {
      seed = nextSeed >>> 0;
      tower = generateTower(seed);
      replaceTowerRoot();

      const wallUrl = pick(assetPool("towerWallJpgPool"), mulberry32(seed ^ 0x7891));
      const wallTex = assetTexture(wallUrl, renderer, {
        repeat: true,
        repeatX: 6,
        repeatY: Math.max(5, towerHeight() / 10)
      });

      wallMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius, towerHeight(), 48, 1, true),
        new THREE.MeshStandardMaterial({
          map: wallTex || null,
          color: wallTex ? 0xffffff : 0x29445c,
          roughness: 0.92,
          metalness: 0.08,
          side: THREE.DoubleSide
        })
      );
      // Levels run from roughly Y=0 down to -180. Center the shell over the
      // complete playable shaft instead of leaving its lower half outside it.
      const towerBottomY = -((tower.levels - 1) * tower.stepY);
      const towerTopY = 6;
      wallMesh.position.y = (towerBottomY + towerTopY) * 0.5;
      towerRoot.add(wallMesh);

      // H1 is the original Tower top/bottom cylinder texture. Keep its
      // existing door/landing use, but also use the same artwork to close the
      // actual top and bottom of the cylindrical shaft.
      const h1Url = assetPool("landingPool").find((url) => /(?:^|\/)H1\.png(?:[?#].*)?$/i.test(String(url || "")))
        || assetPool("landingPool").find((url) => /(?:^|\/)H1/i.test(String(url || "")))
        || "";
      if (h1Url) {
        const h1Tex = assetTexture(h1Url, renderer, { removeWhite: true });
        if (h1Tex) {
          const capMaterial = new THREE.MeshStandardMaterial({
            map: h1Tex,
            transparent: h1Tex.format === THREE.RGBAFormat,
            alphaTest: 0.02,
            roughness: 0.92,
            metalness: 0.05,
            side: THREE.DoubleSide
          });

          const topCap = new THREE.Mesh(
            new THREE.CircleGeometry(radius, 48),
            capMaterial
          );
          topCap.rotation.x = -Math.PI / 2;
          topCap.position.y = towerTopY;
          topCap.userData.towerCap = "top";
          towerRoot.add(topCap);
          wallCapMeshes.push(topCap);

          const bottomCap = new THREE.Mesh(
            new THREE.CircleGeometry(radius, 48),
            capMaterial.clone()
          );
          bottomCap.rotation.x = Math.PI / 2;
          bottomCap.position.y = towerBottomY;
          bottomCap.userData.towerCap = "bottom";
          towerRoot.add(bottomCap);
          wallCapMeshes.push(bottomCap);
        }
      }

      for (const cell of tower.cells.values()) {
        makeSurface(cell);
        makeObject(cell);
      }

      buildBirds();

      playerTextures = [null, null];
      syncCrewSelectionFromMiniSim();

      // The embedded mini-sim supplies the two selected Crew before Tower starts.
      // Direct Tower pages retain a small visual fallback.
      const fallbackCrewImage = inlineConfig.crewImage
        ? String(inlineConfig.crewImage)
        : "";

      let fallbackPlayerTexture = null;
      if (fallbackCrewImage) {
        fallbackPlayerTexture = assetTexture(fallbackCrewImage, renderer, {});
      } else {
        const canvas2d = document.createElement("canvas");
        canvas2d.width = 128;
        canvas2d.height = 128;
        const ctx = canvas2d.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, 128, 128);
          ctx.fillStyle = "#202833";
          ctx.beginPath();
          ctx.arc(64, 32, 18, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#73d6ff";
          ctx.fillRect(42, 51, 44, 42);
          ctx.fillStyle = "#202833";
          ctx.fillRect(44, 91, 14, 25);
          ctx.fillRect(70, 91, 14, 25);
          ctx.fillStyle = "#ffe6c7";
          ctx.beginPath();
          ctx.arc(58, 28, 3, 0, Math.PI * 2);
          ctx.arc(70, 28, 3, 0, Math.PI * 2);
          ctx.fill();
          fallbackPlayerTexture = new THREE.CanvasTexture(canvas2d);
          if ("colorSpace" in fallbackPlayerTexture && THREE.SRGBColorSpace !== undefined) {
            fallbackPlayerTexture.colorSpace = THREE.SRGBColorSpace;
          } else if (THREE.sRGBEncoding !== undefined) {
            fallbackPlayerTexture.encoding = THREE.sRGBEncoding;
          }
          fallbackPlayerTexture.needsUpdate = true;
        }
      }

      for (let i = 0; i < 2; i++) {
        const selectedCrew = crewById(crewSlots[i].crewId);
        const imageUrl = selectedCrew?.image || "";
        playerTextures[i] = imageUrl
          ? assetTexture(imageUrl, renderer, { removeWhite: /\\.png(?:[?#].*)?$/i.test(imageUrl) })
          : fallbackPlayerTexture;
      }

      while (playerMarkers.length) {
        const oldMarker = playerMarkers.pop();
        scene.remove(oldMarker);
        safeDispose(oldMarker);
      }
      while (playerSprites.length) {
        const old = playerSprites.pop();
        if (old) {
          scene.remove(old);
          safeDispose(old);
        }
      }

      for (let i = 0; i < 2; i++) {
        const marker = new THREE.Mesh(
          new THREE.SphereGeometry(0.48, 10, 8),
          new THREE.MeshStandardMaterial({
            color: i === 0 ? 0x74d7ff : 0xffbf6d,
            emissive: i === 0 ? 0x103a55 : 0x50310d,
            roughness: 0.7,
            metalness: 0.18
          })
        );
        scene.add(marker);
        playerMarkers.push(marker);

        if (playerTextures[i]) {
          const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: playerTextures[i],
            transparent: true,
            depthWrite: false,
            sizeAttenuation: true
          }));
          sprite.scale.set(1.65, 1.65, 1);
          scene.add(sprite);
          playerSprites.push(sprite);
        } else {
          playerSprites.push(null);
        }
      }

      for (let i = 0; i < 2; i++) {
        resetPlayer(i, i === 0 ? 0 : 0.85);
        doorTransit[i] = null;
        if (doorTransitLayers[i]) doorTransitLayers[i].hidden = true;
      }
      updateCrewMatrix();
      exposeCrewMatrix();
      status.textContent = "TOWER READY";
      restartButton.hidden = true;
    }

    function towerHeight() {
      return tower ? ((tower.levels - 1) * tower.stepY + 12) : 196;
    }

    function resetPlayer(index, angleOffset) {
      const p = players[index];
      const topSector = tower.path[0];
      const cell = tower.cells.get((tower.levels - 1) + ":" + topSector);
      const startY = cell ? cellWorldY(cell) + 0.9 : 0;
      p.y = startY;
      p.vy = 0;
      p.angle = topSector * sectorWidth() + angleOffset;
      p.radial = playerWallRadius;
      p.jumps = 0;
      p.grounded = true;
      p.currentCell = cell || null;
      p.liftRide = null;
      p.hazard = 0;
      p.slide = 0;
      p.finished = false;
      p.doorCooldown = 0;
      p.jumpStarted = false;
      p.fallStartY = null;
      p.maxFallSpeed = 0;
      p.birdHitCooldown = 0;
      p.visualFacing = 1;
      p.visualAngle = p.angle;
    }

    function surfaceCandidates(player) {
      const approximate = Math.round(
        (player.y + ((tower.levels - 1) * tower.stepY)) / tower.stepY
      );
      const candidates = [];

      for (let level = approximate - 2; level <= approximate + 2; level++) {
        if (level < 0 || level >= tower.levels) continue;

        const centerSector = wrapSector(
          Math.round(player.angle / sectorWidth()),
          tower.sectors
        );

        for (let d = -2; d <= 2; d++) {
          const sector = wrapSector(centerSector + d, tower.sectors);
          const cell = tower.cells.get(level + ":" + sector);
          if (!cell) continue;

          const mesh = platformMeshes.find(m => m.userData.cell === cell);
          const meshX = mesh ? mesh.position.x : Math.sin(sector * sectorWidth()) * (radius + 0.4);
          const meshZ = mesh ? mesh.position.z : Math.cos(sector * sectorWidth()) * (radius + 0.4);
          const surfaceAngle = Math.atan2(meshX, meshZ);
          const surfaceRadius = Math.hypot(meshX, meshZ);

          // A retracting platform is not a floor once it has gone through the
          // cylinder wall. It may visually enter the tower, but the player
          // cannot follow it through the solid shell.
          if (
            cell.surface === "lift" &&
            cell.motion === "retract" &&
            surfaceRadius + 0.65 < playerWallRadius - 0.08
          ) {
            continue;
          }

          const da = Math.abs(angleDelta(player.angle, surfaceAngle));
          if (da > sectorWidth() * 0.62) continue;

          const targetRadial = surfaceRadius + 0.65;
          if (Math.abs(player.radial - targetRadial) > 1.00) continue;

          const y = mesh ? mesh.position.y : cellWorldY(cell);
          const dy = player.y - (y + 0.72);
          candidates.push({
            cell,
            y,
            dy,
            da,
            angle: surfaceAngle,
            radial: targetRadial
          });
        }
      }

      candidates.sort((a, b) => Math.abs(a.dy) - Math.abs(b.dy));
      return candidates;
    }

    function findLanding(player) {
      const candidates = surfaceCandidates(player);
      for (const candidate of candidates) {
        if (player.vy > 0) continue;
        if (candidate.dy <= 1.15 && candidate.dy >= -1.2) return candidate;
      }
      return null;
    }

    function doJump(index) {
      const p = players[index];
      if (p.finished || doorTransit[index]) return;

      if (p.grounded) {
        p.vy = jumpVelocity;
        p.grounded = false;
        p.jumps = 1;
        p.jumpStarted = true;
        p.fallStartY = null;
        p.maxFallSpeed = 0;
        return;
      }

      // A genuine double-jump exists only after a real first jump from a
      // platform. Walking/falling off a platform counts as the first jump,
      // so that state gets at most one emergency air jump.
      if (p.jumpStarted && p.jumps === 1) {
        p.vy = doubleJumpVelocity;
        p.jumps = 2;
        p.jumpStarted = false;
        return;
      }

      if (!p.jumpStarted && p.jumps === 1) {
        p.vy = doubleJumpVelocity;
        p.jumps = 2;
      }
    }

    function resetAfterHazard(index, message) {
      resetPlayer(index, index === 0 ? 0 : 0.85);
      status.textContent = message;
    }

    function collectObject(cell, objectMesh) {
      if (!cell || cell.collected) return;
      cell.collected = true;
      if (objectMesh) objectMesh.visible = false;
    }

    function findObjectMesh(cell) {
      return objectMeshes.find(m => m.userData.cell === cell && m.visible !== false) || null;
    }

    function interact(index) {
      const p = players[index];
      if (!p.currentCell || p.doorCooldown > 0) return;
      const cell = p.currentCell;

      if (cell.object === "door" && cell.doorPair) {
        if (doorTransit[index]) return;
        const destination = cell.doorPair;
        const doorMesh = findObjectMesh(cell);
        const layer = doorTransitLayers[index];
        const imageUrl = doorMesh?.userData?.assetUrl || "";

        clearControls(index);
        doorTransit[index] = {
          destination,
          until: performance.now() + 1500
        };
        p.doorCooldown = 1.65;
        p.grounded = false;
        p.liftRide = null;
        p.currentCell = null;
        p.vy = 0;

        if (layer) {
          const card = layer.querySelector(".bcm-tower-door-transition-card");
          if (card) card.style.backgroundImage = imageUrl ? 'url("' + imageUrl.replace(/"/g, "\"") + '")' : "none";
          layer.hidden = false;
        }
        status.textContent = "ДВЕРЬ: ПРОХОД СКВОЗЬ ВЫШКУ · 1.5 s";
        return;
      }

      if (cell.object === "safebox" || cell.object === "box") {
        collectObject(cell, findObjectMesh(cell));
        p.collected += 1;
        status.textContent = "ЯЩИК ОТКРЫТ";
      }

      if (cell.object === "dangerbox") {
        resetAfterHazard(index, "ОПАСНЫЙ ЯЩИК: СПУСК ПЕРЕЗАПУЩЕН");
      }
    }

    function updateLiftMotion(time) {
      for (const cell of tower.cells.values()) {
        if (cell.surface !== "lift") continue;
        const mesh = platformMeshes.find(m => m.userData.cell === cell);
        if (!mesh) continue;

        const t = time * 0.001 * cell.motionSpeed + cell.phase;
        const base = cellBaseY(cell);

        if (cell.motion === "vertical") {
          cell.runtimeY = base + Math.sin(t) * cell.motionAmp;
          mesh.position.y = cell.runtimeY;
        } else if (cell.motion === "radial") {
          cell.runtimeY = base + Math.sin(t * 0.9) * 0.35;
          const r = radius + 0.4 + Math.sin(t) * cell.motionAmp;
          const a = cell.sector * sectorWidth();
          mesh.position.x = Math.sin(a) * r;
          mesh.position.z = Math.cos(a) * r;
          mesh.position.y = cell.runtimeY;
        } else if (cell.motion === "orbit") {
          cell.runtimeY = base + Math.sin(t) * 0.4;
          const a = cell.sector * sectorWidth() + Math.sin(t) * 0.22;
          const r = radius + 0.4;
          mesh.position.x = Math.sin(a) * r;
          mesh.position.z = Math.cos(a) * r;
          mesh.position.y = cell.runtimeY;
        } else {
          // Retracting lift: starts inside the tower and periodically extends
          // through the cylindrical wall. Once it retracts beyond the player's
          // radial reach, the player loses the surface and falls.
          cell.runtimeY = base + Math.sin(t * 0.9) * 0.25;
          const travel = 4.8;
          const r = radius - 2.0 + (Math.sin(t) + 1) * 0.5 * travel;
          const a = cell.sector * sectorWidth();
          mesh.position.x = Math.sin(a) * r;
          mesh.position.z = Math.cos(a) * r;
          mesh.position.y = cell.runtimeY;
        }

        // Objects sitting on a lift belong to that lift's moving layer too.
        // This keeps box*/dangerbox* aligned with a retracting platform instead
        // of leaving the object suspended in world space.
        const liftR = Math.hypot(mesh.position.x, mesh.position.z);
        const liftA = Math.atan2(mesh.position.x, mesh.position.z);
        objectMeshes.forEach((objectMesh) => {
          const objectCell = objectMesh.userData.cell;
          if (!objectCell || objectCell.surface !== "lift" || !objectMesh.userData.liftBound) return;
          if (objectCell !== cell) return;
          const objectType = objectMesh.userData.objectType;
          const radialOffset = objectType === "dangerbox" || objectType === "safebox" || objectType === "box"
            ? 0.55
            : 0.35;
          objectMesh.position.set(
            Math.sin(liftA) * (liftR + radialOffset),
            mesh.position.y + ((objectMesh.geometry.parameters?.height || 1.4) * 0.5),
            Math.cos(liftA) * (liftR + radialOffset)
          );
          objectMesh.rotation.y = liftA;
        });
      }
    }

    function syncLiftRide(p) {
      if (
        !p.grounded ||
        p.currentCell?.surface !== "lift" ||
        p.currentCell.motion === "retract" ||
        p.currentCell.carryPlayer === false
      ) {
        p.liftRide = null;
        return;
      }

      const mesh = platformMeshes.find(m => m.userData.cell === p.currentCell);
      if (!mesh) {
        p.liftRide = null;
        return;
      }

      const state = {
        cell: p.currentCell,
        y: mesh.position.y,
        radial: Math.hypot(mesh.position.x, mesh.position.z) + 0.65,
        angle: Math.atan2(mesh.position.x, mesh.position.z)
      };

      if (p.liftRide && p.liftRide.cell === state.cell) {
        p.y += state.y - p.liftRide.y;
        p.radial += state.radial - p.liftRide.radial;
        p.angle += angleDelta(state.angle, p.liftRide.angle);
      } else {
        p.radial = state.radial;
        p.angle = state.angle;
      }

      p.liftRide = state;
    }

    function updatePlayer(index, dt) {
      const p = players[index];
      const c = controls[index];

      if (doorTransit[index]) {
        if (performance.now() < doorTransit[index].until) return;
        const destination = doorTransit[index].destination;
        doorTransit[index] = null;
        if (doorTransitLayers[index]) doorTransitLayers[index].hidden = true;

        p.y = cellWorldY(destination) + 0.9;
        p.vy = 0;
        p.grounded = true;
        p.jumps = 0;
        p.jumpStarted = false;
        p.fallStartY = null;
        p.currentCell = destination;
        p.radial = playerWallRadius;
        p.angle = destination.sector * sectorWidth();
        status.textContent = "ДВЕРЬ: ВЫХОД НА ПРОТИВОПОЛОЖНОЙ СТОРОНЕ";
        return;
      }

      if (p.finished) return;

      syncLiftRide(p);

      // The tower cylinder is a hard radial wall, exactly like Room 1's
      // corridor walls. A moving platform can never pull the player through it.
      if (p.radial < playerWallRadius) {
        p.radial = playerWallRadius;
        p.liftRide = null;
      }

      p.doorCooldown = Math.max(0, p.doorCooldown - dt);
      if (p.grounded) p.maxFallSpeed = 0;
      p.vy -= gravity * dt;

      let turn = (c.right ? 1 : 0) - (c.left ? 1 : 0);
      let trim = (c.up ? 1 : 0) - (c.down ? 1 : 0);

      const onIce = p.currentCell?.surface === "ice" || p.currentCell?.liftHazard === "ice";
      const onHot = p.currentCell?.surface === "hot" || p.currentCell?.liftHazard === "hot";
      const onLava = p.currentCell?.surface === "lava" || p.currentCell?.liftHazard === "lava";
      const turnSpeed = baseTurnSpeed * (onIce ? 1.52 : 1);

      if (onIce) {
        if (turn !== 0) p.slide = clamp(p.slide + turn * dt * 2.4, -1.8, 1.8);
        else p.slide *= Math.max(0, 1 - dt * 0.35);
        turn += p.slide * 0.55;
      } else {
        p.slide *= Math.max(0, 1 - dt * 7);
      }

      p.angle += turn * turnSpeed * dt;
      p.vy += trim * trimPower * dt;
      if (!p.grounded && p.vy < 0) {
        p.maxFallSpeed = Math.max(p.maxFallSpeed, -p.vy);
      }
      p.y += p.vy * dt;

      const bottomY = -((tower.levels - 1) * tower.stepY);
      if (p.y < bottomY - 4.2) {
        p.finished = true;
        p.vy = 0;
        p.grounded = false;
        status.textContent = mode === "multi" ? "ИГРОК ДОШЁЛ ДО ОСНОВАНИЯ" : "СПУСК ЗАВЕРШЁН";
        showEndLevelMarker();
        return;
      }

      const wasGrounded = p.grounded;
      const previousCell = p.currentCell;
      const landing = findLanding(p);

      if (landing) {
        p.y = landing.y + 0.72;
        p.vy = 0;
        p.grounded = true;
        p.jumps = 0;
        p.currentCell = landing.cell;

        // Keep the player's own angular position. Landing no longer snaps the
        // character to the visual center of the platform.
        p.radial = Math.max(playerWallRadius, p.radial);
        if (Math.abs(p.radial - landing.radial) > 1.0) {
          p.radial = landing.radial;
        }

        if (!wasGrounded && p.fallStartY !== null) {
          const fallenLevels = Math.floor(
            Math.max(0, p.fallStartY - landing.y) / tower.stepY
          );
          const impactSpeed = Math.max(0, p.maxFallSpeed);
          p.fallStartY = null;
          p.maxFallSpeed = 0;
          if (fallenLevels >= 5 || impactSpeed >= fallResetSpeed) {
            resetAfterHazard(
              index,
              impactSpeed >= fallResetSpeed
                ? "СИЛЬНОЕ ПАДЕНИЕ: СКОРОСТЬ УДАРА " + impactSpeed.toFixed(1)
                : "ПАДЕНИЕ БОЛЕЕ 5 УРОВНЕЙ: ВОЗВРАТ В НАЧАЛО"
            );
            return;
          }
        }

        p.jumpStarted = false;

        if (landing.cell.object === "dangerbox") {
          resetAfterHazard(index, "DANGERBOX: ВОЗВРАТ В НАЧАЛО");
          return;
        }

        if (landing.cell.surface === "lift") {
          if (!wasGrounded || previousCell !== landing.cell || !p.liftRide) {
            p.liftRide = {
              cell: landing.cell,
              y: landing.y,
              radial: landing.radial,
              angle: landing.angle
            };
          } else {
            // Keep the lift's previous frame as the motion reference. The
            // player may rotate independently on the lift surface.
            p.liftRide.cell = landing.cell;
            p.liftRide.y = landing.y;
            p.liftRide.radial = landing.radial;
          }
        } else {
          p.liftRide = null;
        }
      } else {
        if (wasGrounded) {
          p.jumps = 1;
          p.jumpStarted = false;
          p.fallStartY = p.y;
          p.maxFallSpeed = 0;
        }
        p.grounded = false;
        p.liftRide = null;
      }

      if (!p.grounded) {
        if (p.fallStartY !== null) {
          const fallenNow = Math.floor(
            Math.max(0, p.fallStartY - p.y) / tower.stepY
          );
          if (fallenNow >= 5) {
            resetAfterHazard(index, "ПАДЕНИЕ БОЛЕЕ 5 УРОВНЕЙ: ВОЗВРАТ В НАЧАЛО");
          }
        }
        return;
      }

      const surface = p.currentCell?.surface;
      if (onLava) {
        resetAfterHazard(index, "ЛАВА: ОПАСНАЯ ЗОНА");
        return;
      } else if (onHot) {
        p.hazard += dt;
        if (p.hazard > 1.15) {
          resetAfterHazard(index, "ГОРЯЧАЯ ПЛАТФОРМА: НЕЛЬЗЯ ЗАДЕРЖИВАТЬСЯ");
          return;
        }
      } else if (p.currentCell?.object === "fire") {
        p.hazard += dt;
        if (p.hazard > 0.75) {
          resetAfterHazard(index, "ОГОНЬ: ПЕРЕЗАПУСК ПОЗИЦИИ");
          return;
        }
      } else {
        p.hazard = Math.max(0, p.hazard - dt * 2.5);
      }

      if (p.currentCell?.object === "dangerbox") {
        p.hazard += dt;
        if (p.hazard > 0.32) {
          resetAfterHazard(index, "ОПАСНЫЙ ЯЩИК");
          return;
        }
      }

      if (p.currentCell?.object === "safebox" || p.currentCell?.object === "box") {
        if (!p.currentCell.collected) collectObject(p.currentCell, findObjectMesh(p.currentCell));
      }
    }

    function updatePlayerVisual(index) {
      const p = players[index];
      const a = p.angle;
      const r = Math.max(p.radial || playerWallRadius, playerWallRadius);
      const x = Math.sin(a) * r;
      const z = Math.cos(a) * r;

      const marker = playerMarkers[index];
      if (marker) {
        marker.position.set(x, p.y + 0.35, z);
      }

      const sprite = playerSprites[index];
      if (sprite) {
        const delta = angleDelta(a, p.visualAngle ?? a);
        const turnInput = (controls[index]?.right ? 1 : 0) - (controls[index]?.left ? 1 : 0);
        if (turnInput !== 0) {
          // Right/left is the authoritative visual direction. This prevents
          // the billboard sprite from keeping its old face while the player
          // walks around the cylinder.
          p.visualFacing = turnInput > 0 ? -1 : 1;
        } else if (Math.abs(delta) > 0.001) {
          // Keep mouse/touch and carried-lift rotation working as before.
          p.visualFacing = delta > 0 ? -1 : 1;
        }
        p.visualAngle = a;

        const moving = Math.abs(p.vy) > 0.4 ||
          Math.abs(delta) > 0.01 ||
          turnInput !== 0 ||
          (!p.grounded && Math.abs(p.vy) > 0.1);
        const bob = moving && !p.finished ? Math.sin(performance.now() * 0.018 + index) * 0.055 : 0;
        sprite.position.set(x, p.y + 1.35 + bob, z);
        sprite.quaternion.copy(cameras[index].quaternion);
        sprite.scale.x = 1.65 * (p.visualFacing || 1);
      }
    }

    function updateCamera(index, viewport) {
      const p = players[index];
      const a = p.angle;
      const x = Math.sin(a) * cameraRadius;
      const z = Math.cos(a) * cameraRadius;
      const camera = cameras[index];
      const playerRadius = p.radial || (radius + 1.05);
      const followRadius = playerRadius + 7.5;

      // Follow from outside the cylinder and keep the character centered.
      camera.position.set(
        Math.sin(a) * followRadius,
        p.y + 4.0,
        Math.cos(a) * followRadius
      );
      camera.lookAt(new THREE.Vector3(
        Math.sin(a) * playerRadius,
        p.y + 0.9,
        Math.cos(a) * playerRadius
      ));
      camera.aspect = viewport.w / Math.max(1, viewport.h);
      camera.updateProjectionMatrix();
    }

    function currentLevelText(p) {
      const bottomY = -((tower.levels - 1) * tower.stepY);
      const level = clamp(
        Math.round((p.y - bottomY) / tower.stepY),
        0,
        tower.levels - 1
      );
      return (tower.levels - 1 - level) + "/" + (tower.levels - 1);
    }

    function updateHud() {
      if (!tower || !gameStarted) return;
      if (mode === "single") {
        levelEl.textContent =
          "СПУСК: " + currentLevelText(players[0]) +
          " · SECTOR " + wrapSector(Math.round(players[0].angle / sectorWidth()), tower.sectors) +
          " · SEED " + tower.seed;
        if (modeEl) modeEl.textContent = "SINGLE";
      } else {
        levelEl.textContent =
          "P1: " + currentLevelText(players[0]) +
          " · P2: " + currentLevelText(players[1]) +
          " · SEED " + tower.seed;
        if (modeEl) {
          const padsNow = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean).length : 0;
          modeEl.textContent = padsNow === 0
            ? "MULTI / SHARED SEED · P1: WASD + SPACE · P2: ARROWS + X"
            : padsNow === 1
              ? "MULTI / SHARED SEED · P1: KEYBOARD · P2: GAMEPAD"
              : "MULTI / SHARED SEED · GAMEPAD 1: P1 · GAMEPAD 2: P2";
        }
      }

      if (inlineConfig.crewName) {
        crewEl.textContent = "CREW: " + inlineConfig.crewName;
      } else if (inlineConfig.crewImage) {
        crewEl.textContent = "CREW: NFT IMAGE";
      } else {
        crewEl.textContent = "CREW: готов к подключению NFT";
      }

      if (players.every(p => p.finished)) {
        restartButton.hidden = false;
      }
      updateCrewMatrix();
      exposeCrewMatrix();
    }

    function renderViews() {
      const w = Math.max(1, root.clientWidth);
      const h = Math.max(1, root.clientHeight);
      renderer.setSize(w, h, false);
      renderer.setScissorTest(true);

      if (mode === "multi") {
        const landscape = w >= h;
        let rects;
        if (landscape) {
          const half = Math.floor(w / 2);
          rects = [
            { x: 0, y: 0, w: half, h },
            { x: half, y: 0, w: w - half, h }
          ];
        } else {
          const half = Math.floor(h / 2);
          rects = [
            { x: 0, y: 0, w, h: half },
            { x: 0, y: half, w, h: h - half }
          ];
        }

        divider.hidden = false;
        p1Label.hidden = false;
        p2Label.hidden = false;

        rects.forEach((r, i) => {
          renderer.setViewport(r.x, r.y, r.w, r.h);
          renderer.setScissor(r.x, r.y, r.w, r.h);
          renderer.clear(true, true, true);
          updateCamera(i, r);
          renderer.render(scene, cameras[i]);
        });
      } else {
        divider.hidden = true;
        p1Label.hidden = true;
        p2Label.hidden = true;
        renderer.setViewport(0, 0, w, h);
        renderer.setScissor(0, 0, w, h);
        renderer.clear(true, true, true);
        updateCamera(0, { w, h });
        renderer.render(scene, cameras[0]);
      }

      renderer.setScissorTest(false);
    }

    function resize() {
      const w = Math.max(1, root.clientWidth);
      const h = Math.max(1, root.clientHeight);
      renderer.setSize(w, h, false);
      // The embedded Tower is initialized while its root is hidden, so the
      // first resize can legitimately be 1x1. Recalculate camera/viewport
      // after the root becomes visible as well.
      if (renderer.domElement && w > 1 && h > 1) {
        renderer.setViewport(0, 0, w, h);
      }
    }

    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => resize())
      : null;
    resizeObserver?.observe(root);

    function ensureTowerAudio() {
      if (towerAudio || !CONFIG.towerAudio) return towerAudio;

      towerAudio = document.createElement("audio");
      towerAudio.src = CONFIG.towerAudio;
      towerAudio.preload = "auto";
      towerAudio.loop = true;
      towerAudio.volume = 0.48;
      towerAudio.setAttribute("playsinline", "");
      towerAudio.setAttribute("aria-hidden", "true");
      towerAudio.style.display = "none";
      document.body.appendChild(towerAudio);
      return towerAudio;
    }

    function stopOtherGameAudio() {
      try {
        window.BCMMiniSimAPI?.stopAudio?.();
      } catch (e) {}

      document.querySelectorAll(".bcm-mini-sim-music-audio").forEach((audio) => {
        if (audio === towerAudio) return;
        try {
          audio.pause();
          audio.volume = 0;
        } catch (e) {}
      });
    }

    function playTowerAudio() {
      stopOtherGameAudio();
      const audio = ensureTowerAudio();
      if (!audio) return;
      audio.muted = false;
      audio.volume = 0.48;
      const promise = audio.play();
      if (promise && promise.catch) {
        promise.catch(() => {
          // Browser autoplay may require a fresh user gesture. The mode buttons
          // call this again directly from the click handler.
        });
      }
    }

    function stopTowerAudio() {
      if (!towerAudio) return;
      try {
        towerAudio.pause();
        towerAudio.currentTime = 0;
      } catch (e) {}
    }

    function startMode(nextMode) {
      mode = nextMode === "multi" ? "multi" : "single";
      playTowerAudio();
      menu.hidden = true;
      mobile?.setAttribute("aria-hidden", "false");
      mobile?.querySelector(".bcm-tower-mobile-p2")?.toggleAttribute("hidden", mode !== "multi");
      root.classList.toggle("is-multi", mode === "multi");

      try {
        buildTower(makeSeed());
        gameStarted = true;
        requestAnimationFrame(() => {
          resize();
          renderViews();
        });
      } catch (error) {
        gameStarted = false;
        menu.hidden = false;
        status.textContent = "TOWER ERROR: " + (error?.message || "BUILD FAILED");
        console.error("BCM Tower startMode failed", error);
        return;
      }

      if (mode === "multi") {
        mobile?.classList.add("is-multi");
        status.textContent = "MULTI READY — ОБЩАЯ БАШНЯ";
      } else {
        mobile?.classList.remove("is-multi");
        status.textContent = "SINGLE READY";
      }
    }

    function showMenu() {
      gameStarted = false;
      menu.hidden = false;
      restartButton.hidden = true;
      status.textContent = "ВЫБЕРИТЕ РЕЖИМ";
      if (modeEl) modeEl.textContent = "";

      // Build a preview behind the menu. This also starts loading the Tower
      // textures before SINGLE/MULTI is selected, so the handoff is visibly alive.
      if (!tower) {
        buildTower(makeSeed());
      }
      requestAnimationFrame(() => {
        resize();
        renderViews();
      });
    }

    function stopTransition() {
      transition.hidden = true;
      transition.style.backgroundImage = "";
      transitionVideo.pause();
      transitionVideo.removeAttribute("src");
      transitionVideo.load();
      transitionVideo.style.opacity = "0";
      transitionStarted = false;
    }

    function helipadMarkerUrl() {
      const pool = assetPool("hMarkerPool");
      const first = pool.find((url) => /(?:^|\/)H1(?:\d*)\.png(?:[?#].*)?$/i.test(url));
      if (first) return first;
      if (pool.length) return pool[0];
      const landing = assetPool("landingPool");
      return landing.find((url) => /(?:^|\/)H1(?:\d*)\.png(?:[?#].*)?$/i.test(url)) || "";
    }

    function showEndLevelMarker() {
      const markerUrl = helipadMarkerUrl();
      if (!markerUrl) return;
      transition.hidden = false;
      transition.style.backgroundImage = 'url("' + markerUrl.replace(/"/g, '\\"') + '")';
      transition.style.backgroundPosition = "center";
      transition.style.backgroundSize = "contain";
      transition.style.backgroundRepeat = "no-repeat";
      transitionVideo.style.opacity = "0";
      window.clearTimeout(showEndLevelMarker.timer);
      showEndLevelMarker.timer = window.setTimeout(() => {
        transition.hidden = true;
        transition.style.backgroundImage = "";
      }, 2200);
    }

    function transitionUrl() {
      // Tower entry must use tower.mp4 itself. Do not silently replace it with
      // another portal clip: the landing clip is part of the handoff contract.
      return CONFIG.transition || "";
    }

    function triggerTransition() {
      if (transitionStarted) return false;
      const url = transitionUrl();
      if (!url) {
        status.textContent = "TOWER LANDING VIDEO MISSING · tower.mp4";
        transition.hidden = false;
        transitionVideo.style.opacity = "0";
        return false;
      }

      transitionStarted = true;
      transition.hidden = false;
      transitionVideo.style.opacity = "0";
      const markerUrl = helipadMarkerUrl();
      if (markerUrl) {
        transition.style.backgroundImage = 'url("' + markerUrl.replace(/"/g, '\\"') + '")';
        transition.style.backgroundPosition = "center";
        transition.style.backgroundSize = "contain";
        transition.style.backgroundRepeat = "no-repeat";
      } else {
        transition.style.backgroundImage = "";
      }
      transitionVideo.muted = true;
      transitionVideo.defaultMuted = true;
      transitionVideo.setAttribute("muted", "");
      transitionVideo.setAttribute("playsinline", "");
      transitionVideo.setAttribute("webkit-playsinline", "");
      transitionVideo.playsInline = true;
      transitionVideo.preload = "auto";
      try { transitionVideo.fetchPriority = "high"; } catch (e) {}

      let revealed = false;
      const revealFirstFrame = () => {
        if (revealed || !transitionStarted) return;
        revealed = true;

        // loadeddata means the first decoded frame is available. Reveal the
        // transition only now, exactly like the mini-sim portal cutscenes.
        try { transitionVideo.currentTime = 0; } catch (e) {}
        transitionVideo.style.opacity = "1";
        playTowerAudio();

        const playPromise = transitionVideo.play();
        if (playPromise && playPromise.catch) {
          playPromise.catch(() => {
            status.textContent = "TOWER LANDING VIDEO READY · PLAY BLOCKED";
          });
        }
      };

      transitionVideo.onloadedmetadata = () => {
        try { transitionVideo.currentTime = 0; } catch (e) {}
      };
      transitionVideo.onloadeddata = revealFirstFrame;
      transitionVideo.oncanplay = revealFirstFrame;
      transitionVideo.onplaying = () => {
        transition.hidden = false;
        transitionVideo.style.opacity = "1";
      };
      transitionVideo.onended = () => {
        stopTransition();
        showMenu();
      };
      transitionVideo.onerror = () => {
        stopTransition();
        status.textContent = "TOWER LANDING VIDEO ERROR · tower.mp4";
      };

      transitionVideo.src = url;
      transitionVideo.load();

      // Muted autoplay should be allowed, but decoding/reveal is still gated
      // by loadeddata so Tower never jumps ahead of the first frame.
      const playPromise = transitionVideo.play();
      if (playPromise && playPromise.catch) playPromise.catch(() => {});

      return true;
    }

    function startNewTower() {
      if (!gameStarted) return;
      buildTower(makeSeed());
      status.textContent = mode === "multi" ? "НОВАЯ ОБЩАЯ БАШНЯ" : "НОВЫЙ SEED";
    }

    function setAction(index, action, value) {
      if (!controls[index] || !(action in controls[index])) return;
      controls[index][action] = value;
    }

    function clearControls(index) {
      Object.keys(controls[index]).forEach(k => controls[index][k] = false);
    }

    const keyMap = {
      KeyA: [0, "left"],
      KeyD: [0, "right"],
      KeyW: [0, "up"],
      KeyS: [0, "down"],
      Space: [0, "jump"],
      KeyE: [0, "interact"],

      // P2 keyboard fallback when no gamepad is available.
      ArrowLeft: [1, "left"],
      ArrowRight: [1, "right"],
      ArrowUp: [1, "up"],
      ArrowDown: [1, "down"],
      KeyX: [1, "jump"],
      ShiftRight: [1, "interact"]
    };

    window.addEventListener("keydown", (event) => {
      if (!gameStarted) {
        if (event.code === "Digit1") startMode("single");
        if (event.code === "Digit2") startMode("multi");
        return;
      }

      if (event.code === "KeyR") {
        startNewTower();
        return;
      }

      const mapped = keyMap[event.code];
      if (!mapped) return;
      event.preventDefault();

      const [index, action] = mapped;
      if (action === "jump") {
        if (!event.repeat) doJump(index);
      } else if (action === "interact") {
        if (!event.repeat) interact(index);
      } else {
        setAction(index, action, true);
      }
    });

    window.addEventListener("keyup", (event) => {
      const mapped = keyMap[event.code];
      if (!mapped) return;
      const [index, action] = mapped;
      if (action !== "jump" && action !== "interact") {
        setAction(index, action, false);
      }
    });

    let mouseDown = false;
    let mousePlayer = 0;

    root.addEventListener("pointerdown", (event) => {
      if (!gameStarted || event.target.closest("button")) return;
      mouseDown = true;

      if (mode === "multi") {
        const rect = root.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        if (rect.width >= rect.height) mousePlayer = x > rect.width / 2 ? 1 : 0;
        else mousePlayer = y > rect.height / 2 ? 1 : 0;
      } else {
        mousePlayer = 0;
      }

      canvas.setPointerCapture?.(event.pointerId);
    });

    root.addEventListener("pointerup", () => {
      mouseDown = false;
    });

    root.addEventListener("pointercancel", () => {
      mouseDown = false;
    });

    root.addEventListener("pointermove", (event) => {
      if (!mouseDown || !gameStarted) return;
      const p = players[mousePlayer];
      p.angle += event.movementX * 0.0125;
      p.vy += clamp(-event.movementY * 0.035, -3, 3);
    });

    mobile?.addEventListener("pointerdown", (event) => {
      const button = event.target.closest("[data-tower-control]");
      if (!button) return;
      event.stopPropagation();

      const index = Number(button.dataset.towerPlayer || 0);
      const action = button.dataset.towerControl;
      if (action === "jump") doJump(index);
      else setAction(index, action, true);
    });

    mobile?.addEventListener("pointerup", (event) => {
      const button = event.target.closest("[data-tower-control]");
      if (!button) return;
      event.stopPropagation();

      const index = Number(button.dataset.towerPlayer || 0);
      const action = button.dataset.towerControl;
      if (action !== "jump") setAction(index, action, false);
    });

    mobile?.addEventListener("pointercancel", () => {
      clearControls(0);
      clearControls(1);
    });

    modeButtons.forEach(button => {
      button.addEventListener("click", () => {
        syncCrewSelectionFromMiniSim();
        startMode(button.dataset.towerMode);
      });
    });

    restartButton.addEventListener("click", startNewTower);

    transitionClose.addEventListener("click", () => {
      stopTransition();
      showMenu();
    });

    function pollGamepads() {
      const pads = navigator.getGamepads ? [...navigator.getGamepads()] : [];
      const connectedPads = pads.filter(Boolean);

      // Multi-player assignment:
      // 0 gamepads  -> P1 keyboard + P2 keyboard
      // 1 gamepad   -> gamepad automatically becomes P2, P1 stays keyboard
      // 2+ gamepads -> first two gamepads become P1 and P2 separately.
      let assignedPads;
      if (mode === "multi") {
        if (connectedPads.length === 1) {
          assignedPads = [null, connectedPads[0]];
        } else {
          assignedPads = [connectedPads[0] || null, connectedPads[1] || null];
        }
      } else {
        assignedPads = [connectedPads[0] || null, null];
      }

      if (!gameStarted) {
        const pad = connectedPads[0] || null;
        if (!pad) return;
        if (pad.buttons?.[0]?.pressed && !edgeState[0].jump) startMode("single");
        if (pad.buttons?.[1]?.pressed && !edgeState[0].interact) startMode("multi");
        edgeState[0].jump = !!pad.buttons?.[0]?.pressed;
        edgeState[0].interact = !!pad.buttons?.[1]?.pressed;
        return;
      }

      for (let i = 0; i < 2; i++) {
        const pad = assignedPads[i];
        if (!pad) {
          // Keyboard, mouse and touch controls share this state. An absent
          // gamepad must not erase a held keyboard key every 60 ms.
          if (gamepadPresent[i]) {
            clearControls(i);
            gamepadPresent[i] = false;
          }
          continue;
        }

        gamepadPresent[i] = true;

        const lx = pad.axes?.[0] || 0;
        const ly = pad.axes?.[1] || 0;
        const dead = 0.16;

        controls[i].left = lx < -dead;
        controls[i].right = lx > dead;
        controls[i].up = ly < -dead;
        controls[i].down = ly > dead;

        const jumpPressed = !!pad.buttons?.[0]?.pressed;
        const interactPressed = !!pad.buttons?.[2]?.pressed;
        const restartPressed = !!pad.buttons?.[3]?.pressed;

        if (jumpPressed && !edgeState[i].jump) doJump(i);
        if (interactPressed && !edgeState[i].interact) interact(i);
        if (restartPressed && !edgeState[i].restart) startNewTower();

        edgeState[i].jump = jumpPressed;
        edgeState[i].interact = interactPressed;
        edgeState[i].restart = restartPressed;
      }
    }

    let previousTime = performance.now();

    function frame(now) {
      const dt = Math.min(0.034, Math.max(0.001, (now - previousTime) / 1000));
      previousTime = now;

      if (tower) {
        if (gameStarted) {
          updateLiftMotion(now);
          updateBirds(now);

          for (let i = 0; i < (mode === "multi" ? 2 : 1); i++) {
            updatePlayer(i, dt);
            updatePlayerVisual(i);
          }

          if (mode === "multi") {
            updatePlayerVisual(1);
          }

          updateHud();
        }

        renderViews();
      }

      requestAnimationFrame(frame);
    }

    window.BCMTowerAPI = window.BCMTowerAPI || {};
    window.BCMTowerAPI.getCrewMatrix = () => window.BCMTowerCrewMatrix || null;
    window.BCMTowerAPI.getWallet = () => window.BCMiniCrewWallet || null;
    window.BCMTowerAPI.stopAudio = () => stopTowerAudio();
    window.BCMTowerAPI.enter = () => {
      root.hidden = false;
      menu.hidden = true;
      status.textContent = "LANDING VIDEO · PREPARING TOWER...";
      try {
        if (!tower) buildTower(makeSeed());
      } catch (error) {
        gameStarted = false;
        status.textContent = "TOWER ERROR: " + (error?.message || "BUILD FAILED");
        console.error("BCM Tower entry build failed", error);
        return;
      }
      resize();
      renderViews();
      if (!triggerTransition()) {
        status.textContent = "tower.mp4 не найден рядом с ассетами башни";
      }
    };
    window.BCMTowerAPI.beginLanding = () => window.BCMTowerAPI.enter();
    window.BCMTowerAPI.mount = (targetRoot) => {
      if (targetRoot && targetRoot !== root) {
        root.hidden = false;
      }
      requestAnimationFrame(() => {
        resize();
        renderViews();
      });
      return root;
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);

    const autostart = root.dataset.bcmTowerAutostart !== "0";
    if (autostart) {
      status.textContent = "LANDING VIDEO...";
      menu.hidden = true;
      triggerTransition();
    } else {
      status.textContent = "TOWER STANDBY";
      showMenu();
    }
    setInterval(pollGamepads, 60);
    requestAnimationFrame(frame);
  }

  function bootAll() {
    document.querySelectorAll(".bcm-tower").forEach(boot);
  }

  function waitForThree() {
    loadScript(THREE_URL).then(bootAll).catch((error) => {
      document.querySelectorAll(".bcm-tower-status").forEach((el) => {
        el.textContent = "ERROR: " + error.message;
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", waitForThree, { once: true });
  } else {
    waitForThree();
  }
})();
