# BCM4StarAtlas / Mini-Sim — актуальная передача

Дата: 21 октября 2026.

## Источник истины

- Main: Mini-Sim **0.9.112**, Tower **0.2.64**.
- Main SHA: 443cd4f1cd388d020f1811908f1d31ad53809334 (squash merge PR [#57](https://github.com/ShamanOrWhitch/BCM4StarAtlas/pull/57)).
- История: PR #46 — Ring menu activation; PR #49 — Warp visual classes; PR #51 — RU/EN UI, Ring weapons and inset cabin; PR #52 — bounded network-room prototype; PR #55 — Hull Dive RU/EN; PR #57 — pilot view/helm, Ring entry and UI hit-test diagnostics.
- **Не путать:** CI PASS — это проверка кода/Playwright сценария, не подтверждение ручной игры на физическом Android/gamepad и не доказательство deploy плагина на WordPress.

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
