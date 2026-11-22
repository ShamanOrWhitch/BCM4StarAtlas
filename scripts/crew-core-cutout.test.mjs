// Owner directive 15 Nov 2026 (WORK LOCK #116): crew-core.js cuts the NFT
// background and assembles the Crew character once; levels only display it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const read = (p) => readFile(new URL(`../${p}`, import.meta.url), "utf8");

// Runtime scripts the plugin actually loads (bcm-mini-sim.php / bcm-tower.php).
const RUNTIME = {
  "crew-core.js": "mini-sim/assets/js/crew-core.js",
  "tower.js": "mini-sim/tower/assets/js/tower.js",
  "hull-dive.js": "mini-sim/assets/js/hull-dive.js",
  "deep-space-warp.js": "mini-sim/assets/js/deep-space-warp.js",
  "mini-sim.js": "mini-sim/assets/js/mini-sim.js",
};

async function filesContaining(re) {
  const hits = [];
  for (const [name, path] of Object.entries(RUNTIME)) if (re.test(await read(path))) hits.push(name);
  return hits;
}

test("only crew-core.js owns the Crew background cutout (model, matte, cache)", async () => {
  assert.deepEqual(await filesContaining(/isnet-general-use-onnx/), ["crew-core.js"], "ISNet model is loaded outside crew-core");
  assert.deepEqual(await filesContaining(/@huggingface\/transformers/), ["crew-core.js"], "Transformers.js is imported outside crew-core");
  assert.deepEqual(await filesContaining(/caches\.open\("bcm-tower-crew-cutouts-v8"\)/), ["crew-core.js"], "cutout cache is opened outside crew-core");
  assert.deepEqual(await filesContaining(/function pruneCrewMatteSpecks|function crewImageHasCutoutAlpha|function crewPixelsHaveCutoutAlpha/), ["crew-core.js"], "matte helpers duplicated");
});

test("levels request the Crew from crew-core and Ring no longer needs Tower loaded", async () => {
  const warp = (await read(RUNTIME["deep-space-warp.js"])) + "\n" + (await read("mini-sim/assets/js/ring-platformer.js"));
  const start = warp.indexOf("function makePlayerSprite(player)");
  const ring = warp.slice(start, warp.indexOf("function playerWorldPosition", start));
  assert.ok(start > 0, "Ring makePlayerSprite not found");
  assert.doesNotMatch(ring, /BCMTowerAPI/, "Ring sprite still depends on Tower being loaded (BUG-002)");
  assert.match(ring, /BCMCrewCore\.requestCrewTexture/);
  const tower = await read(RUNTIME["tower.js"]);
  assert.match(tower, /BCMCrewCore\.requestCrewTexture/);
  assert.match(tower, /window\.BCMTowerAPI\.makeCrewSpriteTexture = \(url\)/, "public Tower alias kept");
  const hull = await read(RUNTIME["hull-dive.js"]);
  assert.match(hull, /BCMCrewCore\.loadCrewTexture/);
  assert.match(hull, /window\.BCMCrewCutout = \{/, "public BCMCrewCutout alias kept");
});

// ---------- behaviour of the core service in a VM with a fake 2D canvas ----------

function makeEnv({ images, segmenter }) {
  const loads = [];
  class FakeCtx {
    constructor(c) { this.c = c; }
    clearRect() { this.c.px = new Uint8ClampedArray(this.c.width * this.c.height * 4); }
    drawImage(img, ...a) {
      // Supported forms: (img, 0, 0) / (img, 0, 0, w, h) at same size, and crop (img, sx, sy, sw, sh, 0, 0, sw, sh).
      const src = img.px ? img : img;
      const [sx, sy] = a.length >= 8 ? [a[0], a[1]] : [0, 0];
      const w = this.c.width, h = this.c.height;
      const out = new Uint8ClampedArray(w * h * 4);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const X = x + sx, Y = y + sy;
        if (X >= src.width || Y >= src.height) continue;
        for (let k = 0; k < 4; k++) out[(y * w + x) * 4 + k] = src.px[(Y * src.width + X) * 4 + k];
      }
      this.c.px = out;
    }
    getImageData(x0, y0, w, h) {
      const data = new Uint8ClampedArray(w * h * 4);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
        for (let k = 0; k < 4; k++) data[(y * w + x) * 4 + k] = this.c.px[((y + y0) * this.c.width + x + x0) * 4 + k];
      return { data, width: w, height: h };
    }
    putImageData(frame) {
      this.c.width = frame.width; this.c.height = frame.height; this.c.px = new Uint8ClampedArray(frame.data);
    }
  }
  class FakeCanvas {
    constructor() { this._w = 1; this._h = 1; this.px = new Uint8ClampedArray(4); }
    get width() { return this._w; } set width(v) { this._w = v; this.px = new Uint8ClampedArray(v * this._h * 4); }
    get height() { return this._h; } set height(v) { this._h = v; this.px = new Uint8ClampedArray(this._w * v * 4); }
    getContext() { return new FakeCtx(this); }
  }
  class FakeImage {
    set src(url) {
      this._src = url; loads.push(url);
      queueMicrotask(() => {
        const def = images[url];
        if (!def) return this.onerror && this.onerror(new Error("404"));
        Object.assign(this, def, { naturalWidth: def.width, naturalHeight: def.height });
        this.onload && this.onload();
      });
    }
    get src() { return this._src; }
  }
  class CanvasTexture { constructor(image) { this.image = image; this.userData = {}; this.needsUpdate = false; } }
  const THREE = { CanvasTexture, sRGBEncoding: 3001, LinearFilter: 1006 };
  const window = { THREE, location: { origin: "https://example.test" }, BCMCrewCoreTestSegmenter: segmenter };
  const context = vm.createContext({
    window, THREE, console, Image: FakeImage, Promise, Math, Number, String, Array, Set, Map, Error, Uint8Array, Uint8ClampedArray,
    queueMicrotask, setTimeout, performance: { now: () => 0 },
    document: { createElement: () => new FakeCanvas() },
  });
  return { context, window, loads, THREE };
}

function figure(width, height, { opaqueBackground = false, top = 6, bottom = 30, left = 12, right = 24 } = {}) {
  const px = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    const body = y >= top && y <= bottom && x >= left && x <= right;
    px[i] = body ? 200 : 255; px[i + 1] = body ? 60 : 255; px[i + 2] = body ? 40 : 255;
    px[i + 3] = body || opaqueBackground ? 255 : 0;
  }
  return { width, height, px };
}

async function loadCore(env) {
  vm.runInContext(await read(RUNTIME["crew-core.js"]), env.context);
  return env.window.BCMCrewCore;
}
const settle = () => new Promise((r) => setTimeout(r, 5));

test("official alpha PNG: one load, cropped silhouette, texture goes pending → ready, shared between levels", async () => {
  const full = "https://cdn.staratlas.com/crew/v1/42_full.jpg";
  const official = "https://cdn.staratlas.com/crew/v1/42.png";
  const env = makeEnv({ images: { [official]: figure(40, 40) } });
  const core = await loadCore(env);
  assert.equal(core.officialCrewCutoutUrl(full), official);

  const towerTex = core.requestCrewTexture(env.THREE, full);
  assert.equal(towerTex.userData.bcmCutoutPending, true, "texture must start pending");
  assert.equal(towerTex.userData.bcmCutoutReady, false);
  const ringTex = core.requestCrewTexture(env.THREE, { image: full });
  await settle();

  for (const tex of [towerTex, ringTex]) {
    assert.equal(tex.userData.bcmCutoutPending, false);
    assert.equal(tex.userData.bcmCutoutReady, true);
    assert.equal(tex.userData.bcmCutoutFailed, false);
    assert.equal(tex.userData.bcmOfficialCutout, true);
    assert.equal(tex.needsUpdate, true);
    assert.ok(tex.image.width <= 21 && tex.image.height <= 34, `cropped to the figure, got ${tex.image.width}x${tex.image.height}`);
    assert.equal(tex.encoding, env.THREE.sRGBEncoding, "r128 colour space");
  }
  assert.deepEqual(env.loads, [official], "the core cuts each Crew once, not once per level");
  assert.ok(towerTex.userData.bcmCutoutFeetPadRatio >= 0 && towerTex.userData.bcmCutoutFeetPadRatio < 0.2);
});

test("card with opaque background goes through the segmenter matte; failure is reported, not shown as raw card", async () => {
  const card = "https://example.test/card.png";
  const seen = [];
  const segmenter = async (canvas) => {
    seen.push([canvas.width, canvas.height]);
    const mask = { width: canvas.width, height: canvas.height, channels: 1, data: new Uint8Array(canvas.width * canvas.height) };
    for (let y = 6; y <= 30; y++) for (let x = 12; x <= 24; x++) mask.data[y * canvas.width + x] = 255;
    return [{ mask }];
  };
  const env = makeEnv({ images: { [card]: figure(48, 48, { opaqueBackground: true }) }, segmenter });
  const core = await loadCore(env);
  const tex = core.requestCrewTexture(env.THREE, card);
  await settle();
  assert.equal(seen.length, 1, "segmenter runs once");
  assert.equal(tex.userData.bcmCutoutReady, true);
  assert.ok(tex.image.width <= 21, `background cropped away, got ${tex.image.width}`);
  const corner = tex.image.getContext("2d").getImageData(0, 0, 1, 1).data[3];
  assert.equal(corner, 0, "card background is transparent after the matte");

  const env2 = makeEnv({ images: { [card]: figure(48, 48, { opaqueBackground: true }) }, segmenter: async () => { throw new Error("offline"); } });
  const core2 = await loadCore(env2);
  const bad = core2.requestCrewTexture(env2.THREE, card);
  await settle();
  assert.equal(bad.userData.bcmCutoutFailed, true);
  assert.equal(bad.userData.bcmCutoutReady, false);
  await assert.rejects(core2.loadCrewTexture(env2.THREE, card));
});
