## Current candidate — Warp flow visual correction / Mini-Sim 0.11.22 (27 October 2026)

- **Branch:** `fix/minisim-0.11.22-warp-flow-bands`; based on main `e1b46b6da1bf54a6d775732cfa3d23f694c19bd5`; follow-up draft PR [#86](https://github.com/ShamanOrWhitch/BCM4StarAtlas/pull/87).
- **Scope:** remove the short axial motion streak overlay; animate 14 low-contrast horizontal/circumferential bands across the entire tube wall. Class II carries those bands deeper into the tunnel; Classes I and III bring them toward the ship. Their rate follows the existing accelerated `tubeTravel` clock.
- **Preserve:** existing 12 longitudinal surface seams, 22 randomized hazard layers, collisions, obstacle timing, course progress, Ring behavior and Tower physics.
- **Galaxy map:** the practical 2D SAGE XY overview is already in main from merged PR [#85](https://github.com/ShamanOrWhitch/BCM4StarAtlas/pull/85). It uses checked-in star/CSS landmarks, live adapter-supplied sector positions, zoom and eight adjacent local destinations plus a separate sector-location layer. This is not a claim that the 8,177 sector coordinates are all present; missing topology is not fabricated.
- **TESTED-CODE (source head `f68541e072cba878bda962cc86b6161e26fa7ec4`):** 8/8 relevant source workflows PASS — [Warp visual tiers](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40501469045), [Warp course/portal first frame](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40501469172), [Warp maze return](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40501469287), [Ring menu controls](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40501469186), [Mini-Sim regression](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40501469415), [UI layer](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40501469209), [Tower top cap](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40501469216), and [UI/weapons/cabin](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40501469091). JavaScript and updated regression-file syntax parsing also pass.
- **Browser QA:** [run 40501469335](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40501469335) was still in progress at last inspection. Prior browser access returned HTTP 403; do not claim `VERIFIED-LIVE`. WordPress is not deployed from this PR. Do not claim the directional visual regression is CI-tested until that workflow reports PASS.
- **Not VERIFIED-LIVE:** WordPress has not been deployed from this follow-up. The previous browser route returned HTTP 403, so production/device rendering remains unverified. Do not bypass site protection.


---

## Previous main baseline — Mini-Sim 0.11.20 / Tower 0.2.66 (26 October 2026)

- First Panda dialog is flight and screen approach. The Warp button (V, or WARP on a phone) is the second dialog, after the screens.
- Ring entry plays the landing clip, then the menu. The 2s abort stays gone. The side view uses the asteroid seed's wall textures. The forward door follows Hydrogen, then the return to the landing cell, including vertical floors.
- Mini-Sim/cache/title version: `0.11.20`; Tower version: `0.2.66`. No WordPress deployment from this commit.

## Previous state — Mini-Sim 0.11.19 / Tower 0.2.66 (26 October 2026)

- Ring level opens on approach and stays open. The 0.11.18 two-second video abort is gone. The crash was `portalMaterial.emissive.setHex` on a basic material, plus a maze-frame ReferenceError that skipped the approach check.
- Warp cancel on the asteroid keeps that locale and those coordinates. Place label is `ASTEROID · X / Y`, not Room 1.
- Flight radius is 160 so the asteroid can be flown around. Wall damping remains the 0.11.2 contact rule (0.15). V = Warp, U = hold, X = helm.
- Mini-Sim/cache/title version: `0.11.19`; Tower version: `0.2.66`. No WordPress deployment from this commit. 0.11.18 was already merged as PR #81.

## Previous state — Mini-Sim 0.11.18 / Tower 0.2.66 (26 October 2026)

- Ring entrance is a tappable door above Panda, and the cell maze renders in the flight canvas with the first opening aimed at the large arena.
- Phone flight copy is tilt, tilt reset, and tap-to-fix music screens. Keyboard Warp is a V button on the same action as the V key; phones get WARP.
- Mini-Sim/cache/title version: `0.11.18`; Tower version: `0.2.66`. No WordPress deployment. Asteroid physics and backside doors stay on the 0.11.16 contract.

## Previous state — Mini-Sim 0.11.17 / Tower 0.2.66 (26 October 2026)

- Merged via [PR #80](https://github.com/ShamanOrWhitch/BCM4StarAtlas/pull/80), commit `d821764610890e84970ba20b354e90e41d1cc6cf`.
- **Ring handoff:** the asteroid and ship remain visible until Ring's world, controls, renderer and cleanup routine are ready. Entry snapshots the old scene. If initialization throws or returns false, partial Ring state is cleaned up and the original asteroid visibility, ship visibility, background and scene children are restored; the Ring button remains retryable. The post-video failure path now displays a status instead of silently leaving empty space.
- **Tower text:** keyboard/mouse, touch/tilt and gamepad each have short device-specific instructions. Gamepad help adapts to Single/Multi and the number of connected controllers. Single objective is `ПОРА СПУСТИТЬСЯ ВНИЗ`; Multi is `КТО ПЕРВЫМ СПУСТИТСЯ ВНИЗ?`. Persistent warning: falling five landings returns to the start.
- Mini-Sim/cache/title version: `0.11.17`; Tower version: `0.2.66`. No WordPress deployment.
- Source CI on PR head `1097fe4b528cfc7695e4df85b76812f545e00803`: Ring, Mini-Sim, UI, Tower, Warp, Hull Dive and portal regressions PASS. Browser smoke was still running when this state note was written; it is not counted as a live pass. Manual game/video/device testing remains unverified.
- The preceding 0.11.16 section is historical and describes the prior asteroid rollback/door fix.

## Superseded state — Mini-Sim 0.11.16 (25 October 2026)

- Merged via [PR #79](https://github.com/ShamanOrWhitch/BCM4StarAtlas/pull/79) as commit `07ed389df12a491d987d47507bc42a1d97559af5`; this supersedes the 0.11.15 asteroid-contact and shell-door behavior documented below.
- **Asteroid rollback:** only the asteroid collision / exterior flight-radius block was restored to the 0.11.2 baseline. It uses the previous two-pass overlap resolver, damps the contacting velocity component by 0.15, retains the 43.2 flight-radius limit and the historical radial-boundary slowdown. Newer Warp, Ring, Hydrogen pickup, route generation, and unrelated Tower code remain in place.
- **Backside doors:** every outer-shell tile carrying a `backside*` texture now responds to the ship approaching its own footprint. Adjacent tiles open together when their clearance areas overlap; collision passage is allowed only when every overlapping panel is fully open. Doors close after the ship moves away.
- **Room 2 remains a solid corridor:** its side and front walls are not doors. The rear cap allows entry and exit only through the matching open `backside*` door; the former unconditional inside-to-space bypass is removed.
- Mini-Sim code/header/cache/title version is `0.11.16`. No WordPress deployment was performed.
- Source CI on tested PR head `a0049580e560babea5d9284ccafbc73e55574e48`: 9 source regression workflows PASS. Browser smoke FAILED because the site returned HTTP 403; Playwright then timed out waiting for `.bcm-mini-sim`. This does **not** establish a live game pass, and no manual phone/gamepad test was performed.
- The previous 0.11.15 description below is historical and is superseded by this rollback.

## Superseded state — Mini-Sim 0.11.15 (25 October 2026)

- Merged via [PR #78](https://github.com/ShamanOrWhitch/BCM4StarAtlas/pull/78) as commit `1b00a801f62506917f533ead12d0524f06159802`; issue [#77](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/77) is closed.
- The only dynamic door candidates are the outer starbase-shell panels built from `backside*` textures. Room 2 interior walls and asteroid maze walls are explicitly excluded. Room 2 does not become generally passable.
- The external shell collider accepts a crossing only if the matching selected backside panel is fully OPEN and the ship crosses within that panel's aperture.
- Asteroid maze collisions zero only the wall-normal component instead of leaving residual impact velocity; tangential motion remains. Exterior radius cap is widened to 58 and removes only outward radial velocity, not all ship speed.
- Crystal pickups show a stronger pickup flash plus floating `H +1` (or `CORE +1` outside the Hydrogen stage). The existing mission event synchronously advances the Hydrogen count; duplicate crystal IDs remain ignored.
- New regression cases cover shell-only door selection/opening, solid Room 2 corridor bounds, low-kickback tangential motion and the actual Hydrogen mission counter.
- Source suites passed on the merged PR head: Mini-Sim regression, Warp maze return, Warp visual tiers, UI layer, Ring controls, Tower top-cap, bilingual copy, UI/weapons/cabin and Warp course/portal first-frame. Browser smoke did not reach gameplay because the runner was still installing isolated Playwright; no visual/device pass or WordPress deployment is claimed.

---

## Main state — Mini-Sim 0.11.14 merged (25 October 2026)

- Merged via [PR #76](https://github.com/ShamanOrWhitch/BCM4StarAtlas/pull/76) as main commit `65df7b29b7e0ab7a139cbf691f41ad103b0d8ba2`; issue [#74](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/74) is closed.
- Retains main's 0.11.13 Warp depth staging, real frame-start collision sampling, swept asteroid collision, Ring entry recovery, and Panda presentation.
- Changes: Room 1/Room 2 collision planes only block at the actual finite wall/cap intersection; Room 1 recovery is limited to the physical corridor cross-section; Room 2 rear exit remains open; asteroid exit-to-map keeps the current ship pose and V opens next-destination navigation; cache version 0.11.14.
- Added source regression cases for free-space X/Y/Z crossings, solid corridor wall/cap crossings, Room 2 rear exit, and asteroid -> map pose handoff.
- **CI status:** Mini-Sim regression, Warp maze return, Warp visual tiers, UI layer, Ring controls, Tower top-cap, bilingual copy, UI/weapons/cabin, and packaged test build passed on the merged commit. Browser smoke remains unverified: the runner has stalled in Playwright setup; earlier runs got HTTP 403 before the game root. No visual PASS or production deployment is claimed.

---

## Mini-Sim 0.11.13 repair candidate — 25 October 2026

- **Branch:** `fix/minisim-0.11.13-warp-depth-room-collision-ring-entry`, based on main `ab7c3d91c9932d3363375036bb07bbcbd6ad67ad` (0.11.12 / Tower 0.2.65).
- Warp: revert the visible obstacle window from 0.68 to 0.36 of the remaining course and restore the prior perspective projection so nearby gates are staged instead of crowding the screen; the HUD now reports the actual speed multiplier used by tube travel, not the abstract ramp.
- Room 1/2: collision now receives the true frame-start ship position. Previously `collide()` cloned the position only after integration, so its before/after crossing checks compared the same coordinates and could not catch a fast wall crossing. Wall-correction flags compare the attempted post-step position against the corrected position.
- Asteroid/Ring: do not permanently unset the shared Warp frame/poll/render handlers after one transient exception (that also removes asteroid collision); Ring entry failures are caught, the overlay is cleaned up, and a manual retry is made available without automatic retry spam.
- Panda dialogue enlarged further: 900px desktop cap, 80px avatar, 19px message; mobile keeps a large avatar and readable message.
- **Not deployed.** CI/source checks pending. Live browser remains blocked by HTTP 403 before `.bcm-mini-sim`. Do not claim visual PASS or bypass the firewall. `wordpress/galia-desk` is out of scope.

## Historical Mini-Sim 0.11.12 repair candidate — 25 October 2026

- **Branch:** `fix/minisim-0.11.12-warp-speed-collision-ring`, based on main `9caba968636610a2413a23177bd9d64f20fe0900` (Mini-Sim 0.11.11 / Tower 0.2.65).
- Focused repairs: Warp multiplier corrected to 1×→8× and displayed in the tunnel HUD; the initial Panda flight prompt explicitly includes `V — карта Warp`; Panda's bubble is wider, right-aligned, with 15–17px message text; asteroid swept collision resolves a frame beginning inside the expanded wall AABB; Ring entry stays armed if engine runtime is unavailable.
- User reports 0.11.8 is still the best-feeling build. This candidate preserves later mission and Ring content while attempting targeted repairs instead of silently rolling back the whole plugin.
- **Not deployed.** CI/source checks pending. Live browser verification is blocked by HTTP 403 before the game container; do not call this a visual pass or bypass the firewall.

## Candidate Mini-Sim 0.11.11 — Warp visibility and Panda controls (25 October 2026)

- **Branch:** `fix/minisim-0.11.11-warp-panda-prompt`; **WORK LOCK:** [Issue #70](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/70).
- **Baseline:** main `bc77614564aa7bf1f2a211c945006fc258d6aeff` (Mini-Sim 0.11.10 / Tower 0.2.65). The original candidate PR #71 was merged into main; it was not deployed to live WordPress.
- Warp regression reported by the user: in 0.11.10, some hazards were no longer readable after their rendering was reduced to two faint longitudinal guide-lines; the tunnel had 24 base strips and Class II extra rails/pulse dots. The candidate returns to 12 base strips, applies modest depth skew, removes the extra Class II rails, keeps decorative circumferential wall rings/chevrons absent, and draws visible segmented gates (with the collision-safe opening), sweepers and spike teeth. The obstacle display window is extended; `updateTube` collision formulas, Warp duration/speed ramp, shimmer timing, soundtrack, navigation and Tower physics are not changed.
- Panda controls: widen the operator bubble to the right; keep Panda visible down to 420px; remove the independent right-side controls card. First-flight copy says WASD, U, mouse look, middle-click release and gamepad sticks. Warp copy says V / gamepad Y and explains mouse drag, A/D/arrows and left-stick steering.
- **TESTED-CODE: PASS** on branch HEAD `dbca3b10bbd5f8598a914527bfe481a38cf59a87`: Mini-Sim regression [run 40198934822](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40198934822), UI layer [run 40198934821](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40198934821), Warp visuals [run 40198934806](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40198934806), Warp course/portal [run 40198934805](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40198934805), Warp maze [run 40198934800](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40198934800), Ring controls [run 40198934803](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40198934803), Hull RU/EN [run 40198934801](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40198934801), Tower cap [run 40198934804](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40198934804). These are code/CI tests, not live visual or hardware verification. Candidate browser QA [run 40198934895](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40198934895) **FAILED/BLOCKED**: the runner received HTTP 403 for `https://walkingyog.com/bcm4sa/` and timed out waiting for `.bcm-mini-sim`; it never reached the game UI. This is not a code/visual FAIL and must not be recorded as a browser PASS. The protection still blocks this GitHub Actions browser request; do not bypass it. No bypass attempt, no production deployment; `wordpress/galia-desk`, scanner and pricing data remain untouched.

## Main baseline before this candidate — Mini-Sim 0.11.10 (25 October 2026)

- Main SHA: `bc77614564aa7bf1f2a211c945006fc258d6aeff`. The latest commit repaired a pointer-lock API name used by a test; Mini-Sim regression and Tower top-cap regression passed on that SHA.
- Browser QA against `https://walkingyog.com/bcm4sa/` still failed with HTTP 403; this is a blocked test, not a visual test of the game.
- No production WordPress deployment or physical phone/gamepad test is recorded.

## Кандидат Mini-Sim 0.11.5 — детерминированная астральная физика
- Основа: кандидат 0.11.4 / Hydrogen mission (PR #66), исправления 0.11.3 (PR #65); Tower обновлён до 0.2.65, чтобы сбрасывать кэш seed-снимка. Ветка minisim-0.11.5-astral-phase, не слита и не развёрнута.
- Для каждой клетки Y-слоя режим вычисляется отдельно от RNG маршрута — по seed астероида и координатам клетки. Одинаковый seed даёт тот же режим и фазу.
- Три режима: Drift (низкая гравитация), Flux (ограниченный пульс гравитации без инверсии), Dense (более сильная гравитация). Карта и HUD показывают различия. Двери, проходы, позиции кристаллов и порядок случайного генератора не меняются; существующие текстуры переиспользуются.
- 0.11.4: после фактического воспроизведения всех настроенных экранов оператор открывает задачу Hydrogen; сбор находится в первой малой клетке того же Ring seed.
- Для будущего возврата: перед freeze Tower сохраняется снимок корабля, а активный Tower seed записывается в `BCMWorldMission`; это основа, не готовый возврат. Tower-часть теперь 0.2.65.
- Не готово: город под Tower + возврат вверх по тому же Tower seed (issue #67); более глубокие взаимодействия астральной фазы (issue #68 — первый слой физики реализован здесь, нужны тесты и доработка по результатам игры).
- Camera: явно выбранный экран сохраняет приоритет над другими роликами и не теряет фокус только потому, что нет ближайшего внешнего видео. Фокус снимается при выходе цели из радиуса/недоступности; HUD показывает прогресс экранов и сбор Hydrogen.
- CI: после открытия PR должны пройти исходные и регрессионные тесты. Production Browser QA получает 403 от firewall; физическое управление и видимый рендер на телефоне не подтверждены.

## Historical snapshot — Mini-Sim 0.11.8 (24 October 2026; superseded by main 0.11.10)

This entry supersedes the older 0.11.3–0.11.5 candidate notes below; those sections remain as history, not as the current state. Current code is on `main`; Tower remains `0.2.65`. **Nothing has been deployed to the website.**

- Warp: Class II has subdued visuals; Class III has a distinct purple shell and ribs; Class IV is disabled. Solid circular obstacle hoops were removed, along with the extra `>` chevron and launcher loop marker. Tube collision and steering should remain independent of visual class.
- Ring: the room graph has a BFS route to the large arena. At blocked doorways a transition selects an available step toward the arena; the action control uses the route hint. Each player retains a separate logical room, with split-screen when they occupy different cells.
- All three bosses now have recognisable pig silhouettes built from existing Three.js primitives (body, snout, ears, nostrils, tusks, legs and tail); no new image or texture assets were added. The weakpoint is in front of the head so the snout does not hide it.
- Source/regression checks, UI-layer checks, Tower top-cap checks, and the test ZIP build passed on the current code. Browser QA did not verify rendering: `https://walkingyog.com/bcm4sa/` returns HTTP 403 before the game container appears. Do not bypass the firewall or report this run as a visual test.
- `wordpress/galia-desk` is untouched. No production deployment was made.

## Предыдущий кандидат Mini-Sim 0.11.4 — Hydrogen mission
- Основа: PR #65 / candidate 0.11.3 поверх main 0.11.2, Tower остаётся 0.2.64. Ветка `minisim-0.11.4-hydrogen-mission`, не слита и не развёрнута.
- Диалоги оператора учитывают экраны только после реального `playing`; каждый настроенный экран засчитывается один раз. После последнего экранного триггера появляется цель: найти Hydrogen в первой маленькой ячейке Ring.
- Hydrogen размещается в ячейке `maze.startCell` того же seed-графа, отмечается буквой H на карте, собирается один раз; событие обновляет журнал миссии и операторский диалог.
- Bearhead пока опционален: если `mini-sim/assets/bearhead.mp4` нет, используется ✦.
- Не сделаны в этом патче: anomalous astral phase beyond current Y-layer gravity/tint, город под Tower и обратный подъём по тому же Tower seed к исходному кораблю. Сцена Mini-Sim сейчас уничтожается на Tower handoff; сначала нужна отдельная схема park/resume или сохранения состояния.
- Кодовые CI проверки нужно выполнить на актуальном коммите. Удалённый браузер сайта получает 403 от firewall; production-визуальная проверка недоступна без нормального доступа.

## Предыдущий кандидат — Mini-Sim 0.11.3 (bugfix branch)
- База: main Mini-Sim 0.11.2, Tower 0.2.64. Ветка `minisim-0.11.3-ring-texture-focus`; пока не влита и не развёрнута на WordPress.
- Ring: у каждой стены астероида теперь сохраняется владеющая клетка; 3D-стены и 2.5D-карта используют `wallAsset` и `wallTurn` этой клетки. Выбор внешнего вида детерминирован отдельным потоком от seed, который строит маршрут и кристаллы.
- Crew: общая `BCMCrewCore` исправляет разворот не-Mierese, сохраняя ориентацию Mierese. Ветка ещё требует регрессионного теста/визуального подтверждения.
- ONICSS: загружает `onicss.mp4` в пределах настроенного preload radius; пока видео не начало воспроизводиться или при ошибке видна `OniStation.png`, а не пустая чёрная плоскость. X снимает фокус камеры, если он активен и не открыт Ring/Hull.
- Диалог оператора может использовать `mini-sim/assets/bearhead.mp4`, когда файл появится; до этого остаётся значок ✦.
- Ещё не реализованы: Hydrogen в стартовой клетке и цель после посещения всех экранов; полноценное астральное измерение; город под Tower и возврат по тому же seed. Это следующие этапы, не часть текущего патча.
- Проверки GitHub/WordPress: статические и CI проверки ожидают запуска после открытия PR. Живой Browser QA через сайт сейчас блокируется ответом 403 от firewall; визуальное поведение на телефоне не подтверждено.

## Предыдущий этап — Mini-Sim 0.11.1
- База: 0.11.0 (Room 1, механики 0.9.113). Кэш **0.11.1**.
- Снаружи: V — Warp, U — трюм. В трюме штурвал — X, кнопки без букв. Полёт клавиатурой на десктопе только вместе с захватом мыши.
- Кольцо строится из клеток астероида и его текстур. Арена боссов — одна большая клетка. Метки кристаллов ставит пролёт корабля. Респавн мобов 4 минуты. Спрайты — вырез `BCMCrewCutout`.
- Это не деплой WordPress и не физический тест телефона.

## Предыдущий этап — Mini-Sim 0.11.0
- База кода: механики **0.9.113** (PR #59, коммит `c9d90ec`). Старт снова **Room 1** `(0, 0, 2)`, без автотелепорта в астероид. Версия кэша **0.11.0**.
- 0.9.114 (cutaway Ring и переназначение кнопок) снята с роли рабочей базы. Ручной прогон той линии не прошёл: V не открывал Warp, U не вёл в трюм.
- Снаружи трюма: V — Warp, U — трюм. Корабль ведёт тот, кто у штурвала; трюм полёт не паузит.

## История этапа 0.9.114 — не база
- Main baseline: Mini-Sim 0.9.113 / Tower 0.2.64 (PR #59). Candidate branch: fix/minisim-0.9.114-ring-cutaway-controls. Flight start remains normal; the ship is not auto-teleported into the asteroid maze.
- Ring Maze is restored from the active 3D maze graph: cells/open passages/stairs, the same seed, entry/exit and three crystals. Linear boss arenas and generated comic backdrops are removed.
- Ring surfaces clone existing maze materials and reuse their texture maps. Cleanup may dispose cloned materials but not textures owned by the active asteroid maze.
- Objective: collect the three crystals and return to the entry. Small seeded mobs patrol cells and can be shot; they do not block completion.
- Controller: X/button 2 fires, Y/button 3 does not. Back/Select exits Ring and returns home outside gameplay overlays. B does not return home; it resets the current room outside overlays, and its Hull Dive action remains available inside.
- Hull Dive releases Pointer Lock on open so mouse interactions work; exterior ship physics continue. CI and code checks are not a physical controller or WordPress test.

## История состояния — 21 октября 2026

- **Актуальный main:** Mini-Sim **0.9.112**, Tower **0.2.64**. Merge commit PR [#57](https://github.com/ShamanOrWhitch/BCM4StarAtlas/pull/57): 443cd4f1cd388d020f1811908f1d31ad53809334. Asset/cache version и стартовые заголовки синхронизированы на 0.9.112. Hull Dive оставляет внешний космический вид работающим под inset, стартует с активным штурвалом; кнопка входа в кабину вынесена на верхний слой документа. Отдельная кнопка Ring доступна рядом с маяком, меню уровня принимает мышь/касание, клавиатуру и gamepad A. Добавлен hit-test аудитор: Ctrl+Alt+U.
- **Проверки PR #57 — PASS:** Mini-Sim regression [39602967437](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39602967437), Ring menu [39602967350](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39602967350), UI layer audit [39602967364](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39602967364), Hull RU/EN [39602967454](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39602967454), Warp visuals [39602967418](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39602967418), Warp return [39602967560](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39602967560), browser smoke [39602967382](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39602967382). Это TESTED-CODE, не физический тест телефона/gamepad и не подтверждение WordPress deploy.
- **Управление Ring:** PR #46 исправил подтверждение SINGLE/MULTI до создания персонажа: клавиатура E/Enter/Space, стрелки/A-D, D-pad/стик и A/Start на gamepad, касание на телефоне. Автотест прошёл; физический контроллер ещё не подтверждён.
- **Warp visual classes:** X-Small/default — стандартная труба; XX-Small — спиральные бирюзово-янтарные рельсы; III/IV — отдельные визуальные прототипы. I/II/III/IV доступны в мини-селекторе Tube. Реальный Warp Drive slot из Galaxy API пока не подключён — класс не является достоверно прочитанным NFT-компонентом.
- **UI и Hull Dive:** два прозрачных диалога-комикса оператора/управления RU/EN; Crew-портреты увеличены. В 0.9.112 Hull Dive немного увеличен, но остаётся адаптивным для узкого viewport; космический рендер продолжает работать сверху, а штурвал активен для Crew 1 при старте у пилотского места. Gamepads назначаются по индексу: один контроллер — P2, два контроллера отдельно управляют P1/P2. Не подтверждено физическим контроллером или телефоном. Дым/пузырьки работают из ограниченных пулов и становятся заметнее по уровню опасности. Графика пробоины/энергии использует холодные космические цвета.
- **Ring weapons:** прототипы — быстрый тонкий laser pointer, более толстый pulse и меняющий цвет spectrum. Мастер предлагает выбор после первого побеждённого босса; тест улучшения предлагается после каждых двух успешных завершённых пробегов между предложениями. Прогресс хранится в памяти вкладки и пока не переживает перезагрузку. Баланс и попадания требуют игрового теста.
- **Split-screen:** в Ring раздельные виды горизонтальные: P1 сверху, P2 снизу, когда игроки достаточно разошлись. Локальная игра не зависит от сети.
- **Network prototype:** PR #52 добавил серверный in-memory room registry и ограничения памяти/клиентов с независимыми локациями. Это **не live multiplayer**: WebSocket, аутентификация, scheduler, RTT и reconnect ещё не реализованы. Следующий этап — Issue #48.
- **CI на коде PR #55:** Mini-Sim regression PASS — [39567055498](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39567055498); Hull RU/EN copy PASS — [39567055354](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39567055354); Warp visual tiers PASS — [39567055312](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39567055312); UI/weapons/cabin PASS — [39567055331](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39567055331); Tower top cap PASS — [39567055392](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39567055392); browser smoke PASS — [39567055334](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39567055334). Browser QA did not run the video-enabled step; no physical Android/gamepad validation or production WordPress deployment is implied by these checks.
- **Таймауты:** browser QA job — 45 минут; отдельные install/media steps — 20–25 минут; regression/source jobs — 25–30 минут; page navigation wait — до 60 секунд.
- **Жёсткое исключение:** не трогать wordpress/galia-desk, scanner, marketplace/pricing data и их общие assets. Не менять расположение планеты, SAGE navigation adapter или глобальный микшер без воспроизводимого регресса.

**Важно:** версия 0.9.112 уже в main, но файлы необходимо проверить/обновить на реальном WordPress. Browser QA не заменяет игру с реальными контроллерами.

Исторические записи и причины предыдущих исправлений ниже сохранены.

 Их наличие в журнале не означает, что они остаются открытыми задачами.

## Закрытый дефект: внешний shell / liquid-metal texture cycle (Issue #32)

- Репорт пользователя 2026-10-14: периодически меняющаяся внешняя оболочка снова перестала менять текстуры; оптимизация не должна убирать задуманное визуальное поведение жидкого металла.
- Baseline main: `c01cec1e6776b53192c15b3027e0240f3ed27a45`; WORK LOCK: [Issue #32](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/32); branch: `fix/exterior-shell-texture-cycle`.
- Root cause в main: shell использовал `allUrls.slice(0, 4)` и удалённые вызовы `randomizeBackside()` / `updateBacksideCamouflage()`; source-contract тест требовал отсутствия циклирования. Историческая рабочая реализация имеется в commit `0fc809c2597debee629fecb0c25dd4ab370d65f9`.
- В текущей ветке desktop снова использует весь набор внешних `back*.png`; touch-landscape сохраняет limit 4 и существующее уменьшение изображений. Материалы внешних панелей меняются индивидуально по таймерам около 0.8–3.0 s, с повторным stagger при появлении оболочки. Цикл исполняется только при видимой внешней оболочке. Интерьер Room 1/2, геометрия и физика не меняются.
- Mini-Sim cache version в main: 0.9.86. Статус: MERGED / TESTED-CODE. Post-merge regression run 38471956269 прошёл. Предыдущий browser smoke с тем же runtime-кодом прошёл в run 38471671934; run 38471956003 был ещё в процессе при последней сверке. Ни один из этих smoke tests не доказывает визуальную правильность текстурного цикла. VERIFIED-LIVE / USER-CONFIRMED не утверждать до установки файлов на WordPress и визуального теста.

## Проверенные факты репозитория

- WordPress shortcode симулятора — [bcm_mini_sim]; для Tower используется отдельный PHP-модуль. Three.js r128 уже встроен в Mini-Sim: не добавлять второй WebGL-контекст или CDN.
- Перенос коммита в GitHub не развёртывает плагин на walkingyog.com. После merge отдельно подтвердить фактическую cache-версию сайта.
- GitHub Actions browser QA подменяет JS/CSS выбранного коммита в сессии тестовой страницы. Это полезная проверка нового кода, но не доказательство production deploy или проверки батареи на Android.
- Mini-Sim использует реальный элемент VideoTexture для внутреннего видео. Не добавлять дублирующие видеодекодеры без необходимости.
- Warp/Tube и астероидный лабиринт остаются локальной аркадной симуляцией: сами по себе не перемещают настоящий флот в SAGE и не меняют блокчейн-состояние.

## Непереговорные требования пользователя

### Музыка

- `starbase` — soundtrack всей первой локации у ONI CSS, включая Room0 и Room1.
- `tower` — только во время уровней Tower.
- `warp` — экран Warp, труба и астероидный лабиринт. Пока отдельный трек астероидов не предоставлен, Warp OST продолжается на всём этом участке. Не придумывать новый OST и не дробить его без запроса.
- **Никогда не проигрывать два OST одновременно.** Переход зоны обязан сначала снять активность с предыдущего трека, затем включить нужный.
- Кнопка-нотка — единый глобальный переключатель музыки. В состоянии OFF все игровые OST остаются выключены; кнопка должна показывать перечёркнутую нотку/понятное состояние. Переход в другую зону не должен игнорировать mute.
- Нажатие A само по себе не должно запускать Tower OST. Проверить обработчики кнопки и состояния переходов.

### Возврат и переходы

- **USER-CONFIRMED, 2026-10-17:** возврат из астероидного лабиринта к карте текущего сектора работает. Это закрытая задача; не возвращать прежний сектор и не выполнять автоматический сброс на ONI CSS.
- Не объединять возврат к карте, возвращение домой, перезапуск текущей зоны и выключение музыки в одну операцию.
- Обычный возврат из Room0 к началу Room1 и Starbase OST считать существующей реализацией; не менять его в рамках 0.9.93 без нового воспроизводимого сбоя.
- Отмена Warp должна сохранять точку вылета и не переносить остаточный ввод/вращение.

### Управление полётом

- Поворот на gamepad должен быть существенно более отзывчивым, но без дрожания/самопроизвольного вращения.
- В коридоре вертикальное движение должно учитывать локальную систему коридора: его текущие пол и потолок, а не только мировую или стартовую ось.
- Не допускать прилипания/магнитной фиксации к полу или потолку. При смене участка не должно быть скачка осей, неконтролируемого roll или сохранённого ввода, который раскручивает корабль после Warp.
- Не менять управление открытого космоса случайным образом ради настройки коридора; тестировать отдельно коридор, астероидный лабиринт и выход в космос.

### Геометрия и материалы Room0/Room1

- Полезное изменение из прошлой итерации: текстура левой стены больше не должна случайно заменяться другой 2–3 раза. Не возвращать таймерную/случайную смену этой текстуры.
- Не менять текстуры первой локации без прямого запроса. Правая стена Room1 с её существующим MP4-поведением — отдельный намеренный случай; не переносить его на левую стену.
- Не менять геометрию комнат ради исправления текстуры.
- Не восстанавливать предложенную ранее модель внешней обшивки: пользователь отдельно уточнил, что именно ту модель возвращать не нужно. Состояние других внешних поверхностей не считать согласованным на новую переделку — сначала исследовать, что именно менялось, и ограничить патч.

## План этапов — актуально 2026-10-17

### P0 — Контекст и рабочий процесс
**Завершено.** Сверять Git историю, версии, WORK LOCK и Actions перед изменениями. Не считать старые упоминания задачи признаком того, что она всё ещё открыта.

### P1 — Возврат и soundtrack
**Функционально закрыто по пользовательскому подтверждению.** Текущий сектор возвращается корректно; не менять реализацию в мобильной ветке. Отдельные проверки исходников/тестового workflow не превращать в повторное пользовательское требование.

### P2 — Мобильное управление и загрузка
**В main, TESTED-CODE + browser smoke; физический тест Android ещё нужен.**
- Загрузка: ближайшие стены → видео правой стены → портал; soundtrack сохраняет высокий приоритет.
- Warp Tube: компактный HUD, управление наклоном телефона с перекалибровкой, умеренное осевое вращение.
- Deep Space: drag вокруг зафиксированного экрана.
- Tower: единый Pointer Events путь на современных телефонах, скрытый P2 не перехватывает экран, tilt P1 немного снижен.
- Автоматические проверки не доказывают работу прыжка и P2 на физическом телефоне; не считать их live-verified до проверки пользователем.

### P3 — Карта SAGE для Warp
**Реализовано в main через PR #85; полное покрытие галактики ограничено данными адаптера.** В меню Warp есть 2D-плоскость SAGE X/Y (−50…50), ориентиры из реального snapshot, текущий сектор, доступные по данным адаптера переходы, выбранный маршрут и масштаб 1×/2×/4×/8×.
Локальный 3×3 preview содержит все 8 направлений, включая диагонали, и явно маркируется как test-only. Слой локаций различает реализованный астероидный комплекс у ONI CSS, планеты с незавершённой привязкой запуска и категорию Deep Space.
Issue #28 остаётся открытым только для полной географии всех секторов: 8,177 — число аккаунтов, а не набор координат; отсутствующие координаты/связи не выдумывать.
### P4 — Warp / Tube
Текущая трасса длится 48 секунд, имеет несколько типов препятствий и явное подтверждение прохождения. В рамках P2 исправляются только свежие отчёты о roll/HUD/phone tilt. Не переделывать повторно геометрию кольца, навигацию или возврат без новых доказательств.

### P5 — Проверка и развёртывание
- Source regression workflows — быстрый шлюз для проверок кода. На известном неизменившемся маршруте Browser QA, который получает HTTP 403 до игрового контейнера, фиксировать BLOCKED-ENVIRONMENT, а не PASS/FAIL игры; не повторять без изменения условий доступа или альтернативного маршрута.
- Слияние исходников и проверка production — разные статусы. Зелёный CI не означает WordPress deployment или проверку на телефоне. Не обходить firewall; подтверждение live/device отмечать только после фактического теста.
## Активные и закрытые направления

- **Активно:** Issue #28 — полноценная SAGE карта.
- **Закрыто после merge PR #38:** Issue #30 (медиа-приоритеты, вращение Warp Tube и новые мобильные исправления).
- **Закрыты как выполненные:** Issue #21 (глобальный mute), #22 (переход Tower SINGLE на весь экран), #24 (возврат к карте текущего сектора), #26 (крышка H1).
- Issue #17 остаётся отдельной задачей автоматизации браузерного сценария Room0 → B → Room1 + global mute; это пробел тестового покрытия, не заявление о текущей поломке функций.
- Пользователь подтвердил, что остальные прежние функции работают; единственная крупная отсутствующая функция — полная карта SAGE.
- Историю Crew names, глобального soundtrack/mute, planetary placement, shell texture cycle и Warp collision не реализовывать заново без конкретного воспроизводимого регресса.

## Шаблон передачи следующему агенту

```text
Прочитай mini-sim/AGENTS.md и mini-sim/PROJECT_STATE.md.
Работай только над активным этапом: [ID].
Симптом/цель: [одна конкретная задача].
До изменения найди точные обработчики и перечисли файлы, которые нужны.
Не исправляй соседние этапы и не меняй согласованное поведение.
Добавь/обнови проверку, сделай минимальный патч, выполни доступные тесты.
После теста обнови PROJECT_STATE.md: результат, SHA, что проверено и что нет.
```

## PR and test tracking
- PR #60: https://github.com/ShamanOrWhitch/BCM4StarAtlas/pull/60
- CI results are pending; do not label 0.9.114 live-verified until the required Actions and a manual WordPress/device test complete.


## Текущий статус после merge PR #85 — 2026-10-27

- **Интеграция:** PR [#85](https://github.com/ShamanOrWhitch/BCM4StarAtlas/pull/85) слит в main. Merge commit: [fa88cb0ae06ab0d534994cc3df6420075db902e9](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/fa88cb0ae06ab0d534994cc3df6420075db902e9). Файлы на GitHub main проверены повторным чтением; WordPress не развёрнут.
- **Карта:** настоящая координатная плоскость SAGE, известные snapshot-звёзды и три CSS, текущая позиция, доступные переходы из навигационного адаптера, выбранный маршрут, zoom 1×/2×/4×/8×. Секторный preview содержит все восемь направлений. Location layer объединяет и дедуплицирует поддерживаемые массивы адаптера; ONI asteroid complex помечен реализованным, Akenat/Pearce/Ioki требуют привязки запуска, Deep Space показан отдельным типом. Полная отрисовка всех 8,177 секторов возможна только после получения фактических координат.
- **Остальные изменения PR #85:** Ring crystal progress guard, возврат к цели перед завершением лабиринта, исправления Warp-меню и pointer lock, Room 2 passage, разгон Warp до 12× с 22 слоями препятствий и обратный поток Class II. Tower physics не менялась.
- **TESTED-CODE:** 9/9 source regression workflows PASS на PR code head [4e4841a912377856a274eb089e9965e7e6c79996](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/4e4841a912377856a274eb089e9965e7e6c79996). Результаты: [Warp visual tiers](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40488604832), [Warp maze return](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40488604529), [Mini-Sim regression](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40488604765), [UI layer](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40488604772).
- **BLOCKED-ENVIRONMENT, не browser PASS:** [browser run 40488604679](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40488604679) получил HTTP 403 и не обнаружил .bcm-mini-sim. Это недоступность страницы для данного runner, а не проверка поведения игры. Известный тот же путь повторно не запускать без изменения условий доступа; firewall не обходить.
- **Не VERIFIED-LIVE:** нет подтверждения WordPress deployment, визуальной проверки на реальном production-браузере или ручного теста на телефоне/геймпаде. Эти статусы не назначаются автоматически по результатам CI и не требуют повторять тот же заблокированный маршрут.

### Протокол отсечения ложных путей
1. До теста определить, какой факт он должен подтвердить и что будет достаточным результатом.
2. После детерминированного HTTP 403 на том же URL не повторять идентичный browser smoke. Продолжать через source, локальные контракты и CI; повторять remote QA только при изменении доступа или тестового маршрута.
3. После 404 NOT_FOUND проверить имя владельца/repository, branch и path один раз; исправить найденную опечатку вместо перебора внешних путей.
4. При таймауте пометить TIMEOUT, записать, что именно не завершилось, и перейти к следующей независимой проверке. Не ждать рецензента/агента сверх рабочего лимита; ставить SKIPPED/TIMEOUT, а не PASS.
5. Не завершать работу только передачей задачи в новый чат. Перед handoff зафиксировать фактические изменения, проверки, блокеры и следующий конкретный шаг.
6. Разделять IMPLEMENTED, TESTED-CODE, BLOCKED-ENVIRONMENT, VERIFIED-LIVE и USER-CONFIRMED. Source CI не доказывает production deployment или проверку на физическом устройстве.
