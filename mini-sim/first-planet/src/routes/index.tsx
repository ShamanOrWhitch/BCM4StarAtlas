import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { DesertIsland } from "@/components/desert-island";
import { ShoalRace } from "@/components/shoal-race";

export const Route = createFileRoute("/")({
  component: Home,
});

function play(audio: HTMLAudioElement | null) {
  if (!audio || (!audio.paused && !audio.ended)) return;
  audio.play()?.catch(() => {});
}

function Home() {
  const [mode, setMode] = useState<"island" | "race">("island");
  const planetRef = useRef<HTMLAudioElement | null>(null);
  const raceRef = useRef<HTMLAudioElement | null>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  useEffect(() => {
    const planet = new Audio("/audio/FP.mp3");
    const race = new Audio("/audio/desertrace.mp3");
    planet.loop = true;
    race.loop = true;
    planet.volume = 0.58;
    race.volume = 0.58;
    planetRef.current = planet;
    raceRef.current = race;
    const duck = (event: Event) => {
      const near = Number((event as CustomEvent<number>).detail) || 0;
      const level = 0.58 * (1 - near * 0.82);
      planet.volume = level;
      race.volume = level;
    };
    window.addEventListener("bcm:tape-near", duck);
    const retry = () => {
      if (modeRef.current === "race") {
        planet.pause();
        play(race);
      } else {
        race.pause();
        play(planet);
      }
    };
    window.addEventListener("pointerdown", retry);
    return () => {
      window.removeEventListener("pointerdown", retry);
      window.removeEventListener("bcm:tape-near", duck);
      planet.pause();
      race.pause();
    };
  }, []);

  if (mode === "race") {
    return (
      <ShoalRace
        onLeave={() => {
          raceRef.current?.pause();
          setMode("island");
        }}
        onStartAudio={() => {
          planetRef.current?.pause();
          play(raceRef.current);
        }}
      />
    );
  }
  return (
    <DesertIsland
      context={{ planetSeed: 0 }}
      onRace={() => {
        planetRef.current?.pause();
        setMode("race");
      }}
      onTowerEnter={() => setMode("island")}
      onStartAudio={() => {
        raceRef.current?.pause();
        play(planetRef.current);
      }}
    />
  );
}