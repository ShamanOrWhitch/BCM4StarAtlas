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

    window.BCMDeepSpaceWarpGetReturnSnapshot = () => ({
      mode: state.mode,
      currentSectorId: state.nav?.current?.id ?? null,
      targetSectorId: state.target?.id ?? null,
      sectorProgressed: !!state.sectorProgressed,
      launchSectorProgressed: !!state.launchSectorProgressed,
      ringCompleted: !!state.maze?.ringCompleted,
      hydrogenCollected: !!window.BCMWorldMission?.hydrogenCollected
    });

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
            '<div class="bcm-warp-galaxy-legend"><span><i class="is-current"></i> ТЕКУЩИЙ СЕКТОР</span><span><i class="is-link"></i> WARP-ДОСТУПЕН</span><span><i class="is-route"></i> МАРШРУТ</span><span><i class="is-star"></i> ЗВЁЗДЫ</span><span><i class="is-css"></i> CSS</span><small>Координаты X/Y −50…50. Доступные переходы берутся из адаптера; недостающие секторы не выдумываются.</small></div>' +
            '<div class="bcm-warp-local-area"><div class="bcm-warp-galaxy-heading"><strong>ЛОКАЦИИ ВЫБРАННОГО СЕКТОРА</strong><span data-warp-local-status>Выберите сектор</span></div><div class="bcm-warp-local-locations" data-warp-local-locations></div><div class="bcm-warp-location-kinds"><span><i>◈</i> Астероиды · локальный комплекс</span><span><i>◎</i> Планета · Tower / внутренние мини-игры</span><span><i>✦</i> Deep Space · внешняя зона с отдельной визуальной темой</span></div></div>' +
          '</div>' +
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
        '<div data-warp-tier-preview aria-label="Временно посмотреть визуальный класс Warp" style="position:absolute;top:12px;right:12px;z-index:8;display:flex;align-items:center;gap:3px;padding:4px;border:1px solid rgba(102,190,210,.45);border-radius:9px;background:rgba(2,12,21,.74);pointer-events:auto;max-width:calc(100vw - 24px)">' +
          '<span style="font:700 9px system-ui,sans-serif;color:#a9cbd7;letter-spacing:.04em;margin-right:2px">ВИД</span>' +
          '<button type="button" data-warp-tier="1" aria-pressed="false" title="Class I — полосы" style="min-width:25px;height:26px;padding:0 5px;font:700 10px system-ui;border:1px solid #426779;border-radius:6px;background:rgba(16,35,45,.96);color:#e8fbff">I</button>' +
          '<button type="button" data-warp-tier="2" aria-pressed="false" title="Class II — спиральные рельсы" style="min-width:25px;height:26px;padding:0 5px;font:700 10px system-ui;border:1px solid #426779;border-radius:6px;background:rgba(16,35,45,.96);color:#e8fbff">II</button>' +
          '<button type="button" data-warp-tier="3" aria-pressed="false" title="Class III — фиолетовые полосы" style="min-width:25px;height:26px;padding:0 5px;font:700 10px system-ui;border:1px solid #426779;border-radius:6px;background:rgba(16,35,45,.96);color:#e8fbff">III</button>' +
          '<button type="button" data-warp-tier="4" aria-pressed="false" aria-disabled="true" disabled title="Class IV выключен" style="min-width:25px;height:26px;padding:0 5px;font:700 10px system-ui;border:1px solid #3a444a;border-radius:6px;background:rgba(19,25,30,.82);color:#64737b;opacity:.58;cursor:not-allowed">IV ×</button>' +
        '</div>' +
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
      { id: "mud-css", name: "MUD CSS", x: 0, y: -39, color: "#e7a18c" },
      { id: "oni-css", name: "ONI CSS", x: -40, y: 30, color: "#7eb6ff" },
      { id: "ustur-css", name: "Ustur CSS", x: 40, y: 30, color: "#e6c15a" }
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
    const tubeContinue = overlay.querySelector("[data-tube-continue]");
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
      const current = { id: "oni-css-neuno--40-30", name: "ONI CSS · NEUNO", x: -40, y: 30, raw: null };
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
            detail: "Локальная игровая зона рядом с ONI CSS; существующая механика астероидного прохода.",
            status: "implemented"
          });
        }
        addKnownLocation({ id: "oni-css-station", name: "ONI CSS", kind: "station", detail: "Орбитальная станция и локальный ориентир сектора.", status: "reference" });
        addKnownLocation({ id: "akenat-planet", name: "Akenat", kind: "planet", detail: "Планетарная локация системы ONI; Tower и внутренние механики здесь пока требуют привязки запуска.", status: "planned" });
      } else if (isMudCss) {
        addKnownLocation({ id: "mud-css-station", name: "MUD CSS", kind: "station", detail: "Орбитальная станция системы MUD.", status: "reference" });
        addKnownLocation({ id: "pearce-planet", name: "Pearce", kind: "planet", detail: "Планетарная локация системы MUD; Tower и внутренние механики требуют привязки запуска.", status: "planned" });
      } else if (isUsturCss) {
        addKnownLocation({ id: "ustur-css-station", name: "Ustur CSS", kind: "station", detail: "Орбитальная станция системы Ustur.", status: "reference" });
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
        : "ПОЛНЫЕ ТОЧКИ СЕКТОРОВ НЕ ДОСТУПНЫ · ЗВЁЗДЫ И CSS — ОРИЕНТИРЫ";
      if (galaxyMapStatus) {
        galaxyMapStatus.textContent = nav && nav.live
          ? statusText
          : "ЛОКАЛЬНЫЙ ТЕСТ · ONI CSS / NEUNO · КООРДИНАТЫ −50…50";
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
        : "Стартовая точка ONI CSS · NEUNO: X -40, Y 30. Соседние клетки сгенерированы только для теста. Warp/Tube/лабиринт не меняют состояние Star Atlas.";
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
      // Repeated trips through the same sector pair should still create a fresh
      // obstacle run rather than showing the exact same 22-piece sequence.
      const runNonce = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
      const rng = randomFrom(hashSeed(state.nav.current.id + ">" + state.target.id + ":" + state.target.x + ":" + state.target.y + ":" + runNonce));
      state.layers = [];
      const courseLayerCount = 22;
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
        if (!window.BCMWorldMission.asteroidSeed) window.BCMWorldMission.asteroidSeed = seed;
      }
      state.savedSpeedMode = engine.getSpeedMode ? engine.getSpeedMode() : 1;
      if (engine.setSpeedMode) engine.setSpeedMode(2);
      state.maze = maze;
      publishAsteroidChart(maze);
      maze.pickupEffects = [];
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
      const t = Math.pow(warpNormalizedTime(elapsed), 0.82);
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

    function drawTubeTunnel(g, w, h, now) {
      const t = state.tubeTravel;
      const shimmerTime = Number(state.tubeShimmerTime || 0);
      const visualClass = activeWarpVisualClass();
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
      const panelCount = visualClass === 3 ? 12 : 18;
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
          const red = visualClass === 3
            ? Math.round(17 + shimmer * 12 + light * 3)
            : Math.round(8 + shimmer * 8 + light * 2);
          const green = visualClass === 3
            ? Math.round(12 + shimmer * 8 + light * 5)
            : Math.round(20 + shimmer * 18 + light * 12);
          const blue = visualClass === 3
            ? Math.round(34 + shimmer * 28 + light * 12)
            : Math.round(31 + shimmer * 22 + light * 18);
          g.fillStyle = "rgba(" + red + "," + green + "," + blue + ",0.98)";
          g.fill();
          // No transverse panel outlines: they read as hoops at speed.
          // The longitudinal strips below are the sole continuous surface lines.
        }
      }

      // Keep the established 12 longitudinal strips. A restrained depth-only skew
      // stops them reading as straight vertical bars while leaving the near opening aligned.
      for (let seam = 0; seam < 12; seam += 1) {
        const theta = seam * Math.PI * 2 / 12;
        g.beginPath();
        for (let step = 0; step <= 35; step += 1) {
          const d = 0.04 + (step / 35) * 0.96;
          const p = point(d, theta + (d - 0.92) * 0.36, -1.5);
          if (!step) g.moveTo(p.x, p.y);
          else g.lineTo(p.x, p.y);
        }
        g.strokeStyle = visualClass === 3
          ? (seam % 3 === 0 ? "rgba(189,139,246,0.86)" : "rgba(131,96,184,0.36)")
          : visualClass === 2
            ? (seam % 3 === 0 ? "rgba(115,193,206,0.56)" : "rgba(110,191,210,0.22)")
            : (seam % 3 === 0 ? "rgba(110,239,246,0.72)" : "rgba(110,191,210,0.25)");
        g.lineWidth = seam % 3 === 0 ? 1.25 : 0.65;
        g.stroke();
      }

      // Class II is a quieter tint of the same tunnel, not a second set of rails.
      // Class III has a distinct violet identity without circular geometry.
      if (visualClass === 3) {
        g.fillStyle = "rgba(30,11,54,0.34)";
        g.fillRect(0, 0, w, h);
      }

      // These are the tube's own horizontal/circumferential wall bands, wrapping the full radius.
      // Increasing depth approaches the ship; decreasing depth recedes into the vanishing point.
      // Class II keeps the inward flow; Classes I and III move toward the ship.
      // tubeTravel already accelerates with flight, so the wall bands accelerate with it.
      const flowDirection = visualClass === 2 ? -1 : 1;
      const bandPhase = ((Number(state.tubeTravel || 0) * 0.018 * flowDirection) % 1 + 1) % 1;
      const bandCount = 14;
      const bandRgb = visualClass === 3 ? "181,139,255" : visualClass === 2 ? "149,220,229" : "110,222,238";
      for (let band = 0; band < bandCount; band += 1) {
        const phase = ((band / bandCount + bandPhase) % 1 + 1) % 1;
        const depth = 0.055 + phase * 0.90;
        const accent = band % 4 === 0;
        const alpha = (accent ? 0.32 : 0.14) * (visualClass === 2 ? 0.84 : 1);
        const color = "rgba(" + bandRgb + "," + alpha.toFixed(3) + ")";
        drawArc(depth, 0, Math.PI * 2, color, accent ? 1.1 : 0.72);
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