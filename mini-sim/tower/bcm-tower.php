<?php
/**
 * BCM Tower mode — lightweight WebGL tower descent for BCM Mini Space Simulation.
 *
 * Shortcode: [bcm_tower]
 *
 * This module is intentionally separate from the existing 6DOF mini-sim so the
 * prototype can be tested without changing the current labyrinth controls.
 */

if (!defined('ABSPATH')) {
    exit;
}

define('BCM_TOWER_VERSION', '0.2.14');
define('BCM_TOWER_PATH', __DIR__ . '/');
define('BCM_TOWER_URL', trailingslashit(plugin_dir_url(__FILE__)));

function bcm_tower_pick_asset($assets, $names, $type = 'image') {
    $wanted = array_map('strtolower', (array) $names);

    foreach ($wanted as $wanted_name) {
        foreach ((array) $assets as $asset) {
            if (($asset['type'] ?? '') === $type && strtolower($asset['name'] ?? '') === $wanted_name) {
                return $asset['url'];
            }
        }
    }

    foreach ((array) $assets as $asset) {
        if (($asset['type'] ?? '') !== $type) {
            continue;
        }

        $basename = strtolower(pathinfo($asset['name'] ?? '', PATHINFO_FILENAME));
        foreach ($wanted as $wanted_name) {
            if ($basename === strtolower(pathinfo($wanted_name, PATHINFO_FILENAME))) {
                return $asset['url'];
            }
        }
    }

    return '';
}

function bcm_tower_asset_urls($assets, $pattern, $type = 'image') {
    $urls = array();
    foreach ((array) $assets as $asset) {
        if (($asset['type'] ?? '') !== $type) continue;
        $name = $asset['name'] ?? '';
        if ($name !== '' && preg_match($pattern, $name)) $urls[] = $asset['url'];
    }
    return array_values(array_unique($urls));
}

function bcm_tower_scan_local_assets() {
    $assets = array();
    $base_path = BCM_TOWER_PATH . 'assets/';
    $allowed = array('png', 'jpg', 'jpeg', 'webp', 'gif', 'mp4', 'webm', 'ogg', 'mp3', 'm4a', 'wav');

    if (!is_dir($base_path)) {
        return $assets;
    }

    try {
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($base_path, FilesystemIterator::SKIP_DOTS)
        );
        foreach ($iterator as $file) {
            if (!$file->isFile()) continue;

            $relative = ltrim(str_replace($base_path, '', $file->getPathname()), '/\\');
            $extension = strtolower(pathinfo($relative, PATHINFO_EXTENSION));
            if (!in_array($extension, $allowed, true)) continue;

            if (in_array($extension, array('mp4', 'webm'), true)) {
                $type = 'video';
            } elseif (in_array($extension, array('mp3', 'm4a', 'wav', 'ogg'), true)) {
                $type = 'audio';
            } else {
                $type = 'image';
            }

            $assets[] = array(
                'name' => $relative,
                'url' => BCM_TOWER_URL . 'assets/' . str_replace('%2F', '/', rawurlencode(str_replace('\\', '/', $relative))),
                'type' => $type,
                'extension' => $extension,
            );
        }
    } catch (Exception $e) {
    }

    usort($assets, function ($a, $b) {
        return strcasecmp($a['name'], $b['name']);
    });

    return $assets;
}

function bcm_tower_get_assets() {
    $assets = array();

    // Keep the existing mini-sim asset library available.
    if (function_exists('bcm_mini_sim_get_assets')) {
        $assets = bcm_mini_sim_get_assets();
    }

    // Also scan the Tower module's own assets directory.
    $tower_assets = bcm_tower_scan_local_assets();

    return array_merge($assets, $tower_assets);
}

function bcm_tower_get_client_config($assets = null) {
    if ($assets === null) {
        $assets = bcm_tower_get_assets();
    }

    return array(
        'threeUrl' => defined('BCM_MINI_SIM_URL') ? BCM_MINI_SIM_URL . 'assets/js/three.min.js' : '',
        'transition' => bcm_tower_pick_asset($assets, array('tower.mp4'), 'video'),
        'transitionFallbacks' => array_values(array_filter(array(
            bcm_tower_pick_asset($assets, array('portal2.mp4'), 'video'),
            bcm_tower_pick_asset($assets, array('portal3.mp4'), 'video'),
            bcm_tower_pick_asset($assets, array('portal1.mp4'), 'video'),
        ))),
        'towerWallJpgPool' => bcm_tower_asset_urls($assets, '/^(towerwall|wall)[^\\/]*\\.(jpg|jpeg)$/i'),
        'towerWallPngPool' => bcm_tower_asset_urls($assets, '/^towerwall[^\\/]*\\.png$/i'),
        'platformPool' => bcm_tower_asset_urls($assets, '/^(platform|paltform)(?!lava|ice)[^\\/]*\\.(png|jpg|jpeg|webp)$/i'),
        'platformLavaPool' => bcm_tower_asset_urls($assets, '/^(platformlava|paltformlava)[^\\/]*\\.(png|jpg|jpeg|webp)$/i'),
        'platformIcePool' => bcm_tower_asset_urls($assets, '/^platformice[^\\/]*\\.(png|jpg|jpeg|webp)$/i'),
        'upperPlatformPool' => bcm_tower_asset_urls($assets, '/^upperplatform[^\\/]*\\.(png|jpg|jpeg|webp)$/i'),
        'rockPool' => bcm_tower_asset_urls($assets, '/^rock[^\\/]*\\.(png|jpg|jpeg|webp)$/i'),
        'liftPool' => bcm_tower_asset_urls($assets, '/^lift[^\\/]*\\.(png|jpg|jpeg|webp)$/i'),
        'boxPool' => bcm_tower_asset_urls($assets, '/^box[^\\/]*\\.(png|jpg|jpeg|webp)$/i'),
        'safeBoxPool' => bcm_tower_asset_urls($assets, '/^safebox[^\\/]*\\.(png|jpg|jpeg|webp)$/i'),
        'dangerBoxPool' => bcm_tower_asset_urls($assets, '/^dangerbox[^\\/]*\\.(png|jpg|jpeg|webp)$/i'),
        'firePool' => bcm_tower_asset_urls($assets, '/^fire(?!metalbear)[^\\/]*\\.(png|jpg|jpeg|webp)$/i'),
        'lavaPool' => bcm_tower_asset_urls($assets, '/^lava[^\\/]*\\.(png|jpg|jpeg|webp)$/i'),
        'landingPool' => bcm_tower_asset_urls($assets, '/^h\\d*\\.(png|jpg|jpeg|webp)$/i'),
        'doorPool' => bcm_tower_asset_urls($assets, '/^door[^\\/]*\\.(png|jpg|jpeg|webp)$/i'),
        'wallDoorPool' => bcm_tower_asset_urls($assets, '/^walldoor\\.(png|jpg|jpeg|webp)$/i'),
        'npcPool' => bcm_tower_asset_urls($assets, '/^(walldoorpiratebear|walldoormetalbear|firemetalbear)[^\\/]*\\.(png|jpg|jpeg|webp)$/i'),
        // Diagnostic Tower background: prefer a future backgroundmenu asset,
        // then use the existing menu background from the mini-sim library.
        'backgroundMenu' => bcm_tower_pick_asset($assets, array(
            'backgroundmenu.png',
            'backgroundmenu.jpg',
            'backgroundmenu.webp',
            'perference bg.png'
        ), 'image'),
        'shipTexture' => bcm_tower_pick_asset($assets, array('ship.png', 'ship.webp', 'ship.jpg', 'ship.jpeg'), 'image'),
        'planetMaps' => array_values(array_map(
            static function ($asset) { return $asset['url']; },
            array_filter($assets, static function ($asset) {
                if (($asset['type'] ?? '') !== 'image') return false;
                $name = strtolower($asset['name'] ?? '');
                return (bool) preg_match('/(^|\\/)planet[^\/]*\\.(png|webp|jpg|jpeg)$/i', $name);
            })
        )),
        'version' => BCM_TOWER_VERSION,
    );
}
function bcm_tower_enqueue_assets() {
    $assets = bcm_tower_get_assets();
    $tower_assets = bcm_tower_scan_local_assets();

    wp_enqueue_style(
        'bcm-tower',
        BCM_TOWER_URL . 'assets/css/tower.css',
        array(),
        BCM_TOWER_VERSION
    );

    wp_enqueue_script(
        'bcm-tower',
        BCM_TOWER_URL . 'assets/js/tower.js',
        array(),
        BCM_TOWER_VERSION,
        false
    );

    wp_localize_script('bcm-tower', 'BCMTowerConfig', bcm_tower_get_client_config($assets));
}

function bcm_tower_shortcode($atts = array()) {
    bcm_tower_enqueue_assets();

    $atts = shortcode_atts(array(
        'height' => 'min(100vh, 900px)',
        'crew_image' => '',
        'crew_name' => '',
        'autostart' => '1',
        'embedded' => '0',
    ), $atts, 'bcm_tower');

    $crew_image = trim((string) $atts['crew_image']);
    $crew_name = trim((string) $atts['crew_name']);

    ob_start();
    ?>
    <div class="bcm-tower<?php echo $atts['embedded'] === '1' ? ' bcm-tower-embedded' : ''; ?>"
         data-bcm-tower-autostart="<?php echo $atts['autostart'] === '0' ? '0' : '1'; ?>"
         <?php echo $atts['embedded'] === '1' ? 'hidden' : ''; ?>
         style="--bcm-tower-height:<?php echo esc_attr($atts['height']); ?>;">
        <canvas class="bcm-tower-canvas" tabindex="0"></canvas>

        <div class="bcm-tower-menu">
            <div class="bcm-tower-menu-title">BCM TOWER</div>
            <div class="bcm-tower-menu-subtitle">LOCAL DESCENT</div>
            <div class="bcm-tower-mode-buttons">
                <button type="button" data-tower-mode="single">SINGLE</button>
                <button type="button" data-tower-mode="multi">MULTI</button>
            </div>
            <div class="bcm-tower-menu-help">
                SINGLE — клавиатура / мышь / 1 gamepad<br>
                MULTI — 2 gamepad или P1 + P2 клавиатура
            </div>
        </div>

        <div class="bcm-tower-hud">
            <div class="bcm-tower-title">BCM TOWER — PROTOTYPE</div>
            <div class="bcm-tower-status">ENGINE LOADING...</div>
            <div class="bcm-tower-level"></div>
            <div class="bcm-tower-mode"></div>
            <div class="bcm-tower-help bcm-tower-help-single">
                <span>A/D</span> вращение башни · <span>Space</span> jetpack ×2 ·
                <span>W/S</span> ручная коррекция высоты · <span>Mouse</span> обзор · <span>R</span> новый спуск
            </div>
            <div class="bcm-tower-help bcm-tower-help-multi">
                <b>P1</b> A/D + W/S + Space + E · <b>P2</b> ←/→ + ↑/↓ + Enter + Shift · <span>gamepad #1/#2</span> одинаковая карта
            </div>
            <div class="bcm-tower-crew" aria-live="polite"></div>
        </div>

        <div class="bcm-tower-split-divider" hidden></div>
        <div class="bcm-tower-split-label bcm-tower-split-p1" hidden>P1</div>
        <div class="bcm-tower-split-label bcm-tower-split-p2" hidden>P2</div>

        <div class="bcm-tower-mobile" aria-hidden="true">
            <div class="bcm-tower-mobile-player bcm-tower-mobile-p1">
                <button data-tower-player="0" data-tower-control="left" type="button">◀</button>
                <button data-tower-player="0" data-tower-control="jump" type="button">JET</button>
                <button data-tower-player="0" data-tower-control="right" type="button">▶</button>
            </div>
            <div class="bcm-tower-mobile-player bcm-tower-mobile-p2" hidden>
                <button data-tower-player="1" data-tower-control="left" type="button">◀</button>
                <button data-tower-player="1" data-tower-control="jump" type="button">JET</button>
                <button data-tower-player="1" data-tower-control="right" type="button">▶</button>
            </div>
        </div>

        <div class="bcm-tower-transition" hidden>
            <video class="bcm-tower-transition-video" playsinline preload="auto"></video>
            <div class="bcm-tower-transition-label">TOWER LANDING</div>
            <button class="bcm-tower-transition-close" type="button" aria-label="Закрыть">×</button>
        </div>

        <button class="bcm-tower-restart" type="button" hidden>НОВЫЙ СПУСК</button>

        <script type="application/json" class="bcm-tower-inline-config"><?php
            echo wp_json_encode(array(
                'crewImage' => esc_url_raw($crew_image),
                'crewName' => sanitize_text_field($crew_name),
            ));
        ?></script>
    </div>
    <?php
    return ob_get_clean();
}

add_shortcode('bcm_tower', 'bcm_tower_shortcode');

/**
 * Optional in-browser texture-sheet analyzer.
 *
 * Shortcode: [bcm_tower_texture_slicer]
 *
 * It does not upload or alter source files. The user selects local images and
 * the browser finds candidate texture regions, then exports cropped PNGs.
 */
function bcm_tower_texture_slicer_shortcode() {
    wp_enqueue_style(
        'bcm-tower-texture-slicer',
        BCM_TOWER_URL . 'assets/css/texture-slicer.css',
        array(),
        BCM_TOWER_VERSION
    );
    wp_enqueue_script(
        'bcm-tower-texture-slicer',
        BCM_TOWER_URL . 'assets/js/texture-slicer.js',
        array(),
        BCM_TOWER_VERSION,
        true
    );

    ob_start();
    ?>
    <div class="bcm-tower-slicer">
        <div class="bcm-tower-slicer-head">
            <strong>BCM Texture Sheet Analyzer</strong>
            <span>PNG/JPG/WebP · обработка в браузере</span>
        </div>

        <div class="bcm-tower-slicer-controls">
            <label>Листы
                <input class="bcm-tower-slicer-files" type="file" accept="image/png,image/jpeg,image/webp" multiple>
            </label>
            <label>Режим
                <select class="bcm-tower-slicer-mode">
                    <option value="auto">Auto</option>
                    <option value="alpha">Прозрачность</option>
                    <option value="grid">Сетка</option>
                </select>
            </label>
            <label class="bcm-tower-slicer-grid-row-wrap">Ряды
                <input class="bcm-tower-slicer-rows" type="number" min="1" max="32" value="4">
            </label>
            <label class="bcm-tower-slicer-grid-col-wrap">Колонки
                <input class="bcm-tower-slicer-cols" type="number" min="1" max="32" value="4">
            </label>
            <label>Мин. площадь
                <input class="bcm-tower-slicer-min-area" type="number" min="8" value="160">
            </label>
            <label>Padding
                <input class="bcm-tower-slicer-padding" type="number" min="0" max="32" value="2">
            </label>
            <button class="bcm-tower-slicer-run" type="button">АНАЛИЗИРОВАТЬ</button>
            <button class="bcm-tower-slicer-export-all" type="button" disabled>СКАЧАТЬ PNG</button>
        </div>

        <div class="bcm-tower-slicer-note">
            Auto ищет самостоятельные области по прозрачности/фону. Если лист собран
            строго сеткой, выбери «Сетка» и укажи ряды/колонки.
        </div>

        <div class="bcm-tower-slicer-status">Файлы ещё не выбраны.</div>
        <div class="bcm-tower-slicer-results"></div>
    </div>
    <?php
    return ob_get_clean();
}

add_shortcode('bcm_tower_texture_slicer', 'bcm_tower_texture_slicer_shortcode');
