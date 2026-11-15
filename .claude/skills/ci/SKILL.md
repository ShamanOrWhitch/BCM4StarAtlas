---
name: ci
description: Получить результаты GitHub Actions BCM4SA для SHA (по умолчанию HEAD) — статусы, упавшие шаги, хвост логов, ссылки для журнала. Использовать после push в main и перед тем, как писать PASS.
argument-hint: "[sha]"
---

# /ci — результаты GitHub Actions

SHA: $ARGUMENTS (пусто = HEAD).

1. `node .claude/tools/gh.mjs runs $ARGUMENTS`.
   - Пусто сразу после push — Actions ещё в очереди. Не опрашивать в цикле: проверь ещё раз позже или продолжай работу (проверка не замораживает `main`).
   - `in_progress`/`queued` — не PASS. Так и пиши.
   - `.github/workflows/minisim-browser-qa.yml` = failure — выключенный владельцем live-QA (`on: []`), не баг и не повод чинить.
2. Для каждого `failure`: `gh.mjs jobs <runId>` → упавший шаг → `gh.mjs log <jobId> 200`. Найди первую настоящую ошибку (ассерта, синтаксис, путь), не последний «exit code 1».
3. Отделяй: source/regression (`Mini-Sim regression checks`), standalone Chromium (`Mini-Sim standalone browser QA`), упаковку (`Package Mini-Sim test build`), Tower (`Tower top cap regression`). Зелёный один уровень не доказывает другой.

## Отчёт

```
CI для <sha7>:
- Mini-Sim regression: PASS N/N — <url>
- Standalone Chromium: PASS / FAIL (<ассерта>) — <url>
- Package: PASS, artifact #<id> — <url>
- Tower top cap: …
Не проверено: live WordPress, ручной полёт, телефон/геймпад.
```

Числа тестов бери из лога (`# pass`, `# fail`), а не придумывай. Для журналов давай готовые markdown-ссылки на run.
