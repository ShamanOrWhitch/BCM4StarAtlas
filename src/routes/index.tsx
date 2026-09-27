import { createFileRoute } from "@tanstack/react-router";
import { CrewBay } from "@/components/crew/bay";

export const Route = createFileRoute("/")({ component: HomePage });

export function HomePage() {
  return <CrewBay />;
}
