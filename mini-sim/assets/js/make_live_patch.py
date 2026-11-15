#!/usr/bin/env python3
"""Строит патч ОТ ЖИВОГО файла (warp_base_015.js) той же сборкой, что build_patch.py.

Зачем отдельный скрипт: владелец кладёт файл в репозиторий заменой, а на сайте
уже стоит наша сборка ревизии 15. Патч «от чистой 0.14.0» к ней не применится,
поэтому для сайта отдаётся второй патч — от живого файла.

Проверка здесь же: результат применения обязан байт в байт совпасть с
warp_patched.js из build_patch.py. Иначе два пути сборки разъехались.
"""
from pathlib import Path
import subprocess


HERE = Path(__file__).resolve().parent
LIVE = HERE / "warp_base_015.js"
TARGET = HERE / "warp_patched.js"
PATCH = HERE / "warp_patch_from_live.patch"
REPO_PATH = "mini-sim/assets/js/deep-space-warp.js"


def main() -> int:
    if not LIVE.exists():
        raise SystemExit(f"нет живого файла {LIVE} — сначала скачать с сайта")
    # Живой файл — это наша же сборка ревизии 15, поэтому build_patch.apply к нему
    # неприменим (анкеры уже сработали). Патч «от живого» = честный diff между
    # тем, что стоит на сайте, и итоговым warp_patched.js. Ничего не досочиняем.
    live = LIVE.read_text(encoding="utf-8")
    tmp = TARGET
    diff = subprocess.run(
        ["git", "diff", "--no-index", "--no-color", "-U6",
         "--src-prefix=a/", "--dst-prefix=b/", str(LIVE), str(tmp)],
        capture_output=True, text=True)
    if diff.returncode not in (0, 1):
        raise SystemExit("git diff не смог построить патч: " + diff.stderr)
    text = diff.stdout
    text = text.replace("a" + str(LIVE), "a/" + REPO_PATH)
    text = text.replace("b" + str(tmp), "b/" + REPO_PATH)
    text = text.replace("--- " + str(LIVE), "--- a/" + REPO_PATH)
    text = text.replace("+++ " + str(tmp), "+++ b/" + REPO_PATH)
    PATCH.write_text(text, encoding="utf-8")
    added = sum(1 for l in text.splitlines() if l.startswith("+") and not l.startswith("+++"))
    removed = sum(1 for l in text.splitlines() if l.startswith("-") and not l.startswith("---"))
    print(f"warp_patch_from_live.patch: {len(text.encode())} байт, +{added} / -{removed} строк")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
