#!/usr/bin/env python3
"""Собирает самодостаточное демо: ядро встраивается в шаблон дословно,
поэтому демо, тест и патч не могут разойтись."""
from pathlib import Path

here = Path(__file__).parent
core = (here / "warp_backdrop_core.js").read_text(encoding="utf-8")
tpl = (here / "warp_demo_template.html").read_text(encoding="utf-8")
marker = "/*__CORE__*/"
assert marker in tpl, "в шаблоне нет метки вставки ядра"
out = tpl.replace(marker, core)
assert "</script>" not in core, "ядро не должно содержать закрывающий тег script"
# Встраиваем скетчи как data URI: превью открывается в песочнице без сети,
# поэтому внешние файлы там не загрузятся, а показать надо настоящие обои.
import base64
sketch_dir = here / "scetchs"
entries = []
if sketch_dir.is_dir():
    for path in sorted(sketch_dir.glob("*.svg")):
        encoded = base64.b64encode(path.read_bytes()).decode("ascii")
        entries.append('  "%s": "data:image/svg+xml;base64,%s"' % (path.name, encoded))
inject = ""
if entries:
    inject = "<script>window.BCM_WARP_SKETCH_DATA = {\n" + ",\n".join(entries) + "\n};</script>\n"
out = out.replace("<!--SKETCH_DATA-->", inject)
print(f"скетчей встроено: {len(entries)}")

# Спрайты астероидов (печёные GLB из mini-sim/assets/mesh/asteroid_variety).
art_path = here / "asteroids_base64.js"
if art_path.exists():
    art = art_path.read_text(encoding="utf-8")
    out = out.replace(
        "<!--ASTEROID_DATA-->",
        "<!--ASTEROID_DATA--><script>\n" + art + "</script>\n",
    )
    print(f"астероидов встроено: {art.count('data:image/png;base64,')}")
else:
    print("ВНИМАНИЕ: asteroids_base64.js нет — астероиды будут гранёным фолбэком")

target = here / "warp_demo.html"
target.write_text(out, encoding="utf-8")
print(f"warp_demo.html: {len(out.encode('utf-8'))} байт, ядро {len(core.encode('utf-8'))} байт")
