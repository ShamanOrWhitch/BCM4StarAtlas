import { useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DesertIsland } from "@/components/desert-island";
import { ShoalRace } from "@/components/shoal-race";
import "./styles.css";

type PlanetContext = {
  sessionId?: string;
  sessionSeed?: number;
  seed?: number;
  planetSeed?: number;
  raceSeed?: number;
  mode?: "single" | "multi";
  players?: Array<{ id?: string; name?: string; image?: string; species?: string }>;
  audioUrl?: string;
};

declare global {
  interface Window {
    BCMMiniSimSession?: {
      currentLocation?: string;
      locationSeeds?: Record<string, number>;
      [key: string]: unknown;
    };
    BCMFirstPlanet?: {
      mount: (target: HTMLElement, context?: PlanetContext) => Promise<void>;
      unmount: (target: HTMLElement) => void;
    };
  }
}

const roots = new WeakMap<HTMLElement, Root>();
const readiness = new WeakMap<HTMLElement, Promise<void>>();

function FirstPlanetApp({
  context,
  onReady,
  onLoadError,
}: {
  context: PlanetContext;
  onReady: () => void;
  onLoadError: (error: unknown) => void;
}) {
  const [mode, setMode] = useState<"island" | "race">("island");
  const musicRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audioUrl = String(context.audioUrl || "");
    if (!audioUrl) return;
    const audio = new Audio(audioUrl);
    audio.preload = "none";
    audio.loop = false;
    audio.volume = 0.58;
    musicRef.current = audio;
    return () => {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      musicRef.current = null;
    };
  }, [context.audioUrl]);

  const startPlanetMusic = () => {
    const audio = musicRef.current;
    if (!audio || (!audio.paused && !audio.ended)) return;
    if (audio.ended) {
      try { audio.currentTime = 0; } catch { /* metadata may not be ready */ }
    }
    const result = audio.play();
    if (result && typeof result.catch === "function") result.catch(() => {
      // Browser autoplay policy: the next explicit user action can retry.
    });
  };

  const enterTower = () => {
    window.dispatchEvent(new CustomEvent("bcm:planet:tower-enter", {
      detail: {
        seed: Number(context.seed ?? context.players?.length ?? 0) || undefined,
        mode: context.mode || "single",
        sessionSeed: context.sessionSeed,
        planetSeed: context.planetSeed,
        sessionId: context.sessionId,
      },
    }));
  };

  return mode === "race"
    ? <ShoalRace onLeave={() => setMode("island")} onStartAudio={startPlanetMusic} />
    : <DesertIsland
        context={context}
        onRace={() => {
          startPlanetMusic();
          setMode("race");
        }}
        onTowerEnter={enterTower}
        onStartAudio={startPlanetMusic}
        onReady={onReady}
        onLoadError={onLoadError}
      />;
}

window.BCMFirstPlanet = {
  mount(target: HTMLElement, context: PlanetContext = {}) {
    let ready = readiness.get(target);
    if (ready) return ready;

    let root = roots.get(target);
    if (!root) {
      root = createRoot(target);
      roots.set(target, root);
    }

    const safeContext: PlanetContext = {
      ...context,
      audioUrl: String(context.audioUrl || ""),
    };
    ready = new Promise<void>((resolve, reject) => {
      root!.render(
        <FirstPlanetApp
          context={safeContext}
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
