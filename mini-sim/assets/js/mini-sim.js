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
    el: null,
    texture: null,
    mesh: null,
    active: false,
    distance: 99,
    radius: 16,
    mute: false
  };
  const tilt = {
    enabled: false,
    available: false,
    a: 0, b: 0, g: 0,
    na: 0, nb: 0, ng: 0
  };
  const pad = { index: -1, lx: 0, ly: 0, rx: 0, ry: 0, roll: 0, vert: 0, prev: [] };

  let renderer, scene, camera, light;
  let running = false;
  let pointerLocked = false;
  let last = performance.now();
  let transitionBusy = false;
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

  function buildRoom(parent, opt) {
    const floor = textured(opt.floor, opt.floorColor);
    const ceil = textured(opt.ceiling, opt.ceilingColor);
    const left = textured(opt.left, opt.leftColor);
    const right = textured(opt.right, opt.rightColor);
    plane(parent, 0, -3.5, opt.z, opt.w, opt.len, -Math.PI / 2, 0, 0, floor);
    plane(parent, 0, 3.5, opt.z, opt.w, opt.len, Math.PI / 2, 0, 0, ceil);
    plane(parent, -opt.w / 2, 0, opt.z, opt.len, opt.h, 0, Math.PI / 2, 0, left);
    plane(parent, opt.w / 2, 0, opt.z, opt.len, opt.h, 0, -Math.PI / 2, 0, right);
    addRoofCorners(parent, opt.z, opt.w, opt.h);
  }

  function buildWorld() {
    const world = new THREE.Group();
    buildRoom(world, {
      z: -10, w: 12, len: 28, h: 8,
      floor: "wall1.png", ceiling: "roof.png",
      left: "wall3.png", right: "wall4.png",
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
    const voidBox = new THREE.Mesh(new THREE.BoxGeometry(80, 50, 28), spaceMat);
    voidBox.position.set(0, 0, -36);
    world.add(voidBox);

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

    const cinemaVideo = document.createElement("video");
    cinemaVideo.src = config.spaceVideoUrl || "";
    cinemaVideo.crossOrigin = "anonymous";
    cinemaVideo.muted = false;
    cinemaVideo.loop = true;
    cinemaVideo.playsInline = true;
    cinemaVideo.preload = "auto";
    cinemaVideo.volume = 0;
    cinemaVideo.addEventListener("error", () => {
      cinema.active = false;
      cinema.distance = 99;
      setStatus("CINEMA VIDEO ERROR");
    });
    cinema.el = cinemaVideo;

    if (cinemaVideo.src) {
      const cinemaTexture = new THREE.VideoTexture(cinemaVideo);
      cinemaTexture.minFilter = THREE.LinearFilter;
      cinemaTexture.magFilter = THREE.LinearFilter;
      cinemaTexture.generateMipmaps = false;
      if ("encoding" in cinemaTexture && THREE.sRGBEncoding !== undefined) {
        cinemaTexture.encoding = THREE.sRGBEncoding;
      }
      cinema.texture = cinemaTexture;

      const cinemaMat = new THREE.MeshBasicMaterial({
        map: cinemaTexture,
        side: THREE.FrontSide,
        fog: false
      });
      const cinemaMesh = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 3.3), cinemaMat);
      cinemaMesh.position.set(5.35, 0.1, -37.5);
      cinemaMesh.rotation.y = -Math.PI / 2;
      cinemaMesh.name = "space-cinema-loop";
      scene.add(cinemaMesh);
      cinema.mesh = cinemaMesh;
    }

    scene.add(world);
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

  function finishTeleport() {
    const direction = portal.direction;
    transitionBusy = false;
    if (transitionRoot) transitionRoot.hidden = true;
    if (transitionVideo) {
      transitionVideo.pause();
      transitionVideo.removeAttribute("src");
      transitionVideo.load();
    }

    if (direction === "BACK") {
      ship.position.set(0, 0, 2);
      ship.velocity.set(0, 0, 0);
      ship.angularVelocity.set(0, 0, 0);
      ship.quaternion.set(0, 0, 0, 1);
      setStatus("ROOM 1 · RETURN COMPLETE");
    } else {
      ship.position.set(0, 0, -52);
      ship.velocity.set(0, 0, 0);
      ship.angularVelocity.set(0, 0, 0);
      ship.quaternion.set(0, 0, 0, 1);
      setStatus("ROOM 2 · TELEPORT COMPLETE");
    }
  }

  function playPortalVideo(direction) {
    if (transitionBusy) return;

    portal.direction = direction === "BACK" ? "BACK" : "FORWARD";
    const url = portal.direction === "BACK"
      ? (assetUrl("portal1.mp4") || assetUrl("portal3.mp4") || assetUrl("portal2.mp4"))
      : (assetUrl("portal2.mp4") || assetUrl("portal3.mp4") || assetUrl("portal1.mp4"));

    if (!url || !transitionVideo || !transitionRoot) {
      setStatus("PORTAL VIDEO MISSING");
      finishTeleport();
      return;
    }

    transitionBusy = true;
    transitionRoot.hidden = false;
    if (transitionLabel) {
      transitionLabel.textContent = portal.direction === "BACK"
        ? "CUTSCENE · ROOM 2 → ROOM 1"
        : "CUTSCENE · ROOM 1 → ROOM 2";
    }
    transitionVideo.muted = true;
    transitionVideo.playsInline = true;
    transitionVideo.src = url;
    transitionVideo.onended = finishTeleport;
    transitionVideo.onerror = () => {
      setStatus("PORTAL MP4 ERROR · SKIP");
      finishTeleport();
    };
    const p = transitionVideo.play();
    if (p && p.catch) {
      p.catch(() => {
        transitionVideo.muted = true;
        transitionVideo.play().catch(finishTeleport);
      });
    }
  }

  function tryPortal() {
    if (!running || transitionBusy) return;

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
    const pitch = dz((tilt.b - tilt.nb) / 14, 0.04);
    const yaw = dz((tilt.g - tilt.ng) / 14, 0.04);
    return {
      pitch: (settings.invertPitch ? -1 : 1) * pitch,
      yaw: (settings.invertYaw ? -1 : 1) * yaw
    };
  }

  function startCinema() {
    if (!cinema.el || !cinema.texture || !cinema.el.src) return;
    cinema.el.loop = true;
    cinema.el.muted = cinema.mute;
    cinema.active = true;
    const p = cinema.el.play();
    if (p && p.catch) {
      p.catch(() => {
        cinema.el.muted = true;
        cinema.mute = true;
        if (musicButton) musicButton.title = "MUTE";
      });
    }
  }

  function setAudioMute(value) {
    cinema.mute = !!value;
    if (musicAudio) musicAudio.muted = cinema.mute;
    if (cinema.el) cinema.el.muted = cinema.mute;
  }

  function updateCinemaAudio() {
    if (!cinema.mesh || !cinema.el) return;

    cinema.distance = cinema.mesh.position.distanceTo(ship.position);
    const radius = cinema.radius;
    const near = 2.5;
    const d = Math.max(near, Math.min(radius, cinema.distance));
    const t = (d - near) / (radius - near);

    // Film audio arrives earlier on approach; OST is ducked much faster.
    const filmGain = Math.pow(1 - t, 0.5);
    const ostGain = Math.pow(t, 2.6);

    cinema.el.volume = Math.max(0, Math.min(1, settings.volume * filmGain));
    if (musicAudio) musicAudio.volume = settings.volume * ostGain;

    if (cinema.distance <= radius && cinema.active) {
      if (interaction) {
        const pct = Math.round(filmGain * 100);
        interaction.textContent = cinema.distance <= near
          ? "CINEMA · 100% · OST 0%"
          : "CINEMA · " + pct + "% · OST " + Math.round(ostGain * 100) + "%";
      }
    }
  }

  function input() {
    readPad();
    const look = tiltLook();
    return {
      thrust: (keys.KeyW || touch.thrust ? 1 : 0) - (keys.KeyS || touch.brake ? 1 : 0) - pad.ly,
      strafe: (keys.KeyD || touch.right ? 1 : 0) - (keys.KeyA || touch.left ? 1 : 0) + pad.lx,
      vertical: (keys.Space || touch.up ? 1 : 0) - (keys.ControlLeft || touch.down ? 1 : 0) + pad.vert,
      roll: (keys.KeyE || touch.rollRight ? 1 : 0) - (keys.KeyQ || touch.rollLeft ? 1 : 0) + pad.roll,
      yaw: (touch.yawRight ? 1 : 0) - (touch.yawLeft ? 1 : 0) + look.yaw + pad.rx * (settings.invertYaw ? 1 : -1),
      pitch: look.pitch
    };
  }

  function collide() {
    if (ship.position.z > -24.5) {
      ship.position.x = Math.max(-5.3, Math.min(5.3, ship.position.x));
      ship.position.y = Math.max(-3.2, Math.min(3.2, ship.position.y));
    } else if (ship.position.z < -49) {
      ship.position.x = Math.max(-5.3, Math.min(5.3, ship.position.x));
      ship.position.y = Math.max(-3.2, Math.min(3.2, ship.position.y));
    }
  }

  function updatePhysics(dt) {
    if (transitionBusy) return;
    updateDoor(dt);
    const inn = input();
    const acc = new THREE.Vector3(
      inn.strafe * ship.strafeThrust,
      inn.vertical * ship.verticalThrust,
      -inn.thrust * ship.thrust
    ).applyQuaternion(ship.quaternion);
    ship.velocity.addScaledVector(acc, dt);
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
    updateCinemaAudio();

    portal.coverage = portalCoverage();
    if (interaction) {
      interaction.textContent = portal.coverage >= 0.69
        ? "PORTAL LOCK 69% · CUTSCENE"
        : "PORTAL " + Math.round(portal.coverage * 100) + "%";
    }
    if (portalSide() === "FRONT" && portal.coverage >= 0.69) tryPortal();
    if (portalSide() === "BACK" && portalTriggerDistance("BACK") <= 7.5) tryPortal();

    const room = ship.position.z < -48 ? "ROOM 2" : (ship.position.z < -28 ? "SPACE" : "ROOM 1");
    setStatus(room + " · SPD " + ship.velocity.length().toFixed(1) + " · DOOR " + door.state);
  }

  function render(now) {
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
    if (settings.open && document.exitPointerLock) document.exitPointerLock();
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
        if (running) touch[id] = true;
      };
      const up = (ev) => { ev.preventDefault(); touch[id] = false; };
      btn.addEventListener("pointerdown", down);
      btn.addEventListener("pointerup", up);
      btn.addEventListener("pointercancel", up);
    });
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
      startCinema();
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
      const stars = new THREE.BufferGeometry();
      const pts = [];
      for (let i = 0; i < 400; i++) pts.push((Math.random() - 0.5) * 300, (Math.random() - 0.5) * 300, (Math.random() - 0.5) * 300);
      stars.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: 0xffffff, size: 0.6 })));
      buildWorld();
      bind();
      resize();
      setStatus("ENGINE READY · LOCAL r128 · 0.5.6");
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
