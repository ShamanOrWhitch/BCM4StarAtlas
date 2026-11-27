import { useEffect, useRef, useState } from "react";
import { Flag, Gauge, Pause, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { activeKeys, bindKeyboard, readDrive, setForced, tiltEnabled, toggleTilt } from "@/game/input";
import { bindGamepad } from "@/game/gamepad";
import { createRace, type Hud, type ItemKind, type Race } from "@/game/sim";
import { MAX_RACE_LEVEL, loadRaceLevel, raceModeFor, recordRaceWin } from "@/game/race-modes";
import { createWorld, paintMap, type Phase } from "@/game/world";
import { TouchPad, useTouchDevice } from "./touch-pad";

const ITEM_CARD: { id: ItemKind; name: string; use: string; mark: string }[] = [
  { id: "solar", name: "Солнце", use: "рывок", mark: "●" },
  { id: "slick", name: "Плёнка", use: "масло назад", mark: "▬" },
  { id: "pulse", name: "Импульс", use: "тормоз впереди", mark: "✦" },
];

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
  mode: "laps",
  title: "",
  map: "",
  rules: "",
  level: 1,
  laps: 3,
  penalty: 0,
  missed: 0,
  out: false,
  nextGate: -1,
  hazard: null,
  hull: 100,
  pitting: false,
  pitNear: false,
};

export function ShoalRace({
  onLeave,
  onStartAudio,
  seed = 0,
  planet,
}: { onLeave?: () => void; onStartAudio?: () => void; seed?: number; planet?: string } = {}) {
  const raceSeed = Number(seed) >>> 0;
  // Each planet has its own form of the race and its own level (race-modes.ts).
  const [level, setLevel] = useState(() => loadRaceLevel(planet));
  const [unlocked, setUnlocked] = useState(0);
  const look = raceModeFor(planet, level);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef<Phase>("gate");
  const viewRef = useRef(0);
  const camHeld = useRef(false);
  const raceRef = useRef<Race | null>(null);
  const [phase, setPhase] = useState<Phase>("gate");
  const [hud, setHud] = useState<Hud>(EMPTY);
  const [muted, setMuted] = useState(false);
  const [tilt, setTilt] = useState(false);
  // Touch controls are shown by the device, not by a CSS class (owner 23.11.2026).
  const touchDevice = useTouchDevice();
  const mutedRef = useRef(false);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const race = createRace(raceSeed, planet);
    raceRef.current = race;
    const world = createWorld(canvas);
    const unbindKeys = bindKeyboard(window);
    const unbindPad = bindGamepad(window, "race");
    const unbind = () => { unbindKeys(); unbindPad(); };
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
        // A first place opens the next level on this planet.
        const you = race.cars[0];
        if (you.place === 1 && !you.out && race.level < MAX_RACE_LEVEL) {
          const next = recordRaceWin(planet);
          setLevel(next);
          setUnlocked(next);
        } else setUnlocked(0);
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
  }, [raceSeed, planet]);

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
        <section data-gamepad-menu className="absolute inset-x-0 bottom-0 z-10 max-h-96 overflow-y-auto border-t border-line bg-surface/92 p-5 backdrop-blur-md md:inset-y-0 md:left-0 md:max-h-none md:w-96 md:border-t-0 md:border-r">
          <p className="text-xs font-medium tracking-widest text-primary uppercase">
            {look.kicker}
          </p>
          <h1
            className="font-display mt-2 text-4xl leading-none font-medium text-fg"
            data-race-mode={look.kind}
          >
            {look.title}
          </h1>
          <p className="mt-3 text-sm text-muted">{look.blurb}</p>
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
              <dd className="font-medium text-fg">{look.map}</dd>
            </div>
            <div className="rounded-xl border border-line bg-bg/50 p-3">
              <dt className="text-muted">Уровень</dt>
              <dd className="font-medium text-fg">
                {level} из {MAX_RACE_LEVEL}
              </dd>
            </div>
            <div className="rounded-xl border border-line bg-bg/50 p-3">
              <dt className="text-muted">Круги</dt>
              <dd className="font-medium text-fg">
                {look.laps} · {look.rules}
              </dd>
            </div>
            <div className="rounded-xl border border-line bg-bg/50 p-3">
              <dt className="text-muted">Лучший круг</dt>
              <dd className="font-medium text-fg">{best > 0 ? formatTime(best) : "ещё нет"}</dd>
            </div>
          </dl>
          <p className="mt-4 text-sm text-muted">
            Экипаж Kestrel, Brine и Halo. Победа открывает следующий уровень: соперники быстрее
            {look.kind === "slalom" ? ", ворота уже" : ""}. A влево, D вправо, Shift дрифт, Z ручник
            {look.items ? ", Ctrl предмет" : ""}. Если упёрся и держишь газ, машина возвращается на дорогу. На дороге ловушки и мобы — их объезжай.
          </p>
        </section>
      ) : null}

      {phase !== "gate" ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-3 pb-40 md:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="pointer-events-auto rounded-2xl border border-line bg-surface/88 px-3 py-2 backdrop-blur-md">
              <p className="text-xs tracking-widest text-muted uppercase">
                {hud.map || look.map} · ур. {hud.level}
              </p>
              <p className="font-display text-2xl leading-none">
                Круг {hud.lap}/{hud.laps}
              </p>
              {hud.mode === "slalom" ? (
                <p className="mt-1 text-sm text-fg" data-race-penalty>
                  Штраф +{hud.penalty} с · мимо ворот {hud.missed}
                </p>
              ) : null}
              {hud.mode === "elimination" ? (
                <p className="mt-1 text-sm text-fg">
                  Выбыли {hud.rows.filter((row) => row.out).length} · последний сходит
                </p>
              ) : null}
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
            {hud.hazard === "trap" ? (
              <p className="rounded-full bg-accent px-4 py-1 text-sm font-medium text-fg">Ловушка</p>
            ) : null}
            {hud.hazard === "mob" ? (
              <p className="rounded-full bg-accent px-4 py-1 text-sm font-medium text-fg">Моб</p>
            ) : null}
            {hud.pitNear ? (
              <p className="rounded-full bg-primary px-4 py-1 text-sm font-medium text-bg">Пит справа · сбрось скорость</p>
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
              <p className="mt-2 text-xs text-muted">Корпус {Math.round(hud.hull)}</p>
              <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-bg">
                <div
                  className="h-full bg-accent"
                  style={{ width: `${Math.round(hud.hull)}%` }}
                />
              </div>
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
              <div className="mt-2 grid gap-1 text-left">
                {ITEM_CARD.map((card) => {
                  const held = look.items && hud.item === card.id;
                  return (
                    <p
                      key={card.id}
                      className={
                        "rounded-lg border px-2 py-1 text-xs " +
                        (held
                          ? "border-primary bg-primary/15 font-medium text-primary"
                          : "border-line text-muted")
                      }
                    >
                      <span className="mr-1">{card.mark}</span>
                      {card.name}
                      <span className="mt-0.5 block">{held ? "у тебя · " : ""}{card.use}</span>
                    </p>
                  );
                })}
              </div>
              <p className="mt-1 text-xs text-muted">
                {look.items ? "Ctrl или X — использовать" : "На этой трассе ящиков нет"}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {phase === "race" && touchDevice ? (
        <TouchPad
          stick={{ left: "KeyA", right: "KeyD" }}
          buttons={[
            { code: "KeyW", label: "Газ", primary: true },
            { code: "KeyS", label: "Тормоз" },
            { code: "ShiftLeft", label: "Дрифт" },
            { code: "ControlLeft", label: "Предмет" },
          ]}
          tilt={tilt}
          onTilt={() => void toggleTilt().then((on) => setTilt(on || tiltEnabled()))}
          lift={96}
          row
        />
      ) : null}

      {phase === "race" && hud.pitting ? (
        <RepairPit
          hull={hud.hull}
          onWeld={(good) => {
            const race = raceRef.current;
            if (!race || !good) return;
            race.patch();
            setHud(race.hud());
          }}
          onLeave={() => {
            const race = raceRef.current;
            if (!race) return;
            race.leavePit();
            setHud(race.hud());
          }}
        />
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
        <section data-gamepad-menu className="absolute inset-0 z-20 grid place-items-center bg-bg/55 p-4">
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-5 text-fg">
            <p className="text-xs tracking-widest text-primary uppercase">Финиш</p>
            <h2 className="font-display mt-1 text-4xl leading-none">
              {hud.out ? "Выбыл" : `${hud.place} место`}
            </h2>
            <p className="mt-2 text-sm text-muted">
              Время {formatTime(hud.time)} · лучший круг{" "}
              {hud.bestLap > 0 ? formatTime(hud.bestLap) : "—"}
              {hud.mode === "slalom" ? ` · штраф +${hud.penalty} с` : ""}
            </p>
            {unlocked ? (
              <p className="mt-2 text-sm font-medium text-primary">Открыт уровень {unlocked}</p>
            ) : null}
            <ol className="mt-4 space-y-2">
              {hud.rows.map((row) => (
                <li
                  key={row.name}
                  className="flex items-center justify-between rounded-xl border border-line bg-bg/40 px-3 py-2 text-sm"
                >
                  <span className={row.you ? "font-medium text-primary" : "text-fg"}>
                    {row.place}. {row.name}
                  </span>
                  <span className="text-muted">
                    {row.out ? "выбыл" : row.done ? formatTime(row.time) : "на круге"}
                  </span>
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

function RepairPit({
  hull,
  onWeld,
  onLeave,
}: {
  hull: number;
  onWeld: (good: boolean) => void;
  onLeave: () => void;
}) {
  const [needle, setNeedle] = useState(0);
  const [miss, setMiss] = useState(false);
  const needleRef = useRef(0);
  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      needleRef.current = (needleRef.current + dt * 0.62) % 1;
      setNeedle(needleRef.current);
    };
    frame = requestAnimationFrame(loop);
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.code === "KeyF" || event.code === "Space") {
        event.preventDefault();
        weld();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey);
    };
  }, []);
  function weld() {
    const good = needleRef.current > 0.4 && needleRef.current < 0.6;
    setMiss(!good);
    onWeld(good);
  }
  const left = Math.max(0, Math.ceil((100 - hull) / 34));
  return (
    <section data-gamepad-menu className="absolute inset-0 z-30 grid place-items-center bg-bg/50 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-primary bg-surface p-5 text-fg">
        <p className="text-xs tracking-widest text-primary uppercase">Пит</p>
        <h2 className="font-display mt-1 text-4xl leading-none">Почини сам</h2>
        <p className="mt-2 text-sm text-muted">Жми, когда метка в зелёной полосе. Три точных шва собирают корпус.</p>
        <div className="relative mt-4 h-10 overflow-hidden rounded-xl border border-line bg-bg">
          <div className="absolute inset-y-0 left-[40%] w-[20%] bg-primary/40" />
          <div className="absolute inset-y-0 w-1 bg-fg" style={{ left: `${needle * 100}%` }} />
        </div>
        <p className="mt-2 text-sm">{miss ? "Мимо шва" : `Корпус ${Math.round(hull)} · швов ещё ${left}`}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={weld} className="h-12 rounded-xl bg-primary font-medium text-bg">
            Варить
          </button>
          <button type="button" onClick={onLeave} className="h-12 rounded-xl border border-line">
            Выехать
          </button>
        </div>
      </div>
    </section>
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
    <section data-gamepad-menu className="absolute inset-0 z-20 grid place-items-center bg-bg/55 p-4">
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
