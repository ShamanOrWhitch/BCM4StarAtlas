(() => {
  "use strict";

  const root = document.querySelector(".bcm-mini-sim");
  if (!root) return;

  const canvas = root.querySelector(".bcm-mini-sim-canvas");
  const startButton = root.querySelector(".bcm-mini-sim-start");
  const status = root.querySelector(".bcm-mini-sim-status");
  const assetStatus = root.querySelector(".bcm-mini-sim-asset-status");
  const interaction = root.querySelector(".bcm-mini-sim-interaction");
  const menuBackdrop = root.querySelector(".bcm-mini-sim-menu-backdrop");
  const musicButton = root.querySelector(".bcm-mini-sim-music");
  const musicAudio = root.querySelector(".bcm-mini-sim-music-audio");
  const tiltButton = root.querySelector('[data-control="tilt"]');
  const settingsRoot = root.querySelector(".bcm-mini-sim-settings");
  const transitionRoot = root.querySelector(".bcm-mini-sim-transition");
  const transitionVideo = root.querySelector(".bcm-mini-sim-transition-video");
  const transitionLabel = root.querySelector(".bcm-mini-sim-transition-label");
  const config = window.BCMMiniSimConfig || {};

  if (!canvas || !startButton || !status) return;

  const assets = Array.isArray(config.assets) ? config.assets : [];
  const byName = Object.create(null);
  assets.forEach((a) => {
    if (a && a.name && a.url) byName[String(a.name).toLowerCase()] = a.url;
  });

  function assetUrl(name) {
    const wanted = String(name || "").toLowerCase();
    if (byName[wanted]) return byName[wanted];
    const base = wanted.split("/").pop();
    if (byName[base]) return byName[base];
    const keys = Object.keys(byName);
    const hit = keys.find((k) => k.split("/").pop() === base);
    return hit ? byName[hit] : "";
  }

  const settings = {
    open: false,
    volume: 0.42,
    invertPitch: true,
    invertYaw: false
  };

  const keys = Object.create(null);
  const touch = Object.create(null);
  const stats = { total: 0, loaded: 0, failed: 0, last: "" };
  const ship = {
    position: null,
    velocity: null,
    angularVelocity: null,
    quaternion: null,
    visual: null,
    thrust: 18,
    strafeThrust: 12,
    verticalThrust: 12,
    linearDrag: 0.1,
    angularDrag: 0.55,
    maxSpeed: 42
  };
  const door = {
    state: "CLOSED",
    progress: 0,
    speed: 1.7,
    mesh: null,
    left: null,
    right: null,
    away: 0,
    style: "slide"
  };
  const DEEP_SPACE_Z = -83;
  const DEEP_SPACE_MIN_Z = -230;
  const portal = { mesh: null, backMesh: null, coverage: 0, z: -24.2, triggerFrontZ: -22.8, triggerBackZ: -25.8, direction: "FORWARD" };
  const returnDoor = {
    state: "CLOSED",
    progress: 0,
    speed: 1.7,
    mesh: null,
    left: null,
    right: null,
    away: 0,
    style: "slide"
  };
  const cinema = {
    zones: [],
    nearest: null,
    focus: null,
    mute: false,
    portalSafeRadius: 12
  };
  const liveWall = {
    el: null,
    texture: null,
    mesh: null,
    material: null,
    url: "",
    fallbackUrl: "",
    radius: 24,
    distance: 99,
    ready: false,
    primed: false,
    active: false,
    error: false
  };
  const backside = {
    urls: Array.isArray(config.backsideTextures) ? config.backsideTextures.slice() : [],
    panels: [],
    nextAt: 0
  };
  const tilt = {
    enabled: false,
    available: false,
    a: 0, b: 0, g: 0,
    na: 0, nb: 0, ng: 0,
    neutralB: 0, neutralG: 0
  };
  const pad = { index: -1, lx: 0, ly: 0, rx: 0, ry: 0, roll: 0, vert: 0, prev: [] };

  let renderer, scene, camera, light;
  let running = false;
  let pointerLocked = false;
  let last = performance.now();
  let transitionBusy = false;
  let transitionLoading = false;
  let musicAllowed = false;

  function setStatus(text) {
    status.textContent = text;
  }

  function hudAssets() {
    if (!assetStatus) return;
    assetStatus.textContent =
      "TEX " + stats.loaded + "/" + stats.total +
      (stats.failed ? " FAIL " + stats.failed + " " + stats.last : "") +
      (config.musicUrl ? " · OST" : " · NO OST");
  }

  function applyTex(tex) {
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    if ("encoding" in tex && THREE.sRGBEncoding !== undefined) tex.encoding = THREE.sRGBEncoding;
    tex.needsUpdate = true;
  }

  function textured(name, fallback, side) {
    const mat = new THREE.MeshBasicMaterial({
      color: fallback || 0x66707a,
      side: side || THREE.DoubleSide,
      fog: false
    });
    const url = assetUrl(name);
    stats.total++;
    hudAssets();
    if (!url) {
      stats.failed++;
      stats.loaded++;
      stats.last = name + " missing";
      hudAssets();
      return mat;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const tex = new THREE.Texture(img);
        applyTex(tex);
        mat.map = tex;
        mat.color.set(0xffffff);
        mat.needsUpdate = true;
        stats.loaded++;
        hudAssets();
      } catch (err) {
        stats.failed++;
        stats.loaded++;
        stats.last = name;
        hudAssets();
      }
    };
    img.onerror = () => {
      stats.failed++;
      stats.loaded++;
      stats.last = name + " 404";
      hudAssets();
    };
    img.src = url;
    return mat;
  }

  function plane(parent, x, y, z, w, h, rx, ry, rz, mat) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx || 0, ry || 0, rz || 0);
    parent.add(mesh);
    return mesh;
  }

  function box(parent, x, y, z, sx, sy, sz, mat) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  function addRoofCorners(parent, z, width, height) {
    const corner = textured("roofa.png", 0x8a9098);
    const corner2 = textured("roofa1.png", 0x8a9098);
    const s = 1.6;
    plane(parent, -width / 2 + 0.8, height / 2 - 0.05, z, s, s, Math.PI / 2, 0, 0, corner);
    plane(parent, width / 2 - 0.8, height / 2 - 0.05, z, s, s, Math.PI / 2, 0, Math.PI / 2, corner2);
    plane(parent, -width / 2 + 0.8, height / 2 - 0.05, z - 8, s, s, Math.PI / 2, 0, -Math.PI / 2, textured("roofa2.png", 0x8a9098));
    plane(parent, width / 2 - 0.8, height / 2 - 0.05, z + 8, s, s, Math.PI / 2, 0, Math.PI, textured("roofa.png", 0x8a9098));
  }

  function buildShipVisual() {
    if (ship.visual) return ship.visual;

    const group = new THREE.Group();
    group.name = "player-ship-visual";

    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x7d8794,
      metalness: 0.78,
      roughness: 0.28
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x202833,
      metalness: 0.55,
      roughness: 0.24
    });
    const trimMat = new THREE.MeshBasicMaterial({
      color: 0x9fdcff
    });
    const engineMat = new THREE.MeshBasicMaterial({
      color: 0x65b9ff
    });

    // Camera sits near the nose/cockpit; the body is mostly behind the camera,
    // so looking backwards reveals the actual rear of the craft.
    const fuselage = new THREE.Mesh(
      new THREE.BoxGeometry(1.35, 0.78, 3.8),
      hullMat
    );
    fuselage.position.set(0, -0.05, 1.45);
    group.add(fuselage);

    const rear = new THREE.Mesh(
      new THREE.BoxGeometry(1.75, 0.95, 0.85),
      darkMat
    );
    rear.position.set(0, 0, 3.1);
    group.add(rear);

    const wingL = new THREE.Mesh(
      new THREE.BoxGeometry(2.9, 0.12, 1.35),
      hullMat
    );
    wingL.position.set(-1.18, -0.08, 1.35);
    group.add(wingL);

    const wingR = wingL.clone();
    wingR.position.x = 1.18;
    group.add(wingR);

    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.95, 1.15),
      darkMat
    );
    tail.position.set(0, 0.52, 2.3);
    group.add(tail);

    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.12, 0.95),
      darkMat
    );
    canopy.position.set(0, 0.38, 0.42);
    group.add(canopy);

    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.08, 2.1),
      trimMat
    );
    trim.position.set(0, 0.33, 1.55);
    group.add(trim);

    [-0.42, 0.42].forEach((x) => {
      const nozzle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.23, 0.35, 8),
        darkMat
      );
      nozzle.rotation.x = Math.PI / 2;
      nozzle.position.set(x, -0.02, 3.48);
      group.add(nozzle);

      const glow = new THREE.Mesh(
        new THREE.CylinderGeometry(0.10, 0.15, 0.12, 8),
        engineMat
      );
      glow.rotation.x = Math.PI / 2;
      glow.position.set(x, -0.02, 3.72);
      group.add(glow);
    });

    group.renderOrder = 3;
    scene.add(group);
    ship.visual = group;
    return group;
  }

  function buildRoom(parent, opt) {
    const floor = textured(opt.floor, opt.floorColor);
    const ceil = textured(opt.ceiling, opt.ceilingColor);
    const left = textured(opt.left, opt.leftColor);
    plane(parent, 0, -3.5, opt.z, opt.w, opt.len, -Math.PI / 2, 0, 0, floor);
    plane(parent, 0, 3.5, opt.z, opt.w, opt.len, Math.PI / 2, 0, 0, ceil);
    plane(parent, -opt.w / 2, 0, opt.z, opt.len, opt.h, 0, Math.PI / 2, 0, left);
    if (opt.right !== false) {
      const right = textured(opt.right, opt.rightColor);
      plane(parent, opt.w / 2, 0, opt.z, opt.len, opt.h, 0, -Math.PI / 2, 0, right);
    }
    addRoofCorners(parent, opt.z, opt.w, opt.h);
  }

  function buildStarbaseExterior(parent) {
    const urls = Array.isArray(backside.urls) ? backside.urls.filter(Boolean) : [];
    if (!urls.length) return;

    const group = new THREE.Group();
    group.name = "starbase-exterior-skeleton";

    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x242b33,
      metalness: 0.72,
      roughness: 0.32
    });

    // Wrap the existing labyrinth footprint, not the distant free-flight tail.
    const startZ = -26;
    const endZ = -82;
    const centerZ = (startZ + endZ) / 2;
    const length = Math.abs(endZ - startZ);
    const width = 14.4;
    const height = 9.8;

    const leftRail = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.65, length), frameMat);
    leftRail.position.set(-width / 2, 0, centerZ);
    group.add(leftRail);

    const rightRail = leftRail.clone();
    rightRail.position.x = width / 2;
    group.add(rightRail);

    const topRail = new THREE.Mesh(new THREE.BoxGeometry(width, 0.65, length), frameMat);
    topRail.position.set(0, height / 2, centerZ);
    group.add(topRail);

    const bottomRail = topRail.clone();
    bottomRail.position.y = -height / 2;
    group.add(bottomRail);

    const materials = urls.map((url) => {
      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        fog: false,
        toneMapped: false
      });
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const tex = new THREE.Texture(img);
        applyTex(tex);
        material.map = tex;
        material.needsUpdate = true;
      };
      img.onerror = () => {
        material.color.set(0x303943);
        material.needsUpdate = true;
      };
      img.src = url;
      return material;
    });

    const panels = [];
    const addPanel = (x, y, z, w, h, rx, ry) => {
      const material = materials[panels.length % materials.length];
      const mesh = plane(group, x, y, z, w, h, rx || 0, ry || 0, 0, material);
      mesh.name = "starbase-backside-panel-" + panels.length;
      panels.push({ mesh, material });
    };

    // Five short bands around the old labyrinth = 20 lightweight outer plates.
    for (let z = -30; z >= -78; z -= 12) {
      addPanel(-width / 2 - 0.04, 0, z, 12, 6.8, 0, Math.PI / 2);
      addPanel(width / 2 + 0.04, 0, z, 12, 6.8, 0, -Math.PI / 2);
      addPanel(0, height / 2 + 0.04, z, 14, 9.2, Math.PI / 2, 0);
      addPanel(0, -height / 2 - 0.04, z, 14, 9.2, -Math.PI / 2, 0);
    }

    // Cross ribs keep the skeleton clearly visible between panels.
    for (let z = -26; z >= -82; z -= 14) {
      const rib = new THREE.Group();
      rib.position.z = z;

      const left = new THREE.Mesh(new THREE.BoxGeometry(0.6, height, 0.6), frameMat);
      left.position.x = -width / 2;
      rib.add(left);

      const right = left.clone();
      right.position.x = width / 2;
      rib.add(right);

      const top = new THREE.Mesh(new THREE.BoxGeometry(width, 0.6, 0.6), frameMat);
      top.position.y = height / 2;
      rib.add(top);

      const bottom = top.clone();
      bottom.position.y = -height / 2;
      rib.add(bottom);

      group.add(rib);
    }

    const front = new THREE.Group();
    front.position.z = startZ;
    const frontTop = new THREE.Mesh(new THREE.BoxGeometry(width, 0.7, 0.8), frameMat);
    frontTop.position.y = height / 2;
    front.add(frontTop);
    const frontBottom = frontTop.clone();
    frontBottom.position.y = -height / 2;
    front.add(frontBottom);
    const frontLeft = new THREE.Mesh(new THREE.BoxGeometry(0.7, height, 0.8), frameMat);
    frontLeft.position.x = -width / 2;
    front.add(frontLeft);
    const frontRight = frontLeft.clone();
    frontRight.position.x = width / 2;
    front.add(frontRight);
    group.add(front);

    parent.add(group);
    backside.panels = panels;
    backside.nextAt = performance.now() + 8000;
    randomizeBackside(performance.now());
  }

  function randomizeBackside(now) {
    if (!backside.panels.length) return;

    const materials = backside.panels.map((item) => item.material);
    for (let i = materials.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = materials[i];
      materials[i] = materials[j];
      materials[j] = tmp;
    }

    backside.panels.forEach((item, index) => {
      item.mesh.material = materials[index];
      item.material = materials[index];
    });

    backside.nextAt = now + 10000 + Math.random() * 9000;
  }

  function updateBacksideCamouflage(now) {
    if (now >= backside.nextAt) randomizeBackside(now);
  }

  function buildWorld() {
    const world = new THREE.Group();
    buildRoom(world, {
      z: -10, w: 12, len: 28, h: 8,
      floor: "wall1.png", ceiling: "roof.png",
      left: "wall3.png", right: false,
      floorColor: 0x46505b, ceilingColor: 0x8b9198,
      leftColor: 0x3b444f, rightColor: 0x343d47
    });
    buildRoom(world, {
      z: -66, w: 12, len: 34, h: 8,
      floor: "wall2.png", ceiling: "roof1.png",
      left: "wall5.png", right: "wall1.png",
      floorColor: 0x343d48, ceilingColor: 0x7c838c,
      leftColor: 0x48535e, rightColor: 0x3a444f
    });

    const spaceMat = new THREE.MeshBasicMaterial({ color: 0x05060a, side: THREE.BackSide });

    // Local void between the portal and Room 2.
    const voidBox = new THREE.Mesh(new THREE.BoxGeometry(80, 50, 28), spaceMat);
    voidBox.position.set(0, 0, -36);
    world.add(voidBox);

    // Large free-flight exterior space after the end of Room 2.
    const deepSpaceBox = new THREE.Mesh(new THREE.BoxGeometry(140, 90, 294), spaceMat);
    deepSpaceBox.position.set(0, 0, -230);
    deepSpaceBox.name = "deep-space-shell";
    world.add(deepSpaceBox);

    buildStarbaseExterior(world);

    const dock = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 1.4, 0.12),
      new THREE.MeshBasicMaterial({ color: 0xf4f4f4 })
    );
    dock.position.set(0, 0, -36);
    dock.name = "dock-target";
    world.add(dock);
    portal.dock = dock;

    const frame = new THREE.MeshStandardMaterial({ color: 0x242a32, metalness: 0.7, roughness: 0.4 });

    const group = new THREE.Group();
    group.position.set(0, 0, -22);
    box(group, 0, 3.3, 0, 7.2, 0.5, 0.7, frame);
    box(group, 0, -3.3, 0, 7.2, 0.5, 0.7, frame);
    box(group, -3.3, 0, 0, 0.5, 6.1, 0.7, frame);
    box(group, 3.3, 0, 0, 0.5, 6.1, 0.7, frame);
    const dmatL = textured("door2.png", 0xffffff);
    const dmatR = textured("door2.png", 0xffffff);
    door.left = plane(group, -1.52, 0, -0.35, 3.05, 6.1, 0, 0, 0, dmatL);
    door.right = plane(group, 1.52, 0, -0.35, 3.05, 6.1, 0, 0, 0, dmatR);
    scene.add(group);
    door.mesh = group;

    const returnGroup = new THREE.Group();
    returnGroup.position.set(0, 0, -27.2);
    box(returnGroup, 0, 3.3, 0, 7.2, 0.5, 0.7, frame);
    box(returnGroup, 0, -3.3, 0, 7.2, 0.5, 0.7, frame);
    box(returnGroup, -3.3, 0, 0, 0.5, 6.1, 0.7, frame);
    box(returnGroup, 3.3, 0, 0, 0.5, 6.1, 0.7, frame);
    const rmatL = textured("door3.png", 0xffffff);
    const rmatR = textured("door3.png", 0xffffff);
    returnDoor.left = plane(returnGroup, -1.52, 0, 0.35, 3.05, 6.1, 0, Math.PI, 0, rmatL);
    returnDoor.right = plane(returnGroup, 1.52, 0, 0.35, 3.05, 6.1, 0, Math.PI, 0, rmatR);
    scene.add(returnGroup);
    returnDoor.mesh = returnGroup;

    const pgroup = new THREE.Group();
    pgroup.position.set(0, 0, portal.z);
    const pmatFront = textured("portal.png", 0x88aacc, THREE.FrontSide);
    const pmatBack = textured("portal2.png", 0x88aacc, THREE.FrontSide);
    portal.mesh = plane(pgroup, 0, 0, 0.01, 5.2, 5.8, 0, 0, 0, pmatFront);
    portal.backMesh = plane(pgroup, 0, 0, -0.01, 5.2, 5.8, 0, Math.PI, 0, pmatBack);
    scene.add(pgroup);

    const videoZones = Array.isArray(config.spaceVideoZones) ? config.spaceVideoZones : [];
    videoZones.forEach((zone, index) => {
      if (!zone || !zone.url) return;
      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = "none";
      video.volume = 0;

      const texture = new THREE.VideoTexture(video);
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      if ("encoding" in texture && THREE.sRGBEncoding !== undefined) {
        texture.encoding = THREE.sRGBEncoding;
      }

      const material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide,
        fog: false,
        toneMapped: false
      });
      material.color.setRGB(1.14, 1.14, 1.14);

      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(zone.width || 5.8, zone.height || 3.4),
        material
      );
      mesh.position.set(zone.x || 0, zone.y || 0, zone.z || -36);
      mesh.name = "space-video-zone-" + index;
      scene.add(mesh);

      const item = {
        el: video,
        texture,
        mesh,
        url: zone.url,
        radius: Number(zone.radius) || 16,
        maxVolume: 1,
        active: false,
        visible: false,
        loaded: false,
        distance: 99
      };

      video.addEventListener("loadedmetadata", () => {
        if (!item.mesh || !video.videoWidth || !video.videoHeight) return;
        const maxW = zone.maxWidth || 6.8;
        const maxH = zone.maxHeight || 4.4;
        const aspect = video.videoWidth / video.videoHeight;
        let w = maxW;
        let h = w / aspect;
        if (h > maxH) {
          h = maxH;
          w = h * aspect;
        }
        item.mesh.geometry.dispose();
        item.mesh.geometry = new THREE.PlaneGeometry(w, h);
      });

      video.addEventListener("error", () => {
        item.active = false;
        item.visible = false;
      });

      cinema.zones.push(item);
    });

    scene.add(world);
    createLiveWall();
  }

  function createLiveWall() {
    if (liveWall.mesh) return;
    const cfg = config.liveWall || {};
    if (!cfg.url) return;

    const fallbackUrl = cfg.fallback || assetUrl("wall1.png");
    const fallbackMaterial = new THREE.MeshBasicMaterial({
      color: 0x46505b,
      side: THREE.DoubleSide,
      fog: false,
      toneMapped: false
    });

    if (fallbackUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const tex = new THREE.Texture(img);
        applyTex(tex);
        fallbackMaterial.map = tex;
        fallbackMaterial.color.set(0xffffff);
        fallbackMaterial.needsUpdate = true;
      };
      img.src = fallbackUrl;
    }

    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "auto";
    video.volume = 0;
    video.src = cfg.url;

    const texture = new THREE.VideoTexture(video);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    if ("encoding" in texture && THREE.sRGBEncoding !== undefined) {
      texture.encoding = THREE.sRGBEncoding;
    }

    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(Number(cfg.width) || 28, Number(cfg.height) || 8),
      fallbackMaterial
    );
    mesh.position.set(
      Number(cfg.x) || 6.01,
      Number(cfg.y) || 0,
      Number(cfg.z) || -10
    );
    mesh.rotation.y = Number(cfg.rotationY) || 0;
    mesh.name = "live-wall-video";
    scene.add(mesh);

    liveWall.el = video;
    liveWall.texture = texture;
    liveWall.mesh = mesh;
    liveWall.material = fallbackMaterial;
    liveWall.url = cfg.url;
    liveWall.fallbackUrl = fallbackUrl || "";
    liveWall.radius = Number(cfg.radius) || 24;

    const revealFirstFrame = () => {
      if (liveWall.ready || liveWall.error) return;
      liveWall.ready = true;
      fallbackMaterial.map = texture;
      fallbackMaterial.color.set(0xffffff);
      fallbackMaterial.needsUpdate = true;
      liveWall.active = !video.paused;
      if (!running) {
        video.pause();
        liveWall.primed = true;
      }
    };

    video.addEventListener("loadeddata", revealFirstFrame);
    video.addEventListener("canplay", revealFirstFrame);
    video.addEventListener("error", () => {
      liveWall.error = true;
      liveWall.active = false;
    });

    // Prime decoding early; until the first decoded frame the fallback image remains visible.
    video.load();
    const p = video.play();
    if (p && p.catch) p.catch(() => {});
  }

  function liveWallOnScreen() {
    if (!liveWall.mesh || !camera) return false;

    const wallPos = liveWall.mesh.getWorldPosition(new THREE.Vector3());
    const toCamera = camera.position.clone().sub(wallPos).normalize();
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(liveWall.mesh.quaternion);
    const facingWall = normal.dot(toCamera);

    const viewDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const toWall = wallPos.clone().sub(camera.position).normalize();
    const lookAtWall = viewDir.dot(toWall);

    return facingWall > 0.12 && lookAtWall > 0.12 && zoneIsOnScreen({ mesh: liveWall.mesh });
  }

  function updateLiveWall() {
    if (!liveWall.el || !liveWall.mesh) return;

    liveWall.distance = liveWall.mesh.getWorldPosition(new THREE.Vector3()).distanceTo(ship.position);
    const visible = running &&
      !transitionBusy &&
      !settings.open &&
      liveWall.distance <= liveWall.radius &&
      liveWallOnScreen();

    if (visible) {
      if (liveWall.ready && liveWall.el.paused) {
        const p = liveWall.el.play();
        if (p && p.catch) p.catch(() => {});
      }
      liveWall.active = true;
    } else {
      if (!liveWall.el.paused) liveWall.el.pause();
      liveWall.active = false;
    }

    if (interaction && liveWall.ready && visible) {
      interaction.textContent = "LIVE WALL · " + Math.round(Math.max(0, 100 - (liveWall.distance / liveWall.radius) * 100)) + "%";
    }
  }

  function applyDoorUnit(unit, p) {
    if (!unit.left || !unit.right) return;
    const t = Math.max(0, Math.min(1, p));
    const baseZ = unit === returnDoor ? 0.35 : -0.35;
    unit.left.position.set(-1.52, 0, baseZ);
    unit.right.position.set(1.52, 0, baseZ);
    unit.left.scale.set(1, 1, 1);
    unit.right.scale.set(1, 1, 1);

    if (unit.style === "iris") {
      const sc = Math.max(0.02, 1 - t);
      unit.left.scale.set(sc, sc, 1);
      unit.right.scale.set(sc, sc, 1);
    } else if (unit.style === "wipe") {
      unit.left.position.y = 3.2 * t;
      unit.right.position.y = -3.2 * t;
    } else {
      unit.left.position.x = -1.52 - 3.1 * t;
      unit.right.position.x = 1.52 + 3.1 * t;
    }
  }

  function openDoor(reason) {
    if (door.state !== "CLOSED") return;
    door.style = ["slide", "wipe", "iris"][Math.floor(Math.random() * 3)];
    door.state = "OPENING";
    door.away = 0;
    setStatus((reason === "REMOTE" ? "DOOR REMOTE · " : "DOOR OPEN · ") + door.style);
  }

  function updateDoorUnit(unit, dt, label) {
    if (!unit.mesh) return;
    const dist = unit.mesh.position.distanceTo(ship.position);
    const to = unit.mesh.position.clone().sub(ship.position);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(ship.quaternion);
    const facing = to.length() ? fwd.dot(to.normalize()) : -1;

    let shouldOpen = false;
    if (unit === returnDoor) {
      // Return gate opens only when approached from Room 2 / back side.
      shouldOpen = ship.position.z < unit.mesh.position.z + 0.5 && dist < 8;
    } else {
      // First gate keeps the original facing requirement.
      shouldOpen = dist < 8 && facing > 0.7;
    }

    if (unit.state === "CLOSED" && shouldOpen) {
      unit.style = ["slide", "wipe", "iris"][Math.floor(Math.random() * 3)];
      unit.state = "OPENING";
      unit.progress = 0;
      unit.away = 0;
      setStatus(label + " · " + unit.style);
    }

    if (unit.state === "OPENING") {
      unit.progress = Math.min(1, unit.progress + dt * unit.speed);
      applyDoorUnit(unit, unit.progress);
      if (unit.progress >= 1) unit.state = "OPEN";
    }

    if (unit.state === "OPEN") {
      if (dist > 5) {
        unit.away += dt;
        if (unit.away >= 4) unit.state = "CLOSING";
      } else {
        unit.away = 0;
      }
    }

    if (unit.state === "CLOSING") {
      unit.progress = Math.max(0, unit.progress - dt * unit.speed);
      applyDoorUnit(unit, unit.progress);
      if (unit.progress <= 0) {
        unit.state = "CLOSED";
        unit.away = 0;
      }
    }
  }

  function updateDoor(dt) {
    updateDoorUnit(door, dt, "DOOR OPEN");
    updateDoorUnit(returnDoor, dt, "RETURN GATE");
  }

  function portalCoverage() {
    if (!portal.mesh || !camera || !renderer) return 0;
    const box = new THREE.Box3().setFromObject(portal.mesh);
    const c = box.getCenter(new THREE.Vector3());
    c.project(camera);
    if (c.z > 1) return 0;
    const size = box.getSize(new THREE.Vector3());
    const dist = camera.position.distanceTo(portal.mesh.getWorldPosition(new THREE.Vector3()));
    if (dist < 0.2) return 1;
    const approx = (6 / dist) * (6 / dist);
    return Math.max(0, Math.min(1, approx));
  }

  function portalSide() {
    if (!portal.mesh) return "UNKNOWN";
    const z = ship.position.z;
    const frontDistance = Math.abs(z - portal.triggerFrontZ);
    const backDistance = Math.abs(z - portal.triggerBackZ);
    if (z > portal.z + 0.45) return "FRONT";
    if (z < portal.z - 0.45) return "BACK";
    return backDistance < frontDistance ? "BACK" : "FRONT";
  }

  function portalTriggerDistance(side) {
    const targetZ = side === "BACK" ? portal.triggerBackZ : portal.triggerFrontZ;
    return Math.sqrt(
      ship.position.x * ship.position.x +
      ship.position.y * ship.position.y +
      (ship.position.z - targetZ) * (ship.position.z - targetZ)
    );
  }

  function returnToStart() {
    if (!running || transitionBusy || !ship.position) return;
    pauseAllCinemaVideos();
    ship.position.set(0, 0, 2);
    ship.velocity.set(0, 0, 0);
    ship.angularVelocity.set(0, 0, 0);
    ship.quaternion.set(0, 0, 0, 1);
    door.state = "CLOSED"; door.progress = 0; door.away = 0; applyDoorUnit(door, 0);
    returnDoor.state = "CLOSED"; returnDoor.progress = 0; returnDoor.away = 0; applyDoorUnit(returnDoor, 0);
    updateCinemaZones();
    if (ship.visual) {
      ship.visual.position.copy(ship.position);
      ship.visual.quaternion.copy(ship.quaternion);
    }
    camera.position.copy(ship.position);
    camera.quaternion.copy(ship.quaternion);
    setStatus("ROOM 1 · HOME");
  }

  function finishTeleport() {
    const direction = portal.direction;
    transitionBusy = false;
    transitionLoading = false;
    if (transitionRoot) {
      transitionRoot.classList.remove("ready");
      transitionRoot.hidden = true;
    }
    if (transitionVideo) {
      transitionVideo.style.opacity = "0";
      transitionVideo.pause();
      transitionVideo.removeAttribute("src");
      transitionVideo.load();
    }

    if (direction === "BACK") {
      ship.position.set(0, 0, 2);
      ship.velocity.set(0, 0, 0);
      ship.angularVelocity.set(0, 0, 0);
      ship.quaternion.set(0, 0, 0, 1);
      updateCinemaZones();
      setStatus("ROOM 1 · RETURN COMPLETE");
    } else {
      ship.position.set(0, 0, -52);
      ship.velocity.set(0, 0, 0);
      ship.angularVelocity.set(0, 0, 0);
      ship.quaternion.set(0, 0, 0, 1);
      updateCinemaZones();
      setStatus("ROOM 2 · TELEPORT COMPLETE");
    }
  }

  function playPortalVideo(direction) {
    if (transitionBusy || transitionLoading) return;

    portal.direction = direction === "BACK" ? "BACK" : "FORWARD";
    const url = portal.direction === "BACK"
      ? (assetUrl("portal1.mp4") || assetUrl("portal3.mp4") || assetUrl("portal2.mp4"))
      : (assetUrl("portal2.mp4") || assetUrl("portal3.mp4") || assetUrl("portal1.mp4"));

    if (!url || !transitionVideo || !transitionRoot) {
      setStatus("PORTAL VIDEO MISSING");
      finishTeleport();
      return;
    }

    // Start loading while the player keeps flying. Controls are locked only
    // after the first decoded frame is ready to be shown.
    transitionLoading = true;
    if (transitionRoot) {
      transitionRoot.classList.remove("ready");
      transitionRoot.hidden = true;
    }
    transitionVideo.style.opacity = "0";
    transitionVideo.muted = true;
    transitionVideo.playsInline = true;
    transitionVideo.preload = "auto";

    const revealFirstFrame = () => {
      if (!transitionLoading) return;

      // Hold the decoded opening frame over the live scene first.
      transitionLoading = false;
      transitionBusy = true;
      pauseAllCinemaVideos();

      if (transitionRoot) {
        transitionRoot.hidden = false;
        transitionRoot.classList.add("ready");
      }
      transitionVideo.style.opacity = "1";

      const p = transitionVideo.play();
      if (p && p.catch) {
        p.catch(finishTeleport);
      }
    };

    transitionVideo.onloadedmetadata = () => {
      try {
        transitionVideo.currentTime = 0;
      } catch (e) {}
    };
    transitionVideo.onloadeddata = revealFirstFrame;
    transitionVideo.onplaying = () => {
      if (transitionRoot && transitionBusy) {
        transitionRoot.hidden = false;
        transitionRoot.classList.add("ready");
      }
    };
    transitionVideo.onended = finishTeleport;
    transitionVideo.onerror = () => {
      transitionLoading = false;
      if (transitionRoot) {
        transitionRoot.classList.remove("ready");
        transitionRoot.hidden = true;
      }
      setStatus("PORTAL MP4 ERROR · SKIP");
      finishTeleport();
    };

    if (transitionLabel) {
      transitionLabel.textContent = portal.direction === "BACK"
        ? "CUTSCENE · ROOM 2 → ROOM 1"
        : "CUTSCENE · ROOM 1 → ROOM 2";
    }

    transitionVideo.src = url;
    transitionVideo.load();

    // Kick decoding immediately. Failure here does not stop the live scene;
    // the loadeddata handler takes over when the first frame arrives.
    const p = transitionVideo.play();
    if (p && p.catch) {
      p.catch(() => {});
    }
  }

  function tryPortal() {
    if (!running || transitionBusy || transitionLoading) return;

    const side = portalSide();
    const triggerDistance = portalTriggerDistance(side);
    const isBack = side === "BACK";

    if (isBack) {
      if (triggerDistance > 7.5) {
        setStatus("PORTAL RETURN · APPROACH");
        return;
      }
      playPortalVideo("BACK");
      return;
    }

    const dist = portal.mesh
      ? portal.mesh.getWorldPosition(new THREE.Vector3()).distanceTo(ship.position)
      : 99;

    if (dist > 10 && portal.coverage < 0.69) {
      setStatus("PORTAL · APPROACH / FILL 69%");
      return;
    }
    playPortalVideo("FORWARD");
  }

  function dz(v, d) {
    if (Math.abs(v) <= d) return 0;
    const s = v < 0 ? -1 : 1;
    return s * Math.min(1, (Math.abs(v) - d) / (1 - d));
  }

  function readPad() {
    if (!navigator.getGamepads) return;
    let list;
    try { list = navigator.getGamepads(); } catch (e) { return; }
    let gp = pad.index >= 0 ? list[pad.index] : null;
    if (!gp) {
      pad.index = -1;
      for (let i = 0; i < list.length; i++) if (list[i]) { pad.index = i; gp = list[i]; break; }
    }
    if (!gp) {
      pad.lx = pad.ly = pad.rx = pad.ry = pad.roll = pad.vert = 0;
      return;
    }
    const ax = gp.axes || [];
    pad.lx = dz(ax[0] || 0, 0.16);
    pad.ly = dz(ax[1] || 0, 0.16);
    pad.rx = dz(ax[2] || 0, 0.14);
    pad.ry = dz(ax[3] || 0, 0.14);
    const btn = (n) => !!(gp.buttons && gp.buttons[n] && (gp.buttons[n].pressed || gp.buttons[n].value > 0.5));
    pad.roll = (btn(5) ? 1 : 0) - (btn(4) ? 1 : 0);
    pad.vert = (btn(7) ? 1 : 0) - (btn(6) ? 1 : 0);
    const edge = (n, fn) => {
      const on = btn(n);
      if (on && !pad.prev[n] && running) fn();
      pad.prev[n] = on;
    };
    edge(0, () => openDoor("REMOTE"));
    edge(3, tryPortal);
    edge(9, toggleSettings);
    edge(8, toggleSettings);
  }

  function tiltLook() {
    if (!tilt.enabled || !tilt.available) return { pitch: 0, yaw: 0 };
    const pitchOffset = Math.max(-32, Math.min(32, tilt.b - tilt.neutralB));
    const yawOffset = Math.max(-32, Math.min(32, tilt.g - tilt.neutralG));
    const dead = 2.5;
    const pitchRaw = Math.abs(pitchOffset) <= dead ? 0 : Math.max(-1, Math.min(1, (Math.abs(pitchOffset) - dead) / 22)) * Math.sign(pitchOffset);
    const yawRaw = Math.abs(yawOffset) <= dead ? 0 : Math.max(-1, Math.min(1, (Math.abs(yawOffset) - dead) / 22)) * Math.sign(yawOffset);
    return {
      pitch: (settings.invertPitch ? -1 : 1) * pitchRaw,
      yaw: (settings.invertYaw ? -1 : 1) * yawRaw
    };
  }

  function pauseAllCinemaVideos() {
    cinema.zones.forEach((zone) => {
      if (zone.el) {
        zone.el.pause();
        zone.el.volume = 0;
      }
      zone.active = false;
      zone.visible = false;
    });
    if (liveWall.el) {
      liveWall.el.pause();
      liveWall.active = false;
    }
    cinema.nearest = null;
  }

  function setAudioMute(value) {
    cinema.mute = !!value;
    if (musicAudio) musicAudio.muted = cinema.mute;
    cinema.zones.forEach((zone) => {
      if (zone.el) zone.el.muted = cinema.mute;
    });
  }

  function zoneIsOnScreen(zone) {
    if (!camera || !zone.mesh) return false;

    const sphere = new THREE.Sphere(
      zone.mesh.getWorldPosition(new THREE.Vector3()),
      Math.max(zone.mesh.geometry.parameters.width || 6, zone.mesh.geometry.parameters.height || 3) * 0.8
    );
    const frustum = new THREE.Frustum();
    camera.updateMatrixWorld(true);
    const projection = new THREE.Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    frustum.setFromProjectionMatrix(projection);
    return frustum.intersectsSphere(sphere);
  }

  function updateCinemaZones() {
    if (!cinema.zones.length) {
      if (musicAudio && !cinema.mute) musicAudio.volume = settings.volume;
      cinema.nearest = null;
      cinema.focus = null;
      return;
    }

    const candidates = [];

    cinema.zones.forEach((zone) => {
      zone.distance = zone.mesh.position.distanceTo(ship.position);
      const portalDistance = zone.mesh.position.distanceTo(
        portal.mesh ? portal.mesh.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(0, 0, portal.z)
      );
      const portalSafe = portalDistance >= cinema.portalSafeRadius;

      zone.visible = portalSafe &&
        zone.distance <= zone.radius &&
        zoneIsOnScreen(zone) &&
        running &&
        !transitionBusy &&
        !settings.open;

      if (zone.visible) candidates.push(zone);
    });

    candidates.sort((a, b) => a.distance - b.distance);
    const nearest = candidates.length ? candidates[0] : null;
    cinema.nearest = nearest;

    // Only the nearest visible zone is allowed to decode/play.
    cinema.zones.forEach((zone) => {
      if (!zone.el) return;

      if (zone === nearest) {
        if (!zone.loaded && zone.url) {
          zone.el.src = zone.url;
          zone.el.load();
          zone.loaded = true;
        }

        if (!zone.active) {
          zone.active = true;
          zone.el.loop = true;
          zone.el.muted = cinema.mute;
          const p = zone.el.play();
          if (p && p.catch) {
            p.catch(() => {
              zone.el.muted = true;
            });
          }
        }
      } else {
        if (zone.active) zone.el.pause();
        zone.el.volume = 0;
        zone.active = false;

        // Release the decoder/source when the screen is far outside its useful radius.
        if (zone.loaded && zone.distance > zone.radius * 1.8) {
          zone.el.pause();
          zone.el.removeAttribute("src");
          zone.el.load();
          zone.loaded = false;
        }
      }
    });

    if (!nearest) {
      if (musicAudio && !cinema.mute) musicAudio.volume = settings.volume;
      if (cinema.focus) cinema.focus = null;
      return;
    }

    const radius = nearest.radius;
    const near = 2.5;
    const d = Math.max(near, Math.min(radius, nearest.distance));
    const t = (d - near) / (radius - near);

    // Film rises toward the screen; OST falls much faster.
    const filmGain = Math.pow(1 - t, 0.5);
    const ostGain = Math.pow(t, 2.6);

    if (!cinema.mute) nearest.el.volume = Math.max(0, Math.min(1, settings.volume * filmGain));
    if (musicAudio && !cinema.mute) musicAudio.volume = settings.volume * ostGain;

    if (cinema.focus && cinema.focus !== nearest) cinema.focus = nearest;
    if (interaction) {
      interaction.textContent = nearest.distance <= near
        ? "CINEMA · 100% · OST 0%"
        : "CINEMA · " + Math.round(filmGain * 100) + "% · OST " + Math.round(ostGain * 100) + "%";
    }
  }

  function toggleCinemaFocus() {
    const target = cinema.focus || cinema.nearest;
    if (!target) {
      setStatus("CINEMA · APPROACH A SCREEN");
      return;
    }

    if (cinema.focus) {
      cinema.focus = null;
      setStatus("CINEMA FOCUS OFF");
      return;
    }

    cinema.focus = target;
    setStatus("CINEMA FOCUS ON · F TO RELEASE");
  }

  function updateCinemaFocus() {
    if (!cinema.focus || !cinema.focus.mesh || !cinema.focus.active) return;
    if (cinema.focus.distance > cinema.focus.radius) {
      cinema.focus = null;
      return;
    }

    const target = cinema.focus.mesh.getWorldPosition(new THREE.Vector3());
    const matrix = new THREE.Matrix4().lookAt(
      ship.position,
      target,
      new THREE.Vector3(0, 1, 0)
    );
    ship.quaternion.setFromRotationMatrix(matrix);
    ship.angularVelocity.multiplyScalar(0.15);
    camera.quaternion.copy(ship.quaternion);
  }

  function input() {
    readPad();
    const look = tiltLook();
    const edgeYaw = (touch.edgeRight ? 1 : 0) - (touch.edgeLeft ? 1 : 0);
    const edgePitch = (touch.edgeDown ? 1 : 0) - (touch.edgeUp ? 1 : 0);
    return {
      thrust: (keys.KeyW || touch.thrust ? 1 : 0) - (keys.KeyS || touch.brake ? 1 : 0) - pad.ly,
      strafe: (keys.KeyD || touch.right ? 1 : 0) - (keys.KeyA || touch.left ? 1 : 0) + pad.lx,
      vertical: (keys.Space || touch.up ? 1 : 0) - (keys.ControlLeft || touch.down ? 1 : 0) + pad.vert,
      roll: (keys.KeyE || touch.rollRight ? 1 : 0) - (keys.KeyQ || touch.rollLeft ? 1 : 0) + pad.roll,
      yaw: (touch.yawRight ? 1 : 0) - (touch.yawLeft ? 1 : 0) + edgeYaw * 0.8 + look.yaw + pad.rx * (settings.invertYaw ? 1 : -1),
      pitch: edgePitch * 0.8 + look.pitch
    };
  }

  function collide() {
    if (ship.position.z > -24.5) {
      // Room 1 / front corridor.
      ship.position.x = Math.max(-5.3, Math.min(5.3, ship.position.x));
      ship.position.y = Math.max(-3.2, Math.min(3.2, ship.position.y));
      return;
    }

    if (ship.position.z >= DEEP_SPACE_Z) {
      // Portal chamber + Room 2 remain corridor-like.
      ship.position.x = Math.max(-5.3, Math.min(5.3, ship.position.x));
      ship.position.y = Math.max(-3.2, Math.min(3.2, ship.position.y));
      return;
    }

    // Past Room 2 there is real free flight in a large 3D volume.
    ship.position.x = Math.max(-58, Math.min(58, ship.position.x));
    ship.position.y = Math.max(-34, Math.min(34, ship.position.y));
    ship.position.z = Math.max(DEEP_SPACE_MIN_Z, Math.min(DEEP_SPACE_Z - 0.1, ship.position.z));
  }

  function updatePhysics(dt) {
    if (transitionBusy) return;
    updateDoor(dt);
    const inn = input();
    const localAcc = new THREE.Vector3(
      inn.strafe * ship.strafeThrust,
      0,
      -inn.thrust * ship.thrust
    ).applyQuaternion(ship.quaternion);
    localAcc.y += inn.vertical * ship.verticalThrust;
    ship.velocity.addScaledVector(localAcc, dt);
    ship.velocity.multiplyScalar(Math.max(0, 1 - ship.linearDrag * dt));
    if (ship.velocity.length() > ship.maxSpeed) ship.velocity.setLength(ship.maxSpeed);
    ship.position.addScaledVector(ship.velocity, dt);
    collide();

    const psign = settings.invertPitch ? 1 : -1;
    ship.angularVelocity.x += pad.ry * psign * 2.1 * dt + inn.pitch * 2.4 * dt;
    ship.angularVelocity.y += inn.yaw * 2.2 * dt;
    ship.angularVelocity.z += inn.roll * 2.6 * dt;
    ship.angularVelocity.multiplyScalar(Math.max(0, 1 - ship.angularDrag * dt));
    if (ship.angularVelocity.lengthSq() > 1e-8) {
      const ang = ship.angularVelocity.length() * dt;
      const q = new THREE.Quaternion().setFromAxisAngle(ship.angularVelocity.clone().normalize(), ang);
      ship.quaternion.multiply(q).normalize();
    }
    camera.position.copy(ship.position);
    camera.quaternion.copy(ship.quaternion);
    light.position.copy(ship.position);
    updateCinemaZones();
    updateLiveWall();
    updateCinemaFocus();
    if (ship.visual) {
      ship.visual.position.copy(ship.position);
      ship.visual.quaternion.copy(ship.quaternion);
    }

    portal.coverage = portalCoverage();
    if (interaction) {
      interaction.textContent = portal.coverage >= 0.69
        ? "PORTAL LOCK 69% · CUTSCENE"
        : "PORTAL " + Math.round(portal.coverage * 100) + "%";
    }
    if (portalSide() === "FRONT" && portal.coverage >= 0.69) tryPortal();
    if (portalSide() === "BACK" && portalTriggerDistance("BACK") <= 7.5) tryPortal();

    const room = ship.position.z < DEEP_SPACE_Z
      ? "DEEP SPACE"
      : (ship.position.z < -48 ? "ROOM 2" : (ship.position.z < -28 ? "SPACE" : "ROOM 1"));
    setStatus(room + " · SPD " + ship.velocity.length().toFixed(1) + " · DOOR " + door.state);
  }

  function render(now) {
    updateBacksideCamouflage(now);
    const dt = Math.min((now - last) / 1000, 0.033);
    last = now;
    if (running && !settings.open) {
      try { updatePhysics(dt); } catch (err) {
        setStatus("LOOP ERR " + (err && err.message ? err.message : "pad"));
      }
    }
    if (renderer && scene && camera) renderer.render(scene, camera);
    requestAnimationFrame(render);
  }

  function toggleSettings() {
    settings.open = !settings.open;
    if (settingsRoot) settingsRoot.hidden = !settings.open;
    root.classList.toggle("menu-open", settings.open);
    if (settings.open) {
      if (document.exitPointerLock) document.exitPointerLock();
      if (liveWall.el) {
        liveWall.el.pause();
        liveWall.active = false;
      }
    } else {
      updateLiveWall();
    }
  }

  function startMusic() {
    if (!musicAllowed || !musicAudio || !config.musicUrl) return;
    if (!musicAudio.src) musicAudio.src = config.musicUrl;
    musicAudio.loop = true;
    musicAudio.volume = settings.volume;
    musicAudio.play().catch(() => {});
    if (musicButton) musicButton.hidden = false;
  }

  function enableTilt() {
    const apply = () => {
      tilt.na = tilt.a; tilt.nb = tilt.b; tilt.ng = tilt.g;
      tilt.neutralB = tilt.b;
      tilt.neutralG = tilt.g;
      tilt.enabled = true;
      if (tiltButton) tiltButton.classList.add("active");
      setStatus("TILT CALIBRATED · THIS POSE IS NEUTRAL");
    };
    const on = (ev) => {
      if (typeof ev.beta !== "number") return;
      tilt.available = true;
      tilt.a = ev.alpha || 0;
      tilt.b = ev.beta;
      tilt.g = ev.gamma || 0;
    };
    const boot = () => {
      window.addEventListener("deviceorientation", on, true);
      setTimeout(() => { if (tilt.available) apply(); else setStatus("TILT · NO SENSOR"); }, 250);
    };
    if (window.DeviceOrientationEvent && DeviceOrientationEvent.requestPermission) {
      DeviceOrientationEvent.requestPermission().then((p) => {
        if (p === "granted") boot();
        else setStatus("TILT DENIED");
      }).catch(() => setStatus("TILT ERROR"));
    } else boot();
  }

  function resize() {
    if (!renderer || !camera) return;
    const w = root.clientWidth || 800;
    const h = root.clientHeight || 600;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function bind() {
    window.addEventListener("keydown", (e) => {
      if (e.code === "Escape") {
        if (document.exitPointerLock) document.exitPointerLock();
        return;
      }
      if (e.code === "Enter") {
        e.preventDefault();
        toggleSettings();
        return;
      }
      if (settings.open) return;
      keys[e.code] = true;
      if (e.code === "KeyG") { e.preventDefault(); tryPortal(); }
      if (e.code === "KeyF") { e.preventDefault(); toggleCinemaFocus(); }
      if (e.code === "KeyH") { e.preventDefault(); returnToStart(); }
      if (e.code === "KeyR") { e.preventDefault(); openDoor("REMOTE"); }
    });
    window.addEventListener("keyup", (e) => { keys[e.code] = false; });
    window.addEventListener("resize", resize);
    window.addEventListener("gamepadconnected", (e) => { if (pad.index < 0) pad.index = e.gamepad.index; });
    canvas.addEventListener("click", () => {
      if (running && canvas.requestPointerLock && !("ontouchstart" in window)) canvas.requestPointerLock();
    });
    document.addEventListener("pointerlockchange", () => {
      pointerLocked = document.pointerLockElement === canvas;
    });
    document.addEventListener("mousemove", (e) => {
      if (!pointerLocked || settings.open) return;
      ship.angularVelocity.y -= e.movementX * 0.0032;
      ship.angularVelocity.x -= e.movementY * 0.0036;
    });
    root.querySelectorAll(".bcm-mini-sim-mobile button").forEach((btn) => {
      const id = btn.dataset.control;
      const down = (ev) => {
        ev.preventDefault();
        if (id === "tilt") { enableTilt(); return; }
        if (id === "portal") { tryPortal(); return; }
        if (id === "home") { returnToStart(); return; }
        if (running) touch[id] = true;
      };
      const up = (ev) => { ev.preventDefault(); touch[id] = false; };
      btn.addEventListener("pointerdown", down);
      btn.addEventListener("pointerup", up);
      btn.addEventListener("pointercancel", up);
    });

    root.querySelectorAll(".bcm-mini-sim-mobile-edge").forEach((edge) => {
      const id = edge.dataset.edge;
      const key = "edge" + id.charAt(0).toUpperCase() + id.slice(1);
      const down = (ev) => { ev.preventDefault(); if (running) touch[key] = true; };
      const up = (ev) => { ev.preventDefault(); touch[key] = false; };
      edge.addEventListener("pointerdown", down, { passive:false });
      edge.addEventListener("pointerup", up, { passive:false });
      edge.addEventListener("pointercancel", up, { passive:false });
      edge.addEventListener("pointerleave", up, { passive:false });
    });

    let dragPointerId = null;
    let dragX = 0, dragY = 0;
    canvas.addEventListener("pointerdown", (ev) => {
      if (!running || ev.pointerType === "mouse") return;
      dragPointerId = ev.pointerId;
      dragX = ev.clientX; dragY = ev.clientY;
      canvas.setPointerCapture?.(ev.pointerId);
    });
    canvas.addEventListener("pointermove", (ev) => {
      if (!running || dragPointerId !== ev.pointerId || ev.pointerType === "mouse" || settings.open) return;
      const dx = ev.clientX - dragX, dy = ev.clientY - dragY;
      dragX = ev.clientX; dragY = ev.clientY;
      ship.angularVelocity.y -= dx * 0.012;
      ship.angularVelocity.x -= dy * 0.010;
    });
    const endDrag = (ev) => { if (dragPointerId === ev.pointerId) dragPointerId = null; };
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);

    const crystal = root.querySelector(".bcm-mini-sim-crystal-main");
    if (crystal) crystal.addEventListener("click", () => openDoor("REMOTE"));
    if (musicButton) musicButton.addEventListener("click", () => {
      setAudioMute(!cinema.mute);
    });
    if (transitionRoot) {
      const close = transitionRoot.querySelector(".bcm-mini-sim-transition-close");
      if (close) close.addEventListener("click", finishTeleport);
    }
    if (settingsRoot) {
      const vol = settingsRoot.querySelector('[data-setting="volume"]');
      const ip = settingsRoot.querySelector('[data-setting="invertPitch"]');
      const iy = settingsRoot.querySelector('[data-setting="invertYaw"]');
      const cl = settingsRoot.querySelector('[data-setting="close"]');
      if (vol) vol.addEventListener("input", () => {
        settings.volume = Number(vol.value) / 100;
        if (musicAudio) musicAudio.volume = settings.volume;
      });
      if (ip) ip.addEventListener("change", () => { settings.invertPitch = ip.checked; });
      if (iy) iy.addEventListener("change", () => { settings.invertYaw = iy.checked; });
      if (cl) cl.addEventListener("click", toggleSettings);
    }
    startButton.addEventListener("click", () => {
      if (!renderer) return;
      running = true;
      musicAllowed = true;
      startMusic();
      if (liveWall.el && liveWall.ready) {
        const wallPlay = liveWall.el.play();
        if (wallPlay && wallPlay.catch) wallPlay.catch(() => {});
      }
      updateLiveWall();
      root.classList.add("game-active");
      startButton.classList.add("hidden");
      canvas.focus();
      if (canvas.requestPointerLock && !("ontouchstart" in window)) canvas.requestPointerLock();
      setStatus("FLIGHT ACTIVE");
    });
    if (menuBackdrop && config.menuBackgroundUrl) {
      menuBackdrop.style.backgroundImage = 'url("' + config.menuBackgroundUrl.replace(/"/g, "") + '")';
    }
  }

  function startSim() {
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x020308);
      camera = new THREE.PerspectiveCamera(70, 1, 0.08, 400);
      light = new THREE.PointLight(0xffffff, 1.1, 80);
      scene.add(light);
      scene.add(new THREE.AmbientLight(0x8899aa, 0.35));
      ship.position = new THREE.Vector3(0, 0, 2);
      ship.velocity = new THREE.Vector3();
      ship.angularVelocity = new THREE.Vector3();
      ship.quaternion = new THREE.Quaternion();
      buildShipVisual();
      const stars = new THREE.BufferGeometry();
      const pts = [];
      for (let i = 0; i < 700; i++) pts.push((Math.random() - 0.5) * 500, (Math.random() - 0.5) * 320, (Math.random() - 0.5) * 520);
      stars.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: 0xffffff, size: 0.6 })));
      buildWorld();
      bind();
      resize();
      setStatus("ENGINE READY · LOCAL r128 · 0.6.4");
      hudAssets();
      requestAnimationFrame(render);
    } catch (err) {
      setStatus("ERROR: " + (err && err.message ? err.message : "start"));
    }
  }

  if (window.THREE) startSim();
  else {
    setStatus("ENGINE LOADING LOCAL r128...");
    const s = document.createElement("script");
    s.src = config.threeUrl || "";
    s.onload = () => { if (window.THREE) startSim(); else setStatus("ERROR: THREE missing"); };
    s.onerror = () => setStatus("ERROR: three.min.js");
    document.head.appendChild(s);
  }
})();
