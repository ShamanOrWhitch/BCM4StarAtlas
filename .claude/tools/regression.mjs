#!/usr/bin/env node
// Runs exactly what CI "Mini-Sim regression checks" runs, read from the
// workflow file, so the local count matches CI (139 on 737ac88), not the
// narrower `npm run test:minisim` subset (62).
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const wf = readFileSync(".github/workflows/minisim-regression.yml", "utf8");
const checks = [...wf.matchAll(/^\s*node --check (\S+)\s*$/gm)].map((m) => m[1]);
const testLine = (wf.match(/^\s*run: node --test (.+)$/m) || [])[1];
if (!testLine) {
  console.error("Could not find the `node --test` line in minisim-regression.yml");
  process.exit(2);
}

let failed = 0;
for (const f of checks) {
  const r = spawnSync(process.execPath, ["--check", f], { stdio: "inherit" });
  if (r.status !== 0) failed++;
}
console.log(`syntax: ${checks.length - failed}/${checks.length} ok`);

const r = spawnSync(process.execPath, ["--test", ...testLine.trim().split(/\s+/)], { stdio: "inherit" });
process.exit(failed ? 1 : (r.status ?? 1));
