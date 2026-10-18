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
      '<div style="position:absolute;top:12px;left:12px;right:12px;display:flex;justify-content:space-between;gap:12px;pointer-events:none">' +
      '<div><div style="letter-spacing:.18em;font-size:12px;color:#c4a35a">ОТСЕК · ПРОРЫВ</div>' +
      '<div data-hull-status style="font-size:14px;margin-top:4px">Завари пробоину и откачай воду</div></div>' +
      '<button type="button" data-hull-exit style="pointer-events:auto;height:44px;padding:0 14px;border:1px solid #355066;background:#10202c;color:#e7eef2;border-radius:8px">К КОЛЬЦУ</button></div>' +
      '<div data-hull-view style="position:absolute;inset:0"></div>' +
      '<div style="position:absolute;left:12px;right:12px;bottom:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
      '<span data-hull-ox style="font-variant-numeric:tabular-nums">O2 100</span>' +
      '<span data-hull-weld>шов 0%</span>' +
      '<span data-hull-hint style="opacity:.75;font-size:13px">A/D ход · W/S в воде · F варить · E насос</span></div>';
    document.body.appendChild(root);

    const view = root.querySelector("[data-hull-view]");
    const status = root.querySelector("[data-hull-status]");
    const oxEl = root.querySelector("[data-hull-ox]");
    const weldEl = root.querySelector("[data-hull-weld]");
    let closed = false;
    let renderer = null;
    let frame = 0;

    function finish() {
      if (closed) return;
      closed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKey, true);
      if (renderer) {
        renderer.dispose();
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      root.remove();
      if (typeof onClose === "function") onClose();
    }
    root.querySelector("[data-hull-exit]").addEventListener("click", finish);

    const keys = Object.create(null);
    function onKey(event) {
      const down = event.type === "keydown";
      keys[event.key.toLowerCase()] = down;
      if (event.key === "Escape" && down) finish();
      if (down && "wasdef ".indexOf(event.key.toLowerCase()) !== -1) event.stopPropagation();
    }
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKey, true);

    const water = [0.05, 0.12, 0.05];
    let weld = 0;
    let oxygen = 100;
    let pressure = 1;
    let px = -4.2;
    let py = floor + 0.42;
    let won = false;
    let last = performance.now();

    let player = null;
    let waters = [];
    let breach = null;
    if (THREE && view) {
      const scene = new THREE.Scene();
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
      player = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 16, 12),
        new THREE.MeshStandardMaterial({ color: 0xe6d7a8, emissive: 0x3a2e12, emissiveIntensity: 0.4 })
      );
      scene.add(player);
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
      const here = roomAt(px);
      if (keys.e) water[here] = Math.max(0, water[here] - 0.16 * dt);
      const submerged = water[here] > 0.42;
      const speed = submerged ? 1.7 : 2.5;
      if (keys.a || keys.arrowleft) px -= speed * dt;
      if (keys.d || keys.arrowright) px += speed * dt;
      if (submerged) {
        if (keys.w || keys.arrowup) py += speed * dt;
        if (keys.s || keys.arrowdown) py -= speed * dt;
      } else {
        py += (floor + 0.42 - py) * Math.min(1, dt * 8);
      }
      px = Math.max(-6, Math.min(6, px));
      py = Math.max(floor + 0.3, Math.min(ceil - 0.2, py));
      const nearBreach = Math.abs(px) < 0.7 && py < floor + 0.9;
      if ((keys.f || keys["ф"]) && nearBreach && weld < 1) weld = Math.min(1, weld + dt * 0.42);
      if (submerged) oxygen = Math.max(0, oxygen - 9 * dt);
      else oxygen = Math.min(100, oxygen + 7 * dt);
      if (oxygen <= 0 && !won) {
        oxygen = 100;
        water[0] *= 0.5;
        water[1] = Math.min(1, water[1] + 0.2);
        status.textContent = "Воздух кончился. Насос E, пока голова над водой.";
      }
      if (weld >= 1 && water.every((level) => level < 0.12)) {
        won = true;
        status.textContent = "Отсек сухой. Можно обратно к кольцу.";
      } else if (!won && nearBreach && weld < 1) {
        status.textContent = "Держи F на пробоине. Давление " + pressure.toFixed(1);
      }
      oxEl.textContent = "O2 " + Math.round(oxygen);
      weldEl.textContent = "шов " + Math.round(weld * 100) + "%";
      if (player) player.position.set(px, py, 0.55);
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
