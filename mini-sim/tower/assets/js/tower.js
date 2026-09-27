(() => {
  "use strict";

  const THREE_URL = window.BCMTowerConfig?.threeUrl || "";
  const CONFIG = window.BCMTowerConfig || {};

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (window.THREE) return resolve();
      if (!src) return reject(new Error("Three.js URL missing"));
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
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

  function assetTexture(url, renderer, repeat = false) {
    if (!url || !window.THREE) return null;
    const tex = new THREE.TextureLoader().load(url);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    tex.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    if (!repeat) tex.needsUpdate = true;
    return tex;
  }

  function makeTextureMatrix(tex, opts) {
    if (!tex) return;
    const scale = opts.scale ?? 1;
    const rotation = opts.rotation ?? 0;
    const offsetX = opts.offsetX ?? 0;
    const offsetY = opts.offsetY ?? 0;
    tex.matrixAutoUpdate = false;
    tex.matrix.identity();
    tex.matrix.setUvTransform(offsetX, offsetY, scale, scale, rotation, 0.5, 0.5);
    tex.needsUpdate = true;
  }

  function generateTower(seed, options = {}) {
    const rand = mulberry32(seed);
    const sectors = options.sectors || 18;
    const levels = options.levels || 34;
    const stepY = options.stepY || 4.0;
    const path = [];
    const cells = new Map();

    function key(level, sector) {
      return level + ":" + ((sector % sectors) + sectors) % sectors;
    }

    function setCell(level, sector, cell) {
      const s = ((sector % sectors) + sectors) % sectors;
      cells.set(key(level, s), { level, sector: s, ...cell });
    }

    // Guaranteed route: one reachable platform per level.
    let sector = Math.floor(rand() * sectors);
    path.push(sector);
    setCell(levels - 1, sector, { type: "start" });

    for (let level = levels - 2; level >= 0; level--) {
      const maxDelta = level % 5 === 0 ? 2 : 1;
      const choices = [];
      for (let d = -maxDelta; d <= maxDelta; d++) {
        if (d !== 0 || rand() > 0.32) choices.push(d);
      }
      sector = (sector + choices[Math.floor(rand() * choices.length)]) % sectors;
      if (sector < 0) sector += sectors;
      path.push(sector);
      setCell(level, sector, {
        type: level === 0 ? "exit" : "path"
      });
    }

    // Safe shoulder platforms + optional mechanics.
    for (let level = 0; level < levels; level++) {
      const routeSector = path[levels - 1 - level];
      const sideCount = 1 + Math.floor(rand() * 3);
      for (let i = 0; i < sideCount; i++) {
        const delta = (rand() < 0.5 ? -1 : 1) * (1 + Math.floor(rand() * 3));
        const side = (routeSector + delta + sectors) % sectors;
        if (!cells.has(key(level, side))) {
          setCell(level, side, {
            type: rand() < 0.12 ? "vanish" : "solid"
          });
        }
      }
      if (rand() < 0.10 && level > 2 && level < levels - 2) {
        setCell(level, (routeSector + (rand() < 0.5 ? -2 : 2) + sectors) % sectors, {
          type: "moving",
          phase: rand() * Math.PI * 2
        });
      }
    }

    // Sparse gaps and obstacles; never delete the route.
    const cellsArray = [...cells.values()];
    for (const cell of cellsArray) {
      if (cell.type !== "solid") continue;
      if (rand() < 0.20) {
        cell.type = "danger";
      }
    }

    // Optional planet-map selection is deliberately data-only for now.
    const planetMap = Array.isArray(CONFIG.planetMaps) && CONFIG.planetMaps.length
      ? CONFIG.planetMaps[Math.floor(rand() * CONFIG.planetMaps.length)]
      : "";

    return {
      seed,
      sectors,
      levels,
      stepY,
      path,
      cells,
      planetMap
    };
  }

  function boot(root) {
    const canvas = root.querySelector(".bcm-tower-canvas");
    const status = root.querySelector(".bcm-tower-status");
    const levelEl = root.querySelector(".bcm-tower-level");
    const crewEl = root.querySelector(".bcm-tower-crew");
    const restartButton = root.querySelector(".bcm-tower-restart");
    const transition = root.querySelector(".bcm-tower-transition");
    const transitionVideo = root.querySelector(".bcm-tower-transition-video");
    const transitionClose = root.querySelector(".bcm-tower-transition-close");
    const mobile = root.querySelector(".bcm-tower-mobile");
    const inline = root.querySelector(".bcm-tower-inline-config");

    if (!canvas || !window.THREE) return;

    let inlineConfig = {};
    try {
      inlineConfig = JSON.parse(inline?.textContent || "{}");
    } catch (e) {}

    const seed = makeSeed();
    const tower = generateTower(seed);
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: "high-performance"
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(root.clientWidth, root.clientHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x02050a);

    const camera = new THREE.PerspectiveCamera(62, root.clientWidth / root.clientHeight, 0.1, 500);
    camera.position.set(0, 4.5, 19);

    const ambient = new THREE.HemisphereLight(0xaad8ff, 0x061018, 1.2);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.25);
    keyLight.position.set(5, 20, 12);
    scene.add(keyLight);

    const towerGroup = new THREE.Group();
    scene.add(towerGroup);

    const radius = 8.4;
    const towerHeight = (tower.levels - 1) * tower.stepY + 10;

    const wallTexture = assetTexture(CONFIG.towerTexture, renderer, true);
    if (wallTexture) {
      wallTexture.repeat.set(6, Math.max(4, towerHeight / 10));
      wallTexture.needsUpdate = true;
    }

    const wall = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, towerHeight, 48, 1, true),
      new THREE.MeshStandardMaterial({
        map: wallTexture || null,
        color: wallTexture ? 0xffffff : 0x29445c,
        roughness: 0.92,
        metalness: 0.08,
        side: THREE.DoubleSide
      })
    );
    towerGroup.add(wall);

    const platformTexture = assetTexture(CONFIG.platformTexture, renderer, false);

    const platformGroup = new THREE.Group();
    towerGroup.add(platformGroup);

    const platformGeometry = new THREE.BoxGeometry(2.15, 0.55, 1.15);
    const platformMaterial = new THREE.MeshStandardMaterial({
      map: platformTexture || null,
      color: platformTexture ? 0xffffff : 0x8eb0c9,
      roughness: 0.82,
      metalness: 0.15
    });

    const dangerMaterial = new THREE.MeshStandardMaterial({
      color: 0xa43a3a,
      emissive: 0x310909,
      roughness: 0.8,
      metalness: 0.05
    });

    const platformMeshes = [];
    for (const cell of tower.cells.values()) {
      if (!["start", "path", "solid", "vanish", "moving", "danger", "exit"].includes(cell.type)) continue;
      const mesh = new THREE.Mesh(platformGeometry, cell.type === "danger" ? dangerMaterial : platformMaterial);
      const angle = (cell.sector / tower.sectors) * Math.PI * 2;
      mesh.position.set(
        Math.sin(angle) * (radius + 0.4),
        cell.level * tower.stepY - ((tower.levels - 1) * tower.stepY),
        Math.cos(angle) * (radius + 0.4)
      );
      mesh.lookAt(0, mesh.position.y, 0);
      mesh.userData = cell;
      platformGroup.add(mesh);
      platformMeshes.push(mesh);
    }

    // Top and bottom rings make the structure readable at a distance.
    const ringMaterial = new THREE.MeshStandardMaterial({ color: 0x345a75, metalness: 0.3, roughness: 0.72 });
    const ringGeo = new THREE.TorusGeometry(radius + 0.12, 0.25, 8, 32);
    for (const y of [towerHeight / 2 - 5, -towerHeight / 2 + 5]) {
      const ring = new THREE.Mesh(ringGeo, ringMaterial);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      towerGroup.add(ring);
    }

    let ship = null;
    if (CONFIG.shipTexture) {
      const shipTex = assetTexture(CONFIG.shipTexture, renderer, false);
      if (shipTex) {
        // Separate texture matrix: ship art can be shifted/scaled without touching tower UVs.
        makeTextureMatrix(shipTex, { scale: 1, rotation: 0, offsetX: 0, offsetY: 0 });
        ship = new THREE.Mesh(
          new THREE.PlaneGeometry(5.2, 3.0),
          new THREE.MeshBasicMaterial({
            map: shipTex,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide
          })
        );
        ship.position.set(0, towerHeight / 2 + 7, 0);
        ship.lookAt(camera.position);
        scene.add(ship);
      }
    }

    const crewImage = inlineConfig.crewImage || "";
    let crewSprite = null;
    if (crewImage) {
      const crewTex = assetTexture(crewImage, renderer, false);
      if (crewTex) {
        crewSprite = new THREE.Sprite(new THREE.SpriteMaterial({
          map: crewTex,
          transparent: true,
          depthWrite: false,
          sizeAttenuation: true
        }));
        crewSprite.scale.set(2.8, 2.8, 1);
        scene.add(crewSprite);
      }
    }

    const player = {
      levelFloat: tower.levels - 1,
      y: (tower.levels - 1) * tower.stepY - ((tower.levels - 1) * tower.stepY),
      vy: 0,
      angle: tower.path[0],
      jumps: 0,
      grounded: true,
      alive: true,
      cameraYaw: 0,
      cameraPitch: 0
    };

    // Start near the upper route platform.
    player.y = 0;
    const gravity = 18;
    const jumpVelocity = 9.2;
    const horizontalAngularSpeed = 3.2;
    const control = { left: false, right: false, jump: false, up: false, down: false };
    let previousTime = performance.now();
    let lastGround = null;
    let transitionStarted = false;

    function sectorFromAngle(angle) {
      const s = Math.round(angle) % tower.sectors;
      return (s + tower.sectors) % tower.sectors;
    }

    function currentRouteLevel() {
      const raw = Math.round((player.y - (-((tower.levels - 1) * tower.stepY))) / tower.stepY);
      return clamp(tower.levels - 1 - raw, 0, tower.levels - 1);
    }

    function findSurfaceAt(level, sector) {
      const candidates = [];
      for (let d = -1; d <= 1; d++) {
        const s = (sector + d + tower.sectors) % tower.sectors;
        const cell = tower.cells.get(level + ":" + s);
        if (cell) candidates.push({ cell, delta: d });
      }
      if (!candidates.length) return null;
      candidates.sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta));
      return candidates[0].cell;
    }

    function triggerTransition() {
      if (transitionStarted || !CONFIG.transition) return;
      transitionStarted = true;
      transition.hidden = false;
      transitionVideo.src = CONFIG.transition;
      transitionVideo.currentTime = 0;
      transitionVideo.play().catch(() => {});
      transitionVideo.onended = () => {
        transition.hidden = true;
        startNewTower(true);
      };
    }

    function updatePlayer(dt) {
      if (!player.alive) return;

      const horizontal =
        (control.right ? 1 : 0) +
        (control.left ? -1 : 0);

      player.angle += horizontal * horizontalAngularSpeed * dt;
      player.vy -= gravity * dt;

      if (control.up) player.vy += 11 * dt;
      if (control.down) player.vy -= 11 * dt;

      player.y += player.vy * dt;

      // The route cells are the only cells used to prove reachability.
      const topY = 0;
      const bottomY = -((tower.levels - 1) * tower.stepY);

      if (player.y > topY + 1.6) {
        player.y = topY + 1.6;
        player.vy = Math.min(player.vy, 0);
      }

      if (player.y < bottomY - 4.5) {
        player.alive = false;
        status.textContent = "СПУСК ЗАВЕРШЁН — ВЫ ДОШЛИ ДО ОСНОВАНИЯ";
        restartButton.hidden = false;
        return;
      }

      const levelApprox = Math.round((player.y - bottomY) / tower.stepY);
      const worldLevel = clamp(tower.levels - 1 - levelApprox, 0, tower.levels - 1);
      const sector = sectorFromAngle(player.angle);
      const surface = findSurfaceAt(worldLevel, sector);

      if (surface && player.vy <= 0) {
        const surfaceY = (worldLevel * tower.stepY) - ((tower.levels - 1) * tower.stepY);
        if (player.y <= surfaceY + 0.55 && player.y >= surfaceY - 1.4) {
          player.y = surfaceY + 0.58;
          player.vy = 0;
          player.grounded = true;
          player.jumps = 0;
          lastGround = surface;
          if (surface.type === "vanish") {
            setTimeout(() => {
              const mesh = platformMeshes.find(m => m.userData === surface);
              if (mesh) mesh.visible = false;
              tower.cells.delete(surface.level + ":" + surface.sector);
            }, 110);
          }
        } else {
          player.grounded = false;
        }
      } else {
        player.grounded = false;
      }

      // Reach exit when the guaranteed bottom route is touched.
      if (worldLevel <= 0 && player.y < bottomY + 2.5) {
        status.textContent = "ВЫХОД НАЙДЕН";
        restartButton.hidden = false;
      }
    }

    function doJump() {
      if (player.grounded) {
        player.vy = jumpVelocity;
        player.grounded = false;
        player.jumps = 1;
        return;
      }
      if (player.jumps < 2) {
        player.vy = jumpVelocity * 0.84;
        player.jumps = 2;
      }
    }

    function setControl(name, value) {
      if (name === "jump") {
        if (value) doJump();
        return;
      }
      if (name in control) control[name] = value;
    }

    function updateVisuals() {
      // The player stays visually centered while the tower rotates.
      const playerAngle = (player.angle / tower.sectors) * Math.PI * 2;
      towerGroup.rotation.y = -playerAngle;

      const playerPos = new THREE.Vector3(
        Math.sin(playerAngle) * (radius + 1.05),
        player.y,
        Math.cos(playerAngle) * (radius + 1.05)
      );

      camera.position.x = playerPos.x;
      camera.position.y = playerPos.y + 0.7;
      camera.position.z = playerPos.z;
      const look = new THREE.Vector3(0, player.y, 0);
      camera.lookAt(look);

      if (ship) ship.quaternion.copy(camera.quaternion);
      if (crewSprite) {
        crewSprite.position.set(
          playerPos.x * 0.72,
          playerPos.y + 1.25,
          playerPos.z * 0.72
        );
        crewSprite.quaternion.copy(camera.quaternion);
      }
    }

    function statusText() {
      const logical = tower.levels - 1 - Math.round((player.y - (-(tower.levels - 1) * tower.stepY)) / tower.stepY);
      const remaining = clamp(logical, 0, tower.levels - 1);
      levelEl.textContent = "УРОВЕНЬ: " + remaining + "/" + (tower.levels - 1) +
        " · СЕКТОР: " + sectorFromAngle(player.angle) +
        " · SEED: " + tower.seed;
      if (inlineConfig.crewName) {
        crewEl.textContent = "CREW: " + inlineConfig.crewName;
      } else {
        crewEl.textContent = crewImage ? "CREW: NFT IMAGE" : "CREW: локальная текстура/ожидает NFT";
      }
    }

    function resize() {
      const w = Math.max(1, root.clientWidth);
      const h = Math.max(1, root.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }

    function startNewTower(fromTransition) {
      window.location.hash = "bcm-tower-" + makeSeed().toString(16);
      window.location.reload();
      if (fromTransition) return;
    }

    function frame(now) {
      const dt = Math.min(0.034, Math.max(0.001, (now - previousTime) / 1000));
      previousTime = now;

      updatePlayer(dt);
      updateVisuals();
      statusText();

      if (!transitionStarted && player.y < -tower.stepY * 0.9) {
        // First substantial descent does not trigger a video by itself; the
        // transition is reserved for entering/re-entering the tower from the ship.
      }

      renderer.render(scene, camera);
      requestAnimationFrame(frame);
    }

    // Desktop keyboard.
    window.addEventListener("keydown", (event) => {
      if (event.code === "KeyA") setControl("left", true);
      if (event.code === "KeyD") setControl("right", true);
      if (event.code === "KeyW") setControl("up", true);
      if (event.code === "KeyS") setControl("down", true);
      if (event.code === "Space" && !event.repeat) setControl("jump", true);
      if (event.code === "KeyR") startNewTower(false);
    });

    window.addEventListener("keyup", (event) => {
      if (event.code === "KeyA") setControl("left", false);
      if (event.code === "KeyD") setControl("right", false);
      if (event.code === "KeyW") setControl("up", false);
      if (event.code === "KeyS") setControl("down", false);
    });

    // Mouse: horizontal motion changes tower angle; vertical motion is a small jetpack trim.
    let mouseDown = false;
    root.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button")) return;
      mouseDown = true;
      canvas.setPointerCapture?.(event.pointerId);
    });
    root.addEventListener("pointerup", () => { mouseDown = false; });
    root.addEventListener("pointercancel", () => { mouseDown = false; });
    root.addEventListener("pointermove", (event) => {
      if (!mouseDown) return;
      player.angle += event.movementX * 0.025;
      player.vy += clamp(-event.movementY * 0.02, -2.5, 2.5);
    });

    // Gamepad.
    function pollGamepad() {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const pad = [...pads].find(Boolean);
      if (!pad) return;
      const lx = pad.axes?.[0] || 0;
      control.left = lx < -0.18;
      control.right = lx > 0.18;
      const ly = pad.axes?.[1] || 0;
      control.up = ly < -0.28;
      control.down = ly > 0.28;
      if (pad.buttons?.[0]?.pressed && !pollGamepad._a) doJump();
      pollGamepad._a = !!pad.buttons?.[0]?.pressed;
      if (pad.buttons?.[3]?.pressed && !pollGamepad._y) startNewTower(false);
      pollGamepad._y = !!pad.buttons?.[3]?.pressed;
    }

    mobile?.addEventListener("pointerdown", (event) => {
      const button = event.target.closest("[data-tower-control]");
      if (!button) return;
      const action = button.dataset.towerControl;
      if (action === "jump") setControl("jump", true);
      else setControl(action, true);
    });
    mobile?.addEventListener("pointerup", (event) => {
      const button = event.target.closest("[data-tower-control]");
      if (!button) return;
      const action = button.dataset.towerControl;
      setControl(action, false);
    });
    mobile?.addEventListener("pointercancel", () => {
      control.left = control.right = false;
    });

    restartButton.addEventListener("click", () => startNewTower(false));
    transitionClose.addEventListener("click", () => {
      transition.hidden = true;
      transitionVideo.pause();
      transitionVideo.removeAttribute("src");
      transitionStarted = false;
    });

    // Public hook for the existing mini-sim:
    // window.BCMTowerAPI.enter() may be called when the player reaches a planet marker.
    window.BCMTowerAPI = window.BCMTowerAPI || {};
    window.BCMTowerAPI.enter = function () {
      if (!CONFIG.transition) return;
      triggerTransition();
    };

    status.textContent = "TOWER ONLINE";
    restartButton.hidden = true;
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);

    // Initial ship-arrival transition: only when requested by query/hash,
    // so the stand-alone shortcode does not unexpectedly play media.
    if (new URLSearchParams(window.location.search).get("towerArrival") === "1") {
      triggerTransition();
    }

    resize();
    requestAnimationFrame(frame);

    // Keep this lightweight loop separate from the render loop.
    setInterval(pollGamepad, 80);
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
