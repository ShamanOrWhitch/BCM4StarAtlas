## Active Work Lock — Mini-Sim 0.11.12 repair candidate (25 October 2026)

- Branch: `fix/minisim-0.11.12-warp-speed-collision-ring`; base main `9caba968636610a2413a23177bd9d64f20fe0900`.
- Scope: Warp speed/HUD, Panda prompt/legibility, asteroid swept collision, Ring entry guard, focused tests and state/handoff notes. Do not touch `wordpress/galia-desk`, scanner, pricing data, or site firewall.
- User reports 0.11.8 remains the best-feeling build; keep this patch narrow and do not claim later features are visually verified.
- CI pending. Live browser QA is blocked by HTTP 403 before the Mini-Sim container, not a playable test. Do not bypass the firewall or claim WordPress deployment.

## Historical Work Lock — Mini-Sim 0.11.11 Warp/Panda regression (PR #71 merged; not live-deployed)

- Issue: [#70](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/70); branch: `fix/minisim-0.11.11-warp-panda-prompt`.
- Baseline main SHA: `bc77614564aa7bf1f2a211c945006fc258d6aeff` (Mini-Sim 0.11.10 / Tower 0.2.65).
- Owned paths: `mini-sim/assets/js/deep-space-warp.js`, `mini-sim/assets/js/mini-sim.js`, `mini-sim/assets/css/mini-sim.css`, `mini-sim/bcm-mini-sim.php`, focused Warp/dialogue/QA tests and Mini-Sim state/handoff/decision docs.
- Keep the patch limited to Warp drawing readability and Panda controls presentation. Preserve collision formulas, speed/shimmer timing, audio, navigation, Tower physics and all Galia Desk/scanner/pricing data.
- Issue #43's older `feat/hull-ring-repair-loop` branch also touched Warp but is 187 commits behind main; do not merge it wholesale. Test and browser status are recorded in the candidate handoff; browser HTTP 403 is BLOCKED, not visual PASS.

## Кандидат — Mini-Sim 0.11.5 Astral phase
- Branch: minisim-0.11.5-astral-phase, stacked on PR #66 / 0.11.4 and PR #65 / 0.11.3. Not merged or deployed.
- Y-layer cells select deterministic Drift/Flux/Dense gravity from asteroid seed + cell coordinates. Keep maze topology/crystal RNG unchanged and preserve existing texture assets/rotations.
- 0.11.4 Hydrogen objective uses actual screen playback + the original cell graph.
- Tower handoff now saves the arriving ship state before velocity freeze and stores the active Tower seed in the mission session. Tower version/cache is 0.2.65. City below Tower and same-seed return remains issue #67; actual restore is not yet wired. Deeper astral rules remain issue #68; current implementation is a modest first step, not a full astral-dimension implementation.
- Explicit cinema focus stays on the chosen panel until unavailable/out of its radius; nearer media doesn't steal it. Mission HUD reports screen progress and Hydrogen completion.
- Workflow CI reports source checks; production browser requests get 403 from firewall. Do not bypass the firewall, and do not claim a visual phone test. wordpress/galia-desk remains off-limits.

## Current main state — Mini-Sim 0.11.8 (24 October 2026)

This entry supersedes the older 0.11.3–0.11.5 candidate notes below; those sections remain as history, not as the current state. Current code is on `main`; Tower remains `0.2.65`. **Nothing has been deployed to the website.**

- Warp: Class II has subdued visuals; Class III has a distinct purple shell and ribs; Class IV is disabled. Solid circular obstacle hoops were removed, along with the extra `>` chevron and launcher loop marker. Tube collision and steering should remain independent of visual class.
- Ring: the room graph has a BFS route to the large arena. At blocked doorways a transition selects an available step toward the arena; the action control uses the route hint. Each player retains a separate logical room, with split-screen when they occupy different cells.
- All three bosses now have recognisable pig silhouettes built from existing Three.js primitives (body, snout, ears, nostrils, tusks, legs and tail); no new image or texture assets were added. The weakpoint is in front of the head so the snout does not hide it.
- Source/regression checks, UI-layer checks, Tower top-cap checks, and the test ZIP build passed on the current code. Browser QA did not verify rendering: `https://walkingyog.com/bcm4sa/` returns HTTP 403 before the game container appears. Do not bypass the firewall or report this run as a visual test.
- `wordpress/galia-desk` is untouched. No production deployment was made.

## Previous candidate — Mini-Sim 0.11.4 Hydrogen mission
- Branch: `minisim-0.11.4-hydrogen-mission`, stacked on candidate 0.11.3 / PR #65. Not merged or deployed.
- Screen progress counts a configured screen only after video `playing`. Once all required screens are visited, operator requests Hydrogen; pickup belongs to the first small cell from `maze.startCell` and shows H on the chart.
- Leave Bearhead optional pending upload. Don't create separate maze textures or regenerate a different cell map for Ring.
- City under Tower and return to the arriving ship need a separate architecture change: Tower entry disposes Mini-Sim scene/renderer. Preserve same Tower seed and ship state intentionally before building the city route.
- Production browser QA is blocked by 403 firewall; do not bypass firewall. `wordpress/galia-desk` remains locked and untouched.

## Предыдущая кандидатная база — Mini-Sim 0.11.3
- Branch: `minisim-0.11.3-ring-texture-focus`, based on main SHA `424394e`. Not merged or deployed.
- Исправляются: facing не-Mierese в shared CrewCore; реальное назначение текстуры/четверть-поворота per asteroid cell; ONICSS poster/preload fallback; explicit X-release camera focus; optional Bearhead avatar video.
- Держать отдельными будущими задачами: Hydrogen, once-only mission after screen discovery, true astral phase mechanics, Tower city below + return to original ship via same seed.
- Обновление production требует deployment вручную. Remote browser QA не стартует, потому что URL получает 403 от firewall. Не обходить защиту и не делать выводов о рендере по статическим тестам.
- Не трогать `wordpress/galia-desk`; Tower остается 0.2.64; Room 1 остается стартом; снаружи V = Warp / U = трюм; внутри X = штурвал; не путать с X камеры, которая работает только в обычном полёте.

## Предыдущая база — Mini-Sim 0.11.1

- Room 1 остаётся стартом. 0.9.114 и 0.9.115 не продолжать.
- Снаружи: V = Warp, U = трюм. В трюме X = штурвал. Это единственное переназначение, его просил заказчик для 0.11.1.
- Кольцо: клетки seed астероида; арена — одна большая клетка; спрайты через `BCMCrewCutout`.
- Пушить ветку в репозиторий в том же заходе. galia-desk не трогать. PR #14 и #18 не сливать.

## Предыдущая база — Mini-Sim 0.11.0
- Код 0.9.113 плюс старт в Room 1. В main как 0.11.0.

## Candidate work — Mini-Sim 0.9.114 — закрыт как база

- Main baseline: 0.9.113 / Tower 0.2.64. Branch: fix/minisim-0.9.114-ring-cutaway-controls.
- Scope: restore same-maze Ring cutaway with original asteroid textures, keep collect-three-and-return objective, add minor mobs, move fire to X, move full return to Back, restore mouse access in Hull Dive.
- Shared changes require branch commits and a PR; GitHub merge does not deploy WordPress.
- Preserve SAGE navigation and wordpress/galia-desk. Do not merge stale PR #14 or #18 wholesale.

# Параллельная работа агентов — BCM4StarAtlas / Mini-Sim

> Это постоянный протокол координации, а не журнал игровых багов. Прочитать **до любой правки** вместе с `AGENTS.md`, `PROJECT_STATE.md` и `DECISIONS.md`.

## Главный принцип

Git — память выполненной работы; журнал решений — память того, почему решение принято и насколько оно проверено; GitHub Issues — общий видимый реестр активных задач; отдельные ветки — изоляция незавершённых изменений.

Разные модели могут работать в разных лабораториях и не видеть незакоммиченный код друг друга. Изменение становится доступным другим агентам только после публикации коммита/ветки или обновления общего Issue. Сообщение «сейчас исправляю» не заменяет общую запись, а незакоммиченный код не может считаться частью синхронизированного контекста.

## Синхронизированный runtime baseline — 2026-10-21

- Mini-Sim 0.9.112 / Tower 0.2.64 is on main at merge commit 443cd4f1cd388d020f1811908f1d31ad53809334 (PR #57).
- PR #57 keeps the pilot view alive during Hull Dive; starts at active helm; stabilizes controller assignment; adds a high-layer Ring entry control and Ctrl+Alt+U UI hit-test auditor.
- Verification is recorded in PROJECT_STATE.md, HANDOFF.md and decision D-022. Passing CI/synthetic browser QA is not hardware verification and does not deploy assets to WordPress.
- PR #14 and #18 remain open but GitHub reports both unmergeable with current main. Both touch mini-sim/assets/js/mini-sim.js; #14 also touches PHP/Tower files and #18 adds QA runner/tests plus a runtime lookYaw fragment. Do not merge either stale branch wholesale. Reconcile only independent useful changes on the newest main and rerun regressions.

## Обязательный стартовый reconcile

1. Прочитай `AGENTS.md`, `PROJECT_STATE.md`, `DECISIONS.md` и этот файл.
2. Проверь текущий `main`/HEAD и последние коммиты; сравни их с baseline из `PROJECT_STATE.md`. Открой diff только релевантных коммитов.
3. Просмотри открытые GitHub Issues и Pull Requests. Найди активные `WORK LOCK`-задачи и проверь ветки и изменённые файлы открытых PR. Открытый PR не блокирует весь проект автоматически, но может пересекаться с файлами или общим API.
4. Сверь текущие исходники, тесты и журнал решений. Отсутствие свежей жалобы не означает подтверждение, но и не является доказательством, что исправление не сделано.
5. Классифицируй исходный статус до новых изменений: `IMPLEMENTED`, `TESTED-CODE`, `VERIFIED-LIVE`, `USER-CONFIRMED`, `OPEN`, `NEEDS-USER-STATUS`, `BLOCKED`, `REOPENED` или `SUPERSEDED`.

## Как резервировать задачу

До первой записи кода создай GitHub Issue с заголовком `WORK LOCK: [этап] — [одна конкретная задача]`. В Issue укажи:

- агента/сессию и статус `IN PROGRESS`;
- исходный `main` SHA и имя отдельной рабочей ветки;
- цель и конкретный воспроизводимый симптом;
- область файлов и затрагиваемые общие API/подсистемы;
- критерии приёмки, нужные проверки и зависимости;
- ссылку на последний коммит/PR и статус передачи.

Перед созданием брони проверь открытые WORK LOCK Issues на пересечение файлов или подсистем. Если пересечение найдено, не начинай изменять код: договорись с владельцем через Issue о разделении или последовательности. Если ответа пока нет, можно продолжить чтение и анализ, но не совершай конфликтующих записей.

Публикуй контрольные коммиты в своей ветке, когда появляется самостоятельный полезный результат. Обновляй Issue после существенного шага, смены объёма, паузы или передачи. Закрывай бронь после интеграции либо явного отказа от задачи, а не только после написания кода.

**GitHub Issues не являются атомарным mutex.** Если два агента создали бронь почти одновременно, повторно сверь открытые Issues непосредственно перед первым коммитом и перед интеграцией. При обнаружении конфликта остановись и согласуй границы. Не затирай чужую работу и не используй force-push.

Не считай бронь свободной автоматически только из-за её возраста. Если нет обновлений 24 часа, сначала проверь последние коммиты/PR и запроси статус владельца, если это возможно. До выяснения не меняй ту же область.

## Правила параллельной работы

- Работай в отдельной ветке от актуального baseline; не отправляй несогласованные правки напрямую в `main`.
- Разные файлы могут иметь общий контракт: аудио, ввод, переходы, система координат, загрузка ресурсов. Если несколько задач касаются такого API, сначала согласуй интерфейс и назначь владельца интеграции.
- Если несколько агентов должны менять один файл, назначь одного владельца или раздели изменения на последовательные маленькие патчи. Никогда не переписывай большой файл целиком только из-за локального исправления.
- Перед открытием PR подтяни или сверяй последний целевой HEAD, прочитай diff и разрешай конфликты осмысленно, не автоматическим выбором «ours/theirs».
- После мержа другой задачи повтори reconcile: её коммит мог изменить предположения о твоей области, даже если прямого пересечения файлов не было.

## Память выполненного и статус пользователя

После существенной работы каждый агент обновляет:
1. `PROJECT_STATE.md` — этап, baseline SHA, итоговый статус и следующий шаг;
2. `DECISIONS.md` — что сделано, какие коммиты и тесты это подтверждают, неизвестные условия и критерии повторного открытия;
3. свою WORK LOCK Issue — ссылки, результаты, пауза/передача или закрытие.

Не удаляй старые решения: отмечай их `SUPERSEDED` или `REOPENED` и связывай с новой записью. Не трать большие вычисления на повтор уже выполненной работы, пока нет нового свидетельства регрессии.

Сохраняй различия:
- `IMPLEMENTED`: изменение находится в коде;
- `TESTED-CODE`: автоматические проверки прошли на конкретном SHA;
- `VERIFIED-LIVE`: браузер проверен на названной версии/окружении;
- `USER-CONFIRMED`: пользователь подтвердил определённый сценарий.

Browser QA с подменой ассетов не доказывает, что production отдаёт те же файлы. Зелёный CI не подтверждает ручное поведение игры. Молчание пользователя не является подтверждением или провалом. Если живой статус влияет на следующий шаг и его невозможно выяснить из Git/тестов, задай один узкий вопрос; иначе зафиксируй неизвестность и продолжай доступную проверку.

## Шаблон WORK LOCK Issue

```text
WORK LOCK: [stage] — [one concrete task]
Agent/session:
Status: IN PROGRESS / PAUSED / BLOCKED
Base SHA:
Branch:
Scope files:
Shared APIs/surfaces:
Goal and observed symptom:
Acceptance criteria:
Checks:
Known unknowns / user question:
Latest commit / PR:
Handoff / close reason:
```

## Состояние после 21 октября 2026 — reconciled

- Current main SHA: `51553e78bec6c7ecfb20cc69610c89d9225222c7`; Mini-Sim **0.9.111**, Tower 0.2.64.
- Merged: #46 Ring menu activation; #49 Warp visual tiers; #51 RU/EN dialogs, Ring weapons, inset Hull Dive and long QA budgets; #52 bounded network room registry/design; #55 Hull Dive RU/EN copy completion/cache bump.
- PR #55 CI: Mini-Sim regression [39567055498](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39567055498) PASS; Tower [39567055392](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39567055392) PASS; Warp [39567055312](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39567055312) PASS; UI/weapons/cabin [39567055331](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39567055331) PASS; Hull RU/EN [39567055354](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39567055354) PASS; browser smoke [39567055334](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39567055334) PASS. Video media step was skipped. Physical Android/gamepad playtest and production WordPress plugin confirmation remain unverified.
- Network co-op is still only `mini-sim/network/room-registry.mjs`, a tested in-memory registry. No live WebSocket/session auth/authoritative scheduler/RTT/reconnect. Next work remains Issue #48.
- Full SAGE map is Issue #28; do not represent local Warp navigation as real SAGE topology or fleet movement.
- Remaining hands-on checks: Ring menu on real keyboard/gamepad/touch, RU/EN selector, Warp I–IV at phone width, Hull visibility and controls, weapon feel/damage/cadence, live plugin asset cache update.
- Strict exclusion: no edits to `wordpress/galia-desk`, scanner, pricing/marketplace shared assets, planet placement, SAGE navigation adapter, global OST mixer or Tower physics.

