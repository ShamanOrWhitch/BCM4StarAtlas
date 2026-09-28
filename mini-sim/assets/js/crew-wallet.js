(() => {
  "use strict";

  const RPCS = [
    "https://solana-rpc.publicnode.com",
    "https://api.mainnet-beta.solana.com"
  ];
  const GALAXY_CREW_URL = "https://galaxy.staratlas.com/crew";
  const TOKEN_PROGRAMS = [
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
  ];

  let crewCatalogPromise = null;

  function provider() {
    const win = window;
    if (win.phantom?.solana?.isPhantom) return win.phantom.solana;
    if (win.solana?.isPhantom) return win.solana;
    return null;
  }

  async function rpc(method, params, timeout = 18000) {
    let lastError = "Solana RPC не ответил";
    for (const url of RPCS) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
          signal: AbortSignal.timeout(timeout)
        });
        const json = await response.json();
        if (json?.error) {
          lastError = json.error.message || lastError;
          continue;
        }
        if (json?.result !== undefined) return json.result;
      } catch (error) {
        lastError = error instanceof Error ? error.message : lastError;
      }
    }
    throw new Error(lastError);
  }

  function characteristicsFromCrewRow(row) {
    const out = {};
    if (!row || typeof row !== "object") return out;

    ["openness", "conscientiousness", "extraversion", "agreeableness", "neuroticism"].forEach((key) => {
      if (row[key] == null) return;
      const n = Number(row[key]);
      if (!Number.isFinite(n)) return;
      out[key] = n <= 1 ? Math.round(n * 100) : Math.round(n);
    });

    if (row.aptitudes && typeof row.aptitudes === "object") {
      out.aptitudes = Object.fromEntries(
        Object.entries(row.aptitudes).map(([name, value]) => [String(name), Number.isFinite(Number(value)) ? Number(value) : String(value)])
      );
    }

    return out;
  }

  function traitsFromCrewRow(row) {
    const traits = [];
    const add = (trait, value) => {
      if (trait == null || value == null || value === "") return;
      if (typeof value === "object") return;
      traits.push({ trait: String(trait), value: String(value) });
    };

    if (row && typeof row === "object") {
      const map = {
        openness: "Openness",
        conscientiousness: "Conscientiousness",
        extraversion: "Extraversion",
        agreeableness: "Agreeableness",
        neuroticism: "Neuroticism",
        species: "Species",
        rarity: "Rarity"
      };

      Object.entries(map).forEach(([key, label]) => {
        if (row[key] != null) {
          const n = Number(row[key]);
          add(label, Number.isFinite(n) && key !== "species" && key !== "rarity"
            ? String(n <= 1 ? Math.round(n * 100) : Math.round(n))
            : row[key]);
        }
      });

      if (row.aptitudes && typeof row.aptitudes === "object") {
        Object.entries(row.aptitudes).forEach(([name, level]) => add(name, level));
      }
    }

    return traits.slice(0, 48);
  }

  async function loadCrewCatalog() {
    if (crewCatalogPromise) return crewCatalogPromise;

    crewCatalogPromise = fetch(GALAXY_CREW_URL, {
      method: "GET",
      credentials: "omit",
      cache: "no-store",
      headers: { "accept": "application/json" },
      signal: AbortSignal.timeout(20000)
    })
      .then((response) => {
        if (!response.ok) throw new Error("Star Atlas Crew API HTTP " + response.status);
        return response.json();
      })
      .then((rows) => {
        const index = new Map();
        const list = Array.isArray(rows) ? rows : [];

        list.forEach((row) => {
          if (!row || typeof row !== "object" || !row.dasID) return;
          index.set(String(row.dasID), {
            name: String(row.name || row.dasID),
            image: String(row.imageUrl || ""),
            rarity: String(row.rarity || ""),
            species: String(row.species || ""),
            traits: traitsFromCrewRow(row),
            characteristics: characteristicsFromCrewRow(row),
            raw: row
          });
        });

        if (!index.size) {
          throw new Error("Star Atlas Crew API вернул пустой каталог.");
        }
        return index;
      });

    try {
      return await crewCatalogPromise;
    } catch (error) {
      crewCatalogPromise = null;
      throw error;
    }
  }

  function tokenRows(result) {
    return Array.isArray(result?.value) ? result.value : [];
  }

  function dasRows(result) {
    return Array.isArray(result?.items) ? result.items : [];
  }

  function normalizeTokenCrew(mint, catalogCard, amount) {
    return {
      id: mint,
      mint,
      name: catalogCard?.name || mint,
      image: catalogCard?.image || "",
      rarity: catalogCard?.rarity || "",
      species: catalogCard?.species || "",
      sex: "",
      source: "wallet",
      traits: Array.isArray(catalogCard?.traits) ? catalogCard.traits : [],
      characteristics: catalogCard?.characteristics && typeof catalogCard.characteristics === "object"
        ? catalogCard.characteristics
        : {},
      raw: catalogCard?.raw || null,
      amount: Number(amount || 0)
    };
  }

  async function directScan(owner) {
    const catalog = await loadCrewCatalog();
    const found = [];
    const seen = new Set();
    const errors = [];

    // 1) Standard SPL / Token-2022 ownership.
    for (const program of TOKEN_PROGRAMS) {
      try {
        const result = await rpc("getTokenAccountsByOwner", [
          owner,
          { programId: program },
          { encoding: "jsonParsed" }
        ]);

        for (const row of tokenRows(result)) {
          const info = row?.account?.data?.parsed?.info;
          if (!info?.mint) continue;

          const amountText = info?.tokenAmount?.uiAmountString ?? info?.tokenAmount?.uiAmount ?? 0;
          const amount = Number(amountText || 0);
          if (!(amount > 0)) continue;

          const mint = String(info.mint);
          const card = catalog.get(mint);
          if (!card || seen.has(mint)) continue;

          seen.add(mint);
          found.push(normalizeTokenCrew(mint, card, amount));
        }
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    // 2) DAS assets. Star Atlas Crew NFTs can be exposed here even when
    // getTokenAccountsByOwner does not return a usable Crew token account.
    let dasSucceeded = false;
    for (let page = 1; page <= 5; page++) {
      try {
        const result = await rpc("getAssetsByOwner", [{
          ownerAddress: owner,
          page,
          limit: 100,
          displayOptions: {
            showFungible: false,
            showZeroBalance: false
          }
        }]);

        dasSucceeded = true;
        const rows = dasRows(result);
        if (!rows.length) break;

        for (const asset of rows) {
          const mint = String(asset?.id || asset?.content?.metadata?.mint || "");
          if (!mint || seen.has(mint)) continue;

          const card = catalog.get(mint);
          if (!card) continue;

          // Crew is an NFT here; one DAS asset represents one Crew.
          const amount = 1;

          seen.add(mint);
          found.push(normalizeTokenCrew(mint, card, amount));
        }

        const total = Number(result?.total || 0);
        if (total && page * 100 >= total) break;
        if (rows.length < 100) break;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
        break;
      }
    }

    if (found.length) return found;
    if (!dasSucceeded) {
      throw new Error(
        errors.length
          ? "DAS Crew scan не доступен: " + errors.join(" · ")
          : "DAS Crew scan не вернул результат."
      );
    }
    return [];
  }
  async function wpScan(owner) {
    const wp = window.GALIA_WP;
    if (!wp?.ajax || !wp?.nonce) return [];

    const body = new FormData();
    body.set("action", "galia_desk_wallet");
    body.set("nonce", wp.nonce);
    body.set("owner", owner);

    const response = await fetch(wp.ajax, {
      method: "POST",
      body,
      credentials: "same-origin"
    });
    const json = await response.json();
    if (!json?.success) {
      throw new Error(json?.data?.message || "WP wallet scan failed");
    }

    const items = Array.isArray(json.data?.items) ? json.data.items : [];
    return items
      .filter((item) => item?.kind === "crew")
      .map((item) => ({
        id: String(item.mint || item.name || ""),
        mint: String(item.mint || ""),
        name: String(item.name || "Crew"),
        image: String(item.image || ""),
        rarity: String(item.rarity || ""),
        species: String(item.spec || ""),
        sex: "",
        source: "wallet",
        traits: Array.isArray(item.traits) ? item.traits : [],
        characteristics: item?.characteristics && typeof item.characteristics === "object"
          ? item.characteristics
          : {}
      }));
  }

  async function scanWallet(owner) {
    let directError = null;

    try {
      const direct = await directScan(owner);
      // Empty is a valid result only after SPL + DAS ownership scans complete.
      return {
        crew: direct,
        source: "star-atlas-crew-api"
      };
    } catch (error) {
      directError = error;
    }

    try {
      const viaWp = await wpScan(owner);
      return {
        crew: viaWp,
        source: "wordpress-galia-desk"
      };
    } catch (error) {
      if (directError) {
        throw new Error(
          "Star Atlas Crew API scan: " +
          (directError instanceof Error ? directError.message : String(directError)) +
          " · WP scan: " +
          (error instanceof Error ? error.message : String(error))
        );
      }
      throw error;
    }
  }

  async function connectAndScan() {
    const wallet = provider();
    if (!wallet) {
      throw new Error(
        "Phantom не найден. Нужен HTTPS/localhost; provider должен быть window.phantom.solana."
      );
    }

    const response = await wallet.connect();
    const owner = response?.publicKey?.toString?.() || "";
    if (!owner) throw new Error("Phantom не вернул публичный ключ.");

    const result = await scanWallet(owner);
    return {
      provider: wallet,
      owner,
      crew: Array.isArray(result?.crew) ? result.crew : [],
      source: result?.source || "unknown"
    };
  }

  window.BCMCrewWallet = {
    provider,
    connectAndScan,
    scanWallet,
    loadCatalog: loadCrewCatalog
  };
})();
