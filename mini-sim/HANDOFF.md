# BCM4StarAtlas / Mini-Sim — актуальная передача

Дата: 21 октября 2026.

## Источник истины

- Main: Mini-Sim **0.9.111**, Tower **0.2.64**.
- Main SHA: `51553e78bec6c7ecfb20cc69610c89d9225222c7`.
- Ключевые изменения: PR #46 — Ring menu activation; PR #49 — Warp visual classes; PR #51 — RU/EN dialog UI, Ring weapons, inset cabin and longer QA budgets; PR #52 — bounded network-room prototype; PR #55 — полный RU/EN copy в Hull Dive.
- **Не путать:** CI PASS — это проверка кода/Playwright сценария, не подтверждение ручной игры на физическом Android/gamepad и не доказательство deploy плагина на WordPress.

## Что есть в 0.9.111

- Стартовый переключатель RU/EN сохраняется в localStorage; Enter переключает язык до вылета.
- Два прозрачных диалога-комикса: оператор/сюжет и подсказка controls по устройству/уровню. Постоянный HUD-инструктаж скрыт в полёте; Ring убирает мелкие угловые подписи во время игры.
- В выборе Crew портреты крупнее, карточки шире, изображения показываются целиком.
- Hull Dive — нижнее правое окно; пилотский вид остаётся сверху. Все подписи кабины, текст станций на процедурной текстуре, телеметрия и основные уведомления ремонта/боезапаса/кислорода учитывают текущий RU/EN язык.
- Smoke/bubble эффекты используют ограниченные пулы: 54 пuffs и 96 bubbles на отсек; плотность реагирует на состояние опасности. Видимые пробоины/энергия оформлены холодными космическими цветами.
- Ring: laser pointer (тонкий/частый), pulse (толще/мощнее), spectrum (смена цвета). Мастер предлагает выбор после первого побеждённого босса, затем тест улучшения после двух успешных завершённых пробегов между предложениями. Прогресс хранится в памяти вкладки, не сохраняется после перезагрузки.
- Split-screen Ring: P1/pilot сверху, P2 снизу. Одиночный режим сохраняется.
- Warp: X-Small — стандартный туннель, XX-Small — сильные спиральные рельсы; I/II/III/IV можно просматривать в Tube. Реальное значение Warp Drive slot не берётся из Galaxy API.
- Network co-op пока представлен только in-memory room registry. Нет живого WebSocket endpoint, auth, authoritative scheduled simulation, измерения RTT или reconnect. Не заявлять, что online co-op уже включён.

## Проверки PR #55

- Mini-Sim regression: PASS — https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39567055498
- Hull RU/EN copy: PASS — https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39567055354
- Warp visual tiers: PASS — https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39567055312
- UI/weapons/cabin: PASS — https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39567055331
- Tower top cap: PASS — https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39567055392
- Browser smoke: PASS — https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39567055334. Video-enabled QA step was skipped; browser smoke does not cover physical phone/gamepad controls or all Ring/Hull playability.

## Осталось проверить вручную

1. После обновления WordPress plugin assets проверить Ring entry на keyboard/gamepad/touch, RU/EN переключение, четыре Warp вида, видимость дыма/воды и размеры Hull inset на Android.
2. Проверить feel оружия, beam hits/cadence и появление Master; изменить баланс по результату игры.
3. Продолжить Issue #48: WebSocket/server entry, auth, authoritative tick/snapshots, RTT/ping UI, reconnect/rejoin и тест двух клиентов в разных локациях.
4. Полная лёгкая SAGE map остаётся отдельным направлением Issue #28.

## Не затрагивать

`wordpress/galia-desk`, scanner, marketplace/pricing/shared assets, planet placement, SAGE navigation adapter, global OST mixer и Tower physics. Не откатывать исправления без воспроизводимого теста.
