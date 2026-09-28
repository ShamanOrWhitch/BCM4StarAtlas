(() => {
  "use strict";

  const RPCS = [
    "https://solana-rpc.publicnode.com",
    "https://api.mainnet-beta.solana.com"
  ];
  const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
  const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

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

  function traitsOf(meta) {
    const raw = meta?.attributes;
    const out = [];
    if (!Array.isArray(raw)) return out;
    for (const row of raw) {
      if (!row || typeof row !== "object") continue;
      const trait = String(row.trait_type ?? row.trait ?? "").trim();
      const value = row.value;
      if (!trait || value == null || typeof value === "object") continue;
      out.push({ trait, value: String(value) });
    }
    return out.slice(0, 48);
  }

  function isCrew(name, symbol, traits) {
    if (/crew/i.test(name) || /crew/i.test(symbol)) return true;
    const blob = traits.map((item) => item.trait + " " + item.value).join(" ").toLowerCase();
    return /flight|command|engineering|hospitality|operator|medical|science|fitness|openness|species|ustur|punaab|sogmian|mierese|hair/.test(blob);
  }

  function normalizeAsset(asset) {
    const content = asset?.content && typeof asset.content === "object" ? asset.content : {};
    const metadata = content.metadata && typeof content.metadata === "object" ? content.metadata : {};
    const links = content.links && typeof content.links === "object" ? content.links : {};
    const name = String(metadata.name || asset?.id || "").trim();
    const symbol = String(metadata.symbol || "").trim();
    const traits = traitsOf(metadata);
    if (!isCrew(name, symbol, traits)) return null;

    const named = traits.find((item) => item.trait.toLowerCase() === "name")?.value || "";
    const image = String(
      links.image ||
      content.files?.[0]?.uri ||
      metadata.image ||
      ""
    );

    return {
      id: String(asset.id || ""),
      mint: String(asset.id || ""),
      name: named && !/^crew\\b/i.test(named) ? named : (name || "Crew"),
      image,
      rarity: traits.find((item) => /rarity/i.test(item.trait))?.value || "",
      species: traits.find((item) => /species/i.test(item.trait))?.value || "",
      sex: traits.find((item) => /^sex$/i.test(item.trait))?.value || "",
      source: "wallet",
      traits,
      raw: asset
    };
  }

  async function directScan(owner) {
    const found = [];
    const seen = new Set();

    for (let page = 1; page <= 4; page++) {
      const result = await rpc("getAssetsByOwner", [{
        ownerAddress: owner,
        page,
        limit: 100,
        displayOptions: {
          showFungible: false,
          showZeroBalance: false
        }
      }]);
      const chunk = Array.isArray(result?.items) ? result.items : [];
      for (const asset of chunk) {
        const crew = normalizeAsset(asset);
        if (!crew || seen.has(crew.id)) continue;
        seen.add(crew.id);
        found.push(crew);
      }
      if (!chunk.length || (result?.total != null && found.length >= Number(result.total))) break;
    }

    return found;
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
    if (!json?.success) throw new Error(json?.data?.message || "WP wallet scan failed");

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
        traits: Array.isArray(item.traits) ? item.traits : []
      }));
  }

  async function scanWallet(owner) {
    let directError = null;
    try {
      const direct = await directScan(owner);
      if (direct.length) return direct;
    } catch (error) {
      directError = error;
    }

    try {
      const viaWp = await wpScan(owner);
      if (viaWp.length || !directError) return viaWp;
    } catch (error) {
      if (directError) {
        throw new Error(
          "Прямой Solana scan: " +
          (directError instanceof Error ? directError.message : String(directError)) +
          " · WP scan: " +
          (error instanceof Error ? error.message : String(error))
        );
      }
    }

    return [];
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

    const crew = await scanWallet(owner);
    return {
      provider: wallet,
      owner,
      crew
    };
  }

  window.BCMCrewWallet = {
    provider,
    connectAndScan,
    scanWallet
  };
})();
