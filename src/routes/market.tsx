import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppChrome } from "@/components/app-chrome";
import { loadMarket, type Candle, type MarketSnap, type ResourceRow, type TapePoint } from "@/lib/desk";
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

const PINNED = ["Food", "Fuel", "Ammunition"];

function fmtAtlas(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1) return n.toLocaleString("ru-RU", { maximumFractionDigits: 4 });
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 6 });
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

function MarketPage() {
  const [snap, setSnap] = useState<MarketSnap | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [tape, setTape] = useState<TapePoint[]>([]);

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
    void pull(false);
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

  const movers = useMemo(() => {
    if (!snap || !previous) return [];
    return snap.resources
      .map((row) => ({ row, d: deltaPct(row.ask, previous.asks[row.mint]) }))
      .filter((item): item is { row: ResourceRow; d: number } => item.d != null && Math.abs(item.d) >= 0.05)
      .sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
      .slice(0, 6);
  }, [snap, previous]);

  const pinned = PINNED.map((name) => snap?.resources.find((row) => row.name === name)).filter(
    (row): row is ResourceRow => Boolean(row),
  );

  return (
    <AppChrome current="market" kicker="Galaxy · Galactic Marketplace" title="Цены ресурсов">
      <div className="h-full overflow-y-auto">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-3 py-4 md:px-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <TokenCard name="ATLAS" quote={snap?.atlas} />
            <TokenCard name="POLIS" quote={snap?.polis} />
          </div>
          <CandleChart candles={snap?.candles ?? []} />

          <div className="grid gap-3 sm:grid-cols-3">
            {pinned.map((row) => (
              <article key={row.mint} className="galia-hop rounded-xl border border-line bg-surface p-3">
                <p className="font-display text-[10px] tracking-[0.18em] text-brass uppercase">{row.name}</p>
                <p className="mt-1 font-mono text-xl text-fg">{fmtAtlas(row.ask)}</p>
                <p className="text-sm text-muted">
                  ATLAS · покупка {fmtAtlas(row.bid)} · {changeLabel(row, previous)}
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
              {loading ? "Снимаю…" : "Снимок"}
            </button>
          </div>

          {error ? <p className="text-sm text-danger">{error}</p> : null}

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
                ? "Свечи ATLAS уже с общего рынка. По ресурсам Galaxy историю не отдаёт: первый общий снимок сервера записан, следующий покажет Δ, не внутренний ноль."
                : `Общих снимков сервера: ${tape.length}. Ноль значит, что стакан между ними не сдвинулся.`}
            </p>
          )}

          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[36rem] border-collapse text-sm">
              <thead className="bg-surface-2 text-left text-faint">
                <tr>
                  <th className="px-3 py-2 font-medium">Ресурс</th>
                  <th className="px-3 py-2 font-medium">Класс</th>
                  <th className="px-3 py-2 font-medium">Продажа</th>
                  <th className="px-3 py-2 font-medium">Покупка</th>
                  <th className="px-3 py-2 font-medium">Δ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
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

function CandleChart({ candles }: { candles: Candle[] }) {
  if (candles.length < 2) return null;
  const w = 640;
  const h = 112;
  const pad = 6;
  const min = Math.min(...candles.map((c) => c.l));
  const max = Math.max(...candles.map((c) => c.h));
  const span = max - min || 1;
  const slot = (w - pad * 2) / candles.length;
  const y = (v: number) => pad + (1 - (v - min) / span) * (h - pad * 2);
  const first = candles[0]?.o ?? 0;
  const last = candles[candles.length - 1]?.c ?? 0;
  const move = first ? ((last - first) / first) * 100 : null;
  return (
    <figure className="rounded-xl border border-line bg-surface p-3">
      <figcaption className="mb-2 flex items-baseline justify-between gap-3">
        <span className="font-display text-[10px] tracking-[0.18em] text-brass uppercase">ATLAS · свечи 4ч</span>
        <span className={`font-mono text-sm ${move != null && move < 0 ? "text-danger" : "text-ok"}`}>{fmtPct(move)}</span>
      </figcaption>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-28 w-full" role="img" aria-label="Свечи ATLAS">
        {candles.map((candle, index) => {
          const x = pad + index * slot + slot / 2;
          const up = candle.c >= candle.o;
          const color = up ? "#7a9a7e" : "#c45c4a";
          const top = y(Math.max(candle.o, candle.c));
          const bot = y(Math.min(candle.o, candle.c));
          return (
            <g key={candle.t}>
              <line x1={x} x2={x} y1={y(candle.h)} y2={y(candle.l)} stroke={color} strokeWidth="1.2" />
              <rect x={x - Math.max(1.2, slot * 0.28)} y={top} width={Math.max(2, slot * 0.56)} height={Math.max(1.2, bot - top)} fill={color} />
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-sm text-muted">Общий рынок MEXC, не снимок этого браузера. Ресурсы ниже — стакан Galactic Marketplace.</p>
    </figure>
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
