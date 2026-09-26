import { createFileRoute } from "@tanstack/react-router";
import { CrewBay } from "@/components/crew/bay";

export const Route = createFileRoute("/crew")({ component: CrewPage });

export function CrewPage() {
  return <CrewBay />;
}
