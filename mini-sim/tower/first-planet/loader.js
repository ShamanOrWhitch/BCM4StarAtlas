(() => {
  "use strict";

  const config = window.BCMFirstPlanetConfig || {};
  let bundlePromise = null;

  function loadBundle() {
    if (window.BCMFirstPlanet && typeof window.BCMFirstPlanet.mount === "function") {
      return Promise.resolve(window.BCMFirstPlanet);
    }
    if (bundlePromise) return bundlePromise;

    if (config.styleUrl && !document.querySelector("link[data-bcm-first-planet-style]")) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = config.styleUrl;
      link.dataset.bcmFirstPlanetStyle = "1";
      document.head.appendChild(link);
    }

    bundlePromise = new Promise((resolve, reject) => {
      if (!config.bundleUrl) {
        reject(new Error("Не задан URL сборки First Planet"));
        return;
      }
      const script = document.createElement("script");
      script.src = config.bundleUrl;
      script.async = true;
      script.onload = () => {
        const api = window.BCMFirstPlanet;
        if (api && typeof api.mount === "function") resolve(api);
        else reject(new Error("Сборка не создала BCMFirstPlanet.mount"));
      };
      script.onerror = () => reject(new Error("Не найдена wp-dist/first-planet.js"));
      document.head.appendChild(script);
    });

    return bundlePromise;
  }

  function attach(root) {
    const host = root.parentElement && root.parentElement.querySelector(".bcm-first-planet-host");
    if (!host) return;
    const mount = host.querySelector(".bcm-first-planet-root");
    const status = host.querySelector(".bcm-first-planet-load-status");
    if (!mount || !status) return;

    let preparePromise = null;
    let mounted = false;
    let planetContext = null;

    function prepare(context) {
      if (context && typeof context === "object") planetContext = context;
      if (preparePromise) return preparePromise;
      host.hidden = false;
      host.classList.add("is-preloading");
      status.hidden = false;
      status.textContent = "Загрузка First Planet…";
      preparePromise = loadBundle().then(async (api) => {
        if (!mounted) {
          try {
            await api.mount(mount, Object.assign({}, planetContext || {}, { audioUrl: config.audioUrl || "" }));
            mounted = true;
          } catch (error) {
            api.unmount(mount);
            throw error;
          }
        }
        status.hidden = true;
        return true;
      }).catch((error) => {
        status.hidden = false;
        status.textContent = "First Planet не собрана: " + (error && error.message ? error.message : "ошибка загрузки");
        return false;
      });
      return preparePromise;
    }

    root.addEventListener("bcm:tower:planet-preload", (event) => {
      prepare(event.detail || {});
    });

    root.addEventListener("bcm:tower:planet-ready", async (event) => {
      const ok = await prepare(event.detail || {});
      if (!ok) {
        host.hidden = true;
        host.classList.remove("is-preloading");
        const towerStatus = root.querySelector(".bcm-tower-status");
        if (towerStatus) towerStatus.textContent = status.textContent;
        const restart = root.querySelector(".bcm-tower-restart");
        if (restart) restart.hidden = false;
        return;
      }
      root.hidden = true;
      host.classList.remove("is-preloading");
      host.hidden = false;
      if (window.BCMMiniSimSession) window.BCMMiniSimSession.currentLocation = "first-planet";
      document.querySelectorAll(".bcm-mini-sim").forEach((element) => {
        element.style.pointerEvents = "none";
      });
    });

    // A Tower entrance on First Planet is a local location transfer, not a new game/session.
    const enterTowerFromPlanet = async (event) => {
      const detail = event?.detail || planetContext || {};
      const api = await loadBundle().catch(() => null);
      if (!api || !mounted) return;
      try {
        api.unmount(mount);
      } catch (error) {
        status.hidden = false;
        status.textContent = "Не удалось закрыть First Planet: " + (error?.message || "ошибка");
        return;
      }
      mounted = false;
      preparePromise = null;
      host.classList.remove("is-preloading");
      host.hidden = true;
      root.hidden = false;
      root.style.pointerEvents = "";
      if (window.BCMMiniSimSession) window.BCMMiniSimSession.currentLocation = "tower-ascent";
      const towerApi = window.BCMTowerAPI;
      const ok = !!(towerApi && typeof towerApi.beginAscent === "function" &&
        towerApi.beginAscent({
          seed: Number(detail.seed ?? planetContext?.seed ?? window.BCMWorldMission?.towerSeed),
          mode: detail.mode || planetContext?.mode || window.BCMWorldMission?.towerMode || "single"
        }));
      if (!ok) {
        root.hidden = true;
        host.hidden = false;
        status.hidden = false;
        status.textContent = "Не удалось открыть тот же seed Tower. Планета остаётся доступной.";
        const restored = await prepare(planetContext || detail);
        if (restored) host.hidden = false;
      }
    };

    window.addEventListener("bcm:planet:tower-enter", enterTowerFromPlanet);

    root.addEventListener("bcm:tower:space-return", () => {
      const saved = typeof window.BCMPrepareMiniSimReturn === "function"
        ? window.BCMPrepareMiniSimReturn()
        : false;
      if (!saved) {
        status.hidden = false;
        status.textContent = "Не удалось сохранить корабль для возвращения. Повтори переход.";
        return;
      }
      if (window.BCMMiniSimSession) window.BCMMiniSimSession.currentLocation = "space-labyrinth";
      // The original Mini-Sim WebGL scene was intentionally released at Tower entry.
      // Rebuild it from the compact saved session snapshot instead of keeping two renderers alive.
      window.location.reload();
    });
  }

  function boot() {
    document.querySelectorAll(".bcm-tower").forEach(attach);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
