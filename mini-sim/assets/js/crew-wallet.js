(() => {
  "use strict";

  // Same public read as BCM4SA desk.impl.ts: token accounts, then DAS.
  // api.mainnet.solana.com is the endpoint that actually returned this wallet.
  // Standard Solana RPCs only. PublicNode is NOT a DAS endpoint and
  // rejects getAssetsByOwner / asks for an indexer token, so it must not
  // be used as a DAS fallback.
  const RPCS = [
    "https://api.mainnet.solana.com",
    "https://api.mainnet-beta.solana.com"
  ];
  const CREW_URL = "https://galaxy.staratlas.com/crew";
  const NFTS_URL = "https://galaxy.staratlas.com/nfts";
  const SOLANAFM_URL = "https://api.solana.fm/v1/addresses/";
  const TOKEN_PROGRAMS = [
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
  ];
  const APTITUDES = ["Command", "Flight", "Operator", "Engineering", "Medical", "Science", "Fitness", "Hospitality"];

  let crewByDas = null;
  let nftByMint = null;

  function provider() {
    const win = window;
    const candidates = [
      win.phantom?.solana,
      win.solana,
      ...(Array.isArray(win.solana?.providers) ? win.solana.providers : [])
    ].filter(Boolean);
    return candidates.find((candidate) => candidate?.isPhantom) || null;
  }

  function ocean(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return n <= 1 ? Math.round(n * 100) : Math.round(n);
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
          lastError = url + ": " + (json.error.message || "RPC ошибка");
          continue;
        }
        if (json?.result !== undefined) return json.result;
      } catch (error) {
        lastError = url + ": " + (error instanceof Error ? error.message : String(error));
      }
    }
    throw new Error(lastError);
  }

  async function loadCrewIndex() {
    if (crewByDas) return crewByDas;
    const response = await fetch(CREW_URL, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error("Galaxy /crew HTTP " + response.status);
    const rows = await response.json();
    const index = new Map();
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const mint = String(row?.dasID || "");
      if (!mint) return;
      index.set(mint, row);
    });
    crewByDas = index;
    return index;
  }

  async function loadNftIndex() {
    if (nftByMint) return nftByMint;
    const response = await fetch(NFTS_URL, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(25000) });
    if (!response.ok) throw new Error("Galaxy /nfts HTTP " + response.status);
    const rows = await response.json();
    const index = new Map();
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const mint = String(row?.mint || "");
      if (!mint) return;
      const attrs = row.attributes && typeof row.attributes === "object" ? row.attributes : {};
      const kind = String(attrs.itemType || "other").toLowerCase();
      index.set(mint, {
        mint,
        name: String(row.name || mint),
        image: String(row.image || ""),
        kind: kind === "ship" || kind === "resource" || kind === "structure" || kind === "crew" ? kind : "other",
        rarity: String(attrs.rarity || ""),
        spec: String(attrs.spec || attrs.class || "")
      });
    });
    nftByMint = index;
    return index;
  }

  function traitsOf(meta) {
    const raw = meta?.attributes;
    const out = [];
    if (!Array.isArray(raw)) return out;
    raw.forEach((row) => {
      if (!row || typeof row !== "object") return;
      const trait = row.trait_type || row.trait;
      if (!trait || row.value == null || typeof row.value === "object") return;
      out.push({ trait: String(trait), value: String(row.value) });
    });
    return out;
  }

  function trait(traits, name) {
    const hit = traits.find((row) => row.trait.toLowerCase() === name.toLowerCase());
    return hit ? hit.value : "";
  }

  function isCrewAsset(name, symbol, traits) {
    if (/crew/i.test(symbol) || /crew/i.test(name)) return true;
    const blob = traits.map((row) => row.trait + " " + row.value).join(" ").toLowerCase();
    return /flight|command|engineering|hospitality|operator|medical|science|fitness|openness|species|ustur|punaab|sogmian|mierese|hair/.test(blob);
  }

  function aptitudesFrom(traits, galaxyRow) {
    const out = {};
    if (galaxyRow?.aptitudes && typeof galaxyRow.aptitudes === "object") {
      Object.entries(galaxyRow.aptitudes).forEach(([name, level]) => {
        out[name] = String(level);
      });
    }
    traits.forEach((row) => {
      const hit = APTITUDES.find((name) => name.toLowerCase() === row.trait.toLowerCase());
      if (hit && out[hit] == null) out[hit] = row.value;
    });
    return out;
  }

  function crewRecord(mint, amount, assetName, image, traits, galaxyRow) {
    const named = trait(traits, "name");
    const galaxyName = galaxyRow?.name ? String(galaxyRow.name) : "";
    const name = galaxyName || (named && !/^crew\b/i.test(named) ? named : "") || assetName || mint;
    const openness = ocean(galaxyRow?.openness ?? trait(traits, "openness"));
    const conscientiousness = ocean(galaxyRow?.conscientiousness ?? trait(traits, "conscientiousness"));
    const extraversion = ocean(galaxyRow?.extraversion ?? trait(traits, "extraversion"));
    const agreeableness = ocean(galaxyRow?.agreeableness ?? trait(traits, "agreeableness"));
    const neuroticism = ocean(galaxyRow?.neuroticism ?? trait(traits, "neuroticism"));
    const species = String(galaxyRow?.species || trait(traits, "species") || "");
    const rarity = String(galaxyRow?.rarity || trait(traits, "rarity") || "");
    const aptitudes = aptitudesFrom(traits, galaxyRow);
    return {
      id: mint,
      mint,
      name,
      image: String(galaxyRow?.imageUrl || image || ""),
      species,
      rarity,
      openness,
      conscientiousness,
      extraversion,
      agreeableness,
      neuroticism,
      aptitudes,
      amount: Number(amount || 1),
      source: galaxyRow ? "galaxy-crew-dasID" : "das-metadata",
      traits,
      characteristics: {
        openness,
        conscientiousness,
        extraversion,
        agreeableness,
        neuroticism,
        aptitudes
      }
    };
  }

  function emptyCounts() {
    return { crew: 0, ship: 0, resource: 0, structure: 0, nft: 0, other: 0 };
  }

  async function scanChain(owner) {
    const [crewIndex, nftIndex] = await Promise.all([
      loadCrewIndex().catch(() => new Map()),
      loadNftIndex().catch(() => new Map())
    ]);
    const errors = [];
    const crew = [];
    const inventory = [];
    const seen = new Set();

    for (const program of TOKEN_PROGRAMS) {
      try {
        const result = await rpc("getTokenAccountsByOwner", [
          owner,
          { programId: program },
          { encoding: "jsonParsed" }
        ]);
        const rows = Array.isArray(result?.value) ? result.value : [];
        rows.forEach((row) => {
          const info = row?.account?.data?.parsed?.info;
          const mint = String(info?.mint || "");
          const amount = Number(info?.tokenAmount?.uiAmount ?? 0);
          if (!mint || !(amount > 0) || seen.has(mint)) return;
          const galaxy = crewIndex.get(mint);
          if (galaxy) {
            seen.add(mint);
            crew.push(crewRecord(mint, amount, galaxy.name, galaxy.imageUrl, [], galaxy));
            return;
          }
          const known = nftIndex.get(mint);
          if (!known || known.kind === "crew") return;
          seen.add(mint);
          inventory.push({
            mint,
            name: known.name,
            amount,
            kind: known.kind,
            image: known.image,
            rarity: known.rarity,
            spec: known.spec
          });
        });
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    let dasOk = false;
    for (let page = 1; page <= 8; page += 1) {
      let result;
      try {
        result = await rpc("getAssetsByOwner", {
          ownerAddress: owner,
          page,
          limit: 100,
          displayOptions: { showFungible: false, showZeroBalance: false }
        });
        dasOk = true;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
        break;
      }
      const rows = Array.isArray(result?.items) ? result.items : [];
      rows.forEach((asset) => {
        const mint = String(asset?.id || "");
        if (!mint || seen.has(mint)) return;
        const meta = asset?.content?.metadata || {};
        const traits = traitsOf(meta);
        const assetName = String(meta.name || "");
        const symbol = String(meta.symbol || "");
        const image = String(asset?.content?.links?.image || "");
        const galaxy = crewIndex.get(mint);
        if (galaxy || isCrewAsset(assetName, symbol, traits)) {
          seen.add(mint);
          crew.push(crewRecord(mint, 1, assetName, image, traits, galaxy || null));
          return;
        }
        const known = nftIndex.get(mint);
        seen.add(mint);
        inventory.push({
          mint,
          name: known?.name || assetName || mint.slice(0, 4),
          amount: 1,
          kind: known?.kind || "nft",
          image: known?.image || image,
          rarity: known?.rarity || "",
          spec: known?.spec || ""
        });
      });
      const total = Number(result?.total || 0);
      if (!rows.length || rows.length < 100 || (total && page * 100 >= total)) break;
    }

    if (!dasOk && !crew.length && !inventory.length) {
      throw new Error(errors.join(" · ") || "DAS не ответил");
    }

    const counts = emptyCounts();
    counts.crew = crew.length;
    inventory.forEach((item) => {
      if (counts[item.kind] == null) counts.other += 1;
      else counts[item.kind] += 1;
    });

    return {
      owner,
      crew,
      inventory,
      counts,
      errors,
      source: "render-wallet-scan",
      ok: true
    };
  }

  function formatDiagnostic(scan) {
    const professionLabels = {
      Command: "Командир",
      Flight: "Пилот",
      Operator: "Оператор",
      Engineering: "Инженер",
      Medical: "Медик",
      Science: "Учёный",
      Fitness: "Боец",
      Hospitality: "Обслуживание"
    };
    const lines = [
      "Wallet:",
      scan?.owner || "",
      "Crew found:",
      String(scan?.crew?.length || 0),
      "source: " + (scan?.source || ""),
      "endpoint: Browser → Render https://bcm4staratlas.onrender.com/api/wallet-scan → Solana/Galaxy",
      "crew data: Galaxy /crew by dasID, real wallet only"
    ];
    (scan?.crew || []).forEach((crew) => {
      const apts = crew.aptitudes ? Object.entries(crew.aptitudes).map(([name, level]) => name + " " + level).join(", ") : "";
      lines.push(
        [
          crew.name,
          crew.mint,
          crew.species || "—",
          crew.rarity || "—",
          "раса " + (crew.species || "—"),
          "профессии " + (
            Object.keys(crew.aptitudes || {})
              .map((name) => professionLabels[name] || name)
              .join(", ") || "—"
          )
        ].join(" · ")
      );
    });
    const counts = scan?.counts || emptyCounts();
    lines.push("Inventory found:");
    lines.push(String((scan?.inventory?.length || 0) + (scan?.crew?.length || 0)));
    lines.push(
      "crew " + counts.crew +
      " · ship " + (counts.ship || 0) +
      " · resource " + (counts.resource || 0) +
      " · structure " + (counts.structure || 0) +
      " · nft " + (counts.nft || 0) +
      " · other " + (counts.other || 0)
    );
    if (scan?.errors?.length) lines.push("rpc notes: " + scan.errors.join(" · "));
    return lines.join("\n");
  }

  async function wordpressScan(owner) {
    const config = window.BCMMiniSimConfig || {};
    const ajax = String(config.crewServerAjax || "");
    const nonce = String(config.crewServerNonce || "");
    if (!ajax || !nonce) throw new Error("WordPress wallet fallback не настроен.");

    const body = new URLSearchParams();
    body.set("action", "bcm_mini_sim_crew_wallet");
    body.set("nonce", nonce);
    body.set("owner", owner);

    const response = await fetch(ajax, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(45000)
    });
    const json = await response.json().catch(() => null);
    if (!response.ok || !json?.success) {
      throw new Error(json?.data?.message || "WordPress wallet fallback HTTP " + response.status);
    }

    const data = json.data || {};
    const crew = Array.isArray(data.crew) ? data.crew : [];
    const inventory = Array.isArray(data.inventory) ? data.inventory : [];
    return {
      owner: String(data.owner || owner),
      crew,
      inventory,
      profiles: Array.isArray(data.profiles) ? data.profiles : [],
      counts: data.counts || {},
      errors: Array.isArray(data.errors) ? data.errors : [],
      source: "wordpress-wallet-fallback",
      ok: true,
      server: true
    };
  }

  async function serverScan(owner) {
    const response = await fetch("https://bcm4staratlas.onrender.com/api/wallet-scan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({ owner }),
      signal: AbortSignal.timeout(45000)
    });
    const json = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(json?.error || ("Render wallet API HTTP " + response.status));
    }

    const data = json?.data && typeof json.data === "object" && Array.isArray(json.data.items)
      ? json.data
      : json;

    if (!data || !Array.isArray(data.items) || !data.owner) {
      throw new Error("Render wallet API вернул неполный ответ.");
    }

    const items = data.items;
    const crew = items.filter((item) => item?.kind === "crew");
    const inventory = items.filter((item) => item?.kind !== "crew");

    return {
      owner: String(data.owner || owner),
      crew,
      inventory,
      profiles: Array.isArray(data.profiles) ? data.profiles : [],
      counts: {
        crew: crew.length,
        ship: inventory.filter((item) => item?.kind === "ship").length,
        resource: inventory.filter((item) => item?.kind === "resource").length,
        structure: inventory.filter((item) => item?.kind === "structure").length,
        nft: inventory.filter((item) => item?.kind === "nft").length,
        other: inventory.filter((item) => !["ship", "resource", "structure", "nft"].includes(item?.kind)).length
      },
      errors: data.rpcWarning ? [String(data.rpcWarning)] : [],
      source: "render-wallet-scan",
      ok: true,
      server: true
    };
  }
  async function scanWallet(owner) {
    const address = String(owner || "").trim();
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
      throw new Error("Нужен публичный ключ Solana. Подпись не требуется.");
    }

    // The page on walkingyog.com must not call Solana itself.
    // PublicNode blocks the browser, and api.mainnet.solana.com answers
    // the WordPress server. Browser RPC is only a last resort, never PublicNode.
    let serverMessage = "";
    try {
      const server = await serverScan(address);
      if (server && (server.crew.length || server.inventory.length || !server.errors.length)) return server;
      serverMessage = (server?.errors || []).join(" · ");
    } catch (error) {
      serverMessage = error instanceof Error ? error.message : String(error);
    }

    try {
      const direct = await scanChain(address);
      const useful = (direct.crew?.length || direct.inventory?.length) > 0;
      direct.errors = serverMessage
        ? [serverMessage, ...(direct.errors || [])]
        : (direct.errors || []);
      direct.source = "browser-das-fallback";
      if (useful || !direct.errors.length) return direct;
    } catch (directError) {
      const directMessage = directError instanceof Error ? directError.message : String(directError);
      serverMessage = [serverMessage, directMessage].filter(Boolean).join(" · ");
    }

    try {
      const wordpress = await wordpressScan(address);
      wordpress.errors = serverMessage
        ? [serverMessage, ...(wordpress.errors || [])]
        : (wordpress.errors || []);
      return wordpress;
    } catch (wordpressError) {
      const message = wordpressError instanceof Error ? wordpressError.message : String(wordpressError);
      throw new Error([serverMessage, message].filter(Boolean).join(" · ") || "Кошелёк не прочитался");
    }
  }

  async function loadCrewForWallet(owner) {
    const scan = await scanWallet(owner);
    return scan.crew;
  }

  async function loadInventoryForWallet(owner) {
    const scan = await scanWallet(owner);
    return scan.inventory;
  }

  async function connectAndScan() {
    const wallet = provider();
    if (!wallet) throw new Error("Phantom не найден. Адрес можно вставить вручную.");
    const response = await wallet.connect();
    const owner = response?.publicKey?.toString?.() || "";
    if (!owner) throw new Error("Phantom не вернул публичный ключ.");
    const scan = await scanWallet(owner);
    return { provider: wallet, ...scan };
  }

  window.BCMCrewWallet = {
    provider,
    connectAndScan,
    scanWallet,
    loadCrewForWallet,
    loadInventoryForWallet,
    loadCatalog: loadCrewIndex,
    formatDiagnostic
  };
})();
