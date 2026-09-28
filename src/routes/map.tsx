import { Component, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { GlobeCanvas } from "@/components/cartograph/scene";
import { Overlay } from "@/components/cartograph/overlay";

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
  return (
    <MapBoundary>
      <main className="relative h-full min-h-[560px] w-full overflow-hidden bg-bg">
        <GlobeCanvas />
        <Overlay />
      </main>
    </MapBoundary>
  );
}
