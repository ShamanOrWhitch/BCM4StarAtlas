(() => {
  "use strict";

  const CONFIG = window.BCMTowerConfig || {};
  if (!Array.isArray(CONFIG.assets) && Array.isArray(window.BCMMiniSimConfig?.assets)) CONFIG.assets = window.BCMMiniSimConfig.assets;
  const TOWER_VERSION = "0.2.64";
  const THREE_URL = CONFIG.threeUrl || "";

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (window.THREE) return resolve();
      if (!src) return reject(new Error("Three.js URL missing"));
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error("Three.js load failed"));
      document.head.appendChild(script);
    });
  }

  function mulberry32(seed) {
    return function () {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeSeed() {
    const a = new Uint32Array(3);
    if (window.crypto?.getRandomValues) {
      window.crypto.getRandomValues(a);
      return (a[0] ^ a[1] ^ a[2]) >>> 0;
    }
    return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function wrapSector(s, count) {
    return ((s % count) + count) % count;
  }

  function configAssets() {
    const list = Array.isArray(CONFIG.assets)
      ? CONFIG.assets
      : Array.isArray(CONFIG.assetList)
        ? CONFIG.assetList
        : [];
    return list.filter((item) => item && typeof item === "object");
  }

  function assetPool(name) {
    const explicit = Array.isArray(CONFIG[name]) ? CONFIG[name].filter(Boolean) : [];
    if (explicit.length) return explicit;

    const aliases = {
      upperPlatformPool: /(^|\/)upperplatform(?:\d+)?\.(?:jpe?g|png)$/i,
      hMarkerPool: /(^|\/)H1?(?:\d*)\.png$/i,
      landingPool: /(^|\/)H1?(?:\d*)\.png$/i
    };
    const re = aliases[name];
    if (!re) return [];
    return configAssets()
      .filter((item) => re.test(String(item.name || item.url || "")))
      .map((item) => String(item.url || ""))
      .filter(Boolean);
  }

  function rasterUrl(url) {
    return /\.(?:png|jpe?g|webp)(?:[?#].*)?$/i.test(String(url || ""));
  }

  function pick(pool, rand) {
    if (!pool.length) return "";
    return pool[Math.floor(rand() * pool.length)];
  }

  function angleDelta(a, b) {
    let d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }



  // Run image matting once per selected Crew image, never inside the render loop.
  // Xenova/modnet is a Transformers.js background-removal model (Apache-2.0).
  let crewSegmentationPipelinePromise = null;

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
      if (!request || !canvas.toBlob) return;
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) return;
      const cache = await window.caches.open("bcm-tower-crew-cutouts-v8");
      await cache.put(request, new Response(blob, { headers: { "Content-Type": "image/png" } }));
    } catch (error) {}
  }

  function getCrewSegmentationPipeline() {
    if (!crewSegmentationPipelinePromise) {
      crewSegmentationPipelinePromise = import("https://esm.sh/@huggingface/transformers@3.8.1?bundle")
        .then((module) => {
          if (module.env) {
            module.env.useBrowserCache = true;
            module.env.allowRemoteModels = true;
          }
          // General-use ISNet is better suited to illustrated/game characters than
          // portrait-only matting. Quantized weights run once per selected image
          // and the transparent PNG is cached in this browser.
          return module.pipeline("background-removal", "Ko033/isnet-general-use-onnx", { dtype: "q8" });
        })
        .catch((error) => {
          crewSegmentationPipelinePromise = null;
          throw error;
        });
    }
    return crewSegmentationPipelinePromise;
  }

  function cropCrewCanvas(canvas, ctx, frame, texture) {
    const w = canvas.width;
    const h = canvas.height;
    const pixels = frame.data;
    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        // Keep faint anti-aliased pixels at hair, fingers and shoe edges.
        if (pixels[(y * w + x) * 4 + 3] < 4) continue;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX < minX || maxY < minY) return false;
    const sourceMaxY = maxY;
    const padX = Math.max(4, Math.round(w * 0.025));
    const padTop = Math.max(4, Math.round(h * 0.025));
    const padBottom = Math.max(2, Math.round(h * 0.01));
    minX = Math.max(0, minX - padX);
    minY = Math.max(0, minY - padTop);
    maxX = Math.min(w - 1, maxX + padX);
    maxY = Math.min(h - 1, maxY + padBottom);
    const cropHeight = maxY - minY + 1;
    const transparentBottom = Math.max(0, maxY - sourceMaxY);
    ctx.putImageData(frame, 0, 0);
    const crop = ctx.getImageData(minX, minY, maxX - minX + 1, cropHeight);
    canvas.width = crop.width;
    canvas.height = crop.height;
    ctx.putImageData(crop, 0, 0);
    if (texture?.userData) {
      texture.userData.bcmCutoutFeetPadRatio = transparentBottom / Math.max(1, crop.height);
    }
    return true;
  }

  function pruneCrewMatteSpecks(frame, width, height) {
    const pixels = frame.data;
    const total = width * height;
    const seen = new Uint8Array(total);
    const stack = [];
    const component = [];
    const minComponentPixels = Math.max(4, Math.floor(total * 0.00002));
    // Clear near-transparent model noise while retaining the smooth semitransparent edge band.
    for (let p = 0; p < total; p += 1) {
      if (pixels[p * 4 + 3] < 24) pixels[p * 4 + 3] = 0;
    }

    const visit = (start) => {
      stack.length = 0;
      component.length = 0;
      stack.push(start);
      seen[start] = 1;
      while (stack.length) {
        const p = stack.pop();
        component.push(p);
        const x = p % width;
        const y = Math.floor(p / width);
        const neighbours = [];
        if (x > 0) neighbours.push(p - 1);
        if (x + 1 < width) neighbours.push(p + 1);
        if (y > 0) neighbours.push(p - width);
        if (y + 1 < height) neighbours.push(p + width);
        for (const q of neighbours) {
          if (seen[q]) continue;
          seen[q] = 1;
          if (pixels[q * 4 + 3] >= 64) stack.push(q);
        }
      }
    };

    let largest = 0;
    let largestCount = 0;
    for (let p = 0; p < total; p += 1) {
      if (seen[p] || pixels[p * 4 + 3] < 64) continue;
      visit(p);
      if (component.length > largestCount) {
        largestCount = component.length;
        largest = p;
      }
    }

    seen.fill(0);
    for (let p = 0; p < total; p += 1) {
      if (seen[p] || pixels[p * 4 + 3] < 64) continue;
      visit(p);
      // Keep the largest island unconditionally. Drop only tiny disconnected
      // islands that are characteristic of residual background specks.
      if (component.length >= minComponentPixels || component[0] === largest) continue;
      for (const q of component) pixels[q * 4 + 3] = 0;
    }
  }

  function speciesMotion(species, sex) {
    if (window.BCMCrewCore && window.BCMCrewCore.speciesMotion) {
      return window.BCMCrewCore.speciesMotion(species, sex);
    }
    const key = String(species || "").toLowerCase();
    const female = /female/i.test(String(sex || ""));
    if (key.includes("profound") || key.includes("high punaab") || key.includes("punaab")) {
      return { bob: 0.055, speed: 0.011, sway: 0.035, squash: 0.045 };
    }
    if (key.includes("sogmian")) return { bob: 0.04, speed: 0.01, sway: 0.02, squash: 0.03 };
    if (key.includes("ustur")) return { bob: 0.012, speed: 0.009, sway: 0.055, squash: 0.015 };
    if (key.includes("mierese")) {
      return female
        ? { bob: 0.048, speed: 0.021, sway: 0.07, squash: 0.05 }
        : { bob: 0.034, speed: 0.015, sway: 0.025, squash: 0.035 };
    }
    return { bob: 0.036, speed: 0.018, sway: 0.018, squash: 0.04 };
  }

  function splitCrewLegs() {
    return;
  }

  function officialCrewCutoutUrl(url) {
    const text = String(url || "");
    const full = text.match(/^(https?:\/\/cdn\.staratlas\.com\/crew\/v1\/)(\d+)_full\.(?:jpe?g|png|webp)(?:\?.*)?$/i);
    if (full) return full[1] + full[2] + ".png";
    const bare = text.match(/^https?:\/\/cdn\.staratlas\.com\/crew\/v1\/\d+\.png(?:\?.*)?$/i);
    return bare ? text : "";
  }

  function crewImageHasCutoutAlpha(pixels) {
    let samples = 0;
    let clear = 0;
    for (let i = 3; i < pixels.length; i += 16) {
      samples += 1;
      if (pixels[i] < 16) clear += 1;
    }
    return samples > 0 && clear / samples > 0.18;
  }

  function assetTexture(url, renderer, options = {}) {
    if (!url || !window.THREE) return null;
    options = options && typeof options === "object" ? options : {};

    const cleanKey = (options.officialAlpha ? "|official" : options.cutout ? "|cutout" : options.removeWhite ? "|whitekey" : "") + (options.removeBlack ? "|black" : "");
    const cacheKey = String(url) + cleanKey;
    const cache = assetTexture.cache || (assetTexture.cache = new Map());
    if (cache.has(cacheKey)) return cache.get(cacheKey);

    let tex;

    if ((options.removeWhite || options.removeBlack || options.cutout || options.officialAlpha) && (rasterUrl(url) || /^https?:/i.test(String(url)))) {
      // Some of the supplied PNG cards contain an opaque white matte instead
      // of real alpha. Remove only near-white pixels and preserve antialiased
      // edges so doors, NPCs and landing cards behave as cut-outs.
      const canvas = document.createElement("canvas");
      canvas.width = 2;
      canvas.height = 2;
      tex = new THREE.CanvasTexture(canvas);
      tex.userData = tex.userData || {};
      if (options.cutout || options.officialAlpha) {
        tex.userData.bcmCutoutPending = true;
        tex.userData.bcmCutoutReady = false;
      }

      const image = new Image();
      image.crossOrigin = "anonymous";
      image.decoding = "async";
      image.onerror = () => {
        if (options.officialAlpha && options.fallbackUrl && image.src !== options.fallbackUrl) {
          options.officialAlpha = false;
          options.cutout = true;
          image.src = options.fallbackUrl;
          return;
        }
        if (tex.userData) {
          tex.userData.bcmCutoutPending = false;
          tex.userData.bcmCutoutFailed = true;
        }
        tex.needsUpdate = true;
      };
      image.onload = async () => {
        try {
          const srcW = image.naturalWidth || image.width || 1;
          const srcH = image.naturalHeight || image.height || 1;
          const maxSide = options.cutout ? 512 : Math.max(srcW, srcH);
          const scale = Math.min(1, maxSide / Math.max(srcW, srcH));
          canvas.width = Math.max(1, Math.round(srcW * scale));
          canvas.height = Math.max(1, Math.round(srcH * scale));
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) return;

          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

          const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const pixels = frame.data;

          if (options.officialAlpha && crewImageHasCutoutAlpha(pixels)) {
            if (!cropCrewCanvas(canvas, ctx, frame, tex, 40)) {
              throw new Error("official crew png had no silhouette");
            }
            splitCrewLegs(canvas, tex);
            tex.userData.bcmCutoutPending = false;
            tex.userData.bcmCutoutReady = true;
            tex.userData.bcmCutoutFailed = false;
            tex.userData.bcmOfficialCutout = true;
            tex.needsUpdate = true;
            return;
          }
          if (options.officialAlpha && options.fallbackUrl && image.src !== options.fallbackUrl) {
            options.officialAlpha = false;
            options.cutout = true;
            image.src = options.fallbackUrl;
            return;
          }

          if (options.cutout) {
            const cachedBlob = await readCrewCutoutCache(url);
            if (cachedBlob && typeof createImageBitmap === "function") {
              const bitmap = await createImageBitmap(cachedBlob);
              canvas.width = bitmap.width;
              canvas.height = bitmap.height;
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(bitmap, 0, 0);
              // Cached PNGs must preserve the same floor anchoring as freshly
              // segmented images. Re-measure transparent bottom padding from alpha.
              const cachedPixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
              let lastVisibleY = -1;
              for (let y = canvas.height - 1; y >= 0 && lastVisibleY < 0; y -= 1) {
                for (let x = 0; x < canvas.width; x += 1) {
                  if (cachedPixels[(y * canvas.width + x) * 4 + 3] >= 4) {
                    lastVisibleY = y;
                    break;
                  }
                }
              }
              const blankBottomRows = lastVisibleY < 0 ? 0 : Math.max(0, canvas.height - 1 - lastVisibleY);
              tex.userData.bcmCutoutFeetPadRatio = blankBottomRows / Math.max(1, canvas.height);
              if (typeof bitmap.close === "function") bitmap.close();
              splitCrewLegs(canvas, tex);
              tex.userData.bcmCutoutPending = false;
              tex.userData.bcmCutoutReady = true;
              tex.needsUpdate = true;
              return;
            }

            let segmented = false;
            try {
              const segmenter = await getCrewSegmentationPipeline();
              const output = await segmenter(canvas);
              const results = Array.isArray(output) ? output : [output];
              const picked = results.find((item) =>
                item && item.mask && item.mask.data && item.mask.width && item.mask.height
              ) || results.find((item) =>
                item && item.data && item.width && item.height
              );
              const mask = picked && picked.mask ? picked.mask : picked;
              if (!mask || !mask.data || !mask.width || !mask.height) {
                throw new Error("MODNet returned no matte");
              }

              // Transformers.js background-removal normally returns a complete
              // RGBA cut-out, not a grayscale matte. In that case the prediction
              // is already in channel 4; using channel 1 (red) as the matte makes
              // costume colors determine transparency and clips body parts.
              const maskChannels = Math.max(1, Number(mask.channels) || 1);
              const embeddedAlpha = !picked.mask && maskChannels === 4;
              const maskChannel = embeddedAlpha ? 3 : 0;
              const maskPixels = mask.width * mask.height;
              if (mask.data.length < maskPixels * maskChannels) {
                throw new Error("ISNet returned an incomplete matte");
              }

              let minMask = Infinity;
              let maxMask = -Infinity;
              for (let p = 0; p < maskPixels; p += 1) {
                const value = Number(mask.data[p * maskChannels + maskChannel]) || 0;
                if (value < minMask) minMask = value;
                if (value > maxMask) maxMask = value;
              }
              const byteMask =
                mask.data instanceof Uint8Array ||
                mask.data instanceof Uint8ClampedArray ||
                maxMask > 1.5;
              const maskScale = byteMask ? 255 : 1;
              if (
                !Number.isFinite(minMask) ||
                !Number.isFinite(maxMask) ||
                maxMask - minMask < (byteMask ? 2 : 0.01)
              ) {
                throw new Error("ISNet returned a flat matte");
              }
              const smoothstep = (a, b, value) => {
                const t = clamp((value - a) / (b - a), 0, 1);
                return t * t * (3 - 2 * t);
              };

              for (let y = 0; y < canvas.height; y += 1) {
                const my = Math.min(mask.height - 1, Math.round(y * (mask.height - 1) / Math.max(1, canvas.height - 1)));
                for (let x = 0; x < canvas.width; x += 1) {
                  const mx = Math.min(mask.width - 1, Math.round(x * (mask.width - 1) / Math.max(1, canvas.width - 1)));
                  const mi = (my * mask.width + mx) * maskChannels + maskChannel;
                  const normalized = clamp((Number(mask.data[mi]) || 0) / maskScale, 0, 1);
                  // For a returned RGBA cut-out, retain the model's soft alpha
                  // and clear only very low-opacity edge noise. If a model returns
                  // a single-channel probability matte instead, threshold it.
                  const alpha = embeddedAlpha
                    ? smoothstep(0.025, 0.26, normalized)
                    : smoothstep(0.18, 0.52, normalized);
                  const pi = (y * canvas.width + x) * 4;
                  pixels[pi + 3] = Math.round(pixels[pi + 3] * alpha);
                }
              }

              // Remove only tiny detached matte specks; preserve the principal
              // silhouette and any substantial separated costume/equipment pieces.
              pruneCrewMatteSpecks(frame, canvas.width, canvas.height);
              if (!cropCrewCanvas(canvas, ctx, frame, tex)) {
                throw new Error("ISNet returned an empty silhouette");
              }
              await writeCrewCutoutCache(url, canvas);
              segmented = true;
            } catch (segmentationError) {
              console.error("Tower Crew cutout failed; card background hidden", url, segmentationError);
              canvas.width = 2;
              canvas.height = 2;
              ctx.clearRect(0, 0, 2, 2);
              tex.userData.bcmCutoutPending = false;
              tex.userData.bcmCutoutReady = false;
              tex.userData.bcmCutoutFailed = true;
              tex.needsUpdate = true;
              return;
            }
            splitCrewLegs(canvas, tex);
            tex.userData.bcmCutoutPending = false;
            tex.userData.bcmCutoutReady = true;
          } else {
            for (let i = 0; i < pixels.length; i += 4) {
              const r = pixels[i];
              const g = pixels[i + 1];
              const b = pixels[i + 2];
              const a = pixels[i + 3];
              if (!a) continue;
              const nearWhite = options.removeWhite && Math.min(r, g, b) >= 246 && Math.max(r, g, b) <= 255;
              const softWhite = options.removeWhite && Math.min(r, g, b) >= 232;
              const nearBlack = options.removeBlack && Math.max(r, g, b) <= 18;
              const softBlack = options.removeBlack && Math.max(r, g, b) <= 40;
              if (nearWhite || nearBlack) {
                pixels[i + 3] = 0;
              } else if (softWhite) {
                const fade = Math.max(0, Math.min(1, (246 - Math.min(r, g, b)) / 14));
                pixels[i + 3] = Math.round(a * fade);
              } else if (softBlack) {
                const fade = Math.max(0, Math.min(1, (Math.max(r, g, b) - 18) / 22));
                pixels[i + 3] = Math.round(a * fade);
              }
            }
            ctx.putImageData(frame, 0, 0);
          }

          tex.needsUpdate = true;
        } catch (error) {
          console.warn("Tower PNG alpha cleanup failed", url, error);
          if (options.cutout && tex.userData) {
            tex.userData.bcmCutoutPending = false;
            tex.userData.bcmCutoutReady = true;
          }
          tex.needsUpdate = true;
        }
      };
      image.src = url;
    } else {
      tex = new THREE.TextureLoader().load(url);
    }

    if ("colorSpace" in tex && THREE.SRGBColorSpace !== undefined) {
      tex.colorSpace = THREE.SRGBColorSpace;
    } else if (THREE.sRGBEncoding !== undefined) {
      tex.encoding = THREE.sRGBEncoding;
    }

    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapS = options.repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    tex.wrapT = options.repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;

    if (options.repeat) {
      tex.repeat.set(options.repeatX || 1, options.repeatY || 1);
    }

    cache.set(cacheKey, tex);
    return tex;
  }

  function makeMaterial(tex, color = 0xffffff, transparent = false, alphaTest = 0.0) {
    return new THREE.MeshStandardMaterial({
      map: tex || null,
      color: tex ? 0xffffff : color,
      roughness: 0.84,
      metalness: 0.08,
      transparent,
      alphaTest,
      depthWrite: !transparent,
      side: transparent ? THREE.DoubleSide : THREE.FrontSide
    });
  }

  function makeJetFlameTexture(color) {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 144;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const glow = ctx.createRadialGradient(64, 76, 3, 64, 76, 74);
    glow.addColorStop(0, "rgba(255,255,255,0.75)");
    glow.addColorStop(0.28, color);
    glow.addColorStop(0.7, "rgba(75,184,255,0.45)");
    glow.addColorStop(1, "rgba(30,90,140,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const x of [43, 85]) {
      const flame = ctx.createLinearGradient(x, 20, x, 132);
      flame.addColorStop(0, "rgba(255,255,255,0)");
      flame.addColorStop(0.18, color);
      flame.addColorStop(0.55, "rgba(110,225,255,0.9)");
      flame.addColorStop(1, "rgba(70,155,255,0)");
      ctx.fillStyle = flame;
      ctx.beginPath();
      ctx.moveTo(x - 13, 16);
      ctx.quadraticCurveTo(x - 12, 58, x, 132);
      ctx.quadraticCurveTo(x + 12, 58, x + 13, 16);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillRect(x - 3, 18, 6, 38);
    }
    const texture = new THREE.CanvasTexture(canvas);
    if (THREE.SRGBColorSpace !== undefined) texture.colorSpace = THREE.SRGBColorSpace;
    else if (THREE.sRGBEncoding !== undefined) texture.encoding = THREE.sRGBEncoding;
    return texture;
  }

  // A separate shield oval keeps the Crew readable without baking card background
  // into the cutout. The AI mask never touches this layer and it never clips the feet.
  function makePlayerHaloTexture(colorHex) {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 192;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const r = (colorHex >> 16) & 255;
    const g = (colorHex >> 8) & 255;
    const b = colorHex & 255;
    const rgb = "rgba(" + r + "," + g + "," + b + ",";
    const fill = ctx.createRadialGradient(64, 96, 8, 64, 96, 96);
    fill.addColorStop(0, "rgba(10,24,35,0.82)");
    fill.addColorStop(0.52, "rgba(10,32,45,0.58)");
    fill.addColorStop(0.84, "rgba(8,20,31,0.22)");
    fill.addColorStop(1, "rgba(4,12,20,0)");

    // Rounded capsule instead of a pointed ellipse. The sides stay wide near
    // the ankles, so the full-body Crew sprite remains inside its shield.
    const traceCapsule = (inset) => {
      const left = 22 + inset;
      const right = 106 - inset;
      const top = 10 + inset;
      const bottom = 182 - inset;
      const rx = (right - left) / 2;
      const ry = (bottom - top) / 2;
      const cx = (left + right) / 2;
      const cy = (top + bottom) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.closePath();
    };

    ctx.fillStyle = fill;
    traceCapsule(0);
    ctx.fill();

    ctx.save();
    ctx.shadowColor = "rgb(" + r + "," + g + "," + b + ")";
    ctx.shadowBlur = 11;
    ctx.strokeStyle = rgb + "0.88)";
    ctx.lineWidth = 3;
    traceCapsule(1.5);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = rgb + "0.32)";
    ctx.lineWidth = 1;
    traceCapsule(7);
    ctx.stroke();
    ctx.restore();

    const texture = new THREE.CanvasTexture(canvas);
    if ("colorSpace" in texture && THREE.SRGBColorSpace !== undefined) {
      texture.colorSpace = THREE.SRGBColorSpace;
    }
    texture.needsUpdate = true;
    return texture;
  }
  function generateTower(seed, options = {}) {
    const rand = mulberry32(seed);
    const sectors = options.sectors || 18;
    const levels = options.levels || 46;
    const stepY = options.stepY || 4;
    const cells = new Map();
    const path = [];
    const doors = [];

    function key(level, sector) {
      return level + ":" + wrapSector(sector, sectors);
    }

    function setCell(level, sector, patch) {
      const s = wrapSector(sector, sectors);
      const k = key(level, s);
      const old = cells.get(k) || {
        level,
        sector: s,
        surface: "platform",
        object: null,
        phase: rand() * Math.PI * 2
      };
      const next = Object.assign(old, patch);
      cells.set(k, next);
      return next;
    }

    let sector = Math.floor(rand() * sectors);
    path.push(sector);
    setCell(levels - 1, sector, {
      surface: "upper",
      object: "landing"
    });

    const temperament = rand();
    let turnBias = rand() < 0.5 ? -1 : 1;
    let biasLeft = 2 + Math.floor(rand() * 6);
    for (let level = levels - 2; level >= 0; level--) {
      const wide = temperament > 0.62;
      // Shorter route jumps and fewer sharp switches make random seeds fairer
      // without changing the tower's dimensions or its guaranteed landing path.
      const maxDelta = wide ? 1 + Math.floor(rand() * 3) : (level % 4 === 0 ? 2 : 1);
      let delta = 0;
      if (rand() < (temperament < 0.28 ? 0.87 : 0.78)) {
        if (biasLeft <= 0) {
          turnBias *= -1;
          biasLeft = 3 + Math.floor(rand() * 5);
        }
        biasLeft -= 1;
        delta = turnBias * (1 + Math.floor(rand() * maxDelta));
      }
      sector = wrapSector(sector + delta, sectors);
      path.push(sector);

      let routeSurface = "platform";
      const surfaceRoll = rand();
      const routeIceChance = temperament > 0.45 ? 0.15 : 0.08;
      if (level < 2) routeSurface = "upper";
      else if (surfaceRoll < routeIceChance) routeSurface = "ice";
      else if (surfaceRoll < routeIceChance + 0.10) routeSurface = "lift";
      setCell(level, sector, {
        surface: routeSurface,
        object: level === 0 ? "landing" : null
      });
    }

    for (let level = 0; level < levels; level++) {
      const routeSector = path[levels - 1 - level];
      const sideCount = 1 + Math.floor(rand() * 2);

      for (let i = 0; i < sideCount; i++) {
        const delta = (rand() < 0.5 ? -1 : 1) * (1 + Math.floor(rand() * 3));
        const s = wrapSector(routeSector + delta, sectors);
        const k = key(level, s);
        if (cells.has(k)) continue;

        const roll = rand();
        let surface = "platform";
        if (roll < 0.10) surface = "rock";
        else if (roll < 0.19) surface = "ice";
        else if (roll < 0.26) surface = "hot";
        else if (roll < 0.30) surface = "lava";
        else if (roll < 0.42) surface = "lift";

        setCell(level, s, { surface });
      }

      // Boxes, doors and test NPCs are objects placed on existing surfaces.
      const objectRoll = rand();
      if (level > 2 && level < levels - 3 && objectRoll < 0.22) {
        const objectSector = wrapSector(routeSector + (rand() < 0.5 ? -2 : 2), sectors);
        const target = cells.get(key(level, objectSector));
        if (target) {
          if (objectRoll < 0.09) target.object = "dangerbox";
          else if (objectRoll < 0.18) target.object = "safebox";
          else if (objectRoll < 0.24) target.object = "fire";
          else target.object = "npc";
        }
      }

      if (level > 4 && level < levels - 6 && rand() < 0.055) {
        // Each door is paired with a real door on the opposite side of the
        // tower at the same level, creating a passage through the cylinder.
        const doorSector = wrapSector(
          routeSector + (rand() < 0.5 ? -3 : 3),
          sectors
        );
        const oppositeSector = wrapSector(
          doorSector + Math.floor(sectors / 2),
          sectors
        );
        const target = cells.get(key(level, doorSector));
        let opposite = cells.get(key(level, oppositeSector));
        if (!opposite) {
          opposite = setCell(level, oppositeSector, { surface: "platform" });
        }
        if (target && !target.object && opposite && !opposite.object) {
          target.object = "door";
          opposite.object = "door";
          doors.push(target, opposite);
        }
      }

      if (level > 5 && level < levels - 5 && rand() < 0.04) {
        const wallDoorSector = wrapSector(routeSector + (rand() < 0.5 ? -4 : 4), sectors);
        const target = cells.get(key(level, wallDoorSector));
        if (target && !target.object) target.object = "walldoor";
      }
    }

    // Guarantee visible, reachable opposite doors at several depths.
    // They sit on the generated safe path, so the player can actually discover
    // the passage instead of waiting for a rare side-cell roll.
    for (const forcedLevel of [8, 18, 28, 38]) {
      if (forcedLevel <= 4 || forcedLevel >= levels - 3) continue;

      const routeSector = path[levels - 1 - forcedLevel];
      if (routeSector == null) continue;

      const oppositeSector = wrapSector(routeSector + Math.floor(sectors / 2), sectors);
      const from = setCell(forcedLevel, routeSector, {
        surface: cells.get(key(forcedLevel, routeSector))?.surface || "platform",
        object: "door"
      });
      const to = setCell(forcedLevel, oppositeSector, {
        surface: "platform",
        object: "door"
      });

      from.doorPair = to;
      to.doorPair = from;
      if (!doors.includes(from)) doors.push(from);
      if (!doors.includes(to)) doors.push(to);
    }

    if (doors.length >= 2) {
      for (let i = 0; i + 1 < doors.length; i += 2) {
        if (!doors[i].doorPair) doors[i].doorPair = doors[i + 1];
        if (!doors[i + 1].doorPair) doors[i + 1].doorPair = doors[i];
      }
    }

    // Optional boost crates appear on nearby side platforms while the guaranteed route stays intact.
    const boostTypes = ["jet", "shield", "spring"];
    const boostOffsets = [1, -1, 2, -2, 3, -3];
    let boostIndex = 0;
    for (let level = 4; level < levels - 4; level += 5) {
      const routeSector = path[levels - 1 - level];
      if (routeSector == null) continue;
      let boostCell = null;
      for (const delta of boostOffsets) {
        const targetSector = wrapSector(routeSector + delta, sectors);
        let candidate = cells.get(key(level, targetSector));
        if (!candidate) {
          candidate = setCell(level, targetSector, { surface: "platform", object: "safebox" });
          boostCell = candidate;
          break;
        }
        if (
          (!candidate.object || candidate.object === "safebox" || candidate.object === "box") &&
          candidate.surface !== "rock" &&
          candidate.surface !== "hot" &&
          candidate.surface !== "lava"
        ) {
          boostCell = candidate;
          break;
        }
      }
      if (!boostCell) continue;
      boostCell.object = "safebox";
      boostCell.boostType = boostTypes[boostIndex % boostTypes.length];
      boostCell.collected = false;
      boostIndex += 1;
    }

    const planetMap = Array.isArray(CONFIG.planetMaps) && CONFIG.planetMaps.length
      ? CONFIG.planetMaps[Math.floor(rand() * CONFIG.planetMaps.length)]
      : "";

    return {
      seed,
      sectors,
      levels,
      stepY,
      cells,
      path,
      doors,
      planetMap
    };
  }

  function boot(root) {
    if (root.dataset.bcmTowerBooted === "1") return;
    root.dataset.bcmTowerBooted = "1";
    root.dataset.bcmTowerVersion = TOWER_VERSION;

    const canvas = root.querySelector(".bcm-tower-canvas");
    const menu = root.querySelector(".bcm-tower-menu");
    const modeButtons = [...root.querySelectorAll("[data-tower-mode]")];
    const status = root.querySelector(".bcm-tower-status");
    const levelEl = root.querySelector(".bcm-tower-level");
    const modeEl = root.querySelector(".bcm-tower-mode");
    const crewEl = root.querySelector(".bcm-tower-crew");
    const restartButton = root.querySelector(".bcm-tower-restart");
    const transition = root.querySelector(".bcm-tower-transition");
    const transitionVideo = root.querySelector(".bcm-tower-transition-video");
    const transitionClose = root.querySelector(".bcm-tower-transition-close");
    const mobile = root.querySelector(".bcm-tower-mobile");
    const divider = root.querySelector(".bcm-tower-split-divider");
    const p1Label = root.querySelector(".bcm-tower-split-p1");
    const p2Label = root.querySelector(".bcm-tower-split-p2");
    const inline = root.querySelector(".bcm-tower-inline-config");

    if (!canvas || !window.THREE) return;

    let doorTransitLayers = [0, 1].map((index) => {
      const layer = document.createElement("div");
      layer.className = "bcm-tower-door-transition bcm-tower-door-p" + (index + 1);
      layer.hidden = true;
      layer.innerHTML = '<div class="bcm-tower-door-transition-card"></div><div class="bcm-tower-door-transition-text">ПЕРЕХОД</div>';
      root.appendChild(layer);
      return layer;
    });

    let inlineConfig = {};
    try {
      inlineConfig = JSON.parse(inline?.textContent || "{}");
    } catch (e) {}

    function towerCrewDisplayName(crew) {
      const row = crew && typeof crew === "object" ? crew : {};
      const raw = row.raw && typeof row.raw === "object" ? row.raw : {};
      const validName = (candidate) => {
        const original = String(candidate || "").trim();
        if (!original) return "";
        const stripped = original.replace(/^crew(?:[\s_:#-]*(?:(?:#|no\.?|number)?[\s_:#-]*\d+))\s*(?:[-:|–—·]\s*)?/i, "").trim();
        if (stripped) return stripped;
        if (/^crew(?:[\s_:#-]*(?:(?:#|no\.?|number)?[\s_:#-]*\d+))?$/i.test(original)) return "";
        return original;
      };
      const attributes = [
        row.traits, row.attributes, raw.traits, raw.attributes,
        row.metadata?.attributes, row.content?.metadata?.attributes,
        row.metadata?.properties?.attributes, row.content?.metadata?.properties?.attributes,
        raw.metadata?.attributes, raw.content?.metadata?.attributes,
        raw.metadata?.properties?.attributes, raw.content?.metadata?.properties?.attributes
      ].filter(Array.isArray).flat();
      const nameTrait = attributes.find((item) => {
        const key = String(item?.trait || item?.trait_type || item?.traitType || item?.key || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
        return ["name", "crewname", "displayname", "personname"].includes(key);
      });
      const namedValue = nameTrait?.value ?? nameTrait?.Value ?? nameTrait?.val ?? "";
      const direct = [
        row.displayName, row.crewName, row.personName, row.name,
        raw.displayName, raw.crewName, raw.name, namedValue
      ].map(validName).find(Boolean);
      if (direct) return direct;
      const given = String(row.given || row.givenName || raw.given || "").trim();
      const family = String(row.family || row.familyName || raw.family || "").trim();
      const ustur = String(row.ustur || raw.ustur || "").trim();
      return validName(ustur ? [given, ustur].filter(Boolean).join(" ") : [given, family].filter(Boolean).join(" "))
        || "Без имени";
    }

    function syncCrewSelectionFromMiniSim() {
      const selected = window.BCMMiniCrewSelection?.players;
      if (!Array.isArray(selected) || selected.length < 2) return false;

      crewRoster = selected.slice(0, 2).map((crew, index) => ({
        id: String(crew.id || crew.mint || ("crew-" + index)),
        mint: String(crew.mint || ""),
        name: towerCrewDisplayName(crew),
        image: String(crew.image || ""),
        species: String(crew.species || crew.spec || ""),
        sex: String(crew.sex || ""),
        source: crew.source || "mini-sim",
        traits: Array.isArray(crew.traits) ? crew.traits : [],
        characteristics: crew.characteristics && typeof crew.characteristics === "object" ? crew.characteristics : {},
        raw: crew.raw && typeof crew.raw === "object" ? crew.raw : null,
        seats: String(crew.seats || ""),
        ocean: String(crew.ocean || ""),
        mission: String(crew.mission || "")
      }));

      for (let i = 0; i < 2; i++) {
        if (crewRoster[i]) crewSlots[i].crewId = crewRoster[i].id;
      }

      return true;
    }

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      powerPreference: "high-performance"
    });

    if (CONFIG.backgroundMenu) {
      root.style.setProperty(
        "--bcm-tower-background-image",
        'url("' + String(CONFIG.backgroundMenu).replace(/"/g, "\\\"") + '")'
      );
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.autoClear = false;

    if ("outputColorSpace" in renderer && THREE.SRGBColorSpace !== undefined) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    } else if ("outputEncoding" in renderer && THREE.sRGBEncoding !== undefined) {
      renderer.outputEncoding = THREE.sRGBEncoding;
    }

    const scene = new THREE.Scene();
    // Transparent WebGL clear lets the diagnostic CSS background remain visible
    // even when Tower geometry/textures fail.
    scene.background = null;
    scene.fog = new THREE.Fog(0x02050a, 70, 190);

    scene.add(new THREE.HemisphereLight(0xaad8ff, 0x061018, 1.25));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(5, 22, 12);
    scene.add(keyLight);

    let towerRoot = new THREE.Group();
    scene.add(towerRoot);

    let tower = null;
    let seed = null;
    let mode = null;
    let gameStarted = false;
    let transitionStarted = false;
    let towerAudio = null;
    let landingFirstFrameCallback = null;
    let landingHandoffPending = false;
    let landingFrameNotified = false;

    let wallMesh = null;
    let platformMeshes = [];
    let objectMeshes = [];
    let wallCapMeshes = [];
    let playerMarkers = [];
    let playerHalos = [];
    let playerSprites = [];
    let playerLegSprites = [];
    let playerJetEffects = [];
    let playerTextures = [null, null];
    // Mierese art uses the current facing; most other races need the reverse.
    let playerFacingFactors = [-1, -1];
    let playerMotion = [speciesMotion("Human", "Male"), speciesMotion("Human", "Male")];
    let birds = [];

    const radius = 8.4;
    // Tower gameplay is on the OUTSIDE skin of the cylinder. The player stays
    // on the circumference while the camera follows just outside it.
    const playerWallRadius = radius + 1.05;
    const cameraRadius = radius + 8.0;
    const gravity = 28;
    // One jump must reach the next 4-unit level. The second jump remains
    // slightly weaker so it extends the first jump without turning the game
    // into unrestricted vertical flight.
    const jumpVelocity = 15.0;
    const doubleJumpVelocity = 11.25;
    const fallResetSpeed = 23.0;
    const baseTurnSpeed = 2.2;
    const trimPower = 10.5;
    const sectorWidth = () => tower ? Math.PI * 2 / tower.sectors : Math.PI / 9;
    // Reduce platform width by about 3.5%; expanded foot-contact reach keeps adjacent landings forgiving.
    const platformWidth = 3.23;
    const footContactReach = 0.32;

    const controls = [
      { left: false, right: false, up: false, down: false, jump: false, interact: false, gamepad: false },
      { left: false, right: false, up: false, down: false, jump: false, interact: false, gamepad: false }
    ];

    const edgeState = [
      { jump: false, interact: false, restart: false, menuUp: false, menuDown: false, menuLeft: false, menuRight: false },
      { jump: false, interact: false, restart: false, menuUp: false, menuDown: false, menuLeft: false, menuRight: false }
    ];
    let towerMenuCursor = 0;
    let towerMenuNavAt = 0;
    const gamepadPresent = [false, false];

    const players = [
      {
        y: 0, vy: 0, angle: 0, radial: 0, jumps: 0, grounded: false,
        currentCell: null, liftRide: null, hazard: 0, slide: 0, finished: false,
        doorCooldown: 0, collected: 0, jumpStarted: false, fallStartY: null,
        maxFallSpeed: 0, birdHitCooldown: 0, visualFacing: 1, visualAngle: 0,
        shieldDownUntil: 0, shieldBlinkUntil: 0, knockUntil: 0, lavaGrace: 0,
        jetCharges: 0, springCharges: 0, jetFxUntil: 0, jetFxPower: 1
      },
      {
        y: 0, vy: 0, angle: 0, radial: 0, jumps: 0, grounded: false,
        currentCell: null, liftRide: null, hazard: 0, slide: 0, finished: false,
        doorCooldown: 0, collected: 0, jumpStarted: false, fallStartY: null,
        maxFallSpeed: 0, birdHitCooldown: 0, visualFacing: 1, visualAngle: 0,
        shieldDownUntil: 0, shieldBlinkUntil: 0, knockUntil: 0, lavaGrace: 0,
        jetCharges: 0, springCharges: 0, jetFxUntil: 0, jetFxPower: 1
      }
    ];

    const cameras = [
      new THREE.PerspectiveCamera(62, 1, 0.1, 260),
      new THREE.PerspectiveCamera(62, 1, 0.1, 260)
    ];

    // Normalized crew state shared by the game and future wallet/JSON loaders.
    // The first prototype keeps the requested default pair.
    let crewRoster = [
      { id: "default-crew-1", name: "Default Crew 1", source: "fallback" },
      { id: "default-crew-2", name: "Default Crew 2", source: "fallback" }
    ];
    const crewSlots = [
      { slot: 0, crewId: crewRoster[0].id, location: "ship", level: null },
      { slot: 1, crewId: crewRoster[1].id, location: "ship", level: null }
    ];
    const doorTransit = [null, null];

    function crewById(id) {
      return crewRoster.find((crew) => crew.id === id) || null;
    }

    function updateCrewMatrix() {
      crewSlots.forEach((slot, i) => {
        const p = players[i];
        if (!p || !gameStarted) {
          slot.location = "ship";
          slot.level = null;
          return;
        }
        slot.location = "tower";
        const bottomY = -((tower.levels - 1) * tower.stepY);
        slot.level = clamp(
          Math.round((p.y - bottomY) / tower.stepY),
          0,
          tower.levels - 1
        );
      });
    }

    function exposeCrewMatrix() {
      window.BCMTowerCrewMatrix = {
        mode,
        crew: crewSlots.map((slot) => ({
          slot: slot.slot,
          crewId: slot.crewId,
          crew: crewById(slot.crewId),
          location: slot.location,
          level: slot.level,
          finished: !!players[slot.slot]?.finished
        }))
      };
    }

    function safeDispose(obj) {
      if (!obj) return;
      if (obj.geometry?.dispose) obj.geometry.dispose();
      if (Array.isArray(obj.material)) {
        obj.material.forEach(m => m?.dispose?.());
      } else {
        obj.material?.dispose?.();
      }
    }

    function replaceTowerRoot() {
      towerRoot.traverse((obj) => {
        if (obj.isMesh) safeDispose(obj);
      });
      scene.remove(towerRoot);
      towerRoot = new THREE.Group();
      scene.add(towerRoot);
      wallMesh = null;
      wallCapMeshes = [];
      platformMeshes = [];
      objectMeshes = [];
    }

    function cellBaseY(cell) {
      return cell.level * tower.stepY - ((tower.levels - 1) * tower.stepY);
    }

    function cellWorldY(cell) {
      if (cell.runtimeY !== undefined) return cell.runtimeY;
      return cellBaseY(cell);
    }

    function cellWorldPosition(cell, extraRadius = 0) {
      const angle = (cell.sector / tower.sectors) * Math.PI * 2;
      const r = radius + extraRadius;
      return new THREE.Vector3(Math.sin(angle) * r, cellWorldY(cell), Math.cos(angle) * r);
    }

    function makeSurface(cell) {
      const p = cellWorldPosition(cell, 0.85);
      let geometry;
      let texUrl = "";
      let color = 0x8eb0c9;
      let height = 0.46;
      let depth = 1.9;
      let width = platformWidth;

      if (cell.surface === "rock") {
        geometry = new THREE.DodecahedronGeometry(1.0, 0);
        texUrl = pick(assetPool("rockPool"), mulberry32(seed ^ cell.level ^ cell.sector));
        color = 0x7d8790;
        height = 1.1;
      } else {
        geometry = new THREE.BoxGeometry(width, height, depth);
        if (cell.surface === "lava") {
          texUrl = pick(assetPool("lavaPool").concat(assetPool("platformLavaPool")), mulberry32(seed ^ 0x5511 ^ cell.level));
          color = 0xd63b27;
        } else if (cell.surface === "hot") {
          texUrl = pick(assetPool("platformLavaPool"), mulberry32(seed ^ 0x5522 ^ cell.level));
          color = 0xb54628;
        } else if (cell.surface === "ice") {
          texUrl = pick(assetPool("platformIcePool"), mulberry32(seed ^ 0x9922 ^ cell.level));
          color = 0x9ddcff;
        } else if (cell.surface === "lift") {
          texUrl = pick(assetPool("liftPool"), mulberry32(seed ^ 0x7744 ^ cell.sector));
          color = 0x9a8e75;
        } else if (cell.surface === "upper") {
          texUrl = pick(assetPool("upperPlatformPool"), mulberry32(seed ^ 0x3344 ^ cell.sector));
          color = 0xaaa078;
        } else {
          texUrl = pick(assetPool("platformPool"), mulberry32(seed ^ cell.level * 31 + cell.sector));
        }
      }

      const tex = assetTexture(texUrl, renderer, {
        removeWhite: rasterUrl(texUrl),
        repeat: cell.surface === "platform" || cell.surface === "ice" || cell.surface === "lava",
        repeatX: 1,
        repeatY: 1
      });

      const transparentSurface =
        cell.surface === "lift" ||
        /\\.png(?:[?#].*)?$/i.test(String(texUrl));
      const mesh = new THREE.Mesh(
        geometry,
        makeMaterial(tex, color, transparentSurface, transparentSurface ? 0.04 : 0)
      );
      mesh.position.copy(p);
      mesh.rotation.y = (cell.sector / tower.sectors) * Math.PI * 2;
      mesh.userData.cell = cell;
      mesh.userData.baseX = p.x;
      mesh.userData.baseZ = p.z;

      if (cell.surface === "rock") {
        mesh.scale.set(1.0, 0.72, 1.15);
      }

      if (cell.surface === "lift") {
        cell.motion = ["vertical", "radial", "orbit", "retract"][cell.sector % 4];
        cell.motionSpeed = 0.55 + ((cell.level + cell.sector) % 3) * 0.15;
        cell.motionAmp = 0.8 + ((cell.level + cell.sector) % 2) * 0.7;
        cell.carryPlayer = cell.motion !== "retract";
      }

      towerRoot.add(mesh);
      platformMeshes.push(mesh);
      return mesh;
    }

    function makeBoostCrateSideTexture(boostType) {
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      const color = boostType === "jet" ? "#59d8ee" : boostType === "shield" ? "#83e0a0" : "#ffbd69";
      ctx.fillStyle = "#152733";
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = "#263f4d";
      ctx.fillRect(10, 10, 236, 236);
      ctx.strokeStyle = "#607e8c";
      ctx.lineWidth = 7;
      ctx.strokeRect(13, 13, 230, 230);
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.strokeRect(28, 30, 200, 196);
      ctx.fillStyle = "#0a1822";
      ctx.fillRect(38, 78, 180, 96);
      ctx.fillStyle = color;
      ctx.font = "bold 31px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(boostType.toUpperCase(), 128, 126);
      ctx.fillStyle = "#9db7c2";
      for (let i = 0; i < 5; i += 1) ctx.fillRect(48 + i * 40, 191, 22, 5);
      const texture = new THREE.CanvasTexture(canvas);
      if (THREE.SRGBColorSpace !== undefined) texture.colorSpace = THREE.SRGBColorSpace;
      else if (THREE.sRGBEncoding !== undefined) texture.encoding = THREE.sRGBEncoding;
      return texture;
    }

    function makeBoostCrateLidTexture(boostType) {
      const canvas = document.createElement("canvas");
      canvas.width = 280;
      canvas.height = 200;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      const color = boostType === "jet" ? "#6de7ff" : boostType === "shield" ? "#8be7a8" : "#ffd080";
      const roundRect = (x, y, w, h, r) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.arcTo(x + w, y, x + w, y + r, r);
        ctx.lineTo(x + w, y + h - r);
        ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
        ctx.lineTo(x + r, y + h);
        ctx.arcTo(x, y + h, x, y + h - r, r);
        ctx.lineTo(x, y + r);
        ctx.arcTo(x, y, x + r, y, r);
        ctx.closePath();
      };
      ctx.fillStyle = "#132632";
      roundRect(8, 8, 264, 184, 16);
      ctx.fill();
      ctx.strokeStyle = "#839daa";
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      roundRect(22, 20, 236, 160, 12);
      ctx.stroke();
      ctx.fillStyle = "#0b1a24";
      roundRect(64, 62, 152, 76, 12);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.stroke();
      if (boostType === "jet") {
        // Twin nozzle/flame markings echo the requested JET crate lid.
        for (const x of [111, 169]) {
          ctx.fillStyle = "#a1c1cd";
          roundRect(x - 15, 28, 30, 42, 8);
          ctx.fill();
          ctx.strokeStyle = "#d4e5eb";
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.fillStyle = "#0b1c26";
          roundRect(x - 9, 34, 18, 22, 4);
          ctx.fill();
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.moveTo(x - 8, 71);
          ctx.lineTo(x, 94);
          ctx.lineTo(x + 8, 71);
          ctx.closePath();
          ctx.fill();
        }
      } else if (boostType === "shield") {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(140, 30);
        ctx.lineTo(170, 42);
        ctx.lineTo(165, 67);
        ctx.quadraticCurveTo(140, 91, 115, 67);
        ctx.lineTo(110, 42);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.strokeStyle = color;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(116, 32);
        ctx.lineTo(164, 43);
        ctx.lineTo(116, 54);
        ctx.lineTo(164, 65);
        ctx.lineTo(116, 76);
        ctx.stroke();
      }
      ctx.fillStyle = color;
      ctx.font = "bold 25px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(boostType.toUpperCase(), 140, 156);
      const texture = new THREE.CanvasTexture(canvas);
      if (THREE.SRGBColorSpace !== undefined) texture.colorSpace = THREE.SRGBColorSpace;
      else if (THREE.sRGBEncoding !== undefined) texture.encoding = THREE.sRGBEncoding;
      return texture;
    }

    function makeObject(cell) {
      if (!cell.object) return null;

      const objectRandom = mulberry32(seed ^ 0x6f41 ^ (cell.level * 97) ^ cell.sector);
      let url = "";
      let w = 1.9;
      let h = 2.2;

      const isBoxObject =
        cell.object === "safebox" ||
        cell.object === "box" ||
        cell.object === "dangerbox";

      if (cell.object === "landing") {
        url = pick(assetPool("landingPool"), objectRandom);
        w = 2.2; h = 2.2;
      } else if (isBoxObject) {
        url = pick(
          cell.object === "dangerbox"
            ? assetPool("dangerBoxPool")
            : assetPool("safeBoxPool").concat(assetPool("boxPool")),
          objectRandom
        );
        w = 1.6; h = 1.4;
      } else if (cell.object === "fire") {
        url = pick(assetPool("firePool"), objectRandom);
        w = 1.45; h = 1.75;
      } else if (cell.object === "door") {
        url = pick(assetPool("doorPool"), objectRandom);
        w = 2.0; h = 3.0;
      } else if (cell.object === "walldoor") {
        url = pick(assetPool("wallDoorPool"), objectRandom);
        w = 2.35; h = 3.25;
      } else if (cell.object === "npc") {
        url = pick(assetPool("npcPool"), objectRandom);
        w = 2.0; h = 2.7;
      }

      if (!url && !cell.boostType) return null;
      const keyedDark = cell.object === "door" || cell.object === "walldoor";
      const tex = url
        ? assetTexture(url, renderer, { removeWhite: true, removeBlack: keyedDark })
        : makeBoostCrateSideTexture(cell.boostType);
      if (!tex) return null;

      const sectorAngle = (cell.sector / tower.sectors) * Math.PI * 2;

      if (isBoxObject) {
        // Real 3D crate/container instead of a flat PNG card.
        const depth = 1.15;
        const radial = radius + depth * 0.5;
        const material = makeMaterial(tex, 0xffffff, true, 0.02);
        const lidTexture = cell.boostType ? makeBoostCrateLidTexture(cell.boostType) : null;
        const lidMaterial = lidTexture
          ? new THREE.MeshStandardMaterial({
              map: lidTexture,
              roughness: 0.66,
              metalness: 0.28,
              side: THREE.DoubleSide
            })
          : material;
        // BoxGeometry material order: +X, -X, +Y (lid), -Y, +Z, -Z.
        const materials = [material, material, lidMaterial, material, material, material];
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(w, h, depth),
          materials
        );
        mesh.position.set(
          Math.sin(sectorAngle) * radial,
          cellWorldY(cell) + h * 0.5,
          Math.cos(sectorAngle) * radial
        );
        mesh.rotation.y = sectorAngle;
        mesh.userData.cell = cell;
        mesh.userData.objectType = cell.object;
        mesh.userData.assetUrl = url;
        mesh.userData.liftBound = cell.surface === "lift";
        towerRoot.add(mesh);
        objectMeshes.push(mesh);
        return mesh;
      }

      const extraRadius =
        cell.object === "fire" ? 0.10 :
        cell.object === "walldoor" ? 0.30 :
        0.85;

      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshStandardMaterial({
          map: tex,
          transparent: true,
          alphaTest: 0.06,
          depthWrite: false,
          roughness: 0.92,
          metalness: 0.04,
          side: THREE.DoubleSide
        })
      );

      // Face each card outward from the cylindrical wall. Fire is deliberately
      // almost flush with the tower skin instead of floating in front of it.
      mesh.position.set(
        Math.sin(sectorAngle) * (radius + extraRadius),
        cellWorldY(cell) + h * 0.45,
        Math.cos(sectorAngle) * (radius + extraRadius)
      );
      mesh.rotation.y = sectorAngle;
      mesh.userData.cell = cell;
      mesh.userData.objectType = cell.object;
      mesh.userData.assetUrl = url;
      mesh.userData.liftBound = cell.surface === "lift";
      towerRoot.add(mesh);
      objectMeshes.push(mesh);
      return mesh;
    }

    function shieldActive(player) {
      return !player.shieldDownUntil || performance.now() >= player.shieldDownUntil;
    }

    function breakShield(player) {
      const now = performance.now();
      player.shieldDownUntil = now + 30000;
      player.shieldBlinkUntil = now + 480;
    }

    function buildBirds() {
      birds = [];
      const rand = mulberry32(seed ^ 0xB17D5EED);
      const count = 38;
      const colors = [0xe6d7a8, 0xf2f2f2, 0x8fd0ff, 0xffb0c8, 0xb7f0a8, 0xffd27a];

      for (let i = 0; i < count; i++) {
        const group = new THREE.Group();
        const tint = colors[i % colors.length];
        const bodyMat = new THREE.MeshStandardMaterial({
          color: tint,
          roughness: 0.55,
          metalness: 0.08,
          emissive: 0x221c10
        });
        const beakMat = new THREE.MeshBasicMaterial({ color: 0xd7b35a });

        const body = new THREE.Mesh(
          new THREE.SphereGeometry(0.28, 7, 5),
          bodyMat
        );
        body.scale.set(1.35, 0.48, 0.78);
        group.add(body);

        const head = new THREE.Mesh(
          new THREE.SphereGeometry(0.19, 7, 5),
          bodyMat
        );
        head.position.set(0, 0.08, -0.23);
        group.add(head);

        const beak = new THREE.Mesh(
          new THREE.ConeGeometry(0.07, 0.22, 5),
          beakMat
        );
        beak.rotation.x = Math.PI / 2;
        beak.position.set(0, 0.05, -0.42);
        group.add(beak);

        const wingGeo = new THREE.BoxGeometry(0.95, 0.05, 0.28);
        const leftWing = new THREE.Mesh(wingGeo, bodyMat);
        const rightWing = new THREE.Mesh(wingGeo, bodyMat);
        leftWing.position.set(-0.34, 0.02, 0);
        rightWing.position.set(0.34, 0.02, 0);
        group.add(leftWing, rightWing);

        const centerAngle = rand() * Math.PI * 2;
        const playableLevels = Math.max(2, (tower && tower.levels) || 40);
        const level = 1 + Math.floor(rand() * (playableLevels - 1));
        const levelY = level * (tower ? tower.stepY : 4) - ((playableLevels - 1) * (tower ? tower.stepY : 4));
        const state = {
          group,
          leftWing,
          rightWing,
          angle: centerAngle,
          baseY: levelY + 1.15,
          radius: playerWallRadius,
          speed: (i === 0 ? 0.33 : 1) * (i % 3 === 0 ? -1 : 1) * (0.78 + rand() * 0.9),
          phase: rand() * Math.PI * 2,
          flap: 7.5 + rand() * 3.5,
          dir: i % 3 === 0 ? -1 : 1,
          homeY: levelY + 1.15,
          aimed: i === 0
        };

        group.userData.bird = true;
        if (i === 0) group.scale.setScalar(1.18);
        towerRoot.add(group);
        birds.push(state);
      }
    }

    let nextBirdPassAt = 0;

    function updateBirds(time) {
      if (!birds.length) return;
      const t = time * 0.001;
      const now = performance.now();

      for (let i = 0; i < players.length; i++) {
        const p = players[i];
        p.birdHitCooldown = Math.max(0, (p.birdHitCooldown || 0) - 0.016);
      }

      const alive = players.filter((candidate) => !candidate.finished);
      if (!nextBirdPassAt) nextBirdPassAt = now + 8000;
      const passer = birds.find((bird) => bird.passing);
      if (!passer && alive.length && now >= nextBirdPassAt) {
        const choice = birds.find((bird) => !bird.aimed && !bird.passing) || null;
        if (choice) {
          choice.passing = true;
          choice.passUntil = now + 3600;
          choice.passTarget = alive[Math.floor(now / 8000) % alive.length];
        }
      }

      for (const bird of birds) {
        let a = bird.angle + t * bird.speed;
        if (bird.aimed && alive.length) {
          if (!bird.aimSwitchAt || now >= bird.aimSwitchAt) {
            bird.aimIndex = ((bird.aimIndex || 0) + 1) % alive.length;
            bird.aimSwitchAt = now + 6500;
          }
          const target = alive[(bird.aimIndex || 0) % alive.length];
          bird.baseY += ((target.y + 0.9) - bird.baseY) * 0.035;
          a = bird.angle + t * bird.speed;
        } else if (bird.passing && bird.passTarget && !bird.passTarget.finished) {
          bird.baseY += ((bird.passTarget.y + 0.85) - bird.baseY) * 0.18;
          if (now >= bird.passUntil) {
            bird.passing = false;
            nextBirdPassAt = now + 8000;
          }
        } else {
          bird.baseY += ((bird.homeY || bird.baseY) - bird.baseY) * 0.06;
        }
        const y = bird.baseY + Math.sin(t * 1.4 + bird.phase) * 0.22;
        const r = bird.radius;

        bird.group.position.set(
          Math.sin(a) * r,
          y,
          Math.cos(a) * r
        );
        bird.group.rotation.y = a + (bird.dir < 0 ? 0 : Math.PI);
        const flap = Math.sin(t * bird.flap + bird.phase) * 0.72;
        bird.leftWing.rotation.z = flap;
        bird.rightWing.rotation.z = -flap;

        for (let i = 0; i < players.length; i++) {
          const p = players[i];
          if (p.finished || p.birdHitCooldown > 0) continue;
          if (Math.abs(angleDelta(p.angle, a)) > 0.38) continue;
          if (Math.abs((p.y + 0.45) - y) > 1.25) continue;

          p.birdHitCooldown = 0.7;
          if (shieldActive(p)) {
            breakShield(p);
            status.textContent = "ЩИТ ПРИНЯЛ ПТИЦУ · ВОССТАНОВЛЕНИЕ 30 С";
            continue;
          }

          // Drop far enough that the same platform cannot catch the player
          // on the next physics step. Tower Toppler knocks downward, it does
          // not send the player back to the roof.
          p.knockUntil = now + 520;
          p.grounded = false;
          p.liftRide = null;
          p.currentCell = null;
          p.jumps = 1;
          p.jumpStarted = false;
          p.fallStartY = p.y;
          p.y -= 0.9;
          p.vy = -5.2;
          p.angle += bird.dir * sectorWidth() * 0.28;
          status.textContent = "ПТИЦА СБРОСИЛА ИГРОКА " + (i + 1);
        }
      }
    }

    function buildTower(nextSeed) {
      seed = nextSeed >>> 0;
      tower = generateTower(seed);
      // Keep the exact geometry seed in the session so a future city exit can
      // rebuild this same tower rather than silently creating a new route.
      if (window.BCMWorldMission) {
        window.BCMWorldMission.towerSeed = seed;
        if (window.BCMWorldMission.originShipSnapshot &&
            window.BCMWorldMission.originShipSnapshot.sessionSeed === window.BCMWorldMission.sessionSeed) {
          window.BCMWorldMission.originShipSnapshot.towerSeed = seed;
        }
      }
      replaceTowerRoot();

      const wallUrl = pick(assetPool("towerWallJpgPool"), mulberry32(seed ^ 0x7891));
      const wallTex = assetTexture(wallUrl, renderer, {
        repeat: true,
        repeatX: 6,
        repeatY: Math.max(5, towerHeight() / 10)
      });

      wallMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius, towerHeight(), 48, 1, true),
        new THREE.MeshStandardMaterial({
          map: wallTex || null,
          color: wallTex ? 0xffffff : 0x29445c,
          roughness: 0.92,
          metalness: 0.08,
          side: THREE.DoubleSide
        })
      );
      // Levels run from roughly Y=0 down to -180. Center the shell over the
      // complete playable shaft instead of leaving its lower half outside it.
      const towerBottomY = -((tower.levels - 1) * tower.stepY);
      const towerTopY = 6;
      wallMesh.position.y = (towerBottomY + towerTopY) * 0.5;
      towerRoot.add(wallMesh);

      // H1 is the original Tower top/bottom cylinder texture. Keep its
      // existing door/landing use, but also use the same artwork to close the
      // actual top and bottom of the cylindrical shaft.
      const h1Url = assetPool("landingPool").find((url) => /(?:^|\/)H1\.png(?:[?#].*)?$/i.test(String(url || "")))
        || assetPool("landingPool").find((url) => /(?:^|\/)H1/i.test(String(url || "")))
        || "";
      if (h1Url) {
        const h1Tex = assetTexture(h1Url, renderer, { removeWhite: true });
        if (h1Tex) {
          const capMaterial = new THREE.MeshStandardMaterial({
            map: h1Tex,
            transparent: h1Tex.format === THREE.RGBAFormat,
            alphaTest: 0.02,
            roughness: 0.92,
            metalness: 0.05,
            side: THREE.DoubleSide
          });

          const topCap = new THREE.Mesh(
            new THREE.CircleGeometry(radius, 48),
            capMaterial
          );
          topCap.rotation.x = -Math.PI / 2;
          // Lift the H1 cap just above the open cylinder rim so it is not z-fighting/recessed.
          topCap.position.y = towerTopY + 0.2;
          topCap.userData.towerCap = "top";
          towerRoot.add(topCap);
          wallCapMeshes.push(topCap);

          const bottomCap = new THREE.Mesh(
            new THREE.CircleGeometry(radius, 48),
            capMaterial.clone()
          );
          bottomCap.rotation.x = Math.PI / 2;
          bottomCap.position.y = towerBottomY;
          bottomCap.userData.towerCap = "bottom";
          towerRoot.add(bottomCap);
          wallCapMeshes.push(bottomCap);
        }
      }

      for (const cell of tower.cells.values()) {
        makeSurface(cell);
        makeObject(cell);
      }

      buildBirds();

      playerTextures = [null, null];
      syncCrewSelectionFromMiniSim();

      // The embedded mini-sim supplies the two selected Crew before Tower starts.
      // Direct Tower pages retain a small visual fallback.
      const fallbackCrewImage = inlineConfig.crewImage
        ? String(inlineConfig.crewImage)
        : "";

      let fallbackPlayerTexture = null;
      if (fallbackCrewImage) {
        fallbackPlayerTexture = assetTexture(fallbackCrewImage, renderer, {});
      } else {
        const canvas2d = document.createElement("canvas");
        canvas2d.width = 128;
        canvas2d.height = 128;
        const ctx = canvas2d.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, 128, 128);
          ctx.fillStyle = "#202833";
          ctx.beginPath();
          ctx.arc(64, 32, 18, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#73d6ff";
          ctx.fillRect(42, 51, 44, 42);
          ctx.fillStyle = "#202833";
          ctx.fillRect(44, 91, 14, 25);
          ctx.fillRect(70, 91, 14, 25);
          ctx.fillStyle = "#ffe6c7";
          ctx.beginPath();
          ctx.arc(58, 28, 3, 0, Math.PI * 2);
          ctx.arc(70, 28, 3, 0, Math.PI * 2);
          ctx.fill();
          fallbackPlayerTexture = new THREE.CanvasTexture(canvas2d);
          if ("colorSpace" in fallbackPlayerTexture && THREE.SRGBColorSpace !== undefined) {
            fallbackPlayerTexture.colorSpace = THREE.SRGBColorSpace;
          } else if (THREE.sRGBEncoding !== undefined) {
            fallbackPlayerTexture.encoding = THREE.sRGBEncoding;
          }
          fallbackPlayerTexture.needsUpdate = true;
        }
      }

      for (let i = 0; i < 2; i++) {
        const selectedCrew = crewById(crewSlots[i].crewId);
        const traitSpecies = Array.isArray(selectedCrew?.traits)
          ? selectedCrew.traits.find((item) => /^(species|race)$/i.test(String(item?.trait || item?.trait_type || "")))?.value
          : "";
        const species = String(selectedCrew?.species || selectedCrew?.spec || traitSpecies || "");
        const sex = String(selectedCrew?.sex || "");
        playerFacingFactors[i] = window.BCMCrewCore && window.BCMCrewCore.facingFactor
          ? window.BCMCrewCore.facingFactor(species)
          : (String(species).toLowerCase().includes("mierese") ? 1 : -1);
        playerMotion[i] = speciesMotion(species, sex);
        const imageUrl = selectedCrew?.image || "";
        const officialUrl = officialCrewCutoutUrl(imageUrl);
        playerTextures[i] = imageUrl
          ? assetTexture(officialUrl || imageUrl, renderer, officialUrl
            ? { officialAlpha: true, fallbackUrl: officialUrl === imageUrl ? "" : imageUrl, cutout: true }
            : { cutout: true })
          : fallbackPlayerTexture;
      }

      while (playerMarkers.length) {
        const oldMarker = playerMarkers.pop();
        scene.remove(oldMarker);
        safeDispose(oldMarker);
      }
      while (playerHalos.length) {
        const oldHalo = playerHalos.pop();
        scene.remove(oldHalo);
        safeDispose(oldHalo);
      }
      while (playerLegSprites.length) {
        const oldLeg = playerLegSprites.pop();
        if (oldLeg) {
          scene.remove(oldLeg);
          safeDispose(oldLeg);
        }
      }
      while (playerSprites.length) {
        const old = playerSprites.pop();
        if (old) {
          scene.remove(old);
          safeDispose(old);
        }
      }
      while (playerJetEffects.length) {
        const oldJet = playerJetEffects.pop();
        if (oldJet) {
          scene.remove(oldJet);
          safeDispose(oldJet);
        }
      }

      for (let i = 0; i < 2; i++) {
        const haloTexture = makePlayerHaloTexture(i === 0 ? 0x74d7ff : 0xffbf6d);
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({
          map: haloTexture,
          transparent: true,
          opacity: 0.98,
          depthWrite: false,
          depthTest: true,
          sizeAttenuation: true
        }));
        halo.center.set(0.5, 0.5);
        halo.scale.set(1.72, 2.42, 1);
        halo.renderOrder = 2;
        halo.visible = !!playerTextures[i];
        scene.add(halo);
        playerHalos.push(halo);

        const marker = new THREE.Mesh(
          new THREE.SphereGeometry(0.48, 10, 8),
          new THREE.MeshStandardMaterial({
            color: i === 0 ? 0x74d7ff : 0xffbf6d,
            emissive: i === 0 ? 0x103a55 : 0x50310d,
            roughness: 0.7,
            metalness: 0.18
          })
        );
        marker.visible = !playerTextures[i];
        scene.add(marker);
        playerMarkers.push(marker);
        if (playerTextures[i]) {
          const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: playerTextures[i],
            transparent: true,
            depthWrite: false,
            sizeAttenuation: true
          }));
          sprite.visible = !playerTextures[i].userData?.bcmCutoutPending;
          sprite.scale.set(1.45, 2.05, 1);
          sprite.renderOrder = 3;
          scene.add(sprite);
          playerSprites.push(sprite);
          const legs = new THREE.Sprite(new THREE.SpriteMaterial({
            transparent: true,
            depthWrite: false,
            sizeAttenuation: true
          }));
          legs.visible = false;
          legs.center.set(0.5, 1);
          legs.renderOrder = 4;
          scene.add(legs);
          playerLegSprites.push(legs);
        } else {
          playerSprites.push(null);
          playerLegSprites.push(null);
        }

        const jetTexture = makeJetFlameTexture(i === 0 ? "#6de7ff" : "#ffd080");
        const jetFx = new THREE.Sprite(new THREE.SpriteMaterial({
          map: jetTexture,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          depthTest: true,
          sizeAttenuation: true
        }));
        jetFx.center.set(0.5, 0.5);
        jetFx.scale.set(0.58, 0.86, 1);
        jetFx.renderOrder = 5;
        jetFx.visible = false;
        scene.add(jetFx);
        playerJetEffects.push(jetFx);
      }

      for (let i = 0; i < 2; i++) {
        resetPlayer(i, i === 0 ? 0 : 0.85);
        doorTransit[i] = null;
        if (doorTransitLayers[i]) doorTransitLayers[i].hidden = true;
      }
      updateCrewMatrix();
      exposeCrewMatrix();
      status.textContent = "TOWER v" + TOWER_VERSION + " READY";
      restartButton.hidden = true;
    }

    function towerHeight() {
      return tower ? ((tower.levels - 1) * tower.stepY + 12) : 196;
    }

    function resetPlayer(index, angleOffset) {
      const p = players[index];
      const topSector = tower.path[0];
      const cell = tower.cells.get((tower.levels - 1) + ":" + topSector);
      const startY = cell ? cellWorldY(cell) + 0.9 : 0;
      p.y = startY;
      p.vy = 0;
      p.angle = topSector * sectorWidth() + angleOffset;
      p.radial = playerWallRadius;
      p.jumps = 0;
      p.grounded = true;
      p.currentCell = cell || null;
      p.liftRide = null;
      p.hazard = 0;
      p.slide = 0;
      p.finished = false;
      p.doorCooldown = 0;
      p.jumpStarted = false;
      p.fallStartY = null;
      p.maxFallSpeed = 0;
      p.birdHitCooldown = 0;
      p.knockUntil = 0;
      p.lavaGrace = 0;
      p.jetCharges = 0;
      p.springCharges = 0;
      p.jetFxUntil = 0;
      p.jetFxPower = 1;
      p.visualFacing = 1;
      p.visualAngle = p.angle;
    }

    function surfaceCandidates(player) {
      const approximate = Math.round(
        (player.y + ((tower.levels - 1) * tower.stepY)) / tower.stepY
      );
      const candidates = [];

      for (let level = approximate - 2; level <= approximate + 2; level++) {
        if (level < 0 || level >= tower.levels) continue;

        const centerSector = wrapSector(
          Math.round(player.angle / sectorWidth()),
          tower.sectors
        );

        for (let d = -2; d <= 2; d++) {
          const sector = wrapSector(centerSector + d, tower.sectors);
          const cell = tower.cells.get(level + ":" + sector);
          if (!cell) continue;

          const mesh = platformMeshes.find(m => m.userData.cell === cell);
          const meshX = mesh ? mesh.position.x : Math.sin(sector * sectorWidth()) * (radius + 1.2);
          const meshZ = mesh ? mesh.position.z : Math.cos(sector * sectorWidth()) * (radius + 1.2);
          const surfaceAngle = Math.atan2(meshX, meshZ);
          const surfaceRadius = Math.hypot(meshX, meshZ);

          // A retracting platform is not a floor once it has gone through the
          // cylinder wall. It may visually enter the tower, but the player
          // cannot follow it through the solid shell.
          if (
            cell.surface === "lift" &&
            cell.motion === "retract" &&
            surfaceRadius + 0.65 < playerWallRadius - 0.08
          ) {
            continue;
          }

          const da = Math.abs(angleDelta(player.angle, surfaceAngle));
          const platformHalfWidth = cell.surface === "rock" ? 1.05 : platformWidth / 2;
          const angularReach = Math.atan2(platformHalfWidth + footContactReach, Math.max(1, surfaceRadius));
          if (da > angularReach) continue;

          const targetRadial = surfaceRadius + 0.65;
          if (Math.abs(player.radial - targetRadial) > 0.88) continue;

          const y = mesh ? mesh.position.y : cellWorldY(cell);
          const dy = player.y - (y + 0.72);
          candidates.push({
            cell,
            y,
            dy,
            da,
            angle: surfaceAngle,
            radial: targetRadial
          });
        }
      }

      candidates.sort((a, b) => Math.abs(a.dy) - Math.abs(b.dy));
      return candidates;
    }

    function findLanding(player) {
      if (player.knockUntil && performance.now() < player.knockUntil) return null;
      const candidates = surfaceCandidates(player);
      for (const candidate of candidates) {
        if (player.vy > 0) continue;
        if (candidate.dy <= 1.15 && candidate.dy >= -1.2) return candidate;
      }
      return null;
    }

    function triggerDoubleJump(player) {
      const powered = Number(player.jetCharges || 0) > 0;
      if (powered) player.jetCharges -= 1;
      player.vy = doubleJumpVelocity * (powered ? 1.42 : 1);
      player.jetFxUntil = performance.now() + (powered ? 650 : 390);
      player.jetFxPower = powered ? 1.32 : 1;
    }

    function doJump(index) {
      const p = players[index];
      if (p.finished || doorTransit[index]) return;

      if (p.grounded) {
        const springBoosted = Number(p.springCharges || 0) > 0;
        if (springBoosted) p.springCharges -= 1;
        p.vy = jumpVelocity * (springBoosted ? 1.27 : 1);
        if (springBoosted) status.textContent = "SPRING BOOST · УСИЛЕННЫЙ ПРЫЖОК";
        p.grounded = false;
        p.jumps = 1;
        p.jumpStarted = true;
        p.fallStartY = null;
        p.maxFallSpeed = 0;
        return;
      }

      // A genuine double-jump exists only after a real first jump from a
      // platform. Walking/falling off a platform counts as the first jump,
      // so that state gets at most one emergency air jump.
      if (p.jumpStarted && p.jumps === 1) {
        triggerDoubleJump(p);
        p.jumps = 2;
        p.jumpStarted = false;
        return;
      }

      if (!p.jumpStarted && p.jumps === 1) {
        triggerDoubleJump(p);
        p.jumps = 2;
      }
    }

    function resetAfterHazard(index, message) {
      resetPlayer(index, index === 0 ? 0 : 0.85);
      status.textContent = message;
    }

    function collectObject(cell, objectMesh, player, index) {
      if (!cell || cell.collected) return false;
      cell.collected = true;
      if (objectMesh) objectMesh.visible = false;

      if (player && cell.boostType) {
        if (cell.boostType === "jet") {
          player.jetCharges = Math.min(2, Number(player.jetCharges || 0) + 1);
          status.textContent = "JET BOOST · УСИЛЕННЫЙ ВТОРОЙ ПРЫЖОК" + (index === 1 ? " · P2" : " · P1");
        } else if (cell.boostType === "shield") {
          player.shieldDownUntil = 0;
          player.shieldBlinkUntil = performance.now() + 1800;
          status.textContent = "SHIELD BOOST · ЗАЩИТА ВОССТАНОВЛЕНА" + (index === 1 ? " · P2" : " · P1");
        } else if (cell.boostType === "spring") {
          player.springCharges = Math.min(2, Number(player.springCharges || 0) + 1);
          status.textContent = "SPRING BOOST · СЛЕДУЮЩИЙ ПРЫЖОК УСИЛЕН" + (index === 1 ? " · P2" : " · P1");
        }
      }
      return true;
    }

    function findObjectMesh(cell) {
      return objectMeshes.find(m => m.userData.cell === cell && m.visible !== false) || null;
    }

    function interact(index) {
      const p = players[index];
      if (!p.currentCell || p.doorCooldown > 0) return;
      const cell = p.currentCell;

      if (cell.object === "door" && cell.doorPair) {
        if (doorTransit[index]) return;
        const destination = cell.doorPair;
        const doorMesh = findObjectMesh(cell);
        const layer = doorTransitLayers[index];
        const imageUrl = doorMesh?.userData?.assetUrl || "";

        clearControls(index);
        doorTransit[index] = {
          destination,
          until: performance.now() + 1500
        };
        p.doorCooldown = 1.65;
        p.grounded = false;
        p.liftRide = null;
        p.currentCell = null;
        p.vy = 0;

        if (layer) {
          const card = layer.querySelector(".bcm-tower-door-transition-card");
          if (card) card.style.backgroundImage = imageUrl ? 'url("' + imageUrl.replace(/"/g, "\"") + '")' : "none";
          layer.hidden = false;
        }
        status.textContent = "ДВЕРЬ: ПРОХОД СКВОЗЬ ВЫШКУ · 1.5 s";
        return;
      }

      if (cell.object === "safebox" || cell.object === "box") {
        const collectedNow = collectObject(cell, findObjectMesh(cell), p, index);
        if (collectedNow) {
          p.collected += 1;
          if (!cell.boostType) status.textContent = "ЯЩИК ОТКРЫТ";
        }
      }

      if (cell.object === "dangerbox") {
        resetAfterHazard(index, "ОПАСНЫЙ ЯЩИК: СПУСК ПЕРЕЗАПУЩЕН");
      }
    }

    function updateLiftMotion(time) {
      for (const cell of tower.cells.values()) {
        if (cell.surface !== "lift") continue;
        const mesh = platformMeshes.find(m => m.userData.cell === cell);
        if (!mesh) continue;

        const t = time * 0.001 * cell.motionSpeed + cell.phase;
        const base = cellBaseY(cell);

        if (cell.motion === "vertical") {
          cell.runtimeY = base + Math.sin(t) * cell.motionAmp;
          mesh.position.y = cell.runtimeY;
        } else if (cell.motion === "radial") {
          cell.runtimeY = base + Math.sin(t * 0.9) * 0.35;
          const r = radius + 0.4 + Math.sin(t) * cell.motionAmp;
          const a = cell.sector * sectorWidth();
          mesh.position.x = Math.sin(a) * r;
          mesh.position.z = Math.cos(a) * r;
          mesh.position.y = cell.runtimeY;
        } else if (cell.motion === "orbit") {
          cell.runtimeY = base + Math.sin(t) * 0.4;
          const a = cell.sector * sectorWidth() + Math.sin(t) * 0.22;
          const r = radius + 0.4;
          mesh.position.x = Math.sin(a) * r;
          mesh.position.z = Math.cos(a) * r;
          mesh.position.y = cell.runtimeY;
        } else {
          // Retracting lift: starts inside the tower and periodically extends
          // through the cylindrical wall. Once it retracts beyond the player's
          // radial reach, the player loses the surface and falls.
          cell.runtimeY = base + Math.sin(t * 0.9) * 0.25;
          const travel = 4.8;
          const r = radius - 2.0 + (Math.sin(t) + 1) * 0.5 * travel;
          const a = cell.sector * sectorWidth();
          mesh.position.x = Math.sin(a) * r;
          mesh.position.z = Math.cos(a) * r;
          mesh.position.y = cell.runtimeY;
        }

        // Objects sitting on a lift belong to that lift's moving layer too.
        // This keeps box*/dangerbox* aligned with a retracting platform instead
        // of leaving the object suspended in world space.
        const liftR = Math.hypot(mesh.position.x, mesh.position.z);
        const liftA = Math.atan2(mesh.position.x, mesh.position.z);
        objectMeshes.forEach((objectMesh) => {
          const objectCell = objectMesh.userData.cell;
          if (!objectCell || objectCell.surface !== "lift" || !objectMesh.userData.liftBound) return;
          if (objectCell !== cell) return;
          const objectType = objectMesh.userData.objectType;
          const radialOffset = objectType === "dangerbox" || objectType === "safebox" || objectType === "box"
            ? 0.55
            : 0.35;
          objectMesh.position.set(
            Math.sin(liftA) * (liftR + radialOffset),
            mesh.position.y + ((objectMesh.geometry.parameters?.height || 1.4) * 0.5),
            Math.cos(liftA) * (liftR + radialOffset)
          );
          objectMesh.rotation.y = liftA;
        });
      }
    }

    function syncLiftRide(p) {
      if (
        !p.grounded ||
        p.currentCell?.surface !== "lift" ||
        p.currentCell.motion === "retract" ||
        p.currentCell.carryPlayer === false
      ) {
        p.liftRide = null;
        return;
      }

      const mesh = platformMeshes.find(m => m.userData.cell === p.currentCell);
      if (!mesh) {
        p.liftRide = null;
        return;
      }

      const state = {
        cell: p.currentCell,
        y: mesh.position.y,
        radial: Math.hypot(mesh.position.x, mesh.position.z) + 0.65,
        angle: Math.atan2(mesh.position.x, mesh.position.z)
      };

      if (p.liftRide && p.liftRide.cell === state.cell) {
        p.y += state.y - p.liftRide.y;
        p.radial += state.radial - p.liftRide.radial;
        p.angle += angleDelta(state.angle, p.liftRide.angle);
      } else {
        p.radial = state.radial;
        p.angle = state.angle;
      }

      p.liftRide = state;
    }

    function updatePlayer(index, dt) {
      const p = players[index];
      const c = controls[index];

      if (doorTransit[index]) {
        if (performance.now() < doorTransit[index].until) return;
        const destination = doorTransit[index].destination;
        doorTransit[index] = null;
        if (doorTransitLayers[index]) doorTransitLayers[index].hidden = true;

        p.y = cellWorldY(destination) + 0.9;
        p.vy = 0;
        p.grounded = true;
        p.jumps = 0;
        p.jumpStarted = false;
        p.fallStartY = null;
        p.currentCell = destination;
        p.radial = playerWallRadius;
        p.angle = destination.sector * sectorWidth();
        status.textContent = "ДВЕРЬ: ВЫХОД НА ПРОТИВОПОЛОЖНОЙ СТОРОНЕ";
        return;
      }

      if (p.finished) return;

      syncLiftRide(p);

      // The tower cylinder is a hard radial wall, exactly like Room 1's
      // corridor walls. A moving platform can never pull the player through it.
      if (p.radial < playerWallRadius) {
        p.radial = playerWallRadius;
        p.liftRide = null;
      }

      p.doorCooldown = Math.max(0, p.doorCooldown - dt);
      if (p.grounded) p.maxFallSpeed = 0;
      p.vy -= gravity * dt;

      let turn = (c.right ? 1 : 0) - (c.left ? 1 : 0);
      if (index === 0) {
        const tiltTurn = towerTiltTurn();
        if (Math.abs(tiltTurn) > Math.abs(turn)) turn = tiltTurn;
      }
      let trim = (c.up ? 1 : 0) - (c.down ? 1 : 0);
      // Keep gamepad response unchanged; keyboard and touch are less twitchy.
      const manualInputScale = c.gamepad ? 1 : 0.84;
      turn *= manualInputScale;
      trim *= manualInputScale;

      const onIce = p.currentCell?.surface === "ice" || p.currentCell?.liftHazard === "ice";
      const onHot = p.currentCell?.surface === "hot" || p.currentCell?.liftHazard === "hot";
      const onLava = p.currentCell?.surface === "lava" || p.currentCell?.liftHazard === "lava";
      const turnSpeed = baseTurnSpeed * (onIce ? 1.52 : 1);

      if (onIce) {
        if (turn !== 0) p.slide = clamp(p.slide + turn * dt * 2.4, -1.8, 1.8);
        else p.slide *= Math.max(0, 1 - dt * 0.35);
        turn += p.slide * 0.55;
      } else {
        p.slide *= Math.max(0, 1 - dt * 7);
      }

      p.angle += turn * turnSpeed * dt;
      p.vy += trim * trimPower * dt;
      if (!p.grounded && p.vy < 0) {
        p.maxFallSpeed = Math.max(p.maxFallSpeed, -p.vy);
      }
      p.y += p.vy * dt;

      const bottomY = -((tower.levels - 1) * tower.stepY);
      if (p.y < bottomY - 4.2) {
        p.finished = true;
        p.vy = 0;
        p.grounded = false;
        status.textContent = mode === "multi" ? "ИГРОК ДОШЁЛ ДО ОСНОВАНИЯ" : "СПУСК ЗАВЕРШЁН";
        showEndLevelMarker();
        return;
      }

      const wasGrounded = p.grounded;
      const previousCell = p.currentCell;
      const landing = findLanding(p);

      if (landing) {
        p.y = landing.y + 0.72;
        p.vy = 0;
        p.grounded = true;
        p.jumps = 0;
        p.currentCell = landing.cell;

        // Keep the player's own angular position. Landing no longer snaps the
        // character to the visual center of the platform.
        p.radial = Math.max(playerWallRadius, p.radial);
        if (Math.abs(p.radial - landing.radial) > 1.0) {
          p.radial = landing.radial;
        }

        if (!wasGrounded && p.fallStartY !== null) {
          const fallenLevels = Math.floor(
            Math.max(0, p.fallStartY - landing.y) / tower.stepY
          );
          const impactSpeed = Math.max(0, p.maxFallSpeed);
          p.fallStartY = null;
          p.maxFallSpeed = 0;
          if (fallenLevels >= 5 || impactSpeed >= fallResetSpeed) {
            resetAfterHazard(
              index,
              impactSpeed >= fallResetSpeed
                ? "СИЛЬНОЕ ПАДЕНИЕ: СКОРОСТЬ УДАРА " + impactSpeed.toFixed(1)
                : "ПАДЕНИЕ БОЛЕЕ 5 УРОВНЕЙ: ВОЗВРАТ В НАЧАЛО"
            );
            return;
          }
        }

        p.jumpStarted = false;

        if (landing.cell.object === "dangerbox") {
          resetAfterHazard(index, "DANGERBOX: ВОЗВРАТ В НАЧАЛО");
          return;
        }

        if (landing.cell.surface === "lift") {
          if (!wasGrounded || previousCell !== landing.cell || !p.liftRide) {
            p.liftRide = {
              cell: landing.cell,
              y: landing.y,
              radial: landing.radial,
              angle: landing.angle
            };
          } else {
            // Keep the lift's previous frame as the motion reference. The
            // player may rotate independently on the lift surface.
            p.liftRide.cell = landing.cell;
            p.liftRide.y = landing.y;
            p.liftRide.radial = landing.radial;
          }
        } else {
          p.liftRide = null;
        }
      } else {
        if (wasGrounded) {
          p.jumps = 1;
          p.jumpStarted = false;
          p.fallStartY = p.y;
          p.maxFallSpeed = 0;
        }
        p.grounded = false;
        p.liftRide = null;
      }

      if (!p.grounded) {
        if (p.fallStartY !== null) {
          const fallenNow = Math.floor(
            Math.max(0, p.fallStartY - p.y) / tower.stepY
          );
          if (fallenNow >= 5) {
            resetAfterHazard(index, "ПАДЕНИЕ БОЛЕЕ 5 УРОВНЕЙ: ВОЗВРАТ В НАЧАЛО");
          }
        }
        return;
      }

      const surface = p.currentCell?.surface;
      if (onLava) {
        if (shieldActive(p)) {
          breakShield(p);
          p.lavaGrace = 1;
          status.textContent = "ЩИТ СГОРЕЛ НА ЛАВЕ · 1 СЕК УЙТИ";
          return;
        }
        p.lavaGrace = (p.lavaGrace || 0) - dt;
        if (p.lavaGrace <= 0) {
          resetAfterHazard(index, "ЛАВА: ОПАСНАЯ ЗОНА");
          return;
        }
        return;
      }
      p.lavaGrace = 0;
      if (onHot) {
        p.hazard += dt;
        if (p.hazard > 1.15) {
          resetAfterHazard(index, "ГОРЯЧАЯ ПЛАТФОРМА: НЕЛЬЗЯ ЗАДЕРЖИВАТЬСЯ");
          return;
        }
      } else if (p.currentCell?.object === "fire") {
        p.hazard += dt;
        if (p.hazard > 0.75) {
          resetAfterHazard(index, "ОГОНЬ: ПЕРЕЗАПУСК ПОЗИЦИИ");
          return;
        }
      } else {
        p.hazard = Math.max(0, p.hazard - dt * 2.5);
      }

      if (p.currentCell?.object === "dangerbox") {
        p.hazard += dt;
        if (p.hazard > 0.32) {
          resetAfterHazard(index, "ОПАСНЫЙ ЯЩИК");
          return;
        }
      }

      if (p.currentCell?.object === "safebox" || p.currentCell?.object === "box") {
        if (!p.currentCell.collected) collectObject(p.currentCell, findObjectMesh(p.currentCell), p, index);
      }
    }

    function updatePlayerVisual(index) {
      const p = players[index];
      const a = p.angle;
      const r = Math.max(p.radial || playerWallRadius, playerWallRadius);
      const x = Math.sin(a) * r;
      const z = Math.cos(a) * r;

      const marker = playerMarkers[index];
      const halo = playerHalos[index];
      const sprite = playerSprites[index];
      const texture = playerTextures[index];
      const cutoutFailed = texture?.userData?.bcmCutoutFailed === true;
      const cutoutReady = !cutoutFailed && (!texture || texture.userData?.bcmCutoutPending !== true);
      const feetOffset = 0.42;
      const footLift = 0.30;

      if (marker) {
        marker.position.set(x, p.y + 0.35, z);
        marker.visible = !sprite || !cutoutReady;
      }
      const shieldOn = shieldActive(p);
      const shieldBlink = p.shieldBlinkUntil && performance.now() < p.shieldBlinkUntil;
      if (halo) {
        const haloRadius = Math.max(0.1, r - 0.045);
        halo.position.set(Math.sin(a) * haloRadius, p.y - feetOffset + footLift + 1.07, Math.cos(a) * haloRadius);
        halo.scale.set(1.72, 2.42, 1);
        halo.visible = !!sprite && (shieldOn || shieldBlink);
        if (halo.material) {
          halo.material.opacity = shieldBlink && (Math.floor(performance.now() / 80) % 2) ? 0.2 : 0.98;
        }
      }
      const jetFx = playerJetEffects[index];
      if (jetFx) {
        const now = performance.now();
        const remaining = Number(p.jetFxUntil || 0) - now;
        jetFx.visible = remaining > 0 && !p.finished;
        if (jetFx.visible) {
          const pulse = 0.86 + Math.sin(now * 0.055 + index) * 0.14;
          const power = Number(p.jetFxPower || 1);
          const jetRadius = r + 0.035;
          jetFx.position.set(
            Math.sin(a) * jetRadius,
            p.y - feetOffset + footLift - 0.18,
            Math.cos(a) * jetRadius
          );
          jetFx.scale.set(0.58 * power * pulse, 0.86 * power * pulse, 1);
          jetFx.material.opacity = Math.min(0.98, Math.max(0, remaining / 100)) * pulse;
          jetFx.material.rotation = Math.sin(now * 0.04 + index) * 0.08;
        }
      }
      if (!sprite) return;
      sprite.visible = cutoutReady;
      if (!cutoutReady) return;

      const delta = angleDelta(a, p.visualAngle ?? a);
      const turnInput = (controls[index]?.right ? 1 : 0) - (controls[index]?.left ? 1 : 0);
      const facingFactor = playerFacingFactors[index] ?? -1;
      if (turnInput !== 0) {
        p.visualFacing = (turnInput > 0 ? -1 : 1) * facingFactor;
      } else if (Math.abs(delta) > 0.001) {
        p.visualFacing = (delta > 0 ? -1 : 1) * facingFactor;
      }
      p.visualAngle = a;

      const motion = playerMotion[index] || speciesMotion("", "");
      const moving = !p.finished && (
        Math.abs(p.vy) > 0.4 ||
        Math.abs(delta) > 0.01 ||
        turnInput !== 0 ||
        !p.grounded
      );
      const wave = Math.sin(performance.now() * motion.speed + index);
      const movingAmp = moving ? 1 : 0.35;
      const bob = wave * motion.bob * movingAmp;
      if (halo) {
        const haloRadius = Math.max(0.1, r - 0.045);
        halo.position.set(Math.sin(a) * haloRadius, p.y - feetOffset + footLift + 1.07 + bob, Math.cos(a) * haloRadius);
        halo.visible = !!sprite && (shieldOn || shieldBlink);
      }

      sprite.center.set(0.5, 0);
      const map = sprite.material && sprite.material.map;
      const face = p.visualFacing || 1;
      if (map) {
        map.wrapS = THREE.RepeatWrapping;
        map.repeat.x = face < 0 ? -1 : 1;
        map.offset.x = face < 0 ? 1 : 0;
      }

      // p.y is maintained above the floor by the physics solver. Anchor the
      // image at the platform rather than adding another positive vertical offset.
      const spriteHeight = 2.15;
      const imageWidth = Number(map?.image?.width || 1);
      const imageHeight = Number(map?.image?.height || 1);
      const aspect = imageWidth / Math.max(1, imageHeight);
      const spriteWidth = clamp(spriteHeight * aspect, 0.55, 1.75);
      // Align the bottom of the full-body cutout to the visible platform top.
      const transparentFootPad = Number(texture?.userData?.bcmCutoutFeetPadRatio || 0);
      const stretch = 1 + wave * motion.squash * movingAmp;
      const feetY = p.y - feetOffset + footLift - transparentFootPad * spriteHeight + bob;
      sprite.position.set(x, feetY, z);
      sprite.scale.set(spriteWidth / stretch, spriteHeight * stretch, 1);
      if (sprite.material) sprite.material.rotation = wave * motion.sway * face * movingAmp * 0.35;
      const legs = playerLegSprites[index];
      if (legs) legs.visible = false;
    }
    function updateCamera(index, viewport) {
      const p = players[index];
      const a = p.angle;
      const x = Math.sin(a) * cameraRadius;
      const z = Math.cos(a) * cameraRadius;
      const camera = cameras[index];
      const playerRadius = p.radial || (radius + 1.05);
      const followRadius = playerRadius + 7.5;

      // Follow from outside the cylinder and keep the character centered.
      camera.position.set(
        Math.sin(a) * followRadius,
        p.y + 4.0,
        Math.cos(a) * followRadius
      );
      camera.lookAt(new THREE.Vector3(
        Math.sin(a) * playerRadius,
        p.y + 0.9,
        Math.cos(a) * playerRadius
      ));
      camera.aspect = viewport.w / Math.max(1, viewport.h);
      camera.updateProjectionMatrix();
    }

    function currentLevelText(p) {
      const bottomY = -((tower.levels - 1) * tower.stepY);
      const level = clamp(
        Math.round((p.y - bottomY) / tower.stepY),
        0,
        tower.levels - 1
      );
      return (tower.levels - 1 - level) + "/" + (tower.levels - 1);
    }

    function updateHud() {
      if (!tower || !gameStarted) return;
      if (mode === "single") {
        levelEl.textContent =
          "СПУСК: " + currentLevelText(players[0]) +
          " · SECTOR " + wrapSector(Math.round(players[0].angle / sectorWidth()), tower.sectors) +
          " · SEED " + tower.seed;
        if (modeEl) {
          modeEl.textContent = mode === "multi"
            ? "МИССИЯ: КТО ПЕРВЫЙ АККУРАТНО СПУСТИТСЯ ВНИЗ"
            : "МИССИЯ: АККУРАТНО СПУСТИТЬСЯ ВНИЗ";
        }
      } else {
        levelEl.textContent =
          "P1: " + currentLevelText(players[0]) +
          " · P2: " + currentLevelText(players[1]) +
          " · SEED " + tower.seed;
        if (modeEl) {
          modeEl.textContent = "МИССИЯ: КТО ПЕРВЫЙ АККУРАТНО СПУСТИТСЯ ВНИЗ";
        }
      }

      if (inlineConfig.crewName) {
        crewEl.textContent = "CREW: " + inlineConfig.crewName;
      } else if (inlineConfig.crewImage) {
        crewEl.textContent = "CREW: NFT IMAGE";
      } else {
        crewEl.textContent = "CREW: готов к подключению NFT";
      }

      if (players.every(p => p.finished)) {
        restartButton.hidden = false;
      }
      updateCrewMatrix();
      exposeCrewMatrix();
    }

    function renderViews() {
      const w = Math.max(1, root.clientWidth);
      const h = Math.max(1, root.clientHeight);
      renderer.setSize(w, h, false);
      renderer.setScissorTest(true);

      if (mode === "multi") {
        const landscape = w >= h;
        let rects;
        if (landscape) {
          const half = Math.floor(w / 2);
          rects = [
            { x: 0, y: 0, w: half, h },
            { x: half, y: 0, w: w - half, h }
          ];
        } else {
          const half = Math.floor(h / 2);
          rects = [
            { x: 0, y: 0, w, h: half },
            { x: 0, y: half, w, h: h - half }
          ];
        }

        divider.hidden = false;
        p1Label.hidden = false;
        p2Label.hidden = false;

        rects.forEach((r, i) => {
          renderer.setViewport(r.x, r.y, r.w, r.h);
          renderer.setScissor(r.x, r.y, r.w, r.h);
          renderer.clear(true, true, true);
          updateCamera(i, r);
          renderer.render(scene, cameras[i]);
        });
      } else {
        divider.hidden = true;
        p1Label.hidden = true;
        p2Label.hidden = true;
        renderer.setViewport(0, 0, w, h);
        renderer.setScissor(0, 0, w, h);
        renderer.clear(true, true, true);
        updateCamera(0, { w, h });
        renderer.render(scene, cameras[0]);
      }

      renderer.setScissorTest(false);
    }

    function resize() {
      const w = Math.max(1, root.clientWidth);
      const h = Math.max(1, root.clientHeight);
      renderer.setSize(w, h, false);
      // The embedded Tower is initialized while its root is hidden, so the
      // first resize can legitimately be 1x1. Recalculate camera/viewport
      // after the root becomes visible as well.
      if (renderer.domElement && w > 1 && h > 1) {
        renderer.setViewport(0, 0, w, h);
      }
    }

    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => resize())
      : null;
    resizeObserver?.observe(root);

    function ensureTowerAudio() {
      if (towerAudio || !CONFIG.towerAudio) return towerAudio;

      towerAudio = document.createElement("audio");
      towerAudio.src = CONFIG.towerAudio;
      towerAudio.preload = "auto";
      towerAudio.loop = true;
      towerAudio.volume = 0.48;
      towerAudio.setAttribute("playsinline", "");
      towerAudio.setAttribute("aria-hidden", "true");
      towerAudio.style.display = "none";
      document.body.appendChild(towerAudio);
      return towerAudio;
    }

    function stopOtherGameAudio() {
      try { window.BCMMiniSimAPI?.stopAudio?.(); } catch (e) {}
      document.querySelectorAll(".bcm-mini-sim-music-audio").forEach((audio) => {
        if (audio === towerAudio) return;
        try { audio.pause(); } catch (e) {}
      });
    }

    function playTowerAudio() {
      const audio = ensureTowerAudio();
      if (!audio) return;
      if (!audio.paused && !audio.ended) return;
      audio.loop = true;
      audio.volume = 0.48;
      if (window.BCMGameAudio?.playExclusive) {
        const promise = window.BCMGameAudio.playExclusive(audio, "tower");
        if (promise && promise.catch) promise.catch(() => {});
        return;
      }
      stopOtherGameAudio();
      audio.muted = !!window.BCMGameAudio?.isMuted?.();
      const promise = audio.play();
      if (promise && promise.catch) promise.catch(() => {});
    }

    function stopTowerAudio() {
      if (!towerAudio) return;
      try {
        towerAudio.pause();
        towerAudio.currentTime = 0;
      } catch (e) {}
    }

    function startMode(nextMode) {
      mode = nextMode === "multi" ? "multi" : "single";
      enableTowerTilt();
      // The OST normally started on tower.mp4's first actual playback frame.
      // Keep this as a fallback, but never restart an already playing track.
      if (!towerAudio || towerAudio.paused || towerAudio.ended) playTowerAudio();
      menu.hidden = true;
      mobile?.setAttribute("aria-hidden", "false");
      mobile?.querySelector(".bcm-tower-mobile-p2")?.toggleAttribute("hidden", mode !== "multi");
      root.classList.toggle("is-multi", mode === "multi");

      try {
        buildTower(makeSeed());
        gameStarted = true;
        requestAnimationFrame(() => {
          resize();
          renderViews();
        });
      } catch (error) {
        gameStarted = false;
        menu.hidden = false;
        status.textContent = "TOWER ERROR: " + (error?.message || "BUILD FAILED");
        console.error("BCM Tower startMode failed", error);
        return;
      }

      if (mode === "multi") {
        mobile?.classList.add("is-multi");
        status.textContent = "МИССИЯ: КТО ПЕРВЫЙ АККУРАТНО СПУСТИТСЯ ВНИЗ";
      } else {
        mobile?.classList.remove("is-multi");
        status.textContent = "МИССИЯ: АККУРАТНО СПУСТИТЬСЯ ВНИЗ";
      }
    }

    function showMenu() {
      gameStarted = false;
      focusTowerMode(0);
      if (transition) transition.hidden = true;
      menu.hidden = false;
      restartButton.hidden = true;
      status.textContent = "ВЫБЕРИТЕ РЕЖИМ";
      if (modeEl) modeEl.textContent = "";

      // Build a preview behind the menu. This also starts loading the Tower
      // textures before SINGLE/MULTI is selected, so the handoff is visibly alive.
      if (!tower) {
        buildTower(makeSeed());
      }
      requestAnimationFrame(() => {
        resize();
        renderViews();
      });
    }

    function stopTransition() {
      transition.hidden = true;
      transition.style.backgroundImage = "";
      transitionVideo.pause();
      transitionVideo.removeAttribute("src");
      transitionVideo.load();
      transitionVideo.style.opacity = "0";
      transitionStarted = false;
    }

    function helipadMarkerUrl() {
      const pool = assetPool("hMarkerPool");
      const first = pool.find((url) => /(?:^|\/)H1(?:\d*)\.png(?:[?#].*)?$/i.test(url));
      if (first) return first;
      if (pool.length) return pool[0];
      const landing = assetPool("landingPool");
      return landing.find((url) => /(?:^|\/)H1(?:\d*)\.png(?:[?#].*)?$/i.test(url)) || "";
    }

    function showEndLevelMarker() {
      const markerUrl = helipadMarkerUrl();
      if (!markerUrl) return;
      transition.hidden = false;
      transition.style.backgroundImage = 'url("' + markerUrl.replace(/"/g, '\\"') + '")';
      transition.style.backgroundPosition = "center";
      transition.style.backgroundSize = "contain";
      transition.style.backgroundRepeat = "no-repeat";
      transitionVideo.style.opacity = "0";
      window.clearTimeout(showEndLevelMarker.timer);
      showEndLevelMarker.timer = window.setTimeout(() => {
        transition.hidden = true;
        transition.style.backgroundImage = "";
      }, 2200);
    }

    function transitionUrl() {
      // Tower entry uses tower.mp4 itself; this is deliberately not a fallback
      // to one of the Mini-Sim portal clips.
      return CONFIG.transition || "";
    }

    function primeTransitionVideo() {
      const url = transitionUrl();
      if (!url || !transitionVideo) return false;
      const absolute = (value) => {
        try { return new URL(value, document.baseURI).href; } catch (e) { return String(value || ""); }
      };
      if (transitionVideo.getAttribute("src") && absolute(transitionVideo.getAttribute("src")) === absolute(url)) {
        return transitionVideo.readyState >= 2;
      }

      transitionVideo.muted = true;
      transitionVideo.defaultMuted = true;
      transitionVideo.setAttribute("muted", "");
      transitionVideo.setAttribute("playsinline", "");
      transitionVideo.setAttribute("webkit-playsinline", "");
      transitionVideo.playsInline = true;
      transitionVideo.preload = "auto";
      try { transitionVideo.fetchPriority = "high"; } catch (e) {}
      transitionVideo.src = url;
      transitionVideo.load();
      return transitionVideo.readyState >= 2;
    }

    function resolveLandingFirstFrame(success) {
      const callback = landingFirstFrameCallback;
      landingFirstFrameCallback = null;
      landingHandoffPending = false;
      if (typeof callback === "function") {
        try { callback(!!success); } catch (e) {}
      }
    }

    function triggerTransition() {
      if (transitionStarted) return false;
      const url = transitionUrl();
      if (!url) {
        status.textContent = "TOWER LANDING VIDEO MISSING · tower.mp4";
        transition.hidden = true;
        transition.style.backgroundImage = "";
        transitionVideo.style.opacity = "0";
        if (landingFirstFrameCallback) resolveLandingFirstFrame(false);
        return false;
      }

      transitionStarted = true;
      window.clearTimeout(showEndLevelMarker.timer);
      transition.hidden = true;
      transition.style.backgroundImage = "";
      transition.style.backgroundPosition = "";
      transition.style.backgroundSize = "";
      transition.style.backgroundRepeat = "no-repeat";
      transitionVideo.style.opacity = "0";
      transitionVideo.muted = true;
      transitionVideo.defaultMuted = true;
      transitionVideo.setAttribute("muted", "");
      transitionVideo.setAttribute("playsinline", "");
      transitionVideo.setAttribute("webkit-playsinline", "");
      transitionVideo.playsInline = true;
      transitionVideo.preload = "auto";
      try { transitionVideo.fetchPriority = "high"; } catch (e) {}

      let playRequested = false;
      const requestPlayback = () => {
        if (playRequested || !transitionStarted || transitionVideo.readyState < 2) return;
        playRequested = true;
        try { transitionVideo.currentTime = 0; } catch (e) {}
        const result = transitionVideo.play();
        if (result && result.catch) {
          result.catch(() => {
            playRequested = false;
            if (landingFirstFrameCallback) resolveLandingFirstFrame(false);
            transitionStarted = false;
            transition.hidden = true;
            transitionVideo.style.opacity = "0";
            status.textContent = "TOWER LANDING VIDEO READY · PLAY BLOCKED";
          });
        }
      };

      transitionVideo.onloadedmetadata = () => {
        try { transitionVideo.currentTime = 0; } catch (e) {}
      };
      transitionVideo.onloadeddata = requestPlayback;
      transitionVideo.oncanplay = requestPlayback;
      transitionVideo.onplaying = () => {
        if (!playRequested || !transitionStarted) return;

        // Both the transition and the Tower OST are tied to actual playback,
        // not merely loadeddata or the old H1 end-level marker.
        transition.style.backgroundImage = "";
        transition.hidden = false;
        transitionVideo.style.opacity = "1";
        playTowerAudio();

        if (landingHandoffPending && !landingFrameNotified) {
          landingFrameNotified = true;
          canvas.style.visibility = "";
          root.style.background = "";
          root.style.pointerEvents = "";
          document.querySelectorAll(".bcm-mini-sim").forEach((el) => {
            el.style.pointerEvents = "none";
          });
          resolveLandingFirstFrame(true);
        }
      };
      transitionVideo.onended = () => {
        stopTransition();
        showMenu();
      };
      transitionVideo.onerror = () => {
        stopTransition();
        if (landingFirstFrameCallback) resolveLandingFirstFrame(false);
        landingFrameNotified = false;
        landingHandoffPending = false;
        status.textContent = "TOWER LANDING VIDEO ERROR · tower.mp4";
        if (root) root.hidden = true;
      };

      const absolute = (value) => {
        try { return new URL(value, document.baseURI).href; }
        catch (e) { return String(value || ""); }
      };
      const currentSrc = transitionVideo.getAttribute("src");
      if (!currentSrc || absolute(currentSrc) !== absolute(url)) {
        transitionVideo.src = url;
        transitionVideo.load();
      }

      // If the first frame is already decoded, ask for playback now. The
      // overlay remains hidden until onplaying confirms the frame has started.
      if (transitionVideo.readyState >= 2) requestPlayback();
      return true;
    }

    function startNewTower() {
      if (!gameStarted) return;
      buildTower(makeSeed());
      status.textContent = mode === "multi" ? "НОВАЯ ОБЩАЯ БАШНЯ" : "НОВЫЙ SEED";
    }

    function setAction(index, action, value) {
      if (!controls[index] || !(action in controls[index])) return;
      controls[index][action] = value;
    }

    function clearControls(index) {
      Object.keys(controls[index]).forEach(k => controls[index][k] = false);
    }

    const keyMap = {
      KeyA: [0, "left"],
      KeyD: [0, "right"],
      KeyW: [0, "up"],
      KeyS: [0, "down"],
      Space: [0, "jump"],
      KeyE: [0, "interact"],

      // P2 keyboard fallback when no gamepad is available.
      ArrowLeft: [1, "left"],
      ArrowRight: [1, "right"],
      ArrowUp: [1, "up"],
      ArrowDown: [1, "down"],
      KeyX: [1, "jump"],
      ShiftRight: [1, "interact"]
    };

    window.addEventListener("keydown", (event) => {
      if (event.code === "Escape") {
        clearControls(0);
        clearControls(1);
        mouseDown = false;
        if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
        return;
      }
      if (!gameStarted) {
        if (event.code === "Digit1") startMode("single");
        if (event.code === "Digit2") startMode("multi");
        return;
      }

      if (event.code === "KeyR") {
        startNewTower();
        return;
      }

      const mapped = keyMap[event.code];
      if (!mapped) return;
      event.preventDefault();

      const [index, action] = mapped;
      if (action === "jump") {
        if (!event.repeat) doJump(index);
      } else if (action === "interact") {
        if (!event.repeat) interact(index);
      } else {
        setAction(index, action, true);
      }
    });

    window.addEventListener("keyup", (event) => {
      const mapped = keyMap[event.code];
      if (!mapped) return;
      const [index, action] = mapped;
      if (action !== "jump" && action !== "interact") {
        setAction(index, action, false);
      }
    });

    window.addEventListener("blur", () => {
      clearControls(0);
      clearControls(1);
      mouseDown = false;
    });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) return;
      clearControls(0);
      clearControls(1);
      mouseDown = false;
    });

    let mouseDown = false;
    let mousePlayer = 0;
    let dragPointer = null;
    const towerTilt = {
      enabled: false,
      bound: false,
      ready: false,
      calibrate: false,
      filtered: 0,
      neutral: 0,
      horizontal: 0
    };

    function towerTiltTurn() {
      return towerTilt.enabled ? towerTilt.horizontal : 0;
    }

    function bindTowerTilt() {
      towerTilt.calibrate = true;
      towerTilt.enabled = true;
      if (towerTilt.bound) return;
      window.addEventListener("deviceorientation", (event) => {
        const angleRaw = screen.orientation && typeof screen.orientation.angle === "number"
          ? screen.orientation.angle
          : (typeof window.orientation === "number" ? window.orientation : 0);
        const angle = ((angleRaw % 360) + 360) % 360;
        const beta = event.beta || 0;
        const gamma = event.gamma || 0;
        let horizontal = gamma;
        if (angle === 90) horizontal = -beta;
        else if (angle === 270) horizontal = beta;
        else if (angle === 180) horizontal = -gamma;
        towerTilt.filtered += (horizontal - towerTilt.filtered) * 0.34;
        if (!towerTilt.ready || towerTilt.calibrate) {
          towerTilt.neutral = towerTilt.filtered;
          towerTilt.ready = true;
          towerTilt.calibrate = false;
        }
        const delta = towerTilt.filtered - towerTilt.neutral;
        const dead = 2.0;
        const shaped = Math.abs(delta) <= dead ? 0 : clamp((delta - Math.sign(delta) * dead) / 11, -1, 1);
        towerTilt.horizontal = -shaped;
      }, true);
      towerTilt.bound = true;
    }

    function enableTowerTilt() {
      const orientation = window.DeviceOrientationEvent;
      if (orientation && typeof orientation.requestPermission === "function") {
        orientation.requestPermission().then((state) => {
          if (state === "granted") bindTowerTilt();
        }).catch(() => {});
        return;
      }
      bindTowerTilt();
    }

    root.addEventListener("pointerdown", (event) => {
      if (!gameStarted || event.pointerType !== "mouse" || event.target.closest("button, .bcm-tower-mobile")) return;
      mouseDown = true;
      dragPointer = { id: event.pointerId, x: event.clientX, y: event.clientY, x0: event.clientX, y0: event.clientY };

      if (mode === "multi") {
        const rect = root.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        if (rect.width >= rect.height) mousePlayer = x > rect.width / 2 ? 1 : 0;
        else mousePlayer = y > rect.height / 2 ? 1 : 0;
      } else {
        mousePlayer = 0;
      }

      if (event.pointerType === "mouse") canvas.setPointerCapture?.(event.pointerId);
    });

    root.addEventListener("pointerup", (event) => {
      if (event.pointerType !== "mouse") {
        mouseDown = false;
        dragPointer = null;
        return;
      }
      if (mouseDown && gameStarted && dragPointer && event.pointerId === dragPointer.id) {
        const dist = Math.hypot(event.clientX - dragPointer.x0, event.clientY - dragPointer.y0);
        if (dist < 16 && !event.target.closest("button, .bcm-tower-mobile")) doJump(mousePlayer);
      }
      mouseDown = false;
      dragPointer = null;
    });

    root.addEventListener("pointercancel", () => {
      mouseDown = false;
      dragPointer = null;
    });

    root.addEventListener("pointermove", (event) => {
      if (!mouseDown || !gameStarted || !dragPointer || event.pointerId !== dragPointer.id) return;
      const dx = event.clientX - dragPointer.x;
      const dy = event.clientY - dragPointer.y;
      dragPointer.x = event.clientX;
      dragPointer.y = event.clientY;
      if (!dx && !dy) return;
      const p = players[mousePlayer];
      p.angle += dx * 0.0065;
      p.vy += clamp(-dy * 0.015, -2.0, 2.0);
    });

    const pointerEventsAvailable = typeof window.PointerEvent === "function";
    mobile?.querySelectorAll("[data-tower-control]").forEach((button) => {
      if (!pointerEventsAvailable) return;
      const index = Number(button.dataset.towerPlayer || 0);
      const action = button.dataset.towerControl;
      const down = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (action === "jump") doJump(index);
        else setAction(index, action, true);
      };
      const up = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (action !== "jump") setAction(index, action, false);
      };
      button.addEventListener("pointerdown", down);
      button.addEventListener("pointerup", up);
      button.addEventListener("pointercancel", up);
      button.addEventListener("lostpointercapture", up);
      button.addEventListener("pointerleave", up);
    });

    function towerButtonAt(x, y) {
      const buttons = root.querySelectorAll("[data-tower-control]");
      for (const button of buttons) {
        if (button.closest("[hidden]")) continue;
        const rect = button.getBoundingClientRect();
        if (rect.width < 8 || rect.height < 8) continue;
        if (x >= rect.left - 16 && x <= rect.right + 16 && y >= rect.top - 16 && y <= rect.bottom + 16) return button;
      }
      return null;
    }

    const heldTowerTouches = new Map();
    // Old-browser fallback only. Modern Android/iOS use Pointer Events, so the
    // same finger no longer triggers both pointerdown and touchstart (two jumps).
    if (!pointerEventsAvailable) {
      root.addEventListener("touchstart", (event) => {
        if (!gameStarted) return;
        let used = false;
        for (const touch of event.changedTouches) {
          if (heldTowerTouches.size >= 3) break;
          const button = towerButtonAt(touch.clientX, touch.clientY);
          if (!button) continue;
          const index = Number(button.dataset.towerPlayer || 0);
          const action = button.dataset.towerControl;
          heldTowerTouches.set(touch.identifier, { index, action });
          if (action === "jump") doJump(index);
          else setAction(index, action, true);
          used = true;
        }
        if (used) event.preventDefault();
      }, { capture: true, passive: false });
      const releaseTowerTouch = (event) => {
        for (const touch of event.changedTouches) {
          const held = heldTowerTouches.get(touch.identifier);
          heldTowerTouches.delete(touch.identifier);
          if (held && held.action !== "jump") setAction(held.index, held.action, false);
        }
      };
      root.addEventListener("touchend", releaseTowerTouch, { capture: true });
      root.addEventListener("touchcancel", releaseTowerTouch, { capture: true });
    }

    // Mini Sim commits its Crew selection only when the player starts.
    // Refresh the Tower preview then, because boot() may already have built it
    // with fallback Crew before the selection existed.
    window.addEventListener("bcm:minicrew-selection-changed", () => {
      const synced = syncCrewSelectionFromMiniSim();
      if (!synced || !tower || gameStarted) return;
      try {
        buildTower(seed == null ? makeSeed() : seed);
        requestAnimationFrame(() => {
          resize();
          renderViews();
        });
      } catch (error) {
        console.warn("Tower Crew preview refresh failed", error);
      }
    });

    let modeStartLock = 0;
    function focusTowerMode(index) {
      if (!modeButtons.length) return;
      towerMenuCursor=(index+modeButtons.length)%modeButtons.length;
      modeButtons.forEach((b,i)=>{const active=i===towerMenuCursor;b.classList.toggle("bcm-gamepad-focused",active);b.setAttribute("aria-current",active?"true":"false");});
      const c=modeButtons[towerMenuCursor];if(c&&typeof c.focus==="function"){try{c.focus({preventScroll:true});}catch(e){c.focus();}}
    }

    function pressTowerMode(nextMode) {
      const now = performance.now();
      if (now - modeStartLock < 700) return;
      modeStartLock = now;
      syncCrewSelectionFromMiniSim();
      startMode(nextMode);
    }
    function towerModeAt(x, y) {
      if (!menu || menu.hidden) return null;
      for (const button of modeButtons) {
        const rect = button.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return button;
      }
      return null;
    }
    document.addEventListener("touchend", (event) => {
      const touch = event.changedTouches && event.changedTouches[0];
      if (!touch || gameStarted) return;
      const button = towerModeAt(touch.clientX, touch.clientY);
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      pressTowerMode(button.dataset.towerMode);
    }, true);
    document.addEventListener("click", (event) => {
      if (gameStarted) return;
      const button = towerModeAt(event.clientX, event.clientY);
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      pressTowerMode(button.dataset.towerMode);
    }, true);

    restartButton.addEventListener("click", startNewTower);

    transitionClose.addEventListener("click", () => {
      stopTransition();
      showMenu();
    });

    function pollGamepads() {
      // An embedded/hidden Tower must never consume a controller's held A button
      // as a menu confirmation. Hull Dive and the Ring platformer own input while
      // their overlays are open, so suppress Tower polling until they close.
      const inputSuppressed = !!root.hidden || !!root.closest("[hidden]") ||
        !!document.getElementById("bcm-hull-dive") ||
        !!document.getElementById("bcm-ring-platformer") ||
        !!document.getElementById("bcm-ring-transition");
      if (inputSuppressed) {
        if (towerAudio && !towerAudio.paused) stopTowerAudio();
        for (let i = 0; i < 2; i += 1) {
          if (gamepadPresent[i]) {
            clearControls(i);
            gamepadPresent[i] = false;
          }
          if (edgeState[i]) {
            edgeState[i].jump = false;
            edgeState[i].interact = false;
            edgeState[i].restart = false;
            edgeState[i].menuUp = false;
            edgeState[i].menuDown = false;
            edgeState[i].menuLeft = false;
            edgeState[i].menuRight = false;
          }
        }
        return;
      }
      const pads = navigator.getGamepads ? [...navigator.getGamepads()] : [];
      const connectedPads = pads.filter(Boolean);

      // Multi-player assignment:
      // 0 gamepads  -> P1 keyboard + P2 keyboard
      // 1 gamepad   -> gamepad automatically becomes P2, P1 stays keyboard
      // 2+ gamepads -> first two gamepads become P1 and P2 separately.
      let assignedPads;
      if (mode === "multi") {
        if (connectedPads.length === 1) {
          assignedPads = [null, connectedPads[0]];
        } else {
          assignedPads = [connectedPads[0] || null, connectedPads[1] || null];
        }
      } else {
        assignedPads = [connectedPads[0] || null, null];
      }

      if (!gameStarted) {
        const pad=connectedPads[0]||null;if(!pad)return;
        const axes=pad.axes||[],button=n=>!!(pad.buttons&&pad.buttons[n]&&pad.buttons[n].pressed);
        const up=button(12)||(axes[1]||0)<-.55,down=button(13)||(axes[1]||0)>.55,left=button(14)||(axes[0]||0)<-.55,right=button(15)||(axes[0]||0)>.55;
        const now=performance.now();
        if(now-towerMenuNavAt>180){
          if(up&&!edgeState[0].menuUp){focusTowerMode(towerMenuCursor-1);towerMenuNavAt=now;}
          else if(down&&!edgeState[0].menuDown){focusTowerMode(towerMenuCursor+1);towerMenuNavAt=now;}
          else if(left&&!edgeState[0].menuLeft){focusTowerMode(towerMenuCursor-1);towerMenuNavAt=now;}
          else if(right&&!edgeState[0].menuRight){focusTowerMode(towerMenuCursor+1);towerMenuNavAt=now;}
        }
        const confirm=button(0),multiShortcut=button(1);
        if(confirm&&!edgeState[0].jump){const c=modeButtons[towerMenuCursor];if(c)pressTowerMode(c.dataset.towerMode);}
        if(multiShortcut&&!edgeState[0].interact)pressTowerMode("multi");
        edgeState[0].jump=confirm;edgeState[0].interact=multiShortcut;
        edgeState[0].menuUp=up;edgeState[0].menuDown=down;edgeState[0].menuLeft=left;edgeState[0].menuRight=right;
        return;
      }

      for (let i = 0; i < 2; i++) {
        const pad = assignedPads[i];
        if (!pad) {
          // Keyboard, mouse and touch controls share this state. An absent
          // gamepad must not erase a held keyboard key every 60 ms.
          if (gamepadPresent[i]) {
            clearControls(i);
            gamepadPresent[i] = false;
          }
          continue;
        }

        gamepadPresent[i] = true;
        controls[i].gamepad = true;

        const lx = pad.axes?.[0] || 0;
        const ly = pad.axes?.[1] || 0;
        const dead = 0.16;

        controls[i].left = lx < -dead;
        controls[i].right = lx > dead;
        controls[i].up = ly < -dead;
        controls[i].down = ly > dead;

        const jumpPressed = !!pad.buttons?.[0]?.pressed;
        const interactPressed = !!pad.buttons?.[2]?.pressed;
        const restartPressed = !!pad.buttons?.[3]?.pressed;

        if (jumpPressed && !edgeState[i].jump) doJump(i);
        if (interactPressed && !edgeState[i].interact) interact(i);
        if (restartPressed && !edgeState[i].restart) startNewTower();

        edgeState[i].jump = jumpPressed;
        edgeState[i].interact = interactPressed;
        edgeState[i].restart = restartPressed;
      }
    }

    let previousTime = performance.now();

    function frame(now) {
      const dt = Math.min(0.034, Math.max(0.001, (now - previousTime) / 1000));
      previousTime = now;

      if (tower) {
        if (gameStarted) {
          updateLiftMotion(now);
          updateBirds(now);

          for (let i = 0; i < (mode === "multi" ? 2 : 1); i++) {
            updatePlayer(i, dt);
            updatePlayerVisual(i);
          }

          if (mode === "multi") {
            updatePlayerVisual(1);
          }

          updateHud();
        }

        renderViews();
      }

      requestAnimationFrame(frame);
    }

    window.BCMTowerAPI = window.BCMTowerAPI || {};
    window.BCMTowerAPI.getCrewMatrix = () => window.BCMTowerCrewMatrix || null;
    window.BCMTowerAPI.getWallet = () => window.BCMiniCrewWallet || null;
    window.BCMTowerAPI.stopAudio = () => stopTowerAudio();
    // Ring reuses Tower's cached, alpha-cleaned Crew texture pipeline for its
    // 2D characters; it falls back to the source image if this texture is unavailable.
    window.BCMTowerAPI.makeCrewSpriteTexture = (url) =>
      assetTexture(String(url || ""), renderer, { cutout: true });
    // Called by Mini-Sim only when the ship approaches ONICSS. Do not fetch
    // tower.mp4 during the initial Starbase load.
    window.BCMTowerAPI.preloadLanding = () => primeTransitionVideo();
    window.BCMTowerAPI.enter = (options) => {
      const deferHandoff = !!(options && options.deferHandoff);
      root.hidden = false;
      root.style.zIndex = "1000001";
      if (deferHandoff) {
        // Tower remains visually and interactively transparent while the live
        // Mini-Sim scene keeps flying underneath the unready landing clip.
        root.style.pointerEvents = "none";
        root.style.background = "transparent";
        canvas.style.visibility = "hidden";
        transition.hidden = true;
        transitionVideo.style.opacity = "0";
      } else {
        root.style.pointerEvents = "";
        root.style.background = "";
        canvas.style.visibility = "";
        document.querySelectorAll(".bcm-mini-sim").forEach((el) => {
          el.style.pointerEvents = "none";
        });
      }
      menu.hidden = true;
      status.textContent = "LANDING VIDEO · PREPARING TOWER...";
      try {
        if (!tower) buildTower(makeSeed());
      } catch (error) {
        gameStarted = false;
        status.textContent = "TOWER ERROR: " + (error?.message || "BUILD FAILED");
        console.error("BCM Tower entry build failed", error);
        if (landingFirstFrameCallback) resolveLandingFirstFrame(false);
        if (deferHandoff) root.hidden = true;
        return false;
      }
      resize();
      renderViews();
      const started = triggerTransition();
      if (!started) {
        status.textContent = "tower.mp4 не найден рядом с ассетами башни";
        if (landingFirstFrameCallback) resolveLandingFirstFrame(false);
        if (deferHandoff) root.hidden = true;
        return false;
      }
      return true;
    };
    window.BCMTowerAPI.beginLanding = (onFirstFrame) => {
      landingFirstFrameCallback = typeof onFirstFrame === "function" ? onFirstFrame : null;
      landingHandoffPending = !!landingFirstFrameCallback;
      landingFrameNotified = false;
      return window.BCMTowerAPI.enter({ deferHandoff: landingHandoffPending });
    };
    window.BCMTowerAPI.mount = (targetRoot) => {
      if (targetRoot && targetRoot !== root) {
        root.hidden = false;
      }
      requestAnimationFrame(() => {
        resize();
        renderViews();
      });
      return root;
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);

    // The landing clip is deliberately not fetched on page boot. Mini-Sim calls
    // preloadLanding() when the ship enters the ONICSS approach radius.
    const autostart = root.dataset.bcmTowerAutostart !== "0";
    if (autostart) {
      status.textContent = "LANDING VIDEO...";
      menu.hidden = true;
      triggerTransition();
    } else {
      status.textContent = "TOWER STANDBY";
      // The embedded Tower sits hidden behind Starbase. Building its preview
      // here would start many texture requests and compete with startup media.
      // Mini-Sim opens it only when the ship approaches ONICSS.
      if (!root.classList.contains("bcm-tower-embedded")) showMenu();
    }
    setInterval(pollGamepads, 60);
    requestAnimationFrame(frame);
  }

  function bootAll() {
    document.querySelectorAll(".bcm-tower").forEach(boot);
  }

  function waitForThree() {
    loadScript(THREE_URL).then(bootAll).catch((error) => {
      document.querySelectorAll(".bcm-tower-status").forEach((el) => {
        el.textContent = "ERROR: " + error.message;
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", waitForThree, { once: true });
  } else {
    waitForThree();
  }
})();
