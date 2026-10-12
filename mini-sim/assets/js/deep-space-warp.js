(() => {
  "use strict";

  function bootWarpModule() {
    const root = document.querySelector(".bcm-mini-sim");
    if (!root || root.dataset.warpModuleReady === "1") return;
    root.dataset.warpModuleReady = "1";

    const api = () => window.BCMiniSimAPI || null;
    const config = window.BCMMiniSimConfig || {};
    const levelAudio = root.querySelector(".bcm-mini-sim-music-audio");
    const WARP_DURATION = 24;
    let levelAudioWasPlaying = false;
    const warpAudio = document.createElement("audio");
    warpAudio.preload = "none";
    warpAudio.loop = true;
    warpAudio.volume = 0.72;
    warpAudio.setAttribute("playsinline", "");
    let warpAudioSrcLoaded = false;

    function startWarpAudio() {
      if (!config.warpMusicUrl) return;
      try {
        if (!warpAudioSrcLoaded) {
          warpAudio.src = config.warpMusicUrl;
          warpAudio.load();
          warpAudioSrcLoaded = true;
        }
        // On mobile the MP3 metadata may not be ready on the first tap.
        // A fresh source is already at time zero; seek only when it is safe.
        if (warpAudio.readyState > 0) {
          try { warpAudio.currentTime = 0; } catch (e) {}
        }
        const playing = warpAudio.play();
        if (playing && typeof playing.catch === "function") playing.catch(() => {});
      } catch (e) {}
    }

    function stopWarpAudio() {
      try {
        warpAudio.pause();
        warpAudio.currentTime = 0;
      } catch (e) {}
    }

    // Mutually exclusive soundtrack rule: one OST at a time.
    // Preserve the regular level OST's playback position while the map/Tube is active.
    function pauseLevelOst() {
      levelAudioWasPlaying = !!(levelAudio && !levelAudio.paused && !levelAudio.ended);
      if (levelAudioWasPlaying) {
        try { levelAudio.pause(); } catch (e) {}
      }
    }

    function resumeLevelOst() {
      if (!levelAudioWasPlaying || !levelAudio) return;
      levelAudioWasPlaying = false;
      try {
        const resumed = levelAudio.play();
        if (resumed && typeof resumed.catch === "function") resumed.catch(() => {});
      } catch (e) {}
    }

    const state = {
      mode: "closed",
      openedAt: 0,
      nav: null,
      target: null,
      savedPosition: null,
      savedQuaternion: null,
      elapsed: 0,
      startedAt: 0,
      shields: 100,
      playerX: 0,
      playerY: 0,
      pointerDown: false,
      pointerX: 0,
      pointerY: 0,
      lastFrame: 0,
      stars: [],
      animationRunning: false,
      layers: [],
      maze: null,
      statusText: "",
      lastStatusAt: 0,
      keys: Object.create(null),
      touch: { left: false, right: false, up: false, down: false }
    };

    const launchButton = document.createElement("button");
    launchButton.className = "bcm-warp-launch";
    launchButton.type = "button";
    launchButton.textContent = "WARP";
    launchButton.setAttribute("aria-label", "Открыть навигацию Warp");
    root.appendChild(launchButton);

    const exitButton = document.createElement("button");
    exitButton.className = "bcm-warp-exit";
    exitButton.type = "button";
    exitButton.textContent = "RETURN TO DEEP SPACE";
    exitButton.hidden = true;
    root.appendChild(exitButton);

    const overlay = document.createElement("div");
    overlay.className = "bcm-warp-overlay";
    overlay.hidden = true;
    overlay.innerHTML =
      '<canvas class="bcm-warp-backdrop" aria-hidden="true"></canvas>' +
      '<div class="bcm-warp-topbar"><div><div class="bcm-warp-brand">BCM 4 STAR ATLAS</div><div class="bcm-warp-heading">WARP NAVIGATION</div></div><button type="button" data-warp-close class="bcm-warp-close" aria-label="Закрыть">×</button></div>' +
      '<section class="bcm-warp-view bcm-warp-map-view" data-warp-view="map">' +
        '<div class="bcm-warp-card">' +
          '<div class="bcm-warp-kicker">SECTOR NAVIGATION</div><h2>Выберите сектор назначения</h2>' +
          '<p class="bcm-warp-explainer" data-warp-current></p>' +
          '<div class="bcm-warp-source" data-warp-source></div>' +
          '<div class="bcm-warp-grid" data-warp-grid hidden aria-label="Соседние клетки вокруг ONI CSS"></div>' +
          '<div class="bcm-warp-sector-list" data-warp-sectors></div>' +
          '<form class="bcm-warp-manual" data-warp-manual><label>Доп. тестовая клетка <span>X</span><input name="x" type="number" step="1" value="-39" inputmode="numeric"></label><label><span>Y</span><input name="y" type="number" step="1" value="30" inputmode="numeric"></label><button type="submit">ВЫБРАТЬ</button></form>' +
          '<div class="bcm-warp-selected" data-warp-selected>Назначение не выбрано</div>' +
          '<div class="bcm-warp-actions"><button type="button" data-warp-start disabled>START WARP</button><button type="button" data-warp-cancel class="bcm-warp-secondary">ОТМЕНА</button></div>' +
          '<p class="bcm-warp-footnote" data-warp-footnote></p>' +
        '</div>' +
      '</section>' +
      '<section class="bcm-warp-view bcm-warp-tube-view" data-warp-view="tube" hidden>' +
        '<div class="bcm-warp-tube-hud"><div class="bcm-warp-kicker">SUBSPACE TUNNEL</div><h2 data-tube-title>WARP IN PROGRESS</h2><div class="bcm-warp-tube-meta" data-tube-meta></div><div class="bcm-warp-shield"><span data-tube-shield></span></div><div class="bcm-warp-tube-help" data-tube-help>Управление: WASD / стрелки / свайп. Избегайте преград в тоннеле. Длина этапа около 24 секунд.</div></div>' +
        '<div class="bcm-warp-touch-controls"><button type="button" data-warp-control="left">◀</button><div><button type="button" data-warp-control="up">▲</button><button type="button" data-warp-control="down">▼</button></div><button type="button" data-warp-control="right">▶</button></div>' +
        '<div class="bcm-warp-result" data-tube-result hidden><h2 data-tube-result-title></h2><p data-tube-result-text></p><div class="bcm-warp-actions"><button type="button" data-tube-retry>ПОВТОРИТЬ WARP</button><button type="button" data-tube-abort class="bcm-warp-secondary">ВЕРНУТЬСЯ</button></div></div>' +
      '</section>';
    root.appendChild(overlay);

    const backdrop = overlay.querySelector(".bcm-warp-backdrop");
    const ctx = backdrop.getContext("2d", { alpha: false });
    const mapView = overlay.querySelector('[data-warp-view="map"]');
    const tubeView = overlay.querySelector('[data-warp-view="tube"]');
    const closeButton = overlay.querySelector("[data-warp-close]");
    const cancelButton = overlay.querySelector("[data-warp-cancel]");
    const startButton = overlay.querySelector("[data-warp-start]");
    const listElement = overlay.querySelector("[data-warp-sectors]");
    const gridElement = overlay.querySelector("[data-warp-grid]");
    const currentElement = overlay.querySelector("[data-warp-current]");
    const sourceElement = overlay.querySelector("[data-warp-source]");
    const selectedElement = overlay.querySelector("[data-warp-selected]");
    const footnoteElement = overlay.querySelector("[data-warp-footnote]");
    const manualForm = overlay.querySelector("[data-warp-manual]");
    const tubeTitle = overlay.querySelector("[data-tube-title]");
    const tubeMeta = overlay.querySelector("[data-tube-meta]");
    const tubeShield = overlay.querySelector("[data-tube-shield]");
    const tubeResult = overlay.querySelector("[data-tube-result]");
    const tubeResultTitle = overlay.querySelector("[data-tube-result-title]");
    const tubeResultText = overlay.querySelector("[data-tube-result-text]");
    const tubeRetry = overlay.querySelector("[data-tube-retry]");
    const tubeAbort = overlay.querySelector("[data-tube-abort]");
    const touchControls = overlay.querySelector(".bcm-warp-touch-controls");

    function hashSeed(value) {
      let h = 2166136261 >>> 0;
      const s = String(value || "deep-space");
      for (let i = 0; i < s.length; i += 1) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return h >>> 0;
    }

    function randomFrom(seed) {
      let value = seed >>> 0;
      return function () {
        value += 0x6D2B79F5;
        let t = value;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    function parseCoords(value) {
      if (Array.isArray(value) && value.length >= 2) {
        const x = Number(value[0]);
        const y = Number(value[1]);
        if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
      }
      if (value && typeof value === "object") {
        const x = Number(value.x != null ? value.x : value[0]);
        const y = Number(value.y != null ? value.y : value[1]);
        if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
      }
      return null;
    }

    function normalizeSector(value, index) {
      if (value == null) return null;
      if (typeof value === "string" || typeof value === "number") {
        return { id: String(value), name: "Сектор " + value, x: null, y: null, raw: value };
      }
      const coords = parseCoords(value.coordinates || value.coords || value.sectorCoordinates || value.subCoordinates || value);
      const xVal = value.x != null ? Number(value.x) : coords ? coords.x : NaN;
      const yVal = value.y != null ? Number(value.y) : coords ? coords.y : NaN;
      const id = String(value.id || value.pubkey || value.publicKey || value.address || value.key || (Number.isFinite(xVal) && Number.isFinite(yVal) ? xVal + "," + yVal : "sector-" + index));
      return {
        id,
        name: String(value.name || value.sectorName || value.label || (Number.isFinite(xVal) && Number.isFinite(yVal) ? "[" + xVal + ", " + yVal + "]" : "Сектор " + (index + 1))),
        x: Number.isFinite(xVal) ? xVal : null,
        y: Number.isFinite(yVal) ? yVal : null,
        raw: value
      };
    }

    function readNavigation() {
      const galia = window.GALIA_PLAY_STATE || {};
      const nav = window.BCM_SAGE_NAVIGATION || window.GALIA_SAGE_NAVIGATION || galia.sageNavigation || galia.navigation || null;
      if (nav && typeof nav === "object") {
        const currentRaw = nav.currentSector || nav.current || nav.sector || nav.current_sector || null;
        const current = normalizeSector(currentRaw, 0);
        if (current) {
          let list = nav.connectedSectors || nav.neighbors || (currentRaw && (currentRaw.connections || currentRaw.neighbors)) || null;
          if (Array.isArray(nav.sectors) && Array.isArray(nav.connections) && nav.connections.length) {
            const ids = new Set(nav.connections.map((item) => String(typeof item === "object" ? (item.id || item.pubkey || item.publicKey || item.connectionSector || item.connection_sector || item.sector || item.key || "") : item)));
            const matched = nav.sectors.filter((item) => {
              const sector = normalizeSector(item, 0);
              return sector && ids.has(sector.id);
            });
            if (matched.length) list = matched;
            else if (!Array.isArray(list)) list = nav.connections;
          }
          if (!Array.isArray(list)) list = Array.isArray(nav.sectors) ? nav.sectors : (Array.isArray(nav.connections) ? nav.connections : []);
          const targets = [];
          list.forEach((item, index) => {
            const sector = normalizeSector(item, index + 1);
            if (sector && sector.id !== current.id && !targets.some((row) => row.id === sector.id)) targets.push(sector);
          });
          const hasCoords = current.x != null && current.y != null;
          return {
            current,
            targets,
            live: true,
            label: String(nav.source || nav.provider || "SAGE NAVIGATION ADAPTER"),
            coordsKnown: hasCoords
          };
        }
      }

      // The prototype starts at the known ONI CSS position on the NEUNO sector grid.
      // Only the four adjacent cells are generated locally; no galaxy-wide coordinates are loaded.
      const current = { id: "oni-css-neuno--40-30", name: "ONI CSS · NEUNO", x: -40, y: 30, raw: null };
      const offsets = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      return {
        current,
        targets: offsets.map((pair) => {
          const x = current.x + pair[0];
          const y = current.y + pair[1];
          return {
            id: "local-test-" + x + "-" + y,
            name: "TEST NEIGHBOR [" + x + ", " + y + "]",
            x, y, raw: null
          };
        }),
        live: false,
        localPreview: true,
        label: "LOCAL TEST · ONI CSS / NEUNO · START X -40, Y 30 · NEIGHBOR CELLS ARE TEST ONLY",
        coordsKnown: true
      };
    }

    function sectorText(sector) {
      if (!sector) return "—";
      if (sector.x != null && sector.y != null) return sector.name + " · X " + sector.x + " / Y " + sector.y;
      return sector.name + " · " + sector.id;
    }

    function listSectorTargets() {
      listElement.replaceChildren();
      const nodes = state.nav.targets || [];
      nodes.forEach((sector, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "bcm-warp-sector";
        button.dataset.sectorId = sector.id;
        button.innerHTML = '<span class="bcm-warp-sector-dot"></span><span class="bcm-warp-sector-copy"><strong></strong><small></small></span><span class="bcm-warp-sector-arrow">↗</span>';
        button.querySelector("strong").textContent = sector.name;
        button.querySelector("small").textContent = sector.x != null && sector.y != null ? "X " + sector.x + " · Y " + sector.y : "Sector key " + sector.id.slice(0, 16);
        button.addEventListener("click", () => selectTarget(sector));
        listElement.appendChild(button);
      });
      if (!nodes.length) {
        const note = document.createElement("p");
        note.className = "bcm-warp-no-sectors";
        note.textContent = "Адаптер не передал соседние секторы. Введите тестовые координаты ниже.";
        listElement.appendChild(note);
      }
    }

    function renderSectorGrid() {
      gridElement.replaceChildren();
      if (!state.nav || !state.nav.current || state.nav.current.x == null || state.nav.current.y == null) {
        gridElement.hidden = true;
        return;
      }
      const current = state.nav.current;
      const targets = state.nav.targets || [];
      const localTargets = targets.filter((sector) =>
        sector.x != null && sector.y != null &&
        Math.abs(sector.x - current.x) <= 1 && Math.abs(sector.y - current.y) <= 1 &&
        !(sector.x === current.x && sector.y === current.y)
      );
      if (!state.nav.localPreview && !localTargets.length) {
        gridElement.hidden = true;
        return;
      }
      gridElement.hidden = false;
      for (let row = 0; row < 3; row += 1) {
        for (let col = 0; col < 3; col += 1) {
          const dx = col - 1;
          const dy = 1 - row;
          const x = current.x + dx;
          const y = current.y + dy;
          const isCurrent = dx === 0 && dy === 0;
          const target = isCurrent ? null : targets.find((sector) => sector.x === x && sector.y === y);
          const cell = document.createElement(target ? "button" : "div");
          if (target) {
            cell.type = "button";
            cell.dataset.sectorId = target.id;
            cell.addEventListener("click", () => selectTarget(target));
          }
          cell.className = "bcm-warp-grid-cell" +
            (isCurrent ? " is-current" : target ? " is-connected" : " is-unavailable") +
            (target && state.target && target.id === state.target.id ? " is-selected" : "");
          const title = document.createElement("strong");
          title.textContent = isCurrent ? "ONI CSS" : target ? "WARP →" : "—";
          const sub = document.createElement("small");
          sub.textContent = isCurrent ? "NEUNO · CURRENT" : "[" + x + ", " + y + "]";
          cell.appendChild(title);
          cell.appendChild(sub);
          gridElement.appendChild(cell);
        }
      }
    }

    function selectTarget(sector) {
      state.target = sector;
      listElement.querySelectorAll(".bcm-warp-sector").forEach((button) => {
        button.classList.toggle("is-selected", button.dataset.sectorId === sector.id);
      });
      gridElement.querySelectorAll(".bcm-warp-grid-cell[data-sector-id]").forEach((button) => {
        button.classList.toggle("is-selected", button.dataset.sectorId === sector.id);
      });
      selectedElement.textContent = "DESTINATION · " + sectorText(sector);
      startButton.disabled = false;
    }

    function openMap() {
      if (!root.classList.contains("game-active") || root.classList.contains("bcm-warp-maze-active")) return;
      const engine = api();
      if (!engine || !engine.getRuntime || !engine.getRuntime().running) {
        const s = root.querySelector(".bcm-mini-sim-status");
        if (s) s.textContent = "WARP · Сначала запустите симуляцию.";
        return;
      }
      pauseLevelOst();
      state.nav = readNavigation();
      state.target = null;
      state.mode = "map";
      state.openedAt = performance.now();
      state.elapsed = 0;
      state.savedPosition = engine.getRuntime().ship.position.clone();
      state.savedQuaternion = engine.getRuntime().ship.quaternion.clone();
      engine.pauseForWarp(true);
      if (document.exitPointerLock) document.exitPointerLock();
      currentElement.textContent = "CURRENT · " + sectorText(state.nav.current);
      sourceElement.textContent = state.nav.label;
      sourceElement.classList.toggle("is-preview", !state.nav.live);
      footnoteElement.textContent = state.nav.live
        ? "Маршрут показывает данные, переданные внешним SAGE-адаптером. Сам Warp — локальная мини-игра и не запускает перемещение в SAGE."
        : "Стартовая точка ONI CSS · NEUNO: X -40, Y 30. Соседние клетки сгенерированы только для теста. Warp/Tube/лабиринт не меняют состояние Star Atlas.";
      listSectorTargets();
      renderSectorGrid();
      selectedElement.textContent = "DESTINATION NOT SELECTED";
      startButton.disabled = true;
      mapView.hidden = false;
      tubeView.hidden = true;
      tubeResult.hidden = true;
      touchControls.hidden = true;
      overlay.hidden = false;
      root.classList.add("bcm-warp-open");
      launchButton.classList.add("is-active");
      resizeBackdrop();
      startBackdropLoop();
    }

    function closeOverlay(restoreMain) {
      stopWarpAudio();
      overlay.hidden = true;
      root.classList.remove("bcm-warp-open");
      launchButton.classList.remove("is-active");
      state.mode = "closed";
      state.pointerDown = false;
      if (state.maze && state.maze.active) return;
      resumeLevelOst();
      const engine = api();
      if (engine) {
        engine.pauseForWarp(false);
        engine.clearExternalHUD();
        if (restoreMain && state.savedPosition && state.savedQuaternion) {
          engine.teleport(state.savedPosition, state.savedQuaternion);
        }
      }
    }

    function showTube() {
      if (!state.target) return;
      startWarpAudio();
      const engine = api();
      if (!engine || !engine.getRuntime || !engine.getRuntime().scene) return;
      state.mode = "tube";
      state.elapsed = 0;
      state.startedAt = performance.now();
      state.shields = 100;
      state.playerX = 0;
      state.playerY = 0;
      state.statusText = "";
      state.touch.left = state.touch.right = state.touch.up = state.touch.down = false;
      const rng = randomFrom(hashSeed(state.nav.current.id + ">" + state.target.id + ":" + state.target.x + ":" + state.target.y));
      state.layers = [];
      // Stagger a small number of obstacle gates over the full Warp run.
      for (let i = 0; i < 8; i += 1) {
        const safe = Math.floor(rng() * 9);
        const blockers = [];
        for (let lane = 0; lane < 9; lane += 1) {
          if (lane !== safe && rng() < 0.62) blockers.push({ x: (lane % 3) - 1, y: Math.floor(lane / 3) - 1 });
        }
        state.layers.push({ phase: (i / 11 + rng() * 0.035) % 1, blockers, hitCycle: -1 });
      }
      tubeTitle.textContent = "WARP IN PROGRESS";
      tubeResult.hidden = true;
      touchControls.hidden = false;
      tubeView.hidden = false;
      mapView.hidden = true;
      overlay.classList.add("is-tubing");
      resizeBackdrop();
      startBackdropLoop();
    }

    function finishTube(success) {
      if (state.mode !== "tube") return;
      // Keep the Warp OST running through the successful arrival transition.
      // On a failed run it stops immediately; regular OST resumes only when Warp closes.
      if (!success) stopWarpAudio();
      state.mode = "result";
      touchControls.hidden = true;
      tubeResult.hidden = false;
      overlay.classList.remove("is-tubing");
      tubeTitle.textContent = success ? "WARP STABLE" : "WARP DISTURBED";
      tubeResultTitle.textContent = success ? "Переход завершён" : "Защита туннеля перегружена";
      tubeResultText.textContent = success
        ? "Координаты " + sectorText(state.target) + " подтверждены для локальной симуляции. Следующий этап — астероидный комплекс."
        : "Пилот получил слишком много попаданий. Повторите короткий участок Warp или отмените переход.";
      tubeRetry.hidden = success;
      tubeAbort.textContent = success ? "ОТМЕНА" : "ОТМЕНИТЬ";
      if (success) {
        tubeResult.hidden = true;
        window.setTimeout(() => {
          if (state.mode === "result") enterAsteroidMaze();
        }, 420);
      }
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
      texture.generateMipmaps = true;
      if (THREE.sRGBEncoding !== undefined) texture.encoding = THREE.sRGBEncoding;
      return texture;
    }

    function enterAsteroidMaze() {
      stopWarpAudio();
      resumeLevelOst();
      const engine = api();
      if (!engine || !engine.getRuntime) return;
      const runtime = engine.getRuntime();
      const THREE = runtime.THREE;
      const scene = runtime.scene;
      if (!THREE || !scene || !runtime.ship) return;

      const NX = 7, NY = 3, NZ = 7, CELL = 5.4, WALL = 0.46;
      // Keep the test maze off-axis and away from the old negative-Z texture-preload trigger.
      const center = new THREE.Vector3(230, 0, 150);
      const seed = hashSeed(state.nav.current.id + "->" + state.target.id + ":" + state.target.x + ":" + state.target.y);
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
      function addWall(x, y, z, sx, sy, sz) {
        walls.push({ x, y, z, sx, sy, sz });
      }
      cells.forEach((cell) => {
        const x = cellX(cell.x), y = cellY(cell.y), z = cellZ(cell.z);
        if (cell.x === 0) addWall(x - CELL / 2, y, z, WALL, CELL, CELL);
        if (cell.x === NX - 1) addWall(x + CELL / 2, y, z, WALL, CELL, CELL);
        else if (!cell.open.xp) addWall(x + CELL / 2, y, z, WALL, CELL, CELL);
        if (cell.y === 0) addWall(x, y - CELL / 2, z, CELL, WALL, CELL);
        if (cell.y === NY - 1) addWall(x, y + CELL / 2, z, CELL, WALL, CELL);
        else if (!cell.open.yp) addWall(x, y + CELL / 2, z, CELL, WALL, CELL);
        if (cell.z === 0) {
          // Leave one clean entrance into the first central cell.
          if (!(cell.x === 0 && cell.y === 1)) addWall(x, y, z + CELL / 2, CELL, CELL, WALL);
        } else if (!cell.open.zn) {
          addWall(x, y, z + CELL / 2, CELL, CELL, WALL);
        }
        if (cell.z === NZ - 1) {
          // Far exit is opened only at the last cell. Internal Z-planes are emitted once
          // from the adjacent cell's positive face, avoiding overlapping double walls.
          if (!(cell.x === NX - 1 && cell.y === 1)) addWall(x, y, z - CELL / 2, CELL, CELL, WALL);
        }
      });

      const texture = makeMazeTexture(THREE);
      const material = new THREE.MeshStandardMaterial({
        map: texture, color: 0xa9bec8, roughness: 0.82, metalness: 0.24, emissive: 0x07121a
      });
      const unit = new THREE.BoxGeometry(1, 1, 1);
      const wallMesh = new THREE.InstancedMesh(unit, material, walls.length);
      wallMesh.name = "asteroid-maze-wall-panels";
      wallMesh.frustumCulled = false;
      const matrix = new THREE.Matrix4();
      const rotation = new THREE.Quaternion();
      walls.forEach((wall, i) => {
        matrix.compose(
          new THREE.Vector3(wall.x, wall.y, wall.z),
          rotation,
          new THREE.Vector3(wall.sx, wall.sy, wall.sz)
        );
        wallMesh.setMatrixAt(i, matrix);
      });
      wallMesh.instanceMatrix.needsUpdate = true;
      group.add(wallMesh);

      const shell = new THREE.Mesh(
        new THREE.SphereGeometry(31, 18, 14),
        new THREE.MeshBasicMaterial({ color: 0x254050, transparent: true, opacity: 0.11, side: THREE.BackSide, depthWrite: false })
      );
      shell.name = "asteroid-inner-shell";
      shell.position.copy(center);
      group.add(shell);

      const crystalMaterial = new THREE.MeshBasicMaterial({ color: 0x52f0dc });
      const crystalGeometry = new THREE.OctahedronGeometry(0.54, 0);
      const beaconMaterial = new THREE.MeshBasicMaterial({ color: 0xdbc17a });
      const beaconGeometry = new THREE.TorusGeometry(1.1, 0.12, 6, 20);
      const startNode = at(0, 1, 0);
      const exitNode = at(NX - 1, 1, NZ - 1);
      const candidates = cells.filter((cell) => !(cell.x === startNode.x && cell.y === startNode.y && cell.z === startNode.z) &&
        !(cell.x === exitNode.x && cell.y === exitNode.y && cell.z === exitNode.z));
      for (let i = candidates.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        const temp = candidates[i]; candidates[i] = candidates[j]; candidates[j] = temp;
      }
      const crystals = [];
      candidates.slice(0, 3).forEach((cell, index) => {
        const mesh = new THREE.Mesh(crystalGeometry, crystalMaterial);
        mesh.position.copy(cellPosition(cell.x, cell.y, cell.z));
        mesh.position.y += 0.2;
        mesh.name = "core-shard-" + index;
        group.add(mesh);
        crystals.push({ mesh, taken: false, phase: rng() * Math.PI * 2 });
      });
      const beacon = new THREE.Mesh(beaconGeometry, beaconMaterial);
      beacon.position.copy(cellPosition(exitNode.x, exitNode.y, exitNode.z));
      beacon.rotation.x = Math.PI / 2;
      beacon.name = "return-warp-beacon";
      group.add(beacon);

      scene.add(group);
      const maze = {
        active: true,
        group,
        center,
        cells,
        walls,
        wallMesh,
        shell,
        crystals,
        beacon,
        start: cellPosition(startNode.x, startNode.y, startNode.z),
        exit: cellPosition(exitNode.x, exitNode.y, exitNode.z),
        count: 0,
        sinceStatus: 0,
        texture,
        material,
        geometry: unit,
        crystalGeometry,
        crystalMaterial,
        beaconGeometry,
        beaconMaterial,
        lastPosition: null
      };
      state.maze = maze;
      root.classList.add("bcm-warp-maze-active");
      exitButton.hidden = false;
      overlay.hidden = true;
      root.classList.remove("bcm-warp-open");
      launchButton.classList.remove("is-active");

      // The main physics resumes in this scene. The seeded maze uses one instanced wall mesh
      // and a single 64x64 generated tile texture, so geometry is cheap on older devices.
      // Default Mini-Sim forward is -Z; face inward from the asteroid entrance.
      engine.teleport({ x: maze.start.x, y: maze.start.y, z: maze.start.z, yaw: 0 }, null);
      engine.pauseForWarp(false);
      engine.setExternalHUD("ASTEROID COMPLEX · " + sectorText(state.target), "EXPEDITION · CORE SHARDS 0/3 · FIND THE RETURN BEACON");
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
      if (fromCenter.length() > 29.4) {
        fromCenter.setLength(29.4);
        pos.copy(maze.center).add(fromCenter);
        ship.velocity.multiplyScalar(0.25);
      }

      maze.crystals.forEach((crystal) => {
        if (crystal.taken) return;
        crystal.mesh.rotation.y += Math.min(frame.dt || 0.016, 0.04) * 1.35;
        crystal.mesh.position.y += Math.sin(performance.now() * 0.002 + crystal.phase) * 0.001;
        if (pos.distanceTo(crystal.mesh.position) < 1.55) {
          crystal.taken = true;
          crystal.mesh.visible = false;
          maze.count += 1;
          setMazeStatus("CORE SHARDS " + maze.count + "/3 · " + (maze.count === 3 ? "RETURN BEACON UNLOCKED" : "SEARCH THE CONNECTED CORRIDORS"));
        }
      });
      maze.beacon.rotation.z += Math.min(frame.dt || 0.016, 0.04) * 0.4;
      if (maze.count === 3 && pos.distanceTo(maze.exit) < 3.8) {
        returnToDeepSpace(false);
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
        const message = "EXPEDITION · CORE SHARDS " + maze.count + "/3" + (maze.count === 3 ? " · REACH GOLD RETURN BEACON" : " · FIND 3 SHARDS");
        setMazeStatus(message);
      }
    }

    function setMazeStatus(message) {
      const engine = api();
      if (engine && engine.setExternalHUD) engine.setExternalHUD("ASTEROID COMPLEX · " + sectorText(state.target), message);
    }

    function disposeMaze() {
      const maze = state.maze;
      if (!maze) return;
      maze.active = false;
      if (maze.group && maze.group.parent) maze.group.parent.remove(maze.group);
      try { maze.wallMesh.dispose(); } catch (e) {}
      try { maze.geometry.dispose(); } catch (e) {}
      try { maze.material.dispose(); } catch (e) {}
      try { maze.texture.dispose(); } catch (e) {}
      try { maze.shell.geometry.dispose(); } catch (e) {}
      try { maze.shell.material.dispose(); } catch (e) {}
      try { maze.crystalGeometry.dispose(); } catch (e) {}
      try { maze.crystalMaterial.dispose(); } catch (e) {}
      try { maze.beaconGeometry.dispose(); } catch (e) {}
      try { maze.beaconMaterial.dispose(); } catch (e) {}
      state.maze = null;
    }

    function returnToDeepSpace(force) {
      stopWarpAudio();
      const maze = state.maze;
      if (!maze) return;
      if (!force && maze.count < 3) {
        setMazeStatus("RETURN LOCKED · COLLECT ALL 3 CORE SHARDS");
        return;
      }
      disposeMaze();
      stopWarpAudio();
      resumeLevelOst();
      window.BCMDeepSpaceWarpFrame = null;
      root.classList.remove("bcm-warp-maze-active");
      exitButton.hidden = true;
      const engine = api();
      if (engine) {
        engine.pauseForWarp(false);
        engine.clearExternalHUD();
        if (state.savedPosition && state.savedQuaternion) engine.teleport(state.savedPosition, state.savedQuaternion);
      }
      state.mode = "closed";
      state.savedPosition = null;
      state.savedQuaternion = null;
      const status = root.querySelector(".bcm-mini-sim-status");
      if (status) status.textContent = force
        ? "DEEP SPACE · EXPEDITION ABORTED · NO SAGE STATE CHANGED"
        : "DEEP SPACE · ASTEROID EXPEDITION COMPLETE · LOCAL SIMULATION";
    }

    function resizeBackdrop() {
      const rect = backdrop.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      backdrop.width = Math.floor(width * dpr);
      backdrop.height = Math.floor(height * dpr);
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!state.stars.length) {
        const rng = randomFrom(0x53414745);
        const count = Math.min(150, Math.max(70, Math.floor(width * height / 5500)));
        for (let i = 0; i < count; i += 1) {
          state.stars.push({ x: rng(), y: rng(), z: rng(), size: 0.3 + rng() * 1.1, phase: rng() * Math.PI * 2 });
        }
      }
    }

    function startBackdropLoop() {
      if (state.animationRunning || overlay.hidden || !ctx) return;
      state.animationRunning = true;
      requestAnimationFrame(drawBackdrop);
    }

    function drawTubeTunnel(g, w, h, now) {
      const cx0 = w * 0.5;
      const cy0 = h * 0.43;
      const motion = state.elapsed;
      const ringCount = 18;
      const slices = 16;
      const maxX = Math.min(w * 0.66, h * 1.02);
      const maxY = Math.min(h * 0.72, w * 0.58);

      function point(depth, angle) {
        const bendX = Math.sin(motion * 0.31 + depth * 4.1) * w * 0.055 * depth;
        const bendY = Math.cos(motion * 0.23 + depth * 3.4) * h * 0.028 * depth;
        const twist = motion * 0.25 + depth * 0.53 + Math.sin(depth * 5.7 + motion * 0.19) * 0.075;
        const perspective = 0.018 + depth * 0.94;
        return {
          x: cx0 + bendX + Math.cos(angle + twist) * maxX * perspective,
          y: cy0 + bendY + Math.sin(angle + twist) * maxY * perspective
        };
      }

      // Tube lining: repeated steel panels with 16 visible seams and a curved vanishing point.
      for (let ring = 0; ring < ringCount; ring += 1) {
        const d0 = Math.pow(ring / ringCount, 1.35);
        const d1 = Math.pow((ring + 1) / ringCount, 1.35);
        for (let seg = 0; seg < slices; seg += 1) {
          const a0 = seg / slices * Math.PI * 2;
          const a1 = (seg + 1) / slices * Math.PI * 2;
          const p0 = point(d0, a0), p1 = point(d0, a1);
          const p2 = point(d1, a1), p3 = point(d1, a0);
          g.beginPath();
          g.moveTo(p0.x, p0.y); g.lineTo(p1.x, p1.y);
          g.lineTo(p2.x, p2.y); g.lineTo(p3.x, p3.y); g.closePath();
          const lit = (seg + Math.floor(ring / 2)) % 4;
          g.fillStyle = lit === 0
            ? "rgba(62,95,112," + (0.15 + d1 * 0.22) + ")"
            : lit === 1
              ? "rgba(22,39,51," + (0.26 + d1 * 0.24) + ")"
              : "rgba(12,23,33," + (0.24 + d1 * 0.25) + ")";
          g.fill();
          g.strokeStyle = "rgba(143,194,214," + (0.08 + d1 * 0.28) + ")";
          g.lineWidth = 0.45 + d1 * 1.1;
          g.stroke();
        }
      }

      // Longitudinal ribs and alternating luminous floor rails make motion readable.
      for (let rail = 0; rail < slices; rail += 1) {
        const angle = rail / slices * Math.PI * 2;
        g.beginPath();
        for (let step = 0; step <= 28; step += 1) {
          const p = point(step / 28, angle);
          if (step === 0) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y);
        }
        g.strokeStyle = rail % 4 === 0 ? "rgba(94,224,222,.70)" : "rgba(139,183,205,.25)";
        g.lineWidth = rail % 4 === 0 ? 1.6 : 0.8;
        g.stroke();
      }

      // Bright near-field ring, HUD horizon, and tunnel speed streaks.
      const near = [];
      for (let seg = 0; seg <= slices; seg += 1) near.push(point(1, seg / slices * Math.PI * 2));
      g.beginPath();
      near.forEach((p, index) => index ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y));
      g.closePath();
      g.strokeStyle = "rgba(107,238,232,.75)";
      g.lineWidth = 2.2;
      g.stroke();
      g.beginPath();
      g.ellipse(cx0, cy0, Math.max(6, w * 0.034), Math.max(4, h * 0.03), Math.sin(motion * 0.4) * 0.06, 0, Math.PI * 2);
      g.fillStyle = "rgba(1,4,10,.82)";
      g.fill();
      g.strokeStyle = "rgba(147,217,236,.55)";
      g.lineWidth = 1;
      g.stroke();

      // Obstacles rush out of the vanishing point and grow toward the player.
      const obstacleCenterY = h * 0.715;
      state.layers.forEach((layer) => {
        const phase = (motion * 0.29 + layer.phase) % 1;
        if (phase < 0.12) return;
        const depth = 0.20 + phase * 0.79;
        const size = 5 + Math.pow(depth, 1.6) * Math.min(w, h) * 0.15;
        layer.blockers.forEach((blocker) => {
          const bx = cx0 + blocker.x * w * (0.075 + depth * 0.225);
          const by = obstacleCenterY + blocker.y * h * 0.105;
          g.save();
          g.translate(bx, by);
          g.scale(0.66 + depth * 0.56, 0.72 + depth * 0.42);
          g.fillStyle = "rgba(0,0,0," + (0.25 + depth * 0.35) + ")";
          g.fillRect(-size * 0.54 + 3, -size * 0.54 + 5, size * 1.08, size * 1.08);
          g.fillStyle = "rgba(181,79,57," + (0.50 + depth * 0.32) + ")";
          g.fillRect(-size / 2, -size / 2, size, size);
          g.fillStyle = "rgba(255,181,127," + (0.25 + depth * 0.45) + ")";
          g.fillRect(-size / 2, -size / 2, size, Math.max(2, size * 0.12));
          g.strokeStyle = "rgba(255,228,198,.92)";
          g.lineWidth = 0.8 + depth * 1.1;
          g.strokeRect(-size / 2, -size / 2, size, size);
          g.restore();
        });
      });

      // Pilot craft in the foreground with side wings, cockpit and thruster flare.
      const px = cx0 + state.playerX * w * 0.30;
      const py = h * 0.77 + state.playerY * h * 0.105;
      const bank = Math.max(-0.4, Math.min(0.4, state.playerX * 0.18));
      g.save();
      g.translate(px, py);
      g.rotate(bank);
      const flare = 0.65 + (Math.sin(now * 0.032) + 1) * 0.22;
      g.fillStyle = "rgba(68,211,255," + flare * 0.25 + ")";
      g.beginPath(); g.moveTo(-6, 8); g.lineTo(0, 25 + flare * 9); g.lineTo(6, 8); g.closePath(); g.fill();
      g.fillStyle = "#173d59";
      g.strokeStyle = "#a9e6f6";
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(0, -16); g.lineTo(10, -2); g.lineTo(21, 9); g.lineTo(7, 7);
      g.lineTo(0, 13); g.lineTo(-7, 7); g.lineTo(-21, 9); g.lineTo(-10, -2); g.closePath();
      g.fill(); g.stroke();
      g.fillStyle = "#8de9f2";
      g.beginPath(); g.moveTo(0, -11); g.lineTo(4.5, 2); g.lineTo(0, 5); g.lineTo(-4.5, 2); g.closePath(); g.fill();
      g.fillStyle = "#ffd29a";
      g.fillRect(-14, 6, 4, 2); g.fillRect(10, 6, 4, 2);
      g.restore();

      // Tube progress and damage flash.
      const progress = Math.min(1, motion / WARP_DURATION);
      g.fillStyle = "rgba(255,255,255,.12)";
      g.fillRect(w * 0.20, h - 17, w * 0.60, 3);
      g.fillStyle = "#56f0d0";
      g.fillRect(w * 0.20, h - 17, w * 0.60 * progress, 3);
      if (state.shields < 100) {
        g.fillStyle = "rgba(255,77,66," + ((100 - state.shields) / 100 * 0.11) + ")";
        g.fillRect(0, 0, w, h);
      }
    }

    function drawBackdrop(now) {
      if (overlay.hidden || !ctx) {
        state.animationRunning = false;
        return;
      }
      const w = backdrop.clientWidth || root.clientWidth || 800;
      const h = backdrop.clientHeight || root.clientHeight || 500;
      const dt = state.lastFrame ? Math.min((now - state.lastFrame) / 1000, 0.04) : 0.016;
      state.lastFrame = now;
      ctx.fillStyle = "#02050b";
      ctx.fillRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2;
      state.stars.forEach((star) => {
        if (state.mode === "tube") {
          star.z += dt * (0.10 + star.size * 0.04);
          if (star.z > 1) {
            star.z = 0;
            star.x = Math.random();
            star.y = Math.random();
          }
          const sx = cx + (star.x - 0.5) * w * (0.12 + star.z * 1.55);
          const sy = cy + (star.y - 0.5) * h * (0.12 + star.z * 1.55);
          const length = 2 + star.z * 22;
          ctx.strokeStyle = "rgba(222,240,255," + (0.25 + star.z * 0.65) + ")";
          ctx.lineWidth = star.size;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + (sx - cx) * length / Math.max(1, w), sy + (sy - cy) * length / Math.max(1, h));
          ctx.stroke();
        } else {
          star.phase += dt * 0.1;
          ctx.fillStyle = "rgba(225,239,255," + (0.35 + Math.sin(star.phase) * 0.15) + ")";
          ctx.fillRect(star.x * w, star.y * h, star.size, star.size);
        }
      });

      if (state.mode === "map") {
        const nav = state.nav;
        if (nav) {
          const nodes = [nav.current].concat(nav.targets || []);
          const maxDelta = Math.max(1, ...nodes.map((n) => Math.max(Math.abs((n.x == null ? 0 : n.x) - (nav.current.x || 0)), Math.abs((n.y == null ? 0 : n.y) - (nav.current.y || 0)))));
          const reveal = Math.min(1, Math.max(0, (now - state.openedAt) / 650));
          const easedReveal = reveal * reveal * (3 - 2 * reveal);
          const scale = (Math.min(w, h) * 0.27 / maxDelta) * (0.20 + 0.80 * easedReveal);
          const positions = nodes.map((node, index) => {
            const angle = ((index - 1) / Math.max(1, nodes.length - 1)) * Math.PI * 2;
            const dx = node.x == null ? (index === 0 ? 0 : Math.cos(angle) * 1.5) : node.x - (nav.current.x || 0);
            const dy = node.y == null ? (index === 0 ? 0 : Math.sin(angle) * 1.5) : node.y - (nav.current.y || 0);
            return { node, x: cx + dx * scale, y: cy - dy * scale };
          });
          ctx.strokeStyle = "rgba(100,169,201,.30)";
          ctx.lineWidth = 1;
          positions.slice(1).forEach((p) => {
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(p.x, p.y); ctx.stroke();
          });
          positions.forEach((p, i) => {
            const isCurrent = i === 0;
            const isSelected = state.target && state.target.id === p.node.id;
            ctx.beginPath();
            ctx.arc(p.x, p.y, isCurrent ? 7 : isSelected ? 6 : 3.5, 0, Math.PI * 2);
            ctx.fillStyle = isCurrent ? "#f2f6ff" : isSelected ? "#56f0d0" : "#8bb8d0";
            ctx.fill();
            if (isCurrent || isSelected) {
              ctx.beginPath();
              ctx.arc(p.x, p.y, isCurrent ? 15 : 12, 0, Math.PI * 2);
              ctx.strokeStyle = isCurrent ? "rgba(242,246,255,.55)" : "rgba(86,240,208,.55)";
              ctx.stroke();
            }
          });
          const pulse = 0.96 + Math.sin(now * 0.00045) * 0.035;
          ctx.strokeStyle = "rgba(130,186,220,.10)";
          ctx.beginPath(); ctx.arc(cx, cy, Math.min(w, h) * 0.40 * pulse, 0, Math.PI * 2); ctx.stroke();
        }
      } else if (state.mode === "tube" || state.mode === "result") {
        if (state.mode === "tube") updateTube(dt, now);
        drawTubeTunnel(ctx, w, h, now);
      }

      if (!overlay.hidden) requestAnimationFrame(drawBackdrop);
      else state.animationRunning = false;
    }

    function updateTube(dt, now) {
      state.elapsed = Math.max(0, (now - state.startedAt) / 1000);
      const steer = (state.keys.ArrowRight || state.keys.KeyD || state.touch.right ? 1 : 0) -
        (state.keys.ArrowLeft || state.keys.KeyA || state.touch.left ? 1 : 0);
      const lift = (state.keys.ArrowDown || state.keys.KeyS || state.touch.down ? 1 : 0) -
        (state.keys.ArrowUp || state.keys.KeyW || state.touch.up ? 1 : 0);
      state.playerX = Math.max(-0.90, Math.min(0.90, state.playerX + steer * dt * 1.45));
      state.playerY = Math.max(-0.72, Math.min(0.72, state.playerY + lift * dt * 1.15));

      state.layers.forEach((layer) => {
        const total = state.elapsed * 0.29 + layer.phase;
        const progress = total % 1;
        const cycle = Math.floor(total);
        if (progress > 0.87 && progress < 0.91 && layer.hitCycle !== cycle) {
          layer.hitCycle = cycle;
          const hit = layer.blockers.some((blocker) => Math.abs(state.playerX - blocker.x * 0.65) < 0.22 && Math.abs(state.playerY - blocker.y * 0.48) < 0.22);
          if (hit) {
            state.shields = Math.max(0, state.shields - 25);
            tubeShield.style.width = state.shields + "%";
            tubeMeta.textContent = "SHIELDS " + state.shields + "% · KEEP CLEAR OF THE RINGS";
            if (state.shields <= 0) {
              finishTube(false);
              return;
            }
          }
        }
      });

      // A longer arcade run gives the pilot time to steer through a real obstacle sequence.
      if (state.elapsed >= WARP_DURATION) finishTube(state.shields > 0);
      tubeMeta.textContent = "SECTOR " + sectorText(state.target) + " · " + Math.max(0, WARP_DURATION - state.elapsed).toFixed(1) + " s";
      tubeShield.style.width = state.shields + "%";
    }

    window.BCMDeepSpaceWarpToggle = function () {
      if (state.mode === "closed") openMap();
    };

    function bindWarpInput() {
      overlay.addEventListener("pointerdown", (event) => {
        if (state.mode !== "tube") return;
        if (event.target.closest(".bcm-warp-touch-controls,button,input,label")) return;
        state.pointerDown = true;
        state.pointerX = event.clientX;
        state.pointerY = event.clientY;
        if (overlay.setPointerCapture) {
          try { overlay.setPointerCapture(event.pointerId); } catch (e) {}
        }
      });
      overlay.addEventListener("pointermove", (event) => {
        if (!state.pointerDown || state.mode !== "tube") return;
        const rect = backdrop.getBoundingClientRect();
        const dx = event.clientX - state.pointerX;
        const dy = event.clientY - state.pointerY;
        state.playerX = Math.max(-0.9, Math.min(0.9, state.playerX + dx / Math.max(1, rect.width) * 2));
        state.playerY = Math.max(-0.72, Math.min(0.72, state.playerY + dy / Math.max(1, rect.height) * 1.5));
        state.pointerX = event.clientX;
        state.pointerY = event.clientY;
      });
      overlay.addEventListener("pointerup", () => { state.pointerDown = false; });
      overlay.addEventListener("pointercancel", () => { state.pointerDown = false; });

      document.addEventListener("keydown", (event) => {
        if (overlay.hidden) return;
        if (event.code === "Escape") {
          event.preventDefault(); event.stopImmediatePropagation();
          closeOverlay(true);
          return;
        }
        if (state.mode === "tube") {
          const allowed = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyA", "KeyD", "KeyW", "KeyS"];
          if (allowed.indexOf(event.code) >= 0) {
            state.keys[event.code] = true;
            event.preventDefault(); event.stopImmediatePropagation();
          }
        }
      }, true);
      document.addEventListener("keyup", (event) => {
        if (overlay.hidden) return;
        state.keys[event.code] = false;
        if (state.mode === "tube") event.stopImmediatePropagation();
      }, true);
      document.querySelectorAll("[data-warp-control]").forEach((button) => {
        const direction = button.dataset.warpControl;
        const down = (event) => {
          event.preventDefault();
          if (state.mode === "tube") state.touch[direction] = true;
        };
        const up = (event) => {
          event.preventDefault();
          state.touch[direction] = false;
        };
        button.addEventListener("pointerdown", down);
        button.addEventListener("pointerup", up);
        button.addEventListener("pointercancel", up);
        button.addEventListener("lostpointercapture", up);
      });
    }

    launchButton.addEventListener("click", openMap);
    closeButton.addEventListener("click", () => closeOverlay(true));
    cancelButton.addEventListener("click", () => closeOverlay(true));
    startButton.addEventListener("click", showTube);
    tubeRetry.addEventListener("click", showTube);
    tubeAbort.addEventListener("click", () => closeOverlay(true));
    exitButton.addEventListener("click", () => returnToDeepSpace(true));
    manualForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const x = Number(manualForm.elements.x.value);
      const y = Number(manualForm.elements.y.value);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const target = {
        id: "manual-test-" + x + "-" + y,
        name: (state.nav.live ? "LOCAL TEST COORDINATE" : "TEST SECTOR") + " [" + x + ", " + y + "]",
        x, y, raw: null
      };
      if (!state.nav.targets.some((sector) => sector.id === target.id)) {
        state.nav.targets.push(target);
        listSectorTargets();
        renderSectorGrid();
      }
      selectTarget(target);
    });
    bindWarpInput();
    window.addEventListener("resize", () => {
      if (!overlay.hidden) resizeBackdrop();
    });

    // In the asteroid maze, keep the main game's requestAnimationFrame loop and WebGL context.
    // The hook is installed only while the maze is active, avoiding idle per-frame work.
    window.BCMDeepSpaceWarpFrame = null;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootWarpModule, { once: true });
  } else {
    bootWarpModule();
  }
})();