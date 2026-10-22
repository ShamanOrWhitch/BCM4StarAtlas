/* Hull dive. A short flood-and-weld drill opened from the asteroid ring.
   Original compartment, not a copy of any submarine game. */
(function () {
  const rooms = [
    { name: "нос", x0: -6.2, x1: -2.05 },
    { name: "трюм", x0: -1.95, x1: 1.95 },
    { name: "корма", x0: 2.05, x1: 6.2 },
  ];
  const floor = -1.85;
  const ceil = 1.55;

  // Shared repair state is the contract between interior compartments and the
  // future exterior EVA loop. IDs are 1-based to match the design document.
  const repairState = window.BCMHullRepairState || (window.BCMHullRepairState = {
    compartments: rooms.map((room, index) => ({
      id: index + 1,
      name: room.name,
      integrity: 100,
      externalHole: false,
      waterLevel: [0.05, 0.12, 0.05][index],
      smokeLevel: [0.025, 0.09, 0.02][index],
      fireLevel: [0.01, 0.06, 0.01][index]
    }))
  });
  repairState.compartments = Array.isArray(repairState.compartments) ? repairState.compartments : [];
  rooms.forEach((room, index) => {
    if (!repairState.compartments[index]) {
      repairState.compartments[index] = {
        id: index + 1, name: room.name, integrity: 100, externalHole: false,
        waterLevel: 0.05, smokeLevel: 0.02, fireLevel: 0.01
      };
    }
  });
  repairState.triggerExternalImpact = (compartmentId, damage) => {
    const index = Math.floor(Number(compartmentId)) - 1;
    const component = repairState.compartments[index];
    const amount = Math.max(0, Number(damage) || 0);
    if (!component || amount <= 0) return false;
    component.integrity = Math.max(0, Number(component.integrity ?? 100) - amount);
    if (component.integrity <= 0) component.externalHole = true;
    return { ...component };
  };
  repairState.patchExternalHole = (compartmentId) => {
    const index = Math.floor(Number(compartmentId)) - 1;
    const component = repairState.compartments[index];
    if (!component || !component.externalHole) return false;
    component.externalHole = false;
    component.integrity = 10;
    return { ...component };
  };

  function open(onClose) {
    if (document.getElementById("bcm-hull-dive")) return;
    try {
      if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
    } catch (e) {}
    const THREE = window.THREE;
    const en = window.BCMDialogue?.language === "en";
    const say = (ru, english) => en ? english : ru;
    const root = document.createElement("div");
    root.id = "bcm-hull-dive";
    root.style.cssText = "position:fixed;left:auto;top:auto;right:max(10px,env(safe-area-inset-right));bottom:max(10px,env(safe-area-inset-bottom));width:min(450px,44vw);height:min(345px,40vh);min-width:min(280px,calc(100vw - 20px));min-height:min(230px,calc(100vh - 20px));z-index:1000850;background:#07131c;border:1px solid rgba(103,201,225,.62);border-radius:15px;box-shadow:0 10px 36px rgba(0,0,0,.5);color:#e7eef2;font-family:Rajdhani,sans-serif;overflow:hidden;";
    root.innerHTML =
      '<div style="position:absolute;top:12px;left:12px;right:12px;display:flex;justify-content:space-between;gap:12px;pointer-events:none;z-index:10">' +
      '<div><div style="letter-spacing:.14em;font-size:10px;color:#c4a35a">' + say("ОТСЕК · РЕМОНТ", "COMPARTMENT · REPAIR") + '</div>' +
      '<div data-hull-status style="font-size:11px;margin-top:3px">' + say("ПРОВЕРЬ ВОДУ И КОРПУС", "CHECK WATER AND HULL") + '</div></div>' +
      '<button type="button" data-hull-exit style="pointer-events:auto;height:44px;padding:0 14px;border:1px solid #355066;background:#10202c;color:#e7eef2;border-radius:8px">' + say("НАЗАД В ПОЛЁТ", "BACK TO FLIGHT") + '</button></div>' +
      '<div data-hull-view style="position:absolute;inset:0"></div>' +
      '<div data-hull-controls style="position:absolute;left:10px;right:10px;bottom:54px;display:flex;justify-content:space-between;gap:6px;flex-wrap:wrap;pointer-events:none">' +
      '<div style="display:flex;gap:5px;pointer-events:auto;flex-wrap:wrap;max-width:min(64vw,520px)">' +
      '<button type="button" data-hull-control="left" aria-label="' + say("Идти влево", "Move left") + '">◀</button>' +
      '<button type="button" data-hull-control="right" aria-label="' + say("Идти вправо", "Move right") + '">▶</button>' +
      '<button type="button" data-hull-control="up" aria-label="' + say("Плыть вверх", "Move up") + '">▲</button>' +
      '<button type="button" data-hull-control="down" aria-label="' + say("Плыть вниз", "Move down") + '">▼</button></div>' +
      '<div style="display:flex;gap:5px;pointer-events:auto;flex-wrap:wrap;max-width:min(72vw,560px);justify-content:flex-end">' +
      '<button type="button" data-hull-control="helm">' + say("V · ШТУРВАЛ", "V · HELM") + '</button>' +
      '<button type="button" data-hull-control="shoot">' + say("SPACE · ОРУДИЕ", "SPACE · GUN") + '</button>' +
      '<button type="button" data-hull-control="reload">' + say("R · БОЕЗАПАС", "R · AMMO") + '</button>' +
      '<button type="button" data-hull-control="repair">' + say("F · РЕМОНТ", "F · REPAIR") + '</button>' +
      '<button type="button" data-hull-control="pump">' + say("E · НАСОС", "E · PUMP") + '</button></div></div>' +
      '<div style="position:absolute;left:12px;right:12px;bottom:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;font-size:12px">' +
      '<span data-hull-ox style="font-variant-numeric:tabular-nums">O2 100</span>' +
      '<span data-hull-weld>' + say("шов 0%", "SEAM 0%") + '</span>' +
      '<span data-hull-hazards style="font-variant-numeric:tabular-nums">' + say("ВОДА 12% · ДЫМ 9% · ПЕРЕГРЕВ 6%", "WATER 12% · SMOKE 9% · OVERHEAT 6%") + '</span>' +
      '<span data-hull-ammo>' + say("БОЕЗАПАС 6/6", "AMMO 6/6") + '</span>' +
      '<span data-hull-flight>' + say("ТЯГА 0% · КУРС 0°", "THRUST 0% · HEADING 0°") + '</span>' +
      '<span data-hull-crew>CREW</span>' +
      '<span data-hull-hint style="opacity:.9">' + say("CREW · НАСОС · РЕМОНТ", "CREW · PUMP · REPAIR") + '</span></div>' +
      '<style>#bcm-hull-dive [data-hull-controls] button{touch-action:none;min-height:38px;min-width:38px;padding:5px 9px;border:1px solid #46667b;border-radius:8px;background:rgba(16,32,44,.94);color:#e7eef2;font-weight:700}#bcm-hull-dive [data-hull-controls] button.is-active{background:#294b60;border-color:#7bd9ee}#bcm-hull-dive canvas{display:block;width:100%;height:100%;touch-action:none}@media(max-width:620px){#bcm-hull-dive{width:min(58vw,320px)!important;height:min(48vh,280px)!important;min-width:220px!important;min-height:210px!important;right:6px!important;bottom:6px!important}#bcm-hull-dive [data-hull-controls]{left:4px;right:4px;bottom:38px;gap:3px}#bcm-hull-dive [data-hull-controls] button{font-size:10px;padding:4px 6px;min-height:32px;min-width:30px}}@media(min-width:1000px){#bcm-hull-dive [data-hull-controls]{left:50%;right:auto;transform:translateX(-50%);width:min(800px,94vw)}}</style>';
    document.body.appendChild(root);

    const view = root.querySelector("[data-hull-view]");
    const status = root.querySelector("[data-hull-status]");
    const oxEl = root.querySelector("[data-hull-ox]");
    const weldEl = root.querySelector("[data-hull-weld]");
    const crewEl = root.querySelector("[data-hull-crew]");
    const ammoEl = root.querySelector("[data-hull-ammo]");
    const hazardsEl = root.querySelector("[data-hull-hazards]");
    const crewSelection = Array.isArray(window.BCMMiniCrewSelection?.players)
      ? window.BCMMiniCrewSelection.players.slice(0, 2)
      : [];
    const crewName = (entry, index) => String(
      entry?.displayName || entry?.crewName || entry?.name ||
      (entry?.mint ? String(entry.mint).slice(0, 8) + "…" : "Crew " + (index + 1))
    ).slice(0, 28);
    const players = [
      { x: -4.75, y: floor + 0.42, sprite: null, texture: null, crew: crewSelection[0] || null, name: crewName(crewSelection[0], 0) },
      { x: 4.75, y: floor + 0.42, sprite: null, texture: null, crew: crewSelection[1] || null, name: crewName(crewSelection[1], 1) }
    ];
    if (crewEl) crewEl.textContent = "CREW: " + players.map((player) => player.name).join(" / ");
    let closed = false;
    let renderer = null;
    let scene = null;
    let frame = 0;
    let pointerInteraction = null;
    let viewResizeObserver = null;

    function finish() {
      if (closed) return;
      closed = true;
      if (document.exitPointerLock && document.pointerLockElement) document.exitPointerLock();
      cancelAnimationFrame(frame);
      if (viewResizeObserver) {
        try { viewResizeObserver.disconnect(); } catch (e) {}
        viewResizeObserver = null;
      }
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKey, true);
      window.removeEventListener("blur", clearHeldKeys);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearHeldKeys();
      players.forEach((player) => {
        if (!player.sprite) return;
        try { player.texture?.dispose?.(); } catch (e) {}
        try { player.sprite.material.dispose?.(); } catch (e) {}
        if (scene) scene.remove(player.sprite);
        player.sprite = null;
      });
      if (scene && scene.traverse) {
        scene.traverse((object) => {
          if (object.geometry && typeof object.geometry.dispose === "function") object.geometry.dispose();
          if (!object.material) return;
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => {
            try { material.map && material.map.dispose && material.map.dispose(); } catch (e) {}
            try { material.dispose && material.dispose(); } catch (e) {}
          });
        });
      }
      if (renderer) {
        renderer.dispose();
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      root.remove();
      window.BCMHullHelmState = { engaged: false, thrust: 0, yaw: 0 };
      if (typeof onClose === "function") onClose();
    }
    root.querySelector("[data-hull-exit]").addEventListener("click", finish);

    const keys = Object.create(null);
    const handledCodes = new Set([
      "KeyW", "KeyA", "KeyS", "KeyD", "KeyE", "KeyF", "KeyR", "KeyQ", "KeyC", "KeyV", "Period", "Slash",
      "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", "ShiftLeft", "ShiftRight", "Space"
    ]);
    let helmTogglePending = false;
    function clearHeldKeys() {
      Object.keys(keys).forEach((key) => { keys[key] = false; });
      helmToggleWasDown = false;
      helmTogglePending = false;
      root.querySelectorAll("[data-hull-control]").forEach((button) => button.classList.remove("is-active"));
    }
    function onVisibilityChange() {
      if (document.hidden) clearHeldKeys();
    }
    function onKey(event) {
      const down = event.type === "keydown";
      const physicalKey = ({
        KeyW: "w", KeyA: "a", KeyS: "s", KeyD: "d", KeyE: "e",
        KeyF: "f", KeyR: "r", KeyQ: "q", KeyC: "c", KeyV: "v"
      })[event.code] || String(event.key || "").toLowerCase();
      keys[physicalKey] = down;
      if (event.code === "Space") keys.space = down;
      if (event.code === "Period") keys.period = down;
      if (event.code === "Slash") keys.slash = down;
      if (event.code === "KeyV" && down && !event.repeat) helmTogglePending = true;
      if (handledCodes.has(event.code)) {
        event.preventDefault();
        // This input belongs to the Hull Dive scene; it must not also trigger
        // Mini-Sim flight/Warp handlers attached to the same window.
        event.stopImmediatePropagation();
      }
      if (event.code === "Escape" && down) {
        event.preventDefault();
        event.stopImmediatePropagation();
        finish();
      }
    }
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKey, true);
    window.addEventListener("blur", clearHeldKeys);
    document.addEventListener("visibilitychange", onVisibilityChange);

    const buttonKeys = { left: "a", right: "d", up: "w", down: "s", helm: "v", shoot: "space", reload: "r", repair: "f", pump: "e" };
    root.querySelectorAll("[data-hull-control]").forEach((button) => {
      const key = buttonKeys[button.dataset.hullControl];
      if (!key) return;
      const press = (event) => {
        event.preventDefault();
        event.stopPropagation();
        keys[key] = true;
        if (button.dataset.hullControl === "helm") helmTogglePending = true;
        button.classList.add("is-active");
        try { if (button.setPointerCapture && event.pointerId != null) button.setPointerCapture(event.pointerId); } catch (e) {}
      };
      const release = (event) => {
        event.preventDefault();
        event.stopPropagation();
        keys[key] = false;
        button.classList.remove("is-active");
      };
      button.addEventListener("pointerdown", press);
      button.addEventListener("pointerup", release);
      button.addEventListener("pointercancel", release);
      button.addEventListener("lostpointercapture", release);
      if (typeof window.PointerEvent !== "function") {
        button.addEventListener("touchstart", press, { passive: false });
        button.addEventListener("touchend", release, { passive: false });
        button.addEventListener("touchcancel", release, { passive: false });
      }
    });

    const water = repairState.compartments.map((item) => Math.max(0, Math.min(1, Number(item.waterLevel) || 0)));
    const smoke = repairState.compartments.map((item) => Math.max(0, Math.min(1, Number(item.smokeLevel) || 0)));
    const fire = repairState.compartments.map((item) => Math.max(0, Math.min(0.95, Number(item.fireLevel) || 0)));
    const integrity = repairState.compartments.map((item) => Math.max(0, Math.min(100, Number(item.integrity ?? 100))));
    const externalHole = repairState.compartments.map((item) => !!item.externalHole);
    let weld = 0;
    let oxygen = 100;
    let pressure = 1;
    let won = false;
    let last = performance.now();
    const maxAmmo = 6;
    let ammo = maxAmmo;
    let targetArmor = 3;
    let shotCooldown = 0;
    const reloadProgress = [0, 0];
    const reloadHeld = [false, false];
    const laserShots = [];
    let gunTarget = null;
    let gunTargetRing = null;
    let actionStatus = "";
    let actionStatusUntil = 0;
    // Crew 1 starts seated at the pilot station, so the main helm is active immediately.
    // V / gamepad LB leaves the helm for on-foot Crew control.
    let pilotMode = true;
    let helmToggleWasDown = false;
    let enginePower = 0;
    let flightHeading = 0;
    let flightTime = 0;

    function notifyStatus(message, duration) {
      actionStatus = String(message || "");
      actionStatusUntil = performance.now() + (duration || 2200);
    }

    function readAssignedGamepads() {
      try {
        const connected = navigator.getGamepads
          ? [...navigator.getGamepads()].filter((pad) => pad && pad.connected).sort((a, b) => a.index - b.index)
          : [];
        // One pad is Player 2 so keyboard Player 1 remains independently usable.
        // With two pads each Crew gets its own controller.
        if (connected.length === 1) return [null, connected[0]];
        return [connected[0] || null, connected[1] || null];
      } catch (e) {
        return [null, null];
      }
    }

    function readGamepad(gp) {
      if (!gp) return { x: 0, y: 0, repair: false, pump: false, shoot: false, reload: false, helm: false };
      const axis = (value) => Math.abs(value) < 0.18 ? 0 : Math.sign(value) * (Math.abs(value) - 0.18) / 0.82;
      const button = (index) => !!(gp.buttons && gp.buttons[index] && gp.buttons[index].pressed);
      const axes = gp.axes || [];
      return {
        x: Math.max(-1, Math.min(1, axis(axes[0] || 0) + (button(15) ? 1 : 0) - (button(14) ? 1 : 0))),
        y: Math.max(-1, Math.min(1, axis(axes[1] || 0) + (button(13) ? 1 : 0) - (button(12) ? 1 : 0))),
        repair: button(0),
        pump: button(1),
        shoot: button(2),
        reload: button(3),
        helm: button(4)
      };
    }

    function playerInput(index, gamepad) {
      const pad = readGamepad(gamepad);
      if (index === 0) {
        return {
          dx: Math.max(-1, Math.min(1, (keys.d ? 1 : 0) - (keys.a ? 1 : 0) + pad.x)),
          dy: Math.max(-1, Math.min(1, (keys.w ? 1 : 0) - (keys.s ? 1 : 0) - pad.y)),
          repair: !!(keys.f || pad.repair),
          pump: !!(keys.e || pad.pump),
          // Keep the existing keyboard-only weapon/reload mapping; pads are
          // assigned to independent Crew movement and repair/pump actions.
          shoot: !!keys.space,
          reload: !!keys.r,
          helm: !!(keys.v || pad.helm)
        };
      }
      return {
        dx: Math.max(-1, Math.min(1, (keys.arrowright ? 1 : 0) - (keys.arrowleft ? 1 : 0) + pad.x)),
        dy: Math.max(-1, Math.min(1, (keys.arrowup ? 1 : 0) - (keys.arrowdown ? 1 : 0) - pad.y)),
        repair: !!(keys.period || pad.repair),
        pump: !!(keys.shift || pad.pump),
        shoot: !!keys.enter,
        reload: !!keys.slash,
        helm: !!pad.helm
      };
    }

    function makeFallbackChibiTexture(THREE, suitColor, accentColor) {
      const canvas = document.createElement("canvas");
      canvas.width = 96;
      canvas.height = 128;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.fillStyle = "rgba(0,0,0,.28)";
      ctx.beginPath(); ctx.ellipse(48, 119, 24, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#344453"; ctx.fillRect(62, 53, 13, 30);
      ctx.fillStyle = accentColor; ctx.fillRect(64, 58, 9, 20);
      ctx.fillStyle = "#263744"; ctx.fillRect(27, 87, 16, 25); ctx.fillRect(51, 87, 16, 25);
      ctx.fillStyle = "#0c1720"; ctx.fillRect(23, 108, 21, 8); ctx.fillRect(49, 108, 21, 8);
      ctx.fillStyle = suitColor;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(24, 49, 49, 43, 12);
      else ctx.rect(24, 49, 49, 43);
      ctx.fill();
      ctx.strokeStyle = "#e7eef2"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(27, 58); ctx.lineTo(17, 76); ctx.moveTo(69, 58); ctx.lineTo(80, 74); ctx.stroke();
      ctx.fillStyle = accentColor;
      ctx.beginPath(); ctx.arc(17, 78, 5, 0, Math.PI * 2); ctx.arc(80, 76, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#c5d5df"; ctx.beginPath(); ctx.arc(48, 35, 27, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#142632"; ctx.beginPath(); ctx.ellipse(48, 36, 20, 17, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#8ee8ff"; ctx.beginPath(); ctx.ellipse(48, 35, 15, 12, -0.12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#eafcff"; ctx.beginPath(); ctx.arc(42, 33, 2.5, 0, Math.PI * 2); ctx.arc(54, 33, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#e8f3f8"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(48, 35, 26, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
      ctx.fillStyle = accentColor; ctx.fillRect(39, 60, 18, 12);
      ctx.fillStyle = "#0d2330"; ctx.fillRect(42, 63, 12, 6);
      const texture = new THREE.CanvasTexture(canvas);
      if (THREE.SRGBColorSpace !== undefined) texture.colorSpace = THREE.SRGBColorSpace;
      else if (THREE.sRGBEncoding !== undefined) texture.encoding = THREE.sRGBEncoding;
      texture.needsUpdate = true;
      return texture;
    }


    let hullCrewSegmentationPipelinePromise = null;

    function officialCrewCutoutUrl(url) {
      const text = String(url || "");
      const full = text.match(/^(https?:\/\/cdn\.staratlas\.com\/crew\/v1\/)(\d+)_full\.(?:jpe?g|png|webp)(?:\?.*)?$/i);
      if (full) return full[1] + full[2] + ".png";
      const bare = text.match(/^https?:\/\/cdn\.staratlas\.com\/crew\/v1\/\d+\.png(?:\?.*)?$/i);
      return bare ? text : "";
    }

    function crewCutoutCacheRequest(url) {
      if (!window.caches || !window.location || !window.location.origin) return null;
      let hash = 2166136261;
      const input = String(url || "") + "|crew-isnet-v8";
      for (let i = 0; i < input.length; i += 1) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      return new Request(window.location.origin + "/?bcm-crew-cutout=v8-" + (hash >>> 0).toString(36));
    }

    async function readCrewCutoutCache(url) {
      try {
        const request = crewCutoutCacheRequest(url);
        if (!request) return null;
        const cache = await window.caches.open("bcm-tower-crew-cutouts-v8");
        const response = await cache.match(request);
        return response && response.ok ? await response.blob() : null;
      } catch (error) {
        return null;
      }
    }

    async function writeCrewCutoutCache(url, canvas) {
      try {
        const request = crewCutoutCacheRequest(url);
        if (!request || !canvas.toBlob || typeof Response !== "function") return;
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
        if (!blob) return;
        const cache = await window.caches.open("bcm-tower-crew-cutouts-v8");
        await cache.put(request, new Response(blob, { headers: { "Content-Type": "image/png" } }));
      } catch (error) {}
    }

    function loadCrewImage(url) {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.decoding = "async";
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Crew image failed to load"));
        image.src = url;
      });
    }

    function crewPixelsHaveCutoutAlpha(pixels) {
      let samples = 0;
      let clear = 0;
      for (let i = 3; i < pixels.length; i += 16) {
        samples += 1;
        if (pixels[i] < 16) clear += 1;
      }
      return samples > 0 && clear / samples > 0.18;
    }

    function cropCrewCanvas(source) {
      const ctx = source.getContext("2d", { willReadFrequently: true });
      if (!ctx) return source;
      const frame = ctx.getImageData(0, 0, source.width, source.height);
      const pixels = frame.data;
      let minX = source.width;
      let minY = source.height;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < source.height; y += 1) {
        for (let x = 0; x < source.width; x += 1) {
          if (pixels[(y * source.width + x) * 4 + 3] < 4) continue;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
      if (maxX < minX || maxY < minY) throw new Error("Crew cut-out is empty");
      const padX = Math.max(3, Math.round(source.width * 0.025));
      const padY = Math.max(3, Math.round(source.height * 0.02));
      const left = Math.max(0, minX - padX);
      const top = Math.max(0, minY - padY);
      const right = Math.min(source.width, maxX + padX + 1);
      const bottom = Math.min(source.height, maxY + padY + 1);
      const cropped = document.createElement("canvas");
      cropped.width = Math.max(1, right - left);
      cropped.height = Math.max(1, bottom - top);
      const croppedContext = cropped.getContext("2d");
      if (!croppedContext) return source;
      croppedContext.drawImage(source, left, top, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);
      return cropped;
    }

    function getHullCrewSegmenter() {
      if (!hullCrewSegmentationPipelinePromise) {
        hullCrewSegmentationPipelinePromise = import("https://esm.sh/@huggingface/transformers@3.8.1?bundle")
          .then((module) => {
            if (module.env) {
              module.env.useBrowserCache = true;
              module.env.allowRemoteModels = true;
            }
            return module.pipeline("background-removal", "Ko033/isnet-general-use-onnx", { dtype: "q8" });
          })
          .catch((error) => {
            hullCrewSegmentationPipelinePromise = null;
            throw error;
          });
      }
      return hullCrewSegmentationPipelinePromise;
    }

    async function cutOutCrewCanvas(canvas) {
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("No Crew canvas context");
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const output = await (await getHullCrewSegmenter())(canvas);
      const results = Array.isArray(output) ? output : [output];
      const picked = results.find((item) => item && item.mask && item.mask.data && item.mask.width && item.mask.height)
        || results.find((item) => item && item.data && item.width && item.height);
      const mask = picked && picked.mask ? picked.mask : picked;
      if (!mask || !mask.data || !mask.width || !mask.height) throw new Error("ISNet returned no Crew matte");
      const channels = Math.max(1, Number(mask.channels) || 1);
      const embeddedAlpha = !picked.mask && channels === 4;
      const channel = embeddedAlpha ? 3 : 0;
      const count = mask.width * mask.height;
      if (mask.data.length < count * channels) throw new Error("ISNet returned incomplete matte");
      let minMask = Infinity;
      let maxMask = -Infinity;
      for (let i = 0; i < count; i += 1) {
        const value = Number(mask.data[i * channels + channel]) || 0;
        minMask = Math.min(minMask, value);
        maxMask = Math.max(maxMask, value);
      }
      const byteMask = mask.data instanceof Uint8Array || mask.data instanceof Uint8ClampedArray || maxMask > 1.5;
      const maskScale = byteMask ? 255 : 1;
      if (!Number.isFinite(minMask) || !Number.isFinite(maxMask) || maxMask - minMask < (byteMask ? 2 : 0.01)) {
        throw new Error("ISNet returned a flat Crew matte");
      }
      const smoothstep = (a, b, value) => {
        const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
        return t * t * (3 - 2 * t);
      };
      for (let y = 0; y < canvas.height; y += 1) {
        const my = Math.min(mask.height - 1, Math.round(y * (mask.height - 1) / Math.max(1, canvas.height - 1)));
        for (let x = 0; x < canvas.width; x += 1) {
          const mx = Math.min(mask.width - 1, Math.round(x * (mask.width - 1) / Math.max(1, canvas.width - 1)));
          const mi = (my * mask.width + mx) * channels + channel;
          const normalized = Math.max(0, Math.min(1, (Number(mask.data[mi]) || 0) / maskScale));
          const alpha = embeddedAlpha ? smoothstep(0.025, 0.26, normalized) : smoothstep(0.18, 0.52, normalized);
          const pi = (y * canvas.width + x) * 4;
          frame.data[pi + 3] = Math.round(frame.data[pi + 3] * alpha);
        }
      }
      ctx.putImageData(frame, 0, 0);
      return cropCrewCanvas(canvas);
    }

    function setCrewTextureColorSpace(THREE, texture) {
      if (THREE.SRGBColorSpace !== undefined) texture.colorSpace = THREE.SRGBColorSpace;
      else if (THREE.sRGBEncoding !== undefined) texture.encoding = THREE.sRGBEncoding;
      // Keep a single top-to-bottom convention for every Crew texture.
      texture.flipY = true;
      texture.needsUpdate = true;
      return texture;
    }

    async function makeCrewTexture(THREE, crew) {
      const sourceUrl = String(crew && crew.image || "").trim();
      if (!sourceUrl) return null;
      const officialUrl = officialCrewCutoutUrl(sourceUrl);
      const candidates = Array.from(new Set([officialUrl, sourceUrl].filter(Boolean)));

      for (const candidate of candidates) {
        const cached = await readCrewCutoutCache(candidate);
        if (!cached) continue;
        try {
          // Decode cached PNGs through the same image -> canvas route as fresh
          // cut-outs. ImageBitmap ignores WebGL's flipY upload flag in some
          // browsers, which can invert just one of two Crew sprites.
          const objectUrl = URL.createObjectURL(cached);
          try {
            const cachedImage = await loadCrewImage(objectUrl);
            const canvas = document.createElement("canvas");
            canvas.width = cachedImage.naturalWidth || cachedImage.width || 1;
            canvas.height = cachedImage.naturalHeight || cachedImage.height || 1;
            const context = canvas.getContext("2d");
            if (!context) throw new Error("No cached Crew canvas context");
            context.drawImage(cachedImage, 0, 0);
            return setCrewTextureColorSpace(THREE, new THREE.CanvasTexture(canvas));
          } finally {
            URL.revokeObjectURL(objectUrl);
          }
        } catch (error) {}
      }

      let image = null;
      let cacheUrl = candidates[0] || sourceUrl;
      for (const candidate of candidates) {
        try {
          image = await loadCrewImage(candidate);
          cacheUrl = candidate;
          break;
        } catch (error) {}
      }
      if (!image) throw new Error("Selected Crew artwork is unavailable");

      const maxSide = 512;
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth || image.width || 1, image.naturalHeight || image.height || 1));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round((image.naturalWidth || image.width || 1) * scale));
      canvas.height = Math.max(1, Math.round((image.naturalHeight || image.height || 1) * scale));
      let ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("No Crew texture context");
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const cutout = crewPixelsHaveCutoutAlpha(frame.data)
        ? cropCrewCanvas(canvas)
        : await cutOutCrewCanvas(canvas);
      await writeCrewCutoutCache(cacheUrl, cutout);
      return setCrewTextureColorSpace(THREE, new THREE.CanvasTexture(cutout));
    }

    function makeHullSideTexture(THREE, english = false) {
      const canvas = document.createElement("canvas");
      canvas.width = 1536;
      canvas.height = 384;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, "#567282");
      gradient.addColorStop(0.18, "#243f50");
      gradient.addColorStop(0.75, "#102534");
      gradient.addColorStop(1, "#07141e");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#8ca7b2"; ctx.fillRect(0, 18, canvas.width, 10);
      ctx.fillStyle = "#07131c"; ctx.fillRect(0, 34, canvas.width, 5);
      ctx.fillRect(0, 336, canvas.width, 20);
      ctx.fillStyle = "#537384"; ctx.fillRect(0, 359, canvas.width, 8);
      ctx.fillStyle = "rgba(4,12,18,.62)";
      ctx.fillRect(0, 42, canvas.width, 280);
      for (let i = 0; i < 3; i += 1) {
        const x = i * 512;
        ctx.fillStyle = i === 1 ? "#182d3a" : "#1b3443";
        ctx.fillRect(x + 10, 52, 492, 260);
        ctx.strokeStyle = "#648392"; ctx.lineWidth = 5;
        ctx.strokeRect(x + 10, 52, 492, 260);
        ctx.strokeStyle = "rgba(160,190,203,.28)"; ctx.lineWidth = 2;
        for (let j = 1; j < 5; j += 1) {
          ctx.beginPath(); ctx.moveTo(x + 20, 52 + j * 52); ctx.lineTo(x + 492, 52 + j * 52); ctx.stroke();
        }
        ctx.fillStyle = i === 0 ? "#7ae4ff" : i === 1 ? "#ffbe65" : "#83e3b0";
        ctx.fillRect(x + 34, 65, 12, 234);
        ctx.fillStyle = "#081722"; ctx.fillRect(x + 65, 73, 360, 58);
        ctx.strokeStyle = i === 0 ? "#4bb3d0" : i === 1 ? "#b47a37" : "#3e9a70";
        ctx.lineWidth = 3; ctx.strokeRect(x + 65, 73, 360, 58);
        ctx.fillStyle = "#e5f2f7";
        ctx.font = "bold 28px Arial, sans-serif";
        const stationLabel = english
          ? (i === 0 ? "PILOT / NAVIGATION" : i === 1 ? "GUN / AMMO" : "ENGINEERING / REPAIR")
          : (i === 0 ? "ПИЛОТ / НАВИГАЦИЯ" : i === 1 ? "ОРУДИЕ / БОЕЗАПАС" : "ИНЖЕНЕР / РЕМОНТ");
        ctx.fillText(stationLabel, x + 82, 109);
        ctx.fillStyle = "#507181";
        for (let j = 0; j < 7; j += 1) {
          ctx.beginPath(); ctx.arc(x + 88 + j * 48, 161, 5, 0, Math.PI * 2); ctx.fill();
        }
        for (let j = 0; j < 4; j += 1) {
          ctx.fillStyle = j % 2 ? "#183b4b" : "#245269";
          ctx.fillRect(x + 75 + j * 86, 190, 70, 62);
          ctx.strokeStyle = "#52798b"; ctx.lineWidth = 2;
          ctx.strokeRect(x + 75 + j * 86, 190, 70, 62);
          ctx.fillStyle = i === 1 ? (j % 2 ? "#f0a248" : "#8b5426") : "#3a7088";
          ctx.fillRect(x + 84 + j * 86, 201, 52, 9);
          ctx.fillStyle = "#a9c3cf";
          ctx.fillRect(x + 84 + j * 86, 218, 35, 5);
        }
      }
      ctx.fillStyle = "#eab85c";
      for (let i = 0; i < 12; i += 1) {
        ctx.fillRect(i * 18, 0, 9, 14);
        ctx.fillRect(canvas.width - 216 + i * 18, 370, 9, 14);
      }
      ctx.fillStyle = "#b8ccd5"; ctx.font = "bold 16px Arial, sans-serif";
      ctx.fillText("BCM ASTEROID RUNNER · PRESSURIZED HULL", 555, 31);
      const texture = new THREE.CanvasTexture(canvas);
      return setCrewTextureColorSpace(THREE, texture);
    }

    let waters = [];
    let smokeParticles = [];
    let waterBubbles = [];
    let fireRing = null;
    let breach = null;
    let externalHoleMeshes = [];
    if (THREE && view) {
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x07131c);
      const camera = new THREE.OrthographicCamera(-8, 8, 4.5, -4.5, 0.1, 20);
      camera.position.set(0, 0, 8);
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setClearColor(0x07131c, 1);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      const resizeCabinView = () => {
        const width = Math.max(1, view.clientWidth || 430);
        const height = Math.max(1, view.clientHeight || 330);
        const halfHeight = 4.5;
        const halfWidth = halfHeight * width / height;
        camera.left = -halfWidth;
        camera.right = halfWidth;
        camera.top = halfHeight;
        camera.bottom = -halfHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
      };
      resizeCabinView();
      if (typeof ResizeObserver === "function") {
        viewResizeObserver = new ResizeObserver(resizeCabinView);
        viewResizeObserver.observe(view);
      }
      view.appendChild(renderer.domElement);
      scene.add(new THREE.AmbientLight(0xffffff, 0.85));
      const hullTexture = makeHullSideTexture(THREE, en);
      const hullMaterial = new THREE.MeshStandardMaterial({ map: hullTexture, color: 0xffffff, metalness: 0.42, roughness: 0.5 });
      // Solid cabin. The ship is not necessarily beside the Ring, so the hold
      // must not be a window onto it.
      [
        { w: 12.8, h: 1.16, x: 0, y: 1.27 },
        { w: 12.8, h: 1.16, x: 0, y: -1.27 },
        { w: 5.25, h: 1.38, x: -3.775, y: 0 },
        { w: 2.35, h: 1.38, x: 0, y: 0 },
        { w: 5.25, h: 1.38, x: 3.775, y: 0 }
      ].forEach((piece) => {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(piece.w, piece.h, 0.4), hullMaterial);
        panel.position.set(piece.x, piece.y, 0);
        scene.add(panel);
      });

      const hullMetal = new THREE.MeshStandardMaterial({ color: 0x426171, metalness: 0.62, roughness: 0.38 });
      const hullDark = new THREE.MeshStandardMaterial({ color: 0x101f2b, metalness: 0.34, roughness: 0.58 });
      const hullScreen = new THREE.MeshStandardMaterial({ color: 0x48c7dc, emissive: 0x125268, emissiveIntensity: 0.8, metalness: 0.15, roughness: 0.28 });
      const hullAmber = new THREE.MeshStandardMaterial({ color: 0x92eaff, emissive: 0x125b78, emissiveIntensity: 0.42 });
      const hullGreen = new THREE.MeshStandardMaterial({ color: 0x69d39a, emissive: 0x113e28, emissiveIntensity: 0.3 });
      const addHullPart = (geometry, material, x, y, z, rz) => {
        const part = new THREE.Mesh(geometry, material);
        part.position.set(x, y, z);
        if (rz) part.rotation.z = rz;
        scene.add(part);
        return part;
      };
      const windowFrame = new THREE.MeshStandardMaterial({ color: 0x426171, metalness: 0.62, roughness: 0.38 });
      addHullPart(new THREE.BoxGeometry(2.38, 0.09, 0.1), windowFrame, 0, 0.64, 0.34);
      addHullPart(new THREE.BoxGeometry(2.38, 0.09, 0.1), windowFrame, 0, -0.64, 0.34);
      addHullPart(new THREE.BoxGeometry(0.09, 1.2, 0.1), windowFrame, -1.15, 0, 0.34);
      addHullPart(new THREE.BoxGeometry(0.09, 1.2, 0.1), windowFrame, 1.15, 0, 0.34);

      // Pilot console and wheel.
      addHullPart(new THREE.BoxGeometry(1.1, 0.52, 0.2), hullMetal, -4.5, -0.85, 0.48);
      addHullPart(new THREE.BoxGeometry(0.76, 0.28, 0.12), hullDark, -4.5, -0.49, 0.61);
      addHullPart(new THREE.BoxGeometry(0.54, 0.1, 0.08), hullScreen, -4.5, -0.49, 0.69);
      addHullPart(new THREE.TorusGeometry(0.22, 0.045, 7, 20), hullMetal, -4.85, -0.08, 0.64);

      // Central gun mount and magazine: this is a playable station, not just decoration.
      addHullPart(new THREE.CylinderGeometry(0.34, 0.4, 0.18, 12), hullMetal, 0, 1.96, 0.45);
      addHullPart(new THREE.BoxGeometry(1.15, 0.15, 0.18), hullDark, -0.3, 2.11, 0.62);
      addHullPart(new THREE.BoxGeometry(0.92, 0.58, 0.2), hullMetal, 0, -0.9, 0.52);
      for (let i = 0; i < 4; i += 1) {
        addHullPart(new THREE.CylinderGeometry(0.075, 0.075, 0.36, 8), hullAmber, -0.3 + i * 0.2, -0.83, 0.68, Math.PI / 2);
      }
      addHullPart(new THREE.BoxGeometry(0.62, 0.09, 0.08), hullScreen, 0, -0.48, 0.68);

      // Engineering panel and crossed repair tools.
      addHullPart(new THREE.BoxGeometry(1.1, 0.55, 0.2), hullMetal, 4.45, -0.85, 0.48);
      addHullPart(new THREE.BoxGeometry(0.74, 0.28, 0.12), hullDark, 4.45, -0.49, 0.61);
      addHullPart(new THREE.BoxGeometry(0.54, 0.1, 0.08), hullGreen, 4.45, -0.49, 0.69);
      addHullPart(new THREE.BoxGeometry(0.55, 0.07, 0.08), hullAmber, 4.45, -0.15, 0.64, 0.62);
      addHullPart(new THREE.BoxGeometry(0.55, 0.07, 0.08), hullMetal, 4.45, -0.15, 0.65, -0.62);

      // A visible asteroid marks the forward gun lane. No ring is drawn in the hold.
      gunTarget = addHullPart(new THREE.DodecahedronGeometry(0.28, 0), hullMetal, 0.7, 2.62, 0.78);
      rooms.forEach((room, index) => {
        if (index === 0) return;
        const wall = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 2.2, 0.5),
          new THREE.MeshStandardMaterial({ color: 0x8aa0b0 })
        );
        wall.position.set(room.x0, 0.55, 0.1);
        scene.add(wall);
      });
      waters = rooms.map((room) => {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(room.x1 - room.x0 - 0.08, 1, 0.35),
          new THREE.MeshBasicMaterial({ color: 0x1d6d86, transparent: true, opacity: 0.55 })
        );
        mesh.position.set((room.x0 + room.x1) / 2, floor, 0.2);
        scene.add(mesh);
        return mesh;
      });
      breach = new THREE.Mesh(
        new THREE.CircleGeometry(0.28, 16),
        new THREE.MeshBasicMaterial({ color: 0x72dcf7 })
      );
      breach.position.set(0, floor + 0.15, 0.45);
      scene.add(breach);
      externalHoleMeshes = rooms.map((room) => {
        const mesh = new THREE.Mesh(
          new THREE.CircleGeometry(0.23, 14),
          new THREE.MeshBasicMaterial({ color: 0x68bfff, transparent: true, opacity: 0.9, depthWrite: false })
        );
        mesh.position.set((room.x0 + room.x1) / 2, floor + 0.15, 0.47);
        mesh.visible = false;
        scene.add(mesh);
        return mesh;
      });
      fireRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.34, 0.022, 6, 18),
        new THREE.MeshBasicMaterial({ color: 0x7cecff, transparent: true, opacity: 0.18, depthWrite: false })
      );
      fireRing.position.set(0, floor + 0.15, 0.49);
      fireRing.visible = true;
      scene.add(fireRing);
      // Dense but bounded smoke fields: particles are reused, not created during frames.
      rooms.forEach((room, roomIndex) => {
        const puffCount = 54;
        for (let puff = 0; puff < puffCount; puff += 1) {
          const phase = puff * 0.83 + roomIndex * 1.71;
          const baseX = room.x0 + 0.22 + (puff + 0.5) / puffCount * (room.x1 - room.x0 - 0.44);
          const mesh = new THREE.Mesh(
            new THREE.CircleGeometry(0.095 + (puff % 4) * 0.035, 8),
            new THREE.MeshBasicMaterial({ color: 0x9eafb8, transparent: true, opacity: 0, depthWrite: false })
          );
          mesh.position.set(baseX, floor + 0.45 + ((puff * 3) % 6) * 0.29, 0.73);
          mesh.visible = false;
          scene.add(mesh);
          smokeParticles.push({ mesh, roomIndex, phase, baseX, roomParticleIndex: puff, particleCount: puffCount });
        }
      });

      // Water bubbles use a fixed pool with a density curve tied to water level.
      rooms.forEach((room, roomIndex) => {
        const bubbleCount = 96;
        for (let bubble = 0; bubble < bubbleCount; bubble += 1) {
          const phase = ((bubble * 0.61803398875) + roomIndex * 0.37) % 1;
          const baseX = room.x0 + 0.18 + (bubble + 0.5) / bubbleCount * (room.x1 - room.x0 - 0.36);
          const mesh = new THREE.Mesh(
            new THREE.CircleGeometry(0.032 + (bubble % 4) * 0.011, 6),
            new THREE.MeshBasicMaterial({ color: 0x9cefff, transparent: true, opacity: 0.66, depthWrite: false })
          );
          mesh.position.set(baseX, floor + 0.05, 0.66);
          mesh.scale.setScalar(0.7 + (bubble % 4) * 0.12);
          mesh.visible = false;
          scene.add(mesh);
          waterBubbles.push({ mesh, roomIndex, phase, baseX, bubbleIndex: bubble, particleCount: bubbleCount });
        }
      });
      const addCrewSprite = (player, index, texture) => {
        if (!texture || closed || !scene) {
          try { texture && texture.dispose(); } catch (e) {}
          return;
        }
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
          map: texture, transparent: true, depthTest: false, depthWrite: false
        }));
        const image = texture.image || {};
        const imageWidth = image.width || image.naturalWidth || 1;
        const imageHeight = image.height || image.naturalHeight || 1;
        const spriteHeight = 1.42;
        sprite.scale.set(spriteHeight * imageWidth / Math.max(1, imageHeight), spriteHeight, 1);
        sprite.position.set(player.x, player.y + 0.16, 0.82 + index * 0.015);
        sprite.renderOrder = 20 + index;
        player.sprite = sprite;
        player.texture = texture;
        scene.add(sprite);
      };
      players.forEach((player, index) => {
        if (player.crew && player.crew.image) {
          makeCrewTexture(THREE, player.crew)
            .then((texture) => addCrewSprite(player, index, texture))
            .catch((error) => {
              console.warn("Hull Dive Crew cut-out unavailable; selected Crew was not replaced by a substitute", error);
              notifyStatus(say("Не удалось подготовить изображение выбранного Crew", "Could not prepare the selected Crew portrait"), 3500);
            });
        } else {
          const fallback = makeFallbackChibiTexture(THREE, index === 0 ? "#62b9d8" : "#d7a65a", index === 0 ? "#d9f6ff" : "#fff0bd");
          addCrewSprite(player, index, fallback);
        }
      });
      const paint = () => {
        if (!renderer || closed) return;
        const w = view.clientWidth || window.innerWidth;
        const h = view.clientHeight || window.innerHeight;
        if (renderer.domElement.width !== Math.floor(w * renderer.getPixelRatio())) renderer.setSize(w, h);
        renderer.render(scene, camera);
      };
      root._paint = paint;

      // One pointer path covers mouse, touchpad and finger. Crew can be dragged;
      // holding on a flooded compartment pumps it, while holding the central seam repairs.
      const canvas = renderer.domElement;
      const pointerWorld = (event) => {
        const rect = canvas.getBoundingClientRect();
        return {
          x: (event.clientX - rect.left) / Math.max(1, rect.width) * 16 - 8,
          y: 4.5 - (event.clientY - rect.top) / Math.max(1, rect.height) * 9
        };
      };
      const endPointerAction = (event) => {
        if (!pointerInteraction || (event && event.pointerId != null && event.pointerId !== pointerInteraction.pointerId)) return;
        pointerInteraction = null;
      };
      canvas.addEventListener("pointerdown", (event) => {
        if (closed || event.button !== 0) return;
        const point = pointerWorld(event);
        const crewIndex = players.findIndex((player) =>
          Math.abs(point.x - player.x) < 0.48 &&
          point.y >= player.y - 0.58 && point.y <= player.y + 0.9
        );
        let action = "";
        let roomIndex = roomAt(point.x);
        if (crewIndex >= 0) {
          action = "drag";
        } else {
          const surface = floor + Math.max(0.04, water[roomIndex] * 3.15);
          if (water[roomIndex] > 0.015 &&
              point.y >= floor - 0.08 && point.y <= surface + 0.24) {
            action = "pump";
          } else if (Math.abs(point.x) < 0.8 &&
                     point.y >= floor - 0.2 && point.y <= floor + 0.95) {
            action = "repair";
          }
        }
        if (!action) return;
        event.preventDefault();
        pointerInteraction = {
          pointerId: event.pointerId,
          action,
          playerIndex: crewIndex,
          roomIndex,
          blockedNotice: false
        };
        try { canvas.setPointerCapture(event.pointerId); } catch (e) {}
        if (action === "drag") {
          players[crewIndex].x = Math.max(-6, Math.min(6, point.x));
          players[crewIndex].y = Math.max(floor + 0.3, Math.min(ceil - 0.2, point.y));
        }
      });
      canvas.addEventListener("pointermove", (event) => {
        if (!pointerInteraction || event.pointerId !== pointerInteraction.pointerId) return;
        const point = pointerWorld(event);
        if (pointerInteraction.action === "drag") {
          const player = players[pointerInteraction.playerIndex];
          if (!player) return;
          player.x = Math.max(-6, Math.min(6, point.x));
          player.y = Math.max(floor + 0.3, Math.min(ceil - 0.2, point.y));
          if (player.sprite) player.sprite.position.set(player.x, player.y + 0.16, 0.82 + pointerInteraction.playerIndex * 0.015);
        } else if (pointerInteraction.action === "pump") {
          const roomIndex = roomAt(point.x);
          const surface = floor + Math.max(0.04, water[roomIndex] * 3.15);
          if (point.y >= floor - 0.08 && point.y <= surface + 0.24) pointerInteraction.roomIndex = roomIndex;
        }
      });
      ["pointerup", "pointercancel", "lostpointercapture"].forEach((name) => {
        canvas.addEventListener(name, endPointerAction);
      });
    }

    function fireWeapon(player) {
      if (Math.abs(player.x) > 1.35) {
        notifyStatus(say("Орудие и боезапас — в центральном отсеке", "The gun and ammo rack are in the central compartment"), 1800);
        return;
      }
      if (!gunTarget) return;
      if (ammo <= 0) {
        notifyStatus(say("Боезапас пуст. У стойки нажми R и удерживай для зарядки", "Out of ammo. Hold R at the rack to reload"), 2300);
        return;
      }
      if (!gunTarget.visible) {
        notifyStatus(say("Цель уже уничтожена. Пополни боезапас для следующего астероида", "Target destroyed. Reload to engage the next asteroid"), 2200);
        return;
      }
      ammo -= 1;
      shotCooldown = 0.42;
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 2.06, 0.88),
        new THREE.Vector3(gunTarget.position.x, gunTarget.position.y, gunTarget.position.z + 0.04)
      ]);
      const material = new THREE.LineBasicMaterial({ color: 0x74efff, transparent: true, opacity: 0.9 });
      const laser = new THREE.Line(geometry, material);
      scene.add(laser);
      laserShots.push({ mesh: laser, life: 0.16 });
      targetArmor = Math.max(0, targetArmor - 1);
      if (targetArmor <= 0) {
        gunTarget.visible = false;
        if (gunTargetRing) gunTargetRing.visible = false;
        notifyStatus(say("Астероид сбит! Перезарядись, чтобы продолжить", "Asteroid destroyed. Reload to continue"), 2500);
      } else {
        notifyStatus(say("Попадание · броня астероида ", "Hit · asteroid armor ") + targetArmor + "/3 · " + say("боезапас ", "ammo ") + ammo + "/" + maxAmmo, 1600);
      }
    }

    function roomAt(x) {
      for (let i = 0; i < rooms.length; i += 1) {
        if (x >= rooms[i].x0 && x <= rooms[i].x1) return i;
      }
      return x < 0 ? 0 : 2;
    }

    function tick(now) {
      if (closed) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // Exterior events can arrive from a separate spacewalk/impact system.
      // Read integrity/hole flags each tick without resetting live water levels.
      repairState.compartments.forEach((component, index) => {
        integrity[index] = Math.max(0, Math.min(100, Number(component.integrity ?? integrity[index])));
        externalHole[index] = !!component.externalHole;
      });
      shotCooldown = Math.max(0, shotCooldown - dt);
      if (keys.q) pressure = Math.max(0.45, pressure - dt * 0.35);
      if (keys.c) pressure = Math.min(1.7, pressure + dt * 0.35);
      laserShots.forEach((shot) => { shot.life -= dt; });
      for (let i = laserShots.length - 1; i >= 0; i -= 1) {
        if (laserShots[i].life > 0) continue;
        scene.remove(laserShots[i].mesh);
        laserShots[i].mesh.geometry.dispose();
        laserShots[i].mesh.material.dispose();
        laserShots.splice(i, 1);
      }
      const leak = (1 - weld) * 0.11 * pressure;
      water[1] = Math.min(1, water[1] + leak * dt);
      externalHole.forEach((isOpen, index) => {
        if (!isOpen) return;
        water[index] = Math.min(1, water[index] + 0.5 * dt);
        smoke[index] = Math.min(1, smoke[index] + 0.2 * dt);
        fire[index] = Math.min(0.95, fire[index] + 0.08 * dt);
      });
      for (let i = 0; i < 2; i += 1) {
        const flow = (water[i] - water[i + 1]) * 0.35 * dt;
        water[i] -= flow;
        water[i + 1] += flow;
      }

      // Fire and smoke are compartment state, not just decoration. The central
      // leak feeds the fire until the seam is sealed; E pumps and extinguishes.
      fire[1] = Math.max(0, Math.min(0.95,
        fire[1] + dt * ((weld < 0.99 ? 0.035 * pressure : -0.015))
      ));
      smoke[1] = Math.max(0, Math.min(1, smoke[1] + dt * (fire[1] * 0.24 - 0.012)));
      for (const side of [0, 2]) {
        const spread = (smoke[1] - smoke[side]) * 0.055 * dt;
        smoke[side] = Math.max(0, Math.min(1, smoke[side] + spread));
        fire[side] = Math.max(0, Math.min(0.6,
          fire[side] + dt * (smoke[side] > 0.72 ? 0.008 : -0.012)
        ));
      }
      const assignedPads = readAssignedGamepads();
      const inputs = players.map((player, index) => playerInput(index, assignedPads[index]));
      const submergedRooms = players.map((player) => water[roomAt(player.x)] > 0.42);
      const submergedCount = submergedRooms.filter(Boolean).length;
      players.forEach((player, index) => {
        const input = inputs[index];
        const atHelm = index === 0 && Math.abs(player.x + 4.75) < 0.8;
        if (index === 0 && ((input.helm && !helmToggleWasDown) || helmTogglePending)) {
          if (pilotMode) {
            // Leaving the helm must always be possible, even if drift put the
            // Crew sprite just outside the narrow physical station radius.
            pilotMode = false;
            notifyStatus(say("Экипаж: A/D и W/S — перемещение. V — вернуться к штурвалу", "Crew movement: A/D and W/S. Press V to return to the helm"), 2800);
          } else if (atHelm) {
            pilotMode = true;
            notifyStatus(say("Штурвал: W/S — тяга, A/D — курс. V — покинуть пост", "Helm: W/S controls thrust, A/D heading. Press V to leave the helm"), 2800);
          } else {
            notifyStatus(say("Чтобы сесть за штурвал, вернись в носовой отсек", "Return to the forward compartment to use the helm"), 2200);
          }
        }
        if (index === 0) helmToggleWasDown = input.helm;
        const usingHelm = index === 0 && atHelm && pilotMode;
        if (usingHelm) {
          enginePower = Math.max(0, Math.min(1, enginePower + input.dy * dt * 0.7));
          flightHeading = Math.max(-1, Math.min(1, flightHeading + input.dx * dt * 0.75));
          flightTime += dt * (0.25 + enginePower * 1.8);
        } else {
          const speed = submergedRooms[index] ? 1.7 : 2.5;
          player.x += input.dx * speed * dt;
          if (submergedRooms[index]) {
            player.y += input.dy * speed * dt;
          } else {
            player.y += (floor + 0.42 - player.y) * Math.min(1, dt * 8);
          }
        }
        if (index === 0) {
          window.BCMHullHelmState = {
            engaged: usingHelm,
            thrust: usingHelm ? input.dy : 0,
            yaw: usingHelm ? input.dx : 0
          };
        }
        player.x = Math.max(-6, Math.min(6, player.x));
        player.y = Math.max(floor + 0.3, Math.min(ceil - 0.2, player.y));
        if (input.pump) {
          const room = roomAt(player.x);
          water[room] = Math.max(0, water[room] - 0.16 * dt);
          fire[room] = Math.max(0, fire[room] - 0.30 * dt);
          smoke[room] = Math.max(0, smoke[room] - 0.34 * dt);
        }
        if (input.shoot && shotCooldown <= 0) fireWeapon(player);
        if (input.reload && Math.abs(player.x) < 1.35) {
          if (ammo < maxAmmo || (gunTarget && !gunTarget.visible)) {
            reloadProgress[index] += dt;
            if (reloadProgress[index] >= 1.05) {
              ammo = maxAmmo;
              reloadProgress[0] = 0;
              reloadProgress[1] = 0;
              if (gunTarget && !gunTarget.visible) {
                targetArmor = 3;
                gunTarget.visible = true;
                if (gunTargetRing) gunTargetRing.visible = true;
              }
              notifyStatus(say("Боезапас пополнен ", "Ammo reloaded: ") + ammo + "/" + maxAmmo, 2000);
            }
          } else {
            reloadProgress[index] = 0;
          }
        } else {
          reloadProgress[index] = 0;
        }
        if (input.reload && !reloadHeld[index] && Math.abs(player.x) >= 1.35) {
          notifyStatus(say("Подойди к центральной стойке боезапаса и удерживай R", "Move to the central ammo rack and hold R"), 2200);
        }
        reloadHeld[index] = input.reload;
        if (player.sprite) player.sprite.position.set(player.x, player.y + 0.16, 0.82 + index * 0.015);
      });
      // A short touchscreen tap can begin and end between animation frames.
      // Consume the edge-triggered request once so the helm never feels stuck.
      helmTogglePending = false;

      const nearBreach = players.map((player) => Math.abs(player.x) < 0.7 && player.y < floor + 0.9);
      const repairers = nearBreach.reduce((count, near, index) =>
        count + (near && inputs[index].repair && !externalHole[1] ? 1 : 0), 0);
      if (repairers && weld < 1) weld = Math.min(1, weld + dt * 0.42 * Math.min(2, repairers));
      if (nearBreach.some((near, index) => near && inputs[index].repair) && externalHole[1]) {
        notifyStatus(say("Снаружи пробоина ещё открыта: сначала требуется наружная заплата", "The exterior breach is still open; patch it from outside first"), 2500);
      }
      if (submergedCount) oxygen = Math.max(0, oxygen - 9 * dt);
      else oxygen = Math.min(100, oxygen + 7 * dt);
      if (oxygen <= 0 && !won) {
        oxygen = 100;
        water[0] *= 0.5;
        water[1] = Math.min(1, water[1] + 0.2);
        status.textContent = say("Воздух кончился. Насос E (или gamepad B), пока голова над водой.", "Oxygen depleted. Use E (or gamepad B) to pump while your head is above water.");
      }
      if (gunTarget && gunTarget.visible) {
        const lateral = Math.sin(flightTime * 0.62 + flightHeading * 2.1) * (0.34 + enginePower * 1.25);
        gunTarget.position.x = 0.7 + lateral;
        gunTarget.position.y = 2.62 + Math.sin(flightTime * 0.83) * (0.08 + enginePower * 0.18);
        if (gunTargetRing) {
          gunTargetRing.position.x = gunTarget.position.x;
          gunTargetRing.position.y = gunTarget.position.y;
        }
      }
      if (pointerInteraction && pointerInteraction.action === "pump") {
        const roomIndex = pointerInteraction.roomIndex;
        if (Number.isInteger(roomIndex) && roomIndex >= 0 && roomIndex < water.length) {
          water[roomIndex] = Math.max(0, water[roomIndex] - 0.42 * dt);
          fire[roomIndex] = Math.max(0, fire[roomIndex] - 0.18 * dt);
          smoke[roomIndex] = Math.max(0, smoke[roomIndex] - 0.12 * dt);
        }
      }
      if (pointerInteraction && pointerInteraction.action === "repair") {
        if (externalHole[1]) {
          if (!pointerInteraction.blockedNotice) {
            pointerInteraction.blockedNotice = true;
            notifyStatus(say("Снаружи сначала установи заплату: внутренний шов пока заблокирован", "Patch the exterior breach first; the inner seam is still locked"), 2600);
          }
        } else {
          weld = Math.min(1, weld + dt * 0.42);
        }
      }
      const anyNearBreach = nearBreach.some(Boolean);
      if (weld >= 1 && water.every((level) => level < 0.12)) {
        won = true;
        status.textContent = say("Отсек сухой. Можно обратно к кольцу.", "Compartment dry. You can return to the Ring.");
      } else if (!won && anyNearBreach && weld < 1) {
        status.textContent = say("Ремонт: F / Enter или gamepad A. Давление ", "Repair: F / Enter or gamepad A. Pressure ") + pressure.toFixed(1);
      }
      oxEl.textContent = "O2 " + Math.round(oxygen);
      weldEl.textContent = say("шов ", "SEAM ") + Math.round(weld * 100) + "%";
      const activeReload = Math.max(reloadProgress[0], reloadProgress[1]);
      if (ammoEl) ammoEl.textContent = say("БОЕЗАПАС ", "AMMO ") + ammo + "/" + maxAmmo + (activeReload > 0 ? " · " + say("ЗАРЯДКА ", "RELOADING ") + Math.round(activeReload / 1.05 * 100) + "%" : "");
      const flightEl = root.querySelector("[data-hull-flight]");
      if (flightEl) flightEl.textContent = (pilotMode ? say("ШТУРВАЛ · LB/V ВЫХОД", "HELM · LB/V EXIT") : say("CREW · LB/V ШТУРВАЛ", "CREW · LB/V HELM")) +
        " · " + say("ТЯГА ", "THRUST ") + Math.round(enginePower * 100) + "% · " + say("КУРС ", "HEADING ") + Math.round(flightHeading * 45) + "°";
      waters.forEach((mesh, index) => {
        const depth = Math.max(0.04, water[index] * 3.15);
        mesh.scale.y = depth;
        mesh.position.y = floor + depth / 2;
      });
      repairState.compartments.forEach((component, index) => {
        component.integrity = integrity[index];
        component.externalHole = externalHole[index];
        component.waterLevel = water[index];
        component.smokeLevel = smoke[index];
        component.fireLevel = fire[index];
      });
      externalHoleMeshes.forEach((mesh, index) => {
        mesh.visible = externalHole[index];
        const pulse = 0.86 + Math.sin(now * 0.008 + index) * 0.1;
        mesh.scale.setScalar(pulse);
      });
      smokeParticles.forEach((puff) => {
        const level = smoke[puff.roomIndex];
        const cycle = ((now * 0.00012 + puff.phase) % 1 + 1) % 1;
        const activeCount = level > 0.012 ? Math.min(puff.particleCount, Math.max(7, Math.ceil(level * puff.particleCount * 2.1))) : 0;
        puff.mesh.visible = puff.roomParticleIndex < activeCount;
        puff.mesh.position.x = puff.baseX + Math.sin(now * 0.0011 + puff.phase) * (0.07 + level * 0.2);
        puff.mesh.position.y = floor + 0.18 + cycle * 2.65;
        puff.mesh.scale.setScalar(0.8 + level * 1.7);
        puff.mesh.material.opacity = Math.min(0.48, 0.13 + level * 0.58) * (0.78 + Math.sin(now * 0.003 + puff.phase) * 0.16);
      });
      waterBubbles.forEach((bubble) => {
        const level = water[bubble.roomIndex];
        const activeCount = level > 0.01 ? Math.min(bubble.particleCount, Math.max(6, Math.ceil(level * bubble.particleCount * 2.2))) : 0;
        bubble.mesh.visible = bubble.bubbleIndex < activeCount;
        if (!bubble.mesh.visible) return;
        const surface = floor + Math.max(0.06, level * 3.15);
        const height = Math.max(0.06, surface - floor - 0.035);
        const cycle = ((now * (0.00038 + level * 0.00026) + bubble.phase) % 1 + 1) % 1;
        bubble.mesh.position.x = bubble.baseX + Math.sin(now * 0.002 + bubble.phase * 7) * (0.035 + level * 0.08);
        bubble.mesh.position.y = floor + 0.035 + cycle * height;
        bubble.mesh.scale.setScalar(0.5 + level * 1.8 + (bubble.bubbleIndex % 4) * 0.12);
      });
      if (fireRing) {
        fireRing.visible = fire[1] > 0.015;
        fireRing.material.opacity = Math.min(0.72, 0.12 + fire[1] * 0.56);
        fireRing.rotation.z += dt * (0.35 + fire[1] * 1.8);
        fireRing.scale.setScalar(0.8 + fire[1] * 0.55);
      }
      if (hazardsEl) {
        hazardsEl.textContent = (window.BCMDialogue?.language === "en" ? "WATER " : "ВОДА ") + Math.round(water[1] * 100) + "% · " +
          (window.BCMDialogue?.language === "en" ? "SMOKE " : "ДЫМ ") + Math.round(smoke[1] * 100) + "% · " +
          (window.BCMDialogue?.language === "en" ? "OVERHEAT " : "ПЕРЕГРЕВ ") + Math.round(fire[1] * 100) + "%";
        hazardsEl.style.color = fire[1] > 0.45 || smoke[1] > 0.65 ? "#ffad83" : "#c4d2d9";
      }
      if (breach) {
        const left = Math.max(0.08, 1 - weld);
        breach.scale.set(left, left, 1);
        breach.material.color.set(weld >= 1 ? 0x7dcea0 : 0x72dcf7);
      }
      if (now < actionStatusUntil && actionStatus) status.textContent = actionStatus;
      if (root._paint) root._paint();
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
  }

  window.BCMHullDive = { open: open };
})();
