# BCM4StarAtlas / Mini-Sim — актуальная передача

## Candidate Mini-Sim 0.11.21 — user playtest stability

- Current follow-up: draft PR [#86](https://github.com/ShamanOrWhitch/BCM4StarAtlas/pull/86), branch `fix/minisim-0.11.22-warp-flow-bands`, based on current main `e1b46b6da1bf54a6d775732cfa3d23f694c19bd5`. PR #85 already merged the 2D SAGE map/stability work; this follow-up is only the Warp flow visual correction.
- User confirmed Ring entry and external backside doors work on 0.11.19/0.11.20; Ring is improved but remains rough. Hydrogen count, Room 2 return, explicit floor interaction and Tower instructions remain active fixes. New Warp playtest direction: preserve all 22 layers and the randomized obstacle mix; keep the 12x acceleration; use 14 moving horizontal/circumferential wall bands as the flow cue (Class II into depth; Classes I/III toward the ship); remove the added short axial streaks; keep menu cursor/keyboard/gamepad selection usable without Escape.
- Controls contract: Space/W only jumps; E follows the open door; R changes floor at a vertical hatch; gamepad A jumps, X uses the door, LB changes floor, Y fires and B dashes.
- Warp course: restore the 22-layer randomized gate/sweeper/spikes/boost/launcher mix; do not cut layers to reduce repeated-looking visuals. Speed uses a shared collision/visual progress curve, accelerating sooner from 1x to 12x. The 14 horizontal/circumferential wall bands show flow: Class II moves deeper; Classes I/III move toward the ship. The added short axial streak overlay is removed. Warp map opens with pointer lock released and an initial focused choice; use arrows/Enter or gamepad navigation. Galaxy panel is a real X/Y coordinate plane (−50…50), using all valid sector positions if the live adapter supplies the full array, plus the checked-in 54 star references and MUD/ONI/Ustur CSS coordinates. The static snapshot records 8,177 sectors but not all 8,177 coordinates; when the adapter lacks them, mark the global point layer as partial rather than fabricating sectors. Highlight current and Warp-connected sectors and the selected direct route. A sector detail layer separates asteroid complexes, planets/Tower surface gameplay and visually distinct Deep Space mechanics; add specific local points only when known or received from sector metadata.
- No WordPress upload. Network mode is deferred until local play and ship/reference identity are stable. Remote browser QA gets HTTP 403; don't bypass the firewall.
- CI/source validation is pending; no live browser/device pass is claimed.

---


## Mini-Sim 0.11.20 — landing clip, then the same asteroid on foot

- The first Panda line is flight and screens. Screens turn on by flying up to them. The V / Warp button is only in the next line, after the screens have played. V is Warp, not a screen switch and not the hold.
- Flying into the gold ring plays the landing clip (`ringgummy.mp4`) through. When it ends, or when the pilot presses ENTER THE RING, the Ring menu opens. The clip is not cut at two seconds and is not skipped by tapping the picture.
- The side view is the same seeded asteroid: each cell shows that cell's asterwall texture and turn, and the arena backdrop uses those textures too. It is a landing, not a different place.
- The open door faces the next Hydrogen crystal, then the way back to the landing cell. A vertical step is jump or E at the glow. E follows that route instead of turning into a side spur. Sometimes one cell on the way has a boss; shoot it, then the door opens. The pig arena is optional. Every seed can be finished by collecting the crystals and returning to the start.
- Version `0.11.20`. Tower stays `0.2.66`. WordPress does not update until the plugin from main is installed.

## Mini-Sim 0.11.19 — Ring level stays open, Warp cancel stays on the asteroid

- 0.11.18 (PR #81) is already on main. Its 2.2s video watchdog made Ring worse: the clip aborted and the level threw (`MeshBasicMaterial` has no `emissive`), so the asteroid was restored and the ring maze never stayed up. The maze frame also threw `updateCrystalPickupEffects is not defined` before the approach check, so flying into the ring never opened it.
- V is Warp, not the hold. U opens the hold. X is the helm. Automatic approach, the Ring button, and gamepad A open the ring level directly. The intro clip is no longer a gate and is not cancelled at 2 seconds.
- Opening Warp on the asteroid no longer deletes the rock. Cancel returns to the same asteroid coordinates. The place is named `ASTEROID · X / Y`, not Room 1 (z ≈ 150 used to look like Room 1).
- Flight envelope is `flyRadius: 160` so the ship can orbit the asteroid and its satellites. Wall-contact damping stays 0.15, two-pass overlap, radial slowdown 0.25. Room 2 walls stay solid. Tower physics untouched.
- Version `0.11.19`. WordPress does not update until the plugin from main is installed.

## Merged candidate 0.11.18 — Ring door, cell maze, phone panda

- Ring intro no longer sits under Panda. The entrance card is above the dialogue, any tap or the ENTER THE RING button starts the level, and a stalled clip gives up after a short watchdog instead of leaving the pilot on black.
- The Ring view uses the flight canvas size and restores that viewport when the run ends, so the cell maze is not drawn off the screen. The first door faces the route to the large arena. A cell shows “walk through the open door / E turns” instead of a boss-arena caption. One bad frame does not kill the loop.
- Panda at flight start on a phone explains tilt, tilt calibration reset, and tapping a silent music screen. Keyboard flight keeps WASD and a V button that runs the same Warp action as the V key. When Panda talks about Warp, keyboard gets that V button and a phone gets WARP. The asteroid exit label is WARP on a phone, still “СЛЕДУЮЩИЙ ПЕРЕХОД · V” on a keyboard.
- Version `0.11.18`. Do not touch asteroid physics, backside doors, Tower physics, Room 1 start, V = Warp, U = hold, X = helm. No WordPress upload from this change. WordPress keeps the previously installed plugin until that package is updated.

## Historical handoff — Mini-Sim 0.11.17 / Tower 0.2.66

## Merged main 0.11.17 / Tower 0.2.66 — Ring recovery and concise controls

- PR [#80](https://github.com/ShamanOrWhitch/BCM4StarAtlas/pull/80), merge commit `d821764610890e84970ba20b354e90e41d1cc6cf`.
- Ring setup now commits the scene handoff only after successful world/input/render setup. Failure paths restore asteroid/ship visibility and previous background, remove partial Ring scene children and expose a retry. This is source-verified, not yet confirmed by manual playback on WordPress.
- Tower copy is split by keyboard/mouse, touch/tilt and gamepad. Controller text updates by Single/Multi and number of gamepads. Objective is short; five-landing fall-to-start warning is persistent.
- Versions: Mini-Sim `0.11.17`; Tower `0.2.66`. No WordPress upload. Source regression workflows pass on PR head `1097fe4b528cfc7695e4df85b76812f545e00803`; browser smoke was still in progress when this note was written.
- Keep the previously agreed asteroid physics and backside shell doors from PR #79 untouched.

## Historical handoff — Mini-Sim 0.11.16

## Superseded merged main 0.11.16 — asteroid rollback + approach-triggered backside doors

- PR [#79](https://github.com/ShamanOrWhitch/BCM4StarAtlas/pull/79), merge commit `07ed389df12a491d987d47507bc42a1d97559af5`.
- Asteroid physics restored selectively to the 0.11.2 collision/contact/radius behavior. Do not restore the whole old `deep-space-warp.js`: later Warp/Ring/Hydrogen features were kept.
- `backside*` outer-shell panels all open by proximity at the corresponding footprint; overlapping/adjacent panels must all reach `OPEN` before passage. Room 2 side/front corridor walls stay solid. Both directions through the Room 2 rear cap require the real open door.
- Mini-Sim source version: `0.11.16`. Regression suites are green on tested PR head `a0049580e560babea5d9284ccafbc73e55574e48` (nine workflows). Browser QA remains unverified: host responds HTTP 403 and the page locator `.bcm-mini-sim` times out. No WordPress upload and no manual device/gamepad confirmation.
- Next action only if user reports a reproducible issue: use the specific failed passage/position as a regression test; do not broadly rewrite asteroid physics or make Room 2 walls passable.

## Historical handoff — Mini-Sim 0.11.15

## Superseded merged main 0.11.15 — backside-only Photoli doors, asteroid flight and Hydrogen pickup feedback

- Merged by [PR #78](https://github.com/ShamanOrWhitch/BCM4StarAtlas/pull/78) as `1b00a801f62506917f533ead12d0524f06159802`; issue [#77](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/77) is closed.
- User scope correction: randomized slide / wipe / iris doors are only on the external shell panels using `backside*` textures. Room 2's corridor walls remain solid. No asteroid labyrinth wall doors.
- Open shell passage is gated by the state and footprint of the specific moving backside panel; other panels and the corridor remain hard.
- Wall impacts in the asteroid remove only inward normal velocity, retaining tangential speed. A radius-58 exterior flight envelope removes only outward radial speed at its limit to preserve orbital movement.
- Crystal pickup effect is larger and includes floating `H +1`; mission event/count and duplicate-ID protection are retained and covered by a source-level behavioral test.
- Version/cache bumped to 0.11.15. Source regression suites passed on the merged PR head. Browser smoke has not reached the site because Playwright setup was still running; earlier probes stopped at HTTP 403 before gameplay. No live visual/device PASS or WordPress deployment is claimed. Do not change Galia Desk, scanner/pricing, Tower, common assets or firewall.

---

# BCM4StarAtlas / Mini-Sim — актуальная передача

## Merged main 0.11.14 — free space around Room 2 and asteroid Warp handoff

- Merged by [PR #76](https://github.com/ShamanOrWhitch/BCM4StarAtlas/pull/76) into `main` as `65df7b29b7e0ab7a139cbf691f41ad103b0d8ba2`. Issue [#74](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/74) is closed.
- Preserve the improved Warp appearance and 0.11.13 near-field depth staging unchanged.
- Collision shell changes restrict walls/caps to finite spans. A plane through open space should not clamp the ship; Room 1/Room 2 interior wall collisions remain solid and the Room 2 rear exit still enters space.
- Asteroid -> next Warp map captures the ship's actual current position/quaternion, removes stale teleport back to the original launch pose, and V invokes the destination map while the asteroid maze is active. Ring/Hull controls remain separate.
- Source regression and package-build checks passed on the merged main commit. The latest browser smoke has not reached the game UI; earlier runs stopped at HTTP 403. No live visual PASS or hardware/manual pass is claimed. Not deployed. Leave `wordpress/galia-desk`, scanner/pricing, Tower physics and shared assets untouched.

---


## Current repair candidate — Mini-Sim 0.11.13 (25 October 2026)

- Branch: `fix/minisim-0.11.13-warp-depth-room-collision-ring-entry`; baseline main `ab7c3d91c9932d3363375036bb07bbcbd6ad67ad` (0.11.12 / Tower 0.2.65).
- Warp visibility: restore the old 0.36 obstacle draw window and reciprocal near-field projection. Show the actual multiplier used by `updateTube`, not only `warpSpeedMultiplier`.
- Room 1/2 collision: snapshot ship position before integration and pass it into `collide(previousPosition)`; maintain a separate post-step `attempted` position so normal movement is not confused with wall correction.
- Asteroid collision continuity: transient Warp-frame exceptions no longer permanently remove `BCMDeepSpaceWarpFrame`; input/render exceptions are rate-limited and surfaced. Ring initialization is wrapped in a retry path that cleans partial overlays and restores flight if it fails.
- Panda UI enlarged further (900px desktop cap / 80px avatar / 19px message; mobile portrait 60px).
- **Not deployed.** Source/CI tests pending. Browser QA is blocked at HTTP 403 before the game container; do not call that a visual pass. Do not change firewall or Galia Desk.

## Historical candidate — Mini-Sim 0.11.12

# BCM4StarAtlas / Mini-Sim — актуальная передача


## Historical candidate — Mini-Sim 0.11.12 (25 October 2026)

- Branch: `fix/minisim-0.11.12-warp-speed-collision-ring`; base main `9caba968636610a2413a23177bd9d64f20fe0900` (0.11.11 / Tower 0.2.65).
- Fixes: Warp speed and HUD 1×→8×; V hint in the initial Panda flight prompt; larger right-side Panda dialogue; asteroid sweep resolver handles a frame starting inside the expanded wall AABB; Ring entry remains armed until runtime validation succeeds.
- **Not deployed.** CI pending. Live browser/device verification is **BLOCKED** because remote QA gets HTTP 403 before `.bcm-mini-sim`; no bypass attempted. Galia Desk/scanner/pricing remain out of scope.


## Historical candidate branch — Mini-Sim 0.11.11 Warp and Panda UI (25 October 2026)

- Branch `fix/minisim-0.11.11-warp-panda-prompt`, lock issue [#70](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/70), based on main `bc77614564aa7bf1f2a211c945006fc258d6aeff` (0.11.10 / Tower 0.2.65). PR #71 was merged into main; this historical candidate was not deployed to live WordPress.
- Warp now has 12 gently skewed base strips, no extra Class II rail/pulse overlay, no decorative wall hoops/chevrons, and more visible segmented gates, sweepers and spikes. Hazard draw depth was extended; hit/collision formulas, speed ramp, shimmer clock, audio and navigation were left unchanged.
- Flight/Warp instructions are routed into the Panda operator bubble. Separate right-side controls markup/styles are removed. Bubble width is increased and Panda stays visible at 420px.
- **TESTED-CODE: PASS** on branch HEAD `dbca3b10bbd5f8598a914527bfe481a38cf59a87`: Mini-Sim regression [40198934822](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40198934822), UI layer [40198934821](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40198934821), Warp visuals [40198934806](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40198934806), Warp course/portal [40198934805](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40198934805), Warp maze [40198934800](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40198934800), Ring controls [40198934803](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40198934803), Hull RU/EN [40198934801](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40198934801), Tower cap [40198934804](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40198934804). These are code/CI checks, not live visual/device verification. Candidate browser QA [40198934895](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40198934895) **FAILED/BLOCKED**: GitHub Actions got HTTP 403 on `https://walkingyog.com/bcm4sa/` and timed out waiting for `.bcm-mini-sim`; it did not reach the game UI. Do not report this as a visual failure or PASS and do not bypass the firewall. No WordPress deployment or physical device test is claimed.
- Do not touch `wordpress/galia-desk`, the scanner or pricing data.

## Historical snapshot — Mini-Sim 0.11.8 (24 October 2026; superseded by main 0.11.10)

This entry supersedes the older 0.11.3–0.11.5 candidate notes below; those sections remain as history, not as the current state. Current code is on `main`; Tower remains `0.2.65`. **Nothing has been deployed to the website.**

- Warp: Class II has subdued visuals; Class III has a distinct purple shell and ribs; Class IV is disabled. Solid circular obstacle hoops were removed, along with the extra `>` chevron and launcher loop marker. Tube collision and steering should remain independent of visual class.
- Ring: the room graph has a BFS route to the large arena. At blocked doorways a transition selects an available step toward the arena; the action control uses the route hint. Each player retains a separate logical room, with split-screen when they occupy different cells.
- All three bosses now have recognisable pig silhouettes built from existing Three.js primitives (body, snout, ears, nostrils, tusks, legs and tail); no new image or texture assets were added. The weakpoint is in front of the head so the snout does not hide it.
- Source/regression checks, UI-layer checks, Tower top-cap checks, and the test ZIP build passed on the current code. Browser QA did not verify rendering: `https://walkingyog.com/bcm4sa/` returns HTTP 403 before the game container appears. Do not bypass the firewall or report this run as a visual test.
- `wordpress/galia-desk` is untouched. No production deployment was made.

## Кандидат Mini-Sim 0.11.5 — Astral phase rules
Дата: 23 октября 2026.

Ветка minisim-0.11.5-astral-phase, stacked above 0.11.4 / PR #66 and 0.11.3 / PR #65. Не влита и не развёрнута.

- Y-layer cells derive one of three rules from maze.seed + cell coordinates, independent of route/crystal RNG: Drift (low gravity), Flux (bounded pulsing gravity, never reverses), Dense (heavier gravity). The map glyph and HUD identify the current mode.
- Door graph, cell coordinates, selected wallAsset and wallTurn, crystal positions and large pig/ring exit cell do not change. Existing textures only.
- Tower handoff now captures the arriving ship pose/velocity/navigation and stores the currently built Tower seed in the session. Tower cache version is 0.2.65. City traversal and actual ship resume are still not implemented.
- PR #66: screen playback activates the Hydrogen quest, and the collectible belongs to the first small cell.
- Remaining: city under Tower + same-seed return to arrival ship is tracked in issue #67. Expand the astral layer only after these rules are tested in the game; use issue #68 for the follow-up.
- Explicit camera focus now wins over nearer videos and remains on interior panels even when no exterior zone is nearest; stale focus clears when the target is unavailable/out of radius. The mission HUD shows screen count and Hydrogen collected state.
- CI can validate source contracts and syntax. Remote production browser QA is blocked by HTTP 403 firewall; no phone or visual production test has been verified.

## Previous candidate — Mini-Sim 0.11.4 Hydrogen mission
Дата: 23 октября 2026.

Ветка `minisim-0.11.4-hydrogen-mission`, поверх candidate PR #65 (0.11.3); пока не влита/не развёрнута.

- Экраны регистрируются только при наличии рабочего URL. Счётчик посещений растёт при событии видео `playing`, а не при одном лишь preload. Каждый экран засчитывается один раз.
- После включения всех обязательных экранов оператор выдаёт задачу пройти Ring-лабиринт и подобрать Hydrogen.
- Hydrogen находится в первой малой ячейке из `maze.startCell`, не на большой арене со свиньями. H отмечает его на карте; сбор обновляет миссию и показывает сообщение оператора.
- `bearhead.mp4` подключится, когда будет загружен в Assets; до этого используется ✦.
- Отложено: полное astral-measure interaction, город ниже башни и возврат по тому же Tower seed в исходный корабль. Tower сейчас получает отдельную сцену после уничтожения Mini-Sim WebGL сцены; не притворяться, будто обратный переход уже готов.
- Проверки GitHub: source/CI нужно проверить для последнего SHA. Browser QA на production заблокирован HTTP 403 firewall; не пытаться обходить его, не заявлять визуальный тест.

## Предыдущий кандидат на проверку — Mini-Sim 0.11.3
Дата: 23 октября 2026.

Ветка `minisim-0.11.3-ring-texture-focus`, на базе main 0.11.2 / Tower 0.2.64. Не считать live или deploy, пока CI и проверка после обновления плагина не завершены.

- **Ring Maze textures:** к каждой стене привязана её клетка; реальные 3D-стены группируются по индексу текстуры и повороту клетки. 2.5D-путь использует ту же `wallAsset`/`wallTurn` таблицу и тот же экземпляр maze. Ошибки загрузки обновляют активный список исходных текстур до fallback.
- **Crew:** общая функция меняет facing только для non-Mierese, Mierese оставляет как есть. Tower работает по окружному углу и сохраняет отдельный расчёт отображаемого направления.
- **ONICSS:** статичный `OniStation.png` является постером для плоскости `onicss.mp4` до первого кадра. Preload теперь уважает `preloadRadius`, playback всё ещё выбирается nearest-zone логикой. X снимает только активный cinematic focus, когда Ring/Hull не владеют клавишами.
- **Operator:** окно умеет включить `bearhead.mp4` при наличии файла в `mini-sim/assets/`; пока его нет, остаётся ✦. Автоматически находить файл будет существующий рекурсивный asset index.
- **Отложено:** Hydrogen возле стартовой клетки; квест-триггер после посещения экранов; city under Tower и возврат к исходному кораблю через тот же tower seed; полноценная астральная фаза. Их лучше вести отдельными связанными задачами.
- **Верификация:** CI после открытия PR должен подтвердить синтаксис/source-contracts. Сайт отвечает 403 на remote Browser QA по текущему firewall, поэтому не заявлять, что проверена отрисовка на production или на физическом телефоне.

## Предыдущая рабочая версия 0.11.2
Дата: 23 октября 2026.

- Штурвал в трюме — те же две руки, что и снаружи: клавиатура ведёт тягу и курс, мышь крутит вид, даже когда открыта мини-игра трюма. Мышь над самим окном трюма не перехватывается.
- Серая полоса, которая обрезала полёт до 68%, снята. Вид полный. Внизу слева — приборная панель (скорость, тяга, курс, горизонт), не заглушка.
- Поворот, шаг и падение чибиков живут в `crew-core.js` (`BCMCrewCore`). Кольцо, трюм и башня берут оттуда расу и направление. Новый уровень не описывает это заново.
- Варп: вид I — основной. Виды II и III больше не накладываются друг на друга и приглушены. Полоски на ускорителе и пусковой заменены одной меткой. Вид IV остаётся отдельным тяжёлым вариантом, не стопкой поверх остальных.
- Лабиринт астероида тот же генератор, клетки чуть шире (6.8), пещера не впритык к стенам, рядом два камня другого размера.
- Снаружи: V — варп, U — трюм, X — штурвал. Старт — комната 1. Пушить в том же заходе. galia-desk не трогать.

## Рабочая версия 0.11.1
Дата: 23 октября 2026.

Поверх 0.11.0 (Room 1, механики 0.9.113). Явное исключение от заказчика, не возврат к 0.9.114:

- Снаружи **V — только Warp**, **U / R3 — трюм**. Внутри трюма штурвал садится и снимается клавишей **X** (не V). Кнопки трюма — значки, без буквенных стен.
- Мышь и клавиатура полёта — один двуручный контроль: на десктопе WASD не везёт корабль, пока указатель не захвачен.
- Кольцо: путь из клеток seed астероида и его текстур с поворотом по карте. Арена со свиньями и кольцом — одна большая клетка (выход). Корабль, пролетевший у кристалла, ставит метку на 2D-карте. Вертикальные ходы — астральный слой, не третье измерение сайд-скролла. Мобы выходят с открытых сторон, респавн 4 минуты.
- Спрайты экипажа снаружи: `window.BCMCrewCutout` (тот же вырез, что трюм и башня), не пустой чиби.

Старт по-прежнему Room 1 `(0, 0, 2)`. Трюм полёт не паузит. 0.9.114 не база. PR #14 и #18 не сливать. После механик сразу пушить ветку и PR.

## Рабочая версия 0.11.0
Дата: 22 октября 2026.

Это **0.9.113 от Грока**, возвращённая в main, со стартом снова в **Room 1** `(0, 0, 2)`. Автотелепорт в астероид снят. В 0.11.1 штурвал внутри трюма перенесён с V на X — это отдельное указание, не повод снова менять Warp и вход в трюм.

## Контракт — не изобретать путь заново

- Старт только Room 1. Не вызывать `BCMDeepSpaceWarpEnterAsteroid` из `beginFlight`.
- Платформенный экипаж рисовать уже существующим вырезом (`window.BCMCrewCutout` / `BCMTowerAPI.makeCrewSpriteTexture`), а не новым чиби-пайплайном.
- V снаружи = Warp, U = трюм, X внутри трюма = штурвал. Не возвращать штурвал на V.
- После правки механик сразу пушить ветку и PR в `ShamanOrWhitch/BCM4StarAtlas`. Локальный превью другим агентам не виден. `wordpress/galia-desk` не трогать.

## Рабочая версия 0.9.114 — ОТМЕНЕНА как база
- Main baseline: 0.9.113 / Tower 0.2.64. Candidate branch: fix/minisim-0.9.114-ring-cutaway-controls.
- Ring is a cutaway of the same maze, not a linear side-scroll level. Existing connections, floors, crystals, entrance and exit are reused. Surface materials take textures from the active maze.
- The objective is three crystals and return to entry; minor mobs are hazards/targets, not boss gates.
- Gamepad X fires; Y does not. Back/Select exits Ring or returns home outside overlays. B no longer takes the player home. Hull Dive releases Pointer Lock for mouse input.
- GitHub checks do not establish physical device behavior. WordPress deployment is separate from merging the PR.

Дата: 22 октября 2026.

## Правило для агентов

После любой правки механик мини-сима сразу коммитить и пушить в репозиторий `ShamanOrWhitch/BCM4StarAtlas` отдельной веткой и открывать PR. Не оставлять дифф только в локальном превью: следующий агент и WordPress его не увидят. Чужие зависшие PR #14 и #18 не сливать.

## История PR #59 — Mini-Sim 0.9.113

- Старт полёта сразу открывает уже построенный астероидный комплекс на весь экран. Вход в трюм больше не является дверью на астероид, и кольцо для этого не нужно.
- Трюм не ставит корабль на паузу. Кораблём управляет тот, кто стоит за штурвалом: W/S — тяга, A/D — курс. Сошёл со штурвала — корабль больше не слушает шаг экипажа.
- Из трюма убрано отображение кольца: кабина непрозрачная, иллюминатор наружу закрыт, прицельное кольцо у орудия снято.
- Уровень внутри кольца не стартовал, потому что мир строился в функции, которую никто не вызывал. Меню SINGLE/MULTI успевало появиться, а обработчики клика — нет. Теперь мир создаётся до кнопок. На ролике перехода есть кнопка «СТАРТ УРОВНЯ».

## Историческая запись источника истины

- Рабочая версия симулятора: Mini-Sim **0.9.113**. На момент написания PR #59 main на GitHub ещё был **0.9.112**, SHA 443cd4f1cd388d020f1811908f1d31ad53809334.
- **Не путать:** проверка исходников — не подтверждение ручной игры на телефоне и не деплой WordPress.

## Что есть в 0.9.112

- Стартовый переключатель RU/EN сохраняется в localStorage; Enter переключает язык до вылета.
- Два прозрачных диалога-комикса: оператор/сюжет и подсказка controls по устройству/уровню. Постоянный HUD-инструктаж скрыт в полёте; Ring убирает мелкие угловые подписи во время игры.
- В выборе Crew портреты крупнее, карточки шире, изображения показываются целиком.
- Hull Dive — нижнее правое окно; в 0.9.112 увеличен примерно на несколько процентных пунктов при сохранении viewport limits, а космический рендер продолжает обновляться сверху. Crew 1 начинает с активным штурвалом, поскольку начальная позиция соответствует пилотскому месту. Все подписи кабины, текст станций на процедурной текстуре, телеметрия и основные уведомления ремонта/боезапаса/кислорода учитывают текущий RU/EN язык.
- Smoke/bubble эффекты используют ограниченные пулы: 54 пuffs и 96 bubbles на отсек; плотность реагирует на состояние опасности. Видимые пробоины/энергия оформлены холодными космическими цветами.
- Ring: laser pointer (тонкий/частый), pulse (толще/мощнее), spectrum (смена цвета). Мастер предлагает выбор после первого побеждённого босса, затем тест улучшения после двух успешных завершённых пробегов между предложениями. Прогресс хранится в памяти вкладки, не сохраняется после перезагрузки.
- Split-screen Ring: P1/pilot сверху, P2 снизу. Одиночный режим сохраняется.
- Warp: **Class I** — стандартная гладкая труба (сейчас предпочтительный вариант); **Class II** — бирюзово-янтарные спиральные рельсы; **Class III** — энергетические дуги; **Class IV** — тяжёлые врата. Все классы декоративные: маршрут, коллизии и сложность не меняются. X-Small → I, XX-Small → II, Medium → III, Large/XL/XXL/Capital → IV — временное отображение; реальный Warp Drive slot из Galaxy API ещё не подключён.
- Network co-op пока представлен только in-memory room registry. Нет живого WebSocket endpoint, auth, authoritative scheduled simulation, измерения RTT или reconnect. Не заявлять, что online co-op уже включён.

## Проверки PR #55 — исторические

## Проверки PR #57 / Mini-Sim 0.9.112

- Mini-Sim regression: PASS — https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39567055498
- Hull RU/EN copy: PASS — https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39567055354
- Warp visual tiers: PASS — https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39567055312
- UI/weapons/cabin: PASS — https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39567055331
- Tower top cap: PASS — https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39567055392
- Browser smoke PR #55: PASS — https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39567055334. Это исторический synthetic smoke, не подтверждение реального оборудования.

- Mini-Sim regression 0.9.112: PASS — https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39602967437
- Ring menu controls: PASS — https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39602967350
- UI layer regression: PASS — https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39602967364
- Hull Dive RU/EN copy: PASS — https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39602967454
- Warp visual tiers: PASS — https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39602967418
- Warp maze return: PASS — https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39602967560
- Browser smoke: PASS — https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39602967382. Physical Android/gamepad testing and production WordPress deployment are still outstanding.

## UI layer auditor

- В запущенной симуляции нажать **Ctrl+Alt+U** — откроется диагностика слоёв.
- Checker сканирует видимые game controls, пробует несколько точек elementFromPoint, отмечает occluded / partially-covered / pointer-events-none и показывает перекрывающий элемент. Это диагностика hit-testing, а не гарантия корректности логики действия.
- При приближении к Ring beacon появляется отдельная кнопка входа. Mouse/touch и gamepad A запускают уровень; стрелки и Enter/Space подтверждают SINGLE/MULTI. Зависший медиа-переход имеет 15-секундный watchdog.

## Осталось проверить вручную

1. После обновления WordPress plugin assets проверить Ring entry на keyboard/gamepad/touch, начальное состояние штурвала, непрерывный внешний вид во время Hull Dive, RU/EN переключение, четыре Warp вида, видимость дыма/воды и размеры Hull inset на Android.
2. Проверить feel оружия, beam hits/cadence и появление Master; изменить баланс по результату игры.
3. Продолжить Issue #48: WebSocket/server entry, auth, authoritative tick/snapshots, RTT/ping UI, reconnect/rejoin и тест двух клиентов в разных локациях.
4. Полная лёгкая SAGE map остаётся отдельным направлением Issue #28.

## Конфликтующие незавершённые PR — reconcile обязательно

- PR [#14](https://github.com/ShamanOrWhitch/BCM4StarAtlas/pull/14) и [#18](https://github.com/ShamanOrWhitch/BCM4StarAtlas/pull/18) остаются открытыми, но GitHub помечает их как несводимые с текущим main. Оба пересекаются с mini-sim/assets/js/mini-sim.js; #14 также затрагивает PHP asset version и Tower Crew cut-out cache, а #18 — browser QA runner/tests и дополнительный lookYaw fragment в runtime-коде.
- **Не сливать эти ветки целиком поверх 0.9.112.** Если нужна независимая логика, переносить минимальный функциональный diff на свежий main и прогонять регрессию. Не возвращать устаревшие версии и не затирать fix Ring/Hull.

## Не затрагивать

`wordpress/galia-desk`, scanner, marketplace/pricing/shared assets, planet placement, SAGE navigation adapter, global OST mixer и Tower physics. Не откатывать исправления без воспроизводимого теста.

## PR and test tracking
- Candidate PR: https://github.com/ShamanOrWhitch/BCM4StarAtlas/pull/60
- Check source-contract tests and browser QA before merge; afterward test entry to Ring, each perpendicular/floor turn, crystal pickup, X fire, Back exit, mouse interaction in Hull Dive, and return to normal flight.


## Текущая передача — Mini-Sim 0.11.21 после merge PR #85 (2026-10-27)

- **Main:** PR [#85](https://github.com/ShamanOrWhitch/BCM4StarAtlas/pull/85) merged в main, commit [fa88cb0](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/fa88cb0ae06ab0d534994cc3df6420075db902e9).
- **Карта Warp:** 2D SAGE XY −50…50; известные snapshot-звёзды/CSS, текущий сектор, цели/переходы из адаптера, выбранный маршрут; обзор и масштаб 2×/4×/8×. Нет выдуманных live-переходов или координат. Детали сектора объединяют массивы locations, POI, activities и mechanics с дедупликацией. Показаны ONI asteroid complex, планеты со статусом planned и категория Deep Space.
- **Оставшийся пробел:** snapshot сообщает 8,177 sector accounts, но не содержит полного списка координат. Полное отображение всех секторов зависит от адаптера.
- **TESTED-CODE:** 9/9 source regression workflows PASS на PR head [4e4841a](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/4e4841a912377856a274eb089e9965e7e6c79996). См. [Warp visual tiers](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40488604832), [Warp maze return](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40488604529), [Mini-Sim regression](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40488604765).
- **Browser QA:** [run 40488604679](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/40488604679) получил HTTP 403 до .bcm-mini-sim. Это BLOCKED-ENVIRONMENT, не PASS и не gameplay FAIL. Не запускать тот же путь повторно, пока доступ не изменился; firewall не обходить.
- **Не подтверждено:** WordPress deployment и ручная визуальная проверка на браузере/телефоне/геймпаде.
- **Следующий шаг:** пользовательский playtest после обновления assets на сайте; при новой ошибке фиксировать точный симптом и менять только нужный путь. Не повторять старый 403-маршрут.
