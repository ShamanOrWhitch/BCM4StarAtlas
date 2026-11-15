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
      ringEnterButton.hidden = true;
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
      overlay.style.cssText = "position:fixed;inset:0;z-index:1001400;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#000;touch-action:manipulation;pointer-events:auto";
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
      const skip = document.createElement("button");
      skip.type = "button";
      const english = window.BCMDialogue?.language === "en";
      skip.textContent = english ? "ENTER THE RING" : "ВОЙТИ В RING";
      skip.setAttribute("aria-label", "Start the Ring level");
      skip.style.cssText = "position:absolute;left:50%;bottom:max(18px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:8;min-height:48px;min-width:180px;padding:10px 18px;border:1px solid #69d7ea;border-radius:12px;background:#123c48;color:#e8fbff;font:800 14px system-ui;letter-spacing:.06em;cursor:pointer;pointer-events:auto";
      skip.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        enterLevel();
      });
      overlay.appendChild(skip);
      // Do not skip the landing clip on any tap of the picture. It plays through,
      // then the Ring menu opens. The button is the only early entrance.
      try { window.BCMDialogue?.hideOperator?.(); } catch (e) {}
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
        if (!attemptOpenRingPlatformer(maze, true)) {
          state.ringPlatformer = false;
          // Keep a manual retry available, but don't retrigger the same failing
          // transition every frame. Clear this latch once the ship leaves the beacon.
          state.ringApproachArmed = true;
          state.ringEntryFailed = true;
          if (engine && engine.pauseForWarp) engine.pauseForWarp(false);
          stopRingAudio(true);
          setMazeStatus("RING ENTRY FAILED · ASTEROID RESTORED · PRESS RING BUTTON TO RETRY");
          try { console.error("Mini-Sim Ring transition ended, but the level did not initialize."); } catch (e) {}
          syncHullButtonVisibility();
          syncRingButtonVisibility();
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
      // The clip plays out or the pilot taps ENTER THE RING. Do not abort it
      // on a short timer: that dumped the ship back to the asteroid with no level.
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

    // Warp visuals are keyed to the actual Warp Drive slot size, not the ship hull's own size.
    // Small is the staged Class 2 preview for Opal Jetjet. When the selected ship's Galaxy
    // metadata is wired in, pass its slots.componentSlots Warp Drive size here.
    function warpVisualClassForSlotSize(slotSize) {
      const size = String(slotSize || "").trim().toLowerCase().replace(/[ _]+/g, "-");
      // Deliberately map the intense rail look to XX-Small; X-Small / Opal Jetjet
      // stays on the previously preferred standard shell until live slot data is wired.
      if (/^(xx-small|xxs)$/.test(size)) return 2;
      if (/^(x-small|xs|extra-small|small|s)$/.test(size)) return 1;
      if (/^(medium|m)$/.test(size)) return 3;
      if (/^(large|x-large|xx-large|capital|class-8|xl|xxl)$/.test(size)) return 3;
      return 1;
    }

    function currentWarpDriveSlotSize() {
      return String(config.warpDriveSlotSize || root.dataset.warpDriveSlotSize || "x-small").trim();
    }

    window.addEventListener("bcm:game-music-mute", (event) => {
      warpAudio.muted = !!event.detail?.muted;
      if (ringAudio) ringAudio.muted = !!event.detail?.muted;
    });
    window.addEventListener("keydown", (event) => {
      if (event.code !== "KeyU" || event.repeat ||
          !root.classList.contains("game-active") ||
          state.mode === "map" || state.mode === "tube" || state.mode === "result" ||
          state.ringPlatformer || state.ringTransitionActive || state.hullOpen) return;
      const towerRoot = document.querySelector(".bcm-tower");
      if (towerRoot && !towerRoot.hidden) return;
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
      // Explicit locale. Z alone cannot tell the asteroid (z ≈ 150) from Room 1.
      place: null,
      savedSpeedMode: null,
      sectorProgressed: false,
      elapsed: 0,
      tubeTravel: 0,
      tubeShimmerTime: 0,
      warpDriveSlotSize: currentWarpDriveSlotSize(),
      warpVisualClass: warpVisualClassForSlotSize(currentWarpDriveSlotSize()),
      warpPreviewClass: null,
      // Seed, из которого строится декоративный фон (не влияет на курс).
      tubeBackdropSeed: 0,
      // Перелив палитры: по умолчанию выключен, вид 0.14.0 сохраняется.
      warpPaletteFlow: false,
      warpPaletteMix: 0,
      warpPaletteTarget: 0,
      warpPalettePeriod: 11,
      // Качество рисуемой стенки: null = авто по замеру кадра.
      warpQualityTier: null,
      warpFrameMs: 0,
      warpSlowStreak: 0,
      // Сглаженный множитель направления: 1 = вперёд, -1 = назад.
      warpDirMix: 1,
      // Цикл фоновых сцен: выровнен по тактам, ~18 с (2 с переход + 16 с пауза).
      // 142 BPM — точный темп от владельца; такт 1.6901 с, цикл 11 тактов.
      warpBgBpm: 142,
      // Ритм сцены: случайный по умолчанию — пауза ~2 с, переход ~0.9 с,
      // каждый переход свой (вид, сила, следующая сцена). Тактовая сетка
      // осталась вторым режимом: BCMDeepSpaceWarpSetRandomCycle(false).
      warpBgRandom: true,
      warpBgHold: 2,
      warpBgSeed: 0x5F3A21C7,
      warpBgPower: 1.6,
      // Астероиды на стенке: плотность 0..1 (0 — выключить), seed поля.
      warpAsteroids: 1,
      warpAsteroidSeed: 20261116,
      warpBgCycle: true,
      warpBgIndex: 0,
      warpBgCells: null,
      // Обои seed: 'sketch' — векторные скетчи из assets/scetchs, 'procedural' —
      // генерация. При отсутствии файла скетч сам падает в процедурный фон.
      // Радужный перелив вместо перехода между двумя наборами цветов.
      warpRainbow: true,
      // Чем сменяется кадр фона: 'dissolve' — рассыпание (по умолчанию),
      // либо другой вид двери: iris / doors / blinds / spiral / sweep.
      warpTransition: "dissolve",
      warpTransitionAuto: false,
      warpTransitionStep: 0,
      warpTransitionFrom: -1,
      // Корабль: вид сзади. Спрайт (если игра его запечёт) важнее силуэта.
      warpShipSprite: null,
      warpShipSpec: "pearce-f4",
      // Ручной крен корабля (Q/E в третьем лице): радианы сверх кольцевого.
      warpShipRoll: 0,
      warpShipScale: 1,
      // Пиксель перехода: "auto" — по профилю устройства (ПК мельче, телефон крупнее).
      warpCellSize: "auto",
      warpArtMode: "sketch",
      warpSketch: null,
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
      ringApproachArmed: true,
      ringEntryFailed: false,
      hullOpen: false,
      rightStickWasDown: false,
      warpCollisionCount: 0,
      statusText: "",
      lastStatusAt: 0,
      keys: Object.create(null),
      touch: { left: false, right: false, up: false, down: false },
      tilt: { enabled: false, bound: false, permissionGranted: false, available: false, filterReady: false, filtered: 0, neutral: 0, calibrating: false, samples: 0, sum: 0, value: 0 }
    };

    window.addEventListener("bcm:mission:hydrogen-unlocked", () => {
      const maze = state.maze;
      if (!maze || !maze.active) return;
      maze.hydrogen = maze.hydrogen || { cell: { ...maze.startCell }, taken: false, scouted: false };
      maze.hydrogen.unlocked = true;
      publishAsteroidChart(maze);
    });
    window.addEventListener("bcm:mission:hydrogen-collected", () => {
      const maze = state.maze;
      if (!maze) return;
      maze.hydrogen = maze.hydrogen || { cell: { ...maze.startCell }, unlocked: true, scouted: false };
      maze.hydrogen.unlocked = true;
      maze.hydrogen.taken = true;
      publishAsteroidChart(maze);
    });
    window.addEventListener("bcm:mission:hydrogen-shard-collected", (event) => {
      const maze = state.maze;
      if (!maze) return;
      const detail = event.detail || {};
      if (detail.type === "ring") {
        maze.hydrogen = maze.hydrogen || { cell: { ...maze.startCell }, unlocked: true, scouted: false };
        maze.hydrogen.unlocked = true;
        maze.hydrogen.taken = true;
      }
      publishAsteroidChart(maze);
    });

    const compactSector = (sector) => sector ? {
      id: String(sector.id || ""),
      name: String(sector.name || ""),
      x: sector.x != null && Number.isFinite(Number(sector.x)) ? Number(sector.x) : null,
      y: sector.y != null && Number.isFinite(Number(sector.y)) ? Number(sector.y) : null
    } : null;

    window.BCMDeepSpaceWarpGetReturnSnapshot = () => ({
      mode: state.mode,
      currentSectorId: state.nav?.current?.id ?? null,
      targetSectorId: state.target?.id ?? null,
      current: compactSector(state.nav?.current),
      targets: (state.nav?.targets || []).map(compactSector).filter(Boolean),
      live: !!state.nav?.live,
      localPreview: !!state.nav?.localPreview,
      label: String(state.nav?.label || ""),
      sectorProgressed: !!state.sectorProgressed,
      launchSectorProgressed: !!state.launchSectorProgressed,
      ringCompleted: !!state.maze?.ringCompleted,
      hydrogenCollected: !!window.BCMWorldMission?.hydrogenCollected
    });

    // Rebind the saved local expedition location after Space Labyrinth is rebuilt.
    // Saved preview coordinates remain preview data; they are never promoted to live SAGE data.
    window.BCMDeepSpaceWarpRestoreReturnSnapshot = (snapshot) => {
      if (!snapshot || typeof snapshot !== "object") return false;
      const savedCurrent = snapshot.current && typeof snapshot.current === "object"
        ? snapshot.current
        : null;
      const savedId = String(snapshot.currentSectorId || savedCurrent?.id || "");
      if (!savedId) return false;

      const currentNavigation = readNavigation();
      const adapter = snapshot.live && currentNavigation && currentNavigation.adapter
        ? currentNavigation.adapter
        : null;
      const compact = (row) => {
        if (!row || typeof row !== "object" || !row.id) return null;
        if (adapter && Array.isArray(adapter.sectors)) {
          const match = adapter.sectors.find((item, index) => {
            const normalized = normalizeSector(item, index);
            return normalized && normalized.id === String(row.id);
          });
          if (match) return normalizeSector(match, 0);
        }
        return {
          id: String(row.id),
          name: String(row.name || row.id),
          x: row.x != null && Number.isFinite(Number(row.x)) ? Number(row.x) : null,
          y: row.y != null && Number.isFinite(Number(row.y)) ? Number(row.y) : null,
          raw: null
        };
      };

      const current = compact(savedCurrent || { id: savedId });
      if (!current) return false;
      const targets = (Array.isArray(snapshot.targets) ? snapshot.targets : [])
        .map(compact)
        .filter((row) => row && row.id !== current.id);
      state.nav = {
        current,
        targets,
        live: !!snapshot.live && !!adapter && !!current.raw,
        localPreview: !!snapshot.localPreview || !snapshot.live,
        adapter: adapter || null,
        label: String(snapshot.label || (snapshot.localPreview
          ? "LOCAL TEST · RESTORED EXPEDITION"
          : "SAVED EXPEDITION")),
        coordsKnown: current.x != null && current.y != null
      };
      state.target = null;
      state.sectorProgressed = !!snapshot.sectorProgressed;
      state.launchSectorProgressed = !!snapshot.launchSectorProgressed;
      state.mode = "closed";
      state.place = null;
      return true;
    };

    // Small public bridge for the later NFT/Galaxy selection integration.
    // It only changes decorative rendering; route, collision, speed and controls stay untouched.
    window.BCMDeepSpaceWarpSetDriveSlot = (slotSize) => {
      state.warpDriveSlotSize = String(slotSize || "").trim();
      state.warpVisualClass = warpVisualClassForSlotSize(state.warpDriveSlotSize);
      state.warpPreviewClass = null;
      if (typeof updateWarpTierPreviewButtons === "function") updateWarpTierPreviewButtons();
      return state.warpVisualClass;
    };
    window.BCMDeepSpaceWarpGetVisualClass = () => state.warpVisualClass;
    window.BCMDeepSpaceWarpGetSpeedMode = () => api()?.getSpeedMode?.() ?? null;
    window.BCMDeepSpaceWarpGetPreviewClass = () => Number(state.warpPreviewClass) || null;
    // Перелив палитры A <-> B: вкл/выкл и период в секундах.
    window.BCMDeepSpaceWarpSetPaletteFlow = (on, period) => {
      state.warpPaletteFlow = !!on;
      if (period) state.warpPalettePeriod = Math.max(2, Number(period) || 11);
    };
    window.BCMDeepSpaceWarpSetPaletteTarget = (value) => {
      state.warpPaletteTarget = Math.max(0, Math.min(1, Number(value) || 0));
      if (!state.warpPaletteFlow) state.warpPaletteMix = state.warpPaletteTarget;
    };
    window.BCMDeepSpaceWarpGetPaletteMix = () => Number(warpSpaceGlobalMix());
    // Радужный перелив: полный цветовой круг вместо одного перехода A <-> B.
    window.BCMDeepSpaceWarpSetRainbow = (on) => { state.warpRainbow = !!on; };
    // Способ смены кадра: id вида, либо 'auto' — по кругу, как двери в первой комнате.
    window.BCMDeepSpaceWarpSetTransition = (kind) => {
      const want = String(kind || "dissolve");
      if (want === "auto") {
        state.warpTransitionAuto = true;
      } else if (warpSpace.warpSpaceTransitionIds().indexOf(want) >= 0) {
        state.warpTransitionAuto = false;
        state.warpTransition = want;
      }
      state.warpBgCells = null;
      return warpSpaceTransitionNow();
    };
    window.BCMDeepSpaceWarpGetTransition = () => warpSpaceTransitionNow();
    window.BCMDeepSpaceWarpGetTransitions = () => warpSpace.warpSpaceTransitionIds();
    // Корабль сзади: настоящий запечённый спрайт важнее процедурного силуэта.
    window.BCMDeepSpaceWarpSetShipSprite = (source) => {
      if (!source) { state.warpShipSprite = null; return false; }
      if (typeof source === "string") {
        if (typeof Image !== "function") return false;
        const img = new Image();
        img.onload = () => { state.warpShipSprite = img; };
        img.onerror = () => { state.warpShipSprite = null; };
        img.src = source;
        return true;
      }
      state.warpShipSprite = source;
      return true;
    };
    window.BCMDeepSpaceWarpSetShip = (spec, scale) => {
      if (spec != null) state.warpShipSpec = warpSpace.warpSpaceShipSpec(spec).id;
      if (scale) state.warpShipScale = Math.max(0.5, Math.min(2.2, Number(scale) || 1));
      return warpShipInfo();
    };
    window.BCMDeepSpaceWarpShipStats = () => warpShipInfo();
    // Ручной крен, как Q/E в третьем лице. Абсолютный поворот = положение
    // на кольце минус 90° плюс этот крен, поэтому на верхней точке кольца
    // корабль честно оказывается вверх тормашками.
    window.BCMDeepSpaceWarpSetShipRoll = (radians) => {
      const r = Number(radians);
      state.warpShipRoll = isFinite(r) ? r : 0;
      return state.warpShipRoll;
    };
    window.BCMDeepSpaceWarpAddShipRoll = (delta) => {
      const d = Number(delta);
      if (isFinite(d)) state.warpShipRoll = Number(state.warpShipRoll || 0) + d;
      return state.warpShipRoll;
    };
    window.BCMDeepSpaceWarpGetRainbow = () => !!state.warpRainbow;
    window.BCMDeepSpaceWarpRainbowAt = (phase, mix) => {
      // clampUnit живёт внутри замыкания ядра, снаружи его нет — считаем здесь.
      const m = mix == null ? warpSpaceGlobalMix() : Number(mix);
      const k = !isFinite(m) ? 0 : m < 0 ? 0 : m > 1 ? 1 : m;
      return warpSpace.warpSpacePaletteAt(
        activeWarpVisualClass(), k, state.warpRainbow ? Number(phase || 0) : null);
    };
    // Качество: 'auto' по замеру кадра, либо принудительно high/low.
    window.BCMDeepSpaceWarpSetQuality = (tier) => {
      state.warpQualityTier = tier === 'low' ? 'low' : tier === 'high' ? 'high' : null;
    };
    window.BCMDeepSpaceWarpGetQuality = () => warpSpaceTierNow();
    // Цикл фоновых сцен и диагностика памяти.
    window.BCMDeepSpaceWarpSetBgCycle = (on) => { state.warpBgCycle = !!on; state.warpBgCells = null; };
    // Астероиды на стенке: плотность 0..1 и seed поля. 0 — выключить.
    window.BCMDeepSpaceWarpSetAsteroids = (density, seed) => {
      const d = Number(density);
      state.warpAsteroids = isFinite(d) ? Math.max(0, Math.min(1, d)) : 1;
      if (seed != null) state.warpAsteroidSeed = Number(seed) >>> 0;
      return state.warpAsteroids;
    };
    window.BCMDeepSpaceWarpAsteroidStats = () => {
      const field = warpSpace.warpSpaceAsteroidField(
        Number(state.warpAsteroidSeed || 0) >>> 0, Number(state.warpAsteroids));
      const sizes = { small: 0, medium: 0, large: 0 };
      field.forEach((slot) => { sizes[slot.size] = (sizes[slot.size] || 0) + 1; });
      const art = warpAsteroidArt();
      return {
        density: Number(state.warpAsteroids),
        slots: field.length,
        sizes: sizes,
        art: Object.keys(art).length,
        decoded: warpAsteroidReadyMap ? Object.keys(warpAsteroidReadyMap).length : 0
      };
    };
    // Ритм сцены: true — случайный (~2 с пауза), false — тактовая сетка.
    window.BCMDeepSpaceWarpSetRandomCycle = (on) => {
      state.warpBgRandom = !!on;
      state.warpBgCells = null;
      state.warpBgIndex = 0;
      return state.warpBgRandom;
    };
    window.BCMDeepSpaceWarpGetRandomCycle = () => !!state.warpBgRandom;
    // Длина паузы в случайном ритме (по умолчанию 2 с) и seed порядка.
    window.BCMDeepSpaceWarpSetBgHold = (sec) => {
      state.warpBgHold = Math.max(0.6, Math.min(8, Number(sec) || 2));
      state.warpBgCells = null;
      return state.warpBgHold;
    };
    window.BCMDeepSpaceWarpSetBgSeed = (seed) => {
      state.warpBgSeed = Number(seed) >>> 0;
      state.warpBgCells = null;
      state.warpBgIndex = 0;
      return state.warpBgSeed;
    };
    window.BCMDeepSpaceWarpSetBgBpm = (bpm, power) => {
      state.warpBgBpm = Math.max(40, Math.min(220, Number(bpm) || 142));
      if (power) state.warpBgPower = Math.max(1, Math.min(3, Number(power) || 1.6));
      state.warpBgCells = null;
    };
    window.BCMDeepSpaceWarpBgStats = () => ({
      cached: warpBgStore.size,
      pool: WARP_BG_POOL,
      created: warpBgCreated,
      index: Number(state.warpBgIndex || 0),
      cycle: !!state.warpBgCycle,
      random: !!state.warpBgRandom,
      hold: Number(state.warpBgHold || 2),
      kind: String(state.warpBgKind || "dissolve")
    });
    // Обои seed: скетчи из assets/scetchs, иначе генерация.
    window.BCMDeepSpaceWarpSetArtMode = (mode) => {
      state.warpArtMode = String(mode) === "procedural" ? "procedural" : "sketch";
      warpBgReset();
    };
    window.BCMDeepSpaceWarpSetSketch = (name) => {
      state.warpSketch = name ? String(name) : null;
      warpBgReset();
    };
    window.BCMDeepSpaceWarpGetSketches = () => warpSpace.WARP_SPACE_SKETCHES.slice();
    // Пиксель перехода: ступень ('coarse'...'micro') либо 'auto' по устройству.
    window.BCMDeepSpaceWarpSetCellSize = (size) => {
      const key = String(size || "auto");
      state.warpCellSize = warpSpace.WARP_SPACE_CELL_PRESETS[key] ? key : "auto";
      state.warpBgCells = null;
      return state.warpCellSize;
    };
    // Профиль устройства и фактическая сетка перехода — для QA на живом сайте.
    window.BCMDeepSpaceWarpDevice = (w, h) => ({
      id: warpDevice.id,
      label: warpDevice.label,
      dprCap: warpDevice.dprCap,
      cellBudget: warpCellBudget(),
      dissolveBudget: warpDissolveBudget(),
      dissolveFrameCap: warpDissolveFrameCap(),
      grid: (() => {
        const g = warpCellGrid(
          Number(w || (typeof window !== "undefined" ? window.innerWidth : 800)) || 800,
          Number(h || (typeof window !== "undefined" ? window.innerHeight : 500)) || 500);
        return g.cols + "x" + g.rows;
      })()
    });
    window.BCMDeepSpaceWarpArtStats = () => ({
      mode: state.warpArtMode,
      sketch: state.warpSketch,
      loaded: Array.from(warpSketchImages.keys()).filter((k) => warpSketchImages.get(k)),
      failed: Array.from(warpSketchImages.keys()).filter((k) => !warpSketchImages.get(k)),
      scenes: warpSketchScenes.size
    });

    const hullEnterButton = document.createElement("button");
    hullEnterButton.className = "bcm-warp-hull-enter";
    hullEnterButton.type = "button";
    hullEnterButton.textContent = "ВНУТРЬ КОРАБЛЯ · U / R3";
    hullEnterButton.setAttribute("aria-label", "Войти внутрь корабля");
    hullEnterButton.hidden = true;
    hullEnterButton.style.cssText = "position:fixed;left:auto;right:14px;top:62px;bottom:auto;transform:none;z-index:1001100;min-height:40px;padding:7px 11px;border:1px solid #70d9ee;border-radius:9px;background:rgba(7,27,42,.96);color:#e8fbff;font:700 11px system-ui;letter-spacing:.03em;touch-action:manipulation;white-space:nowrap;box-shadow:0 4px 18px rgba(0,0,0,.38);pointer-events:auto;cursor:pointer";
    document.body.appendChild(hullEnterButton);
    hullEnterButton.addEventListener("click", () => openHullInterior());

    function syncHullButtonVisibility() {
      const towerRoot = document.querySelector(".bcm-tower");
      const towerOwnsScreen = !!(towerRoot && !towerRoot.hidden);
      const busy = state.mode === "map" || state.mode === "tube" || state.mode === "result" ||
        state.ringPlatformer || state.ringTransitionActive || state.hullOpen || towerOwnsScreen ||
        !!document.getElementById("bcm-hull-dive") ||
        !!document.getElementById("bcm-ring-platformer") ||
        !!document.getElementById("bcm-ring-transition");
      const hidden = !root.classList.contains("game-active") || busy;
      if (hullEnterButton.hidden !== hidden) hullEnterButton.hidden = hidden;
      return !hidden;
    }

    const ringEnterButton = document.createElement("button");
    ringEnterButton.className = "bcm-warp-ring-enter";
    ringEnterButton.type = "button";
    ringEnterButton.textContent = "ВХОД В ЛАБИРИНТ RING";
    ringEnterButton.setAttribute("aria-label", "Войти в большой лабиринт Ring Frontier");
    ringEnterButton.hidden = true;
    ringEnterButton.style.cssText = "position:fixed;left:auto;right:14px;top:108px;bottom:auto;transform:none;z-index:1001101;min-height:40px;max-width:calc(100vw - 28px);padding:7px 11px;border:1px solid #d5bd73;border-radius:9px;background:rgba(31,25,10,.96);color:#fff0bd;font:800 11px system-ui;letter-spacing:.04em;touch-action:manipulation;white-space:nowrap;box-shadow:0 4px 18px rgba(0,0,0,.38);pointer-events:auto;cursor:pointer";
    document.body.appendChild(ringEnterButton);
    ringEnterButton.addEventListener("click", () => {
      const maze = state.maze;
      if (!maze || !maze.active || state.mode !== "maze") return;
      if (attemptOpenRingPlatformer(maze)) ringEnterButton.hidden = true;
      syncHullButtonVisibility();
      syncRingButtonVisibility();
    });

    function syncRingButtonVisibility() {
      const maze = state.maze;
      const towerRoot = document.querySelector(".bcm-tower");
      const towerOwnsScreen = !!(towerRoot && !towerRoot.hidden);
      const blocked = state.mode !== "maze" || !maze || !maze.active || maze.ringCompleted ||
        !state.ringApproachArmed || state.ringDistance >= 18 || state.ringPlatformer ||
        state.ringTransitionActive || state.hullOpen || towerOwnsScreen ||
        !!document.getElementById("bcm-hull-dive") ||
        !!document.getElementById("bcm-ring-platformer") ||
        !!document.getElementById("bcm-ring-transition");
      const visible = root.classList.contains("game-active") && !blocked;
      ringEnterButton.hidden = !visible;
      const english = window.BCMDialogue?.language === "en";
      ringEnterButton.textContent = english ? "ENTER RING LABYRINTH" : "ВХОД В ЛАБИРИНТ RING";
      ringEnterButton.setAttribute("aria-label", english ? "Enter the large Ring Frontier level" : "Войти в большой лабиринт Ring Frontier");
      return visible;
    }

    function attemptOpenRingPlatformer(maze, afterTransition = false) {
      state.ringEntryFailed = false;
      const engine = api();
      const runtime = engine && engine.getRuntime ? engine.getRuntime() : null;
      const scene = runtime && runtime.scene;
      const snapshot = {
        mazeGroup: maze && maze.group ? maze.group : null,
        mazeVisible: maze && maze.group ? maze.group.visible : null,
        shipVisual: runtime && runtime.ship ? runtime.ship.visual : null,
        shipVisible: runtime && runtime.ship && runtime.ship.visual ? runtime.ship.visual.visible : null,
        scene,
        sceneBackground: scene ? scene.background : null,
        sceneChildren: new Set(scene && scene.children ? scene.children : []),
        customRenderer: window.BCMDeepSpaceWarpRender
      };

      // Ring setup creates a sizeable 3D world in the shared scene. If any
      // texture/world/UI setup step throws, roll it back as one transaction:
      // never strand the pilot with a hidden asteroid and ship but no Ring level.
      function restoreEntrySnapshot() {
        try {
          if (snapshot.mazeGroup) snapshot.mazeGroup.visible = snapshot.mazeVisible;
        } catch (e) {}
        try {
          if (snapshot.shipVisual) snapshot.shipVisual.visible = snapshot.shipVisible;
        } catch (e) {}
        try {
          if (snapshot.scene) {
            [...snapshot.scene.children].forEach((child) => {
              if (!snapshot.sceneChildren.has(child)) snapshot.scene.remove(child);
            });
            snapshot.scene.background = snapshot.sceneBackground;
          }
        } catch (e) {}
        try { window.BCMDeepSpaceWarpRender = snapshot.customRenderer; } catch (e) {}
        state.ringRenderState = null;
      }

      try {
        const opened = openRingPlatformer(maze, afterTransition);
        if (!opened && !state.ringPlatformer && !state.ringTransitionActive) {
          restoreEntrySnapshot();
        }
        return opened;
      } catch (error) {
        const partialCleanup = state.ringPlatformerCleanup;
        state.ringPlatformerCleanup = null;
        try {
          if (typeof partialCleanup === "function") partialCleanup();
        } catch (cleanupError) {
          try { console.error("Mini-Sim Ring partial cleanup failed:", cleanupError); } catch (e) {}
        }
        restoreEntrySnapshot();
        state.ringPlatformer = false;
        state.ringTransitionActive = false;
        state.ringApproachArmed = true;
        state.ringEntryFailed = true;
        try { document.getElementById("bcm-ring-transition")?.remove(); } catch (e) {}
        try { document.getElementById("bcm-ring-platformer")?.remove(); } catch (e) {}
        try { document.getElementById("bcm-ring-platformer-old")?.remove(); } catch (e) {}
        try { if (engine && engine.pauseForWarp) engine.pauseForWarp(false); } catch (e) {}
        try { stopRingAudio(true); } catch (e) {}
        try {
          setMazeStatus("RING ENTRY FAILED · ASTEROID RESTORED · PRESS RING BUTTON TO RETRY");
        } catch (e) {}
        try { console.error("Mini-Sim Ring entry failed; restored asteroid scene:", error); } catch (e) {}
        try { syncHullButtonVisibility(); syncRingButtonVisibility(); } catch (e) {}
        return false;
      }
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
    exitButton.textContent = "СЛЕДУЮЩИЙ ПЕРЕХОД · V";
    exitButton.hidden = true;
    root.appendChild(exitButton);

    const overlay = document.createElement("div");
    overlay.className = "bcm-warp-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "WARP — карта Галактики и выбор сектора назначения");
    overlay.tabIndex = -1;
    overlay.hidden = true;
    overlay.innerHTML =
      '<canvas class="bcm-warp-backdrop" aria-hidden="true"></canvas>' +
      '<div class="bcm-warp-topbar"><div><div class="bcm-warp-brand">BCM 4 STAR ATLAS</div><div class="bcm-warp-heading">WARP NAVIGATION</div></div><button type="button" data-warp-close class="bcm-warp-close" aria-label="Закрыть">×</button></div>' +
      '<section class="bcm-warp-view bcm-warp-map-view" data-warp-view="map">' +
        '<div class="bcm-warp-card">' +
          '<div class="bcm-warp-kicker">SECTOR NAVIGATION</div><h2>Выберите сектор назначения</h2>' +
          '<div data-warp-tier-preview aria-label="Выбор оформления Warp" style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin:8px 0 12px;padding:6px;border:1px solid rgba(102,190,210,.45);border-radius:9px;background:rgba(2,12,21,.74)">' +
            '<span style="font:700 10px system-ui;color:#a9cbd7;margin-right:3px">ВАРП</span>' +
            '<button type="button" data-warp-tier="1" aria-pressed="false" title="Class I — полосы" style="min-width:32px;height:28px;padding:0 6px;font:700 11px system-ui;border:1px solid #426779;border-radius:6px;background:rgba(16,35,45,.96);color:#e8fbff">I</button>' +
            '<button type="button" data-warp-tier="2" aria-pressed="false" title="Class II — мягкое оформление" style="min-width:32px;height:28px;padding:0 6px;font:700 11px system-ui;border:1px solid #426779;border-radius:6px;background:rgba(16,35,45,.96);color:#e8fbff">II</button>' +
            '<button type="button" data-warp-tier="3" aria-pressed="false" title="Class III — фиолетовые полосы" style="min-width:32px;height:28px;padding:0 6px;font:700 11px system-ui;border:1px solid #426779;border-radius:6px;background:rgba(16,35,45,.96);color:#e8fbff">III</button>' +
            '<button type="button" data-warp-tier="4" aria-pressed="false" aria-disabled="true" disabled title="Class IV выключен" style="min-width:32px;height:28px;padding:0 6px;font:700 11px system-ui;border:1px solid #3a444a;border-radius:6px;background:rgba(19,25,30,.82);color:#64737b;opacity:.58;cursor:not-allowed">IV ×</button>' +
          '</div>' +
          '<p class="bcm-warp-explainer" data-warp-current></p>' +
          '<div class="bcm-warp-source" data-warp-source></div>' +
          '<div class="bcm-warp-galaxy-panel">' +
            '<div class="bcm-warp-galaxy-heading"><strong>GALAXY MAP</strong><span data-warp-galaxy-status>СХЕМА ГАЛАКТИКИ · ТЕКУЩИЙ СЕКТОР</span></div>' +
            '<div class="bcm-warp-galaxy-map-tools" aria-label="Масштаб карты">' +
              '<button type="button" data-warp-map-zoom-out aria-label="Уменьшить масштаб карты" disabled>−</button>' +
              '<button type="button" data-warp-map-zoom-reset aria-label="Общий обзор галактики">ОБЗОР</button>' +
              '<span data-warp-map-zoom-level>ОБЗОР 1×</span>' +
              '<button type="button" data-warp-map-zoom-in aria-label="Приблизить текущий сектор">+</button>' +
            '</div>' +
            '<canvas class="bcm-warp-galaxy-map" data-warp-galaxy-map tabindex="0" role="application" aria-label="Координатная карта SAGE X/Y. Приближайте карту, чтобы различать соседние секторы; выбирайте доступную точку для прокладки Warp-маршрута."></canvas>' +
            '<div class="bcm-warp-galaxy-legend"><span><i class="is-current"></i> ТЕКУЩИЙ СЕКТОР</span><span><i class="is-link"></i> WARP-ДОСТУПЕН</span><span><i class="is-route"></i> МАРШРУТ</span><span><i class="is-star"></i> ЗВЁЗДЫ</span><span><i class="is-css"></i> ФРАКЦИИ</span><small>Координаты X/Y −50…50. Доступные переходы берутся из адаптера; недостающие секторы не выдумываются.</small></div>' +
            '<div class="bcm-warp-local-area"><div class="bcm-warp-galaxy-heading"><strong>ЛОКАЦИИ ВЫБРАННОГО СЕКТОРА</strong><span data-warp-local-status>Выберите сектор</span></div><div class="bcm-warp-local-locations" data-warp-local-locations></div><div class="bcm-warp-location-kinds"><span><i>◈</i> Астероиды · локальный комплекс</span><span><i>◎</i> Планета · Tower / внутренние мини-игры</span><span><i>✦</i> Deep Space · внешняя зона с отдельной визуальной темой</span></div></div>' +
          '</div>' +
          '<div class="bcm-warp-grid" data-warp-grid hidden aria-label="Соседние клетки вокруг ONI"></div>' +
          '<div class="bcm-warp-sector-list" data-warp-sectors></div>' +
          '<form class="bcm-warp-manual" data-warp-manual><label>Доп. тестовая клетка <span>X</span><input name="x" type="number" step="1" value="-39" inputmode="numeric"></label><label><span>Y</span><input name="y" type="number" step="1" value="30" inputmode="numeric"></label><button type="submit">ВЫБРАТЬ</button></form>' +
          '<div class="bcm-warp-selected" data-warp-selected>Назначение не выбрано</div>' +
          '<div class="bcm-warp-actions"><button type="button" data-warp-start disabled>START WARP</button><button type="button" data-warp-cancel class="bcm-warp-secondary">ОТМЕНА</button></div>' +
          '<p class="bcm-warp-footnote" data-warp-footnote></p>' +
        '</div>' +
      '</section>' +
      '<section class="bcm-warp-view bcm-warp-tube-view" data-warp-view="tube" hidden>' +
        '<div class="bcm-warp-tube-hud"><div class="bcm-warp-kicker">SUBSPACE TUNNEL</div><h2 data-tube-title>WARP IN PROGRESS</h2><div class="bcm-warp-tube-meta" data-tube-meta></div><div class="bcm-warp-shield"><span data-tube-shield></span></div><div class="bcm-warp-tube-help" data-tube-help>Влево и вправо двигают корабль по кольцу. Препятствие остаётся на своём кольце и не растягивается.</div></div>' +
        '<div data-warp-tier-preview aria-label="Временно посмотреть визуальный класс Warp" style="position:absolute;top:12px;right:12px;z-index:8;display:flex;align-items:center;gap:3px;padding:4px;border:1px solid rgba(102,190,210,.45);border-radius:9px;background:rgba(2,12,21,.74);pointer-events:auto;max-width:calc(100vw - 24px)">' +
          '<span style="font:700 9px system-ui,sans-serif;color:#a9cbd7;letter-spacing:.04em;margin-right:2px">ВИД</span>' +
          '<button type="button" data-warp-tier="1" aria-pressed="false" title="Class I — полосы" style="min-width:25px;height:26px;padding:0 5px;font:700 10px system-ui;border:1px solid #426779;border-radius:6px;background:rgba(16,35,45,.96);color:#e8fbff">I</button>' +
          '<button type="button" data-warp-tier="2" aria-pressed="false" title="Class II — спиральные рельсы" style="min-width:25px;height:26px;padding:0 5px;font:700 10px system-ui;border:1px solid #426779;border-radius:6px;background:rgba(16,35,45,.96);color:#e8fbff">II</button>' +
          '<button type="button" data-warp-tier="3" aria-pressed="false" title="Class III — фиолетовые полосы" style="min-width:25px;height:26px;padding:0 5px;font:700 10px system-ui;border:1px solid #426779;border-radius:6px;background:rgba(16,35,45,.96);color:#e8fbff">III</button>' +
          '<button type="button" data-warp-tier="4" aria-pressed="false" aria-disabled="true" disabled title="Class IV выключен" style="min-width:25px;height:26px;padding:0 5px;font:700 10px system-ui;border:1px solid #3a444a;border-radius:6px;background:rgba(19,25,30,.82);color:#64737b;opacity:.58;cursor:not-allowed">IV ×</button>' +
        '</div>' +
        '<div class="bcm-warp-touch-controls"><button type="button" data-warp-control="left" aria-label="Рулить влево">◀</button><button type="button" data-warp-control="tilt" aria-label="Включить или откалибровать управление наклоном">↻ TILT</button><button type="button" data-warp-control="right" aria-label="Рулить вправо">▶</button></div>' +
        '<div class="bcm-warp-result" data-tube-result hidden><h2 data-tube-result-title></h2><p data-tube-result-text></p><div class="bcm-warp-actions"><button type="button" data-tube-retry>ПОВТОРИТЬ WARP</button><button type="button" data-tube-abort class="bcm-warp-secondary">ОТМЕНА</button></div></div>' +
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
    const galaxyMap = overlay.querySelector("[data-warp-galaxy-map]");
    const galaxyMapStatus = overlay.querySelector("[data-warp-galaxy-status]");
    const galaxyMapZoomOut = overlay.querySelector("[data-warp-map-zoom-out]");
    const galaxyMapZoomReset = overlay.querySelector("[data-warp-map-zoom-reset]");
    const galaxyMapZoomIn = overlay.querySelector("[data-warp-map-zoom-in]");
    const galaxyMapZoomLevel = overlay.querySelector("[data-warp-map-zoom-level]");
    const galaxyMapCtx = galaxyMap ? galaxyMap.getContext("2d") : null;
    const galaxyLocalStatus = overlay.querySelector("[data-warp-local-status]");
    const galaxyLocalLocations = overlay.querySelector("[data-warp-local-locations]");
    const GALAXY_MAP_ZOOM_LEVELS = [1, 2, 4, 8];
    let galaxyMapZoom = 1;
    let galaxyMapPoints = [];
    let galaxyCurrentPoint = null;
    const selectedElement = overlay.querySelector("[data-warp-selected]");
    // Existing SAGE snapshot points reused from src/data/sage-plane.ts.
    // These are reference stars, not fabricated sector coordinates.
    const SAGE_STAR_REFERENCE_POINTS = [
      [-2,-44],[10,-41],[0,-39],[-10,-37],[2,-34],[-15,-33],[12,-31],[21,-26],
      [-22,-25],[-8,-24],[0,-24],[2,-23],[31,-19],[-30,-16],[-14,-16],[11,-16],
      [23,-12],[-36,-7],[16,-5],[39,-1],[-16,0],[-40,3],[-23,4],[22,5],[44,10],
      [-35,12],[25,14],[-45,15],[-25,15],[0,16],[35,16],[49,20],[-28,21],[17,21],
      [28,21],[-18,23],[-9,24],[-38,25],[38,25],[2,26],[30,28],[-47,30],[-40,30],
      [-30,30],[40,30],[22,31],[-22,32],[48,32],[-42,35],[-8,35],[42,35],[13,37],
      [-19,40],[5,44]
    ];
    const SAGE_CSS_REFERENCE_POINTS = [
      { id: "mud-css", name: "MUD", x: 0, y: -39, color: "#e7a18c" },
      { id: "oni-css", name: "ONI", x: -40, y: 30, color: "#7eb6ff" },
      { id: "ustur-css", name: "Ustur", x: 40, y: 30, color: "#e6c15a" }
    ];
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
    const tiltButton = overlay.querySelector('[data-warp-control="tilt"]');
    const warpTierButtons = [...overlay.querySelectorAll("[data-warp-tier]")];

    function activeWarpVisualClass() {
      const selected = Number(state.warpPreviewClass) || Number(state.warpVisualClass) || 1;
      return [1, 2, 3].includes(selected) ? selected : 1;
    }

    function updateWarpTierPreviewButtons() {
      const active = activeWarpVisualClass();
      warpTierButtons.forEach((button) => {
        const selected = Number(button.getAttribute("data-warp-tier")) === active;
        button.setAttribute("aria-pressed", selected ? "true" : "false");
        button.style.background = selected ? "rgba(28,92,113,.98)" : "rgba(16,35,45,.96)";
        button.style.borderColor = selected ? "#7be4f4" : "#426779";
        button.style.boxShadow = selected ? "0 0 0 1px rgba(123,228,244,.3)" : "none";
      });
    }

    function setWarpVisualPreviewClass(value) {
      const selected = Math.trunc(Number(value));
      if (![1, 2, 3].includes(selected)) return activeWarpVisualClass();
      state.warpPreviewClass = selected;
      state.warpVisualClass = selected;
      updateWarpTierPreviewButtons();
      return selected;
    }

    warpTierButtons.forEach((button) => {
      button.addEventListener("click", () => setWarpVisualPreviewClass(button.getAttribute("data-warp-tier")));
    });
    window.BCMDeepSpaceWarpPreviewClass = setWarpVisualPreviewClass;
    updateWarpTierPreviewButtons();

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

    // The GLTF loader and crystal scene are lazy, shared page-level resources.
    // They are requested only when an asteroid maze is actually constructed.
    let asteroidGltfLoaderPromise = null;
    let asteroidWallRockTemplatePromise = null;
    const asteroidWallCrystalPartPromises = new Map();
    const asteroidWallCrystalTemplatePromises = new Map();
    const asteroidWallCrystalColors = ["cyan", "violet", "amber", "green"];
    const asteroidWallCrystalAssetRoot = "mesh/twinsun_pack01/twinsun_pack01/parts/";

    function ensureAsteroidGltfLoader(THREE) {
      if (THREE && THREE.GLTFLoader) return Promise.resolve(THREE.GLTFLoader);
      if (asteroidGltfLoaderPromise) return asteroidGltfLoaderPromise;
      const loaderUrl = String(config.gltfLoaderUrl || "").trim();
      if (!loaderUrl) return Promise.reject(new Error("Local GLTFLoader URL is not configured"));

      asteroidGltfLoaderPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = loaderUrl;
        script.async = true;
        script.dataset.bcmR128GltfLoader = "1";
        script.onload = () => {
          if (THREE && THREE.GLTFLoader) resolve(THREE.GLTFLoader);
          else reject(new Error("Local GLTFLoader loaded without registering THREE.GLTFLoader"));
        };
        script.onerror = () => reject(new Error("Local GLTFLoader request failed"));
        document.head.appendChild(script);
      }).catch((error) => {
        asteroidGltfLoaderPromise = null;
        throw error;
      });
      return asteroidGltfLoaderPromise;
    }

    function loadAsteroidWallAssetTemplate(THREE, assetName, cache, cacheKey) {
      if (cache.has(cacheKey)) return cache.get(cacheKey);
      const assets = Array.isArray(config.assets) ? config.assets : [];
      const wanted = String(assetName || "").toLowerCase();
      const asset = assets.find((item) =>
        item && item.type === "model" &&
        String(item.name || "").toLowerCase() === wanted &&
        typeof item.url === "string" && item.url
      );
      if (!asset) return Promise.reject(new Error("Missing local GLB model asset: " + assetName));

      const promise = ensureAsteroidGltfLoader(THREE)
        .then(() => new Promise((resolve, reject) => {
          const loader = new THREE.GLTFLoader();
          loader.load(asset.url, (gltf) => {
            const root = gltf && (gltf.scene || (Array.isArray(gltf.scenes) ? gltf.scenes[0] : null));
            let meshes = 0;
            if (root && typeof root.traverse === "function") {
              root.traverse((node) => {
                if (!node || !node.isMesh) return;
                meshes += 1;
                node.castShadow = false;
                node.receiveShadow = false;
              });
            }
            if (!root || meshes === 0) {
              reject(new Error("GLB contains no renderable meshes: " + assetName));
              return;
            }
            resolve(root);
          }, undefined, reject);
        }))
        .catch((error) => {
          cache.delete(cacheKey);
          throw error;
        });
      cache.set(cacheKey, promise);
      return promise;
    }

    function loadAsteroidWallRockTemplate(THREE) {
      if (asteroidWallRockTemplatePromise) return asteroidWallRockTemplatePromise;
      const assetName = asteroidWallCrystalAssetRoot + "rock_cluster.glb";
      asteroidWallRockTemplatePromise = loadAsteroidWallAssetTemplate(
        THREE, assetName, new Map(), "wall-rock"
      ).catch((error) => {
        asteroidWallRockTemplatePromise = null;
        throw error;
      });
      return asteroidWallRockTemplatePromise;
    }

    function loadAsteroidWallCrystalTemplate(THREE, color) {
      const selectedColor = asteroidWallCrystalColors.includes(String(color).toLowerCase())
        ? String(color).toLowerCase()
        : "cyan";
      if (asteroidWallCrystalTemplatePromises.has(selectedColor)) {
        return asteroidWallCrystalTemplatePromises.get(selectedColor);
      }

      const getPart = (part) => {
        const assetName = asteroidWallCrystalAssetRoot + "crystal_" + part + "_" + selectedColor + ".glb";
        const cacheKey = selectedColor + ":" + part;
        return loadAsteroidWallAssetTemplate(THREE, assetName, asteroidWallCrystalPartPromises, cacheKey);
      };

      const promise = Promise.all([
        loadAsteroidWallRockTemplate(THREE),
        getPart("main"),
        getPart("side"),
        getPart("small")
      ]).then(([rock, main, side, small]) => {
        // The four GLBs deliberately retain one shared authoring coordinate
        // system. Keep the stone and all three crystals as separate child nodes.
        const deposit = new THREE.Group();
        deposit.name = "twinsun-crystal-deposit-" + selectedColor;
        const crystalGlow = {
          cyan: 0x22cbd4,
          violet: 0xa45be5,
          amber: 0xe38a25,
          green: 0x61c83e
        }[selectedColor] || 0x22cbd4;
        [rock, main, side, small].forEach((part) => {
          const child = part.clone(true);
          child.userData = child.userData || {};
          child.userData.bcmDepositPart = part === rock ? "rock" : part === main ? "crystal-main" :
            part === side ? "crystal-side" : "crystal-small";
          if (part !== rock) {
            // Subtle per-colour emission keeps the crystals readable against dark
            // asteroid textures without adding lights or affecting the rock base.
            child.traverse((node) => {
              if (!node || !node.isMesh || !node.material) return;
              const brighten = (material) => {
                const copy = material.clone();
                if (copy.emissive) copy.emissive.setHex(crystalGlow);
                copy.emissiveIntensity = 0.42;
                copy.needsUpdate = true;
                return copy;
              };
              node.material = Array.isArray(node.material)
                ? node.material.map(brighten)
                : brighten(node.material);
            });
          }
          deposit.add(child);
        });
        return deposit;
      }).catch((error) => {
        asteroidWallCrystalTemplatePromises.delete(selectedColor);
        throw error;
      });
      asteroidWallCrystalTemplatePromises.set(selectedColor, promise);
      return promise;
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

    // SAGE XY navigation is eight-way: the four diagonal neighbors are valid sectors too.
    // Keep this preview offset list aligned with the visible 3×3 sector grid.
    const SAGE_SECTOR_NEIGHBOR_OFFSETS = [
      [-1, 1], [0, 1], [1, 1],
      [-1, 0],          [1, 0],
      [-1, -1], [0, -1], [1, -1]
    ];

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
      // Show all eight adjacent XY cells in the 3×3 preview, not just cardinal directions;
      // preview cells remain explicitly test-only until the live adapter supplies real links.
      const current = { id: "oni-css-neuno--40-30", name: "ONI · NEUNO", x: -40, y: 30, raw: null };
      return {
        current,
        targets: SAGE_SECTOR_NEIGHBOR_OFFSETS.map((pair) => {
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
        label: "LOCAL TEST · ONI / NEUNO · START X -40, Y 30 · NEIGHBOR CELLS ARE TEST ONLY",
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
        return SAGE_SECTOR_NEIGHBOR_OFFSETS.map((offset) => {
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

    function asteroidPlace(sector) {
      const source = sector || null;
      const x = source && source.x != null ? source.x : "—";
      const y = source && source.y != null ? source.y : "—";
      return {
        id: "asteroid",
        label: "ASTEROID · X " + x + " / Y " + y,
        sectorX: source ? source.x : null,
        sectorY: source ? source.y : null
      };
    }

    function rememberPlace(place) {
      state.place = place && place.id ? place : null;
      const engine = api();
      if (engine && typeof engine.setPlace === "function") engine.setPlace(state.place);
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

    function renderSectorLocations(sector) {
      if (!galaxyLocalLocations || !galaxyLocalStatus) return;
      galaxyLocalLocations.replaceChildren();
      const raw = sector && sector.raw && typeof sector.raw === "object" ? sector.raw : {};
      const locationKeys = [
        "gameLocations", "game_locations", "localLocations", "local_locations",
        "locations", "pointsOfInterest", "points_of_interest", "activities", "mechanics"
      ];
      // Some adapters split local POIs, mechanics and activities across separate arrays.
      // Merge every available list instead of silently discarding everything after the first.
      const provided = locationKeys.flatMap((key) => Array.isArray(raw[key]) ? raw[key] : []);
      const seenProvidedLocations = new Set();
      const locations = provided.map((item, index) => {
        if (typeof item === "string") return { id: "location-" + index, name: item, kind: "location", detail: "", status: "adapter" };
        if (!item || typeof item !== "object") return null;
        return {
          id: String(item.id || item.key || "location-" + index),
          name: String(item.name || item.title || item.label || item.type || "Локация"),
          kind: String(item.kind || item.type || item.category || "location").toLowerCase(),
          detail: String(item.description || item.blurb || item.mechanic || item.game || ""),
          status: "adapter"
        };
      }).filter(Boolean).filter((location) => {
        const id = String(location.id || "").trim().toLowerCase();
        const nameKind = String(location.name || "").trim().toLowerCase() + "|" +
          String(location.kind || "").trim().toLowerCase();
        const key = /^location-\d+$/.test(id) ? "name:" + nameKind : "id:" + id;
        if (seenProvidedLocations.has(key)) return false;
        seenProvidedLocations.add(key);
        return true;
      });

      const x = sector && sector.x != null ? Number(sector.x) : NaN;
      const y = sector && sector.y != null ? Number(sector.y) : NaN;
      const id = String((sector && sector.id) || "").toLowerCase();
      const name = String((sector && sector.name) || "").toLowerCase();
      const isOniCss = (x === -40 && y === 30) || id.includes("oni-css") || name.includes("oni css");
      const isMudCss = (x === 0 && y === -39) || id.includes("mud-css") || name.includes("mud css");
      const isUsturCss = (x === 40 && y === 30) || id.includes("ustur-css") || name.includes("ustur css");
      const hasKind = (pattern) => locations.some((item) => pattern.test(item.name + " " + item.kind));
      const addKnownLocation = (location) => {
        if (!locations.some((item) => item.id === location.id || (item.name === location.name && item.kind === location.kind))) {
          locations.push(location);
        }
      };
      if (isOniCss) {
        if (!hasKind(/asteroid|астероид/i)) {
          locations.unshift({
            id: "local-asteroid-complex",
            name: "Астероидный комплекс",
            kind: "asteroid",
            detail: "Локальная игровая зона рядом с ONI; существующая механика астероидного прохода.",
            status: "implemented"
          });
        }
        addKnownLocation({ id: "oni-css-station", name: "ONI", kind: "station", detail: "Орбитальная станция и локальный ориентир сектора.", status: "reference" });
        addKnownLocation({ id: "akenat-planet", name: "Akenat", kind: "planet", detail: "Планетарная локация системы ONI; Tower и внутренние механики здесь пока требуют привязки запуска.", status: "planned" });
      } else if (isMudCss) {
        addKnownLocation({ id: "mud-css-station", name: "MUD", kind: "station", detail: "Орбитальная станция системы MUD.", status: "reference" });
        addKnownLocation({ id: "pearce-planet", name: "Pearce", kind: "planet", detail: "Планетарная локация системы MUD; Tower и внутренние механики требуют привязки запуска.", status: "planned" });
      } else if (isUsturCss) {
        addKnownLocation({ id: "ustur-css-station", name: "Ustur", kind: "station", detail: "Орбитальная станция системы Ustur.", status: "reference" });
        addKnownLocation({ id: "ioki-planet", name: "Ioki", kind: "planet", detail: "Планетарная локация системы Ustur; Tower и внутренние механики требуют привязки запуска.", status: "planned" });
      }

      galaxyLocalStatus.textContent = sector
        ? ((sector.x != null && sector.y != null) ? "X " + sector.x + " · Y " + sector.y : "КООРДИНАТЫ НЕ ПЕРЕДАНЫ")
        : "СЕКТОР НЕ ВЫБРАН";

      const kindInfo = (kind) => {
        if (/asteroid|rock|астероид/i.test(kind)) return { icon: "◈", label: "АСТЕРОИДЫ" };
        if (/planet|surface|tower|планет/i.test(kind)) return { icon: "◎", label: "ПЛАНЕТА / TOWER" };
        if (/deep.?space|void|внешн/i.test(kind)) return { icon: "✦", label: "DEEP SPACE" };
        if (/station|css|orbit|станц/i.test(kind)) return { icon: "⌖", label: "СТАНЦИЯ / ОРБИТА" };
        return { icon: "•", label: "ЛОКАЦИЯ СЕКТОРА" };
      };
      if (locations.length) {
        locations.forEach((location) => {
          const info = kindInfo(location.kind);
          const item = document.createElement("div");
          item.className = "bcm-warp-local-location" +
            (location.status === "implemented" ? " is-implemented" : location.status === "planned" ? " is-planned" : "");
          const symbol = document.createElement("strong");
          symbol.className = "bcm-warp-local-icon";
          symbol.textContent = info.icon;
          const copy = document.createElement("span");
          copy.className = "bcm-warp-local-copy";
          const title = document.createElement("b");
          title.textContent = location.name;
          const subtitle = document.createElement("small");
          subtitle.textContent = location.detail || info.label;
          const stateText = document.createElement("em");
          stateText.textContent = location.status === "implemented" ? "В ИГРЕ"
            : location.status === "planned" ? "НУЖНА ПРИВЯЗКА"
              : location.status === "reference" ? "ОРИЕНТИР"
                : "ДАННЫЕ АДАПТЕРА";
          copy.append(title, subtitle);
          item.append(symbol, copy, stateText);
          galaxyLocalLocations.appendChild(item);
        });
      } else {
        const note = document.createElement("p");
        note.className = "bcm-warp-local-empty";
        note.textContent = "Навигационный адаптер не передал дополнительные локальные точки для этого сектора. Астероидные комплексы, планеты / Tower и внешние Deep Space-механики остаются отдельными типами локаций, пока их привязка не задана.";
        galaxyLocalLocations.appendChild(note);
      }
    }

    function renderGalaxyMap() {
      if (!galaxyMap || !galaxyMapCtx) return;
      const rect = galaxyMap.getBoundingClientRect();
      const w = Math.max(240, Math.floor(rect.width || 760));
      const h = Math.max(150, Math.floor(rect.height || 380));
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      if (galaxyMap.width !== Math.round(w * dpr) || galaxyMap.height !== Math.round(h * dpr)) {
        galaxyMap.width = Math.round(w * dpr);
        galaxyMap.height = Math.round(h * dpr);
      }
      const g = galaxyMapCtx;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      g.fillStyle = "#070b12";
      g.fillRect(0, 0, w, h);

      const nav = state.nav;
      const current = nav && nav.current;
      const targets = nav && Array.isArray(nav.targets) ? nav.targets : [];
      const adapterSectors = nav && nav.adapter && Array.isArray(nav.adapter.sectors) ? nav.adapter.sectors : [];
      const zoom = galaxyMapZoom;
      // Overview is centered on SAGE (0,0). Zoom recenters on current sector,
      // making adjacent coordinates readable and selectable without false geography.
      const centerX = zoom > 1 && current && current.x != null && Number.isFinite(Number(current.x)) ? Number(current.x) : 0;
      const centerY = zoom > 1 && current && current.y != null && Number.isFinite(Number(current.y)) ? Number(current.y) : 0;
      const side = Math.max(100, Math.min(w - 28, h - 34));
      const left = (w - side) / 2;
      const top = (h - side) / 2;
      const scale = side / 100;
      const toPoint = (x, y) => ({
        x: left + side / 2 + (Number(x) - centerX) * scale * zoom,
        y: top + side / 2 - (Number(y) - centerY) * scale * zoom
      });
      g.fillStyle = "rgba(18,31,45,0.92)";
      g.fillRect(left, top, side, side);
      g.strokeStyle = "rgba(176,199,217,0.52)";
      g.lineWidth = 1;
      g.strokeRect(left + 0.5, top + 0.5, side - 1, side - 1);

      // Clip content to the map viewport. Zoom changes the camera, not SAGE data.
      g.save();
      g.beginPath();
      g.rect(left + 1, top + 1, side - 2, side - 2);
      g.clip();
      const halfSpan = 50 / zoom;
      const gridStep = zoom >= 4 ? 1 : zoom >= 2 ? 5 : 10;
      const minGridX = Math.max(-50, Math.ceil((centerX - halfSpan) / gridStep) * gridStep);
      const maxGridX = Math.min(50, Math.floor((centerX + halfSpan) / gridStep) * gridStep);
      const minGridY = Math.max(-50, Math.ceil((centerY - halfSpan) / gridStep) * gridStep);
      const maxGridY = Math.min(50, Math.floor((centerY + halfSpan) / gridStep) * gridStep);
      g.strokeStyle = "rgba(119,156,184,0.20)";
      g.lineWidth = 1;
      for (let x = minGridX; x <= maxGridX; x += gridStep) {
        const a = toPoint(x, centerY - halfSpan);
        const b = toPoint(x, centerY + halfSpan);
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      }
      for (let y = minGridY; y <= maxGridY; y += gridStep) {
        const a = toPoint(centerX - halfSpan, y);
        const b = toPoint(centerX + halfSpan, y);
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      }
      const origin = toPoint(0, 0);
      g.strokeStyle = "rgba(196,163,90,0.55)";
      g.beginPath(); g.moveTo(origin.x - 5, origin.y); g.lineTo(origin.x + 5, origin.y);
      g.moveTo(origin.x, origin.y - 5); g.lineTo(origin.x, origin.y + 5); g.stroke();

      const sectorByCoord = new Set();
      let knownSectorCount = 0;
      adapterSectors.forEach((item, index) => {
        const sector = normalizeSector(item, index);
        if (!sector || sector.x == null || sector.y == null) return;
        const x = Number(sector.x), y = Number(sector.y);
        if (!Number.isFinite(x) || !Number.isFinite(y) || x < -50 || x > 50 || y < -50 || y > 50) return;
        const key = x + "," + y;
        if (sectorByCoord.has(key)) return;
        sectorByCoord.add(key);
        knownSectorCount += 1;
      });
      if (knownSectorCount) {
        adapterSectors.forEach((item, index) => {
          const sector = normalizeSector(item, index);
          if (!sector || sector.x == null || sector.y == null) return;
          const x = Number(sector.x), y = Number(sector.y);
          if (!Number.isFinite(x) || !Number.isFinite(y) || x < -50 || x > 50 || y < -50 || y > 50) return;
          const p = toPoint(x, y);
          g.fillStyle = "rgba(111,149,179,0.50)";
          g.fillRect(p.x - 1, p.y - 1, 2, 2);
        });
      }
      // Keep known star locations as orientation landmarks even with live
      // sector coordinates; the two data layers are separate on the map.
      SAGE_STAR_REFERENCE_POINTS.forEach(([x, y]) => {
        const p = toPoint(x, y);
        g.fillStyle = "rgba(230,193,120,0.72)";
        g.beginPath(); g.arc(p.x, p.y, zoom >= 4 ? 2.2 : 1.8, 0, Math.PI * 2); g.fill();
      });

      SAGE_CSS_REFERENCE_POINTS.forEach((css) => {
        const p = toPoint(css.x, css.y);
        g.beginPath(); g.arc(p.x, p.y, zoom >= 4 ? 4.8 : 4.2, 0, Math.PI * 2);
        g.fillStyle = css.color; g.fill();
        g.strokeStyle = "#f3f6f9"; g.lineWidth = 1; g.stroke();
        g.fillStyle = css.color; g.font = "600 9px system-ui,sans-serif";
        g.textAlign = css.x > 25 ? "right" : "left"; g.textBaseline = "bottom";
        if (!(zoom > 1 && current && css.x === Number(current.x) && css.y === Number(current.y))) {
          g.fillText(css.name, p.x + (css.x > 25 ? -6 : 6), p.y - 5);
        }
      });

      galaxyMapPoints = [];
      galaxyCurrentPoint = null;
      const hasPoint = (node) => node && node.x != null && node.y != null &&
        Number.isFinite(Number(node.x)) && Number.isFinite(Number(node.y)) &&
        Number(node.x) >= -50 && Number(node.x) <= 50 && Number(node.y) >= -50 && Number(node.y) <= 50;
      if (current && hasPoint(current)) {
        const p = toPoint(current.x, current.y);
        galaxyCurrentPoint = p;
        g.strokeStyle = "rgba(111,176,211,0.55)";
        g.lineWidth = 1.1;
        targets.filter(hasPoint).forEach((target) => {
          const q = toPoint(target.x, target.y);
          g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke();
        });
      }
      targets.forEach((target) => {
        if (!hasPoint(target)) return;
        const p = toPoint(target.x, target.y);
        const selected = !!(state.target && state.target.id === target.id);
        if (selected && galaxyCurrentPoint) {
          g.strokeStyle = "#56f0d0"; g.lineWidth = 2.5;
          g.beginPath(); g.moveTo(galaxyCurrentPoint.x, galaxyCurrentPoint.y); g.lineTo(p.x, p.y); g.stroke();
          const angle = Math.atan2(p.y - galaxyCurrentPoint.y, p.x - galaxyCurrentPoint.x);
          g.beginPath();
          g.moveTo(p.x, p.y);
          g.lineTo(p.x - Math.cos(angle - 0.48) * 7, p.y - Math.sin(angle - 0.48) * 7);
          g.moveTo(p.x, p.y);
          g.lineTo(p.x - Math.cos(angle + 0.48) * 7, p.y - Math.sin(angle + 0.48) * 7);
          g.stroke();
        }
        g.beginPath(); g.arc(p.x, p.y, selected ? 5.5 : 4, 0, Math.PI * 2);
        g.fillStyle = selected ? "#56f0d0" : "#8bb8d0"; g.fill();
        g.strokeStyle = selected ? "#e1fff8" : "#b7d5e5"; g.lineWidth = 1; g.stroke();
        galaxyMapPoints.push({ sector: target, x: p.x, y: p.y });
      });
      if (galaxyCurrentPoint) {
        // Keep CURRENT visible above adjacent target markers in overview mode.
        g.beginPath(); g.arc(galaxyCurrentPoint.x, galaxyCurrentPoint.y, zoom >= 4 ? 5.4 : 6.2, 0, Math.PI * 2);
        g.fillStyle = "#f4fbff"; g.fill();
        g.strokeStyle = "#56f0d0"; g.lineWidth = 2; g.stroke();
        g.fillStyle = "#f4fbff"; g.font = "700 9px system-ui,sans-serif";
        g.textAlign = galaxyCurrentPoint.x > left + side * 0.72 ? "right" : "left";
        g.textBaseline = "top";
        g.fillText("YOU · " + String(current.name || current.id || "CURRENT").slice(0, 20),
          galaxyCurrentPoint.x + (galaxyCurrentPoint.x > left + side * 0.72 ? -7 : 7), galaxyCurrentPoint.y + 7);
      }
      g.restore();

      if (galaxyMapZoomLevel) galaxyMapZoomLevel.textContent = zoom === 1 ? "ОБЗОР 1×" : "ОКРЕСТНОСТЬ " + zoom + "×";
      if (galaxyMapZoomOut) galaxyMapZoomOut.disabled = zoom === GALAXY_MAP_ZOOM_LEVELS[0];
      if (galaxyMapZoomIn) galaxyMapZoomIn.disabled = zoom === GALAXY_MAP_ZOOM_LEVELS[GALAXY_MAP_ZOOM_LEVELS.length - 1];
      g.fillStyle = "rgba(190,211,225,0.9)";
      g.font = "9px ui-monospace,Consolas,monospace";
      g.textAlign = "left"; g.textBaseline = "top";
      g.fillText(zoom === 1 ? "SAGE XY · −50 … +50" : "SAGE XY · " + zoom + "× · CENTER " + centerX + "," + centerY, 8, 8);
      const statusText = knownSectorCount
        ? knownSectorCount.toLocaleString() + " СЕКТОРОВ В АДАПТЕРЕ"
        : "ПОЛНЫЕ ТОЧКИ СЕКТОРОВ НЕ ДОСТУПНЫ · ЗВЁЗДЫ И ФРАКЦИИ — ОРИЕНТИРЫ";
      if (galaxyMapStatus) {
        galaxyMapStatus.textContent = nav && nav.live
          ? statusText
          : "ЛОКАЛЬНЫЙ ТЕСТ · ONI / NEUNO · КООРДИНАТЫ −50…50";
      }
      renderSectorLocations(state.target || current);
    }

    function setGalaxyMapZoom(direction) {
      const index = GALAXY_MAP_ZOOM_LEVELS.indexOf(galaxyMapZoom);
      const nextIndex = direction === "reset" ? 0 : Math.max(0, Math.min(
        GALAXY_MAP_ZOOM_LEVELS.length - 1,
        index + (direction === "in" ? 1 : -1)
      ));
      galaxyMapZoom = GALAXY_MAP_ZOOM_LEVELS[nextIndex];
      renderGalaxyMap();
    }
    galaxyMapZoomOut?.addEventListener("click", () => setGalaxyMapZoom("out"));
    galaxyMapZoomReset?.addEventListener("click", () => setGalaxyMapZoom("reset"));
    galaxyMapZoomIn?.addEventListener("click", () => setGalaxyMapZoom("in"));

    galaxyMap?.addEventListener("click", (event) => {
      const rect = galaxyMap.getBoundingClientRect();
      const x = event.clientX - rect.left, y = event.clientY - rect.top;
      let nearest = null, best = Infinity;
      galaxyMapPoints.forEach((p) => {
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < best) { best = d; nearest = p; }
      });
      const currentDistance = galaxyCurrentPoint
        ? Math.hypot(galaxyCurrentPoint.x - x, galaxyCurrentPoint.y - y)
        : Infinity;
      // Adjacent dots overlap at overview scale. Zoom in or use the sector list
      // rather than accidentally selecting a hidden neighbor under CURRENT.
      const targetCanBePicked = galaxyMapZoom >= 4 || currentDistance > 9;
      if (nearest && best <= 15 && targetCanBePicked) selectTarget(nearest.sector);
      else galaxyMap.focus({ preventScroll: true });
    });
    galaxyMap?.addEventListener("keydown", (event) => {
      if ((event.code === "Enter" || event.code === "Space") && state.target) {
        event.preventDefault();
        startButton.focus({ preventScroll: true });
      }
    });

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
      renderGalaxyMap();
    }

    function visibleMapChoices() {
      return [...mapView.querySelectorAll("button:not([disabled]), input:not([disabled]), select:not([disabled])")].filter((node) => {
        if (node.closest("[hidden]")) return false;
        const rect = node.getBoundingClientRect();
        const style = window.getComputedStyle(node);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      });
    }

    function focusMapChoice(step) {
      const choices = visibleMapChoices();
      if (!choices.length) { overlay.focus({ preventScroll: true }); return; }
      let index = choices.indexOf(document.activeElement);
      if (index < 0) index = 0;
      else if (step) index = (index + step + choices.length) % choices.length;
      choices[index].focus({ preventScroll: true });
      if (choices[index].scrollIntoView) choices[index].scrollIntoView({ block: "nearest" });
    }

    function focusInitialMapChoice() {
      const first = listElement.querySelector(".bcm-warp-sector") || manualForm.elements.x || closeButton;
      if (first && typeof first.focus === "function") first.focus({ preventScroll: true });
      else overlay.focus({ preventScroll: true });
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
      if (engine.releaseFlightPointerLock) engine.releaseFlightPointerLock();
      if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
      state.nav = readNavigation();
      state.target = null;
      state.mode = "map";
      window.BCMDialogue?.showControls("warp");
      state.openedAt = performance.now();
      state.elapsed = 0;
      state.savedPosition = engine.getRuntime().ship.position.clone();
      state.savedQuaternion = engine.getRuntime().ship.quaternion.clone();
      state.returnPosition = null;
      state.returnQuaternion = null;
      engine.pauseForWarp(true);
      currentElement.textContent = "CURRENT · " + sectorText(state.nav.current);
      sourceElement.textContent = state.nav.label;
      sourceElement.classList.toggle("is-preview", !state.nav.live);
      footnoteElement.textContent = state.nav.live
        ? "Маршрут показывает данные, переданные внешним SAGE-адаптером. Сам Warp — локальная мини-игра и не запускает перемещение в SAGE."
        : "Стартовая точка ONI · NEUNO: X -40, Y 30. Соседние клетки сгенерированы только для теста. Warp/Tube/лабиринт не меняют состояние Star Atlas.";
      listSectorTargets();
      renderSectorGrid();
      renderGalaxyMap();
      selectedElement.textContent = "DESTINATION NOT SELECTED";
      startButton.disabled = true;
      mapView.hidden = false;
      tubeView.hidden = true;
      tubeResult.hidden = true;
      touchControls.hidden = true;
      overlay.hidden = false;
      root.classList.add("bcm-warp-open");
      launchButton.classList.add("is-active");
      overlay.style.pointerEvents = "auto";
      resizeBackdrop();
      renderGalaxyMap();
      focusInitialMapChoice();
      startBackdropLoop();
    }

    function closeOverlay(restoreMain) {
      const keepAsteroid = !!(state.maze && state.maze.active);
      if (!keepAsteroid) stopWarpAudio();
      overlay.hidden = true;
      overlay.classList.remove("is-tubing");
      state.tilt.value = 0;
      root.classList.remove("bcm-warp-open", "is-tubing");
      launchButton.classList.remove("is-active");
      state.pointerDown = false;
      if (keepAsteroid) {
        // CANCEL KEEPS THE ASTEROID LOCALE. The rock stays in the scene and
        // the ship stays at the coordinates where Warp was opened. Do not
        // rewind launchNav to Room 1 / ONI CSS and do not teleport.
        root.classList.add("bcm-warp-maze-active");
        exitButton.hidden = false;
        exitButton.textContent = nextWarpDestinationLabel();
        state.mode = "maze";
        window.BCMDeepSpaceWarpFrame = updateMazeFrame;
        const engine = api();
        if ((!state.place || state.place.id !== "asteroid") && (state.target || (state.nav && state.nav.current))) {
          rememberPlace(asteroidPlace(state.target || state.nav.current));
        }
        if (engine) {
          const placeLabel = state.place && state.place.label
            ? state.place.label
            : asteroidPlace(state.target || (state.nav && state.nav.current)).label;
          engine.setExternalHUD(placeLabel, "EXPEDITION · CORE SHARDS " + (state.maze.count || 0) + "/3 · ASTEROID COMPLEX");
          engine.pauseForWarp(false);
        }
        state.returnPosition = null;
        state.returnQuaternion = null;
        return;
      }
      state.mode = "closed";
      resumeLevelOst();
      state.layers = [];
      state.target = null;
      window.BCMDeepSpaceWarpFrame = null;
      const engine = api();
      if (engine) {
        engine.clearExternalHUD();
        const anchorPosition = state.returnPosition || state.savedPosition;
        const anchorQuaternion = state.returnQuaternion || state.savedQuaternion;
        // Cancelling a tube that never committed a new locale restores the
        // sector the launch started from. An asteroid place is never that path:
        // the keepAsteroid branch already returned.
        if (restoreMain && state.launchNav && !(state.place && state.place.id === "asteroid")) {
          state.nav = state.launchNav;
          state.sectorProgressed = state.launchSectorProgressed;
        }
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
      // Each Tube run gets its own seed derived from this local session's Warp
      // stream and a per-session run counter. A future server can authoritatively
      // supply the same counter/seed to every client in one party.
      const localSession = window.BCMMiniSimSession || null;
      const locationSeeds = localSession && localSession.locationSeeds
        ? localSession.locationSeeds
        : {};
      const runCounters = localSession
        ? (localSession.runCounters || (localSession.runCounters = {}))
        : {};
      const warpRun = Number(runCounters.warp || 0) + 1;
      runCounters.warp = warpRun;
      const warpBaseSeed = Number.isSafeInteger(Number(locationSeeds.warp))
        ? Number(locationSeeds.warp) >>> 0
        : hashSeed(String(state.nav.current.id) + "|warp");
      const warpRunSeed = hashSeed(warpBaseSeed + "|" + warpRun + "|" +
        state.nav.current.id + ">" + state.target.id + ":" + state.target.x + ":" + state.target.y);
      if (localSession) {
        localSession.activeSeeds = localSession.activeSeeds || {};
        localSession.activeSeeds.warp = warpRunSeed;
      }
      state.tubeBackdropSeed = warpRunSeed;
      const rng = randomFrom(warpRunSeed);
      state.layers = [];
      const courseLayerCount = 24;
      let previousSafeAngle = null;
      for (let i = 0; i < courseLayerCount; i += 1) {
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
        const progress = 0.08 + (i / Math.max(1, courseLayerCount - 1)) * 0.86 + (rng() - 0.5) * 0.006;
        state.layers.push({
          progress,
          type,
          safeAngle,
          gapHalf: type === "gate" ? 0.94 : 0.86,
          blockedAngles,
          sweepAngle: rng() * Math.PI * 2 - Math.PI,
          sweepSpeed: (rng() < 0.5 ? -1 : 1) * (0.55 + rng() * 0.38),
          obstacleWidth: type === "sweeper" ? 0.20 : 0.15,
          resolved: false
        });
      }
      tubeTitle.textContent = "WARP IN PROGRESS";
      state.warpPreviewClass = null;
      updateWarpTierPreviewButtons();
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
      // Прибытие — настоящее событие, а не таймер: гасим цикл фонов здесь.
      stopWarpBackgroundCycle();
      // Keep the same Warp OST running through retries, arrival and the asteroid maze.
      state.mode = "result";
      touchControls.hidden = true;
      tubeResult.hidden = false;
      overlay.classList.remove("is-tubing");
      tubeTitle.textContent = success ? "WARP STABLE" : "WARP DISTURBED";
      tubeResultTitle.textContent = success ? "Переход завершён" : "Защита туннеля перегружена";
      tubeResultText.textContent = success
        ? "Координаты " + sectorText(state.target) + " подтверждены. Автоматический вход в сектор…"
        : "Пилот получил слишком много попаданий. Повторите короткий участок или отмените переход — корабль останется на прежнем месте.";
      tubeRetry.hidden = success;
      tubeAbort.textContent = "ОТМЕНА";
      if (success) {
        // Give the arrival status one short beat, then enter the selected sector.
        // Cancel changes the mode first, so this callback cannot override the pilot.
        window.setTimeout(() => {
          if (state.mode === "result") confirmTubeArrival();
        }, 700);
      }
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
      disposeMaze();
      rememberPlace(null);
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
          state.nav.current.name = "ONI · NEUNO";
          state.nav.current.x = -40;
          state.nav.current.y = 30;
        }
      } else {
        const home = { id: "oni-css-neuno--40-30", name: "ONI · NEUNO", x: -40, y: 30, raw: null };
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
          label: "LOCAL TEST · RETURNED TO ONI / NEUNO · X -40, Y 30",
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
      if (status) status.textContent = "ARRIVED · ONI / NEUNO · LOCAL SIMULATION";
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

    function publishAsteroidChart(maze) {
      if (!maze) return;
      const marks = (maze.crystals || []).filter((crystal) => crystal.scouted || crystal.taken).map((crystal) => ({
        x: crystal.cell.x, y: crystal.cell.y, z: crystal.cell.z, taken: !!crystal.taken
      }));
      const anomalies = (maze.cells || []).filter((cell) => cell.y !== 1).map((cell) => ({
        x: cell.x, y: cell.y, z: cell.z,
        mode: ["drift", "flux", "dense"][hashSeed(String(maze.seed) + "|astral|" + cell.x + "|" + cell.y + "|" + cell.z) % 3]
      }));
      const hydrogen = maze.hydrogen || null;
      window.BCMAsteroidChart = {
        seed: maze.seed,
        dimensions: maze.dimensions,
        marks,
        anomalies,
        hydrogen: hydrogen ? {
          x: hydrogen.cell.x, y: hydrogen.cell.y, z: hydrogen.cell.z,
          unlocked: !!hydrogen.unlocked,
          taken: !!hydrogen.taken
        } : null
      };
    }

    function enterAsteroidMaze() {
      // Warp OST owns the whole Warp stage, including the asteroid maze.
      // A committed arrival replaces the previous rock. Opening the map must
      // not dispose it; only this handoff and a return to ONI CSS do.
      if (state.maze) disposeMaze();
      const engine = api();
      if (!engine || !engine.getRuntime) return;
      const runtime = engine.getRuntime();
      const THREE = runtime.THREE;
      const scene = runtime.scene;
      if (!THREE || !scene || !runtime.ship) return;

      // The asteroid is already built. Starting here must not depend on
      // flying to the Ring or climbing into the hold first.
      if (!state.nav || !state.nav.current) {
        state.nav = {
          current: { id: "asteroid-berth", name: "ASTEROID COMPLEX", x: -40, y: 30, raw: null },
          targets: [],
          live: false,
          localPreview: true,
          label: "ASTEROID COMPLEX",
          coordsKnown: true,
          adapter: null
        };
      }
      if (!state.target) {
        state.target = { id: "asteroid-complex", name: "ASTEROID COMPLEX", x: -39, y: 30, raw: null };
      }

      const NX = 7, NY = 3, NZ = 7, CELL = 6.8, WALL = 0.46;
      // Keep the test maze off-axis and away from the old negative-Z texture-preload trigger.
      const center = new THREE.Vector3(230, 0, 150);
      const localSession = window.BCMMiniSimSession || null;
      const locationSeeds = localSession && localSession.locationSeeds
        ? localSession.locationSeeds
        : {};
      const runCounters = localSession
        ? (localSession.runCounters || (localSession.runCounters = {}))
        : {};
      const asteroidRun = Number(runCounters.asteroid || 0) + 1;
      runCounters.asteroid = asteroidRun;
      const asteroidBaseSeed = Number.isSafeInteger(Number(locationSeeds.asteroid))
        ? Number(locationSeeds.asteroid) >>> 0
        : hashSeed(String(state.nav.current.id) + "|asteroid");
      const seed = hashSeed(asteroidBaseSeed + "|" + asteroidRun + "|" +
        state.nav.current.id + "->" + state.target.id + ":" + state.target.x + ":" + state.target.y);
      if (localSession) {
        localSession.activeSeeds = localSession.activeSeeds || {};
        localSession.activeSeeds.asteroid = seed;
      }
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
      function addWall(x, y, z, sx, sy, sz, cell) {
        walls.push({ x, y, z, sx, sy, sz, cell });
      }
      cells.forEach((cell) => {
        const x = cellX(cell.x), y = cellY(cell.y), z = cellZ(cell.z);
        if (cell.x === 0) addWall(x - CELL / 2, y, z, WALL, CELL, CELL, cell);
        if (cell.x === NX - 1) addWall(x + CELL / 2, y, z, WALL, CELL, CELL, cell);
        else if (!cell.open.xp) addWall(x + CELL / 2, y, z, WALL, CELL, CELL, cell);
        if (cell.y === 0) addWall(x, y - CELL / 2, z, CELL, WALL, CELL, cell);
        if (cell.y === NY - 1) addWall(x, y + CELL / 2, z, CELL, WALL, CELL, cell);
        else if (!cell.open.yp) addWall(x, y + CELL / 2, z, CELL, WALL, CELL, cell);
        if (cell.z === 0) {
          // Leave one clean entrance into the first central cell.
          if (!(cell.x === 0 && cell.y === 1)) addWall(x, y, z + CELL / 2, CELL, CELL, WALL, cell);
        } else if (!cell.open.zn) {
          addWall(x, y, z + CELL / 2, CELL, CELL, WALL, cell);
        }
        if (cell.z === NZ - 1) {
          // Far exit is opened only at the last cell. Internal Z-planes are emitted once
          // from the adjacent cell's positive face, avoiding overlapping double walls.
          if (!(cell.x === NX - 1 && cell.y === 1)) addWall(x, y, z - CELL / 2, CELL, CELL, WALL, cell);
        }
      });

      // Use every prepared asterwall variant. The files are small, and a full
      // shuffle means the entire asteroid run can display the whole texture family.
      let maze = null;
      const fallbackTexture = makeMazeTexture(THREE);
      const availableWallAssets = asteroidWallAssetPool();
      // Asset ordering is decorative too: do not consume the topology/crystal RNG.
      const wallAssetOrderRng = randomFrom(hashSeed(String(seed) + "|wall-assets"));
      for (let i = availableWallAssets.length - 1; i > 0; i -= 1) {
        const j = Math.floor(wallAssetOrderRng() * (i + 1));
        [availableWallAssets[i], availableWallAssets[j]] = [availableWallAssets[j], availableWallAssets[i]];
      }
      const chosenWallAssets = availableWallAssets;
      const wallMaterials = [];
      const wallTextures = [];
      const wallVariantTextures = [];
      const wallVariantMaterials = [];
      const wallVariantsByAsset = Array.from({ length: Math.max(1, chosenWallAssets.length) }, () => []);
      const wallTextureCopiesByAsset = Array.from({ length: Math.max(1, chosenWallAssets.length) }, () => []);
      if (chosenWallAssets.length) {
        const loader = new THREE.TextureLoader();
        chosenWallAssets.forEach((asset, index) => {
          const texture = loader.load(asset.url, (loadedTexture) => {
            // Clones created before TextureLoader decodes the image keep image=null.
            // Sync that decoded image into all existing wall and Ring texture copies.
            const syncImage = (copy) => {
              if (!copy) return;
              copy.image = loadedTexture.image;
              copy.needsUpdate = true;
            };
            (wallVariantsByAsset[index] || []).forEach((variant) => syncImage(variant.texture));
            (wallTextureCopiesByAsset[index] || []).forEach(syncImage);
          }, undefined, () => {
            // Keep both the 3D maze and Ring's 2D cutaway on the same fallback.
            wallTextures[index] = fallbackTexture;
            if (maze?.textures && maze.textures[index] !== undefined) maze.textures[index] = fallbackTexture;
            (wallTextureCopiesByAsset[index] || []).forEach((copy) => {
              copy.image = fallbackTexture.image;
              copy.needsUpdate = true;
            });
            if (wallMaterials[index]) {
              wallMaterials[index].map = fallbackTexture;
              wallMaterials[index].needsUpdate = true;
            }
            (wallVariantsByAsset[index] || []).forEach((variant) => {
              const replacement = fallbackTexture.clone();
              replacement.wrapS = THREE.RepeatWrapping;
              replacement.wrapT = THREE.RepeatWrapping;
              replacement.center.set(0.5, 0.5);
              replacement.rotation = variant.turn * (Math.PI / 2);
              replacement.needsUpdate = true;
              try { variant.texture.dispose(); } catch (e) {}
              variant.texture = replacement;
              variant.material.map = replacement;
              variant.material.needsUpdate = true;
              wallVariantTextures.push(replacement);
            });
            try { texture.dispose(); } catch (e) {}
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

      // Texture selection is deterministic for this maze seed but does not consume
      // the route/crystal RNG stream. Each cell's wall choice now drives both views.
      const wallLookRng = randomFrom(hashSeed(seed + "|wall-map"));
      cells.forEach((cell) => {
        cell.wallTurn = Math.floor(wallLookRng() * 4);
        cell.wallAsset = wallTextures.length > 1 ? Math.floor(wallLookRng() * wallTextures.length) : 0;
      });

      const wallVariantByKey = new Map();
      function wallVariant(cell) {
        const assetIndex = Math.max(0, Math.min(wallTextures.length - 1, Math.floor(Number(cell?.wallAsset) || 0)));
        const turn = ((Math.floor(Number(cell?.wallTurn) || 0) % 4) + 4) % 4;
        const key = assetIndex + ":" + turn;
        if (wallVariantByKey.has(key)) return { key, entry: wallVariantByKey.get(key) };
        const source = wallTextures[assetIndex] || fallbackTexture;
        const variantTexture = source.clone();
        variantTexture.wrapS = THREE.RepeatWrapping;
        variantTexture.wrapT = THREE.RepeatWrapping;
        variantTexture.center.set(0.5, 0.5);
        variantTexture.rotation = turn * (Math.PI / 2);
        variantTexture.needsUpdate = true;
        const variantMaterial = new THREE.MeshStandardMaterial({
          map: variantTexture, color: 0xffffff, roughness: 0.82, metalness: 0.24, emissive: 0x07121a
        });
        const entry = { assetIndex, turn, texture: variantTexture, material: variantMaterial };
        wallVariantByKey.set(key, entry);
        wallVariantsByAsset[assetIndex].push(entry);
        wallVariantTextures.push(variantTexture);
        wallVariantMaterials.push(variantMaterial);
        return { key, entry };
      }

      const unit = new THREE.BoxGeometry(1, 1, 1);
      const wallBatches = new Map();
      walls.forEach((wall) => {
        const resolved = wallVariant(wall.cell);
        if (!wallBatches.has(resolved.key)) wallBatches.set(resolved.key, { entry: resolved.entry, walls: [] });
        wallBatches.get(resolved.key).walls.push(wall);
      });
      const wallMeshes = Array.from(wallBatches.entries()).map(([key, batch]) => {
        const wallMesh = new THREE.InstancedMesh(unit, batch.entry.material, batch.walls.length);
        wallMesh.name = "asteroid-maze-wall-panels-" + key.replace(":", "-");
        wallMesh.frustumCulled = false;
        const matrix = new THREE.Matrix4();
        const rotation = new THREE.Quaternion();
        batch.walls.forEach((wall, instanceIndex) => {
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
      const wallMesh = wallMeshes[0] || null;
      const material = wallMaterials[0];
      const texture = wallTextures[0];
      const shell = new THREE.Mesh(
        new THREE.SphereGeometry(46, 18, 14),
        new THREE.MeshBasicMaterial({ color: 0x254050, transparent: true, opacity: 0.08, side: THREE.BackSide, depthWrite: false })
      );
      shell.name = "asteroid-inner-shell";
      shell.visible = false;
      shell.position.copy(center);
      group.add(shell);

      const crystalMaterial = new THREE.MeshBasicMaterial({ color: 0x66ffed });
      const crystalGeometry = new THREE.OctahedronGeometry(0.92, 1);
      const beaconMaterial = new THREE.MeshBasicMaterial({ color: 0xdbc17a });
      const beaconGeometry = new THREE.TorusGeometry(1.1, 0.12, 6, 20);
      const startNode = at(0, 1, 0);
      const exitNode = at(NX - 1, 1, NZ - 1);

      const routeParent = new Map([[startNode, null]]);
      const routeQueue = [startNode];
      for (let cursor = 0; cursor < routeQueue.length && !routeParent.has(exitNode); cursor += 1) {
        const here = routeQueue[cursor];
        dirs.forEach((dir) => {
          if (!here.open[dir.key]) return;
          const next = at(here.x + dir.x, here.y + dir.y, here.z + dir.z);
          if (routeParent.has(next)) return;
          routeParent.set(next, here);
          routeQueue.push(next);
        });
      }
      const routeCells = [];
      for (let node = exitNode; node && routeParent.has(node); node = routeParent.get(node)) routeCells.unshift(node);
      const isEndpoint = (cell) =>
        (cell.x === startNode.x && cell.y === startNode.y && cell.z === startNode.z) ||
        (cell.x === exitNode.x && cell.y === exitNode.y && cell.z === exitNode.z);
      let coreCandidates = routeCells.filter((cell) => !isEndpoint(cell));
      const middleRoute = coreCandidates.filter((cell) => cell.y === 1);
      if (middleRoute.length >= 3) coreCandidates = middleRoute;
      const crystalCells = [];
      [0.22, 0.50, 0.78].forEach((fraction) => {
        if (coreCandidates.length < 3) return;
        let index = Math.max(0, Math.min(coreCandidates.length - 1, Math.round((coreCandidates.length - 1) * fraction)));
        while (crystalCells.includes(coreCandidates[index]) && index < coreCandidates.length - 1) index += 1;
        if (crystalCells.includes(coreCandidates[index])) index = coreCandidates.findIndex((cell) => !crystalCells.includes(cell));
        if (index >= 0) crystalCells.push(coreCandidates[index]);
      });
      const fallbackCandidates = cells.filter((cell) => !isEndpoint(cell) && !crystalCells.includes(cell));
      while (crystalCells.length < 3 && fallbackCandidates.length) {
        crystalCells.push(fallbackCandidates.splice(Math.floor(rng() * fallbackCandidates.length), 1)[0]);
      }
      const crystals = [];
      crystalCells.slice(0, 3).forEach((cell, index) => {
        const mesh = new THREE.Mesh(crystalGeometry, crystalMaterial);
        mesh.position.copy(cellPosition(cell.x, cell.y, cell.z));
        mesh.position.y += 0.35;
        mesh.name = "core-shard-" + index;
        mesh.scale.setScalar(1.18);
        group.add(mesh);
        crystals.push({ mesh, taken: false, scouted: true, phase: rng() * Math.PI * 2, cell: { x: cell.x, y: cell.y, z: cell.z } });
      });
      const beacon = new THREE.Mesh(beaconGeometry, beaconMaterial);
      beacon.position.copy(cellPosition(exitNode.x, exitNode.y, exitNode.z));
      beacon.rotation.x = Math.PI / 2;
      beacon.scale.set(1.65, 1.65, 1.65);
      beacon.name = "return-warp-beacon";
      group.add(beacon);

      const satellites = [
        { offset: new THREE.Vector3(34, 3, 10), radius: 6.4 },
        { offset: new THREE.Vector3(-30, -7, 16), radius: 3.6 }
      ].map((rock, index) => {
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(rock.radius, 12, 9),
          wallMaterials[index % wallMaterials.length]
        );
        mesh.position.copy(center).add(rock.offset);
        mesh.name = "asteroid-satellite-" + index;
        group.add(mesh);
        return { position: mesh.position, radius: rock.radius, mesh: mesh };
      });

      scene.add(group);
      maze = {
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
        wallTextureCopiesByAsset,
        material,
        materials: wallMaterials,
        wallVariantMaterials,
        wallVariantTextures,
        geometry: unit,
        crystalGeometry,
        crystalMaterial,
        beaconGeometry,
        beaconMaterial,
        satellites,
        // Wide enough to fly around the asteroid and its satellites.
        // Wall-contact damping stays the 0.11.2 baseline; only the envelope grew.
        flyRadius: 160,
        lastPosition: null,
        lastImpactAt: 0,
        ringCompleted: false,
        hydrogen: {
          cell: { x: startNode.x, y: startNode.y, z: startNode.z },
          unlocked: !!window.BCMWorldMission?.hydrogenUnlocked,
          taken: !!window.BCMWorldMission?.hydrogenCollected,
          scouted: false
        }
      };
      if (window.BCMWorldMission) {
        window.BCMWorldMission.asteroidSeed = seed;
      }
      state.savedSpeedMode = engine.getSpeedMode ? engine.getSpeedMode() : 1;
      if (engine.setSpeedMode) engine.setSpeedMode(2);
      state.maze = maze;
      maze.pickupEffects = [];

      // Wall-mounted crystal deposits are purely decorative. Their placement
      // uses a separate seed stream so it cannot alter maze topology, exits,
      // Hydrogen cells, wall textures or the existing collision list.
      function attachAsteroidWallCrystals() {
        const decorationGroup = new THREE.Group();
        decorationGroup.name = "asteroid-wall-crystal-decorations";
        maze.wallCrystalGroup = decorationGroup;
        group.add(decorationGroup);

        const placementRng = randomFrom(hashSeed(String(seed) + "|wall-crystal-layout"));
        const endpoint = (cell, point) => !!cell && !!point &&
          cell.x === point.x && cell.y === point.y && cell.z === point.z;
        const byCell = new Map();

        walls.forEach((wall) => {
          const cell = wall && wall.cell;
          if (!cell || endpoint(cell, maze.startCell) || endpoint(cell, maze.exitCell)) return;

          // Only the vertical side panels are decorated. Floor/ceiling panels
          // and passage openings stay visually clear.
          if (wall.sy <= Math.min(wall.sx, wall.sz)) return;
          const key = cell.x + ":" + cell.y + ":" + cell.z;
          if (!byCell.has(key)) byCell.set(key, []);
          byCell.get(key).push(wall);
        });

        // Prefer the first traversable route cells across all heights so the pilot can
        // see a deposit early in the asteroid run. This only ranks the existing
        // wall list; route generation and its seeded RNG are not modified.
        const routeIndexByCell = new Map();
        routeCells.forEach((cell, index) => {
          routeIndexByCell.set(cell.x + ":" + cell.y + ":" + cell.z, index);
        });
        const candidates = [];
        byCell.forEach((cellWalls, key) => {
          const routeIndex = routeIndexByCell.get(key);
          if (Number.isFinite(routeIndex) && routeIndex <= 0) return;
          if (!cellWalls.length) return;
          const pick = Math.floor(placementRng() * cellWalls.length);
          const onRoute = Number.isFinite(routeIndex);
          candidates.push({
            wall: cellWalls[pick],
            routeIndex: onRoute ? routeIndex : null,
            routePriority: onRoute ? 0 : 1,
            sortSalt: placementRng()
          });
        });
        // Use the main route first, then fill other eligible cells across the maze
        // if it has fewer than twelve panels. The wall list remains read-only.
        candidates.sort((a, b) =>
          a.routePriority - b.routePriority ||
          (a.routeIndex ?? Number.MAX_SAFE_INTEGER) - (b.routeIndex ?? Number.MAX_SAFE_INTEGER) ||
          a.sortSalt - b.sortSalt
        );

        const placementCount = Math.min(12, candidates.length);
        // Rotate the four-colour palette by one seeded offset. A full set of
        // four deposits therefore shows all four authored variants, while the
        // asteroid seed still changes which colour appears first.
        const paletteOffset = Math.floor(placementRng() * asteroidWallCrystalColors.length);
        const placements = candidates.slice(0, placementCount).map((candidate, index) => {
          const wall = candidate.wall;
          const routeIndex = candidate.routeIndex;
          const cellCenter = cellPosition(wall.cell.x, wall.cell.y, wall.cell.z);
          const inward = cellCenter.sub(new THREE.Vector3(wall.x, wall.y, wall.z));
          inward.y = 0;
          if (inward.lengthSq() < 1e-6) return null;
          inward.normalize();

          const up = new THREE.Vector3(0, 1, 0);
          // The separate crystal GLBs retain their shared source coordinates.
          // Their growth axis is local +Z; map it out from the wall and keep +Y vertical.
          const tangent = up.clone().cross(inward).normalize();
          const basis = new THREE.Matrix4().makeBasis(tangent, up, inward);
          const quaternion = new THREE.Quaternion().setFromRotationMatrix(basis);
          const wallThickness = Math.min(wall.sx, wall.sz);
          const scale = 0.60 + placementRng() * 0.07;
          const color = asteroidWallCrystalColors[(index + paletteOffset) % asteroidWallCrystalColors.length];
          const position = new THREE.Vector3(wall.x, wall.y, wall.z)
            .addScaledVector(inward, wallThickness * 0.5 - 0.08)
            .addScaledVector(tangent, (placementRng() - 0.5) * 2.4)
            .addScaledVector(up, (placementRng() - 0.5) * 1.6);
          return { wall, position, quaternion, scale, routeIndex, color, index };
        }).filter(Boolean);

        maze.wallCrystalPlacementCount = placements.length;
        maze.wallCrystalPlacements = placements.map((placement) => ({
          cell: { x: placement.wall.cell.x, y: placement.wall.cell.y, z: placement.wall.cell.z },
          routeIndex: placement.routeIndex,
          color: placement.color
        }));
        if (!placements.length) {
          group.remove(decorationGroup);
          maze.wallCrystalGroup = null;
          return;
        }

        Promise.all(placements.map((placement) =>
          loadAsteroidWallCrystalTemplate(THREE, placement.color)
            .then((template) => ({ placement, template }))
        )).then((loaded) => {
          // A load may finish after the pilot has left and disposed this maze.
          if (!maze.active || state.maze !== maze || decorationGroup.parent !== group) return;
          loaded.forEach(({ placement, template }) => {
            const model = template.clone(true);
            model.name = "asteroid-wall-crystal-" + placement.index;
            model.position.copy(placement.position);
            model.quaternion.copy(placement.quaternion);
            model.scale.setScalar(placement.scale);
            model.userData.bcmWallDecoration = true;
            model.userData.bcmWallColor = placement.color;
            model.userData.bcmWallCell = { x: placement.wall.cell.x, y: placement.wall.cell.y, z: placement.wall.cell.z };
            model.userData.bcmWallRouteIndex = placement.routeIndex;
            model.userData.bcmWallScale = placement.scale;
            model.traverse((node) => {
              if (!node || !node.isMesh) return;
              node.frustumCulled = true;
              node.castShadow = false;
              node.receiveShadow = false;
            });
            decorationGroup.add(model);
          });
          maze.wallCrystalCount = loaded.length;
        }).catch((error) => {
          if (decorationGroup.parent === group) group.remove(decorationGroup);
          if (maze.wallCrystalGroup === decorationGroup) maze.wallCrystalGroup = null;
          maze.wallCrystalCount = 0;
          try { console.warn("[BCM] Asteroid wall crystal model was skipped:", error); } catch (e) {}
        });
      }

      attachAsteroidWallCrystals();
      publishAsteroidChart(maze);
      function spawnCrystalPickupEffect(position, pickupLabel) {
        const effect = new THREE.Group();
        effect.name = "asteroid-crystal-pickup-impact";
        effect.position.copy(position);
        const glowMaterial = new THREE.MeshBasicMaterial({
          color: 0xbafcff, transparent: true, opacity: 0.98,
          blending: THREE.AdditiveBlending, depthWrite: false
        });
        const ringMaterial = new THREE.MeshBasicMaterial({
          color: 0x5befff, transparent: true, opacity: 0.92,
          blending: THREE.AdditiveBlending, depthWrite: false
        });
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), glowMaterial);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.055, 6, 24), ringMaterial);
        ring.rotation.x = Math.PI * 0.34;
        effect.add(core, ring);
        const light = new THREE.PointLight(0x74f6ff, 3.8, 12, 2);
        effect.add(light);

        // A world-space label makes mission pickups obvious even when the HUD is small.
        const labelCanvas = document.createElement("canvas");
        labelCanvas.width = 320;
        labelCanvas.height = 112;
        const ctx = labelCanvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, labelCanvas.width, labelCanvas.height);
          ctx.font = "bold 64px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.lineJoin = "round";
          ctx.lineWidth = 14;
          ctx.strokeStyle = "rgba(2, 15, 26, 0.95)";
          ctx.strokeText(pickupLabel || "CORE +1", 160, 56);
          ctx.fillStyle = pickupLabel === "H +1" ? "#bafff1" : "#a9f5ff";
          ctx.fillText(pickupLabel || "CORE +1", 160, 56);
        }
        const labelTexture = new THREE.CanvasTexture(labelCanvas);
        labelTexture.needsUpdate = true;
        const labelMaterial = new THREE.SpriteMaterial({
          map: labelTexture, transparent: true, depthWrite: false, opacity: 1
        });
        const labelSprite = new THREE.Sprite(labelMaterial);
        labelSprite.position.set(0, 1.55, 0);
        labelSprite.scale.set(3.6, 1.25, 1);
        effect.add(labelSprite);

        scene.add(effect);
        maze.pickupEffects.push({
          group: effect, core, ring, light, glowMaterial, ringMaterial,
          labelSprite, labelMaterial, labelTexture, age: 0, duration: 1.15
        });
      }
      function updateCrystalPickupEffects(dt) {
        maze.pickupEffects = maze.pickupEffects.filter((effect) => {
          effect.age += dt;
          const t = Math.min(1, effect.age / effect.duration);
          effect.ring.scale.setScalar(0.55 + t * 6.6);
          effect.ring.rotation.z += dt * 4.0;
          effect.core.scale.setScalar(0.6 + (1 - t) * 2.8);
          effect.glowMaterial.opacity = Math.max(0, (1 - t) * 0.98);
          effect.ringMaterial.opacity = Math.max(0, (1 - t) * 0.96);
          effect.light.intensity = Math.max(0, (1 - t) * 3.8);
          if (effect.labelSprite) {
            effect.labelSprite.position.y = 1.55 + t * 2.2;
            effect.labelMaterial.opacity = Math.max(0, 1 - t * 0.92);
            effect.labelSprite.scale.set(3.6 + t * 0.75, 1.25 + t * 0.22, 1);
          }
          if (t >= 1) {
            scene.remove(effect.group);
            effect.group.traverse((child) => { if (child.geometry) child.geometry.dispose(); });
            effect.glowMaterial.dispose();
            effect.ringMaterial.dispose();
            if (effect.labelMaterial) effect.labelMaterial.dispose();
            if (effect.labelTexture) effect.labelTexture.dispose();
            return false;
          }
          return true;
        });
      }
      maze.spawnCrystalPickupEffect = spawnCrystalPickupEffect;
      maze.updateCrystalPickupEffects = updateCrystalPickupEffects;
      state.ringApproachArmed = true;
      root.classList.add("bcm-warp-maze-active");
      exitButton.textContent = nextWarpDestinationLabel();
      exitButton.hidden = false;
      overlay.hidden = true;
      root.classList.remove("bcm-warp-open");
      launchButton.classList.remove("is-active");

      // The main physics resumes in this scene. The seeded maze uses a small number of
      // instanced wall batches and up to four asterwall textures, with a tiny procedural fallback.
      // Cell +Z index is world −Z, the ship's forward at yaw 0. Face whichever
      // side the carve actually opened, including up/down, so spawn is not a wall.
      const spawn = maze.start.clone();
      const look = new THREE.Quaternion();
      if (startNode.open.zp) {
        spawn.z -= 0.45;
      } else if (startNode.open.xp) {
        look.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2);
        spawn.x += 0.45;
      } else if (startNode.open.xn) {
        look.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
        spawn.x -= 0.45;
      } else if (startNode.open.yp) {
        look.setFromEuler(new THREE.Euler(1.05, 0, 0, "YXZ"));
        spawn.y += 0.45;
      } else if (startNode.open.yn) {
        look.setFromEuler(new THREE.Euler(-1.05, 0, 0, "YXZ"));
        spawn.y -= 0.45;
      } else if (startNode.open.zn) {
        look.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
        spawn.z += 0.45;
      }
      engine.teleport({ x: spawn.x, y: spawn.y, z: spawn.z }, look);
      engine.pauseForWarp(false);
      rememberPlace(asteroidPlace(state.target));
      engine.setExternalHUD(state.place.label, "EXPEDITION · CORE SHARDS 0/3 · U / R3 OPENS THE HOLD");
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

      // Ring gameplay replaces the flight view. The hold does not: the helm
      // keeps flying the same ship, so maze collision stays active.
      if (state.ringPlatformer || state.ringTransitionActive) {
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
      const flyRadius = Number(maze.flyRadius) || 160;
      if (fromCenter.length() > flyRadius) {
        fromCenter.setLength(flyRadius);
        pos.copy(maze.center).add(fromCenter);
        ship.velocity.multiplyScalar(0.25);
      }
      (maze.satellites || []).forEach((rock) => {
        const away = pos.clone().sub(rock.position);
        const limit = rock.radius + 1.05;
        if (away.length() >= limit) return;
        if (away.lengthSq() < 1e-6) away.set(1, 0, 0);
        away.setLength(limit);
        pos.copy(rock.position).add(away);
        ship.velocity.multiplyScalar(0.45);
      });

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
        if (!crystal.scouted && pos.distanceTo(crystal.mesh.position) < 8) {
          crystal.scouted = true;
          publishAsteroidChart(maze);
          setMazeStatus("CHART MARK · CORE SHARD " + (crystal.cell.x + 1) + "." + (crystal.cell.z + 1));
        }
        if (pos.distanceTo(crystal.mesh.position) < 2.0) {
          const pickupPosition = crystal.mesh.position.clone();
          crystal.taken = true;
          crystal.scouted = true;
          crystal.mesh.visible = false;
          maze.count += 1;
          publishAsteroidChart(maze);
          const mission = window.BCMWorldMission || {};
          const isHydrogenPickup = !!mission.hydrogenUnlocked &&
            Number(mission.hydrogenCount || 0) < 3;
          maze.spawnCrystalPickupEffect(pickupPosition, isHydrogenPickup ? "H +1" : "CORE +1");
          if (isHydrogenPickup) {
            window.dispatchEvent(new CustomEvent("bcm:mission:hydrogen-shard-collected", {
              detail: {
                crystalId: String(maze.seed) + ":" + crystal.cell.x + "," + crystal.cell.y + "," + crystal.cell.z,
                asteroidSeed: maze.seed,
                cell: { ...crystal.cell },
                type: "asteroid-crystal"
              }
            }));
            const count = Number(window.BCMWorldMission?.hydrogenCount || 0);
            setMazeStatus("HYDROGEN " + count + "/3 · " + Math.max(0, 3 - count) + " LEFT");
          } else {
            setMazeStatus("CORE SHARDS " + maze.count + "/3 · " + (maze.count === 3 ? "GOLD RING IS OPEN" : "SEARCH THE CONNECTED CORRIDORS"));
          }
        }
      });
      maze.updateCrystalPickupEffects(Math.min(frame.dt || 0.016, 0.04));
      maze.beacon.rotation.z += Math.min(frame.dt || 0.016, 0.04) * 0.4;
      const ringDistance = pos.distanceTo(maze.beacon.position);
      state.ringDistance = ringDistance;
      syncHullButtonVisibility();
      syncRingButtonVisibility();
      // Require the ship to leave the beacon's capture radius after exiting Ring
      // before accepting another approach; the same level can still be re-entered.
      if (ringDistance > 4.2) {
        state.ringApproachArmed = true;
        state.ringEntryFailed = false;
      }
      if (state.ringApproachArmed && !state.ringEntryFailed && !state.ringPlatformer &&
          !maze.ringCompleted && ringDistance < 2.6) {
        attemptOpenRingPlatformer(maze);
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
          ? "RING AHEAD · THE LEVEL IS OPTIONAL · HELM STILL FLIES THE SHIP"
          : "EXPEDITION · CORE SHARDS " + maze.count + "/3 · ASTEROID COMPLEX";
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

      // The hold is the crew's station, not a cutscene. Do not pause the ship:
      // whoever is standing at the helm keeps flying it.
      state.hullOpen = true;
      root.classList.add("bcm-hull-interior-active");
      window.dispatchEvent(new Event("resize"));
      window.BCMDialogue?.showControls("hull");
      window.BCMHullHelmState = { engaged: true, thrust: 0, yaw: 0 };
      window.BCMRingWindowState = null;
      syncHullButtonVisibility();
      window.BCMiniSimAPI?.requestFlightPointerLock?.();

      window.BCMHullDive.open(() => {
        state.hullOpen = false;
        root.classList.remove("bcm-hull-interior-active");
        window.dispatchEvent(new Event("resize"));
        window.BCMRingWindowState = null;
        window.BCMHullHelmState = { engaged: false, thrust: 0, yaw: 0 };
        syncHullButtonVisibility();
        window.BCMiniSimAPI?.requestFlightPointerLock?.();
      });
      syncHullButtonVisibility();
      return true;
    }

    const hullEntryPadWasDown = new Map();
    const ringEntryPadWasDown = new Map();
    window.BCMDeepSpaceWarpPoll = () => {
      syncHullButtonVisibility();
      syncRingButtonVisibility();
      const pads = navigator.getGamepads ? [...navigator.getGamepads()] : [];
      let pressed = false;
      let ringPressed = false;
      for (const pad of pads) {
        if (!pad || !pad.connected) continue;
        const down = !!pad.buttons?.[11]?.pressed;
        const wasDown = hullEntryPadWasDown.get(pad.index) || false;
        hullEntryPadWasDown.set(pad.index, down);
        if (down && !wasDown) pressed = true;
        const ringDown = !!pad.buttons?.[0]?.pressed;
        const ringWasDown = ringEntryPadWasDown.get(pad.index) || false;
        ringEntryPadWasDown.set(pad.index, ringDown);
        if (ringDown && !ringWasDown) ringPressed = true;
      }
      for (const index of [...hullEntryPadWasDown.keys()]) {
        if (!pads.some((pad) => pad && pad.connected && pad.index === index)) hullEntryPadWasDown.delete(index);
      }
      for (const index of [...ringEntryPadWasDown.keys()]) {
        if (!pads.some((pad) => pad && pad.connected && pad.index === index)) ringEntryPadWasDown.delete(index);
      }
      if (ringPressed && state.mode === "maze" && state.maze && state.maze.active &&
          state.ringApproachArmed && state.ringDistance < 18 && !state.ringPlatformer &&
          !state.ringTransitionActive && !state.hullOpen) {
        attemptOpenRingPlatformer(state.maze);
        return;
      }
      if (!pressed || state.mode === "map" || state.mode === "tube" || state.mode === "result" ||
          state.ringPlatformer || state.ringTransitionActive || state.hullOpen ||
          document.getElementById("bcm-hull-dive") ||
          document.getElementById("bcm-ring-platformer") ||
          document.getElementById("bcm-ring-transition")) return;
      const towerRoot = document.querySelector(".bcm-tower");
      if (towerRoot && !towerRoot.hidden) return;
      openHullInterior();
    };

    function openRingPlatformer(maze, afterTransition = false) {
      if (!maze || !maze.active || state.ringPlatformer || state.hullOpen || state.mode !== "maze") return false;
      const engine = api();
      const runtime = engine && engine.getRuntime ? engine.getRuntime() : null;
      if (!runtime?.ship || !runtime.THREE || !runtime.scene) return false;
      // Disarm only after the engine is valid; a failed attempt must not lock out
      // the Ring button until the pilot leaves the beacon's capture radius.
      state.ringApproachArmed = false;
      if (!afterTransition) {
        const transitionSource = findRingTransitionVideoSource();
        if (transitionSource) return playRingTransition(maze, transitionSource, engine);
      }

      startRingAudio();
      state.ringPlatformer = true;
      hullEnterButton.hidden = true;
      ringEnterButton.hidden = true;
      if (engine.pauseForWarp) engine.pauseForWarp(true);

      const THREE = runtime.THREE;
      const scene = runtime.scene;
      const seed = Number(maze.seed) || 0;

      const root2d = document.createElement("div");
      root2d.id = "bcm-ring-platformer";
      root2d.tabIndex = 0;
      root2d.style.cssText = "position:fixed;inset:0;z-index:1001200;background:transparent;color:#e8f4f8;font:14px system-ui,sans-serif;overflow:hidden;touch-action:none;pointer-events:auto";
      const en = window.BCMDialogue?.language === "en";
      const copy = en ? {
        landing: "LANDING", bosses: "BOSSES", back: "Return to ship", canvas: "Large arena progress",
        jump: "JUMP", action: "E · DOOR", floor: "R · FLOOR", laser: "LASER", dash: "DASH",
        title: "Seeded asteroid cells",
        description: "This is the same asteroid you just landed on. E follows the marked open door; R / LB changes floor at a glowing hatch. Space / W only jumps. A boss may guard a passage; the pig arena is optional.",
        controls: "P1: A/D or ←/→ move · Space/W jump · E door · R floor · Q fire · Shift/C dash\nP2: J/L move · P jump · O door · I floor · K fire · U dash\nGamepad: stick move · A jump · X door · LB floor · Y fire · B dash"
      } : {
        landing: "ВЫСАДКА", bosses: "БОССЫ", back: "В корабль", canvas: "Прогресс по аренам",
        jump: "ПРЫЖОК", action: "E · ДВЕРЬ", floor: "R · ЭТАЖ", laser: "ЛАЗЕР", dash: "РЫВОК",
        title: "Высадка на этот астероид",
        description: "Это тот же астероид и те же текстуры клеток. E — пройти через отмеченную открытую дверь; R / LB — перейти на другой этаж у светящегося люка. Space / W — только прыжок. Иногда проход охраняет противник; арена со свиньями необязательна.",
        controls: "P1: A/D или ←/→ — бег · Space/W — прыжок · E — дверь · R — этаж · Q — лазер · Shift/C — рывок\nP2: J/L — бег · P — прыжок · O — дверь · I — этаж · K — лазер · U — рывок\nГеймпад: стик — бег · A — прыжок · X — дверь · LB — этаж · Y — лазер · B — рывок"
      };
      root2d.innerHTML =
        '<div style="position:absolute;top:10px;left:12px;right:12px;display:flex;justify-content:space-between;gap:10px;align-items:flex-start;pointer-events:none;z-index:3">' +
          '<div style="max-width:62%;text-shadow:0 2px 8px #000"><div style="font-size:11px;letter-spacing:.16em;color:#60ddec">RING // FRONTIER</div>' +
          '<div data-ring-status style="font-weight:900;margin-top:5px;line-height:1.3">' + copy.landing + '</div>' +
          '<div data-ring-floor style="margin-top:5px;color:#b8cbd6;font-size:12px"></div>' +
          '<div data-ring-boss-meter style="display:none;width:min(48vw,300px);height:7px;margin-top:8px;border:1px solid rgba(211,235,248,.6);border-radius:9px;background:rgba(4,10,18,.8);overflow:hidden"><div data-ring-boss-fill style="width:100%;height:100%;background:linear-gradient(90deg,#55e6ef,#f6b55e);transition:width .12s linear"></div></div></div>' +
          '<div style="display:flex;flex-direction:column;gap:7px;align-items:flex-end;pointer-events:auto">' +
            '<div data-ring-count style="padding:6px 9px;background:rgba(7,22,34,.94);border:1px solid #25485b;border-radius:8px;color:#d9f8ff;white-space:nowrap">' + copy.bosses + ' 0/3</div>' +
            '<button type="button" data-ring-exit title="' + copy.back + '" aria-label="' + copy.back + '" style="min-width:42px;min-height:42px;padding:7px 11px;border:1px solid #547083;border-radius:9px;background:rgba(16,35,45,.96);color:#e8fbff;font-size:20px;font-weight:800">↩</button>' +
          '</div>' +
        '</div>' +
        '<canvas data-ring-canvas aria-label="' + copy.canvas + '" style="position:absolute;right:12px;top:78px;width:min(34vw,220px);height:168px;min-width:120px;min-height:120px;border:1px solid rgba(88,173,198,.55);border-radius:9px;background:rgba(3,10,18,.83);z-index:2;pointer-events:none"></canvas>' +
        '<div data-ring-split-divider hidden style="position:absolute;inset:0;z-index:1;pointer-events:none;border:0"></div>' +
        '<div style="position:absolute;left:12px;right:12px;bottom:calc(10px + env(safe-area-inset-bottom));display:flex;justify-content:space-between;align-items:flex-end;gap:12px;z-index:4;pointer-events:none">' +
          '<div style="display:grid;grid-template-columns:repeat(3,46px);grid-template-rows:repeat(3,42px);gap:4px;pointer-events:auto">' +
             '<span></span><button type="button" data-ring-action="jump" aria-label="' + copy.jump + '" style="grid-column:2;grid-row:1;min-height:42px">' + copy.jump + '</button><span></span>' +
             '<button type="button" data-ring-action="left" aria-label="' + (en ? "Left" : "Влево") + '" style="min-height:42px">◀</button><span style="display:block"></span><button type="button" data-ring-action="right" aria-label="' + (en ? "Right" : "Вправо") + '" style="min-height:42px">▶</button>' +
             '<button type="button" data-ring-action="floor" aria-label="' + copy.floor + '" title="' + (en ? "R / LB: change floor at a glowing hatch" : "R / LB: сменить этаж у светящегося люка") + '" style="grid-column:1 / span 3;grid-row:3;min-height:38px">' + copy.floor + '</button>' +
           '</div>' +
           '<div style="display:flex;gap:6px;align-items:flex-end;pointer-events:auto">' +
            '<button type="button" data-ring-action="activate" style="min-height:42px;padding:6px 10px;font-size:12px">' + copy.action + '</button>' +
            '<button type="button" data-ring-action="fire" aria-label="' + copy.laser + '" style="min-height:42px;padding:6px 10px;font-size:12px">' + copy.laser + '</button>' +
            '<button type="button" data-ring-action="dash" style="min-height:42px;padding:6px 10px;font-size:12px">' + copy.dash + '</button>' +
          '</div>' +
        '</div>' +
        '<div data-ring-mode-menu style="position:absolute;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(1,5,12,.74);pointer-events:auto">' +
          '<div style="width:min(480px,100%);padding:22px;border:1px solid #37677c;border-radius:16px;background:rgba(6,20,32,.97);box-shadow:0 12px 60px #0009;text-align:center">' +
            '<div style="font-size:12px;letter-spacing:.18em;color:#60ddec">RING FRONTIER · SEED ' + seed + '</div>' +
            '<div style="font-size:24px;font-weight:900;margin:12px 0 7px">' + copy.title + '</div>' +
            '<div style="color:#b7cbd6;line-height:1.5;margin-bottom:17px">' + copy.description + '</div>' +
            '<div style="color:#91b8c7;font-size:12px;line-height:1.5;margin-bottom:17px;white-space:pre-line">' + copy.controls + '</div>' +
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
      const modeButtons = [
        root2d.querySelector("[data-ring-single]"),
        root2d.querySelector("[data-ring-multi]")
      ];
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
      let menuFocusIndex = 0;
      let menuPadPrevious = { left: false, right: false, confirm: false };
      const weaponProgress = window.BCMRingWeaponProgress || (window.BCMRingWeaponProgress = {
        type: "pointer", tier: 1, completedRuns: 0, pendingUpgrade: false, lastUpgradePromptRun: -1, nextUpgradeAt: 2
      });
      weaponProgress.nextUpgradeAt = Math.max(2, Math.floor(Number(weaponProgress.nextUpgradeAt) || 2));
      const weaponPalette = [0xff426f, 0xffab48, 0xffed57, 0x56f0a0, 0x58c9ff, 0xc884ff];
      const weaponShots = [];
      let weaponShotIndex = 0;
      let masterOfferedThisRun = false;
      const oneShotActions = new Set(["activate", "dash", "floor"]);
      const worldSaved = {
        oldMazeVisible: maze.group ? maze.group.visible : true,
        oldShipVisible: runtime.ship.visual ? runtime.ship.visual.visible : true,
        oldBackground: scene.background
      };

      function focusModeMenu(index) {
        if (gameStarted || done || !modeButtons.length) return;
        menuFocusIndex = ((Number(index) || 0) % modeButtons.length + modeButtons.length) % modeButtons.length;
        modeButtons.forEach((button, buttonIndex) => {
          if (!button) return;
          const focused = buttonIndex === menuFocusIndex;
          button.style.outline = focused ? "3px solid #f4fbff" : "none";
          button.style.outlineOffset = "3px";
          button.style.boxShadow = focused
            ? "0 0 0 5px rgba(83,213,235,.25), 0 8px 24px #0008"
            : "none";
          button.setAttribute("aria-pressed", focused ? "true" : "false");
        });
      }

      function confirmModeMenu() {
        if (gameStarted || done) return false;
        startMode(menuFocusIndex === 1 ? "multi" : "single");
        return true;
      }

      function pollModeMenuGamepad() {
        const connected = [...navigator.getGamepads()].filter((pad) => pad && pad.connected);
        const pad = connected[0];
        if (!pad) {
          menuPadPrevious = { left: false, right: false, confirm: false };
          return;
        }
        const axisX = Number(pad.axes?.[0] || 0);
        const button = (number) => !!(pad.buttons && pad.buttons[number] && pad.buttons[number].pressed);
        const left = button(14) || axisX < -0.55;
        const right = button(15) || axisX > 0.55;
        // Standard gamepad A confirms a menu choice; Start is a convenient fallback.
        const confirm = button(0) || button(9);
        if (left && !menuPadPrevious.left) focusModeMenu(menuFocusIndex - 1);
        if (right && !menuPadPrevious.right) focusModeMenu(menuFocusIndex + 1);
        if (confirm && !menuPadPrevious.confirm) confirmModeMenu();
        menuPadPrevious = { left, right, confirm };
      }

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
        world.name = "bcm-ring-frontier-side-scroll";
        const buckets = { floor: [], platforms: [], backdrop: [], trim: [] };
        const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
        const materials = [
          new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0.22 }),
          new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.35, emissive: 0x06121b }),
          new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0.04, emissive: 0x030a13 }),
          new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.45, emissive: 0x0b2630 })
        ];
        const worldTextures = [];
        const extraGeometries = [];
        function addBox(bucket, x, y, z, sx, sy, sz, color) {
          buckets[bucket].push({ x, y, z, sx, sy, sz, color: color || 0x28414d });
        }
        const platforms = [];
        function addPlatform(x1, x2, topY, color) {
          const width = x2 - x1;
          const center = (x1 + x2) / 2;
          const floor = topY === 0;
          addBox(floor ? "floor" : "platforms", center, topY - 0.18, 0,
            width, 0.36, 3.8, color || (floor ? 0x182b38 : 0x486b7d));
          if (floor) {
            // Broken-up floor markings read as a traversable stage, not a flat map tile.
            for (let mark = x1 + 2.5; mark < x2 - 1; mark += 7.5) {
              addBox("trim", mark, 0.045, 0.08, 1.25, 0.055, 0.08,
                ((Math.floor(mark) % 2) === 0) ? 0x61deef : 0x405e70);
            }
          } else {
            // A bright lip and dark support braces give the ledges a comic-panel silhouette.
            addBox("trim", center, topY + 0.055, 0.12, width + 0.12, 0.075, 3.92,
              color || 0x64d9e8);
            const braceY = topY * 0.48;
            const braceHeight = Math.max(0.45, topY * 0.88);
            [x1 + 0.35, x2 - 0.35].forEach((braceX) => {
              addBox("backdrop", braceX, braceY, -0.34, 0.20, braceHeight, 0.20, 0x07121b);
              addBox("trim", braceX, braceY, -0.20, 0.055, braceHeight * 0.94, 0.08,
                color || 0x64d9e8);
            });
          }
          platforms.push({ minX: x1, maxX: x2, y: topY });
        }
        addPlatform(-51, 84, 0, 0x142936);
        [
          [-39, -33, 2.2], [-31, -26, 4.25], [-24, -19, 2.3], [-16, -9, 3.75],
          [1, 6, 2.1], [8, 13, 4.1], [15, 21, 2.35], [24, 31, 4.0],
          [39, 45, 2.15], [47, 52, 4.35], [55, 61, 2.5], [64, 71, 4.0]
        ].forEach((ledge, i) => addPlatform(ledge[0], ledge[1], ledge[2],
          [0x456b7b, 0x607786, 0x485f7c][i % 3]));

        const zones = [
          { x1: -50, x2: -2, center: -26, arenaX: -16, color: 0x0a2639, trim: 0x37c5e7, art: 0 },
          { x1: -2, x2: 36, center: 17, arenaX: 18, color: 0x14263a, trim: 0x5fe0c4, art: 1 },
          { x1: 36, x2: 84, center: 60, arenaX: 58, color: 0x271a39, trim: 0xc08bff, art: 2 }
        ];

        function makeComicBackdrop(zone) {
          const canvas = document.createElement("canvas");
          canvas.width = 1024;
          canvas.height = 512;
          const ctx = canvas.getContext("2d");
          const palettes = [
            { top: "#06111d", bottom: "#173b4d", glow: "#1bbbdc", mid: "#122c3d", deep: "#07131f", metal: "#2d4b5a", accent: "#75edff" },
            { top: "#061918", bottom: "#25494a", glow: "#31c9a4", mid: "#173834", deep: "#071b20", metal: "#355756", accent: "#7af8d8" },
            { top: "#100d20", bottom: "#3b2450", glow: "#a45ce8", mid: "#291b3d", deep: "#100e20", metal: "#4b355c", accent: "#e2a7ff" }
          ];
          const p = palettes[zone.art];
          const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
          bg.addColorStop(0, p.top);
          bg.addColorStop(0.52, p.bottom);
          bg.addColorStop(1, "#050910");
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          const glow = ctx.createRadialGradient(
            canvas.width * (0.28 + zone.art * 0.20), canvas.height * 0.40, 4,
            canvas.width * (0.28 + zone.art * 0.20), canvas.height * 0.40, 360
          );
          glow.addColorStop(0, p.glow + "88");
          glow.addColorStop(1, p.glow + "00");
          ctx.fillStyle = glow;
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Distant silhouette: irregular machinery, towers and broken skyline, inked like a comic panel.
          const randomAt = (n) => {
            const raw = Math.sin((zone.art + 3) * 71.31 + n * 19.17) * 43758.5453;
            return raw - Math.floor(raw);
          };
          for (let i = 0; i < 14; i += 1) {
            const x = i * 78 - 18;
            const bw = 38 + randomAt(i + 2) * 52;
            const bh = 100 + randomAt(i + 23) * 245;
            const top = 390 - bh;
            ctx.beginPath();
            ctx.moveTo(x, 432);
            ctx.lineTo(x, top + 28);
            ctx.lineTo(x + bw * 0.16, top + 8);
            ctx.lineTo(x + bw * 0.30, top + 23);
            ctx.lineTo(x + bw * 0.52, top);
            ctx.lineTo(x + bw * 0.70, top + 18);
            ctx.lineTo(x + bw, top + 34);
            ctx.lineTo(x + bw, 432);
            ctx.closePath();
            ctx.fillStyle = i % 2 ? p.mid : p.deep;
            ctx.strokeStyle = "#02060b";
            ctx.lineWidth = 12;
            ctx.lineJoin = "miter";
            ctx.fill();
            ctx.stroke();

            ctx.globalAlpha = 0.68;
            ctx.fillStyle = p.accent;
            for (let windowY = top + 47; windowY < 385; windowY += 34) {
              if (randomAt(i * 13 + windowY) > 0.62) continue;
              ctx.fillRect(x + 8, windowY, Math.max(4, bw * 0.14), 9);
              ctx.fillRect(x + bw * 0.53, windowY + 8, Math.max(4, bw * 0.18), 5);
            }
            ctx.globalAlpha = 1;
          }

          // Monumental reactor rings and thick conduit lines create depth behind the arena.
          const reactorX = canvas.width * (0.70 - zone.art * 0.06);
          const reactorY = 220;
          [150, 116, 83].forEach((radius, i) => {
            ctx.beginPath();
            ctx.arc(reactorX, reactorY, radius, 0, Math.PI * 2);
            ctx.strokeStyle = i === 0 ? "#02060b" : p.accent;
            ctx.lineWidth = i === 0 ? 18 : (i === 1 ? 7 : 3);
            ctx.globalAlpha = i === 0 ? 0.95 : (0.30 + i * 0.18);
            ctx.stroke();
          });
          ctx.globalAlpha = 1;
          ctx.fillStyle = p.deep;
          ctx.strokeStyle = "#02060b";
          ctx.lineWidth = 14;
          ctx.beginPath();
          ctx.moveTo(reactorX - 34, reactorY - 70);
          ctx.lineTo(reactorX + 58, reactorY - 24);
          ctx.lineTo(reactorX + 40, reactorY + 76);
          ctx.lineTo(reactorX - 62, reactorY + 40);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          for (let pipe = 0; pipe < 5; pipe += 1) {
            const y = 65 + pipe * 68;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(128 + pipe * 23, y);
            ctx.lineTo(155 + pipe * 23, y + 24);
            ctx.lineTo(canvas.width, y + 24);
            ctx.strokeStyle = "#02060b";
            ctx.lineWidth = 17;
            ctx.stroke();
            ctx.strokeStyle = pipe % 2 ? p.metal : p.accent;
            ctx.lineWidth = pipe % 2 ? 5 : 2;
            ctx.globalAlpha = pipe % 2 ? 0.7 : 0.45;
            ctx.stroke();
            ctx.globalAlpha = 1;
          }

          // Halftone dots and panel hatching provide a hand-inked, comic-book finish.
          ctx.globalAlpha = 0.17;
          ctx.fillStyle = p.accent;
          for (let y = 18; y < 496; y += 15) {
            for (let x = 18 + ((Math.floor(y / 15) % 2) * 7); x < 1008; x += 15) {
              const dx = (x - 512) / 512;
              const dy = (y - 256) / 256;
              if (dx * dx + dy * dy > 0.84 && randomAt(x + y) < 0.72) continue;
              ctx.beginPath();
              ctx.arc(x, y, 1.4 + randomAt(x * 2 + y) * 0.8, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          ctx.globalAlpha = 1;
          for (let i = 0; i < 10; i += 1) {
            const x = i * 116 - 30;
            ctx.beginPath();
            ctx.moveTo(x, 512);
            ctx.lineTo(x + 110, 390);
            ctx.strokeStyle = "#02060b";
            ctx.lineWidth = 9;
            ctx.globalAlpha = 0.35;
            ctx.stroke();
          }
          ctx.globalAlpha = 1;

          // Heavy black frame and bright inset line make each zone read as a distinct large location.
          ctx.strokeStyle = "#02060b";
          ctx.lineWidth = 26;
          ctx.strokeRect(9, 9, canvas.width - 18, canvas.height - 18);
          ctx.strokeStyle = p.accent;
          ctx.globalAlpha = 0.88;
          ctx.lineWidth = 3;
          ctx.strokeRect(25, 25, canvas.width - 50, canvas.height - 50);
          ctx.globalAlpha = 1;
          ctx.fillStyle = p.accent;
          for (let bolt = 0; bolt < 14; bolt += 1) {
            const x = 43 + bolt * 71;
            ctx.beginPath();
            ctx.arc(x, 39, 3.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(x, 472, 3.4, 0, Math.PI * 2);
            ctx.fill();
          }

          const texture = new THREE.CanvasTexture(canvas);
          if (THREE.sRGBEncoding !== undefined) texture.encoding = THREE.sRGBEncoding;
          return texture;
        }

        const parallaxPanels = [];
        zones.forEach((zone, index) => {
          const texture = makeComicBackdrop(zone);
          const panelGeometry = new THREE.PlaneGeometry(zone.x2 - zone.x1, 11.2);
          const panelMaterial = new THREE.MeshBasicMaterial({
            map: texture, side: THREE.DoubleSide, depthWrite: false
          });
          const panel = new THREE.Mesh(panelGeometry, panelMaterial);
          panel.name = "ring-comic-zone-backdrop-" + (index + 1);
          panel.position.set(zone.center, 4.9, -5.15);
          world.add(panel);
          worldTextures.push(texture);
          extraGeometries.push(panelGeometry);
          materials.push(panelMaterial);
          parallaxPanels.push({ mesh: panel, baseX: zone.center, factor: 0.48 });

          // Layered silhouettes sit between the painted backdrop and the play plane.
          for (let x = zone.x1 + 3.2; x < zone.x2; x += 6.4) {
            addBox("trim", x, 4.0, -2.8, 0.24, 8.1, 0.24, zone.trim);
            addBox("trim", x + 1.25, 7.6, -2.7, 2.4, 0.14, 0.18, zone.trim);
            addBox("backdrop", x + 2.8, 2.8, -3.5, 3.0, 3.1, 0.24, index === 1 ? 0x183d46 : 0x172838);
          }
          addBox("trim", zone.center, 9.0, -2.5, zone.x2 - zone.x1 - 3.0, 0.12, 0.18, zone.trim);

          // Each boss gets a framed arena with a heavy lintel, pylons and glowing edge strips.
          const arenaX = zone.arenaX;
          const arenaHalf = 8.6;
          [-1, 1].forEach((side) => {
            const pillarX = arenaX + side * arenaHalf;
            addBox("backdrop", pillarX, 3.65, -2.95, 0.72, 7.25, 0.48, 0x050a12);
            addBox("trim", pillarX, 3.65, -2.70, 0.13, 6.95, 0.17, zone.trim);
            addBox("backdrop", pillarX, 0.34, -2.55, 1.45, 0.65, 0.52, 0x03070d);
            addBox("trim", pillarX, 0.69, -2.45, 1.2, 0.11, 0.22, zone.trim);
          });
          addBox("backdrop", arenaX, 7.25, -3.0, arenaHalf * 2 + 1.1, 0.56, 0.46, 0x050a12);
          addBox("trim", arenaX, 6.93, -2.71, arenaHalf * 2 - 0.6, 0.095, 0.16, zone.trim);
          addBox("backdrop", arenaX, 0.18, -2.55, arenaHalf * 2 + 1.1, 0.35, 0.46, 0x03070d);
        });

        const barriers = [];
        [
          { x: -2, unlockAfter: 1, color: 0xffbd63 },
          { x: 36, unlockAfter: 2, color: 0xa97cff }
        ].forEach((item) => {
          const barrierGroup = new THREE.Group();
          barrierGroup.position.set(item.x, 3.3, 0.15);
          const material = new THREE.MeshStandardMaterial({
            color: item.color, emissive: item.color, emissiveIntensity: 1.1,
            transparent: true, opacity: 0.72, roughness: 0.24, metalness: 0.28
          });
          barrierGroup.add(new THREE.Mesh(new THREE.BoxGeometry(0.32, 6.6, 0.45), material));
          world.add(barrierGroup);
          materials.push(material);
          barriers.push({ x: item.x, unlockAfter: item.unlockAfter, group: barrierGroup });
        });

        const bossBodyGeometry = new THREE.DodecahedronGeometry(1, 1);
        const bossOutlineGeometry = new THREE.DodecahedronGeometry(1, 1);
        const bossArmorGeometry = new THREE.BoxGeometry(1, 1, 1);
        const bossHornGeometry = new THREE.ConeGeometry(0.42, 1.35, 5);
        const bossCoreGeometry = new THREE.SphereGeometry(0.40, 12, 10);
        const bossEyeGeometry = new THREE.SphereGeometry(0.18, 10, 8);
        // Reuse a small set of Three.js primitives to restore the three pig bosses;
        // no external textures or newly generated image assets are needed.
        const pigSphereGeometry = new THREE.SphereGeometry(1, 16, 12);
        const pigEarGeometry = new THREE.ConeGeometry(0.24, 0.58, 5);
        const pigTuskGeometry = new THREE.ConeGeometry(0.13, 0.34, 5);
        const pigTailGeometry = new THREE.TorusGeometry(0.20, 0.065, 6, 16);
        const bossRingGeometry = new THREE.TorusGeometry(1.9, 0.10, 8, 28);
        const exitGeometry = new THREE.TorusGeometry(1.15, 0.13, 8, 32);
        const shockwaveGeometry = new THREE.TorusGeometry(0.82, 0.12, 8, 20);
        const pickupGeometry = new THREE.OctahedronGeometry(0.38, 0);
        const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xc9fbff });
        const bossCoreMaterial = new THREE.MeshBasicMaterial({ color: 0xfff0b5 });
        const pigSnoutMaterial = new THREE.MeshStandardMaterial({
          color: 0xf0b0ae, roughness: 0.72, metalness: 0.02
        });
        const pigInnerEarMaterial = new THREE.MeshStandardMaterial({
          color: 0x813747, roughness: 0.78, metalness: 0.01
        });
        const pigNostrilMaterial = new THREE.MeshBasicMaterial({ color: 0x341821 });
        const pigEyeWhiteMaterial = new THREE.MeshBasicMaterial({ color: 0xfff2df });
        const pigPupilMaterial = new THREE.MeshBasicMaterial({ color: 0x11131b });
        const pigTuskMaterial = new THREE.MeshStandardMaterial({
          color: 0xf4d59b, roughness: 0.4, metalness: 0.04
        });
        const pigHoofMaterial = new THREE.MeshStandardMaterial({
          color: 0x382633, roughness: 0.62, metalness: 0.12
        });
        const bossOutlineMaterial = new THREE.MeshBasicMaterial({ color: 0x02060b });
        const bossArmorMaterial = new THREE.MeshStandardMaterial({
          color: 0x1b2935, roughness: 0.48, metalness: 0.62, emissive: 0x09121a, emissiveIntensity: 0.45
        });
        const bossRingMaterial = new THREE.MeshBasicMaterial({ color: 0x9cf5ff, transparent: true, opacity: 0.9 });
        const exitMaterial = new THREE.MeshBasicMaterial({ color: 0x72f0e2, transparent: true, opacity: 0.8 });
        const pickupMaterial = new THREE.MeshStandardMaterial({ color: 0x75f2e1, emissive: 0x117f79, emissiveIntensity: 1.25, roughness: 0.22, metalness: 0.2 });
        const shockwaveMaterial = new THREE.MeshBasicMaterial({ color: 0xff9e5e, transparent: true, opacity: 0.94 });
        materials.push(eyeMaterial, bossCoreMaterial, pigSnoutMaterial, pigInnerEarMaterial,
          pigNostrilMaterial, pigEyeWhiteMaterial, pigPupilMaterial, pigTuskMaterial,
          pigHoofMaterial, bossOutlineMaterial, bossArmorMaterial,
          bossRingMaterial, exitMaterial, pickupMaterial, shockwaveMaterial);

        const bosses = [
          { name: "СБОЙНЫЙ СТРАЖ", x: -16, y: 0, maxHp: 5, color: 0xffa45f, zone: 0 },
          { name: "ПЛАЗМЕННЫЙ СЕРДЕЧНИК", x: 18, y: 0, maxHp: 7, color: 0x5fe6cf, zone: 1 },
          { name: "СТАРШИЙ СИНГУЛЯРНОСТИ", x: 58, y: 0, maxHp: 9, color: 0xc28aff, zone: 2 }
        ];
        bosses.forEach((boss, index) => {
          const bossMaterial = new THREE.MeshStandardMaterial({
            color: boss.color, emissive: boss.color, emissiveIntensity: 0.48,
            roughness: 0.34, metalness: 0.52
          });
          const armorAccent = new THREE.MeshStandardMaterial({
            color: boss.color, emissive: boss.color, emissiveIntensity: 0.20,
            roughness: 0.42, metalness: 0.60
          });
          materials.push(bossMaterial, armorAccent);
          const group = new THREE.Group();
          group.name = "ring-boss-" + (index + 1);
          group.position.set(boss.x, boss.y, 0.1);
          const pigSkinMaterial = new THREE.MeshStandardMaterial({
            color: [0xd9878e, 0xc97c89, 0xa98ac8][index],
            roughness: 0.72, metalness: 0.03, emissive: 0x16090d, emissiveIntensity: 0.12
          });
          materials.push(pigSkinMaterial);

          // Dark offset meshes create the thick inked silhouette of a comic-book boss.
          const outline = new THREE.Mesh(bossOutlineGeometry, bossOutlineMaterial);
          outline.position.set(0, 2.30, -0.20);
          outline.scale.set(2.45 + index * 0.24, 2.20 + index * 0.23, 0.94);
          group.add(outline);

          [-1, 1].forEach((side) => {
            const armOutline = new THREE.Mesh(bossArmorGeometry, bossOutlineMaterial);
            armOutline.position.set(side * (1.63 + index * 0.12), 1.72, -0.16);
            armOutline.rotation.z = side * -0.15;
            armOutline.scale.set(1.82 + index * 0.12, 0.94 + index * 0.10, 0.92);
            group.add(armOutline);

            const arm = new THREE.Mesh(bossArmorGeometry, bossArmorMaterial);
            arm.position.set(side * (1.63 + index * 0.12), 1.77, 0.02);
            arm.rotation.z = side * -0.15;
            arm.scale.set(1.62 + index * 0.12, 0.70 + index * 0.10, 0.72);
            group.add(arm);

            const hornOutline = new THREE.Mesh(bossHornGeometry, bossOutlineMaterial);
            hornOutline.position.set(side * (0.94 + index * 0.08), 3.92 + index * 0.20, -0.15);
            hornOutline.rotation.z = side * -0.37;
            hornOutline.scale.set(1.14, 1.12, 0.86);
            group.add(hornOutline);

            const horn = new THREE.Mesh(bossHornGeometry, armorAccent);
            horn.position.set(side * (0.94 + index * 0.08), 3.95 + index * 0.20, 0.02);
            horn.rotation.z = side * -0.37;
            horn.scale.set(0.96, 0.96, 0.76);
            group.add(horn);
          });

          const body = new THREE.Mesh(bossBodyGeometry, bossMaterial);
          body.position.set(0, 2.25, 0.02);
          body.scale.set(2.08 + index * 0.24, 1.94 + index * 0.22, 0.78);
          group.add(body);

          const core = new THREE.Mesh(bossCoreGeometry, bossCoreMaterial);
          core.position.set(0, 2.20, 0.86);
          core.scale.set(1.0 + index * 0.08, 1.10 + index * 0.10, 0.48);
          group.add(core);

          const eyeLeft = new THREE.Mesh(bossEyeGeometry, eyeMaterial);
          eyeLeft.position.set(-0.74, 2.54, 0.82);
          eyeLeft.scale.setScalar(1.12 + index * 0.08);
          const eyeRight = new THREE.Mesh(bossEyeGeometry, eyeMaterial);
          eyeRight.position.set(0.74, 2.54, 0.82);
          eyeRight.scale.setScalar(1.12 + index * 0.08);
          group.add(eyeLeft, eyeRight);

          const ring = new THREE.Mesh(bossRingGeometry, bossRingMaterial);
          ring.position.set(0, 2.20, -0.05);
          ring.scale.set(1.18 + index * 0.15, 1.18 + index * 0.15, 1);
          group.add(ring);

          // Pig body, face, ears, nostrils and tusks sit in front of the arena armor.
          const pig = new THREE.Group();
          pig.name = "ring-pig-boss-" + (index + 1);
          pig.position.z = 0.72;
          group.add(pig);
          const pigBody = new THREE.Mesh(pigSphereGeometry, pigSkinMaterial);
          pigBody.name = "ring-pig-boss-body-" + (index + 1);
          pigBody.position.set(0, 1.48, 0.08);
          pigBody.scale.set(1.46 + index * 0.10, 0.98 + index * 0.08, 0.68);
          pig.add(pigBody);

          const pigHead = new THREE.Mesh(pigSphereGeometry, pigSkinMaterial);
          pigHead.name = "ring-pig-boss-head-" + (index + 1);
          pigHead.position.set(0, 2.38, 0.42);
          pigHead.scale.set(0.82 + index * 0.04, 0.78 + index * 0.04, 0.59);
          pig.add(pigHead);

          const pigSnout = new THREE.Mesh(pigSphereGeometry, pigSnoutMaterial);
          pigSnout.name = "ring-pig-boss-snout-" + (index + 1);
          pigSnout.position.set(0, 2.10, 0.94);
          pigSnout.scale.set(0.48, 0.34, 0.25);
          pig.add(pigSnout);
          [-1, 1].forEach((side) => {
            const nostril = new THREE.Mesh(pigSphereGeometry, pigNostrilMaterial);
            nostril.name = "ring-pig-boss-nostril";
            nostril.position.set(side * 0.15, 2.12, 1.16);
            nostril.scale.set(0.07, 0.095, 0.045);
            pig.add(nostril);

            const eye = new THREE.Mesh(bossEyeGeometry, pigEyeWhiteMaterial);
            eye.name = "ring-pig-boss-eye";
            eye.position.set(side * 0.34, 2.62, 0.91);
            eye.scale.set(1.0, 1.08, 0.72);
            pig.add(eye);
            const pupil = new THREE.Mesh(pigSphereGeometry, pigPupilMaterial);
            pupil.name = "ring-pig-boss-pupil";
            pupil.position.set(side * 0.36, 2.62, 0.985);
            pupil.scale.set(0.065, 0.085, 0.045);
            pig.add(pupil);

            const ear = new THREE.Mesh(pigEarGeometry, pigSkinMaterial);
            ear.name = "ring-pig-boss-ear";
            ear.position.set(side * 0.56, 3.02, 0.27);
            ear.rotation.z = side * 0.24;
            ear.scale.set(1.0, 1.0, 0.82);
            pig.add(ear);
            const innerEar = new THREE.Mesh(pigEarGeometry, pigInnerEarMaterial);
            innerEar.name = "ring-pig-boss-inner-ear";
            innerEar.position.set(side * 0.56, 3.04, 0.40);
            innerEar.rotation.z = side * 0.24;
            innerEar.scale.set(0.52, 0.58, 0.35);
            pig.add(innerEar);

            const tusk = new THREE.Mesh(pigTuskGeometry, pigTuskMaterial);
            tusk.name = "ring-pig-boss-tusk";
            tusk.position.set(side * 0.43, 1.95, 0.91);
            tusk.rotation.z = side * -0.52;
            pig.add(tusk);

            const leg = new THREE.Mesh(bossArmorGeometry, pigSkinMaterial);
            leg.name = "ring-pig-boss-leg";
            leg.position.set(side * 0.86, 0.51, 0.17);
            leg.scale.set(0.32, 0.66, 0.42);
            pig.add(leg);
            const hoof = new THREE.Mesh(bossArmorGeometry, pigHoofMaterial);
            hoof.name = "ring-pig-boss-hoof";
            hoof.position.set(side * 0.86, 0.18, 0.22);
            hoof.scale.set(0.35, 0.20, 0.44);
            pig.add(hoof);
          });
          const pigTail = new THREE.Mesh(pigTailGeometry, pigSkinMaterial);
          pigTail.name = "ring-pig-boss-tail";
          pigTail.position.set(-1.47, 1.88, -0.03);
          pigTail.rotation.y = Math.PI / 2;
          pig.add(pigTail);

          // Keep the weakpoint visible above the snout for the existing activation mechanic.
          core.position.set(0, 2.78, 1.85);
          world.add(group);
          Object.assign(boss, { group, hp: boss.maxHp, alive: true, activated: false, nextAttackAt: 0, lastDamageAt: 0 });
        });

        const exitMarker = new THREE.Mesh(exitGeometry, exitMaterial);
        exitMarker.name = "ring-frontier-exit";
        exitMarker.position.set(81, 2.0, 0.45);
        world.add(exitMarker);

        const coreMeshes = [];
        [-30, 8, 49].forEach((x, index) => {
          const mesh = new THREE.Mesh(pickupGeometry, pickupMaterial);
          mesh.name = "ring-frontier-repair-core-" + index;
          mesh.position.set(x, index === 1 ? 2.9 : 1.3, 0.25);
          world.add(mesh);
          coreMeshes.push({ mesh, x, y: mesh.position.y, taken: false });
        });

        const meshBatch = (name, items, material) => {
          if (!items.length) return null;
          const mesh = new THREE.InstancedMesh(boxGeometry, material, items.length);
          mesh.name = name;
          mesh.frustumCulled = false;
          const box = new THREE.Object3D();
          for (let i = 0; i < items.length; i += 1) {
            const item = items[i];
            box.position.set(item.x, item.y, item.z);
            box.rotation.set(0, 0, 0);
            box.scale.set(item.sx, item.sy, item.sz);
            box.updateMatrix();
            mesh.setMatrixAt(i, box.matrix);
            const tint = new THREE.Color(0xffffff);
            if (mesh.setColorAt) mesh.setColorAt(i, tint);
          }
          mesh.instanceMatrix.needsUpdate = true;
          world.add(mesh);
        };
        meshBatch("ring-frontier-floor", buckets.floor, materials[0]);
        meshBatch("ring-frontier-platforms", buckets.platforms, materials[1]);
        meshBatch("ring-frontier-backdrop", buckets.backdrop, materials[2]);
        meshBatch("ring-frontier-ribs", buckets.trim, materials[3]);
        scene.add(world);

        return {
          group: world, boxGeometry, materials, textures: worldTextures, parallaxPanels,
          specialGeometry: [...extraGeometries, bossBodyGeometry, bossOutlineGeometry, bossArmorGeometry,
            bossHornGeometry, bossCoreGeometry, bossEyeGeometry, pigSphereGeometry, pigEarGeometry,
            pigTuskGeometry, pigTailGeometry, bossRingGeometry, exitGeometry, shockwaveGeometry, pickupGeometry],
          platforms, bosses, barriers, coreMeshes, exitMarker, exitX: 81, spawnX: -45,
          shockwaves: [], shockwaveGeometry, shockwaveMaterial,
          defeatedBosses: 0, pickupGeometry
        };
      }

      function updateRoomSlice() {
        // The pigs-and-ring side-scroller stays one large cell. Neighbors use the asteroid chart.
      }

      function attachAsteroidCellPath(world) {
        const RING_CELL_HOME = 420;
        const ROOM_HALF = 6;
        const keyOf = (x, y, z) => x + "," + y + "," + z;
        const step = { xp: [1, 0, 0], xn: [-1, 0, 0], zp: [0, 0, 1], zn: [0, 0, -1], yp: [0, 1, 0], yn: [0, -1, 0] };
        const opposite = { xp: "xn", xn: "xp", zp: "zn", zn: "zp", yp: "yn", yn: "yp" };
        const nodes = new Map();
        (maze.cells || []).forEach((cell) => {
          const large = !!(maze.exitCell && cell.x === maze.exitCell.x && cell.y === maze.exitCell.y && cell.z === maze.exitCell.z);
          const astral = cell.y !== 1;
          const astralHash = hashSeed(String(maze.seed) + "|astral|" + cell.x + "|" + cell.y + "|" + cell.z);
          nodes.set(keyOf(cell.x, cell.y, cell.z), {
            x: cell.x, y: cell.y, z: cell.z,
            open: cell.open || {},
            wallTurn: cell.wallTurn || 0,
            wallAsset: cell.wallAsset || 0,
            astral,
            astralMode: astral ? ["drift", "flux", "dense"][astralHash % 3] : "normal",
            astralPhase: ((hashSeed(String(maze.seed) + "|phase|" + cell.x + "|" + cell.y + "|" + cell.z) / 0xffffffff) * Math.PI * 2),
            large,
            mobs: []
          });
        });
        function neighbor(node, dir) {
          if (!node || !node.open || !node.open[dir] || !step[dir]) return null;
          const delta = step[dir];
          return nodes.get(keyOf(node.x + delta[0], node.y + delta[1], node.z + delta[2])) || null;
        }
        // The carved map is connected. BFS gives every room a known route to the
        // large pig arena, so a player can escape dead ends without a random guess.
        function nextDirectionTowardLarge(startNode) {
          if (!startNode || startNode.large) return null;
          const dirs = ["xp", "xn", "zp", "zn", "yp", "yn"];
          const firstStep = new Map([[startNode, null]]);
          const queue = [startNode];
          for (let cursor = 0; cursor < queue.length; cursor += 1) {
            const here = queue[cursor];
            for (const dir of dirs) {
              const next = neighbor(here, dir);
              if (!next || firstStep.has(next)) continue;
              firstStep.set(next, here === startNode ? dir : firstStep.get(here));
              if (next.large) return firstStep.get(next);
              queue.push(next);
            }
          }
          return null;
        }
        function nextDirectionToward(startNode, goalNode) {
          if (!startNode || !goalNode || startNode === goalNode) return null;
          const dirs = ["xp", "xn", "zp", "zn", "yp", "yn"];
          function search(allowLarge) {
            const firstStep = new Map([[startNode, null]]);
            const queue = [startNode];
            for (let cursor = 0; cursor < queue.length; cursor += 1) {
              const here = queue[cursor];
              for (const dir of dirs) {
                const next = neighbor(here, dir);
                if (!next || firstStep.has(next)) continue;
                if (!allowLarge && next.large && next !== goalNode) continue;
                const step = here === startNode ? dir : firstStep.get(here);
                firstStep.set(next, step);
                if (next === goalNode) return step;
                queue.push(next);
              }
            }
            return null;
          }
          return search(false) || search(true);
        }
        function distanceToNode(fromNode, goalNode) {
          if (!fromNode || !goalNode) return Infinity;
          if (fromNode === goalNode) return 0;
          const dirs = ["xp", "xn", "zp", "zn", "yp", "yn"];
          function measure(allowLarge) {
            const dist = new Map([[fromNode, 0]]);
            const queue = [fromNode];
            for (let cursor = 0; cursor < queue.length; cursor += 1) {
              const here = queue[cursor];
              const steps = dist.get(here);
              for (const dir of dirs) {
                const next = neighbor(here, dir);
                if (!next || dist.has(next)) continue;
                if (!allowLarge && next.large && next !== goalNode) continue;
                dist.set(next, steps + 1);
                if (next === goalNode) return steps + 1;
                queue.push(next);
              }
            }
            return Infinity;
          }
          const around = measure(false);
          return Number.isFinite(around) ? around : measure(true);
        }
        const routeMission = window.BCMWorldMission || {};
        const routeCrystals = (maze.crystals || []).filter((crystal) => crystal && crystal.cell).map((crystal) => {
          const cell = { x: crystal.cell.x, y: crystal.cell.y, z: crystal.cell.z };
          const id = String(maze.seed) + ":" + cell.x + "," + cell.y + "," + cell.z;
          // Don't inherit a 3D pickup made before the Hydrogen mission unlocked.
          return { id, cell, taken: !!routeMission.hydrogenCollectedIds?.[id], scouted: false };
        });
        function objectiveNode(fromNode) {
          const mission = window.BCMWorldMission || {};
          const hydrogenRouteActive = !!mission.hydrogenUnlocked &&
            Number(mission.hydrogenCount || 0) < 3 && routeCrystals.length > 0;
          const pending = hydrogenRouteActive
            ? routeCrystals.filter((crystal) => !crystal.taken).map((crystal) =>
              nodes.get(keyOf(crystal.cell.x, crystal.cell.y, crystal.cell.z)) || null).filter(Boolean)
            : [];
          let best = null;
          let bestDist = Infinity;
          pending.forEach((goal) => {
            const dist = distanceToNode(fromNode, goal);
            if (dist < bestDist) { best = goal; bestDist = dist; }
          });
          if (best) return best;

          // With no active Hydrogen-shard route, guide the pilot through the large
          // connected area before returning home. Otherwise a two-cell backtrack
          // incorrectly looked like a completed Ring run and closed the level.
          const visitedLarge = !!world.cellPath?.visitedLarge;
          const large = [...nodes.values()].find((candidate) => candidate.large);
          if (!hydrogenRouteActive && !visitedLarge && large && large !== fromNode) return large;

          const home = maze.startCell
            ? nodes.get(keyOf(maze.startCell.x, maze.startCell.y, maze.startCell.z))
            : null;
          return home && home !== fromNode ? home : null;
        }
        const textures = (maze.textures || []).map((tex, index) => {
          const copy = tex.clone();
          copy.image = tex.image;
          copy.needsUpdate = true;
          copy.wrapS = THREE.RepeatWrapping;
          copy.wrapT = THREE.RepeatWrapping;
          copy.center.set(0.5, 0.5);
          if (maze.wallTextureCopiesByAsset && maze.wallTextureCopiesByAsset[index]) {
            maze.wallTextureCopiesByAsset[index].push(copy);
          }
          return copy;
        });
        if (!textures.length) {
          const canvas = document.createElement("canvas");
          canvas.width = 64;
          canvas.height = 64;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#3d5562";
          ctx.fillRect(0, 0, 64, 64);
          ctx.strokeStyle = "#8fd0e2";
          ctx.strokeRect(4, 4, 56, 56);
          textures.push(new THREE.CanvasTexture(canvas));
        }
        const floorMaterial = new THREE.MeshStandardMaterial({
          map: textures[0], color: 0xffffff, roughness: 0.82, metalness: 0.24
        });
        const wallMaterial = new THREE.MeshStandardMaterial({
          map: textures[0], color: 0xffffff, roughness: 0.9, metalness: 0.18,
          emissive: 0x000000, emissiveIntensity: 0
        });
        const room = new THREE.Group();
        room.name = "bcm-asteroid-cell-room";
        const floor = new THREE.Mesh(new THREE.BoxGeometry(ROOM_HALF * 2, 0.36, 3.8), floorMaterial);
        floor.position.set(RING_CELL_HOME, -0.18, 0);
        room.add(floor);
        const doorGeo = new THREE.BoxGeometry(0.28, 2.4, 0.4);
        const doorLeft = new THREE.Mesh(doorGeo, wallMaterial);
        const doorRight = new THREE.Mesh(doorGeo, wallMaterial);
        doorLeft.position.set(RING_CELL_HOME - ROOM_HALF + 0.2, 1.15, 0);
        doorRight.position.set(RING_CELL_HOME + ROOM_HALF - 0.2, 1.15, 0);
        const sealedWallGeo = new THREE.BoxGeometry(0.24, 2.55, 3.8);
        const sealedWallLeft = new THREE.Mesh(sealedWallGeo, wallMaterial);
        const sealedWallRight = new THREE.Mesh(sealedWallGeo, wallMaterial);
        sealedWallLeft.name = "ring-cell-sealed-wall-left";
        sealedWallRight.name = "ring-cell-sealed-wall-right";
        sealedWallLeft.position.set(RING_CELL_HOME - ROOM_HALF + 0.12, 1.15, 0);
        sealedWallRight.position.set(RING_CELL_HOME + ROOM_HALF - 0.12, 1.15, 0);
        room.add(sealedWallLeft, sealedWallRight, doorLeft, doorRight);
        const backGeo = new THREE.PlaneGeometry(ROOM_HALF * 2.4, 5.4);
        const backWall = new THREE.Mesh(backGeo, wallMaterial);
        backWall.name = "ring-cell-asteroid-face";
        backWall.position.set(RING_CELL_HOME, 2.2, -1.5);
        const ceilingGeo = new THREE.BoxGeometry(ROOM_HALF * 2, 0.28, 3.6);
        const ceiling = new THREE.Mesh(ceilingGeo, floorMaterial);
        ceiling.name = "ring-cell-asteroid-ceiling";
        ceiling.position.set(RING_CELL_HOME, 3.65, 0);
        room.add(backWall, ceiling);
        const hatch = new THREE.Mesh(
          new THREE.BoxGeometry(1.1, 0.08, 1.1),
          new THREE.MeshBasicMaterial({ color: 0x5fdbc8, emissive: 0x124b55, emissiveIntensity: 0.9 })
        );
        hatch.position.set(RING_CELL_HOME, 0.08, 0.2);
        room.add(hatch);
        const portalMaterial = new THREE.MeshBasicMaterial({
          color: 0x7ef4e6, emissive: 0x1a8eab, transparent: true, opacity: 0.92,
          blending: THREE.AdditiveBlending, depthWrite: false
        });
        const portalRing = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.085, 8, 24), portalMaterial);
        portalRing.name = "ring-cell-vertical-portal";
        portalRing.position.set(RING_CELL_HOME, 1.42, 0.62);
        room.add(portalRing);
        const mobMat = new THREE.MeshStandardMaterial({ color: 0xd27a4a, emissive: 0x3a1408, roughness: 0.45, metalness: 0.2 });
        const mobGeo = new THREE.BoxGeometry(0.7, 0.9, 0.5);
        nodes.forEach((node) => {
          if (node.large) return;
          const sides = ["xn", "xp", "zn", "zp", "yn", "yp"].filter((dir) => node.open && node.open[dir]);
          const count = Math.min(2, sides.length);
          for (let i = 0; i < count; i += 1) {
            const side = sides[i];
            const mesh = new THREE.Mesh(mobGeo, mobMat);
            mesh.visible = false;
            mesh.name = "ring-cell-mob";
            room.add(mesh);
            const fromLeft = side === "xn" || side === "zn" || side === "yn";
            node.mobs.push({
              side,
              offset: fromLeft ? -4.2 : 4.2,
              dir: fromLeft ? 1 : -1,
              alive: true,
              respawnAt: 0,
              mesh
            });
          }
        });
        scene.add(room);
        world.platforms.push({ minX: RING_CELL_HOME - ROOM_HALF, maxX: RING_CELL_HOME + ROOM_HALF, y: 0, cellRoom: true });
        world.materials.push(floorMaterial, wallMaterial, hatch.material, portalMaterial, mobMat);
        textures.forEach((texture) => world.textures.push(texture));
        world.specialGeometry.push(floor.geometry, doorGeo, sealedWallGeo, hatch.geometry, portalRing.geometry, mobGeo, backGeo, ceilingGeo);
        const start = (maze.startCell && nodes.get(keyOf(maze.startCell.x, maze.startCell.y, maze.startCell.z)))
          || nodes.values().next().value;
        const horizontalOpen = ["xp", "xn", "zp", "zn"];
        const towardLarge = start ? nextDirectionTowardLarge(start) : null;
        const firstOpen = (towardLarge && horizontalOpen.includes(towardLarge) && start.open && start.open[towardLarge])
          ? towardLarge
          : (horizontalOpen.find((dir) => start && start.open && start.open[dir]) || "xp");
        const hydrogenGeometry = new THREE.OctahedronGeometry(0.46, 0);
        const hydrogenMaterial = new THREE.MeshStandardMaterial({
          color: 0x9cffe9, emissive: 0x198b78, emissiveIntensity: 1.15,
          metalness: 0.18, roughness: 0.28
        });
        const hydrogenMesh = new THREE.Mesh(hydrogenGeometry, hydrogenMaterial);
        hydrogenMesh.name = "ring-hydrogen-pickup";
        hydrogenMesh.position.set(RING_CELL_HOME + 2.6, 0.82, 0.58);
        hydrogenMesh.visible = !!window.BCMWorldMission?.hydrogenUnlocked &&
          !window.BCMWorldMission?.hydrogenCollected && !start?.large;
        room.add(hydrogenMesh);
        world.materials.push(hydrogenMaterial);
        world.specialGeometry.push(hydrogenGeometry);
        const hydrogenState = maze.hydrogen || {
          cell: { x: start?.x || 0, y: start?.y || 1, z: start?.z || 0 },
          unlocked: !!window.BCMWorldMission?.hydrogenUnlocked,
          taken: !!window.BCMWorldMission?.hydrogenCollected,
          scouted: false
        };
        world.cellPath = {
          nodes, neighbor, opposite, keyOf, nextDirectionTowardLarge, nextDirectionToward, objectiveNode, routeCrystals,
          nx: maze.dimensions?.nx || 7,
          ny: maze.dimensions?.ny || 3,
          nz: maze.dimensions?.nz || 7,
          room, floorMaterial, wallMaterial, doorLeft, doorRight, sealedWallLeft, sealedWallRight,
          hatch, portalRing, portalMaterial, textures,
          hydrogenNode: start,
          hydrogen: hydrogenState,
          hydrogenMesh,
          hydrogenPickupX: RING_CELL_HOME + 2.6,
          homeX: RING_CELL_HOME, half: ROOM_HALF,
          current: start, heading: firstOpen, previous: null, returnNode: null,
          visitedLarge: !!start?.large, departed: false, pendingReturn: false,
          respawnMs: 240000, turnQueued: false
        };
        world.inLargeCell = false;
        world.group.visible = false;
        room.visible = true;
        const skinList = textures.filter(Boolean);
        (world.parallaxPanels || []).forEach((panel, index) => {
          const material = panel.mesh && panel.mesh.material;
          if (!material || !skinList.length) return;
          material.map = skinList[index % skinList.length];
          if (material.color) material.color.setHex(0xffffff);
          material.needsUpdate = true;
        });
        (world.materials || []).slice(0, 4).forEach((material, index) => {
          if (!material || !skinList.length) return;
          material.map = skinList[index % skinList.length];
          if (material.color) material.color.setHex(0xffffff);
          material.needsUpdate = true;
        });
        applyRingCellLook(world);
        const gateRoll = hashSeed(String(maze.seed) + "|boss-gate") % 3;
        if (gateRoll === 1 && start) {
          const firstCrystal = (maze.crystals || []).map((crystal) => {
            if (!crystal || !crystal.cell) return null;
            return nodes.get(keyOf(crystal.cell.x, crystal.cell.y, crystal.cell.z)) || null;
          }).filter(Boolean).sort((a, b) => distanceToNode(start, a) - distanceToNode(start, b))[0];
          const trail = [];
          let walk = start;
          const seen = new Set();
          while (walk && firstCrystal && walk !== firstCrystal && trail.length < 48 && !seen.has(walk)) {
            seen.add(walk);
            const dir = nextDirectionToward(walk, firstCrystal);
            walk = dir ? neighbor(walk, dir) : null;
            if (walk && walk !== firstCrystal && !walk.large) trail.push(walk);
          }
          const gateCell = trail.length ? trail[Math.floor(trail.length / 2)] : null;
          if (gateCell) gateCell.gate = true;
        }
        publishAsteroidChart(maze);
      }

      function applyRingCellLook(world, nodeOverride, headingOverride) {
        const path = world.cellPath;
        if (!path || !(nodeOverride || path.current)) return;
        const node = nodeOverride || path.current;
        const heading = headingOverride || path.heading;
        const tex = path.textures[Math.abs(node.wallAsset || 0) % path.textures.length];
        if (tex) {
          tex.rotation = (node.wallTurn || 0) * (Math.PI / 2);
          tex.center.set(0.5, 0.5);
          path.floorMaterial.map = tex;
          path.wallMaterial.map = tex;
          path.floorMaterial.needsUpdate = true;
          path.wallMaterial.needsUpdate = true;
        }
        const astralPalette = {
          drift: { floor: 0xc9b6ff, wall: 0x8d78c9 },
          flux: { floor: 0x9ce9ff, wall: 0x438fa9 },
          dense: { floor: 0xf0c8ff, wall: 0x9666ac }
        };
        const tint = astralPalette[node.astralMode] || { floor: 0x9ce9ff, wall: 0x438fa9 };
        path.floorMaterial.color.setHex(0xffffff);
        path.wallMaterial.color.setHex(0xffffff);
        if (path.floorMaterial.emissive && path.wallMaterial.emissive) {
          path.floorMaterial.emissive.setHex(node.astral ? tint.floor : 0x000000);
          path.wallMaterial.emissive.setHex(node.astral ? tint.wall : 0x000000);
          path.floorMaterial.emissiveIntensity = node.astral ? 0.16 : 0;
          path.wallMaterial.emissiveIntensity = node.astral ? 0.16 : 0;
        }
        const rightDoor = !node.large && !!path.neighbor(node, heading);
        const leftDoor = !node.large && !!path.neighbor(node, path.opposite[heading]);
        path.doorRight.visible = rightDoor;
        path.doorLeft.visible = leftDoor;
        path.sealedWallRight.visible = !node.large && !rightDoor;
        path.sealedWallLeft.visible = !node.large && !leftDoor;
        const verticalExit = !node.large && !!(path.neighbor(node, "yp") || path.neighbor(node, "yn"));
        path.hatch.visible = verticalExit;
        path.portalRing.visible = verticalExit;
        path.portalMaterial.color.setHex(path.neighbor(node, "yp") ? 0x7ef4e6 : 0xb99aff);
        // MeshBasicMaterial has no emissive. Calling setHex there aborted the level
        // and restored the asteroid, so the Ring maze never stayed open.
        if (path.portalMaterial.emissive && path.portalMaterial.emissive.setHex) {
          path.portalMaterial.emissive.setHex(path.neighbor(node, "yp") ? 0x1a8eab : 0x5d2d91);
        }
        if (path.hydrogenMesh) {
          const mission = window.BCMWorldMission || {};
          const hydrogenActive = !!mission.hydrogenUnlocked && Number(mission.hydrogenCount || 0) < 3;
          const crystalHere = (path.routeCrystals || []).some((crystal) =>
            crystal && !crystal.taken && crystal.cell &&
            crystal.cell.x === node.x && crystal.cell.y === node.y && crystal.cell.z === node.z);
          path.hydrogenMesh.visible = hydrogenActive && !node.large && (crystalHere ||
            (!(path.routeCrystals || []).length && node === path.hydrogenNode));
        }
        path.nodes.forEach((other) => {
          (other.mobs || []).forEach((mob) => {
            if (!mob.mesh) return;
            mob.mesh.visible = other === node && mob.alive && !node.large;
          });
        });
        if (!nodeOverride) world.inLargeCell = !!node.large;
        world.group.visible = !!node.large;
        path.room.visible = !node.large;
      }

      function placeParty(x, player) {
        const targets = player ? [player] : players;
        targets.forEach((mate, index) => {
          mate.worldX = x + (!player && index ? -0.9 : 0);
          mate.worldY = 0;
          mate.vy = 0;
          mate.grounded = true;
          mate.supportPlatform = null;
          const node = mate.ringCurrent || worldState.cellPath?.current;
          mate.checkpointX = node?.large ? worldState.spawnX : worldState.cellPath.homeX;
          updatePlayerSprite(mate);
        });
      }

      function faceAsteroidRoute(world, node, player) {
        const path = world.cellPath;
        if (!path || !node || typeof path.objectiveNode !== "function" || typeof path.nextDirectionToward !== "function") return;
        const goal = path.objectiveNode(node);
        const step = goal ? path.nextDirectionToward(node, goal) : null;
        path.routeStep = step;
        if (node.large) return;
        const horizontal = ["xp", "xn", "zp", "zn"];
        let heading = player ? (player.ringHeading || path.heading) : path.heading;
        if (step && horizontal.includes(step) && path.neighbor(node, step)) heading = step;
        else if (step === "yp" || step === "yn") {
          const closed = horizontal.find((dir) => !path.neighbor(node, dir));
          if (closed) heading = closed;
        }
        if (player) {
          player.ringHeading = heading;
          if (player.index === 0) path.heading = heading;
        } else {
          path.heading = heading;
        }
        const home = maze.startCell
          ? path.nodes.get(path.keyOf(maze.startCell.x, maze.startCell.y, maze.startCell.z))
          : null;
        if (home && node !== home) path.departed = true;
        const mission = window.BCMWorldMission || {};
        const routeCrystals = path.routeCrystals || [];
        const hydrogenRouteActive = !!mission.hydrogenUnlocked &&
          Number(mission.hydrogenCount || 0) < 3 && routeCrystals.length > 0;
        const pending = hydrogenRouteActive && routeCrystals.some((crystal) => crystal && !crystal.taken);
        const objectiveReached = hydrogenRouteActive
          ? routeCrystals.every((crystal) => crystal && crystal.taken)
          : !!path.visitedLarge;
        // A home revisit is not a win by itself: only finish after collecting the
        // active route's crystals, or after the no-Hydrogen route visited the large area.
        if (path.departed && home && node === home && objectiveReached && !pending) path.pendingReturn = true;
      }

      function enterRingCell(world, node, fromSide, player) {
        const path = world.cellPath;
        if (!path || !node) return world.spawnX;
        const previous = player ? (player.ringCurrent || path.current) : path.current;
        path.previous = previous;
        path.current = node;
        if (node.large) path.visitedLarge = true;
        if (player) {
          player.ringPrevious = previous;
          player.ringCurrent = node;
          if (node.large && previous && !previous.large) player.ringReturnNode = previous;
          else if (!node.large) player.ringReturnNode = null;
          player.ringHeading = player.ringHeading || path.heading;
          if (player.index === 0) {
            path.heading = player.ringHeading;
            path.returnNode = player.ringReturnNode || null;
          }
        } else if (node.large && previous && !previous.large) {
          path.returnNode = previous;
        }
        faceAsteroidRoute(world, node, player);
        applyRingCellLook(world, player ? node : null, player ? (player.ringHeading || path.heading) : path.heading);
        if (node.large) return world.spawnX;
        if (fromSide === "right") return path.homeX + path.half - 1.6;
        if (fromSide === "left") return path.homeX - path.half + 1.6;
        return path.homeX;
      }

      const oldBackground = scene.background;

      const old = document.getElementById("bcm-ring-platformer-old");
      if (old) old.remove();

      // The side-scroll world has to exist before the mode buttons are wired.
      // Without this call the menu is already on screen when spawn setup throws,
      // so SINGLE/MULTI look clickable and the level never starts.
      const worldState = buildRingWorld();
      attachAsteroidCellPath(worldState);
      const mission = window.BCMWorldMission;
      if (mission?.hydrogenUnlocked && !mission.hydrogenCollected && !mission.ringHydrogenPromptShown) {
        mission.ringHydrogenPromptShown = true;
        window.BCMDialogue?.showOperator?.("", window.BCMDialogue?.language === "en"
          ? "Hydrogen is marked on your chart. It is in the first small cell, not at the pig arena. Take the side door and search the floor."
          : "Hydrogen отмечен на карте. Он в первой малой ячейке, а не на арене со свиньями. Иди через боковую дверь и осмотри пол.");
      }
      const cameraOne = new THREE.OrthographicCamera(-5, 5, 4.6, -4.6, 0.1, 500);
      const cameraTwo = new THREE.OrthographicCamera(-5, 5, 4.6, -4.6, 0.1, 500);
      const cameraFocus = { x: worldState.cellPath ? worldState.cellPath.homeX : worldState.spawnX, y: 1.6, z: 0 };

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
        if (window.BCMCrewCutout?.placeholder) {
          try { texture = window.BCMCrewCutout.placeholder(THREE, player.index); } catch (e) {}
        }
        if (!texture) texture = fallbackCrewTexture(player.index);
        if (imageUrl && window.BCMTowerAPI?.makeCrewSpriteTexture) {
          try {
            const shared = window.BCMTowerAPI.makeCrewSpriteTexture(imageUrl);
            if (shared) texture = shared;
          } catch (e) {}
        }
        if (texture.colorSpace !== undefined && THREE.SRGBColorSpace !== undefined) texture.colorSpace = THREE.SRGBColorSpace;
        const material = new THREE.SpriteMaterial({
          map: texture, transparent: true, alphaTest: 0.035, depthWrite: false
        });
        const sprite = new THREE.Sprite(material);
        sprite.name = "ring-crew-sprite-" + (player.index + 1);
        sprite.scale.set(1.18, 1.78, 1);
        sprite.renderOrder = 8;
        scene.add(sprite);
        player.sprite = sprite;
        player.spriteMaterial = material;
        const swapCutout = window.BCMCrewCutout?.makeTexture || null;
        if (swapCutout && imageUrl) {
          swapCutout(THREE, imageUrl).then((cut) => {
            if (!cut || !player.spriteMaterial || player.spriteMaterial.map === cut) return;
            player.spriteMaterial.map = cut;
            player.spriteMaterial.needsUpdate = true;
          }).catch(() => {});
        }
      }

      function playerWorldPosition(player) {
        return { x: player.worldX, y: player.worldY + 0.98, z: 0.45 };
      }
      function updatePlayerSprite(player) {
        if (!player.sprite) return;
        const moved = Math.abs((player._prevX ?? player.worldX) - player.worldX) > 0.01;
        player._prevX = player.worldX;
        if (window.BCMCrewCore) {
          window.BCMCrewCore.applyPlatformSprite(player.sprite, {
            facing: player.facing,
            moving: moved || !player.grounded,
            grounded: player.grounded,
            vy: player.vy,
            crew: crewSelection[player.index],
            index: player.index,
            y: player.worldY + 0.98
          });
          player.sprite.position.x = player.worldX;
          player.sprite.position.z = 0.45;
        } else {
          const p = playerWorldPosition(player);
          player.sprite.position.set(p.x, p.y, p.z);
          player.sprite.scale.x = player.facing < 0 ? -1.45 : 1.45;
        }
        player.sprite.visible = true;
      }

      function createPlayer(index, spawn) {
        const crew = crewSelection[index] || {};
        const player = {
          index,
          name: String(crew.name || crew.displayName || ("Crew " + (index + 1))),
          worldX: Number(spawn.x) || 0, worldY: Number(spawn.y) || 0,
          x: Number(spawn.x) || 0, y: Number(spawn.y) || 0, z: 0,
          localX: 0, jumpHeight: 0, vy: 0, grounded: true, supportPlatform: null,
          facing: 1, lastActionAt: 0, wasJumpDown: false,
          actionReadyAt: 0, dashReadyAt: 0, dashUntil: 0,
          weaponType: weaponProgress.type || "pointer",
          weaponTier: Math.max(1, Number(weaponProgress.tier) || 1),
          weaponReadyAt: 0,
          hp: 5, maxHp: 5, invulnerableUntil: 0,
          checkpointX: Number(spawn.x) || -45,
          image: crewImages[index] || null, tint: playerColors[index], moves: 0,
          sprite: null, spriteMaterial: null,
          ringCurrent: worldState.cellPath ? worldState.cellPath.current : null,
          ringPrevious: null,
          ringHeading: worldState.cellPath ? worldState.cellPath.heading : "xp",
          ringReturnNode: worldState.cellPath ? worldState.cellPath.returnNode : null,
          ringTurnQueued: false
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
          jump: !!(keys.jump || touch.jump || pad.jump),
          fire: !!(keys.fire || touch.fire || pad.fire)
        };
      }

      const bossMeter = root2d.querySelector("[data-ring-boss-meter]");
      const bossFill = root2d.querySelector("[data-ring-boss-fill]");

      function updateHud(message) {
        countEl.textContent = "БОССЫ " + worldState.defeatedBosses + "/3";
        const p1 = players[0];
        const p2 = players[1];
        if (p1) {
          const zone = p1.worldX < -2 ? 1 : p1.worldX < 36 ? 2 : 3;
          const astralNode = worldState.cellPath && worldState.cellPath.current;
          const anomalyLabel = astralNode?.astral
            ? ({ drift: "ASTRAL · DRIFT", flux: "ASTRAL · GRAVITY FLUX", dense: "ASTRAL · DENSE GRAVITY" }[astralNode.astralMode] || "ASTRAL")
            : "";
          floorEl.textContent = "ЗОНА " + zone + "/3 · P1 HP " + p1.hp +
            (p2 ? " · P2 HP " + p2.hp : "") + (splitActive ? " · SPLIT" : " · SHARED") +
            (anomalyLabel ? " · " + anomalyLabel : "");
        } else {
          floorEl.textContent = "RING FRONTIER · 3 ЗОНЫ";
        }
        const focusPlayer = p1 || p2;
        const activeBoss = worldState.bosses.find((boss) =>
          boss.alive && focusPlayer && Math.abs(focusPlayer.worldX - boss.x) < 15
        );
        if (bossMeter) bossMeter.style.display = activeBoss ? "block" : "none";
        if (bossFill) bossFill.style.width = activeBoss ? Math.max(0, activeBoss.hp / activeBoss.maxHp * 100) + "%" : "100%";
        if (message) {
          statusEl.textContent = message;
          return;
        }
        if (worldState.defeatedBosses >= 3) {
          statusEl.textContent = (p1 && p1.worldX >= worldState.exitX - 2)
            ? "ВЫХОД ОТКРЫТ · ВОЗВРАЩАЙСЯ К КОЛЬЦУ"
            : "АРЕНЫ ОЧИЩЕНЫ · ИДИ К ВЫХОДУ";
        } else if (activeBoss) {
          statusEl.textContent = activeBoss.name + " · " + activeBoss.hp + "/" + activeBoss.maxHp;
        } else if (worldState.cellPath && worldState.cellPath.current && !worldState.cellPath.current.large) {
          const en = window.BCMDialogue?.language === "en";
          const step = worldState.cellPath.routeStep;
          const here = worldState.cellPath.current;
          const gateLocked = !!(here.gate && !here.gateCleared && (here.mobs || []).some((mob) => mob.alive));
          if (gateLocked) {
            statusEl.textContent = en
              ? "THIS CELL'S PASSAGE IS GUARDED · FIRE THE LASER · THEN THE OPEN DOOR"
              : "ПРОХОД ЭТОЙ КЛЕТКИ СТЕРЕЖЁТ БОСС · ЛАЗЕР · ПОТОМ ОТКРЫТАЯ ДВЕРЬ";
          } else if (step === "yp" || step === "yn") {
            statusEl.textContent = en
              ? "ASTEROID CELL · JUMP OR E AT THE GLOW · OTHER FLOOR"
              : "ЯЧЕЙКА АСТЕРОИДА · ПРЫЖОК ИЛИ E У СВЕЧЕНИЯ · ДРУГОЙ ЭТАЖ";
          } else if (worldState.cellPath.departed &&
              (!window.BCMWorldMission?.hydrogenUnlocked ||
               Number(window.BCMWorldMission?.hydrogenCount || 0) >= 3 ||
               !(worldState.cellPath.routeCrystals || []).some((crystal) => crystal && !crystal.taken))) {
            statusEl.textContent = en
              ? "CELL · OPEN DOOR LEADS BACK TO THE LANDING"
              : "ЯЧЕЙКА · ОТКРЫТАЯ ДВЕРЬ ВЕДЁТ К МЕСТУ ВЫСАДКИ";
          } else {
            statusEl.textContent = worldState.cellPath.current.astral
              ? (en ? "ASTRAL LAYER · JUMP AT THE GLOW" : "АСТРАЛЬНЫЙ СЛОЙ · ПРЫЖОК У СВЕЧЕНИЯ")
              : (en ? "CELL · WALK THROUGH THE OPEN DOOR · E TURNS" : "ЯЧЕЙКА · ИДИ В ОТКРЫТУЮ ДВЕРЬ · E ПОВОРОТ");
          }
        } else {
          statusEl.textContent = "ЗОНА " + (p1 ? (p1.worldX < -2 ? 1 : p1.worldX < 36 ? 2 : 3) : 1) +
            " · НАЙДИ АРЕНУ БОССА";
        }
      }

      function collectHydrogenAt(player) {
        const path = worldState.cellPath;
        const mission = window.BCMWorldMission || {};
        const playerNode = player.ringCurrent || path?.current;
        if (!path || (path.routeCrystals || []).length || !path.hydrogenMesh ||
            !mission.hydrogenUnlocked || Number(mission.hydrogenCount || 0) >= 3 ||
            path.hydrogen.taken || playerNode !== path.hydrogenNode || playerNode?.large) return false;
        if (Math.abs(player.worldX - path.hydrogenPickupX) > 1.05 ||
            Math.abs(player.worldY - 0.82) > 1.25) return false;

        path.hydrogenMesh.visible = false;
        path.hydrogen.taken = true;
        path.hydrogen.unlocked = true;
        maze.hydrogen = path.hydrogen;
        publishAsteroidChart(maze);
        window.dispatchEvent(new CustomEvent("bcm:mission:hydrogen-shard-collected", {
          detail: {
            crystalId: "ring:" + String(maze.seed),
            asteroidSeed: maze.seed,
            cell: { ...path.hydrogen.cell },
            type: "ring"
          }
        }));
        updateHud(window.BCMDialogue?.language === "en"
          ? "HYDROGEN RECOVERED · MISSION UPDATED"
          : "HYDROGEN ПОЛУЧЕН · ЗАДАНИЕ ОБНОВЛЕНО");
        drawMiniMap();
        return true;
      }

      function collectRouteCrystal(player) {
        const path = worldState.cellPath;
        const node = player.ringCurrent || path?.current;
        if (!path || !node || node.large) return false;
        const mission = window.BCMWorldMission || {};
        if (!mission.hydrogenUnlocked || Number(mission.hydrogenCount || 0) >= 3) return false;
        const crystal = (path.routeCrystals || []).find((item) =>
          item && !item.taken && item.cell &&
          item.cell.x === node.x && item.cell.y === node.y && item.cell.z === node.z);
        if (!crystal) return false;
        if (Math.abs(player.worldX - path.hydrogenPickupX) > 1.15) return false;
        crystal.taken = true;
        crystal.scouted = true;
        if (path.hydrogenMesh) path.hydrogenMesh.visible = false;
        publishAsteroidChart(maze);
        window.dispatchEvent(new CustomEvent("bcm:mission:hydrogen-shard-collected", {
          detail: {
            crystalId: crystal.id,
            asteroidSeed: maze.seed,
            cell: { x: crystal.cell.x, y: crystal.cell.y, z: crystal.cell.z },
            type: "asteroid-crystal"
          }
        }));
        const count = Number(window.BCMWorldMission?.hydrogenCount || 0);
        const left = (path.routeCrystals || []).filter((item) => item && !item.taken).length;
        const en = window.BCMDialogue?.language === "en";
        updateHud(count >= 3
          ? (en ? "HYDROGEN 3/3 · RETURN TO THE LANDING CELL" : "HYDROGEN 3/3 · ВЕРНИСЬ К МЕСТУ ВЫСАДКИ")
          : (en
            ? "HYDROGEN " + count + "/3 · " + Math.max(0, 3 - count) + " LEFT · FOLLOW THE OPEN DOOR"
            : "HYDROGEN " + count + "/3 · ОСТАЛОСЬ " + Math.max(0, 3 - count) + " · ИДИ В ОТКРЫТУЮ ДВЕРЬ"));
        faceAsteroidRoute(worldState, node, player);
        return true;
      }

      function collectAt(player) {
        let collected = false;
        worldState.coreMeshes.forEach((core) => {
          if (core.taken || Math.abs(player.worldX - core.x) > 1.0 ||
              Math.abs((player.worldY + 0.8) - core.y) > 1.5) return;
          core.taken = true;
          core.mesh.visible = false;
          player.hp = Math.min(player.maxHp, player.hp + 1);
          collected = true;
        });
        if (collected) updateHud("ЭНЕРГОЯДРО · СИСТЕМЫ ВОССТАНОВЛЕНЫ");
        return collected;
      }

      function currentWeaponProfile(player) {
        const type = String(player?.weaponType || weaponProgress.type || "pointer");
        const tier = Math.max(1, Number(player?.weaponTier || weaponProgress.tier) || 1);
        if (type === "pulse") return { cooldown: Math.max(360, 720 - tier * 45), damage: 2 + Math.floor((tier - 1) / 2), color: 0xffb960, range: 16, width: 0.07 };
        if (type === "spectrum") return { cooldown: Math.max(190, 390 - tier * 30), damage: 1 + Math.floor(tier / 3), color: weaponPalette[weaponShotIndex % weaponPalette.length], range: 17, width: 0.055 };
        return { cooldown: Math.max(75, 150 - tier * 14), damage: 1, color: 0x75eaff, range: 15, width: 0.045 };
      }

      function firePlayerWeapon(player, now) {
        if (!player || !gameStarted || done || now < player.weaponReadyAt) return false;
        const profile = currentWeaponProfile(player);
        player.weaponReadyAt = now + profile.cooldown;
        const start = new THREE.Vector3(player.worldX, player.worldY + 0.9, 0.92);
        const end = start.clone().add(new THREE.Vector3(player.facing * profile.range, 0, 0));
        let target = null;
        let nearest = Infinity;
        const playerNode = player.ringCurrent || worldState.cellPath?.current;
        if (playerNode && !playerNode.large) {
          (playerNode.mobs || []).forEach((mob) => {
            if (!mob.alive || !mob.mesh) return;
            const forwardDistance = (mob.mesh.position.x - player.worldX) * player.facing;
            if (forwardDistance <= 0.2 || forwardDistance > profile.range) return;
            mob.alive = false;
            mob.mesh.visible = false;
            mob.respawnAt = now + worldState.cellPath.respawnMs;
          });
        }
        for (const boss of worldState.bosses) {
          if (!boss.alive) continue;
          const forwardDistance = (boss.x - player.worldX) * player.facing;
          if (forwardDistance <= 0 || forwardDistance > profile.range) continue;
          if (Math.abs(player.worldY - boss.y) > 4.4) continue;
          if (forwardDistance < nearest) { target = boss; nearest = forwardDistance; }
        }
        if (target) end.set(target.x, target.y + 0.2, 0.94);
        const beamDirection = end.clone().sub(start);
        const beamLength = Math.max(0.01, beamDirection.length());
        const beamRotation = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0), beamDirection.clone().normalize()
        );
        const geometry = new THREE.CylinderGeometry(profile.width, profile.width, beamLength, 6, 1, true);
        const material = new THREE.MeshBasicMaterial({
          color: profile.color, transparent: true, opacity: 0.94, depthTest: false, depthWrite: false
        });
        const beam = new THREE.Mesh(geometry, material);
        beam.position.copy(start).add(end).multiplyScalar(0.5);
        beam.quaternion.copy(beamRotation);
        beam.renderOrder = 999;
        scene.add(beam);
        const glowWidth = profile.width * (player.weaponType === "pointer" ? 2.2 : 3.2);
        const glowGeometry = new THREE.CylinderGeometry(glowWidth, glowWidth, beamLength, 6, 1, true);
        const glowMaterial = new THREE.MeshBasicMaterial({
          color: profile.color, transparent: true, opacity: 0.23, depthTest: false, depthWrite: false
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.position.copy(beam.position);
        glow.quaternion.copy(beamRotation);
        glow.renderOrder = 998;
        scene.add(glow);
        weaponShots.push({ mesh: beam, life: 0.105, geometry, material, glow, glowGeometry, glowMaterial });

        if (player.weaponType === "spectrum") weaponShotIndex += 1;
        if (target && target.activated && now >= (Number(target.nextDamageAt) || 0)) {
          target.nextDamageAt = now + Math.max(110, profile.cooldown * 0.7);
          target.hp = Math.max(0, target.hp - profile.damage);
          target.lastDamageAt = now;
          if (target.hp <= 0) {
            target.alive = false;
            target.group.visible = false;
            worldState.defeatedBosses = Math.min(3, worldState.defeatedBosses + 1);
            worldState.barriers.forEach((barrier) => {
              barrier.group.visible = worldState.defeatedBosses < barrier.unlockAfter;
            });
            updateHud(target.name + " · ОРУЖИЕ " + String(player.weaponType).toUpperCase());
            if (worldState.defeatedBosses === 1 && !masterOfferedThisRun) {
              masterOfferedThisRun = true;
              window.setTimeout(() => offerWeaponChoice(false), 120);
            }
          } else {
            updateHud("ПОПАДАНИЕ · " + target.name + " · " + target.hp + "/" + target.maxHp);
          }
        } else if (target && !target.activated) {
          updateHud("АРЕНА ЕЩЁ НЕ ОТКРЫТА");
        }
        return true;
      }

      function updateWeaponShots(dt) {
        for (let i = weaponShots.length - 1; i >= 0; i -= 1) {
          const shot = weaponShots[i];
          shot.life -= dt;
          const opacity = Math.max(0, shot.life / 0.105);
          shot.mesh.material.opacity = opacity;
          shot.glow.material.opacity = opacity * 0.3;
          if (shot.life > 0) continue;
          scene.remove(shot.mesh);
          scene.remove(shot.glow);
          try { shot.geometry.dispose(); } catch (e) {}
          try { shot.material.dispose(); } catch (e) {}
          try { shot.glowGeometry.dispose(); } catch (e) {}
          try { shot.glowMaterial.dispose(); } catch (e) {}
          weaponShots.splice(i, 1);
        }
      }

      function applyTeamWeapon(type, tier) {
        const validType = ["pointer", "pulse", "spectrum"].includes(type) ? type : "pointer";
        weaponProgress.type = validType;
        weaponProgress.tier = Math.max(1, Math.min(5, Math.floor(Number(tier) || 1)));
        players.forEach((player) => {
          player.weaponType = weaponProgress.type;
          player.weaponTier = weaponProgress.tier;
          player.weaponReadyAt = 0;
        });
        const fireButton = root2d.querySelector('[data-ring-action="fire"]');
        if (fireButton) {
          const labels = window.BCMDialogue?.language === "en"
            ? { pointer: "LASER", pulse: "PULSE", spectrum: "SPECTRUM" }
            : { pointer: "ЛАЗЕР", pulse: "ИМПУЛЬС", spectrum: "СПЕКТР" };
          fireButton.textContent = labels[validType];
        }
        const names = window.BCMDialogue?.language === "en"
          ? { pointer: "Laser pointer", pulse: "Pulse beam", spectrum: "Spectrum beam" }
          : { pointer: "Лазер-указка", pulse: "Импульсный луч", spectrum: "Спектральный луч" };
        updateHud("ОРУЖИЕ · " + names[validType] + " · T" + weaponProgress.tier);
      }

      function offerWeaponChoice(upgradeTest) {
        const lang = window.BCMDialogue?.language || "ru";
        const message = upgradeTest
          ? (lang === "en" ? "A stronger weapon test is ready. Upgrade your current weapon or keep the proven setting." : "Мастер подготовил усиленный тест. Улучшить оружие или оставить проверенный вариант?")
          : (lang === "en" ? "Choose a main weapon. Each option has its own firing rhythm and beam colour." : "Выбери основное оружие. У каждого свой ритм выстрела и цвет луча.");
        const choices = upgradeTest
          ? [
              { label: lang === "en" ? "TEST UPGRADE" : "ПРОБНЫЙ АПГРЕЙД", onSelect: () => {
                applyTeamWeapon(weaponProgress.type || "pointer", (weaponProgress.tier || 1) + 1);
                weaponProgress.pendingUpgrade = false;
                weaponProgress.lastUpgradePromptRun = weaponProgress.completedRuns;
                weaponProgress.nextUpgradeAt = weaponProgress.completedRuns + 2;
              } },
              { label: lang === "en" ? "KEEP CURRENT" : "ОСТАВИТЬ", onSelect: () => {
                weaponProgress.pendingUpgrade = false;
                weaponProgress.lastUpgradePromptRun = weaponProgress.completedRuns;
                weaponProgress.nextUpgradeAt = weaponProgress.completedRuns + 2;
              } }
            ]
          : [
              { label: lang === "en" ? "Laser pointer · fast" : "Лазер-указка · быстро", onSelect: () => applyTeamWeapon("pointer", 1) },
              { label: lang === "en" ? "Pulse · heavy" : "Импульс · мощно", onSelect: () => applyTeamWeapon("pulse", 1) },
              { label: lang === "en" ? "Spectrum · rainbow" : "Спектр · радуга", onSelect: () => applyTeamWeapon("spectrum", 1) }
            ];
        window.BCMDialogue?.showOperator(lang === "en" ? "WEAPON MASTER" : "МАСТЕР ОРУЖИЯ", message, choices);
      }

      function activateBossWeakpoint(player) {
        const now = performance.now();
        const boss = worldState.bosses.find((item) =>
          item.alive && item.activated && Math.abs(player.worldX - item.x) < 5.8 &&
          Math.abs(player.worldY - item.y) < 4.5
        );
        if (!boss) {
          updateHud("ПОДОЙДИ К АРЕНЕ И НАЖМИ АКТИВАЦИЮ");
          return false;
        }
        if (now < boss.nextDamageAt) return false;
        boss.nextDamageAt = now + 620;
        boss.hp = Math.max(0, boss.hp - 1);
        boss.lastDamageAt = now;
        if (boss.hp <= 0) {
          boss.alive = false;
          boss.group.visible = false;
          worldState.defeatedBosses = Math.min(3, worldState.defeatedBosses + 1);
          worldState.barriers.forEach((barrier) => {
            barrier.group.visible = worldState.defeatedBosses < barrier.unlockAfter;
          });
          updateHud(boss.name + " · АРЕНА ОЧИЩЕНА");
          if (worldState.defeatedBosses === 1 && !masterOfferedThisRun) {
            masterOfferedThisRun = true;
            window.setTimeout(() => offerWeaponChoice(false), 120);
          }
        } else {
          updateHud("ТОЧКА БОССА ОТКЛИКНУЛАСЬ · " + boss.hp + " / " + boss.maxHp);
        }
        return true;
      }

      function triggerAction(index, action) {
        const player = players[index];
        if (!player || !gameStarted || done) return false;
        const now = performance.now();
        if (action === "floor") {
          const path = worldState.cellPath;
          const node = player.ringCurrent || path?.current;
          if (!path || !node || node.large) return false;
          const routeStep = path.routeStep;
          const preferred = player.ringFloorDirection ||
            ((routeStep === "yp" || routeStep === "yn") ? routeStep : "yp");
          const nextDir = [preferred, path.opposite[preferred]].find((dir) => path.neighbor(node, dir));
          if (!nextDir) {
            updateHud(window.BCMDialogue?.language === "en"
              ? "NO FLOOR CONNECTION HERE · FIND A GLOWING HATCH"
              : "ЗДЕСЬ НЕТ ПЕРЕХОДА МЕЖДУ ЭТАЖАМИ · ИЩИ СВЕТЯЩИЙСЯ ЛЮК");
            return true;
          }
          const nextNode = path.neighbor(node, nextDir);
          player.ringFloorDirection = path.opposite[nextDir] || "yp";
          placeParty(enterRingCell(worldState, nextNode, null, player), player);
          return true;
        }
        if (action === "activate") {
          const path = worldState.cellPath;
          const node = player.ringCurrent || path?.current;
          if (node && node.large && path) {
            const dirs = ["xp", "xn", "zp", "zn", "yp", "yn"].filter((dir) => path.neighbor(node, dir));
            const other = dirs.map((dir) => path.neighbor(node, dir)).find((next) => next && next !== player.ringReturnNode);
            const leave = other || (dirs[0] ? path.neighbor(node, dirs[0]) : null);
            if (leave) {
              placeParty(enterRingCell(worldState, leave, "right", player), player);
              return true;
            }
          }
          if (node && !node.large) {
            const step = path && path.routeStep;
            const gateLocked = !!(node.gate && !node.gateCleared && (node.mobs || []).some((mob) => mob.alive));
            if (path && step && path.neighbor(node, step) && !gateLocked) {
              const fromRight = step === "xn" || step === "zn";
              placeParty(enterRingCell(worldState, path.neighbor(node, step), fromRight ? "right" : "left", player), player);
              return true;
            }
            if (gateLocked) {
              updateHud(window.BCMDialogue?.language === "en"
                ? "A BOSS GUARDS THIS PASSAGE · FIRE THE LASER"
                : "БОСС СТЕРЕЖЁТ ПРОХОД · СТРЕЛЯЙ ЛАЗЕРОМ");
              return true;
            }
            player.ringTurnQueued = true;
            return true;
          }
          return activateBossWeakpoint(player);
        }
        if (action === "dash" && now >= player.dashReadyAt) {
          player.dashUntil = now + 210;
          player.dashReadyAt = now + 850;
          player.invulnerableUntil = Math.max(player.invulnerableUntil, now + 210);
          return true;
        }
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
        if (!gameStarted) {
          const previousFocus = event.code === "ArrowLeft" || event.code === "KeyA" || event.code === "Tab" && event.shiftKey;
          const nextFocus = event.code === "ArrowRight" || event.code === "KeyD" || event.code === "Tab" && !event.shiftKey;
          const confirm = event.code === "KeyE" || event.code === "Enter" || event.code === "NumpadEnter" || event.code === "Space";
          if (previousFocus || nextFocus || confirm) {
            event.preventDefault();
            event.stopImmediatePropagation();
            if (!down || event.repeat) return;
            if (previousFocus) focusModeMenu(menuFocusIndex - 1);
            else if (nextFocus) focusModeMenu(menuFocusIndex + 1);
            else confirmModeMenu();
          }
          return;
        }
        const p1 = {
          ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
          Space: "jump", ArrowUp: "jump", KeyW: "jump"
        };
        const p2 = { KeyJ: "left", KeyL: "right", KeyP: "jump" };
        let index = 0;
        if (event.code === "KeyQ" || (mode === "multi" && event.code === "KeyK")) {
          index = event.code === "KeyK" ? 1 : 0;
          event.preventDefault();
          event.stopImmediatePropagation();
          keyboardInputs[index].fire = down;
          return;
        }
        let action = p1[event.code] || null;
        if (!action && mode === "multi") {
          action = p2[event.code] || null;
          if (action) index = 1;
        }
        const p1Activate = event.code === "KeyE";
        const p1Floor = event.code === "KeyR";
        const p1Dash = event.code === "ShiftLeft" || event.code === "ShiftRight" || event.code === "KeyC";
        const p2Activate = event.code === "KeyO";
        const p2Floor = event.code === "KeyI";
        const p2Dash = event.code === "KeyU";
        if (mode === "multi" && (p2Activate || p2Floor || p2Dash)) index = 1;
        if (p1Floor || p2Floor) {
          event.preventDefault();
          event.stopImmediatePropagation();
          if (down && !event.repeat) triggerAction(index, "floor");
          return;
        }
        if (p1Activate || p2Activate) {
          event.preventDefault();
          event.stopImmediatePropagation();
          if (down && !event.repeat) triggerAction(index, "activate");
          return;
        }
        if (p1Dash || p2Dash) {
          event.preventDefault();
          event.stopImmediatePropagation();
          if (down && !event.repeat) triggerAction(index, "dash");
          return;
        }
        if (!action || index >= (mode === "multi" ? 2 : 1)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        keyboardInputs[index][action] = down;
      }

      function pollGamepads() {
        if (done || !navigator.getGamepads) return;
        if (!gameStarted) {
          pollModeMenuGamepad();
          return;
        }
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
          const button = (n) => !!(pad.buttons && pad.buttons[n] && pad.buttons[n].pressed);
          statePad.left = !!(button(14) || axisX < -0.42);
          statePad.right = !!(button(15) || axisX > 0.42);
          statePad.jump = !!(button(0) || button(12) || axisY < -0.68);
          statePad.dash = !!button(1);
          statePad.activate = !!button(2);
          statePad.fire = !!button(3);
          statePad.floor = !!button(4);
          if (statePad.activate && !previousPad[i].activate) triggerAction(i, "activate");
          if (statePad.dash && !previousPad[i].dash) triggerAction(i, "dash");
          if (statePad.floor && !previousPad[i].floor) triggerAction(i, "floor");
          previousPad[i] = { activate: statePad.activate, dash: statePad.dash, floor: statePad.floor };
        }
      }

      function damagePlayer(player, now) {
        if (now < player.invulnerableUntil) return;
        player.hp -= 1;
        player.invulnerableUntil = now + 1000;
        if (player.hp <= 0) {
          player.hp = player.maxHp;
          player.worldX = player.checkpointX;
          player.worldY = 0;
          player.vy = 0;
          player.grounded = true;
          player.supportPlatform = null;
          player.invulnerableUntil = now + 1500;
          updateHud(player.name + " · ВОЗВРАТ НА КОНТРОЛЬНУЮ ТОЧКУ");
        } else {
          updateHud(player.name + " · ПОВРЕЖДЕНИЕ " + player.hp + " HP");
        }
      }

      function updateCellMobs(dt, now) {
        const path = worldState.cellPath;
        if (!path) return;
        const activeNodes = new Set(players.map((player) => player.ringCurrent || path.current).filter((node) => node && !node.large));
        if (!activeNodes.size && path.current && !path.current.large) activeNodes.add(path.current);
        activeNodes.forEach((node) => {
          if (node.astral) {
            const tex = path.textures[Math.abs(node.wallAsset || 0) % path.textures.length];
            if (tex) tex.rotation = (node.wallTurn || 0) * (Math.PI / 2) + now * 0.0004;
          }
          (node.mobs || []).forEach((mob) => {
            if (!mob.mesh) return;
            if (!mob.alive) {
              mob.mesh.visible = false;
              if (node.gate) return;
              if (now >= mob.respawnAt) mob.alive = true;
              else return;
            }
            const limit = node.gate ? 3.05 : 2.15;
            mob.offset += mob.dir * (node.astral ? 2.4 : 1.7) * dt;
            if (mob.offset > limit || mob.offset < -limit) mob.dir *= -1;
            mob.offset = Math.max(-limit, Math.min(limit, mob.offset));
            mob.mesh.position.set(path.homeX + mob.offset, node.astral ? 1.2 : 0.55, 0.45);
            mob.mesh.visible = true;
            const hit = players.find((player) => (player.ringCurrent || path.current) === node &&
              Math.abs(player.worldX - mob.mesh.position.x) < 0.62 && player.worldY < 1.35);
            if (hit) damagePlayer(hit, now);
          });
          if (node.gate && !(node.mobs || []).some((mob) => mob.alive)) node.gateCleared = true;
        });
      }

      function updateBosses(dt, now) {
        const living = players.filter(Boolean);
        worldState.bosses.forEach((boss) => {
          if (!boss.alive) return;
          const ring = boss.group.children[3];
          if (ring) ring.rotation.z += dt * 0.8;
          const target = living.reduce((best, player) =>
            !best || Math.abs(player.worldX - boss.x) < Math.abs(best.worldX - boss.x) ? player : best, null);
          if (!target || Math.abs(target.worldX - boss.x) > 14) return;
          if (!boss.activated) {
            boss.activated = true;
            boss.nextAttackAt = now + 900;
            boss.nextDamageAt = 0;
            updateHud("АРЕНА ОТКРЫТА · " + boss.name);
          }
          if (now < boss.nextAttackAt) return;
          boss.nextAttackAt = now + Math.max(1350, 2350 - boss.zone * 220);
          const direction = target.worldX < boss.x ? -1 : 1;
          const startX = boss.x + direction * 2.2;
          const mesh = new THREE.Mesh(worldState.shockwaveGeometry, worldState.shockwaveMaterial);
          mesh.position.set(startX, 0.95, 0.78);
          mesh.scale.setScalar(0.78);
          worldState.group.add(mesh);
          worldState.shockwaves.push({ mesh, x: startX, direction, age: 0 });
        });
      }

      function updatePlayers(dt) {
        if (worldState.cellPath && worldState.cellPath.pendingReturn) {
          worldState.cellPath.pendingReturn = false;
          finishRingPlatformer(maze, true);
          return;
        }
        pollGamepads();
        const now = performance.now();
        for (const player of players) {
          const input = getInput(player);
          const direction = (input.right ? 1 : 0) - (input.left ? 1 : 0);
          if (direction) { player.facing = direction; player.moves += dt; }
          if (input.fire) firePlayerWeapon(player, now);
          const dashing = now < player.dashUntil, previousX = player.worldX;
          if (dashing) player.worldX += player.facing * 12.5 * dt;
          else player.worldX += direction * 7.2 * dt;
          const path = worldState.cellPath;
          const playerNode = player.ringCurrent || path?.current;
          const playerInLarge = playerNode ? !!playerNode.large : worldState.inLargeCell;
          if (playerInLarge) {
            if (direction < 0 && previousX <= -48.15 && path && player.ringReturnNode) {
              placeParty(enterRingCell(worldState, player.ringReturnNode, "right", player), player);
              continue;
            }
            player.worldX = Math.max(-49, Math.min(worldState.exitX + 1.5, player.worldX));
          } else if (path && playerNode) {
            const node = playerNode;
            const horizontalDirs = ["xp", "xn", "zp", "zn"];
            const step = path.routeStep;
            const progressDir = (step && horizontalDirs.includes(step) && path.neighbor(node, step))
              ? step
              : (player.ringHeading || path.heading);
            if (progressDir !== (player.ringHeading || path.heading) && step && horizontalDirs.includes(step)) {
              player.ringHeading = progressDir;
              if (player.index === 0) path.heading = progressDir;
            }
            const heading = player.ringHeading || path.heading;
            const gateLocked = !!(node.gate && !node.gateCleared && (node.mobs || []).some((mob) => mob.alive));
            if (player.worldX > path.homeX + path.half - 0.4) {
              const forward = (step && horizontalDirs.includes(step)) ? step : heading;
              const nextNode = !gateLocked || forward !== step ? path.neighbor(node, forward) : null;
              if (gateLocked && forward === step) {
                player.worldX = path.homeX + path.half - 0.55;
                updateHud(window.BCMDialogue?.language === "en"
                  ? "A BOSS GUARDS THIS PASSAGE · FIRE THE LASER"
                  : "БОСС СТЕРЕЖЁТ ПРОХОД · СТРЕЛЯЙ ЛАЗЕРОМ");
              } else if (nextNode) {
                placeParty(enterRingCell(worldState, nextNode, "left", player), player);
                continue;
              }
            }
            if (player.worldX < path.homeX - path.half + 0.4) {
              const nextNode = path.neighbor(node, path.opposite[heading]);
              if (nextNode) {
                placeParty(enterRingCell(worldState, nextNode, "right", player), player);
                continue;
              }
            }
            player.worldX = Math.max(path.homeX - path.half + 0.35, Math.min(path.homeX + path.half - 0.35, player.worldX));
            if (player.ringTurnQueued) {
              player.ringTurnQueued = false;
              const activeHeading = player.ringHeading || path.heading;
              if ((step === "yp" || step === "yn") && path.neighbor(node, step) && !gateLocked) {
                placeParty(enterRingCell(worldState, path.neighbor(node, step), null, player), player);
                continue;
              }
              if (step && horizontalDirs.includes(step) && path.neighbor(node, step) && !gateLocked) {
                const fromRight = step === "xn" || step === "zn";
                placeParty(enterRingCell(worldState, path.neighbor(node, step), fromRight ? "right" : "left", player), player);
                continue;
              }
              const routeDirection = path.nextDirectionTowardLarge(node);
              const pendingCrystals = (maze.crystals || []).some((crystal) => crystal && !crystal.taken);
              if (!pendingCrystals && routeDirection && horizontalDirs.includes(routeDirection) && path.neighbor(node, routeDirection)) {
                const fromRight = routeDirection === "xn" || routeDirection === "zn";
                placeParty(enterRingCell(worldState, path.neighbor(node, routeDirection), fromRight ? "right" : "left", player), player);
                continue;
              }
              const openH = horizontalDirs.filter((dir) => path.neighbor(node, dir));
              const idx = Math.max(0, openH.indexOf(activeHeading));
              const turn = openH.length > 1 ? openH[(idx + 1) % openH.length] : null;
              if (turn && turn !== activeHeading) {
                player.ringHeading = turn;
                if (player.index === 0) path.heading = turn;
                const goal = typeof path.objectiveNode === "function" ? path.objectiveNode(node) : null;
                path.routeStep = goal && typeof path.nextDirectionToward === "function"
                  ? path.nextDirectionToward(node, goal) : path.routeStep;
                applyRingCellLook(worldState, node, player.ringHeading || path.heading);
              } else {
                updateHud("ТУТ НЕТ БОКОВОГО ПРОХОДА · ИЩИ СВЕЧЕНИЕ ПОРТАЛА");
              }
            }
          } else player.worldX = Math.max(-49, Math.min(worldState.exitX + 1.5, player.worldX));
          worldState.barriers.forEach((barrier) => {
            if (worldState.defeatedBosses < barrier.unlockAfter && previousX <= barrier.x + 0.12 && player.worldX > barrier.x - 0.72) player.worldX = barrier.x - 0.72;
          });
          const previousY = player.worldY;
          const astralNode = player.ringCurrent || worldState.cellPath?.current;
          const astral = !!(astralNode && astralNode.astral && !playerInLarge);
          const astralMode = astral ? astralNode.astralMode : "normal";
          let gravity = 21, jumpVelocity = 8.8;
          if (astralMode === "drift") { gravity = 6.0; jumpVelocity = 7.8; }
          else if (astralMode === "flux") { gravity = 8.0 + Math.sin(now * 0.0018 + (astralNode.astralPhase || 0)) * 1.8; jumpVelocity = 8.8; }
          else if (astralMode === "dense") { gravity = 14.5; jumpVelocity = 10.2; }
          const jumpPressed = input.jump && !player.wasJumpDown && player.grounded;
          if (jumpPressed) { player.vy = jumpVelocity; player.grounded = false; player.supportPlatform = null; }
          player.wasJumpDown = input.jump;
          player.vy -= gravity * dt;
          player.worldY += player.vy * dt;
          if (player.vy <= 0) {
            const landing = worldState.platforms.filter((platform) =>
              player.worldX >= platform.minX && player.worldX <= platform.maxX &&
              previousY >= platform.y && player.worldY <= platform.y
            ).sort((a,b)=>b.y-a.y)[0];
            if (landing) {
              player.worldY = landing.y; player.vy = 0; player.grounded = true; player.supportPlatform = landing;
              if (landing.y === 0) player.checkpointX = playerInLarge ? worldState.spawnX : (path ? path.homeX : (player.worldX < -2 ? -43 : (player.worldX < 36 ? 3 : 40)));
            } else player.grounded = false;
          }
          if (player.worldY < -7) {
            player.worldY = 0; player.vy = 0; player.grounded = true; player.supportPlatform = null;
            player.worldX = player.checkpointX; damagePlayer(player, now);
          }
          if (player.grounded && player.supportPlatform && player.supportPlatform.y > 0 &&
              (player.worldX < player.supportPlatform.minX || player.worldX > player.supportPlatform.maxX)) {
            player.grounded = false; player.vy = -0.2; player.supportPlatform = null;
          }
          collectAt(player); collectHydrogenAt(player); collectRouteCrystal(player);
          const blinking = now < player.invulnerableUntil && Math.floor(now / 90) % 2 === 0;
          if (player.sprite) player.sprite.visible = !blinking;
          updatePlayerSprite(player);
        }
        worldState.shockwaves = worldState.shockwaves.filter((wave) => {
          wave.age += dt; wave.x += wave.direction * 8.5 * dt; wave.mesh.position.x = wave.x;
          wave.mesh.scale.setScalar(0.72 + Math.min(0.45, wave.age * 0.22));
          const hitPlayer = players.find((player) => Math.abs(player.worldX - wave.x) < 1.0 && player.worldY < 1.15);
          if (hitPlayer) { damagePlayer(hitPlayer, now); wave.mesh.parent?.remove(wave.mesh); return false; }
          if (wave.x < -53 || wave.x > worldState.exitX + 4) { wave.mesh.parent?.remove(wave.mesh); return false; }
          return true;
        });
        updateCellMobs(dt, now); updateBosses(dt, now);
        worldState.coreMeshes.forEach((core, index) => { if (!core.taken) core.mesh.rotation.y += dt * (1 + index * 0.2); });
        worldState.exitMarker.rotation.z += dt * 0.42;
        if (worldState.defeatedBosses >= 3 && players.some((player) =>
          (player.ringCurrent ? player.ringCurrent.large : worldState.inLargeCell) && player.worldX >= worldState.exitX - 1.3
        )) { finishRingPlatformer(maze, true); return; }
        updateSplitState(); updateHud();
      }

      function updateSplitState() {
        const path = worldState.cellPath;
        if (players[0] && players[0].ringCurrent && path) {
          path.current = players[0].ringCurrent;
          path.heading = players[0].ringHeading || path.heading;
          path.returnNode = players[0].ringReturnNode || null;
          worldState.inLargeCell = !!players[0].ringCurrent.large;
        }
        if (mode !== "multi" || players.length < 2) {
          splitActive = false;
          splitDivider.hidden = true;
          return;
        }
        const p1 = players[0], p2 = players[1];
        const dx = Math.abs(p1.worldX - p2.worldX), dy = Math.abs(p1.worldY - p2.worldY);
        const haveSeparateCells = !!(p1.ringCurrent && p2.ringCurrent && p1.ringCurrent !== p2.ringCurrent);
        if (haveSeparateCells) splitActive = true;
        else if (p1.ringCurrent && p2.ringCurrent && !p1.ringCurrent.large && !p2.ringCurrent.large) {
          if (!splitActive && (dx > 4 || dy > 3)) splitActive = true;
          else if (splitActive && dx < 2.5 && dy < 1.5) splitActive = false;
        } else {
          if (!splitActive && (dx > 20 || dy > 7)) splitActive = true;
          else if (splitActive && dx < 14 && dy < 4.5) splitActive = false;
        }
        splitDivider.hidden = !splitActive;
        splitDivider.style.border = "0";
        splitDivider.style.borderLeft = "0";
        splitDivider.style.background = splitActive
          ? "linear-gradient(to bottom, transparent calc(50% - 1px), rgba(115,203,225,.82) calc(50% - 1px), rgba(115,203,225,.82) calc(50% + 1px), transparent calc(50% + 1px))"
          : "transparent";
      }

      function configureCamera(camera, viewport, center) {
        const aspect = Math.max(0.3, viewport.w / Math.max(1, viewport.h));
        const halfHeight = viewport.h > viewport.w ? 7.1 : 5.4;
        // The painted zone backgrounds drift more slowly than the action plane.
        // Apply per view so local split-screen cameras each get the same parallax illusion.
        const worldState = state.ringRenderState && state.ringRenderState.worldState;
        if (worldState && Array.isArray(worldState.parallaxPanels)) {
          worldState.parallaxPanels.forEach((layer) => {
            layer.mesh.position.x = layer.baseX + center.x * (1 - layer.factor);
          });
        }
        camera.left = -halfHeight * aspect;
        camera.right = halfHeight * aspect;
        camera.top = halfHeight;
        camera.bottom = -halfHeight;
        camera.near = 0.1;
        camera.far = 500;
        camera.updateProjectionMatrix();
        camera.up.set(0, 1, 0);
        camera.position.set(center.x, center.y + 0.65, 42);
        camera.lookAt(center.x, center.y + 0.65, 0);
      }

      function cameraTargetFor(player) {
        return { x: player.worldX, y: player.worldY + 2.2, z: 0 };
      }

      function renderRingViews(frameContext) {
        if (!state.ringPlatformer || !state.ringRenderState || done) return false;
        const renderer = frameContext && frameContext.renderer;
        const activeScene = frameContext && frameContext.scene;
        if (!renderer || !activeScene) return false;
        const canvasEl = renderer.domElement;
        const viewW = Math.max(1, (canvasEl && canvasEl.clientWidth) || root.clientWidth || 1);
        const viewH = Math.max(1, (canvasEl && canvasEl.clientHeight) || root.clientHeight || 1);
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, viewW, viewH);
        if (!players.length) {
          configureCamera(cameraOne, { w: viewW, h: viewH }, cameraFocus);
          renderer.render(activeScene, cameraOne);
          return true;
        }
        const oldAutoClear = renderer.autoClear;
        renderer.autoClear = false;
        renderer.setScissorTest(true);
        const landscape = viewW >= viewH;
        let views;
        if (splitActive && mode === "multi" && players.length > 1) {
          // P1/pilot always owns the upper horizontal half; P2's lower view is
          // independent so players can explore different zones comfortably.
          const half = Math.floor(viewH / 2);
          views = [
            { x: 0, y: half, w: viewW, h: viewH - half, player: players[0], camera: cameraOne },
            { x: 0, y: 0, w: viewW, h: half, player: players[1], camera: cameraTwo }
          ];
        } else {
          let target = cameraTargetFor(players[0]);
          if (mode === "multi" && players[1]) {
            const other = cameraTargetFor(players[1]);
            target = {
              x: (target.x + other.x) * 0.5,
              y: (target.y + other.y) * 0.5,
              z: 0
            };
          }
          views = [{ x: 0, y: 0, w: viewW, h: viewH, player: players[0], camera: cameraOne, target }];
        }

        for (const view of views) {
          const target = view.target || cameraTargetFor(view.player);
          const previousSpriteVisibility = players.map((player) => player.sprite ? player.sprite.visible : null);
          if (worldState.cellPath && view.player?.ringCurrent) {
            applyRingCellLook(worldState, view.player.ringCurrent, view.player.ringHeading);
            players.forEach((player) => {
              if (player.sprite && player.ringCurrent !== view.player.ringCurrent) player.sprite.visible = false;
            });
          }
          configureCamera(view.camera, view, target);
          renderer.setViewport(view.x, view.y, view.w, view.h);
          renderer.setScissor(view.x, view.y, view.w, view.h);
          renderer.clear(true, true, true);
          renderer.render(activeScene, view.camera);
          players.forEach((player, index) => {
            if (player.sprite && previousSpriteVisibility[index] !== null) player.sprite.visible = previousSpriteVisibility[index];
          });
        }
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, viewW, viewH);
        renderer.autoClear = oldAutoClear;
        return true;
      }

      function drawMiniMap() {
        if (done || !g) return;
        g.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        g.clearRect(0, 0, mapWidth, mapHeight);
        const bg = g.createLinearGradient(0, 0, mapWidth, mapHeight);
        bg.addColorStop(0, "#081826");
        bg.addColorStop(1, "#02070d");
        g.fillStyle = bg;
        g.fillRect(0, 0, mapWidth, mapHeight);
        const path = worldState.cellPath;
        if (path && path.current) {
          const pad = 8;
          const cellW = (mapWidth - pad * 2) / Math.max(1, path.nx);
          const cellH = (mapHeight - 16) / Math.max(1, path.nz);
          const layer = path.current.y;
          for (let z = 0; z < path.nz; z += 1) {
            for (let x = 0; x < path.nx; x += 1) {
              const node = path.nodes.get(path.keyOf(x, layer, z));
              if (!node) continue;
              const px = pad + x * cellW;
              const py = 8 + z * cellH;
              const linked = node.open.xp || node.open.xn || node.open.zp || node.open.zn || node.open.yp || node.open.yn;
              const anomalyFill = {
                drift: "#2a2047",
                flux: "#123d4a",
                dense: "#362247"
              }[node.astralMode] || "#2a1844";
              g.fillStyle = node.large ? "#4a3b14" : node.astral ? anomalyFill : (linked ? "#143246" : "#0c1a24");
              g.fillRect(px + 1, py + 1, Math.max(1, cellW - 2), Math.max(1, cellH - 2));
              if (node.astral) {
                const glyph = ({ drift: "≈", flux: "↕", dense: "◆" }[node.astralMode]) || "·";
                g.fillStyle = "#dfe5ff";
                g.font = "bold 9px system-ui";
                g.textAlign = "center";
                g.textBaseline = "middle";
                g.fillText(glyph, px + cellW * 0.5, py + cellH * 0.5);
              }
              if (node === path.current) {
                g.strokeStyle = "#f4fbff";
                g.strokeRect(px + 0.5, py + 0.5, Math.max(1, cellW - 1), Math.max(1, cellH - 1));
              }
              const mark = (maze.crystals || []).find((crystal) =>
                crystal.cell && crystal.cell.x === x && crystal.cell.y === layer && crystal.cell.z === z &&
                (crystal.scouted || crystal.taken));
              if (mark) {
                g.fillStyle = mark.taken ? "#8ef6d8" : "#5ce1ff";
                g.fillRect(px + cellW * 0.32, py + cellH * 0.32, Math.max(2, cellW * 0.34), Math.max(2, cellH * 0.34));
              }
              const mission = window.BCMWorldMission || {};
              const hydrogen = maze.hydrogen;
              if (hydrogen && hydrogen.unlocked && !mission.hydrogenCollected &&
                  hydrogen.cell.x === x && hydrogen.cell.y === layer && hydrogen.cell.z === z) {
                g.fillStyle = "#9cffe9";
                g.font = "bold 10px system-ui";
                g.textAlign = "center";
                g.textBaseline = "middle";
                g.fillText("H", px + cellW * 0.5, py + cellH * 0.5);
              }
            }
          }
          return;
        }
        const x1 = 9, x2 = mapWidth - 9, y = Math.max(20, mapHeight * 0.52);
        const trackW = Math.max(1, x2 - x1);
        const zones = [
          { a: -50, b: -2, c: "#194359" },
          { a: -2, b: 36, c: "#1f4c4a" },
          { a: 36, b: 84, c: "#3c2852" }
        ];
        zones.forEach((zone) => {
          const left = x1 + (zone.a + 50) / 134 * trackW;
          const right = x1 + (zone.b + 50) / 134 * trackW;
          g.fillStyle = zone.c;
          g.fillRect(left, y - 5, right - left, 10);
          g.strokeStyle = "rgba(191,226,239,.26)";
          g.strokeRect(left, y - 5, right - left, 10);
        });
        worldState.bosses.forEach((boss, index) => {
          const x = x1 + (boss.x + 50) / 134 * trackW;
          g.fillStyle = boss.alive ? "#ffba75" : "#67e6cf";
          g.beginPath();
          g.arc(x, y, boss.alive ? 4.3 : 3.2, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = "#d1e7ef";
          g.font = "9px system-ui";
          g.textAlign = "center";
          g.fillText(String(index + 1), x, y - 10);
        });
        players.forEach((player) => {
          const x = x1 + (player.worldX + 50) / 134 * trackW;
          g.fillStyle = playerColors[player.index];
          g.shadowColor = playerColors[player.index];
          g.shadowBlur = 6;
          g.beginPath();
          g.arc(x, y + (player.index ? 4 : -4), 3, 0, Math.PI * 2);
          g.fill();
          g.shadowBlur = 0;
        });
        g.fillStyle = "#b8d2de";
        g.font = "9px system-ui";
        g.textAlign = "left";
        g.textBaseline = "top";
        // Progress is shown by the strip and markers; avoid tiny permanent caption text.
      }

      function startMode(nextMode) {
        if (done || gameStarted) return;
        mode = nextMode === "multi" ? "multi" : "single";
        gameStarted = true;
        menu.hidden = true;
        menu.style.display = "none";
        const home = worldState.cellPath
          ? enterRingCell(worldState, worldState.cellPath.current, null)
          : worldState.spawnX;
        const spawn1 = { x: home, y: 0 };
        const spawn2 = mode === "multi" ? { x: home - 1.4, y: 0 } : null;
        players = [createPlayer(0, spawn1)];
        if (spawn2) players.push(createPlayer(1, spawn2));
        updateSplitState();
        updateHud(mode === "multi" ? "MULTI" : "SINGLE");
        statusEl.style.display = "";
        floorEl.style.display = "";
        countEl.style.display = "none";
        window.BCMDialogue?.showControls("ring");
        if (Number(weaponProgress.completedRuns) >= Number(weaponProgress.nextUpgradeAt || 2) &&
            weaponProgress.pendingUpgrade &&
            Number(weaponProgress.lastUpgradePromptRun) !== Number(weaponProgress.completedRuns)) {
          window.setTimeout(() => offerWeaponChoice(true), 250);
        }
        resize2d();
        root2d.focus({ preventScroll: true });
      }

      function updateViewportSize() {
        width = Math.max(1, root.clientWidth);
        height = Math.max(1, root.clientHeight);
        cameraOne.aspect = width / height;
        cameraTwo.aspect = width / height;
        updateSplitState();
      }

      function frame(now) {
        if (done) return;
        try {
          const dt = frameStamp ? Math.min(0.05, Math.max(0.001, (now - frameStamp) / 1000)) : 1 / 60;
          frameStamp = now;
          updatePlayers(dt);
          updateWeaponShots(dt);
          if (!done) {
            updateSplitState();
            drawMiniMap();
          }
        } catch (error) {
          try { console.error("Mini-Sim Ring maze frame failed:", error); } catch (e) {}
        }
        if (!done) raf = requestAnimationFrame(frame);
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
      focusModeMenu(0);
      modeButtons.forEach((button, index) => {
        if (!button) return;
        button.style.pointerEvents = "auto";
        button.style.position = "relative";
        button.style.zIndex = "50";
        button.style.cursor = "pointer";
        const activate = () => {
          focusModeMenu(index);
          startMode(index === 1 ? "multi" : "single");
        };
        // pointerdown gives mobile taps an immediate activation path; the click
        // handler remains for keyboard and assistive-technology activation.
        button.addEventListener("pointerdown", (event) => {
          if (event.button !== 0 || gameStarted || done) return;
          event.preventDefault();
          event.stopPropagation();
          activate();
        });
        button.addEventListener("focus", () => focusModeMenu(index));
        button.addEventListener("click", activate);
      });
      root2d.addEventListener("keydown", (event) => {
        if (gameStarted || done) return;
        if (event.code === "ArrowLeft" || event.code === "ArrowUp") {
          event.preventDefault();
          event.stopPropagation();
          focusModeMenu(menuFocusIndex - 1);
        } else if (event.code === "ArrowRight" || event.code === "ArrowDown") {
          event.preventDefault();
          event.stopPropagation();
          focusModeMenu(menuFocusIndex + 1);
        } else if (event.code === "Enter" || event.code === "Space") {
          event.preventDefault();
          event.stopPropagation();
          confirmModeMenu();
        }
      });
      menu.addEventListener("pointerdown", (event) => {
        if (gameStarted || done || event.target.closest("button")) return;
        if (event.target === menu || event.target.closest("[data-ring-mode-menu]")) {
          event.preventDefault();
          confirmModeMenu();
        }
      });
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
        try {
          const gl = runtime.renderer;
          const canvasEl = gl && gl.domElement;
          if (gl && canvasEl) {
            gl.setScissorTest(false);
            gl.setViewport(0, 0, Math.max(1, canvasEl.clientWidth), Math.max(1, canvasEl.clientHeight));
            gl.autoClear = true;
          }
        } catch (e) {}
        window.removeEventListener("keydown", keyboardMove, true);
        window.removeEventListener("keyup", keyboardMove, true);
        window.removeEventListener("resize", resize2d);
        if (worldState.cellPath && worldState.cellPath.room) worldState.cellPath.room.parent?.remove(worldState.cellPath.room);
        worldState.group.parent?.remove(worldState.group);
        worldState.group.traverse((object) => {
          if (object.geometry && object.geometry !== worldState.boxGeometry) {
            // Meshes share a small set of geometries; special crystal geometries are disposed below.
          }
        });
        try { worldState.boxGeometry.dispose(); } catch (e) {}
        worldState.specialGeometry.forEach((geometry) => { try { geometry.dispose(); } catch (e) {} });
        worldState.textures.forEach((texture) => { try { texture.dispose(); } catch (e) {} });
        worldState.materials.forEach((material) => { try { material.dispose(); } catch (e) {} });
        players.forEach((player) => {
          if (player.sprite) scene.remove(player.sprite);
          if (player.spriteMaterial) player.spriteMaterial.dispose();
        });
        weaponShots.forEach((shot) => {
          scene.remove(shot.mesh);
          scene.remove(shot.glow);
          try { shot.geometry.dispose(); } catch (e) {}
          try { shot.material.dispose(); } catch (e) {}
          try { shot.glowGeometry.dispose(); } catch (e) {}
          try { shot.glowMaterial.dispose(); } catch (e) {}
        });
        weaponShots.length = 0;
        maze.group.visible = worldSaved.oldMazeVisible;
        if (runtime.ship.visual) runtime.ship.visual.visible = worldSaved.oldShipVisible;
        scene.background = oldBackground;
        state.ringRenderState = null;
        window.BCMDeepSpaceWarpRender = null;
        splitDivider.remove();
        root2d.remove();
        syncHullButtonVisibility();
      };
      // Commit the scene switch only after the Ring world, input bindings,
      // renderer, and cleanup routine are ready. Failures before this point
      // leave the asteroid visible; later failures are safely rolled back above.
      maze.group.visible = false;
      if (runtime.ship.visual) runtime.ship.visual.visible = false;
      scene.background = new THREE.Color(0x030812);
      state.ringLastUpdate = 0;
      syncHullButtonVisibility();
      raf = requestAnimationFrame(frame);
      return true;
    }

    function finishRingPlatformer(maze, completed) {
      if (!state.ringPlatformer || !maze) return false;
      const success = completed === true;
      maze.ringCompleted = success;
      if (success) {
        const progress = window.BCMRingWeaponProgress || (window.BCMRingWeaponProgress = {
          type: "pointer", tier: 1, completedRuns: 0, pendingUpgrade: false, lastUpgradePromptRun: -1
        });
        progress.completedRuns = (Number(progress.completedRuns) || 0) + 1;
        progress.nextUpgradeAt = Math.max(2, Number(progress.nextUpgradeAt) || 2);
        if (progress.completedRuns >= progress.nextUpgradeAt && Number(progress.tier) < 5) progress.pendingUpgrade = true;
      }
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
      const placeLabel = state.place && state.place.id === "asteroid" && state.place.label
        ? state.place.label
        : asteroidPlace(state.target).label;
      if (engine && engine.setExternalHUD) engine.setExternalHUD(placeLabel, message);
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
      for (const material of new Set([...(maze.materials || [maze.material]), ...(maze.wallVariantMaterials || [])])) {
        try { material?.dispose?.(); } catch (e) {}
      }
      for (const texture of new Set([...(maze.textures || [maze.texture]), ...(maze.wallVariantTextures || [])])) {
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

    function nextWarpDestinationLabel() {
      let language = "ru";
      try {
        const saved = window.localStorage.getItem("bcm-mini-sim-language");
        if (saved === "ru" || saved === "en") language = saved;
      } catch (e) {}
      const coarse = !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
      const touch = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
      const narrow = Math.min(window.innerWidth || 0, window.innerHeight || 0) < 900;
      const phone = coarse || (touch && narrow);
      return language === "en"
        ? (phone ? "WARP" : "NEXT WARP DESTINATION · V")
        : (phone ? "WARP" : "СЛЕДУЮЩИЙ ПЕРЕХОД · V");
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
        state.returnQuaternion = runtime.ship.quaternion.clone();
      }

      // Keep the asteroid in the scene. Cancelling the map returns to this
      // same locale and these coordinates; disposing here made cancel look like Room 1.
      const arrivedSector = state.target || (state.nav && state.nav.current);
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
        // Keep the live ship pose where it is: this is the next-destination handoff,
        // not a reset to the pre-Warp launch point.
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
      // Start at 1x, ramp sooner than the old 8x curve, and reach 12x at arrival.
      const t = Math.pow(warpNormalizedTime(elapsed), 0.60);
      return Math.pow(12, t);
    }

    function warpCourseProgress(elapsed) {
      // Visible hazard positions and collision timing share this accelerated 1x..12x curve.
      return (warpSpeedMultiplier(elapsed) - 1) / 11;
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

    // Спрайты астероидов: испечены из настоящих GLB
    // mini-sim/assets/mesh/asteroid_variety (large/medium/small).
    // Печём заранее, потому что слой варпа — Canvas 2D и второй
    // WebGL-контекст на слабом Android не нужен.
    window.BCM_WARP_ASTEROID_ART = window.BCM_WARP_ASTEROID_ART || {};
    Object.assign(window.BCM_WARP_ASTEROID_ART, {
      "small_01": "data:image/png;base64,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",
      "small_02": "data:image/png;base64,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",
      "medium_01": "data:image/png;base64,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",
      "medium_02": "data:image/png;base64,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",
      "large_01": "data:image/png;base64,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",
      "large_02": "data:image/png;base64,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"
    });


    // ---------------------------------------------------------------------
    // WARP SPACE — декоративный слой Canvas 2D (фон космоса, кольца, ленты,
    // пульс). Ничего не читает и не меняет в курсе, столкновениях, скорости,
    // щитах, тайминге, управлении и звуке. Удаление блока = только пиксели.
    // ---------------------------------------------------------------------
    const warpSpace = (() => {
  /* ---------------------------------------------------------------- profiles
   * Five looks, five sets of numbers, one drawing path. `rings: 0` reproduces
   * the accepted 0.14.0 look exactly, so Class I is never forced to change.
   */
  /* Порядок = порядок в меню. «Ленты» стоят первыми и включены по умолчанию:
   * это выбор владельца, поэтому первый пункт списка и стартовый вид — одно и то же. */
  var WARP_SPACE_PROFILES = [
    { id: "ribbon",  label: "Ленты",   spokes: 12, rings: 5,  ringAlpha: 0.20, ringStep: 2, ribbon: true,  pulse: false, nebula: 0.70, planets: 2 },
    { id: "grid",    label: "Сетка",   spokes: 12, rings: 0,  ringAlpha: 0.00, ringStep: 0, ribbon: false, pulse: false, nebula: 0.55, planets: 1 },
    { id: "lattice", label: "Решётка", spokes: 12, rings: 7,  ringAlpha: 0.30, ringStep: 1, ribbon: false, pulse: false, nebula: 0.55, planets: 2 },
    { id: "dense",   label: "Плотная", spokes: 24, rings: 21, ringAlpha: 0.13, ringStep: 1, ribbon: false, pulse: false, nebula: 0.45, planets: 1 },
    { id: "pulse",   label: "Пульс",   spokes: 12, rings: 9,  ringAlpha: 0.26, ringStep: 1, ribbon: false, pulse: true,  nebula: 0.55, planets: 1, seedShift: 1, reverseMotion: true }
  ];

  var WARP_SPACE_PROFILE_INDEX = (function () {
    var map = {};
    for (var i = 0; i < WARP_SPACE_PROFILES.length; i += 1) map[WARP_SPACE_PROFILES[i].id] = i;
    return map;
  })();

  /* Which look a live Warp run gets.
   * Only visual classes I..III are live: `activeWarpVisualClass()` clamps to
   * [1,2,3] and the Class IV button ships disabled. So the variation axis is
   * "which of the five looks inside this class", seeded by the run seed that
   * the course already derives — not a new menu and not a fourth axis.
   */
  function warpSpaceProfileFor(visualClass, seed) {
    var cls = Math.max(1, Math.min(3, Number(visualClass) || 1));
    // Пулы заданы идентификаторами, а не номерами: перестановка пунктов меню
    // («Ленты» первыми) не должна менять то, какой вид выпадает заезду.
    var idx = WARP_SPACE_PROFILE_INDEX;
    var pool = cls === 1 ? ["grid", "lattice"]
      : cls === 2 ? ["lattice", "dense", "ribbon"]
        : ["dense", "ribbon", "pulse"];
    var roll = (Number(seed) >>> 0) % pool.length;
    return WARP_SPACE_PROFILES[idx[pool[roll]]];
  }

  /* ------------------------------------------------------------------ seeds */
  function makeRandom(seed, hashSeed) {
    if (typeof hashSeed === "function") return null; // caller's RNG wins
    var value = (Number(seed) >>> 0) || 1;
    return function () {
      value += 0x6D2B79F5;
      var t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* -------------------------------------------------------------- cache size
   * The backdrop is painted once into an offscreen canvas and then blitted.
   * Repainting gradients and 140 stars every frame is what kills a weak
   * Android, not the blit. Scale is capped so the cache stays ~0.5 MB at 800px.
   */
  function warpSpaceQuality(w, h) {
    var px = Math.max(1, w) * Math.max(1, h);
    if (px > 1100000) return 0.34;
    if (px > 620000) return 0.45;
    return 0.55;
  }

  /* --------------------------------------------------------- backdrop painter
   * Deterministic: same seed + same size => identical pixels. Draws, in order:
   * deep gradient, galaxy band, nebula blobs, far/mid/near star layers,
   * one or two planets with a terminator and an optional thin ring.
   */
  function paintSpaceBackdrop(g, w, h, seed, profile, hashSeed) {
    var rnd = makeRandom(seed, null);
    var neb = profile && profile.nebula != null ? profile.nebula : 0.55;
    var planets = profile && profile.planets != null ? profile.planets : 1;

    var deep = g.createLinearGradient(0, 0, w * 0.35, h);
    deep.addColorStop(0, "#01030a");
    deep.addColorStop(0.45, "#050b1c");
    deep.addColorStop(1, "#01020a");
    g.fillStyle = deep;
    g.fillRect(0, 0, w, h);

    /* galaxy band: a soft diagonal wash with dust dashes */
    g.save();
    g.translate(w * 0.5, h * 0.5);
    g.rotate(-0.42);
    var band = g.createLinearGradient(0, -h * 0.34, 0, h * 0.34);
    band.addColorStop(0, "rgba(24,52,120,0)");
    band.addColorStop(0.34, "rgba(66,104,190," + (0.16 * neb) + ")");
    band.addColorStop(0.5, "rgba(150,196,255," + (0.22 * neb) + ")");
    band.addColorStop(0.66, "rgba(78,92,190," + (0.16 * neb) + ")");
    band.addColorStop(1, "rgba(24,52,120,0)");
    g.fillStyle = band;
    g.fillRect(-w, -h * 0.34, w * 2, h * 0.68);
    for (var dash = 0; dash < 90; dash += 1) {
      var dx = (rnd() - 0.5) * w * 1.9;
      var dy = (rnd() - 0.5) * h * 0.40;
      var dl = 6 + rnd() * 46;
      g.fillStyle = "rgba(198,222,255," + (0.05 + rnd() * 0.16) + ")";
      g.fillRect(dx, dy, dl, 1);
    }
    g.restore();

    /* nebula blobs */
    var tint = [[64, 140, 255], [150, 84, 220], [64, 208, 220], [230, 140, 190]];
    for (var n = 0; n < 4; n += 1) {
      var bx = (0.12 + rnd() * 0.76) * w;
      var by = (0.12 + rnd() * 0.76) * h;
      var br = (0.16 + rnd() * 0.30) * Math.min(w, h);
      var c = tint[n % tint.length];
      var blob = g.createRadialGradient(bx, by, 0, bx, by, br);
      blob.addColorStop(0, "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + (0.20 * neb) + ")");
      blob.addColorStop(0.55, "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + (0.07 * neb) + ")");
      blob.addColorStop(1, "rgba(" + c[0] + "," + c[1] + "," + c[2] + ",0)");
      g.fillStyle = blob;
      g.beginPath();
      g.arc(bx, by, br, 0, Math.PI * 2);
      g.fill();
    }

    /* stars: three depth layers, one flat rect per star (no arcs: cheaper) */
    var layers = [
      { count: 150, size: 1, alpha: 0.36 },
      { count: 70, size: 1.6, alpha: 0.62 },
      { count: 22, size: 2.4, alpha: 0.92 }
    ];
    layers.forEach(function (layer) {
      for (var i = 0; i < layer.count; i += 1) {
        var sx = rnd() * w;
        var sy = rnd() * h;
        g.fillStyle = "rgba(226,240,255," + (layer.alpha * (0.55 + rnd() * 0.45)).toFixed(3) + ")";
        g.fillRect(sx, sy, layer.size, layer.size);
      }
    });

    /* planets */
    var palette = [
      ["#5b8ec9", "#11213c"],
      ["#c98a5b", "#2a1508"],
      ["#7bc9a6", "#0d2a24"]
    ];
    for (var p = 0; p < planets; p += 1) {
      var px2 = (0.10 + rnd() * 0.80) * w;
      var py2 = (0.10 + rnd() * 0.80) * h;
      var pr = (0.045 + rnd() * 0.075) * Math.min(w, h);
      var pal = palette[Math.floor(rnd() * palette.length)];
      var pl = g.createRadialGradient(px2 - pr * 0.32, py2 - pr * 0.34, pr * 0.1, px2, py2, pr);
      pl.addColorStop(0, pal[0]);
      pl.addColorStop(0.72, pal[1]);
      pl.addColorStop(1, "#02040b");
      g.fillStyle = pl;
      g.beginPath();
      g.arc(px2, py2, pr, 0, Math.PI * 2);
      g.fill();
      if (rnd() > 0.55) {
        g.strokeStyle = "rgba(190,224,255,0.22)";
        g.lineWidth = Math.max(1, pr * 0.10);
        g.beginPath();
        g.ellipse(px2, py2, pr * 1.7, pr * 0.42, -0.35, 0, Math.PI * 2);
        g.stroke();
      }
    }
    return g;
  }

  /* Build (or reuse) the offscreen cache. Returns { canvas, w, h, scale }. */
  function createSpaceBackdropCache(w, h, seed, profile, makeCanvas, hashSeed) {
    var scale = warpSpaceQuality(w, h);
    var cw = Math.max(2, Math.round(w * scale));
    var ch = Math.max(2, Math.round(h * scale));
    var canvas = makeCanvas(cw, ch);
    var g = canvas.getContext("2d");
    paintSpaceBackdrop(g, cw, ch, seed, profile, hashSeed);
    return { canvas: canvas, w: cw, h: ch, scale: scale, seed: seed, id: profile && profile.id };
  }

  /* One blit + a slow sine drift. Sine, not modulo: a wrapped nebula would
   * jump at the seam, a bounded sine never does. */
  function drawSpaceBackdrop(g, cache, w, h, t) {
    if (!cache || !cache.canvas) return;
    var drift = Math.sin(t * 0.045) * w * 0.008;
    var rise = Math.cos(t * 0.031) * h * 0.006;
    g.drawImage(cache.canvas, drift - w * 0.004, rise - h * 0.003, w * 1.008, h * 1.008);
  }

  /* --------------------------------------------------------------- palettes
   * Two colour sets per visual class: A is the approved 0.14.0 look, B is the
   * "перевёрнутая" variant. Between them is a continuous parameter `mix`.
   *
   * Hard requirement: at mix = 0 the produced strings are byte-identical to
   * what 0.14.0 draws, INCLUDING the moving light pattern. The wall animation
   * lives in `shimmer` and `light`, so both sets carry the same modulation
   * terms and the modulation is added AFTER blending — that keeps the panels
   * moving exactly as approved at every point of the transition.
   */
  var WARP_SPACE_PALETTES = {
    /* Classes I and II share the same wall formula in 0.14.0. */
    1: {
      a: {
        fillBase: [8, 20, 31], fillShim: [8, 18, 22], fillLight: [2, 12, 18],
        seamThick: [110, 239, 246], seamThickA: 0.72,
        seamThin: [110, 191, 210], seamThinA: 0.25,
        accent: [190, 255, 255], accentA: 1,
        ring: [122, 232, 255]
      },
      b: {
        fillBase: [86, 196, 214], fillShim: [8, 18, 22], fillLight: [2, 12, 18],
        seamThick: [235, 252, 255], seamThickA: 0.72,
        seamThin: [214, 240, 250], seamThinA: 0.25,
        accent: [255, 255, 255], accentA: 1,
        ring: [240, 252, 255]
      }
    },
    /* Второй режим носит ФИОЛЕТОВЫЕ настройки третьего — прямое указание
     * владельца («сделай ему фиолетовые настройки третьего»). Значения взяты
     * один в один из набора класса III, поэтому «второй» и «третий» отличаются
     * не цветом, а ходом коридора: класс II разворачивает видимое движение.
     * Исключение из правила «mix 0 = 0.14.0 бит в бит» — только для класса II;
     * класс I остаётся эталоном, по нему и сверяется совместимость. */
    2: {
      a: {
        fillBase: [17, 12, 34], fillShim: [12, 8, 28], fillLight: [3, 5, 12],
        seamThick: [189, 139, 246], seamThickA: 0.86,
        seamThin: [131, 96, 184], seamThinA: 0.36,
        accent: [230, 205, 255], accentA: 1,
        ring: [189, 139, 246]
      },
      b: {
        fillBase: [124, 86, 186], fillShim: [12, 8, 28], fillLight: [3, 5, 12],
        seamThick: [244, 232, 255], seamThickA: 0.86,
        seamThin: [222, 206, 250], seamThinA: 0.36,
        accent: [255, 248, 255], accentA: 1,
        ring: [244, 232, 255]
      }
    },
    3: {
      a: {
        fillBase: [17, 12, 34], fillShim: [12, 8, 28], fillLight: [3, 5, 12],
        seamThick: [189, 139, 246], seamThickA: 0.86,
        seamThin: [131, 96, 184], seamThinA: 0.36,
        accent: [230, 205, 255], accentA: 1,
        ring: [189, 139, 246]
      },
      b: {
        fillBase: [124, 86, 186], fillShim: [12, 8, 28], fillLight: [3, 5, 12],
        seamThick: [244, 232, 255], seamThickA: 0.86,
        seamThin: [222, 206, 250], seamThinA: 0.36,
        accent: [255, 248, 255], accentA: 1,
        ring: [244, 232, 255]
      }
    }
  };

  /* B inverts the WALL, not the lines. Inverting both cannot be animated
   * continuously: a line that starts brighter than the wall and ends darker
   * must equal the wall colour at some instant and would vanish there. */

  /* Положительный остаток.
   * Под «Пульсом» стенка идёт назад, поэтому `t` отрицательное, а `% 1` в JS
   * сохраняет знак: получались отрицательные фазы, отрицательные радиусы и
   * `ctx.arc()` с ними — в браузере это IndexSizeError и мёртвый кадр.
   * Именно это и было «пульс сломан». Теперь фаза всегда 0..1. */
  function wrap01(v) {
    var n = Number(v);
    if (!isFinite(n)) return 0;
    var m = n % 1;
    return m < 0 ? m + 1 : m;
  }

  function clampUnit(v) {
    var n = Number(v);
    if (!isFinite(n)) return 0;
    return n < 0 ? 0 : n > 1 ? 1 : n;
  }

  function lerpChannel(a, b, k) {
    return a + (b - a) * k;
  }

  function mixRgb(from, to, k) {
    return [
      Math.round(lerpChannel(from[0], to[0], k)),
      Math.round(lerpChannel(from[1], to[1], k)),
      Math.round(lerpChannel(from[2], to[2], k))
    ];
  }

  /* Rec. 709 luminance, 0..255 */
  function relativeLuminance(rgb) {
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  }

  /* ------------------------------------------------------- радужный перелив
   * «Зачем ограничиваться одним цветом» — незачем. Технология перелива та же,
   * что уже работает (непрерывный ping-pong + волна по поверхности), но
   * отображается она не в отрезок A->B, а в цветовой круг.
   *
   * Как это читается на стенке: панель берёт свой оттенок из hue-круга, сдвиг
   * вдоль поверхности (`spread`) даёт диагональные полосы, а общий mix гонит
   * всю радугу по кругу за период перелива. Получается то же «переливание»,
   * что на Rainbow Photoli: цвет течёт по поверхности, а не переключается.
   *
   * Порядок цветов — натуральный спектральный (красный -> жёлтый -> зелёный ->
   * голубой -> синий -> фиолетовый), а не два конца. Числа подобраны так, чтобы
   * стенка оставалась тёмной (иначе она перестаёт читаться как коридор), а шов
   * и акцент — светлыми: контраст «линия ярче стенки» обязан сохраняться.
   */
  var WARP_SPACE_RAINBOW = {
    // Классы различаются насыщенностью и стартовой точкой круга, а не одним цветом.
    1: { hue: 0.50, sat: 0.78, spread: 0.55, wallL: 0.115, seamL: 0.66, accentL: 0.90 },
    2: { hue: 0.74, sat: 0.74, spread: 0.62, wallL: 0.125, seamL: 0.66, accentL: 0.90 },
    3: { hue: 0.90, sat: 0.80, spread: 0.48, wallL: 0.130, seamL: 0.68, accentL: 0.92 }
  };

  function rainbowPhaseIsSet(value) {
    return value != null && isFinite(Number(value));
  }

  function normalizeHue(h) {
    var v = Number(h);
    if (!isFinite(v)) return 0;
    v = v % 1;
    return v < 0 ? v + 1 : v;
  }

  /* HSL -> RGB. Без зависимостей и без hsla-строк: цвет нужен массивом,
   * потому что к нему ещё прибавляется модуляция огоньков. */
  function hslToRgb(h, s, l) {
    var hue = normalizeHue(h);
    var sat = clampUnit(s);
    var light = clampUnit(l);
    var a = sat * Math.min(light, 1 - light);
    function channel(n) {
      var k = (n + hue * 12) % 12;
      var v = light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
      return Math.round(v * 255);
    }
    return [channel(0), channel(8), channel(4)];
  }

  /* Полный набор цветов на заданной фазе. `shade` — сдвиг оттенка внутри
   * набора, чтобы шов не сливался со стенкой в один тон. */
  function warpSpaceRainbowPalette(visualClass, mix, rainbowPhase) {
    var cls = Math.max(1, Math.min(3, Number(visualClass) || 1));
    var cfg = WARP_SPACE_RAINBOW[cls];
    var phase = Number(rainbowPhase);
    if (!isFinite(phase)) phase = 0;
    var hue = normalizeHue(cfg.hue + clampUnit(mix) + phase * cfg.spread);
    var sat = cfg.sat;
    return {
      fill: hslToRgb(hue, sat * 0.92, cfg.wallL),
      seamThick: hslToRgb(hue + 0.035, sat, cfg.seamL),
      seamThin: hslToRgb(hue - 0.035, sat * 0.82, Math.max(0.16, cfg.seamL - 0.34)),
      accent: hslToRgb(hue + 0.09, Math.min(1, sat + 0.12), cfg.accentL),
      ring: hslToRgb(hue + 0.02, sat * 0.9, cfg.seamL - 0.08),
      hue: hue
    };
  }

  function paletteSet(visualClass) {
    var cls = Math.max(1, Math.min(3, Number(visualClass) || 1));
    return WARP_SPACE_PALETTES[cls];
  }

  /* Wall panel colour.
   * `shimmer` and `light` are the 0.14.0 animation inputs (0..1 each), passed
   * through untouched, so the moving light cells and the continuous shimmer
   * keep their approved tempo and phase at every mix value.
   *
   * Пятый аргумент — фаза радуги. Если она задана, базовый цвет берётся из
   * цветового круга (см. WARP_SPACE_RAINBOW), а модуляция shimmer/light
   * остаётся прежней: огоньки на стенке продолжают ходить с тем же темпом. */
  function warpSpacePanelRgb(visualClass, shimmer, light, mix, rainbowPhase) {
    var set = paletteSet(visualClass);
    var k = clampUnit(mix);
    var sh = isFinite(shimmer) ? shimmer : 0;
    var li = isFinite(light) ? light : 0;
    var out = [0, 0, 0];
    if (rainbowPhaseIsSet(rainbowPhase)) {
      // Радуга модулируется по СВЕТЛОТЕ того же оттенка, а не прибавкой
      // фиксированных RGB: иначе огоньки уводили бы красную стенку в бирюзу.
      // Огоньки от этого не исчезают — они идут как более светлые пятна
      // своего же оттенка, с прежним темпом shimmer/light.
      var cfg = WARP_SPACE_RAINBOW[Math.max(1, Math.min(3, Number(visualClass) || 1))];
      var pal = warpSpaceRainbowPalette(visualClass, k, rainbowPhase);
      var lit = cfg.wallL + sh * 0.042 + li * 0.055;
      return hslToRgb(pal.hue, Math.min(1, cfg.sat * (0.90 + sh * 0.10 + li * 0.05)),
        lit > 0.34 ? 0.34 : lit);
    }
    var base = warpSpacePaletteAt(visualClass, k).fill;
    for (var i = 0; i < 3; i += 1) {
      var value = base[i] + sh * set.a.fillShim[i] + li * set.a.fillLight[i];
      var v = Math.round(value);
      out[i] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
    return out;
  }

  function warpSpacePanelCss(visualClass, shimmer, light, mix, rainbowPhase) {
    return "rgba(" + rgbCss(warpSpacePanelRgb(visualClass, shimmer, light, mix, rainbowPhase)) + ",0.98)";
  }

  function warpSpaceSeamRgb(visualClass, kind, mix) {
    var set = paletteSet(visualClass);
    var k = clampUnit(mix);
    var key = kind === "thin" ? "seamThin" : "seamThick";
    return mixRgb(set.a[key], set.b[key], k);
  }

  function warpSpaceSeamCss(visualClass, kind, mix, rainbowPhase) {
    var set = paletteSet(visualClass);
    var alpha = kind === "thin" ? set.a.seamThinA : set.a.seamThickA;
    if (rainbowPhaseIsSet(rainbowPhase)) {
      var pal = warpSpaceRainbowPalette(visualClass, clampUnit(mix), rainbowPhase);
      return rgbaCss(kind === "thin" ? pal.seamThin : pal.seamThick, alpha);
    }
    return rgbaCss(warpSpaceSeamRgb(visualClass, kind, mix), alpha);
  }

  function warpSpaceAccentCss(visualClass, mix, rainbowPhase) {
    var set = paletteSet(visualClass);
    if (rainbowPhaseIsSet(rainbowPhase)) {
      return rgbaCss(warpSpaceRainbowPalette(visualClass, clampUnit(mix), rainbowPhase).accent, set.a.accentA);
    }
    return rgbaCss(mixRgb(set.a.accent, set.b.accent, clampUnit(mix)), set.a.accentA);
  }

  function warpSpaceRingRgb(visualClass, mix, rainbowPhase) {
    var set = paletteSet(visualClass);
    if (rainbowPhaseIsSet(rainbowPhase)) {
      return warpSpaceRainbowPalette(visualClass, clampUnit(mix), rainbowPhase).ring;
    }
    return mixRgb(set.a.ring, set.b.ring, clampUnit(mix));
  }

  /* Blended base colours without modulation, for rings and for tests.
   * Если задана фаза радуги — возвращается цвет с цветового круга: радужный
   * перелив вместо перехода между двумя наборами. */
  function warpSpacePaletteAt(visualClass, mix, rainbowPhase) {
    if (rainbowPhaseIsSet(rainbowPhase)) {
      return warpSpaceRainbowPalette(visualClass, clampUnit(mix), rainbowPhase);
    }
    var set = paletteSet(visualClass);
    var k = clampUnit(mix);
    return {
      fill: mixRgb(set.a.fillBase, set.b.fillBase, k),
      seamThick: warpSpaceSeamRgb(visualClass, "thick", k),
      seamThin: warpSpaceSeamRgb(visualClass, "thin", k),
      accent: mixRgb(set.a.accent, set.b.accent, k),
      ring: warpSpaceRingRgb(visualClass, k)
    };
  }

  /* Spatial wave: at a given point of the surface the local mix runs ahead of
   * the global one, so the colour change travels along the tunnel instead of
   * fading everywhere at the same instant. */
  function warpSpaceFlowMix(mix, spatialPhase, t, amplitude) {
    var amp = amplitude == null ? 0.20 : amplitude;
    var wave = Math.sin((spatialPhase || 0) * Math.PI * 2 - (t || 0) * 0.9);
    return clampUnit(clampUnit(mix) + wave * amp * 0.5);
  }

  /* Ease for the transition itself: soft start and stop. */
  function warpSpaceEase(k) {
    var v = clampUnit(k);
    return v * v * (3 - 2 * v);
  }

  /* Ping-pong 0..1..0 so an unattended flow breathes between A and B. */
  function warpSpacePingPong(t, period) {
    var p = period && period > 0 ? period : 9;
    return 0.5 - 0.5 * Math.cos(((t || 0) / p) * Math.PI * 2);
  }

  function rgbCss(rgb) {
    return Math.round(rgb[0]) + "," + Math.round(rgb[1]) + "," + Math.round(rgb[2]);
  }

  function rgbaCss(rgb, alpha) {
    var a = alpha == null ? 1 : alpha;
    return "rgba(" + rgbCss(rgb) + "," + a + ")";
  }

  /* Под «Пульсом» космос другой и стенка идёт в обратную сторону.
   * Направление берётся как XOR с классовым: класс II в 0.14.0 уже разворачивает
   * видимый ход коридора, а профиль с reverseMotion разворачивает его ещё раз,
   * поэтому «два разворота» дают нормальный ход, а не двойное отрицание вслепую. */
  function warpSpaceSeedFor(seed, profile) {
    var base = Number(seed) >>> 0;
    if (!profile || !profile.seedShift) return base;
    return (base + Math.imul(profile.seedShift, 0x9E3779B1)) >>> 0;
  }

  function warpSpaceDirectionFor(visualClass, profile) {
    var reversedByClass = (Number(visualClass) || 1) === 2;
    var reversedByProfile = !!(profile && profile.reverseMotion);
    return reversedByClass !== reversedByProfile ? -1 : 1;
  }

  /* Тир качества.
   *
   * Две поправки после наблюдения в браузере:
   *  1. Панели НЕ урезаются. Уменьшение panelCount с 18 до 13 превращало
   *     круглое сечение в гранёную «бочку» — это читалось как баг, а не как
   *     экономия. Режем только глубину и сэмплы, силуэт остаётся прежним.
   *  2. Решение принимается по устойчивому замеру: одиночный медленный кадр
   *     (переключение вкладки, первый кадр после кэша) не должен понижать
   *     качество. Нужно не меньше 45 подряд медленных кадров подряд.
   */
  function warpSpaceTier(avgFrameMs, slowStreak) {
    var ms = Number(avgFrameMs);
    if (!isFinite(ms) || ms <= 0) return "high";
    var streak = Number(slowStreak) || 0;
    if (ms > 26 && streak >= 45) return "low";
    return "high";
  }

  /* Геометрия НЕ зависит от тира.
   *
   * История: сначала я резал число панелей (18 -> 13), и круглое сечение
   * становилось гранёной «бочкой». Потом резал глубину (23 -> 18) — на классе III
   * с его 12 панелями это дало «купол» из крупных плоских граней. Оба раза
   * экономия ломала силуэт.
   *
   * Теперь силуэт одинаков во всех тирах: глубина 23, панелей 18 (III тоже 18).
   * Экономия берётся только там, где не видно: отсечение субпиксельных панелей,
   * меньше точек у колец, фон в кэше мельче.
   */
  function warpSpaceTierParams(tier) {
    return tier === "low"
      ? { ringAlphaScale: 0.8, backdropScale: 0.34, cullScale: 3.2 }
      : { ringAlphaScale: 1, backdropScale: null, cullScale: 1.6 };
  }

  /* Плавная смена направления: без этого переключение вида разворачивает
   * стенку за один кадр, и она «телепортируется». */
  function warpSpaceDirectionRamp(current, target, dt) {
    var cur = Number(current);
    if (!isFinite(cur)) cur = target >= 0 ? 1 : -1;
    var tgt = target >= 0 ? 1 : -1;
    var k = Math.min(1, (Number(dt) || 0) * 3.2);
    var next = cur + (tgt - cur) * k;
    if (Math.abs(next - tgt) < 0.02) next = tgt;
    return next;
  }

  /* ------------------------------------------------------------- sketches
   * Шесть векторных обоев из mini-sim/assets/scetchs. Они статические: в каждом
   * 300–620 элементов и по три feGaussianBlur, поэтому растеризация стоит
   * заметно дороже процедурного фона. Отсюда правила:
   *  - растеризуем ОДИН раз в offscreen-кэш, как и процедурный фон;
   *  - делаем это в паузе (предзагрузка), а не в кадре перехода;
   *  - пока картинка не готова, показываем процедурный фон — экран не пустует;
   *  - если загрузка не удалась, остаёмся на процедурном без ошибок.
   */
  var WARP_SPACE_SKETCHES = [
    "01-star-tunnel.svg",
    "02-particle-seed.svg",
    "03-energy-waves.svg",
    "04-scan-transition.svg",
    "05-deep-parallax.svg",
    "06-portal-shift.svg"
  ];

  function warpSpaceSketchFor(index) {
    var n = Math.max(0, Math.floor(Number(index) || 0));
    return WARP_SPACE_SKETCHES[n % WARP_SPACE_SKETCHES.length];
  }

  /* Cover-подгонка: картинка заполняет кадр целиком без полей, лишнее режется. */
  function warpSpaceCoverRect(iw, ih, cw, ch) {
    var sw = Math.max(1, Number(iw) || 1);
    var sh = Math.max(1, Number(ih) || 1);
    var scale = Math.max(cw / sw, ch / sh);
    var w = sw * scale;
    var h = sh * scale;
    return { x: (cw - w) * 0.5, y: (ch - h) * 0.5, w: w, h: h };
  }

  /* Готовит кэш из уже загруженной картинки. Возвращает объект той же формы,
   * что и процедурный кэш, поэтому растворение работает с любым источником. */
  function createSketchCache(image, w, h, makeCanvas, scale) {
    var q = isFinite(scale) && scale > 0 ? Number(scale) : warpSpaceQuality(w, h);
    var cw = Math.max(2, Math.round(w * q));
    var ch = Math.max(2, Math.round(h * q));
    var canvas = makeCanvas(cw, ch);
    var g = canvas.getContext("2d");
    g.fillStyle = "#01030a";
    g.fillRect(0, 0, cw, ch);
    var iw = image && (image.naturalWidth || image.width) || 1600;
    var ih = image && (image.naturalHeight || image.height) || 900;
    var rect = warpSpaceCoverRect(iw, ih, cw, ch);
    g.drawImage(image, rect.x, rect.y, rect.w, rect.h);
    return { canvas: canvas, w: cw, h: ch, scale: q, id: "sketch" };
  }

  /* ------------------------------------------------------- cycling seeds
   * Фон не меняется «сам по себе» и не режется жёстким срезом: он проходит
   * цикл из спецификации — 3 с переход частицами, 4,5 с пауза, 7,5 с полный
   * цикл. Порядок seed детерминированный, производный от seed заезда, поэтому
   * повторный вход в тот же заезд даёт тот же ряд фонов.
   */
  /* Полный цикл 18 с: 3 с переход частицами + 15 с паузы.
   * Переход укоротить нельзя без потери читаемости (3 с — минимум, при котором
   * разлёт успевает прочитаться как движение, а не как рябь), поэтому растёт
   * именно пауза. Значения вынесены в конфиг, а не зашиты в цикл. */
  /* Полный цикл 18 с. По умолчанию границы переходов сидят на тактовой сетке:
   * при 120 BPM такт = 2 с, значит переход 2 с = 1 такт и пауза 16 с = 8 тактов,
   * итого ровно 9 тактов. Переход, который начинается на сильной доле, читается
   * как часть музыки, а не как случайная вспышка.
   *
   * ВАЖНО про AUDIO FREEZE: звук здесь не трогается вообще. Мы только выравниваем
   * ФАЗУ КАРТИНКИ по постоянному BPM, взятого как константа. Ни одного аудиофайла
   * не создаётся, не меняется и не запускается.
   */
  /* 142 BPM — точный показатель, названный владельцем. При нём такт = 240/142 =
   * 1.6901 с, переход = ровно 1 такт, а весь цикл ложится в 11 тактов =
   * 18.59 с (по-прежнему «около 18 секунд», но теперь сетка не «примерно»,
   * а точно по темпу). Значение 120 остаётся доступным и даёт прежние
   * 2.00 / 16.00 / 18.00 — сетка от этого не меняется. */
  var WARP_SPACE_CYCLE = { transition: 2, hold: 16, period: 18, bpm: 142 };

  /* Длина такта в секундах для 4/4. */
  function warpSpaceBarSeconds(bpm) {
    var b = Number(bpm);
    if (!isFinite(b) || b <= 0) b = 120;
    return 240 / b;
  }

  /* Подгоняет длительности под целое число тактов, сохраняя общий период 18 с. */
  function warpSpaceBeatAligned(total, bpm) {
    var bar = warpSpaceBarSeconds(bpm);
    var bars = Math.max(1, Math.round((Number(total) || 18) / bar));
    var period = bars * bar;
    var transitionBars = Math.max(1, Math.round(1));
    return {
      bar: bar,
      bars: bars,
      period: period,
      transition: bar * transitionBars,
      hold: period - bar * transitionBars
    };
  }

  function warpSpaceCycleConfig(transition, hold, bpm) {
    var t = Number(transition);
    var h = Number(hold);
    var bars = Number(bpm);
    if (isFinite(bars) && bars > 0) {
      var aligned = warpSpaceBeatAligned(
        (isFinite(t) && t > 0 ? t : WARP_SPACE_CYCLE.transition) +
        (isFinite(h) && h >= 0 ? h : WARP_SPACE_CYCLE.hold), bars);
      return {
        transition: aligned.transition,
        hold: aligned.hold,
        period: aligned.period,
        bpm: bars,
        bar: aligned.bar,
        bars: aligned.bars
      };
    }
    return {
      transition: isFinite(t) && t > 0 ? t : WARP_SPACE_CYCLE.transition,
      hold: isFinite(h) && h >= 0 ? h : WARP_SPACE_CYCLE.hold,
      period: (isFinite(t) && t > 0 ? t : WARP_SPACE_CYCLE.transition) +
              (isFinite(h) && h >= 0 ? h : WARP_SPACE_CYCLE.hold)
    };
  }

  /* Фаза внутри такта 0..1 — для синхронизации вспышек и скорости разлёта. */
  function warpSpaceBeatPhase(elapsed, bpm) {
    var bar = warpSpaceBarSeconds(bpm);
    var e = Math.max(0, Number(elapsed) || 0);
    var v = (e / bar) % 1;
    return v < 0 ? v + 1 : v;
  }

  /* N-й seed ряда. Не «случайная картинка»: чистая функция от базового seed. */
  function warpSpaceNextSeed(seed, index) {
    var base = (Number(seed) >>> 0) || 1;
    var n = Math.max(0, Math.floor(Number(index) || 0));
    var v = base + Math.imul(n + 1, 0x9E3779B1);
    v >>>= 0;
    v ^= v >>> 15;
    v = Math.imul(v, 0x85EBCA6B) >>> 0;
    v ^= v >>> 13;
    return v >>> 0;
  }

  /* Состояние цикла в момент elapsed.
   * remaining — сколько секунд осталось до прибытия; переход, который не успеет
   * дорисоваться, не начинается. Это и есть «не использовать произвольный
   * таймер вместо реального события прибытия»: окно закрывается по времени
   * заезда, а событие прибытия просто обнуляет remaining.
   */
  function warpSpaceCycleAt(elapsed, config, remaining) {
    var cfg = config || WARP_SPACE_CYCLE;
    var e = Math.max(0, Number(elapsed) || 0);
    var left = remaining == null ? Infinity : Math.max(0, Number(remaining) || 0);
    var index = Math.floor(e / cfg.period);
    var within = e - index * cfg.period;
    if (within < cfg.hold) {
      return { phase: "hold", from: index, to: index, k: 0, index: index, remaining: left };
    }
    var k = (within - cfg.hold) / cfg.transition;
    if (k > 1) k = 1;
    // Переход не стартует, если до прибытия меньше его длительности.
    if (left < cfg.transition * (1 - k)) {
      return { phase: "hold", from: index, to: index, k: 0, index: index, remaining: left };
    }
    return { phase: "transition", from: index, to: index + 1, k: k, index: index, remaining: left };
  }

  /* ---------------------------------------------------- астероиды в стенке
   * Настоящие меши из mini-sim/assets/mesh/asteroid_variety. В игре они НЕ
   * грузятся как GLB: слой варпа — Canvas 2D, второй WebGL-контекст на слабом
   * Android не нужен (решение ревизии 11 в силе). Меши испечены в спрайты
   * заранее (bake_asteroids.py): в кадре это один drawImage на камень.
   *
   * Раскладка — чистая функция от глубины, угла и seed: камень «прибит» к
   * стенке и уезжает в точку схода вместе с ней, поэтому поле не дёргается.
   * Классы — как папки в репозитории: small / medium / large.
   */
  var WARP_SPACE_ASTEROIDS = {
    large: { px: 160, minPx: 26, maxPx: 92, scale: 0.30 },
    medium: { px: 112, minPx: 14, maxPx: 46, scale: 0.20 },
    small: { px: 80, minPx: 7, maxPx: 20, scale: 0.12 }
  };

  var WARP_SPACE_ASTEROID_SLOTS = 30;
  var asteroidSlotCache = {};

  function warpSpaceAsteroidArt() {
    var art = typeof window !== "undefined" ? window.BCM_WARP_ASTEROID_ART : null;
    return art && typeof art === "object" ? art : null;
  }

  function warpSpaceAsteroidIds() {
    var art = warpSpaceAsteroidArt();
    if (!art) return [];
    return Object.keys(art).sort();
  }

  function warpSpaceAsteroidSizeOf(id) {
    var name = String(id || "");
    if (name.indexOf("large") === 0) return "large";
    if (name.indexOf("medium") === 0) return "medium";
    if (name.indexOf("small") === 0) return "small";
    return "medium";
  }

  /* Раскладка поля. depth 0..1 (0 — у камеры, 1 — точка схода), как у стенки.
   * Отдаёт массив слотов: угол, глубина, размер-класс, id спрайта, поворот. */
  function warpSpaceAsteroidField(seed, density) {
    var s = (Number(seed) >>> 0) || 1;
    var d = Number(density);
    var count = isFinite(d) && d >= 0 ? Math.round(d * WARP_SPACE_ASTEROID_SLOTS) : WARP_SPACE_ASTEROID_SLOTS;
    count = Math.max(0, Math.min(WARP_SPACE_ASTEROID_SLOTS, count));
    var key = s + "|" + count;
    if (asteroidSlotCache[key]) return asteroidSlotCache[key];
    var ids = warpSpaceAsteroidIds();
    var rnd = makeRandom(s ^ 0x2C1B3C6D, null);
    var slots = [];
    for (var i = 0; i < count; i += 1) {
      var deep = 0.06 + rnd() * 0.94;
      var sizeRoll = rnd();
      var size = sizeRoll > 0.72 ? "large" : sizeRoll > 0.38 ? "medium" : "small";
      var pool = ids.filter(function (id) { return warpSpaceAsteroidSizeOf(id) === size; });
      var id = pool.length ? pool[Math.floor(rnd() * pool.length) % pool.length] : (ids[0] || null);
      slots.push({
        angle: rnd() * Math.PI * 2,
        depth: deep,
        size: size,
        id: id,
        spin: (rnd() * 2 - 1) * 0.35
      });
    }
    // Ближние рисуются последними: порядок фиксирован, чтобы кадр был стабилен.
    slots.sort(function (a, b) { return b.depth - a.depth; });
    asteroidSlotCache[key] = slots;
    return slots;
  }

  function warpSpaceAsteroidRadius(size, wallRadius) {
    var spec = WARP_SPACE_ASTEROIDS[size] || WARP_SPACE_ASTEROIDS.medium;
    var wall = Number(wallRadius);
    if (!isFinite(wall) || wall <= 0) wall = 320;   // запас: кадр без размеров
    var px = wall * spec.scale;
    if (!isFinite(px)) px = spec.minPx;
    return Math.max(spec.minPx, Math.min(spec.maxPx, px));
  }

  /* Рисует камни на стенке. point(depth, angle) даёт точку кольца; images —
   * карта id -> Image (их грузит игра/демо один раз). */
  function drawWarpSpaceAsteroids(g, point, wallRadius, seed, density, images, t) {
    var slots = warpSpaceAsteroidField(seed, density);
    if (!slots.length) return 0;
    var drawn = 0;
    for (var i = 0; i < slots.length; i += 1) {
      var slot = slots[i];
      // Ближние камни у самой камеры выходят за кольцо — не рисуем их.
      if (slot.depth < 0.10) continue;
      var radius = warpSpaceAsteroidRadius(slot.size, wallRadius);
      if (!(radius > 0.5)) continue;
      var p = point(slot.depth, slot.angle);
      if (!p || !isFinite(p.x) || !isFinite(p.y)) continue;
      var spec = WARP_SPACE_ASTEROIDS[slot.size] || WARP_SPACE_ASTEROIDS.medium;
      // Настоящий размер камня: ближе к камере — крупнее. Без этого поле
      // читается как плоские наклейки.
      var zoom = 0.42 + (1 - slot.depth) * 1.15;
      var size = Math.max(spec.minPx * 0.8, Math.min(spec.maxPx * 1.2, radius * zoom));
      var image = images && slot.id ? images[slot.id] : null;
      var alpha = 0.55 + (1 - slot.depth) * 0.45;
      g.save();
      g.globalAlpha = Math.max(0.12, Math.min(1, alpha));
      g.translate(p.x, p.y);
      g.rotate(slot.angle * 1.7 + (Number(t) || 0) * slot.spin + slot.depth);
      if (image) {
        g.drawImage(image, -size * 0.5, -size * 0.5, size, size);
      } else {
        // Фолбэк без картинки: гранёный камень, чтобы поле не исчезало.
        g.beginPath();
        for (var k = 0; k < 7; k += 1) {
          var a = (k / 7) * Math.PI * 2;
          var rr = size * (k % 2 ? 0.34 : 0.5);
          if (!k) g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
          else g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        g.closePath();
        g.fillStyle = "rgba(58,62,70,0.92)";
        g.fill();
        g.strokeStyle = "rgba(150,160,170,0.55)";
        g.lineWidth = 1;
        g.stroke();
      }
      g.restore();
      drawn += 1;
    }
    return drawn;
  }

  /* ---------- случайный ритм: пауза ~2 с, дальше сам разнообразит ----------
   * Владельцу не нужна привязка к тактам: «сама разнообразность эффективно».
   * Поэтому ритм больше не выровнен по музыке, а идёт короткими отрезками —
   * ~2 с паузы и ~0.9 с перехода, каждый раз чуть разные (±джиттер), и каждый
   * переход берёт СЛУЧАЙНЫЙ способ из всех шести, случайную силу и следующую
   * по порядку сцену. Способ выбирается «мешком»: все шесть видов выпадают по
   * одному разу за круг, но в случайном порядке, и подряд два одинаковых не
   * встают — так разнообразие видно сразу, без повторов и без залипания.
   *
   * Всё это по-прежнему ЧИСТАЯ функция от elapsed: таблица отрезков строится
   * детерминированно из seed, поэтому кадр можно пересчитать с любого момента,
   * а тест — сравнить два прогона.
   */
  var WARP_SPACE_RANDOM = {
    hold: 2, holdJitter: 0.4,
    // Переход между кадрами скетчей — вдвое длиннее, чем было (0.9): на 1.8 с
    // рассыпание успевает прочитаться, а не мигнуть.
    transition: 1.8, transitionJitter: 0.4,
    powerMin: 1, powerMax: 2.5,
    seed: 0x5F3A21C7
  };

  var randomCycleCache = { key: "", segs: [], bag: null, prevKind: null, rnd: null, upto: 0 };

  function randomCycleOpts(opts) {
    var o = opts || {};
    function num(v, fallback, min) {
      var n = Number(v);
      return isFinite(n) && n >= min ? n : fallback;
    }
    return {
      hold: num(o.hold, WARP_SPACE_RANDOM.hold, 0.1),
      holdJitter: num(o.holdJitter, WARP_SPACE_RANDOM.holdJitter, 0),
      transition: num(o.transition, WARP_SPACE_RANDOM.transition, 0.1),
      transitionJitter: num(o.transitionJitter, WARP_SPACE_RANDOM.transitionJitter, 0),
      powerMin: num(o.powerMin, WARP_SPACE_RANDOM.powerMin, 0),
      powerMax: num(o.powerMax, WARP_SPACE_RANDOM.powerMax, 0),
      seed: (Number(o.seed) >>> 0) || WARP_SPACE_RANDOM.seed
    };
  }

  function randomCycleKey(o) {
    return [o.hold, o.holdJitter, o.transition, o.transitionJitter,
      o.powerMin, o.powerMax, o.seed].join("|");
  }

  function randomCycleStep(cache, o) {
    var ids = warpSpaceTransitionIds();
    var n = ids.length;
    var index = cache.segs.length;
    var rnd = cache.rnd;
    if (index % n === 0) {
      var bag = ids.slice();
      for (var a = bag.length - 1; a > 0; a -= 1) {
        var b = Math.floor(rnd() * (a + 1));
        if (b < 0) b = 0;
        if (b > a) b = a;
        var tmp = bag[a]; bag[a] = bag[b]; bag[b] = tmp;
      }
      // два одинаковых подряд на стыке кругов — единственный заметный «сбой»
      if (cache.prevKind && bag[0] === cache.prevKind && bag.length > 1) {
        var first = bag[0]; bag[0] = bag[1]; bag[1] = first;
      }
      cache.bag = bag;
    }
    var kind = cache.bag[index % n];
    if (ids.indexOf(kind) < 0) kind = ids[0];
    cache.prevKind = kind;

    var hold = o.hold + (rnd() * 2 - 1) * o.holdJitter;
    if (hold < 0.25) hold = 0.25;
    var trans = o.transition + (rnd() * 2 - 1) * o.transitionJitter;
    if (trans < 0.3) trans = 0.3;
    var power = o.powerMin + rnd() * (o.powerMax - o.powerMin);

    var prev = cache.segs[index - 1];
    var start = prev ? prev.start + prev.hold + prev.transition : 0;
    cache.segs.push({
      index: index, from: index, to: index + 1,
      start: start, hold: hold, transition: trans,
      kind: kind, power: power
    });
    cache.upto = start + hold + trans;
    return cache.segs[index];
  }

  function randomCycleReady(opts, upto) {
    var o = randomCycleOpts(opts);
    var key = randomCycleKey(o);
    if (randomCycleCache.key !== key) {
      randomCycleCache = {
        key: key, segs: [], bag: null, prevKind: null,
        rnd: makeRandom(o.seed, null), upto: 0
      };
    }
    // Потолок на перебор: даже если elapsed пришёл абсурдно большой, кадр
    // не должен зависнуть в цикле на тысячу отрезков.
    var guard = 0;
    while (randomCycleCache.upto <= upto && guard < 20000) {
      randomCycleStep(randomCycleCache, o);
      guard += 1;
    }
    return randomCycleCache;
  }

  function warpSpaceRandomCycleAt(elapsed, opts, remaining) {
    var o = randomCycleOpts(opts);
    var e = Math.max(0, Number(elapsed) || 0);
    var left = remaining == null ? Infinity : Math.max(0, Number(remaining) || 0);
    var cache = randomCycleReady(o, e);
    var segs = cache.segs;
    var at = segs.length - 1;
    for (var i = 0; i < segs.length; i += 1) {
      var end = segs[i].start + segs[i].hold + segs[i].transition;
      if (e < end) { at = i; break; }
    }
    var seg = segs[at];
    var within = e - seg.start;
    var isHold = within < seg.hold;
    var k = isHold ? 0 : (within - seg.hold) / seg.transition;
    if (k > 1) k = 1;
    if (!isHold && left < seg.transition * (1 - k)) isHold = true, k = 0;
    return {
      phase: isHold ? "hold" : "transition",
      from: seg.from,
      to: seg.to,
      k: k,
      index: seg.from,
      kind: seg.kind,
      power: seg.power,
      start: seg.start,
      hold: seg.hold,
      transition: seg.transition,
      period: seg.hold + seg.transition,
      remaining: left
    };
  }

  /* Раскладка ближайших переходов — для панели и для тестов. */
  function warpSpaceRandomCyclePlan(opts, count) {
    var o = randomCycleOpts(opts);
    var n = Math.max(1, Math.floor(Number(count) || 1));
    var cache = randomCycleReady(o, 0);
    while (cache.segs.length < n) randomCycleStep(cache, o);
    return cache.segs.slice(0, n).map(function (seg) {
      return {
        index: seg.index, start: seg.start, hold: seg.hold,
        transition: seg.transition, kind: seg.kind, power: seg.power
      };
    });
  }

  /* ---------- площадь панели для отсечения субпиксельных ----------
   * Панель стенки — четырёхугольник p00(p01) x p10(p11). Раньше площадь
   * оценивалась как |dx1 * dy2|, то есть ОДНИМ членом векторного произведения:
   * на 0° и 180° радиальное ребро горизонтально (dy2 ≈ 0), произведение
   * обнулялось, и панель 40x60 px выбрасывалась как «субпиксельная» — на
   * стенке появлялись дыры, которые ездили вместе с поворотом кольца.
   * Здесь полная шнуровка: |dx1*dy2 - dx2*dy1| (это удвоенная площадь, для
   * отсечения это не важно — порог тот же).
   */
  function warpSpaceQuadArea(p00, p01, p10) {
    if (!p00 || !p01 || !p10) return 0;
    var dx1 = (Number(p01.x) || 0) - (Number(p00.x) || 0);
    var dy1 = (Number(p01.y) || 0) - (Number(p00.y) || 0);
    var dx2 = (Number(p10.x) || 0) - (Number(p00.x) || 0);
    var dy2 = (Number(p10.y) || 0) - (Number(p00.y) || 0);
    var area = Math.abs(dx1 * dy2 - dx2 * dy1);
    return isFinite(area) ? area : 0;
  }

  function warpSpacePanelVisible(p00, p01, p10, minArea) {
    var m = Number(minArea);
    if (!isFinite(m) || m < 0) m = 0;
    return warpSpaceQuadArea(p00, p01, p10) >= m;
  }

  /* Прямоугольники ячеек для растворения. Считаются один раз на переход. */
  function warpSpaceCellField(cols, rows, seed) {
    var n = Math.max(1, cols | 0) * Math.max(1, rows | 0);
    var rnd = makeRandom(((Number(seed) >>> 0) || 1) ^ 0x51ED270B, null);
    var cells = new Array(n);
    for (var i = 0; i < n; i += 1) {
      var cx = i % cols;
      var cy = Math.floor(i / cols);
      var nx = (cx + 0.5) / cols - 0.5;
      var ny = (cy + 0.5) / rows - 0.5;
      var len = Math.sqrt(nx * nx + ny * ny) || 0.0001;
      cells[i] = {
        col: cx,
        row: cy,
        ux: nx / len,
        uy: ny / len,
        spin: (rnd() * 2 - 1) * 0.9,
        delay: rnd() * 0.35,
        spread: 0.55 + rnd() * 0.9
      };
    }
    return cells;
  }

  /* ------------------------------------------------------- пиксель перехода
   * Раньше сетка перехода была зашита: 12x7 / 18x10 / 26x15. Это одинаково
   * плохо с двух сторон: на телефоне с DPR 3 клетка 18x10 — это всё равно
   * крупный «конфетти», а на нормальном ПК та же сетка — заведомо грубая
   * мозаика, хотя железо тянет на порядок мельче.
   *
   * Теперь сетка задаётся БЮДЖЕТОМ КЛЕТОК, а не готовой парой чисел.
   * Клетки держим квадратными и ограничиваем снизу 3 пикселями кадра:
   * мельче всё равно не видно, а blit стоит столько же.
   *
   * Стоимость кадра перехода = 2 * (cols * rows) drawImage (уходящая +
   * приходящая картинка). Отсюда все числа ниже: 84 клетки на слабом
   * устройстве, 5184 на обычном ПК.
   */
  /* Мельчесть частиц рассыпания. Владелец: «мелкие частицы ещё мельче в
   * переходе рассыпания, прям в 23 раза». Понимаем буквально по площади:
   * частиц в 23 раза больше, каждая в 23 раза меньше по площади (линейно
   * ~4.8 раза мельче — клетка 15 px становится ~3 px). Меньше 3 px на клетку
   * не имеет смысла: это уже субпиксельный шум, поэтому сетка упирается в
   * потолок warpSpaceCellGrid.
   *
   * maxDraws — предохранитель кадра: на ПК 23x от «микро» даёт ~119 тысяч
   * клеток, и рисовать их все каждый кадр физически нельзя. Когда живых
   * клеток больше maxDraws, кадр рисует свою долю, а следующие кадры — соседние
   * доли (сдвиг по номеру кадра). Мозаика на 3 px собирается как обычно, а
   * кадр остаётся кадром, а не слайд-шоу.
   */
  var WARP_SPACE_DISSOLVE = { fineness: 23, maxDraws: 24000 };

  /* Потолок клеток на кадр по тиру: ПК держит больше, слабому хватает малого.
   * Это не «мельчесть», а предохранитель — сама сетка считается отдельно. */
  function warpSpaceDissolveFrameCap(tier) {
    if (tier === "low") return 2400;
    return 12000;
  }

  function warpSpaceDissolveBudget(baseBudget) {
    var b = Number(baseBudget);
    if (!isFinite(b) || b <= 0) b = 180;
    return Math.round(b * WARP_SPACE_DISSOLVE.fineness);
  }

  var WARP_SPACE_CELL_PRESETS = {
    coarse: 84,      // 12x7   — крупные осколки, самый дешёвый
    fine: 180,       // 18x10  — прежний вид по умолчанию
    small: 390,      // 26x15
    tiny: 1100,      // 44x25  — «очень мелкий»
    micro: 5184      // 96x54  — «микро», только для теста на ПК
  };

  function warpSpaceCellGrid(budget, w, h) {
    var width = Math.max(2, Number(w) || 2);
    var height = Math.max(2, Number(h) || 2);
    var b = Number(budget);
    if (!isFinite(b) || b < 12) b = WARP_SPACE_CELL_PRESETS.fine;
    // Не мельче 3 px на клетку: дальше растёт только счётчик вызовов.
    var maxByPixels = Math.max(12, Math.floor((width / 3) * (height / 3)));
    if (b > maxByPixels) b = maxByPixels;
    var aspect = width / height;
    var cols = Math.max(4, Math.round(Math.sqrt(b * aspect)));
    var rows = Math.max(3, Math.round(b / cols));
    return { cols: cols, rows: rows, cells: cols * rows, budget: b };
  }

  /* Профиль устройства: насколько мелкий пиксель и какое разрешение канвы
   * заслуживает это железо.
   *
   * Смысл — не «урезать всем», а не требовать с телефона то, что он не может:
   * на телефоне DPR 3 при экране 390x844 — это канва 1170x2532, то есть
   * 3 млн пикселей на кадр только на заливку. Поэтому у телефона потолок
   * DPR 1.25 и крупный пиксель перехода, у ПК — мелкий пиксель и полный DPR.
   *
   * info: { cores, dpr, shortSide (css px), coarsePointer, tier }
   */
  function warpSpaceDeviceProfile(info) {
    var i = info || {};
    var tier = i.tier === "low" ? "low" : "high";
    var cores = Number(i.cores) || 0;
    var dpr = Number(i.dpr) || 1;
    if (!isFinite(dpr) || dpr <= 0) dpr = 1;
    var shortSide = Number(i.shortSide) || 0;
    var coarse = !!i.coarsePointer;

    if (tier === "low") {
      return { id: "weak", label: "слабое устройство", dprCap: 1, cellBudget: 84, backdropScale: 0.34 };
    }
    if (coarse || (shortSide && shortSide <= 600)) {
      return { id: "touch", label: "телефон", dprCap: 1.25, cellBudget: 180, backdropScale: 0.40 };
    }
    if (shortSide && shortSide <= 1000 && cores > 0 && cores < 8) {
      return { id: "tablet", label: "планшет / ноутбук", dprCap: 1.35, cellBudget: 1100, backdropScale: 0.45 };
    }
    return { id: "desktop", label: "ПК", dprCap: Math.max(1, Math.min(1.5, dpr)), cellBudget: 5184, backdropScale: 0.55 };
  }

  /* --------------------------------------------------- корабль, вид сзади
   * «Активную модельку можно крепить от вида сзади конкретного корабля в
   * режиме полёт, только таким же маленьким, удобно управляемым внутри
   * кольца». В варпе корабль — это 2D-слой, поэтому здесь два пути:
   *
   *  1. Готовый спрайт (обязательный случай для игры): если передан
   *     `sprite` — Image или canvas с запечённым видом сзади настоящей модели,
   *     рисуется он. Печётся он в игре один раз (WebGL-рендер в offscreen),
   *     поэтому в кадре это один drawImage, а не второй WebGL-контекст.
   *  2. Процедурный силуэт сзади: если спрайта нет, рисуется маленький
   *     корабль по параметрам силуэта — двигатели, крылья, огни. Это фолбэк,
   *     который обязан выглядеть прилично, потому что спрайта может не быть.
   *
   * Размер сознательно маленький: корабль живёт ВНУТРИ кольца и не должен
   * закрывать собой коридор. Размер задаётся в пикселях кадра и ограничен
   * сверху, чтобы на 4K он не вырос в полэкрана.
   */
  var WARP_SPACE_SHIP_SPECS = [
    { id: "pearce-f4", label: "Pearce F4", span: 1.00, engines: 2, engineSpread: 0.34,
      hullW: 0.30, hullL: 1.00, fin: 0.34, hull: "#26424f", accent: "#8eeaf4", glow: "99,222,255" },
    { id: "fimbul-mamba", label: "Fimbul Mamba", span: 1.34, engines: 4, engineSpread: 0.52,
      hullW: 0.42, hullL: 0.92, fin: 0.22, hull: "#3b2a24", accent: "#ffcf8e", glow: "255,166,92" },
    { id: "chi", label: "Chi", span: 0.86, engines: 2, engineSpread: 0.26,
      hullW: 0.34, hullL: 0.86, fin: 0.46, hull: "#1f3a52", accent: "#b8f0ff", glow: "140,226,255" },
    { id: "om", label: "Om", span: 1.12, engines: 3, engineSpread: 0.44,
      hullW: 0.38, hullL: 0.98, fin: 0.28, hull: "#40323f", accent: "#f0c4ff", glow: "214,150,255" },
    { id: "packlite", label: "Packlite", span: 1.20, engines: 2, engineSpread: 0.60,
      hullW: 0.52, hullL: 0.80, fin: 0.18, hull: "#2c3a2c", accent: "#d8f5b0", glow: "180,240,140" }
  ];

  function warpSpaceShipSpec(idOrIndex) {
    if (typeof idOrIndex === "number") {
      var byIndex = WARP_SPACE_SHIP_SPECS[Math.abs(Math.trunc(idOrIndex)) % WARP_SPACE_SHIP_SPECS.length];
      return byIndex;
    }
    var want = String(idOrIndex || "").toLowerCase();
    for (var i = 0; i < WARP_SPACE_SHIP_SPECS.length; i += 1) {
      if (WARP_SPACE_SHIP_SPECS[i].id === want) return WARP_SPACE_SHIP_SPECS[i];
    }
    return WARP_SPACE_SHIP_SPECS[0];
  }

  /* Размер корабля в пикселях кадра: маленький, но не точка. */
  function warpSpaceShipSize(w, h) {
    var minDim = Math.min(Number(w) || 0, Number(h) || 0) || 500;
    var size = minDim * 0.075;
    if (size < 22) size = 22;
    if (size > 46) size = 46;
    return size;
  }

  /* Вид сзади. (cx, cy) — центр силуэта, size — его высота в пикселях,
   * bank — крен (-1..1), thrust — 0..1 (насколько горят двигатели).
   * Всё считается от size, поэтому силуэт одинаков на любом разрешении. */
  function paintShipRear(g, cx, cy, size, spec, bank, thrust, rollAbs) {
    var s0 = warpSpaceShipSpec(spec && spec.id ? spec.id : spec) || WARP_SPACE_SHIP_SPECS[0];
    var height = Number(size) || 32;
    var width = height * (s0.span || 1);
    var bankAmount = isFinite(bank) ? Math.max(-1, Math.min(1, Number(bank))) : 0;
    var fire = isFinite(thrust) ? clampUnit(Number(thrust)) : 0.7;
    var halfW = width * 0.5;
    var halfH = height * 0.5;
    // rollAbs — абсолютный поворот в экранных радианах (кольцо + Q/E).
    // Если он не задан, остаётся старое поведение: лёгкий крен от руля.
    var absolute = isFinite(rollAbs) ? Number(rollAbs) : null;

    g.save();
    g.translate(cx, cy);
    if (absolute == null) {
      g.rotate(bankAmount * 0.28);
      g.translate(bankAmount * width * 0.10, 0);
    } else {
      g.rotate(absolute);
    }

    // 1. факелы двигателей — за корпусом, чтобы свет шёл из-под него
    var engines = Math.max(1, s0.engines | 0);
    var spread = halfW * (s0.engineSpread || 0.4);
    var engineY = halfH * 0.62;
    var engineR = Math.max(1.2, height * 0.085);
    for (var e = 0; e < engines; e += 1) {
      var t = engines === 1 ? 0 : (e / (engines - 1)) * 2 - 1;
      var ex = t * spread;
      var flareH = height * (0.22 + fire * 0.30);
      var grad = g.createLinearGradient(ex, engineY, ex, engineY + flareH);
      grad.addColorStop(0, "rgba(" + s0.glow + "," + (0.55 * fire + 0.15).toFixed(3) + ")");
      grad.addColorStop(1, "rgba(" + s0.glow + ",0)");
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(ex - engineR, engineY);
      g.lineTo(ex + engineR, engineY);
      g.lineTo(ex, engineY + flareH);
      g.closePath();
      g.fill();
    }

    // 2. крылья: два сужения к краям, с навигационными огнями на концах
    g.fillStyle = s0.hull;
    g.strokeStyle = "rgba(200,240,255,0.45)";
    g.lineWidth = Math.max(0.8, height * 0.022);
    var wingReach = halfW * (0.86 + s0.fin * 0.1);
    g.beginPath();
    g.moveTo(-halfW * 0.30, -halfH * 0.34);
    g.lineTo(-wingReach, halfH * (0.10 + s0.fin * 0.18));
    g.lineTo(-halfW * 0.34, halfH * 0.30);
    g.closePath();
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(halfW * 0.30, -halfH * 0.34);
    g.lineTo(wingReach, halfH * (0.10 + s0.fin * 0.18));
    g.lineTo(halfW * 0.34, halfH * 0.30);
    g.closePath();
    g.fill();
    g.stroke();

    // 3. корпус: сверху уже (нос уходит вдаль), снизу шире (корма к камере)
    g.fillStyle = s0.hull;
    g.beginPath();
    g.moveTo(-halfW * (0.16 + s0.hullW * 0.10), -halfH * s0.hullL * 0.52);
    g.lineTo(halfW * (0.16 + s0.hullW * 0.10), -halfH * s0.hullL * 0.52);
    g.lineTo(halfW * s0.hullW * 0.62, halfH * 0.30);
    g.lineTo(-halfW * s0.hullW * 0.62, halfH * 0.30);
    g.closePath();
    g.fill();
    g.stroke();

    // 4. двигатели: сопла с ярким ядром
    for (var p = 0; p < engines; p += 1) {
      var u = engines === 1 ? 0 : (p / (engines - 1)) * 2 - 1;
      var px = u * spread;
      g.fillStyle = "rgba(12,18,26,0.95)";
      g.beginPath();
      g.arc(px, engineY, engineR * 1.55, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = s0.accent;
      g.globalAlpha = 0.55 + fire * 0.45;
      g.beginPath();
      g.arc(px, engineY, engineR, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
    }

    // 5. фонарь кабины и огни
    g.fillStyle = "rgba(190,240,255,0.75)";
    g.beginPath();
    g.ellipse(0, -halfH * s0.hullL * 0.30, Math.max(1, height * 0.055), Math.max(1.6, height * 0.10), 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(255,86,86,0.95)";
    g.fillRect(-wingReach, halfH * (0.06 + s0.fin * 0.18), Math.max(1.4, height * 0.05), Math.max(1.4, height * 0.035));
    g.fillStyle = "rgba(120,255,140,0.95)";
    g.fillRect(wingReach - Math.max(1.4, height * 0.05), halfH * (0.06 + s0.fin * 0.18),
      Math.max(1.4, height * 0.05), Math.max(1.4, height * 0.035));

    g.restore();
    return { width: width, height: height, engines: engines };
  }

  /* Точка входа для игры и демо: спрайт, если он есть, иначе силуэт.
   * В кадре это ровно один drawImage либо один paintShipRear — не цикл. */
  function drawWarpShip(g, cx, cy, size, spec, bank, thrust, sprite, rollAbs) {
    var height = Number(size) || 32;
    var bankAmount = isFinite(bank) ? Math.max(-1, Math.min(1, Number(bank))) : 0;
    var absolute = isFinite(rollAbs) ? Number(rollAbs) : null;
    if (sprite && (sprite.naturalWidth || sprite.width)) {
      var iw = sprite.naturalWidth || sprite.width;
      var ih = sprite.naturalHeight || sprite.height;
      var scale = height / Math.max(1, ih);
      var dw = iw * scale;
      g.save();
      g.translate(cx, cy);
      g.rotate(absolute == null ? bankAmount * 0.28 : absolute);
      g.drawImage(sprite, -dw * 0.5, -height * 0.5, dw, height);
      g.restore();
      return { width: dw, height: height, sprite: true };
    }
    return paintShipRear(g, cx, cy, height, spec, bank, thrust, absolute);
  }

  /* Поворот корабля на кольце.
   *
   * Просьба владельца: «должен вращаться, как будто я кнопками Q/E его кручу,
   * чтобы по кольцу красиво ходить и вверх тормашками в том числе».
   *
   * Корабль висит на стенке трубы: «верх» силуэта всегда смотрит к центру
   * кольца. Поэтому поворот считается из положения на кольце:
   *   низ кольца (θ = π/2)  -> 0        (стоит как обычно)
   *   верх кольца (θ = 3π/2) -> π       (вверх тормашками)
   *   правый борт (θ = 0)   -> -π/2     (лёг на бок)
   * Q/E добавляют ручной крен сверху — как обзор в третьем лице.
   */
  function warpSpaceShipRollFor(ringAngle, manualRoll) {
    var a = Number(ringAngle);
    if (!isFinite(a)) a = Math.PI / 2;
    var m = Number(manualRoll);
    if (!isFinite(m)) m = 0;
    var roll = a - Math.PI / 2 + m;
    // держим в -π..π, чтобы поворот не накапливался бесконечно
    var turns = Math.round(roll / (Math.PI * 2));
    return roll - turns * Math.PI * 2;
  }

  /* ------------------------------------------------------ виды переходов
   * «Переход между кадрами, кроме рассыпания, может быть и другой — как двери
   * в первой комнате открываются разными способами». Поэтому способ смены
   * фона — список, а не одна функция. Приоритет остаётся за рассыпанием:
   * оно по умолчанию, остальные — варианты на выбор.
   *
   * Все варианты на Canvas 2D, без шейдеров: каждый — это clip плюс 1–2
   * drawImage на кадр, то есть дешевле рассыпания (там 2 * клеток blit-ов).
   * Ни один не читает и не меняет игровое состояние.
   */
  var WARP_SPACE_TRANSITIONS = [
    { id: "dissolve", label: "Рассыпание", cost: "клетки" },
    { id: "iris",     label: "Диафрагма",  cost: "2 blit" },
    { id: "doors",    label: "Створки",    cost: "2 blit" },
    { id: "blinds",   label: "Жалюзи",     cost: "полосы" },
    { id: "spiral",   label: "Спираль",    cost: "2 blit" },
    { id: "sweep",    label: "Сектор",     cost: "2 blit" }
  ];

  function warpSpaceTransitionIds() {
    return WARP_SPACE_TRANSITIONS.map(function (t) { return t.id; });
  }

  /* Детерминированный выбор способа для номера перехода: «по кругу» в
   * настройках означает именно это, а не случайность — повторный вход в тот
   * же заезд даёт ту же последовательность дверей. */
  function warpSpaceTransitionFor(index) {
    var list = warpSpaceTransitionIds();
    var n = Number(index);
    if (!isFinite(n)) n = 0;
    var i = ((Math.trunc(n) % list.length) + list.length) % list.length;
    return list[i];
  }

  function easeInOutCubic(v) {
    var t = clampUnit(v);
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /* Переход, кроме рассыпания. Возвращает число сделанных blit-ов, чтобы
   * вызывающий код мог честно показать стоимость кадра. */
  function drawSpaceWipe(g, prevCache, nextCache, k, w, h, kind) {
    var t = clampUnit(k);
    var e = easeInOutCubic(t);
    var prev = prevCache && prevCache.canvas;
    var next = nextCache && nextCache.canvas;
    if (!next && !prev) return 0;
    var blits = 0;

    function drawFull(canvas) {
      if (!canvas) return;
      g.drawImage(canvas, 0, 0, w, h);
      blits += 1;
    }

    if (kind === "iris") {
      // Круглая диафрагма: новый кадр раскрывается из центра.
      drawFull(prev);
      if (next) {
        var radius = e * Math.sqrt(w * w + h * h) * 0.55;
        g.save();
        g.beginPath();
        g.arc(w * 0.5, h * 0.5, Math.max(0.5, radius), 0, Math.PI * 2);
        g.closePath();
        g.clip();
        g.drawImage(next, 0, 0, w, h);
        g.restore();
        blits += 1;
        // светящаяся кромка: читается как дверь, а не как «просто проявилось»
        g.save();
        g.globalAlpha = 0.5 * Math.sin(Math.PI * t);
        g.strokeStyle = "#dff2ff";
        g.lineWidth = Math.max(1.5, Math.min(w, h) * 0.006);
        g.beginPath();
        g.arc(w * 0.5, h * 0.5, Math.max(0.5, radius), 0, Math.PI * 2);
        g.stroke();
        g.restore();
      }
      return blits;
    }

    if (kind === "doors") {
      // Створки расходятся от центра: две половины нового кадра выезжают
      // наружу, старый остаётся под ними.
      drawFull(prev);
      if (next) {
        var half = (w * 0.5) * e;
        if (half > 0.5) {
          g.save();
          g.beginPath();
          g.rect(w * 0.5 - half, 0, half, h);
          g.rect(w * 0.5, 0, half, h);
          g.clip();
          g.drawImage(next, 0, 0, w, h);
          g.restore();
          blits += 1;
        }
        // стык створок
        g.save();
        g.globalAlpha = 0.45 * (1 - t);
        g.fillStyle = "#eaf7ff";
        g.fillRect(w * 0.5 - 1, 0, 2, h);
        g.restore();
      }
      return blits;
    }

    if (kind === "blinds") {
      // Жалюзи: горизонтальные полосы нового кадра открываются по очереди,
      // сверху вниз. Число полос фиксировано, поэтому цена постоянная.
      drawFull(prev);
      if (next) {
        var strips = 14;
        var sh = h / strips;
        for (var i = 0; i < strips; i += 1) {
          var delay = (i / strips) * 0.35;
          var local = clampUnit((t - delay) / 0.65);
          if (local <= 0) continue;
          var open = sh * local;
          g.save();
          g.beginPath();
          g.rect(0, i * sh, w, open + 0.5);
          g.clip();
          g.drawImage(next, 0, i * sh, w, sh);
          g.restore();
          blits += 1;
        }
      }
      return blits;
    }

    if (kind === "spiral") {
      // Спираль: новый кадр вкручивается — растёт круг и проворачивается.
      drawFull(prev);
      if (next) {
        var scale = 0.25 + e * 0.75;
        var angle = (1 - e) * Math.PI * 1.6;
        g.save();
        g.beginPath();
        g.arc(w * 0.5, h * 0.5, Math.max(0.5, e * Math.sqrt(w * w + h * h) * 0.55), 0, Math.PI * 2);
        g.clip();
        g.translate(w * 0.5, h * 0.5);
        g.rotate(angle);
        g.globalAlpha = Math.min(1, 0.35 + e);
        g.drawImage(next, -w * 0.5 * scale, -h * 0.5 * scale, w * scale, h * scale);
        g.restore();
        g.globalAlpha = 1;
        blits += 1;
      }
      return blits;
    }

    if (kind === "sweep") {
      // Сектор: как радар — новый кадр заливается по кругу от верхней точки.
      drawFull(prev);
      if (next) {
        var end = -Math.PI / 2 + e * Math.PI * 2;
        g.save();
        g.beginPath();
        g.moveTo(w * 0.5, h * 0.5);
        g.arc(w * 0.5, h * 0.5, Math.sqrt(w * w + h * h) * 0.55, -Math.PI / 2, end);
        g.closePath();
        g.clip();
        g.drawImage(next, 0, 0, w, h);
        g.restore();
        blits += 1;
        // бегущая кромка
        g.save();
        g.globalAlpha = 0.35;
        g.strokeStyle = "#dff2ff";
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(w * 0.5, h * 0.5);
        g.lineTo(w * 0.5 + Math.cos(end) * Math.sqrt(w * w + h * h), h * 0.5 + Math.sin(end) * Math.sqrt(w * w + h * h));
        g.stroke();
        g.restore();
      }
      return blits;
    }

    // Неизвестный вид — не падаем и не оставляем пустой кадр: растворяем.
    drawFull(prev);
    drawFull(next);
    return blits;
  }

  /* Единая точка входа: способ + общие входные данные. «Рассыпание» идёт
   * прежним путём (клетки), остальные — через drawSpaceWipe. */
  function drawSpaceTransition(g, prevCache, nextCache, k, w, h, kind, cells, cols, rows, quality, intensity) {
    if (!kind || kind === "dissolve") {
      drawSpaceDissolve(g, prevCache, nextCache, k, w, h, cells, cols, rows, quality, intensity);
      return;
    }
    drawSpaceWipe(g, prevCache, nextCache, k, w, h, kind);
  }

  /* ------------------------------------------------- dissolve transition
   * Растворение одного фона в другой «частицами» на Canvas 2D.
   *
   * Почему не Three.js-шейдер из референса: в варпе уже есть единственный
   * Canvas 2D на слой фона, и второй WebGL-рендерер был бы и дублирующим
   * циклом, и лишним контекстом на слабом Android. Тот же эффект даётся
   * нарезкой кэша на ячейки: уходящая картинка разлетается, приходящая
   * собирается из тех же клеток. Никаких новых зависимостей.
   *
   * Стоимость: 2 * (cols * rows) drawImage за кадр перехода и 1 за кадр паузы.
   * На 12x7 это 168 blit-ов только в переходе; в паузе — один.
   */
  /* Положение клетки в кадре, 0 = центр, 1 = угол. Нужен для радиальной
   * волны распада; считается на месте, без дополнительных полей в клетке. */
  function cellRadius(cell) {
    var nx = (cell.col + 0.5) * 2 - 1;
    var ry = (cell.row + 0.5) * 2 - 1;
    var r = Math.sqrt(nx * nx + ry * ry) / 1.4142;
    return r > 1 ? 1 : r;
  }

  function drawSpaceDissolve(g, prevCache, nextCache, k, w, h, cells, cols, rows, quality, intensity, frame, maxDraws) {
    var t = clampUnit(k);
    var eased = t * t * (3 - 2 * t);
    var q = quality == null ? 1 : quality;
    var power = isFinite(intensity) && intensity > 0 ? Number(intensity) : 1;
    var cw = w / cols;
    var ch = h / rows;
    var prev = prevCache && prevCache.canvas;
    var next = nextCache && nextCache.canvas;
    var prevW = prev ? prev.width : 0;
    var prevH = prev ? prev.height : 0;
    var nextW = next ? next.width : 0;
    var nextH = next ? next.height : 0;
    var throwScale = (0.55 + 0.45 * q) * power;
    var spinScale = (0.6 + 0.4 * q) * power;

    /* Мелкий пиксель ведёт себя иначе, чем крупный.
     * При клетке меньше 8 px вращение превращается в мерцание: поворот
     * квадрата 5x5 px — это субпиксельный шум, а не «осколок». Поэтому у
     * мелкой сетки вращение гасится, а разлёт становится волной по радиусу:
     * картинка распадается кольцом от центра, как в референсах с шейдером,
     * вместо случайного конфетти. Крупная сетка (12x7) остаётся как была. */
    var cellSide = Math.min(cw, ch);
    var tiny = cellSide < 8;
    // Гашение поворота квадратичное: 6 px — уже почти без вращения, 9–10 px —
    // как раньше, 3 px — вращения практически нет (иначе субпиксельное мерцание).
    var spinFactor = Math.min(1, (cellSide / 10) * (cellSide / 10));
    spinScale *= Math.max(0.06, spinFactor);
    if (tiny) throwScale *= 1.15;

    // Уходящая картинка: клетки уезжают от центра, растут и гаснут.
    // На мелкой сетке добавляется радиальная волна: клетки с большим |u|
    // уходят позже, поэтому распад идёт кольцом, а не пятном.
    // Предохранитель кадра (см. WARP_SPACE_DISSOLVE): если клеток больше
    // maxDraws, каждый кадр рисует свою долю, а соседние доли берут следующие
    // кадры. Порядок детерминированный, от seed не зависит.
    var total = cells.length;
    // Потолок кадра задаёт вызывающий (по тиру устройства): на слабом ему
    // незачем столько же, сколько на ПК.
    var cap = Number(maxDraws);
    if (!isFinite(cap) || cap <= 0) cap = WARP_SPACE_DISSOLVE.maxDraws;
    var stride = total > cap ? Math.ceil(total / cap) : 1;
    var offset = stride > 1 ? (((Number(frame) || 0) % stride) + stride) % stride : 0;
    var drawn = 0;

    if (prev) {
      for (var i = offset; i < cells.length; i += stride) {
        var c = cells[i];
        // На мелкой сетке разлёт идёт кольцом от центра: радиус добавляет
        // задержку, поэтому картинка «раскрывается», а не рябит случайно.
        var delayEff = tiny ? c.delay * 0.45 + cellRadius(c) * 0.40 : c.delay;
        var local = (t - delayEff) / Math.max(0.001, 1 - delayEff);
        if (local <= 0) local = 0;
        if (local >= 1) continue;               // уже улетела
        var alpha = 1 - local;
        if (alpha <= 0.02) continue;
        var sx = c.col * cw;
        var sy = c.row * ch;
        var dist = local * c.spread * throwScale;
        var dx = sx + c.ux * dist * w * 0.55;
        var dy = sy + c.uy * dist * h * 0.55;
        var scale = 1 + local * 0.45;
        var side = cw * scale;
        var sideY = ch * scale;
        g.save();
        g.globalAlpha = alpha;
        g.translate(dx + cw * 0.5, dy + ch * 0.5);
        g.rotate(c.spin * spinScale * local);
        g.drawImage(
          prev,
          c.col * (prevW / cols), c.row * (prevH / rows),
          prevW / cols, prevH / rows,
          -side * 0.5, -sideY * 0.5, side, sideY
        );
        g.restore();
        drawn += 1;
      }
    }

    // Приходящая картинка: те же клетки слетаются на своё место.
    if (next) {
      for (var j = offset; j < cells.length; j += stride) {
        var c2 = cells[j];
        var local2 = eased;
        var delay2 = tiny ? c2.delay * 0.45 + (1 - cellRadius(c2)) * 0.30 : c2.delay * 0.3;
        var appear = clampUnit((local2 - delay2) / 0.7);
        if (appear <= 0) continue;
        var alpha2 = appear;
        var back = 1 - appear;
        var sx2 = c2.col * cw;
        var sy2 = c2.row * ch;
        var dist2 = back * c2.spread * throwScale;
        var dx2 = sx2 + c2.ux * dist2 * w * 0.55;
        var dy2 = sy2 + c2.uy * dist2 * h * 0.55;
        var scale2 = 1 + back * 0.45;
        var side2 = cw * scale2;
        var sideY2 = ch * scale2;
        g.save();
        g.globalAlpha = alpha2;
        g.translate(dx2 + cw * 0.5, dy2 + ch * 0.5);
        g.rotate(c2.spin * spinScale * back);
        g.drawImage(
          next,
          c2.col * (nextW / cols), c2.row * (nextH / rows),
          nextW / cols, nextH / rows,
          -side2 * 0.5, -sideY2 * 0.5, side2, sideY2
        );
        g.restore();
        drawn += 1;
      }
    }
    // Вспышка на пике перехода: короткая, только в середине, чтобы стык
    // «разошлось / собралось» читался как один удар, а не как два.
    if (power > 1.05) {
      var flare = Math.sin(t * Math.PI);
      if (flare > 0.02) {
        g.globalAlpha = 0.20 * flare * (power - 1);
        g.fillStyle = "#bfe6ff";
        g.fillRect(0, 0, w, h);
      }
    }
    g.globalAlpha = 1;
    return drawn;
  }

  /* ------------------------------------------------------------------ rings
   * Rings ride the same `point(depth, angle, extra)` the wall and obstacles
   * use, so they cannot desync from the corridor. They are thin, uniformly
   * coloured and never segmented, to avoid reading as a collision gate.
   */
  function drawWarpSpaceRings(g, point, profile, t, palette) {
    if (!profile || !profile.rings) return 0;
    var col = palette || "122,232,255";
    var drawn = 0;
    for (var i = 0; i < profile.rings; i += 1) {
      var phase = wrap01((i / profile.rings) + t * 0.028);
      var d = 0.06 + phase * 0.86;
      if (profile.ringStep > 1 && i % profile.ringStep !== 0) continue;
      var depthFade = Math.sin(phase * Math.PI);
      var alpha = profile.ringAlpha * depthFade;
      if (alpha <= 0.012) continue;
      // Число сэмплов по видимому радиусу: дальние кольца всё равно занимают
      // считанные пиксели, рисовать их 26 точками — чистая трата кадра.
      var edge = point(d, 0, 0);
      var midP = point(d, Math.PI, 0);
      var rx = Math.abs(edge.x - midP.x) * 0.5;
      var samples = Math.max(8, Math.min(26, Math.round(rx / 5)));
      g.beginPath();
      for (var s = 0; s <= samples; s += 1) {
        var p = point(d, (s / samples) * Math.PI * 2, 0);
        if (!s) g.moveTo(p.x, p.y);
        else g.lineTo(p.x, p.y);
      }
      g.strokeStyle = "rgba(" + col + "," + alpha.toFixed(3) + ")";
      g.lineWidth = 0.8 + depthFade * 1.1;
      g.stroke();
      drawn += 1;
    }
    return drawn;
  }

  /* Outward-travelling pulse rings for the "pulse" profile. */
  function drawWarpSpacePulse(g, px, py, rBase, t, profile, palette) {
    if (!profile || !profile.pulse) return 0;
    var col = palette || "190,255,255";
    var base = Math.abs(Number(rBase) || 0);
    var time = Number(t);
    if (!isFinite(time)) time = 0;
    var drawn = 0;
    for (var i = 0; i < 3; i += 1) {
      // Фаза нормализована: при обратном ходе (t < 0) раньше выходил
      // отрицательный радиус, и arc() ронял весь кадр.
      var phase = wrap01(time * 0.11 + i / 3);
      var r = base * (0.12 + phase * 1.05);
      if (!(r > 0.5)) continue;                 // страховка: никогда не 0 и не минус
      var alpha = 0.26 * (1 - phase) * (1 - phase);
      if (alpha <= 0.01) continue;
      g.strokeStyle = "rgba(" + col + "," + alpha.toFixed(3) + ")";
      g.lineWidth = 0.8 + (1 - phase) * 1.2;
      g.beginPath();
      g.arc(px, py, r, 0, Math.PI * 2);
      g.stroke();
      drawn += 1;
    }
    return drawn;
  }

  /* Ribbon seams: same path as the frame lines, three stacked wide strokes.
   * No shadowBlur — it is the single most expensive 2D effect on low-end GPUs. */
  function drawWarpSpaceRibbon(g, pathPoints, baseColor, thickness) {
    var k = isFinite(thickness) && thickness > 0 ? Number(thickness) : 1;
    var widths = [7 * k, 4 * k, 1.6 * k];
    var alphas = [0.10, 0.16, 0.95];
    for (var i = 0; i < widths.length; i += 1) {
      g.beginPath();
      pathPoints.forEach(function (p, index) {
        if (!index) g.moveTo(p.x, p.y);
        else g.lineTo(p.x, p.y);
      });
      g.strokeStyle = i === 0 || i === 1
        ? "rgba(122,232,255," + (alphas[i] * k) + ")"
        : baseColor;
      g.lineWidth = widths[i];
      g.lineCap = "round";
      g.stroke();
    }
  }

      return {
        WARP_SPACE_PROFILES,
        warpSpaceProfileFor,
        warpSpaceQuality,
        paintSpaceBackdrop,
        createSpaceBackdropCache,
        drawSpaceBackdrop,
        drawWarpSpaceRings,
        drawWarpSpacePulse,
        warpSpacePaletteAt,
        warpSpaceFlowMix,
        warpSpacePingPong,
        warpSpacePanelCss,
        warpSpacePanelRgb,
        warpSpaceSeamCss,
        warpSpaceAccentCss,
        warpSpaceRingRgb,
        warpSpaceSeedFor,
        warpSpaceNextSeed,
        warpSpaceDirectionFor,
        warpSpaceDirectionRamp,
        warpSpaceTier,
        warpSpaceTierParams,
        warpSpaceCycleConfig,
        warpSpaceCycleAt,
        WARP_SPACE_RANDOM,
        warpSpaceRandomCycleAt,
        warpSpaceRandomCyclePlan,
        WARP_SPACE_ASTEROIDS,
        WARP_SPACE_ASTEROID_SLOTS,
        warpSpaceAsteroidIds,
        warpSpaceAsteroidSizeOf,
        warpSpaceAsteroidField,
        warpSpaceAsteroidRadius,
        drawWarpSpaceAsteroids,
        warpSpaceCellField,
        warpSpaceQuadArea,
        warpSpacePanelVisible,
        drawSpaceDissolve,
        WARP_SPACE_DISSOLVE,
        warpSpaceDissolveBudget,
        warpSpaceDissolveFrameCap,
        WARP_SPACE_TRANSITIONS,
        warpSpaceTransitionIds,
        warpSpaceTransitionFor,
        drawSpaceWipe,
        drawSpaceTransition,
        WARP_SPACE_SHIP_SPECS,
        warpSpaceShipSpec,
        warpSpaceShipSize,
        paintShipRear,
        drawWarpShip,
        warpSpaceShipRollFor,
        warpSpaceCellGrid,
        warpSpaceDeviceProfile,
        WARP_SPACE_CELL_PRESETS,
        WARP_SPACE_SKETCHES,
        warpSpaceSketchFor,
        warpSpaceCoverRect,
        createSketchCache,
        rgbCss,
        rgbaCss
      };
    })();

    let warpSpaceCache = null;

    function warpSpaceProfile() {
      return warpSpace.warpSpaceProfileFor(
        activeWarpVisualClass(),
        Number(state.tubeBackdropSeed || 0) >>> 0
      );
    }

    function warpSpaceRingTint() {
      const cls = activeWarpVisualClass();
      return cls === 3 ? "189,139,246" : cls === 2 ? "115,193,206" : "122,232,255";
    }

    function warpSpacePulseTint() {
      return activeWarpVisualClass() === 3 ? "230,205,255" : "190,255,255";
    }

    // Фон рисуется один раз в offscreen-canvas и потом только копируется:
    // перерисовка градиентов и 240 звёзд каждый кадр — это и есть просадка
    // на слабом Android, а не сам blit.
    // Палитра: не переключение, а непрерывный перелив A <-> B. В каждой точке
    // стенки локальный mix опережает общий, поэтому смена цвета бежит волной —
    // тот же приём, что перелив текстуры на Rainbow Photoli.
    function warpSpaceGlobalMix() {
      if (!state.warpPaletteFlow) return Number(state.warpPaletteMix || 0);
      return warpSpace.warpSpacePingPong(state.elapsed, Number(state.warpPalettePeriod) || 11);
    }

    function warpSpaceLocalMix(spatialPhase) {
      // Волна только в режиме перелива. При закреплённой палитре mix равен цели
      // ровно, поэтому вид A воспроизводит 0.14.0 бит в бит.
      if (!state.warpPaletteFlow) return warpSpaceGlobalMix();
      return warpSpace.warpSpaceFlowMix(warpSpaceGlobalMix(), spatialPhase, state.elapsed, 0.22);
    }

    function warpSpacePalette(spatialPhase) {
      // Радуга включена по умолчанию: цвет берётся с цветового круга, фаза
      // сдвигается вдоль поверхности — полосы переливаются по стенке, а не
      // переключаются в один момент. Выключенная радуга возвращает переход
      // A <-> B, то есть при mix 0 — ровно вид 0.14.0.
      return warpSpace.warpSpacePaletteAt(
        activeWarpVisualClass(),
        warpSpaceLocalMix(spatialPhase),
        state.warpRainbow ? spatialPhase : null
      );
    }

    // Тир качества: если кадр стабильно дороже 22 мс, режем глубину стенки.
    // Порог и параметры — в ядре, здесь только сглаживание замера.
    function warpSpaceTierNow() {
      if (state.warpQualityTier) return state.warpQualityTier;
      return warpSpace.warpSpaceTier(Number(state.warpFrameMs || 0), Number(state.warpSlowStreak || 0));
    }

    // Глубина и число панелей НЕ зависят от тира: урезание ломало силуэт
    // (гранёная «бочка», потом «купол» на классе III). Экономия — только
    // отсечением субпиксельных панелей и разрешением фона.
    // ---------------------------------------------- астероиды на стенке
    // Спрайты уже вкомпилированы (window.BCM_WARP_ASTEROID_ART) — это печёные
    // кадры настоящих GLB из mini-sim/assets/mesh/asteroid_variety. Здесь их
    // только декодируем один раз: в кадре остаётся один drawImage на камень,
    // никакого GLTFLoader и второго WebGL-контекста.
    const warpAsteroidImageCache = new Map();
    let warpAsteroidReadyMap = null;

    function warpAsteroidArt() {
      return (typeof window !== "undefined" && window.BCM_WARP_ASTEROID_ART) || {};
    }

    function warpAsteroidImages() {
      const art = warpAsteroidArt();
      const ids = Object.keys(art);
      if (!ids.length) return null;
      let allReady = true;
      ids.forEach((id) => {
        let img = warpAsteroidImageCache.get(id);
        if (!img) {
          img = new Image();
          img.src = art[id];
          warpAsteroidImageCache.set(id, img);
        }
        if (!(img.complete && img.naturalWidth > 0)) allReady = false;
      });
      if (allReady && !warpAsteroidReadyMap) {
        warpAsteroidReadyMap = {};
        warpAsteroidImageCache.forEach((img, id) => {
          if (img && img.complete && img.naturalWidth > 0) warpAsteroidReadyMap[id] = img;
        });
      }
      return warpAsteroidReadyMap;
    }

    // ------------------------------------------------- завороты трубы
    // Вернули изгиб: амплитуда была срезана «на глаз» до 0.05, и стенка
    // читалась ровным цилиндром. Медленная волна даёт длинные завороты
    // (период ~14 с), вторая — короткое «дыхание» сечения.
    function warpTubeTurn(elapsed) {
      const e = Number(elapsed) || 0;
      const slow = Math.sin(e * 0.45) * 0.6 + Math.sin(e * 0.19 + 1.7) * 0.4;
      return {
        curve: 1.8 + 1.1 * slow,
        wobble: 1 + 0.06 * Math.sin(e * 0.33 + 0.6)
      };
    }

    // Плотность поля: на слабом тире камней вдвое меньше (они дороже панелей —
    // это drawImage 80–160 px, а не заливка полигона).
    function warpAsteroidDensityNow() {
      const base = Math.max(0, Math.min(1, Number(state.warpAsteroids) || 0));
      return warpSpaceTierNow() === "low" ? base * 0.55 : base;
    }

    function warpSpaceDepthSteps() {
      return 23;
    }

    function warpSpaceCullScale() {
      return warpSpace.warpSpaceTierParams(warpSpaceTierNow()).cullScale;
    }

    // ---------------------------------------------------------- устройство
    // Пиксель перехода и разрешение канвы подбираются под железо, а не
    // выдаются всем одинаково: телефон с DPR 3 — это 3 млн пикселей на кадр
    // ни за что, а ПК зря получал грубую мозаику 18x10.
    const warpDevice = (() => {
      let cores = 0;
      let coarse = false;
      try {
        if (typeof navigator !== "undefined" && navigator.hardwareConcurrency) {
          cores = Number(navigator.hardwareConcurrency) || 0;
        }
        if (typeof window !== "undefined" && window.matchMedia) {
          coarse = !!window.matchMedia("(pointer: coarse)").matches;
        }
      } catch (e) {}
      const dpr = typeof window !== "undefined" && window.devicePixelRatio ? window.devicePixelRatio : 1;
      const shortSide = typeof window !== "undefined"
        ? Math.min(Number(window.innerWidth) || 0, Number(window.innerHeight) || 0)
        : 0;
      return warpSpace.warpSpaceDeviceProfile({ cores, dpr, shortSide, coarsePointer: coarse });
    })();

    // Ручная ступень из хука; null = авто по профилю устройства.
    function warpCellBudget(w) {
      const preset = warpSpace.WARP_SPACE_CELL_PRESETS[String(state.warpCellSize || "")];
      let budget = typeof preset === "number" ? preset : warpDevice.cellBudget;
      if (warpSpaceTierNow() === "low") {
        budget = Math.min(budget, warpSpace.WARP_SPACE_CELL_PRESETS.coarse);
      }
      return budget;
    }

    // Ревизия 19: «частицы рассыпания в 23 раза мельче» — считаем по площади,
    // то есть клеток ровно в 23 раза больше (клетка ~3 px вместо ~15). Меньше
    // 3 px уже упирается в warpSpaceCellGrid, поэтому дальше не мельчим.
    function warpDissolveBudget() {
      return warpSpace.warpSpaceDissolveBudget(warpCellBudget());
    }

    // Потолок отрисовки за кадр: переполненная сетка дорисовывается долями по
    // номеру кадра, на слабом тире доля меньше — иначе кадр не влезает.
    function warpDissolveFrameCap() {
      return warpSpace.warpSpaceDissolveFrameCap(warpSpaceTierNow());
    }

    function warpCellGrid(w, h) {
      return warpSpace.warpSpaceCellGrid(warpDissolveBudget(), w, h);
    }

    // ------------------------------------------------- способ смены кадра
    // Приоритет — рассыпание (по указанию владельца). Остальные виды — как
    // двери в первой комнате: каждый переход может открываться по-своему.
    function warpSpaceTransitionNow(randomKind) {
      if (state.warpTransitionAuto) {
        // Случайный ритм уже выбрал вид за нас — главнее «по кругу».
        if (state.warpBgRandom && randomKind &&
            warpSpace.warpSpaceTransitionIds().indexOf(randomKind) >= 0) {
          return randomKind;
        }
        // step начинается с 1 (первый переход), индекс — с 0
        return warpSpace.warpSpaceTransitionFor(Math.max(0, Number(state.warpTransitionStep || 1) - 1));
      }
      const want = String(state.warpTransition || "dissolve");
      return warpSpace.warpSpaceTransitionIds().indexOf(want) >= 0 ? want : "dissolve";
    }

    // -------------------------------------------------- корабль, вид сзади
    // Маленький силуэт внутри кольца. Если игра передала запечённый спрайт
    // настоящей модели (BCMDeepSpaceWarpSetShipSprite), рисуется он: в кадре
    // это один drawImage, второй WebGL-контекст не создаётся.
    // Размеры кадра: во время отрисовки они приходят из drawTubeTunnel, а при
    // вызове хука снаружи берутся из window. Без этого хук падал бы с
    // ReferenceError на w/h — ровно тот класс ошибки, что ловят новые стражи.
    function warpFrameSize() {
      const fw = Number(state.warpW || (typeof window !== "undefined" ? window.innerWidth : 800)) || 800;
      const fh = Number(state.warpH || (typeof window !== "undefined" ? window.innerHeight : 500)) || 500;
      return { w: fw, h: fh };
    }

    function warpShipInfo() {
      const spec = warpSpace.warpSpaceShipSpec(state.warpShipSpec);
      const frame = warpFrameSize();
      const size = warpSpace.warpSpaceShipSize(frame.w, frame.h) * (Number(state.warpShipScale) || 1);
      return {
        spec: spec.id,
        engines: spec.engines,
        sprite: !!state.warpShipSprite,
        roll: Number(state.warpShipRollShown || 0),
        manualRoll: Number(state.warpShipRoll || 0),
        size: Math.round(size)
      };
    }

    function drawWarpShipLayer(g, x, y, bank, thrust, roll) {
      const frame = warpFrameSize();
      const size = warpSpace.warpSpaceShipSize(frame.w, frame.h) * (Number(state.warpShipScale) || 1);
      warpSpace.drawWarpShip(g, x, y, size, state.warpShipSpec, bank, thrust,
        state.warpShipSprite || null, roll);
      return size;
    }

    // Кэш фоновых сцен. Ритм смены кадра быстрый (~2 с пауза), поэтому сцены
    // идут по кругу из пула: строить полноэкранный фон на каждый переход —
    // заметный рывок на слабом Android. Пул 4: текущая, следующая и две под
    // переиспользование. Разнообразие даёт способ перехода и сила, а не
    // бесконечная генерация новых звёзд.
    const WARP_BG_POOL = 4;
    const warpBgStore = new Map();
    const warpBgOrder = [];
    let warpBgCreated = 0;

    function warpBgSceneSlot(index) {
      const i = Number(index) || 0;
      return ((i % WARP_BG_POOL) + WARP_BG_POOL) % WARP_BG_POOL;
    }

    function warpBgKey(index, w, h) {
      const profile = warpSpaceProfile();
      const seed = warpSpace.warpSpaceSeedFor(Number(state.tubeBackdropSeed || 0) >>> 0, profile);
      return warpBgSceneSlot(index) + "|" + seed + "|" + profile.id + "|" + Math.round(w) + "x" + Math.round(h) +
        "|" + warpSpaceTierNow();
    }

    function warpBgTouch(key) {
      const at = warpBgOrder.indexOf(key);
      if (at >= 0) warpBgOrder.splice(at, 1);
      warpBgOrder.push(key);
    }

    // ---------------------------------------------------------------------
    // Обои seed из mini-sim/assets/scetchs (векторные скетчи 1600x900).
    // Путь берётся из config.assets — тем же способом, что и GLB для астероидной
    // стенки (loadAsteroidWallAssetTemplate) — с запасным путём рядом со скриптом.
    // Пока картинки нет или файл не найден, на экране процедурный фон: кадр не
    // пустует, исключений нет, повторных запросов к отсутствующему файлу нет.
    // SVG тяжёлый (300-600 элементов + feGaussianBlur), поэтому растеризация
    // делается один раз в offscreen-кэш, а не каждый кадр.
    // ---------------------------------------------------------------------
    const warpSketchImages = new Map();      // имя -> Image | null (null = отказ)
    const warpSketchLoading = new Set();
    const warpSketchScenes = new Map();      // "имя|WxH" -> готовая сцена
    const warpSketchSceneOrder = [];

    function warpSketchBaseUrl() {
      const explicit = String(config.warpSketchBaseUrl || "").trim();
      if (explicit) return explicit.charAt(explicit.length - 1) === "/" ? explicit : explicit + "/";
      try {
        const doc = typeof document !== "undefined" ? document : null;
        const script = doc && (doc.currentScript ||
          (doc.querySelector && doc.querySelector('script[src*="deep-space-warp"]')));
        const src = script && script.src ? String(script.src) : "";
        // assets/js/deep-space-warp.js -> assets/scetchs/
        if (src) return src.split(/[?#]/)[0].replace(/[^/]*$/, "") + "../scetchs/";
      } catch (e) {}
      return "assets/scetchs/";
    }

    function warpSketchUrl(name) {
      const assets = Array.isArray(config.assets) ? config.assets : [];
      const wanted = String(name || "").toLowerCase();
      const asset = assets.find((item) => {
        if (!item || typeof item.url !== "string" || !item.url) return false;
        const file = String(item.name || item.filename || item.path || item.url)
          .split(/[?#]/)[0].split("/").pop().toLowerCase();
        return file === wanted;
      });
      if (asset) return asset.url;
      return warpSketchBaseUrl() + name;
    }

    function warpSketchName(index) {
      if (state.warpSketch) return String(state.warpSketch);
      return warpSpace.warpSpaceSketchFor(index);
    }

    function loadWarpSketch(name) {
      if (!name || warpSketchImages.has(name) || warpSketchLoading.has(name)) return;
      if (typeof Image !== "function") return;
      const img = new Image();
      warpSketchLoading.add(name);
      img.onload = () => {
        warpSketchLoading.delete(name);
        warpSketchImages.set(name, img);
        warpSketchDropPending();
      };
      img.onerror = () => {
        warpSketchLoading.delete(name);
        warpSketchImages.set(name, null);   // запоминаем отказ: фолбэк постоянный
      };
      try {
        if ("decoding" in img) img.decoding = "async";
        img.src = warpSketchUrl(name);
      } catch (e) {
        warpSketchLoading.delete(name);
        warpSketchImages.set(name, null);
      }
    }

    // Сбрасываем ТОЛЬКО сцены, ждавшие картинку: соседний фон валиден и не
    // перестраивается (иначе лишняя растеризация прямо посреди паузы).
    function warpSketchDropPending() {
      const stale = [];
      warpBgStore.forEach((value, key) => {
        if (value && value.pendingSketch) stale.push(key);
      });
      for (let i = 0; i < stale.length; i += 1) {
        warpBgStore.delete(stale[i]);
        const at = warpBgOrder.indexOf(stale[i]);
        if (at >= 0) warpBgOrder.splice(at, 1);
      }
    }

    function warpSketchScene(name, w, h) {
      if (!name) return null;
      if (!warpSketchImages.has(name)) loadWarpSketch(name);
      const img = warpSketchImages.get(name);
      if (!img) return null;
      const key = name + "|" + Math.round(w) + "x" + Math.round(h);
      const hit = warpSketchScenes.get(key);
      if (hit) return hit;
      const made = warpSpace.createSketchCache(img, w, h, (cw, ch) => {
        const canvas = document.createElement("canvas");
        canvas.width = cw;
        canvas.height = ch;
        return canvas;
      });
      if (!made) return null;
      warpSketchScenes.set(key, made);
      warpSketchSceneOrder.push(key);
      while (warpSketchSceneOrder.length > 3) {
        warpSketchScenes.delete(warpSketchSceneOrder.shift());
      }
      return made;
    }

    function warpBgGet(index, w, h) {
      const sketchMode = state.warpArtMode !== "procedural";
      const key = warpBgKey(index, w, h) + "|" + (sketchMode ? "sk" : "pr");
      const cached = warpBgStore.get(key);
      if (cached) { warpBgTouch(key); return cached; }
      const profile = warpSpaceProfile();
      const makeCanvas = (cw, ch) => {
        const canvas = document.createElement("canvas");
        canvas.width = cw;
        canvas.height = ch;
        return canvas;
      };
      const sketchName = sketchMode ? warpSketchName(index) : null;
      let built = sketchName ? warpSketchScene(sketchName, w, h) : null;
      if (!built) {
        const base = warpSpace.warpSpaceSeedFor(Number(state.tubeBackdropSeed || 0) >>> 0, profile);
        const seed = warpSpace.warpSpaceNextSeed(base, index);
        built = warpSpace.createSpaceBackdropCache(w, h, seed, profile, makeCanvas);
        // Пока SVG в пути — процедурный фон уже на экране, кадр не пустует.
        // Если файла нет вовсе, флаг не ставится и пересборки не будет.
        if (sketchName && warpSketchLoading.has(sketchName)) built.pendingSketch = true;
      }
      built.key = key;
      warpBgCreated += 1;
      warpBgStore.set(key, built);
      warpBgTouch(key);
      while (warpBgOrder.length > WARP_BG_POOL) {
        const oldest = warpBgOrder.shift();
        if (oldest !== key) warpBgStore.delete(oldest);
      }
      return built;
    }

    function warpBgReset() {
      warpBgStore.clear();
      warpBgOrder.length = 0;
      state.warpBgCells = null;
    }

    // Текущий отрезок ритма: случайный (по умолчанию) либо тактовая сетка.
    // Обе ветки возвращают одинаковый набор полей, поэтому кадр ниже один.
    function warpBgCycleState(remaining) {
      const elapsed = Number(state.elapsed || 0);
      if (state.warpBgRandom) {
        return warpSpace.warpSpaceRandomCycleAt(elapsed, {
          seed: Number(state.warpBgSeed || 0),
          hold: Number(state.warpBgHold) || 2
        }, remaining);
      }
      const cfg = warpSpace.warpSpaceCycleConfig(3, 15, Number(state.warpBgBpm) || 142);
      const cs = warpSpace.warpSpaceCycleAt(elapsed, cfg, remaining);
      cs.kind = null;
      cs.power = Number(state.warpBgPower) || 1.6;
      return cs;
    }

    // Сила перехода: в случайном ритме она тоже своя на каждый переход, но
    // общий регулятор игры (warpBgPower) остаётся главным — он множитель.
    function warpBgPowerNow(cs) {
      const base = Number(state.warpBgPower) || 1.6;
      if (!state.warpBgRandom || !cs || !isFinite(cs.power)) return base;
      const scaled = Number(cs.power) * (base / 1.6);
      return Math.max(0.6, Math.min(3, scaled));
    }

    // Декоративный фон живёт своим циклом: 3 с переход частицами, 4,5 с пауза.
    // Переход не начинается, если до прибытия он не успеет дорисоваться.
    function drawWarpSpaceBackdrop(g, w, h, t) {
      const remaining = Math.max(0, WARP_DURATION - Number(state.elapsed || 0));
      // Номер кадра нужен рассыпанию: при переполненной сетке оно рисует долю
      // клеток, и без счётчика одна и та же доля повторялась бы каждый кадр.
      state.warpFrameNo = (Number(state.warpFrameNo || 0) + 1) % 100000;

      if (!state.warpBgCycle) {
        warpSpace.drawSpaceBackdrop(g, warpBgGet(Number(state.warpBgIndex || 0), w, h), w, h, t);
        return;
      }

      // Ритм сцены. По умолчанию — СЛУЧАЙНЫЙ: пауза ~2 с, переход ~0.9 с, и
      // каждый переход берёт свой способ из всех шести (случайный «мешок» без
      // повторов подряд) и свою силу. Тактовую сетку (142 BPM) владелец оставил
      // вторым режимом: BCMDeepSpaceWarpSetRandomCycle(false).
      const cs = warpBgCycleState(remaining);
      const current = warpBgGet(cs.from, w, h);

      if (cs.phase === "hold") {
        warpBgGet(cs.from + 1, w, h);            // предзагрузка в паузе
        warpSpace.drawSpaceBackdrop(g, current, w, h, t);
        state.warpBgIndex = cs.from;
        state.warpBgCells = null;
        return;
      }

      const incoming = warpBgGet(cs.to, w, h);
      const low = warpSpaceTierNow() === "low";
      // Шаг «по кругу» считается по входу в переход: каждый новый переход —
      // следующая дверь, как в первой комнате. Последовательность детерминированная.
      if (state.warpTransitionFrom !== cs.to) {
        state.warpTransitionFrom = cs.to;
        state.warpTransitionStep = Number(state.warpTransitionStep || 0) + 1;
      }
      const kind = warpSpaceTransitionNow(cs.kind);
      state.warpBgKind = kind;
      if (kind !== "dissolve") {
        // Остальные виды — clip + 1–2 drawImage: дешевле рассыпания.
        warpSpace.drawSpaceTransition(g, current, incoming, cs.k, w, h, kind);
        state.warpBgIndex = cs.to;
        state.warpBgCells = null;
        return;
      }
      if (!state.warpBgCells) {
        // Пиксель перехода считается под кадр и под устройство, а в ревизии 19
        // ещё и мельче в 23 раза по площади: на ПК это ~437x273 клетки (клетка
        // 3.3 px), на телефоне ~44x94, на слабом — ещё грубее. Рисуется такая
        // сетка долями за кадр (warpSpaceDissolveFrameCap), поэтому снаружи
        // видна не мозаика 15 px, а мелкое рассыпание, собирающееся за ~10
        // кадров. Сетка пересчитывается на каждый переход, поэтому смена
        // размера окна или тира не оставляет старую.
        const grid = warpCellGrid(w, h);
        state.warpBgCells = warpSpace.warpSpaceCellField(grid.cols, grid.rows, cs.from * 7919 + cs.to);
        state.warpBgCols = grid.cols;
        state.warpBgRows = grid.rows;
      }
      warpSpace.drawSpaceDissolve(g, current, incoming, cs.k, w, h,
        state.warpBgCells, state.warpBgCols, state.warpBgRows, low ? 0.35 : 1,
        warpBgPowerNow(cs), state.warpFrameNo, warpDissolveFrameCap());
      state.warpBgIndex = cs.to;
    }

    // Остановка по РЕАЛЬНОМУ событию прибытия: finishTube() переводит режим из
    // tube, после чего фон больше не цикличный и таймер не запускается.
    function stopWarpBackgroundCycle() {
      state.warpBgCycle = false;
      state.warpBgCells = null;
      warpBgReset();
    }

    function drawTubeTunnel(g, w, h, now) {
      state.warpW = w;
      state.warpH = h;
      const visualClass = activeWarpVisualClass();
      // Профиль нужен до расчёта направления: под «Пульсом» стенка идёт назад.
      const spaceProfile = warpSpaceProfile();
      // Class II reverses visible corridor motion, not just its colour pulse.
      // Course timing and obstacle collision remain on the same forward clock.
      // Профиль с reverseMotion разворачивает ход ещё раз, поэтому два
      // разворота дают нормальный ход — XOR, а не двойное отрицание вслепую.
      const flowDirection = warpSpace.warpSpaceDirectionFor(visualClass, spaceProfile);
      const t = Number(state.tubeTravel || 0) * flowDirection;
      const shimmerTime = Number(state.tubeShimmerTime || 0) * flowDirection;
      const flowPhase = ((t * 0.052 + 0.12) % 1 + 1) % 1;
      const flowPulsePosition = 1 - flowPhase;
      // Restore a clear but controlled roll so the pilot can feel the corridor moving.
      const axialRoll = Number(state.tubeRoll || 0) * flowDirection + Math.sin(t * 0.13) * 0.20;
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
      // Завороты трубы: медленная волна изгиба плюс «дыхание» сечения.
      // Раньше амплитуда была 0.05, и стенка читалась ровным цилиндром.
      const tubeTurn = warpTubeTurn(state.elapsed);

      // The near ring stays on screen. Depth only shifts the far vanishing point,
      // so a bend cannot unwind the cylinder into the spiral seen in 0.9.90.
      const centerX = (d) => mid +
        (Math.sin(t * 0.19 + d * 4.3) * 0.045 +
         Math.sin(t * 0.11 + d * 7.1) * 0.02 +
         Math.sin(d * Math.PI * 1.55 + phase) * curveScale * 0.05 * tubeTurn.curve +
         Math.sin(loopPhase + d * Math.PI * 2.4) * loopMix * 0.06) * minDim * (1 - d);
      const centerY = (d) => h * 0.5 +
        (Math.sin(t * 0.15 + d * 3.6) * 0.035 +
         Math.sin(t * 0.09 + d * 7.7) * 0.018 +
         Math.sin(d * Math.PI * 1.25 + phase) * liftScale * 0.04 * tubeTurn.curve +
         Math.sin(loopPhase + d * Math.PI * 2.4) * loopMix * 0.05) * minDim * (1 - d);
      const radiusX = (d) => 4 + maxRadius * Math.pow(Math.max(0, d), 1.20) * widthScale * tubeTurn.wobble;
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

      // Космос виден вокруг силуэта трубы и в дальнем отверстии.
      // Рисуется до стенки: стенка непрозрачна, значит препятствия не перекрываются.
      drawWarpSpaceBackdrop(g, w, h, t);

      // Build the inside wall from circumferential panels. Seams, panel
      // highlights, rings, and obstacles all rotate around the tunnel axis.
      const depthSteps = warpSpaceDepthSteps();
      // 18 панелей для всех классов: при 12 у класса III сечение читалось
      // как гранёный «купол» — это и было видно на скриншотах.
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
          // Субпиксельные панели у точки схода не видны, но каждый fill стоит
          // вызова. Площадь — полная шнуровка (ядро: warpSpacePanelVisible).
          // Раньше здесь стоял один член |dx1*dy2|: на 0° и 180° радиальное
          // ребро горизонтально, произведение обнулялось, и здоровая панель
          // выбрасывалась — это и были «дыры» в стенке на живом сайте.
          if (!warpSpace.warpSpacePanelVisible(p00, p01, p10, warpSpaceCullScale())) continue;
          // Перекрытие на 1 px: у соседних панелей общие рёбра, и любое
          // сглаживание края давало волосяные щели. Расширяем от центра.
          const cxq = (p00.x + p01.x) / 2;
          const cyq = (p00.y + p01.y) / 2;
          const push = (p) => {
            const dx = p.x - cxq;
            const dy = p.y - cyq;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            return { x: p.x + (dx / len) * 1.0, y: p.y + (dy / len) * 1.0 };
          };
          const q00 = push(p00), q01 = push(p01), q11 = push(p11), q10 = push(p10);
          g.beginPath();
          g.moveTo(q00.x, q00.y);
          g.lineTo(q01.x, q01.y);
          g.lineTo(q11.x, q11.y);
          g.lineTo(q10.x, q10.y);
          g.closePath();
          const shimmer = Math.sin(shimmerTime * 1.35 + panel * 1.72 + step * 0.77 + playerAngle) * 0.5 + 0.5;
          const light = (((step + Math.floor(shimmerTime * 8) + panel * 3) % 5 + 5) % 5 === 0) ? 1 : 0;
          // Цвет панели берётся из палитры класса с локальным сдвигом перелива,
          // поэтому смена A -> B идёт волной вдоль стенки, а не разом.
          // Цвет панели целиком из палитры (при радуге — из цветового круга).
          // warpSpacePanelCss сам добавляет модуляцию shimmer/light: в радужном
          // режиме она идёт по светлоте того же оттенка, чтобы огоньки не
          // уводили красную стенку в бирюзу.
          const panelMix = warpSpaceLocalMix(panel / panelCount + step * 0.04);
          g.fillStyle = warpSpace.warpSpacePanelCss(
            activeWarpVisualClass(), shimmer, light, panelMix,
            state.warpRainbow ? (panel / panelCount + step * 0.04) : null
          );
          g.fill();
          // No transverse panel outlines: they read as hoops at speed.
          // The longitudinal strips below are the sole continuous surface lines.
        }
      }

      // Астероиды на стенке: настоящие меши, испечённые в спрайты. Рисуются
      // после панелей (стенка уже залита) и до колец, чтобы кольца и пульс
      // остались поверх — иначе поле перекрывает ориентиры глубины.
      if (Number(state.warpAsteroids) > 0) {
        warpSpace.drawWarpSpaceAsteroids(g, point, maxRadius,
          Number(state.warpAsteroidSeed || 0) >>> 0,
          warpAsteroidDensityNow(), warpAsteroidImages(),
          Number(state.elapsed || 0));
      }

      // Глубинные кольца и (опционально) расходящийся пульс. Тонкие, одного
      // цвета, без разрывов — чтобы не читались как ворота столкновения.
      const seamPalette = warpSpacePalette(0.25);
      warpSpace.drawWarpSpaceRings(g, point, spaceProfile, t, warpSpace.rgbCss(seamPalette.ring));
      warpSpace.drawWarpSpacePulse(g, centerX(0.5), centerY(0.5),
        maxRadius * 0.9, t, spaceProfile, warpSpace.rgbCss(seamPalette.accent));

      // Keep the established 12 longitudinal frame lines. Their geometry and
      // width stay unchanged; only a colour pulse moves along each same path.
      for (let seam = 0; seam < 12; seam += 1) {
        const theta = seam * Math.PI * 2 / 12;
        g.beginPath();
        let frameStart = null;
        let frameEnd = null;
        for (let step = 0; step <= 35; step += 1) {
          const d = 0.04 + (step / 35) * 0.96;
          const p = point(d, theta + (d - 0.92) * 0.36, -1.5);
          if (!step) {
            frameStart = p;
            g.moveTo(p.x, p.y);
          } else {
            if (step === 35) frameEnd = p;
            g.lineTo(p.x, p.y);
          }
        }

        const seamPalette = warpSpacePalette(seam / 12);
        const baseColor = seam % 3 === 0
          ? warpSpace.rgbaCss(seamPalette.seamThick, 0.80)
          : warpSpace.rgbaCss(seamPalette.seamThin, 0.26);
        const pulseColor = warpSpace.rgbaCss(seamPalette.accent, 1);
        const flowGradient = g.createLinearGradient(frameStart.x, frameStart.y, frameEnd.x, frameEnd.y);
        const pulseWidth = 0.085;
        const pulseStart = Math.max(0, flowPulsePosition - pulseWidth);
        const pulseEnd = Math.min(1, flowPulsePosition + pulseWidth);
        flowGradient.addColorStop(0, baseColor);
        if (pulseStart > 0) flowGradient.addColorStop(pulseStart, baseColor);
        flowGradient.addColorStop(flowPulsePosition, pulseColor);
        if (pulseEnd < 1) flowGradient.addColorStop(pulseEnd, baseColor);
        flowGradient.addColorStop(1, baseColor);
        g.strokeStyle = flowGradient;
        if (spaceProfile.ribbon && seam % 3 === 0) {
          // Лента: широкий мягкий проход под чёткой линией. Без shadowBlur —
          // это самый дорогой 2D-эффект на слабых GPU.
          g.globalAlpha = 0.16;
          g.lineWidth = 6;
          g.stroke();
          g.globalAlpha = 0.28;
          g.lineWidth = 2.6;
          g.stroke();
          g.globalAlpha = 1;
        }
        g.lineWidth = seam % 3 === 0 ? 1.25 : 0.65;
        g.stroke();
      }

      // Class II is a quieter tint of the same tunnel, not a second set of rails.
      // Class III has a distinct violet identity without circular geometry.
      if (visualClass === 3) {
        g.fillStyle = "rgba(30,11,54,0.34)";
        g.fillRect(0, 0, w, h);
      }

      const routeProgress = warpObstacleProgress(state.elapsed);
      const obstacleDepth = (distance) => {
        // Keep only the next section of the course visible at once. The earlier
        // 0.68 window placed too many gates on screen together and flattened depth.
        if (distance > 0.36 || distance <= 0) return null;
        return Math.min(1, 0.055 / (distance + 0.05));
      };
      state.layers.forEach((layer) => {
        const distance = layer.progress - routeProgress;
        const d = obstacleDepth(distance);
        if (d == null) return;
        const rx = radiusX(d);
        const strokeWidth = Math.max(5, rx * 0.065);
        if (layer.type === "gate") {
          // Show a broken segmented barrier and leave the exact collision-safe gap open.
          // Small breaks between segments keep it from reading as a solid decorative hoop.
          const pieces = 32;
          for (let i = 0; i < pieces; i += 1) {
            const from = i * Math.PI * 2 / pieces;
            const to = (i + 1) * Math.PI * 2 / pieces;
            if (Math.abs(angleDifference((from + to) * 0.5, layer.safeAngle)) <= layer.gapHalf) continue;
            drawArc(d, from + 0.012, to - 0.012,
              i % 4 === 0 ? "rgba(255,191,119,0.98)" : "rgba(117,204,222,0.92)",
              strokeWidth);
          }
        } else if (layer.type === "sweeper") {
          const angle = layer.sweepAngle + state.elapsed * layer.sweepSpeed;
          const p0 = point(d, angle, -rx * 0.02);
          const p1 = point(d, angle + Math.PI, -rx * 0.02);
          g.beginPath();
          g.moveTo(p0.x, p0.y);
          g.lineTo(centerX(d), centerY(d));
          g.lineTo(p1.x, p1.y);
          g.strokeStyle = "rgba(255,112,86,0.98)";
          g.lineWidth = Math.max(5, rx * 0.095);
          g.lineCap = "round";
          g.stroke();
          g.strokeStyle = "rgba(255,231,200,0.96)";
          g.lineWidth = Math.max(1.6, rx * 0.025);
          g.stroke();
        } else if (layer.type === "spikes") {
          // Bright inward-pointing hazard teeth; no full ring and no checkmark glyphs.
          layer.blockedAngles.forEach((angle, index) => {
            const tip = point(d, angle, -rx * 0.28);
            const sideA = point(d, angle - 0.11, -rx * 0.035);
            const sideB = point(d, angle + 0.11, -rx * 0.035);
            g.beginPath();
            g.moveTo(sideA.x, sideA.y);
            g.lineTo(tip.x, tip.y);
            g.lineTo(sideB.x, sideB.y);
            g.closePath();
            g.fillStyle = index % 2 ? "rgba(255,104,75,0.95)" : "rgba(255,177,112,0.95)";
            g.strokeStyle = "rgba(255,226,194,0.98)";
            g.lineWidth = 1.4;
            g.fill();
            g.stroke();
          });
        }
        // Boost/launcher pickups remain functional but have no distracting checkmark decoration.
      });

      // The ship rides the wall. Right decreases the angle so it moves screen-right
      // from the bottom; the tunnel itself stays put.
      // Корабль: вид СЗАДИ, маленький, внутри кольца. Раньше здесь был
      // плоский глиф сверху и он был крупным; теперь силуэт сзади (двигатели
      // к камере), размер ограничен, управление то же — он едет по стенке.
      const nearDepth = 0.92;
      const craftPoint = point(nearDepth, playerAngle, -radiusX(nearDepth) * 0.20);
      const craftThrust = 0.55 + (Math.sin(now * 0.006) + 1) * 0.22;
      // Корабль висит на стенке: «верх» силуэта смотрит к центру кольца,
      // поэтому при ходе по кольцу он честно переворачивается (на верхней
      // точке — вверх тормашками). Ручной крен Q/E добавляется сверху.
      const craftRing = playerAngle + courseTwist(nearDepth);
      const craftRoll = warpSpace.warpSpaceShipRollFor(craftRing, Number(state.warpShipRoll) || 0);
      state.warpShipRollShown = craftRoll;
      const craftSize = drawWarpShipLayer(g, craftPoint.x, craftPoint.y,
        (state.steerBank || 0) * 1.4, craftThrust, craftRoll);
      // Кольцо вокруг корабля: видно, что он маленький и летит по стенке,
      // а не «висит» на экране. Тонкое, декоративное, на столкновения не влияет.
      g.save();
      g.globalAlpha = 0.20 + 0.10 * Math.sin(now * 0.004);
      g.strokeStyle = "rgba(200,245,255,0.85)";
      g.lineWidth = 1;
      g.beginPath();
      g.arc(craftPoint.x, craftPoint.y, craftSize * 0.95, 0, Math.PI * 2);
      g.stroke();
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
      // Keep stars as static atmosphere outside the tube; the tube wall itself
      // carries the animated directional cue through circumferential bands below.
      if (state.mode !== "tube" && state.mode !== "result") {
        state.stars.forEach((star) => {
          star.phase += dt * 0.1;
          ctx.fillStyle = "rgba(225,239,255," + (0.35 + Math.sin(star.phase) * 0.15) + ")";
          ctx.fillRect(star.x * w, star.y * h, star.size, star.size);
        });
      }

      if (state.mode === "map") {
        // Sector navigation is rendered in the real X/Y coordinate canvas inside the menu.
        // Keep this full-screen backdrop purely atmospheric so it cannot imply a second,
        // radial or fabricated sector layout behind the actual map.
      } else if (state.mode === "tube" || state.mode === "result") {
        if (state.mode === "tube") updateTube(dt, now);
        drawTubeTunnel(ctx, w, h, now);
      }

      if (!overlay.hidden) requestAnimationFrame(drawBackdrop);
      else state.animationRunning = false;
    }

    function updateTube(dt, now) {
      // Сглаженный замер кадра. Понижение качества — только по устойчивому
      // ряду медленных кадров: один тяжёлый кадр не должен менять вид.
      state.warpFrameMs = state.warpFrameMs
        ? state.warpFrameMs * 0.94 + dt * 1000 * 0.06
        : dt * 1000;
      state.warpSlowStreak = state.warpFrameMs > 26
        ? Number(state.warpSlowStreak || 0) + 1
        : 0;
      // Направление хода стенки меняется плавно, а не за один кадр.
      state.warpDirMix = warpSpace.warpSpaceDirectionRamp(
        state.warpDirMix, warpSpace.warpSpaceDirectionFor(activeWarpVisualClass(), warpSpaceProfile()), dt);
      // При выключенном переливе mix плавно догоняет цель: переключение
      // A -> B занимает около секунды, а не происходит мгновенно.
      if (!state.warpPaletteFlow) {
        const mixNow = Number(state.warpPaletteMix || 0);
        const mixTarget = Number(state.warpPaletteTarget || 0);
        if (Math.abs(mixTarget - mixNow) > 0.001) {
          state.warpPaletteMix = mixNow + (mixTarget - mixNow) * Math.min(1, dt * 1.6);
        }
      }
      state.elapsed = Math.max(0, (now - state.startedAt) / 1000);
      const speedBySection = [0.76, 1.24, 0.84, 1.34, 0.68, 1.14];
      const rollRates = [0.42, 0.82, 0.55, 1.12, 0.31, 0.72];
      const boosted = state.elapsed < Number(state.tubeBoostUntil || 0);
      const rampMultiplier = warpSpeedMultiplier(state.elapsed);
      const speed = Math.max(1, Math.min(12,
        tubeSectionBlend(speedBySection, state.elapsed).value * 1.25 *
        rampMultiplier * (boosted ? 1.4 : 1)
      ));
      // Give the tube geometry a modestly faster sense of forward movement,
      // while keeping its established material shimmer tempo independent.
      state.tubeTravel += dt * speed * 1.48;
      state.tubeShimmerTime = Number(state.tubeShimmerTime || 0) + dt * speed;
      state.tubeRoll = Number(state.tubeRoll || 0) + dt * tubeSectionBlend(rollRates, state.elapsed).value * 0.72;
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
        "SPEED " + speed.toFixed(1) + "× · " +
        Math.round(playerAngle * 180 / Math.PI) + "°";
      tubeShield.style.width = state.shields + "%";
    }

    window.BCMDeepSpaceWarpToggle = function () {
      if (state.mode === "closed") {
        openMap();
      } else if (state.mode === "maze" && state.maze && state.maze.active &&
          !state.ringPlatformer && !state.ringTransitionActive && !state.hullOpen) {
        returnToWarpMap();
      }
    };

    window.BCMDeepSpaceWarpEnterAsteroid = function () {
      if (state.ringPlatformer || state.ringTransitionActive || state.hullOpen) return false;
      if (state.mode === "maze" && state.maze && state.maze.active) return true;
      enterAsteroidMaze();
      return !!(state.mode === "maze" && state.maze && state.maze.active);
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
        if (state.mode === "map") {
          if (["ArrowDown", "ArrowRight"].includes(event.code)) {
            event.preventDefault(); event.stopImmediatePropagation();
            focusMapChoice(1);
            return;
          }
          if (["ArrowUp", "ArrowLeft"].includes(event.code)) {
            event.preventDefault(); event.stopImmediatePropagation();
            focusMapChoice(-1);
            return;
          }
          if (event.code === "Enter" || event.code === "Space") {
            const active = document.activeElement;
            if (active && active.closest && active.closest("[data-warp-manual]") && event.code === "Enter") return;
            if (active && active.matches && active.matches("button:not([disabled])")) {
              event.preventDefault(); event.stopImmediatePropagation();
              active.click();
              return;
            }
            if (active === galaxyMap && state.target) {
              event.preventDefault(); event.stopImmediatePropagation();
              startButton.focus({ preventScroll: true });
              return;
            }
          }
        }
        if (event.code === "Escape" || event.code === "Backspace") {
          if (state.mode !== "map") return;
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
      if (!overlay.hidden) {
        resizeBackdrop();
        if (state.mode === "map") renderGalaxyMap();
      }
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