#!/usr/bin/env bash
# Поднимает версию Mini-Sim 0.14.0 -> NEW и проверяет, что замен ровно столько,
# сколько ожидается. Запускать из КОРНЯ репозитория, после того как положил файл.
#
# Нужен обязательно: URL ассетов подключаются как `?ver=<константа>`. Если версию
# не поднять, браузер отдаст закэшированный deep-space-warp.js и новых эффектов
# не будет видно вообще — это самая частая причина «положил, а ничего не изменилось».
set -eu
OLD="${1:-0.14.0}"
NEW="${2:-0.14.1}"
PHP="mini-sim/bcm-mini-sim.php"
JS="mini-sim/assets/js/mini-sim.js"
fail=0

check() { # файл, строка, ожидаемое число вхождений
  local file="$1" needle="$2" expected="$3"
  local got
  got=$(grep -o -F "$needle" "$file" | wc -l | tr -d ' ')
  printf '%-42s %-22s ожидалось %s, найдено %s\n' "$(basename "$file")" "$needle" "$expected" "$got"
  [ "$got" = "$expected" ] || fail=1
}

echo "== до замен"
check "$PHP" "Version: $OLD" 1
check "$PHP" "'BCM_MINI_SIM_VERSION', '$OLD'" 1
check "$PHP" "SPACE LABYRINTH — $OLD" 1
check "$JS"  "КОСМИЧЕСКИЙ ЛАБИРИНТ — $OLD" 1
check "$JS"  "SPACE LABYRINTH — $OLD" 1
check "$JS"  'config.version || "'"$OLD"'"' 1

[ "$fail" -eq 0 ] || { echo "раскладка не совпала — ничего не меняю"; exit 1; }

sed -i "s/Version: $OLD/Version: $NEW/" "$PHP"
sed -i "s/'BCM_MINI_SIM_VERSION', '$OLD'/'BCM_MINI_SIM_VERSION', '$NEW'/" "$PHP"
sed -i "s/SPACE LABYRINTH — $OLD/SPACE LABYRINTH — $NEW/" "$PHP"
sed -i "s/КОСМИЧЕСКИЙ ЛАБИРИНТ — $OLD/КОСМИЧЕСКИЙ ЛАБИРИНТ — $NEW/" "$JS"
sed -i "s/SPACE LABYRINTH — $OLD/SPACE LABYRINTH — $NEW/" "$JS"
sed -i "s/config.version || \"$OLD\"/config.version || \"$NEW\"/" "$JS"

echo
echo "== после замен"
check "$PHP" "Version: $NEW" 1
check "$JS"  "SPACE LABYRINTH — $NEW" 1
[ "$fail" -eq 0 ] || { echo "что-то не заменилось"; exit 1; }

echo
echo "Готово: $OLD -> $NEW. Проверка синтаксиса и тестов:"
command -v php >/dev/null 2>&1 && php -l "$PHP" || echo "  php не установлен, пропускаю php -l"
command -v node >/dev/null 2>&1 && node --check "$JS" && echo "  node --check mini-sim.js: OK"
echo
echo "Дальше: npm run test:minisim, затем обнови страницу с жёстким кэшем (Ctrl+F5)."
