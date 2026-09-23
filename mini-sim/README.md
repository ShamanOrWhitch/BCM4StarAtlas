# BCM Mini-Sim 0.5.2 — GPT handoff

## STOP — read this before another GPT rewrite

Live site: https://walkingyog.com/bcm4sa/
Repo: ShamanOrWhitch/BCM4StarAtlas / mini-sim

**Canonical source:** GitHub `mini-sim/` is now the working source for the engine. When fixing this simulation, edit the files in this repository directly and commit them. Do not invent a ZIP patch as the only deliverable. The WordPress copy is a deployment target and must be synchronized from these exact files.
Engine: **bundled Three.js r128 only** (`assets/js/three.min.js`, 603445 bytes). Do not upgrade to r159. No jsDelivr, no unpkg.

### Why 0.4.1 looked "not applied"
- PHP was updated to 0.4.1 (`?ver=0.4.1`).
- **JS on the server stayed the old 48890-byte 0.4.0 file.**
- GitHub also temporarily contained a 0.5.2 README while the actual PHP/JS files were still 0.4.1. Do not trust the README alone: inspect the actual three source files and their commit.
- Current target is 0.5.2. HUD must show `ENGINE READY · LOCAL r128 · 0.5.2`.
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
Doors: `door1.png` is **the first door and must be used**. Also door.png, door2–door5.png
Portals: portal.png / portal2.png / portal3.png
Videos: portal1.mp4, portal2.mp4, portal3.mp4
Music: `starbase ost.mp3` (space in the name)
Menu bg: `perference bg.png` (typo is real; rename only if PHP+JS change together)
Old root `mini-sim/door.png` is leftover. Prefer `assets/door1.png`.

### Rules the owner already confirmed
1. Music starts **only** on button «Играть». Never on page load / pointerdown / keyboard / crystal / engine init.
2. Esc must **release pointer lock** and leave the browser usable. Do not freeze the rAF loop if a gamepad is connected. Wrap pad + physics in try/catch.
3. Gamepad: left stick move, right stick look (yoke). Start/Select = settings. Do not invert yaw unless the settings checkbox is on.
4. Phone tilt = look, not thrust. Calibrate **current pose as neutral**. Default pitch: device down = look up (aviation). Left/right not reversed.
5. Portal: play the **mp4 overlay**, then teleport ship to room 2 (`z ≈ -52`). If the portal quad covers ~69% of view, auto-start the cutscene.
6. Door: first door uses door1.png. Random open/close style (slide/wipe/iris). If player range > 5 for 4 seconds, close. Never leave the door permanently OPEN.
7. Between rooms is open space + starfield. White cube there is the future docking trainer target. Do not delete it.
8. Keep r128 APIs: MeshBasicMaterial + Texture from Image. ClampToEdge, no mipmaps on NPOT art.

### What to replace on WordPress
Only these three files (do not re-upload 3–6MB png/mp4 unless missing):
- `mini-sim/bcm-mini-sim.php`
- `mini-sim/assets/js/mini-sim.js`
- `mini-sim/assets/css/mini-sim.css`

Shortcode: `[bcm_mini_sim]`

### Verify after deploy
Network tab:
- 200 `.../mini-sim/assets/js/mini-sim.js?ver=0.5.2` (about 24KB, not 48890)
- 200 `.../assets/wall1.png`, `roof.png`, `roofa.png`, `door1.png`, `portal2.mp4`, `starbase%20ost.mp3`
- HUD: `ENGINE READY · LOCAL r128 · 0.5.2`
- Click ИГРАТЬ → OST starts. Refresh page → OST silent until click.

### Do not
- Rewrite the whole engine to r159 / modules / React.
- Point textures at Star Atlas CDN from this plugin.
- Autostart music.
- Capture Esc for the menu only (Esc = unlock mouse first).
- Assume GitHub JS is what the site runs. The site copies files manually.

Crew/mission UI is a **separate** plugin `bcm4staratlas`. Do not merge them into one JS file.


### Handoff rules for another GPT/Grok

- Start by reading this README and the actual current `bcm-mini-sim.php`, `assets/js/mini-sim.js`, and `assets/css/mini-sim.css` from GitHub. Do not continue from a pasted old patch.
- The asset directory is authoritative. Textures are under `mini-sim/assets/`; PHP builds the registry from that directory.
- Main ceiling textures are `roof.png`, `roof1.png`, `roof3.png`. Ceiling corner/joint textures are `roofa.png`, `roofa1.png`, `roofa2.png`. They are not wall textures and must not be silently replaced with `wall*.png`.
- The first door is `assets/door1.png`. Do not use the old plugin-root `door.png` path.
- OST is `assets/starbase ost.mp3`. It may be assigned to the audio element during initialization, but `.play()` must only happen after the `ИГРАТЬ` click has set `running = true`.
- If a requested change is already present in GitHub, verify the live WordPress copy before rewriting code. The site may still contain an older manually uploaded JS file or cache.
- Do not rewrite Three.js. This project uses the bundled `assets/js/three.min.js` r128.
- Do not merge the separate `bcm4staratlas` crew/mission plugin into mini-sim.
- Before declaring a patch finished, make a real GitHub commit and report the exact changed paths and commit SHA. The user should not have to hunt for a ZIP file.
