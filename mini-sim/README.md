# BCM Mini-Sim 0.9.9

## STOP — read this before another GPT rewrite

### 0.9.2 Deep Space / speed matrix
### 0.9.3 exterior flight / satellite
- The decorative deep-space object is now named **SATELLITE**; approaching within about 34 units reports **SATELLITE REACHED**.
- Room 1 and Room 2 remain bounded while the ship is inside their corridor, but the boundary no longer forcibly drags an exterior flight back into the room.
- The starbase can therefore be inspected from above, below, and both sides in open space.

- Version is explicitly **0.9.2** in PHP, HUD, and this README.
- Default flight mode is **Speed 1**: forward/back thrust is slightly reduced to make normal exploration slower.
- **Speed 2** preserves the previous 0.9.0 thrust/max-speed values for the future fast-flight switch.
- Deep Space has no enclosing visual shell. The player can fly above, below, beside, and around the external starbase and inspect it from open space.
- The exterior starbase is separate from the interior/backside texture layers. Nothing from that exterior structure is rendered in the BLACK HOLE transition volume.
- Collision limits remain the navigation boundary only; the starbase itself has no collision yet.
- Boundary impacts use a temporary red visual pulse that fades over about 1.5 seconds.

Live site: https://walkingyog.com/bcm4sa/
Repo: ShamanOrWhitch/BCM4StarAtlas / mini-sim
Engine: **bundled Three.js r128 only** (`assets/js/three.min.js`, 603445 bytes). Do not upgrade to r159. No jsDelivr, no unpkg.

### Why 0.4.1 looked “not applied”
- PHP was updated to 0.4.1 (`?ver=0.4.1`).
- **JS on the server stayed the old 48890-byte 0.4.0 file.**
- Always check file size / first comment / HUD title `SPACE LABYRINTH — 0.6.1`.
- After upload purge LiteSpeed **and** Autoptimize. Exclude `mini-sim.js` and `three.min.js` from Autoptimize JS.

### Asset URLs (the real 404 bug)
Files live in `wp-content/plugins/mini-sim/assets/`.
PHP **must** build:
`plugin_dir_url + 'assets/' + rawurlencode(filename)`
Wrong: `.../mini-sim/wall1.png` (404)
Right: `.../mini-sim/assets/wall1.png` (200)

Registry is `BCMMiniSimConfig.assets[]` with `{name, url, type}`.
JS must resolve by lowercase basename (`wall1.png`, `roof.png`, `door1.png`, `portal2.mp4`).
Do **not** hardcode plugin-root paths.

### Current media map
Walls: wall1–wall5.png
Ceilings: roof.png, roof1.png, roof3.png
Ceiling corner joints: roofa.png, roofa1.png, roofa2.png
Doors: door1.png is **first door**. Also door.png, door2–door5.png
Portals still: portal.png / portal2.png / portal3.png
Videos: portal1.mp4, portal2.mp4, portal3.mp4
Music: `starbase ost.mp3` (space in the name)
Menu bg: `perference bg.png` (filename typo is real, do not rename unless you change PHP+JS together)
Old root `mini-sim/door.png` is leftover. Prefer `assets/door1.png`.

### Rules the owner already confirmed
1. Music starts **only** on button «Играть». Never on page load / pointerdown / engine init.
2. Esc must **release pointer lock** and leave the browser usable. Do not freeze the rAF loop if a gamepad is connected. Wrap pad + physics in try/catch.
3. Gamepad: left stick move, right stick look (yoke). Start/Select = settings. Do not invert yaw unless the settings checkbox is on.
4. Phone tilt = look, not thrust. Calibrate **current pose as neutral**. Default pitch: device down = look up (aviation). Left/right not reversed.
5. Portal: play the **mp4 overlay**, then teleport ship to room 2 (`z ≈ -52`). If the portal quad covers ~69% of view, auto-start the cutscene.
6. Door: first door uses door1.png. Random open style (slide/wipe/iris). If player range > 5 for 4 seconds, close.
7. Between rooms is open space + starfield. White cube there is the future docking trainer target. Do not delete it.
8. Keep r128 APIs: MeshBasicMaterial + Texture from Image is safest. ClampToEdge, no mipmaps on NPOT art.

### What to replace on WordPress
Only these three files (do not re-upload 3–6MB png/mp4 unless missing):
- `mini-sim/bcm-mini-sim.php`
- `mini-sim/assets/js/mini-sim.js`
- `mini-sim/assets/css/mini-sim.css`

Shortcode: `[bcm_mini_sim]`

### Verify after deploy
Network tab:
- 200 `.../mini-sim/assets/js/mini-sim.js?ver=0.6.1` (about 24KB, not 48890)
- 200 `.../assets/wall1.png`, `roof.png`, `door1.png`, `portal2.mp4`
- HUD: `ENGINE READY · LOCAL r128 · 0.6.1`
- Click ИГРАТЬ → OST starts. Refresh page → OST silent until click.

### Do not
- Rewrite the whole engine to r159 / modules / React.
- Point textures at Star Atlas CDN from this plugin.
- Autostart music.
- Capture Esc for the menu only (Esc = unlock mouse first).
- Assume GitHub JS is what the site runs. The site copies files manually.

Crew/mission UI is a **separate** plugin `bcm4staratlas`. Do not merge them into one JS file.


### Portal travel 0.6.1
- Forward: Room 1 → Room 2 uses `portal2.mp4`.
- Return: Room 2 → Room 1 uses `portal1.mp4` from the back side of the portal.
- Return teleport lands at the original start position `(0, 0, 2)` facing the initial door.
- The back-side trigger has priority in Room 2 and cannot accidentally use the forward portal trigger.


### 0.6.5 scene/media additions
- Live wall: `wall.mp4` is used as a full wall panel with `wall1.png` as a first-frame fallback until the video is decoded.
- Cinema clips now use `i-dance-fin.mp4` and `Reshade-Rasta-Dance3.mp4` in place of the older clips.
- Exterior starbase: a lightweight skeleton surrounds the open-space departure path with segmented outer panels using `back*.png` textures.
- The exterior panels reuse a small set of loaded textures and periodically shuffle their assignments to create a camouflage effect.
- The six backside PNGs belong in `mini-sim/assets/`; the root copies are not used.

### 0.6.5
- The portal remains on the r128 implementation.
- Front portal face: `portal.png`; rear portal face: `portal2.png`.
- The first and return gates keep the existing door logic.
- Exterior structure is deliberately lightweight so it does not replace the free-flight space with a heavy model.


### 0.6.6 geometry rollback
- Restored the 0.6.5 scene/controls/doors/portal logic.
- Exterior `back*.png` skeleton now wraps only Room 1 and Room 2.
- The central black `voidBox` remains black and completely untextured.
- Exterior skeleton is offset outward from the inner room surfaces by roughly 1–1.6 scene units.
- No extended hull corridor is generated beyond Room 2.

### 0.6.9 live layout correction
- `capdoor.mp4` is a single full rear-wall video panel in Room 1. It is warmed quietly shortly after the player starts, while playback waits until it is actually visible.
- `wall.mp4` is used exactly once on the right wall of Room 2, on the panel closest to the portal exit.
- `door-wallbotright.mp4` is used exactly once as the smaller lower-right panel farther along the same Room 2 wall; existing `wall1.png` remains visible in the unfilled areas.
- Portal videos keep the higher fetch priority. Room 2 textures, exterior `back*.png`, and the two Room 2 live panels warm in the low-priority background queue during portal travel.
- The background queue no longer starts at spawn.
- The exterior truss remains only the two short Room 1 / Room 2 tubes and stays slightly outside the interior surfaces.

### 0.6.9 exterior-only visibility fix
- The uploaded Room 2 lower-right video is resolved as doorwallbotright.mp4; the old hyphenated spelling remains a fallback.
- Wall.mp4 remains the single near-exit Room 2 video and is mounted on the interior side of the right wall.
- Room 2 live videos are distance-driven inside the room, so they can play while the player is in the room instead of waiting for a precise camera angle.
- Exterior back*.png materials use outward-facing FrontSide normals, preventing the external skin from appearing inside the rooms.
- The two exterior skins are pulled farther away on X/Y and slightly past the tube ends on Z. The central black void remains untouched.


## 0.6.10 geometry/media correction
- Exterior `back*.png` panels are moved farther away on X/Y and beyond the room ends on Z; the left/right panel normals are corrected so the outside skin faces outward and cannot visually form an interior wall.
- The background image queue de-duplicates each `back*.png` URL, so one file is decoded once even though several exterior panels reuse it.
- `Wall.mp4` is restored to the Room 1 right wall, with `wall1.png` visible as the immediate fallback while the video decodes.
- `doorwallbotright.mp4` remains only on the Room 2 bottom-right panel; its filename is treated as the placement indicator.
- The existing Room 1 rear `capdoor.mp4` panel and portal/control logic are unchanged.


## 0.7.0 live-wall/exterior correction
- `Wall.mp4` now fills the entire Room 1 right-side opening at the Room 1 wall dimensions (12×8), with `wall1.png` remaining the immediate fallback.
- `doorwallbotright.mp4` remains the lower-right Room 2 clip, but is moved forward to approximately z=-56.8 so it sits much closer to the dark portal-transition area instead of being stranded in the middle of the wall.
- The exterior `back*.png` skeleton is pulled substantially farther away again on X/Y and beyond both room tube ends on Z. The interior room dimensions and collision corridor are unchanged.


## 0.7.1 wall/exterior visibility correction
- `Wall.mp4` uses the exact full-wall Room 1 geometry from the earlier working build: x=5.96, z=-10, 28×8, rotated -90° around Y.
- `doorwallbotright.mp4` is moved to z=-51.95. With its 5.9-unit Z span, its near edge is approximately flush with the Room 2 entrance at z=-49, directly against the dark intermediate/portal side.
- Exterior `back*.png` panels remain pulled far outside the rooms and use outward-facing `FrontSide` normals plus disabled depth testing. The latter prevents the black `voidBox` from hiding the exterior skin, while backface culling keeps the skin out of the interior view.


## 0.7.2 polish
- `doorwallbotright.mp4` is reduced by about 3.5% to 5.6935×2.94325 and nudged farther down/right so it sits tighter in the Room 2 lower-right corner.
- Exterior `back*.png` texture shuffling now occurs about three times as often (roughly every 3.3–6.3 seconds instead of 10–19 seconds).
- Exterior tube ends are pulled back out of the central dark inter-portal room, removing the visible gray ribs there while keeping the outer Room 1 / Room 2 shell.


## 0.7.3 controls / HUD cleanup
- Keyboard vertical down control is now **C** instead of Ctrl; Space remains vertical up.
- Gamepad mapping: **A = door**, **B = return home**, **X = lock/focus nearest screen**, **Y = portal**, **LB/RB = roll**, **LT/RT = vertical movement**, **Start/Select = menu**.
- When a gamepad is connected, the HUD control legend switches to the gamepad mapping; keyboard help returns after disconnect.
- The continuous HUD status no longer appends the stale `DOOR CLOSED/OPEN` state; it shows only room and speed.


## 0.7.4 mobile controls
- Mobile edge zones no longer intercept touches; visible movement buttons have priority for movement.
- Swipe/drag directly on the game canvas remains the mobile screen-look control.
- Device tilt is requested automatically when the game starts in landscape on a touch device and controls camera rotation. The `TILT` button recalibrates the current pose.
- Pressing `Играть` recenters the mini-sim vertically in the phone viewport.


## 0.7.5 mobile look sensitivity
- Mobile canvas drag sensitivity is reduced from 0.012/0.010 to 0.0025/0.0022 to prevent a small swipe from spinning the ship.
- Tilt calibration now averages sensor samples for about 0.8 seconds before establishing the neutral pose.
- Tilt dead zone is increased to 5°, response span to 38°, and the resulting look input is reduced to 34% of the previous range.
- Movement buttons and desktop/gamepad controls are unchanged.


## 0.7.6 mobile control correction
- Tilt is now a **direct slow look rate** rather than accumulated angular acceleration, eliminating the tendency to drift or spin away.
- Phone tilt now has filtered sensor data, a 7° dead zone, a 45° response span, and 18% gain. Default left/right tilt direction is corrected.
- Mobile screen-drag sensitivity is reduced again to 0.0011/0.0010.
- Pressing the mobile portal button near the portal (within 14 scene units) launches the portal transition without requiring 69% visual coverage.
- The mini-sim enters browser fullscreen on mobile when `Играть` is pressed and uses `100dvh`/fixed positioning as the fallback. Mobile control buttons are enlarged and kept inside the safe area.
- A central `◎` button performs nearest-screen focus/lock.


## 0.7.7 mobile tilt / UI polish
- Tilt uses a linear response after a 4° dead zone, with a 30° response span and 34% gain, so small physical tilts produce visible camera rotation without accumulated spin.
- Tilt permission is requested before fullscreen on mobile.
- Cosmic space videos preload on touch landscape devices; their displayed size is increased by 45% only on mobile to remain visible.
- Mobile side controls are moved inward from the browser edge and suppress long-press/context-menu handling.
- The central screen-focus control is functionally present but completely invisible, with a 64×64 touch target.
- `back*.png` shuffle now runs roughly twice as fast again, about every 0.8–1.6 seconds.


## 0.7.8 direction/video check
- Верх HUD подписан как **BCM 4 STAR ATLAS**, версия мини-приложения — **0.7.8**.
- На телефоне **↟/↡** обозначены как вертикаль вверх/вниз; **◀/▶** — поворот влево/вправо.
- Исправлено направление экранных кнопок **◀/▶**.
- В SETTINGS добавлена проверка всех зарегистрированных видео: 3 локальных интерьерных ролика, 4 `spaceVideoZones` и 3 portal-видео — 10 уникальных источников.
- Проверка использует `preload=metadata` и запускается после «Играть», а также вручную из SETTINGS.


## 0.7.9 tilt-axis correction
- Исправлены оси мобильного наклона для горизонтальной ориентации экрана: вертикальный наклон телефона управляет вертикальным обзором, горизонтальный — горизонтальным поворотом.
- Учтён угол ориентации экрана 90°/270°, чтобы оси не перекручивались крест-накрест.
- Возвращено абсолютное позиционирование мобильных кнопок; предыдущая подпись групп больше не сжимает и не смещает блоки управления.
- Функции экранных кнопок сохранены: ▲/▼ — вертикаль, ◀/▶ — поворот.


## 0.8.0 mobile video optimization / mission
- Правая панель мобильных кнопок переставлена: ↡ выше ↟, ▶ выше ◀.
- Фиксация экрана теперь ищет ближайшее активное видео среди внешних `spaceVideoZones`, интерьерных видео и Wall.mp4.
- В HUD добавлена миссия: проверить внешние экраны.
- На телефоне удалено одновременное `preload=auto` для всех удалённых внешних роликов. С повышенным приоритетом загружается только ближайший активный экран.
- Удалённые видео и интерьерные видео освобождают источник раньше после ухода на достаточное расстояние, чтобы не держать несколько декодеров одновременно.


## 0.8.1 focus / mobile network correction
- Автоматический полный тест всех видеозаписей после запуска убран: он создавал лишнюю сетевую нагрузку на телефоне. Полная проверка видео остаётся ручной через SETTINGS.
- Фиксация выбранного экрана больше не сбрасывается каждым обновлением `cinema.nearest`; она сохраняется до выхода выбранного видео из его собственной рабочей зоны.


## 0.8.2 mobile network guard
- Полностью удалён автоматический полный скан 10 видео после запуска. Проверка всех видео запускается только вручную из SETTINGS.


## 0.8.3 tilt / center-focus correction
- Вертикальное направление наклона телефона инвертировано относительно 0.8.2.
- Чувствительность наклона увеличена с 34% до 40%; dead zone и диапазон реакции оставлены прежними.
- Центральная невидимая кнопка на экране вызывает ту же `toggleCinemaFocus()`, что и клавиша `F`: фиксация ближайшего активного ролика и повторное нажатие для снятия.
- Подпись настройки `invertPitch` обновлена на «Инверсия вертикального наклона».


## 0.8.4 back-texture/video layering
- `back*.png` внешней оболочки оставлены без изменения геометрии и находятся в нижнем render layer (`renderOrder=1`).
- Интерьерные видео (`20`), `Wall.mp4` (`21`) и космические видеозоны (`22`) теперь рисуются поверх `back*`, чтобы внешние текстуры не просвечивали через видеопанели.
- Управление, наклон и мобильная раскладка в этой версии не менялись.


## 0.8.5 screen interaction / mobile visibility
- Короткий тап прямо по загруженному видеопанелю на телефоне включает фиксацию этого ролика; повторный тап по нему снимает фиксацию.
- В режиме фиксации кнопки ◀/▶ переходят в режим горизонтального облёта выбранного ролика, сохраняя взгляд на нём.
- Добавлена подсказка TAP VIDEO · FOCUS · ◀ ▶ и SCREEN LOCK · ... ORBIT.
- Космические видеопанели на телефоне увеличены до 1.80× базового размера.
- Кнопки mute и звёздочка на мобильном экране сдвинуты левее.
- Оси наклона и чувствительность из 0.8.3 не менялись.


## 0.8.6 tap vs swipe guard
- Тап по видеопанели определяется по общей длине движения менее 9 px, поэтому медленный свайп больше не должен случайно включать фиксацию.


## 0.8.7 mobile memory reduction test
- На touch-landscape телефонах локальные PNG уменьшаются до максимум **1024 px** по длинной стороне перед созданием Three.js texture.
- Внешняя `back*` оболочка на телефоне использует максимум **4** фоновые текстуры вместо всего набора.
- Pixel Ratio мобильного рендера ограничен **1.0**; desktop остаётся с прежним пределом 1.5.
- Исходные файлы не перекодируются и desktop quality не меняется.


## 0.8.8 mobile texture reduction test
- Максимальный размер локальной текстуры на touch-landscape телефонах снижен с **1024 px** до **640 px** по длинной стороне перед созданием Three.js texture.
- Остальные ограничения 0.8.7 не менялись: максимум 4 фоновые `back*` текстуры, mobile Pixel Ratio 1.0, desktop без изменений.


## 0.8.9 mobile texture orientation fix
- При использовании уменьшенных `ImageBitmap` текстуры на телефоне больше не переворачиваются по вертикали.
- Наклон и его настройки не изменялись.


## 0.9.0 mobile PNG orientation / portal focus safety
- Для уменьшенных `ImageBitmap` добавлен `imageOrientation: "flipY"`, чтобы PNG на телефоне сохраняли нормальную ориентацию.
- Автоматический переход через портал временно блокируется, пока активен `SCREEN FOCUS`; ручной `G`/кнопка портала не менялись.
- Первый космический экран в портальной зоне перенесён с `z=-38.5` на `z=-42.0`, а безопасная дистанция видео от портала увеличена с `12` до `16`.
- Наклон и его параметры не изменялись.

### 0.9.4 sealed exterior hull
- The visible `back*.png` exterior shell is now treated as the starbase hull envelope: outer X/Y = ±16 / ±12 for Room 1 and Room 2.
- Texture gaps between shell bands are filled with additional back-texture panels; end caps close the Room 1/Room 2 outer shells.
- Structural rails are aligned directly along the textured shell edges.
- Exterior collision is one-way: approaching the back-texture shell from open space cannot pass through it, while leaving an interior/existing hull volume outward remains possible.
- The BLACK HOLE gap stays open; it does not receive the Room 1/Room 2 outer shell.

### 0.9.5 panel visibility / corridor collision
- Exterior `back*.png` panels now use normal depth testing and stay hidden until the ship is actually in Deep Space, preventing them from appearing as a screen overlay at launch.
- BLACK HOLE has no textured end caps; the gap between Room 1 and Room 2 remains visually open.
- Room 1 / Room 2 / BLACK HOLE corridor bounds are restored as physical interior limits; exterior flight begins in Deep Space through the portal.
- Re-entry from Deep Space into the back-texture hull is blocked by the external shell envelope.
- Default Speed 1 is reduced to thrust 15.5 and max speed 32; Speed 2 remains the stored fast mode.

### 0.9.6 full exterior inspection layer
- The player switches from INSIDE to OUTSIDE after crossing the rear opening of Room 2 at z < -84.5.
- OUTSIDE is now a single large open flight volume around the complete Room 1 + BLACK HOLE + Room 2 structure.
- The player can fly around the front, rear, top, bottom and sides of the starbase and inspect the back*.png exterior from all directions.
- back*.png collision acts only as an exterior hull barrier against re-entry; BLACK HOLE has no back-texture shell.
- Returning home or using either portal resets the layer to INSIDE.

### 0.9.7 rigid back texture collision
- Exterior collision now uses the ship's movement segment, preventing tunneling through the back*.png hull at higher speed.
- Boundary checks handle exact contact with the shell and side/top/bottom edges.
- The collision envelope is slightly outside the texture plane so the ship cannot visibly clip into the shell.
- BLACK HOLE remains open and has no back-texture cap.

### 0.9.8 iOS / portal / hull polish
- iOS/iPadOS startup no longer requests motion permission or fullscreen automatically; the `TILT` button remains the explicit gesture for sensor permission. The mini-sim also waits for DOM ready before booting, avoiding early Safari/WordPress script timing failures.
- Local and transition videos explicitly set muted + playsinline/`webkit-playsinline` attributes for iOS video playback.
- The portal surface now fills the corridor wall at approximately 11.8×7.0 scene units.
- Door and return-door geometry are widened and resized to fit the 12-unit corridor more accurately.
- Exterior back textures are divided into smaller ~4.5-unit bands, with each panel changing independently on a staggered roughly 0.8–3.0 second timer.
- Only the true outer rear ends of Room 1 and Room 2 receive `back*.png` caps; BLACK HOLE-facing ends remain open.
- Room 1's rear cap surrounds/backs the exterior side of `capdoor.mp4` with the back-texture shell.

### 0.9.9 BLACK HOLE open volume / physical exterior hull
- Removed the finite black-hole `voidBox`; BLACK HOLE is now a true open 3D volume with no rectangular visual boundary.
- INSIDE, BLACK HOLE, and OUTSIDE are treated as separate spatial zones instead of switching the whole game into noclip.
- BLACK HOLE allows free X/Y flight; entering/leaving Room 1 and Room 2 is through the actual corridor openings.
- OUTSIDE keeps real movement limits plus rigid collision against the external back-texture hull; it is not global noclip.
- The Room 2 rear cap remains a one-way exit from INSIDE to OUTSIDE; re-entry through that back-texture cap is blocked.
- back*.png exterior textures are hidden while in BLACK HOLE and shown again only in DEEP SPACE.
