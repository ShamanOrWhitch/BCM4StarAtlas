# BCM4StarAtlas / Mini-Sim — актуальная передача

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
