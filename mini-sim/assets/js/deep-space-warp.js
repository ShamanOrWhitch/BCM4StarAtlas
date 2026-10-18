(() => {
  "use strict";

  function bootWarpModule() {
    const root = document.querySelector(".bcm-mini-sim");
    if (!root || root.dataset.warpModuleReady === "1") return;
    root.dataset.warpModuleReady = "1";

    const api = () => window.BCMiniSimAPI || null;
    const config = window.BCMMiniSimConfig || {};
    const levelAudio = root.querySelector(".bcm-mini-sim-music-audio");
    const WARP_DURATION = 42;
    // Reduce repeated canvas work on touch devices without changing elapsed-time gameplay.
    const mobileRenderTarget = !!(
      (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) ||
      (navigator.maxTouchPoints > 0 && window.innerWidth < 900)
    );
    const warpFrameInterval = mobileRenderTarget ? 1000 / 30 : 1000 / 60;
    let levelAudioWasPlaying = false;
    const warpAudio = document.createElement("audio");
    warpAudio.preload = "none";
    warpAudio.loop = true;
    warpAudio.volume = 0.72;
    warpAudio.setAttribute("playsinline", "");
    let warpAudioSrcLoaded = false;

    function startWarpAudio(restartSession) {
      if (!config.warpMusicUrl) return;
      try {
        if (!warpAudioSrcLoaded) {
          warpAudio.src = config.warpMusicUrl;
          warpAudio.load();
          warpAudioSrcLoaded = true;
        }
        // Map -> Tube -> asteroid maze is one Warp level; never reset between screens.
        if (restartSession && warpAudio.readyState > 0) {
          try { warpAudio.currentTime = 0; } catch (e) {}
        }
        if (!warpAudio.paused && !warpAudio.ended) return;
        if (window.BCMGameAudio?.register) window.BCMGameAudio.register(warpAudio, "warp");
        warpAudio.muted = !!window.BCMGameAudio?.isMuted?.();
        const playing = window.BCMGameAudio?.playExclusive
          ? window.BCMGameAudio.playExclusive(warpAudio, "warp")
          : warpAudio.play();
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
        const resumed = window.BCMGameAudio?.playExclusive
          ? window.BCMGameAudio.playExclusive(levelAudio, "starbase")
          : levelAudio.play();
        if (resumed && typeof resumed.catch === "function") resumed.catch(() => {});
      } catch (e) {}
    }

    window.addEventListener("bcm:game-music-mute", (event) => {
      warpAudio.muted = !!event.detail?.muted;
    });

    const state = {
      mode: "closed",
      openedAt: 0,
      nav: null,
      target: null,
      savedPosition: null,
      savedQuaternion: null,
      savedSpeedMode: null,
      sectorProgressed: false,
      elapsed: 0,
      tubeTravel: 0,
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
      touch: { left: false, right: false, up: false, down: false },
      tilt: { enabled: false, bound: false, permissionGranted: false, available: false, filterReady: false, filtered: 0, neutral: 0, calibrating: false, samples: 0, sum: 0, value: 0 }
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
    exitButton.textContent = "RETURN TO WARP MAP";
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
        '<div class="bcm-warp-tube-hud"><div class="bcm-warp-kicker">SUBSPACE TUNNEL</div><h2 data-tube-title>WARP IN PROGRESS</h2><div class="bcm-warp-tube-meta" data-tube-meta></div><div class="bcm-warp-shield"><span data-tube-shield></span></div><div class="bcm-warp-tube-help" data-tube-help>Влево и вправо двигают корабль по кольцу. Препятствие остаётся на своём кольце и не растягивается.</div></div>' +
        '<div class="bcm-warp-touch-controls"><button type="button" data-warp-control="left" aria-label="Рулить влево">◀</button><button type="button" data-warp-control="tilt" aria-label="Включить или откалибровать управление наклоном">↻ TILT</button><button type="button" data-warp-control="right" aria-label="Рулить вправо">▶</button></div>' +
        '<div class="bcm-warp-result" data-tube-result hidden><h2 data-tube-result-title></h2><p data-tube-result-text></p><div class="bcm-warp-actions"><button type="button" data-tube-continue hidden>ПРОДОЛЖИТЬ</button><button type="button" data-tube-retry>ПОВТОРИТЬ WARP</button><button type="button" data-tube-abort class="bcm-warp-secondary">ОТМЕНА</button></div></div>' +
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
    const tubeContinue = overlay.querySelector("[data-tube-continue]");
    const tubeAbort = overlay.querySelector("[data-tube-abort]");
    const touchControls = overlay.querySelector(".bcm-warp-touch-controls");
    const tiltButton = overlay.querySelector('[data-warp-control="tilt"]');

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
      // After a local sector arrival, keep that session's current sector when
      // the player closes and reopens the Warp menu. The global adapter often
      // still points to the original ONI CSS launch point.
      if (state.sectorProgressed && state.nav) return state.nav;
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
            adapter: nav,
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
        adapter: null,
        label: "LOCAL TEST · ONI CSS / NEUNO · START X -40, Y 30 · NEIGHBOR CELLS ARE TEST ONLY",
        coordsKnown: true
      };
    }

    function navigationAfterArrival(sector) {
      const previous = state.nav || readNavigation();
      const current = normalizeSector(sector, 0) || sector;
      const raw = current && current.raw && typeof current.raw === "object" ? current.raw : {};
      const adapter = previous.adapter || null;
      const isManualTest = !!current && /^manual-test-/.test(String(current.id || ""));
      const isLocalTest = !!current && (/^local-test-/.test(String(current.id || "")) || isManualTest || !current.raw);

      const makeLocalTargets = (origin) => {
        if (!origin || origin.x == null || origin.y == null) return [];
        return [[-1, 0], [1, 0], [0, -1], [0, 1]].map((offset) => {
          const x = Number(origin.x) + offset[0];
          const y = Number(origin.y) + offset[1];
          return {
            id: "local-test-" + x + "-" + y,
            name: "TEST NEIGHBOR [" + x + ", " + y + "]",
            x, y, raw: null
          };
        });
      };

      // A generated preview can continue for interaction testing, but it remains
      // explicitly test-only and never becomes live SAGE navigation.
      if (previous.localPreview || isLocalTest) {
        return {
          current,
          targets: makeLocalTargets(current),
          live: false,
          localPreview: true,
          adapter: null,
          label: isManualTest
            ? "LOCAL TEST COORDINATE · NOT A LIVE SAGE SECTOR"
            : (previous.label || "LOCAL TEST · SAGE DATA UNAVAILABLE"),
          coordsKnown: current.x != null && current.y != null
        };
      }

      let list = null;
      const neighborKeys = ["connectedSectors", "connected_sectors", "neighbors", "connections", "connected"];
      for (const key of neighborKeys) {
        if (Array.isArray(raw[key])) {
          list = raw[key];
          break;
        }
      }
      if (!Array.isArray(list) && adapter) {
        const lookup = adapter.getNeighbors || adapter.getNeighborsForSector || adapter.neighborsForSector;
        if (typeof lookup === "function") {
          try {
            const candidate = lookup.call(adapter, current.raw || current);
            if (Array.isArray(candidate)) list = candidate;
          } catch (e) {}
        }
      }

      // Resolve references against a full adapter sector list when available.
      // If no neighbors were supplied for this sector, do not reuse the previous
      // sector's links and do not invent live connections.
      const references = Array.isArray(list) ? list : [];
      const refId = (item) => {
        if (item == null) return "";
        if (typeof item !== "object") return String(item);
        return String(item.id || item.pubkey || item.publicKey || item.address ||
          item.key || item.connectionSector || item.connection_sector ||
          item.connectedSector || item.connected_sector || item.sector || "");
      };
      const ids = new Set(references.map(refId).filter(Boolean));
      const candidates = adapter && Array.isArray(adapter.sectors) && adapter.sectors.length
        ? adapter.sectors
        : references;
      const targets = candidates.map((item, index) => {
        const id = refId(item);
        const known = id && adapter && Array.isArray(adapter.sectors)
          ? adapter.sectors.find((row) => {
              const normalized = normalizeSector(row, 0);
              return normalized && normalized.id === id;
            })
          : null;
        return normalizeSector(known || item, index + 1);
      }).filter((candidate) =>
        candidate &&
        candidate.id !== current.id &&
        (ids.has(candidate.id) || references.some((item) => item === candidate.raw))
      );

      return {
        current,
        targets: targets.filter((candidate, index, rows) =>
          rows.findIndex((row) => row.id === candidate.id) === index
        ),
        live: !!previous.live,
        localPreview: false,
        adapter,
        label: previous.label || "SAGE NAVIGATION ADAPTER",
        coordsKnown: current.x != null && current.y != null
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
          title.textContent = isCurrent ? (current.name || "CURRENT SECTOR") : target ? "WARP →" : "—";
          const sub = document.createElement("small");
          sub.textContent = isCurrent
            ? (current.x != null && current.y != null ? "X " + current.x + " · Y " + current.y + " · CURRENT" : "CURRENT SECTOR")
            : "[" + x + ", " + y + "]";
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
      startWarpAudio(true);
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
      overlay.classList.remove("is-tubing");
      state.tilt.value = 0;
      root.classList.remove("bcm-warp-open", "is-tubing");
      launchButton.classList.remove("is-active");
      state.mode = "closed";
      state.pointerDown = false;
      if (state.maze && state.maze.active) return;
      resumeLevelOst();
      state.layers = [];
      state.target = null;
      window.BCMDeepSpaceWarpFrame = null;
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
      const engine = api();
      if (!engine || !engine.getRuntime || !engine.getRuntime().scene) return;
      state.mode = "tube";
      state.elapsed = 0;
      state.tubeTravel = 0;
      state.startedAt = performance.now();
      state.shields = 100;
      // X/Y are the pilot's position on the tube cross-section, held at a
      // stable radius so input moves around the wall, sides and ceiling.
      state.playerX = 0;
      state.playerY = 0;
      state.playerAngle = Math.PI / 2;
      state.steerBank = 0;
      state.tubeRoll = 0;
      state.tilt.value = 0;
      state.tilt.enabled = false;
      state.tilt.calibrating = false;
      tiltButton?.classList.remove("active");
      state.tubeBoostUntil = 0;
      state.statusText = "";
      state.touch.left = state.touch.right = state.touch.up = state.touch.down = false;
      const rng = randomFrom(hashSeed(state.nav.current.id + ">" + state.target.id + ":" + state.target.x + ":" + state.target.y));
      state.layers = [];
      const gateCount = 15;
      for (let i = 0; i < gateCount; i += 1) {
        const type = i % 7 === 2 ? "spikes" : (i % 7 === 4 ? "sweeper" : (i % 7 === 5 ? "boost" : (i % 7 === 6 ? "launcher" : "gate")));
        const safeAngle = rng() * Math.PI * 2 - Math.PI;
        const blockedAngles = [];
        const spikeCount = type === "spikes" ? 3 : 0;
        for (let n = 0; n < spikeCount; n += 1) {
          let angle = rng() * Math.PI * 2 - Math.PI;
          if (Math.abs(Math.atan2(Math.sin(angle - safeAngle), Math.cos(angle - safeAngle))) < 0.92) {
            angle = safeAngle + (n % 2 ? 1 : -1) * (1.15 + rng() * 0.65);
          }
          blockedAngles.push(Math.atan2(Math.sin(angle), Math.cos(angle)));
        }
        const progress = 0.15 + (i / Math.max(1, gateCount - 1)) * 0.72 + (rng() - 0.5) * 0.006;
        state.layers.push({
          progress,
          type,
          safeAngle,
          gapHalf: type === "gate" ? 0.76 : 0.86,
          blockedAngles,
          sweepAngle: rng() * Math.PI * 2 - Math.PI,
          sweepSpeed: (rng() < 0.5 ? -1 : 1) * (0.55 + rng() * 0.38),
          obstacleWidth: type === "sweeper" ? 0.20 : 0.15,
          resolved: false
        });
      }
      tubeTitle.textContent = "WARP IN PROGRESS";
      tubeResult.hidden = true;
      touchControls.hidden = false;
      tubeView.hidden = false;
      mapView.hidden = true;
      overlay.classList.add("is-tubing");
      if (mobileRenderTarget) enableWarpTilt(true);
      resizeBackdrop();
      startBackdropLoop();
    }

    function finishTube(success) {
      if (state.mode !== "tube") return;
      // Keep the same Warp OST running through retries, arrival and the asteroid maze.
      state.mode = "result";
      touchControls.hidden = true;
      tubeResult.hidden = false;
      overlay.classList.remove("is-tubing");
      tubeTitle.textContent = success ? "WARP STABLE" : "WARP DISTURBED";
      tubeResultTitle.textContent = success ? "Переход завершён" : "Защита туннеля перегружена";
      tubeResultText.textContent = success
        ? "Координаты " + sectorText(state.target) + " подтверждены. «Продолжить» ведёт дальше. «Отмена» оставляет корабль там, откуда открыт Warp."
        : "Пилот получил слишком много попаданий. Повторите короткий участок или отмените переход — корабль останется на прежнем месте.";
      tubeRetry.hidden = success;
      tubeContinue.hidden = !success;
      tubeAbort.textContent = "ОТМЕНА";
    }

    function isOniCssDestination(sector) {
      return !!sector && Number(sector.x) === -40 && Number(sector.y) === 30;
    }

    function confirmTubeArrival() {
      if (state.mode !== "result") return;
      if (isOniCssDestination(state.target)) returnToOniCss();
      else enterAsteroidMaze();
    }

    function returnToOniCss() {
      const engine = api();
      const previous = state.nav || readNavigation();
      const adapter = previous && previous.adapter;
      let homeRecord = null;

      if (adapter && Array.isArray(adapter.sectors)) {
        homeRecord = adapter.sectors.find((item) => {
          const candidate = normalizeSector(item, 0);
          return candidate && candidate.x === -40 && candidate.y === 30;
        }) || null;
      }
      if (!homeRecord && state.target && state.target.raw && typeof state.target.raw === "object") {
        const candidate = normalizeSector(state.target.raw, 0);
        if (candidate && candidate.x === -40 && candidate.y === 30) homeRecord = state.target.raw;
      }

      if (homeRecord) {
        state.nav = navigationAfterArrival(homeRecord);
        if (state.nav && state.nav.current) {
          state.nav.current.name = "ONI CSS · NEUNO";
          state.nav.current.x = -40;
          state.nav.current.y = 30;
        }
      } else {
        const home = { id: "oni-css-neuno--40-30", name: "ONI CSS · NEUNO", x: -40, y: 30, raw: null };
        state.nav = {
          current: home,
          targets: [[-1, 0], [1, 0], [0, -1], [0, 1]].map(([dx, dy]) => {
            const x = home.x + dx;
            const y = home.y + dy;
            return { id: "local-test-" + x + "-" + y, name: "TEST NEIGHBOR [" + x + ", " + y + "]", x, y, raw: null };
          }),
          live: false,
          localPreview: true,
          adapter: null,
          label: "LOCAL TEST · RETURNED TO ONI CSS / NEUNO · X -40, Y 30",
          coordsKnown: true
        };
      }
      state.sectorProgressed = true;

      // A destination of ONI CSS is the end of this local Warp trip. Do not
      // launch another asteroid maze; restore the Mini-Sim home pose instead.
      closeOverlay(false);
      if (engine && typeof engine.teleport === "function") {
        engine.teleport({ x: 0, y: 0, z: 2, yaw: 0 }, null);
      }
      const status = root.querySelector(".bcm-mini-sim-status");
      if (status) status.textContent = "ARRIVED · ONI CSS / NEUNO · LOCAL SIMULATION";
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

    function enterAsteroidMaze() {
      // Warp OST owns the whole Warp stage, including the asteroid maze.
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

      // Use every prepared asterwall variant. The files are small, and a full
      // shuffle means the entire asteroid run can display the whole texture family.
      const fallbackTexture = makeMazeTexture(THREE);
      const availableWallAssets = asteroidWallAssetPool();
      for (let i = availableWallAssets.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        [availableWallAssets[i], availableWallAssets[j]] = [availableWallAssets[j], availableWallAssets[i]];
      }
      const chosenWallAssets = availableWallAssets;
      const wallMaterials = [];
      const wallTextures = [];
      if (chosenWallAssets.length) {
        const loader = new THREE.TextureLoader();
        chosenWallAssets.forEach((asset, index) => {
          const texture = loader.load(asset.url, undefined, undefined, () => {
            if (wallMaterials[index]) {
              wallMaterials[index].map = fallbackTexture;
              wallMaterials[index].needsUpdate = true;
            }
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
      const unit = new THREE.BoxGeometry(1, 1, 1);
      const wallBatches = Array.from({ length: wallMaterials.length }, () => []);
      walls.forEach((wall, index) => wallBatches[index % wallBatches.length].push(wall));
      const wallMeshes = wallBatches.map((batch, index) => {
        const wallMesh = new THREE.InstancedMesh(unit, wallMaterials[index], batch.length);
        wallMesh.name = "asteroid-maze-wall-panels-" + index;
        wallMesh.frustumCulled = false;
        const matrix = new THREE.Matrix4();
        const rotation = new THREE.Quaternion();
        batch.forEach((wall, instanceIndex) => {
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
      const wallMesh = wallMeshes[0];
      const material = wallMaterials[0];
      const texture = wallTextures[0];

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
      beacon.scale.set(1.65, 1.65, 1.65);
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
        material,
        materials: wallMaterials,
        geometry: unit,
        crystalGeometry,
        crystalMaterial,
        beaconGeometry,
        beaconMaterial,
        lastPosition: null
      };
      state.savedSpeedMode = engine.getSpeedMode ? engine.getSpeedMode() : 1;
      if (engine.setSpeedMode) engine.setSpeedMode(2);
      state.maze = maze;
      root.classList.add("bcm-warp-maze-active");
      exitButton.hidden = false;
      overlay.hidden = true;
      root.classList.remove("bcm-warp-open");
      launchButton.classList.remove("is-active");

      // The main physics resumes in this scene. The seeded maze uses a small number of
      // instanced wall batches and up to four asterwall textures, with a tiny procedural fallback.
      // Default Mini-Sim forward is -Z; face inward from the asteroid entrance.
      engine.teleport({ x: maze.start.x, y: maze.start.y, z: maze.start.z, yaw: 0 }, null);
      engine.pauseForWarp(false);
      engine.setExternalHUD("ASTEROID COMPLEX · " + sectorText(state.target), "EXPEDITION · CORE SHARDS 0/3 · GOLD RING OPENS THE HULL");
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
          setMazeStatus("CORE SHARDS " + maze.count + "/3 · " + (maze.count === 3 ? "GOLD RING IS OPEN" : "SEARCH THE CONNECTED CORRIDORS"));
        }
      });
      maze.beacon.rotation.z += Math.min(frame.dt || 0.016, 0.04) * 0.4;
      const ringDistance = pos.distanceTo(maze.beacon.position);
      if (!state.hullOpen && ringDistance < 2.6 && window.BCMHullDive && window.BCMHullDive.open) {
        state.hullOpen = true;
        const engine = api();
        if (engine && engine.pauseForWarp) engine.pauseForWarp(true);
        const away = pos.clone().sub(maze.beacon.position);
        if (away.lengthSq() < 0.04) away.set(0, 0.4, 1);
        away.setLength(5.2);
        pos.copy(maze.beacon.position).add(away);
        ship.velocity.set(0, 0, 0);
        window.BCMHullDive.open(function () {
          state.hullOpen = false;
          if (engine && engine.pauseForWarp) engine.pauseForWarp(false);
          setMazeStatus("BACK AT THE RING · FLY IN TO DIVE AGAIN");
        });
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
        const message = "EXPEDITION · CORE SHARDS " + maze.count + "/3 · FLY INTO THE GOLD RING";
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
      for (const mesh of maze.wallMeshes || [maze.wallMesh]) {
        try { mesh?.dispose?.(); } catch (e) {}
      }
      try { maze.geometry.dispose(); } catch (e) {}
      for (const material of new Set(maze.materials || [maze.material])) {
        try { material?.dispose?.(); } catch (e) {}
      }
      for (const texture of new Set(maze.textures || [maze.texture])) {
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

    function returnToWarpMap() {
      const maze = state.maze;
      if (!maze) return;

      const arrivedSector = state.target || (state.nav && state.nav.current);
      disposeMaze();
      window.BCMDeepSpaceWarpFrame = null;
      root.classList.remove("bcm-warp-maze-active", "is-tubing");
      exitButton.hidden = true;

      const engine = api();
      if (arrivedSector) {
        state.nav = navigationAfterArrival(arrivedSector);
        state.sectorProgressed = true;
      }
      state.target = null;

      if (engine) {
        if (state.savedSpeedMode != null && engine.setSpeedMode) {
          engine.setSpeedMode(state.savedSpeedMode);
        }
        state.savedSpeedMode = null;
        engine.clearExternalHUD();
        if (state.savedPosition && state.savedQuaternion) {
          engine.teleport(state.savedPosition, state.savedQuaternion);
        }
        // The map is a paused navigation overlay. Keep Warp OST running without
        // overlapping it with Starbase; closing the map resumes the normal zone.
        engine.pauseForWarp(true);
      }

      overlay.hidden = false;
      root.classList.add("bcm-warp-open");
      launchButton.classList.add("is-active");
      state.mode = "map";
      state.openedAt = performance.now();
      state.elapsed = 0;
      mapView.hidden = false;
      tubeView.hidden = true;
      tubeResult.hidden = true;
      touchControls.hidden = true;
      currentElement.textContent = "CURRENT · " + sectorText(state.nav && state.nav.current);
      sourceElement.textContent = state.nav ? state.nav.label : "SAGE NAVIGATION";
      sourceElement.classList.toggle("is-preview", !state.nav || !state.nav.live);
      footnoteElement.textContent = state.nav && state.nav.live
        ? "Соседние сектора показаны только если их передал SAGE-адаптер. Warp остаётся локальной симуляцией и не перемещает флот в блокчейне."
        : "LOCAL TEST GRID · координаты и соседние клетки тестовые, не данные SAGE. Полная карта и реальные связи секторов ещё не подключены.";
      listSectorTargets();
      renderSectorGrid();
      selectedElement.textContent = "CURRENT SECTOR · " + sectorText(state.nav && state.nav.current) + " · SELECT NEXT DESTINATION";
      startButton.disabled = true;
      resizeBackdrop();
      startBackdropLoop();

      const status = root.querySelector(".bcm-mini-sim-status");
      if (status) status.textContent = "WARP MAP · CURRENT " + sectorText(state.nav && state.nav.current) + " · LOCAL SIMULATION";
    }

    function resizeBackdrop() {
      const rect = backdrop.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, mobileRenderTarget ? 1 : 1.25);
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

    function warpNormalizedTime(elapsed) {
      return Math.max(0, Math.min(1, Number(elapsed || 0) / WARP_DURATION));
    }

    // The visual/collision course accelerates as a single journey: 1x at launch,
    // smoothly reaching 8x by the final second without desynchronizing the gates.
    function warpSpeedMultiplier(elapsed) {
      return Math.pow(8, warpNormalizedTime(elapsed));
    }

    function warpCourseProgress(elapsed) {
      return (warpSpeedMultiplier(elapsed) - 1) / 7;
    }

    function tubeSectionBlend(values, elapsed) {
      const count = values.length;
      const sectionDuration = WARP_DURATION / count;
      const position = Math.max(0, elapsed) / sectionDuration;
      const integer = Math.floor(position);
      const current = integer % count;
      const next = (current + 1) % count;
      const t = position - integer;
      const eased = t * t * (3 - 2 * t);
      return {
        value: values[current] + (values[next] - values[current]) * eased,
        phase: position * Math.PI * 2 / count
      };
    }

    function angleDifference(a, b) {
      return Math.atan2(Math.sin(a - b), Math.cos(a - b));
    }

    function drawTubeTunnel(g, w, h, now) {
      const t = state.tubeTravel;
      // 45% of the former roll rate: midway between the old over-rotation and the current almost-static tube.
      const axialRoll = Number(state.tubeRoll || 0) + Math.sin(t * 0.13) * 0.126;
      const mid = w * 0.5;
      const minDim = Math.min(w, h);
      const maxRadius = minDim * 0.435;
      const widths = [0.92, 0.78, 1.02, 0.87, 1.08, 0.95];
      const curves = [0.10, 0.85, -0.72, 1.18, -0.45, 0.62];
      const liftShape = [0, -0.55, 0.25, -0.1, 0.9, 0.05];
      const widthScale = tubeSectionBlend(widths, state.elapsed).value;
      const curveScale = tubeSectionBlend(curves, state.elapsed).value;
      const liftScale = tubeSectionBlend(liftShape, state.elapsed).value;
      const phase = tubeSectionBlend(curves, state.elapsed).phase;
      const playerAngle = Number(state.playerAngle || 0);
      const loopMix = Math.max(0, Math.min(1,
        Math.min((state.elapsed - 20) / 2.5, (34 - state.elapsed) / 2.5)));
      const loopPhase = ((state.elapsed + 5) / 10.5) * Math.PI * 2;

      // The near ring stays on screen. Depth only shifts the far vanishing point,
      // so a bend cannot unwind the cylinder into the spiral seen in 0.9.90.
      const centerX = (d) => mid +
        (Math.sin(t * 0.19 + d * 4.3) * 0.045 +
         Math.sin(t * 0.11 + d * 7.1) * 0.02 +
         Math.sin(d * Math.PI * 1.55 + phase) * curveScale * 0.05 +
         Math.sin(loopPhase + d * Math.PI * 2.4) * loopMix * 0.06) * minDim * (1 - d);
      const centerY = (d) => h * 0.5 +
        (Math.sin(t * 0.15 + d * 3.6) * 0.035 +
         Math.sin(t * 0.09 + d * 7.7) * 0.018 +
         Math.sin(d * Math.PI * 1.25 + phase) * liftScale * 0.04 +
         Math.sin(loopPhase + d * Math.PI * 2.4) * loopMix * 0.05) * minDim * (1 - d);
      const radiusX = (d) => 4 + maxRadius * Math.pow(Math.max(0, d), 1.20) * widthScale;
      const radiusY = (d) => radiusX(d) * 0.91;
      // Twist stays small and is zero at the ship, so the opening on screen is
      // the opening that collides. A large depth twist was hitting empty space.
      const courseTwist = (d) => {
        const ahead = d - 0.92;
return axialRoll + ahead * 0.12 +
          (Math.sin(d * Math.PI * 2 + phase) - Math.sin(0.92 * Math.PI * 2 + phase)) * curveScale * 0.04 +
          (Math.sin(loopPhase + d * Math.PI * 2.4) - Math.sin(loopPhase + 0.92 * Math.PI * 2.4)) * loopMix * 0.10;
      };
      const twistAt = (d) => courseTwist(d);
      const point = (d, theta, extra) => {
        const angle = theta + twistAt(d);
        const rx = radiusX(d) + (extra || 0);
        const ry = radiusY(d) + (extra || 0) * 0.91;
        return {
          x: centerX(d) + Math.cos(angle) * rx,
          y: centerY(d) + Math.sin(angle) * ry
        };
      };
      const drawArc = (depth, from, to, stroke, width) => {
        const samples = Math.max(3, Math.ceil(Math.abs(to - from) * 13));
        g.beginPath();
        for (let i = 0; i <= samples; i += 1) {
          const a = from + (to - from) * (i / samples);
          const p = point(depth, a, 0);
          if (!i) g.moveTo(p.x, p.y);
          else g.lineTo(p.x, p.y);
        }
        g.strokeStyle = stroke;
        g.lineWidth = width;
        g.lineCap = "round";
        g.stroke();
      };

      const bg = g.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#02060d");
      bg.addColorStop(0.46, "#071b2a");
      bg.addColorStop(1, "#02040a");
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);

      // Build the inside wall from circumferential panels. Seams, panel
      // highlights, rings, and obstacles all rotate around the tunnel axis.
      const depthSteps = 23;
      const panelCount = 18;
      for (let step = 0; step < depthSteps; step += 1) {
        const d0 = 0.04 + (step / depthSteps) * 0.96;
        const d1 = 0.04 + ((step + 1) / depthSteps) * 0.96;
        for (let panel = 0; panel < panelCount; panel += 1) {
          const a0 = panel * Math.PI * 2 / panelCount;
          const a1 = (panel + 1) * Math.PI * 2 / panelCount;
          const p00 = point(d0, a0, 0);
          const p01 = point(d0, a1, 0);
          const p11 = point(d1, a1, 0);
          const p10 = point(d1, a0, 0);
          g.beginPath();
          g.moveTo(p00.x, p00.y);
          g.lineTo(p01.x, p01.y);
          g.lineTo(p11.x, p11.y);
          g.lineTo(p10.x, p10.y);
          g.closePath();
          const shimmer = Math.sin(t * 1.35 + panel * 1.72 + step * 0.77 + playerAngle) * 0.5 + 0.5;
          const light = ((step + Math.floor(t * 8) + panel * 3) % 5 === 0) ? 1 : 0;
          const red = Math.round(8 + shimmer * 8 + light * 2);
          const green = Math.round(20 + shimmer * 18 + light * 12);
          const blue = Math.round(31 + shimmer * 22 + light * 18);
          g.fillStyle = "rgba(" + red + "," + green + "," + blue + ",0.98)";
          g.fill();
          g.strokeStyle = "rgba(81,181,207," + (0.12 + shimmer * 0.18) + ")";
          g.lineWidth = 0.6 + d1 * 0.7;
          g.stroke();
        }
      }

      // Circumferential rings and seams make the enclosing cylinder legible.
      for (let ring = 0; ring < 17; ring += 1) {
        const d = 0.06 + (ring / 17) * 0.92;
        for (let part = 0; part < 48; part += 1) {
          const a0 = part * Math.PI * 2 / 48;
          const a1 = (part + 1) * Math.PI * 2 / 48;
          const p0 = point(d, a0, 0.6);
          const p1 = point(d, a1, 0.6);
          g.beginPath();
          g.moveTo(p0.x, p0.y);
          g.lineTo(p1.x, p1.y);
          g.strokeStyle = ring % 3 === 0 ? "rgba(118,222,237,0.55)" : "rgba(88,154,178,0.20)";
          g.lineWidth = ring % 3 === 0 ? 1 + d * 1.4 : 0.7;
          g.stroke();
        }
      }
      for (let seam = 0; seam < 12; seam += 1) {
        const theta = seam * Math.PI * 2 / 12;
        g.beginPath();
        for (let step = 0; step <= 35; step += 1) {
          const d = 0.04 + (step / 35) * 0.96;
          const p = point(d, theta, -1.5);
          if (!step) g.moveTo(p.x, p.y);
          else g.lineTo(p.x, p.y);
        }
        g.strokeStyle = seam % 3 === 0 ? "rgba(110,239,246,0.78)" : "rgba(110,191,210,0.32)";
        g.lineWidth = seam % 3 === 0 ? 1.5 : 0.8;
        g.stroke();
      }

      const routeProgress = warpCourseProgress(state.elapsed);
      const obstacleDepth = (distance) => {
        // Stay inside the near ring. d>1 is what stretched spikes into the gold wedge.
        if (distance > 0.36 || distance <= 0) return null;
        return Math.min(1, 0.055 / (distance + 0.05));
      };
      state.layers.forEach((layer) => {
        const distance = layer.progress - routeProgress;
        const d = obstacleDepth(distance);
        if (d == null) return;
        const rx = radiusX(d);
        const strokeWidth = Math.max(3, rx * 0.052);
        if (layer.type === "gate") {
          // All angles are blocked except the clearly marked opening used by
          // the exact same angular collision rule in updateTube().
          const pieces = 32;
          for (let i = 0; i < pieces; i += 1) {
            const from = i * Math.PI * 2 / pieces;
            const to = (i + 1) * Math.PI * 2 / pieces;
            if (Math.abs(angleDifference((from + to) * 0.5, layer.safeAngle)) <= layer.gapHalf) continue;
            drawArc(d, from, to, i % 4 === 0 ? "rgba(255,191,119,0.98)" : "rgba(117,204,222,0.92)", strokeWidth);
          }
          drawArc(d, layer.safeAngle - layer.gapHalf, layer.safeAngle + layer.gapHalf, "rgba(86,240,208,0.94)", Math.max(1.5, strokeWidth * 0.28));
        } else if (layer.type === "sweeper") {
          const angle = layer.sweepAngle + state.elapsed * layer.sweepSpeed;
          const p0 = point(d, angle, -rx * 0.02);
          const p1 = point(d, angle + Math.PI, -rx * 0.02);
          g.beginPath();
          g.moveTo(p0.x, p0.y);
          g.lineTo(centerX(d), centerY(d));
          g.lineTo(p1.x, p1.y);
          g.strokeStyle = "rgba(255,132,104,0.96)";
          g.lineWidth = Math.max(4, rx * 0.10);
          g.lineCap = "round";
          g.stroke();
          g.strokeStyle = "rgba(255,227,190,0.95)";
          g.lineWidth = Math.max(1.5, rx * 0.025);
          g.stroke();
        } else if (layer.type === "spikes") {
          layer.blockedAngles.forEach((angle, index) => {
            drawArc(d, angle - 0.12, angle + 0.12, "rgba(255,126,93,0.98)", Math.max(5, rx * 0.09));
            const tip = point(d, angle, -rx * 0.22);
            const sideA = point(d, angle - 0.10, -rx * 0.08);
            const sideB = point(d, angle + 0.10, -rx * 0.08);
            g.beginPath();
            g.moveTo(sideA.x, sideA.y);
            g.lineTo(tip.x, tip.y);
            g.lineTo(sideB.x, sideB.y);
            g.closePath();
            g.fillStyle = index % 2 ? "#ff8d73" : "#e9d3ae";
            g.fill();
            g.strokeStyle = "rgba(255,224,190,0.9)";
            g.lineWidth = Math.max(1, rx * 0.012);
            g.stroke();
          });
        } else if (layer.type === "boost") {
          drawArc(d, layer.safeAngle - 0.55, layer.safeAngle + 0.55, "rgba(56,245,193,0.96)", Math.max(5, rx * 0.075));
          for (let stripe = -2; stripe <= 2; stripe += 1) {
            const a = layer.safeAngle + stripe * 0.13;
            const p0 = point(d, a, -rx * 0.03);
            const p1 = point(Math.min(1.07, d + 0.025), a, -rx * 0.18);
            g.beginPath();
            g.moveTo(p0.x, p0.y);
            g.lineTo(p1.x, p1.y);
            g.strokeStyle = "rgba(115,255,214,0.88)";
            g.lineWidth = Math.max(1, rx * 0.022);
            g.stroke();
          }
        } else if (layer.type === "launcher") {
          // A passable pair of angled launch rails, not an opaque slab.
          drawArc(d, layer.safeAngle - 0.48, layer.safeAngle + 0.48, "rgba(255,190,95,0.96)", Math.max(4, rx * 0.06));
          for (let stripe = -2; stripe <= 2; stripe += 1) {
            const a0 = layer.safeAngle + stripe * 0.14 - 0.10;
            const a1 = layer.safeAngle + stripe * 0.14 + 0.06;
            const p0 = point(d, a0, -rx * 0.03);
            const p1 = point(Math.min(1.07, d + 0.035), a1, -rx * 0.22);
            g.beginPath();
            g.moveTo(p0.x, p0.y);
            g.lineTo(p1.x, p1.y);
            g.strokeStyle = "rgba(255,222,155,0.96)";
            g.lineWidth = Math.max(1, rx * 0.026);
            g.stroke();
          }
        }
      });

      // The ship rides the wall. Right decreases the angle so it moves screen-right
      // from the bottom; the tunnel itself stays put.
      const nearDepth = 0.92;
      const craftAngle = playerAngle + courseTwist(nearDepth);
      const craftPoint = point(nearDepth, playerAngle, -radiusX(nearDepth) * 0.20);
      g.save();
      g.translate(craftPoint.x, craftPoint.y);
      g.rotate(craftAngle - Math.PI / 2 + (state.steerBank || 0));
      g.scale(Math.min(1, w / 900), Math.min(1, w / 900));
      const flare = 0.65 + (Math.sin(now * 0.032) + 1) * 0.18;
      g.fillStyle = "rgba(63,213,255," + flare * 0.42 + ")";
      g.beginPath();
      g.moveTo(-5, 14); g.lineTo(0, 35 + flare * 10); g.lineTo(5, 14); g.closePath(); g.fill();
      g.fillStyle = "#1b3e56"; g.strokeStyle = "#c2f0fb"; g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, -23); g.lineTo(13, -7); g.lineTo(25, 12); g.lineTo(8, 8);
      g.lineTo(0, 16); g.lineTo(-8, 8); g.lineTo(-25, 12); g.lineTo(-13, -7);
      g.closePath(); g.fill(); g.stroke();
      g.fillStyle = "#8eeaf4";
      g.beginPath(); g.moveTo(0, -16); g.lineTo(5, 2); g.lineTo(0, 7); g.lineTo(-5, 2); g.closePath(); g.fill();
      g.fillStyle = "#ffce91"; g.fillRect(-17, 8, 5, 3); g.fillRect(12, 8, 5, 3);
      g.restore();

      const progress = warpCourseProgress(t);
      g.fillStyle = "rgba(255,255,255,.15)"; g.fillRect(w * 0.18, h - 17, w * 0.64, 3);
      g.fillStyle = "#56f0d0"; g.fillRect(w * 0.18, h - 17, w * 0.64 * progress, 3);
      if (state.shields < 100) {
        g.fillStyle = "rgba(255,77,66," + ((100 - state.shields) / 100 * 0.10) + ")";
        g.fillRect(0, 0, w, h);
      }
    }

    function drawBackdrop(now) {
      if (overlay.hidden || !ctx) {
        state.animationRunning = false;
        return;
      }
      if (state.lastFrame && now - state.lastFrame < warpFrameInterval) {
        requestAnimationFrame(drawBackdrop);
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
      const speedBySection = [0.76, 1.24, 0.84, 1.34, 0.68, 1.14];
      const rollRates = [0.42, 0.82, 0.55, 1.12, 0.31, 0.72];
      const boosted = state.elapsed < Number(state.tubeBoostUntil || 0);
      const rampMultiplier = warpSpeedMultiplier(state.elapsed);
      const speed = Math.min(8, Math.max(1,
        tubeSectionBlend(speedBySection, state.elapsed).value * 1.25 *
        rampMultiplier * (boosted ? 1.4 : 1)
      ));
      state.tubeTravel += dt * speed;
      state.tubeRoll = Number(state.tubeRoll || 0) + dt * tubeSectionBlend(rollRates, state.elapsed).value * 0.45;
      const routeProgress = warpCourseProgress(state.elapsed);

      let padX = 0;
      try {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = pads && [...pads].find((p) => p && p.connected);
        if (gp) {
          const axes = gp.axes || [];
          const button = (n) => !!(gp.buttons && gp.buttons[n] && gp.buttons[n].pressed);
          const axis = axes[0] || 0;
          padX = Math.abs(axis) > 0.18 ? axis : 0;
          padX += (button(15) ? 1 : 0) - (button(14) ? 1 : 0);
        }
      } catch (e) {}

      // Left/right is the only steering axis and always changes the same angle.
      // Adding up/down into X/Y made "up" continue a right turn after the ship
      // left the bottom of the circle.
      const steer = Math.max(-1, Math.min(1,
        ((state.keys.ArrowRight || state.keys.KeyD || state.touch.right ? 1 : 0) -
         (state.keys.ArrowLeft || state.keys.KeyA || state.touch.left ? 1 : 0)) + padX + (state.tilt.enabled ? state.tilt.value * 0.9 : 0)));
      state.playerAngle = Number(state.playerAngle || 0) - steer * dt * 1.85;
      state.playerAngle = Math.atan2(Math.sin(state.playerAngle), Math.cos(state.playerAngle));
      const bankTarget = -steer * 0.42;
      state.steerBank = Number(state.steerBank || 0) + (bankTarget - Number(state.steerBank || 0)) * Math.min(1, dt * 10);
      const playerAngle = state.playerAngle;

      state.layers.forEach((layer) => {
        const distance = layer.progress - routeProgress;
        if (layer.resolved || distance > 0 || distance < -0.03) return;
        layer.resolved = true;
        let hit = false;

        if (layer.type === "gate") {
          hit = Math.abs(angleDifference(playerAngle, layer.safeAngle)) > layer.gapHalf;
        } else if (layer.type === "sweeper") {
          const sweep = layer.sweepAngle + state.elapsed * layer.sweepSpeed;
          const first = Math.abs(angleDifference(playerAngle, sweep));
          const opposite = Math.abs(angleDifference(playerAngle, sweep + Math.PI));
          hit = Math.min(first, opposite) < layer.obstacleWidth;
        } else if (layer.type === "spikes") {
          hit = layer.blockedAngles.some((angle) =>
            Math.abs(angleDifference(playerAngle, angle)) < layer.obstacleWidth
          );
        } else if (layer.type === "boost" || layer.type === "launcher") {
          if (Math.abs(angleDifference(playerAngle, layer.safeAngle)) < (layer.type === "launcher" ? 0.68 : 0.72)) {
            state.tubeBoostUntil = state.elapsed + (layer.type === "launcher" ? 4.2 : 3.5);
            state.shields = Math.min(100, state.shields + (layer.type === "launcher" ? 4 : 8));
          }
        }

        if (hit) {
          state.shields = Math.max(0, state.shields - 25);
          tubeShield.style.width = state.shields + "%";
          tubeMeta.textContent = "SHIELDS " + state.shields + "% · FOLLOW THE OPEN ARC";
          if (state.shields <= 0) {
            finishTube(false);
            return;
          }
        }
      });

      if (state.elapsed >= WARP_DURATION) finishTube(state.shields > 0);
      tubeMeta.textContent = Math.ceil(Math.max(0, WARP_DURATION - state.elapsed)) + "s · " +
        Math.round(playerAngle * 180 / Math.PI) + "°";
      tubeShield.style.width = state.shields + "%";
    }

    window.BCMDeepSpaceWarpToggle = function () {
      if (state.mode === "closed") openMap();
    };

    function enableWarpTilt(recalibrate) {
      const orientation = window.DeviceOrientationEvent;
      if (!orientation) return;

      const begin = () => {
        if (!state.tilt.bound) {
          window.addEventListener("deviceorientation", (event) => {
            if (typeof event.gamma !== "number" || typeof event.beta !== "number") return;
            state.tilt.available = true;
            let horizontal = event.gamma;
            const angleRaw = screen.orientation && typeof screen.orientation.angle === "number"
              ? screen.orientation.angle
              : (typeof window.orientation === "number" ? window.orientation : 0);
            const angle = ((angleRaw % 360) + 360) % 360;
            if (angle === 90) horizontal = -event.beta;
            else if (angle === 270) horizontal = event.beta;
            else if (angle === 180) horizontal = -event.gamma;

            if (!state.tilt.filterReady) {
              state.tilt.filtered = horizontal;
              state.tilt.filterReady = true;
            } else {
              state.tilt.filtered += (horizontal - state.tilt.filtered) * 0.22;
            }

            if (state.tilt.calibrating) {
              state.tilt.sum += state.tilt.filtered;
              state.tilt.samples += 1;
              if (state.tilt.samples >= 10) {
                state.tilt.neutral = state.tilt.sum / state.tilt.samples;
                state.tilt.calibrating = false;
                state.tilt.enabled = true;
                state.tilt.value = 0;
                tiltButton?.classList.add("active");
              }
              return;
            }
            if (!state.tilt.enabled) return;
            const delta = state.tilt.filtered - state.tilt.neutral;
            const dead = 2.5;
            state.tilt.value = Math.abs(delta) <= dead
              ? 0
              : Math.max(-1, Math.min(1, (delta - Math.sign(delta) * dead) / 16));
          }, true);
          state.tilt.bound = true;
        }

        state.tilt.permissionGranted = true;
        if (recalibrate || !state.tilt.enabled) {
          state.tilt.calibrating = true;
          state.tilt.samples = 0;
          state.tilt.sum = 0;
          state.tilt.value = 0;
          state.tilt.enabled = false;
          tiltButton?.classList.add("active");
        }
      };

      if (typeof orientation.requestPermission === "function" && !state.tilt.permissionGranted) {
        orientation.requestPermission().then((permission) => {
          if (permission === "granted") begin();
          else {
            state.tilt.enabled = false;
            tiltButton?.classList.remove("active");
          }
        }).catch(() => {
          state.tilt.enabled = false;
          tiltButton?.classList.remove("active");
        });
      } else {
        begin();
      }
    }

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
        state.playerAngle = Number(state.playerAngle || 0) - dx / Math.max(1, rect.width) * Math.PI * 1.25;
        state.playerAngle = Math.atan2(Math.sin(state.playerAngle), Math.cos(state.playerAngle));
        state.pointerX = event.clientX;
        state.pointerY = event.clientY;
      });
      overlay.addEventListener("pointerup", () => { state.pointerDown = false; });
      overlay.addEventListener("pointercancel", () => { state.pointerDown = false; });

      document.addEventListener("keydown", (event) => {
        if (overlay.hidden) return;
        if (event.code === "Escape" || event.code === "Backspace") {
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
          if (state.mode !== "tube") return;
          if (direction === "tilt") { enableWarpTilt(true); return; }
          state.touch[direction] = true;
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
    tubeContinue.addEventListener("click", confirmTubeArrival);
    tubeAbort.addEventListener("click", () => closeOverlay(true));
    exitButton.addEventListener("click", returnToWarpMap);
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