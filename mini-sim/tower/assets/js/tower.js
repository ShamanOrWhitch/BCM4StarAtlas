(() => {
  "use strict";

  const CONFIG = window.BCMTowerConfig || {};
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

  function assetPool(name) {
    return Array.isArray(CONFIG[name]) ? CONFIG[name].filter(Boolean) : [];
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
    const cache = assetTexture.cache || (assetTexture.cache = new Map());
    if (cache.has(url)) return cache.get(url);

    const tex = new THREE.TextureLoader().load(url);
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

    cache.set(url, tex);
    return tex;
  }

  function makeMaterial(tex, color = 0xffffff, transparent = false) {
    return new THREE.MeshStandardMaterial({
      map: tex || null,
      color: tex ? 0xffffff : color,
      roughness: 0.84,
      metalness: 0.08,
      transparent,
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
        const doorSector = wrapSector(routeSector + (rand() < 0.5 ? -3 : 3), sectors);
        const target = cells.get(key(level, doorSector));
        if (target && !target.object) {
          target.object = "door";
          doors.push(target);
        }
      }

      if (level > 5 && level < levels - 5 && rand() < 0.04) {
        const wallDoorSector = wrapSector(routeSector + (rand() < 0.5 ? -4 : 4), sectors);
        const target = cells.get(key(level, wallDoorSector));
        if (target && !target.object) target.object = "walldoor";
      }
    }

    if (doors.length >= 2) {
      for (let i = 0; i + 1 < doors.length; i += 2) {
        doors[i].doorPair = doors[i + 1];
        doors[i + 1].doorPair = doors[i];
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

    let inlineConfig = {};
    try {
      inlineConfig = JSON.parse(inline?.textContent || "{}");
    } catch (e) {}

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: "high-performance"
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.autoClear = false;

    if ("outputColorSpace" in renderer && THREE.SRGBColorSpace !== undefined) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    } else if ("outputEncoding" in renderer && THREE.sRGBEncoding !== undefined) {
      renderer.outputEncoding = THREE.sRGBEncoding;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x02050a);
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

    let wallMesh = null;
    let platformMeshes = [];
    let objectMeshes = [];
    let playerMarkers = [];
    let playerSprites = [];
    let playerTexture = null;

    const radius = 8.4;
    const cameraRadius = radius + 8.6;
    const gravity = 18;
    const jumpVelocity = 9.3;
    const baseTurnSpeed = 2.75;
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

    const players = [
      {
        y: 0, vy: 0, angle: 0, jumps: 0, grounded: false,
        currentCell: null, hazard: 0, slide: 0, finished: false, doorCooldown: 0, collected: 0
      },
      {
        y: 0, vy: 0, angle: 0, jumps: 0, grounded: false,
        currentCell: null, hazard: 0, slide: 0, finished: false, doorCooldown: 0, collected: 0
      }
    ];

    const cameras = [
      new THREE.PerspectiveCamera(62, 1, 0.1, 260),
      new THREE.PerspectiveCamera(62, 1, 0.1, 260)
    ];

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
      let depth = 1.15;
      let width = 2.15;

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
        repeat: cell.surface === "platform" || cell.surface === "ice" || cell.surface === "lava",
        repeatX: 1,
        repeatY: 1
      });

      const mesh = new THREE.Mesh(geometry, makeMaterial(tex, color));
      mesh.position.copy(p);
      mesh.rotation.y = (cell.sector / tower.sectors) * Math.PI * 2;
      mesh.userData.cell = cell;
      mesh.userData.baseX = p.x;
      mesh.userData.baseZ = p.z;

      if (cell.surface === "rock") {
        mesh.scale.set(1.0, 0.72, 1.15);
      }

      if (cell.surface === "lift") {
        cell.motion = ["vertical", "radial", "orbit"][cell.sector % 3];
        cell.motionSpeed = 0.55 + ((cell.level + cell.sector) % 3) * 0.15;
        cell.motionAmp = 0.8 + ((cell.level + cell.sector) % 2) * 0.7;
      }

      towerRoot.add(mesh);
      platformMeshes.push(mesh);
      return mesh;
    }

    function makeObject(cell) {
      if (!cell.object) return null;

      const p = cellWorldPosition(cell, 1.0);
      let url = "";
      let w = 1.9;
      let h = 2.2;

      if (cell.object === "landing") {
        url = pick(assetPool("landingPool"), mulberry32(seed ^ 0x19af ^ cell.sector));
        w = 2.2; h = 2.2;
      } else if (cell.object === "safebox" || cell.object === "box") {
        url = pick(assetPool("safeBoxPool").concat(assetPool("boxPool")), mulberry32(seed ^ 0x4b11 ^ cell.level));
        w = 1.6; h = 1.4;
      } else if (cell.object === "dangerbox") {
        url = pick(assetPool("dangerBoxPool"), mulberry32(seed ^ 0x4b22 ^ cell.level));
        w = 1.6; h = 1.4;
      } else if (cell.object === "fire") {
        url = pick(assetPool("firePool"), mulberry32(seed ^ 0x4b33 ^ cell.level));
        w = 1.45; h = 1.75;
      } else if (cell.object === "door") {
        url = pick(assetPool("doorPool"), mulberry32(seed ^ 0x4b44 ^ cell.level));
        w = 2.0; h = 3.0;
      } else if (cell.object === "walldoor") {
        url = pick(assetPool("wallDoorPool"), mulberry32(seed ^ 0x4b55 ^ cell.level));
        w = 2.35; h = 3.25;
      } else if (cell.object === "npc") {
        url = pick(assetPool("npcPool"), mulberry32(seed ^ 0x4b66 ^ cell.level));
        w = 2.0; h = 2.7;
      }

      if (!url) return null;
      const tex = assetTexture(url, renderer, false);
      if (!tex) return null;

      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide
        })
      );
      mesh.position.set(p.x, p.y + h * 0.45, p.z);
      mesh.userData.cell = cell;
      mesh.userData.objectType = cell.object;
      towerRoot.add(mesh);
      objectMeshes.push(mesh);
      return mesh;
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
      towerRoot.add(wallMesh);

      for (const cell of tower.cells.values()) {
        makeSurface(cell);
        makeObject(cell);
      }

      playerTexture = null;
      if (inlineConfig.crewImage) {
        playerTexture = assetTexture(inlineConfig.crewImage, renderer, false);
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

        if (playerTexture) {
          const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: playerTexture,
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

      for (let i = 0; i < 2; i++) resetPlayer(i, i === 0 ? 0 : 0.85);
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
      p.jumps = 0;
      p.grounded = true;
      p.currentCell = cell || null;
      p.hazard = 0;
      p.slide = 0;
      p.finished = false;
      p.doorCooldown = 0;
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
          const sectorAngle = sector * sectorWidth();
          const da = Math.abs(angleDelta(player.angle, sectorAngle));
          if (da > sectorWidth() * 0.72) continue;

          const y = cellWorldY(cell);
          const dy = player.y - (y + 0.72);
          candidates.push({ cell, y, dy, da });
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
      if (p.finished) return;
      if (p.grounded) {
        p.vy = jumpVelocity;
        p.grounded = false;
        p.jumps = 1;
        return;
      }
      if (p.jumps < 2) {
        p.vy = jumpVelocity * 0.84;
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
        const destination = cell.doorPair;
        p.angle = destination.sector * sectorWidth();
        p.y = cellWorldY(destination) + 1.05;
        p.vy = 0;
        p.currentCell = destination;
        p.doorCooldown = 0.9;
        status.textContent = "ДВЕРЬ: ПЕРЕХОД К ПАРНОЙ ТОЧКЕ";
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
        } else {
          cell.runtimeY = base + Math.sin(t) * 0.4;
          const a = cell.sector * sectorWidth() + Math.sin(t) * 0.22;
          const r = radius + 0.4;
          mesh.position.x = Math.sin(a) * r;
          mesh.position.z = Math.cos(a) * r;
          mesh.position.y = cell.runtimeY;
        }
      }
    }

    function updatePlayer(index, dt) {
      const p = players[index];
      const c = controls[index];
      if (p.finished) return;

      p.doorCooldown = Math.max(0, p.doorCooldown - dt);
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
      p.y += p.vy * dt;

      const bottomY = -((tower.levels - 1) * tower.stepY);
      if (p.y < bottomY - 4.2) {
        p.finished = true;
        p.vy = 0;
        p.grounded = false;
        status.textContent = mode === "multi" ? "ИГРОК ДОШЁЛ ДО ОСНОВАНИЯ" : "СПУСК ЗАВЕРШЁН";
        return;
      }

      const landing = findLanding(p);
      if (landing) {
        p.y = landing.y + 0.72;
        p.vy = 0;
        p.grounded = true;
        p.jumps = 0;
        p.currentCell = landing.cell;
      } else {
        p.grounded = false;
      }

      if (!p.grounded) return;

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
      const r = radius + 1.05;
      const x = Math.sin(a) * r;
      const z = Math.cos(a) * r;

      const marker = playerMarkers[index];
      if (marker) {
        marker.position.set(x, p.y + 0.35, z);
      }

      const sprite = playerSprites[index];
      if (sprite) {
        sprite.position.set(x, p.y + 1.35, z);
        sprite.quaternion.copy(cameras[index].quaternion);
      }
    }

    function updateCamera(index, viewport) {
      const p = players[index];
      const a = p.angle;
      const x = Math.sin(a) * cameraRadius;
      const z = Math.cos(a) * cameraRadius;
      const camera = cameras[index];

      camera.position.set(x, p.y + 4.5, z);
      camera.lookAt(new THREE.Vector3(0, p.y + 0.25, 0));
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
        modeEl.textContent = "SINGLE";
      } else {
        levelEl.textContent =
          "P1: " + currentLevelText(players[0]) +
          " · P2: " + currentLevelText(players[1]) +
          " · SEED " + tower.seed;
        modeEl.textContent = "MULTI / SHARED SEED";
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
    }

    function startMode(nextMode) {
      mode = nextMode === "multi" ? "multi" : "single";
      gameStarted = true;
      menu.hidden = true;
      mobile?.setAttribute("aria-hidden", "false");
      mobile?.querySelector(".bcm-tower-mobile-p2")?.toggleAttribute("hidden", mode !== "multi");
      root.classList.toggle("is-multi", mode === "multi");
      buildTower(makeSeed());

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
      modeEl.textContent = "";
    }

    function stopTransition() {
      transition.hidden = true;
      transitionVideo.pause();
      transitionVideo.removeAttribute("src");
      transitionVideo.load();
      transitionStarted = false;
    }

    function transitionUrl() {
      if (CONFIG.transition) return CONFIG.transition;
      const fallbacks = Array.isArray(CONFIG.transitionFallbacks)
        ? CONFIG.transitionFallbacks.filter(Boolean)
        : [];
      return fallbacks[0] || "";
    }

    function triggerTransition() {
      if (transitionStarted) return;
      const url = transitionUrl();
      if (!url) {
        showMenu();
        return;
      }

      transitionStarted = true;
      transition.hidden = false;
      transitionVideo.src = url;
      transitionVideo.currentTime = 0;

      transitionVideo.onended = () => {
        stopTransition();
        showMenu();
      };

      transitionVideo.play().catch(() => {
        stopTransition();
        showMenu();
      });
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

      ArrowLeft: [1, "left"],
      ArrowRight: [1, "right"],
      ArrowUp: [1, "up"],
      ArrowDown: [1, "down"],
      Enter: [1, "jump"],
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
      button.addEventListener("click", () => startMode(button.dataset.towerMode));
    });

    restartButton.addEventListener("click", startNewTower);

    transitionClose.addEventListener("click", () => {
      stopTransition();
      showMenu();
    });

    function pollGamepads() {
      const pads = navigator.getGamepads ? [...navigator.getGamepads()] : [];
      const activePads = [pads[0] || null, pads[1] || null];

      if (!gameStarted) {
        const pad = activePads[0];
        if (!pad) return;
        if (pad.buttons?.[0]?.pressed && !edgeState[0].jump) startMode("single");
        if (pad.buttons?.[1]?.pressed && !edgeState[0].interact) startMode("multi");
        edgeState[0].jump = !!pad.buttons?.[0]?.pressed;
        edgeState[0].interact = !!pad.buttons?.[1]?.pressed;
        return;
      }

      for (let i = 0; i < 2; i++) {
        const pad = activePads[i];
        if (!pad) {
          clearControls(i);
          continue;
        }

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

      if (gameStarted && tower) {
        updateLiftMotion(now);

        for (let i = 0; i < (mode === "multi" ? 2 : 1); i++) {
          updatePlayer(i, dt);
          updatePlayerVisual(i);
        }

        if (mode === "multi") {
          updatePlayerVisual(1);
        }

        updateHud();
        renderViews();
      }

      requestAnimationFrame(frame);
    }

    window.BCMTowerAPI = window.BCMTowerAPI || {};
    window.BCMTowerAPI.enter = triggerTransition;

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);

    status.textContent = "LANDING VIDEO...";
    menu.hidden = true;
    triggerTransition();
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
