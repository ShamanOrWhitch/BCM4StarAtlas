import { useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DesertIsland } from "@/components/desert-island";
import { ShoalRace } from "@/components/shoal-race";
import "./styles.css";

declare global {
  interface Window {
    BCMFirstPlanet?: {
      mount: (target: HTMLElement) => void;
      unmount: (target: HTMLElement) => void;
    };
  }
}

const roots = new WeakMap<HTMLElement, Root>();

function FirstPlanetApp() {
  const [mode, setMode] = useState<"island" | "race">("island");
  return mode === "race"
    ? <ShoalRace onLeave={() => setMode("island")} />
    : <DesertIsland onRace={() => setMode("race")} />;
}

window.BCMFirstPlanet = {
  mount(target: HTMLElement) {
    let root = roots.get(target);
    if (!root) {
      root = createRoot(target);
      roots.set(target, root);
    }
    root.render(<FirstPlanetApp />);
  },
  unmount(target: HTMLElement) {
    const root = roots.get(target);
    if (!root) return;
    root.unmount();
    roots.delete(target);
  },
};
