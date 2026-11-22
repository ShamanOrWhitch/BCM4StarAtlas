<?php
/**
 * Full-screen globe served by this plugin. No external address.
 */

if (!defined('ABSPATH')) {
    exit;
}

$url = function_exists('galia_desk_app_url') ? galia_desk_app_url() : '';
?><!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Galia</title>
<style>
  html, body { margin: 0; height: 100%; background: #07090e; color: #e8eef2; }
  iframe { display: block; width: 100%; height: 100dvh; border: 0; background: #07090e; }
</style>
</head>
<body>
<?php
if ($url !== '') {
    echo '<iframe title="Galia" src="' . esc_url($url) . '" allow="fullscreen" allowfullscreen></iframe>';
} elseif (function_exists('galia_desk_globe_markup')) {
    echo galia_desk_globe_markup(true);
}
?>
</body>
</html>
