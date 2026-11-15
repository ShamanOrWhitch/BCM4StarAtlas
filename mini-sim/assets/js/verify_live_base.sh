#!/usr/bin/env bash
# Проверка, что патч построен РОВНО на том варпе, который сейчас отдаёт сайт.
#
# Что делает:
#   1. скачивает живой deep-space-warp.js (и два соседних игровых файла);
#   2. сверяет md5 с локальной базой warp_source.js;
#   3. применяет warp_space.patch к ЖИВОМУ файлу и сверяет с warp_patched.js;
#   4. проверяет синтаксис результата;
#   5. прогоняет тесты.
#
# Ничего не пишет на сайт, только GET. Один запрос на файл.
set -u
cd "$(dirname "$0")" || exit 1

BASE_URL="https://walkingyog.com/wp-content/plugins/mini-sim"
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
fail=0

say() { printf '%-52s %s\n' "$1" "$2"; }

md5_of() { if command -v md5sum >/dev/null 2>&1; then md5sum "$1" | cut -d' ' -f1; else md5 -q "$1"; fi; }

echo "== 1. скачивание живых файлов"
for f in assets/js/deep-space-warp.js assets/js/mini-sim.js assets/js/hull-dive.js; do
  name="$(basename "$f")"
  code=$(curl -sS -m 45 -A "$UA" -o "$TMP/$name" -w '%{http_code}' "$BASE_URL/$f?ver=0.14.0")
  say "$name" "http=$code bytes=$(wc -c < "$TMP/$name" | tr -d ' ')"
  [ "$code" = "200" ] || fail=1
done

echo
echo "== 2. сверка варпа с локальными ориентирами"
live_md5=$(md5_of "$TMP/deep-space-warp.js")
base_md5=$(md5_of warp_source.js)
installed_md5="$( [ -f warp_base_015.js ] && md5_of warp_base_015.js || echo none )"
say "живой deep-space-warp.js" "$live_md5"
say "чистая база 0.14.0 (warp_source.js)" "$base_md5"
say "наша сборка ревизии 15 (warp_base_015.js)" "$installed_md5"

# Патч, которым проверяем применимость: к чистой базе — полный, к уже
# установленной нашей сборке — только правка дыр.
if [ "$live_md5" = "$base_md5" ]; then
  CHECK_PATCH=warp_space.patch
  say "режим" "живой = чистая 0.14.0, кладём полный патч"
elif [ "$live_md5" = "$installed_md5" ]; then
  CHECK_PATCH=warp_holes_fix.patch
  say "режим" "живой = наша ревизия 15, кладём правку дыр (ревизия 16)"
else
  CHECK_PATCH=warp_space.patch
  say "режим" "живой файл не опознан — сверяем полный патч с базой"
fi

if [ "$live_md5" = "$base_md5" ] || [ "$live_md5" = "$installed_md5" ]; then
  say "итог" "опознан — патч построен на живом файле"
else
  say "итог" "РАЗЛИЧАЮТСЯ — базу нужно пересобрать с сайта"
  fail=1
fi

echo
echo "== 3. патч применяется к живому файлу"
mkdir -p "$TMP/work/mini-sim/assets/js"
cp "$TMP/deep-space-warp.js" "$TMP/work/mini-sim/assets/js/deep-space-warp.js"
if ( cd "$TMP/work" && git init -q . && git add -A >/dev/null 2>&1 \
     && git -c user.email=a@b -c user.name=c commit -qm live >/dev/null 2>&1 \
     && git apply --check "$OLDPWD/$CHECK_PATCH" ); then
  say "git apply --check на живом файле" "OK"
  ( cd "$TMP/work" && git apply "$OLDPWD/$CHECK_PATCH" )
  if cmp -s "$TMP/work/mini-sim/assets/js/deep-space-warp.js" warp_patched.js; then
    say "результат применения" "совпадает с warp_patched.js"
  else
    say "результат применения" "РАСХОДИТСЯ с warp_patched.js"; fail=1
  fi
else
  say "git apply --check на живом файле" "НЕ ПРИМЕНИЛСЯ"; fail=1
fi

echo
echo "== 4. синтаксис"
if node --check warp_patched.js >/dev/null 2>&1; then
  say "node --check warp_patched.js" "OK"
else
  say "node --check warp_patched.js" "FAIL"; fail=1
fi

echo
echo "== 5. тесты"
node --test warp_backdrop_core.test.mjs demo_smoke.test.mjs demo_cycle.test.mjs \
  warp_space_wiring.test.mjs warp_sketch_loader.test.mjs warp_patch_runtime.test.mjs \
  > "$TMP/test.out" 2>&1
summary=$(grep -E "^# (tests|pass|fail)" "$TMP/test.out" | tr '\n' ' ')
if echo "$summary" | grep -q "fail 0"; then
  say "тесты" "$summary"
else
  say "тесты" "ЕСТЬ ПАДЕНИЯ: $summary"
  grep -E "^not ok" "$TMP/test.out" | head -5
  fail=1
fi

echo
if [ "$fail" -eq 0 ]; then
  echo "ИТОГ: база = живой сайт, патч применим, тесты зелёные."
else
  echo "ИТОГ: есть расхождения, см. выше."
fi
exit "$fail"
