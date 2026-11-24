/**
 * Gamepad reader for First Planet and Shoal Race (owner 24.11.2026: "в этом меню я gamepad ничего не
 * могу выбрать, и управление на планете gamepad отсутствует… гонка на джойстике не работает";
 * "управление должно быть прописано не для каждой планеты отдельно, а для разных игр в crew-core и
 * подгружено нужное по форме уровня").
 *
 * The mapping lives in crew-core.js (window.BCMCrewCore.padKeysFor(form, pad)), one scheme per kind of
 * game: "island" for walking and riding on any planet, "race" for Shoal Race. This file only reads the
 * pad each frame, hands the keys to input.ts (padKeysHeld) and drives menus marked [data-gamepad-menu]:
 * d-pad/stick move a visible focus, A presses, B or Start act as Escape. Start in play is Escape (pause).
 */
import { padKeysHeld } from "./input";

export const padHeld = padKeysHeld;

export type GameForm = "island" | "race";
type PadLike = { axes: readonly number[]; buttons: readonly { pressed: boolean; value: number }[] };
type Rect = { x: number; y: number; w: number; h: number };
export type Dir = "up" | "down" | "left" | "right";

type CrewCoreControls = {
  padKeysFor: (form: string, pad: PadLike) => Set<string>;
  padButtonDown: (pad: PadLike, i: number) => boolean;
  nextMenuFocus: (rects: Rect[], from: number, dir: Dir) => number;
};

function core(): CrewCoreControls | null {
  const c = (globalThis as unknown as { BCMCrewCore?: Partial<CrewCoreControls> }).BCMCrewCore;
  return c && typeof c.padKeysFor === "function" && typeof c.nextMenuFocus === "function" && typeof c.padButtonDown === "function"
    ? (c as CrewCoreControls) : null;
}

/** The keys this pad state presses in a game form (crew-core's scheme). Empty without crew-core. */
export function padKeys(pad: PadLike, form: GameForm = "island") {
  const c = core();
  return c ? c.padKeysFor(form, pad) : new Set<string>();
}

/** Menu focus step (crew-core's rule). */
export function nextFocus(rects: Rect[], from: number, dir: Dir) {
  const c = core();
  return c ? c.nextMenuFocus(rects, from, dir) : from;
}

function visibleMenu(): HTMLElement | null {
  const menus = Array.from(document.querySelectorAll<HTMLElement>("[data-gamepad-menu]"));
  for (let i = menus.length - 1; i >= 0; i -= 1) {
    const m = menus[i];
    if (m.offsetParent !== null || m.getClientRects().length) return m;
  }
  return null;
}

function menuButtons(menu: HTMLElement) {
  return Array.from(menu.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]"))
    .filter((b) => b.offsetParent !== null || b.getClientRects().length);
}

function pressKey(code: string) {
  window.dispatchEvent(new KeyboardEvent("keydown", { code, key: code }));
  window.dispatchEvent(new KeyboardEvent("keyup", { code, key: code }));
}

let styled = false;
function ensureStyle() {
  if (styled) return;
  styled = true;
  const style = document.createElement("style");
  style.textContent = "[data-gamepad-menu] [data-gp-focus]{outline:3px solid #ffd23a!important;outline-offset:3px;box-shadow:0 0 0 6px rgba(255,210,58,.25)!important}";
  document.head.appendChild(style);
}

/** Start reading the first connected pad every frame for this game form. Returns the unbind. */
export function bindGamepad(win: Window, form: GameForm = "island") {
  if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return () => {};
  let frame = 0;
  let prev = new Set<string>();
  let prevStart = false;
  let navHold = 0;
  let focused: HTMLElement | null = null;
  const loop = (now: number) => {
    frame = win.requestAnimationFrame(loop);
    const c = core();
    const pads = Array.from(navigator.getGamepads()).filter(Boolean);
    const p = pads[0] as PadLike | undefined;
    if (!p || !c) {
      padHeld.clear();
      return;
    }
    const keys = c.padKeysFor(form, p);
    const start = c.padButtonDown(p, 9);
    const startEdge = start && !prevStart;
    const pressedA = c.padButtonDown(p, 0) && !prev.has("pad:A");
    const pressedB = c.padButtonDown(p, 1) && !prev.has("pad:B");
    const menu = visibleMenu();
    if (menu) {
      ensureStyle();
      padHeld.clear();
      const buttons = menuButtons(menu);
      if (focused && !buttons.includes(focused)) focused = null;
      if (!focused && buttons.length) focused = buttons[0];
      const dir: Dir | null = keys.has("KeyW") ? "up" : keys.has("KeyS") ? "down" : keys.has("KeyA") ? "left" : keys.has("KeyD") ? "right" : null;
      if (dir && focused && now > navHold) {
        const rects = buttons.map((b) => {
          const r = b.getBoundingClientRect();
          return { x: r.left, y: r.top, w: r.width, h: r.height };
        });
        focused = buttons[c.nextMenuFocus(rects, buttons.indexOf(focused), dir)] || focused;
        navHold = now + 220;
      }
      if (!dir) navHold = 0;
      buttons.forEach((b) => (b === focused ? b.setAttribute("data-gp-focus", "") : b.removeAttribute("data-gp-focus")));
      if (focused && document.activeElement !== focused) focused.focus({ preventScroll: false });
      if (pressedA && focused) focused.click();
      if (pressedB || startEdge) pressKey("Escape");
    } else {
      if (focused) focused.removeAttribute("data-gp-focus");
      focused = null;
      padHeld.clear();
      keys.forEach((k) => padHeld.add(k));
      if (startEdge) pressKey("Escape");
    }
    prev = new Set(keys);
    if (c.padButtonDown(p, 0)) prev.add("pad:A");
    if (c.padButtonDown(p, 1)) prev.add("pad:B");
    prevStart = start;
  };
  frame = win.requestAnimationFrame(loop);
  return () => {
    win.cancelAnimationFrame(frame);
    padHeld.clear();
  };
}
