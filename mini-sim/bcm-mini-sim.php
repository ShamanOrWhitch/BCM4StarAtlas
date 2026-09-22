<?php
/**
 * Plugin Name: BCM Mini Space Simulation
 * Description: Self-contained Descent-style 6DOF space-labyrinth test for WordPress.
 * Version: 0.3.4
 * Author: ShamanOrWitch
 * License: GPL-2.0-or-later
 */

if (!defined('ABSPATH')) exit;

define('BCM_MINI_SIM_VERSION', '0.3.4');
define('BCM_MINI_SIM_URL', plugin_dir_url(__FILE__));
define('BCM_MINI_SIM_PATH', plugin_dir_path(__FILE__));

function bcm_mini_sim_get_assets() {
    $assets = array();
    $base_path = BCM_MINI_SIM_PATH . 'assets/';
    $allowed = array('png', 'jpg', 'jpeg', 'webp', 'gif', 'mp4', 'webm', 'ogg');

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

            $assets[] = array(
                'name' => $relative,
                'url' => BCM_MINI_SIM_URL . str_replace('%2F', '/', rawurlencode(str_replace('\\', '/', $relative))),
                'type' => in_array($extension, array('mp4', 'webm', 'ogg'), true) ? 'video' : 'image',
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

function bcm_mini_sim_enqueue_assets() {
    $door_texture = '';

    if (file_exists(BCM_MINI_SIM_PATH . 'door.png')) {
        $door_texture = BCM_MINI_SIM_URL . 'door.png';
    } elseif (file_exists(dirname(BCM_MINI_SIM_PATH) . '/door.png')) {
        $door_texture = BCM_MINI_SIM_URL . '../door.png';
    }

    $assets = bcm_mini_sim_get_assets();

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

        <div class="bcm-mini-sim-hud">
            <div class="bcm-mini-sim-title">SPACE LABYRINTH — PLAYABLE TEST 0.3</div>
            <div class="bcm-mini-sim-status">ENGINE LOADING...</div>
            <div class="bcm-mini-sim-help">
                <span>W/S</span> thrust · <span>A/D</span> strafe · <span>Space/Ctrl</span> vertical ·
                <span>Mouse</span> look · <span>Q</span> rotate clockwise · <span>E</span> rotate counter-clockwise ·
                <span>F</span> shield · <span>R/◆</span> door crystal · <span>G</span> portal transition
            </div>
        </div>

        <div class="bcm-mini-sim-asset-status">LOCAL ASSETS: SCANNING...</div>

        <button class="bcm-mini-sim-start" type="button">ИГРАТЬ</button>

        <button class="bcm-mini-sim-crystal bcm-mini-sim-crystal-main" type="button"
                aria-label="Remote door crystal" title="Дистанционно открыть дверь">◆</button>

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
            <button data-control="portal">G</button>
        </div>
    </div>
    <?php
    return ob_get_clean();
}

add_shortcode('bcm_mini_sim', 'bcm_mini_sim_shortcode');
