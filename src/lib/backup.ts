import { CREW, displayName, type Crew } from "@/data/crew";
import { PACKETS } from "@/data/packets";
import { SHIPS, SIZE_ABBR, STATUS_LABEL, type ShipLine } from "@/data/ships";
import { SYSTEMS } from "@/data/systems";
import { loadFavorites, saveFavorites } from "@/lib/favorites";
import { loadStars, saveStars } from "@/lib/crew-stars";

export const BACKUP_VERSION = 1;
const LAST_KEY = "galia-last-export";

export type CatalogBackup = {
  version: number;
  app: "galia-crew-bay";
  exportedAt: string;
  crew: Crew[];
  packets: Record<string, string>;
  ships: {
    id: string;
    name: string;
    size: ShipLine["size"];
    spec: string;
    rarity: string;
    maker: string;
    status: ShipLine["status"];
    crew: number;
    count: number;
    supply: number | null;
    note: string;
    hulls: ShipLine["hulls"];
  }[];
  systems: {
    id: string;
    name: string;
    planet: string;
    faction: string;
    lore: string;
    markers: { id: string; name: string; kind: string; placement: string; blurb: string }[];
  }[];
  stars: string[];
  favorites: string[];
};

export function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export function buildSnapshot(): CatalogBackup {
  return {
    version: BACKUP_VERSION,
    app: "galia-crew-bay",
    exportedAt: new Date().toISOString(),
    crew: CREW,
    packets: { ...PACKETS },
    ships: SHIPS.map((s) => ({
      id: s.id,
      name: s.name,
      size: s.size,
      spec: s.spec,
      rarity: s.rarity,
      maker: s.maker,
      status: s.status,
      crew: s.crew,
      count: s.count,
      supply: s.supply,
      note: s.note,
      hulls: s.hulls,
    })),
    systems: SYSTEMS.map((s) => ({
      id: s.id,
      name: s.name,
      planet: s.planet,
      faction: s.faction,
      lore: s.lore,
      markers: s.markers.map((m) => ({
        id: m.id,
        name: m.name,
        kind: m.kind,
        placement: m.placement,
        blurb: m.blurb,
      })),
    })),
    stars: typeof window === "undefined" ? [] : loadStars(),
    favorites: typeof window === "undefined" ? [] : loadFavorites(),
  };
}

export function snapshotJson(data: CatalogBackup): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}

export function rememberExport() {
  try {
    localStorage.setItem(LAST_KEY, new Date().toISOString());
  } catch {
    /* quota */
  }
}

export function lastExport(): string | null {
  try {
    return localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
}

export function downloadFile(filename: string, body: string, mime: string) {
  const blob = new Blob([body], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function esc(value: string | number | null | undefined): string {
  const amp = "&" + "amp;";
  const lt = "&" + "lt;";
  const gt = "&" + "gt;";
  const quot = "&" + "quot;";
  return String(value ?? "")
    .replace(/&/g, amp)
    .replace(/</g, lt)
    .replace(/>/g, gt)
    .replace(/"/g, quot);
}

function aptLine(c: Crew): string {
  return c.aptitudes.map((a) => `${a.name} +${a.xp}`).join(" · ");
}

function catalogInner(data: CatalogBackup): string {
  const when = new Date(data.exportedAt).toLocaleString("ru-RU");
  const crewRows = data.crew
    .map((c) => {
      const packet = data.packets[c.id] ?? "";
      return `<tr>
        <td>${esc(displayName(c))}</td>
        <td>${esc(c.species)} · ${esc(c.sex)}</td>
        <td>${esc(c.official)}</td>
        <td>${c.tensorRank == null ? "—" : `#${c.tensorRank.toLocaleString("en-US")}`}</td>
        <td>${esc(aptLine(c))}</td>
        <td>O${c.o} C${c.c} E${c.e} A${c.a} N${c.n}</td>
        <td>${esc(packet)}</td>
        <td>${esc(c.note ?? "")}</td>
      </tr>`;
    })
    .join("\n");

  const packetRows = Object.entries(data.packets)
    .map(([id, label]) => {
      const c = data.crew.find((x) => x.id === id);
      return `<tr><td>${esc(c ? displayName(c) : id)}</td><td>${esc(label)}</td></tr>`;
    })
    .join("\n");

  const shipRows = data.ships
    .map((s) => {
      const hulls = s.hulls
        .map((h) => {
          const seats = h.seats
            .map((seat) => {
              const who = seat.crewId ? data.crew.find((c) => c.id === seat.crewId) : null;
              return `${esc(seat.role)}: ${who ? esc(displayName(who)) : "пусто"}`;
            })
            .join("; ");
          return `<li><strong>${esc(h.label)}</strong> — ${seats}</li>`;
        })
        .join("");
      return `<div class="galia-card">
        <p class="galia-name">${esc(s.name)}</p>
        <p class="galia-meta">${esc(SIZE_ABBR[s.size])} · ${esc(s.rarity)} · ${esc(s.spec)} · ${esc(STATUS_LABEL[s.status])}${s.count ? ` · ×${s.count}` : ""} · ${s.crew} экипаж</p>
        <p>${esc(s.note)}</p>
        ${hulls ? `<ul>${hulls}</ul>` : ""}
      </div>`;
    })
    .join("\n");

  const systemBlocks = data.systems
    .map((s) => {
      const marks = s.markers
        .map(
          (m) =>
            `<li><strong>${esc(m.name)}</strong> · ${esc(m.kind)} · ${esc(m.placement)} — ${esc(m.blurb)}</li>`,
        )
        .join("");
      return `<div class="galia-card">
        <p class="galia-name">${esc(s.name)}</p>
        <p class="galia-meta">${esc(s.faction)} · ${esc(s.planet)}</p>
        <p>${esc(s.lore)}</p>
        <ul>${marks}</ul>
      </div>`;
    })
    .join("\n");

  return `<div class="galia-head">
    <p class="galia-kicker">Star Atlas · снимок каталога</p>
    <p class="galia-title">Galia Crew Bay</p>
    <p class="galia-sub">Копия на ${esc(when)}. ${data.crew.length} экипаж · ${data.ships.length} судов. Живёт без приложения.</p>
  </div>
  <div class="galia-body">
    <p class="galia-h">Пакеты</p>
    <div class="galia-wrap">
      <table>
        <thead><tr><th>Кто</th><th>Борт / пост</th></tr></thead>
        <tbody>${packetRows}</tbody>
      </table>
    </div>
    <p class="galia-h">Экипаж</p>
    <div class="galia-wrap">
      <table>
        <thead>
          <tr>
            <th>Имя</th><th>Вид</th><th>Алмаз</th><th>Tensor</th>
            <th>Aptitudes</th><th>OCEAN</th><th>Пакет</th><th>Заметка</th>
          </tr>
        </thead>
        <tbody>${crewRows}</tbody>
      </table>
    </div>
    <p class="galia-h">Флот</p>
    ${shipRows}
    <p class="galia-h">Карта</p>
    ${systemBlocks}
  </div>
  <p class="galia-foot">WordPress: вставь этот блок в «Произвольный HTML», либо залей galia.html в корень сайта.</p>`;
}

const GALIA_CSS = `.galia-catalog{box-sizing:border-box;background:#07090e;color:#e8eef2;font:16px/1.5 "Segoe UI",system-ui,sans-serif;padding:0 0 2rem}
.galia-catalog *,.galia-catalog *::before,.galia-catalog *::after{box-sizing:border-box}
.galia-head{padding:2rem 1.25rem 1.5rem;border-bottom:1px solid rgba(232,238,242,.12)}
.galia-kicker{color:#c4a35a;font-size:.75rem;letter-spacing:.22em;text-transform:uppercase;margin:0 0 .35rem}
.galia-title{margin:0;font-size:2rem;font-weight:600;letter-spacing:.02em}
.galia-sub{color:#8b96a3;margin:.5rem 0 0;max-width:40rem}
.galia-body{padding:1.5rem 1.25rem 1rem;max-width:72rem;margin:0 auto}
.galia-h{color:#c4a35a;font-size:1.1rem;letter-spacing:.16em;text-transform:uppercase;margin:2.5rem 0 1rem;font-weight:600}
.galia-wrap{overflow-x:auto;border:1px solid rgba(232,238,242,.12);border-radius:10px;background:#10141c}
.galia-catalog table{width:100%;border-collapse:collapse;font-size:.85rem}
.galia-catalog th,.galia-catalog td{padding:.65rem .75rem;text-align:left;vertical-align:top;border-top:1px solid rgba(232,238,242,.12);color:#e8eef2}
.galia-catalog th{color:#5c6673;font-weight:600;background:#171d28;border-top:0}
.galia-card{border:1px solid rgba(232,238,242,.12);background:#10141c;border-radius:10px;padding:1rem 1.1rem;margin:0 0 .75rem;color:#e8eef2}
.galia-name{margin:0 0 .25rem;font-size:1.25rem;font-weight:600}
.galia-meta{color:#c4a35a;font-size:.8rem;letter-spacing:.08em;text-transform:uppercase;margin:0 0 .5rem}
.galia-catalog ul{margin:.4rem 0 0;padding-left:1.1rem;color:#8b96a3}
.galia-foot{color:#5c6673;font-size:.8rem;padding:0 1.25rem 1rem;max-width:72rem;margin:0 auto}`;

export function snapshotHtml(data: CatalogBackup): string {
  const inner = catalogInner(data);
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Galia · каталог ${esc(stamp())}</title>
  <style>${GALIA_CSS}
body{margin:0;background:#07090e;color:#e8eef2}</style>
</head>
<body>
<div class="galia-catalog">
${inner}
</div>
</body>
</html>
`;
}

/** Fragment for WordPress Custom HTML block — no html/body, scoped styles. */
export function snapshotWp(data: CatalogBackup): string {
  return `<!-- Galia: Страницы → Добавить → блок «Произвольный HTML» → вставить всё. -->
<style>${GALIA_CSS}</style>
<div class="galia-catalog">
${catalogInner(data)}
</div>
`;
}

export type ImportResult = { ok: true; stars: number; favorites: number } | { ok: false; error: string };

export function applyBackup(raw: unknown): ImportResult {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Файл пустой или не JSON." };
  const data = raw as Partial<CatalogBackup>;
  if (data.app && data.app !== "galia-crew-bay") return { ok: false, error: "Это не снимок Galia." };
  if (data.version != null && data.version !== BACKUP_VERSION) {
    return { ok: false, error: `Версия ${String(data.version)} не подходит.` };
  }
  if (Array.isArray(data.stars)) saveStars(data.stars.filter((x) => typeof x === "string"));
  if (Array.isArray(data.favorites)) saveFavorites(data.favorites.filter((x) => typeof x === "string"));
  rememberExport();
  return {
    ok: true,
    stars: Array.isArray(data.stars) ? data.stars.length : 0,
    favorites: Array.isArray(data.favorites) ? data.favorites.length : 0,
  };
}
