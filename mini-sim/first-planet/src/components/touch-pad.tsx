/*
 * Touch controls for First Planet and Shoal Race (owner 23.11.2026: "у нас нет никакого
 * управления у телефонов ни у First Planet, ни у гонок").
 *
 * Shown by code on a touch device (not by a CSS class a WordPress theme can override): a
 * stick on the left that holds the movement keys, a few round action buttons on the right,
 * rare actions as small pills. Everything presses the same keys as the keyboard (`held`).
 */
import { useEffect, useRef, useState } from "react";
import { held } from "@/game/input";

export function isTouchDevice() {
  if (typeof window === "undefined") return false;
  const coarse = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  return "ontouchstart" in window || (navigator.maxTouchPoints || 0) > 0 || coarse;
}

export function useTouchDevice() {
  const [touch] = useState(isTouchDevice);
  return touch;
}

export type TouchButton = { code: string; label: string; primary?: boolean };
export type TouchStick = { up?: string; down?: string; left: string; right: string };

const STICK_R = 56; // px, knob travel
const STICK_ON = 0.35; // share of the travel that presses a direction

function useHeldCodes() {
  // Codes this pad pressed, released on unmount so nothing stays stuck.
  const mine = useRef(new Set<string>());
  useEffect(() => () => { mine.current.forEach((code) => held.delete(code)); mine.current.clear(); }, []);
  return {
    press(code: string) { held.add(code); mine.current.add(code); },
    release(code: string) { held.delete(code); mine.current.delete(code); },
  };
}

function Stick({ keys }: { keys: TouchStick }) {
  const { press, release } = useHeldCodes();
  const base = useRef<HTMLDivElement | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const active = useRef(new Set<string>());

  const apply = (dx: number, dy: number) => {
    const want = new Set<string>();
    if (dx < -STICK_ON) want.add(keys.left);
    if (dx > STICK_ON) want.add(keys.right);
    if (keys.up && dy < -STICK_ON) want.add(keys.up);
    if (keys.down && dy > STICK_ON) want.add(keys.down);
    active.current.forEach((code) => { if (!want.has(code)) { release(code); active.current.delete(code); } });
    want.forEach((code) => { if (!active.current.has(code)) { press(code); active.current.add(code); } });
  };

  const move = (clientX: number, clientY: number) => {
    const rect = base.current?.getBoundingClientRect();
    if (!rect) return;
    let x = clientX - (rect.left + rect.width / 2);
    let y = clientY - (rect.top + rect.height / 2);
    const len = Math.hypot(x, y);
    if (len > STICK_R) { x = (x / len) * STICK_R; y = (y / len) * STICK_R; }
    setKnob({ x, y });
    apply(x / STICK_R, y / STICK_R);
  };

  const end = () => { setKnob({ x: 0, y: 0 }); apply(0, 0); };

  return (
    <div
      ref={base}
      data-bcm-touch-stick=""
      className="pointer-events-auto relative rounded-full border border-line bg-surface/45 backdrop-blur-sm"
      style={{ width: 132, height: 132, touchAction: "none" }}
      onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); move(event.clientX, event.clientY); }}
      onPointerMove={(event) => { if (event.buttons || event.pointerType === "touch") move(event.clientX, event.clientY); }}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
    >
      <div
        className="absolute rounded-full bg-primary/85 shadow-lg"
        style={{ width: 56, height: 56, left: 38 + knob.x, top: 38 + knob.y }}
      />
    </div>
  );
}

function RoundButton({ button, size }: { button: TouchButton; size: number }) {
  const { press, release } = useHeldCodes();
  return (
    <button
      type="button"
      data-bcm-touch-button={button.code}
      className={`pointer-events-auto rounded-full border border-line text-xs font-semibold shadow-lg backdrop-blur-sm ${button.primary ? "bg-primary text-bg" : "bg-surface/70 text-fg"}`}
      style={{ width: size, height: size, touchAction: "none" }}
      onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); press(button.code); }}
      onPointerUp={() => release(button.code)}
      onPointerCancel={() => release(button.code)}
      onLostPointerCapture={() => release(button.code)}
    >
      {button.label}
    </button>
  );
}

export function TouchPad({
  stick,
  buttons,
  extras = [],
  tilt,
  onTilt,
  lift = 0,
  row = false,
}: {
  stick: TouchStick;
  /** First is the big one (bottom right), the rest sit around it. */
  buttons: TouchButton[];
  extras?: TouchButton[];
  tilt?: boolean;
  onTilt?: () => void;
  /** Raise the pad (px) above a game's own bottom panels (the race speedometer and lap time). */
  lift?: number;
  /** Side buttons in a row left of the big one (lower pad, for the race HUD). */
  row?: boolean;
}) {
  const [main, ...rest] = buttons;
  return (
    <div
      data-bcm-touch-pad=""
      className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between px-4"
      style={{ paddingBottom: "calc(max(14px, env(safe-area-inset-bottom)) + " + lift + "px)" }}
    >
      <Stick keys={stick} />
      <div className="flex flex-col items-end gap-2">
        {extras.length || onTilt ? (
          <div className="flex flex-wrap justify-end gap-1.5">
            {extras.map((b) => (
              <ExtraPill key={b.code} button={b} />
            ))}
            {onTilt ? (
              <button
                type="button"
                className="pointer-events-auto h-8 rounded-full border border-line bg-surface/70 px-3 text-xs font-medium"
                onClick={onTilt}
              >
                {tilt ? "TILT вкл" : "TILT"}
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="flex items-end gap-2">
          <div className={row ? "flex flex-row items-end gap-2" : "flex flex-col gap-2"}>
            {rest.map((b) => (
              <RoundButton key={b.code} button={b} size={54} />
            ))}
          </div>
          {main ? <RoundButton button={main} size={78} /> : null}
        </div>
      </div>
    </div>
  );
}

function ExtraPill({ button }: { button: TouchButton }) {
  const { press, release } = useHeldCodes();
  return (
    <button
      type="button"
      data-bcm-touch-button={button.code}
      className="pointer-events-auto h-8 rounded-full border border-line bg-surface/70 px-3 text-xs font-medium"
      style={{ touchAction: "none" }}
      onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); press(button.code); }}
      onPointerUp={() => release(button.code)}
      onPointerCancel={() => release(button.code)}
      onLostPointerCapture={() => release(button.code)}
    >
      {button.label}
    </button>
  );
}
