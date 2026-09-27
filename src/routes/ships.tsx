import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppChrome } from "@/components/app-chrome";
import { loadMarket, scanDeskWallet } from "@/lib/desk";
import type { BookLevel, MarketShip } from "@/lib/desk-types";
import { addToFleet, loadFleets, saveFleets, type SavedFleet } from "@/lib/fleets";
import { walletCrew } from "@/lib/wallet-crew";
import type { Crew } from "@/data/crew";
import { CrewPortrait } from "@/components/crew/portrait";

export const Route = createFileRoute("/ships")({ component: ShipsPage });

const CLASSES = ["xx-small", "x-small", "small", "medium", "large", "capital", "commander", "titan"] as const;

const CLASS_LABEL: Record<string, string> = {
  "xx-small": "XX-Small",
  "x-small": "X-Small",
  small: "Small",
  medium: "Medium",
  large: "Large",
  capital: "Capital",
  commander: "Commander",
  titan: "Titan",
};

const RARITY_COLOR: Record<string, string> = {
  anomaly: "text-[#e85cff]",
  legendary: "text-[#e2b657]",
  epic: "text-[#a06bff]",
  rare: "text-[#4c8dff]",
  uncommon: "text-[#3dba7a]",
  common: "text-[#9aa3ad]",
};

function money(n: number | null, digits: number) {
  if (n == null) return "—";
  return n.toLocaleString("ru-RU", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function ShipsPage() {
  const [ships, setShips] = useState<MarketShip[]>([]);
  const [held, setHeld] = useState<Record<string, number>>({});
  const [crew, setCrew] = useState<Crew[]>([]);
  const [klass, setKlass] = useState<string>("x-small");
  const [open, setOpen] = useState<string | null>(null);
  const [fleets, setFleets] = useState<SavedFleet[]>([]);
  const [tab, setTab] = useState("market");
  const [error, setError] = useState("");

  useEffect(() => {
    setFleets(loadFleets());
    void loadMarket()
      .then((snap) => setShips(snap.marketShips ?? []))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Каталог не открылся"));
    const owner = localStorage.getItem("galia-owner");
    if (!owner) return;
    void scanDeskWallet({ data: { owner } })
      .then((scan) => {
        const counts: Record<string, number> = {};
        for (const item of scan.items) {
          if (item.kind === "ship") counts[item.mint] = (counts[item.mint] ?? 0) + item.amount;
        }
        setHeld(counts);
        setCrew(walletCrew(scan.items));
      })
      .catch(() => undefined);
  }, []);

  const visible = useMemo(() => ships.filter((ship) => ship.className === klass), [ships, klass]);
  const picked = ships.find((ship) => ship.mint === open) ?? null;
  const fleet = fleets.find((row) => row.id === tab) ?? null;

  return (
    <AppChrome current="ships" kicker="play.staratlas.com/market · корабли" title="Флот">
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-line px-3 py-2">
          <Tab on={tab === "market"} onClick={() => setTab("market")} label="Рынок" />
          {fleets.map((row) => (
            <Tab key={row.id} on={tab === row.id} onClick={() => setTab(row.id)} label={row.name} />
          ))}
        </div>
        {error ? <p className="px-4 py-2 text-sm text-danger">{error}</p> : null}
        {tab === "market" ? (
          <div className="flex min-h-0 flex-1">
            <div className={`${picked ? "hidden md:flex" : "flex"} min-h-0 w-full flex-col md:w-[22rem] md:shrink-0 md:border-r md:border-line`}>
              <div className="flex gap-2 overflow-x-auto border-b border-line px-3 py-2">
                {CLASSES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setKlass(item);
                      setOpen(null);
                    }}
                    className={`h-11 shrink-0 rounded-full border px-3 font-display text-sm ${klass === item ? "border-brass-dim bg-surface-2 text-fg" : "border-line text-muted"}`}
                  >
                    {CLASS_LABEL[item]}
                  </button>
                ))}
              </div>
              <ul className="min-h-0 flex-1 overflow-y-auto">
                {visible.map((ship) => (
                  <li key={ship.mint}>
                    <button type="button" onClick={() => setOpen(ship.mint)} className="flex w-full items-center gap-3 border-b border-line px-3 py-2 text-left hover:bg-surface">
                      {ship.image ? <img src={ship.image} alt="" className="size-14 rounded-md object-cover" /> : <div className="size-14 rounded-md bg-surface-2" />}
                      <span className="min-w-0">
                        <span className="block truncate font-display text-base">{ship.name}</span>
                        <span className={`font-mono text-xs uppercase ${RARITY_COLOR[ship.rarity] ?? "text-muted"}`}>{ship.rarity}</span>
                        <span className="mt-0.5 block font-mono text-xs text-muted">
                          USDC {money(ship.usdcAsks[0]?.price ?? null, 2)} · ATLAS {money(ship.atlasAsks[0]?.price ?? null, 2)}
                          {held[ship.mint] ? ` · есть ×${held[ship.mint]}` : ""}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
                {!visible.length ? <li className="px-3 py-8 text-sm text-muted">В этом классе пусто.</li> : null}
              </ul>
            </div>
            <div className={`${picked ? "flex" : "hidden md:flex"} min-h-0 min-w-0 flex-1 flex-col overflow-y-auto`}>
              {picked ? (
                <ShipSheet
                  ship={picked}
                  held={held[picked.mint] ?? 0}
                  fleets={fleets}
                  onBack={() => setOpen(null)}
                  onFleet={(name, qty) => setFleets(addToFleet(fleets, name, { mint: picked.mint, name: picked.name, image: picked.image, qty }))}
                />
              ) : (
                <p className="px-6 py-16 text-muted">Выберите корпус слева. Откроются картинка, описание и два стакана: продавцы и покупатели.</p>
              )}
            </div>
          </div>
        ) : fleet ? (
          <FleetSheet
            fleet={fleet}
            crew={crew}
            onChange={(rows) => {
              setFleets(rows);
              setTab("market");
            }}
          />
        ) : null}
      </div>
    </AppChrome>
  );
}

function Tab({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className={`h-11 shrink-0 rounded-full border px-3 font-display text-sm ${on ? "border-brass-dim bg-surface-2 text-fg" : "border-line text-muted"}`}>
      {label}
    </button>
  );
}

function ShipSheet({
  ship,
  held,
  fleets,
  onBack,
  onFleet,
}: {
  ship: MarketShip;
  held: number;
  fleets: SavedFleet[];
  onBack: () => void;
  onFleet: (name: string, qty: number) => void;
}) {
  const [shot, setShot] = useState(ship.image);
  const [qty, setQty] = useState(1);
  const [name, setName] = useState("");
  const shots = [ship.image, ...ship.gallery].filter(Boolean);
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-3 py-4 md:px-6">
      <button type="button" onClick={onBack} className="h-11 self-start font-display text-sm text-muted md:hidden">
        ← список
      </button>
      <p className="font-mono text-xs text-faint">
        SHIPS / {CLASS_LABEL[ship.className] ?? ship.className} / {ship.name}
      </p>
      <img src={shot || ship.image} alt="" className="max-h-80 w-full rounded-xl bg-surface-2 object-contain" />
      {shots.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto">
          {shots.map((src) => (
            <button key={src} type="button" onClick={() => setShot(src)} className="shrink-0">
              <img src={src} alt="" className="h-16 w-24 rounded-md object-cover" />
            </button>
          ))}
        </div>
      ) : null}
      <div>
        <h2 className="font-display text-3xl">{ship.name.replace(ship.make, "").trim() || ship.name}</h2>
        <p className="text-muted">{ship.make} {ship.spec}</p>
        <p className="mt-2 font-mono text-xs uppercase">
          <span className={RARITY_COLOR[ship.rarity] ?? "text-muted"}>{ship.rarity}</span>
          <span className="text-faint"> · {CLASS_LABEL[ship.className] ?? ship.className} · экипаж {ship.crew || "—"}</span>
          {ship.msrp != null ? <span className="text-faint"> · MSRP {money(ship.msrp, 2)} USDC</span> : null}
          {held ? <span className="text-ok"> · есть в наличии ×{held}</span> : null}
        </p>
        {ship.slots.length ? <p className="mt-1 text-sm text-ice">{ship.slots.join(" · ")}</p> : null}
        <p className="mt-3 text-sm leading-relaxed text-muted">{ship.description}</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Book title="USDC" asks={ship.usdcAsks} bids={ship.usdcBids} digits={2} />
        <Book title="ATLAS" asks={ship.atlasAsks} bids={ship.atlasBids} digits={2} />
      </div>
      <form
        className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-3"
        onSubmit={(event) => {
          event.preventDefault();
          onFleet(name, Math.max(1, qty));
          setName("");
        }}
      >
        <p className="w-full font-display text-sm">Добавить в флот</p>
        <input
          type="number"
          min={1}
          value={qty}
          onChange={(event) => setQty(Number(event.target.value))}
          className="h-11 w-20 rounded-md border border-line bg-bg px-2"
          aria-label="Количество"
        />
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Имя нового флота"
          className="h-11 min-w-40 flex-1 rounded-md border border-line bg-bg px-2"
        />
        <button type="submit" className="h-11 rounded-md border border-brass-dim px-3 font-display text-sm">
          Создать
        </button>
        {fleets.map((fleet) => (
          <button key={fleet.id} type="button" className="h-11 rounded-full border border-line px-3 text-sm" onClick={() => onFleet(fleet.name, Math.max(1, qty))}>
            В «{fleet.name}»
          </button>
        ))}
      </form>
    </div>
  );
}

function Book({ title, asks, bids, digits }: { title: string; asks: BookLevel[]; bids: BookLevel[]; digits: number }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-3">
      <h3 className="font-display text-sm tracking-[0.16em] text-brass uppercase">{title}</h3>
      <Level title="Продавцы" rows={asks} digits={digits} />
      <Level title="Покупатели" rows={bids} digits={digits} />
    </section>
  );
}

function Level({ title, rows, digits }: { title: string; rows: BookLevel[]; digits: number }) {
  return (
    <div className="mt-2">
      <p className="font-mono text-xs text-faint">{title}</p>
      {rows.length ? (
        <ul>
          {rows.map((row) => (
            <li key={`${title}-${row.price}`} className="flex justify-between font-mono text-sm">
              <span>×{row.qty}</span>
              <span>{money(row.price, digits)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Пусто</p>
      )}
    </div>
  );
}

function FleetSheet({ fleet, crew, onChange }: { fleet: SavedFleet; crew: Crew[]; onChange: (rows: SavedFleet[]) => void }) {
  const [job, setJob] = useState("Flight");
  const [calm, setCalm] = useState(100);
  const jobs = ["Flight", "Operator", "Command", "Engineering", "Medical", "Science", "Fitness", "Hospitality"];
  const matches = crew
    .filter((member) => member.aptitudes.some((apt) => apt.name === job) && member.n <= calm)
    .slice(0, 6);
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-6">
      <h2 className="font-display text-2xl">{fleet.name}</h2>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {fleet.hulls.map((hull) => (
          <li key={hull.mint} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-2">
            {hull.image ? <img src={hull.image} alt="" className="size-16 rounded-md object-cover" /> : null}
            <span>
              <span className="block font-display">{hull.name}</span>
              <span className="font-mono text-sm text-muted">×{hull.qty}</span>
            </span>
          </li>
        ))}
      </ul>
      <section className="mt-6">
        <h3 className="font-display text-sm tracking-[0.16em] text-brass uppercase">Подбор в этот флот</h3>
        <p className="mt-1 text-sm text-muted">Сначала профессия, потом потолок нервов. Картинка того, кто подходит.</p>
        <div className="mt-2 flex gap-2 overflow-x-auto">
          {jobs.map((item) => (
            <button key={item} type="button" onClick={() => setJob(item)} className={`h-11 shrink-0 rounded-full border px-3 text-sm ${job === item ? "border-brass-dim bg-surface-2" : "border-line text-muted"}`}>
              {item}
            </button>
          ))}
        </div>
        <label className="mt-3 block text-sm text-muted">
          Нервы не выше {calm}
          <input type="range" min={0} max={100} value={calm} onChange={(event) => setCalm(Number(event.target.value))} className="mt-1 w-full" />
        </label>
        {matches.length ? (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {matches.map((member) => (
              <li key={member.id} className="flex items-center gap-3 rounded-xl border border-line p-2">
                <CrewPortrait crew={member} size="lg" />
                <span>
                  <span className="block font-display">{member.given} {member.family}</span>
                  <span className="text-sm text-muted">{member.aptitudes.map((apt) => `${apt.name} ${apt.xp === 50 ? "major" : "minor"}`).join(" · ")}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">На ключе нет такой профессии. Сначала откройте сейф и прочитайте кошелёк.</p>
        )}
      </section>
      <button
        type="button"
        className="mt-6 h-11 text-sm text-danger"
        onClick={() => {
          const next = loadFleets().filter((row) => row.id !== fleet.id);
          saveFleets(next);
          onChange(next);
        }}
      >
        Удалить флот
      </button>
    </div>
  );
}
