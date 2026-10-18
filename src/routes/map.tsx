import { Component, useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Overlay } from "@/components/cartograph/overlay";
import { SagePlane } from "@/components/cartograph/sage-plane";
import { useCartograph } from "@/components/cartograph/store";
import { FACTION_TONE, SYSTEMS, cssMarker } from "@/data/systems";
import type { WalletItem } from "@/lib/desk-types";
import { rememberedWalletScan } from "@/lib/wallet-cache";

export const Route = createFileRoute("/map")({ component: MapPage });

class CanvasBoundary extends Component<{ children: ReactNode; onError: (message: string) => void }, { error: string }> {
  state = { error: "" };
  static getDerivedStateFromError(err: Error) {
    return { error: err.message || "WebGL" };
  }
  componentDidCatch(err: Error) {
    this.props.onError(err.message || "WebGL");
  }
  render() {
    if (this.state.error) return null;
    return this.props.children;
  }
}

type Race = "ONI" | "MUD" | "Ustur";
type View = "sector" | "galaxy";

const JUMPS = [
  { id: "oni", label: "ONI CSS" },
  { id: "ustur", label: "Ustur" },
  { id: "mud", label: "MUD" },
] as const;

function raceOf(items: WalletItem[]): Race | null {
  let oni = 0;
  let mud = 0;
  let ustur = 0;
  for (const item of items) {
    if (item.kind !== "crew") continue;
    const raw = (item.traits.find((row) => /species/i.test(row.trait))?.value || item.spec || "").toLowerCase();
    if (!raw) continue;
    if (raw.includes("ustur")) ustur += 1;
    else if (raw.includes("human")) mud += 1;
    else if (raw.includes("punaab") || raw.includes("sogm") || raw.includes("miere")) oni += 1;
  }
  const top = Math.max(oni, mud, ustur);
  if (top === 0) return null;
  if (ustur > oni && ustur > mud) return "Ustur";
  if (mud > oni && mud > ustur) return "MUD";
  if (oni > mud && oni > ustur) return "ONI";
  if (oni === top) return "ONI";
  if (ustur === top) return "Ustur";
  return "MUD";
}

function homeId(race: Race | null) {
  if (race === "Ustur") return "ustur";
  if (race === "MUD") return "mud";
  return "oni";
}

function aim(id: string) {
  const system = SYSTEMS.find((row) => row.id === id) ?? SYSTEMS[0];
  const station = cssMarker(system);
  useCartograph.setState({ systemId: system.id, markerId: station?.id ?? null, focusNonce: 0 });
}

export function MapPage() {
  const systemId = useCartograph((s) => s.systemId);
  const [view, setView] = useState<View>("sector");
  const [globe, setGlobe] = useState(false);
  const [CanvasView, setCanvasView] = useState<ComponentType | null>(null);
  const [webglError, setWebglError] = useState("");
  const [focus, setFocus] = useState<Race | null>(null);
  const [progress, setProgress] = useState(6);
  const alive = useRef(true);

  async function loadCanvas() {
    try {
      const mod = await import("@/components/cartograph/scene");
      if (!alive.current) return false;
      setCanvasView(() => mod.GlobeCanvas);
      setWebglError("");
      setGlobe(true);
      return true;
    } catch (err) {
      if (!alive.current) return false;
      setGlobe(false);
      setWebglError(err instanceof Error ? err.message : "Карта не загрузилась");
      setView("galaxy");
      return false;
    }
  }

  useEffect(() => {
    alive.current = true;
    const scan = rememberedWalletScan();
    const race = scan ? raceOf(scan.items) : null;
    setFocus(race);
    aim(homeId(race));
    const creep = window.setInterval(() => {
      setProgress((n) => (n < 64 ? n + 3 : n));
    }, 160);
    void (async () => {
      setProgress((n) => Math.max(n, 22));
      const ok = await loadCanvas();
      if (!alive.current) return;
      window.clearInterval(creep);
      setProgress(ok ? 100 : 0);
    })();
    return () => {
      alive.current = false;
      window.clearInterval(creep);
    };
  }, []);

  function openSector(id: string) {
    aim(id);
    setView("sector");
    setWebglError("");
    if (CanvasView) {
      setGlobe(true);
      return;
    }
    setProgress(40);
    void loadCanvas();
  }

  const showPlanet = view === "sector" && globe && CanvasView && !webglError;
  const loading = view === "sector" && !showPlanet && !webglError;
  const loadLabel = systemId === "ustur" ? "Ustur · Ioki" : systemId === "mud" ? "MUD · Pearce" : "ONI CSS";

  return (
    <main className="relative h-full min-h-[560px] w-full overflow-hidden bg-bg">
      {showPlanet ? (
        <CanvasBoundary
          onError={(message) => {
            setWebglError(message);
            setGlobe(false);
            setView("galaxy");
          }}
        >
          <CanvasView />
        </CanvasBoundary>
      ) : view === "galaxy" || webglError ? (
        <SagePlane
          focus={focus}
          onAim={(id) => aim(id)}
          onOpen={(id) => openSector(id)}
        />
      ) : null}
      {loading ? (
        <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center bg-[#07090e]">
          <div className="w-[min(100%,280px)] px-6 text-center">
            <p className="font-display text-xs tracking-[0.22em] text-brass uppercase">{loadLabel}</p>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-brass transition-[width] duration-200" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-2 font-mono text-[10px] text-faint">{Math.min(100, progress)}% · сектор, не вся галактика</p>
          </div>
        </div>
      ) : null}
      {webglError ? (
        <p className="pointer-events-none absolute top-16 right-3 left-3 z-20 text-sm text-muted">
          3D не открылось ({webglError}). Сетка на месте.
        </p>
      ) : null}
      <Overlay expanse={view === "galaxy"} />
      <div className="pointer-events-auto absolute right-3 bottom-16 left-3 z-30 flex gap-2 md:right-auto md:bottom-4 md:left-4 md:w-auto">
          {JUMPS.map((jump) => {
            const on = view === "sector" && systemId === jump.id;
            const tone = FACTION_TONE[jump.id === "ustur" ? "Ustur" : jump.id === "mud" ? "MUD" : "ONI"];
            return (
              <button
                key={jump.id}
                type="button"
                onClick={() => openSector(jump.id)}
                className={`h-11 min-w-0 flex-1 rounded-lg border px-2 font-display text-sm md:flex-none md:px-3 ${on ? "border-transparent text-[#07090e]" : "border-line bg-surface/90 text-fg"}`}
                style={on ? { background: tone } : undefined}
              >
                {jump.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setView("galaxy");
              setGlobe(false);
            }}
            className={`h-11 min-w-0 flex-1 rounded-lg border px-2 font-display text-sm md:flex-none md:px-3 ${view === "galaxy" ? "border-transparent bg-brass text-[#07090e]" : "border-line bg-surface/90 text-fg"}`}
          >
            Galaxy
          </button>
      </div>
    </main>
  );
}