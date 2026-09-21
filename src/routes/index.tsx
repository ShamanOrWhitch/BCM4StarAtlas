import { createFileRoute } from "@tanstack/react-router";
import { GlobeCanvas } from "@/components/cartograph/scene";
import { Overlay } from "@/components/cartograph/overlay";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-bg">
      <GlobeCanvas />
      <Overlay />
    </main>
  );
}
