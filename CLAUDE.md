# CLAUDE.md — BCM4StarAtlas (Claude Code)

Этот файл читает Claude Code. Корневой `AGENTS.md` — контракт песочницы Grok Build (`/workspace`, порт 8080, `startup.sh`); к работе Claude Code на этой машине он **не относится**. Правила проекта для всех агентов — в `mini-sim/AGENTS.md`, он подключён ниже и обязателен.

## Роль Claude Code

- Указание владельца от 15 ноября 2026 (WORK LOCK [#115](https://github.com/ShamanOrWhitch/BCM4StarAtlas/issues/115)): Claude Code — главный инженер-механик проекта, с правом читать и писать в `main`.
- **Других помощников не ущемлять.** DR GPT, Dr Fable, Grok и остальные сохраняют свои роли. Не переписывать и не откатывать их коммиты без нового воспроизводимого свидетельства. Не удалять их WORK LOCK и записи в журналах.
- Один writer на одни и те же файлы одновременно. Перед записью: `git pull --ff-only`, проверить открытые WORK LOCK. Если чужой lock покрывает те же файлы и обновлялся недавно — согласовать комментарием в Issue, а не писать поверх.
- Отвечать владельцу по-русски, в продуктовых словах. Формат отчёта по задаче — конец `mini-sim/AGENTS.md`.

## Обязательный цикл (коротко)

1. **Reconcile** — `/reconcile`. Хук SessionStart уже дал сводку: HEAD, коммиты после среза журналов, статусы BUG-ов, WORK LOCK, CI для HEAD.
2. **WORK LOCK** — до первой правки кода: `node .claude/tools/gh.mjs open-lock "<задача>" <файл с описанием>`.
3. **Категория** — идея / баг / комплектация. Не смешивать (`/idea`, `/bug`, `/kit`).
4. **Красный тест сначала** — интеграционный, падающий по нужному состоянию, не по отсутствию функции. В отчёт — текст ассерты до и после.
5. **Правка → проверки → commit в `main` → push → `/ci`.** PASS пишется только по факту, с SHA и ссылкой на run.
6. **Журналы** — обновить нужный журнал, а при смене поведения ещё `PROJECT_STATE.md`/`DECISIONS.md` с SHA. Stop-хук напомнит, если код поменялся, а журнал нет.
7. **Закрыть свой WORK LOCK** итоговым комментарием (`gh.mjs close <n> <файл>`).

## Защищённые зоны (без отдельного прямого разрешения владельца — нельзя)

- **AUDIO FREEZE:** никакой новой работы со звуком, музыкой, OST, эффектами, голосами, аудиокодом. Существующее не удалять.
- `wordpress/galia-desk/**`, scanner/pricing, firewall/security, production WordPress, запись в кошелёк, транзакции SAGE.
- Live-QA walkingyog.com не включать и не обходить 403. Workflow `minisim-browser-qa.yml` выключен (`on: []`) намеренно — его красный статус не баг.
- Не добавлять тяжёлые библиотеки/ассеты, второй WebGL-контекст; не менять публичные события, API и WordPress-контракт без задачи.
- Не создавать ZIP внутри артефакта Actions (см. §0 `mini-sim/AGENTS.md`).
- Только `main`: без feature-веток и новых PR. Ветки `backup/*` — архив.
- Каждый push в `main` запускает автодеплой Render (`render.yaml`: `branch: main`, `autoDeployTrigger: commit`), даже документационный. Это сервис `bcm4staratlas` — корневое приложение Galia (`npm run build`, free plan), **не** WordPress на walkingyog.com. Так работает каждый коммит любого агента. Пушить реже: копить мелкие правки в один push.
- Запрещённые команды (уничтожают незакоммиченное): `git reset --hard`, `git checkout .`, `git restore .`, `git clean`; не амендить запушенное. Перед стартом проверять `git status --short` — чужое незакоммиченное не трогать.
- Версия поднимается только после зелёных тестов, не перед правкой: тогда «откатить в 0.14.6» всегда означает рабочую сборку.

Правки путей `wordpress/galia-desk/**` и аудиофайлов запрещены в `.claude/settings.json`.

## Команды

| Что | Команда |
|---|---|
| Регрессия Mini-Sim **ровно как в CI** (синтаксис + 10 файлов, 139 тестов на `737ac88`) | `node .claude/tools/regression.mjs` |
| Узкий набор (6 файлов, 62 теста — не равен CI) | `npm run test:minisim` |
| Браузерный standalone QA (Chromium) | `npm run qa:minisim:standalone` |
| Только переходы | `npm run qa:minisim:transitions:standalone` |
| Один тест | `node --test scripts/<name>.test.mjs` |
| Линт | `npm run lint` |
| WORK LOCK / Issues / Actions | `node .claude/tools/gh.mjs` (без аргументов — справка) |

`npm run dev` поднимает Galia (TanStack), **не** Mini-Sim.

## Особенности этой машины (Windows, G:\BCM4StarAtlas)

- `gh` CLI не установлен (нет winget). GitHub API — через `.claude/tools/gh.mjs`, токен берётся из Git Credential Manager; если его нет — `git credential-manager github login`.
- Git с OpenSSL падает на сертификате (`unable to get local issuer certificate`). В локальном конфиге стоит `http.sslBackend=schannel` и `core.longpaths=true` — не убирать.
- Системный git ставит `core.autocrlf=true`; с CRLF регэкспы в `scripts/minisim-local-qa.test.mjs` падают (тест «Warp OST…»). В этом клоне `core.autocrlf=false`, `core.eol=lf` — с ними `npm run test:minisim` даёт 62/62, а `regression.mjs` 139/139, как в CI. Настройки только локальные (`.git/config`); глобальные и системные не менялись.
- Python не установлен: скрипты `*.py` в `mini-sim/assets/**` локально не запускаются.
- Bash-инструмент — Git Bash; PowerShell 5.1 без `&&`.

## Источники истины

@mini-sim/AGENTS.md

Подробнее по запросу: `mini-sim/WORK_COORDINATION.md`, `mini-sim/PROJECT_STATE.md`, `mini-sim/DECISIONS.md`, `mini-sim/DR_FABLE_PLAYBOOK.md`, журналы `mini-sim/JOURNAL_{BUGS,IDEAS,KIT}.md`.
