/* BCM4SA Ring Frontier runtime. Kept separate from Warp navigation/travel. */
(function (window) {
  "use strict";
  function create(context) {
    const {
      state, api, config, root, hullEnterButton, ringEnterButton,
      startWarpAudio, warpAudio, setMazeStatus, syncHullButtonVisibility,
      syncRingButtonVisibility, attemptOpenRingPlatformer, hashSeed,
      publishAsteroidChart
    } = context;
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

    const ringBossModelPaths = [
      "ring-bosses/mesh/boss-1-roller.glb",
      "ring-bosses/mesh/phase-forms/phase-2-walker.glb",
      "ring-bosses/mesh/phase-forms/phase-3-orbiter.glb",
      "ring-bosses/mesh/phase-forms/phase-4-brawler.glb",
      "ring-bosses/mesh/phase-forms/phase-5-runner.glb",
      "ring-bosses/mesh/phase-forms/phase-6-stalker.glb"
    ];
    const ringBossGltfCache = new Map();
    let ringBossLoaderPromise = null;

    function ringBossAssetUrl(relativePath) {
      const wanted = String(relativePath || "");
      const assets = Array.isArray(config.assets) ? config.assets : [];
      const asset = assets.find((entry) => {
        const name = String(entry && (entry.name || entry.path || entry.filename) || "");
        return name === wanted || name.endsWith("/" + wanted);
      });
      return String(asset && (asset.url || asset.src || asset.path) || "");
    }

    function ensureRingBossLoader() {
      const THREE = window.THREE;
      if (!THREE) return Promise.reject(new Error("Ring boss model load: THREE is unavailable"));
      if (THREE.GLTFLoader) return Promise.resolve(THREE.GLTFLoader);
      if (ringBossLoaderPromise) return ringBossLoaderPromise;
      const loaderUrl = String(config.gltfLoaderUrl || "").trim();
      if (!loaderUrl) return Promise.reject(new Error("Ring boss model load: GLTFLoader URL is missing"));
      ringBossLoaderPromise = new Promise((resolve, reject) => {
        const ready = () => window.THREE && window.THREE.GLTFLoader
          ? resolve(window.THREE.GLTFLoader)
          : reject(new Error("Ring boss model load: GLTFLoader did not register"));
        const existing = document.querySelector('script[data-bcm-r128-sector-loader="1"],script[data-bcm-r128-gltf-loader="1"]');
        if (existing) {
          if (window.THREE && window.THREE.GLTFLoader) { ready(); return; }
          existing.addEventListener("load", ready, { once: true });
          existing.addEventListener("error", () => reject(new Error("Ring boss model load: GLTFLoader request failed")), { once: true });
          return;
        }
        const script = document.createElement("script");
        script.src = loaderUrl;
        script.async = true;
        script.dataset.bcmR128GltfLoader = "1";
        script.onload = ready;
        script.onerror = () => reject(new Error("Ring boss model load: GLTFLoader request failed"));
        document.head.appendChild(script);
      }).catch((error) => {
        ringBossLoaderPromise = null;
        throw error;
      });
      return ringBossLoaderPromise;
    }

    function loadRingBossGltf(relativePath) {
      const key = String(relativePath || "");
      if (ringBossGltfCache.has(key)) return ringBossGltfCache.get(key);
      const url = ringBossAssetUrl(key);
      if (!url) return Promise.reject(new Error("Ring boss asset is not registered: " + key));
      const pending = ensureRingBossLoader().then((Loader) => new Promise((resolve, reject) => {
        new Loader().load(url, resolve, undefined, reject);
      })).catch((error) => {
        ringBossGltfCache.delete(key);
        throw error;
      });
      ringBossGltfCache.set(key, pending);
      return pending;
    }

    function playRingBossAnimation(boss, phaseOffset, clipName, once) {
      const record = boss && boss.phaseModels && boss.phaseModels[phaseOffset];
      if (!record || !record.mixer) return false;
      const clip = record.clips.find((item) => item && item.name === clipName);
      if (!clip) return false;
      record.mixer.stopAllAction();
      const action = record.mixer.clipAction(clip);
      action.reset();
      if (once && window.THREE.LoopOnce !== undefined) {
        action.setLoop(window.THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      } else if (window.THREE.LoopRepeat !== undefined) {
        action.setLoop(window.THREE.LoopRepeat, Infinity);
        action.clampWhenFinished = false;
      }
      action.play();
      record.activeClip = clipName;
      return true;
    }

    function setRingBossGroupOpacity(group, opacity) {
      if (!group) return;
      const alpha = Math.max(0, Math.min(1, opacity));
      group.traverse((node) => {
        if (!node.isMesh || !node.material) return;
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        materials.forEach((material) => {
          if (!material.userData) material.userData = {};
          if (material.userData.bcmRingOriginalOpacity === undefined) {
            material.userData.bcmRingOriginalOpacity = Number.isFinite(material.opacity) ? material.opacity : 1;
            material.userData.bcmRingOriginalTransparent = !!material.transparent;
            material.userData.bcmRingOriginalDepthWrite = material.depthWrite !== false;
          }
          const transparent = alpha < 0.999 || material.userData.bcmRingOriginalTransparent;
          if (material.transparent !== transparent) {
            material.transparent = transparent;
            material.needsUpdate = true;
          }
          material.opacity = material.userData.bcmRingOriginalOpacity * alpha;
          material.depthWrite = alpha >= 0.999 && material.userData.bcmRingOriginalDepthWrite;
        });
      });
    }

    function beginRingBossTransitionVfx(boss) {
      const THREE = window.THREE;
      if (!THREE || !boss || !boss.group) return;
      clearRingBossTransitionVfx(boss);
      const count = 720;
      const positions = new Float32Array(count * 3);
      const velocities = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      const cyan = new THREE.Color(0x45f4ff);
      const violet = new THREE.Color(0xb44cff);
      const gold = new THREE.Color(0xffce75);
      for (let i = 0; i < count; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const r = 0.32 + Math.random() * 1.35;
        const y = 1.45 + Math.random() * 1.65;
        positions[i * 3] = Math.cos(a) * r;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = Math.sin(a) * (0.18 + Math.random() * 0.65);
        const speed = 0.7 + Math.random() * 2.8;
        velocities[i * 3] = Math.cos(a) * speed;
        velocities[i * 3 + 1] = (Math.random() - 0.38) * speed;
        velocities[i * 3 + 2] = Math.sin(a) * speed * 0.55;
        const c = Math.random() < 0.68 ? cyan : (Math.random() < 0.5 ? violet : gold);
        colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      const material = new THREE.PointsMaterial({ size: 0.075, vertexColors: true, transparent: true,
        opacity: 0.92, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
      const particles = new THREE.Points(geometry, material);
      particles.name = "ring-boss-phase-shift-particles";
      particles.frustumCulled = false;
      boss.group.add(particles);
      const rings = [0, 1].map((index) => {
        const ringMaterial = new THREE.MeshBasicMaterial({ color: index ? 0xb951ff : 0x53f5ff,
          transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
          depthWrite: false });
        const ring = new THREE.Mesh(new THREE.TorusGeometry(index ? 0.72 : 0.46, 0.035, 8, 56), ringMaterial);
        ring.position.set(0, 2.15, 1.25 + index * 0.04);
        ring.scale.set(0.2, 0.2, 1);
        ring.name = "ring-boss-phase-shift-ring-" + index;
        boss.group.add(ring);
        return ring;
      });
      boss.transitionVfx = { particles, geometry, material, rings, velocities, elapsed: 0 };
    }

    function clearRingBossTransitionVfx(boss) {
      const fx = boss && boss.transitionVfx;
      if (!fx) return;
      if (boss.group) {
        boss.group.remove(fx.particles);
        fx.rings.forEach((ring) => boss.group.remove(ring));
      }
      try { fx.geometry.dispose(); fx.material.dispose(); } catch (e) {}
      fx.rings.forEach((ring) => { try { ring.geometry.dispose(); ring.material.dispose(); } catch (e) {} });
      boss.transitionVfx = null;
    }

    // Owner 23.11.2026 "красивые трансформации и переходы": each form turns into the next
    // in the owner's video (white background, keyed out here), played muted in place of
    // the boss. Keyed by the phase the boss turns into. Pig → Roller has no video and
    // keeps the particle transition; so does any transition whose video fails.
    const ringBossTransformVideos = {
      2: "ring-bosses/video/transform-roller-walker.mp4",
      3: "ring-bosses/video/transform-walker-orbiter.mp4",
      4: "ring-bosses/video/transform-orbiter-brawler.mp4",
      5: "ring-bosses/video/transform-brawler-runner.mp4",
      6: "ring-bosses/video/transform-runner-stalker.mp4"
    };
    const RING_BOSS_VIDEO_MS = 5000;
    // Owner 24.11.2026 (BUG-028): "меш оказался меньше видео перехода… размер следующего босса
    // не совпал с переходом". Where the figure stands in the first and last frame of each clip
    // (tools/ring-bosses/video-bounds.mjs): frame fractions [x0, y0, x1, y1], y from the top.
    // The clip plane starts on the old form and ends on the new one, by height, floor and centre.
    const RING_BOSS_VIDEO_FIGURE = {
      2: { first: [0.092, 0.027, 0.873, 0.96], last: [0.106, 0.013, 0.87, 0.985] },
      3: { first: [0.113, 0.014, 0.865, 0.986], last: [0.046, 0.017, 0.896, 0.933] },
      4: { first: [0.046, 0.019, 0.896, 0.933], last: [0.088, 0.014, 0.906, 0.981] },
      5: { first: [0.09, 0.014, 0.902, 0.981], last: [0.05, 0.028, 0.981, 0.956] },
      6: { first: [0.05, 0.028, 0.981, 0.953], last: [0.225, 0, 0.754, 1] }
    };
    const RING_BOSS_VIDEO_ASPECT = 4 / 3;
    // The clip plane that puts the figure box `box` on a form standing at { bottom, height, x }.
    function ringBossVideoFit(box, form, aspect) {
      const height = form.height / Math.max(0.05, box[3] - box[1]);
      const width = height * aspect;
      return { width, height, x: form.x - width * ((box[0] + box[2]) / 2 - 0.5), y: form.bottom + height * (box[3] - 0.5) };
    }
    // Where a form of the boss stands, in the boss group: its floor, full height and centre.
    function ringBossFormFrame(boss, phaseIndex, bottom, x) {
      const group = boss.phaseGroups[phaseIndex - 1];
      const half = (group && group.userData.bcmGroundY) || 1.6;
      return { bottom, height: half * 2, x };
    }
    // Where the new form will begin its own move: it appears there, not on the old form's spot.
    function ringBossRevealPose(boss, phaseIndex) {
      const api = window.BCMRingBossMoves;
      if ((phaseIndex === 5 && window.BCMRingRunnerChase) || !api) return { x: boss.x, y: 0 };
      const out = api.create(phaseIndex, { homeX: boss.homeX, seed: 1 }).step(0, { targetX: boss.x, targetY: 0 });
      return { x: Number.isFinite(out.x) ? out.x : boss.x, y: Number(out.y) || 0 };
    }
    function placeRingBossTransformVideo(boss, k) {
      const film = boss.transformVideo;
      const figure = RING_BOSS_VIDEO_FIGURE[boss.phaseIndex];
      if (!film || !figure) return;
      const to = ringBossFormFrame(boss, boss.phaseIndex, boss.revealY || 0, 0);
      const a = ringBossVideoFit(figure.first, boss.transitionFromFrame || to, RING_BOSS_VIDEO_ASPECT);
      const b = ringBossVideoFit(figure.last, to, RING_BOSS_VIDEO_ASPECT);
      const mix = (p, q) => p + (q - p) * k;
      film.mesh.scale.set(mix(a.width, b.width), mix(a.height, b.height), 1);
      film.mesh.position.set(mix(a.x, b.x), mix(a.y, b.y), 1.35);
    }

    function beginRingBossTransformVideo(boss, phaseIndex) {
      clearRingBossTransformVideo(boss);
      const THREE = window.THREE;
      const url = ringBossAssetUrl(ringBossTransformVideos[phaseIndex] || "");
      if (!url || !THREE || !THREE.VideoTexture || !boss || !boss.group) return false;
      const video = document.createElement("video");
      video.muted = true;
      video.defaultMuted = true;
      video.setAttribute("muted", "");
      video.playsInline = true;
      video.setAttribute("playsinline", "");
      video.preload = "auto";
      video.loop = false;
      video.crossOrigin = "anonymous";
      video.src = url;
      const texture = new THREE.VideoTexture(video);
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      if (THREE.sRGBEncoding !== undefined) texture.encoding = THREE.sRGBEncoding;
      const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, opacity: 0 });
      // The videos are drawn on white: near-white turns transparent, edges stay soft.
      material.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>",
          "#include <map_fragment>\n  float bcmWhiteKey = distance(diffuseColor.rgb, vec3(1.0));\n  diffuseColor.a *= smoothstep(0.10, 0.32, bcmWhiteKey);");
      };
      const geometry = new THREE.PlaneGeometry(1, 1);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = "ring-boss-transform-video";
      mesh.renderOrder = 8;
      mesh.position.z = 1.35; // size and place: placeRingBossTransformVideo, from the form
      boss.group.add(mesh);
      const record = { url, video, texture, material, geometry, mesh, failed: false, started: false };
      video.addEventListener("error", () => { record.failed = true; });
      video.addEventListener("playing", () => { record.started = true; });
      const played = video.play();
      if (played && typeof played.catch === "function") played.catch(() => { record.failed = true; });
      boss.transformVideo = record;
      return true;
    }

    function clearRingBossTransformVideo(boss) {
      const record = boss && boss.transformVideo;
      if (!record) return;
      boss.transformVideo = null;
      try { record.video.pause(); record.video.removeAttribute("src"); record.video.load(); } catch (e) {}
      if (record.mesh.parent) record.mesh.parent.remove(record.mesh);
      try { record.texture.dispose(); record.material.dispose(); record.geometry.dispose(); } catch (e) {}
    }

    function updateRingBossTransitionVfx(boss, dt, elapsed) {
      const fx = boss && boss.transitionVfx;
      if (!fx) return;
      fx.elapsed += dt;
      const pos = fx.particles.geometry.attributes.position.array;
      const fade = Math.max(0, 1 - elapsed / 2.35);
      for (let i = 0; i < pos.length / 3; i += 1) {
        pos[i * 3] += fx.velocities[i * 3] * dt;
        pos[i * 3 + 1] += fx.velocities[i * 3 + 1] * dt;
        pos[i * 3 + 2] += fx.velocities[i * 3 + 2] * dt;
      }
      fx.particles.geometry.attributes.position.needsUpdate = true;
      fx.material.opacity = 0.92 * fade;
      fx.rings.forEach((ring, index) => {
        const grow = Math.min(3.8, 0.35 + elapsed * (2.3 + index * 0.4));
        ring.scale.set(grow, grow * (index ? 0.78 : 1), 1);
        ring.rotation.z += dt * (index ? -1.3 : 1.7);
        ring.material.opacity = Math.max(0, (1 - elapsed / 1.7) * (index ? 0.55 : 0.82));
      });
    }

    // Scale of each form model by phase offset (0 Roller … 5 Stalker); the Brawler is big.
    const RING_BOSS_FORM_SCALE = { 3: 2.2 };

    function loadRingBossPhaseModels(world) {
      if (!world || !Array.isArray(world.bosses)) return;
      world.bosses.forEach((boss) => {
        boss.phaseModels = new Array(ringBossModelPaths.length).fill(null);
        if (!boss.hasPhases) return;
        ringBossModelPaths.forEach((path, phaseOffset) => {
          loadRingBossGltf(path).then((gltf) => {
            if (world.disposed || !boss.group || !world.group.parent) return;
            const phaseGroup = boss.phaseGroups[phaseOffset];
            if (!phaseGroup) return;
            const model = gltf.scene.clone(true);
            // The painted art of a form shows as drawn (owner: the forms read too dark under
            // the arena lights): the art map also drives the emissive channel.
            const brighten = (source) => {
              const material = source.clone();
              // The form GLBs carry v growing upwards while GLTFLoader keeps flipY off: the
              // art came out upside down (owner's screenshot of the Brawler). Flip it back once.
              // (flipY does not apply to the ImageBitmaps GLTFLoader makes, so the uv transform does it.)
              if (material.map && !material.map.bcmUprightArt) {
                material.map.bcmUprightArt = true;
                material.map.repeat.set(1, -1);
                material.map.offset.set(0, 1);
              }
              if (material.map && "emissiveMap" in material) {
                material.emissive = new window.THREE.Color(0xffffff);
                material.emissiveMap = material.map;
                material.emissiveIntensity = 0.85;
              }
              return material;
            };
            model.traverse((node) => {
              if (!node.isMesh || !node.material) return;
              node.material = Array.isArray(node.material) ? node.material.map(brighten) : brighten(node.material);
            });
            model.updateMatrixWorld(true);
            const bounds = new window.THREE.Box3().setFromObject(model);
            const center = bounds.getCenter(new window.THREE.Vector3());
            const pivot = new window.THREE.Group();
            pivot.name = "ring-boss-model-pivot-" + (phaseOffset + 2);
            pivot.position.set(-center.x, -center.y, -center.z);
            phaseGroup.clear();
            phaseGroup.add(pivot);
            pivot.add(model);
            // Owner 23.11.2026: the Brawler pig is 2.2 times bigger. Every form now stands on
            // the floor: its group is raised by half its (scaled) height, not a fixed 2.1 m.
            const formScale = RING_BOSS_FORM_SCALE[phaseOffset] || 1;
            const size = bounds.getSize(new window.THREE.Vector3());
            phaseGroup.scale.setScalar(formScale);
            phaseGroup.userData.bcmGroundY = (size.y / 2) * formScale;
            phaseGroup.userData.bcmHalfW = (size.x / 2) * formScale;
            phaseGroup.position.y = phaseGroup.userData.bcmGroundY;
            const mixer = new window.THREE.AnimationMixer(model);
            const clips = gltf.animations || [];
            phaseGroup.userData.bcmRingBossAsset = path;
            phaseGroup.userData.bcmRingBossClips = clips.map((clip) => clip.name);
            boss.phaseModels[phaseOffset] = { mixer, clips, model, activeClip: "" };
            if (boss.phaseState === "transition") {
              if (boss.transitionFromIndex === phaseOffset + 1) playRingBossAnimation(boss, phaseOffset, "transform_out", true);
              if (boss.phaseIndex === phaseOffset + 1) playRingBossAnimation(boss, phaseOffset, "transform_in", true);
            } else if (boss.phaseIndex === phaseOffset + 1) {
              playRingBossAnimation(boss, phaseOffset, "idle", false);
            }
          }).catch((error) => {
            try { console.warn("Ring boss GLB unavailable; procedural fallback retained:", path, error); } catch (e) {}
          });
        });
      });
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
        description: "Это тот же астероид и те же текстуры клеток. E — пройти через отмеченную открытую дверь; R / LB — перейти на другой этаж у светящегося люка. Space / W — прыжок; в фиолетовых полях подруливай вверх/вниз и нажимай прыжок для импульса. Синие поля дают короткий прыжок. Арена со свиньями необязательна.",
        controls: "P1: A/D — бег · ↑/↓ — вертикаль · Space/W — прыжок/импульс · E — дверь · R — этаж · Q — лазер · Shift/C — рывок\nP2: J/L — бег · T/G — вертикаль · P — прыжок · O — дверь · I — этаж · K — лазер · U — рывок\nГеймпад: стик — бег/вертикаль · A — прыжок/импульс · X — дверь · LB — этаж · Y — лазер · B — рывок"
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
             '<span></span><button type="button" data-ring-action="jump" aria-label="' + copy.jump + '" style="grid-column:2;grid-row:1;min-height:42px">' + copy.jump + '</button><button type="button" data-ring-action="up" aria-label="' + (en ? "Vertical up" : "Вверх") + '" style="min-height:42px">↑</button>' +
             '<button type="button" data-ring-action="left" aria-label="' + (en ? "Left" : "Влево") + '" style="min-height:42px">◀</button><button type="button" data-ring-action="down" aria-label="' + (en ? "Vertical down" : "Вниз") + '" style="min-height:42px">↓</button><button type="button" data-ring-action="right" aria-label="' + (en ? "Right" : "Вправо") + '" style="min-height:42px">▶</button>' +
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
      const crewControls = [0, 1].map((playerIndex) => window.BCMCrewCore?.createCrewControls
        ? window.BCMCrewCore.createCrewControls({ playerIndex })
        : null);
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
        // Owner 23.11.2026: raised ledges stand behind the boss and the pilots (their front
        // face at z -0.5), not as 3.8 m boxes whose front face covered the boss's eyes.
        const LEDGE_Z = -1.3, LEDGE_DEPTH = 1.6;
        function addPlatform(x1, x2, topY, color) {
          const width = x2 - x1;
          const center = (x1 + x2) / 2;
          const floor = topY === 0;
          addBox(floor ? "floor" : "platforms", center, topY - 0.18, floor ? 0 : LEDGE_Z,
            width, 0.36, floor ? 3.8 : LEDGE_DEPTH, color || (floor ? 0x182b38 : 0x486b7d));
          if (floor) {
            // Broken-up floor markings read as a traversable stage, not a flat map tile.
            for (let mark = x1 + 2.5; mark < x2 - 1; mark += 7.5) {
              addBox("trim", mark, 0.045, 0.08, 1.25, 0.055, 0.08,
                ((Math.floor(mark) % 2) === 0) ? 0x61deef : 0x405e70);
            }
          } else {
            // A bright lip and dark support braces give the ledges a comic-panel silhouette.
            addBox("trim", center, topY + 0.055, LEDGE_Z, width + 0.12, 0.075, LEDGE_DEPTH + 0.12,
              color || 0x64d9e8);
            const braceY = topY * 0.48;
            const braceHeight = Math.max(0.45, topY * 0.88);
            [x1 + 0.35, x2 - 0.35].forEach((braceX) => {
              addBox("backdrop", braceX, braceY, LEDGE_Z - 0.2, 0.20, braceHeight, 0.20, 0x07121b);
              addBox("trim", braceX, braceY, LEDGE_Z - 0.06, 0.055, braceHeight * 0.94, 0.08,
                color || 0x64d9e8);
            });
          }
          platforms.push({ minX: x1, maxX: x2, y: topY });
        }
        addPlatform(-51, 84, 0, 0x142936);
        // Two tiers a pilot can climb (jump peak 1.84 m): 1.4 m from the floor, 2.8 m from
        // the low ledge beside it. Each boss arena (-16, 18, 58) has a pair on both sides.
        [
          [-40, -36, 1.4], [-37, -33, 2.8],
          [-24, -21, 1.4], [-22.5, -19.5, 2.8], [-11, -8, 1.4], [-12.5, -9.5, 2.8],
          [0, 4, 1.4], [3, 7, 2.8],
          [10, 13, 1.4], [11.5, 14.5, 2.8], [23, 26, 1.4], [21.5, 24.5, 2.8],
          [38, 42, 1.4], [41, 45, 2.8],
          [50, 53, 1.4], [51.5, 54.5, 2.8], [63, 66, 1.4], [61.5, 64.5, 2.8]
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

          // The provided GLBs are used when loaded; the procedural forms below
          // remain a graceful fallback. The existing Pig is phase one and is hidden
          // only after its ordinary defeat.
          const phaseSpecs = [
            { name: "КАТОК", hp: 4, color: 0xffa45f },
            { name: "ШАГОХОД", hp: 5, color: 0x75d9a8 },
            { name: "ОРБИТА", hp: 5, color: 0x8b9dff },
            { name: "БОЕЦ", hp: 6, color: 0xe57667 },
            { name: "ГОНЩИК", hp: 6, color: 0xffc35f },
            { name: "ТЕНЬ", hp: 7, color: 0xa77bff }
          ];
          const phaseGroups = phaseSpecs.map((spec, phaseIndex) => {
            const phase = new THREE.Group();
            phase.name = "ring-boss-phase-" + (phaseIndex + 2) + "-" + index;
            phase.position.set(0, 2.1, 1.02);
            phase.visible = false;
            const material = new THREE.MeshStandardMaterial({
              color: spec.color, emissive: spec.color, emissiveIntensity: 0.34,
              roughness: 0.42, metalness: 0.48
            });
            const dark = new THREE.MeshStandardMaterial({
              color: phaseIndex === 5 ? 0x21183a : 0x152533,
              roughness: 0.62, metalness: 0.34
            });
            materials.push(material, dark);
            const addPart = (geometry, partMaterial, x, y, z, sx, sy, sz, rotationZ) => {
              const part = new THREE.Mesh(geometry, partMaterial);
              part.position.set(x, y, z);
              part.scale.set(sx, sy, sz);
              if (rotationZ) part.rotation.z = rotationZ;
              phase.add(part);
              return part;
            };
            if (phaseIndex === 0) { // Roller: shell, exposed core and wheels.
              addPart(pigSphereGeometry, material, 0, 0, 0, 1.28, 1.02, 0.72);
              addPart(bossCoreGeometry, bossCoreMaterial, 0, 0.05, 0.68, 0.52, 0.52, 0.36);
              [-1, 1].forEach((side) => addPart(bossRingGeometry, dark, side * 0.86, -0.32, 0.05, 0.40, 0.40, 0.36, Math.PI / 2));
            } else if (phaseIndex === 1) { // Walker: body and committed stomping legs.
              addPart(bossBodyGeometry, material, 0, 0.2, 0, 0.9, 1.15, 0.68);
              [-1, 1].forEach((side) => {
                addPart(bossArmorGeometry, dark, side * 0.62, -0.76, 0, 0.30, 0.94, 0.42, side * -0.08);
                addPart(bossArmorGeometry, material, side * 0.62, -1.25, 0.10, 0.55, 0.20, 0.58);
              });
              addPart(bossCoreGeometry, bossCoreMaterial, 0, 0.16, 0.65, 0.44, 0.50, 0.36);
            } else if (phaseIndex === 2) { // Orbiter: rings around an openable core.
              addPart(bossCoreGeometry, bossCoreMaterial, 0, 0, 0.15, 0.72, 0.72, 0.52);
              [-0.42, 0, 0.42].forEach((turn, ringIndex) => {
                const orbit = addPart(bossRingGeometry, ringIndex === 1 ? material : dark, 0, 0, 0, 1.0 + ringIndex * 0.18, 1.0 + ringIndex * 0.18, 0.18);
                orbit.rotation.y = turn;
              });
            } else if (phaseIndex === 3) { // Brawler: torso and oversized fists.
              addPart(bossArmorGeometry, material, 0, 0, 0, 1.28, 1.28, 0.7);
              addPart(bossCoreGeometry, bossCoreMaterial, 0, 0.05, 0.58, 0.46, 0.46, 0.36);
              [-1, 1].forEach((side) => addPart(pigSphereGeometry, dark, side * 1.20, -0.42, 0.08, 0.62, 0.62, 0.62));
            } else if (phaseIndex === 4) { // Runner: low chassis and wheel pair.
              addPart(bossArmorGeometry, material, 0, -0.28, 0, 1.42, 0.62, 0.72);
              addPart(bossCoreGeometry, bossCoreMaterial, 0.12, 0.10, 0.60, 0.38, 0.38, 0.30);
              [-1, 1].forEach((side) => addPart(bossRingGeometry, dark, side * 0.88, -0.76, 0.10, 0.44, 0.44, 0.40, Math.PI / 2));
            } else { // Stalker / Shadow: long-limbed dark silhouette.
              addPart(bossBodyGeometry, dark, 0, 0.18, 0, 0.72, 1.15, 0.5);
              addPart(bossCoreGeometry, bossCoreMaterial, 0, 0.20, 0.52, 0.36, 0.42, 0.28);
              [-1, 1].forEach((side) => {
                addPart(bossArmorGeometry, dark, side * 0.82, -0.20, 0, 0.20, 1.30, 0.24, side * -0.28);
                addPart(bossArmorGeometry, dark, side * 0.35, -1.02, 0, 0.22, 1.10, 0.24, side * 0.16);
              });
            }
            group.add(phase);
            return phase;
          });

          const tellMaterial = new THREE.MeshBasicMaterial({
            color: 0xffcc6a, transparent: true, opacity: 0.88, depthWrite: false
          });
          materials.push(tellMaterial);
          const tellMesh = new THREE.Mesh(bossRingGeometry, tellMaterial);
          tellMesh.name = "ring-boss-attack-tell-" + index;
          tellMesh.position.set(0, 2.2, 1.18);
          tellMesh.scale.set(1.42, 1.42, 1);
          tellMesh.visible = false;
          group.add(tellMesh);
          // Keep the weakpoint visible above the snout for the existing activation mechanic.
          core.position.set(0, 2.78, 1.85);
          world.add(group);
          Object.assign(boss, {
            group, pigGroup: pig, core, phaseGroups, phaseSpecs, tellMesh, ring,
            // Owner 23.11.2026: only the last (farthest) Pig turns into the six forms; the
            // Pig shell (armour, horns, eyes, core, halo, pig) leaves the stage after it.
            hasPhases: index === bosses.length - 1,
            pigShell: group.children.filter((child) => child !== tellMesh && !phaseGroups.includes(child)),
            phaseIndex: 0, phaseState: "pig", vulnerable: true,
            hp: boss.maxHp, alive: true, activated: false, nextAttackAt: 0, lastDamageAt: 0
          });
        });

        if (new URLSearchParams(window.location.search).has("bcm_qa_ring_boss")) {
          window.__BCM_RING_BOSS_QA__ = {
            transition() {
              const boss = worldState.bosses.find((item) => item.alive && item.hasPhases) || worldState.bosses.find((item) => item.alive);
              if (!boss) throw new Error("Ring QA: no live boss");
              worldState.group.visible = true;
              if (worldState.cellPath?.room) worldState.cellPath.room.visible = false;
              scene.traverse((node) => {
                if (node.name === "bcm-asteroid-cell-room" || node.name.startsWith("ring-cell-")) node.visible = false;
              });
              const qaPlayer = players.find(Boolean);
              const arenaNode = worldState.cellPath && Array.from(worldState.cellPath.nodes.values()).find((node) => node.large);
              if (arenaNode) {
                worldState.cellPath.current = arenaNode;
                if (qaPlayer) qaPlayer.ringCurrent = arenaNode;
              }
              if (qaPlayer) {
                qaPlayer.worldX = boss.x - 4;
                qaPlayer.worldY = 0;
                qaPlayer.velocityX = 0;
                // QA only: a standing probe pilot would die to the form's attacks and be sent
                // back to the checkpoint, far from the arena; each form starts at full HP.
                qaPlayer.hp = qaPlayer.maxHp;
              }
              boss.activated = true;
              // QA only: skip the form's own armour so the probe can advance every form.
              boss.moves = null;
              boss.vulnerable = true;
              boss.hp = 1;
              damageBoss(boss, 1, performance.now(), 0);
              return this.snapshot();
            },
            // QA only: beat one Pig with a single hit (the boss-arc probe).
            strike(index) {
              const boss = worldState.bosses[index];
              if (!boss || !boss.alive) return false;
              boss.activated = true; boss.moves = null; boss.vulnerable = true; boss.hp = 1; boss.nextDamageAt = 0;
              damageBoss(boss, 1, performance.now(), 0);
              return { alive: boss.alive, phaseIndex: boss.phaseIndex };
            },
            // QA only: walk the first pilot into a purple cell (a flight panel), from the left door.
            // QA only: walk the first pilot into the n-th small cell with mobs (the mob probe); the
            // pilot is untouchable for a minute so the mobs are watched, not fought.
            enterCell(n) {
              const path = worldState.cellPath;
              const qaPlayer = players.find(Boolean);
              if (!path || !qaPlayer) return null;
              const nodes = Array.from(path.nodes.values()).filter((node) => !node.large && (node.mobs || []).length);
              const node = nodes[Math.abs(Number(n) || 0) % Math.max(1, nodes.length)];
              if (!node) return null;
              path.panelNode = null;
              placeParty(enterRingCell(worldState, node, "left", qaPlayer), qaPlayer);
              qaPlayer.worldY = 0; qaPlayer.vy = 0; qaPlayer.grounded = true; qaPlayer.hp = qaPlayer.maxHp;
              qaPlayer.invulnerableUntil = performance.now() + 60000;
              return { cells: nodes.length, astral: !!node.astral, mobs: node.mobs.length };
            },
            enterFlightCell() {
              const path = worldState.cellPath;
              const qaPlayer = players.find(Boolean);
              if (!path || !qaPlayer) return null;
              const nodes = Array.from(path.nodes.values()).filter((n) => !n.large);
              let node = nodes.find((n) => n.astral && (n.astralMode === "drift" || n.astralMode === "flux"));
              if (!node) { node = nodes.find((n) => n !== path.current) || nodes[0]; node.astral = true; node.astralMode = "drift"; node.airBubbles = node.airBubbles || []; }
              path.panelNode = null;
              placeParty(enterRingCell(worldState, node, "left", qaPlayer), qaPlayer);
              qaPlayer.worldY = 0; qaPlayer.vy = 0; qaPlayer.grounded = true; qaPlayer.hp = qaPlayer.maxHp;
              qaPlayer.jetFuel = 100; qaPlayer.breathReserve = 100;
              return this.flightSnapshot();
            },
            flightSnapshot() {
              const path = worldState.cellPath;
              const fl = path && path.flight;
              const p = players.find(Boolean);
              if (!fl || !p) return { flight: false };
              const t = (performance.now() - fl.startedAt) / 1000;
              return { flight: true, inPanel: !!p.flightPanel, x: p.worldX - fl.hx, y: p.worldY, vy: p.vy, hp: p.hp, jet: p.jetFuel,
                grounded: !!p.grounded, pit: [fl.F.pit.minX, fl.F.pit.maxX], ceilingY: fl.F.ceilingY,
                gates: fl.F.gates.map((g) => ({ x: g.x, gap: window.BCMRingPanels.flightGapAt(g, t) })),
                bubbles: fl.bubbles.filter((b) => b.mesh.visible).length, t,
                pops: (worldState.comicPops || []).filter((pop) => pop.sprite.visible).map((pop) => pop.text) };
            },
            // QA only: put the first pilot at a spot in the arena (the pit probe).
            placePilot(x, y) {
              const qaPlayer = players.find(Boolean);
              if (!qaPlayer) return false;
              qaPlayer.worldX = Number(x); qaPlayer.worldY = Number(y);
              qaPlayer.vy = 0; qaPlayer.grounded = false; qaPlayer.supportPlatform = null;
              return true;
            },
            setRearView(enabled) {
              const boss = worldState.bosses.find((item) => item.alive);
              if (!boss || boss.phaseIndex < 1) return false;
              boss.phaseGroups[boss.phaseIndex - 1].rotation.y = enabled ? Math.PI : 0;
              return true;
            },
            snapshot() {
              const boss = worldState.bosses.find((item) => item.alive && item.hasPhases) || worldState.bosses.find((item) => item.alive);
              if (!boss) return { alive: false };
              const groupOpacity = (group) => {
                let found = null;
                group?.traverse((node) => {
                  if (found === null && node.isMesh && node.material) {
                    const material = Array.isArray(node.material) ? node.material[0] : node.material;
                    found = material && Number.isFinite(material.opacity) ? material.opacity : 1;
                  }
                });
                return found;
              };
              return { alive: boss.alive, bossVisible: !!boss.group.visible,
                bossPosition: boss.group.position.toArray(), phaseIndex: boss.phaseIndex, phaseState: boss.phaseState,
                transitionFromIndex: boss.transitionFromIndex, vfxActive: !!boss.transitionVfx,
                ringVisible: !!boss.ring?.visible,
                visiblePhases: boss.phaseGroups.map((group, index) => group.visible ? index + 1 : 0).filter(Boolean),
                opacities: boss.phaseGroups.map(groupOpacity), pigVisible: !!boss.pigGroup.visible,
                transitionDurationMs: boss.phaseUntil - (boss.phaseStartedAt || 0),
                // Boss moves (ring-boss-moves.js): form, current move, open core, drawn zones.
                moveForm: boss.moves ? boss.moves.form : null, moveState: boss.lastMoveState || null,
                vulnerable: !!boss.vulnerable, bossX: boss.x,
                flight: !!(boss.moves && boss.moves.flight),
                camera: worldState.cameraView || null,
                // The Brawler's clip in the arena (BUG-028): which one plays, and whether the model gave way to it.
                comic: boss.brawlerFilm && boss.brawlerFilm.mesh.visible ? BRAWLER_FILMS[boss.brawlerFilm.key].file : null,
                film: boss.brawlerFilm ? { key: boss.brawlerFilm.key, visible: !!boss.brawlerFilm.mesh.visible,
                  inWorld: boss.brawlerFilm.mesh.parent === boss.group, height: Math.abs(boss.brawlerFilm.mesh.scale.y),
                  mirror: boss.brawlerFilm.mesh.scale.x < 0, modelVisible: !!boss.phaseGroups[3].visible,
                  shake: Math.abs(boss.phaseGroups[3].rotation.z) } : null,
                shielded: !!(boss.shieldMesh && boss.shieldMesh.visible), bossHp: boss.hp,
                aimBand: boss.lastMoveOut && boss.lastMoveOut.tell && boss.lastMoveOut.tell.kind === "aim" ? boss.lastMoveOut.tell : null,
                balls: boss.lastMoveOut && boss.lastMoveOut.balls ? boss.lastMoveOut.balls : [],
                comicVideo: boss.brawlerFilm && boss.brawlerFilm.video ? { ready: boss.brawlerFilm.video.readyState, t: boss.brawlerFilm.video.currentTime,
                  paused: boss.brawlerFilm.video.paused, err: boss.brawlerFilm.video.error && boss.brawlerFilm.video.error.code } : null,
                // Up axis of the current form model in the world (1 = upright, -1 = upside down).
                modelUp: (() => { const record = boss.phaseIndex > 0 && boss.phaseModels && boss.phaseModels[boss.phaseIndex - 1];
                  if (!record || !record.model) return null;
                  const q = record.model.getWorldQuaternion(new THREE.Quaternion());
                  return Math.round(new THREE.Vector3(0, 1, 0).applyQuaternion(q).y * 100) / 100; })(),
                modelClips: (() => { const record = boss.phaseIndex > 0 && boss.phaseModels && boss.phaseModels[boss.phaseIndex - 1];
                  return record ? record.activeClip : null; })(),
                transformVideo: boss.transformVideo ? {
                  file: String(boss.transformVideo.url).split("/").pop().split("?")[0],
                  time: boss.transformVideo.video.currentTime, started: boss.transformVideo.started,
                  failed: boss.transformVideo.failed, opacity: boss.transformVideo.material.opacity,
                  visible: !!boss.transformVideo.mesh.visible } : null,
                transformVideoDropped: boss.transformVideoDropped || null,
                // Pig arc: what of the Pig (shell) is still drawn, and which Pigs carry forms.
                shellVisible: (() => { let n = 0; boss.group.children.forEach((child) => {
                  if (child === boss.tellMesh || boss.phaseGroups.includes(child) || !child.visible) return;
                  child.traverse((node) => { if (node.isMesh && node.visible) n += 1; }); }); return n; })(),
                bosses: worldState.bosses.map((item) => ({ alive: item.alive, phaseIndex: item.phaseIndex, hasPhases: !!item.hasPhases })),
                formArtLit: boss.phaseIndex > 0 ? (() => { let lit = 0, all = 0; boss.phaseGroups[boss.phaseIndex - 1].traverse((node) => {
                  if (!node.isMesh || !node.material || !node.material.map) return; all += 1; if (node.material.emissiveMap || node.material.isMeshBasicMaterial) lit += 1; });
                  return all ? lit / all : null; })() : null,
                chase: worldState.chase && worldState.chase.out ? {
                  phase: worldState.chase.out.phase, gap: worldState.chase.out.gap, lane: worldState.chase.out.player.lane,
                  y: worldState.chase.out.player.y, bossState: worldState.chase.out.boss.state, vulnerable: worldState.chase.out.boss.vulnerable,
                  obstacles: worldState.chase.out.obstacles.length, hits: worldState.chase.hitCount, shots: worldState.chase.shotCount,
                  landed: worldState.chase.landedCount, jetjetModel: worldState.chase.models.flight, runnerModel: worldState.chase.models.runner,
                  cameraBehind: worldState.chase.camera.position.z > worldState.chase.jetjet.position.z } : null,
                homeX: boss.homeX ?? boss.x,
                pit: (boss.pitMeshes || []).some((mesh) => mesh.visible && /^ring-boss-pit-\d/.test(mesh.name)),
                ledges: boss.moves && boss.lastMoveOut ? boss.lastMoveOut.ledges || [] : [],
                bubbles: (boss.bubbleMeshes || []).filter((mesh) => mesh.visible).length,
                pilot: (() => { const p = players.find(Boolean); return p ? { x: p.worldX, y: p.worldY, jet: p.jetFuel, air: p.breathReserve,
                  flame: !!(p.jetFlame && p.jetFlame.visible), bossFlight: !!p.bossFlight, hp: p.hp } : null; })(),
                zones: (boss.zoneMeshes || []).filter((mesh) => mesh.visible).map((mesh) => mesh.name) };
            }
          };
        }

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

        const frontierWorld = {
          group: world, boxGeometry, materials, textures: worldTextures, parallaxPanels,
          specialGeometry: [...extraGeometries, bossBodyGeometry, bossOutlineGeometry, bossArmorGeometry,
            bossHornGeometry, bossCoreGeometry, bossEyeGeometry, pigSphereGeometry, pigEarGeometry,
            pigTuskGeometry, pigTailGeometry, bossRingGeometry, exitGeometry, shockwaveGeometry, pickupGeometry],
          platforms, bosses, barriers, coreMeshes, exitMarker, exitX: 81, spawnX: -45,
          shockwaves: [], shockwaveGeometry, shockwaveMaterial,
          defeatedBosses: 0, pickupGeometry, disposed: false
        };
        loadRingBossPhaseModels(frontierWorld);
        return frontierWorld;
      }

      function updateRoomSlice() {
        // The pigs-and-ring side-scroller stays one large cell. Neighbors use the asteroid chart.
      }

      function attachAsteroidCellPath(world) {
        const RING_CELL_HOME = 420;
        // Owner 19.11.2026 (IDEA-024): each cell is a comic panel with its own level,
        // so the cell is wider and taller than the old 12 x 3.6 m corridor.
        const ROOM_HALF = 9;
        const CELL_HEIGHT = 6;
        const keyOf = (x, y, z) => x + "," + y + "," + z;
        const step = { xp: [1, 0, 0], xn: [-1, 0, 0], zp: [0, 0, 1], zn: [0, 0, -1], yp: [0, 1, 0], yn: [0, -1, 0] };
        const opposite = { xp: "xn", xn: "xp", zp: "zn", zn: "zp", yp: "yn", yn: "yp" };
        const nodes = new Map();
        const airBubbleGeometry = new THREE.SphereGeometry(0.27, 12, 10);
        const airBubbleMaterial = new THREE.MeshBasicMaterial({
          color: 0x93f7ff, transparent: true, opacity: 0.84, depthWrite: false
        });
        world.specialGeometry.push(airBubbleGeometry);
        world.materials.push(airBubbleMaterial);
        (maze.cells || []).forEach((cell) => {
          const large = !!(maze.exitCell && cell.x === maze.exitCell.x && cell.y === maze.exitCell.y && cell.z === maze.exitCell.z);
          const astral = cell.y !== 1;
          const astralHash = hashSeed(String(maze.seed) + "|astral|" + cell.x + "|" + cell.y + "|" + cell.z);
          const astralMode = astral ? ["drift", "flux", "dense"][astralHash % 3] : "normal";
          const node = {
            x: cell.x, y: cell.y, z: cell.z,
            open: cell.open || {},
            wallTurn: cell.wallTurn || 0,
            wallAsset: cell.wallAsset || 0,
            astral,
            astralMode,
            astralPhase: ((hashSeed(String(maze.seed) + "|phase|" + cell.x + "|" + cell.y + "|" + cell.z) / 0xffffffff) * Math.PI * 2),
            large,
            mobs: [],
            airBubbles: []
          };
          if (astral && (astralMode === "drift" || astralMode === "flux")) {
            for (let i = 0; i < 3; i += 1) {
              const mesh = new THREE.Mesh(airBubbleGeometry, airBubbleMaterial);
              mesh.name = "ring-air-bubble-" + cell.x + "-" + cell.y + "-" + cell.z + "-" + i;
              mesh.position.set(RING_CELL_HOME - 5.8 + i * 5.8, 1.35 + ((astralHash >>> (i * 3)) % 3) * 1.05, 0.62);
              mesh.visible = false;
              world.group.add(mesh);
              node.airBubbles.push({ mesh, taken: false, x: mesh.position.x, y: mesh.position.y });
            }
          }
          nodes.set(keyOf(cell.x, cell.y, cell.z), node);
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
          // Owner 24.11.2026: "не дошёл даже до боссов, в какой-то момент меня повело обратно".
          // Entering the large cell set visitedLarge and a pending Hydrogen shard pulled the
          // route aside, so the arrows turned home with the bosses still alive. While a boss
          // lives, the route leads to the boss arena first; shards and home come after.
          const bossArena = [...nodes.values()].find((candidate) => candidate.large);
          if (Number(world.defeatedBosses || 0) < 3 && bossArena && bossArena !== fromNode) return bossArena;
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
        // Ring cell tiles (owner 19.11.2026, sheet art/tower-ring-kits/textures-grid.webp,
        // atlas cut by tools/ring-tiles/cut.mjs: 4x4 tiles of 128 px). Each floor of
        // the asteroid has its own theme; the cell's wallAsset picks the variant, so
        // the Ring is still built from the asteroid's own cells. Until the atlas has
        // loaded (or if it is missing) the cell keeps the asteroid rock.
        const RING_CELL_THEMES = [
          { id: "brick", walls: [0, 1, 2], floor: [3, 15], light: 0xffd8b0, glow: 0x000000 },
          { id: "ice", walls: [4, 5], floor: [6, 7], light: 0xd4ecff, glow: 0x000000 },
          { id: "lava", walls: [8, 9], floor: [10, 11], light: 0xffa060, glow: 0x3a0c02 }
        ];
        const RING_TILE_DOOR = 12;
        const RING_TILE_HAZARD = 13;
        const RING_TILE_HATCH = 14;
        const backMaterial = new THREE.MeshStandardMaterial({
          map: textures[0], color: 0xffffff, roughness: 0.9, metalness: 0.12,
          emissive: 0x000000, emissiveIntensity: 0
        });
        const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x8a96a0, roughness: 0.6, metalness: 0.45, emissive: 0x000000, emissiveIntensity: 0 });
        const trimMaterial = new THREE.MeshStandardMaterial({ color: 0xd8b03a, roughness: 0.7, metalness: 0.2 });
        const ringTiles = { ready: false, canvases: [], cache: new Map() };
        ringTiles.get = (index, role) => {
          const key = index + ":" + role;
          if (ringTiles.cache.has(key)) return ringTiles.cache.get(key);
          const source = ringTiles.canvases[index];
          if (!source) return null;
          const tex = new THREE.CanvasTexture(source);
          tex.name = "ring-tile-" + index + "-" + role;
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.RepeatWrapping;
          const repeat = { floor: [6, 2], wall: [2, 1.4], back: [6, 2.3], door: [1, 1.5], trim: [3, 0.5], hatch: [1, 1] }[role] || [1, 1];
          tex.repeat.set(repeat[0], repeat[1]);
          if (THREE.sRGBEncoding !== undefined) tex.encoding = THREE.sRGBEncoding;
          ringTiles.cache.set(key, tex);
          if (world.textures) world.textures.push(tex);
          return tex;
        };
        (function loadRingTiles() {
          const assets = Array.isArray(config.assets) ? config.assets : [];
          const found = assets.find((item) => String(item && (item.name || item.url) || "")
            .split(/[?#]/)[0].split("/").pop().toLowerCase() === "ring-tiles.webp");
          let url = found && found.url ? String(found.url) : "";
          if (!url) {
            try {
              const script = document.querySelector('script[src*="deep-space-warp"]');
              if (script && script.src) url = String(script.src).split(/[?#]/)[0].replace(/[^/]*$/, "") + "../textures/ring-tiles.webp";
            } catch (e) {}
          }
          if (!url) return;
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            for (let i = 0; i < 16; i += 1) {
              const c = document.createElement("canvas");
              c.width = 128;
              c.height = 128;
              c.getContext("2d").drawImage(img, (i % 4) * 128, Math.floor(i / 4) * 128, 128, 128, 0, 0, 128, 128);
              ringTiles.canvases.push(c);
            }
            ringTiles.ready = true;
            try { if (world.cellPath) applyRingCellLook(world); } catch (e) {}
          };
          img.onerror = () => { try { console.warn("Mini-Sim Ring tiles missing; the cells keep the asteroid rock.", url); } catch (e) {} };
          img.src = url;
        })();
        const room = new THREE.Group();
        room.name = "bcm-asteroid-cell-room";
        const floor = new THREE.Mesh(new THREE.BoxGeometry(ROOM_HALF * 2, 0.36, 3.8), floorMaterial);
        floor.position.set(RING_CELL_HOME, -0.18, 0);
        room.add(floor);
        const doorGeo = new THREE.BoxGeometry(0.28, 2.4, 0.4);
        const doorLeft = new THREE.Mesh(doorGeo, doorMaterial);
        const doorRight = new THREE.Mesh(doorGeo, doorMaterial);
        doorLeft.name = "ring-cell-door-left";
        doorRight.name = "ring-cell-door-right";
        // A hazard-striped lintel over each door, and the doorway itself on the back
        // wall (the door box shows the camera only its 0.28 m edge). Children of the
        // door, so they come and go with it.
        const lintelGeo = new THREE.BoxGeometry(0.42, 0.34, 0.6);
        const doorwayGeo = new THREE.PlaneGeometry(1.5, 2.3);
        const doorwayTrimGeo = new THREE.PlaneGeometry(1.8, 0.32);
        [doorLeft, doorRight].forEach((door, index) => {
          const lintel = new THREE.Mesh(lintelGeo, trimMaterial);
          lintel.position.set(0, 1.37, 0);
          door.add(lintel);
          const inward = index === 0 ? 1 : -1;
          const doorway = new THREE.Mesh(doorwayGeo, doorMaterial);
          doorway.name = "ring-cell-doorway";
          doorway.position.set(inward * 0.95, -0.03, -1.47);
          door.add(doorway);
          const doorwayTrim = new THREE.Mesh(doorwayTrimGeo, trimMaterial);
          doorwayTrim.position.set(inward * 0.95, 1.26, -1.46);
          door.add(doorwayTrim);
        });
        doorLeft.position.set(RING_CELL_HOME - ROOM_HALF + 0.2, 1.15, 0);
        doorRight.position.set(RING_CELL_HOME + ROOM_HALF - 0.2, 1.15, 0);
        const sealedWallGeo = new THREE.BoxGeometry(0.24, CELL_HEIGHT + 0.2, 3.8);
        const sealedWallLeft = new THREE.Mesh(sealedWallGeo, wallMaterial);
        const sealedWallRight = new THREE.Mesh(sealedWallGeo, wallMaterial);
        sealedWallLeft.name = "ring-cell-sealed-wall-left";
        sealedWallRight.name = "ring-cell-sealed-wall-right";
        sealedWallLeft.position.set(RING_CELL_HOME - ROOM_HALF + 0.12, CELL_HEIGHT / 2, 0);
        sealedWallRight.position.set(RING_CELL_HOME + ROOM_HALF - 0.12, CELL_HEIGHT / 2, 0);
        // The wall above each door stays when the door is open.
        const headerGeo = new THREE.BoxGeometry(0.24, CELL_HEIGHT - 2.35, 3.8);
        [-1, 1].forEach((side) => {
          const header = new THREE.Mesh(headerGeo, wallMaterial);
          header.name = "ring-cell-door-header";
          header.position.set(RING_CELL_HOME + side * (ROOM_HALF - 0.12), 2.35 + (CELL_HEIGHT - 2.35) / 2, 0);
          room.add(header);
        });
        room.add(sealedWallLeft, sealedWallRight, doorLeft, doorRight);
        const backGeo = new THREE.PlaneGeometry(ROOM_HALF * 2.4, CELL_HEIGHT + 2.4);
        const backWall = new THREE.Mesh(backGeo, backMaterial);
        backWall.name = "ring-cell-asteroid-face";
        backWall.position.set(RING_CELL_HOME, CELL_HEIGHT / 2, -1.5);
        const ceilingGeo = new THREE.BoxGeometry(ROOM_HALF * 2, 0.28, 3.6);
        const ceiling = new THREE.Mesh(ceilingGeo, floorMaterial);
        ceiling.name = "ring-cell-asteroid-ceiling";
        ceiling.position.set(RING_CELL_HOME, CELL_HEIGHT + 0.14, 0);
        room.add(backWall, ceiling);
        // The cell's own light, tinted by its theme: the asteroid light alone left it black.
        const roomLight = new THREE.PointLight(0xffd8b0, 2.1, 34, 1.3);
        roomLight.name = "ring-cell-light";
        roomLight.position.set(RING_CELL_HOME, 4.6, 3.2);
        // Comic panel frame: a thick black border round the cell, and a caption box.
        const frameMat = new THREE.MeshBasicMaterial({ color: 0x07070a });
        const frameGeoH = new THREE.BoxGeometry(ROOM_HALF * 2 + 1.0, 0.42, 0.2);
        const frameGeoV = new THREE.BoxGeometry(0.42, CELL_HEIGHT + 1.4, 0.2);
        [[0, -0.55, frameGeoH], [0, CELL_HEIGHT + 0.55, frameGeoH], [-(ROOM_HALF + 0.29), CELL_HEIGHT / 2, frameGeoV], [ROOM_HALF + 0.29, CELL_HEIGHT / 2, frameGeoV]]
          .forEach(([x, y, geo]) => {
            const bar = new THREE.Mesh(geo, frameMat);
            bar.name = "ring-cell-comic-frame";
            bar.position.set(RING_CELL_HOME + x, y, 1.6);
            room.add(bar);
          });
        const captionCanvas = document.createElement("canvas");
        captionCanvas.width = 512;
        captionCanvas.height = 96;
        const captionTexture = new THREE.CanvasTexture(captionCanvas);
        if (THREE.sRGBEncoding !== undefined) captionTexture.encoding = THREE.sRGBEncoding;
        const captionGeo = new THREE.PlaneGeometry(4.6, 0.86);
        const caption = new THREE.Mesh(captionGeo, new THREE.MeshBasicMaterial({ map: captionTexture, transparent: true }));
        caption.name = "ring-cell-caption";
        caption.position.set(RING_CELL_HOME - ROOM_HALF + 2.6, CELL_HEIGHT - 0.55, 1.5);
        room.add(caption);
        room.add(roomLight);
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
        // Owner 24.11.2026 (BUG-028): "мобы не проработаны". The cells held 0.7 x 0.9 m boxes that all
        // walked alike; now the owner's pig mobs (ring-mobs.js; art: assets/ring-bosses/mobs.webp),
        // each kind with its own gait and toughness, drawn flat and unlit like the art.
        const mobGeo = new THREE.PlaneGeometry(1, 1);
        const mobArt = { texture: null, byKind: {} };
        (function loadMobArt() {
          const url = ringBossAssetUrl("ring-bosses/mobs.webp");
          if (!url || !THREE.TextureLoader) return;
          // Each kind is a copy of the atlas with its own window; a copy made before the atlas
          // arrived has no picture, so the picture is handed to every copy once it loads.
          mobArt.texture = new THREE.TextureLoader().load(url, (loaded) => {
            Object.keys(mobArt.byKind).forEach((key) => { mobArt.byKind[key].image = loaded.image; mobArt.byKind[key].needsUpdate = true; });
          });
          world.textures.push(mobArt.texture);
        })();
        const mobTexture = (kindIndex) => {
          if (!mobArt.texture) return null;
          if (mobArt.byKind[kindIndex]) return mobArt.byKind[kindIndex];
          const r = window.BCMRingMobs.ART[kindIndex];
          const tex = mobArt.texture.clone();
          tex.repeat.set(r[2] - r[0], r[3] - r[1]);
          tex.offset.set(r[0], 1 - r[3]);
          tex.needsUpdate = true;
          mobArt.byKind[kindIndex] = tex;
          world.textures.push(tex);
          return tex;
        };
        const mobThreadGeo = new THREE.BoxGeometry(0.03, 1, 0.03);
        const mobThreadMat = new THREE.MeshBasicMaterial({ color: 0xc8d2e0, transparent: true, opacity: 0.7 });
        world.materials.push(mobThreadMat);
        nodes.forEach((node) => {
          if (node.large) return;
          const sides = ["xn", "xp", "zn", "zp", "yn", "yp"].filter((dir) => node.open && node.open[dir]);
          const count = Math.min(2, sides.length);
          for (let i = 0; i < count; i += 1) {
            const side = sides[i];
            const kindIndex = hashSeed(String(maze.seed) + "|mob|" + node.x + "|" + node.y + "|" + node.z + "|" + i) % 9;
            const kind = window.BCMRingMobs ? window.BCMRingMobs.KINDS[kindIndex] : "base";
            const material = new THREE.MeshBasicMaterial({
              map: window.BCMRingMobs ? mobTexture(kindIndex) : null, color: 0xffffff,
              transparent: true, alphaTest: 0.35, side: THREE.DoubleSide
            });
            world.materials.push(material);
            const mesh = new THREE.Mesh(mobGeo, material);
            mesh.visible = false;
            mesh.name = "ring-cell-mob";
            mesh.userData.bcmMobKind = kind;
            mesh.renderOrder = 4;
            room.add(mesh);
            let thread = null;
            if (kind === "spider") {
              thread = new THREE.Mesh(mobThreadGeo, mobThreadMat);
              thread.name = "ring-cell-mob-thread";
              thread.visible = false;
              room.add(thread);
            }
            const fromLeft = side === "xn" || side === "zn" || side === "yn";
            node.mobs.push({
              side,
              kind,
              offset: fromLeft ? -4.2 : 4.2,
              dir: fromLeft ? 1 : -1,
              phase: i * 2.1 + (kindIndex % 3),
              alive: true,
              respawnAt: 0,
              mesh,
              thread,
              ai: null
            });
          }
        });
        scene.add(room);
        world.platforms.push({ minX: RING_CELL_HOME - ROOM_HALF, maxX: RING_CELL_HOME + ROOM_HALF, y: 0, cellRoom: true });
        world.materials.push(floorMaterial, wallMaterial, backMaterial, doorMaterial, trimMaterial, hatch.material, portalMaterial);
        textures.forEach((texture) => world.textures.push(texture));
        world.specialGeometry.push(floor.geometry, doorGeo, lintelGeo, doorwayGeo, doorwayTrimGeo, sealedWallGeo, hatch.geometry, portalRing.geometry, mobGeo, mobThreadGeo, backGeo, ceilingGeo);
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
          panelSeed: Number(maze.seed) >>> 0, cellHeight: CELL_HEIGHT, roomHalf: ROOM_HALF, panelGroup: null, panelNode: null, spikes: [],
          // Every Ring entry is a new run: the panels are rebuilt (owner 20.11: replayability).
          panelRun: (window.__bcmRingRuns = (Number(window.__bcmRingRuns) || 0) + 1), panelGrid: null,
          // A block top the hands can reach (crew-core crewLedgeStep asks this).
          ledgeAt(x, footY, dir) {
            const grid = this.panelGrid;
            if (!grid) return null;
            const left = this.homeX - this.half;
            const col = Math.floor(x - left);
            const rows = grid.length;
            if (col < 0 || col >= grid[0].length) return null;
            const solid = (r) => r >= 0 && r < rows && "BMCR".indexOf(grid[rows - 1 - r][col]) >= 0;
            for (let r = rows - 1; r >= 0; r -= 1) {
              if (!solid(r) || solid(r + 1) || solid(r + 2)) continue;
              const top = r + 1;
              if (top >= footY + 0.9 && top <= footY + 2.2 && top + 1.8 <= rows) return { top, edgeX: left + col + (dir > 0 ? 0 : 1) };
            }
            return null;
          },
          solidAt(x, y0, y1) {
            const grid = this.panelGrid;
            if (!grid) return false;
            const col = Math.floor(x - (this.homeX - this.half));
            if (col < 0 || col >= grid[0].length) return false;
            for (let r = Math.max(0, Math.floor(y0)); r <= Math.min(grid.length - 1, Math.floor(y1)); r += 1) {
              if ("BMCR".indexOf(grid[grid.length - 1 - r][col]) >= 0) return true;
            }
            return false;
          },
          captionCanvas, captionTexture, frameMat,
          room, floorMaterial, wallMaterial, backMaterial, doorMaterial, trimMaterial, roomLight, ringTiles, RING_CELL_THEMES,
          RING_TILE_DOOR, RING_TILE_HAZARD, RING_TILE_HATCH, doorLeft, doorRight, sealedWallLeft, sealedWallRight,
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

      // The cell's comic panel (ring-panels.js): platforms, spikes and a caption,
      // rebuilt when the pilot enters another cell. The boss arena keeps its own layout.
      function buildCellPanel(world, path, node) {
        if (!path || !node || path.panelNode === node) return;
        path.panelNode = node;
        if (path.panelGroup) {
          path.room.remove(path.panelGroup);
          path.panelGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
          path.panelGroup = null;
        }
        for (let i = world.platforms.length - 1; i >= 0; i -= 1) if (world.platforms[i].cellPanel) world.platforms.splice(i, 1);
        path.spikes = [];
        path.flight = null;
        if (node.large || !window.BCMRingPanels) return;
        // Owner 23.11.2026: a purple (low-gravity) cell is crossed on the jet — a flight panel
        // (ring-panels.js): pit, drifting energy gates, ceiling spikes, a rest island, bubbles.
        const flightCell = !!(node.astral && (node.astralMode === "drift" || node.astralMode === "flux") &&
          window.BCMRingPanels.buildFlightPanel);
        const panel = flightCell
          ? window.BCMRingPanels.buildFlightPanel(path.panelSeed, node, { half: path.half, height: path.cellHeight, run: path.panelRun })
          : window.BCMRingPanels.buildPanel(path.panelSeed, node, { half: path.half, height: path.cellHeight, run: path.panelRun });
        path.panelGrid = panel.grid || null;
        const group = new THREE.Group();
        group.name = "ring-cell-panel-" + panel.kind;
        // The block grid (ring-panels.js): bricks wear the theme wall, metal the steel
        // tile, crates and barrels their own colour. One instanced mesh per kind.
        if (panel.grid) {
          if (!path.metalMaterial) path.metalMaterial = new THREE.MeshStandardMaterial({ color: 0x9aa4ac, roughness: 0.5, metalness: 0.55 });
          if (!path.crateMaterial) path.crateMaterial = new THREE.MeshStandardMaterial({ color: 0x9a6a36, roughness: 0.85 });
          if (!path.barrelMaterial) path.barrelMaterial = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.5, metalness: 0.3, emissive: 0x2a0500, emissiveIntensity: 0.4 });
          if (path.ringTiles && path.ringTiles.ready && !path.metalMaterial.map) {
            path.metalMaterial.map = path.ringTiles.get(15, "hatch");
            path.metalMaterial.color.setHex(0xffffff);
            path.metalMaterial.needsUpdate = true;
          }
          const kinds = {
            B: { geo: new THREE.BoxGeometry(1, 1, 1.8), mat: path.wallMaterial },
            M: { geo: new THREE.BoxGeometry(1, 1, 1.8), mat: path.metalMaterial },
            C: { geo: new THREE.BoxGeometry(0.92, 0.92, 1.2), mat: path.crateMaterial },
            R: { geo: new THREE.CylinderGeometry(0.42, 0.42, 0.96, 12), mat: path.barrelMaterial }
          };
          const rows = panel.grid.length;
          const cells = { B: [], M: [], C: [], R: [] };
          panel.grid.forEach((row, i) => {
            for (let c = 0; c < row.length; c += 1) if (cells[row[c]]) cells[row[c]].push([c, rows - 1 - i]);
          });
          const dummy = new THREE.Object3D();
          Object.keys(cells).forEach((k) => {
            if (!cells[k].length) return;
            const mesh = new THREE.InstancedMesh(kinds[k].geo, kinds[k].mat, cells[k].length);
            mesh.name = "ring-cell-blocks-" + k;
            cells[k].forEach(([c, r], n) => {
              dummy.position.set(path.homeX - path.half + c + 0.5, r + 0.5 - (k === "C" ? 0.04 : 0), 0);
              dummy.updateMatrix();
              mesh.setMatrixAt(n, dummy.matrix);
            });
            mesh.instanceMatrix.needsUpdate = true;
            group.add(mesh);
          });
        }
        path.crumbles = [];
        path.timedSpikes = [];
        const plateGeo = new THREE.BoxGeometry(0.96, 0.26, 1.6);
        const plateMat = path.plateMaterial || (path.plateMaterial = new THREE.MeshStandardMaterial({ color: 0xb5652e, roughness: 0.8, emissive: 0x2a0c00, emissiveIntensity: 0.3 }));
        panel.platforms.forEach((p) => {
          const platform = { minX: path.homeX + p.minX, maxX: path.homeX + p.maxX, y: p.y, cellPanel: true };
          if (p.crumble) {
            // Crumbling plate: shakes when stood on, falls after 0.55 s, back after 5 s.
            platform.crumble = true;
            platform.mesh = new THREE.Mesh(plateGeo, plateMat);
            platform.mesh.name = "ring-cell-crumble";
            platform.mesh.position.set((platform.minX + platform.maxX) / 2, p.y - 0.13, 0);
            platform.baseX = platform.mesh.position.x;
            group.add(platform.mesh);
            path.crumbles.push(platform);
          }
          world.platforms.push(platform);
        });
        path.slicers = [];
        const jawGeo = new THREE.BoxGeometry(0.9, 0.12, 1.5);
        const jawMat = path.jawMaterial || (path.jawMaterial = new THREE.MeshStandardMaterial({ color: 0xd9dee3, metalness: 0.85, roughness: 0.25, emissive: 0x330000, emissiveIntensity: 0.35 }));
        (panel.traps || []).filter((t) => t.kind === "slicer").forEach((t) => {
          const jaws = new THREE.Group();
          jaws.name = "ring-cell-slicer";
          const low = new THREE.Mesh(jawGeo, jawMat);
          const high = new THREE.Mesh(jawGeo, jawMat);
          jaws.add(low, high);
          jaws.position.set(path.homeX + (t.minX + t.maxX) / 2, 0, 0.1);
          group.add(jaws);
          path.slicers.push({ trap: t, low, high, x: path.homeX + (t.minX + t.maxX) / 2, wasShut: false });
        });
        (panel.traps || []).filter((t) => t.kind === "timed").forEach((t, n) => {
          const row = new THREE.Group();
          row.name = "ring-cell-timed-spikes";
          for (let x = t.minX + 0.22; x < t.maxX - 0.1; x += 0.42) {
            for (const z of [-0.5, 0.1, 0.7]) {
              const spike = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.55, 4), path.spikeMaterial || (path.spikeMaterial = new THREE.MeshStandardMaterial({ color: 0xb8c0c8, metalness: 0.7, roughness: 0.3, emissive: 0x3a0000, emissiveIntensity: 0.4 })));
              spike.position.set(path.homeX + x, 0.27, z);
              row.add(spike);
            }
          }
          group.add(row);
          path.timedSpikes.push({ minX: path.homeX + t.minX, maxX: path.homeX + t.maxX, group: row, phase: n * 0.6, active: false });
        });
        const spikeGeo = new THREE.ConeGeometry(0.2, 0.55, 4);
        const spikeMat = path.spikeMaterial || (path.spikeMaterial = new THREE.MeshStandardMaterial({ color: 0xb8c0c8, metalness: 0.7, roughness: 0.3, emissive: 0x3a0000, emissiveIntensity: 0.4 }));
        panel.spikes.forEach((s) => {
          const row = new THREE.Group();
          row.name = "ring-cell-spikes";
          for (let x = s.minX + 0.22; x < s.maxX - 0.1; x += 0.42) {
            for (const z of [-0.5, 0.1, 0.7]) {
              const spike = new THREE.Mesh(spikeGeo, spikeMat);
              spike.position.set(path.homeX + x, 0.27, z);
              row.add(spike);
            }
          }
          group.add(row);
          path.spikes.push({ minX: path.homeX + s.minX, maxX: path.homeX + s.maxX });
        });
        if (panel.flight) buildFlightPanelLook(path, group, panel, node);
        path.room.add(group);
        path.panelGroup = group;
        // Comic caption: the panel's name, like a narration box.
        const names = { steps: "СТУПЕНИ", bridge: "МОСТ НАД ШИПАМИ", tower: "БАШНЯ", gallery: "ГАЛЕРЕЯ" };
        const ctx = path.captionCanvas && path.captionCanvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, 512, 96);
          ctx.fillStyle = "#ffe066";
          ctx.fillRect(4, 4, 504, 88);
          ctx.lineWidth = 8;
          ctx.strokeStyle = "#07070a";
          ctx.strokeRect(4, 4, 504, 88);
          ctx.fillStyle = "#07070a";
          ctx.font = "bold 44px Impact, 'Arial Black', sans-serif";
          ctx.textBaseline = "middle";
          const text = panel.label || names[panel.kind] || String(panel.kind).toUpperCase();
          ctx.font = (text.length > 18 ? "bold 30px" : "bold 44px") + " Impact, 'Arial Black', sans-serif";
          ctx.fillText(text, 24, 50);
          path.captionTexture.needsUpdate = true;
        }
      }

      // Comic sound words (owner 23.11.2026: more worked-out comic moments on the way):
      // a lettered burst at the spot — ФЬЮУ! on a fall, ВЖЖ! on a gate, БУЛЬ! on a bubble,
      // КРАК! when a plate gives way, ЧАК! when a blade snaps. Pooled canvas sprites, 0.8 s.
      function comicPop(text, x, y) {
        const pops = worldState.comicPops || (worldState.comicPops = []);
        const path = worldState.cellPath;
        const parent = path && path.room && path.room.visible ? path.room : worldState.group;
        let pop = pops.find((item) => !item.sprite.visible);
        if (!pop) {
          const canvas = document.createElement("canvas");
          canvas.width = 256; canvas.height = 128;
          const texture = new THREE.CanvasTexture(canvas);
          const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false }));
          sprite.renderOrder = 30;
          sprite.name = "ring-comic-pop";
          pop = { canvas, texture, sprite, text: "", age: 0 };
          pops.push(pop);
        }
        if (pop.sprite.parent !== parent) parent.add(pop.sprite);
        const ctx = pop.canvas.getContext("2d");
        ctx.clearRect(0, 0, 256, 128);
        // A jagged burst behind the word.
        ctx.beginPath();
        for (let i = 0; i < 18; i += 1) {
          const a = (i / 18) * Math.PI * 2;
          const r = i % 2 ? 44 : 62;
          ctx.lineTo(128 + Math.cos(a) * r * 1.8, 64 + Math.sin(a) * r * 0.95);
        }
        ctx.closePath();
        ctx.fillStyle = "#ffe066"; ctx.fill();
        ctx.lineWidth = 6; ctx.strokeStyle = "#07070a"; ctx.stroke();
        ctx.font = "bold 46px Impact, 'Arial Black', sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.lineWidth = 8; ctx.strokeStyle = "#07070a"; ctx.strokeText(text, 128, 66);
        ctx.fillStyle = "#ff3b5c"; ctx.fillText(text, 128, 66);
        pop.texture.needsUpdate = true;
        pop.text = text; pop.age = 0;
        pop.sprite.position.set(x, y, 1.6);
        pop.sprite.visible = true;
        pop.sprite.material.opacity = 1;
        return pop;
      }

      function updateComicPops(dt) {
        (worldState.comicPops || []).forEach((pop) => {
          if (!pop.sprite.visible) return;
          pop.age += dt;
          const k = pop.age / 0.8;
          const s = k < 0.15 ? 0.4 + k / 0.15 * 0.9 : 1.3 - Math.min(0.2, (k - 0.15) * 0.3);
          pop.sprite.scale.set(2.2 * s, 1.1 * s, 1);
          pop.sprite.position.y += dt * 0.6;
          pop.sprite.material.opacity = Math.max(0, 1 - Math.max(0, k - 0.6) / 0.4);
          if (k >= 1) pop.sprite.visible = false;
        });
      }

      // Flight panel look: dark abyss over the floor, two energy pillars per gate (their gap
      // moves, ring-panels.js flightGapAt), ceiling spikes, a metal rest island, bubbles.
      function buildFlightPanelLook(path, group, panel, node) {
        const F = panel.flight;
        const hx = path.homeX;
        const mat = (key, make) => path[key] || (path[key] = make());
        const gateMat = mat("flightGateMat", () => new THREE.MeshBasicMaterial({ color: 0x7ff6ff, transparent: true, opacity: 0.78, depthWrite: false }));
        const abyssMat = mat("flightAbyssMat", () => new THREE.MeshBasicMaterial({ color: 0x05030c }));
        const edgeMat = mat("flightEdgeMat", () => new THREE.MeshBasicMaterial({ color: 0xc08bff }));
        const bubbleMat = mat("flightBubbleMat", () => new THREE.MeshBasicMaterial({ color: 0x9fe7ff, transparent: true, opacity: 0.55, depthWrite: false }));
        const spikeMat = path.spikeMaterial || (path.spikeMaterial = new THREE.MeshStandardMaterial({ color: 0xb8c0c8, metalness: 0.7, roughness: 0.3, emissive: 0x3a0000, emissiveIntensity: 0.4 }));
        const pitW = F.pit.maxX - F.pit.minX;
        const abyss = new THREE.Mesh(new THREE.BoxGeometry(pitW, 0.5, 3.0), abyssMat);
        abyss.name = "ring-flight-abyss";
        abyss.position.set(hx + (F.pit.minX + F.pit.maxX) / 2, -0.2, 0);
        group.add(abyss);
        [F.pit.minX, F.pit.maxX].forEach((x) => {
          const edge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 3.0), edgeMat);
          edge.position.set(hx + x, 0.02, 0);
          group.add(edge);
        });
        const gates = F.gates.map((gate, i) => {
          const lower = new THREE.Mesh(new THREE.BoxGeometry(gate.width, 1, 1.0), gateMat);
          const upper = new THREE.Mesh(new THREE.BoxGeometry(gate.width, 1, 1.0), gateMat);
          lower.name = "ring-flight-gate-" + i + "-low";
          upper.name = "ring-flight-gate-" + i + "-high";
          group.add(lower, upper);
          return { gate, lower, upper };
        });
        const spikeGeo = new THREE.ConeGeometry(0.18, 0.5, 4);
        for (let x = F.pit.minX + 0.25; x < F.pit.maxX; x += 0.5) {
          const spike = new THREE.Mesh(spikeGeo, spikeMat);
          spike.rotation.z = Math.PI;
          spike.position.set(hx + x, F.ceilingY + 0.25, 0.2);
          group.add(spike);
        }
        const islandGeo = new THREE.BoxGeometry(1, 0.3, 1.2);
        F.islands.forEach((isl) => {
          const island = new THREE.Mesh(islandGeo, path.metalMaterial || edgeMat);
          island.name = "ring-flight-island";
          island.scale.x = isl.maxX - isl.minX;
          island.position.set(hx + (isl.minX + isl.maxX) / 2, isl.y - 0.15, 0);
          group.add(island);
        });
        const bubbleGeo = new THREE.SphereGeometry(0.27, 12, 10);
        const bubbles = F.bubbles.map((b) => {
          const mesh = new THREE.Mesh(bubbleGeo, bubbleMat);
          mesh.name = "ring-flight-bubble";
          mesh.position.set(hx + b.x, b.y, 0.6);
          group.add(mesh);
          return { x: hx + b.x, y: b.y, mesh, taken: false, respawnAt: 0 };
        });
        // The cell's own scattered bubbles give way to the panel's.
        (node.airBubbles || []).forEach((b) => { b.taken = true; b.respawnAt = Infinity; if (b.mesh) b.mesh.visible = false; });
        path.flight = {
          F, gates, bubbles, startedAt: performance.now(), hx,
          pitMinX: hx + F.pit.minX, pitMaxX: hx + F.pit.maxX,
          padLeft: hx - path.half + 1.2, padRight: hx + path.half - 1.2
        };
        updateFlightPanel(path, performance.now());
      }

      function updateFlightPanel(path, now) {
        const fl = path && path.flight;
        if (!fl) return;
        const t = (now - fl.startedAt) / 1000;
        fl.gates.forEach(({ gate, lower, upper }) => {
          const gp = window.BCMRingPanels.flightGapAt(gate, t);
          const x = fl.hx + gate.x;
          lower.scale.y = Math.max(0.05, gp.y0 + 0.5);
          lower.position.set(x, (gp.y0 - 0.5) / 2, 0.1);
          upper.scale.y = Math.max(0.05, fl.F.ceilingY + 0.6 - gp.y1);
          upper.position.set(x, (gp.y1 + fl.F.ceilingY + 0.6) / 2, 0.1);
        });
        fl.bubbles.forEach((b) => {
          if (b.taken && now >= b.respawnAt) b.taken = false;
          b.mesh.visible = !b.taken;
          b.mesh.position.y = b.y + Math.sin(now * 0.003 + b.x) * 0.1;
        });
      }

      function applyRingCellLook(world, nodeOverride, headingOverride) {
        const path = world.cellPath;
        if (!path || !(nodeOverride || path.current)) return;
        const node = nodeOverride || path.current;
        const heading = headingOverride || path.heading;
        buildCellPanel(world, path, node);
        // Theme by the cell's floor (brick / ice / lava); the cell's wallAsset picks the tile.
        const themeCount = (path.RING_CELL_THEMES || []).length;
        const theme = themeCount ? path.RING_CELL_THEMES[((Number(node.y) || 0) % themeCount + themeCount) % themeCount] : null;
        const tiles = path.ringTiles;
        if (theme && tiles && tiles.ready) {
          const pickTile = (list) => list[Math.abs(node.wallAsset || 0) % list.length];
          const setMap = (material, tex) => {
            if (!material || !tex || material.map === tex) return;
            material.map = tex;
            material.needsUpdate = true;
          };
          const wallTile = pickTile(theme.walls);
          setMap(path.wallMaterial, tiles.get(wallTile, "wall"));
          setMap(path.backMaterial, tiles.get(wallTile, "back"));
          setMap(path.floorMaterial, tiles.get(pickTile(theme.floor), "floor"));
          setMap(path.doorMaterial, tiles.get(path.RING_TILE_DOOR, "door"));
          // The doorway stands back from the cell light: let its own tile glow a little.
          if (path.doorMaterial && path.doorMaterial.emissiveMap !== path.doorMaterial.map) {
            path.doorMaterial.emissiveMap = path.doorMaterial.map;
            path.doorMaterial.emissive.setHex(0x8a8a8a);
            path.doorMaterial.emissiveIntensity = 0.55;
            path.doorMaterial.needsUpdate = true;
          }
          setMap(path.trimMaterial, tiles.get(path.RING_TILE_HAZARD, "trim"));
          if (path.doorMaterial) path.doorMaterial.color.setHex(0xffffff);
          if (path.trimMaterial) path.trimMaterial.color.setHex(0xffffff);
          if (path.roomLight) path.roomLight.color.setHex(theme.light);
          if (path.backMaterial && path.backMaterial.emissive) {
            path.backMaterial.emissive.setHex(theme.glow);
            path.backMaterial.emissiveIntensity = theme.glow ? 0.9 : 0;
          }
        } else {
          const tex = path.textures[Math.abs(node.wallAsset || 0) % path.textures.length];
          if (tex) {
            tex.rotation = (node.wallTurn || 0) * (Math.PI / 2);
            tex.center.set(0.5, 0.5);
            path.floorMaterial.map = tex;
            path.wallMaterial.map = tex;
            if (path.backMaterial) path.backMaterial.map = tex;
            path.floorMaterial.needsUpdate = true;
            path.wallMaterial.needsUpdate = true;
            if (path.backMaterial) path.backMaterial.needsUpdate = true;
          }
        }
        const astralPalette = {
          drift: { floor: 0xc9b6ff, wall: 0x8d78c9 },
          flux: { floor: 0xb59cff, wall: 0x7457b5 },
          dense: { floor: 0x9ce9ff, wall: 0x438fa9 }
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
            if (mob.thread && other !== node) mob.thread.visible = false;
            if (other !== node) hideMobHazards(mob);
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
          // Teleport, not a step: pose without advancing the walk.
          updatePlayerSprite(mate, 0);
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
        // The full cutout stays here; crew-core draws the body without shins and two shins.
        player.crewTexture = texture;
        player.legs = window.BCMCrewCore && window.BCMCrewCore.createCrewLegs
          ? window.BCMCrewCore.createCrewLegs(THREE, scene, 9) : null;
        const flameGeometry = new THREE.ConeGeometry(0.15, 0.55, 8);
        const flameMaterial = new THREE.MeshBasicMaterial({
          color: 0x73eaff, transparent: true, opacity: 0.92, depthWrite: false
        });
        const flame = new THREE.Mesh(flameGeometry, flameMaterial);
        flame.name = "ring-jetpack-flame-" + (player.index + 1);
        flame.rotation.z = Math.PI;
        flame.renderOrder = 9;
        flame.visible = false;
        worldState.group.add(flame);
        worldState.specialGeometry.push(flameGeometry);
        worldState.materials.push(flameMaterial);
        player.jetFlame = flame;
        // crew-core.js cuts and assembles the Crew; Ring shows the placeholder
        // until it is ready. Tower does not have to be loaded (BUG-002).
        if (imageUrl && window.BCMCrewCore?.requestCrewTexture) {
          const pending = window.BCMCrewCore.requestCrewTexture(THREE, imageUrl);
          if (pending) pending.bcmCrewReady.then((cut) => {
            if (!cut || !player.spriteMaterial || player.crewTexture === cut) return;
            player.crewTexture = cut;
            player.spriteMaterial.map = cut;
            player.spriteMaterial.needsUpdate = true;
          }).catch(() => {});
        }
      }

      function playerWorldPosition(player) {
        return { x: player.worldX, y: player.worldY + 0.98, z: 0.45 };
      }
      function updatePlayerSprite(player, dt) {
        if (!player.sprite) return;
        const deltaX = player.worldX - (player._prevX ?? player.worldX);
        const moved = Math.abs(deltaX) > 0.01;
        const speed = dt > 0 ? Math.abs(deltaX) / dt : 0;
        player._prevX = player.worldX;
        player.climbRemaining = Math.max(0, (Number(player.climbRemaining) || 0) - dt);
        if (window.BCMCrewCore && window.BCMCrewCore.applyCrewFigure) {
          // Owner 24.11.2026: the Ring draws the Crew as Tower does — body and stepping shins,
          // assembled by crew-core (one place for rig and animation).
          window.BCMCrewCore.applyCrewFigure(THREE, player.sprite, player.legs, {
            facing: player.facing,
            hanging: !!player.hang,
            climbing: player.climbRemaining > 0,
            moving: moved && player.grounded && !player.hang,
            speed,
            grounded: player.grounded,
            vy: player.vy,
            crew: crewSelection[player.index],
            index: player.index
          }, dt, {
            texture: player.crewTexture,
            height: 1.78,
            maxWidth: 1.3,
            feetY: player.worldY,
            place: (along, y) => ({ x: player.worldX + along, y, z: 0.45 })
          });
        } else {
          const p = playerWorldPosition(player);
          player.sprite.position.set(p.x, p.y, p.z);
          player.sprite.scale.x = player.facing < 0 ? -1.45 : 1.45;
        }
        player.sprite.visible = true;
        if (player.legs) player.legs.forEach((shin) => { if (!player.sprite.visible) shin.visible = false; });
        if (player.jetFlame) {
          const flameOn = Number(player.jetFlameRemaining) > 0;
          player.jetFlameRemaining = Math.max(0, (Number(player.jetFlameRemaining) || 0) - dt);
          player.jetFlamePhase = (Number(player.jetFlamePhase) || 0) + dt * 24;
          player.jetFlame.visible = flameOn;
          player.jetFlame.position.set(player.worldX, player.worldY - 0.34, 0.56);
          const pulse = 0.82 + Math.sin(player.jetFlamePhase + player.index) * 0.18;
          player.jetFlame.scale.setScalar(flameOn ? pulse : 0.001);
        }
      }

      function createPlayer(index, spawn) {
        const crew = crewSelection[index] || {};
        const player = {
          index,
          name: String(crew.name || crew.displayName || ("Crew " + (index + 1))),
          worldX: Number(spawn.x) || 0, worldY: Number(spawn.y) || 0,
          x: Number(spawn.x) || 0, y: Number(spawn.y) || 0, z: 0,
          localX: 0, jumpHeight: 0, vy: 0, grounded: true, supportPlatform: null,
          facing: 1, lastActionAt: 0,
          actionReadyAt: 0, dashReadyAt: 0, dashUntil: 0,
          weaponType: weaponProgress.type || "pointer",
          weaponTier: Math.max(1, Number(weaponProgress.tier) || 1),
          weaponReadyAt: 0,
          hp: 5, maxHp: 5, invulnerableUntil: 0,
          jetFuel: 100, breathReserve: 100, jetFlameRemaining: 0, jetFlamePhase: 0,
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
        const controls = crewControls[player.index];
        return controls ? controls.intent() : {
          moveX: 0, moveY: 0, jump: false, jumpEdge: false,
          fire: false, dash: false, activate: false, floor: false
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
          const astralNode = p1.ringCurrent || worldState.cellPath?.current;
          const anomalyLabel = astralNode?.astral
            ? ({ drift: "ФИОЛЕТОВОЕ · НИЗКАЯ G", flux: "ФИОЛЕТОВОЕ · НИЗКАЯ G", dense: "СИНЕЕ · ВЫСОКАЯ G" }[astralNode.astralMode] || "ASTRAL")
            : "";
          const flightLabel = p1.bossFlight || astralNode && (astralNode.astralMode === "drift" || astralNode.astralMode === "flux")
            ? " · JET " + Math.ceil(p1.jetFuel) + " · O₂ " + Math.ceil(p1.breathReserve)
            : "";
          floorEl.textContent = "ЗОНА " + zone + "/3 · P1 HP " + p1.hp +
            (p2 ? " · P2 HP " + p2.hp : "") + (splitActive ? " · SPLIT" : " · SHARED") +
            (anomalyLabel ? " · " + anomalyLabel : "") + flightLabel;
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

      function finishBossArena(boss) {
        boss.alive = false;
        boss.vulnerable = false;
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
      }

      function damageBoss(boss, damage, now, cooldown, fromX) {
        if (!boss || !boss.alive || !boss.activated) return false;
        // A form with moves decides by itself (the Brawler takes shots in the back).
        const openToShot = boss.moves && boss.phaseState === "moves"
          ? boss.moves.canBeHit(Number.isFinite(fromX) ? fromX : boss.x)
          : boss.vulnerable;
        if (boss.phaseIndex > 0 && !openToShot) {
          updateHud(boss.moves && boss.moves.form === "brawler"
            ? (boss.shieldMesh && boss.shieldMesh.visible ? "ЩИТ · БОЕЦ ПЬЁТ И ЧИНИТСЯ — ЖДИ ХОХОТА" : "БРОНЯ СПЕРЕДИ · ЗАЙДИ СО СПИНЫ ИЛИ ЖДИ ПРОМАХА")
            : "ЯДРО ЗАКРЫТО · ДОЖДИСЬ ОКНА УЯЗВИМОСТИ");
          return true;
        }
        if (now < boss.nextDamageAt) return false;
        boss.nextDamageAt = now + cooldown;
        boss.hp = Math.max(0, boss.hp - damage);
        boss.lastDamageAt = now;
        if (boss.hp > 0) {
          if (boss.phaseIndex > 0) {
            playRingBossAnimation(boss, boss.phaseIndex - 1, "hit", true);
            boss.hitClipUntil = now + 380;
          }
          updateHud("ПОПАДАНИЕ · " + boss.name + " · " + boss.hp + "/" + boss.maxHp);
          return true;
        }
        if (boss.hasPhases && boss.phaseIndex < 6) {
          const previousPhaseIndex = boss.phaseIndex;
          boss.phaseIndex += 1;
          const spec = boss.phaseSpecs[boss.phaseIndex - 1];
          boss.name = spec.name;
          boss.maxHp = spec.hp;
          boss.hp = spec.hp;
          boss.pigGroup.visible = previousPhaseIndex === 0;
          boss.pigGroup.scale.setScalar(1);
          boss.core.visible = false;
          boss.transitionFromIndex = previousPhaseIndex;
          boss.phaseGroups.forEach((group, index) => {
            group.visible = index === boss.phaseIndex - 1 || (previousPhaseIndex > 0 && index === previousPhaseIndex - 1);
            if (group.visible) setRingBossGroupOpacity(group, index === boss.phaseIndex - 1 ? 0 : 1);
          });
          if (boss.ring) boss.ring.visible = false;
          if (previousPhaseIndex > 0) playRingBossAnimation(boss, previousPhaseIndex - 1, "transform_out", true);
          playRingBossAnimation(boss, boss.phaseIndex - 1, "transform_in", true);
          boss.moves = null;
          drawBossZones(boss, null);
          if (boss.shieldMesh) boss.shieldMesh.visible = false;
          if (boss.volley) drawBrawlerVolley(boss, null, now);
          hideBrawlerFilm(boss);
          if (boss.phaseIndex === 4) preloadBrawlerFilms(boss);
          endRunnerChase(boss);
          boss.phaseState = "transition";
          boss.phaseStartedAt = now;
          boss.phaseUntil = now + 2400;
          beginRingBossTransitionVfx(boss);
          if (beginRingBossTransformVideo(boss, boss.phaseIndex)) boss.phaseUntil = now + RING_BOSS_VIDEO_MS;
          // BUG-028: the clip starts on the old form and ends where the new form begins its move.
          if (boss.homeX === undefined) boss.homeX = boss.x;
          const oldForm = previousPhaseIndex > 0 ? boss.phaseGroups[previousPhaseIndex - 1] : null;
          boss.transitionFromFrame = oldForm
            ? ringBossFormFrame(boss, previousPhaseIndex, oldForm.position.y - (oldForm.userData.bcmGroundY || 1.6), oldForm.position.x)
            : null;
          const reveal = ringBossRevealPose(boss, boss.phaseIndex);
          boss.transitionStartX = boss.x;
          boss.revealX = reveal.x;
          boss.revealY = reveal.y;
          placeRingBossTransformVideo(boss, 0);
          boss.vulnerable = false;
          boss.tellMesh.visible = false;
          updateHud("ФОРМА · " + boss.name + " · ПРИГОТОВЬСЯ");
          return true;
        }
        finishBossArena(boss);
        return true;
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
            // The beam runs at chest height: a flying angel or a hanging spider is out of line.
            const box = mob.out && mob.out.box;
            if (box && (start.y < box.y0 - 0.45 || start.y > box.y1 + 0.45)) return;
            // Tough kinds take more than one hit; each hit flashes the mob.
            // The spiky pig takes a shot from behind on its spikes: the mob is told where it came from.
            if (mob.ai && !mob.ai.hit(player.worldX - worldState.cellPath.homeX)) return;
            mob.alive = false;
            mob.mesh.visible = false;
            if (mob.thread) mob.thread.visible = false;
            mob.respawnAt = now + worldState.cellPath.respawnMs;
            hideMobHazards(mob);
          });
        }
        for (const boss of worldState.bosses) {
          if (!boss.alive) continue;
          const forwardDistance = (boss.x - player.worldX) * player.facing;
          if (forwardDistance <= 0 || forwardDistance > profile.range) continue;
          if (Math.abs(player.worldY - boss.y) > 4.4) continue;
          if (forwardDistance < nearest) { target = boss; nearest = forwardDistance; }
        }
        if (target) end.set(target.x, target.y + (target.phaseIndex > 0 ? 2.1 : 2.78), 0.94);
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
        if (target && target.activated) {
          damageBoss(target, profile.damage, now, Math.max(110, profile.cooldown * 0.7), player.worldX);
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
        return damageBoss(boss, 1, now, 620, player.worldX);
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
        const indices = mode === "multi" ? [0, 1] : [0];
        let handled = false;
        indices.forEach((index) => {
          const controls = crewControls[index];
          if (controls && controls.key(event.code, down, event.repeat)) handled = true;
        });
        if (!handled) return;
        event.preventDefault();
        event.stopImmediatePropagation();
      }

      function pollGamepads() {
        if (done) return;
        if (!navigator.getGamepads) {
          crewControls.forEach((controls) => controls?.gamepad(null));
          return;
        }
        if (!gameStarted) {
          pollModeMenuGamepad();
          return;
        }
        const connected = [...navigator.getGamepads()].filter((pad) => pad && pad.connected);
        const assignment = mode === "multi"
          ? (connected.length > 1 ? [connected[0], connected[1]] : [null, connected[0] || null])
          : [connected[0] || null, null];
        for (let i = 0; i < 2; i += 1) {
          if (crewControls[i]) crewControls[i].gamepad(players[i] ? assignment[i] : null);
        }
      }

      function damagePlayer(player, now) {
        if (now < player.invulnerableUntil) return;
        player.hp -= 1;
        player.invulnerableUntil = now + 1000;
        if (player.hp <= 0) {
          player.hp = player.maxHp;
          player.worldX = player.checkpointX;
          // In a flight panel the cell's checkpoint is over the abyss: back on a pad instead.
          const fl = player.flightPanel && worldState.cellPath && worldState.cellPath.flight;
          if (fl) {
            const pad = Number.isFinite(player.flightPadX) ? player.flightPadX : fl.padLeft;
            player.worldX = pad < fl.hx ? Math.min(pad, fl.pitMinX - 0.5) : Math.max(pad, fl.pitMaxX + 0.5);
            player.jetFuel = 100; player.breathReserve = 100;
          }
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

      // Puddles are low green ovals that fade as they dry; a shell is a hot orange ball.
      const mobHazardLook = {};
      function mobHazardMesh(kind, parent) {
        if (!mobHazardLook[kind]) {
          mobHazardLook[kind] = kind === "puddle"
            ? { geometry: new THREE.CircleGeometry(0.5, 20), material: new THREE.MeshBasicMaterial({ color: 0x8dff3a, transparent: true, opacity: 0.8, depthWrite: false }) }
            : { geometry: new THREE.SphereGeometry(0.22, 12, 10), material: new THREE.MeshBasicMaterial({ color: 0xffa040 }) };
          worldState.specialGeometry.push(mobHazardLook[kind].geometry);
          worldState.materials.push(mobHazardLook[kind].material);
        }
        const look = mobHazardLook[kind];
        const mesh = new THREE.Mesh(look.geometry, kind === "puddle" ? look.material.clone() : look.material);
        // The camera looks from the side: a puddle flat on the floor would be a line. It is a low
        // oval facing the camera, ankle high, as wide as its zone.
        if (kind === "puddle") { mesh.scale.set(1, 0.3, 1); worldState.materials.push(mesh.material); }
        mesh.name = kind === "puddle" ? "ring-mob-puddle" : "ring-mob-shell";
        mesh.renderOrder = 5;
        parent.add(mesh);
        return mesh;
      }
      function drawMobHazards(mob, out, path, now) {
        const list = (out && out.hazards) || [];
        mob.hazardMeshes = mob.hazardMeshes || [];
        list.forEach((z, i) => {
          let mesh = mob.hazardMeshes[i];
          if (!mesh || mesh.name !== (z.kind === "puddle" ? "ring-mob-puddle" : "ring-mob-shell")) {
            if (mesh) mesh.parent?.remove(mesh);
            mesh = mob.hazardMeshes[i] = mobHazardMesh(z.kind, mob.mesh.parent || worldState.group);
          }
          const cx = path.homeX + (z.x0 + z.x1) / 2;
          if (z.kind === "puddle") {
            mesh.position.set(cx, 0.12, 0.7);
            mesh.material.opacity = 0.8 * Math.min(1, (3.2 - (z.age || 0)) / 0.8);
          } else {
            mesh.position.set(cx, (z.y0 + z.y1) / 2, 0.62);
            mesh.rotation.z -= 0.2 * (z.dir || 1);
          }
          mesh.visible = true;
        });
        for (let i = list.length; i < mob.hazardMeshes.length; i += 1) mob.hazardMeshes[i].visible = false;
        if (out && out.glance > 0.28 && !mob.glancePopped) {
          mob.glancePopped = true;
          comicPop(window.BCMDialogue?.language === "en" ? "CLANG!" : "ДЗЫНЬ!", path.homeX + out.offset, out.y + 1.4);
        } else if (out && !out.glance) mob.glancePopped = false;
      }
      function hideMobHazards(mob) {
        (mob.hazardMeshes || []).forEach((mesh) => { mesh.visible = false; });
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
          const here = players.filter((player) => player && (player.ringCurrent || path.current) === node);
          (node.mobs || []).forEach((mob) => {
            if (!mob.mesh) return;
            if (!mob.alive) {
              mob.mesh.visible = false;
              if (mob.thread) mob.thread.visible = false;
              hideMobHazards(mob);
              if (node.gate) return;
              if (now >= mob.respawnAt) { mob.alive = true; mob.ai = null; }
              else return;
            }
            if (!mob.ai) {
              const limit = node.gate ? 3.05 : 2.15;
              mob.ai = window.BCMRingMobs
                ? window.BCMRingMobs.create(mob.kind, { offset: mob.offset, dir: mob.dir, limit, chargeLimit: path.roomHalf - 2.5, astral: node.astral, phase: mob.phase })
                : null;
              if (!mob.ai) return;
            }
            const target = here.reduce((best, player) => !best || Math.abs(player.worldX - path.homeX - mob.offset) <
              Math.abs(best.worldX - path.homeX - mob.offset) ? player : best, null);
            const out = mob.ai.step(dt, target
              ? { near: true, targetOffset: target.worldX - path.homeX, targetY: target.worldY }
              : { near: false });
            mob.offset = out.offset;
            mob.out = out;
            // The art faces left: it turns to where it goes. A hit flashes it, it does not shake.
            mob.mesh.scale.set(out.width * (out.facing > 0 ? -1 : 1), out.height, 1);
            mob.mesh.position.set(path.homeX + out.offset, out.y + out.height / 2, 0.45);
            mob.mesh.material.color.setScalar(out.flash > 0 ? 3 : 1);
            mob.mesh.visible = true;
            if (mob.thread) {
              const top = path.cellHeight - 0.1, from = out.y + out.height * 0.8;
              mob.thread.visible = top - from > 0.1;
              mob.thread.scale.y = Math.max(0.01, top - from);
              mob.thread.position.set(path.homeX + out.offset, (top + from) / 2, 0.44);
            }
            // The mob's attacks (owner 25.11.2026 "Атаки мобов"): poison puddles and tank shells.
            drawMobHazards(mob, out, path, now);
            const touches = (z) => here.find((player) => player.worldX + 0.35 > path.homeX + z.x0 && player.worldX - 0.35 < path.homeX + z.x1 &&
              player.worldY + 1.7 > z.y0 && player.worldY < z.y1);
            (out.hazards || []).forEach((z) => { const victim = touches(z); if (victim) damagePlayer(victim, now); });
            if (!out.hurts) return;
            const hit = touches(out.box);
            if (hit) damagePlayer(hit, now);
          });
          if (node.gate && !(node.mobs || []).some((mob) => mob.alive)) node.gateCleared = true;
        });
      }

      // ---- Runner chase (owner 23.11.2026 "Погоня Гонщика") ----------------------
      // Rules live in ring-runner-chase.js. Here: a road group far below the arena in
      // the same scene, Opal Jetjet and the Runner seen from behind, and a perspective
      // camera that replaces the 2.5D views while the chase runs (one WebGL context).
      const RUNNER_CHASE_Y = -2000;
      const CHASE_HELP_RU = "← → ПОЛОСА · ПРЫЖОК — ПЕРЕСКОК · ЛАЗЕР — ОГОНЬ В ОКНО · РЫВОК — ДОГНАТЬ";
      const CHASE_HELP_EN = "← → LANE · JUMP — HOP · LASER — FIRE IN THE WINDOW · DASH — CATCH UP";
      const CHASE_JETJET = { flight: "mesh/ships/xsmall/jetjet/jetjet_teal_flight.glb", parked: "mesh/ships/xsmall/jetjet/jetjet_teal_parked.glb" };
      // The phase-forms GLB carries the Runner's back art on its rear cap; turned to the camera.
      const CHASE_RUNNER_REAR = "ring-bosses/mesh/phase-forms/phase-5-runner.glb";

      function startRunnerChase(boss, now) {
        endRunnerChase(boss);
        const rules = window.BCMRingRunnerChase.create({ seed: (Math.round((boss.homeX ?? boss.x) * 97) + 5 * 7919) >>> 0 });
        const geoms = [], mats = [];
        const mesh = (geometry, material, name) => {
          geoms.push(geometry); mats.push(material);
          const m = new THREE.Mesh(geometry, material);
          if (name) m.name = name;
          return m;
        };
        const basic = (color, extra) => new THREE.MeshBasicMaterial(Object.assign({ color }, extra || {}));
        const group = new THREE.Group();
        group.name = "ring-chase";
        group.position.set(0, RUNNER_CHASE_Y, 0);
        group.add(new THREE.HemisphereLight(0xd8ecff, 0x1c1430, 1.15));
        const sun = new THREE.DirectionalLight(0xffffff, 0.8);
        sun.position.set(3, 8, 6);
        group.add(sun);
        // Sky, road, rails.
        const sky = mesh(new THREE.PlaneGeometry(420, 160), basic(0x0c0822), "ring-chase-sky");
        sky.position.set(0, 30, -150);
        group.add(sky);
        const road = mesh(new THREE.PlaneGeometry(6.6, 150), basic(0x17132a), "ring-chase-road");
        road.rotation.x = -Math.PI / 2;
        road.position.set(0, 0, -62);
        group.add(road);
        [-3.4, 3.4].forEach((x) => {
          const rail = mesh(new THREE.BoxGeometry(0.14, 0.16, 150), basic(0x5fe6ff), "ring-chase-rail");
          rail.position.set(x, 0.08, -62);
          group.add(rail);
        });
        const dashes = [];
        [-0.9, 0.9].forEach((x) => {
          for (let i = 0; i < 18; i += 1) {
            const dash = mesh(new THREE.BoxGeometry(0.09, 0.02, 2.4), basic(0x8f86c9));
            dash.position.set(x, 0.02, -i * 7.5);
            dash.userData.baseZ = -i * 7.5;
            group.add(dash);
            dashes.push(dash);
          }
        });
        // Speed streaks on both sides and above.
        const streaks = [];
        let streakSeed = 7;
        const rnd = () => { streakSeed = (streakSeed * 16807) % 2147483647; return streakSeed / 2147483647; };
        for (let i = 0; i < 40; i += 1) {
          const streak = mesh(new THREE.BoxGeometry(0.05, 0.05, 3.2), basic(0xb7f3ff, { transparent: true, opacity: 0.55 }));
          const side = rnd() < 0.5 ? -1 : 1;
          streak.position.set(side * (4.2 + rnd() * 6), 0.4 + rnd() * 6, -rnd() * 120);
          group.add(streak);
          streaks.push(streak);
        }
        // The lane the Runner marks for a mine.
        const tellStrip = mesh(new THREE.PlaneGeometry(1.6, 30), basic(0xffcc6a, { transparent: true, opacity: 0.4, depthWrite: false }), "ring-chase-tell");
        tellStrip.rotation.x = -Math.PI / 2;
        tellStrip.visible = false;
        group.add(tellStrip);
        // Opal Jetjet: a box until the GLB comes; parked while boarding, then flight.
        const jetjet = new THREE.Group();
        jetjet.name = "ring-chase-jetjet";
        const jetProxy = mesh(new THREE.BoxGeometry(1.1, 0.5, 3.0), new THREE.MeshStandardMaterial({ color: 0x3fc6c0, roughness: 0.5 }));
        jetProxy.position.y = 0.45;
        jetjet.add(jetProxy);
        group.add(jetjet);
        // The Runner from behind.
        const runner = new THREE.Group();
        runner.name = "ring-chase-runner";
        const runnerProxy = mesh(new THREE.BoxGeometry(1.8, 1.6, 1.4), new THREE.MeshStandardMaterial({ color: 0xff6a3a, roughness: 0.6 }));
        runnerProxy.position.y = 0.8;
        runner.add(runnerProxy);
        const windowRing = mesh(new THREE.TorusGeometry(1.25, 0.08, 8, 32), basic(0x69ffe0, { transparent: true, opacity: 0.9 }), "ring-chase-window");
        windowRing.position.y = 1.2;
        windowRing.visible = false;
        runner.add(windowRing);
        group.add(runner);
        const laser = mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 6, 1, true), basic(0xff4ad8, { transparent: true, opacity: 0.95, depthWrite: false }), "ring-chase-laser");
        laser.rotation.x = Math.PI / 2;
        laser.visible = false;
        group.add(laser);
        worldState.group.add(group);
        const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 260);
        const chase = {
          boss, rules, group, geoms, mats, camera, jetjet, jetProxy, runner, runnerProxy, windowRing, tellStrip, laser,
          dashes, streaks, obstacleMeshes: new Map(), out: null, lastCue: "", laserLife: 0,
          shotReadyAt: [0, 0], hitCount: 0, shotCount: 0, landedCount: 0, boardedAt: now,
          models: { flight: false, parked: false, runner: false }, parts: {}
        };
        worldState.chase = chase;
        boss.phaseState = "chase";
        boss.vulnerable = false;
        // Models, fitted to the road: Jetjet nose (+X in the file) points away from the camera.
        const fit = (object, length, axis) => {
          const box = new THREE.Box3().setFromObject(object);
          const size = box.getSize(new THREE.Vector3());
          const scale = length / Math.max(0.001, size[axis]);
          object.scale.setScalar(scale);
          const box2 = new THREE.Box3().setFromObject(object);
          const center = box2.getCenter(new THREE.Vector3());
          object.position.x -= center.x; object.position.z -= center.z; object.position.y -= box2.min.y;
          return object;
        };
        const place = (key, path, parent, proxy, build) => loadRingBossGltf(path).then((gltf) => {
          if (worldState.chase !== chase) return;
          const holder = new THREE.Group();
          const model = gltf.scene.clone(true);
          // The Jetjet GLBs carry vertex colours and no normals: lit materials draw them
          // black, so such meshes get an unlit vertex-colour material.
          model.traverse((node) => {
            if (!node.isMesh || !node.geometry || node.geometry.getAttribute("normal")) return;
            const material = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: !!node.geometry.getAttribute("color") });
            mats.push(material);
            node.material = material;
          });
          holder.add(build(model));
          holder.name = "ring-chase-model-" + key;
          parent.add(holder);
          chase.parts[key] = holder;
          chase.models[key] = true;
          if (proxy) proxy.visible = false;
          holder.visible = key !== "flight" || !chase.parts.parked || (chase.out && chase.out.phase === "chase");
          if (key === "parked") holder.visible = !chase.out || chase.out.phase === "board";
        }).catch(() => {});
        place("flight", CHASE_JETJET.flight, jetjet, jetProxy, (model) => { model.rotation.y = Math.PI / 2; return fit(model, 3.2, "z"); });
        place("parked", CHASE_JETJET.parked, jetjet, jetProxy, (model) => { model.rotation.y = Math.PI / 2; return fit(model, 3.2, "z"); });
        place("runner", CHASE_RUNNER_REAR, runner, runnerProxy, (model) => {
          model.rotation.y = Math.PI;
          model.traverse((node) => {
            if (!node.isMesh || !node.material || !node.material.map || !("emissiveMap" in node.material)) return;
            const material = node.material.clone();
            material.emissive = new THREE.Color(0xffffff); material.emissiveMap = material.map; material.emissiveIntensity = 0.85;
            // Same upright fix as the arena forms (v grows upwards in these GLBs).
            if (!material.map.bcmUprightArt) {
              material.map.bcmUprightArt = true; material.map.repeat.set(1, -1); material.map.offset.set(0, 1);
            }
            mats.push(material); node.material = material;
          });
          return fit(model, 2.4, "y");
        });
        updateHud(window.BCMDialogue?.language === "en" ? "BOARDING · OPAL JETJET · " + CHASE_HELP_EN : "ПОСАДКА · OPAL JETJET · " + CHASE_HELP_RU);
      }

      function endRunnerChase(boss) {
        const chase = worldState.chase;
        if (!chase || (boss && chase.boss !== boss)) return;
        chase.group.parent?.remove(chase.group);
        chase.geoms.forEach((geometry) => geometry.dispose());
        chase.mats.forEach((material) => material.dispose());
        chase.obstacleMeshes.forEach((item) => { item.geometry.dispose(); item.material.dispose(); });
        worldState.chase = null;
      }

      function updateRunnerChase(dt, now) {
        const chase = worldState.chase;
        const boss = chase.boss;
        if (!boss.alive) { endRunnerChase(boss); return; }
        // Single: P1 does everything. Co-op: P1 steers and hops, P2 fires and boosts.
        const p1 = getInput(players[0] || { index: 0 });
        const p2 = players[1] ? getInput(players[1]) : null;
        const gunner = p2 || p1;
        const steer = Math.abs(p1.moveX) > 0.5 ? Math.sign(p1.moveX) : 0;
        const out = chase.rules.step(dt, { steer, jumpEdge: p1.jumpEdge, boost: !!gunner.dash });
        chase.out = out;
        boss.vulnerable = out.boss.vulnerable;
        // Hits: the Jetjet carries the whole crew.
        if (out.hits.length) {
          chase.hitCount += out.hits.length;
          players.forEach((player) => { if (player.hp > 0) damagePlayer(player, now); });
        }
        // Laser: only in the window and within range lands.
        const shooter = p2 ? 1 : 0;
        if (gunner.fire && out.phase === "chase" && now >= chase.shotReadyAt[shooter]) {
          chase.shotReadyAt[shooter] = now + 260;
          chase.shotCount += 1;
          chase.laserLife = 0.1;
          const english = window.BCMDialogue?.language === "en";
          if (chase.rules.canBeHit()) {
            chase.landedCount += 1;
            damageBoss(boss, 1, now, 0);
          } else if (out.boss.vulnerable) {
            updateHud(english ? "TOO FAR · DASH TO CATCH UP" : "ДАЛЕКО · РЫВОК — ДОГНАТЬ");
          } else {
            updateHud(english ? "ARMOUR · WAIT FOR A SKID OR OVERHEAT" : "БРОНЯ · ЖДИ ЗАНОСА ИЛИ ПЕРЕГРЕВА");
          }
          if (!worldState.chase) return; // the shot ended the form
        }
        if (out.cue !== chase.lastCue) {
          chase.lastCue = out.cue;
          const english = window.BCMDialogue?.language === "en";
          updateHud(english
            ? (out.phase === "board" ? "BOARDING · OPAL JETJET" : out.boss.state.toUpperCase()) + " · " + CHASE_HELP_EN
            : out.cue + " · " + CHASE_HELP_RU);
        }
        drawRunnerChase(chase, out, dt);
      }

      function drawRunnerChase(chase, out, dt) {
        const scroll = out.distance;
        chase.dashes.forEach((dash) => { dash.position.z = ((dash.userData.baseZ + scroll) % 135 + 135) % 135 - 127; });
        chase.streaks.forEach((streak) => {
          streak.position.z += out.speed * 1.8 * dt;
          if (streak.position.z > 8) streak.position.z -= 128;
          streak.visible = out.speed > 0;
        });
        chase.jetjet.position.set(out.player.x, out.player.y, 0);
        const blink = out.player.safe && Math.floor(performance.now() / 90) % 2 === 0;
        chase.jetjet.visible = !blink;
        if (chase.parts.parked) chase.parts.parked.visible = out.phase === "board";
        if (chase.parts.flight) chase.parts.flight.visible = out.phase !== "board" || !chase.parts.parked;
        chase.runner.position.set(out.boss.x, 0, -out.gap);
        chase.runner.rotation.z = out.boss.state === "skid" ? Math.sin(performance.now() * 0.02) * 0.25 : 0;
        chase.windowRing.visible = out.boss.vulnerable;
        chase.windowRing.rotation.z += dt * 2;
        const tell = out.boss.tell && out.boss.tell.kind === "lane";
        chase.tellStrip.visible = !!tell;
        if (tell) {
          chase.tellStrip.position.set((out.boss.tell.lane - 1) * 1.8, 0.03, -out.gap / 2 - 2);
          chase.tellStrip.scale.y = Math.max(0.2, out.gap / 30);
          chase.tellStrip.material.opacity = 0.25 + Math.abs(Math.sin(performance.now() * 0.012)) * 0.35;
        }
        // Obstacles: low wall, gate, mine.
        const seen = new Set();
        out.obstacles.forEach((ob) => {
          seen.add(ob.id);
          let item = chase.obstacleMeshes.get(ob.id);
          if (!item) {
            const geometry = ob.kind === "gate" ? new THREE.BoxGeometry(1.6, 2.4, 0.4)
              : ob.kind === "mine" ? new THREE.SphereGeometry(0.42, 12, 10) : new THREE.BoxGeometry(1.5, 0.6, 0.5);
            const material = new THREE.MeshBasicMaterial({ color: ob.kind === "gate" ? 0xff4a4a : ob.kind === "mine" ? 0xff3fd2 : 0xffa53c });
            item = new THREE.Mesh(geometry, material);
            item.name = "ring-chase-" + ob.kind;
            chase.group.add(item);
            chase.obstacleMeshes.set(ob.id, item);
          }
          item.position.set(ob.x, ob.kind === "gate" ? 1.2 : ob.kind === "mine" ? 0.45 : 0.3, -ob.z);
        });
        chase.obstacleMeshes.forEach((item, id) => {
          if (seen.has(id)) return;
          chase.group.remove(item);
          item.geometry.dispose(); item.material.dispose();
          chase.obstacleMeshes.delete(id);
        });
        // Laser from the Jetjet nose to the Runner.
        chase.laserLife = Math.max(0, chase.laserLife - dt);
        chase.laser.visible = chase.laserLife > 0;
        if (chase.laser.visible) {
          const length = Math.max(1, out.gap - 1.6);
          chase.laser.scale.set(1, length, 1);
          chase.laser.position.set((out.player.x + out.boss.x) / 2, 0.7 + out.player.y, -1.6 - length / 2);
        }
        // Camera behind and above the Jetjet; boarding starts from the side and swings behind.
        const board = out.phase === "board" ? Math.max(0, 1 - (performance.now() - chase.boardedAt) / 1200) : 0;
        const camX = out.player.x * 0.55 + board * 6;
        chase.camera.position.set(camX, RUNNER_CHASE_Y + 2.5 + out.player.y * 0.4, 6.4 - board * 4);
        chase.camera.lookAt(out.player.x * 0.3, RUNNER_CHASE_Y + 1.0, -14);
      }

      // Tells (yellow) and hazards (red) of a boss form, drawn as flat zones in
      // front of the arena. Pooled per boss; unused zones are hidden.
      function drawBossZones(boss, out) {
        if (!boss.zoneMeshes) boss.zoneMeshes = [];
        const zones = [];
        if (out && out.tell) zones.push({ zone: out.tell, tell: true });
        (out ? out.hazards : []).forEach((zone) => { if (zone.kind !== "plasma") zones.push({ zone, tell: false }); });
        while (boss.zoneMeshes.length < zones.length) {
          const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(1, 1),
            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false })
          );
          mesh.renderOrder = 6;
          worldState.group.add(mesh);
          boss.zoneMeshes.push(mesh);
        }
        const pulse = 0.55 + Math.sin(performance.now() * 0.018) * 0.25;
        boss.zoneMeshes.forEach((mesh, index) => {
          const item = zones[index];
          mesh.visible = !!item;
          if (!item) return;
          const z = item.zone;
          const body = z.kind === "roll" || z.kind === "chassis" || z.kind === "landing";
          mesh.name = item.tell ? "ring-boss-tell-" + z.kind : "ring-boss-hazard-" + z.kind;
          mesh.position.set((z.x0 + z.x1) / 2, (z.y0 + z.y1) / 2 + (item.tell ? 0.02 : 0), item.tell ? 0.86 : 0.92);
          mesh.scale.set(Math.max(0.05, z.x1 - z.x0), Math.max(0.05, z.y1 - z.y0), 1);
          const spark = z.kind === "spark";
          const beam = z.kind === "beam" && !item.tell;
          mesh.material.color.setHex(item.tell ? 0xffcc6a : beam ? 0x9ffcff : spark ? 0xe6fbff : z.kind === "shard" || z.kind === "orb" ? 0x8fe8ff : 0xff4a4a);
          mesh.material.opacity = item.tell ? 0.22 + pulse * 0.3 : beam ? 0.8 : spark ? 0.55 + pulse * 0.4 : body ? 0.22 : 0.62;
          if (spark) mesh.rotation.z = performance.now() * 0.012; else mesh.rotation.z = 0;
        });
        // Air bubbles of the Orbiter flight: refill jet and breath.
        if (!boss.bubbleMeshes) boss.bubbleMeshes = [];
        const bubbles = out && out.bubbles ? out.bubbles : [];
        while (boss.bubbleMeshes.length < bubbles.length) {
          const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.3, 12, 10),
            new THREE.MeshBasicMaterial({ color: 0x9fe7ff, transparent: true, opacity: 0.55, depthWrite: false })
          );
          mesh.name = "ring-boss-bubble-" + boss.bubbleMeshes.length;
          mesh.renderOrder = 6;
          worldState.group.add(mesh);
          boss.bubbleMeshes.push(mesh);
        }
        boss.bubbleMeshes.forEach((mesh, index) => {
          const bubble = bubbles[index];
          mesh.visible = !!bubble;
          if (bubble) mesh.position.set(bubble.x, bubble.y, 0.9);
        });
        // Orbiter pit: a dark gap over the floor off the ledges (orange while it warns),
        // ledges as violet plates.
        if (!boss.pitMeshes) boss.pitMeshes = [];
        const slabs = [];
        const ledges = out && out.ledges ? out.ledges.slice().sort((a, b) => a.x0 - b.x0) : [];
        if (out && (out.pit || out.floorWarn) && ledges.length) {
          const span = out.pit || { x0: ledges[0].x0 - 0.9, x1: ledges[ledges.length - 1].x1 + 0.9 };
          let from = span.x0;
          ledges.forEach((ledge) => { if (ledge.x0 > from) slabs.push({ kind: "gap", x0: from, x1: ledge.x0 }); from = Math.max(from, ledge.x1); });
          if (span.x1 > from) slabs.push({ kind: "gap", x0: from, x1: span.x1 });
          ledges.forEach((ledge) => slabs.push({ kind: "ledge", x0: ledge.x0, x1: ledge.x1 }));
        }
        while (boss.pitMeshes.length < slabs.length) {
          const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(1, 1),
            new THREE.MeshBasicMaterial({ color: 0x05030c, transparent: true, opacity: 0.94, depthWrite: false })
          );
          mesh.renderOrder = 5;
          worldState.group.add(mesh);
          boss.pitMeshes.push(mesh);
        }
        boss.pitMeshes.forEach((mesh, index) => {
          const slab = slabs[index];
          mesh.visible = !!slab;
          if (!slab) return;
          const ledge = slab.kind === "ledge";
          const warn = !ledge && !out.pit;
          mesh.name = ledge ? "ring-boss-ledge-" + index : warn ? "ring-boss-pit-warn-" + index : "ring-boss-pit-" + index;
          mesh.position.set((slab.x0 + slab.x1) / 2, ledge ? -0.12 : -0.3, ledge ? 0.97 : 0.95);
          mesh.scale.set(slab.x1 - slab.x0, ledge ? 0.34 : 0.7, 1);
          mesh.material.color.setHex(ledge ? 0xb59cff : warn ? 0xff9a3c : 0x05030c);
          mesh.material.opacity = ledge ? 0.9 : warn ? 0.25 + pulse * 0.35 : 0.94;
        });
      }

      // Owner 24.11.2026 (BUG-028): "смех и выстрел заменены дешёвой потряской текстуры". The owner's
      // Brawler clips (a studio or a room behind it, so they cannot be keyed like the transform clips)
      // play in the arena itself, on the Brawler's spot and at its size, in a soft oval frame; the
      // model hides while its clip plays (owner's choice 25.11.2026: "рамка на месте Бойца").
      // Per clip, frame fractions with y from the top: feet = where the feet stand, stand = the height
      // a standing Brawler takes in this frame (the drink is sat down), oval = [cx, cy, rx, ry].
      const BRAWLER_FILMS = {
        cannon: { file: "brawler-attack-cannon.mp4", feet: 0.97, stand: 0.93, cx: 0.47, oval: [0.47, 0.5, 0.47, 0.53] },
        drink: { file: "brawler-drink.mp4", feet: 1.0, stand: 1.2, cx: 0.55, oval: [0.55, 0.56, 0.43, 0.5] },
        laugh: { file: "brawler-laugh.mp4", feet: 0.95, stand: 0.88, cx: 0.53, oval: [0.53, 0.5, 0.33, 0.53] }
      };
      // The cannon clip runs from the charge through the whole volley and holds its last frame.
      const BRAWLER_FILM_BY_STATE = { charge: "cannon", aim: "cannon", fire: "cannon", recover: "cannon", drink: "drink", taunt: "laugh" };
      const BRAWLER_FILM_ASPECT = 16 / 9;

      function brawlerFilmVideo(film, key) {
        if (film.videos[key]) return film.videos[key];
        const url = ringBossAssetUrl("ring-bosses/video/" + BRAWLER_FILMS[key].file);
        if (!url) return null;
        const video = document.createElement("video");
        video.muted = true;
        video.defaultMuted = true;
        video.setAttribute("muted", "");
        video.playsInline = true;
        video.setAttribute("playsinline", "");
        video.preload = "auto";
        video.loop = false;
        video.crossOrigin = "anonymous";
        video.src = url;
        const texture = new THREE.VideoTexture(video);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        if (THREE.sRGBEncoding !== undefined) texture.encoding = THREE.sRGBEncoding;
        const entry = { video, texture, ready: false, failed: false };
        // Once a clip has shown a frame it stays on screen while it seeks back to its start.
        video.addEventListener("loadeddata", () => { entry.ready = true; });
        video.addEventListener("error", () => { entry.failed = true; });
        film.videos[key] = entry;
        return entry;
      }

      function brawlerFilm(boss) {
        if (boss.brawlerFilm) return boss.brawlerFilm;
        const oval = { value: new THREE.Vector4(0.5, 0.5, 0.5, 0.5) };
        const material = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0 });
        // A soft oval: the Brawler is drawn whole, the room around it fades out.
        material.onBeforeCompile = (shader) => {
          shader.uniforms.bcmOval = oval;
          shader.fragmentShader = "uniform vec4 bcmOval;\n" + shader.fragmentShader.replace("#include <map_fragment>",
            "#include <map_fragment>\n  float bcmOvalR = length((vUv - bcmOval.xy) / bcmOval.zw);\n  diffuseColor.a *= 1.0 - smoothstep(0.7, 1.0, bcmOvalR);");
        };
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
        mesh.name = "ring-boss-brawler-film";
        mesh.renderOrder = 8;
        mesh.visible = false;
        boss.group.add(mesh);
        boss.brawlerFilm = { mesh, material, oval, videos: {}, key: "", video: null };
        return boss.brawlerFilm;
      }

      // Load the three clips while the form turns into the Brawler, so none starts on a black frame.
      function preloadBrawlerFilms(boss) {
        const film = brawlerFilm(boss);
        Object.keys(BRAWLER_FILMS).forEach((key) => { const v = brawlerFilmVideo(film, key); if (v) try { v.video.load(); } catch (e) {} });
      }

      function hideBrawlerFilm(boss) {
        const film = boss && boss.brawlerFilm;
        if (!film) return;
        Object.keys(film.videos).forEach((key) => { try { film.videos[key].video.pause(); } catch (e) {} });
        film.mesh.visible = false;
        film.key = "";
        film.video = null;
      }

      // Returns true while a clip stands in for the model.
      function playBrawlerFilm(boss, phaseGroup, out) {
        const key = out.form === "brawler" ? BRAWLER_FILM_BY_STATE[out.state] || "" : "";
        const film = key || boss.brawlerFilm ? brawlerFilm(boss) : null;
        if (!film) return false;
        if (!key) { if (film.key) hideBrawlerFilm(boss); return false; }
        const entry = brawlerFilmVideo(film, key);
        if (!entry) return false;
        if (film.key !== key) {
          Object.keys(film.videos).forEach((other) => { if (other !== key) try { film.videos[other].video.pause(); } catch (e) {} });
          film.key = key;
          film.video = entry.video;
          film.material.map = entry.texture;
          film.material.needsUpdate = true;
          try { entry.video.currentTime = 0; } catch (e) {}
          const played = entry.video.play();
          if (played && typeof played.catch === "function") played.catch(() => {});
        }
        // Until the clip has a frame the model stays: no black square in the arena. A clip that
        // fails to load leaves the model too.
        if (entry.failed || !(entry.ready || entry.video.readyState >= 2)) { film.mesh.visible = false; return false; }
        const clip = BRAWLER_FILMS[key];
        const half = (phaseGroup && phaseGroup.userData.bcmGroundY) || 3.08;
        const height = (half * 2) / clip.stand;
        const width = height * BRAWLER_FILM_ASPECT;
        // The cannon arm is on the left of the clip: it turns to the pilot.
        const mirror = (out.facing || -1) > 0 ? -1 : 1;
        film.mesh.scale.set(width * mirror, height, 1);
        film.mesh.position.set(-(clip.cx - 0.5) * width * mirror, (out.y || 0) + height * (clip.feet - 0.5), 1.3);
        film.oval.value.set(clip.oval[0], 1 - clip.oval[1], clip.oval[2], clip.oval[3]);
        film.material.opacity = 1;
        film.mesh.visible = true;
        return true;
      }

      // Owner 23.11.2026: the big Brawler fires its cannon itself in the arena — a glow grows at
      // its hand, a thin aim line runs along the pilot's tier, three plasma balls fly across
      // with a halo and a tail; the pilot jumps between the floor and the ledges.
      function drawBrawlerVolley(boss, out, now) {
        if (!boss.volley) {
          const glowMat = new THREE.MeshBasicMaterial({ color: 0x8ff8ff, transparent: true, opacity: 0.85, depthWrite: false });
          const haloMat = new THREE.MeshBasicMaterial({ color: 0x3fd8ff, transparent: true, opacity: 0.35, depthWrite: false });
          const lineMat = new THREE.MeshBasicMaterial({ color: 0xfff1a8, transparent: true, opacity: 0.9, depthWrite: false });
          const sphere = new THREE.SphereGeometry(1, 16, 12);
          const charge = new THREE.Mesh(sphere, glowMat);
          charge.name = "ring-boss-charge";
          charge.renderOrder = 9;
          const chargeHalo = new THREE.Mesh(sphere, haloMat);
          chargeHalo.renderOrder = 8;
          const aim = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), lineMat);
          aim.name = "ring-boss-aim";
          aim.renderOrder = 8;
          worldState.group.add(charge, chargeHalo, aim);
          boss.volley = { sphere, glowMat, haloMat, charge, chargeHalo, aim, balls: [] };
        }
        const v = boss.volley;
        const on = !!(out && out.form === "brawler");
        const level = on ? Number(out.charge) || 0 : 0;
        v.charge.visible = v.chargeHalo.visible = level > 0;
        if (level > 0 && out.muzzle) {
          const r = 0.18 + level * 0.62 + Math.sin(now * 0.04) * 0.05;
          v.charge.position.set(out.muzzle.x, out.muzzle.y, 1.7);
          v.charge.scale.setScalar(r);
          v.chargeHalo.position.copy(v.charge.position);
          v.chargeHalo.scale.setScalar(r * (1.6 + Math.sin(now * 0.02) * 0.2));
        }
        const tell = on && out.tell && out.tell.kind === "aim" ? out.tell : null;
        v.aim.visible = !!tell;
        if (tell) {
          v.aim.position.set((tell.x0 + tell.x1) / 2, (tell.y0 + tell.y1) / 2, 1.5);
          v.aim.scale.set(tell.x1 - tell.x0, 0.06, 1);
          v.aim.material.opacity = 0.45 + Math.abs(Math.sin(now * 0.02)) * 0.5;
        }
        const balls = on && out.balls ? out.balls : [];
        while (v.balls.length < balls.length) {
          const core = new THREE.Mesh(v.sphere, v.glowMat);
          core.name = "ring-boss-plasma";
          core.renderOrder = 9;
          const halo = new THREE.Mesh(v.sphere, v.haloMat);
          halo.renderOrder = 8;
          const tail = [0, 1, 2].map(() => { const t = new THREE.Mesh(v.sphere, v.haloMat); t.renderOrder = 7; return t; });
          worldState.group.add(core, halo, ...tail);
          v.balls.push({ core, halo, tail });
        }
        v.balls.forEach((mesh, index) => {
          const b = balls[index];
          const show = !!b;
          mesh.core.visible = mesh.halo.visible = show;
          mesh.tail.forEach((t) => { t.visible = show; });
          if (!b) return;
          const wob = Math.sin(now * 0.05 + index) * 0.04;
          mesh.core.position.set(b.x, b.y, 1.7);
          mesh.core.scale.setScalar(0.42 + wob);
          mesh.halo.position.set(b.x, b.y, 1.65);
          mesh.halo.scale.setScalar(0.75 + wob * 2);
          mesh.tail.forEach((t, k) => {
            t.position.set(b.x - b.dir * (0.55 + k * 0.5), b.y, 1.6);
            t.scale.setScalar(0.4 - k * 0.1);
          });
        });
      }

      // The Brawler's body without a rig: a step bob while it walks. Applied to its form group
      // around the base scale (2.2) and the ground height.
      function brawlerPose(boss, phaseGroup, out, now) {
        const base = RING_BOSS_FORM_SCALE[3] || 1;
        const groundY = phaseGroup.userData.bcmGroundY || 2.1;
        const rot = 0, sx = 1, sy = 1, dx = 0;
        let dy = 0;
        if (out.state === "back" || out.state === "advance") {
          dy = Math.abs(Math.sin(now * 0.012)) * 0.18;
        }
        // Charge, volley, drink and laugh are the owner's clips in the arena (playBrawlerFilm), not a
        // shaken model (BUG-028): the model stands still under them.
        phaseGroup.rotation.z = rot;
        phaseGroup.scale.set(base * sx, base * sy, base);
        phaseGroup.position.x = dx;
        phaseGroup.position.y = groundY * sy + (out.y || 0) + dy;
      }

      function runBossMoves(boss, phaseGroup, target, living, dt, now) {
        const out = boss.moves.step(dt, { targetX: target.worldX, targetY: target.worldY });
        boss.lastMoveOut = out;
        boss.x = out.x;
        boss.group.position.x = out.x;
        boss.vulnerable = out.vulnerable;
        boss.moveFacing = out.facing;
        if (phaseGroup) {
          phaseGroup.position.y = (phaseGroup.userData.bcmGroundY || 2.1) + out.y;
          if (out.attacking) phaseGroup.rotation.z = Math.sin(now * 0.03) * 0.14;
        }
        // Shield while the Brawler drinks (owner): a bubble around it; it mends 1 HP once.
        if (!boss.shieldMesh) {
          boss.shieldMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14),
            new THREE.MeshBasicMaterial({ color: 0x7fd8ff, transparent: true, opacity: 0.28, depthWrite: false }));
          boss.shieldMesh.name = "ring-boss-shield";
          boss.shieldMesh.renderOrder = 7;
          boss.group.add(boss.shieldMesh);
        }
        boss.shieldMesh.visible = !!out.shielded;
        if (out.shielded) {
          const groundY = (phaseGroup && phaseGroup.userData.bcmGroundY) || 2.0;
          const halfW = (phaseGroup && phaseGroup.userData.bcmHalfW) || 1.6;
          boss.shieldMesh.position.set(0, groundY + out.y, 1.0 + halfW * 0.2);
          boss.shieldMesh.scale.set(halfW * 1.25, groundY * 1.1, Math.max(1.2, halfW * 0.6));
          boss.shieldMesh.material.opacity = 0.22 + Math.abs(Math.sin(now * 0.006)) * 0.16;
          if (!boss.mendedThisDrink && boss.hp < boss.maxHp) { boss.hp += 1; boss.mendedThisDrink = true; }
        } else boss.mendedThisDrink = false;
        // The open core shows as the green ring over the form.
        boss.tellMesh.visible = out.vulnerable;
        if (out.vulnerable) {
          boss.tellMesh.material.color.setHex(0x69ffe0);
          boss.tellMesh.material.opacity = 0.9;
          boss.tellMesh.position.set(0, ((phaseGroup && phaseGroup.userData.bcmGroundY) || 2.2) + out.y, 1.18 + ((phaseGroup && phaseGroup.userData.bcmHalfW) || 0) * 0.2);
          boss.tellMesh.scale.set(1.65, 1.65, 1);
          boss.tellMesh.rotation.z += dt * 1.3;
        }
        drawBossZones(boss, out);
        drawBrawlerVolley(boss, out, now);
        if (out.form === "brawler" && phaseGroup) {
          phaseGroup.visible = !playBrawlerFilm(boss, phaseGroup, out);
          brawlerPose(boss, phaseGroup, out, now);
        }
        if (out.state !== boss.lastMoveState) {
          boss.lastMoveState = out.state;
          const english = window.BCMDialogue?.language === "en";
          if (out.cue) updateHud(english ? (out.form.toUpperCase() + " · " + out.state.toUpperCase()) : out.cue);
        }
        // Balloon flight: an airborne pilot drifts forward and takes the bubbles it flies through.
        if (out.flight) living.forEach((player) => {
          if (!player.bossFlight) return;
          if (!player.grounded) {
            player.worldX = Math.max(boss.homeX - 9.4, Math.min(boss.homeX + 9.4, player.worldX + player.facing * out.drift * dt));
          }
          if (boss.moves.collect(player.worldX, player.worldY + 0.9)) {
            player.jetFuel = Math.min(100, player.jetFuel + 34);
            player.breathReserve = Math.min(100, player.breathReserve + 34);
            updateHud(window.BCMDialogue?.language === "en" ? "BUBBLE · JET AND AIR REFILLED" : "ПУЗЫРЬ · ЗАПАС ПОЛЁТА И КИСЛОРОДА ВОССТАНОВЛЕН");
          }
        });
        // A hazard hurts a pilot whose body (0.7 m wide, 1.7 m tall) overlaps it.
        living.forEach((player) => {
          const hit = out.hazards.some((h) =>
            player.worldX + 0.35 > h.x0 && player.worldX - 0.35 < h.x1 &&
            player.worldY + 1.7 > h.y0 && player.worldY < h.y1);
          if (hit) damagePlayer(player, now);
        });
      }

      function updateBosses(dt, now) {
        const living = players.filter(Boolean);
        const phaseCues = [
          "", "КАТОК: РАЗГОН · ПРЫГНИ ИЛИ УЙДИ С ЛИНИИ", "ШАГОХОД: ТОПОТ · ПРЫГНИ ЧЕРЕЗ ВОЛНУ",
          "ОРБИТА: МАНЕВРИРУЙ ВВЕРХ/ВНИЗ · ЖДИ ОТКРЫТОЕ ЯДРО", "БОЕЦ: ЗАМAХ · УЙДИ С ЛИНИИ УДАРА",
          "ГОНЩИК: УСКОРЕНИЕ · УЙДИ С ТРАЕКТОРИИ", "ТЕНЬ: ОТМЕЧЕНА ЗОНА ПРИЗЕМЛЕНИЯ · УЙДИ"
        ];
        const phaseCuesEn = [
          "", "ROLLER: CHARGE · JUMP OR LEAVE THE LANE", "WALKER: STOMP · JUMP THE SHOCKWAVE",
          "ORBITER: STEER UP/DOWN · WAIT FOR THE OPEN CORE", "BRAWLER: WIND-UP · STEP OUT OF THE STRIKE",
          "RUNNER: BOOST · LEAVE THE CHASE LINE", "STALKER: LANDING ZONE MARKED · MOVE AWAY"
        ];
        worldState.bosses.forEach((boss) => {
          if (!boss.alive) return;
          (boss.phaseModels || []).forEach((record, index) => {
            if (record && boss.phaseGroups[index]?.visible) record.mixer.update(dt);
          });
          if (boss.hitClipUntil && now >= boss.hitClipUntil && boss.phaseState === "recovery") {
            playRingBossAnimation(boss, boss.phaseIndex - 1, "idle", false);
            boss.hitClipUntil = 0;
          }
          if (boss.ring) boss.ring.rotation.z += dt * (boss.phaseIndex === 3 ? 1.8 : 0.8);
          const target = living.reduce((best, player) =>
            !best || Math.abs(player.worldX - boss.x) < Math.abs(best.worldX - boss.x) ? player : best, null);
          // 20 m: the big Brawler fires from the far wall of its 18 m arena (arenas are 34+ m apart).
          if (!target || Math.abs(target.worldX - boss.x) > 20) return;
          if (!boss.activated) {
            boss.activated = true;
            boss.nextAttackAt = now + 900;
            boss.nextDamageAt = 0;
            updateHud("АРЕНА ОТКРЫТА · " + boss.name);
            if (!worldState.ringGoalHintShown) {
              worldState.ringGoalHintShown = true;
              const message = window.BCMDialogue?.language === "en"
                ? "We are close to the goal! The pigs are still ahead."
                : "Мы почти у цели! Осталось победить свиней!";
              window.BCMDialogue?.showOperator?.("", message, null, "panda.mp4", 4500);
            }
          }
          if (!boss.phaseIndex) {
            // Preserve the existing Pig's attack timing and ordinary first defeat.
            if (now < boss.nextAttackAt) return;
            boss.nextAttackAt = now + Math.max(1350, 2350 - boss.zone * 220);
            const direction = target.worldX < boss.x ? -1 : 1;
            const startX = boss.x + direction * 2.2;
            const mesh = new THREE.Mesh(worldState.shockwaveGeometry, worldState.shockwaveMaterial);
            mesh.position.set(startX, 0.95, 0.78);
            mesh.scale.setScalar(0.78);
            worldState.group.add(mesh);
            worldState.shockwaves.push({ mesh, x: startX, direction, age: 0, speed: 8.5 });
            return;
          }

          const phaseIndex = boss.phaseIndex;
          const cue = window.BCMDialogue?.language === "en" ? phaseCuesEn[phaseIndex] : phaseCues[phaseIndex];
          const phaseGroup = boss.phaseGroups[phaseIndex - 1];
          if (phaseGroup) {
            phaseGroup.rotation.z = boss.phaseState === "attack" ? Math.sin(now * 0.018) * 0.10 : Math.sin(now * 0.002) * 0.035;
            if (phaseIndex === 3) phaseGroup.rotation.y += dt * 1.1;
            const groundY = phaseGroup.userData.bcmGroundY || 2.1;
            if (phaseIndex === 6 && boss.phaseState === "attack") phaseGroup.position.y = groundY + Math.sin(now * 0.02) * 0.8;
            else phaseGroup.position.y = groundY;
          }
          if (boss.phaseState === "transition") {
            boss.vulnerable = false;
            const elapsed = Math.max(0, (now - (boss.phaseStartedAt || now)) / 1000);
            const film = boss.transformVideo;
            // A video that fails, or has not started after 3 s, gives way to the old transition.
            if (film && (film.failed || (!film.started && elapsed > 3) || elapsed > 12)) {
              boss.transformVideoDropped = film.failed ? "failed" : (film.started ? "stalled" : "slow");
              clearRingBossTransformVideo(boss);
              boss.phaseUntil = Math.min(boss.phaseUntil, now + 900);
            }
            const filmOn = !!boss.transformVideo;
            // BUG-028: the clip starts about a second late, and a fixed 5 s cut it at 3.3-3.7 s of
            // 5.04: the player never saw its last frame. The transition now lasts until the clip ends.
            let progress = Math.min(1, elapsed / Math.max(0.5, (boss.phaseUntil - (boss.phaseStartedAt || now)) / 1000));
            if (filmOn) {
              const clip = boss.transformVideo.video;
              if (boss.transformVideo.started && clip.duration > 0) {
                boss.phaseUntil = now + Math.max(0, clip.duration - clip.currentTime) * 1000;
                progress = clip.ended ? 1 : Math.min(1, clip.currentTime / clip.duration);
              } else {
                boss.phaseUntil = Math.max(boss.phaseUntil, now + RING_BOSS_VIDEO_MS);
                progress = 0;
              }
              placeRingBossTransformVideo(boss, progress);
            }
            // The boss walks to where its new form begins its move while the clip plays, and the
            // new form stands at the height of that move (the Orbiter hovers), not on the old spot.
            const glide = progress * progress * (3 - 2 * progress);
            if (Number.isFinite(boss.revealX) && Number.isFinite(boss.transitionStartX)) {
              boss.x = boss.transitionStartX + (boss.revealX - boss.transitionStartX) * glide;
              boss.group.position.x = boss.x;
            }
            if (phaseGroup) {
              phaseGroup.position.x = 0;
              phaseGroup.position.y = (phaseGroup.userData.bcmGroundY || 2.1) + (boss.revealY || 0);
            }
            const total = Math.max(0.5, (boss.phaseUntil - (boss.phaseStartedAt || now)) / 1000);
            const oldOpacity = filmOn ? Math.max(0, 1 - elapsed / 0.35) : Math.max(0, 1 - elapsed / 0.92);
            const newOpacity = filmOn
              ? Math.max(0, Math.min(1, (elapsed - (total - 0.6)) / 0.5))
              : Math.max(0, Math.min(1, (elapsed - 0.72) / 1.08));
            if (filmOn) {
              boss.transformVideo.material.opacity = Math.max(0, Math.min(1, elapsed / 0.3, (total - elapsed) / 0.45));
            }
            if (boss.transitionFromIndex > 0) {
              const oldGroup = boss.phaseGroups[boss.transitionFromIndex - 1];
              setRingBossGroupOpacity(oldGroup, oldOpacity);
            } else if (boss.pigShell) {
              const shrink = Math.max(0.02, 1 - elapsed / 0.62);
              boss.pigShell.forEach((part) => {
                if (!part.userData.bcmBaseScale) part.userData.bcmBaseScale = part.scale.clone();
                part.scale.copy(part.userData.bcmBaseScale).multiplyScalar(shrink);
              });
            }
            setRingBossGroupOpacity(phaseGroup, newOpacity);
            updateRingBossTransitionVfx(boss, dt, elapsed);
            if (now >= boss.phaseUntil) {
              boss.phaseGroups.forEach((group, index) => {
                group.visible = index === phaseIndex - 1;
                setRingBossGroupOpacity(group, index === phaseIndex - 1 ? 1 : 0);
              });
              if (boss.pigGroup) { boss.pigGroup.visible = false; boss.pigGroup.scale.setScalar(1); }
              if (boss.pigShell) boss.pigShell.forEach((part) => { part.visible = false; });
              if (boss.pigShell) boss.pigShell.forEach((part) => { if (part.userData.bcmBaseScale) part.scale.copy(part.userData.bcmBaseScale); });
              clearRingBossTransitionVfx(boss);
              clearRingBossTransformVideo(boss);
              if (Number.isFinite(boss.revealX)) { boss.x = boss.revealX; boss.group.position.x = boss.x; }
              boss.transitionFromIndex = 0;
              playRingBossAnimation(boss, phaseIndex - 1, "idle", false);
              // Owner 22.11.2026 "Бои с боссами Ring": each form plays its own move
              // (ring-boss-moves.js) instead of the shared shockwave loop below.
              if (boss.homeX === undefined) boss.homeX = boss.x;
              // Owner 23.11.2026 "Погоня Гонщика": the Runner is fought as a rear-view chase.
              if (phaseIndex === 5 && window.BCMRingRunnerChase) {
                boss.moves = null;
                boss.tellMesh.visible = false;
                startRunnerChase(boss, now);
                return;
              }
              boss.moves = window.BCMRingBossMoves
                ? window.BCMRingBossMoves.create(phaseIndex, { homeX: boss.homeX, seed: (Math.round(boss.homeX * 97) + phaseIndex * 7919) >>> 0 })
                : null;
              boss.lastMoveState = "";
              if (boss.moves) {
                boss.phaseState = "moves";
                boss.tellMesh.visible = false;
                // Orbiter: the fight is flown (Balloon flight), jet and breath start full.
                if (boss.moves.flight) players.forEach((pilot) => { pilot.jetFuel = 100; pilot.breathReserve = 100; });
                return;
              }
              boss.phaseState = "telegraph";
              boss.phaseUntil = now + 850;
              boss.tellMesh.visible = true;
              boss.tellMesh.material.color.setHex(phaseIndex === 6 ? 0xff5e81 : 0xffcc6a);
              if (phaseIndex === 6) {
                boss.tellMesh.position.set(target.worldX - boss.x, 0.08, 1.2);
                boss.tellMesh.scale.set(1.08, 0.62, 1);
              } else {
                boss.tellMesh.position.set(0, 2.2, 1.18);
                boss.tellMesh.scale.set(1.42, 1.42, 1);
              }
              updateHud(cue);
            }
            return;
          }
          if (boss.phaseState === "chase") return;
          if (boss.phaseState === "moves" && boss.moves) {
            runBossMoves(boss, phaseGroup, target, living, dt, now);
            return;
          }
          if (boss.phaseState === "telegraph") {
            boss.vulnerable = false;
            boss.tellMesh.visible = true;
            boss.tellMesh.rotation.z += dt * 1.3;
            boss.tellMesh.material.opacity = 0.58 + Math.sin(now * 0.018) * 0.30;
            if (now < boss.phaseUntil) return;
            boss.phaseState = "attack";
            boss.phaseUntil = now + (phaseIndex === 1 || phaseIndex === 5 ? 620 : 480);
            boss.tellMesh.visible = false;
            const direction = target.worldX < boss.x ? -1 : 1;
            const waveCount = phaseIndex === 3 ? 2 : 1;
            for (let waveIndex = 0; waveIndex < waveCount; waveIndex += 1) {
              const startX = boss.x + direction * 2.2;
              const mesh = new THREE.Mesh(worldState.shockwaveGeometry, worldState.shockwaveMaterial);
              mesh.position.set(startX, waveCount === 2 ? (waveIndex ? 3.3 : 0.95) : 0.95, 0.78);
              mesh.scale.setScalar(phaseIndex === 4 ? 0.95 : 0.78);
              worldState.group.add(mesh);
              const speed = phaseIndex === 5 ? 13.0 : phaseIndex === 1 ? 11.5 : phaseIndex === 4 ? 7.0 : 8.5;
              worldState.shockwaves.push({ mesh, x: startX, direction, age: 0, speed, phase: phaseIndex });
            }
            return;
          }
          if (boss.phaseState === "attack") {
            boss.vulnerable = false;
            if (now < boss.phaseUntil) return;
            boss.phaseState = "recovery";
            boss.phaseUntil = now + 1050;
            boss.vulnerable = true;
            boss.tellMesh.visible = true;
            boss.tellMesh.material.color.setHex(0x69ffe0);
            boss.tellMesh.material.opacity = 0.9;
            boss.tellMesh.position.set(0, 2.2, 1.18);
            boss.tellMesh.scale.set(1.65, 1.65, 1);
            updateHud("ЯДРО ОТКРЫТО · СТРЕЛЯЙ СЕЙЧАС");
            return;
          }
          if (boss.phaseState === "recovery" && now >= boss.phaseUntil) {
            boss.phaseState = "telegraph";
            boss.phaseUntil = now + 950;
            boss.vulnerable = false;
            boss.tellMesh.visible = true;
            boss.tellMesh.material.color.setHex(phaseIndex === 6 ? 0xff5e81 : 0xffcc6a);
            updateHud(cue);
          }
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
        if (worldState.chase) { updateRunnerChase(dt, now); return; }
        for (const player of players) {
          const input = getInput(player);
          const moveX = input.moveX;
          const direction = Math.sign(moveX);
          if (direction) { player.facing = direction; player.moves += dt; }
          if (input.fire) firePlayerWeapon(player, now);
          if (input.activate) triggerAction(player.index, "activate");
          if (input.floor) triggerAction(player.index, "floor");
          if (input.dash) triggerAction(player.index, "dash");
          const dashing = now < player.dashUntil, previousX = player.worldX;
          if (dashing) player.worldX += player.facing * 12.5 * dt;
          else player.worldX += moveX * 7.2 * dt;
          const path = worldState.cellPath;
          const playerNode = player.ringCurrent || path?.current;
          const playerInLarge = playerNode ? !!playerNode.large : worldState.inLargeCell;
          const flightPanel = !!(path && path.flight && !playerInLarge && playerNode === path.panelNode);
          // In a flight panel the air speed is the panel's (Balloon pace): 0..airSpeed.
          if (flightPanel && !dashing && !player.grounded) {
            const reach = path.flight.F.airSpeed * dt;
            player.worldX = previousX + Math.max(-reach, Math.min(reach, player.worldX - previousX));
          }
          player.flightPanel = flightPanel;
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
            // Blocks of the panel are walls from the side (they hold from above as platforms).
            if (path.solidAt) {
              const lead = player.worldX + (player.worldX >= previousX ? 0.32 : -0.32);
              const stuck = path.solidAt(previousX, player.worldY + 0.12, player.worldY + 1.7);
              if (!stuck && player.worldX !== previousX && path.solidAt(lead, player.worldY + 0.12, player.worldY + 1.7)) player.worldX = previousX;
            }
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
          // Owner 22.11.2026 "Полёт в фазе Орбиты": the Orbiter arena is flown like a purple cell.
          const flightBoss = playerInLarge ? worldState.bosses.find((item) =>
            item.alive && item.activated && item.phaseState === "moves" && item.moves && item.moves.flight &&
            Math.abs(player.worldX - (item.homeX ?? item.x)) < 10.5) : null;
          const bossFlight = !!flightBoss;
          player.bossFlight = bossFlight;
          // Camera in flight (owner 22.11.2026): ease into the whole-arena frame and back.
          player.flightFrame = (Number(player.flightFrame) || 0) +
            ((bossFlight ? 1 : 0) - (Number(player.flightFrame) || 0)) * Math.min(1, dt * 2.5);
          // Boss camera (owner 23.11.2026: the big Brawler fires from the far wall): during a
          // form fight the frame moves toward the middle between the pilot and the boss and
          // pulls back a little, so the boss, its charge and the balls stay on screen.
          const framedBoss = playerInLarge ? worldState.bosses.find((item) =>
            item.alive && item.activated && item.phaseIndex > 0 && item.phaseState !== "chase" &&
            Math.abs(player.worldX - item.x) < 20) : null;
          player.bossFrame = (Number(player.bossFrame) || 0) +
            ((framedBoss ? 1 : 0) - (Number(player.bossFrame) || 0)) * Math.min(1, dt * 2.0);
          if (framedBoss) player.bossFrameX = (player.worldX + framedBoss.x) / 2;
          const lowGravity = astralMode === "drift" || astralMode === "flux" || bossFlight || flightPanel;
          if (bossFlight) { gravity = 6.0; jumpVelocity = 7.8; }
          const highGravity = astralMode === "dense";
          if (astralMode === "drift") { gravity = 6.0; jumpVelocity = 7.8; }
          else if (astralMode === "flux") { gravity = 7.0 + Math.sin(now * 0.0018 + (astralNode.astralPhase || 0)) * 1.2; jumpVelocity = 7.4; }
          else if (highGravity) { gravity = 27.0; jumpVelocity = 5.7; }
          if (flightPanel) gravity = path.flight.F.gravity;
          const hangJump = input.jumpEdge;
          if (flightPanel && player.index === 0) updateFlightPanel(path, now);
          // Traps of the panel: plates crumble after a touch, timed spikes rise and sink.
          if (path && !playerInLarge) {
            (path.crumbles || []).forEach((pl) => {
              if (!pl.crumbleAt) return;
              const age = now - pl.crumbleAt;
              if (!pl.gone && age > 550) {
                comicPop(window.BCMDialogue?.language === "en" ? "KRAK!" : "КРАК!", (pl.minX + pl.maxX) / 2, pl.y + 0.6);
                pl.gone = true; pl.homeMinX = pl.minX; pl.homeMaxX = pl.maxX; pl.minX = pl.maxX = -9999;
                if (pl.mesh) pl.mesh.visible = false;
              } else if (!pl.gone && pl.mesh) {
                pl.mesh.position.x = pl.baseX + Math.sin(age * 0.09) * 0.05;
              } else if (pl.gone && age > 5500) {
                pl.gone = false; pl.minX = pl.homeMinX; pl.maxX = pl.homeMaxX; pl.crumbleAt = 0;
                if (pl.mesh) { pl.mesh.visible = true; pl.mesh.position.x = pl.baseX; }
              }
            });
            (path.slicers || []).forEach((sl) => {
              const shut = window.BCMRingPanels.slicerClosedAt(sl.trap, now / 1000);
              // Jaws: apart (floor and 1.9 m) when open, meeting at 0.95 m when shut.
              const p = ((now / 1000 + sl.trap.phase) % sl.trap.period);
              const close = shut ? 1 : Math.max(0, 1 - Math.min(p - sl.trap.closed, sl.trap.period - p) / 0.25);
              sl.low.position.y = 0.06 + close * 0.83;
              sl.high.position.y = 1.9 - close * 0.83;
              if (shut && !sl.wasShut && Math.abs(player.worldX - sl.x) < 4) comicPop("ЧАК!", sl.x, 2.3);
              sl.wasShut = shut;
              if (shut && Math.abs(player.worldX - sl.x) < 0.45 + 0.35 && player.worldY < 1.9) {
                damagePlayer(player, now);
                player.worldX = sl.x - Math.sign(player.worldX - previousX || player.facing || 1) * 1.0;
              }
            });
            (path.timedSpikes || []).forEach((t) => {
              t.active = ((now / 1000 + t.phase) % 2.4) < 1.2;
              if (t.group) t.group.position.y = t.active ? 0 : -0.5;
            });
          }
          if (lowGravity && input.moveY && !flightPanel) {
            // Positive moveY is down in the shared control convention; Ring world Y is up.
            player.vy = Math.max(-4.8, Math.min(4.8, player.vy - input.moveY * 10.5 * dt));
          }
          const jumpPressed = input.jumpEdge && player.grounded;
          // Owner 24.11.2026: the jet is held — it thrusts while the jump is down and burns fuel
          // (and breath) per second; no fixed number of hops. A grounded tap still jumps.
          if (jumpPressed && !flightPanel) {
            player.vy = jumpVelocity;
            player.grounded = false;
            player.supportPlatform = null;
          } else if (input.jump && lowGravity && player.jetFuel > 0 && player.breathReserve > 0) {
            const F = flightPanel ? path.flight.F : null;
            const thrust = F ? F.thrust : 13.0;
            const burn = F ? F.burn : 22;
            const maxRise = F ? F.maxRise : 6.2;
            player.vy = Math.min(maxRise, player.vy + thrust * dt);
            player.jetFuel = Math.max(0, player.jetFuel - burn * dt);
            player.breathReserve = Math.max(0, player.breathReserve - burn * 0.5 * dt);
            player.grounded = false;
            player.supportPlatform = null;
            player.jetFlameRemaining = 0.08;
          } else if (jumpPressed) {
            player.vy = jumpVelocity;
            player.grounded = false;
            player.supportPlatform = null;
          }
          player.vy -= gravity * dt;
          // Below the floor line of a flight panel the abyss pulls harder: the fall reads at once.
          if (flightPanel && player.worldY < 0) player.vy -= gravity * 2 * dt;
          player.worldY += player.vy * dt;
          if (bossFlight && player.worldY > flightBoss.moves.ceiling) {
            player.worldY = flightBoss.moves.ceiling; player.vy = Math.min(0, player.vy);
          }
          if (player.vy <= 0) {
            // Orbiter pit (owner 23.11.2026): the arena floor is gone off the ledges.
            const overPit = (bossFlight && flightBoss.moves.pitAt(player.worldX)) ||
              (flightPanel && player.worldX > path.flight.pitMinX && player.worldX < path.flight.pitMaxX);
            const landing = worldState.platforms.filter((platform) =>
              player.worldX >= platform.minX && player.worldX <= platform.maxX &&
              previousY >= platform.y && player.worldY <= platform.y &&
              !(overPit && platform.y <= 0.01)
            ).sort((a,b)=>b.y-a.y)[0];
            if (landing) {
              player.worldY = landing.y; player.vy = 0; player.grounded = true; player.supportPlatform = landing;
              if (landing.crumble && !landing.crumbleAt) landing.crumbleAt = now;
              if (landing.y === 0) player.checkpointX = playerInLarge ? worldState.spawnX : (path ? path.homeX : (player.worldX < -2 ? -43 : (player.worldX < 36 ? 3 : 40)));
            } else player.grounded = false;
          }
          // Ledge grab: the motion lives in crew-core (owner 20.11.2026); the Ring
          // only answers where a reachable block top is.
          if (path && !playerInLarge && path.ledgeAt && window.BCMCrewCore && window.BCMCrewCore.crewLedgeStep) {
            const step = window.BCMCrewCore.crewLedgeStep(
              { x: player.worldX, y: player.worldY, vy: player.vy, facing: player.facing, grounded: player.grounded, hang: player.hang || null },
              { jumpEdge: hangJump, dir: direction },
              (x, footY, dir) => path.ledgeAt(x, footY, dir)
            );
            if (step) {
              player.hang = step.hang;
              player.worldX = step.x; player.worldY = step.y; player.vy = step.vy; player.grounded = step.grounded;
              if (step.climbed) {
                player.climbRemaining = 0.24;
                player.supportPlatform = worldState.platforms.find((p) => p.y === step.y && player.worldX >= p.minX && player.worldX <= p.maxX) || null;
              }
            }
          } else if (player.hang) player.hang = null;
          // Panel spikes (ring-panels.js) hurt and throw the pilot up; timed spikes only when up.
          const onSpikes = !!(path && !playerInLarge && player.grounded && player.worldY < 0.05 &&
            ((path.spikes || []).some((s) => player.worldX > s.minX && player.worldX < s.maxX) ||
             (path.timedSpikes || []).some((t) => t.active && player.worldX > t.minX && player.worldX < t.maxX)));
          if (onSpikes) {
            damagePlayer(player, now);
            player.vy = 7.2; player.grounded = false; player.supportPlatform = null;
          }
          // In the Orbiter pit the fall ends once the pilot leaves the arena frame (−0.6 m).
          if (flightPanel && player.grounded && player.worldY < 0.01) player.flightPadX = player.worldX;
          if (flightPanel && player.worldY < -1.5) {
            player.worldY = 0; player.vy = 0; player.grounded = true; player.supportPlatform = null;
            const fl = path.flight;
            const pad = Number.isFinite(player.flightPadX) ? player.flightPadX
              : (Math.abs(player.worldX - fl.padLeft) < Math.abs(player.worldX - fl.padRight) ? fl.padLeft : fl.padRight);
            player.worldX = pad < fl.hx ? Math.min(pad, fl.pitMinX - 0.5) : Math.max(pad, fl.pitMaxX + 0.5);
            damagePlayer(player, now);
            player.jetFuel = Math.max(60, player.jetFuel);
            player.breathReserve = Math.max(60, player.breathReserve);
            updateHud(window.BCMDialogue?.language === "en" ? "INTO THE ABYSS · BACK ON THE PAD" : "СОРВАЛСЯ В ПРОПАСТЬ · НАЗАД НА ПЛОЩАДКУ");
            comicPop(window.BCMDialogue?.language === "en" ? "WHOOSH!" : "ФЬЮУ!", player.worldX, 2.2);
          }
          if (player.worldY < (bossFlight ? -2.5 : -7)) {
            player.worldY = 0; player.vy = 0; player.grounded = true; player.supportPlatform = null;
            // In the Orbiter pit the pilot comes back on the nearest ledge with some jet and air.
            const nearestLedge = bossFlight ? flightBoss.moves.nearestLedge(player.worldX) : null;
            player.worldX = nearestLedge !== null ? nearestLedge : player.checkpointX; damagePlayer(player, now);
            if (nearestLedge !== null) {
              player.jetFuel = Math.max(50, player.jetFuel);
              player.breathReserve = Math.max(50, player.breathReserve);
              updateHud(window.BCMDialogue?.language === "en" ? "FELL INTO THE PIT · BACK ON THE LEDGE" : "СОРВАЛСЯ В ПРОПАСТЬ · НАЗАД НА УСТУП");
            }
          }
          if (player.grounded && player.supportPlatform && player.supportPlatform.y > 0 &&
              (player.worldX < player.supportPlatform.minX || player.worldX > player.supportPlatform.maxX)) {
            player.grounded = false; player.vy = -0.2; player.supportPlatform = null;
          }
          if (flightPanel) {
            const fl = path.flight;
            const t = (now - fl.startedAt) / 1000;
            fl.gates.forEach(({ gate }) => {
              const gx = fl.hx + gate.x;
              if (Math.abs(player.worldX - gx) > (gate.width + 0.7) / 2) return;
              const gp = window.BCMRingPanels.flightGapAt(gate, t);
              if (player.worldY < gp.y0 || player.worldY + 1.7 > gp.y1) {
                if (now >= player.invulnerableUntil) comicPop(window.BCMDialogue?.language === "en" ? "ZZAP!" : "ВЖЖ!", gx, player.worldY + 1.4);
                damagePlayer(player, now);
                player.worldX = gx - Math.sign(player.worldX - previousX || player.facing || 1) * ((gate.width + 0.7) / 2 + 0.15);
              }
            });
            if (player.worldY + 1.7 > fl.F.ceilingY) {
              damagePlayer(player, now);
              player.worldY = fl.F.ceilingY - 1.75; player.vy = Math.min(player.vy, -1.5);
            }
            fl.bubbles.forEach((b) => {
              if (!b.taken && Math.abs(player.worldX - b.x) < 0.75 && Math.abs(player.worldY + 0.9 - b.mesh.position.y) < 0.95) {
                b.taken = true; b.respawnAt = now + 6000;
                player.jetFuel = Math.min(100, player.jetFuel + fl.F.bubble);
                player.breathReserve = Math.min(100, player.breathReserve + fl.F.bubble);
                comicPop(window.BCMDialogue?.language === "en" ? "BLUB!" : "БУЛЬ!", b.x, b.y + 0.6);
              }
            });
          }
          if (lowGravity && playerNode?.airBubbles) {
            playerNode.airBubbles.forEach((bubble) => {
              if (bubble.taken && now >= bubble.respawnAt) bubble.taken = false;
              if (!bubble.taken && Math.abs(player.worldX - bubble.x) < 0.72 && Math.abs(player.worldY + 0.9 - bubble.y) < 0.9) {
                bubble.taken = true;
                bubble.respawnAt = now + 7000;
                player.jetFuel = Math.min(100, player.jetFuel + 34);
                player.breathReserve = Math.min(100, player.breathReserve + 34);
                updateHud("ПУЗЫРЬ · ЗАПАС ПОЛЁТА И КИСЛОРОДА ВОССТАНОВЛЕН");
              }
            });
          }
          collectAt(player); collectHydrogenAt(player); collectRouteCrystal(player);
          const blinking = now < player.invulnerableUntil && Math.floor(now / 90) % 2 === 0;
          if (player.sprite) player.sprite.visible = !blinking;
          updatePlayerSprite(player, dt);
        }
        updateComicPops(dt);
        const bubblePath = worldState.cellPath;
        if (bubblePath?.nodes) bubblePath.nodes.forEach((node) => {
          (node.airBubbles || []).forEach((bubble) => {
            if (bubble.taken && now >= bubble.respawnAt) bubble.taken = false;
            bubble.mesh.visible = !bubble.taken && players.some((pilot) => (pilot.ringCurrent || bubblePath.current) === node);
          });
        });
        worldState.shockwaves = worldState.shockwaves.filter((wave) => {
          wave.age += dt; wave.x += wave.direction * (Number(wave.speed) || 8.5) * dt; wave.mesh.position.x = wave.x;
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
        const halfHeight = (viewport.h > viewport.w ? 7.1 : 5.4) * (Number(center.zoom) || 1);
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
        // In the Orbiter flight the view stands on the arena floor, so the floor tells,
        // the Orbiter and a pilot at the ceiling (8 m) all stay in the frame.
        const followY = center.y + 0.65;
        const arenaY = -0.6 + halfHeight;
        const flight = Math.max(0, Math.min(1, Number(center.flight) || 0));
        const viewY = followY + (arenaY - followY) * flight;
        camera.position.set(center.x, viewY, 42);
        camera.lookAt(center.x, viewY, 0);
        // What the first view shows, in world metres (read by the QA snapshot).
        if (worldState && camera === cameraOne) {
          worldState.cameraView = { y: viewY, bottom: viewY - halfHeight, top: viewY + halfHeight,
            left: center.x - halfHeight * aspect, right: center.x + halfHeight * aspect };
        }
      }

      function cameraTargetFor(player) {
        const boss = Number(player.bossFrame) || 0;
        const midX = Number.isFinite(player.bossFrameX) ? player.bossFrameX : player.worldX;
        return { x: player.worldX + (midX - player.worldX) * boss, y: player.worldY + 2.2, z: 0,
          flight: Math.max(Number(player.flightFrame) || 0, boss), zoom: 1 + 0.18 * boss };
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
        if (worldState.chase && worldState.chase.camera) {
          const chaseCamera = worldState.chase.camera;
          chaseCamera.aspect = viewW / viewH;
          chaseCamera.updateProjectionMatrix();
          renderer.render(activeScene, chaseCamera);
          return true;
        }
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
              z: 0,
              flight: Math.max(target.flight, other.flight),
              zoom: Math.max(target.zoom || 1, other.zoom || 1)
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
                flux: "#38245f",
                dense: "#123d66"
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
        if (!players[index] || !crewControls[index]) return;
        crewControls[index].touch(action, down);
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
        const stop = (event) => setActionFromPointer(button, action, false, event);
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
        crewControls.forEach((controls) => controls?.clear());
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
            if (worldState) worldState.disposed = true;
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


    function setMuted(muted) {
      if (ringAudio) ringAudio.muted = !!muted;
    }
    return {
      open: openRingPlatformer,
      stopAudio: stopRingAudio,
      setMuted
    };
  }
  window.BCMRingPlatformer = { create };
})(window);
