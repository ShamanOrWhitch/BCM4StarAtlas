// Loads the real First Planet island sim (sim.ts) in node, with the same key
// set the browser feeds it. Used by tests that play the island by keys.
import { register } from "node:module";
import { pathToFileURL } from "node:url";

const SRC = new URL("../../mini-sim/first-planet/src/", import.meta.url).href;

// First Planet sources use the Vite alias "@/..." and extensionless imports.
register(
  "data:text/javascript," +
    encodeURIComponent(
      `const SRC = ${JSON.stringify(SRC)};
export async function resolve(s, c, next) {
  if (s.startsWith("@/")) s = SRC + s.slice(2);
  try { return await next(s, c); } catch (e) {
    if (!/\\.[a-z]+$/i.test(s)) {
      try { return await next(s + ".ts", c); } catch (e2) { return next(s + ".tsx", c); }
    }
    throw e;
  }
}
// Vite imports JSON without an attribute; node needs the module spelled out.
export async function load(url, context, next) {
  if (url.endsWith(".json")) {
    const { readFile } = await import("node:fs/promises");
    const { fileURLToPath } = await import("node:url");
    return { format: "module", shortCircuit: true, source: "export default " + (await readFile(fileURLToPath(url), "utf8")) + ";" };
  }
  return next(url, context);
}`,
    ),
  pathToFileURL("./"),
);

if (!globalThis.localStorage) {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => void store.set(k, String(v)),
    removeItem: (k) => void store.delete(k),
    clear: () => store.clear(),
  };
}

const input = await import(SRC + "game/input.ts");
const simModule = await import(SRC + "game/island/sim.ts");
const terrain = await import(SRC + "game/island/terrain.ts");

/** A fresh sim plus helpers: hold keys for a number of seconds at 60 steps a second. */
/** planet: First Planet profile id (content and save are per planet). keepSave: do not wipe saves. */
export function playIsland(seed = 7, planet = undefined, { keepSave = false } = {}) {
  if (!keepSave) globalThis.localStorage.clear?.();
  terrain.setRelief?.("desert");
  const sim = simModule.createSim(seed, planet);
  const hold = (codes, seconds, each) => {
    input.setForced(codes.length ? codes : null);
    const steps = Math.round(seconds * 60);
    for (let i = 0; i < steps; i += 1) {
      sim.step(1 / 60);
      if (each) each(sim, i);
    }
    input.setForced(null);
  };
  const tap = (code) => {
    hold([code], 2 / 60);
    hold([], 2 / 60);
  };
  return { sim, hold, tap, terrain };
}
