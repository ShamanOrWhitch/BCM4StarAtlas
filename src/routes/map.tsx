import { Component, useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Overlay } from "@/components/cartograph/overlay";
import { useCartograph } from "@/components/cartograph/store";
import { SYSTEMS, cssMarker } from "@/data/systems";
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

function aimHome() {
  const scan = rememberedWalletScan();
  const race = scan ? raceOf(scan.items) : null;
  const id = race === "Ustur" ? "ustur" : race === "MUD" ? "mud" : "oni";
  const system = SYSTEMS.find((row) => row.id === id) ?? SYSTEMS[0];
  const station = cssMarker(system);
  useCartograph.setState({ systemId: system.id, markerId: station?.id ?? "oni-css", focusNonce: 0 });
}

export function MapPage() {
  const [CanvasView, setCanvasView] = useState<ComponentType | null>(null);
  const [webglError, setWebglError] = useState("");
  const [progress, setProgress] = useState(12);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    aimHome();
    const creep = window.setInterval(() => setProgress((n) => (n < 70 ? n + 4 : n)), 140);
    void import("@/components/cartograph/scene")
      .then((mod) => {
        if (!alive.current) return;
        setCanvasView(() => mod.GlobeCanvas);
        setProgress(100);
      })
      .catch((err: unknown) => {
        if (!alive.current) return;
        setWebglError(err instanceof Error ? err.message : "Карта не загрузилась");
      })
      .finally(() => window.clearInterval(creep));
    return () => {
      alive.current = false;
      window.clearInterval(creep);
    };
  }, []);

  return (
    <main className="relative h-full min-h-[560px] w-full overflow-hidden bg-bg">
      {CanvasView && !webglError ? (
        <CanvasBoundary onError={(message) => setWebglError(message)}>
          <CanvasView />
        </CanvasBoundary>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-[#07090e]">
          <div className="w-[min(100%,280px)] px-6 text-center">
            <p className="font-display text-xs tracking-[0.22em] text-brass uppercase">
              {webglError ? "3D не открылось" : "ONI CSS"}
            </p>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-brass transition-[width] duration-200" style={{ width: `${webglError ? 100 : progress}%` }} />
            </div>
            <p className="mt-2 text-sm text-muted">{webglError || "Спутник и корабли. Меню на месте."}</p>
          </div>
        </div>
      )}
      <Overlay />
    </main>
  );
}
