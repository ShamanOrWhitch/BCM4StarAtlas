import { SYSTEMS, FACTION_TONE } from "@/data/systems";

const ZONES = [
  { id: "mud", title: "MUD", tone: "Красный", note: "Safe zone. Дом людей — Pearce, не Galia." },
  { id: "oni", title: "ONI", tone: "Синий", note: "Safe zone. Дом гамми — Akenat." },
  { id: "ustur", title: "Ustur", tone: "Жёлтый", note: "Safe zone. Дом роботов — Ioki, не сектор Galia." },
] as const;

export function SageBoard({ onOpen }: { onOpen?: (id: string) => void }) {
  return (
    <div className="flex h-full min-h-[560px] flex-col gap-4 overflow-y-auto bg-[#070b12] p-4 md:p-6">
      <div>
        <p className="font-display text-[10px] tracking-[0.22em] text-brass uppercase">SAGE C4 · без 3D</p>
        <h2 className="font-display text-2xl">Galia Expanse</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Galia — весь простор, не планета и не Земля. Внутри три safe zone и серая MRZ между ними. Ustur живёт на Ioki. Текстуры планет здесь не грузятся.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {ZONES.map((zone) => {
          const system = SYSTEMS.find((item) => item.id === zone.id);
          const tone = FACTION_TONE[zone.id === "ustur" ? "Ustur" : zone.id === "mud" ? "MUD" : "ONI"];
          return (
            <section key={zone.id} className="rounded-xl border border-line bg-surface p-3">
              <p className="font-display text-sm uppercase" style={{ color: tone }}>
                {zone.title} · {zone.tone}
              </p>
              <p className="mt-1 text-sm text-muted">{zone.note}</p>
              <ul className="mt-3 flex flex-col gap-1">
                {system?.markers.map((marker) => (
                  <li key={marker.id} className="rounded-md bg-surface-2 px-2 py-1.5 text-sm">
                    <span className="text-fg">{marker.name}</span>
                    <span className="text-faint"> · {marker.placement}</span>
                  </li>
                ))}
              </ul>
              {onOpen ? (
                <button
                  type="button"
                  onClick={() => onOpen(zone.id)}
                  className="mt-3 h-11 w-full rounded-lg border border-line font-display text-sm"
                >
                  3D · CSS
                </button>
              ) : null}
            </section>
          );
        })}
      </div>
      <section className="rounded-xl border border-dashed border-line p-3">
        <p className="font-display text-sm text-muted uppercase">MRZ · серый</p>
        <p className="mt-1 text-sm text-muted">Нейтраль между тремя зонами. Плоская карта — отдельный слой с координат цепи, не эта схема.</p>
      </section>
    </div>
  );
}
