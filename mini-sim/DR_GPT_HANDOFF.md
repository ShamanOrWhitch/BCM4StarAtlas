# DR.GPT — инженерная передача BCM4StarAtlas

Дата сверки: 14 ноября 2026  
Репозиторий: https://github.com/ShamanOrWhitch/BCM4StarAtlas  
Рабочая ветка по прямому указанию владельца: main  
Проверенный HEAD на 14 ноября 2026: 92e1ea608bc8fce09ed5b9ffe1705825d7919320  
Текущие версии из исходников: Mini-Sim 0.14.0; Tower 0.2.79.

Этот документ — долговременная передача контекста для GPT, SYNTX, Grok и других AI-агентов проекта. Он не заменяет сверку актуального кода, Git-коммитов, Issues и PR перед каждой задачей. При расхождении этого документа с более свежим прямым указанием владельца приоритет имеет указание владельца; при расхождении с текущим кодом приоритет имеет код и Git-история.

---

## 0. Текущий baseline и работа при недоступном Shell

### Проверенный baseline main (14 ноября 2026)

- `main`: `92e1ea608bc8fce09ed5b9ffe1705825d7919320` — `docs(minisim): record complete 0.14.0 local verification`.
- Исходники подтверждают Mini-Sim `0.14.0` (`mini-sim/bcm-mini-sim.php`) и Tower `0.2.79` (`mini-sim/tower/bcm-tower.php`).
- Более ранняя строка HEAD `cb4ead0` / Mini-Sim `0.12.13` ниже заменена этим актуальным baseline. Исторические упоминания 0.12.x в журнале не являются текущей версией.
- После этой сверки каждый агент обязан повторно получить актуальный `main` SHA. Этот документ не заменяет Git reconcile.

### Shell, полномочия и fallback

- Shell — возможность конкретной платформенной сессии, а не настройка репозитория. Если SYNTX/Dr Fable не показывает Shell-инструмент или его вызовы зависают без результата, DR GPT не может включить его настройкой GitHub или изменением файла. Это должен исправить поставщик/администратор самой платформы.
- Диагностика: один вызов `pwd` и один `node -v`, если инструмент доступен. При повторном tool-level отказе — `SHELL-UNAVAILABLE`, остановить повторы и не смешивать его с Node, сетью, HTTP 403, отсутствующим Chromium или GitHub permissions.
- По текущему прямому указанию владельца DR GPT с подключённым GitHub write-инструментом — единственный writer. Остальные модели/агенты (включая Dr Fable и возможный Einstein) работают read-only: анализируют, тестируют при доступности своих инструментов и передают конкретные замечания; не создают конкурирующие коммиты.
- Writer может читать/изменять текст через GitHub API без локального Shell. Проверки запускаются существующими GitHub Actions на точном commit SHA; writer получает статусы и логи и сообщает только фактические результаты. Если GitHub content-write/API отказывает, задача получает `GITHUB-WRITE-UNAVAILABLE` — не нужно изображать локальную запись.
- Для Mini-Sim используй `npm run test:minisim` и `npm run qa:minisim:standalone` в подходящей среде/CI. Не запускай корневой `npm run dev` в ожидании Mini-Sim: он относится к Galia.
- Live WordPress browser QA остаётся отключённым до отдельного прямого разрешения владельца. Одиночный HTTP 200 от curl не является Playwright PASS и не меняет это правило. Firewall/anti-bot и production WordPress не менять.

---

## 1. Главные директивы владельца

### 1.1 Работа непосредственно в main

Владелец прямо установил: работаем в main. Не создавать feature-ветки, временные ветки и Pull Request как обязательный путь. Сначала reconcile и WORK LOCK, затем небольшой согласованный патч непосредственно в main и commit. Не переписывать историю, не делать force-push и не удалять чужие коммиты.

- Одновременно только один агент имеет право записи (writer).
- Остальные агенты — read-only reviewer/tester; не редактируют те же файлы параллельно.
- Перед записью проверить актуальный main HEAD, Issues, PR, изменяемые файлы и возможное пересечение.
- Не затирать незакоммиченные изменения другого агента. Если есть риск конфликта — остановить запись и согласовать передачу.
- PR и старые ветки использовать как источники diff/истории. Не сливать их целиком без прямого разрешения.
- Каждый commit в main может инициировать Render deploy: корневой render.yaml указывает branch main и autoDeployTrigger: commit. Даже документационный commit потенциально запускает деплой.

### 1.2 Полный AUDIO FREEZE

Никакой новой разработки звука, музыки, саундтреков, OST, звуковых эффектов, голосов, озвучки, синтеза речи, аудиогенерации или аудиосистемы. Не открывать аудионаправление «заодно» с игровой задачей.

Существующие аудиофайлы и код не удалять и не переписывать: они заморожены, а не отменены. Если старые Issues/PR включают звук, отделять аудиочасть и помечать её OUT OF SCOPE — AUDIO FREEZE. Не включать звук/музыку/голоса в новые критерии приёмки и не расходовать тестовый бюджет на новые аудиосценарии. Существующие аудио-проверки не расширять и не удалять без отдельной задачи.

### 1.3 Защищённые области

Без отдельного прямого разрешения владельца не изменять:

- wordpress/galia-desk/ — Galia Desk, сканер, таблица цен, holdings, wallet, рыночные данные и связанные экраны;
- настройки firewall, anti-bot и защиты walkingyog.com;
- реальные wallet write paths, Phantom signing и транзакции SAGE;
- production WordPress и его файлы/настройки.

Режим проекта по Star Atlas — read-only данные Crew/NFT и симуляция. Не добавлять реальные перемещения флотов, транзакции или торговые действия.

### 1.4 Запрет на бесполезный live QA

Владелец попросил полностью отключить автоматическую проверку страницы https://walkingyog.com/bcm4sa/ через GitHub Actions. Anti-bot/HTTP 403 блокировали автоматические запросы, прежний тест мог ждать до 45 минут и не проверял игру.

Не восстанавливать этот workflow, не обходить firewall, не повторять blocked URL и не рекомендовать ежедневные обновления security-плагинов как обход CI. HTTP 403, сеть или timeout — BLOCKED-ENVIRONMENT, не игровой FAIL и не PASS.

Сохранены локальные проверки исходников и standalone browser QA на локальной HTTP fixture.

---

## 2. Роль AI-агента

Ты — инженерный агент BCM4StarAtlas, а не только советчик. Если в текущей среде реально доступны GitHub read/write-инструменты, используй их напрямую, не проси владельца скачивать весь проект на Windows. Не утверждай наличие доступа, пока не проверил именно свою авторизацию и permissions.

Обязательные правила:

1. Сначала читаешь актуальный код и историю, затем предлагаешь или вносишь изменение.
2. Не выдумываешь состояние файлов, результаты тестов, права, возможности платформы и браузерные проверки.
3. Публичное чтение GitHub не равно записи. Перед записью проверяешь права.
4. Не переписываешь крупные модули ради точечного исправления.
5. Сохраняешь существующие контракты, состояния, seed, обратную совместимость и работающие сценарии.
6. Не создаёшь тяжёлые медиа/ассеты как замену рабочему коду.
7. Общение с владельцем — по-русски, конкретно и без лишней теории.
8. Отделяешь подтверждённое поведение от исторических пожеланий и предположений.

---

## 3. Что такое BCM4StarAtlas

BCM4StarAtlas (Best Crew Missions 4 Star Atlas) — симулятор/конфигуратор Crew и миссий Star Atlas плюс связанная последовательность локальных аркадных игровых миров.

Главная идея владельца: разные игры и миры должны ощущаться частями одной экспедиции. Переходы между ними — часть геймплея, а не запуск несвязанных демо. Игровые состояния, seeds, корабль, Crew и прогресс должны сохраняться там, где этого требует сценарий.

Основные направления:
- 6DOF-полёт и управление кораблём;
- Warp: выбор направления/сектора, туннель и скоростной маршрут;
- seeded asteroid maze: процедурный 3D-граф клеток;
- Ring: 2.5D/side-view прохождение внутри того же астероида;
- Tower: seeded WebGL/Three.js игра, локальный Single и split-screen Multi;
- Hull Dive: экипаж, аварии, отсеки, повреждения и ремонт;
- First Planet: остров, корабли, Desert Island и Shoal Race;
- read-only Crew/NFT данные и ограниченный read-only SAGE context.

Это не официальный SAGE-клиент и не средство управления реальным флотом.

---

## 4. Карта репозитория

Репозиторий: ShamanOrWhitch/BCM4StarAtlas.

- mini-sim/ — основной WordPress Mini-Sim и связанные игровые подсистемы.
- mini-sim/assets/js/mini-sim.js — ядро Mini-Sim, запуск, состояние и переходы.
- mini-sim/assets/js/deep-space-warp.js — Deep Space/6DOF/Warp и маршруты.
- mini-sim/assets/js/hull-dive.js — Hull Dive, экипаж и аварийные системы.
- mini-sim/assets/js/crew-core.js и crew-wallet.js — общие данные/визуализация Crew, read-only wallet context.
- mini-sim/tower/ — Tower и WordPress-интеграция.
- mini-sim/tower/assets/js/tower.js — Tower runtime, управление, игровая логика.
- mini-sim/tower/bcm-tower.php — интеграция Tower/First Planet и версия.
- mini-sim/tower/first-planet/ — отдельное приложение First Planet; исходники в src/, WordPress bundle в wp-dist/.
- mini-sim/assets/mesh/ships/catalog.json — общий каталог корабельных моделей и состояний.
- scripts/ — source/regression и standalone browser QA.
- .github/workflows/ — CI и тестовые workflows.
- wordpress/galia-desk/ — отдельный Galia Desk (карта, Crew, флот, цены, сканер); не смешивать его с Mini-Sim.

Корневой README и проектные документы указывают порядок чтения. Для Mini-Sim обязательно читать mini-sim/AGENTS.md, mini-sim/WORK_COORDINATION.md, mini-sim/PROJECT_STATE.md, mini-sim/DECISIONS.md и актуальный HANDOFF.

---

## 5. Проверенный baseline и уже сделанная работа

### 5.1 HEAD и версии

На момент актуальной сверки `main` HEAD:
`92e1ea608bc8fce09ed5b9ffe1705825d7919320` — запись завершённой локальной проверки Mini-Sim 0.14.0.

Версии прочитаны непосредственно из исходников:
- Mini-Sim `0.14.0` — `mini-sim/bcm-mini-sim.php`;
- Tower `0.2.79` — `mini-sim/tower/bcm-tower.php`.

Это baseline на 14.11.2026, а не обещание, что HEAD не изменился после этой даты. Перед каждой задачей повторно проверь GitHub `main`, коммиты, Issues/PR и содержимое файлов. Не используй старую шапку передачи как замену reconcile.

### 5.2 Недавние коммиты, которые нельзя случайно откатить

- cb4ead0 — отключён автоматический live WordPress Mini-Sim browser QA.
- 7380e6c — неактивные корабельные турбины полностью выключены.
- 6d7bf3f — выровнено смещение камеры Opal cockpit по локальной оси корпуса.
- e8cf0fc — исправления управления кораблями, Max Hog thrust и First Planet inventory.
- c4754e0 — подключены parked/flight hull states для корабельного каталога (PR #108).

По пользовательским сообщениям о камере Opal, пересадке и активных соплах уже есть соответствующие source commits. Не объявлять эти проблемы открытыми автоматически. Проверять текущий код и конкретный новый сценарий. USER-CONFIRMED без сообщения владельца или реального доказательства не ставить.

### 5.3 Каталог кораблей — PR #108 / Issue #107

Issue #107 закрыт, PR #108 merged в main:
- общий каталог содержит 37 семейств и 240 существующих GLB;
- для семейства заданы parked и flight формы; одиночная модель может использоваться в обоих состояниях;
- Mini-Sim first-person picker использует каталог;
- First Planet использует тот же каталог: малые/очень малые корабли размещаются на острове, средние/крупные/Titan — на orbital showcase;
- при движении и посадке/остановке выбирается соответствующая форма;
- сохранены отдельные demo rigs Packlite, Mamba, Mamba EX и Pearce F4;
- Rainbow camouflage и старые панели не переписывать без отдельного подтверждённого дефекта.

Визуальная/живая проверка на production WordPress и физическом устройстве не следует автоматически из source CI.

---

## 6. Backlog: открытые задачи, сверенные с GitHub

Открытая Issue или PR — не доказательство, что всё в ней ещё не реализовано. Перед продолжением открыть текущий diff, сверить main и acceptance. Не выполнять смешанные аудиозадачи.

### Issue #104 / PR #105 — Desert Island и Shoal Race

Использовать уже загруженные mesh packs для поселения Desert Island и прибрежного оформления Shoal Race. Цель — разнообразные кактусы, кусты, камни, песчаниковые/храмовые ориентиры, рынок, оазис/цветы, маяк, пальмы, буйки, скалы, dock/boat/islets и ограждения трассы.

Ограничения из Issue/PR:
- использовать существующие GLB без дублирования/переэкспорта;
- deterministic isolated seed streams для декора;
- декор не должен менять маршрут, ширину трассы, pickup, физику, collision, spawn, quests или переходы;
- необязательные модели загружать небольшими пакетами; отсутствие декора не должно блокировать старт;
- повторяющиеся объекты instancing/merged meshes с контролем draw calls;
- проверять source regression, First Planet bundle/package и допустимый standalone browser path.

PR #105 открыт; в его описании source/regression и package проверки отмечены PASS, но визуальная проверка нового оформления на браузере/устройстве и live WordPress не подтверждены. Сверить PR #105 с текущим main; не делать blind merge.

### PR #110 — fail-fast для blocked live preflight

PR #110 добавляет ограниченный preflight timeout и BLOCKED_ENVIRONMENT, тест контракта и документацию. Main уже отключил live WordPress QA. Поэтому сравнить изменения с текущим main: часть задачи может быть избыточной. Не восстанавливать live probes. Сохранять локальный standalone runner и source regression.

### Issue #97 — Tower ↔ First Planet ↔ Space Labyrinth

Общий локальный session/context и настоящий цикл переходов:
- сохранить исходный session seed, корабль, экипаж, позу/ориентацию, навигационный контекст и прогресс;
- Tower сохраняет собственный seed;
- First Planet получает детерминированный seed;
- вход на планету и назад в Tower ведёт к тому же Tower seed/маршруту;
- обратный выход возвращает исходный Space Labyrinth, а не новый случайный старт;
- сохранить offline Single и local split-screen Multi.

Это local one-browser flow, не сетевой multiplayer. Аудиопункты Issue #97 полностью OUT OF SCOPE — AUDIO FREEZE. Не добавлять FP/Desert Race soundtrack и не тестировать аудиочасть.

### Issue #67 — Tower City и возврат на исходный корабль

Нижняя городская зона — осознанное продолжение вниз за низ башни, не death/reset. Затем обратный подъём по той же seeded Tower geometry. У выхода — добровольный выбор вернуться на первоначальный ship/session, восстановив snapshot: ship, pose/orientation, sector/navigation, Crew и игровое состояние.

Архитектурный блокер: Tower и Mini-Sim имеют отдельные renderer/state lifecycle; передача в Tower очищает Mini-Sim resources. Нужно выбрать/проверить один контракт:
A) suspend/park исходный мир с оценкой GPU-памяти на слабом Android;
B) сохранить компактный snapshot и восстановить мир при возвращении.

Не делать фальшивый возврат в Room 1 или новый случайный seed. Не создавать новые Crew textures; использовать CrewCore и существующий cutout cache.

### Issue #68 — Anomalous Astral Layer в астероиде

Развить существующие верхние/нижние Y-cells в аномальный слой, но сохранить исходный seeded maze graph. Не создавать второй route RNG или дублирующий лабиринт.

Возможные эффекты ячеек: gravity, timing, traversability, perception. Нужны ясные подсказки и гарантированный путь входа/выхода, кроме явной terminal cell. 3D wall и 2.5D Ring map должны использовать одинаковые wall asset/rotation. Сохранять согласованность 3D flight и 2.5D cell view.

### Issue #43 — Hull Dive и Ring platformer

Исторические игровые требования:
- bounded smoke/bubbles; плотность пузырьков соответствует уровню воды;
- один gamepad по умолчанию управляет P2, не перехватывая keyboard P1; два gamepad назначаются отдельно;
- pointer/touch drag/hold Crew для перемещения, pump и weld;
- collision damage учитывает силу удара и cooldown, а не каждый кадр;
- состояние отсеков, пробоины, вода и ремонт отображаются понятно;
- ограниченное притяжение к Ring в астероидной сцене;
- отдельный 2D side-scrolling Ring platformer с core shards и явным выходом в ship.

Все аудиочасти Issue #43, Tower OST/mute, Ring OST и любые MP3 — OUT OF SCOPE. В Issue описаны пересечения исторических веток с tower.js и mini-sim.js; перед работой сверять открытые PR #14/#18 и текущие файлы. Не использовать старую ветку как актуальную базу без diff reconciliation.

### Issue #48 — сетевой co-op

Это архитектурный backlog, а не готовый multiplayer. Требования: server-authoritative session/world state, несколько одновременно живущих seeded location instances, sequenced input/tick IDs, bounded snapshots, interpolation, interest management, RTT/ping, reconnect/rejoin tokens и exponential backoff.

Local split-screen остаётся независимым. Первую реализацию изолировать за отдельным модулем и тестировать fake clients. Не заявлять multiplayer-ready до реальной проверки. Учесть Render Free Frankfurt: cold start, ограничение инстансов и ephemeral filesystem. Никаких wallet writes/on-chain movement.

### Issue #28 — read-only SAGE map/fleet context

Mini-Sim остаётся симулятором. Нельзя добавлять Phantom signing, transaction writes, реальные fleet movements, inventory withdrawals или marketplace actions.

Возможное направление — лёгкая 2D карта/sector view и optional read-only SAGE sync при наличии проверенного источника. Различать observed data, derived estimates и local placeholder. Старый фиксированный reference: ONI CSS / NEUNO / X=-40 / Y=30; численные координаты не подменять. Четыре локальных соседа Warp preview — не реальные SAGE sectors. Не копировать тяжёлый 3D Galaxy Viewer; использовать существующий Canvas/SVG подход.

### Issue #70 — Warp reverse flow + Tower P2

Основной source fix в PR #88 merged: обратный Warp flow и Tower P2 controls (arrows move, Right Ctrl jump, Right Shift act). Исторические source checks прошли, но Issue открыт для пользовательского подтверждения после deployment. Live WordPress автоматические прогоны отключены: не повторять прежний 403 маршрут. Новый статус брать только из свежего реального playtest.

### Открытые PR, которые нельзя вслепую вливать

На момент проверки:
- #92 — draft Ring/Tower browser playthrough QA;
- #61 — старое Ring cutaway syntax fix;
- #18 — старые Room0/Home/global mute QA изменения;
- #14 — Crew cutout/matte; пересечения с Tower/Mini-Sim;
- #3 и #2 — исторические версии Mini-Sim.

Открытый PR не блокирует весь проект, но его изменённые файлы могут пересекаться. Сверять patch и base SHA. Не сливать старые ветки целиком. Аудиочасти не выполнять.

---

## 7. Исторические контракты управления — всегда перепроверять в актуальном коде

Это ориентиры из прошлых решений, а не повод переносить старые input handlers вслепую:
- Tower seeded WebGL/Three.js; local Single и split-screen Multi.
- Tower P2: arrows move, Right Ctrl jump, Right Shift act; не возвращать старый X jump.
- Warp: V — вход в Warp; исторически первый полёт использовал WASD, U, mouse look и middle-click для освобождения курсора. Gamepad/touch проверять отдельно.
- Ring/asteroid historical contract: Space/W jump; E follow/open door; R change floor at vertical hatch; gamepad A jump, X door, LB floor, Y fire, B dash.
- Пользователь предпочитает короткие понятные подсказки управления с конкретными действиями и целью, а не абстрактные стрелки/стики или постоянно видимую стену букв.

Перед изменением управления сверить реальные handlers, device mapping и тесты current main.

---

## 8. NFT, Crew, wallet, SAGE и игровые данные

- Crew/NFT и wallet context только read-only.
- Не запрашивать seed phrase/private key и не добавлять transaction signing.
- Любое движение в Mini-Sim — локальная симуляция; не показывать его как настоящее перемещение в SAGE.
- Не выдавать локальную test grid или неполный секторный список за официальную galaxy topology.
- OCEAN/traits и коэффициенты симулятора не являются официальной формулой SAGE, если нет подтверждённого источника.
- Уникальные Crew/NFT metadata могут быть вне Galaxy /nfts; проверять существующие adapters и источники до изменения.
- Не придумывать отсутствующие координаты и fleet states.

---

## 9. Производительность и устройство

Владелец использует старый Windows 10 x64 ноутбук HP Pavilion dv7, i7, 16 GB RAM, AMD Radeon HD 6770M 2 GB + Intel HD 3000. Нужны осторожные решения для старого железа и телефонов:
- не добавлять второй WebGL renderer/context без необходимости;
- ограничивать draw calls, использовать instancing/merged meshes;
- lazy-load optional assets и большие модели;
- избегать крупных новых библиотек и тяжёлых runtime allocations;
- сохранять low-quality/fallback путь, не ломая shader-unsupported модели;
- не считать визуальный shader/camouflage обязательным преимуществом железа;
- mobile, touch и gamepad — отдельные input/performance поверхности.

---

## 10. Протокол разработчиков и тестировщиков

### Роли

1. Implementer — единственный writer в конкретной задаче; делает минимальный патч, тест и commit.
2. Independent reviewer/critic — read-only, ищет ошибки и нарушения границ, не исправляет собственную проверку.
3. Source tester — syntax/lint/unit/source regression и GitHub Actions.
4. Browser tester — допустимый standalone Chromium path и конкретные сценарии.
5. Release/report — сводит результаты, обновляет проектные записи.

Если отдельных агентов нет, один агент может провести несколько видов проверок, но обязан написать, что независимой проверки не было.

### Лимит критика

На ответ reviewer/critic ждать максимум 8 минут. После этого отметить TIMEOUT или SKIPPED, указать причину и продолжить доступные проверки. Не подвешивать разработку и не ждать десятки минут.

### Статусы

- IMPLEMENTED — код/изменение присутствует; тестирование не подразумевается.
- TESTED-CODE — конкретные автоматические проверки прошли на указанном SHA.
- VERIFIED-LIVE — поведение подтверждено в конкретной production/live среде; указать URL/версию/сценарий.
- USER-CONFIRMED — владелец подтвердил определённый сценарий.
- OPEN — подтверждённый дефект/незавершённая задача.
- NEEDS-USER-STATUS — нужен один точный ответ владельца, недоступный из кода/CI.
- BLOCKED — отсутствует необходимый доступ, файл или сервис.
- BLOCKED-ENVIRONMENT — сеть, firewall, anti-bot, HTTP 403 или среда блокируют проверку.
- TIMEOUT — агент/reviewer не ответил в лимит.
- SKIPPED — проверка сознательно пропущена; причина должна быть указана.
- REOPENED — ранее закрытая задача вернулась с новым воспроизводимым evidence.
- SUPERSEDED — требование/решение заменено более новым.
- OUT OF SCOPE — AUDIO FREEZE — звуковые/музыкальные/голосовые задачи.

Молчание владельца не равно USER-CONFIRMED и не является доказательством провала. Не возвращать старую задачу в OPEN без нового evidence.

### Тестовый маршрут и дневной счётчик

Каждый тестовый цикл записывает:
- дату/время и commit SHA;
- путь тестирования: source, regression, CI, standalone Chromium, live site, phone/controller/manual;
- конкретный игровой сценарий и путь;
- число попыток и фактический результат;
- все ошибки, отказы, HTTP/network failures, 403, timeouts;
- все проверки, которые пропущены/заблокированы, с причиной;
- путь, снятый с эксплуатации, чтобы не запускать бесполезный тест повторно.

После детерминированного 403 пометить live path BLOCKED/RETIRED. Не повторять без изменившихся условий и прямого разрешения. Не путать blocked environment с gameplay failure.

### Доступные проверки репозитория

В корневом package.json:
- npm run test:minisim — Mini-Sim source/regression tests.
- npm run qa:minisim:standalone — standalone Chromium на local HTTP fixture с repository JS/CSS/assets.
- npm run qa:minisim — старый URL-based runner; НЕ использовать для live walkingyog.com/bcm4sa после решения владельца об отключении live QA.

Standalone browser не проверяет реальный WordPress PHP markup, production assets/cache, внешние API и физические устройства. Отчёт обязан отделять:
1. static/source checks;
2. unit/regression checks;
3. standalone browser automation;
4. production/live WordPress;
5. physical phone/controller/gamepad playtest.

Не заявлять более высокий уровень, чем реально проверен.

### Ref 2

Владелец упоминал отдельную систему/референс Ref 2 с чёткими агентами тестирования. В доступном контексте подтверждены: роли critic/tester, 8-minute critic timeout, TIMEOUT/SKIPPED, фиксация всех отказов/ошибок и test-path дневной счётчик. Полная исходная спецификация Ref 2 не восстановлена из репозитория на дату этой передачи. Не придумывать её детали; дополнить этот раздел только после получения первоисточника от владельца или из передачи другого агента.

---

## 11. Формат отчёта по каждой задаче

- WORK LOCK / этап и точная цель.
- Baseline main SHA до изменения и commit SHA после.
- Reconcile: прочитанные файлы, commits, Issues и PR.
- Статус до работы.
- Изменённые файлы и минимальный scope.
- Что изменено и почему.
- Проверки: точные commands/workflow IDs, результат и SHA.
- Independent reviewer: findings или TIMEOUT/SKIPPED (ожидание не более 8 минут).
- Что не проверено: live WordPress, physical device, gamepad и т.п.
- Все блокировки/отказы и test-path counter.
- Один следующий безопасный шаг.

После существенной работы обновлять PROJECT_STATE.md, DECISIONS.md, WORK_COORDINATION.md и при необходимости HANDOFF.md. Не переписывать историю с нуля: добавлять краткие актуальные записи в начало, старые записи оставлять историческими. Записывать commit SHA и evidence.

---

## 12. Стартовый промт новому агенту

Ты — инженерный AI-агент BCM4StarAtlas. Прочитай mini-sim/DR_GPT_HANDOFF.md полностью. Затем проверь собственный доступ к GitHub и текущий main HEAD. Прочитай mini-sim/AGENTS.md, WORK_COORDINATION.md, PROJECT_STATE.md, DECISIONS.md, HANDOFF.md. Открой актуальные Issues и PR и сравни diff с main. Не полагайся на старые чаты или версии.

Работай прямо в main — это прямое указание владельца от 14.11.2026. Не создавай ветки и PR без нового прямого разрешения. Перед первым изменением reconcile и WORK LOCK; один writer, остальные агенты read-only. Учитывай Render autoDeployTrigger: commit.

Полный AUDIO FREEZE: не разрабатывать звуки, музыку, OST, эффекты, голоса или аудиосистему. Существующее аудио не удалять — только оставить замороженным.

Не изменяй wordpress/galia-desk, scanner/pricing, firewall, security settings, production WordPress, wallet writes или SAGE transactions. Не запускай live test против walkingyog.com/bcm4sa. Используй source regression и standalone local browser fixture.

Критик ждёт максимум 8 минут, затем TIMEOUT/SKIPPED. Записывай ошибки, отказы и все test paths в дневной счётчик. Разделяй IMPLEMENTED, TESTED-CODE, VERIFIED-LIVE и USER-CONFIRMED.

Сначала подготовь карту текущего состояния и backlog без изменений кода. В качестве проверенных исходных данных: main HEAD cb4ead0418bfcf99f4b3a808bfdb09ce507e3ec3; Mini-Sim 0.12.13; Tower 0.2.79; Issue #107 / PR #108 merged; каталог 37 ship families / 240 GLB; commits по Opal cockpit, ship controls и inactive thrusters уже в main. Issues #104, #97, #67, #68, #43, #48, #28, #70 и открытые PR требуют сверки с current main. Не повторяй старое исправление без нового evidence.

---

## 13. Ссылки

- Repo: https://github.com/ShamanOrWhitch/BCM4StarAtlas
- Main baseline: https://github.com/ShamanOrWhitch/BCM4StarAtlas/commit/cb4ead0418bfcf99f4b3a808bfdb09ce507e3ec3
- Project agent instructions: https://github.com/ShamanOrWhitch/BCM4StarAtlas/blob/main/mini-sim/AGENTS.md
- Current state: https://github.com/ShamanOrWhitch/BCM4StarAtlas/blob/main/mini-sim/PROJECT_STATE.md
- Decisions: https://github.com/ShamanOrWhitch/BCM4StarAtlas/blob/main/mini-sim/DECISIONS.md
- Work coordination: https://github.com/ShamanOrWhitch/BCM4StarAtlas/blob/main/mini-sim/WORK_COORDINATION.md
- Existing handoff: https://github.com/ShamanOrWhitch/BCM4StarAtlas/blob/main/mini-sim/HANDOFF.md
- This DR.GPT handoff: https://github.com/ShamanOrWhitch/BCM4StarAtlas/blob/main/mini-sim/DR_GPT_HANDOFF.md
- Issue #104 / Desert + Shoal: https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/104
- PR #105 / Desert + Shoal: https://github.com/ShamanOrWhitch/BCM4StarAtlas/pull/105
- PR #110 / QA fail-fast: https://github.com/ShamanOrWhitch/BCM4StarAtlas/pull/110
- Issue #97 / local transitions: https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/97
- Issue #67 / Tower City: https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/67
- Issue #68 / Astral layer: https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/68
- Issue #43 / Hull Dive + Ring: https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/43
- Issue #48 / network co-op: https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/48
- Issue #28 / SAGE read-only map: https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/28
- Issue #70 / Warp + Tower P2 follow-up: https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/70

## 14. Ограничения достоверности

Эта передача сверена с main на указанном SHA 14.11.2026. Если HEAD изменился, сначала повторить reconcile. Некоторые описания backlog взяты из открытых Issues/PR и исторических пользовательских обсуждений; они не утверждают, что соответствующий дефект сейчас воспроизводится. Статус тестирования не повышать без реального evidence. Точный формат Ref 2 нужно дополнить по исходному материалу, а не догадками.