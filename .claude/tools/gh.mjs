#!/usr/bin/env node
// Minimal GitHub helper for Claude Code sessions on this machine.
// Works without the `gh` CLI: the token comes from Git Credential Manager
// (`git credential fill`), so nothing secret is stored in the repository.
//
// Usage:
//   node .claude/tools/gh.mjs locks                 open WORK LOCK issues
//   node .claude/tools/gh.mjs issues [all]          open issues (all = incl. closed, last 30)
//   node .claude/tools/gh.mjs issue <n>             issue body + comments
//   node .claude/tools/gh.mjs runs [sha]            Actions runs for a SHA (default: HEAD)
//   node .claude/tools/gh.mjs jobs <runId>          jobs/steps of one run, failed steps marked
//   node .claude/tools/gh.mjs log <jobId>           tail of one job log
//   node .claude/tools/gh.mjs open-lock "<title>" <bodyFile>   create "WORK LOCK: <title>"
//   node .claude/tools/gh.mjs comment <n> <bodyFile>
//   node .claude/tools/gh.mjs close <n> [bodyFile]
//   node .claude/tools/gh.mjs whoami
// Flags: --json prints raw JSON; --quiet suppresses errors (for hooks).

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const REPO = "ShamanOrWhitch/BCM4StarAtlas";
const API = "https://api.github.com";
const argv = process.argv.slice(2);
const JSON_OUT = argv.includes("--json");
const QUIET = argv.includes("--quiet");
const args = argv.filter((a) => !a.startsWith("--"));

function fail(msg, code = 1) {
  if (!QUIET) console.error(msg);
  process.exit(QUIET ? 0 : code);
}

function token() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    const out = execFileSync("git", ["credential", "fill"], {
      input: "protocol=https\nhost=github.com\n\n",
      env: { ...process.env, GCM_INTERACTIVE: "never", GIT_TERMINAL_PROMPT: "0" },
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
      timeout: 15000,
    });
    const m = out.match(/^password=(.+)$/m);
    if (m) return m[1].trim();
  } catch {}
  fail("GITHUB-WRITE-UNAVAILABLE: no GitHub credential. Run: git credential-manager github login");
}

const TOKEN = token();

async function gh(path, { method = "GET", body, raw = false } = {}) {
  const res = await fetch(path.startsWith("http") ? path : `${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "bcm4sa-claude-tools",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) fail(`HTTP-BLOCKED: ${method} ${path} -> ${res.status} ${await res.text().catch(() => "")}`.slice(0, 400));
  return raw ? res.text() : res.json();
}

const headSha = () => execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const out = (data, fmt) => (JSON_OUT ? console.log(JSON.stringify(data, null, 2)) : fmt(data));
const day = (s) => (s || "").slice(0, 10);
const readBody = (f) => (f ? readFileSync(f, "utf8") : "");

const [cmd, a1, a2] = args;

switch (cmd) {
  case "whoami": {
    const u = await gh("/user");
    const r = await gh(`/repos/${REPO}`);
    out({ login: u.login, permissions: r.permissions }, (d) =>
      console.log(`${d.login} — ${Object.entries(d.permissions).filter(([, v]) => v).map(([k]) => k).join(", ")}`),
    );
    break;
  }
  case "locks":
  case "issues": {
    const state = a1 === "all" ? "all" : "open";
    let list = await gh(`/repos/${REPO}/issues?state=${state}&per_page=${state === "all" ? 30 : 100}`);
    list = list.filter((i) => !i.pull_request);
    if (cmd === "locks") list = list.filter((i) => /WORK LOCK/i.test(i.title));
    out(list.map(({ number, title, state, updated_at, user }) => ({ number, title, state, updated_at, author: user?.login })), (d) => {
      if (!d.length) return console.log("(none)");
      for (const i of d) console.log(`#${i.number} ${i.state === "closed" ? "[closed] " : ""}${i.title}  (upd ${day(i.updated_at)})`);
    });
    break;
  }
  case "issue": {
    if (!a1) fail("issue <number>");
    const i = await gh(`/repos/${REPO}/issues/${a1}`);
    const c = await gh(`/repos/${REPO}/issues/${a1}/comments?per_page=100`);
    out({ issue: i, comments: c }, () => {
      console.log(`#${i.number} [${i.state}] ${i.title}\n${i.html_url}\n\n${i.body || ""}`);
      for (const x of c) console.log(`\n--- ${x.user.login} ${day(x.created_at)}\n${x.body}`);
    });
    break;
  }
  case "runs": {
    const sha = a1 || headSha();
    const d = await gh(`/repos/${REPO}/actions/runs?head_sha=${sha}&per_page=50`);
    out(d.workflow_runs, (runs) => {
      console.log(`Actions for ${sha.slice(0, 7)}:`);
      if (!runs.length) return console.log("(no runs yet — push may still be queuing, or no workflow matched the paths)");
      for (const r of runs) console.log(`${(r.conclusion || r.status).padEnd(11)} ${r.name}  id=${r.id}  ${r.html_url}`);
    });
    break;
  }
  case "jobs": {
    if (!a1) fail("jobs <runId>");
    const d = await gh(`/repos/${REPO}/actions/runs/${a1}/jobs?per_page=50`);
    out(d.jobs, (jobs) => {
      for (const j of jobs) {
        console.log(`${(j.conclusion || j.status).padEnd(11)} job ${j.name} id=${j.id}`);
        for (const s of j.steps || []) if (s.conclusion && s.conclusion !== "success" && s.conclusion !== "skipped") console.log(`   ✗ step ${s.number}: ${s.name} (${s.conclusion})`);
      }
    });
    break;
  }
  case "log": {
    if (!a1) fail("log <jobId>");
    const text = await gh(`/repos/${REPO}/actions/jobs/${a1}/logs`, { raw: true });
    const lines = text.split(/\r?\n/);
    console.log(lines.slice(-Number(a2 || 150)).join("\n"));
    break;
  }
  case "open-lock": {
    if (!a1) fail('open-lock "<title>" <bodyFile>');
    const title = /^WORK LOCK/i.test(a1) ? a1 : `WORK LOCK: ${a1}`;
    const i = await gh(`/repos/${REPO}/issues`, { method: "POST", body: { title, body: readBody(a2) } });
    console.log(`#${i.number} ${i.html_url}`);
    break;
  }
  case "comment": {
    if (!a1 || !a2) fail("comment <number> <bodyFile>");
    const c = await gh(`/repos/${REPO}/issues/${a1}/comments`, { method: "POST", body: { body: readBody(a2) } });
    console.log(c.html_url);
    break;
  }
  case "close": {
    if (!a1) fail("close <number> [bodyFile]");
    if (a2) await gh(`/repos/${REPO}/issues/${a1}/comments`, { method: "POST", body: { body: readBody(a2) } });
    const i = await gh(`/repos/${REPO}/issues/${a1}`, { method: "PATCH", body: { state: "closed" } });
    console.log(`#${i.number} closed`);
    break;
  }
  default:
    console.log(readFileSync(new URL(import.meta.url), "utf8").split("\n").slice(1, 18).join("\n").replace(/^\/\/ ?/gm, ""));
}
