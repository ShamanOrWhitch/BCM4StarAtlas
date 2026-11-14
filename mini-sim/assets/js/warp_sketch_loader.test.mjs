/* Загрузчик обоев seed: путь из config.assets, фолбэк рядом со скриптом,
 * отказ картинки -> процедурный фон, и точечный сброс только ждущих сцен.
 * Тестируется сам сниппет, который build_patch.py вставляет в игру. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const loaderSrc = readFileSync(new URL("./warp_sketch_loader.js", import.meta.url), "utf8");

/* Заглушка Image: поведение задаётся сценарием (ok / error), src — запоминается. */
function imageFactory(mode, log) {
  return function Image() {
    const img = { decoding: "", onload: null, onerror: null, _src: "" };
    Object.defineProperty(img, "src", {
      get() { return img._src; },
      set(value) {
        img._src = value;
        if (log) log.push(value);
        if (mode === "ok") { if (img.onload) img.onload(); }
        else if (mode === "error") { if (img.onerror) img.onerror(); }
      }
    });
    return img;
  };
}

function makeLoader({ config = {}, document = null, state = {}, imageMode = "idle", log = [] } = {}) {
  const warpSpace = {
    WARP_SPACE_SKETCHES: ["01-star-tunnel.svg", "02-particle-seed.svg", "03-energy-waves.svg"],
    warpSpaceSketchFor: (i) => {
      const n = Math.abs(Math.trunc(i) || 0) % 3;
      return warpSpace.WARP_SPACE_SKETCHES[n];
    },
    createSketchCache: (img, w, h, makeCanvas) => {
      const canvas = makeCanvas(w, h);
      canvas.painted = true;
      return { canvas, w, h, scale: 1, id: "sketch" };
    }
  };
  const warpBgStore = new Map();
  const warpBgOrder = [];
  const fakeDocument = document || { currentScript: null, querySelector: () => null };
  if (!fakeDocument.createElement) {
    fakeDocument.createElement = () => ({ width: 0, height: 0, painted: true });
  }
  const factory = new Function(
    "config", "document", "state", "warpSpace", "warpBgStore", "warpBgOrder", "Image",
    loaderSrc +
      "\nreturn { warpSketchUrl, warpSketchBaseUrl, warpSketchName, loadWarpSketch," +
      " warpSketchScene, warpSketchDropPending, warpSketchImages, warpSketchLoading };\n"
  );
  const api = factory(config, fakeDocument, state, warpSpace, warpBgStore, warpBgOrder,
    imageFactory(imageMode, log));
  return { api, warpBgStore, warpBgOrder, log };
}

test("URL скетча берётся из config.assets, как GLB астероидной стенки", () => {
  const { api } = makeLoader({
    config: {
      assets: [
        { type: "model", name: "rock.glb", url: "assets/models/rock.glb" },
        { type: "image", name: "02-particle-seed.svg", url: "mini-sim/assets/scetchs/02-particle-seed.svg" }
      ]
    }
  });
  assert.equal(api.warpSketchUrl("02-particle-seed.svg"), "mini-sim/assets/scetchs/02-particle-seed.svg");
  // файла нет в манифесте — относительный путь рядом со скриптом, без исключения
  assert.ok(api.warpSketchUrl("03-energy-waves.svg").endsWith("03-energy-waves.svg"));
});

test("фолбэк: config.warpSketchBaseUrl, иначе папка рядом с самим скриптом", () => {
  const withBase = makeLoader({ config: { warpSketchBaseUrl: "/wp-content/scetchs" } }).api;
  assert.equal(withBase.warpSketchUrl("01-star-tunnel.svg"), "/wp-content/scetchs/01-star-tunnel.svg");

  const fromScript = makeLoader({
    document: {
      currentScript: null,
      querySelector: () => ({ src: "https://walkingyog.com/bcm4sa/mini-sim/assets/js/deep-space-warp.js?ver=0.14.0" })
    }
  }).api;
  const url = fromScript.warpSketchUrl("01-star-tunnel.svg");
  assert.ok(url.startsWith("https://walkingyog.com/bcm4sa/mini-sim/assets/js/"), url);
  assert.ok(url.endsWith("../scetchs/01-star-tunnel.svg"), url);
  assert.ok(!url.includes("?ver="), "строка запроса не должна попадать в путь к файлу");
});

test("ошибка загрузки SVG: фолбэк на процедурный фон, без повторов и исключений", () => {
  const { api, log } = makeLoader({ imageMode: "error" });
  const first = api.warpSketchScene("01-star-tunnel.svg", 880, 495);
  assert.equal(first, null, "пока картинки нет, сцены быть не должно");
  assert.equal(api.warpSketchImages.get("01-star-tunnel.svg"), null, "отказ запоминается");
  const second = api.warpSketchScene("01-star-tunnel.svg", 880, 495);
  assert.equal(second, null);
  assert.equal(log.length, 1, "к отсутствующему файлу не должно быть повторных запросов");
  assert.equal(api.warpSketchLoading.size, 0, "состояние загрузки не залипло");
});

test("картинка пришла — сцена растеризуется один раз и переиспользуется", () => {
  const { api } = makeLoader({ imageMode: "ok" });
  const one = api.warpSketchScene("02-particle-seed.svg", 880, 495);
  assert.ok(one && one.canvas.painted, "сцена должна собраться из SVG");
  const two = api.warpSketchScene("02-particle-seed.svg", 880, 495);
  assert.equal(two, one, "повторный запрос обязан вернуть тот же offscreen-кэш");
  // другой размер — другой кэш, иначе картинка растянется
  const three = api.warpSketchScene("02-particle-seed.svg", 400, 900);
  assert.notEqual(three, one);
});

test("картинка пришла позже: сбрасываются только ждущие сцены", () => {
  const { api, warpBgStore, warpBgOrder } = makeLoader({ imageMode: "ok" });
  warpBgStore.set("0|sk", { key: "0|sk", pendingSketch: true });
  warpBgStore.set("1|sk", { key: "1|sk" });
  warpBgStore.set("0|pr", { key: "0|pr" });
  warpBgOrder.push("0|sk", "1|sk", "0|pr");

  api.loadWarpSketch("01-star-tunnel.svg");   // onload внутри stub-а -> dropPending
  assert.ok(!warpBgStore.has("0|sk"), "ждавшая сцена должна пересобраться из картинки");
  assert.ok(warpBgStore.has("1|sk"), "валидный соседний фон не трогаем");
  assert.ok(warpBgStore.has("0|pr"), "процедурный фон не трогаем");
  assert.deepEqual(warpBgOrder, ["1|sk", "0|pr"]);
});

test("ручной выбор скетча важнее ряда, индекс — по кругу", () => {
  const { api } = makeLoader({ state: { warpSketch: null } });
  assert.equal(api.warpSketchName(0), "01-star-tunnel.svg");
  assert.equal(api.warpSketchName(2), "03-energy-waves.svg");
  assert.equal(api.warpSketchName(5), "03-energy-waves.svg", "ряд замыкается по кругу");
  const forced = makeLoader({ state: { warpSketch: "02-particle-seed.svg" } }).api;
  assert.equal(forced.warpSketchName(0), "02-particle-seed.svg");
  assert.equal(forced.warpSketchName(9), "02-particle-seed.svg");
});
