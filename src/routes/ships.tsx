import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CREW, displayName } from "@/data/crew";
import {
  SHIPS,
  SHIP_SIZES,
  SIZE_ABBR,
  SIZE_SPAN,
  STATUS_LABEL,
  formatSupply,
  type CrewSlot,
  type Hull,
  type ShipLine,
  type ShipSize,
  type ShipStatus,
} from "@/data/ships";
import { CrewPortrait } from "@/components/crew/portrait";
import { AppChrome } from "@/components/app-chrome";

export const Route = createFileRoute("/ships")({ component: ShipsPage });

const STATUS_TONE: Record<ShipStatus, string> = {
  owned: "text-ok",
  garage: "text-ice",
  project: "text-brass",
  rent: "text-muted",
  watch: "text-faint",
};

function ShipsPage() {
  const [size, setSize] = useState<ShipSize | "all">("X-Small");
  const [lineId, setLineId] = useState<string | null>("jetjet");
  const [hullId, setHullId] = useState<string | null>("jetjet-1");

  const lines = useMemo(() => (size === "all" ? SHIPS : SHIPS.filter((s) => s.size === size)), [size]);
  const line = lineId ? (lines.find((s) => s.id === lineId) ?? SHIPS.find((s) => s.id === lineId) ?? null) : null;
  const hull = line?.hulls.find((h) => h.id === hullId) ?? line?.hulls[0] ?? null;

  function pickSize(next: ShipSize | "all") {
    setSize(next);
    const list = next === "all" ? SHIPS : SHIPS.filter((x) => x.size === next);
    if (list.length === 1) {
      setLineId(list[0].id);
      setHullId(list[0].hulls[0]?.id ?? null);
    } else {
      setLineId(null);
      setHullId(null);
    }
  }

  function pickLine(id: string) {
    const s = SHIPS.find((x) => x.id === id);
    setLineId(id);
    setHullId(s?.hulls[0]?.id ?? null);
  }

  return (
    <AppChrome current="ships" kicker="Galactic Market · официальные галереи" title="Флот">
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-line px-3 py-2 md:px-6">
          <SizeTab on={size === "all"} onClick={() => pickSize("all")} label="Все" hint={`${SHIPS.length}`} />
          {SHIP_SIZES.map((s) => (
            <SizeTab
              key={s}
              on={size === s}
              onClick={() => pickSize(s)}
              label={SIZE_ABBR[s]}
              hint={`${SIZE_SPAN[s]} · ${SHIPS.filter((x) => x.size === s).length}`}
            />
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {!line ? (
            <Catalog lines={lines} onPick={pickLine} />
          ) : (
            <Vessel
              line={line}
              hull={hull}
              siblings={lines}
              onBack={() => setLineId(null)}
              onPickLine={pickLine}
              onPickHull={setHullId}
            />
          )}
        </div>
      </div>
    </AppChrome>
  );
}

function SizeTab({ on, onClick, label, hint }: { on: boolean; onClick: () => void; label: string; hint: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-11 shrink-0 flex-col items-center justify-center rounded-lg border px-3 font-display leading-none ${
        on ? "border-brass-dim bg-surface-2 text-fg" : "border-line text-muted hover:text-fg"
      }`}
    >
      <span className="text-sm">{label}</span>
      {hint ? <span className="mt-0.5 font-mono text-[10px] text-faint">{hint}</span> : null}
    </button>
  );
}

function Catalog({ lines, onPick }: { lines: ShipLine[]; onPick: (id: string) => void }) {
  if (lines.length === 0) {
    return <p className="px-6 py-16 text-center text-muted">В этом классе судов нет.</p>;
  }
  return (
    <ul className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3 md:p-6">
      {lines.map((s) => (
        <li key={s.id}>
          <button
            type="button"
            onClick={() => onPick(s.id)}
            className="flex w-full flex-col overflow-hidden rounded-xl border border-line bg-surface text-left hover:border-brass-dim"
          >
            <img src={s.images[0]} alt="" className="aspect-video w-full bg-surface-2 object-cover" />
            <div className="flex flex-col gap-1 p-3">
              <p className="font-mono text-[10px] tracking-[0.14em] text-brass uppercase">
                {SIZE_ABBR[s.size]} · {s.rarity} · {s.spec}
              </p>
              <p className="font-display text-lg font-semibold">{s.name}</p>
              <p className={`font-mono text-xs ${STATUS_TONE[s.status]}`}>
                {s.count > 0 ? `×${s.count} · ` : ""}
                {STATUS_LABEL[s.status]} · {s.crew} экипаж
              </p>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Vessel({
  line,
  hull,
  siblings,
  onBack,
  onPickLine,
  onPickHull,
}: {
  line: ShipLine;
  hull: Hull | null;
  siblings: ShipLine[];
  onBack: () => void;
  onPickLine: (id: string) => void;
  onPickHull: (id: string) => void;
}) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex h-11 items-center rounded-lg border border-line px-3 font-display text-sm text-muted hover:text-fg"
        >
          К каталогу
        </button>
        {siblings.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onPickLine(s.id)}
            className={`flex h-11 items-center rounded-lg border px-3 font-display text-sm ${
              s.id === line.id ? "border-brass-dim bg-surface-2" : "border-line text-muted"
            }`}
          >
            {s.name}
            {s.count > 0 ? <span className="ml-2 font-mono text-xs text-faint">×{s.count}</span> : null}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <MarketMeta line={line} />
        <Gallery key={line.id} images={line.images} alt={line.name} />
        <div className="p-4">
          <p className="font-mono text-xs tracking-[0.16em] text-brass uppercase">
            {line.maker} · {line.rarity} · {SIZE_ABBR[line.size]} {line.spec}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <h2 className="font-display text-3xl font-semibold">{line.name}</h2>
            <span className={`font-mono text-xs uppercase ${STATUS_TONE[line.status]}`}>{STATUS_LABEL[line.status]}</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted">{line.note}</p>
          <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat k="Длина" v={line.length != null ? `${line.length} м` : "—"} />
            <Stat k="Экипаж" v={String(line.crew)} />
            <Stat k="Бак" v={line.fuel != null ? String(line.fuel) : "—"} />
            <Stat k="Скан" v={line.scan != null ? String(line.scan) : "—"} />
          </dl>
        </div>
      </div>

      <section>
        <p className="font-display text-xs tracking-wide text-muted uppercase">Штат маркета</p>
        <SlotList slots={line.crewSlots} />
      </section>

      {line.hulls.length > 0 ? (
        <section>
          <p className="font-display text-xs tracking-wide text-muted uppercase">
            Борта · выборка {line.hulls.length}
          </p>
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {line.hulls.map((h) => {
              const filled = h.seats.filter((s) => s.crewId).length;
              const on = hull?.id === h.id;
              return (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => onPickHull(h.id)}
                    className={`flex h-auto min-h-16 w-full flex-col rounded-lg border px-3 py-3 text-left ${
                      on ? "border-brass-dim bg-surface-2" : "border-line bg-surface hover:bg-surface-2/70"
                    }`}
                  >
                    <span className="font-display text-base font-medium">{h.label}</span>
                    <span className="font-mono text-xs text-muted">
                      слоты {filled}/{h.seats.length}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <p className="font-mono text-xs text-faint">В ангаре нет бортов. Витрина, не флот кромки.</p>
      )}

      {hull ? (
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="font-display text-lg font-medium">{hull.label}</p>
          <ul className="mt-3 flex flex-col gap-2">
            {hull.seats.map((seat, i) => {
              const crew = seat.crewId ? CREW.find((c) => c.id === seat.crewId) : null;
              return (
                <li key={i} className="flex items-center gap-3 rounded-lg bg-surface-2 px-3 py-2">
                  {crew ? (
                    <CrewPortrait crew={crew} size="sm" />
                  ) : (
                    <span className="size-10 rounded-md border border-dashed border-line" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[10px] text-faint uppercase">{seat.role}</p>
                    <p className="truncate font-display text-sm">{crew ? displayName(crew) : "пусто"}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function MarketMeta({ line }: { line: ShipLine }) {
  return (
    <dl className="grid grid-cols-4 gap-2 px-3 py-3 text-center">
      <Meta k="Class" v={SIZE_ABBR[line.size]} />
      <Meta k="Rarity" v={line.rarity.toUpperCase()} />
      <Meta k="Crew" v={String(line.crew)} />
      <Meta k="Supply" v={formatSupply(line.supply)} />
    </dl>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] tracking-[0.16em] text-faint uppercase">{k}</dt>
      <dd className="font-display text-lg font-semibold leading-tight">{v}</dd>
    </div>
  );
}

function Gallery({ images, alt }: { images: string[]; alt: string }) {
  const [shot, setShot] = useState(0);
  const total = images.length;
  const src = images[shot] ?? images[0];

  function step(dir: number) {
    if (total < 2) return;
    setShot((i) => (i + dir + total) % total);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        step(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        step(-1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total]);

  return (
    <div>
      <div className="relative aspect-video overflow-hidden bg-surface-2">
        <img src={src} alt={alt} className="absolute inset-0 size-full object-contain" />
        {total > 1 ? (
          <>
            <button
              type="button"
              aria-label="Предыдущий кадр"
              onClick={() => step(-1)}
              className="absolute top-1/2 left-2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-bg/80 text-fg backdrop-blur-sm hover:border-brass-dim"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Следующий кадр"
              onClick={() => step(1)}
              className="absolute top-1/2 right-2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-bg/80 text-fg backdrop-blur-sm hover:border-brass-dim"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        ) : null}
      </div>
      {total > 1 ? (
        <div className="flex min-w-0 flex-col gap-2 px-3 py-3">
          <ul className="flex min-w-0 gap-2 overflow-x-auto pb-1">
            {images.map((img, i) => (
              <li key={img} className="shrink-0">
                <button
                  type="button"
                  aria-label={`Кадр ${i + 1}`}
                  onClick={() => setShot(i)}
                  className={`block h-11 w-16 overflow-hidden rounded-md border ${
                    i === shot ? "border-brass" : "border-line opacity-70 hover:opacity-100"
                  }`}
                >
                  <img src={img} alt="" loading="lazy" className="size-full object-cover" />
                </button>
              </li>
            ))}
          </ul>
          <p className="text-center font-mono text-[10px] text-faint">Стрелки ← → листают галерею</p>
        </div>
      ) : null}
    </div>
  );
}

function SlotList({ slots }: { slots: CrewSlot[] }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {slots.map((s) => (
        <li key={s.type} className="rounded-md border border-line bg-surface px-3 py-2">
          <p className="font-mono text-[10px] tracking-wide text-faint uppercase">{s.type}</p>
          <p className="font-display text-sm">×{s.n}</p>
        </li>
      ))}
    </ul>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-3 py-2">
      <p className="font-mono text-[10px] text-faint uppercase">{k}</p>
      <p className="font-display text-sm">{v}</p>
    </div>
  );
}
