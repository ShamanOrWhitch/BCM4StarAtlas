Fimbul BYOS Packlite — средний грузовик-баржа Star Atlas (FBLBPL, Rare)
========================================================================
Габарит по карточке: 67.1 × 26.5 × 21.6 м. Экипаж 6.
Слоты: 2 medium fixed hardpoint, 2 x-small turret, small missile bay,
M + 2 small контрмеры, Scanner Array M, Tractor Beam M, Heat Sink M,
Subwarp Engine L; модули 2×Cargo / 2×Fuel.

Файлы
-----
packlite.glb            — сама модель (40 узлов, ~20.9 тыс. треугольников)
packlite_demo.html      — автономная демка: three r128 + GLTFLoader + GLB в base64
packlite_controls.js    — контроллер (режимы, узлы, анимация)
packlite_panel.js       — панель управления (чистый DOM)
modes.json              — параметры режимов и подвижных узлов
preview.jpg / hero.jpg  — ракурсы, отрендеренные без GPU
create.py               — генератор геометрии (все размеры в метрах)
glb_writer.py           — запись GLB
render_preview.py       — программный растеризатор (превью без WebGL)
hole_check.py           — проверка «сквозных дыр» в обшивке
hole_base.json          — базовая линия дыр
packlite.test.mjs       — 10 тестов модели (node --test)
packlite_load_check.js  — прогон через настоящий GLTFLoader r128 + контроллер
vendor/three.min.js     — three r128 (локальная копия, сборка без сети)
vendor/GLTFLoader.js    — GLTFLoader r128

Узлы (40)
---------
Статика: center_hull, bridge, canopy, intake_r/l, cargo_deck, cargo_hold,
  container_r0…r4, container_l0…l4, radar_tower, deck_crane, engine_frame,
  nozzle_cluster, pod_r0/r1/l0/l1, cm_pod_r/l, greebles, decals
Свет:    thrusters (5 струй), lights (прожекторы, палубные огни, трюм),
         beacon (строки на мачте и ферме)
Подвижные: turret_r/l (подъём 16°), cargo_lid_r/l (створки люка, 82°),
         leg_0…leg_3 (лыжи, ход 2.0 м)

Режимы
------
pad    — на палубе: лыжи выпущены, люк закрыт, тяга 0
flight — полёт: лыжи убраны, тяга 70 %
hunt   — охота: стволы турелей подняты 16°, тяга 88 %, стробы
load   — погрузка: лыжи выпущены, створки люка 82°, подсветка трюма

API контроллера (совместим с остальными кораблями)
--------------------------------------------------
createPackliteControls(root) → { setMode, getMode, getModes, setLegs, setGuns,
  setLid, setThrust, setStrobe, setSpots, setEngines, setShaderMode, update,
  getState, constants, dispose }
Без шейдеров (CPU-путь) материал — unlit MeshBasicMaterial с вершинными
цветами; «Шейдерный режим» переключает на MeshLambertMaterial.

Проверки (все зелёные)
----------------------
node --test packlite.test.mjs     — 10/10
node packlite_load_check.js       — ALL OK
python3 hole_check.py             — обшивка без сквозных дыр
python3 create.py                 — 0 пересечений, посадка декора на обшивку OK
