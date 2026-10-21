# Параллельная работа агентов — BCM4StarAtlas / Mini-Sim

> Это постоянный протокол координации, а не журнал игровых багов. Прочитать **до любой правки** вместе с `AGENTS.md`, `PROJECT_STATE.md` и `DECISIONS.md`.

## Главный принцип

Git — память выполненной работы; журнал решений — память того, почему решение принято и насколько оно проверено; GitHub Issues — общий видимый реестр активных задач; отдельные ветки — изоляция незавершённых изменений.

Разные модели могут работать в разных лабораториях и не видеть незакоммиченный код друг друга. Изменение становится доступным другим агентам только после публикации коммита/ветки или обновления общего Issue. Сообщение «сейчас исправляю» не заменяет общую запись, а незакоммиченный код не может считаться частью синхронизированного контекста.

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

- Current main SHA: 9b4e7b8a2fe842de9418772c33499b63a79c1e18; Mini-Sim 0.9.110, Tower 0.2.64.
- Merged: #46 (Ring menu activation), #49 (Warp visual tiers), #51 (RU/EN dialogs, Ring weapons, inset Hull Dive, longer QA budgets), #52 (bounded network room registry/design).
- Main Mini-Sim regression [39565685006](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39565685006) PASS; Tower top cap [39565684968](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39565684968) PASS; browser smoke on code-identical PR assets [39565526302](https://github.com/ShamanOrWhitch/BCM4StarAtlas/actions/runs/39565526302) PASS. Physical Android/gamepad playtest and production WordPress plugin update remain unverified.
- Network co-op: mini-sim/network/room-registry.mjs is only a tested in-memory room registry; no active WebSocket/server transport yet. The next milestone is Issue #48 (WebSocket/auth/authoritative tick/RTT/reconnect/two-client tests).
- Full SAGE map remains Issue #28. Local Warp grid is not a real SAGE sector graph or actual fleet movement.
- Next user playtest areas: Ring keyboard/gamepad/touch entry; RU/EN language toggle; all four Warp visual previews on phone; laser/pulse/spectrum feel and Master choices; smoke/bubbles visibility and inset Hull size.
- Strict exclusion remains: do not edit wordpress/galia-desk, scanner, pricing/marketplace data/shared assets, planet placement, SAGE navigation adapter or global soundtrack mixer.

