export const held = new Set<string>();

let forced: Set<string> | null = null;

export function activeKeys() {
  return forced ?? held;
}

export function setForced(codes: string[] | null) {
  forced = codes && codes.length ? new Set(codes) : null;
}

export function readDrive() {
  const keys = activeKeys();
  let steer = 0;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) steer += 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) steer -= 1;
  const throttle = keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0;
  const brake = keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0;
  const drift = keys.has("ShiftLeft") || keys.has("ShiftRight") || keys.has("Space");
  const use = keys.has("ControlLeft") || keys.has("ControlRight") || keys.has("KeyE");
  const cam = keys.has("KeyV");
  return { throttle, brake, steer, drift, use, cam };
}

export function bindKeyboard(target: Window) {
  const block = new Set(["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);
  const down = (event: KeyboardEvent) => {
    held.add(event.code);
    if (block.has(event.code)) event.preventDefault();
  };
  const up = (event: KeyboardEvent) => {
    held.delete(event.code);
  };
  const blur = () => held.clear();
  target.addEventListener("keydown", down);
  target.addEventListener("keyup", up);
  target.addEventListener("blur", blur);
  const vis = () => {
    if (document.visibilityState !== "visible") held.clear();
  };
  document.addEventListener("visibilitychange", vis);
  return () => {
    target.removeEventListener("keydown", down);
    target.removeEventListener("keyup", up);
    target.removeEventListener("blur", blur);
    document.removeEventListener("visibilitychange", vis);
  };
}
