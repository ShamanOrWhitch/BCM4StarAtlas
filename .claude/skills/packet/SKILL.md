---
name: packet
description: Превратить work packet Dr Fable (или задание владельца) в GitHub Issue «WORK LOCK» по формату playbook §5 и взять в работу; или закрыть пакет отчётом с доказательствами. Использовать, когда приходит задание от Fable или владелец говорит «оформи задачу».
argument-hint: "<текст задания> | close <issue#> <sha>"
---

# /packet — задание → WORK LOCK Issue

Вход: $ARGUMENTS

## Открыть

1. Разбери задание на поля playbook §5. Пустое поле не выдумывай — пиши «не задано» и, если оно влияет на правку, задай владельцу один вопрос.

```markdown
**ID / цель:** …
**Источник:** Dr Fable (SYNTX, дата) | владелец (чат, дата)
**Контекст и baseline SHA:** `git rev-parse --short HEAD`, версии Mini-Sim / Tower
**Категория:** баг BUG-NNN | идея IDEA-NNN | комплектация — мини-игра, категория из JOURNAL_KIT
**Что сделать:** …
**Что не трогать:** … + всегда: AUDIO FREEZE, galia-desk, wallet/SAGE, firewall, production WP
**Файлы:** …
**Ожидаемый артефакт:** коммит(ы), тест, скриншоты Crew Lab при изменении вида экипажа
**Критерии приёмки:** красный тест по состоянию → зелёный; соседний случай цел; CI зелёный
**Проверки:** `node .claude/tools/regression.mjs`, нужные `node --test`, Crew Lab (`node tools/crew-lab/shoot.mjs`) для экипажа
```

2. Проверь пересечения: `node .claude/tools/gh.mjs locks`. Чужой свежий lock на те же файлы → комментарий в его Issue, не запись поверх.
3. `node .claude/tools/gh.mjs open-lock "<короткое название>" <файл с текстом>` — заголовок станет `WORK LOCK: …`.
4. Если задание — идея из JOURNAL_IDEAS, поставь ей `TAKEN` со ссылкой на Issue.

## Закрыть

1. `node .claude/tools/evidence.mjs <sha> --since <первый sha> --md > <файл>` и допиши сверху 2–3 строки по-русски: что изменилось для игрока.
2. Не закрывай, пока CI для этого SHA не завершён (`STATUS: RUNNING` → ждать). `FAIL` → чинить, не закрывать.
3. `node .claude/tools/gh.mjs close <n> <файл>`; обнови журналы (`/bug`, `/idea`, `/kit`), `PROJECT_STATE.md` с SHA.
