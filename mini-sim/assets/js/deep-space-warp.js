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

    let ringAudio = null;
    let ringAudioSource = "";
    function findRingAudioSource() {
      if (String(config.ringMusicUrl || "").trim()) return String(config.ringMusicUrl).trim();
      const assets = Array.isArray(config.assets) ? config.assets : [];
      const item = assets.find((asset) => {
        const candidate = String(asset && (asset.name || asset.filename || asset.path || asset.url) || "")
          .split(/[?#]/)[0].split("/").pop().toLowerCase();
        return candidate === "ring.mp3";
      });
      return String(item && (item.url || item.src || item.path) || "");
    }

    // Warm the soundtrack while the transition clip is loading, but do not play
    // it until the clip's first frame is actually presented.
    function prepareRingAudio() {
      const source = findRingAudioSource();
      if (!source) return false;
      if (!ringAudio) {
        ringAudio = document.createElement("audio");
        ringAudio.preload = "auto";
        ringAudio.loop = true;
        ringAudio.volume = 0.68;
        ringAudio.setAttribute("playsinline", "");
        ringAudioSource = source;
        ringAudio.src = source;
        ringAudio.load();
        if (window.BCMGameAudio?.register) window.BCMGameAudio.register(ringAudio, "ring");
      } else if (ringAudioSource !== source) {
        try { ringAudio.pause(); } catch (e) {}
        ringAudioSource = source;
        ringAudio.preload = "auto";
        ringAudio.src = source;
        ringAudio.load();
      }
      ringAudio.muted = !!window.BCMGameAudio?.isMuted?.();
      return true;
    }

    function startRingAudio() {
      if (!prepareRingAudio()) return false;
      ringAudio.muted = !!window.BCMGameAudio?.isMuted?.();
      if (!ringAudio.paused && !ringAudio.ended) return true;
      const playing = window.BCMGameAudio?.playExclusive
        ? window.BCMGameAudio.playExclusive(ringAudio, "ring")
        : ringAudio.play();
      if (playing && typeof playing.catch === "function") playing.catch(() => {});
      return true;
    }

    function stopRingAudio(resumeWarp) {
      if (ringAudio) {
        try { ringAudio.pause(); ringAudio.currentTime = 0; } catch (e) {}
      }
      if (resumeWarp && state.mode === "maze" && !state.ringPlatformer && !state.ringTransitionActive) {
        warpAudio.muted = !!window.BCMGameAudio?.isMuted?.();
        startWarpAudio(false);
      }
    }

    function findRingTransitionVideoSource() {
      if (String(config.ringTransitionVideoUrl || "").trim()) return String(config.ringTransitionVideoUrl).trim();
      const assets = Array.isArray(config.assets) ? config.assets : [];
      const fileName = (asset) => String(asset && (asset.name || asset.filename || asset.path || asset.url) || "")
        .split(/[?#]/)[0].split("/").pop().toLowerCase();
      const preferred = assets.find((asset) => fileName(asset) === "ringgummy.mp4");
      const item = preferred || assets.find((asset) => /^ring[^/]*\.mp4$/i.test(fileName(asset)));
      return String(item && (item.url || item.src || item.path) || "");
    }

    function playRingTransition(maze, source, engine) {
      if (state.ringTransitionActive || state.ringPlatformer) return false;
      state.ringTransitionActive = true;
      state.ringPlatformer = true;
      hullEnterButton.hidden = true;
      if (engine && engine.pauseForWarp) engine.pauseForWarp(true);

      const audioPrepared = prepareRingAudio();
      let audioReady = !audioPrepared || !ringAudio || ringAudio.readyState >= 3;
      let videoReady = false;
      let playbackRequested = false;
      let finished = false;
      let firstFrameCallback = 0;

      const overlay = document.createElement("div");
      overlay.id = "bcm-ring-transition";
      overlay.setAttribute("aria-label", "Ring transition");
      overlay.style.cssText = "position:fixed;inset:0;z-index:1000700;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#000;touch-action:none";
      const video = document.createElement("video");
      video.preload = "auto";
      video.autoplay = true;
      video.loop = false;
      video.muted = true;
      video.controls = false;
      video.playsInline = true;
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");
      video.disablePictureInPicture = true;
      video.style.cssText = "display:block;width:100%;height:100%;object-fit:contain;background:#000";
      overlay.appendChild(video);
      document.body.appendChild(overlay);

      function enterLevel() {
        if (finished) return;
        finished = true;
        try {
          if (firstFrameCallback && typeof video.cancelVideoFrameCallback === "function") {
            video.cancelVideoFrameCallback(firstFrameCallback);
          }
        } catch (e) {}
        try { video.pause(); video.removeAttribute("src"); video.load(); } catch (e) {}
        overlay.remove();
        state.ringTransitionActive = false;
        state.ringPlatformer = false;
        if (!openRingPlatformer(maze, true)) {
          state.ringPlatformer = false;
          if (engine && engine.pauseForWarp) engine.pauseForWarp(false);
          stopRingAudio(true);
        }
      }

      function maybeStartVideo() {
        if (finished || playbackRequested || !videoReady || !audioReady) return;
        playbackRequested = true;
        const playing = video.play();
        if (playing && typeof playing.catch === "function") playing.catch(() => enterLevel());
      }

      video.addEventListener("loadeddata", () => {
        videoReady = true;
        maybeStartVideo();
      }, { once: true });
      video.addEventListener("ended", enterLevel, { once: true });
      video.addEventListener("error", enterLevel, { once: true });

      if (audioPrepared && ringAudio && !audioReady) {
        ringAudio.addEventListener("canplay", () => {
          audioReady = true;
          maybeStartVideo();
        }, { once: true });
        ringAudio.addEventListener("error", () => {
          audioReady = true;
          maybeStartVideo();
        }, { once: true });
      }

      const startSoundOnFirstFrame = () => {
        if (!finished) startRingAudio();
      };
      if (typeof video.requestVideoFrameCallback === "function") {
        try { firstFrameCallback = video.requestVideoFrameCallback(startSoundOnFirstFrame); }
        catch (e) { video.addEventListener("loadeddata", startSoundOnFirstFrame, { once: true }); }
      } else {
        // Older Safari/WebViews expose the decoded first frame via loadeddata.
        video.addEventListener("loadeddata", startSoundOnFirstFrame, { once: true });
      }

      video.src = source;
      video.load();
      maybeStartVideo();
      return true;
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
      if (ringAudio) ringAudio.muted = !!event.detail?.muted;
    });
    window.addEventListener("keydown", (event) => {
      if (event.code !== "KeyU" || event.repeat ||
          state.mode === "map" || state.mode === "tube" || state.mode === "result" ||
          state.ringPlatformer || state.ringTransitionActive || state.hullOpen) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openHullInterior();
    }, true);

    const state = {
      mode: "closed",
      openedAt: 0,
      nav: null,
      target: null,
      savedPosition: null,
      savedQuaternion: null,
      // Launch pose is immutable during a trip. A returned asteroid-run pose
      // is separate so cancelling after comeback cannot restore Room 1.
      returnPosition: null,
      returnQuaternion: null,
      launchNav: null,
      launchSectorProgressed: false,
      savedSpeedMode: null,
      sectorProgressed: false,
      elapsed: 0,
      tubeTravel: 0,
      tubeShimmerTime: 0,
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
      ringPlatformer: false,
      ringTransitionActive: false,
      ringRenderState: null,
      ringDistance: Infinity,
      hullOpen: false,
      rightStickWasDown: false,
      warpCollisionCount: 0,
      statusText: "",
      lastStatusAt: 0,
      keys: Object.create(null),
      touch: { left: false, right: false, up: false, down: false },
      tilt: { enabled: false, bound: false, permissionGranted: false, available: false, filterReady: false, filtered: 0, neutral: 0, calibrating: false, samples: 0, sum: 0, value: 0 }
    };

    const hullEnterButton = document.createElement("button");
    hullEnterButton.className = "bcm-warp-hull-enter";
    hullEnterButton.type = "button";
    hullEnterButton.textContent = "ВНУТРЬ КОРАБЛЯ · U / R3";
    hullEnterButton.setAttribute("aria-label", "Войти внутрь корабля");
    hullEnterButton.hidden = true;
    hullEnterButton.style.cssText = "position:fixed;left:50%;bottom:calc(96px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:1000500;min-height:46px;padding:9px 16px;border:1px solid #70d9ee;border-radius:10px;background:rgba(7,27,42,.96);color:#e8fbff;font:700 13px system-ui;letter-spacing:.05em;touch-action:manipulation;white-space:nowrap;box-shadow:0 4px 22px rgba(0,0,0,.35)";
    root.appendChild(hullEnterButton);
    hullEnterButton.addEventListener("click", () => openHullInterior());

    function syncHullButtonVisibility() {
      const towerRoot = document.querySelector(".bcm-tower");
      const towerOwnsScreen = !!(towerRoot && !towerRoot.hidden && towerRoot.style.pointerEvents !== "none");
      const busy = state.mode === "map" || state.mode === "tube" || state.mode === "result" ||
        state.ringPlatformer || state.ringTransitionActive || state.hullOpen || towerOwnsScreen ||
        !!document.getElementById("bcm-hull-dive") ||
        !!document.getElementById("bcm-ring-platformer") ||
        !!document.getElementById("bcm-ring-transition");
      const hidden = !root.classList.contains("game-active") || busy;
      if (hullEnterButton.hidden !== hidden) hullEnterButton.hidden = hidden;
      return !hidden;
    }
    if (typeof MutationObserver === "function") {
      const hullButtonObserver = new MutationObserver(syncHullButtonVisibility);
      hullButtonObserver.observe(root, { attributes: true, attributeFilter: ["class"] });
    }
    syncHullButtonVisibility();

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
      state.returnPosition = null;
      state.returnQuaternion = null;
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
        engine.clearExternalHUD();
        const anchorPosition = state.returnPosition || state.savedPosition;
        const anchorQuaternion = state.returnQuaternion || state.savedQuaternion;
        // Cancelling means the simulated sector change was not committed. Keep
        // the ship's physical comeback position, but restore the sector from
        // which this particular Tube launch began.
        if (restoreMain && state.launchNav) {
          state.nav = state.launchNav;
          state.sectorProgressed = state.launchSectorProgressed;
        }
        // Restore the chosen pose before unpausing physics. This avoids a stale
        // post-Warp movement update winning over the return position.
        if (restoreMain && anchorPosition && anchorQuaternion) {
          engine.teleport(anchorPosition, anchorQuaternion);
        }
        engine.pauseForWarp(false);
      }
      state.returnPosition = null;
      state.returnQuaternion = null;
      state.launchNav = null;
      state.launchSectorProgressed = false;
    }

    function showTube() {
      if (!state.target) return;
      const engine = api();
      if (!engine || !engine.getRuntime) return;
      const startRuntime = engine.getRuntime();
      if (!startRuntime || !startRuntime.scene || !startRuntime.ship ||
          !startRuntime.ship.position || !startRuntime.ship.quaternion) return;
      // Each new Tube launch snapshots its own origin sector and ship pose.
      // A previous asteroid comeback must not bleed into this Warp attempt.
      state.savedPosition = startRuntime.ship.position.clone();
      state.savedQuaternion = startRuntime.ship.quaternion.clone();
      state.returnPosition = null;
      state.returnQuaternion = null;
      state.launchNav = state.nav;
      state.launchSectorProgressed = state.sectorProgressed;
      state.mode = "tube";
      state.elapsed = 0;
      state.tubeTravel = 0;
      state.tubeShimmerTime = 0;
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
      // Repeated trips through the same sector pair should still create a fresh
      // obstacle run rather than showing the exact same 22-piece sequence.
      const runNonce = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
      const rng = randomFrom(hashSeed(state.nav.current.id + ">" + state.target.id + ":" + state.target.x + ":" + state.target.y + ":" + runNonce));
      state.layers = [];
      const gateCount = 22;
      let previousSafeAngle = null;
      for (let i = 0; i < gateCount; i += 1) {
        const typeRoll = rng();
        const type = typeRoll < 0.34 ? "gate"
          : typeRoll < 0.55 ? "sweeper"
          : typeRoll < 0.70 ? "spikes"
          : typeRoll < 0.86 ? "boost" : "launcher";
        let safeAngle = rng() * Math.PI * 2 - Math.PI;
        if (previousSafeAngle != null) {
          const delta = Math.atan2(Math.sin(safeAngle - previousSafeAngle), Math.cos(safeAngle - previousSafeAngle));
          // Cap adjacent lane changes so a human can physically steer between them.
          if (Math.abs(delta) > 1.18) safeAngle = previousSafeAngle + Math.sign(delta) * 1.18;
        }
        previousSafeAngle = safeAngle;
        const blockedAngles = [];
        const spikeCount = type === "spikes" ? 3 : 0;
        for (let n = 0; n < spikeCount; n += 1) {
          let angle = rng() * Math.PI * 2 - Math.PI;
          if (Math.abs(Math.atan2(Math.sin(angle - safeAngle), Math.cos(angle - safeAngle))) < 0.92) {
            angle = safeAngle + (n % 2 ? 1 : -1) * (1.15 + rng() * 0.65);
          }
          blockedAngles.push(Math.atan2(Math.sin(angle), Math.cos(angle)));
        }
        const progress = 0.08 + (i / Math.max(1, gateCount - 1)) * 0.86 + (rng() - 0.5) * 0.006;
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
      const runNonce = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
      const seed = hashSeed(state.nav.current.id + "->" + state.target.id + ":" + state.target.x + ":" + state.target.y + ":" + runNonce);
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
        crystals.push({ mesh, taken: false, phase: rng() * Math.PI * 2, cell: { x: cell.x, y: cell.y, z: cell.z } });
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
        // The 2D Ring mode reuses this exact maze instance and topology, not a second RNG.
        seed,
        dimensions: { nx: NX, ny: NY, nz: NZ },
        startCell: { x: startNode.x, y: startNode.y, z: startNode.z },
        exitCell: { x: exitNode.x, y: exitNode.y, z: exitNode.z },
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
        lastPosition: null,
        lastImpactAt: 0,
        ringCompleted: false
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

      // The external ship scene remains the transparent window's backdrop while either
      // overlay is active; keep camera/visual transforms synced, but never move a paused ship.
      if (state.ringPlatformer || state.hullOpen) {
        if (frame.camera) {
          frame.camera.position.copy(pos);
          frame.camera.quaternion.copy(ship.quaternion);
        }
        if (ship.visual) {
          ship.visual.position.copy(pos);
          ship.visual.quaternion.copy(ship.quaternion);
        }
        maze.lastPosition.copy(pos);
        return;
      }

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
          const impactSpeed = ship.velocity.length();
          const impactNow = performance.now();
          if (impactSpeed > 3.0 && impactNow - maze.lastImpactAt > 650) {
            maze.lastImpactAt = impactNow;
            const compartmentId = pos.x < maze.center.x - 5.4 ? 1 : (pos.x > maze.center.x + 5.4 ? 3 : 2);
            const damage = Math.max(4, Math.min(24, Math.round((impactSpeed - 2.0) * 4.4)));
            const damaged = window.BCMHullRepairState?.triggerExternalImpact?.(compartmentId, damage);
            if (damaged) {
              setMazeStatus("IMPACT · " + damaged.name + " · INTEGRITY " + Math.round(damaged.integrity) + "% · HIT " + damage);
            }
          }
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

      // Local artificial gravity activates near the gold ring, with a smooth falloff.
      const ringVector = maze.beacon.position.clone().sub(pos);
      const approachDistance = ringVector.length();
      state.ringDistance = approachDistance;
      if (approachDistance < 22 && approachDistance > 2.65) {
        const falloff = Math.max(0, 1 - approachDistance / 22);
        ringVector.normalize();
        ship.velocity.addScaledVector(ringVector, (frame.dt || 0.016) * (0.25 + falloff * falloff * 1.8));
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
      state.ringDistance = ringDistance;
      hullEnterButton.hidden = !(ringDistance < 8) || state.ringPlatformer;
      if (!state.ringPlatformer && !maze.ringCompleted && ringDistance < 2.6) {
        openRingPlatformer(maze);
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
        const message = state.ringDistance < 22
          ? "RING GRAVITY ACTIVE · PRESS U / R3 OR TAP THE HULL BUTTON"
          : "EXPEDITION · CORE SHARDS " + maze.count + "/3 · FOLLOW THE GOLD RING";
        setMazeStatus(message);
      }
    }

    function openHullInterior() {
      const engine = api();
      const runtime = engine && engine.getRuntime ? engine.getRuntime() : null;
      const maze = state.maze && state.maze.active && state.mode === "maze" ? state.maze : null;
      if (state.hullOpen || state.ringPlatformer || state.ringTransitionActive ||
          !root.classList.contains("game-active") || !runtime || !runtime.ship ||
          !window.BCMHullDive || typeof window.BCMHullDive.open !== "function") return false;

      // This is the ship's interior, not a teleport to the golden Ring.
      // Preserve the current first-person flight pose and only pause the ship while
      // the transparent compartment simulation owns the screen.
      state.hullOpen = true;
      syncHullButtonVisibility();
      if (engine.pauseForWarp) engine.pauseForWarp(true);

      const nearRing = !!(maze && maze.beacon && state.ringDistance < 18);
      window.BCMRingWindowState = nearRing ? {
        visible: true,
        ringDistance: state.ringDistance,
        target: maze.beacon.position.clone(),
        maze
      } : null;

      window.BCMHullDive.open(() => {
        state.hullOpen = false;
        window.BCMRingWindowState = null;
        if (engine.pauseForWarp) engine.pauseForWarp(false);
        const freshRuntime = engine.getRuntime ? engine.getRuntime() : null;
        if (maze && freshRuntime?.ship?.position) {
          state.ringDistance = freshRuntime.ship.position.distanceTo(maze.beacon.position);
          setMazeStatus("BACK IN THE SHIP · RING WINDOW " +
            (state.ringDistance < 18 ? "VISIBLE" : "OUT OF VIEW"));
        }
        syncHullButtonVisibility();
      });
      syncHullButtonVisibility();
      return true;
    }

    const hullEntryPadWasDown = new Map();
    window.BCMDeepSpaceWarpPoll = () => {
      syncHullButtonVisibility();
      const pads = navigator.getGamepads ? [...navigator.getGamepads()] : [];
      let pressed = false;
      for (const pad of pads) {
        if (!pad || !pad.connected) continue;
        const down = !!pad.buttons?.[11]?.pressed;
        const wasDown = hullEntryPadWasDown.get(pad.index) || false;
        hullEntryPadWasDown.set(pad.index, down);
        if (down && !wasDown) pressed = true;
      }
      for (const index of [...hullEntryPadWasDown.keys()]) {
        if (!pads.some((pad) => pad && pad.connected && pad.index === index)) hullEntryPadWasDown.delete(index);
      }
      if (!pressed || state.mode === "map" || state.mode === "tube" || state.mode === "result" ||
          state.ringPlatformer || state.ringTransitionActive || state.hullOpen ||
          document.getElementById("bcm-hull-dive") ||
          document.getElementById("bcm-ring-platformer") ||
          document.getElementById("bcm-ring-transition")) return;
      const towerRoot = document.querySelector(".bcm-tower");
      if (towerRoot && !towerRoot.hidden && towerRoot.style.pointerEvents !== "none") return;
      openHullInterior();
    };

    function openRingPlatformer(maze, afterTransition = false) {
      if (!maze || !maze.active || state.ringPlatformer || state.hullOpen || state.mode !== "maze") return false;
      const engine = api();
      const runtime = engine && engine.getRuntime ? engine.getRuntime() : null;
      if (!runtime?.ship || !runtime.THREE || !runtime.scene) return false;
      if (!afterTransition) {
        const transitionSource = findRingTransitionVideoSource();
        if (transitionSource) return playRingTransition(maze, transitionSource, engine);
      }

      startRingAudio();
      state.ringPlatformer = true;
      hullEnterButton.hidden = true;
      if (engine.pauseForWarp) engine.pauseForWarp(true);

      const THREE = runtime.THREE;
      const scene = runtime.scene;
      const nx = Math.max(1, Number(maze.dimensions?.nx) || Math.max(...maze.cells.map((c) => c.x)) + 1);
      const ny = Math.max(1, Number(maze.dimensions?.ny) || Math.max(...maze.cells.map((c) => c.y)) + 1);
      const nz = Math.max(1, Number(maze.dimensions?.nz) || Math.max(...maze.cells.map((c) => c.z)) + 1);
      const seed = Number(maze.seed) || 0;
      const cellSize = Number(maze.cellSize) || 5.4;
      const wallThickness = 0.24;
      const doorWidth = 2.5;
      const doorHeight = 3.35;
      const roomHalf = cellSize / 2;
      const floorYForCell = (cellY) => cellWorld({ x: 0, y: cellY, z: 0 }).y - roomHalf + 0.16;
      const cellMap = new Map(maze.cells.map((cell) => [cell.x + ":" + cell.y + ":" + cell.z, cell]));
      const getCell = (x, y, z) => cellMap.get(x + ":" + y + ":" + z) || null;
      const entryCell = maze.startCell || { x: 0, y: 1, z: 0 };
      const ringCell = maze.exitCell || { x: nx - 1, y: Math.min(1, ny - 1), z: nz - 1 };
      const exitCell = { x: entryCell.x, y: entryCell.y, z: entryCell.z };

      function cellWorld(cell) {
        return {
          x: maze.center.x + (cell.x - (nx - 1) / 2) * cellSize,
          y: maze.center.y + (cell.y - (ny - 1) / 2) * cellSize,
          z: maze.center.z + ((nz - 1) / 2 - cell.z) * cellSize
        };
      }

      const root2d = document.createElement("div");
      root2d.id = "bcm-ring-platformer";
      root2d.tabIndex = 0;
      root2d.style.cssText = "position:fixed;inset:0;z-index:1000600;background:transparent;color:#e8f4f8;font:14px system-ui,sans-serif;overflow:hidden;touch-action:none;pointer-events:none";
      root2d.innerHTML =
        '<div style="position:absolute;top:10px;left:12px;right:12px;display:flex;justify-content:space-between;gap:12px;align-items:flex-start;pointer-events:none;z-index:3">' +
          '<div style="max-width:62%;text-shadow:0 2px 8px #000"><div style="font-size:11px;letter-spacing:.16em;color:#60ddec">RING // 2D IN 3D</div>' +
          '<div data-ring-status style="font-weight:800;margin-top:5px;line-height:1.3">Выбери режим</div>' +
          '<div data-ring-floor style="margin-top:5px;color:#b8cbd6;font-size:12px"></div></div>' +
          '<div style="display:flex;flex-direction:column;gap:7px;align-items:flex-end;pointer-events:auto">' +
            '<div data-ring-count style="padding:6px 9px;background:rgba(7,22,34,.94);border:1px solid #25485b;border-radius:8px;color:#d9f8ff;white-space:nowrap">ЯДРА 0/3</div>' +
            '<button type="button" data-ring-exit style="min-height:42px;padding:7px 11px;border:1px solid #547083;border-radius:9px;background:rgba(16,35,45,.96);color:#e8fbff;font-weight:800">В КОРАБЛЬ · Esc</button>' +
          '</div>' +
        '</div>' +
        '<canvas data-ring-canvas aria-label="Карта текущего лабиринта" style="position:absolute;right:12px;top:100px;width:min(34vw,240px);height:min(30vh,190px);min-width:124px;min-height:116px;border:1px solid rgba(88,173,198,.55);border-radius:10px;background:rgba(3,10,18,.83);z-index:2;pointer-events:none"></canvas>' +
        '<div data-ring-split-divider hidden style="position:absolute;inset:0;z-index:1;pointer-events:none;border:0"></div>' +
        '<div style="position:absolute;left:12px;right:12px;bottom:calc(10px + env(safe-area-inset-bottom));display:flex;justify-content:space-between;align-items:flex-end;gap:12px;z-index:4;pointer-events:none">' +
          '<div style="display:grid;grid-template-columns:repeat(3,46px);grid-template-rows:repeat(2,42px);gap:4px;pointer-events:auto">' +
            '<span></span><button type="button" data-ring-action="turnUp" aria-label="Повернуть вглубь" style="grid-column:2;grid-row:1;min-height:42px">▲</button><span></span>' +
            '<button type="button" data-ring-action="left" aria-label="Влево" style="min-height:42px">◀</button><button type="button" data-ring-action="jump" aria-label="Прыжок" style="min-height:42px">↑</button><button type="button" data-ring-action="right" aria-label="Вправо" style="min-height:42px">▶</button>' +
            '<button type="button" data-ring-action="turnDown" aria-label="Повернуть назад" style="grid-column:2;grid-row:3;min-height:38px">▼</button>' +
          '</div>' +
          '<div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end;pointer-events:auto">' +
            '<div style="color:#b9d3df;background:rgba(4,13,23,.82);border:1px solid rgba(76,139,163,.35);border-radius:8px;padding:5px 8px;font-size:11px;text-align:right">ТРИГГЕРЫ · ПОВОРОТЫ · ЛЕСТНИЦЫ</div>' +
            '<div style="display:flex;gap:5px">' +
              '<button type="button" data-ring-action="floorUp" style="min-height:38px;padding:5px 9px;font-size:12px">ЭТАЖ +</button>' +
              '<button type="button" data-ring-action="floorDown" style="min-height:38px;padding:5px 9px;font-size:12px">ЭТАЖ −</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div data-ring-mode-menu style="position:absolute;inset:0;z-index:6;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(1,5,12,.74);pointer-events:auto">' +
          '<div style="width:min(460px,100%);padding:22px;border:1px solid #37677c;border-radius:16px;background:rgba(6,20,32,.97);box-shadow:0 12px 60px #0009;text-align:center">' +
            '<div style="font-size:12px;letter-spacing:.18em;color:#60ddec">SEED ' + seed + ' · ТОТ ЖЕ ЛАБИРИНТ</div>' +
            '<div style="font-size:23px;font-weight:900;margin:12px 0 7px">Внутри лабиринта</div>' +
            '<div style="color:#b7cbd6;line-height:1.45;margin-bottom:17px">2D-управление в трёхмерных комнатах. Двери меняют направление камеры, лестницы ведут на другие этажи. Открой те же коридоры и собери оставшиеся ядра.</div>' +
            '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">' +
              '<button type="button" data-ring-single style="min-height:48px;min-width:126px;padding:9px 16px;border:1px solid #69d7ea;border-radius:10px;background:#123c48;color:#e8fbff;font-weight:900">SINGLE</button>' +
              '<button type="button" data-ring-multi style="min-height:48px;min-width:126px;padding:9px 16px;border:1px solid #bb9a57;border-radius:10px;background:#3b301b;color:#fff0c7;font-weight:900">MULTI · 2 CREW</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      document.body.appendChild(root2d);
      const canvas = root2d.querySelector("[data-ring-canvas]");
      const g = canvas.getContext("2d");
      const statusEl = root2d.querySelector("[data-ring-status]");
      const countEl = root2d.querySelector("[data-ring-count]");
      const floorEl = root2d.querySelector("[data-ring-floor]");
      const menu = root2d.querySelector("[data-ring-mode-menu]");
      const splitDivider = root2d.querySelector("[data-ring-split-divider]");
      const playerColors = ["#65dcf0", "#f3c46c"];
      const crewSelection = Array.isArray(window.BCMMiniCrewSelection?.players)
        ? window.BCMMiniCrewSelection.players : [];
      const crewImages = [];
      crewSelection.slice(0, 2).forEach((crew, index) => {
        const imageUrl = String(crew?.image || "");
        if (!imageUrl) { crewImages[index] = null; return; }
        const img = new Image();
        img.onload = () => {};
        img.onerror = () => {};
        img.src = imageUrl;
        crewImages[index] = img;
      });

      let mapWidth = 1, mapHeight = 1, pixelRatio = 1, raf = 0, done = false, gameStarted = false;
      let mode = "single";
      let players = [];
      let splitActive = false;
      let frameStamp = 0;
      let lastHudCount = -1;
      const keyboardInputs = [{}, {}];
      const touchInputs = [{}, {}];
      const padInputs = [{}, {}];
      const previousPad = [{}, {}];
      const oneShotActions = new Set(["turnUp", "turnDown", "floorUp", "floorDown"]);
      const worldSaved = {
        oldMazeVisible: maze.group ? maze.group.visible : true,
        oldShipVisible: runtime.ship.visual ? runtime.ship.visual.visible : true,
        oldBackground: scene.background
      };

      function resize2d() {
        const rect = canvas.getBoundingClientRect();
        pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
        mapWidth = Math.max(1, rect.width);
        mapHeight = Math.max(1, rect.height);
        canvas.width = Math.round(mapWidth * pixelRatio);
        canvas.height = Math.round(mapHeight * pixelRatio);
      }

      function buildRingWorld() {
        const world = new THREE.Group();
        world.name = "bcm-ring-cutaway-world";
        const buckets = { floor: [], ceiling: [], wallsX: [], wallsZ: [], framesX: [], framesZ: [], platforms: [], ladders: [] };
        const platforms = [];
        const wallMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72, metalness: 0.32 });
        const floorMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0.2 });
        const ceilingMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86, metalness: 0.16 });
        const frameMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.45, emissive: 0x06202a });
        const platformMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.34, emissive: 0x07171d });
        const ladderMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0.42, emissive: 0x0a2630 });
        const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
        const doorSide = (cellSize - doorWidth) / 2;
        const headerHeight = (cellSize - doorHeight) / 2;
        const hatchSize = 1.18;

        function addBox(bucket, x, y, z, sx, sy, sz, color) {
          buckets[bucket].push({ x, y, z, sx, sy, sz, color: color || 0x28414d });
        }
        function addFrameX(x, y, z, color) {
          addBox("framesX", x, y, z - doorWidth / 2, wallThickness * 0.8, doorHeight, 0.075, color || 0x59d7ea);
          addBox("framesX", x, y, z + doorWidth / 2, wallThickness * 0.8, doorHeight, 0.075, color || 0x59d7ea);
          addBox("framesX", x, y + doorHeight / 2, z, wallThickness * 0.8, 0.075, doorWidth, color || 0x59d7ea);
        }
        function addFrameZ(x, y, z, color) {
          addBox("framesZ", x - doorWidth / 2, y, z, 0.075, doorHeight, wallThickness * 0.8, color || 0x59d7ea);
          addBox("framesZ", x + doorWidth / 2, y, z, 0.075, doorHeight, wallThickness * 0.8, color || 0x59d7ea);
          addBox("framesZ", x, y + doorHeight / 2, z, doorWidth, 0.075, wallThickness * 0.8, color || 0x59d7ea);
        }
        function addFaceX(xFace, yCenter, zCenter, opening, color) {
          const baseColor = color || 0x263e4a;
          if (!opening) {
            addBox("wallsX", xFace, yCenter, zCenter, wallThickness, cellSize, cellSize, baseColor);
            return;
          }
          addBox("wallsX", xFace, yCenter, zCenter - (doorWidth + cellSize) / 4, wallThickness, cellSize, doorSide, baseColor);
          addBox("wallsX", xFace, yCenter, zCenter + (doorWidth + cellSize) / 4, wallThickness, cellSize, doorSide, baseColor);
          addBox("wallsX", xFace, yCenter + (doorHeight + cellSize) / 4, zCenter, wallThickness, headerHeight, doorWidth, baseColor);
          addFrameX(xFace, yCenter - cellSize / 2 + doorHeight / 2, zCenter, 0x50cce0);
        }
        function addFaceZ(xCenter, yCenter, zFace, opening, color) {
          const baseColor = color || 0x263e4a;
          if (!opening) {
            addBox("wallsZ", xCenter, yCenter, zFace, cellSize, cellSize, wallThickness, baseColor);
            return;
          }
          addBox("wallsZ", xCenter - (doorWidth + cellSize) / 4, yCenter, zFace, doorSide, cellSize, wallThickness, baseColor);
          addBox("wallsZ", xCenter + (doorWidth + cellSize) / 4, yCenter, zFace, doorSide, cellSize, wallThickness, baseColor);
          addBox("wallsZ", xCenter, yCenter + (doorHeight + cellSize) / 4, zFace, doorWidth, headerHeight, wallThickness, baseColor);
          addFrameZ(xCenter, yCenter - cellSize / 2 + doorHeight / 2, zFace, 0x50cce0);
        }
        function addHatch(bucket, x, y, z, color) {
          const span = cellSize - wallThickness;
          const side = (span - hatchSize) / 2;
          addBox(bucket, x - (hatchSize + span) / 4, y, z, side, wallThickness, span, color);
          addBox(bucket, x + (hatchSize + span) / 4, y, z, side, wallThickness, span, color);
          addBox(bucket, x, y, z - (hatchSize + span) / 4, hatchSize, wallThickness, side, color);
          addBox(bucket, x, y, z + (hatchSize + span) / 4, hatchSize, wallThickness, side, color);
        }

        maze.cells.forEach((cell) => {
          const p = cellWorld(cell);
          const floorY = p.y - roomHalf + wallThickness / 2;
          const ceilingY = p.y + roomHalf - wallThickness / 2;
          const floorColor = ((cell.x + cell.z + cell.y) & 1) ? 0x102632 : 0x142d39;
          if (cell.open.yn) addHatch("floor", p.x, floorY, p.z, floorColor);
          else addBox("floor", p.x, floorY, p.z, cellSize - wallThickness, wallThickness, cellSize - wallThickness, floorColor);
          if (cell.open.yp) addHatch("ceiling", p.x, ceilingY, p.z, 0x1a3440);
          else addBox("ceiling", p.x, ceilingY, p.z, cellSize - wallThickness, wallThickness, cellSize - wallThickness, 0x152a34);

          const leftDoor = cell.x < nx - 1 && !!cell.open.xp;
          addFaceX(p.x + roomHalf, p.y, p.z, leftDoor, 0x263e4a);
          if (cell.x === 0) addFaceX(p.x - roomHalf, p.y, p.z, false, 0x263e4a);

          // The two map boundaries use the same openings as the 3D asteroid maze:
          // entrance at the initial cell and the gold Ring at the far exit cell.
          if (cell.z === 0) {
            const entranceDoor = cell.x === 0 && cell.y === 1;
            addFaceZ(p.x, p.y, p.z + roomHalf, entranceDoor, 0x263e4a);
            if (entranceDoor) addFrameZ(p.x, p.y - roomHalf + doorHeight / 2, p.z + roomHalf, 0xf1c66e);
          }
          if (cell.z < nz - 1) {
            const open = !!cell.open.zp;
            addFaceZ(p.x, p.y, p.z - roomHalf, open, 0x263e4a);
          } else {
            const ringGate = cell.x === nx - 1 && cell.y === 1;
            addFaceZ(p.x, p.y, p.z - roomHalf, ringGate, 0x263e4a);
            if (ringGate) addFrameZ(p.x, p.y - roomHalf + doorHeight / 2, p.z - roomHalf, 0xf1c66e);
          }

          if (cell.open.yp || cell.open.yn) {
            const ladderX = p.x + 1.55;
            addBox("ladders", ladderX - 0.35, p.y, p.z, 0.08, cellSize * 0.58, 0.08, 0x69d9e8);
            addBox("ladders", ladderX + 0.35, p.y, p.z, 0.08, cellSize * 0.58, 0.08, 0x69d9e8);
            for (let rung = 0; rung < 5; rung += 1) {
              addBox("ladders", ladderX, p.y - 1.1 + rung * 0.55, p.z, 0.72, 0.07, 0.08, 0xd4b66e);
            }
          }

          // Stable seed-derived platforms make the room a small parkour stage without
          // altering the actual graph links or the existing crystal locations.
          const roomRng = randomFrom(hashSeed(String(seed) + ":ring-platform:" + cell.x + ":" + cell.y + ":" + cell.z));
          if (roomRng() < 0.32) {
            const dx = roomRng() < 0.5 ? -1.18 : 1.18;
            const dz = roomRng() < 0.5 ? -0.72 : 0.72;
            const platformHeight = 1.18 + roomRng() * 0.42;
            addBox("platforms", p.x + dx, floorY + platformHeight - 0.08, p.z + dz, 1.7, 0.16, 1.9, 0x3a626d);
            platforms.push({
              x: cell.x, y: cell.y, z: cell.z,
              worldX: p.x + dx, worldZ: p.z + dz,
              topHeight: platformHeight,
              halfX: 0.85, halfZ: 0.95
            });
          }
        });

        const box = new THREE.Object3D();
        const createBatch = (name, items, material, visible = true) => {
          if (!items.length) return null;
          const mesh = new THREE.InstancedMesh(boxGeometry, material, items.length);
          mesh.name = name;
          mesh.frustumCulled = false;
          for (let i = 0; i < items.length; i += 1) {
            const item = items[i];
            box.position.set(item.x, item.y, item.z);
            box.rotation.set(0, 0, 0);
            box.scale.set(item.sx, item.sy, item.sz);
            box.updateMatrix();
            mesh.setMatrixAt(i, box.matrix);
            if (mesh.setColorAt) mesh.setColorAt(i, new THREE.Color(item.color));
          }
          mesh.instanceMatrix.needsUpdate = true;
          mesh.visible = visible;
          mesh.userData = mesh.userData || {};
          mesh.userData.bcmLaneItems = items;
          mesh.userData.bcmLaneKey = "";
          world.add(mesh);
          return mesh;
        };
        const floorsMesh = createBatch("ring-room-floors", buckets.floor, floorMat);
        const ceilingsMesh = createBatch("ring-room-ceilings", buckets.ceiling, ceilingMat);
        const wallsX = createBatch("ring-room-side-walls-x", buckets.wallsX, wallMat);
        const wallsZ = createBatch("ring-room-side-walls-z", buckets.wallsZ, wallMat);
        const framesX = createBatch("ring-room-door-frames-x", buckets.framesX, frameMat);
        const framesZ = createBatch("ring-room-door-frames-z", buckets.framesZ, frameMat);
        const platformsMesh = createBatch("ring-room-platforms", buckets.platforms, platformMat);
        const laddersMesh = createBatch("ring-room-ladders", buckets.ladders, ladderMat);

        const coreMeshes = [];
        const coreGeometry = new THREE.OctahedronGeometry(0.42, 0);
        const coreMaterial = new THREE.MeshStandardMaterial({
          color: 0x62f0df, emissive: 0x0e6d6b, emissiveIntensity: 0.75,
          roughness: 0.26, metalness: 0.4
        });
        (maze.crystals || []).forEach((crystal, index) => {
          if (!crystal.cell) { coreMeshes[index] = null; return; }
          const p = cellWorld(crystal.cell);
          const mesh = new THREE.Mesh(coreGeometry, coreMaterial);
          mesh.name = "ring-2d-core-" + index;
          mesh.position.set(p.x, floorYForCell(crystal.cell.y) + 1.05, p.z);
          mesh.visible = !crystal.taken;
          world.add(mesh);
          coreMeshes[index] = mesh;
        });
        const ringGeometry = new THREE.TorusGeometry(0.88, 0.13, 8, 26);
        const ringMaterial = new THREE.MeshStandardMaterial({
          color: 0xeac56f, emissive: 0x83531a, emissiveIntensity: 0.8,
          roughness: 0.24, metalness: 0.65
        });
        const ringMarker = new THREE.Mesh(ringGeometry, ringMaterial);
        const ringPos = cellWorld(ringCell);
        ringMarker.position.set(ringPos.x, floorYForCell(ringCell.y) + 0.95, ringPos.z);
        ringMarker.rotation.x = Math.PI / 2;
        world.add(ringMarker);

        const exitMarker = new THREE.Mesh(
          new THREE.TorusGeometry(0.7, 0.1, 7, 24),
          new THREE.MeshStandardMaterial({ color: 0x75e6ed, emissive: 0x1b6b78, emissiveIntensity: 0.9 })
        );
        const exitPos = cellWorld(exitCell);
        exitMarker.position.set(exitPos.x, floorYForCell(exitCell.y) + 0.9, exitPos.z);
        exitMarker.rotation.x = Math.PI / 2;
        world.add(exitMarker);
        scene.add(world);

        return {
          group: world, floorsMesh, ceilingsMesh, wallsX, wallsZ, framesX, framesZ,
          platformsMesh, laddersMesh, platforms, coreMeshes, boxGeometry,
          materials: [wallMat, floorMat, ceilingMat, frameMat, platformMat, ladderMat, coreMaterial, ringMaterial, exitMarker.material],
          specialGeometry: [coreGeometry, ringGeometry, exitMarker.geometry],
          ringMarker, exitMarker
        };
      }

      const worldState = buildRingWorld();

      function setMeshLane(mesh, axis, laneIndex, floorIndex) {
        if (!mesh || !mesh.userData?.bcmLaneItems) return;
        const laneKey = axis + ":" + laneIndex + ":floor:" + floorIndex;
        if (mesh.userData.bcmLaneKey === laneKey) return;
        const items = mesh.userData.bcmLaneItems;
        const matrix = new THREE.Matrix4();
        const position = new THREE.Vector3();
        const scale = new THREE.Vector3();
        const rotation = new THREE.Quaternion();
        for (let i = 0; i < items.length; i += 1) {
          const item = items[i];
          const itemLane = axis === "z"
            ? Math.round((nz - 1) / 2 - (item.z - maze.center.z) / cellSize)
            : Math.round((item.x - maze.center.x) / cellSize + (nx - 1) / 2);
          const itemFloor = Math.round((item.y - maze.center.y) / cellSize + (ny - 1) / 2);
          const visible = itemLane === laneIndex && itemFloor === floorIndex;
          position.set(item.x, item.y, item.z);
          scale.set(visible ? item.sx : 0, visible ? item.sy : 0, visible ? item.sz : 0);
          matrix.compose(position, rotation, scale);
          mesh.setMatrixAt(i, matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        mesh.userData.bcmLaneKey = laneKey;
      }

      function updateRoomSlice(player) {
        const axis = player.orientation === 0 ? "z" : "x";
        const lane = player.orientation === 0 ? player.z : player.x;
        setMeshLane(worldState.floorsMesh, axis, lane, player.y);
        setMeshLane(worldState.ceilingsMesh, axis, lane, player.y);
        setMeshLane(worldState.platformsMesh, axis, lane, player.y);
        setMeshLane(worldState.laddersMesh, axis, lane, player.y);
        setMeshLane(worldState.framesX, axis, lane, player.y);
        setMeshLane(worldState.framesZ, axis, lane, player.y);
        setMeshLane(worldState.wallsX, axis, lane, player.y);
        setMeshLane(worldState.wallsZ, axis, lane, player.y);
        if (worldState.wallsX) worldState.wallsX.visible = player.orientation === 0;
        if (worldState.wallsZ) worldState.wallsZ.visible = player.orientation === 1;
        if (worldState.framesX) worldState.framesX.visible = player.orientation === 0;
        if (worldState.framesZ) worldState.framesZ.visible = player.orientation === 1;
        for (let i = 0; i < worldState.coreMeshes.length; i += 1) {
          const crystal = maze.crystals[i];
          const sameSlice = !!crystal?.cell && crystal.cell.y === player.y &&
            crystal.cell[axis] === lane;
          if (worldState.coreMeshes[i]) worldState.coreMeshes[i].visible = sameSlice && !crystal.taken;
        }
        worldState.ringMarker.visible = ringCell.y === player.y && ringCell[axis] === lane;
        worldState.exitMarker.visible = exitCell.y === player.y && exitCell[axis] === lane;
      }

      maze.group.visible = false;
      if (runtime.ship.visual) runtime.ship.visual.visible = false;
      const oldBackground = scene.background;
      scene.background = new THREE.Color(0x030812);

      const old = document.getElementById("bcm-ring-platformer-old");
      if (old) old.remove();

      const cameraOne = new THREE.OrthographicCamera(-5, 5, 4.6, -4.6, 0.1, 500);
      const cameraTwo = new THREE.OrthographicCamera(-5, 5, 4.6, -4.6, 0.1, 500);
      const cameraFocus = cellWorld(ringCell);
      const savedPlayerVisualState = [];
      let width = 1, height = 1;

      const textureLoader = new THREE.TextureLoader();
      function fallbackCrewTexture(index) {
        const portrait = document.createElement("canvas");
        portrait.width = 64; portrait.height = 96;
        const ctx = portrait.getContext("2d");
        ctx.fillStyle = playerColors[index]; ctx.beginPath(); ctx.arc(32, 18, 11, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#e8d9bb"; ctx.fillRect(22, 30, 20, 12);
        ctx.fillStyle = playerColors[index]; ctx.fillRect(16, 39, 32, 32);
        ctx.fillStyle = "#1a2730"; ctx.fillRect(18, 71, 11, 22); ctx.fillRect(35, 71, 11, 22);
        return new THREE.CanvasTexture(portrait);
      }

      function makePlayerSprite(player) {
        let texture = null;
        const imageUrl = String(crewSelection[player.index]?.image || "");
        if (imageUrl && window.BCMTowerAPI?.makeCrewSpriteTexture) {
          try { texture = window.BCMTowerAPI.makeCrewSpriteTexture(imageUrl); } catch (e) {}
        }
        if (!texture && imageUrl) {
          try { texture = textureLoader.load(imageUrl); } catch (e) {}
        }
        if (!texture) texture = fallbackCrewTexture(player.index);
        if (texture.colorSpace !== undefined && THREE.SRGBColorSpace !== undefined) texture.colorSpace = THREE.SRGBColorSpace;
        const material = new THREE.SpriteMaterial({
          map: texture, transparent: true, alphaTest: 0.035, depthWrite: false
        });
        const sprite = new THREE.Sprite(material);
        sprite.name = "ring-crew-sprite-" + (player.index + 1);
        sprite.scale.set(1.18, 1.78, 1);
        sprite.renderOrder = 8;
        worldState.group.add(sprite);
        player.sprite = sprite;
        player.spriteMaterial = material;
      }

      function cellPositionOf(player) { return cellWorld({ x: player.x, y: player.y, z: player.z }); }
      function playerWorldPosition(player) {
        const p = cellPositionOf(player);
        const floorY = floorYForCell(player.y);
        if (player.orientation === 0) {
          return { x: p.x + player.localX, y: floorY + 0.98 + player.jumpHeight, z: p.z + 0.72 };
        }
        return { x: p.x + 0.72, y: floorY + 0.98 + player.jumpHeight, z: p.z - player.localX };
      }
      function updatePlayerSprite(player) {
        if (!player.sprite) return;
        const p = playerWorldPosition(player);
        player.sprite.position.set(p.x, p.y, p.z);
        player.sprite.scale.x = player.facing < 0 ? -1.18 : 1.18;
        player.sprite.visible = true;
      }

      function createPlayer(index, spawn) {
        const crew = crewSelection[index] || {};
        const player = {
          index,
          name: String(crew.name || crew.displayName || ("Crew " + (index + 1))),
          x: spawn.x, y: spawn.y, z: spawn.z,
          localX: Number(spawn.localX) || 0, jumpHeight: 0, vy: 0, grounded: true, supportPlatform: null,
          orientation: 0, facing: 1, turnReadyAt: 0, lastActionAt: 0,
          wasJumpDown: false, padTurnUpWasDown: false, padTurnDownWasDown: false,
          padFloorUpWasDown: false, padFloorDownWasDown: false,
          image: crewImages[index] || null, tint: playerColors[index], moves: 0,
          sprite: null, spriteMaterial: null
        };
        makePlayerSprite(player);
        return player;
      }

      function getInput(player) {
        const index = player.index;
        const keys = keyboardInputs[index] || {};
        const touch = touchInputs[index] || {};
        const pad = padInputs[index] || {};
        return {
          left: !!(keys.left || touch.left || pad.left),
          right: !!(keys.right || touch.right || pad.right),
          jump: !!(keys.jump || touch.jump || pad.jump)
        };
      }

      function updateHud(message) {
        countEl.textContent = "ЯДРА " + Math.max(0, maze.count || 0) + "/3";
        const p1 = players[0];
        const p2 = players[1];
        if (p1) {
          floorEl.textContent = "P1: ЭТАЖ " + (p1.y + 1) +
            (p2 ? " · P2: ЭТАЖ " + (p2.y + 1) : "") +
            " · SEED " + seed + (splitActive ? " · SPLIT" : " · SHARED");
        } else {
          floorEl.textContent = "ЭТАЖ " + (ringCell.y + 1) + " · SEED " + seed;
        }
        if (message) {
          statusEl.textContent = message;
          return;
        }
        if (lastHudCount !== Number(maze.count || 0)) {
          lastHudCount = Number(maze.count || 0);
          statusEl.textContent = maze.count >= 3
            ? "ЯДРА СОБРАНЫ · ВЕРНИСЬ ЧЕРЕЗ ТРИГГЕРЫ К ВХОДУ"
            : "ИССЛЕДУЙ КОМНАТЫ · ЯДЕР ОСТАЛОСЬ " + Math.max(0, 3 - maze.count);
        }
      }

      function syncCoreMeshes() {
        (maze.crystals || []).forEach((crystal, index) => {
          if (worldState.coreMeshes[index]) worldState.coreMeshes[index].visible = !crystal.taken;
        });
      }

      function collectAt(player) {
        if (Math.abs(player.localX) > 0.74 || player.jumpHeight > 0.6) return false;
        const crystal = (maze.crystals || []).find((item) =>
          !item.taken && item.cell &&
          item.cell.x === player.x && item.cell.y === player.y && item.cell.z === player.z
        );
        if (!crystal) return false;
        crystal.taken = true;
        if (crystal.mesh) crystal.mesh.visible = false;
        maze.count = Math.min(3, Number(maze.count || 0) + 1);
        syncCoreMeshes();
        updateHud("ЯДРО СОБРАНО · " + maze.count + "/3");
        return true;
      }

      function triggerTurn(player, direction) {
        const now = performance.now();
        if (!gameStarted || done || now < player.turnReadyAt) return false;
        if (Math.abs(player.localX) > 1.28) {
          updateHud("ПОВОРОТ · ПОДОЙДИ К ДВЕРНОМУ ТРИГГЕРУ В ЦЕНТРЕ");
          return false;
        }
        const cell = getCell(player.x, player.y, player.z);
        if (!cell) return false;
        let flag, dx = 0, dz = 0;
        if (player.orientation === 0) {
          flag = direction === "turnUp" ? "zn" : "zp";
          dz = direction === "turnUp" ? -1 : 1;
        } else {
          flag = direction === "turnUp" ? "xp" : "xn";
          dx = direction === "turnUp" ? 1 : -1;
        }
        if (!cell.open[flag] || !getCell(player.x + dx, player.y, player.z + dz)) {
          updateHud("СТЕНА · ИЩИ ДРУГОЙ ДВЕРНОЙ ТРИГГЕР");
          return false;
        }
        player.x += dx;
        player.z += dz;
        player.orientation = player.orientation === 0 ? 1 : 0;
        player.localX = 0;
        player.supportPlatform = null;
        player.turnReadyAt = now + 260;
        player.moves += 1;
        collectAt(player);
        updateHud("РАЗВОРОТ · КАМЕРА ПЕРЕШЛА В СОСЕДНЮЮ СЕКЦИЮ");
        checkFinish(player);
        return true;
      }

      function triggerFloor(player, direction) {
        const now = performance.now();
        if (!gameStarted || done || now < player.turnReadyAt) return false;
        if (Math.abs(player.localX) > 1.05) {
          updateHud("ЛЕСТНИЦА · ПОДОЙДИ К ВЕРТИКАЛЬНОМУ ТРИГГЕРУ");
          return false;
        }
        const cell = getCell(player.x, player.y, player.z);
        const flag = direction === "floorUp" ? "yp" : "yn";
        const dy = direction === "floorUp" ? 1 : -1;
        if (!cell || !cell.open[flag] || !getCell(player.x, player.y + dy, player.z)) {
          updateHud("ЗДЕСЬ НЕТ ЛЕСТНИЦЫ · ПРОВЕРЬ КАРТУ");
          return false;
        }
        player.y += dy;
        player.localX = 0;
        player.jumpHeight = 0;
        player.vy = 0;
        player.grounded = true;
        player.supportPlatform = null;
        player.turnReadyAt = now + 340;
        player.moves += 1;
        collectAt(player);
        updateHud("ЭТАЖ " + (player.y + 1) + " · ПЕРЕХОД ПО ЛЕСТНИЦЕ");
        checkFinish(player);
        return true;
      }

      function checkFinish(player) {
        if (maze.count < 3 || player.x !== exitCell.x || player.y !== exitCell.y ||
            player.z !== exitCell.z || Math.abs(player.localX) > 0.72 || player.jumpHeight > 0.45) return false;
        finishRingPlatformer(maze, true);
        return true;
      }

      function triggerAction(index, action) {
        const player = players[index];
        if (!player || !gameStarted || done) return false;
        if (action === "turnUp" || action === "turnDown") return triggerTurn(player, action);
        if (action === "floorUp" || action === "floorDown") return triggerFloor(player, action);
        return false;
      }

      function keyboardMove(event) {
        if (done) return;
        const down = event.type === "keydown";
        if (down && event.code === "Escape") {
          event.preventDefault();
          event.stopImmediatePropagation();
          finishRingPlatformer(maze, false);
          return;
        }
        const p1 = {
          ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
          Space: "jump"
        };
        const p2 = {
          KeyJ: "left", KeyL: "right", KeyP: "jump"
        };
        let index = 0;
        let action = p1[event.code] || null;
        if (!action && mode === "multi") {
          action = p2[event.code] || null;
          if (action) index = 1;
        }
        const isP1TurnUp = event.code === "ArrowUp" || event.code === "KeyW";
        const isP1TurnDown = event.code === "ArrowDown" || event.code === "KeyS";
        const isP2TurnUp = event.code === "KeyI";
        const isP2TurnDown = event.code === "KeyK";
        const floorUp = event.code === "KeyE" || (mode === "multi" && event.code === "KeyO");
        const floorDown = event.code === "KeyQ" || (mode === "multi" && event.code === "KeyU");
        if (!action && (isP1TurnUp || isP1TurnDown || isP2TurnUp || isP2TurnDown || floorUp || floorDown)) {
          if (mode === "multi" && (isP2TurnUp || isP2TurnDown || (event.code === "KeyO" || event.code === "KeyU"))) index = 1;
          if (isP1TurnUp || isP2TurnUp) action = "turnUp";
          else if (isP1TurnDown || isP2TurnDown) action = "turnDown";
          else if (floorUp) action = "floorUp";
          else if (floorDown) action = "floorDown";
          if (down && !event.repeat) {
            event.preventDefault();
            event.stopImmediatePropagation();
            triggerAction(index, action);
          }
          return;
        }
        if (!action || index >= (mode === "multi" ? 2 : 1)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        keyboardInputs[index][action] = down;
      }

      function pollGamepads() {
        if (!gameStarted || done || !navigator.getGamepads) return;
        const connected = [...navigator.getGamepads()].filter((pad) => pad && pad.connected);
        const assignment = mode === "multi"
          ? (connected.length > 1 ? [connected[0], connected[1]] : [null, connected[0] || null])
          : [connected[0] || null];
        for (let i = 0; i < 2; i += 1) {
          const pad = assignment[i];
          const statePad = padInputs[i] = {};
          if (!pad || !players[i]) continue;
          const axisX = Number(pad.axes?.[0] || 0);
          const axisY = Number(pad.axes?.[1] || 0);
          statePad.left = !!(pad.buttons?.[14]?.pressed || axisX < -0.42);
          statePad.right = !!(pad.buttons?.[15]?.pressed || axisX > 0.42);
          statePad.turnUp = !!(pad.buttons?.[12]?.pressed || axisY < -0.58);
          statePad.turnDown = !!(pad.buttons?.[13]?.pressed || axisY > 0.58);
          statePad.floorUp = !!pad.buttons?.[5]?.pressed;
          statePad.floorDown = !!pad.buttons?.[4]?.pressed;
          statePad.jump = !!pad.buttons?.[0]?.pressed;
          if (statePad.turnUp && !previousPad[i].turnUp) triggerAction(i, "turnUp");
          if (statePad.turnDown && !previousPad[i].turnDown) triggerAction(i, "turnDown");
          if (statePad.floorUp && !previousPad[i].floorUp) triggerAction(i, "floorUp");
          if (statePad.floorDown && !previousPad[i].floorDown) triggerAction(i, "floorDown");
          previousPad[i] = {
            turnUp: statePad.turnUp, turnDown: statePad.turnDown,
            floorUp: statePad.floorUp, floorDown: statePad.floorDown
          };
        }
      }

      function updatePlayers(dt) {
        pollGamepads();
        for (const player of players) {
          const input = getInput(player);
          const direction = (input.right ? 1 : 0) - (input.left ? 1 : 0);
          if (direction !== 0) {
            player.localX += direction * 4.15 * dt;
            player.facing = direction;
            player.moves += Math.abs(direction) * dt;
          }

          const edge = roomHalf;
          if (player.localX > edge || player.localX < -edge) {
            const side = player.localX > 0 ? 1 : -1;
            const cell = getCell(player.x, player.y, player.z);
            const flag = player.orientation === 0
              ? (side > 0 ? "xp" : "xn")
              : (side > 0 ? "zp" : "zn");
            let dx = 0, dz = 0;
            if (player.orientation === 0) dx = side;
            else dz = side;
            if (cell && cell.open[flag] && getCell(player.x + dx, player.y, player.z + dz)) {
              player.x += dx;
              player.z += dz;
              player.localX -= side * cellSize;
              player.turnReadyAt = performance.now() + 120;
              player.supportPlatform = null;
              collectAt(player);
              checkFinish(player);
            } else {
              player.localX = side * (roomHalf - 0.55);
            }
          }

          const pWorld = playerWorldPosition(player);
          const previousHeight = player.jumpHeight;
          if (input.jump && !player.wasJumpDown && player.grounded) {
            player.vy = 5.1;
            player.grounded = false;
            player.supportPlatform = null;
          }
          player.wasJumpDown = input.jump;

          if (!player.grounded) {
            player.vy -= 12.5 * dt;
            player.jumpHeight = Math.max(-0.3, player.jumpHeight + player.vy * dt);
            const floorY = floorYForCell(player.y);
            const currentWorld = playerWorldPosition(player);
            const landed = worldState.platforms.find((platform) =>
              platform.x === player.x && platform.y === player.y && platform.z === player.z &&
              player.vy <= 0 &&
              previousHeight > platform.topHeight && player.jumpHeight <= platform.topHeight &&
              Math.abs(currentWorld.x - platform.worldX) <= platform.halfX &&
              Math.abs(currentWorld.z - platform.worldZ) <= platform.halfZ
            );
            if (landed) {
              player.jumpHeight = landed.topHeight;
              player.vy = 0;
              player.grounded = true;
              player.supportPlatform = landed;
            } else if (player.jumpHeight <= 0) {
              player.jumpHeight = 0;
              player.vy = 0;
              player.grounded = true;
              player.supportPlatform = null;
            }
          } else if (player.supportPlatform) {
            const platform = player.supportPlatform;
            const currentWorld = playerWorldPosition(player);
            if (Math.abs(currentWorld.x - platform.worldX) > platform.halfX ||
                Math.abs(currentWorld.z - platform.worldZ) > platform.halfZ) {
              player.grounded = false;
              player.vy = 0;
              player.supportPlatform = null;
            }
          }

          if (player.grounded && player.jumpHeight < 0.05) player.jumpHeight = 0;
          collectAt(player);
          updatePlayerSprite(player);
        }
      }

      function updateSplitState() {
        if (mode !== "multi" || players.length < 2) { splitActive = false; return; }
        const a = playerWorldPosition(players[0]);
        const b = playerWorldPosition(players[1]);
        const distance = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
        // Room-adjacent Crew can still share one camera; different floors or
        // different room facing require independent views.
        const samePlane = players[0].y === players[1].y &&
          players[0].orientation === players[1].orientation &&
          (players[0].orientation === 0
            ? players[0].z === players[1].z
            : players[0].x === players[1].x);
        if (!splitActive && (!samePlane || distance > cellSize * 1.62)) splitActive = true;
        else if (splitActive && samePlane && distance < cellSize * 1.22) splitActive = false;
        const landscape = width >= height;
        splitDivider.hidden = !splitActive;
        splitDivider.style.border = splitActive ? "1px solid rgba(115,203,225,.45)" : "0";
        splitDivider.style.background = "transparent";
        if (splitActive) {
          splitDivider.style.borderTop = landscape ? "0" : "2px solid rgba(115,203,225,.75)";
          splitDivider.style.borderLeft = landscape ? "2px solid rgba(115,203,225,.75)" : "0";
        } else {
          splitDivider.style.border = "0";
        }
      }

      function configureCamera(camera, viewport, center, orientation) {
        const halfHeight = Math.max(3.7, Math.min(4.7, cellSize * 0.82));
        const aspect = Math.max(0.3, viewport.w / Math.max(1, viewport.h));
        camera.left = -halfHeight * aspect;
        camera.right = halfHeight * aspect;
        camera.top = halfHeight;
        camera.bottom = -halfHeight;
        camera.near = 0.1;
        camera.far = 500;
        camera.updateProjectionMatrix();
        camera.up.set(0, 1, 0);
        if (orientation === 0) {
          camera.position.set(center.x, center.y + 0.55, center.z + cellSize * 2.05);
          camera.lookAt(center.x, center.y, center.z);
        } else {
          camera.position.set(center.x + cellSize * 2.05, center.y + 0.55, center.z);
          camera.lookAt(center.x, center.y, center.z);
        }
      }

      function cameraTargetFor(player) {
        const p = playerWorldPosition(player);
        return { x: p.x, y: p.y - 0.1, z: p.z };
      }

      function renderRingViews(frameContext) {
        if (!state.ringPlatformer || !state.ringRenderState || done) return false;
        const renderer = frameContext && frameContext.renderer;
        const activeScene = frameContext && frameContext.scene;
        if (!renderer || !activeScene || !players.length) {
          const previewPlayer = { x: ringCell.x, y: ringCell.y, z: ringCell.z, localX: 0, jumpHeight: 0, orientation: 0, index: 0 };
          updateRoomSlice(previewPlayer);
          const defaultPos = cellWorld(ringCell);
          configureCamera(cameraOne, { w: Math.max(1, root.clientWidth), h: Math.max(1, root.clientHeight) }, {
            x: defaultPos.x, y: floorYForCell(ringCell.y) + 1, z: defaultPos.z
          }, 0);
          if (renderer && activeScene) renderer.render(activeScene, cameraOne);
          return true;
        }
        const viewW = Math.max(1, root.clientWidth);
        const viewH = Math.max(1, root.clientHeight);
        const oldAutoClear = renderer.autoClear;
        renderer.autoClear = false;
        renderer.setScissorTest(true);
        const landscape = viewW >= viewH;
        let views;
        if (splitActive && mode === "multi" && players.length > 1) {
          const half = Math.floor((landscape ? viewW : viewH) / 2);
          views = landscape
            ? [
                { x: 0, y: 0, w: half, h: viewH, player: players[0], camera: cameraOne },
                { x: half, y: 0, w: viewW - half, h: viewH, player: players[1], camera: cameraTwo }
              ]
            : [
                { x: 0, y: Math.floor(viewH / 2), w: viewW, h: viewH - Math.floor(viewH / 2), player: players[0], camera: cameraOne },
                { x: 0, y: 0, w: viewW, h: Math.floor(viewH / 2), player: players[1], camera: cameraTwo }
              ];
        } else {
          let target = cameraTargetFor(players[0]);
          if (mode === "multi" && players[1]) {
            const other = cameraTargetFor(players[1]);
            target = { x: (target.x + other.x) * 0.5, y: (target.y + other.y) * 0.5, z: (target.z + other.z) * 0.5 };
          }
          views = [{ x: 0, y: 0, w: viewW, h: viewH, player: players[0], camera: cameraOne, shared: true, target }];
        }

        for (const view of views) {
          const p = view.player;
          let target;
          if (view.shared) {
            target = view.target;
          } else {
            target = cameraTargetFor(p);
          }
          configureCamera(view.camera, view, target, p.orientation);
          // Hide the wall plane facing the camera to get Tower-like cutaway rooms;
          // toggle synchronously per viewport so different orientations work in split-screen.
          updateRoomSlice(p);
          renderer.setViewport(view.x, view.y, view.w, view.h);
          renderer.setScissor(view.x, view.y, view.w, view.h);
          renderer.clear(true, true, true);
          renderer.render(activeScene, view.camera);
        }
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, viewW, viewH);
        if (worldState.wallsX) worldState.wallsX.visible = true;
        if (worldState.wallsZ) worldState.wallsZ.visible = true;
        if (worldState.framesX) worldState.framesX.visible = true;
        if (worldState.framesZ) worldState.framesZ.visible = true;
        renderer.autoClear = oldAutoClear;
        return true;
      }

      function drawMiniMap() {
        if (done || !g) return;
        g.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        g.clearRect(0, 0, mapWidth, mapHeight);
        const bg = g.createLinearGradient(0, 0, mapWidth, mapHeight);
        bg.addColorStop(0, "#081826"); bg.addColorStop(1, "#02070d");
        g.fillStyle = bg; g.fillRect(0, 0, mapWidth, mapHeight);
        const floor = players.length ? players[0].y : ringCell.y;
        const pad = 7;
        const cell = Math.max(8, Math.min(24, Math.floor(Math.min(mapWidth - pad * 2, mapHeight - pad * 2) / Math.max(nx, nz))));
        const x0 = Math.floor((mapWidth - cell * nx) / 2);
        const y0 = Math.floor((mapHeight - cell * nz) / 2);
        const floorCells = maze.cells.filter((c) => c.y === floor);
        floorCells.forEach((c) => {
          const x = x0 + c.x * cell, y = y0 + c.z * cell;
          g.fillStyle = ((c.x + c.z) & 1) ? "#102532" : "#0c1e29";
          g.fillRect(x + 1, y + 1, cell - 2, cell - 2);
        });
        g.lineWidth = Math.max(1.2, cell * 0.095);
        g.lineCap = "square";
        g.strokeStyle = "#4fa9be";
        floorCells.forEach((c) => {
          const x = x0 + c.x * cell, y = y0 + c.z * cell;
          g.beginPath();
          if (c.x === 0) { g.moveTo(x, y); g.lineTo(x, y + cell); }
          if (c.x === nx - 1 || !c.open.xp) { g.moveTo(x + cell, y); g.lineTo(x + cell, y + cell); }
          if (c.z === 0 && !(c.x === 0 && c.y === 1)) { g.moveTo(x, y); g.lineTo(x + cell, y); }
          if (c.z === nz - 1 && !(c.x === nx - 1 && c.y === 1)) { g.moveTo(x, y + cell); g.lineTo(x + cell, y + cell); }
          if (c.z < nz - 1 && !c.open.zp) { g.moveTo(x, y + cell); g.lineTo(x + cell, y + cell); }
          g.stroke();
        });
        (maze.crystals || []).forEach((crystal) => {
          if (!crystal.taken && crystal.cell && crystal.cell.y === floor) {
            const x = x0 + (crystal.cell.x + 0.5) * cell, y = y0 + (crystal.cell.z + 0.5) * cell;
            g.fillStyle = "#5af3df"; g.beginPath(); g.arc(x, y, Math.max(2, cell * 0.13), 0, Math.PI * 2); g.fill();
          }
        });
        players.forEach((player) => {
          if (player.y !== floor) return;
          const x = x0 + (player.x + 0.5) * cell, y = y0 + (player.z + 0.5) * cell;
          g.fillStyle = playerColors[player.index]; g.shadowColor = playerColors[player.index]; g.shadowBlur = 7;
          g.beginPath(); g.arc(x, y, Math.max(3, cell * 0.18), 0, Math.PI * 2); g.fill();
          g.shadowBlur = 0;
        });
        g.fillStyle = "#b8d2de"; g.font = "10px system-ui"; g.textAlign = "left"; g.textBaseline = "top";
        g.fillText("КАРТА · ЭТАЖ " + (floor + 1), 7, 5);
      }

      function startMode(nextMode) {
        if (done) return;
        mode = nextMode === "multi" ? "multi" : "single";
        gameStarted = true;
        menu.hidden = true;
        menu.style.display = "none";
        // Begin side by side in the same room. This lets Multi start with a
        // shared camera; door turns/floor changes and distance decide when to split.
        const spawn1 = { x: ringCell.x, y: ringCell.y, z: ringCell.z, localX: 1.1 };
        const spawn2 = mode === "multi"
          ? { x: ringCell.x, y: ringCell.y, z: ringCell.z, localX: -1.1 }
          : null;
        players = [createPlayer(0, spawn1)];
        if (spawn2) players.push(createPlayer(1, spawn2));
        syncCoreMeshes();
        updateSplitState();
        updateHud(mode === "multi"
          ? "MULTI · P1 WASD/стрелки · P2 IJKL · Space/P прыжок · E/Q этаж"
          : "SINGLE · WASD/стрелки · Space прыжок · E/Q лестницы");
        resize2d();
        root2d.focus({ preventScroll: true });
      }

      function updateSplitState() {
        if (mode !== "multi" || players.length < 2) { splitActive = false; return; }
        const a = playerWorldPosition(players[0]);
        const b = playerWorldPosition(players[1]);
        const distance = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
        const samePlane = players[0].y === players[1].y &&
          players[0].orientation === players[1].orientation &&
          (players[0].orientation === 0 ? players[0].z === players[1].z : players[0].x === players[1].x);
        if (!splitActive && (!samePlane || distance > cellSize * 1.62)) splitActive = true;
        else if (splitActive && samePlane && distance < cellSize * 1.22) splitActive = false;
      }

      function updateViewportSize() {
        width = Math.max(1, root.clientWidth);
        height = Math.max(1, root.clientHeight);
        cameraOne.aspect = width / height;
        cameraTwo.aspect = width / height;
        updateSplitState();
        splitDivider.hidden = !splitActive;
        const landscape = width >= height;
        if (splitActive) {
          splitDivider.style.border = "0";
          splitDivider.style.borderLeft = landscape ? "2px solid rgba(115,203,225,.75)" : "0";
          splitDivider.style.borderTop = landscape ? "0" : "2px solid rgba(115,203,225,.75)";
        } else {
          splitDivider.style.border = "0";
        }
      }

      function frame(now) {
        if (done) return;
        const dt = frameStamp ? Math.min(0.05, Math.max(0.001, (now - frameStamp) / 1000)) : 1 / 60;
        frameStamp = now;
        updatePlayers(dt);
        updateSplitState();
        worldState.coreMeshes.forEach((mesh) => { if (mesh) mesh.rotation.y += dt * 0.9; });
        worldState.ringMarker.rotation.z += dt * 0.32;
        drawMiniMap();
        raf = requestAnimationFrame(frame);
      }

      function setActionFromPointer(button, action, down, event) {
        const index = Number(button.getAttribute("data-ring-player") || 0);
        if (!players[index]) return;
        if (oneShotActions.has(action)) {
          if (down) triggerAction(index, action);
          return;
        }
        touchInputs[index][action] = down;
        if (down && event && button.setPointerCapture) {
          try { button.setPointerCapture(event.pointerId); } catch (e) {}
        }
      }

      root2d.querySelectorAll("[data-ring-action]").forEach((button) => {
        const action = button.getAttribute("data-ring-action");
        button.style.cssText += ";pointer-events:auto;border:1px solid #426779;border-radius:10px;background:rgba(16,35,45,.96);color:#e8fbff;font-weight:900;touch-action:none";
        button.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          setActionFromPointer(button, action, true, event);
        });
        const stop = (event) => {
          if (!oneShotActions.has(action)) setActionFromPointer(button, action, false, event);
        };
        ["pointerup", "pointercancel", "lostpointercapture"].forEach((name) => button.addEventListener(name, stop));
      });
      const closeButton = root2d.querySelector("[data-ring-exit]");
      closeButton.style.cssText += ";pointer-events:auto";
      closeButton.addEventListener("click", () => finishRingPlatformer(maze, false));
      root2d.querySelector("[data-ring-single]").addEventListener("click", () => startMode("single"));
      root2d.querySelector("[data-ring-multi]").addEventListener("click", () => startMode("multi"));
      window.addEventListener("keydown", keyboardMove, true);
      window.addEventListener("keyup", keyboardMove, true);
      window.addEventListener("blur", () => {
        keyboardInputs.forEach((entry) => Object.keys(entry).forEach((key) => { entry[key] = false; }));
        touchInputs.forEach((entry) => Object.keys(entry).forEach((key) => { entry[key] = false; }));
      });
      window.addEventListener("resize", resize2d);
      resize2d();

      state.ringRenderState = {
        worldState,
        scene,
        maze,
        oldMazeVisible: worldSaved.oldMazeVisible,
        oldShipVisible: worldSaved.oldShipVisible,
        oldBackground,
        runtime
      };
      window.BCMDeepSpaceWarpRender = renderRingViews;

      state.ringPlatformerCleanup = () => {
        done = true;
        if (raf) cancelAnimationFrame(raf);
        window.removeEventListener("keydown", keyboardMove, true);
        window.removeEventListener("keyup", keyboardMove, true);
        window.removeEventListener("resize", resize2d);
        worldState.group.parent?.remove(worldState.group);
        worldState.group.traverse((object) => {
          if (object.geometry && object.geometry !== worldState.boxGeometry) {
            // Meshes share a small set of geometries; special crystal geometries are disposed below.
          }
        });
        try { worldState.boxGeometry.dispose(); } catch (e) {}
        worldState.specialGeometry.forEach((geometry) => { try { geometry.dispose(); } catch (e) {} });
        worldState.materials.forEach((material) => { try { material.dispose(); } catch (e) {} });
        players.forEach((player) => {
          if (player.sprite) worldState.group.remove(player.sprite);
          if (player.spriteMaterial) player.spriteMaterial.dispose();
        });
        maze.group.visible = worldSaved.oldMazeVisible;
        if (runtime.ship.visual) runtime.ship.visual.visible = worldSaved.oldShipVisible;
        scene.background = oldBackground;
        state.ringRenderState = null;
        window.BCMDeepSpaceWarpRender = null;
        splitDivider.remove();
        root2d.remove();
        syncHullButtonVisibility();
      };
      state.ringLastUpdate = 0;
      syncHullButtonVisibility();
      raf = requestAnimationFrame(frame);
      return true;
    }

    function finishRingPlatformer(maze, completed) {
      if (!state.ringPlatformer || !maze) return false;
      const success = completed === true;
      maze.ringCompleted = success;
      const cleanup = state.ringPlatformerCleanup;
      state.ringPlatformerCleanup = null;
      state.ringPlatformer = false;
      state.ringTransitionActive = false;
      if (typeof cleanup === "function") cleanup();
      stopRingAudio(true);
      const engine = api();
      if (engine && engine.pauseForWarp) engine.pauseForWarp(false);
      syncHullButtonVisibility();
      setMazeStatus(success
        ? "2D IN 3D · ROUTE COMPLETE · BACK IN THE ASTEROID MAZE"
        : "BACK IN THE ASTEROID MAZE · RING RUN PAUSED");
      return true;
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

      // Leaving the asteroid run makes that location the new return anchor.
      // Never restore the older Room 1 pose saved before the outward Warp.
      const engine = api();
      const runtime = engine && engine.getRuntime ? engine.getRuntime() : null;
      if (runtime && runtime.ship && runtime.ship.position && runtime.ship.quaternion) {
        state.returnPosition = runtime.ship.position.clone();
        const THREE = runtime.THREE;
        if (THREE && THREE.Vector3 && THREE.Quaternion) {
          const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(runtime.ship.quaternion);
          const yaw = Math.atan2(-forward.x, -forward.z);
          state.returnQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        } else {
          state.returnQuaternion = runtime.ship.quaternion.clone();
        }
      }

      const arrivedSector = state.target || (state.nav && state.nav.current);
      disposeMaze();
      window.BCMDeepSpaceWarpFrame = null;
      root.classList.remove("bcm-warp-maze-active", "is-tubing");
      exitButton.hidden = true;

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
      // Start at the old finish-line pace (8x) and accelerate to 64x by the end.
      return 8 * Math.pow(8, warpNormalizedTime(elapsed));
    }

    function warpCourseProgress(elapsed) {
      // 0..1 progress follows the 8x..64x flight profile.
      return (warpSpeedMultiplier(elapsed) / 8 - 1) / 7;
    }

    function warpObstacleProgress(elapsed) {
      // Hazards approach a little more briskly than the underlying tube. Keep
      // the same endpoints and use this curve for both drawing and collisions.
      return Math.pow(warpCourseProgress(elapsed), 0.86);
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
      const shimmerTime = Number(state.tubeShimmerTime || 0);
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
          const shimmer = Math.sin(shimmerTime * 1.35 + panel * 1.72 + step * 0.77 + playerAngle) * 0.5 + 0.5;
          const light = ((step + Math.floor(shimmerTime * 8) + panel * 3) % 5 === 0) ? 1 : 0;
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

      const routeProgress = warpObstacleProgress(state.elapsed);
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

      const progress = warpObstacleProgress(t);
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
      const speed = Math.max(8, Math.min(64,
        tubeSectionBlend(speedBySection, state.elapsed).value * 1.25 *
        rampMultiplier * (boosted ? 1.4 : 1)
      ));
      // Give the tube geometry a modestly faster sense of forward movement,
      // while keeping its established material shimmer tempo independent.
      state.tubeTravel += dt * speed * 1.12;
      state.tubeShimmerTime = Number(state.tubeShimmerTime || 0) + dt * speed;
      state.tubeRoll = Number(state.tubeRoll || 0) + dt * tubeSectionBlend(rollRates, state.elapsed).value * 0.45;
      const routeProgress = warpObstacleProgress(state.elapsed);

      let padX = 0;
      try {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = pads && [...pads].find((p) => p && p.connected);
        if (gp) {
          const axes = gp.axes || [];
          const button = (n) => !!(gp.buttons && gp.buttons[n] && gp.buttons[n].pressed);
          const leftStickX = Number(axes[0] || 0);
           const alternateStickX = Number(axes[2] || 0);
           const axis = Math.abs(leftStickX) > 0.18 ? leftStickX : alternateStickX;
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
      state.playerAngle = Number(state.playerAngle || 0) - steer * dt * 2.2;
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
          // Each obstacle is resolved exactly once; repeated hits progressively
          // damage a different compartment and can open an external breach.
          state.warpCollisionCount = Math.min(99, Number(state.warpCollisionCount || 0) + 1);
          const damage = Math.min(24, 4 + state.warpCollisionCount * 1.6);
          const compartmentId = ((state.warpCollisionCount - 1) % 3) + 1;
          const repair = window.BCMHullRepairState;
          if (repair && typeof repair.triggerExternalImpact === "function") {
            repair.triggerExternalImpact(compartmentId, damage);
          }
          tubeShield.style.width = state.shields + "%";
          tubeMeta.textContent = "SHIELDS " + state.shields + "% · HULL HITS " + state.warpCollisionCount;
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