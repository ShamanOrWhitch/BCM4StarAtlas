#!/usr/bin/env node
// Acceptance evidence for one commit, in Dr Fable's report format
// (DR_FABLE_PLAYBOOK §5: STATUS / FILES / FINDINGS / PATCH / TESTS / BLOCKERS / RECOMMENDATION).
//   node .claude/tools/evidence.mjs [sha] [--since <sha>] [--md]
// Reads git locally and GitHub Actions through gh.mjs. Never claims PASS for
// a run that is not finished, and never counts the disabled live-QA workflow.
import { execFileSync } from "node:child_process";

const argv = process.argv.slice(2);
const md = argv.includes("--md");
const sinceIdx = argv.indexOf("--since");
const since = sinceIdx >= 0 ? argv[sinceIdx + 1] : null;
const target = argv.find((a, i) => !a.startsWith("--") && (sinceIdx < 0 || i !== sinceIdx + 1)) || "HEAD";

const git = (...a) => execFileSync("git", a, { encoding: "utf8" }).trim();
const gh = (...a) => JSON.parse(execFileSync(process.execPath, [".claude/tools/gh.mjs", ...a, "--json"], { encoding: "utf8", maxBuffer: 64 << 20 }));
const ghText = (...a) => execFileSync(process.execPath, [".claude/tools/gh.mjs", ...a], { encoding: "utf8", maxBuffer: 64 << 20 });

const sha = git("rev-parse", target);
const short = sha.slice(0, 7);
const range = since ? `${since}..${sha}` : `${sha}~1..${sha}`;
const commits = git("log", "--format=%h %s", range).split("\n").filter(Boolean);
const files = git("diff", "--stat", range.replace("..", " ").split(" ")[0], sha).split("\n");
const bodies = git("log", "--format=%B", range);
const red = bodies.split("\n").filter((l) => /\bred\b|до правки|before:|Red on/i.test(l)).slice(0, 6);

const runs = gh("runs", sha).filter((r) => !/minisim-browser-qa\.yml$/.test(r.path || r.name));
const tests = [];
for (const run of runs) {
  const row = { name: run.name, status: run.status, conclusion: run.conclusion, url: run.html_url, counts: "", artifacts: [] };
  if (run.status === "completed") {
    try {
      const jobs = gh("jobs", String(run.id));
      for (const job of jobs) {
        const log = ghText("log", String(job.id), "400");
        const pick = (k) => (log.match(new RegExp(`# ${k} (\\d+)`)) || [])[1];
        if (pick("tests")) row.counts = `${pick("pass")}/${pick("tests")}`;
        else if (/"status":\s*"PASS"/.test(log)) row.counts = "PASS";
      }
      row.artifacts = gh("artifacts", String(run.id)).map((x) => ({ name: x.name, id: x.id, mb: (x.size_in_bytes / 1e6).toFixed(1) }));
    } catch {}
  }
  tests.push(row);
}

const pending = tests.filter((t) => t.status !== "completed");
const failed = tests.filter((t) => t.status === "completed" && t.conclusion !== "success");
const status = !tests.length ? "NO-CI-YET" : failed.length ? "FAIL" : pending.length ? "RUNNING" : "TESTED-CODE";

const lines = [];
const h = (t) => lines.push(md ? `\n**${t}**` : `\n${t}`);
lines.push(`${md ? "### " : ""}Evidence for ${short} — STATUS: ${status}`);
h("FILES");
lines.push(...files.slice(-12).map((l) => (md ? "    " : "  ") + l.trim()));
h("COMMITS");
lines.push(...commits.map((c) => `- ${c}`));
if (red.length) { h("RED → GREEN (from commit messages)"); lines.push(...red.map((l) => `- ${l.trim()}`)); }
h("TESTS (GitHub Actions)");
for (const t of tests) {
  const verdict = t.status !== "completed" ? t.status.toUpperCase() : t.conclusion === "success" ? "PASS" : t.conclusion.toUpperCase();
  lines.push(`- ${verdict} ${t.name}${t.counts ? " " + t.counts : ""} — ${md ? `[run](${t.url})` : t.url}`);
  for (const a of t.artifacts) lines.push(`  - artifact ${a.name} (${a.mb} MB) ${md ? `[#${a.id}](${t.url}/artifacts/${a.id})` : `#${a.id}`}`);
}
if (!tests.length) lines.push("- no runs yet for this SHA");
h("BLOCKERS / NOT VERIFIED");
if (pending.length) lines.push(`- still running: ${pending.map((t) => t.name).join(", ")} — not PASS yet`);
if (failed.length) lines.push(`- failed: ${failed.map((t) => t.name).join(", ")}`);
lines.push("- live WordPress, manual play, phone/gamepad: not covered by CI");
console.log(lines.join("\n"));
process.exit(failed.length ? 1 : 0);
