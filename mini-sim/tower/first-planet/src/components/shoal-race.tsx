import { useEffect, useRef, useState } from "react";
import { Flag, Gauge, Pause, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { activeKeys, bindKeyboard, held, readDrive, setForced } from "@/game/input";
import { LAPS, createRace, type Hud, type ItemKind, type Race } from "@/game/sim";
import { createWorld, paintMap, type Phase } from "@/game/world";

const ITEM_LABEL: Record<ItemKind, string> = {
  solar: "Солнце",
  slick: "Плёнка",
  pulse: "Импульс",
};

function formatTime(t: number) {
  if (!(t > 0)) return "0:00.0";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const tenth = Math.floor((t % 1) * 10);
  return `${m}:${s.toString().padStart(2, "0")}.${tenth}`;
}

const EMPTY: Hud = {
  lap: 1,
  time: 0,
  lapTime: 0,
  bestLap: 0,
  storedBest: 0,
  speed: 0,
  place: 1,
  total: 4,
  item: null,
  drift: 0,
  boosting: false,
  wrong: false,
  rows: [],
  go: 0,
};

export function ShoalRace({ onLeave, onStartAudio, seed = 0 }: { onLeave?: () => void; onStartAudio?: () => void; seed?: number } = {}) {
  const raceSeed = Number(seed) >>> 0;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef<Phase>("gate");
  const viewRef = useRef(0);
  const camHeld = useRef(false);
  const raceRef = useRef<Race | null>(null);
  const [phase, setPhase] = useState<Phase>("gate");
  const [hud, setHud] = useState<Hud>(EMPTY);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const race = createRace(raceSeed);
    raceRef.current = race;
    const world = createWorld(canvas, raceSeed);
    const unbind = bindKeyboard(window);
    let audio: { ctx: AudioContext; osc: OscillatorNode; gain: GainNode } | null = null;

    const probe = {
      getYaw: () => race.cars[0].yaw,
      getSpeed: () => race.cars[0].speed,
      setKeys: (codes: string[]) => setForced(codes),
      setSteer: (v: number) => {
        setForced(v > 0 ? ["KeyW", "KeyA"] : v < 0 ? ["KeyW", "KeyD"] : ["KeyW"]);
      },
    };
    window.__controlsTest = probe;

    let frame = 0;
    let last = performance.now();
    let acc = 0;
    let hudAt = 0;
    let rHeld = false;
    let elapsed = 0;
    const step = 1 / 60;

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      elapsed += dt;
      acc += dt;
      if (acc > 0.2) acc = 0.2;
      const live = phaseRef.current === "race";
      while (acc >= step) {
        race.step(step, readDrive(), live);
        acc -= step;
      }
      const keys = activeKeys();
      if (keys.has("KeyV")) {
        if (!camHeld.current) {
          viewRef.current = (viewRef.current + 1) % 3;
          camHeld.current = true;
        }
      } else camHeld.current = false;

      if (live && keys.has("KeyR")) {
        if (!rHeld) race.respawnYou();
        rHeld = true;
      } else rHeld = false;

      world.update(race, phaseRef.current, viewRef.current, dt, elapsed);
      const map = mapRef.current;
      if (map && phaseRef.current !== "gate") paintMap(map, race);

      if (audio && live && !mutedRef.current) {
        audio.osc.frequency.value = 48 + race.cars[0].speed * 1.5;
        audio.gain.gain.value = 0.012;
      } else if (audio) {
        audio.gain.gain.value = 0;
      }

      if (live && race.cars[0].finished) {
        phaseRef.current = "finish";
        setPhase("finish");
        setHud(race.hud());
      } else if (now - hudAt > 100) {
        hudAt = now;
        setHud(race.hud());
      }
    };
    frame = requestAnimationFrame(loop);

    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Escape" || event.repeat) return;
      if (phaseRef.current === "race") {
        phaseRef.current = "pause";
        setPhase("pause");
      } else if (phaseRef.current === "pause") {
        phaseRef.current = "race";
        setPhase("race");
      }
    };
    window.addEventListener("keydown", onKey);

    const unlock = () => {
      if (audio) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      audio = { ctx, osc, gain };
      void ctx.resume();
    };
    window.addEventListener("pointerdown", unlock);

    return () => {
      cancelAnimationFrame(frame);
      unbind();
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", unlock);
      if (window.__controlsTest === probe) delete window.__controlsTest;
      audio?.osc.stop();
      void audio?.ctx.close();
      world.dispose();
    };
  }, [raceSeed]);

  function setPhaseBoth(next: Phase) {
    phaseRef.current = next;
    setPhase(next);
  }

  function start() {
    onStartAudio?.();
    const race = raceRef.current;
    if (!race) return;
    race.reset();
    viewRef.current = 0;
    setHud(race.hud());
    setPhaseBoth("race");
  }

  function resume() {
    setPhaseBoth("race");
  }

  const best = hud.bestLap > 0 ? hud.bestLap : hud.storedBest;

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-bg text-fg">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {phase === "gate" ? (
        <section className="absolute inset-x-0 bottom-0 z-10 max-h-96 overflow-y-auto border-t border-line bg-surface/92 p-5 backdrop-blur-md md:inset-y-0 md:left-0 md:max-h-none md:w-96 md:border-t-0 md:border-r">
          <p className="text-xs font-medium tracking-widest text-primary uppercase">
            Galia · Tower exit
          </p>
          <h1 className="font-display mt-2 text-4xl leading-none font-medium text-fg">
            Спуск с Башни
          </h1>
          <p className="mt-3 text-sm text-muted">
            Башня отпустила на воду. Внизу берег цитадели под двумя солнцами — заезд того же
            типа, что у Little Big Racing Adventure.
          </p>
          <button
            type="button"
            onClick={start}
            className="mt-4 h-12 w-full rounded-xl bg-primary font-medium text-bg"
          >
            Start
          </button>
          {onLeave ? (
            <button
              type="button"
              onClick={onLeave}
              className="mt-2 h-12 w-full rounded-xl border border-line text-fg"
            >
              На остров
            </button>
          ) : null}
          <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl border border-line bg-bg/50 p-3">
              <dt className="text-muted">Карта</dt>
              <dd className="font-medium text-fg">Берег Цитадели</dd>
            </div>
            <div className="rounded-xl border border-line bg-bg/50 p-3">
              <dt className="text-muted">Откуда контур</dt>
              <dd className="font-medium text-fg">Citadel 2, LBRA</dd>
            </div>
            <div className="rounded-xl border border-line bg-bg/50 p-3">
              <dt className="text-muted">Круги</dt>
              <dd className="font-medium text-fg">{LAPS} · предметы и дрифт</dd>
            </div>
            <div className="rounded-xl border border-line bg-bg/50 p-3">
              <dt className="text-muted">Лучший круг</dt>
              <dd className="font-medium text-fg">{best > 0 ? formatTime(best) : "ещё нет"}</dd>
            </div>
          </dl>
          <p className="mt-4 text-sm text-muted">
            У друга в релизе 2026.10.28.2132 острова собираются из дисков LBA, в git их нет, а сеть —
            лобби на UDP. Сюда перенесён тип гонки: городской круг острова-цитадели, своя геометрия,
            экипаж Kestrel, Brine и Halo. A влево, D вправо, Shift дрифт, Ctrl предмет.
          </p>
        </section>
      ) : null}

      {phase !== "gate" ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-3 pb-40 md:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="pointer-events-auto rounded-2xl border border-line bg-surface/88 px-3 py-2 backdrop-blur-md">
              <p className="text-xs tracking-widest text-muted uppercase">Берег Цитадели</p>
              <p className="font-display text-2xl leading-none">
                Круг {hud.lap}/{LAPS}
              </p>
              <p className="mt-1 flex items-center gap-1 text-sm text-fg">
                <Flag className="size-4 text-primary" aria-hidden />
                {hud.place} / {hud.total}
              </p>
            </div>
            <div className="pointer-events-auto flex items-start gap-2">
              <canvas
                ref={mapRef}
                width={180}
                height={180}
                className="size-28 rounded-2xl border border-line bg-bg/40 md:size-40"
              />
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  aria-label={muted ? "Включить звук" : "Выключить звук"}
                  onClick={() => setMuted((v) => !v)}
                  className="grid size-11 place-items-center rounded-xl border border-line bg-surface/88 text-fg"
                >
                  {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
                </button>
                {phase === "race" ? (
                  <button
                    type="button"
                    aria-label="Пауза"
                    onClick={() => setPhaseBoth("pause")}
                    className="grid size-11 place-items-center rounded-xl border border-line bg-surface/88 text-fg"
                  >
                    <Pause className="size-5" />
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2">
            {hud.wrong ? (
              <p className="rounded-full bg-accent px-4 py-1 text-sm font-medium text-fg">
                Не туда
              </p>
            ) : null}
            {hud.go > 0 && phase === "race" ? (
              <p className="font-display text-5xl text-primary">Go</p>
            ) : null}
          </div>

          <div className="flex items-end justify-between gap-3">
            <div className="pointer-events-auto rounded-2xl border border-line bg-surface/88 px-3 py-2 backdrop-blur-md">
              <p className="flex items-center gap-1 text-xs text-muted">
                <Gauge className="size-3.5" aria-hidden />
                Скорость
              </p>
              <p className="font-display text-3xl leading-none">{Math.round(hud.speed * 3.2)}</p>
              <div className="mt-2 h-1.5 w-28 overflow-hidden rounded-full bg-bg">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${Math.round(hud.drift * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted">{hud.boosting ? "Турбо" : "Дрифт"}</p>
            </div>
            <div className="pointer-events-auto rounded-2xl border border-line bg-surface/88 px-3 py-2 text-right backdrop-blur-md">
              <p className="text-xs text-muted">Время круга</p>
              <p className="font-display text-2xl leading-none">{formatTime(hud.lapTime)}</p>
              <p className="mt-1 text-xs text-muted">
                Лучший {best > 0 ? formatTime(best) : "—"}
              </p>
              <p className="mt-1 text-sm font-medium text-primary">
                {hud.item ? ITEM_LABEL[hud.item] : "Пусто"}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {phase === "race" ? (
        <div className="absolute inset-x-0 bottom-24 z-20 hidden grid-cols-6 gap-2 px-3 max-md:grid [@media(pointer:coarse)]:grid">
          <Hold code="KeyA" label="Лево" />
          <Hold code="KeyD" label="Право" />
          <Hold code="KeyW" label="Газ" className="col-span-2 bg-primary text-bg" />
          <Hold code="KeyS" label="Тормоз" />
          <Hold code="ShiftLeft" label="Дрифт" />
          <Hold code="ControlLeft" label="Предмет" className="col-span-5" />
        </div>
      ) : null}

      {phase === "pause" ? (
        <Overlay
          title="Пауза"
          text="Экипаж ждёт на берегу. Esc или кнопка возвращает в заезд."
          primary="Дальше"
          onPrimary={resume}
          secondary={onLeave ? "На остров" : "К башне"}
          onSecondary={() => (onLeave ? onLeave() : setPhaseBoth("gate"))}
        />
      ) : null}

      {phase === "finish" ? (
        <section className="absolute inset-0 z-20 grid place-items-center bg-bg/55 p-4">
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-5 text-fg">
            <p className="text-xs tracking-widest text-primary uppercase">Финиш</p>
            <h2 className="font-display mt-1 text-4xl leading-none">
              {hud.place} место
            </h2>
            <p className="mt-2 text-sm text-muted">
              Время {formatTime(hud.time)} · лучший круг{" "}
              {hud.bestLap > 0 ? formatTime(hud.bestLap) : "—"}
            </p>
            <ol className="mt-4 space-y-2">
              {hud.rows.map((row) => (
                <li
                  key={row.name}
                  className="flex items-center justify-between rounded-xl border border-line bg-bg/40 px-3 py-2 text-sm"
                >
                  <span className={row.you ? "font-medium text-primary" : "text-fg"}>
                    {row.place}. {row.name}
                  </span>
                  <span className="text-muted">{row.done ? formatTime(row.time) : "на круге"}</span>
                </li>
              ))}
            </ol>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={start}
                className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary font-medium text-bg"
              >
                <RotateCcw className="size-4" />
                Ещё круг
              </button>
              <button
                type="button"
                onClick={() => (onLeave ? onLeave() : setPhaseBoth("gate"))}
                className="h-12 rounded-xl border border-line text-fg"
              >
                {onLeave ? "На остров" : "К башне"}
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}

function Overlay({
  title,
  text,
  primary,
  onPrimary,
  secondary,
  onSecondary,
}: {
  title: string;
  text: string;
  primary: string;
  onPrimary: () => void;
  secondary: string;
  onSecondary: () => void;
}) {
  return (
    <section className="absolute inset-0 z-20 grid place-items-center bg-bg/55 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-display text-4xl leading-none">{title}</h2>
        <p className="mt-2 text-sm text-muted">{text}</p>
        <button
          type="button"
          onClick={onPrimary}
          className="mt-4 h-12 w-full rounded-xl bg-primary font-medium text-bg"
        >
          {primary}
        </button>
        <button
          type="button"
          onClick={onSecondary}
          className="mt-2 h-12 w-full rounded-xl border border-line text-fg"
        >
          {secondary}
        </button>
      </div>
    </section>
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
    >
      {label}
    </button>
  );
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      setKeys?: (codes: string[]) => void;
      setSteer?: (v: number) => void;
    };
    __island?: {
      x: number;
      y: number;
      z: number;
      yaw: number;
      mode: "foot" | "bike";
      prompt: string;
    };
  }
}
