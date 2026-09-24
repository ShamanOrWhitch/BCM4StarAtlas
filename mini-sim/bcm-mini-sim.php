<?php
/**
 * Plugin Name: BCM Mini Space Simulation
 * Description: Self-contained 6DOF space-labyrinth test for WordPress.
 * Version: 0.6.4
 * Author: ShamanOrWitch
 * License: GPL-2.0-or-later
 */

if (!defined('ABSPATH')) {
    exit;
}

define('BCM_MINI_SIM_VERSION', '0.6.4');
define('BCM_MINI_SIM_URL', plugin_dir_url(__FILE__));
define('BCM_MINI_SIM_PATH', plugin_dir_path(__FILE__));

function bcm_mini_sim_get_assets()
{
    $assets = array();
    $base_path = BCM_MINI_SIM_PATH . 'assets/';
    $allowed = array('png', 'jpg', 'jpeg', 'webp', 'gif', 'mp4', 'webm', 'ogg', 'mp3', 'm4a', 'wav');

    if (!is_dir($base_path)) {
        return $assets;
    }

    try {
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($base_path, FilesystemIterator::SKIP_DOTS)
        );
        foreach ($iterator as $file) {
            if (!$file->isFile()) {
                continue;
            }
            $relative = ltrim(str_replace($base_path, '', $file->getPathname()), '/\\');
            $extension = strtolower(pathinfo($relative, PATHINFO_EXTENSION));
            if (!in_array($extension, $allowed, true)) {
                continue;
            }
            if (in_array($extension, array('mp4', 'webm'), true)) {
                $type = 'video';
            } elseif (in_array($extension, array('mp3', 'm4a', 'wav', 'ogg'), true)) {
                $type = 'audio';
            } else {
                $type = 'image';
            }
            $assets[] = array(
                'name' => $relative,
                'url' => BCM_MINI_SIM_URL . 'assets/' . str_replace('%2F', '/', rawurlencode(str_replace('\\', '/', $relative))),
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

function bcm_mini_sim_pick_asset($assets, $names, $type)
{
    $wanted = array_map('strtolower', (array) $names);
    foreach ($wanted as $wanted_name) {
        foreach ($assets as $asset) {
            if (isset($asset['name'], $asset['type']) && $asset['type'] === $type && strtolower($asset['name']) === $wanted_name) {
                return $asset['url'];
            }
        }
    }
    foreach ($assets as $asset) {
        if (!isset($asset['name'], $asset['type']) || $asset['type'] !== $type) {
            continue;
        }
        $basename = strtolower(pathinfo($asset['name'], PATHINFO_FILENAME));
        foreach ($wanted as $wanted_name) {
            if ($basename === strtolower(pathinfo($wanted_name, PATHINFO_FILENAME))) {
                return $asset['url'];
            }
        }
    }
    return '';
}

function bcm_mini_sim_enqueue_assets()
{
    $assets = bcm_mini_sim_get_assets();
    $door = bcm_mini_sim_pick_asset($assets, array('door1.png', 'door.png'), 'image');
    if (!$door && file_exists(BCM_MINI_SIM_PATH . 'door.png')) {
        $door = BCM_MINI_SIM_URL . 'door.png';
    }

    $backside_urls = array();
    $backside_files = glob(BCM_MINI_SIM_PATH . 'back*.png');
    if (is_array($backside_files)) {
        foreach ($backside_files as $backside_file) {
            if (!is_file($backside_file)) {
                continue;
            }
            $backside_urls[] = BCM_MINI_SIM_URL . rawurlencode(basename($backside_file));
        }
    }
    foreach ($assets as $asset) {
        if (!isset($asset['name'], $asset['type']) || $asset['type'] !== 'image') {
            continue;
        }
        $base = strtolower(pathinfo($asset['name'], PATHINFO_BASENAME));
        if (strpos($base, 'back') === 0 && substr($base, -4) === '.png') {
            $backside_urls[] = $asset['url'];
        }
    }
    $backside_urls = array_values(array_unique($backside_urls));
    if (!$backside_urls) {
        $backside_urls = array(
            'https://raw.githubusercontent.com/ShamanOrWhitch/BCM4StarAtlas/main/backrside.png',
            'https://raw.githubusercontent.com/ShamanOrWhitch/BCM4StarAtlas/main/backsade1.png',
            'https://raw.githubusercontent.com/ShamanOrWhitch/BCM4StarAtlas/main/backside2.png',
            'https://raw.githubusercontent.com/ShamanOrWhitch/BCM4StarAtlas/main/backside3.png',
            'https://raw.githubusercontent.com/ShamanOrWhitch/BCM4StarAtlas/main/backside4.png',
            'https://raw.githubusercontent.com/ShamanOrWhitch/BCM4StarAtlas/main/backsidea.png',
        );
    }

    wp_enqueue_style('bcm-mini-sim', BCM_MINI_SIM_URL . 'assets/css/mini-sim.css', array(), BCM_MINI_SIM_VERSION);
    wp_enqueue_script('bcm-mini-sim', BCM_MINI_SIM_URL . 'assets/js/mini-sim.js', array(), BCM_MINI_SIM_VERSION, false);
    wp_localize_script('bcm-mini-sim', 'BCMMiniSimConfig', array(
        'threeUrl' => BCM_MINI_SIM_URL . 'assets/js/three.min.js',
        'doorTexture' => $door,
        'menuBackgroundUrl' => bcm_mini_sim_pick_asset($assets, array('perference bg.png'), 'image'),
        'musicUrl' => bcm_mini_sim_pick_asset($assets, array('starbase ost.mp3', 'starbase-ost.mp3', 'ost.mp3'), 'audio'),
        'spaceVideoZones' => array(
            // Only one clip in the portal/open-space room.
            array('url' => 'https://walkingyog.com/wp-content/uploads/2025/11/30Сек43-1.mp4', 'x' => -4.2, 'y' => 1.4, 'z' => -38.5, 'radius' => 9, 'maxWidth' => 7.2, 'maxHeight' => 4.5),

            // The remaining clips are beyond Room 2 in the large exterior space.
            array('url' => 'https://walkingyog.com/wp-content/uploads/2025/12/Jah-Love-480P.mp4', 'x' => -18, 'y' => 7, 'z' => -105, 'radius' => 16, 'maxWidth' => 8.0, 'maxHeight' => 5.0),
            array('url' => 'https://walkingyog.com/wp-content/uploads/2026/09/i-dance-fin.mp4', 'x' => 18, 'y' => -6, 'z' => -135, 'radius' => 18, 'maxWidth' => 8.0, 'maxHeight' => 5.0),
            array('url' => 'https://walkingyog.com/wp-content/uploads/2026/09/Reshade-Rasta-Dance3.mp4', 'x' => -22, 'y' => 8, 'z' => -170, 'radius' => 20, 'maxWidth' => 8.5, 'maxHeight' => 5.2),
        ),
        'liveWall' => array(
            'url' => 'https://walkingyog.com/wp-content/uploads/2026/09/wall.mp4',
            'fallback' => bcm_mini_sim_pick_asset($assets, array('wall1.png'), 'image'),
            'x' => 5.96,
            'y' => 0,
            'z' => -10,
            'width' => 28,
            'height' => 8,
            'rotationY' => -1.5707963267948966,
            'radius' => 24,
        ),
        'backsideTextures' => $backside_urls,
        'assets' => $assets,
        'version' => BCM_MINI_SIM_VERSION,
    ));
}

function bcm_mini_sim_shortcode($atts = array())
{
    bcm_mini_sim_enqueue_assets();
    $atts = shortcode_atts(array('height' => 'min(100vh, 900px)'), $atts, 'bcm_mini_sim');
    ob_start();
    ?>
    <div class="bcm-mini-sim" style="--bcm-sim-height:<?php echo esc_attr($atts['height']); ?>;">
        <canvas class="bcm-mini-sim-canvas" tabindex="0"></canvas>
        <div class="bcm-mini-sim-menu-backdrop" aria-hidden="true"></div>
        <div class="bcm-mini-sim-menu-shade" aria-hidden="true"></div>
        <div class="bcm-mini-sim-landscape-warning">ПОВЕРНИТЕ УСТРОЙСТВО ГОРИЗОНТАЛЬНО</div>
        <div class="bcm-mini-sim-hud">
            <div class="bcm-mini-sim-title">SPACE LABYRINTH — 0.6.4</div>
            <div class="bcm-mini-sim-status">ENGINE LOADING...</div>
            <div class="bcm-mini-sim-interaction"></div>
            <div class="bcm-mini-sim-help">
                <span>W/S</span> thrust · <span>A/D</span> strafe · <span>Mouse</span> look ·
                <span>Enter</span> menu · <span>Esc</span> release mouse ·
                <span>G</span> portal video · <span>F</span> focus nearest screen · <span>LIVE WALL</span> wall.mp4
            </div>
        </div>
        <div class="bcm-mini-sim-asset-status">LOCAL ASSETS: SCANNING...</div>
        <button class="bcm-mini-sim-start" type="button">ИГРАТЬ</button>
        <button class="bcm-mini-sim-music" type="button" hidden>♫</button>
        <button class="bcm-mini-sim-crystal bcm-mini-sim-crystal-main" type="button">◆</button>
        <audio class="bcm-mini-sim-music-audio" preload="none" loop></audio>
        <div class="bcm-mini-sim-transition" hidden>
            <video class="bcm-mini-sim-transition-video" playsinline></video>
            <div class="bcm-mini-sim-transition-label">PORTAL</div>
            <button class="bcm-mini-sim-transition-close" type="button">×</button>
        </div>
        <div class="bcm-mini-sim-settings" hidden>
            <div class="bcm-mini-sim-settings-card">
                <h2>SETTINGS</h2>
                <label>Громкость <input type="range" min="0" max="100" value="42" data-setting="volume"></label>
                <label><input type="checkbox" data-setting="invertPitch" checked> Авиа-питч (вниз = вверх взгляда)</label>
                <label><input type="checkbox" data-setting="invertYaw"> Реверс лево/право</label>
                <p>Музыка только после «Играть». Esc отпускает мышь и не вешает цикл. G или 69% портала — mp4, затем комната 2.</p>
                <button type="button" data-setting="close">Закрыть</button>
            </div>
        </div>
        <div class="bcm-mini-sim-mobile" aria-hidden="true">
            <div class="bcm-mini-sim-mobile-left">
                <button data-control="thrust">▲</button>
                <button data-control="brake">▼</button>
                <button data-control="rollLeft">↶</button>
                <button data-control="rollRight">↷</button>
            </div>
            <div class="bcm-mini-sim-mobile-right">
                <button data-control="up">↟</button>
                <button data-control="down">↡</button>
                <button data-control="yawLeft">◀</button>
                <button data-control="yawRight">▶</button>
                <button data-control="tilt">TILT</button>
                <button data-control="portal">G</button>
                <button data-control="home">HOME</button>
            </div>
            <div class="bcm-mini-sim-mobile-edge bcm-mini-sim-mobile-edge-top" data-edge="up" aria-hidden="true"></div>
            <div class="bcm-mini-sim-mobile-edge bcm-mini-sim-mobile-edge-bottom" data-edge="down" aria-hidden="true"></div>
            <div class="bcm-mini-sim-mobile-edge bcm-mini-sim-mobile-edge-left" data-edge="left" aria-hidden="true"></div>
            <div class="bcm-mini-sim-mobile-edge bcm-mini-sim-mobile-edge-right" data-edge="right" aria-hidden="true"></div>
        </div>
    </div>
    <?php
    return ob_get_clean();
}

add_shortcode('bcm_mini_sim', 'bcm_mini_sim_shortcode');
add_filter('autoptimize_filter_js_exclude', function ($exclude) {
    return $exclude . ', mini-sim/assets/js/mini-sim.js, three.min.js';
});
