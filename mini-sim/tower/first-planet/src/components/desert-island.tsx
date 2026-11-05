import { useEffect, useRef, useState } from "react";
import { Compass, Gauge, Pause, RotateCcw } from "lucide-react";
import { bindKeyboard, held, setForced } from "@/game/input";
import { createIsland, type IslandWorld, type Phase } from "@/game/island/scene";
import type { IslandHud } from "@/game/island/sim";

const EMPTY: IslandHud = {
  mode: "foot",
  speed: 0,
  alt: 0,
  region: "Посадочная",
  prompt: "",
  dialogue: null,
  quests: [],
  coins: 0,
  crystals: 0,
  fires: 0,
  x: 0,
  z: 0,
  yaw: 0,
  depart: false,
  towerEnter: false,
};

export function DesertIsland({
  context,
  onRace,
  onTowerEnter,
  onStartAudio,
  onReady,
  onLoadError,
}: {
  context: { planetSeed?: number; sessionSeed?: number };
  onRace: () => void;
  onTowerEnter: () => void;
  onStartAudio: () => void;
  onReady?: () => void;
  onLoadError?: (error: unknown) => void;
}) {
  const planetSeed = Number(context.planetSeed) >>> 0;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<IslandWorld | null>(null);
  const phaseRef = useRef<Phase>("gate");
  const [phase, setPhase] = useState<Phase>("gate");
  const [hud, setHud] = useState<IslandHud>(EMPTY);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const left = useRef(false);
  const towerEntered = useRef(false);

  const onRaceRef = useRef(onRace);
  onRaceRef.current = onRace;
  const onTowerEnterRef = useRef(onTowerEnter);
  onTowerEnterRef.current = onTowerEnter;
  const onStartAudioRef = useRef(onStartAudio);
  onStartAudioRef.current = onStartAudio;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const onLoadErrorRef = useRef(onLoadError);
  onLoadErrorRef.current = onLoadError;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let world: IslandWorld;
    try {
      world = createIsland(
        canvas,
        () => {
          setReady(true);
          onReadyRef.current?.();
        },
        (loadError) => onLoadErrorRef.current?.(loadError),
        { planetSeed },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось открыть остров");
      onLoadErrorRef.current?.(err);
      return;
    }
    worldRef.current = world;
    const probe = {
      getYaw: () => world.sim.yaw,
      getSpeed: () => world.sim.speed,
      setKeys: (codes: string[]) => setForced(codes),
      setSteer: (v: number) => {
        setForced(v > 0 ? ["KeyW", "KeyA"] : v < 0 ? ["KeyW", "KeyD"] : ["KeyW"]);
      },
    };
    window.__controlsTest = probe;
    if (import.meta.env.DEV) {
      window.__island = world.sim;
    }

    let frame = 0;
    let lastHud = 0;
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      world.frame(now, phaseRef.current);
      if (now - lastHud > 90) {
        lastHud = now;
        const next = world.sim.hud();
        setHud(next);
        const map = mapRef.current;
        if (map && phaseRef.current !== "gate") world.paintMap(map);
        if (next.towerEnter && !towerEntered.current) {
          towerEntered.current = true;
          onTowerEnterRef.current();
        }
        if (next.depart && !left.current) {
          left.current = true;
          onRaceRef.current();
        }
      }
    };
    frame = requestAnimationFrame(loop);
    const unbind = bindKeyboard(window);
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Escape" || event.repeat) return;
      if (phaseRef.current === "play") {
        phaseRef.current = "pause";
        setPhase("pause");
      } else if (phaseRef.current === "pause") {
        phaseRef.current = "play";
        setPhase("play");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      unbind();
      window.removeEventListener("keydown", onKey);
      if (window.__controlsTest === probe) delete window.__controlsTest;
      if (window.__island === world.sim) delete window.__island;
      world.dispose();
      worldRef.current = null;
    };
  }, [planetSeed]);

  function setPhaseBoth(next: Phase) {
    phaseRef.current = next;
    setPhase(next);
  }

  function advanceTalk() {
    const world = worldRef.current;
    if (!world) return;
    world.sim.advance();
    setHud(world.sim.hud());
  }

  const talk = hud.dialogue;
  const lastPage = talk ? talk.i >= talk.pages.length - 1 : false;

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-bg text-fg">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {error ? (
        <p className="absolute inset-x-4 top-6 z-20 rounded-xl bg-surface p-4 text-sm">{error}</p>
      ) : null}

      {phase === "gate" ? (
        <section className="absolute inset-x-0 bottom-0 z-10 max-h-[70dvh] overflow-y-auto border-t border-line bg-surface/92 p-5 backdrop-blur-md md:inset-y-0 md:left-0 md:max-h-none md:w-96 md:border-t-0 md:border-r">
          <p className="text-xs font-medium tracking-widest text-primary uppercase">
            Desert Island · посадочная
          </p>
          <h1 className="font-display mt-2 text-4xl leading-none font-medium">Остров пустыни</h1>
          <p className="mt-3 text-sm text-muted">
            Дюнный посад. У входа стоит байк — на нём можно подняться над крышами. Внизу дома,
            оазис и трое жителей с поручениями. Северное кольцо ведёт на береговую гонку. На
            рядом с посадочной площадкой светится портал в Tower: подойди к нему и нажми E,
            чтобы пройти ту же сохранённую башню снизу вверх.
          </p>
          <button
            type="button"
            onClick={() => {
              onStartAudioRef.current();
              setPhaseBoth("play");
            }}
            className="mt-4 h-12 w-full rounded-xl bg-primary font-medium text-bg"
          >
            Start
          </button>
          <button
            type="button"
            onClick={() => {
              onRaceRef.current();
            }}
            className="mt-2 h-12 w-full rounded-xl border border-line text-fg"
          >
            Сразу к гонке
          </button>
          <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl border border-line bg-bg/50 p-3">
              <dt className="text-muted">Вход</dt>
              <dd className="font-medium">Байк на плите</dd>
            </div>
            <div className="rounded-xl border border-line bg-bg/50 p-3">
              <dt className="text-muted">Жители</dt>
              <dd className="font-medium">Сера, Орр, Ламп</dd>
            </div>
          </dl>
          <p className="mt-4 text-sm text-muted">
            Пешком и на байке: W вперёд, S назад, A влево, D вправо, E говорить и садиться. На байке
            пробел вверх, C вниз, Shift форсаж. R возвращает на плиту. Висячий остров ждёт трассу —
            пресеты встанут туда следующим заходом.
          </p>
          <p className="mt-2 text-xs text-muted">{ready ? "Меши на острове." : "Байк и жители ещё садятся…"}</p>
        </section>
      ) : null}

      {phase !== "gate" ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-3 pb-36 md:p-5 md:pb-5">
          <div className="flex items-start justify-between gap-3">
            <div className="pointer-events-auto max-w-56 rounded-2xl border border-line bg-surface/88 px-3 py-2 backdrop-blur-md">
              <p className="flex items-center gap-1 text-xs tracking-widest text-muted uppercase">
                <Compass className="size-3.5 text-primary" aria-hidden />
                {hud.region}
              </p>
              <p className="font-display text-2xl leading-none">
                {hud.mode === "bike" ? "Байк" : "Пешком"}
              </p>
              <p className="mt-1 flex items-center gap-1 text-sm">
                <Gauge className="size-4 text-primary" aria-hidden />
                {Math.round(Math.abs(hud.speed))} м/с
                {hud.mode === "bike" ? ` · ${Math.round(hud.alt)} м` : ""}
              </p>
              <p className="mt-1 text-xs text-muted">Монеты {hud.coins}</p>
            </div>
            <div className="pointer-events-auto flex items-start gap-2">
              <canvas
                ref={mapRef}
                width={180}
                height={180}
                className="size-24 rounded-2xl border border-line bg-bg/40 md:size-36"
              />
              <div className="flex flex-col gap-2">
                {phase === "play" ? (
                  <button
                    type="button"
                    aria-label="Пауза"
                    onClick={() => setPhaseBoth("pause")}
                    className="grid size-11 place-items-center rounded-xl border border-line bg-surface/88"
                  >
                    <Pause className="size-5" />
                  </button>
                ) : null}
                <button
                  type="button"
                  aria-label="На посадочную"
                  onClick={() => worldRef.current?.sim.respawn()}
                  className="grid size-11 place-items-center rounded-xl border border-line bg-surface/88"
                >
                  <RotateCcw className="size-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2">
            {hud.prompt && phase === "play" && !talk ? (
              <p className="rounded-full bg-surface/90 px-4 py-1 text-sm font-medium text-primary">
                {hud.prompt}
              </p>
            ) : null}
          </div>

          <ul className="pointer-events-none max-w-xs space-y-1 self-start">
            {hud.quests.map((quest) => (
              <li
                key={quest.id}
                className="rounded-xl border border-line bg-surface/88 px-3 py-1.5 text-sm backdrop-blur-md"
              >
                <span className="font-medium text-fg">{quest.title}</span>
                <span className="text-muted"> · {quest.status}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {talk && phase === "play" ? (
        <section className="absolute inset-x-3 bottom-3 z-30 rounded-2xl border border-line bg-surface/95 p-4 md:inset-x-auto md:bottom-6 md:left-1/2 md:w-[28rem] md:-translate-x-1/2">
          <p className="text-xs tracking-widest text-primary uppercase">{talk.who}</p>
          <p className="mt-2 text-sm text-fg">{talk.pages[talk.i]}</p>
          <button
            type="button"
            onClick={advanceTalk}
            className="mt-3 h-12 w-full rounded-xl bg-primary font-medium text-bg"
          >
            {lastPage ? "Закрыть" : "Дальше"}
          </button>
        </section>
      ) : null}

      {phase === "play" && !talk ? (
        <div className="absolute inset-x-0 bottom-3 z-20 grid grid-cols-4 gap-2 px-3 md:hidden">
          <Hold code="KeyA" label="Лево" />
          <Hold code="KeyW" label="Вперёд" className="bg-primary text-bg" />
          <Hold code="KeyS" label="Назад" />
          <Hold code="KeyD" label="Право" />
          <Hold code="KeyE" label="E" />
          <Hold code="Space" label="Вверх" />
          <Hold code="KeyC" label="Вниз" />
          <Hold code="ShiftLeft" label="Форсаж" />
        </div>
      ) : null}

      {phase === "pause" ? (
        <section className="absolute inset-0 z-30 grid place-items-center bg-bg/55 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-5">
            <h2 className="font-display text-4xl leading-none">Пауза</h2>
            <p className="mt-2 text-sm text-muted">
              Посадка на юге, архив на западе, кольцо гонки на севере. R или кнопка компаса
              возвращает на плиту.
            </p>
            <button
              type="button"
              onClick={() => setPhaseBoth("play")}
              className="mt-4 h-12 w-full rounded-xl bg-primary font-medium text-bg"
            >
              Дальше
            </button>
            <button
              type="button"
              onClick={() => setPhaseBoth("gate")}
              className="mt-2 h-12 w-full rounded-xl border border-line"
            >
              К посадке
            </button>
          </div>
        </section>
      ) : null}
    </main>
  );
}

function Hold({ code, label, className = "" }: { code: string; label: string; className?: string }) {
  return (
    <button
      type="button"
      className={`h-12 rounded-xl border border-line bg-surface/90 text-sm font-medium text-fg ${className}`}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        held.add(code);
      }}
      onPointerUp={() => held.delete(code)}
      onPointerCancel={() => held.delete(code)}
      onLostPointerCapture={() => held.delete(code)}
    >
      {label}
    </button>
  );
}
