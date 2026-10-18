## D-015 — asteroіd textures, calmer Tower, faster Warp and controllable Hull Dive crew

**Статус:** IMPLEMENTED IN BRANCH; TESTED-CODE ожидает CI на PR SHA; VERIFIED-LIVE отсутствует. Baseline `437be7a24970f3d0e52438427f4dcb1c4bf7fd86`, branch `fix/asteroid-tower-hull-controls`, [WORK LOCK Issue #39](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/39).

- Астероидные стены берут текстуры из семейства `mini-sim/assets/asterwall*`. В одном входе лабиринта выбираются максимум четыре варианта, затем панели распределяются по ним; при ошибке загрузки остаётся процедурная fallback-текстура. Ограничение удерживает загрузку разумной для старых телефонов.
- Tower: более короткие прыжки между секторами, меньше боковых опасностей и объектов. Keyboard/touch/mouse/tilt реагируют спокойнее; когда подключён gamepad, его масштаб ввода остаётся 1.0.
- Warp Tube: перемещение/прокрутка ускорены коэффициентом 1.25, boost — 1.4; длительность составляет 42 секунды вместо 48. Сцена и аудио по-прежнему общие с Mini-Sim.
- Room 0 временно использует speed level 3 (thrust 24 / max speed 60). Предыдущий режим запоминается и восстанавливается при возврате с трассы либо Home.
- Hull Dive: два процедурных чиби-астронавта; P1 — WASD, F/E, экранные кнопки и gamepad (левый стик/D-pad, A repair, B pump); P2 — стрелки, Enter/Shift. Механики воды, общего кислорода, насоса и сварки пока сохранены.
- Это не сетевой мультиплеер: роли пилота/стрелка/инженера, FPS у штурвала, скафандры, вакуумное вытягивание и zero-G — следующий отдельный дизайн/реализационный этап. Для инкрементального подхода к маленькому игровому прототипу как вдохновение просмотрен [studioigor/ref2game](https://github.com/studioigor/ref2game); репозиторий не устанавливается как runtime dependency.
- Не менять подтверждённый пользователем переход обратно к карте текущего сектора, SAGE навигацию/сектор, порядок мультимедийной загрузки, глобальный OST mixer или Crew segmentation workflow. Никаких on-chain команд/транзакций не добавляется.

Результаты CI, commit SHA и живой статус дописать после проверок.

---

## D-014 — 0.9.93 mobile controls, media priority and return status

**Статус: MERGED / TESTED-CODE + BROWSER-SMOKE; физический Android-тест ещё нужен.** Mini-Sim 0.9.93 / Tower 0.2.58 merged by [09c0a955](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/09c0a9553daa6406302c3e54cd0bca1aaeff6702) from [PR #38](https://github.com/ShamanOrWhitch/BCM4StarAtlas/pull/38). All five Actions checks passed on the tested PR head `962cb6267012232bfa4dd866b4af1ef5a07f3e43`; documentation reconciliation was validated on the later PR head. Browser QA on code head [39023846140](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39023846140) also succeeded. These checks do not prove input on a physical Android phone and do not deploy to WordPress.

- Загрузка: запуск очереди текстур ближайших стен до видео правой стены; реальное видео портала запрашивается после правого видео; наружные и декоративные текстуры сохраняют низкий приоритет.
- Warp Tube: компактный HUD на touch-экранах; управление наклоном устройства с запросом разрешения iOS и кнопкой перекалибровки; осевое вращение восстановлено с коэффициентом 0.45 от прежнего чрезмерного темпа при сохранении текущего кольцевого курса и углов коллизий.
- Deep Space: drag при зафиксированном видеэкране меняет позицию корабля по орбите вокруг выбранного экрана вместо общей скорости обзора.
- Tower: современные телефоны используют один путь Pointer Events, чтобы одно нажатие не запускало и pointer-, и touch-прыжок; старый touch-handler оставлен только как fallback; скрытые P2-кнопки явно display:none; чувствительность наклона P1 снижена немного. Версия/кэш Tower — 0.2.58, Mini-Sim — 0.9.93.
- Пользователь подтвердил, что возврат из астероидного лабиринта к карте текущего сектора работает. Не менять текущий сектор, адаптер или логику возврата.
- Тесты обновляются под новый порядок запросов и номера версий. Не считать функцию проверенной на живом WordPress/Android до прохождения CI и ручного теста. GitHub не развёртывает плагин автоматически.

---

# BCM Mini-Sim — журнал решений и выполненной работы

## D-013 — Mobile Warp render pacing for 0.9.92

**Статус: TESTED-CODE on [46dea0e](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/46dea0ed32cebac7636f8c2522ccb6fe4348ddda).** Regression check [38841425206](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/38841425206) succeeded. Browser smoke [38841425219](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/38841425219) succeeded with video media disabled; the video-enabled scenario was skipped. Android battery use is not yet VERIFIED-LIVE.

Integrated Grok's `fix/warp-angle-and-room2-view` code into `main` as Mini-Sim 0.9.92. Warp canvas animation is capped at 30 FPS on touch/mobile devices and at 60 FPS on desktop; mobile canvas backing resolution is capped at device-pixel-ratio 1. The Tube duration remains 48 seconds and its elapsed time remains timestamp-based. This reduces repeated canvas work but is not proof of measured battery savings. Verify on Android before calling battery use fixed.

Tower's visible JS version label is synchronized with its existing PHP/cache version 0.2.57; no Tower gameplay or input logic changed in this release.

---


Этот файл — долговременная инженерная память, а не список пожеланий. Его нужно читать до новых исправлений. Записи не удаляются при смене этапа: обновляется статус, добавляются доказательства и новые коммиты. Если позднее пользователь захочет применить готовую технологию заново, используйте её как существующий строительный блок, а не разрабатывайте повторно.

## Как читать статусы

- **IMPLEMENTED** — изменение присутствует в указанном коммите и, после сверки, в текущей ветке.
- **TESTED-CODE** — автоматические тесты/линтеры прошли на указанном SHA. Не означает runtime или live verification.
- **VERIFIED-LIVE** — поведение проверено в браузере на названном окружении/версии.
- **USER-CONFIRMED** — пользователь явно подтвердил работоспособность конкретного сценария.
- **OPEN** — исправления нет либо есть действующее свидетельство дефекта.
- **NEEDS-USER-STATUS** — нужен краткий ответ пользователя, потому что фактическое поведение сайта нельзя вывести из кода, а от ответа зависит дальнейшая работа.
- **BLOCKED** — есть конкретный недостающий доступ, файл, источник или воспроизводимый вход.
- **REOPENED** — прежнее исправление имеет новое свидетельство регрессии; ссылка на прежнее решение сохраняется.
- **SUPERSEDED** — решение заменено более новым. Не возвращать его без нового обоснования.

Никогда не подменять один статус другим. Например, зелёный тест исходников не равен тому, что сайт уже получил файлы, а отсутствие жалобы не является подтверждением. Но отсутствие подтверждения также не является причиной бесконечно переделывать уже реализованный код.

---

## D-012 — Планета остаётся снаружи Room 2 и видна из коридора

**Статус: IMPLEMENTED; целевые проверки исходника и JavaScript parse check пройдены. Полный Node suite не запускался; VERIFIED-LIVE нет.**

После версии 0.9.89 пользователь сообщил, что планета стала выглядеть как объект внутри Room 2. Причина — радиус был увеличен с 11 до 28, а позиция смещена с `(-26, 9, -190)` на `(0, 16, -220)`. Хотя координата Z всё ещё находится за пределами Room 2, увеличенная сфера оказалась прямо на оси прохода.

Восстановлено прежнее внешнее положение: `SphereGeometry(11, 24, 16)` и `position.set(-26, 9, -190)`. При этом `updateSpaceSatelliteVisibility()` продолжает показывать космические объекты как в `ROOM2`, так и в `DEEP_SPACE`. Коллизии, геометрия комнат, материалы спутника, media queue и Warp не менялись. Кэш-версия Mini-Sim — 0.9.90.

Связанные изменения: `9b37c93` (позиция/размер), `a8355a7` (cache version), `af8608b` (source-contract test). Целевые проверки координат/размера/видимости и согласованности версии прошли; полный Node suite не запускался, потому что в этом окружении недоступно клонирование репозитория. На WordPress ничего не загружалось.

---

## D-013 — Труба не растягивает препятствия, обшивка видна из полости

**Статус: IMPLEMENTED в 0.9.91. TESTED-CODE — 31 source-contract pass. VERIFIED-LIVE нет. Планета и сфера станции не сдвигались.**

Скрин 0.9.90: кольца уходили спиралью, шипы при глубине больше 1 рисовались жёлтым клином за пределами трубы, удар не совпадал с видимым проёмом, потому что поворот препятствия по глубине был большим. Глубина препятствия теперь не больше 1, ближнее кольцо остаётся в центре экрана, поворот по глубине маленький.

Обшивку `back*.png` не удаляли. Панели смотрели только внутрь и скрывались, пока `exteriorFlight` был ложью, поэтому снаружи переливов не было. Теперь материал двусторонний и оболочка видна везде, кроме внутренности коридора. Полость между стенами Room 2 и обшивкой пролетается. Рот коридора после телепорта остаётся твёрдым. Сквозной выход через всю заднюю крышку убран: наружу выпускает только створ коридора. Невидимый захват на 8 единиц вокруг корпуса уменьшен до 1.2.

---

## D-011 — Warp: один угол крена, отмена без автопереноса, объекты космоса видны из Room 2

**Статус: IMPLEMENTED в 0.9.89 на ветке `fix/warp-angle-and-room2-view`. TESTED-CODE — 31 source-contract pass. VERIFIED-LIVE нет.**

Уточнение пользователя после 0.9.88: крен трубы уже читается, но влево/вправо перепутаны, крутиться должен корабль, а не труба, препятствия зависают у камеры. Спутник стал плоским, потому что 0.9.88 заменил металлический материал на Basic. Планета была в стороне от оси коридора. Счётчик TEX останавливался, потому что повторный запрос того же файла выбрасывал callback.

0.9.89: корабль едет по стенке, вправо уменьшает угол и визуально уходит вправо; труба от стика не крутится; глубина препятствия 1/z, без стоянки у носа. Каркас спутника снова MeshStandardMaterial. Планета на оси коридора, крупнее. Очередь текстур вызывает все callback одного файла и через 20 с отпускает зависший запрос. Папка `scripts` по-прежнему не ставится ни на WordPress, ни на Render.

Свидетельство пользователя на 0.9.87 (2026-10-14): вправо крутит то вправо, то влево; после сдвига вправо кнопка вверх продолжает тот же поворот, затем управление расходится. Это не поломка джойстика. Код двигал точку по X/Y и снова клал её на окружность, поэтому направление стика зависело от того, где корабль уже стоял на круге.

Решение, без копирования кода tube64:
- Влево/вправо меняют только `playerAngle` с постоянной скоростью.
- Корабль рисуется внизу экрана, туннель крутится в обратную сторону.
- Вверх/вниз больше не участвуют в крене.
- Успешный Warp не уводит в ONICSS сам. «Продолжить» идёт дальше, «Отмена» возвращает сохранённую точку вылета.
- Спутник и планета видны уже в Room 2, не только после пересечения границы Deep Space. Каркас спутника — `MeshBasicMaterial`, чтобы он не гас вне короткого радиуса точечного света.

Не трогались: переход Room 2, сдача Tower, микшер музыки, карта SAGE.

Условие переоткрытия: на сайте с версией 0.9.88 вправо всё ещё меняет направление само, либо спутник по-прежнему отсутствует в коридоре Room 2.

---

## D-001 — Имя Crew вместо обобщённого «Crew #...»

**Статус: IMPLEMENTED в коде; live/user confirmation не записаны для последней версии. Не начинать заново без нового свидетельства.**

Проблема обсуждалась и повторно исправлялась несколькими коммитами 10–11 октября. История особенно важна: ранние исправления меняли fallback и регулярные выражения, после чего нормализация имён неоднократно уточнялась. Текущий код содержит нормализацию и несколько источников настоящего имени.

Связанные коммиты:
- [8ad3e72 — Preserve Crew display names from metadata](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/8ad3e727743522d69634296b1554c224624a74a3)
- [892ea3a — Resolve real Crew names and bump Mini Sim assets](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/892ea3abb6d538e4d6570e40d70ef448154394a2)
- [ec01831 — Fix Crew names in character selection](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/ec01831e54bdc3b8af71782e6304cd25f096911e)
- [b3b2148 — Fix Tower Crew segmentation and shield alignment / normalize names](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/b3b214865caf74aa47f8dd3b693c8e15baf01c54)
- [0e7c65b — Fix Crew wallet metadata parsing and names](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/0e7c65b3a37f28b596ceedcda3c20a39ecb4d854)

Текущие релевантные файлы:
- mini-sim/assets/js/crew-wallet.js: traitsOf(), trait(), crewRecord() — обрабатывает несколько форм метаданных и варианты display/person/given/family name.
- mini-sim/assets/js/mini-sim.js: crewPersonName() — нормализует имя в Mini-Sim.

Правило для следующих агентов:
- Не писать очередной resolver и не переделывать имя «на всякий случай».
- Если перед работой над именами это важно, сначала проверить текущие функции и все последующие коммиты.
- Если остаётся неизвестным, работает ли последнее исправление на сайте, задать пользователю один короткий вопрос или попросить только конкретный пример, если это действительно блокирует текущую задачу.
- Повторно открыть только при свежем воспроизводимом примере/логе/скриншоте или подтверждении пользователя, что имена снова выводятся как «Crew»/номер.

## D-002 — Единый микшер OST, mute и кнопка-нотка

**Статус: IMPLEMENTED в коде. Source-contract на 7489982 был красным из-за слишком широкого утверждения и выровнен без изменения микшера. Browser QA с подменой ассетов подтвердил непрерывность Warp OST и возврат обычного OST после отмены Warp; mute-кнопка и Room0 → B этим прогоном не нажимались. Немодифицированный сайт всё ещё на 0.9.82 / 0.2.53.**

Основной коммит:
- [3196d8d — Fix shared OST control and Room 1 home reset](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/3196d8d9a07dc08fcf930973cecd7dc395c94ce2)

Продолжения:
- [962a5d0 — Route Tower OST through shared mixer](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/962a5d05f0879db26d0f372310ce9ba36a13abba)
- [f6afd57 — Show muted state on music note](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/f6afd5728f25f0b49a8f28eba3a0061573c08300)
- [f1b1064 — Test shared audio, Home reset and rotating Warp course](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/f1b1064a2f7fbec7551ddafe3e940f81a1addd75)

Current intended behavior:
- starbase for the first ONI CSS location, including Room0 and Room1.
- tower only while Tower gameplay is active.
- warp from Warp map/Tube into the asteroid maze until the pilot exits; there is no separate asteroid OST yet.
- One OST at a time through window.BCMGameAudio.playExclusive.
- Note button toggles global mute; CSS .is-muted shows a strike-through; zone changes should respect mute.
- Gamepad A must not trigger Tower OST unless the Tower mode-selection/gameplay action actually starts Tower.

Useful code:
- mini-sim/assets/js/mini-sim.js: registerGameOst(), playExclusiveGameOst(), setAudioMute(), syncMusicButton(), startMusic().
- mini-sim/assets/js/deep-space-warp.js: uses shared Warp channel.
- mini-sim/tower/assets/js/tower.js: playTowerAudio() uses shared Tower channel.

Regression tests in scripts/minisim-local-qa.test.mjs:
- “Note button shares one mute state across Starbase, Warp and Tower OSTs”.
- “Room 1 Home clears Room 0 constraints and restores Starbase OST”.
- Warp tests assert Warp OST remains continuous across the Warp stage.

**Do not blindly rewrite the mixer.** `returnToStart()` still calls `stopMiniSimAudio()` and then `startMusic()`. The f1b1064 assertion forbade any `stopMiniSimAudio()` before `setStatus` and failed CI from that commit through `7489982` (run 38368355012: 8 pass / 1 fail). The assertion now requires `startMusic()` after that stop and before the Room 1 status. Audio handlers were not edited.

On 2026-10-13 a local run of `scripts/minisim-local-qa.mjs` against https://walkingyog.com/bcm4sa/ with commit assets substituted for both plugin URLs and Autoptimize handles passed the existing Warp map → Tube → cancel checks, including a single Warp OST that continues into Tube and a non-Warp OST after cancel. That is not a Room0 B test and not proof that an unmodified visitor receives these files.

## D-003 — B / Home returns from Room0 to the start of Room1

**Статус: IMPLEMENTED в коде; live Room0 → B на текущем деплое не подтверждён. Browser runner этот сценарий пока не выполняет.**

Commit: [3196d8d — Fix shared OST control and Room 1 home reset](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/3196d8d9a07dc08fcf930973cecd7dc395c94ce2).

The current handler returnToStart() deactivates the Room0 race, resets its race state and hides its group, moves the ship to (0, 0, 2), clears linear/angular velocity, resets orientation/doors, and calls startMusic(). In the gamepad input mapping, button index 1 calls returnToStart; keyboard H also calls it. The separate gamepad Back/Select button index 8 calls resetCurrentRoom().

Regression test:
- “Room 1 Home clears Room 0 constraints and restores Starbase OST” in scripts/minisim-local-qa.test.mjs.

If B still returns the player to Room0, do not immediately rewrite this same handler: confirm which PHP/JS version the live WordPress page actually serves, then trace the button event and next physics frame. This code-level fix may not yet be deployed or may have a new regression.

## D-004 — Responsive gamepad turning and ship-local vertical input

**Статус: PARTIALLY IMPLEMENTED; physical behavior still needs gameplay verification.**

Commit: [3196d8d — Fix shared OST control and Room 1 home reset](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/3196d8d9a07dc08fcf930973cecd7dc395c94ce2).

The current source increases gamepad yaw/pitch multipliers and applies vertical acceleration along the ship's quaternion-rotated local axis. The contract test checks these source patterns.

Important distinction: using the ship's local up axis is not by itself proof that movement is correctly aligned to the current tunnel/corridor floor and ceiling. The player has reported sticking to the floor/ceiling and vertical controls referring to the wrong axis. This remains a real open physical/gameplay question, not a closed issue. Do not mark it solved solely due to the source assertion.

Next work after current deployment is confirmed: test corridor, maze, and open-space separately; adjust corridor-frame handling without adding an attracting/adhesive force; clear residual angular velocity/inputs on Warp transition.

## D-005 — Warp length, looping OST and rolling/variable Tube prototype

**Статус: PARTIALLY IMPLEMENTED в коде; gameplay quality remains OPEN.**

Commits:
- [14f9c8b — Extend Warp Tube with rolling varied one-pass course](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/14f9c8b0537d952e29f821f7e725baeef2948e33)
- [f1b1064 — Test shared audio, Home reset and rotating Warp course](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/f1b1064a2f7fbec7551ddafe3e940f81a1addd75)

Current source has:
- WARP_DURATION = 48 (48 seconds, twice the previous 24-second course).
- Warp OST loops and is intended to continue from map through Tube and asteroid maze.
- A Canvas tunnel scene with a roll transform, changing speed multipliers by section, and spaced gates.
- Controller/touch/keyboard steering.

The user previously reported that the obstacles still cover too much of the view, the course is repetitive, and the craft can spin uncontrollably after exiting Warp. These concerns remain active until a current build is tested and/or further variety/physics is implemented. Source checks confirm only selected code contracts, not that the scene visually feels like Bullfrog's Tube or that roll/transition control works well.

Do not describe the current Tube as finished. The remaining design goal is a tube-racing route with varied curves, rolling orientation, loops/wall/ceiling travel, clear passable openings, some speed variation or gating obstacles, and collision geometry that matches what is drawn.

## D-006 — Room1 left wall material stability

**Статус: IMPLEMENTED in code as a texture-stability change; shell/model appearance is not user-confirmed.**

The current Mini-Sim source and regression test intentionally restrict/back off periodic random wall texture changes. Do not re-add random switching to the left wall without explicit request.

This does not authorize restoring the earlier proposed outer-shell model or changing other external surfaces. The user specifically said not to restore that model. If visuals are reported as broken, isolate which renderer/material/mesh disappeared and make a narrow fix.

## D-007 — SAGE map / galaxy-wide route planner

**Статус: OPEN.**

The current Warp navigation reads an optional BCM_SAGE_NAVIGATION / GALIA_SAGE_NAVIGATION adapter and otherwise generates a local 3x3 test preview around ONI CSS. It does not show the full galaxy map and does not execute real fleet movement.

Task when this phase becomes active:
- inspect actual available SAGE map assets/API and verify completeness; do not infer full regional count from a filename;
- display the entire map for planning, mark current sector, destination, and only real connections;
- in-game movement remains one connected cell per jump;
- don't force a pilot in an asteroid sector to return to base by default.

## D-008 — Browser testing without downloading/uploading the whole project repeatedly

**Статус: browser workflow PASS на `dc8a08e` после исправления Autoptimize mapping. Покрыт только текущий Warp map → Tube → cancel сценарий. Room0 → B, mute и интерактивная ручная проверка остаются OPEN; непереписанный production не обновлён этим тестом.**

Проверено 2026-10-13 по `main` `748998250d39ac9ed163b84caa1f7178da920d9a` и трём runs workflow `minisim-browser-qa.yml`:
- run 38365777216, SHA `ec70ed5`, failure, артефактов нет;
- run 38366096126, SHA `e8cbd54`, failure, артефакт есть;
- run 38366114002, SHA `7ae46c4`, failure, артефакт `11796367897` доступен до 2026-10-20.

Страница https://walkingyog.com/bcm4sa/ содержит `id="bcm-deep-space-warp-js"` со `src` вида `/wp-content/cache/autoptimize/autoptimize_single_….php?ver=0.9.82`. Тот же кэш у `bcm-mini-sim-css`, `bcm-tower-css`, `bcm-crew-wallet-js`. Поэтому старый runner не считал Warp JS файлом коммита и выходил до кликов. Runner теперь читает HTML и подменяет URL этих id файлами checkout. Видео по-прежнему блокируются в лёгком режиме; 404 темы `core.css` и 502 `admin-ajax.php` остаются в отчёте, но не валят Mini-Sim, если игровые checks прошли и файлы плагина не отдали HTTP-ошибку. Ошибка прелоадера темы `wy-preloader` (inline base64) тоже не относится к игре.

Это не разрешение подключать произвольный JS с raw GitHub на публичный сайт.

---

## Reconciliation history

### Baseline before the agent-context documentation
The most recent relevant game commits already present on main before these documentation files were added included:

- 0e7c65b3a37f28b596ceedcda3c20a39ecb4d854 — Crew wallet metadata/name parsing.
- 3196d8d9a07dc08fcf930973cecd7dc395c94ce2 — shared OST control and Room1 Home reset.
- 14f9c8b0537d952e29f821f7e725baeef2948e33 — 48-second rolling/varied Warp course.
- 962a5d05f0879db26d0f372310ce9ba36a13abba — Tower OST routed through shared mixer.
- 4030d30f59cfd7e5525beb899c5775e5219e5ae3 — Mini-Sim cache version bumped to 0.9.83.
- e0a9e21e99e045744113663000db66eb640b337d — Tower cache version bumped to 0.2.54.
- f6afd5728f25f0b49a8f28eba3a0061573c08300 — visual muted state for note button.
- f1b1064a2f7fbec7551ddafe3e940f81a1addd75 — regression tests for music, Home and Tube.

The latest scripts/minisim-local-qa.test.mjs contains source-contract checks for shared music, Home reset, 48-second rotating Tube, vertical input, Back reset, stable wall textures, controller navigation and the local browser runner. The presence of assertions is not proof that they passed on the current SHA, and neither is proof of live WordPress behavior. A CI status lookup for the recent commits returned no individual commit statuses; do not claim a green CI run for those SHAs unless a current Actions run can be verified.

After this reconciliation, agents should append new commit SHAs and update each decision's status rather than relying on this baseline forever.

### 2026-10-13 — P1 reconcile against Actions and the live page

HEAD at the start of the session was `748998250d39ac9ed163b84caa1f7178da920d9a` (docs only after `7ae46c4`). No later commit changed OST, Home, or the runner. Regression workflow on that HEAD failed one Home source assertion; browser workflow had already failed three times before gameplay. The game mixer was left as implemented. The runner and the Home assertion landed in [d42818a](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/d42818adec98adc77d8a4e471f8e57984fcbe494). GitHub Actions on the following journal commit [dc8a08e](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/dc8a08e35b5e457c4a18cf437cbe9661e58e56d6), which contains that runner, both succeeded: regression run [38369594418](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/38369594418) and browser QA run [38369594467](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/38369594467). The browser job uploaded artifact `minisim-browser-qa-dc8a08e35b5e457c4a18cf437cbe9661e58e56d6` (id 11798337294, expires 2026-10-20). That remote pass uses asset substitution on the live page. It is not unmodified-live verification and it does not cover Room0 → B or the mute button.


## D-009 — Постоянная координация нескольких агентов и лабораторий

**Статус: описан в ветке `docs/shared-agent-coordination`; ожидает ревью/интеграции.**  
Резервирующая задача: [Issue #15](https://github.com/ShamanOrWitch/BCM4StarAtlas/issues/15).

Контекст: агенты могут работать параллельно в раздельных песочницах и не видеть чужие незакоммиченные изменения. Ссылка на чат или Markdown не является блокировкой. В `WORK_COORDINATION.md` описан общий протокол: сначала сверить HEAD, коммиты, Issues и PR; затем зарегистрировать `WORK LOCK` Issue с baseline SHA, branch, scope files, критериями и проверками; работать в отдельной ветке; публиковать контрольные коммиты; после существенной работы обновлять PROJECT_STATE и DECISIONS.

Ограничение: GitHub Issues не являются атомарным mutex. Поэтому повторно проверяй пересечения перед первой записью и интеграцией. При конфликте не перезаписывай чужие файлы и не используй force-push; согласуй владельца/границы через Issue. Открытый PR — свидетельство незавершённой ветки, но его области надо определить по diff, а не по одному заголовку.

Статусы должны различать IMPLEMENTED, TESTED-CODE, VERIFIED-LIVE и USER-CONFIRMED. Молчание пользователя не подтверждает исправность и не доказывает регрессию. Если факт live-поведения влияет на текущую задачу и его нельзя вывести из кода/тестов, задавай один узкий вопрос, иначе сохраняй статус и продолжай доступную проверку.

Источники:
- [WORK_COORDINATION.md](WORK_COORDINATION.md)
- [AGENTS.md](AGENTS.md)
- [PROJECT_STATE.md](PROJECT_STATE.md)


## D-010 — Восстановить периодическое изменение текстур внешней оболочки

**Статус: MERGED в main; TESTED-CODE PASS; визуальная проверка сайта не выполнена.**  
Репорт пользователя: 2026-10-14 — внешняя оболочка потеряла периодически меняющиеся текстуры, несмотря на то что оптимизация не должна была удалять эффект жидкого металла, ассоциированный с Photoli / Rainbow Chi.

- Baseline main: `c01cec1e6776b53192c15b3027e0240f3ed27a45`; issue [#32](https://github.com/ShamanOrWitch/BCM4StarAtlas/issues/32); branch `fix/exterior-shell-texture-cycle`.
- Root cause: desktop-набор был насильно ограничен первыми четырьмя `back*.png`; функции `randomizeBackside()` и `updateBacksideCamouflage()`, рендер-вызов и stagger по таймерам убрали, а source-contract test прямо требовал отсутствия цикла. Историческая рабочая версия: [`0fc809c`](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/0fc809c2597debee629fecb0c25dd4ab370d65f9).
- Восстановлено: полный доступный пул текстур для desktop; до четырёх текстур в touch-landscape; существующий mobile downscaling в `makeTextureSource()` сохранён. Внешние shell-панели получают индивидуальные периоды смены около 0.8–3.0 s; при повторном появлении оболочки таймеры сдвигаются друг относительно друга. Смена обновляет только `backside.panels` и не запускается для интерьерных стен.
- Изменены: `mini-sim/assets/js/mini-sim.js`, `scripts/minisim-local-qa.test.mjs`, cache version в `mini-sim/bcm-mini-sim.php` → 0.9.86.
- Ограничение: source-contract и CI подтверждают кодовые инварианты, но не визуальный вид материала в настоящем браузере; branch assets не выкладывались на WordPress. Не отмечать как VERIFIED-LIVE до установки/проверки на сайте.
- Повторное открытие допустимо, если после установки панели не меняются, desktop всё ещё использует только часть текстур или shell цикл влияет на интерьерные стены.

- Merge commit: [ad4d8cf](https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/ad4d8cf8cdf261cecb30b95ddbf85ceaf7514f02); pull request [#33](https://github.com/ShamanOrWhitch/BCM4StarAtlas/pull/33).
- Post-merge Mini-Sim regression: PASS — [run 38471956269](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/38471956269). Warp source-contract: PASS on PR SHA `c92c16d` — [run 38471847602](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/38471847602). Browser smoke passed on code-identical runtime SHA `be2adbd` — [run 38471671934](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/38471671934); post-merge browser QA run `38471956003` remained in progress when the record was updated. None of these tests visually verifies liquid-metal appearance.
