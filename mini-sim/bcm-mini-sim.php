<?php
/**
 * Plugin Name: BCM Mini Space Simulation
 * Description: Self-contained 6DOF space-labyrinth test for WordPress.
 * Version: 0.8.9
 * Author: ShamanOrWitch
 * License: GPL-2.0-or-later
 */

if (!defined('ABSPATH')) {
    exit;
}

define('BCM_MINI_SIM_VERSION', '0.8.9');
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
        'capdoorVideo' => bcm_mini_sim_pick_asset($assets, array('capdoor.mp4'), 'video'),
        'room1WallVideo' => bcm_mini_sim_pick_asset($assets, array('Wall.mp4', 'wall.mp4'), 'video'),
        'room2RightVideo' => bcm_mini_sim_pick_asset($assets, array('doorwallbotright.mp4', 'door-wallbotright.mp4'), 'video'),
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
            <div class="bcm-mini-sim-brand">BCM 4 STAR ATLAS</div>
            <div class="bcm-mini-sim-title">SPACE LABYRINTH — 0.8.9</div>
            <div class="bcm-mini-sim-mission">МИССИЯ: ПРОВЕРИТЬ ВНЕШНИЕ ЭКРАНЫ</div>
            <div class="bcm-mini-sim-status">ENGINE LOADING...</div>
            <div class="bcm-mini-sim-interaction"></div>
            <div class="bcm-mini-sim-help bcm-mini-sim-help-keyboard">
                <span>W/S</span> тяга · <span>A/D</span> влево/вправо · <span>Space</span> вверх · <span>C</span> вниз ·
                <span>Mouse</span> взгляд · <span>G</span> портал · <span>F</span> фиксация экрана ·
                <span>H</span> домой · <span>R</span> дверь · <span>Enter</span> меню · <span>Esc</span> отпустить мышь
            </div>
            <div class="bcm-mini-sim-help bcm-mini-sim-help-gamepad">
                <span>Левый стик</span> движение · <span>Правый стик</span> взгляд ·
                <span>A</span> дверь · <span>B</span> домой · <span>X</span> фиксация экрана ·
                <span>Y</span> портал · <span>LB/RB</span> крен · <span>LT/RT</span> вверх/вниз ·
                <span>Start/Select</span> меню
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
                <label><input type="checkbox" data-setting="invertPitch" checked> Инверсия вертикального наклона</label>
                <label><input type="checkbox" data-setting="invertYaw"> Реверс лево/право</label>
                <p>Клавиатура: W/S — тяга, A/D — влево/вправо, Space — вверх, C — вниз, G — портал, F — фиксация экрана, H — домой, R — дверь.</p>
                <p>Gamepad: левый стик — движение, правый — взгляд; A — дверь, B — домой, X — фиксация экрана, Y — портал; LB/RB — крен, LT/RT — вверх/вниз, Start/Select — меню.</p>
                <p>Миссия: проверить внешние экраны и все видеозоны. Подлетайте к каждому экрану снаружи, дождитесь его запуска и нажмите центр экрана для той же фиксации ролика, что и клавиша F. На телефоне ▲/▼ — тяга вперёд/назад; ↟/↡ — вертикаль вверх/вниз; ◀/▶ — поворот; ↶/↷ — крен. Свайп — ручной обзор, наклон — обзор.</p>
                <p>Музыка только после «Играть». Esc отпускает мышь. G или 69% портала запускает видео перехода, затем перенос в Room 2.</p>
                <button type="button" data-setting="checkVideos">Проверить все видео</button>
                <div class="bcm-mini-sim-video-check-status" data-setting="videoCheckStatus">Видео: ещё не проверялись.</div>
                <button type="button" data-setting="close">Закрыть</button>
            </div>
        </div>
        <div class="bcm-mini-sim-mobile" aria-hidden="true">
            <div class="bcm-mini-sim-mobile-left">
                <button data-control="thrust" aria-label="Тяга вперёд">▲</button>
                <button data-control="brake" aria-label="Тяга назад">▼</button>
                <button data-control="rollLeft" aria-label="Крен влево">↶</button>
                <button data-control="rollRight" aria-label="Крен вправо">↷</button>
            </div>
            <button class="bcm-mini-sim-mobile-focus" data-control="focus" type="button" aria-label="Фиксация экрана">◎</button>
            <div class="bcm-mini-sim-mobile-right">
                <button data-control="down" aria-label="Вертикаль вниз">↡</button>
                <button data-control="up" aria-label="Вертикаль вверх">↟</button>
                <button data-control="yawRight" aria-label="Поворот вправо">▶</button>
                <button data-control="yawLeft" aria-label="Поворот влево">◀</button>
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
