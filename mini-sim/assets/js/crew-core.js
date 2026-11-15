/* Crew core: assembles the Crew character for every level.
   It cuts the NFT card background once (requestCrewTexture / loadCrewTexture)
   and says how a race faces, walks and falls. Tower, the hold and the ring only
   display what this core returns; they keep no copies of this logic. */
(function () {
  function speciesMotion(species, sex) {
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

  // Mierese art already looks along the walk direction. The other races are drawn the other way.
  function facingFactor(species) {
    return String(species || "").toLowerCase().includes("mierese") ? 1 : -1;
  }

  function readCrewProfile(crew) {
    const traitSpecies = Array.isArray(crew && crew.traits)
      ? (crew.traits.find((item) => /^(species|race)$/i.test(String(item && (item.trait || item.trait_type) || ""))) || {}).value
      : "";
    const species = String((crew && (crew.species || crew.spec)) || traitSpecies || "");
    const sex = String((crew && (crew.sex || crew.gender)) || "");
    return { species, sex, motion: speciesMotion(species, sex), facingFactor: facingFactor(species) };
  }

  function applyPlatformSprite(sprite, actor) {
    if (!sprite || !actor) return 0;
    const profile = actor.profile || readCrewProfile(actor.crew || actor);
    const motion = profile.motion || speciesMotion("", "");
    // The current Ring/Hull cut-outs run backwards for non-Mierese. Correct those textures,
    // but preserve Mierese artwork, whose source already matches the movement direction.
    const baseFacing = profile.facingFactor || -1;
    const faceFactor = String(profile.species || "").toLowerCase().includes("mierese") ? baseFacing : -baseFacing;
    const face = (Number(actor.facing) < 0 ? -1 : 1) * faceFactor;
    const map = sprite.material && sprite.material.map;
    if (map) {
      map.wrapS = 1000;
      map.repeat.x = face < 0 ? -1 : 1;
      map.offset.x = face < 0 ? 1 : 0;
    }
    const data = sprite.userData || (sprite.userData = {});
    if (!data.bcmBaseScale) {
      data.bcmBaseScale = {
        x: Math.abs(sprite.scale.x) || 1,
        y: Math.abs(sprite.scale.y) || 1
      };
    }
    const moving = !!actor.moving;
    const falling = actor.grounded === false && Number(actor.vy) < -0.35;
    const wave = Math.sin(performance.now() * motion.speed + (Number(actor.index) || 0));
    const amp = moving ? 1 : 0.35;
    const bob = wave * motion.bob * amp;
    const squash = moving ? 1 + wave * motion.squash : 1;
    const baseX = data.bcmBaseScale.x;
    const baseY = data.bcmBaseScale.y;
    sprite.scale.x = baseX * (falling ? 0.92 : squash);
    sprite.scale.y = falling ? baseY * 1.12 : baseY / Math.max(0.82, squash);
    if (sprite.material) sprite.material.rotation = wave * motion.sway * amp;
    if (Number.isFinite(actor.y)) sprite.position.y = actor.y + bob + (falling ? -0.06 : 0);
    return bob;
  }

  /* ---------------------------------------------------------------------------
     Crew cutout — the only place that removes the NFT card background.
     Levels (Tower, Ring, Hull Dive) ask for a texture and only display it.
     Order: browser cache → image (official alpha PNG first) → ISNet matte →
     speck prune → crop with feet padding. Each source image is cut once per
     page; every level gets its own Texture over the same finished canvas.
     ------------------------------------------------------------------------- */
  const CUTOUT_CACHE = "bcm-tower-crew-cutouts-v8";
  const CUTOUT_MAX_SIDE = 512;
  const cutouts = new Map();
  let segmenterPromise = null;

  function officialCrewCutoutUrl(url) {
    const text = String(url || "");
    const full = text.match(/^(https?:\/\/cdn\.staratlas\.com\/crew\/v1\/)(\d+)_full\.(?:jpe?g|png|webp)(?:\?.*)?$/i);
    if (full) return full[1] + full[2] + ".png";
    const bare = text.match(/^https?:\/\/cdn\.staratlas\.com\/crew\/v1\/\d+\.png(?:\?.*)?$/i);
    return bare ? text : "";
  }

  function crewImageUrl(crewOrUrl) {
    if (typeof crewOrUrl === "string") return crewOrUrl.trim();
    return String((crewOrUrl && crewOrUrl.image) || "").trim();
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

  function cutoutCacheRequest(url) {
    if (!window.caches || !window.location || !window.location.origin || typeof Request !== "function") return null;
    let hash = 2166136261;
    const input = String(url || "") + "|crew-isnet-v8";
    for (let i = 0; i < input.length; i += 1) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return new Request(window.location.origin + "/?bcm-crew-cutout=v8-" + (hash >>> 0).toString(36));
  }

  async function readCutoutCache(url) {
    try {
      const request = cutoutCacheRequest(url);
      if (!request) return null;
      const cache = await window.caches.open("bcm-tower-crew-cutouts-v8");
      const response = await cache.match(request);
      return response && response.ok ? await response.blob() : null;
    } catch (_error) {
      return null;
    }
  }

  async function writeCutoutCache(url, canvas) {
    try {
      const request = cutoutCacheRequest(url);
      if (!request || !canvas.toBlob || typeof Response !== "function") return;
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) return;
      const cache = await window.caches.open(CUTOUT_CACHE);
      await cache.put(request, new Response(blob, { headers: { "Content-Type": "image/png" } }));
    } catch (_error) { /* cache is an optimisation; a failed write is not an error */ }
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.decoding = "async";
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Crew image failed to load: " + url));
      image.src = url;
    });
  }

  function canvasContext(canvas) {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("No Crew canvas context");
    return ctx;
  }

  // Transparent rows under the feet, as a share of height. Levels use it to
  // stand the figure on the platform top.
  function measureFeetPad(canvas) {
    const pixels = canvasContext(canvas).getImageData(0, 0, canvas.width, canvas.height).data;
    for (let y = canvas.height - 1; y >= 0; y -= 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        if (pixels[(y * canvas.width + x) * 4 + 3] >= 4) return (canvas.height - 1 - y) / Math.max(1, canvas.height);
      }
    }
    return 0;
  }

  // Crop to the silhouette with a small margin. Returns the feet padding ratio,
  // or -1 when no visible pixel remains.
  function cropCrewCanvas(canvas, ctx, frame) {
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
    if (maxX < minX || maxY < minY) return -1;
    const sourceMaxY = maxY;
    const padX = Math.max(4, Math.round(w * 0.025));
    const padTop = Math.max(4, Math.round(h * 0.025));
    const padBottom = Math.max(2, Math.round(h * 0.01));
    minX = Math.max(0, minX - padX);
    minY = Math.max(0, minY - padTop);
    maxX = Math.min(w - 1, maxX + padX);
    maxY = Math.min(h - 1, maxY + padBottom);
    ctx.putImageData(frame, 0, 0);
    const crop = ctx.getImageData(minX, minY, maxX - minX + 1, maxY - minY + 1);
    canvas.width = crop.width;
    canvas.height = crop.height;
    ctx.putImageData(crop, 0, 0);
    return Math.max(0, maxY - sourceMaxY) / Math.max(1, crop.height);
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

  function getSegmenter() {
    // Node tests inject a segmenter; the browser loads ISNet once per page.
    if (typeof window.BCMCrewCoreTestSegmenter === "function") return Promise.resolve(window.BCMCrewCoreTestSegmenter);
    if (!segmenterPromise) {
      segmenterPromise = import("https://esm.sh/@huggingface/transformers@3.8.1?bundle")
        .then((module) => {
          if (module.env) {
            module.env.useBrowserCache = true;
            module.env.allowRemoteModels = true;
          }
          // General-use ISNet suits illustrated/game characters better than
          // portrait-only matting. Quantized weights run once per selected image.
          return module.pipeline("background-removal", "Ko033/isnet-general-use-onnx", { dtype: "q8" });
        })
        .catch((error) => {
          segmenterPromise = null;
          throw error;
        });
    }
    return segmenterPromise;
  }

  async function applyCrewMatte(canvas, ctx, frame) {
    const segmenter = await getSegmenter();
    const output = await segmenter(canvas);
    const results = Array.isArray(output) ? output : [output];
    const picked = results.find((item) => item && item.mask && item.mask.data && item.mask.width && item.mask.height)
      || results.find((item) => item && item.data && item.width && item.height);
    const mask = picked && picked.mask ? picked.mask : picked;
    if (!mask || !mask.data || !mask.width || !mask.height) throw new Error("ISNet returned no Crew matte");
    // Transformers.js background-removal normally returns a complete RGBA cut-out,
    // not a grayscale matte. Then the prediction is in channel 4; reading channel 1
    // would let costume colours decide transparency and clip body parts.
    const channels = Math.max(1, Number(mask.channels) || 1);
    const embeddedAlpha = !picked.mask && channels === 4;
    const channel = embeddedAlpha ? 3 : 0;
    const count = mask.width * mask.height;
    if (mask.data.length < count * channels) throw new Error("ISNet returned an incomplete Crew matte");
    let minMask = Infinity;
    let maxMask = -Infinity;
    for (let i = 0; i < count; i += 1) {
      const value = Number(mask.data[i * channels + channel]) || 0;
      if (value < minMask) minMask = value;
      if (value > maxMask) maxMask = value;
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
    const pixels = frame.data;
    for (let y = 0; y < canvas.height; y += 1) {
      const my = Math.min(mask.height - 1, Math.round(y * (mask.height - 1) / Math.max(1, canvas.height - 1)));
      for (let x = 0; x < canvas.width; x += 1) {
        const mx = Math.min(mask.width - 1, Math.round(x * (mask.width - 1) / Math.max(1, canvas.width - 1)));
        const normalized = Math.max(0, Math.min(1, (Number(mask.data[(my * mask.width + mx) * channels + channel]) || 0) / maskScale));
        // RGBA cut-out: keep the model's soft alpha, drop only faint edge noise.
        // Single-channel probability matte: threshold it.
        const alpha = embeddedAlpha ? smoothstep(0.025, 0.26, normalized) : smoothstep(0.18, 0.52, normalized);
        const pi = (y * canvas.width + x) * 4;
        pixels[pi + 3] = Math.round(pixels[pi + 3] * alpha);
      }
    }
    pruneCrewMatteSpecks(frame, canvas.width, canvas.height);
  }

  async function decodeCachedCutout(blob) {
    // Decode through Image → canvas, like fresh cut-outs. ImageBitmap ignores
    // WebGL's flipY upload flag in some browsers and can invert one sprite.
    const objectUrl = URL.createObjectURL(blob);
    try {
      const image = await loadImage(objectUrl);
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth || image.width || 1;
      canvas.height = image.naturalHeight || image.height || 1;
      canvasContext(canvas).drawImage(image, 0, 0);
      return canvas;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  async function cutCrew(sourceUrl) {
    const officialUrl = officialCrewCutoutUrl(sourceUrl);
    const candidates = Array.from(new Set([officialUrl, sourceUrl].filter(Boolean)));

    for (const candidate of candidates) {
      const blob = await readCutoutCache(candidate);
      if (!blob) continue;
      try {
        const canvas = await decodeCachedCutout(blob);
        return { canvas, feetPadRatio: measureFeetPad(canvas), official: false, cached: true };
      } catch (_error) { /* try the next candidate */ }
    }

    let image = null;
    let usedUrl = "";
    for (const candidate of candidates) {
      try {
        image = await loadImage(candidate);
        usedUrl = candidate;
        break;
      } catch (_error) { /* try the next candidate */ }
    }
    if (!image) throw new Error("Selected Crew artwork is unavailable");

    const srcW = image.naturalWidth || image.width || 1;
    const srcH = image.naturalHeight || image.height || 1;
    const scale = Math.min(1, CUTOUT_MAX_SIDE / Math.max(srcW, srcH));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(srcW * scale));
    canvas.height = Math.max(1, Math.round(srcH * scale));
    const ctx = canvasContext(canvas);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Official Star Atlas PNGs (and any art) that already carry alpha skip the model.
    if (crewImageHasCutoutAlpha(frame.data)) {
      const feetPadRatio = cropCrewCanvas(canvas, ctx, frame);
      if (feetPadRatio < 0) throw new Error("Crew alpha image has no silhouette");
      return { canvas, feetPadRatio, official: usedUrl === officialUrl, cached: false };
    }

    await applyCrewMatte(canvas, ctx, frame);
    const feetPadRatio = cropCrewCanvas(canvas, ctx, frame);
    if (feetPadRatio < 0) throw new Error("ISNet returned an empty Crew silhouette");
    await writeCutoutCache(usedUrl, canvas);
    return { canvas, feetPadRatio, official: false, cached: false };
  }

  // One cut per source image per page. A failed cut is forgotten so a later
  // request (for example after the network returns) can try again.
  function crewCutout(crewOrUrl) {
    const url = crewImageUrl(crewOrUrl);
    if (!url) return Promise.reject(new Error("Crew has no image"));
    if (!cutouts.has(url)) {
      const job = cutCrew(url);
      cutouts.set(url, job);
      job.catch(() => {
        if (cutouts.get(url) === job) cutouts.delete(url);
      });
    }
    return cutouts.get(url);
  }

  function prepareCrewTexture(THREE, texture) {
    if ("colorSpace" in texture && THREE.SRGBColorSpace !== undefined) texture.colorSpace = THREE.SRGBColorSpace;
    else if (THREE.sRGBEncoding !== undefined) texture.encoding = THREE.sRGBEncoding;
    // Cut-outs are NPOT canvases; no mipmaps, linear filtering, one flip convention.
    texture.generateMipmaps = false;
    if (THREE.LinearFilter !== undefined) {
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
    }
    texture.flipY = true;
    return texture;
  }

  // Returns a texture at once. userData tells the level what to show:
  // bcmCutoutPending → wait, bcmCutoutReady → draw, bcmCutoutFailed → own marker.
  // The background is never shown: a failed cut stays transparent.
  function requestCrewTexture(THREE, crewOrUrl) {
    THREE = THREE || window.THREE;
    if (!THREE || !THREE.CanvasTexture) return null;
    const blank = document.createElement("canvas");
    blank.width = 2;
    blank.height = 2;
    const texture = prepareCrewTexture(THREE, new THREE.CanvasTexture(blank));
    const data = texture.userData || (texture.userData = {});
    data.bcmCutoutPending = true;
    data.bcmCutoutReady = false;
    data.bcmCutoutFailed = false;
    texture.bcmCrewReady = crewCutout(crewOrUrl).then(
      (result) => {
        texture.image = result.canvas;
        data.bcmCutoutFeetPadRatio = result.feetPadRatio;
        data.bcmOfficialCutout = result.official;
        data.bcmCutoutPending = false;
        data.bcmCutoutReady = true;
        texture.needsUpdate = true;
        return texture;
      },
      (error) => {
        console.error("Crew cutout failed; card background hidden", crewImageUrl(crewOrUrl), error);
        data.bcmCutoutPending = false;
        data.bcmCutoutFailed = true;
        texture.needsUpdate = true;
        throw error;
      }
    );
    texture.bcmCrewReady.catch(() => {});
    return texture;
  }

  // Promise form for levels that place the sprite only once the Crew is ready.
  function loadCrewTexture(THREE, crewOrUrl) {
    const texture = requestCrewTexture(THREE, crewOrUrl);
    return texture ? texture.bcmCrewReady : Promise.reject(new Error("THREE is not available"));
  }

  window.BCMCrewCore = {
    speciesMotion: speciesMotion,
    facingFactor: facingFactor,
    readCrewProfile: readCrewProfile,
    applyPlatformSprite: applyPlatformSprite,
    officialCrewCutoutUrl: officialCrewCutoutUrl,
    crewCutout: crewCutout,
    requestCrewTexture: requestCrewTexture,
    loadCrewTexture: loadCrewTexture
  };
})();
