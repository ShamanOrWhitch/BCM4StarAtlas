<?php
/**
 * Plugin Name: BCM Mini Space Simulation
 * Description: Lightweight Descent-style 6DOF space-labyrinth simulation for WordPress.
 * Version: 0.2.1
 * Author: ShamanOrWitch
 * License: GPL-2.0-or-later
 */

if (!defined('ABSPATH')) exit;

define('BCM_MINI_SIM_VERSION', '0.2.1');
define('BCM_MINI_SIM_URL', plugin_dir_url(__FILE__));
define('BCM_MINI_SIM_PATH', plugin_dir_path(__FILE__));

function bcm_mini_sim_enqueue_assets() {
    $door_texture = '';
    if (file_exists(BCM_MINI_SIM_PATH . 'door.png')) {
        $door_texture = BCM_MINI_SIM_URL . 'door.png';
    } elseif (file_exists(dirname(BCM_MINI_SIM_PATH) . '/door.png')) {
        $door_texture = plugins_url('door.png', dirname(BCM_MINI_SIM_PATH) . '/placeholder.php');
    }

    wp_enqueue_style(
        'bcm-mini-sim',
        BCM_MINI_SIM_URL . 'assets/css/mini-sim.css',
        array(),
        BCM_MINI_SIM_VERSION
    );

    // Three.js is used only as the lightweight WebGL renderer/geometry layer.
    wp_enqueue_script(
        'bcm-three',
        'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.min.js',
        array(),
        '0.180.0',
        true
    );

    wp_enqueue_script(
        'bcm-mini-sim',
        BCM_MINI_SIM_URL . 'assets/js/mini-sim.js',
        array('bcm-three'),
        BCM_MINI_SIM_VERSION,
        true
    );

    wp_localize_script('bcm-mini-sim', 'BCMMiniSimConfig', array(
        'textureBase' => BCM_MINI_SIM_URL . 'assets/',
        'doorTexture' => $door_texture,
        'remoteTextures' => array(
            BCM_MINI_SIM_URL . 'assets/wall1.png',
            BCM_MINI_SIM_URL . 'assets/wall2.png',
            BCM_MINI_SIM_URL . 'assets/wall3.png',
            BCM_MINI_SIM_URL . 'assets/wall4.png',
            BCM_MINI_SIM_URL . 'assets/wall5.png',
        ),
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
        <canvas class="bcm-mini-sim-canvas"></canvas>

        <div class="bcm-mini-sim-hud">
            <div class="bcm-mini-sim-title">SPACE LABYRINTH — PLAYABLE TEST</div>
            <div class="bcm-mini-sim-status">Loading...</div>
            <div class="bcm-mini-sim-help">
                <span>W/S</span> thrust · <span>A/D</span> strafe · <span>Space/Ctrl</span> vertical ·
                <span>Mouse</span> look · <span>F</span> shield · <span>Q/E</span> roll · <span>R</span> door crystal
            </div>
        </div>

        <button class="bcm-mini-sim-start" type="button">ИГРАТЬ</button>

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
            <button class="bcm-mini-sim-crystal" data-control="remoteDoor" aria-label="Remote door crystal" title="Remote door crystal">◆</button>
        </div>
    </div>
    <?php
    return ob_get_clean();
}

add_shortcode('bcm_mini_sim', 'bcm_mini_sim_shortcode');
