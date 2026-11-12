# Mini-Sim testing policy

Last updated: 12 November 2026

This file is the canonical test boundary. Read it before starting browser QA or changing a workflow.

## Allowed automatic checks

- `npm run test:minisim` — source, asset-path and regression contracts. It does not open the public website.
- `npm run qa:minisim:standalone` — Playwright/Chromium against a local HTTP fixture built from the checked-out repository. It uses local Mini-Sim assets; it does not visit WordPress.
- `.github/workflows/minisim-standalone-browser-qa.yml` — the standalone local-fixture browser test. Preserve this workflow.

## Retired live WordPress automation

- `.github/workflows/minisim-browser-qa.yml` is retired and disabled (no event triggers and an inert job guard). Never re-enable it as an automatic, scheduled, push or pull-request check.
- The old route opened `https://walkingyog.com/bcm4sa/`. GitHub-hosted automation received HTTP 403 before the `.bcm-mini-sim` application root; the runner then waited for a selector that could never appear. The workflow could consume long job time without testing gameplay.
- Historical context: real PASS runs existed through 21 October 2026. The first confirmed HTTP 403 failure was 22 October 2026. This changed over time; do not report that the test never passed.
- A live WordPress check is manual-only and may be run only when the user explicitly asks for that check. `npm run qa:minisim -- --url "..."` is not part of routine CI and must never be scheduled or automatically retried.

## Fail-fast rule for the manual live runner

`scripts/minisim-local-qa.mjs` performs one short preflight (10-second timeout). If the response is not successful, the host cannot be reached, or the returned HTML does not contain the `.bcm-mini-sim` root, it exits before launching Chromium and records `BLOCKED_ENVIRONMENT`. If the browser request is subsequently denied or the root is replaced by a challenge page, it also reports `BLOCKED_ENVIRONMENT` rather than a Mini-Sim gameplay failure. Do not wait 30 seconds for a DOM element that the host has already blocked.

## Security plugin / firewall policy

- The HTTP 403 is evidence that the request was denied at the website/edge boundary; Actions logs do not identify the exact security component or prove that a plugin update caused it. Daily security-plugin updates are therefore not a QA fix and are not a prerequisite for Mini-Sim tests.
- Do not update, disable, reconfigure, whitelist, bypass or otherwise manipulate WordPress security plugins, firewall rules or anti-bot settings to make GitHub Actions pass. Do not probe alternate endpoints or retry the same blocked route.
- WordPress security updates remain ordinary site maintenance, performed by the site owner on their own schedule and according to actual security advisories—not by a game test script and not every day just to satisfy CI.
- If the live preflight is blocked, stop. Continue with source tests and the local standalone browser fixture. Record the live site as unverified until the user independently confirms it is reachable and explicitly requests a manual live check.

## Reporting labels

- `PASS` — the named source or local browser checks actually passed.
- `FAIL` — a check reached the Mini-Sim runtime and a code or gameplay assertion failed.
- `BLOCKED_ENVIRONMENT` — host, security gate, network, or missing shortcode root prevented the test from reaching the Mini-Sim runtime. This is neither PASS nor a gameplay FAIL.
- A local fixture PASS does not imply a live WordPress deployment, active theme, remote API, phone/gamepad behavior or user-confirmed playtest.
