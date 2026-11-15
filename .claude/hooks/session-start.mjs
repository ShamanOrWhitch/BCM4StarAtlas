#!/usr/bin/env node
// SessionStart hook: prints a short reconcile brief into Claude's context.
// Must never fail the session: every step is best-effort and time-boxed.
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const git = (...a) => {
  try {
    return execFileSync("git", a, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 15000 }).trim();
  } catch {
    return "";
  }
};
const read = (p) => {
  const f = join(root, p);
  return existsSync(f) ? readFileSync(f, "utf8") : "";
};

const lines = ["## BCM4SA reconcile brief (auto, SessionStart hook)"];

// 1. Git position
git("-c", "http.sslBackend=schannel", "fetch", "-q", "origin", "main");
const head = git("rev-parse", "--short", "HEAD");
const branch = git("rev-parse", "--abbrev-ref", "HEAD");
const ab = git("rev-list", "--left-right", "--count", "HEAD...origin/main").split(/\s+/);
const dirty = git("status", "--porcelain").split("\n").filter(Boolean);
lines.push(
  `- Git: \`${branch}\` @ \`${head}\`; ahead ${ab[0] ?? "?"} / behind ${ab[1] ?? "?"} origin/main; ${dirty.length ? `${dirty.length} uncommitted file(s)` : "clean tree"}.`,
);
if (branch !== "main") lines.push("- ⚠ Owner directive: work only in `main`, no feature branches or new PRs.");
if (Number(ab[1]) > 0) lines.push("- ⚠ Behind origin/main — another writer pushed. `git pull --ff-only` before editing.");

// 2. Journal snapshot vs HEAD
const bugs = read("mini-sim/JOURNAL_BUGS.md");
const snap = (bugs.match(/Срез чтения: `main` `([0-9a-f]{7,40})`[^\n]*/) || [])[1];
if (snap) {
  const since = git("rev-list", "--count", `${snap}..HEAD`);
  lines.push(`- Journals read at \`${snap}\`; ${since || "?"} commit(s) since. Review them before trusting journal statuses:`);
  const log = git("log", "--oneline", "-n", "12", `${snap}..HEAD`);
  if (log) lines.push(...log.split("\n").map((l) => `  - ${l}`));
}
const open = [...bugs.matchAll(/^## (BUG-\d+)[^\n]*\n[\s\S]*?\*\*Статус:\*\* `([A-Z-]+)`/gm)].map((m) => `${m[1]}=${m[2]}`);
if (open.length) lines.push(`- Bug statuses: ${open.join(", ")}.`);
const ver = (read("mini-sim/bcm-mini-sim.php").match(/Version:\s*([\d.]+)/) || [])[1];
if (ver) lines.push(`- Mini-Sim plugin header version: ${ver}.`);

// 3. GitHub: WORK LOCKs + CI for HEAD (time-boxed)
const gh = (...a) => {
  try {
    return execFileSync(process.execPath, [join(root, ".claude/tools/gh.mjs"), ...a, "--quiet"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 25000,
    }).trim();
  } catch {
    return "";
  }
};
const locks = gh("locks");
lines.push(locks ? "- Open WORK LOCK issues:\n" + locks.split("\n").map((l) => `  - ${l}`).join("\n") : "- WORK LOCK list unavailable (GitHub offline or no credential).");
const runs = gh("runs");
if (runs) lines.push("- CI:\n" + runs.split("\n").map((l) => `  - ${l.replace(/\s+https:\S+/, "")}${/minisim-browser-qa\.yml/.test(l) ? "  ← live WP QA disabled by owner (`on: []`); expected, not a bug" : ""}`).join("\n"));

lines.push(
  "- Protocol: mini-sim/AGENTS.md §1 — reconcile, WORK LOCK before code, integration test first, update the right journal. Use /reconcile for the full pass.",
);
console.log(lines.join("\n"));
