import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppChrome } from "@/components/app-chrome";
import { loadMarket, watchLiveBooks, type Candle, type MarketSnap, type ResourceRow, type TapePoint } from "@/lib/desk";
import { deltaPct } from "@/lib/price-tape";

export const Route = createFileRoute("/market")({ component: MarketPage });

const CLASS_LABEL: Record<string, string> = {
  consumable: "расходник",
  "raw material": "сырьё",
  component: "компонент",
  "compound material": "сплав",
  "material bundle": "набор",
  contracts: "контракт",
  data: "данные",
};

const FILTERS = [
  { id: "all", label: "все" },
  { id: "consumable", label: "расход" },
  { id: "raw material", label: "сырьё" },
  { id: "component", label: "компоненты" },
  { id: "compound material", label: "сплавы" },
  { id: "contracts", label: "контракты" },
];

const SPECIAL_RESOURCES = [
  { label: "Еда", re: /^food$/i },
  { label: "Топливо", re: /^fuel$/i },
  { label: "Амуниция", re: /ammunition|ammo/i },
  { label: "Ремкомплекты", re: /repair|repair kit|repairkit/i },
];

function fmtAtlas(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1) return n.toLocaleString("ru-RU", { maximumFractionDigits: 4 });
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 6 });
}

function priced(row: ResourceRow, quote: "USDC" | "ATLAS" | "POLIS"): ResourceRow {
  const pack = (ask: number | null | undefined, bid: number | null | undefined, unit: "USDC" | "ATLAS" | "POLIS") => ({
    ...row,
    ask: ask ?? null,
    bid: bid ?? null,
    quote: unit,
  });
  if (quote === "ATLAS") return pack(row.atlasAsk, row.atlasBid, "ATLAS");
  if (quote === "POLIS") return pack(row.polisAsk, row.polisBid, "POLIS");
  if (row.usdcAsk != null || row.usdcBid != null) return pack(row.usdcAsk, row.usdcBid, "USDC");
  return pack(row.usdcAsk, row.usdcBid, "USDC");
}
function money(row: ResourceRow): string {
  const n = row.ask ?? row.bid;
  const unit = row.quote === "POLIS" ? "POLIS" : row.quote === "ATLAS" ? "ATLAS" : "USDC";
  return `${fmtAtlas(n)} ${unit}`;
}

function fmtUsd(n: number | null): string {
  if (n == null) return "—";
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 6 })}`;
}

function fmtCompact(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 0 });
}

function fmtPct(n: number | null): string {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}%`;
}

export function MarketPage() {
  const [snap, setSnap] = useState<MarketSnap | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [tape, setTape] = useState<TapePoint[]>([]);
  const [resourceMint, setResourceMint] = useState("");
  const [quote, setQuote] = useState<"USDC" | "ATLAS" | "POLIS">("USDC");

  async function pull(_force: boolean) {
    setLoading(true);
    setError("");
    try {
      const data = await loadMarket();
      setSnap(data);
      setTape(data.tape);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Стакан не ответил");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;
    let last = 0;
    async function tick(silent: boolean) {
      if (document.hidden) return;
      if (silent && Date.now() - last < 30_000) return;
      last = Date.now();
      if (!silent) setLoading(true);
      try {
        const data = await loadMarket();
        if (!alive) return;
        setSnap(data);
        setTape(data.tape);
        setError("");
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Стакан не ответил");
      } finally {
        if (alive && !silent) setLoading(false);
      }
    }
    void tick(false);
    const stopBooks = watchLiveBooks((remote) => {
      if (!alive) return;
      setSnap((current) => current ? {
        ...current,
        resources: remote.resources,
        ships: remote.ships,
        marketShips: remote.marketShips,
        orderCount: remote.orderCount,
        note: remote.note || current.note,
        pairQuotes: remote.pairQuotes ?? current.pairQuotes,
      } : remote);
      setError("");
    });
    const timer = window.setInterval(() => void tick(true), 3 * 60 * 1000);
    const onVisible = () => {
      if (!document.hidden) void tick(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      stopBooks();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const previous = tape.length >= 2 ? tape[tape.length - 2] : undefined;
  const rows = useMemo(() => {
    if (!snap) return [];
    const q = query.trim().toLowerCase();
    return snap.resources.filter((row) => {
      if (filter !== "all" && row.className !== filter) return false;
      if (!q) return true;
      return row.name.toLowerCase().includes(q) || row.symbol.toLowerCase().includes(q);
    });
  }, [snap, filter, query]);
  const viewRows = useMemo(() => rows.map((row) => priced(row, quote)), [rows, quote]);
  const viewShips = useMemo(() => (snap?.ships ?? []).map((row) => priced(row, quote)), [snap, quote]);

  const movers = useMemo(() => {
    if (!snap || !previous) return [];
    return snap.resources
      .map((row) => ({ row, d: deltaPct(row.ask, previous.asks[row.mint]) }))
      .filter((item): item is { row: ResourceRow; d: number } => item.d != null && Math.abs(item.d) >= 0.05)
      .sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
      .slice(0, 6);
  }, [snap, previous]);

  const specialResources = SPECIAL_RESOURCES
    .map((item) => ({
      ...item,
      row: snap?.resources.find((row) => item.re.test(row.name)) ?? null,
    }))
    .filter((item): item is typeof SPECIAL_RESOURCES[number] & { row: ResourceRow } => Boolean(item.row));

  return (
    <AppChrome current="market" kicker="Galaxy · Galactic Marketplace" title="Цены ресурсов">
      <div className="h-full overflow-y-auto">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-3 py-4 md:px-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <PairCard name="ATLAS / USDC" value={snap?.pairQuotes?.atlasUsdc ?? snap?.atlas?.usd ?? null} unit="USDC" />
            <PairCard name="POLIS / USDC" value={snap?.pairQuotes?.polisUsdc ?? snap?.polis?.usd ?? null} unit="USDC" />
            <PairCard name="POLIS / ATLAS" value={snap?.pairQuotes?.polisAtlas ?? null} unit="ATLAS" />
          </div>
          <CandleChart title="ATLAS / USDC" candles={snap?.candles ?? []} source="Дневные свечи. «Сейчас» — закрытие последней свечи, это mark на момент сборки." />
          <CandleChart title="POLIS / USDC" candles={snap?.polisUsdcCandles ?? []} source="Дневные свечи POLIS/USDC. «Сейчас» — закрытие последней свечи." />
          <CandleChart title="POLIS / ATLAS" candles={snap?.pairCandles ?? []} source="Сколько ATLAS стоит один POLIS. Считается из двух USDC-пар." />
          <CandleChart title="ATLAS / SOL" candles={snap?.solAtlasCandles ?? []} source="Сколько SOL стоит один ATLAS. Из дневных свечей ATLAS/USD и SOL/USD." />
          <CandleChart title="POLIS / SOL" candles={snap?.solPolisCandles ?? []} source="Сколько SOL стоит один POLIS. Из дневных свечей POLIS/USD и SOL/USD." />

          <div className="grid gap-3 sm:grid-cols-4">
            {specialResources.map(({ label, row }) => (
              <article key={row.mint} className="galia-hop rounded-xl border border-line bg-surface p-3">
                <p className="font-display text-[10px] tracking-[0.18em] text-brass uppercase">{label}</p>
                <p className="mt-1 font-mono text-lg text-fg">USDC {fmtAtlas(row.usdcAsk)}</p>
                <p className="font-mono text-sm text-muted">ATLAS {fmtAtlas(row.atlasAsk)}</p>
                <p className="text-xs text-faint">
                  {row.usdcDerived ? "USDC рассчитан из ATLAS/USDC" : "USDC из прямого стакана"}
                </p>
              </article>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={`h-11 rounded-lg border px-3 font-display text-sm ${
                  filter === item.id ? "border-brass bg-surface-2 text-fg" : "border-line text-muted"
                }`}
              >
                {item.label}
              </button>
            ))}
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск"
              className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-fg outline-none placeholder:text-faint"
            />
            <button
              type="button"
              onClick={() => void pull(true)}
              className="h-11 rounded-lg border border-line bg-surface px-3 font-display text-sm text-fg"
            >
              {loading && !snap ? "Разбудить Render…" : "Обновить"}
            </button>
          </div>

          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <p className="text-sm text-muted">Цены обновляются сами каждые 3 минуты, пока вкладка открыта.</p>

          {movers.length ? (
            <p className="text-sm text-muted">
              С прошлого снимка:{" "}
              {movers.map((item) => (
                <span key={item.row.mint} className={item.d > 0 ? "text-danger" : "text-ok"}>
                  {item.row.name} {fmtPct(item.d)}{" "}
                </span>
              ))}
            </p>
          ) : (
            <p className="text-sm text-muted">
              {tape.length < 2
                ? "Первый серверный снимок записан. Цены ресурсов и кораблей берутся из стаканов; если прямого USDC нет, ATLAS пересчитывается по текущему ATLAS/USDC."
                : `Общих снимков сервера: ${tape.length}. Ноль значит, что стакан между ними не сдвинулся.`}
            </p>
          )}

          <div className="flex gap-2">
            {(["USDC", "ATLAS", "POLIS"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setQuote(item)}
                className={`h-11 rounded-full border px-3 font-display text-sm ${quote === item ? "border-brass-dim bg-surface-2 text-fg" : "border-line text-muted"}`}
              >
                {item}
              </button>
            ))}

          </div>
          <BubbleField title={quote === "USDC" ? "Ресурсы · USDC, если стакана нет — показан ATLAS" : `Ресурсы · ${quote}`} rows={viewRows} previous={previous} />
          <BubbleField title={`Корабли · ${quote}`} rows={viewShips} previous={previous} />
          <ResourceTape rows={rows} tape={tape} mint={resourceMint} onMint={setResourceMint} />
          <p className="text-sm text-muted">
            Экипаж на Galactic Marketplace стаканом не торгуется. Карточки — NFT, их статы в метадате, пол — на Tensor. Пузырь цены экипажа без чужого архива был бы выдумкой.
          </p>

          <h2 className="font-display text-sm tracking-[0.16em] text-brass uppercase">Ресурсы</h2>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[36rem] border-collapse text-sm">
              <thead className="bg-surface-2 text-left text-faint">
                <tr>
                  <th className="px-3 py-2 font-medium">Ресурс</th>
                  <th className="px-3 py-2 font-medium">Класс</th>
                  <th className="px-3 py-2 font-medium">Продажа, {quote}</th>
                  <th className="px-3 py-2 font-medium">Покупка, {quote}</th>
                  <th className="px-3 py-2 font-medium">Δ</th>
                </tr>
              </thead>
              <tbody>
                {viewRows.map((row) => {
                  const d = deltaPct(row.ask, previous?.asks[row.mint]);
                  return (
                    <tr key={row.mint} className="border-t border-line">
                      <td className="px-3 py-2">
                        <span className="text-fg">{row.name}</span>
                        <span className="ml-2 font-mono text-faint">{row.symbol}</span>
                      </td>
                      <td className="px-3 py-2 text-muted">{CLASS_LABEL[row.className] ?? row.className}</td>
                      <td className="px-3 py-2 font-mono text-fg">{fmtAtlas(row.ask)}</td>
                      <td className="px-3 py-2 font-mono text-muted">{fmtAtlas(row.bid)}</td>
                      <td className={`px-3 py-2 font-mono ${d == null ? "text-faint" : d > 0 ? "text-danger" : "text-ok"}`}>
                        {fmtPct(d)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="pb-6 text-sm text-muted">{snap?.note}</p>
        </div>
      </div>
    </AppChrome>
  );
}

function BubbleField({ title, rows, previous }: { title: string; rows: ResourceRow[]; previous?: TapePoint }) {
  if (!rows.length) return null;
  const shown = rows.slice(0, 42);
  const max = Math.max(...shown.map((row) => Math.log10((row.askQty || 1) + 10)));
  return (
    <section>
      <h2 className="mb-2 font-display text-sm tracking-[0.16em] text-brass uppercase">{title}</h2>
      <div className="flex flex-wrap items-center gap-2">
        {shown.map((row) => {
          const change = deltaPct(row.ask, previous?.asks[row.mint]);
          const size = 76 + (Math.log10((row.askQty || 1) + 10) / (max || 1)) * 48;
          const tone = change == null ? "border-line text-muted" : change > 0 ? "border-danger text-danger" : "border-ok text-ok";
          return (
            <div
              key={row.mint}
              className={`flex flex-col items-center justify-center rounded-full border bg-surface px-2 text-center ${tone}`}
              style={{ width: size, height: size }}
            >
              {row.image ? <img src={row.image} alt="" width={28} height={28} loading="lazy" decoding="async" className="mb-1 size-7 rounded-full object-cover" /> : null}
              <span className="line-clamp-2 font-display text-xs leading-tight text-fg">{row.name}</span>
              <span className="font-mono text-[10px]">{row.ask == null ? "нет стакана" : change == null ? money(row) : fmtPct(change)}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ResourceTape({
  rows,
  tape,
  mint,
  onMint,
}: {
  rows: ResourceRow[];
  tape: TapePoint[];
  mint: string;
  onMint: (mint: string) => void;
}) {
  const picked = mint || rows.find((row) => row.ask != null)?.mint || "";
  const name = rows.find((row) => row.mint === picked)?.name ?? "ресурс";
  const points = tape
    .map((point) => ({ t: point.t, v: point.asks[picked] }))
    .filter((point): point is { t: number; v: number } => point.v != null);
  return (
    <section className="rounded-xl border border-line bg-surface p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-sm tracking-[0.16em] text-brass uppercase">График ресурса · ATLAS</h2>
        <select
          value={picked}
          onChange={(event) => onMint(event.target.value)}
          className="h-11 rounded-md border border-line bg-bg px-2 text-sm text-fg"
        >
          {rows
            .filter((row) => row.ask != null)
            .map((row) => (
              <option key={row.mint} value={row.mint}>
                {row.name}
              </option>
            ))}
        </select>
      </div>
      {points.length < 2 ? (
        <p className="text-sm text-muted">
          {name}: резкий ход виден, когда есть хотя бы два общих снимка. История Galaxy по ресурсам не отдаётся, график копится здесь сам.
        </p>
      ) : (
        <TapeLine name={name} points={points} />
      )}
    </section>
  );
}

function TapeLine({ name, points }: { name: string; points: { t: number; v: number }[] }) {
  const w = 640;
  const h = 120;
  const pad = 8;
  const min = Math.min(...points.map((point) => point.v));
  const max = Math.max(...points.map((point) => point.v));
  const span = max - min || 1;
  const d = points
    .map((point, index) => {
      const x = pad + (index / Math.max(1, points.length - 1)) * (w - pad * 2);
      const y = pad + (1 - (point.v - min) / span) * (h - pad * 2);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const last = points[points.length - 1]?.v ?? 0;
  const first = points[0]?.v ?? last;
  const move = first ? ((last - first) / first) * 100 : 0;
  return (
    <figure>
      <figcaption className="mb-1 font-mono text-xs text-muted">
        {name} {fmtAtlas(last)} ATLAS · {fmtPct(move)}
      </figcaption>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-32 w-full">
        <text x={w - 4} y="14" textAnchor="end" fill="#8b96a3" fontSize="12">
          {fmtAtlas(max)}
        </text>
        <text x={w - 4} y={h - 4} textAnchor="end" fill="#8b96a3" fontSize="12">
          {fmtAtlas(min)}
        </text>
        <path d={d} fill="none" stroke="#c4a35a" strokeWidth="2" />
      </svg>
    </figure>
  );
}

function CandleChart({ title, candles, source }: { title: string; candles: Candle[]; source?: string }) {
  const [hover, setHover] = useState<{ x: number; y: number; index: number; price: number } | null>(null);

  if (candles.length < 2) return <p className="text-sm text-muted">{title}: свечи ещё не пришли.</p>;
  const w = 720;
  const h = 260;
  const pad = 28;
  const padR = 92;
  const padB = 28;
  const min = Math.min(...candles.map((c) => c.l));
  const max = Math.max(...candles.map((c) => c.h));
  const span = max - min || 1;
  const slot = (w - pad - padR) / candles.length;
  const y = (v: number) => pad + (1 - (v - min) / span) * (h - pad - padB);
  const last = candles[candles.length - 1];
  const first = candles[0];
  const move = first && first.o ? ((last.c - first.o) / first.o) * 100 : null;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((step) => min + span * step);
  const fmtTick = (n: number) => (n >= 100 ? n.toFixed(2) : n >= 1 ? n.toFixed(2) : n.toFixed(6));
  const dateOf = (t: number) => new Date(t > 1e12 ? t : t * 1000).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
  const marks = candles.filter((_, index) => index % Math.ceil(candles.length / 5) === 0 || index === candles.length - 1);

  function onMove(event: MouseEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const px = ((event.clientX - rect.left) / rect.width) * w;
    const py = ((event.clientY - rect.top) / rect.height) * h;
    if (px < pad || px > w - padR || py < pad || py > h - padB) return;
    const index = Math.max(0, Math.min(candles.length - 1, Math.round((px - pad - slot / 2) / slot)));
    const x = pad + index * slot + slot / 2;
    const price = Math.max(min, Math.min(max, max - ((py - pad) / (h - pad - padB)) * span));
    setHover({ x, y: py, index, price });
  }

  return (
    <figure className="rounded-xl border border-line bg-surface p-3">
      <figcaption className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
        <span className="font-display text-[10px] tracking-[0.18em] text-brass uppercase">{title} · 1д</span>
        <span className="font-mono text-lg text-fg">сейчас {fmtTick(last.c)}</span>
        <span className="font-mono text-xs text-muted">
          мин {fmtTick(min)} · среднее {fmtTick(candles.reduce((sum, candle) => sum + candle.c, 0) / candles.length)} · макс {fmtTick(max)}
        </span>
        <span className={`font-mono text-sm ${move != null && move < 0 ? "text-danger" : "text-ok"}`}>{fmtPct(move)}</span>
      </figcaption>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-64 w-full" role="img" aria-label={title} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={pad} x2={w - padR} y1={y(tick)} y2={y(tick)} stroke="rgba(232,238,242,0.18)" />
            <text x={w - 4} y={y(tick) + 4} textAnchor="end" fill="#c5ced6" fontSize="13">
              {fmtTick(tick)}
            </text>
          </g>
        ))}
        {candles.map((candle, index) => {
          const x = pad + index * slot + slot / 2;
          const up = candle.c >= candle.o;
          const color = up ? "#7a9a7e" : "#c45c4a";
          const top = y(Math.max(candle.o, candle.c));
          const bot = y(Math.min(candle.o, candle.c));
          return (
            <g key={candle.t}>
              <title>{`${dateOf(candle.t)}  O ${fmtTick(candle.o)}  H ${fmtTick(candle.h)}  L ${fmtTick(candle.l)}  C ${fmtTick(candle.c)}`}</title>
              <line x1={x} x2={x} y1={y(candle.h)} y2={y(candle.l)} stroke={color} strokeWidth="1.2" />
              <rect x={x - Math.max(1.2, slot * 0.28)} y={top} width={Math.max(2, slot * 0.56)} height={Math.max(1.2, bot - top)} fill={color} />
            </g>
          );
        })}
        <line x1={pad} x2={w - padR} y1={y(last.c)} y2={y(last.c)} stroke="#e8eef2" strokeWidth="1.4" />
        <text x={pad + 4} y={Math.max(pad + 12, y(last.c) - 6)} fill="#e8eef2" fontSize="13">
          сейчас {fmtTick(last.c)}
        </text>
        {hover ? (
          <g pointerEvents="none">
            <line x1={hover.x} x2={hover.x} y1={pad} y2={h - padB} stroke="#8b96a3" strokeWidth="1" strokeDasharray="4 3" />
            <line x1={pad} x2={w - padR} y1={hover.y} y2={hover.y} stroke="#8b96a3" strokeWidth="1" strokeDasharray="4 3" />
            <rect x={w - padR + 8} y={Math.max(pad, Math.min(h - padB - 22, hover.y - 11))} width={padR - 16} height="22" rx="3" fill="#07090e" stroke="#8b96a3" />
            <text x={w - padR + 12} y={Math.max(pad + 14, Math.min(h - padB - 8, hover.y + 4))} fill="#e8eef2" fontSize="11">
              {fmtTick(hover.price)}
            </text>
            <circle cx={hover.x} cy={y(candles[hover.index].c)} r="3" fill="#e8eef2" />
          </g>
        ) : null}
        {marks.map((candle) => {
          const index = candles.indexOf(candle);
          const x = pad + index * slot + slot / 2;
          return (
            <text key={`d-${candle.t}`} x={x} y={h - 6} textAnchor="middle" fill="#8b96a3" fontSize="11">
              {dateOf(candle.t)}
            </text>
          );
        })}
      </svg>
      <p className="mt-1 text-sm text-muted">{source ?? "Дневные свечи. Ось справа — цена. Наведи на свечу: дата и OHLC."}</p>
    </figure>
  );
}

function PairCard({ name, value, unit }: { name: string; value: number | null; unit: "USDC" | "ATLAS" }) {
  return (
    <article className="rounded-xl border border-line bg-surface p-3">
      <p className="font-display text-[10px] tracking-[0.18em] text-brass uppercase">{name}</p>
      <p className="mt-1 font-mono text-2xl text-fg">{fmtAtlas(value)} {unit}</p>
      <p className="text-sm text-muted">текущий курс</p>
    </article>
  );
}

function changeLabel(row: ResourceRow, previous: TapePoint | undefined): string {
  const d = deltaPct(row.ask, previous?.asks[row.mint]);
  return d == null ? "нет прошлого снимка" : fmtPct(d);
}

function TokenCard({ name, quote }: { name: string; quote?: MarketSnap["atlas"] }) {
  return (
    <article className="rounded-xl border border-line bg-surface p-3">
      <p className="font-display text-[10px] tracking-[0.18em] text-brass uppercase">{name}</p>
      <p className="mt-1 font-mono text-2xl text-fg">{fmtUsd(quote?.usd ?? null)}</p>
      <p className="text-sm text-muted">
        24ч {fmtPct(quote?.change24h ?? null)} · в обороте {fmtCompact(quote?.circulating ?? null)}
      </p>
    </article>
  );
}
