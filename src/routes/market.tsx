import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppChrome } from "@/components/app-chrome";
import { loadMarket, watchLiveBooks, type Candle, type MarketSnap, type ResourceRow, type TapePoint } from "@/lib/desk";
import { deltaPct, recordTape, rememberFloors } from "@/lib/price-tape";

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

const PERIODS = [
  { id: "15m", label: "15м", ms: 15 * 60 * 1000 },
  { id: "4h", label: "4ч", ms: 4 * 60 * 60 * 1000 },
  { id: "1d", label: "1д", ms: 24 * 60 * 60 * 1000 },
  { id: "1w", label: "1н", ms: 7 * 24 * 60 * 60 * 1000 },
  { id: "1y", label: "1г", ms: 365 * 24 * 60 * 60 * 1000 },
  { id: "all", label: "всё", ms: Number.POSITIVE_INFINITY },
] as const;

type PeriodId = (typeof PERIODS)[number]["id"];

function stampMs(t: number): number {
  return t > 0 && t < 1e12 ? t * 1000 : t;
}

function mergeTape(server: TapePoint[], local: TapePoint[]): TapePoint[] {
  const map = new Map<number, TapePoint>();
  for (const point of [...server, ...local]) {
    if (!point?.asks || typeof point.t !== "number") continue;
    const t = stampMs(point.t);
    map.set(t, { t, asks: point.asks });
  }
  return [...map.values()].sort((a, b) => a.t - b.t);
}

function anchorAsks(tape: TapePoint[], floors: Record<string, number>, period: PeriodId): Record<string, number> {
  if (period === "all") return floors;
  const span = PERIODS.find((item) => item.id === period)?.ms ?? 0;
  const cutoff = Date.now() - span;
  let hit: Record<string, number> | undefined;
  for (const point of tape) {
    if (stampMs(point.t) <= cutoff) hit = point.asks;
  }
  return hit ?? {};
}

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
  const [floors, setFloors] = useState<Record<string, number>>({});
  const [resourceMint, setResourceMint] = useState("");
  const [bookMint, setBookMint] = useState("");
  const [quote, setQuote] = useState<"USDC" | "ATLAS" | "POLIS">("USDC");
  const [period, setPeriod] = useState<PeriodId>("1w");

  async function pull(_force: boolean) {
    setLoading(true);
    setError("");
    try {
      const data = await loadMarket();
      setSnap(data);
      const asks: Record<string, number> = {};
      for (const row of [...data.resources, ...data.ships]) {
        const price = row.usdcAsk ?? row.ask;
        if (price != null) asks[row.mint] = price;
      }
      setTape(mergeTape(data.tape ?? [], recordTape(asks, data.atlas.usd)));
      setFloors(rememberFloors(asks, data.floors, lowsOf(data.tape)));
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
        const asks: Record<string, number> = {};
        for (const row of [...data.resources, ...data.ships]) {
          const price = row.usdcAsk ?? row.ask;
          if (price != null) asks[row.mint] = price;
        }
        setTape(recordTape(asks, data.atlas.usd));
        setFloors(rememberFloors(asks, data.floors, lowsOf(data.tape)));
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
  const anchor = useMemo(() => anchorAsks(tape, floors, period), [tape, floors, period]);

  return (
    <AppChrome current="market" kicker="Galaxy · Galactic Marketplace" title="Цены ресурсов">
      <div className="h-full overflow-y-auto">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-3 py-4 md:px-6">
          <div className="flex flex-wrap items-center gap-2">
            {PERIODS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPeriod(item.id)}
                className={`h-11 rounded-full border px-3 font-display text-sm ${period === item.id ? "border-brass bg-surface-2 text-fg" : "border-line text-muted"}`}
              >
                {item.label}
              </button>
            ))}
            <a
              href="https://play.staratlas.com/market/"
              target="_blank"
              rel="noreferrer"
              className="ml-auto flex h-11 items-center rounded-lg border border-brass-dim px-3 font-display text-sm text-fg"
            >
              Биржа Star Atlas
            </a>
          </div>
          <BubbleField
            title="Ресурсы"
            rows={viewRows}
            anchor={anchor}
            floors={floors}
            versus={period === "all" ? "floor" : "tape"}
          />
          <BubbleField
            title="Корабли"
            rows={viewShips}
            anchor={anchor}
            floors={floors}
            versus={period === "all" ? "floor" : "tape"}
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <PairCard name="ATLAS / USD" value={snap?.pairQuotes?.atlasUsdc ?? snap?.atlas?.usd ?? null} unit="USD" />
            <PairCard name="POLIS / USD" value={snap?.pairQuotes?.polisUsdc ?? snap?.polis?.usd ?? null} unit="USD" />
            <PairCard name="SOL за 1 POLIS" value={snap?.pairQuotes?.solPerPolis ?? null} unit="SOL" />
            <PairCard name="ATLAS за 1 SOL" value={snap?.pairQuotes?.atlasPerSol ?? null} unit="ATLAS" />
          </div>
          <CandleChart title="ATLAS / USD" candles={snap?.candles ?? []} />
          <CandleChart title="POLIS / USD" candles={snap?.polisUsdcCandles ?? []} />
          <CandleChart title="SOL за 1 POLIS" candles={snap?.solPolisCandles ?? []} />
          <CandleChart title="ATLAS за 1 SOL" candles={snap?.solAtlasCandles ?? []} />
          <CandleChart title="ATLAS за 1 POLIS" candles={snap?.pairCandles ?? []} />

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
            <button
              type="button"
              onClick={() => void pull(true)}
              className="h-11 rounded-lg border border-line bg-surface px-3 font-display text-sm text-fg"
            >
              {loading && !snap ? "…" : "Обновить"}
            </button>
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}

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
                  const open = bookMint === row.mint;
                  return (
                    <tr key={row.mint} className="border-t border-line">
                      <td className="px-3 py-2">
                        <button type="button" className="text-left text-fg" onClick={() => setBookMint(open ? "" : row.mint)}>
                          {row.name}
                        </button>
                        <span className="ml-2 font-mono text-faint">{row.symbol}</span>
                        {open ? <BookPeek row={row} quote={quote} /> : null}
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
        </div>
      </div>
    </AppChrome>
  );
}

const SMALL_CLASS = new Set(["xx-small", "x-small", "small"]);

function lowsOf(tape: TapePoint[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const point of tape) {
    for (const [mint, price] of Object.entries(point.asks)) {
      if (!(price > 0)) continue;
      if (out[mint] == null || price < out[mint]) out[mint] = price;
    }
  }
  return out;
}

function msrpPct(row: ResourceRow): number | null {
  const ask = row.usdcAsk ?? (row.quote === "USDC" ? row.ask : null);
  if (ask == null || row.msrp == null || row.msrp <= 0) return null;
  return ((ask - row.msrp) / row.msrp) * 100;
}

function fromFloor(row: ResourceRow, floors: Record<string, number>): number | null {
  const ask = row.usdcAsk ?? row.ask;
  const floor = floors[row.mint];
  if (ask == null || floor == null || floor <= 0) return null;
  return ((ask - floor) / floor) * 100;
}

function FloorLift({ rows, floors }: { rows: ResourceRow[]; floors: Record<string, number> }) {
  const lifted = rows
    .map((row) => ({ row, lift: fromFloor(row, floors), discount: msrpPct(row) }))
    .filter((item): item is { row: ResourceRow; lift: number; discount: number | null } => item.lift != null && item.lift >= 8)
    .sort((a, b) => b.lift - a.lift)
    .slice(0, 10);
  return (
    <section className="rounded-xl border border-line bg-surface p-3">
      <h2 className="font-display text-sm tracking-[0.16em] text-brass uppercase">От пола</h2>
      <p className="mt-1 text-sm text-muted">
        Скидка от MSRP остаётся: это длинная свеча, часто −90% и ниже. Здесь другое — продажа против самой низкой цены USDC, которую это окно уже записало. Спред Atlas в расчёт не берётся: в альфе стакан широкий, потому что торгующих мало. Старые $10–15 Galaxy задним числом не отдаёт, пол не выдумывается.
      </p>
      {lifted.length ? (
        <div className="mt-2 grid gap-1">
          {lifted.map(({ row, lift, discount }) => (
            <p key={row.mint} className="flex justify-between gap-3 font-mono text-xs">
              <span className="text-fg">{row.name}</span>
              <span>
                <span className="text-ok">от пола {fmtPct(lift)}</span>
                <span className="text-danger"> · MSRP {fmtPct(discount)}</span>
                <span className="text-muted"> · пол {fmtAtlas(floors[row.mint] ?? null)}</span>
              </span>
            </p>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted">Пока все продажи стоят у своего пола. Отскок появится, когда цена уйдёт вверх и пол не поднимется следом.</p>
      )}
    </section>
  );
}

function SmallHullCheck({ rows, floors }: { rows: ResourceRow[]; floors: Record<string, number> }) {
  const small = rows
    .filter((row) => SMALL_CLASS.has(row.className) && row.usdcAsk != null)
    .map((row) => {
      const lift = fromFloor(row, floors);
      const discount = msrpPct(row);
      return { row, lift, discount };
    })
    .sort((a, b) => (b.lift ?? -1) - (a.lift ?? -1) || (b.discount ?? -1e9) - (a.discount ?? -1e9));
  if (!small.length) return null;
  return (
    <section className="rounded-xl border border-line bg-surface p-3">
      <h2 className="font-display text-sm tracking-[0.16em] text-brass uppercase">Мелкие корпуса · MSRP и пол</h2>
      <p className="mt-1 text-sm text-muted">
        MSRP показывает скидку от изначальной цены. Пол — самая низкая продажа в этой ленте. Рост на 100–300% от пола на фоне −98% к MSRP иначе не виден.
      </p>
      <div className="mt-2 grid gap-1 sm:grid-cols-2">
        {small.map(({ row, lift, discount }) => (
          <p key={row.mint} className="flex justify-between gap-3 font-mono text-xs">
            <span className="text-fg">
              {row.className} · {row.name}
            </span>
            <span>
              <span className={lift != null && lift >= 8 ? "text-ok" : "text-faint"}>{fmtAtlas(row.usdcAsk ?? null)} · пол {fmtPct(lift)}</span>
              <span className={discount != null && discount < 0 ? "text-danger" : "text-ok"}> · MSRP {fmtPct(discount)}</span>
            </span>
          </p>
        ))}
      </div>
    </section>
  );
}

function BubbleField({
  title,
  rows,
  anchor,
  floors = {},
  versus = "tape",
}: {
  title: string;
  rows: ResourceRow[];
  anchor: Record<string, number>;
  floors?: Record<string, number>;
  versus?: "tape" | "floor";
}) {
  const shown = rows
    .filter((row) => (row.ask ?? 0) > 0 || Boolean(row.image))
    .slice()
    .sort((a, b) => (b.ask ?? 0) - (a.ask ?? 0))
    .slice(0, 42);
  if (!shown.length) return null;
  const max = Math.max(...shown.map((row) => row.ask ?? 0), 1);
  return (
    <section>
      <h2 className="mb-2 font-display text-sm tracking-[0.16em] text-brass uppercase">{title}</h2>
      <div className="flex flex-wrap items-end gap-3">
        {shown.map((row) => {
          const base = versus === "floor" ? (anchor[row.mint] ?? floors[row.mint]) : anchor[row.mint];
          const ask = row.usdcAsk ?? row.ask;
          const change = deltaPct(ask, base);
          const weight = row.ask && row.ask > 0 ? row.ask : max * 0.15;
          const size = 108 + Math.sqrt(weight / max) * 56;
          const up = change != null && change >= 0;
          const ring = change == null ? "rgba(232,238,242,0.45)" : up ? "#3dba7a" : "#e15b4a";
          return (
            <div
              key={row.mint}
              className="relative shrink-0 overflow-hidden rounded-full border-[3px] bg-[#121820]"
              style={{ width: size, height: size, borderColor: ring }}
              title={row.name}
            >
              {row.image ? <img src={row.image} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-black/10" />
              <div className="absolute inset-x-1 bottom-2 z-10 text-center text-white">
                <p className="font-mono text-sm font-semibold leading-none" style={{ color: ring }}>
                  {change == null ? money(row) : fmtPct(change)}
                </p>
                <p className="mt-1 line-clamp-2 font-display text-[11px] leading-tight">{row.name}</p>
              </div>
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
  if (points.length < 2) return null;
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

function BookPeek({ row, quote }: { row: ResourceRow; quote: "USDC" | "ATLAS" | "POLIS" }) {
  const asks = quote === "ATLAS" ? row.atlasAsks : quote === "POLIS" ? [] : row.usdcAsks?.length ? row.usdcAsks : row.atlasAsks;
  const bids = quote === "ATLAS" ? row.atlasBids : quote === "POLIS" ? [] : row.usdcBids?.length ? row.usdcBids : row.atlasBids;
  const unit = asks?.length ? (quote === "USDC" && row.usdcAsks?.length ? "USDC" : "ATLAS") : quote;
  if (!asks?.length && !bids?.length) {
    return <p className="mt-1 text-xs text-muted">Стакан в {quote} пуст. Если цена есть только в другой валюте — переключи ползунок сверху.</p>;
  }
  return (
    <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
      <div>
        <p className="text-danger">продавцы · {unit}</p>
        {(asks ?? []).map((level) => (
          <p key={`a-${level.price}`} className="font-mono">
            {fmtAtlas(level.price)} ×{level.qty}
          </p>
        ))}
      </div>
      <div>
        <p className="text-ok">покупатели · {unit}</p>
        {(bids ?? []).map((level) => (
          <p key={`b-${level.price}`} className="font-mono">
            {fmtAtlas(level.price)} ×{level.qty}
          </p>
        ))}
      </div>
    </div>
  );
}

function CandleChart({ title, candles }: { title: string; candles: Candle[] }) {
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
    </figure>
  );
}

function PairCard({ name, value, unit }: { name: string; value: number | null; unit: string }) {
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
