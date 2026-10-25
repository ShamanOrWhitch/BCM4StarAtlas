# BCM4StarAtlas / Mini-Sim — актуальная передача

## Candidate branch — Mini-Sim 0.11.11 Warp and Panda UI (25 October 2026)

- Branch `fix/minisim-0.11.11-warp-panda-prompt`, lock issue [#70](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/70), based on main `bc77614564aa7bf1f2a211c945006fc258d6aeff` (0.11.10 / Tower 0.2.65). Not merged or deployed.
- Warp now has 12 gently skewed base strips, no extra Class II rail/pulse overlay, no decorative wall hoops/chevrons, and more visible segmented gates, sweepers and spikes. Hazard draw depth was extended; hit/collision formulas, speed ramp, shimmer clock, audio and navigation were left unchanged.
- Flight/Warp instructions are routed into the Panda operator bubble. Separate right-side controls markup/styles are removed. Bubble width is increased and Panda stays visible at 420px.
- Code/CI status is pending until runs for the pull request finish. Repeat production browser QA still receives HTTP 403 before the game container; do not call this visual verification. No WordPress deployment or physical device test is claimed.
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
