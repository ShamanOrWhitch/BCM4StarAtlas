<?php
/**
 * Plugin Name: BCM Mini Space Simulation
 * Description: Self-contained Descent-style 6DOF space-labyrinth test for WordPress.
 * Version: 0.3.7
 * Author: ShamanOrWitch
 * License: GPL-2.0-or-later
 */

if (!defined('ABSPATH')) exit;

define('BCM_MINI_SIM_VERSION', '0.3.7');
define('BCM_MINI_SIM_URL', plugin_dir_url(__FILE__));
define('BCM_MINI_SIM_PATH', plugin_dir_path(__FILE__));

function bcm_mini_sim_get_assets() {
    $assets = array();
    $base_path = BCM_MINI_SIM_PATH . 'assets/';
    $allowed = array(
        'png', 'jpg', 'jpeg', 'webp', 'gif',
        'mp4', 'webm', 'ogg',
        'mp3', 'm4a', 'wav'
    );

    if (!is_dir($base_path)) {
        return $assets;
    }

    try {
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($base_path, FilesystemIterator::SKIP_DOTS)
        );

        foreach ($iterator as $file) {
            if (!$file->isFile()) continue;

            $path = $file->getPathname();
            $relative = ltrim(str_replace($base_path, '', $path), '/\\');
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
                'url' => BCM_MINI_SIM_URL . str_replace('%2F', '/', rawurlencode(str_replace('\\', '/', $relative))),
                'type' => $type,
                'extension' => $extension,
            );
        }
    } catch (Exception $e) {
        // Keep the plugin usable even when directory iteration is unavailable.
    }

    usort($assets, function($a, $b) {
        return strcasecmp($a['name'], $b['name']);
    });

    return $assets;
}

function bcm_mini_sim_pick_asset($assets, $names, $type) {
    $wanted = array_map('strtolower', (array) $names);

    foreach ($wanted as $wanted_name) {
        foreach ($assets as $asset) {
            if (
                isset($asset['name'], $asset['type']) &&
                $asset['type'] === $type &&
                strtolower($asset['name']) === $wanted_name
            ) {
                return $asset['url'];
            }
        }
    }

    foreach ($assets as $asset) {
        if (
            !isset($asset['name'], $asset['type']) ||
            $asset['type'] !== $type
        ) {
            continue;
        }

        $basename = strtolower(pathinfo($asset['name'], PATHINFO_FILENAME));
        foreach ($wanted as $wanted_name) {
            $wanted_base = strtolower(pathinfo($wanted_name, PATHINFO_FILENAME));
            if ($basename === $wanted_base) {
                return $asset['url'];
            }
        }
    }

    return '';
}

function bcm_mini_sim_enqueue_assets() {
    $door_texture = '';

    if (file_exists(BCM_MINI_SIM_PATH . 'door.png')) {
        $door_texture = BCM_MINI_SIM_URL . 'door.png';
    } elseif (file_exists(dirname(BCM_MINI_SIM_PATH) . '/door.png')) {
        $door_texture = BCM_MINI_SIM_URL . '../door.png';
    }

    $assets = bcm_mini_sim_get_assets();

    $menu_background = bcm_mini_sim_pick_asset(
        $assets,
        array('perference bg.png'),
        'image'
    );

    $music_candidates = array(
        'starbase ost.mp3',
        'starbase-ost.mp3',
        'starbase_ost.mp3',
        'background.mp3',
        'music.mp3',
        'menu.mp3',
        'ost.mp3'
    );

    $music_url = bcm_mini_sim_pick_asset(
        $assets,
        $music_candidates,
        'audio'
    );

    // Also accept the same OST beside bcm-mini-sim.php. This is useful when
    // the project archive was uploaded with the music at plugin root.
    if (!$music_url) {
        foreach ($music_candidates as $candidate) {
            if (file_exists(BCM_MINI_SIM_PATH . $candidate)) {
                $music_url = BCM_MINI_SIM_URL . str_replace(
                    '%2F',
                    '/',
                    rawurlencode($candidate)
                );
                break;
            }
        }
    }

    wp_enqueue_style(
        'bcm-mini-sim',
        BCM_MINI_SIM_URL . 'assets/css/mini-sim.css',
        array(),
        BCM_MINI_SIM_VERSION
    );

    // Only the simulator loader is enqueued here. It dynamically loads the
    // bundled Three.js r128 itself, so Autoptimize/script reordering cannot
    // execute mini-sim.js before the engine is available.
    wp_enqueue_script(
        'bcm-mini-sim',
        BCM_MINI_SIM_URL . 'assets/js/mini-sim.js',
        array(),
        BCM_MINI_SIM_VERSION,
        false
    );

    wp_localize_script('bcm-mini-sim', 'BCMMiniSimConfig', array(
        'threeUrl' => BCM_MINI_SIM_URL . 'assets/js/three.min.js',
        'doorTexture' => $door_texture,
        'menuBackgroundUrl' => $menu_background,
        'musicUrl' => $music_url,
        'assets' => $assets,
        'version' => BCM_MINI_SIM_VERSION,
    ));
}

function bcm_mini_sim_shortcode($atts = array()) {
    bcm_mini_sim_enqueue_assets();

    $atts = shortcode_atts(array(
        'height' => 'min(100vh, 900px)',
    ), $atts, 'bcm_mini_sim');

    ob_start();
    ?>
    <div class="bcm-mini-sim" style="--bcm-sim-height:<?php echo esc_attr($atts['height']); ?>;">
        <canvas class="bcm-mini-sim-canvas" tabindex="0"></canvas>

        <div class="bcm-mini-sim-menu-backdrop" aria-hidden="true"></div>
        <div class="bcm-mini-sim-menu-shade" aria-hidden="true"></div>

        <div class="bcm-mini-sim-hud">
            <div class="bcm-mini-sim-title">SPACE LABYRINTH — PLAYABLE TEST 0.37</div>
            <div class="bcm-mini-sim-status">ENGINE LOADING...</div>
            <div class="bcm-mini-sim-interaction"></div>
            <div class="bcm-mini-sim-help">
                <span>W/S</span> thrust · <span>A/D</span> strafe · <span>Space/Ctrl</span> vertical ·
                <span>Mouse</span> look · <span>Q</span> clockwise roll · <span>E</span> counter-clockwise roll ·
                <span>F</span> shield · <span>R/◆</span> door crystal · <span>G</span> portal · <span>T</span> alternate portal route
            </div>
        </div>

        <div class="bcm-mini-sim-asset-status">LOCAL ASSETS: SCANNING...</div>

        <button class="bcm-mini-sim-start" type="button">ИГРАТЬ</button>
        <button class="bcm-mini-sim-music" type="button" aria-label="Музыка" title="Музыка">♫</button>

        <button class="bcm-mini-sim-crystal bcm-mini-sim-crystal-main" type="button"
                aria-label="Remote door crystal" title="Дистанционно открыть дверь">◆</button>

        <audio class="bcm-mini-sim-music-audio" preload="none" loop></audio>

        <div class="bcm-mini-sim-mobile" aria-hidden="true">
            <button data-control="thrust">▲</button>
            <button data-control="brake">▼</button>
            <button data-control="left">◀</button>
            <button data-control="right">▶</button>
            <button data-control="up">↟</button>
            <button data-control="down">↡</button>
            <button data-control="rollLeft">↶</button>
            <button data-control="rollRight">↷</button>
            <button data-control="shield">🛡</button>
            <button data-control="route">↕</button>
            <button data-control="tilt">TILT</button>
            <button data-control="portal">G</button>
        </div>
    </div>
    <?php
    return ob_get_clean();
}

add_shortcode('bcm_mini_sim', 'bcm_mini_sim_shortcode');
