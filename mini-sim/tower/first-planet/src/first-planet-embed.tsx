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
  raceAudioUrl?: string;
  live?: boolean;
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
      setLive?: (target: HTMLElement, live: boolean) => void;
    };
  }
}

const roots = new WeakMap<HTMLElement, Root>();
const readiness = new WeakMap<HTMLElement, Promise<void>>();
const liveSetters = new WeakMap<HTMLElement, (live: boolean) => void>();

function FirstPlanetApp({
  context,
  registerLive,
  onReady,
  onLoadError,
}: {
  context: PlanetContext;
  registerLive: (setter: (live: boolean) => void) => void;
  onReady: () => void;
  onLoadError: (error: unknown) => void;
}) {
  const [mode, setMode] = useState<"island" | "race">("island");
  const [live, setLive] = useState(context.live !== false);
  const planetMusicRef = useRef<HTMLAudioElement | null>(null);
  const raceMusicRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    registerLive(setLive);
  }, [registerLive]);

  useEffect(() => {
    const makeAudio = (url: string | undefined) => {
      if (!url) return null;
      const audio = new Audio(url);
      audio.preload = "none";
      audio.loop = true;
      audio.volume = 0.58;
      return audio;
    };
    const planetAudio = makeAudio(context.audioUrl);
    const raceAudio = makeAudio(context.raceAudioUrl);
    planetMusicRef.current = planetAudio;
    raceMusicRef.current = raceAudio;
    return () => {
      [planetAudio, raceAudio].forEach((audio) => {
        if (!audio) return;
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      });
      planetMusicRef.current = null;
      raceMusicRef.current = null;
    };
  }, [context.audioUrl, context.raceAudioUrl]);

  const playTrack = (audio: HTMLAudioElement | null) => {
    if (!audio || (!audio.paused && !audio.ended)) return;
    if (audio.ended) {
      try { audio.currentTime = 0; } catch { /* metadata may not be ready */ }
    }
    const result = audio.play();
    if (result && typeof result.catch === "function") result.catch(() => {
      // Browser autoplay policy: the next explicit user action can retry.
    });
  };

  const startPlanetMusic = () => {
    raceMusicRef.current?.pause();
    playTrack(planetMusicRef.current);
  };

  const startRaceMusic = () => {
    planetMusicRef.current?.pause();
    playTrack(raceMusicRef.current);
  };

  const leaveRace = () => {
    raceMusicRef.current?.pause();
    setMode("island");
    startPlanetMusic();
  };

  const enterTower = () => {
    window.dispatchEvent(new CustomEvent("bcm:planet:tower-enter", {
      detail: {
        seed: Number(context.seed) >>> 0,
        mode: context.mode || "single",
        sessionSeed: context.sessionSeed,
        planetSeed: context.planetSeed,
        sessionId: context.sessionId,
      },
    }));
  };

  if (window.BCMMiniSimSession) window.BCMMiniSimSession.currentLocation = "first-planet";

  return mode === "race"
    ? <ShoalRace seed={Number(context.raceSeed) >>> 0} onLeave={leaveRace} onStartAudio={startRaceMusic} />
    : <DesertIsland
        context={context}
        live={live}
        onRace={() => {
          planetMusicRef.current?.pause();
          setMode("race");
        }}
        onTowerEnter={enterTower}
        onStartAudio={startPlanetMusic}
        onReady={onReady}
        onLoadError={onLoadError}
      />;
}

const api = {
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
      raceAudioUrl: String(context.raceAudioUrl || ""),
      live: context.live !== false,
    };
    const registerLive = (setter: (live: boolean) => void) => {
      liveSetters.set(target, setter);
    };
    ready = new Promise<void>((resolve, reject) => {
      root!.render(
        <FirstPlanetApp
          context={safeContext}
          registerLive={registerLive}
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
    liveSetters.delete(target);
  },
  setLive(target: HTMLElement, live: boolean) {
    liveSetters.get(target)?.(live);
  },
};

window.BCMFirstPlanet = api;
export default api;
