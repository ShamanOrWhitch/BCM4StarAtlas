import { Component, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { GlobeCanvas } from "@/components/cartograph/scene";
import { Overlay } from "@/components/cartograph/overlay";
import { SageBoard } from "@/components/cartograph/sage-board";

export const Route = createFileRoute("/map")({ component: MapPage });

class MapBoundary extends Component<{ children: ReactNode }, { error: string }> {
  state = { error: "" };
  static getDerivedStateFromError(err: Error) {
    return { error: err.message || "Карта не собралась" };
  }
  render() {
    if (this.state.error) {
      return (
        <p className="p-6 text-sm text-muted">
          Карта не открылась: {this.state.error}. Остальные вкладки на месте. Если пропало меню, откройте адрес без /map.
        </p>
      );
    }
    return this.props.children;
  }
}

export function MapPage() {
  const [globe, setGlobe] = useState(true);
  return (
    <MapBoundary>
      <main className="relative h-full min-h-[560px] w-full overflow-hidden bg-bg">
        <button
          type="button"
          onClick={() => setGlobe((on) => !on)}
          className="absolute right-3 bottom-4 z-20 h-11 rounded-lg border border-line bg-surface px-3 font-display text-sm"
        >
          {globe ? "Сектора" : "3D"}
        </button>
        {globe ? (
          <>
            <GlobeCanvas />
            <Overlay />
          </>
        ) : (
          <SageBoard />
        )}
      </main>
    </MapBoundary>
  );
}
