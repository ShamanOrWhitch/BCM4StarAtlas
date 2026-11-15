// BUG-006: First Planet scene called hoverFloor() without importing it, so the
// bundle CI ships threw "hoverFloor is not defined" on boarding the bike (F).
// Every terrain helper the scene calls must be imported from ./terrain.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

test("scene imports every terrain helper it calls", () => {
  const terrain = read("mini-sim/first-planet/src/game/island/terrain.ts");
  const scene = read("mini-sim/first-planet/src/game/island/scene.ts");
  const exported = [...terrain.matchAll(/export function (\w+)/g)].map((m) => m[1]);
  const block = scene.match(/import \{([^}]*)\} from "\.\/terrain";/);
  assert.ok(block, "scene has no terrain import");
  const imported = new Set(block[1].split(",").map((s) => s.replace(/^\s*type\s+/, "").trim()).filter(Boolean));
  const local = new Set([...scene.matchAll(/function (\w+)\s*\(/g)].map((m) => m[1]));
  const calls = (name) => new RegExp(`(^|[^.\\w])${name}\\(`).test(scene);
  const missing = exported.filter((name) => !local.has(name) && calls(name) && !imported.has(name));
  assert.deepEqual(missing, [], "called but not imported: " + missing.join(", "));
});
