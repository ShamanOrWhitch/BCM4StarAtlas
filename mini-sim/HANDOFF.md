# BCM4StarAtlas / Mini-Sim — актуальная передача

Дата: 21 октября 2026.

## Источник истины

- Main: Mini-Sim 0.9.110, Tower 0.2.64.
- Сборочный SHA: 9b4e7b8a2fe842de9418772c33499b63a79c1e18.
- Ключевые изменения: PR #46 Ring menu input; PR #49 Warp visual classes; PR #51 RU/EN dialogs, Ring weapons and inset cabin; PR #52 bounded network room prototype.
- Не путать: CI PASS подтверждает код/автоматизированный сценарий, но не ручную игру на физическом Android/gamepad и не deploy плагина на WordPress.

## Что есть в 0.9.110

- Стартовый переключатель RU/EN сохраняется в localStorage; Enter переключает язык до вылета.
- Два полупрозрачных диалога-комикса: оператор/сюжет и устройство-зависимые controls. В полёте постоянный HUD-инструктаж скрыт; Ring убирает мелкие угловые подписи во время игры.
- В меню Crew портреты увеличены, карточки шире и изображение показывается целиком.
- Hull Dive — отдельное окно справа снизу, а пилотский вид остаётся сверху. Пулы частиц ограничены: по 54 smoke puffs и 96 bubbles на отсек; плотность зависит от уровней опасности. Для пробоин и энергии используются холодные космические цвета, не flame-эффекты.
- Ring имеет три экспериментальных профиля оружия: тонкая/частая laser pointer, более толстый pulse и меняющий цвет spectrum. Мастер оружия предлагает выбор после первого побеждённого босса. Следующий тест улучшения выдаётся после двух успешных завершённых пробегов с предыдущего предложения. Прогресс живёт в памяти вкладки, но не сохраняется после перезагрузки.
- Split-screen Ring: P1/pilot сверху, P2 снизу. Одиночный режим сохраняется.
- Warp: X-Small получает спокойный стандартный туннель; XX-Small — сильные спиральные рельсы; доступны просмотры визуальных классов I–IV. Истинный размер компонента Warp Drive ещё не берётся из Galaxy API.
- Сетевые location rooms представлены только registry-прототипом в памяти процесса; настоящего WebSocket endpoint, auth, scheduled simulation, measured RTT или reconnect нет. Не называть это работающим online co-op.

## Проверки

- Mini-Sim regression после merge: PASS — https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39565685006
- UI/dialog/weapons/Hull suite: PASS — https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39565526244
- Warp visual tiers: PASS — https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39565526252
- Tower top cap: PASS — https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39565684968
- Browser smoke with branch assets: PASS — https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39565526302. Это smoke-тест сценария Warp map → Tube → cancel, а не полный playtest Ring-оружия и Hull на телефоне.
- Long operations: browser QA job 45 min; media/load steps 20–25 min; source regression jobs 25–30 min; navigation wait до 60 s.

## Следующие шаги

1. После обновления WordPress plugin assets вручную проверить Ring-вход через keyboard/gamepad/touch, RU/EN, четыре Warp вида, видимость дыма/воды и размеры Hull inset на Android.
2. Проверить реальное ощущение оружия, попадания луча и cadence; при необходимости изменить баланс по игровому тесту.
3. Продолжить Issue #48: WebSocket server entry, authentication, authoritative ticking, snapshots, RTT/ping, reconnect/rejoin и два клиента в разных локациях.
4. Полная лёгкая SAGE map остаётся отдельным долгосрочным Issue #28.

## Не затрагивать

wordpress/galia-desk, scanner, marketplace/pricing/shared assets; размещение планеты и SAGE navigation adapter; global OST mixer; Tower physics. Не откатывать исправления без воспроизводимого теста.
