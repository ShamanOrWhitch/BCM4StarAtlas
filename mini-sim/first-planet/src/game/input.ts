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
  steer = Math.max(-1, Math.min(1, steer - readTilt()));
  const throttle = keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0;
  const brake = keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0;
  const drift = keys.has("ShiftLeft") || keys.has("ShiftRight") || keys.has("Space");
  const use = keys.has("ControlLeft") || keys.has("ControlRight") || keys.has("KeyE");
  const cam = keys.has("KeyV");
  return { throttle, brake, steer, drift, use, cam };
}

let tiltOn = false;
let tiltNeutral = 0;
let tiltValue = 0;

function screenTilt(beta: number, gamma: number) {
  const angleRaw = screen.orientation && typeof screen.orientation.angle === "number"
    ? screen.orientation.angle
    : typeof window.orientation === "number"
      ? window.orientation
      : 90;
  const angle = ((angleRaw % 360) + 360) % 360;
  if (angle === 90) return -beta;
  if (angle === 270) return beta;
  if (angle === 180) return -gamma;
  return gamma;
}

if (typeof window !== "undefined") {
  window.addEventListener("deviceorientation", (event) => {
    if (!tiltOn) return;
    const horizontal = screenTilt(event.beta ?? 0, event.gamma ?? 0);
    tiltValue = Math.max(-1, Math.min(1, (horizontal - tiltNeutral) / 26));
  });
}

/** Same idea as the space TILT button: lean the phone to steer. */
export async function toggleTilt() {
  tiltOn = !tiltOn;
  tiltValue = 0;
  const ask = (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission;
  if (tiltOn && ask) {
    try {
      await ask.call(DeviceOrientationEvent);
    } catch {
      tiltOn = false;
    }
  }
  if (tiltOn) tiltNeutral = 0;
  return tiltOn;
}

export function tiltEnabled() {
  return tiltOn;
}

export function readTilt() {
  return tiltOn ? tiltValue : 0;
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
