import { useEffect, useRef, useState } from "react";
import { activeKeys, bindKeyboard } from "@/game/input";
import { bindGamepad } from "@/game/gamepad";
import { CAPTAIN, CASTLE_TIERS, FLEET, LOOT_NAMES, createOrbis, type FleetId, type LootKind } from "@/game/sphere/orbis";
import { createOrbisScene } from "@/game/sphere/sphere-scene";

/**
 * Orbis — the sphere planet (IDEA-033). The captain's briefing, then the flight over the whole
 * planet on the one ship core: W/S thrust, A/D turn, R/F height, Space fire, Shift boost.
 */
type Hud = {
  phase: "briefing" | "fly";
  hp: number;
  hpMax: number;
  hold: LootKind[];
  cap: number;
  materials: Record<LootKind, number>;
  castle: number;
  towers: number;
  shield: boolean;
  fortressOpen: boolean;
  note: string;
  village: { name: string; ask: string } | null;
  ship: string;
};

export function SphereWorld({
  live = true,
  onReady,
  onLoadError,
  onStartAudio,
}: {
  live?: boolean;
  onReady?: () => void;
  onLoadError?: (error: unknown) => void;
  onStartAudio?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<ReturnType<typeof createOrbis> | null>(null);
  const [hud, setHud] = useState<Hud | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (live) onStartAudio?.();
  }, [live]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let view: ReturnType<typeof createOrbisScene>;
    const game = createOrbis(Date.now() >>> 0);
    gameRef.current = game;
    try {
      view = createOrbisScene(canvas, game);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось открыть Орбис");
      onLoadError?.(err);
      return;
    }
    (window as unknown as { __BCM_ORBIS_QA__?: unknown }).__BCM_ORBIS_QA__ = { game };
    const unbindKeys = bindKeyboard(window);
    const unbindPad = bindGamepad(window, "island");
    let frame = 0;
    let last = performance.now();
    let lastHud = 0;
    let readySent = false;
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const k = activeKeys();
      const has = (...codes: string[]) => codes.some((c) => k.has(c));
      game.step(dt, {
        thrust: has("KeyW", "ArrowUp") ? 1 : has("KeyS", "ArrowDown") ? -0.6 : 0,
        yaw: (has("KeyD", "ArrowRight") ? 1 : 0) - (has("KeyA", "ArrowLeft") ? 1 : 0),
        lift: (has("KeyR") ? 1 : 0) - (has("KeyF") ? 1 : 0),
        strafe: (has("KeyE") ? 1 : 0) - (has("KeyQ") ? 1 : 0),
        boost: has("ShiftLeft", "ShiftRight") ? 1 : 0,
        fire: has("Space"),
      });
      view.frame(now);
      if (!readySent) { readySent = true; onReady?.(); }
      if (now - lastHud > 100) {
        lastHud = now;
        const s = game.state;
        const make = FLEET.find((f) => f.id === s.fleetId);
        setHud({
          phase: s.phase,
          hp: s.hp,
          hpMax: make ? make.hp : 0,
          hold: s.hold.slice(),
          cap: make ? make.cap : 0,
          materials: { ...s.materials },
          castle: s.castle,
          towers: s.towers.filter((t) => t.hp > 0).length,
          shield: game.shieldUp(),
          fortressOpen: s.fortress.open,
          note: s.noteFor > 0 ? s.note : "",
          village: game.villageNear(),
          ship: make ? make.name : "",
        });
      }
    };
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      unbindKeys();
      unbindPad();
      view.dispose();
    };
  }, []);

  const take = (id: FleetId) => gameRef.current?.takeShip(id);
  const next = hud ? CASTLE_TIERS[hud.castle] : null;
  const panel = "rounded-2xl bg-slate-900/80 px-4 py-3 text-slate-100 shadow-lg backdrop-blur";

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-950" data-bcm-planet="orbis">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {error ? <div className={`${panel} absolute left-4 top-4`}>{error}</div> : null}
      {hud && hud.phase === "briefing" ? (
        <div className={`${panel} absolute left-1/2 top-1/2 w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2`} data-orbis-briefing>
          <div className="text-xs uppercase tracking-widest text-amber-300">Орбис · база на северном полюсе</div>
          <div className="mt-1 text-lg font-bold">{CAPTAIN.name}</div>
          {CAPTAIN.lines.map((line) => <p key={line} className="mt-2 text-sm leading-snug">{line}</p>)}
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {FLEET.map((make) => (
              <button key={make.id} type="button" data-orbis-ship={make.id}
                className="rounded-xl border border-amber-300/50 bg-slate-800 px-3 py-2 text-left hover:bg-slate-700 focus:outline focus:outline-2 focus:outline-amber-300"
                onClick={() => take(make.id)}>
                <div className="font-semibold">{make.name}</div>
                <div className="text-xs text-slate-300">{make.note}</div>
              </button>
            ))}
          </div>
          <div className="mt-3 text-xs text-slate-400">W/S — тяга · A/D — поворот · R/F — высота · Пробел — огонь · Shift — форсаж</div>
        </div>
      ) : null}
      {hud && hud.phase === "fly" ? (
        <>
          <div className={`${panel} absolute left-4 top-4 text-sm`} data-orbis-hud>
            <div className="font-semibold">{hud.ship} · корпус {hud.hp}/{hud.hpMax}</div>
            <div>Трюм {hud.hold.length}/{hud.cap}{hud.hold.length ? ": " + hud.hold.map((k) => LOOT_NAMES[k]).join(", ") : ""}</div>
            <div>Башен: {hud.towers} · крепость {hud.fortressOpen ? "пала" : hud.shield ? "под щитом" : "без щита"}</div>
          </div>
          <div className={`${panel} absolute right-4 top-4 text-sm`}>
            <div className="font-semibold">Замок: {hud.castle}/{CASTLE_TIERS.length}</div>
            <div className="text-xs text-slate-300">
              На складе: доски {hud.materials.board}, ящики {hud.materials.crate}, бочки {hud.materials.barrel}, рюкзаки {hud.materials.backpack}
            </div>
            {next ? (
              <div className="text-xs text-amber-200">
                Дальше «{next.title}»: {Object.entries(next.cost).map(([k, n]) => `${LOOT_NAMES[k as LootKind]} ${n}`).join(", ")}
              </div>
            ) : <div className="text-xs text-amber-200">Замок достроен</div>}
          </div>
          {hud.note ? <div className={`${panel} absolute bottom-20 left-1/2 -translate-x-1/2 text-sm`}>{hud.note}</div> : null}
          {hud.village ? (
            <div className={`${panel} absolute bottom-4 left-4 max-w-md text-sm`}>
              <div className="font-semibold">{hud.village.name}</div>
              <div>{hud.village.ask}</div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
