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

  function open(onClose) {
    if (document.getElementById("bcm-hull-dive")) return;
    const THREE = window.THREE;
    const root = document.createElement("div");
    root.id = "bcm-hull-dive";
    root.style.cssText = "position:fixed;inset:0;z-index:80;background:#041018;color:#e7eef2;font-family:Rajdhani,sans-serif;";
    root.innerHTML =
      '<div style="position:absolute;top:12px;left:12px;right:12px;display:flex;justify-content:space-between;gap:12px;pointer-events:none;z-index:10">' +
      '<div><div style="letter-spacing:.18em;font-size:12px;color:#c4a35a">ОТСЕК · ПРОРЫВ</div>' +
      '<div data-hull-status style="font-size:14px;margin-top:4px">Завари пробоину и откачай воду</div></div>' +
      '<button type="button" data-hull-exit style="pointer-events:auto;height:44px;padding:0 14px;border:1px solid #355066;background:#10202c;color:#e7eef2;border-radius:8px">К КОЛЬЦУ</button></div>' +
      '<div data-hull-view style="position:absolute;inset:0"></div>' +
      '<div data-hull-controls style="position:absolute;left:10px;right:10px;bottom:54px;display:flex;justify-content:space-between;gap:6px;flex-wrap:wrap;pointer-events:none">' +
      '<div style="display:flex;gap:5px;pointer-events:auto">' +
      '<button type="button" data-hull-control="left" aria-label="Идти влево">◀</button>' +
      '<button type="button" data-hull-control="right" aria-label="Идти вправо">▶</button>' +
      '<button type="button" data-hull-control="up" aria-label="Плыть вверх">▲</button>' +
      '<button type="button" data-hull-control="down" aria-label="Плыть вниз">▼</button></div>' +
      '<div style="display:flex;gap:5px;pointer-events:auto">' +
      '<button type="button" data-hull-control="repair">F · РЕМОНТ</button>' +
      '<button type="button" data-hull-control="pump">E · НАСОС</button></div></div>' +
      '<div style="position:absolute;left:12px;right:12px;bottom:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;font-size:12px">' +
      '<span data-hull-ox style="font-variant-numeric:tabular-nums">O2 100</span>' +
      '<span data-hull-weld>шов 0%</span>' +
      '<span data-hull-crew>CREW</span>' +
      '<span data-hull-hint style="opacity:.75">P1 WASD · F/E · P2 стрелки · Enter/Shift</span></div>' +
      '<style>#bcm-hull-dive [data-hull-controls] button{touch-action:none;min-height:38px;min-width:38px;padding:5px 9px;border:1px solid #46667b;border-radius:8px;background:rgba(16,32,44,.94);color:#e7eef2;font-weight:700}#bcm-hull-dive [data-hull-controls] button.is-active{background:#294b60;border-color:#7bd9ee}#bcm-hull-dive canvas{display:block;width:100%;height:100%}@media(max-width:620px){#bcm-hull-dive [data-hull-controls] button{font-size:12px;padding:4px 7px;min-height:36px}}@media(min-width:1000px){#bcm-hull-dive [data-hull-controls]{left:50%;right:auto;transform:translateX(-50%);width:min(800px,94vw)}}</style>';
    document.body.appendChild(root);

    const view = root.querySelector("[data-hull-view]");
    const status = root.querySelector("[data-hull-status]");
    const oxEl = root.querySelector("[data-hull-ox]");
    const weldEl = root.querySelector("[data-hull-weld]");
    const crewEl = root.querySelector("[data-hull-crew]");
    const crewSelection = Array.isArray(window.BCMMiniCrewSelection?.players)
      ? window.BCMMiniCrewSelection.players.slice(0, 2)
      : [];
    const crewName = (entry, index) => String(
      entry?.displayName || entry?.crewName || entry?.name ||
      (entry?.mint ? String(entry.mint).slice(0, 8) + "…" : "Crew " + (index + 1))
    ).slice(0, 28);
    const players = [
      { x: -4.2, y: floor + 0.42, sprite: null, texture: null, name: crewName(crewSelection[0], 0) },
      { x: -3.1, y: floor + 0.42, sprite: null, texture: null, name: crewName(crewSelection[1], 1) }
    ];
    if (crewEl) crewEl.textContent = "CREW: " + players.map((player) => player.name).join(" / ");
    let closed = false;
    let renderer = null;
    let scene = null;
    let frame = 0;

    function finish() {
      if (closed) return;
      closed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKey, true);
      players.forEach((player) => {
        if (!player.sprite) return;
        try { player.texture?.dispose?.(); } catch (e) {}
        try { player.sprite.material.dispose?.(); } catch (e) {}
        if (scene) scene.remove(player.sprite);
        player.sprite = null;
      });
      if (renderer) {
        renderer.dispose();
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      root.remove();
      if (typeof onClose === "function") onClose();
    }
    root.querySelector("[data-hull-exit]").addEventListener("click", finish);

    const keys = Object.create(null);
    const handledCodes = new Set([
      "KeyW", "KeyA", "KeyS", "KeyD", "KeyE", "KeyF", "KeyR", "KeyC",
      "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", "ShiftLeft", "ShiftRight", "Space"
    ]);
    function onKey(event) {
      const down = event.type === "keydown";
      keys[String(event.key || "").toLowerCase()] = down;
      if (handledCodes.has(event.code)) {
        event.preventDefault();
        event.stopPropagation();
      }
      if (event.code === "Escape" && down) finish();
    }
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKey, true);

    const buttonKeys = { left: "a", right: "d", up: "w", down: "s", repair: "f", pump: "e" };
    root.querySelectorAll("[data-hull-control]").forEach((button) => {
      const key = buttonKeys[button.dataset.hullControl];
      if (!key) return;
      const press = (event) => {
        event.preventDefault();
        event.stopPropagation();
        keys[key] = true;
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

    const water = [0.05, 0.12, 0.05];
    let weld = 0;
    let oxygen = 100;
    let pressure = 1;
    let won = false;
    let last = performance.now();

    function readGamepad() {
      try {
        const pads = navigator.getGamepads ? [...navigator.getGamepads()] : [];
        const gp = pads.find((pad) => pad && pad.connected);
        if (!gp) return { x: 0, y: 0, repair: false, pump: false };
        const axis = (value) => Math.abs(value) < 0.18 ? 0 : Math.sign(value) * (Math.abs(value) - 0.18) / 0.82;
        const button = (index) => !!(gp.buttons && gp.buttons[index] && gp.buttons[index].pressed);
        const axes = gp.axes || [];
        return {
          x: Math.max(-1, Math.min(1, axis(axes[0] || 0) + (button(15) ? 1 : 0) - (button(14) ? 1 : 0))),
          y: Math.max(-1, Math.min(1, axis(axes[1] || 0) + (button(13) ? 1 : 0) - (button(12) ? 1 : 0))),
          repair: button(0),
          pump: button(1)
        };
      } catch (e) {
        return { x: 0, y: 0, repair: false, pump: false };
      }
    }

    function playerInput(index, pad) {
      if (index === 0) {
        return {
          dx: Math.max(-1, Math.min(1, (keys.d ? 1 : 0) - (keys.a ? 1 : 0) + pad.x)),
          dy: Math.max(-1, Math.min(1, (keys.w ? 1 : 0) - (keys.s ? 1 : 0) - pad.y)),
          repair: !!(keys.f || pad.repair),
          pump: !!(keys.e || pad.pump)
        };
      }
      return {
        dx: (keys.arrowright ? 1 : 0) - (keys.arrowleft ? 1 : 0),
        dy: (keys.arrowup ? 1 : 0) - (keys.arrowdown ? 1 : 0),
        repair: !!keys.enter,
        pump: !!keys.shift
      };
    }

    function makeChibiTexture(THREE, suitColor, accentColor) {
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

    let waters = [];
    let breach = null;
    if (THREE && view) {
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x041018);
      const camera = new THREE.OrthographicCamera(-8, 8, 4.5, -4.5, 0.1, 20);
      camera.position.set(0, 0, 8);
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setSize(view.clientWidth || window.innerWidth, view.clientHeight || window.innerHeight);
      view.appendChild(renderer.domElement);
      scene.add(new THREE.AmbientLight(0xffffff, 0.85));
      const hull = new THREE.Mesh(
        new THREE.BoxGeometry(12.8, 3.7, 0.4),
        new THREE.MeshStandardMaterial({ color: 0x1c3344, metalness: 0.35, roughness: 0.55 })
      );
      scene.add(hull);
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
        new THREE.MeshBasicMaterial({ color: 0xffb15a })
      );
      breach.position.set(0, floor + 0.15, 0.45);
      scene.add(breach);
      players.forEach((player, index) => {
        const texture = makeChibiTexture(THREE, index === 0 ? "#62b9d8" : "#d7a65a", index === 0 ? "#d9f6ff" : "#fff0bd");
        if (!texture) return;
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
          map: texture, transparent: true, depthTest: false, depthWrite: false
        }));
        sprite.scale.set(0.82, 1.1, 1);
        sprite.position.set(player.x, player.y + 0.16, 0.72 + index * 0.01);
        sprite.renderOrder = 20 + index;
        player.sprite = sprite;
        player.texture = texture;
        scene.add(sprite);
      });
      const paint = () => {
        if (!renderer || closed) return;
        const w = view.clientWidth || window.innerWidth;
        const h = view.clientHeight || window.innerHeight;
        if (renderer.domElement.width !== Math.floor(w * renderer.getPixelRatio())) renderer.setSize(w, h);
        renderer.render(scene, camera);
      };
      root._paint = paint;
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
      if (keys.r) pressure = Math.max(0.45, pressure - dt * 0.35);
      if (keys.c) pressure = Math.min(1.7, pressure + dt * 0.35);
      const leak = (1 - weld) * 0.11 * pressure;
      water[1] = Math.min(1, water[1] + leak * dt);
      for (let i = 0; i < 2; i += 1) {
        const flow = (water[i] - water[i + 1]) * 0.35 * dt;
        water[i] -= flow;
        water[i + 1] += flow;
      }
      const pad = readGamepad();
      const inputs = players.map((player, index) => playerInput(index, pad));
      const submergedRooms = players.map((player) => water[roomAt(player.x)] > 0.42);
      const submergedCount = submergedRooms.filter(Boolean).length;
      players.forEach((player, index) => {
        const input = inputs[index];
        const speed = submergedRooms[index] ? 1.7 : 2.5;
        player.x += input.dx * speed * dt;
        if (submergedRooms[index]) {
          player.y += input.dy * speed * dt;
        } else {
          player.y += (floor + 0.42 - player.y) * Math.min(1, dt * 8);
        }
        player.x = Math.max(-6, Math.min(6, player.x));
        player.y = Math.max(floor + 0.3, Math.min(ceil - 0.2, player.y));
        if (input.pump) {
          const room = roomAt(player.x);
          water[room] = Math.max(0, water[room] - 0.16 * dt);
        }
        if (player.sprite) player.sprite.position.set(player.x, player.y + 0.16, 0.72 + index * 0.01);
      });

      const nearBreach = players.map((player) => Math.abs(player.x) < 0.7 && player.y < floor + 0.9);
      const repairers = nearBreach.reduce((count, near, index) =>
        count + (near && inputs[index].repair ? 1 : 0), 0);
      if (repairers && weld < 1) weld = Math.min(1, weld + dt * 0.42 * Math.min(2, repairers));
      if (submergedCount) oxygen = Math.max(0, oxygen - 9 * dt);
      else oxygen = Math.min(100, oxygen + 7 * dt);
      if (oxygen <= 0 && !won) {
        oxygen = 100;
        water[0] *= 0.5;
        water[1] = Math.min(1, water[1] + 0.2);
        status.textContent = "Воздух кончился. Насос E (или gamepad B), пока голова над водой.";
      }
      const anyNearBreach = nearBreach.some(Boolean);
      if (weld >= 1 && water.every((level) => level < 0.12)) {
        won = true;
        status.textContent = "Отсек сухой. Можно обратно к кольцу.";
      } else if (!won && anyNearBreach && weld < 1) {
        status.textContent = "Ремонт: F / Enter или gamepad A. Давление " + pressure.toFixed(1);
      }
      oxEl.textContent = "O2 " + Math.round(oxygen);
      weldEl.textContent = "шов " + Math.round(weld * 100) + "%";
      waters.forEach((mesh, index) => {
        const depth = Math.max(0.04, water[index] * 3.15);
        mesh.scale.y = depth;
        mesh.position.y = floor + depth / 2;
      });
      if (breach) {
        const left = Math.max(0.08, 1 - weld);
        breach.scale.set(left, left, 1);
        breach.material.color.set(weld >= 1 ? 0x7dcea0 : 0xffb15a);
      }
      if (root._paint) root._paint();
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
  }

  window.BCMHullDive = { open: open };
})();
