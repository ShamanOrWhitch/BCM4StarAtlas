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

