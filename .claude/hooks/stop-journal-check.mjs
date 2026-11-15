#!/usr/bin/env node
// Stop hook: if game code changed (uncommitted, or in commits not yet pushed)
// but none of the journals / state files did, ask Claude once to record it.
// Blocks at most once per stop cycle (respects stop_hook_active).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {}
if (input.stop_hook_active) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const git = (...a) => {
  try {
    return execFileSync("git", a, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 10000 }).trim();
  } catch {
    return "";
  }
};

const changed = new Set(
  [git("diff", "--name-only", "HEAD"), git("diff", "--name-only", "--cached"), git("diff", "--name-only", "origin/main...HEAD")]
    .join("\n")
    .split("\n")
    .filter(Boolean),
);

const code = [...changed].filter((f) => /^mini-sim\/.*\.(js|mjs|php|css|ts|tsx)$/i.test(f) && !/\.test\.mjs$/.test(f));
const journals = [...changed].filter((f) => /^mini-sim\/(JOURNAL_(BUGS|IDEAS|KIT)|PROJECT_STATE|DECISIONS)\.md$/.test(f));

if (code.length && !journals.length) {
  const reason =
    `Game code changed (${code.slice(0, 5).join(", ")}${code.length > 5 ? ", …" : ""}) but no journal was updated. ` +
    "Per mini-sim/AGENTS.md «Обновление журналов обязательно»: record the bug fix in JOURNAL_BUGS.md, the idea in JOURNAL_IDEAS.md " +
    "or the kit change in JOURNAL_KIT.md, and PROJECT_STATE.md/DECISIONS.md with the SHA if behaviour changed. " +
    "If this change truly needs no journal entry (e.g. a pure refactor not yet finished), say so explicitly and stop.";
  console.log(JSON.stringify({ decision: "block", reason }));
}
process.exit(0);
