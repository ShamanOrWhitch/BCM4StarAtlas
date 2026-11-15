---
name: reconcile
description: Полная сверка BCM4SA перед любой работой — журналы, коммиты после среза, WORK LOCK, CI, статус задачи. Использовать в начале задачи, перед правкой кода и когда владелец говорит «проверь, что сделано».
argument-hint: "[тема или ID: BUG-004, IDEA-010, Warp, Tower…]"
---

# /reconcile — сверка по `mini-sim/AGENTS.md` §1

Тема: $ARGUMENTS (если пусто — общая сверка).

Делай по порядку, без правок файлов:

1. `git pull --ff-only` (если дерево чистое). Запомни HEAD.
2. Прочитай сводку SessionStart-хука; если её нет в контексте — `node .claude/hooks/session-start.mjs`.
3. Прочитай целиком `mini-sim/JOURNAL_BUGS.md`, `JOURNAL_IDEAS.md`; из `JOURNAL_KIT.md`, `PROJECT_STATE.md`, `DECISIONS.md`, `WORK_COORDINATION.md` — только разделы по теме (Grep по ID/мини-игре). Не перечитывай весь репозиторий.
4. Коммиты после строки «Срез чтения» журналов: `git log --oneline <срез>..HEAD`, для релевантных — `git show --stat` и дифф. Название коммита — намерение, не доказательство.
5. `node .claude/tools/gh.mjs locks` — есть ли чужой WORK LOCK на те же файлы; для релевантного — `gh.mjs issue <n>`.
6. `node .claude/tools/gh.mjs runs` — CI для HEAD. Красный `minisim-browser-qa.yml` — выключенный live-QA, не баг.
7. Для темы найди точки входа поиском по символам и сопоставь журнал с текущим кодом.

## Итог (по-русски, коротко)

- **HEAD / версии:** SHA, Mini-Sim, Tower.
- **Что изменилось после среза журналов:** коммиты, затрагивающие тему.
- **Статус темы:** IMPLEMENTED / TESTED-CODE / VERIFIED-LIVE / USER-CONFIRMED / OPEN / NEEDS-USER-STATUS / BLOCKED / REOPENED — с доказательством (файл:строка, SHA, run).
- **Категория:** идея / баг / комплектация.
- **Блокеры:** чужой WORK LOCK, невыбранное решение (например D-054 для BUG-004), защищённая зона.
- **Следующий шаг:** один конкретный, с файлами и проверкой.

Не задавай владельцу вопрос, ответ на который есть в журнале или коммитах.
