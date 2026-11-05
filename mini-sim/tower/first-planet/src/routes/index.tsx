import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { DesertIsland } from "@/components/desert-island";
import { ShoalRace } from "@/components/shoal-race";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const [mode, setMode] = useState<"island" | "race">("island");
  if (mode === "race") return <ShoalRace onLeave={() => setMode("island")} />;
  return <DesertIsland onRace={() => setMode("race")} />;
}
