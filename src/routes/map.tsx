import { Component, useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Overlay } from "@/components/cartograph/overlay";
import { SageBoard } from "@/components/cartograph/sage-board";
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

/** Wallet race opens that CSS. No crew and no wallet stay on the Galia expanse. */
function applyHome(): boolean {
  const scan = rememberedWalletScan();
  const race = scan ? raceOf(scan.items) : null;
  if (!race) return false;
  const id = race === "Ustur" ? "ustur" : race === "MUD" ? "mud" : "oni";
  const system = SYSTEMS.find((row) => row.id === id) ?? SYSTEMS[0];
  const station = cssMarker(system);
  useCartograph.setState({ systemId: system.id, markerId: station?.id ?? "oni-css", focusNonce: 0 });
  return true;
}

export function MapPage() {
  const [globe, setGlobe] = useState(false);
  const [CanvasView, setCanvasView] = useState<ComponentType | null>(null);
  const [webglError, setWebglError] = useState("");

  const alive = useRef(true);

  async function loadCanvas() {
    try {
      const mod = await import("@/components/cartograph/scene");
      if (!alive.current) return;
      setCanvasView(() => mod.GlobeCanvas);
      setWebglError("");
      setGlobe(true);
    } catch (err) {
      if (!alive.current) return;
      setGlobe(false);
      setWebglError(err instanceof Error ? err.message : "Карта не загрузилась");
    }
  }

  useEffect(() => {
    alive.current = true;
    if (applyHome()) void loadCanvas();
    const unsub = useCartograph.subscribe((state, prev) => {
      if (state.systemId !== prev.systemId || (state.markerId && state.markerId !== prev.markerId)) {
        void loadCanvas();
      }
    });
    return () => {
      alive.current = false;
      unsub();
    };
  }, []);

  return (
    <main className="relative h-full min-h-[560px] w-full overflow-hidden bg-bg">
      {globe && CanvasView && !webglError ? (
        <CanvasBoundary
          onError={(message) => {
            setWebglError(message);
            setGlobe(false);
          }}
        >
          <CanvasView />
        </CanvasBoundary>
      ) : (
        <div className="h-full overflow-y-auto pt-16">
          {webglError ? (
            <p className="px-4 pt-3 text-sm text-muted">3D не открылось ({webglError}). Меню на месте.</p>
          ) : null}
          <SageBoard
            onOpen={(id) => {
              useCartograph.getState().setSystem(id);
              void loadCanvas();
            }}
          />
        </div>
      )}
      <Overlay expanse={!globe} />
      <button
        type="button"
        onClick={() => {
          if (globe) {
            setGlobe(false);
            return;
          }
          const state = useCartograph.getState();
          if (!state.markerId) {
            const system = SYSTEMS.find((row) => row.id === state.systemId) ?? SYSTEMS[0];
            const station = cssMarker(system);
            if (station) useCartograph.setState({ markerId: station.id });
          }
          void loadCanvas();
        }}
        className="absolute right-3 bottom-20 z-20 h-11 rounded-lg border border-line bg-surface px-3 font-display text-sm md:bottom-4"
      >
        {globe ? "Galia" : "3D · CSS"}
      </button>
    </main>
  );
}
