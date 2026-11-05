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

    function prepare() {
      if (preparePromise) return preparePromise;
      host.hidden = false;
      host.classList.add("is-preloading");
      status.hidden = false;
      status.textContent = "Загрузка First Planet…";
      preparePromise = loadBundle().then(async (api) => {
        if (!mounted) {
          try {
            await api.mount(mount);
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

    root.addEventListener("bcm:tower:planet-preload", () => {
      prepare();
    });

    root.addEventListener("bcm:tower:planet-ready", async () => {
      const ok = await prepare();
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
      document.querySelectorAll(".bcm-mini-sim").forEach((element) => {
        element.style.pointerEvents = "none";
      });
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
