import { useEffect, useRef, useState } from "react";
import { Compass, Gauge, Pause, RotateCcw } from "lucide-react";
import { bindKeyboard, setForced, tiltEnabled, toggleTilt } from "@/game/input";
import { createIsland, type IslandWorld, type Phase } from "@/game/island/scene";
import { planetContent } from "@/game/island/content";
import { planetLook } from "@/game/island/planet";
import type { IslandHud } from "@/game/island/sim";
import { TouchPad, useTouchDevice } from "./touch-pad";

const MOOD_NAME = {
  walk: "Пешком",
  sport: "Спорт",
  fight: "Агрессия",
  stealth: "Стелс",
} as const;

function moodName(mood: IslandHud["mood"]) {
  return MOOD_NAME[mood] || "Пешком";
}

const EMPTY: IslandHud = {
  mode: "foot",
  flightMode: false,
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
  mood: "walk",
  depart: false,
  towerEnter: false,
  tape: "floor",
  tapes: [],
  inventory: [],
  selectedTape: "",
  nearTapeDeck: false,
  carpet: null,
};

export function DesertIsland({
  context,
  live = true,
  onRace,
  onTowerEnter,
  onStartAudio,
  onReady,
  onLoadError,
}: {
  context: { planetSeed?: number; sessionSeed?: number; planet?: string; players?: Array<{ species?: string; name?: string }> };
  live?: boolean;
  onRace: () => void;
  onTowerEnter: () => void;
  onStartAudio: () => void;
  onReady?: () => void;
  onLoadError?: (error: unknown) => void;
}) {
  const planetSeed = Number(context.planetSeed) >>> 0;
  const look = planetLook(context.planet);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<IslandWorld | null>(null);
  const phaseRef = useRef<Phase>("gate");
  const [phase, setPhase] = useState<Phase>("gate");
  const [hud, setHud] = useState<IslandHud>(EMPTY);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [tilt, setTilt] = useState(false);
  // Touch controls are shown by the device, not by a CSS class (owner 23.11.2026).
  const touchDevice = useTouchDevice();
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const left = useRef(false);
  const towerEntered = useRef(false);
  const liveRef = useRef(live);
  liveRef.current = live;

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
    if (!live) return;
    onStartAudioRef.current();
  }, [live]);

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
        { planetSeed, players: context.players, planet: look.id },
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
    let warmup = 0;
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      // While Tower is still being played the planet stays mounted but does not
      // render every frame. Two warmup frames upload shaders during the descent.
      if (!liveRef.current && warmup >= 2) return;
      if (!liveRef.current) warmup += 1;
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
  }, [planetSeed, look.id]);

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
            {look.kicker}
          </p>
          <h1 className="font-display mt-2 text-4xl leading-none font-medium" data-bcm-planet={look.id}>{look.title}</h1>
          {look.blurb ? <p className="mt-2 text-sm text-muted">{look.blurb}</p> : null}
          <p className="mt-3 text-sm text-muted">
            Корабль выбирается в меню экипажа до старта — в космосе на нём летишь из кабины.
            Здесь камера сзади и корпус виден целиком. E — сесть в стоящий корабль. Персонаж идёт спиной, раса как у выбранного Crew.
          </p>
          <button
            type="button"
            onClick={() => {
              onStartAudioRef.current();
              worldRef.current?.applyShip();
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
              <dd className="font-medium">{planetContent(context.planet).people}</dd>
            </div>
          </dl>
          <p className="mt-4 text-sm text-muted">
            Пешком: W A S D, пробел — прыжок, C — настроение (обычный, спорт, агрессия, стелс).
            На байке: T или кнопка «Полёт» включает режим полёта; пробел — вверх, Q — вниз. «Земля» возвращает колёса на поверхность. E — говорить и взаимодействовать, F — сесть/спешиться, V — извлечь кассету, R — на плиту.
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
                {hud.mode === "bike" ? (hud.carpet ? "Корабль" : "Байк") : moodName(hud.mood)}
              </p>
              <p className="mt-1 flex items-center gap-1 text-sm">
                <Gauge className="size-4 text-primary" aria-hidden />
                {Math.round(Math.abs(hud.speed))} м/с
                {hud.mode === "bike" ? ` · ${Math.round(hud.alt)} м` : ""}
              </p>
              <p className="mt-1 text-xs text-muted">Монеты {hud.coins}</p>
              {hud.carpet && hud.mode === "bike" ? (
                <div className="mt-2 space-y-1 text-xs" data-opus-carpet>
                  <div className="h-2 w-40 overflow-hidden rounded-full bg-bg/60">
                    <div
                      className={hud.carpet.hit ? "h-full bg-red-500" : "h-full bg-primary"}
                      style={{ width: `${Math.round((hud.carpet.energy / hud.carpet.energyMax) * 100)}%` }}
                    />
                  </div>
                  <p className="text-muted">
                    Энергия {Math.round(hud.carpet.energy)} · трюм {hud.carpet.hold}/{hud.carpet.holdCap} · накопитель {hud.carpet.store}
                  </p>
                  <p className="text-muted">Стражи на узлах: {hud.carpet.wardensUp}</p>
                </div>
              ) : null}
            </div>
            <div className="pointer-events-auto flex items-start gap-2">
              <canvas
                ref={mapRef}
                width={180}
                height={180}
                className="size-24 rounded-2xl border border-line bg-bg/40 md:size-36"
              />
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  aria-expanded={inventoryOpen}
                  onClick={() => setInventoryOpen((open) => !open)}
                  className="min-h-11 min-w-20 rounded-xl border border-line bg-surface/92 px-3 text-xs font-semibold tracking-wide text-fg"
                >
                  СУМКА · {hud.inventory.length}
                </button>
                {phase === "play" && hud.mode === "bike" && !hud.carpet ? (
                  <button
                    type="button"
                    aria-label={hud.flightMode ? "Перейти в режим земли" : "Включить режим полёта"}
                    onClick={() => {
                      const sim = worldRef.current?.sim;
                      if (sim) {
                        sim.toggleFlightMode();
                        setHud(sim.hud());
                      }
                    }}
                    className="h-11 min-w-20 rounded-xl border border-primary bg-surface/92 px-3 text-xs font-semibold tracking-wide text-primary"
                  >
                    {hud.flightMode ? "ЗЕМЛЯ" : "ПОЛЁТ"}
                  </button>
                ) : null}
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

          {inventoryOpen ? (
            <section className="pointer-events-auto absolute right-3 top-24 z-20 w-[min(88vw,19rem)] rounded-2xl border border-line bg-surface/95 p-3 shadow-xl backdrop-blur-md">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-display text-xl">Инвентарь</h2>
                <button type="button" onClick={() => setInventoryOpen(false)} className="rounded-lg border border-line px-2 py-1 text-sm">Закрыть</button>
              </div>
              {hud.inventory.length ? (
                <ul className="max-h-64 space-y-2 overflow-auto">
                  {hud.inventory.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2">
                      <span className="min-w-0 text-sm">
                        {item.kind === "tape" ? "📼 " : item.kind === "crystal" ? "◆ " : "🗝 "}
                        {item.title}{item.count > 1 ? " × " + item.count : ""}
                      </span>
                      {item.kind === "tape" ? (
                        <button
                          type="button"
                          aria-pressed={hud.selectedTape === item.id}
                          onClick={() => {
                            const sim = worldRef.current?.sim;
                            if (sim?.selectTape(item.id)) setHud(sim.hud());
                          }}
                          className={hud.selectedTape === item.id
                            ? "shrink-0 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-bg"
                            : "shrink-0 rounded-full border border-line px-3 py-1 text-xs"}
                        >
                          {hud.selectedTape === item.id ? "Выбрана" : "Выбрать"}
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Пока пусто. Найденные предметы появятся здесь.</p>
              )}
              <p className="mt-2 text-xs text-muted">Кристаллы и ключ исчезают из сумки после сдачи жителям.</p>
            </section>
          ) : null}

          <div className="flex flex-col items-center gap-2">
            {phase === "play" && hud.nearTapeDeck && hud.tapes.length > 0 ? (
              <div className="pointer-events-auto flex max-w-[min(92vw,28rem)] flex-wrap items-center justify-center gap-2 rounded-2xl border border-line bg-surface/92 px-3 py-2 shadow-lg backdrop-blur-md">
                <span className="px-1 text-xs font-semibold uppercase tracking-wider text-muted">Кассеты</span>
                {hud.tapes.map((tape) => (
                  <button
                    key={tape.id}
                    type="button"
                    aria-pressed={hud.selectedTape === tape.id}
                    onClick={() => {
                      const sim = worldRef.current?.sim;
                      if (sim?.selectTape(tape.id)) setHud(sim.hud());
                    }}
                    className={hud.selectedTape === tape.id
                      ? "rounded-full border border-primary bg-primary px-3 py-1.5 text-sm font-semibold text-bg"
                      : "rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-fg"}
                  >
                    {tape.title}
                  </button>
                ))}
              </div>
            ) : null}
            {hud.prompt.includes("экран") ? (
              <button
                type="button"
                className="pointer-events-auto rounded-full bg-primary px-4 py-1 text-sm font-medium text-bg"
                onClick={() => worldRef.current?.toggleTapeScreen()}
              >
                {hud.tape === "paused" ? "На паузе · весь экран" : "Весь экран"}
              </button>
            ) : null}
            {hud.nearTapeDeck && (hud.tape === "playing" || hud.tape === "paused") ? (
              <button
                type="button"
                className="pointer-events-auto rounded-full border border-line bg-surface/95 px-4 py-1 text-sm font-medium"
                onClick={() => {
                  const sim = worldRef.current?.sim;
                  if (sim?.ejectTape()) setHud(sim.hud());
                }}
              >
                V · Извлечь кассету
              </button>
            ) : null}
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

      {phase === "play" && !talk && touchDevice ? (
        <TouchPad
          stick={{ up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD" }}
          buttons={hud.carpet && hud.mode === "bike" ? [
            { code: "KeyX", label: "Огонь", primary: true },
            { code: "Space", label: "Выше" },
            { code: "KeyQ", label: "Ниже" },
            { code: "KeyF", label: "Выйти" },
          ] : [
            { code: "Space", label: "Прыжок", primary: true },
            { code: "KeyE", label: "Взять" },
            { code: "KeyF", label: "Сесть" },
            { code: "ShiftLeft", label: "Форсаж" },
          ]}
          extras={[
            { code: "KeyV", label: "Кассета" },
            { code: "KeyC", label: "Настроение" },
            { code: "KeyQ", label: "Вниз" },
            ...(hud.carpet && hud.mode === "bike" ? [{ code: "KeyE", label: "Купить" }, { code: "ShiftLeft", label: "Форсаж" }] : []),
          ]}
          tilt={tilt}
          onTilt={() => void toggleTilt().then((on) => setTilt(on || tiltEnabled()))}
        />
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
