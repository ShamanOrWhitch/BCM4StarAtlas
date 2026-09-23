<?php
/**
 * Plugin Name: BCM Mini Space Simulation
 * Description: Self-contained 6DOF space-labyrinth test for WordPress.
 * Version: 0.5.2
 * Author: ShamanOrWitch
 * License: GPL-2.0-or-later
 */

if (!defined('ABSPATH')) {
    exit;
}

define('BCM_MINI_SIM_VERSION', '0.5.2');
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

    wp_enqueue_style('bcm-mini-sim', BCM_MINI_SIM_URL . 'assets/css/mini-sim.css', array(), BCM_MINI_SIM_VERSION);
    wp_enqueue_script('bcm-mini-sim', BCM_MINI_SIM_URL . 'assets/js/mini-sim.js', array(), BCM_MINI_SIM_VERSION, false);
    wp_localize_script('bcm-mini-sim', 'BCMMiniSimConfig', array(
        'threeUrl' => BCM_MINI_SIM_URL . 'assets/js/three.min.js',
        'doorTexture' => $door,
        'menuBackgroundUrl' => bcm_mini_sim_pick_asset($assets, array('perference bg.png'), 'image'),
        'musicUrl' => bcm_mini_sim_pick_asset($assets, array('starbase ost.mp3', 'starbase-ost.mp3', 'ost.mp3'), 'audio'),
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
        <div class="bcm-mini-sim-landscape-warning">ÐÐÐÐÐ ÐÐÐ¢Ð Ð£Ð¡Ð¢Ð ÐÐÐ¡Ð¢ÐÐ ÐÐÐ ÐÐÐÐÐ¢ÐÐÐ¬ÐÐ</div>
        <div class="bcm-mini-sim-hud">
            <div class="bcm-mini-sim-title">SPACE LABYRINTH â 0.5.2</div>
            <div class="bcm-mini-sim-status">ENGINE LOADING...</div>
            <div class="bcm-mini-sim-interaction"></div>
            <div class="bcm-mini-sim-help">
                <span>W/S</span> thrust Â· <span>A/D</span> strafe Â· <span>Mouse</span> look Â·
                <span>Enter</span> menu Â· <span>Esc</span> release mouse Â·
                <span>G</span> portal video
            </div>
        </div>
        <div class="bcm-mini-sim-asset-status">LOCAL ASSETS: SCANNING...</div>
        <button class="bcm-mini-sim-start" type="button">ÐÐÐ ÐÐ¢Ð¬</button>
        <button class="bcm-mini-sim-music" type="button" hidden>â«</button>
        <button class="bcm-mini-sim-crystal bcm-mini-sim-crystal-main" type="button">â</button>
        <audio class="bcm-mini-sim-music-audio" preload="none" loop></audio>
        <div class="bcm-mini-sim-transition" hidden>
            <video class="bcm-mini-sim-transition-video" playsinline></video>
            <div class="bcm-mini-sim-transition-label">PORTAL</div>
            <button class="bcm-mini-sim-transition-close" type="button">Ã</button>
        </div>
        <div class="bcm-mini-sim-settings" hidden>
            <div class="bcm-mini-sim-settings-card">
                <h2>SETTINGS</h2>
                <label>ÐÑÐ¾Ð¼ÐºÐ¾ÑÑÑ <input type="range" min="0" max="100" value="42" data-setting="volume"></label>
                <label><input type="checkbox" data-setting="invertPitch" checked> ÐÐ²Ð¸Ð°-Ð¿Ð¸ÑÑ (Ð²Ð½Ð¸Ð· = Ð²Ð²ÐµÑÑ Ð²Ð·Ð³Ð»ÑÐ´Ð°)</label>
                <label><input type="checkbox" data-setting="invertYaw"> Ð ÐµÐ²ÐµÑÑ Ð»ÐµÐ²Ð¾/Ð¿ÑÐ°Ð²Ð¾</label>
                <p>ÐÑÐ·ÑÐºÐ° ÑÐ¾Ð»ÑÐºÐ¾ Ð¿Ð¾ÑÐ»Ðµ Â«ÐÐ³ÑÐ°ÑÑÂ». Esc Ð¾ÑÐ¿ÑÑÐºÐ°ÐµÑ Ð¼ÑÑÑ Ð¸ Ð½Ðµ Ð²ÐµÑÐ°ÐµÑ ÑÐ¸ÐºÐ». G Ð¸Ð»Ð¸ 69% Ð¿Ð¾ÑÑÐ°Ð»Ð° â mp4, Ð·Ð°ÑÐµÐ¼ ÐºÐ¾Ð¼Ð½Ð°ÑÐ° 2.</p>
                <button type="button" data-setting="close">ÐÐ°ÐºÑÑÑÑ</button>
            </div>
        </div>
        <div class="bcm-mini-sim-mobile" aria-hidden="true">
            <div class="bcm-mini-sim-mobile-left">
                <button data-control="thrust">â²</button>
                <button data-control="brake">â¼</button>
                <button data-control="rollLeft">â¶</button>
                <button data-control="rollRight">â·</button>
            </div>
            <div class="bcm-mini-sim-mobile-right">
                <button data-control="up">â</button>
                <button data-control="down">â¡</button>
                <button data-control="yawLeft">â</button>
                <button data-control="yawRight">â¶</button>
                <button data-control="tilt">TILT</button>
                <button data-control="portal">G</button>
            </div>
        </div>
    </div>
    <?php
    return ob_get_clean();
}

add_shortcode('bcm_mini_sim', 'bcm_mini_sim_shortcode');
add_filter('autoptimize_filter_js_exclude', function ($exclude) {
    return $exclude . ', mini-sim/assets/js/mini-sim.js, three.min.js';
});
