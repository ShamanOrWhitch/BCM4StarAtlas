import { useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DesertIsland } from "@/components/desert-island";
import { ShoalRace } from "@/components/shoal-race";
import "./styles.css";

declare global {
  interface Window {
    BCMFirstPlanet?: {
      mount: (target: HTMLElement) => Promise<void>;
      unmount: (target: HTMLElement) => void;
    };
  }
}

const roots = new WeakMap<HTMLElement, Root>();
const readiness = new WeakMap<HTMLElement, Promise<void>>();

function FirstPlanetApp({
  onReady,
  onLoadError,
}: {
  onReady: () => void;
  onLoadError: (error: unknown) => void;
}) {
  const [mode, setMode] = useState<"island" | "race">("island");
  return mode === "race"
    ? <ShoalRace onLeave={() => setMode("island")} />
    : <DesertIsland
        onRace={() => setMode("race")}
        onReady={onReady}
        onLoadError={onLoadError}
      />;
}

window.BCMFirstPlanet = {
  mount(target: HTMLElement) {
    let ready = readiness.get(target);
    if (ready) return ready;

    let root = roots.get(target);
    if (!root) {
      root = createRoot(target);
      roots.set(target, root);
    }

    ready = new Promise<void>((resolve, reject) => {
      root!.render(
        <FirstPlanetApp
          onReady={resolve}
          onLoadError={reject}
        />,
      );
    });
    readiness.set(target, ready);
    return ready;
  },
  unmount(target: HTMLElement) {
    const root = roots.get(target);
    if (!root) return;
    root.unmount();
    roots.delete(target);
    readiness.delete(target);
  },
};
