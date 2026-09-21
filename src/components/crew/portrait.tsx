import type { Crew, Species } from "@/data/crew";

function portraitSrc(c: Crew) {
  const female = c.sex === "Female";
  const key: Record<Species, string> = {
    "High Punaab": female ? "high-punaab-female" : "high-punaab-male",
    "Profound Punaab": female ? "profound-punaab-female" : "profound-punaab-male",
    Sogmian: female ? "sogmian-female" : "sogmian-male",
    Human: female ? "human-female" : "human-male",
    Ustur: c.sex === "Body 2" ? "ustur-body2" : "ustur-body1",
    Mierese: female ? "mierese-female" : "mierese-male",
  };
  return `/portraits/${key[c.species]}.jpg`;
}

function glyph(c: Crew) {
  if (c.ustur) return c.ustur.replace(".", "").slice(0, 2).toUpperCase();
  return (c.given[0] + (c.family[0] ?? c.given[1] ?? "")).toUpperCase();
}

export function CrewPortrait({ crew, size = "md" }: { crew: Crew; size?: "sm" | "md" | "lg" }) {
  const dim = size === "lg" ? "size-20" : size === "sm" ? "size-10" : "size-12";
  const type = size === "lg" ? "text-xs" : "text-[9px]";
  return (
    <span className={`relative inline-flex shrink-0 overflow-hidden rounded-md bg-surface-2 ${dim}`} aria-hidden>
      <img src={portraitSrc(crew)} alt="" className="size-full object-cover" />
      <span
        className={`absolute right-0 bottom-0 left-0 bg-bg/70 px-0.5 text-center font-display font-semibold tracking-wide text-fg ${type}`}
      >
        {glyph(crew)}
      </span>
    </span>
  );
}
