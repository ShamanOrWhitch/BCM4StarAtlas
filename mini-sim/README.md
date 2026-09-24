# BCM Mini-Sim 0.6.4

## STOP — read this before another GPT rewrite

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


### 0.6.4 scene/media additions
- Live wall: `wall.mp4` is used as a full wall panel with `wall1.png` as a first-frame fallback until the video is decoded.
- Cinema clips now use `i-dance-fin.mp4` and `Reshade-Rasta-Dance3.mp4` in place of the older clips.
- Exterior starbase: a lightweight skeleton surrounds the open-space departure path with segmented outer panels using `back*.png` textures.
- The exterior panels reuse a small set of loaded textures and periodically shuffle their assignments to create a camouflage effect.
- The six submitted backside PNGs are currently stored at repository root; PHP falls back to their GitHub raw URLs until local plugin copies exist.

### 0.6.4
- The portal remains on the r128 implementation.
- Front portal face: `portal.png`; rear portal face: `portal2.png`.
- The first and return gates keep the existing door logic.
- Exterior structure is deliberately lightweight so it does not replace the free-flight space with a heavy model.
