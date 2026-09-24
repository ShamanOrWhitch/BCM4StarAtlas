<?php
/**
 * Full-screen shell. The globe, crew and market stay in the published app.
 * WordPress only fills the window with that address.
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
  .galia-app-miss { max-width: 36rem; margin: 0 auto; padding: 2rem 1.25rem; font: 16px/1.5 "Segoe UI", system-ui, sans-serif; }
  .galia-app-miss a { color: #c4a35a; }
</style>
</head>
<body>
<?php if ($url !== '') : ?>
<iframe title="Galia" src="<?php echo esc_url($url); ?>" allow="fullscreen" allowfullscreen></iframe>
<?php else : ?>
<main class="galia-app-miss">
  <p>Адрес приложения ещё не задан. В админке: Настройки → Galia Desk → вставь https-адрес опубликованной Galia и обнови страницу.</p>
</main>
<?php endif; ?>
</body>
</html>
