<?php
/**
 * Plugin Name: BCM Mini Space Simulation
 * Description: Self-contained Descent-style 6DOF space-labyrinth test for WordPress.
 * Version: 0.5.2
 * Author: ShamanOrWitch
 * License: GPL-2.0-or-later
 */

if (!defined('ABSPATH')) exit;

define('BCM_MINI_SIM_VERSION', '0.5.2');
define('BCM_MINI_SIM_URL', plugin_dir_url(__FILE__));
define('BCM_MINI_SIM_PATH', plugin_dir_path(__FILE__));

function bcm_mini_sim_video_mime($extension) {
    $map = array(
        'mp4' => 'video/mp4',
        'webm' => 'video/webm',
        'ogg' => 'video/ogg',
    );

    return isset($map[$extension]) ? $map[$extension] : '';
}

function bcm_mini_sim_stream_video() {
    if (!isset($_GET['bcm_mini_sim_video'])) {
        return;
    }

    $relative = wp_unslash($_GET['bcm_mini_sim_video']);

    if (!is_string($relative) || $relative === '' || strpos($relative, '..') !== false) {
        status_header(400);
        exit;
    }

    $relative = str_replace('\\', '/', ltrim($relative, '/'));
    $base_path = realpath(BCM_MINI_SIM_PATH . 'assets');
    $file_path = realpath(BCM_MINI_SIM_PATH . 'assets/' . $relative);

    if (
        !$base_path ||
        !$file_path ||
        strpos($file_path, $base_path . DIRECTORY_SEPARATOR) !== 0 ||
        !is_file($file_path)
    ) {
        status_header(404);
        exit;
    }

    $extension = strtolower(pathinfo($file_path, PATHINFO_EXTENSION));
    $mime = bcm_mini_sim_video_mime($extension);

    if (!$mime) {
        status_header(404);
        exit;
    }

    $size = filesize($file_path);

    if ($size === false || $size < 1) {
        status_header(404);
        exit;
    }

    $start = 0;
    $end = $size - 1;
    $status = 200;

    if (!empty($_SERVER['HTTP_RANGE'])) {
        $range = trim($_SERVER['HTTP_RANGE']);

        if (preg_match('/bytes=(\d*)-(\d*)/i', $range, $matches)) {
            if ($matches[1] === '' && $matches[2] === '') {
                status_header(416);
                header('Content-Range: bytes */' . $size);
                exit;
            }

            if ($matches[1] === '') {
                $suffix = (int) $matches[2];
                $start = max(0, $size - $suffix);
            } else {
                $start = (int) $matches[1];
            }

            if ($matches[2] !== '') {
                $end = (int) $matches[2];
            }

            if ($end >= $size) {
                $end = $size - 1;
            }

            if ($start < 0 || $start >= $size || $start > $end) {
                status_header(416);
                header('Content-Range: bytes */' . $size);
                exit;
            }

            $status = 206;
        }
    }

    $length = $end - $start + 1;

    status_header($status);
    header('Content-Type: ' . $mime);
    header('Content-Length: ' . $length);
    header('Accept-Ranges: bytes');
    header('Content-Range: bytes ' . $start . '-' . $end . '/' . $size);
    header('Cache-Control: public, max-age=31536000, immutable');
    header('Content-Disposition: inline; filename="' . basename($file_path) . '"');
    header('X-Content-Type-Options: nosniff');

    while (ob_get_level()) {
        ob_end_clean();
    }

    $handle = fopen($file_path, 'rb');

    if (!$handle) {
        status_header(500);
        exit;
    }

    fseek($handle, $start);

    $remaining = $length;
    $chunk_size = 1024 * 1024;

    while ($remaining > 0 && !feof($handle)) {
        $read_length = min($chunk_size, $remaining);
        $buffer = fread($handle, $read_length);

        if ($buffer === false) {
            break;
        }

        echo $buffer;
        $remaining -= strlen($buffer);

        if (function_exists('flush')) {
            flush();
        }
    }

    fclose($handle);
    exit;
}

add_action('template_redirect', 'bcm_mini_sim_stream_video', 0);

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

            $asset = array(
                'name' => $relative,
                'url' => BCM_MINI_SIM_URL . 'assets/' . str_replace('%2F', '/', rawurlencode(str_replace('\\', '/', $relative))),
                'type' => $type,
                'extension' => $extension,
            );

            if ($type === 'video') {
                $asset['streamUrl'] = add_query_arg(
                    'bcm_mini_sim_video',
                    str_replace('\\', '/', $relative),
                    home_url('/')
                );
            }

            $assets[] = $asset;
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
    } elseif (file_exists(BCM_MINI_SIM_PATH . 'assets/door.png')) {
        $door_texture = BCM_MINI_SIM_URL . 'assets/door.png';
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

    if (!$music_url) {
        foreach ($music_candidates as $candidate) {
            if (file_exists(BCM_MINI_SIM_PATH . $candidate)) {
                $music_url = BCM_MINI_SIM_URL . str_replace('%2F', '/', rawurlencode($candidate));
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
        <div class="bcm-mini-sim-landscape-warning" aria-hidden="true">
            ПОВЕРНИТЕ УСТРОЙСТВО ГОРИЗОНТАЛЬНО
        </div>

        <div class="bcm-mini-sim-hud">
            <div class="bcm-mini-sim-title">SPACE LABYRINTH — PLAYABLE TEST 0.52</div>
            <div class="bcm-mini-sim-status">ENGINE LOADING...</div>
            <div class="bcm-mini-sim-interaction"></div>
            <div class="bcm-mini-sim-help">
                <span>W/S</span> thrust · <span>A/D</span> strafe · <span>Space/Ctrl</span> vertical ·
                <span>Mouse</span> look · <span>Q</span>/<span>E</span> roll ·
                <span>Enter</span> меню · <span>F</span> shield · <span>R/◆</span> дверь · <span>G</span> портал / AUTO 69%
            </div>
        </div>

        <div class="bcm-mini-sim-asset-status">LOCAL ASSETS: SCANNING...</div>

        <button class="bcm-mini-sim-start" type="button">ИГРАТЬ</button>
        <div class="bcm-mini-sim-start-hint">Портал уже есть в стартовой секции. Подлетите к светящемуся квадрату: при 69% видимости переход начнётся автоматически. G / Y / PORTAL — ручной запуск.</div>
        <button class="bcm-mini-sim-music" type="button" aria-label="Музыка" title="Музыка">♫</button>

        <button class="bcm-mini-sim-crystal bcm-mini-sim-crystal-main" type="button"
                aria-label="Remote door crystal" title="Дистанционно открыть дверь">◆</button>

        <audio class="bcm-mini-sim-music-audio" preload="none" loop></audio>

        <div class="bcm-mini-sim-settings" hidden>
            <div class="bcm-mini-sim-settings-card">
                <h2>SETTINGS</h2>
                <label>Громкость <input type="range" min="0" max="100" value="42" data-setting="volume"></label>
                <label>Качество текстур
                    <select data-setting="quality">
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                    </select>
                </label>
                <label><input type="checkbox" data-setting="effects" checked> Доп. эффекты</label>
                <label><input type="checkbox" data-setting="invertPitch" checked> Авиа-питч (вниз устройства = вверх взгляда)</label>
                <label><input type="checkbox" data-setting="invertYaw"> Реверс лево/право</label>
                <p>Портал запускается сам при 69% видимости квадрата. G / Y / PORTAL — ручной запуск. Во время видео полёт заблокирован, после ended — телепорт.</p>
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
                <button data-control="up">☝</button>
                <button data-control="down">↧</button>
                <button data-control="yawLeft">◀</button>
                <button data-control="yawRight">▶</button>
                <button data-control="shield">🛡</button>
                <button data-control="tilt">TILT</button>
                <button data-control="portal" aria-label="Портал">PORTAL</button>
            </div>
        </div>
    </div>
    <?php
    return ob_get_clean();
}

add_shortcode('bcm_mini_sim', 'bcm_mini_sim_shortcode');
