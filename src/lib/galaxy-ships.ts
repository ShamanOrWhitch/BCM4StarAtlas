/** Official Star Atlas ship art — Galaxy API + GCS CDN. */

export const GALAXY_NFTS = "https://galaxy.staratlas.com/nfts";

export const SHIP_OFFICIAL_NAME: Record<string, string> = {
  airbike: "Fimbul Airbike",
  unibomba: "Fimbul ECOS Unibomba",
  ruch: "Ogrika Ruch",
  x4: "Pearce X4",
  jetjet: "Opal Jetjet",
  chi: "Rainbow Chi",
  tufa: "Tufa Feist",
  om: "Rainbow Om",
  "mamba-ex": "Fimbul Mamba EX",
  compakt: "Calico Compakt Hero",
  arc: "Rainbow Arc",
  sunpaa: "Ogrika Sunpaa",
  r8: "Pearce R8",
  bitboat: "Opal Bitboat",
  greenader: "Fimbul ECOS Greenader",
};

type GalaxyNft = {
  name: string;
  image?: string;
  media?: { gallery?: string[] | null };
};

function urlsOf(nft: GalaxyNft): string[] {
  const out: string[] = [];
  if (nft.image) out.push(nft.image);
  for (const u of nft.media?.gallery ?? []) {
    if (typeof u === "string" && u.startsWith("http") && !out.includes(u)) out.push(u);
  }
  return out;
}

let cache: Record<string, string[]> | null = null;

export async function loadOfficialShipImages(): Promise<Record<string, string[]>> {
  if (cache) return cache;
  const res = await fetch(GALAXY_NFTS);
  if (!res.ok) throw new Error(`galaxy nfts ${res.status}`);
  const list = (await res.json()) as GalaxyNft[];
  const byName = new Map(list.map((n) => [n.name, n]));
  const next: Record<string, string[]> = {};
  for (const [id, name] of Object.entries(SHIP_OFFICIAL_NAME)) {
    const nft = byName.get(name);
    next[id] = nft ? urlsOf(nft) : [];
  }
  cache = next;
  return next;
}
