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

  // Historical race split (Mierese +1, others -1). Kept as public API, but since
  // 0.15.1 it does not decide mirroring: crewFace treats every race the same.
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

  /* Can the legs of this cut-out be drawn as two separate parts?
     Scans the shin band (knee → feet) of the finished cut-out for a vertical
     gap of transparent columns between the two legs. Front-facing NFT art
     often has the legs touching; then the rig keeps one leg sprite.
     pixels: RGBA of the cut-out canvas. Returns pixel and ratio measurements. */
  function measureLegGap(pixels, width, height, species) {
    const w = Math.max(1, Math.floor(Number(width) || 0));
    const h = Math.max(1, Math.floor(Number(height) || 0));
    if (!pixels || pixels.length < w * h * 4) return null;
    const rig = window.BCMCrewRig;
    const cut = rig ? rig.rigProfile(species).cut : { knee: 0.73 };
    // Shins only: the feet band often keeps the floor shadow from the NFT
    // render, which would bridge the gap between the feet.
    const y0 = Math.round(cut.knee * (h - 1));
    const y1 = Math.round(0.92 * (h - 1));
    const rows = Math.max(1, y1 - y0 + 1);
    const filled = new Array(w).fill(false);
    const body = new Array(w).fill(false);
    for (let x = 0; x < w; x += 1) {
      let opaque = 0;
      for (let y = y0; y <= y1; y += 1) if (pixels[(y * w + x) * 4 + 3] >= 24) opaque += 1;
      body[x] = opaque > 0;
      // A column between the legs is open when it is see-through on most rows.
      filled[x] = opaque / rows > 0.3;
    }
    const left = body.indexOf(true);
    const right = body.lastIndexOf(true);
    if (left < 0) return { width: w, height: h, bandY0: y0 / h, bandY1: y1 / h, gapPx: 0, gapRatio: 0, gapCenter: 0.5, splittable: false };
    let best = 0;
    let bestStart = -1;
    for (let x = left, run = 0; x <= right; x += 1) {
      run = filled[x] ? 0 : run + 1;
      if (run > best) {
        best = run;
        bestStart = x - run + 1;
      }
    }
    const legsWidth = right - left + 1;
    return {
      width: w,
      height: h,
      bandY0: y0 / h,
      bandY1: y1 / h,
      legsLeft: left / w,
      legsRight: (right + 1) / w,
      gapPx: best,
      gapRatio: best / Math.max(1, legsWidth),
      gapCenter: best ? (bestStart + best / 2) / w : 0.5,
      // A robe or long coat leaves only a narrow slit; cutting it makes the hem
      // swing in two halves. Split only clearly separate legs (Crew Lab, 0.15.0:
      // High Punaab robe 8%, other races 23–34%).
      splittable: best >= 4 && best / Math.max(1, legsWidth) >= 0.15
    };
  }

  /* Crew assembly: body + two shins cut from the finished cut-out, so the rig
     can step each leg. Thighs stay in the body; the shins hang from the knee
     line and overlap it a little to hide the seam. Returns { splittable:false }
     when the art has no gap between the legs (one-piece figure as before).
     Cached on the texture; call after bcmCutoutReady. */
  const LEG_SEAM_OVERLAP = 0.035;

  function cropToCanvas(source, sx, sy, sw, sh) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, sw);
    canvas.height = Math.max(1, sh);
    canvasContext(canvas).drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
    return canvas;
  }

  function crewLegParts(THREE, texture, species) {
    THREE = THREE || window.THREE;
    const data = texture && texture.userData;
    if (!data || !data.bcmCutoutReady || !texture.image || !texture.image.getContext) return null;
    if (data.bcmLegParts && data.bcmLegParts.image === texture.image) return data.bcmLegParts;
    const source = texture.image;
    const w = source.width;
    const h = source.height;
    const pixels = canvasContext(source).getImageData(0, 0, w, h).data;
    const measurement = measureLegGap(pixels, w, h, species);
    let parts = { image: source, splittable: false, measurement: measurement };
    if (measurement && measurement.splittable && THREE && THREE.CanvasTexture) {
      const rig = window.BCMCrewRig;
      const kneeY = rig ? rig.rigProfile(species).cut.knee : 0.73;
      const knee = Math.round(kneeY * h);
      const top = Math.max(0, knee - Math.round(LEG_SEAM_OVERLAP * h));
      const split = Math.max(1, Math.min(w - 1, Math.round(measurement.gapCenter * w)));
      const body = cropToCanvas(source, 0, 0, w, h);
      canvasContext(body).clearRect(0, knee, w, h - knee);
      const shinL = cropToCanvas(source, 0, top, split, h - top);
      const shinR = cropToCanvas(source, split, top, w - split, h - top);
      const tex = (canvas) => prepareCrewTexture(THREE, new THREE.CanvasTexture(canvas));
      parts = {
        image: source,
        splittable: true,
        measurement: measurement,
        kneeY: kneeY,
        shinTop: top / h,
        bodyTexture: tex(body),
        shinTextures: [tex(shinL), tex(shinR)],
        // Fractions of the figure width/height.
        shinWidths: [split / w, (w - split) / w],
        shinCenters: [split / w / 2 - 0.5, (split + w) / w / 2 - 0.5],
        shinHeight: (h - top) / h
      };
    }
    data.bcmLegParts = parts;
    return parts;
  }

  /* Where to draw each shin this frame, in fractions of the figure size,
     measured from the feet (y up) and the figure centre (x right on screen).
     pose: crewSpritePose(...) result. Mirroring swaps the sides. */
  function crewFigureLayout(parts, pose) {
    if (!parts || !parts.splittable || !pose || !pose.pose) return null;
    const p = pose.pose;
    const mirror = pose.face < 0 ? -1 : 1;
    const side = (i) => {
      const lift = i ? p.liftR : p.liftL;
      return {
        x: parts.shinCenters[i] * mirror,
        top: 1 - parts.shinTop + lift,
        width: parts.shinWidths[i],
        height: parts.shinHeight * (i ? p.scaleR : p.scaleL),
        // Shin swings from the knee: forward through the stride, back on push-off.
        rotation: -(i ? p.hipR : p.hipL) * 0.45 * mirror
      };
    };
    return { shins: [side(0), side(1)], mirror: mirror };
  }

  /* Which way the cut-out must be drawn. `direction` is where the Crew moves on
     screen (+1 right, -1 left). Every race, Mierese included, faces where it
     moves: right draws the art as is, left mirrors it. Owner, live 0.15.0:
     "Mierese перепутанно влево/вправо" — the 0.14.8 race split (Tower's old
     facingFactor rule) was wrong; this restores what the owner confirmed in
     0.11.3 (D-027) and applies it to Tower too. `species` is kept in the
     signature so a race-specific art fix can return with evidence. */
  function crewFace(direction, species) { // eslint-disable-line no-unused-vars
    return Number(direction) < 0 ? -1 : 1;
  }

  /* The pose of a cut-out Crew for this frame. The walk phase is advanced by dt
     through BCMCrewRig and kept in `state`, so a paused game (dt = 0) holds the
     pose and two calls in one frame do not walk twice as fast.
     actor: { crew | profile, direction | facing, moving, grounded, vy, index }.
     Returns numbers only; the level positions the sprite. */
  function crewSpritePose(actor, dt, state) {
    const profile = actor.profile || readCrewProfile(actor.crew || actor);
    const motion = profile.motion || speciesMotion("", "");
    const rig = window.BCMCrewRig || null;
    const store = state || actor;
    const moving = !!actor.moving;
    const rigProfile = rig ? rig.rigProfile(profile.species, profile.sex) : null;
    let phase = Number(store.bcmWalkPhase);
    // Two Crew of the same race should not march in lockstep.
    if (!Number.isFinite(phase)) phase = ((Number(actor.index) || 0) * 0.37) % 1;
    phase = rig
      ? rig.stepPhase(phase, dt, rigProfile, moving)
      : (phase + Math.max(0, Number(dt) || 0) * (moving ? 1 : 0.2)) % 1;
    store.bcmWalkPhase = phase;
    const pose = rig ? rig.walkPose(phase, rigProfile) : null;
    const turn = phase * Math.PI * 2;
    const sway = Math.sin(turn);        // one shoulder roll per stride
    const bounce = Math.sin(turn * 2);  // the body rises at each footfall
    const amp = moving ? 1 : 0.35;
    const hanging = !!actor.hanging;
    const grounded = actor.grounded !== false;
    const velocityY = Number(actor.vy) || 0;
    const rising = !grounded && !hanging && velocityY > 0.35;
    const falling = !grounded && !hanging && velocityY < -0.35;
    let landingRemaining = Math.max(0, Number(store.bcmLandingRemaining) || 0);
    if (grounded && store.bcmWasGrounded === false) landingRemaining = 0.12;
    else landingRemaining = Math.max(0, landingRemaining - Math.max(0, Number(dt) || 0));
    store.bcmLandingRemaining = landingRemaining;
    store.bcmWasGrounded = grounded;
    const climbing = !!actor.climbing;
    const motionState = hanging ? "hang" : climbing ? "climb" : rising ? "jump-rise" : falling ? "fall"
      : landingRemaining > 0 ? "land" : moving ? (Number(actor.speed) >= 8 ? "run" : "walk") : "idle";
    const squash = moving ? 1 + bounce * motion.squash : 1;
    const direction = actor.direction !== undefined ? actor.direction : actor.facing;
    return {
      face: crewFace(direction, profile.species),
      phase: phase,
      pose: pose,
      state: motionState,
      bob: hanging ? 0 : bounce * motion.bob * amp + (falling ? -0.06 : rising ? 0.025 : 0),
      scaleX: hanging ? 0.9 : falling ? 0.92 : rising ? 0.96 : motionState === "land" ? 1.06 : squash,
      scaleY: hanging ? 1.14 : falling ? 1.12 : rising ? 1.06 : motionState === "land" ? 0.92 : 1 / Math.max(0.82, squash),
      rotation: hanging || climbing ? 0 : sway * motion.sway * amp,
      rising: rising,
      falling: falling,
      landing: state === "land",
      // Hanging from a ledge: stretched, still, no walk sway.
      hanging: hanging
    };
  }

  // Draws the cut-out the way crewSpritePose says: mirror, stretch, roll, bob.
  // Ring and Hull Dive call this with their own dt.
  function applyPlatformSprite(sprite, actor, dt) {
    if (!sprite || !actor) return 0;
    const data = sprite.userData || (sprite.userData = {});
    const pose = crewSpritePose(actor, dt !== undefined ? dt : actor.dt, data);
    // Kept so a level can lay out the shins (crewFigureLayout) without
    // advancing the walk a second time this frame.
    data.bcmLastPose = pose;
    const map = sprite.material && sprite.material.map;
    if (map) {
      map.wrapS = 1000;
      map.repeat.x = pose.face < 0 ? -1 : 1;
      map.offset.x = pose.face < 0 ? 1 : 0;
    }
    if (!data.bcmBaseScale) {
      data.bcmBaseScale = {
        x: Math.abs(sprite.scale.x) || 1,
        y: Math.abs(sprite.scale.y) || 1
      };
    }
    sprite.scale.x = data.bcmBaseScale.x * pose.scaleX;
    sprite.scale.y = data.bcmBaseScale.y * pose.scaleY;
    if (sprite.material) sprite.material.rotation = pose.rotation;
    if (Number.isFinite(actor.y)) sprite.position.y = actor.y + pose.bob;
    return pose.bob;
  }

  /* ---------------------------------------------------------------------------
     The figure (owner 24.11.2026: "перебросить центральным управлением всё по rig и
     анимациям в crew-core"). One assembler for every level: the body without its shins,
     two shin sprites that step under it with the walking rig, the mirror, the bob and the
     roll. A level only says where the feet are and how to place a point beside them.
     ------------------------------------------------------------------------- */
  function createCrewLegs(THREE, parent, renderOrder) {
    THREE = THREE || window.THREE;
    return [0, 1].map(function () {
      const shin = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, alphaTest: 0.035 }));
      shin.visible = false;
      shin.center.set(0.5, 1);
      shin.renderOrder = renderOrder || 9;
      if (parent) parent.add(shin);
      return shin;
    });
  }

  function mirrorMap(map, face) {
    if (!map) return;
    map.wrapS = 1000; // THREE.RepeatWrapping
    map.repeat.x = face < 0 ? -1 : 1;
    map.offset.x = face < 0 ? 1 : 0;
  }

  /* opts: { texture (the full cutout), height (m), feetY (world y of the soles),
     place(along, y) → {x, y, z} (along = metres to the screen right of the figure centre),
     pose (an already computed crewSpritePose, so a level does not step twice),
     rotationScale (Tower rolls less), minWidth, maxWidth }. Returns the pose. */
  function applyCrewFigure(THREE, sprite, legs, actor, dt, opts) {
    if (!sprite || !actor) return null;
    const o = opts || {};
    const data = sprite.userData || (sprite.userData = {});
    const pose = o.pose || crewSpritePose(actor, dt, data);
    data.bcmLastPose = pose;
    const texture = o.texture || (sprite.material && sprite.material.map);
    const profile = actor.profile || readCrewProfile(actor.crew || actor);
    const parts = texture ? crewLegParts(THREE, texture, profile.species) : null;
    const body = parts && parts.splittable ? parts.bodyTexture : texture;
    if (sprite.material && body && sprite.material.map !== body) {
      sprite.material.map = body;
      sprite.material.needsUpdate = true;
    }
    mirrorMap(sprite.material && sprite.material.map, pose.face);
    const height = Number(o.height) || 1.8;
    const image = texture && texture.image;
    const aspect = image ? Number(image.width || 1) / Math.max(1, Number(image.height || 1)) : 0.6;
    const width = Math.max(o.minWidth || 0.55, Math.min(o.maxWidth || 1.75, height * aspect));
    const pad = Number(texture && texture.userData && texture.userData.bcmCutoutFeetPadRatio || 0);
    const feetY = (Number(o.feetY) || 0) - pad * height + pose.bob;
    const place = typeof o.place === "function" ? o.place : function (along, y) { return { x: along, y: y, z: 0 }; };
    sprite.center.set(0.5, 0);
    const at = place(0, feetY);
    sprite.position.set(at.x, at.y, at.z);
    sprite.scale.set(width * pose.scaleX, height * pose.scaleY, 1);
    // Side views roll with the pose; Tower passes a smaller roll that follows the mirror.
    if (sprite.material) {
      sprite.material.rotation = o.rotationScale === undefined ? pose.rotation : pose.rotation * pose.face * o.rotationScale;
    }
    const layout = crewFigureLayout(parts, pose);
    (legs || []).forEach(function (shin, side) {
      const part = layout && layout.shins[side];
      shin.visible = !!part && sprite.visible !== false;
      if (!part) return;
      if (shin.material.map !== parts.shinTextures[side]) {
        shin.material.map = parts.shinTextures[side];
        shin.material.needsUpdate = true;
      }
      mirrorMap(shin.material.map, layout.mirror);
      const p = place(part.x * width * pose.scaleX, feetY + part.top * height * pose.scaleY);
      shin.position.set(p.x, p.y, p.z);
      shin.scale.set(part.width * width * pose.scaleX, part.height * height * pose.scaleY, 1);
      shin.material.rotation = part.rotation;
    });
    return pose;
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

  /* Shared Mini-Sim input normalization. Levels bind physical sources through
     this adapter and consume one action intent; they do not maintain their own
     keyboard/gamepad/touch action tables. One-shot actions are latched until the
     next read, so a quick tap between rendered frames is not lost. */
  /* ---------------------------------------------------------------------------
     Control schemes by game form (owner 24.11.2026: "управление должно быть прописано не для каждой
     планеты отдельно, а для разных игр в crew-core и подгружено нужное по форме уровня").
     One table per kind of game; a level asks for its form and gets the gamepad → key mapping.
       island — walking and riding on a planet (First Planet, any planet; Opus fire on B)
       race   — Shoal Race: RT throttle, LT brake, A drift, X item
     Stick and d-pad give W A S D in every form; Start is always Escape (pause).
     ------------------------------------------------------------------------- */
  const CONTROL_SCHEMES = {
    island: {
      title: "Остров",
      buttons: [[0, "Space"], [2, "KeyE"], [3, "KeyF"], [1, "KeyX"], [5, "ShiftLeft"], [4, "KeyQ"], [8, "KeyC"], [11, "KeyT"], [7, "KeyW"], [6, "KeyS"]],
      hint: "Стик — ходьба · A — прыжок/вверх · X — говорить · Y — сесть · RB — форсаж · Start — пауза"
    },
    race: {
      title: "Гонка",
      buttons: [[7, "KeyW"], [6, "KeyS"], [0, "Space"], [2, "KeyE"], [5, "ShiftLeft"], [3, "KeyV"]],
      hint: "Стик — руль · RT — газ · LT — тормоз · A — дрифт · X — предмет · Start — пауза"
    }
  };
  const PAD_DEAD = 0.35;
  const PAD_TRIGGER = 0.3;

  function controlScheme(form) {
    return CONTROL_SCHEMES[form] || CONTROL_SCHEMES.island;
  }

  function padButtonDown(pad, i) {
    const b = pad && pad.buttons && pad.buttons[i];
    return !!b && (b.pressed || Number(b.value) > PAD_TRIGGER);
  }

  /** Keys the pad presses in this game form (the same codes the keyboard sends). */
  function padKeysFor(form, pad) {
    const keys = new Set();
    if (!pad) return keys;
    const x = Number(pad.axes && pad.axes[0]) || 0;
    const y = Number(pad.axes && pad.axes[1]) || 0;
    if (x < -PAD_DEAD || padButtonDown(pad, 14)) keys.add("KeyA");
    if (x > PAD_DEAD || padButtonDown(pad, 15)) keys.add("KeyD");
    if (y < -PAD_DEAD || padButtonDown(pad, 12)) keys.add("KeyW");
    if (y > PAD_DEAD || padButtonDown(pad, 13)) keys.add("KeyS");
    controlScheme(form).buttons.forEach(function (pair) { if (padButtonDown(pad, pair[0])) keys.add(pair[1]); });
    return keys;
  }

  /** Menus: index of the nearest button rect in the pushed direction (stays put when none). */
  function nextMenuFocus(rects, from, dir) {
    const a = rects[from];
    if (!a) return 0;
    const ax = a.x + a.w / 2;
    const ay = a.y + a.h / 2;
    let best = from;
    let bestScore = Infinity;
    rects.forEach(function (r, i) {
      if (i === from) return;
      const dx = r.x + r.w / 2 - ax;
      const dy = r.y + r.h / 2 - ay;
      const along = dir === "up" ? -dy : dir === "down" ? dy : dir === "left" ? -dx : dx;
      const across = dir === "up" || dir === "down" ? Math.abs(dx) : Math.abs(dy);
      if (along <= 4) return;
      const score = along + across * 2;
      if (score < bestScore) { bestScore = score; best = i; }
    });
    return best;
  }

  function createCrewControls(options) {
    const opts = options || {};
    const playerIndex = Math.max(0, Math.floor(Number(opts.playerIndex) || 0));
    const states = { keyboard: {}, touch: {}, gamepad: {} };
    const edges = { jump: false, dash: false, activate: false, floor: false };
    let previousJump = false;
    const clamp = (value) => Math.max(-1, Math.min(1, Number(value) || 0));
    const bindings = playerIndex === 0
      ? {
          ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
          ArrowUp: "up", ArrowDown: "down", Space: "jump", KeyW: "jump",
          KeyQ: "fire", KeyE: "activate", KeyR: "floor", KeyC: "dash",
          ShiftLeft: "dash", ShiftRight: "dash"
        }
      : {
          KeyJ: "left", KeyL: "right", KeyT: "up", KeyG: "down", KeyP: "jump",
          KeyK: "fire", KeyO: "activate", KeyI: "floor", KeyU: "dash"
        };
    const validActions = new Set(["left", "right", "up", "down", "jump", "fire", "dash", "activate", "floor"]);

    function set(source, action, down) {
      if (!validActions.has(action)) return false;
      const values = states[source];
      if (!values) return false;
      const pressed = !!down;
      const wasPressed = !!values[action];
      values[action] = pressed;
      if (pressed && !wasPressed && Object.prototype.hasOwnProperty.call(edges, action)) edges[action] = true;
      return true;
    }

    function key(code, down, repeat) {
      const action = bindings[String(code || "")];
      if (!action) return null;
      if (repeat && (action === "activate" || action === "dash" || action === "floor" || action === "jump")) return action;
      set("keyboard", action, down);
      return action;
    }

    function touch(action, down) {
      const normalized = ({ up: "up", down: "down", moveUp: "up", moveDown: "down" })[action] || action;
      return set("touch", normalized, down);
    }

    function gamepad(pad) {
      const state = {};
      states.gamepad.axisX = 0;
      states.gamepad.axisY = 0;
      if (pad && pad.connected !== false) {
        const axis = (index) => Number(pad.axes && pad.axes[index]) || 0;
        const button = (index) => !!(pad.buttons && pad.buttons[index] && pad.buttons[index].pressed);
        const ax = Math.abs(axis(0)) < 0.22 ? 0 : clamp(axis(0));
        const ay = Math.abs(axis(1)) < 0.22 ? 0 : clamp(axis(1));
        if (button(14)) state.left = true;
        if (button(15)) state.right = true;
        if (button(12)) state.up = true;
        if (button(13)) state.down = true;
        states.gamepad.axisX = ax;
        states.gamepad.axisY = ay;
        for (const [index, action] of [[0, "jump"], [1, "dash"], [2, "activate"], [3, "fire"], [4, "floor"]]) {
          if (button(index)) state[action] = true;
        }
      }
      Object.keys(states.gamepad).forEach((action) => set("gamepad", action, false));
      Object.keys(state).forEach((action) => set("gamepad", action, true));
    }

    function intent() {
      const all = [states.keyboard, states.touch, states.gamepad];
      const held = (action) => all.some((source) => !!source[action]);
      const moveX = clamp((held("right") ? 1 : 0) - (held("left") ? 1 : 0) + (Number(states.gamepad.axisX) || 0));
      const moveY = clamp((held("down") ? 1 : 0) - (held("up") ? 1 : 0) + (Number(states.gamepad.axisY) || 0));
      const jump = held("jump");
      const result = {
        moveX,
        moveY,
        jump,
        jumpEdge: !!edges.jump || (jump && !previousJump),
        fire: held("fire"),
        dash: !!edges.dash,
        activate: !!edges.activate,
        floor: !!edges.floor
      };
      previousJump = jump;
      Object.keys(edges).forEach((action) => { edges[action] = false; });
      return result;
    }

    function clear() {
      Object.keys(states).forEach((source) => {
        Object.keys(states[source]).forEach((action) => { states[source][action] = false; });
      });
      Object.keys(edges).forEach((action) => { edges[action] = false; });
      previousJump = false;
    }

    return { key, touch, gamepad, intent, clear };
  }

  /* Ledge grab (owner 20.11.2026: movement and animation live in crew core).
     One step of the grab for a Crew in a side view. Pure: the level passes its
     geometry as ledgeAt(x, footY, dir) -> { top, edgeX } | null (a block top the
     hands can reach, with room above it) and applies what comes back.
     actor: { x, y (feet), vy, facing, grounded, hang }
     input: { jumpEdge (jump pressed this frame), dir (-1, 0, +1) }
     Returns null (nothing to do) or { hang, x, y, vy, grounded, grabbed?, climbed?, dropped? }. */
  const HANG_DROP = 1.62; // feet below the ledge top while hanging
  function crewLedgeStep(actor, input, ledgeAt) {
    const a = actor || {};
    const i = input || {};
    if (a.hang) {
      const h = a.hang;
      if (i.jumpEdge) {
        return { hang: null, x: h.edgeX + h.dir * 0.45, y: h.top, vy: 0, grounded: true, climbed: true };
      }
      if (Number(i.dir) === -h.dir) {
        return { hang: null, x: h.edgeX - h.dir * 0.6, y: h.top - HANG_DROP, vy: -0.5, grounded: false, dropped: true };
      }
      return { hang: h, x: h.edgeX - h.dir * 0.34, y: h.top - HANG_DROP, vy: 0, grounded: false };
    }
    if (a.grounded || Number(a.vy) > 2.5 || typeof ledgeAt !== "function") return null;
    const dir = Number(a.facing) < 0 ? -1 : 1;
    const ledge = ledgeAt(Number(a.x) + dir * 0.5, Number(a.y), dir);
    if (!ledge) return null;
    const hang = { top: ledge.top, edgeX: ledge.edgeX, dir: dir };
    return { hang: hang, x: ledge.edgeX - dir * 0.34, y: ledge.top - HANG_DROP, vy: 0, grounded: false, grabbed: true };
  }

  window.BCMCrewCore = {
    createCrewControls: createCrewControls,
    crewLedgeStep: crewLedgeStep,
    speciesMotion: speciesMotion,
    facingFactor: facingFactor,
    readCrewProfile: readCrewProfile,
    applyPlatformSprite: applyPlatformSprite,
    crewFace: crewFace,
    crewSpritePose: crewSpritePose,
    measureLegGap: measureLegGap,
    crewLegParts: crewLegParts,
    crewFigureLayout: crewFigureLayout,
    createCrewLegs: createCrewLegs,
    controlScheme: controlScheme,
    padKeysFor: padKeysFor,
    padButtonDown: padButtonDown,
    nextMenuFocus: nextMenuFocus,
    applyCrewFigure: applyCrewFigure,
    officialCrewCutoutUrl: officialCrewCutoutUrl,
    crewCutout: crewCutout,
    requestCrewTexture: requestCrewTexture,
    loadCrewTexture: loadCrewTexture
  };
})();
