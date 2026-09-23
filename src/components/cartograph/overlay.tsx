import { useEffect, useMemo, useState, type ReactNode } from "react";
import { MapPin, Star, Orbit } from "lucide-react";
import { SYSTEMS, FACTION_TONE, markerKey, type Marker, type MarkerKind, type Placement } from "@/data/systems";
import { loadFavorites } from "@/lib/favorites";
import { AppNav } from "@/components/app-nav";
import { ArchiveButton, ArchivePanel } from "@/components/archive";
import { useCartograph } from "./store";

const KIND: Record<MarkerKind, string> = {
  station: "станция",
  port: "порт",
  claim: "клейм",
  core: "ядро",
  yard: "верфь",
};

const PLACE: Record<Placement, string> = {
  orbit: "орбита",
  surface: "планета",
  hab: "на CSS",
};

export function Overlay() {
  const systemId = useCartograph((s) => s.systemId);
  const markerId = useCartograph((s) => s.markerId);
  const favorites = useCartograph((s) => s.favorites);
  const autoRotate = useCartograph((s) => s.autoRotate);
  const setSystem = useCartograph((s) => s.setSystem);
  const selectMarker = useCartograph((s) => s.selectMarker);
  const toggleFavorite = useCartograph((s) => s.toggleFavorite);
  const setAutoRotate = useCartograph((s) => s.setAutoRotate);
  const [openList, setOpenList] = useState<"systems" | "places" | null>(null);
  const [archive, setArchive] = useState(false);

  useEffect(() => {
    useCartograph.setState({ favorites: loadFavorites() });
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      useCartograph.setState({ autoRotate: false });
    }
  }, []);

  const system = SYSTEMS.find((s) => s.id === systemId) ?? SYSTEMS[0];
  const marker = system.markers.find((m) => m.id === markerId) ?? null;
  const favKey = marker ? markerKey(system.id, marker.id) : "";
  const favItems = useMemo(
    () =>
      favorites
        .map((key) => {
          const [sid, mid] = key.split(":");
          const sys = SYSTEMS.find((s) => s.id === sid);
          const mk = sys?.markers.find((m) => m.id === mid);
          if (!sys || !mk) return null;
          return { key, sys, mk };
        })
        .filter((x): x is NonNullable<typeof x> => Boolean(x)),
    [favorites],
  );

  function jumpFav(sid: string, mid: string) {
    if (sid !== systemId) setSystem(sid);
    window.setTimeout(() => useCartograph.getState().selectMarker(mid), sid !== systemId ? 40 : 0);
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-10 text-fg">
      <header className="pointer-events-auto absolute top-0 right-0 left-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-bg/85 px-3 backdrop-blur-md md:h-16 md:px-4">
        <div className="min-w-0 flex-1">
          <p className="font-display text-[10px] tracking-[0.22em] text-brass uppercase">Star Atlas · Galia</p>
          <p className="truncate font-display text-base font-semibold leading-tight md:text-lg">{system.name}</p>
        </div>
        <div className="hidden md:block">
          <AppNav current="map" />
        </div>
        <ArchiveButton onClick={() => setArchive(true)} />
        <button
          type="button"
          onClick={() => setAutoRotate(!autoRotate)}
          className="flex size-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-line bg-surface font-display text-sm md:w-auto md:px-3"
        >
          <Orbit className="size-4 text-brass" />
          <span className="hidden md:inline">{autoRotate ? "Авто" : "Стоп"}</span>
        </button>
      </header>

      <aside className="pointer-events-auto absolute top-16 bottom-40 left-3 hidden w-56 flex-col gap-2 md:flex md:left-4">
        <Panel title="Системы">
          <ul className="flex flex-col gap-0.5">
            {SYSTEMS.map((s) => {
              const active = s.id === systemId;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setSystem(s.id)}
                    className={`flex h-11 w-full items-center justify-between rounded-md px-3 text-left transition-colors duration-150 ${
                      active ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface-2/60 hover:text-fg"
                    }`}
                  >
                    <span className="truncate font-display font-medium">{s.name}</span>
                    <span className="font-mono text-[10px] uppercase" style={{ color: FACTION_TONE[s.faction] }}>
                      {s.faction}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>
      </aside>

      <aside className="pointer-events-auto absolute top-16 right-3 bottom-40 hidden w-64 flex-col gap-2 md:flex md:right-4">
        <Panel title="Локации">
          <ul className="flex flex-col gap-0.5">
            {system.markers.map((m) => (
              <li key={m.id}>
                <PlaceButton marker={m} active={m.id === markerId} starred={favorites.includes(markerKey(system.id, m.id))} onClick={() => selectMarker(m.id)} />
              </li>
            ))}
          </ul>
        </Panel>
        <div className="max-h-36 shrink-0 overflow-hidden rounded-xl border border-line bg-surface/80 backdrop-blur-md">
          <p className="px-4 pt-3 pb-1 font-display text-[10px] tracking-[0.18em] text-brass uppercase">Избранное</p>
          <div className="max-h-24 overflow-y-auto px-2 pb-2">
            {favItems.length === 0 ? (
              <p className="px-1 py-2 text-sm text-muted">Звезда на карточке — список в этом браузере.</p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {favItems.map(({ key, sys, mk }) => (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => jumpFav(sys.id, mk.id)}
                      className="flex h-11 w-full items-center gap-2 rounded-md px-3 text-left text-muted hover:bg-surface-2/60 hover:text-fg"
                    >
                      <Star className="size-3.5 fill-brass text-brass" />
                      <span className="min-w-0 flex-1 truncate font-display text-sm">{mk.name}</span>
                      <span className="font-mono text-[10px] text-faint">{sys.faction}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </aside>

      <div className="pointer-events-auto absolute top-16 right-3 left-3 z-20 flex gap-2 md:hidden">
        <MobileMenu
          label="Системы"
          open={openList === "systems"}
          onToggle={() => setOpenList(openList === "systems" ? null : "systems")}
        >
          {SYSTEMS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setSystem(s.id);
                setOpenList(null);
              }}
              className="flex h-11 w-full items-center justify-between px-3 text-left text-sm"
            >
              {s.name}
              <span className="font-mono text-xs" style={{ color: FACTION_TONE[s.faction] }}>
                {s.faction}
              </span>
            </button>
          ))}
        </MobileMenu>
        <MobileMenu
          label="Места"
          open={openList === "places"}
          onToggle={() => setOpenList(openList === "places" ? null : "places")}
        >
          {system.markers.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                selectMarker(m.id);
                setOpenList(null);
              }}
              className="flex h-11 w-full items-center gap-2 px-3 text-left text-sm"
            >
              <MapPin className="size-3.5 text-brass" />
              <span className="min-w-0 flex-1 truncate">{m.name}</span>
              <span className="font-mono text-[10px] text-faint">{PLACE[m.placement]}</span>
            </button>
          ))}
        </MobileMenu>
      </div>

      <footer className="pointer-events-none absolute right-3 bottom-32 left-3 md:right-80 md:bottom-16 md:left-64">
        <div className="pointer-events-auto mx-auto max-w-lg">
          {marker ? (
            <div className="rounded-xl border border-line bg-surface/90 px-4 py-3 backdrop-blur-md">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] tracking-[0.16em] text-brass uppercase">
                    {KIND[marker.kind]} · {PLACE[marker.placement]}
                  </p>
                  <h2 className="font-display text-lg font-semibold">{marker.name}</h2>
                  <p className="mt-1 text-sm leading-snug text-muted">{marker.blurb}</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleFavorite(favKey)}
                  className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-line"
                >
                  <Star className={`size-4 ${favorites.includes(favKey) ? "fill-brass text-brass" : "text-muted"}`} />
                </button>
              </div>
            </div>
          ) : (
            <p className="rounded-xl border border-line bg-surface/80 px-4 py-3 text-sm text-muted backdrop-blur-md">
              {system.lore}
            </p>
          )}
        </div>
      </footer>

      <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 md:hidden">
        <AppNav current="map" variant="dock" />
      </div>
      {archive ? <ArchivePanel onClose={() => setArchive(false)} /> : null}
    </div>
  );
}

function PlaceButton({
  marker,
  active,
  starred,
  onClick,
}: {
  marker: Marker;
  active: boolean;
  starred: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-11 w-full items-center gap-2 rounded-md px-3 text-left transition-colors duration-150 ${
        active ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface-2/60 hover:text-fg"
      }`}
    >
      <MapPin className="size-3.5 shrink-0 text-brass" />
      <span className="min-w-0 flex-1 truncate font-display">{marker.name}</span>
      <span className="font-mono text-[10px] text-faint">{PLACE[marker.placement]}</span>
      {starred ? <Star className="size-3.5 fill-brass text-brass" /> : null}
    </button>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-line bg-surface/80 backdrop-blur-md">
      <p className="shrink-0 px-4 pt-3 pb-1 font-display text-[10px] tracking-[0.18em] text-brass uppercase">{title}</p>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">{children}</div>
    </div>
  );
}

function MobileMenu({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="relative min-w-0 flex-1">
      <button
        type="button"
        onClick={onToggle}
        className="flex h-11 w-full items-center justify-center rounded-lg border border-line bg-surface/90 font-display text-sm backdrop-blur-md"
      >
        {label}
      </button>
      {open ? (
        <div className="absolute top-12 right-0 left-0 z-30 max-h-64 overflow-y-auto rounded-lg border border-line bg-surface">
          {children}
        </div>
      ) : null}
    </div>
  );
}
