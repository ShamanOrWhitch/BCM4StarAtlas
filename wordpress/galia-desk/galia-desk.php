<?php
/**
 * Plugin Name: Galia Desk
 * Description: Полный экран Galia и стол цен. Шорткоды [galia_app] и [galia_desk]. Лабиринт не заменяет.
 * Version: 0.3.0
 * Author: ShamanOrWitch
 * License: GPL-2.0-or-later
 */

if (!defined('ABSPATH')) {
    exit;
}

const GALIA_DESK_GM = 'traderDnaR5w6Tcoi3NFm53i48FTDNbGjBSZwWXDRrg';
const GALIA_DESK_ATLAS = 'ATLASXmbPQxBUYbxPsV97usA3fPQYEqzQBUHgiFCUsXx';
const GALIA_DESK_POLIS = 'poLisWXnNRwC6oBu1vHiuKQzFjGL4XDSu4g9qjz9qVk';
const GALIA_DESK_RPC = 'https://api.mainnet-beta.solana.com';

function galia_desk_b58encode($bin) {
    $alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    if (function_exists('gmp_init')) {
        $base = gmp_init(bin2hex($bin) === '' ? '0' : ('0x' . bin2hex($bin)), 0);
        $out = '';
        while (gmp_cmp($base, 0) > 0) {
            $out = $alphabet[gmp_intval(gmp_mod($base, 58))] . $out;
            $base = gmp_div_q($base, 58);
        }
    } elseif (function_exists('bcadd')) {
        $n = '0';
        $len = strlen($bin);
        for ($i = 0; $i < $len; $i++) {
            $n = bcmul($n, '256');
            $n = bcadd($n, (string) ord($bin[$i]));
        }
        $out = '';
        while (bccomp($n, '0') > 0) {
            $out = $alphabet[(int) bcmod($n, '58')] . $out;
            $n = bcdiv($n, '58', 0);
        }
    } else {
        return '';
    }
    $zeros = 0;
    $len = strlen($bin);
    for ($i = 0; $i < $len && $bin[$i] === "\0"; $i++) {
        $zeros++;
    }
    return str_repeat('1', $zeros) . $out;
}

function galia_desk_u64($bin) {
    $lo = unpack('V', substr($bin, 0, 4))[1];
    $hi = unpack('V', substr($bin, 4, 4))[1];
    return $hi * 4294967296 + $lo;
}

function galia_desk_remote_json($url, $args = array()) {
    $response = wp_remote_get($url, array_merge(array('timeout' => 25), $args));
    if (is_wp_error($response)) {
        return null;
    }
    $code = wp_remote_retrieve_response_code($response);
    if ($code < 200 || $code >= 300) {
        return null;
    }
    $json = json_decode(wp_remote_retrieve_body($response), true);
    return is_array($json) ? $json : null;
}

function galia_desk_rpc($method, $params) {
    $response = wp_remote_post(GALIA_DESK_RPC, array(
        'timeout' => 40,
        'headers' => array('Content-Type' => 'application/json'),
        'body' => wp_json_encode(array(
            'jsonrpc' => '2.0',
            'id' => 1,
            'method' => $method,
            'params' => $params,
        )),
    ));
    if (is_wp_error($response)) {
        return null;
    }
    $json = json_decode(wp_remote_retrieve_body($response), true);
    return is_array($json) ? $json : null;
}

function galia_desk_catalog() {
    $cached = get_transient('galia_desk_catalog');
    if (is_array($cached)) {
        return $cached;
    }
    $rows = galia_desk_remote_json('https://galaxy.staratlas.com/nfts');
    $catalog = array();
    if (!is_array($rows)) {
        return $catalog;
    }
    foreach ($rows as $row) {
        if (empty($row['mint'])) {
            continue;
        }
        $attrs = isset($row['attributes']) && is_array($row['attributes']) ? $row['attributes'] : array();
        $catalog[$row['mint']] = array(
            'name' => isset($row['name']) ? $row['name'] : $row['mint'],
            'symbol' => isset($row['symbol']) ? $row['symbol'] : '',
            'kind' => isset($attrs['itemType']) ? $attrs['itemType'] : 'other',
            'className' => isset($attrs['class']) ? $attrs['class'] : '',
            'rarity' => isset($attrs['rarity']) ? $attrs['rarity'] : '',
            'spec' => isset($attrs['spec']) ? $attrs['spec'] : '',
            'image' => isset($row['image']) ? $row['image'] : '',
        );
    }
    set_transient('galia_desk_catalog', $catalog, 30 * MINUTE_IN_SECONDS);
    return $catalog;
}

function galia_desk_market() {
    $cached = get_transient('galia_desk_market');
    if (is_array($cached)) {
        return $cached;
    }
    $catalog = galia_desk_catalog();
    $atlas = galia_desk_remote_json('https://galaxy.staratlas.com/tokens/atlas');
    $polis = galia_desk_remote_json('https://galaxy.staratlas.com/tokens/polis');
    $prices = galia_desk_remote_json('https://lite-api.jup.ag/price/v3?ids=' . GALIA_DESK_ATLAS . ',' . GALIA_DESK_POLIS);
    $book = galia_desk_rpc('getProgramAccounts', array(
        GALIA_DESK_GM,
        array(
            'encoding' => 'base64',
            'dataSlice' => array('offset' => 40, 'length' => 153),
            'filters' => array(array('dataSize' => 201)),
        ),
    ));

    $asks = array();
    $bids = array();
    $qty = array();
    $order_count = 0;
    if (isset($book['result']) && is_array($book['result']) && (function_exists('gmp_init') || function_exists('bcadd'))) {
        $atlas_hex = bin2hex(galia_desk_b58_decode(GALIA_DESK_ATLAS));
        foreach ($book['result'] as $row) {
            $order_count++;
            if (empty($row['account']['data'][0])) {
                continue;
            }
            $raw = base64_decode($row['account']['data'][0]);
            if (!is_string($raw) || strlen($raw) < 153) {
                continue;
            }
            if (bin2hex(substr($raw, 0, 32)) !== $atlas_hex) {
                continue;
            }
            $asset = galia_desk_b58encode(substr($raw, 32, 32));
            $side = ord($raw[128]);
            $price = galia_desk_u64(substr($raw, 129, 8)) / 100000000;
            $rem = galia_desk_u64(substr($raw, 145, 8));
            if ($price <= 0 || $rem <= 0) {
                continue;
            }
            if ($side === 1 && (!isset($asks[$asset]) || $price < $asks[$asset])) {
                $asks[$asset] = $price;
                $qty[$asset] = $rem;
            } elseif ($side === 0 && (!isset($bids[$asset]) || $price > $bids[$asset])) {
                $bids[$asset] = $price;
            }
        }
    }

    $resources = array();
    foreach ($catalog as $mint => $item) {
        if ($item['kind'] !== 'resource') {
            continue;
        }
        $resources[] = array(
            'mint' => $mint,
            'name' => $item['name'],
            'symbol' => $item['symbol'],
            'className' => $item['className'],
            'ask' => isset($asks[$mint]) ? $asks[$mint] : null,
            'bid' => isset($bids[$mint]) ? $bids[$mint] : null,
            'askQty' => isset($qty[$mint]) ? $qty[$mint] : 0,
        );
    }
    usort($resources, function ($a, $b) {
        return strcasecmp($a['name'], $b['name']);
    });

    $payload = array(
        'at' => time(),
        'orderCount' => $order_count,
        'atlas' => galia_desk_token($atlas, $prices, GALIA_DESK_ATLAS),
        'polis' => galia_desk_token($polis, $prices, GALIA_DESK_POLIS),
        'resources' => $resources,
        'candles' => galia_desk_candles(),
        'tape' => galia_desk_push_tape($resources),
        'gmp' => function_exists('gmp_init') || function_exists('bcadd'),
    );
    set_transient('galia_desk_market', $payload, 3 * MINUTE_IN_SECONDS);
    return $payload;
}

function galia_desk_b58_decode($text) {
    $alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    $len = strlen($text);
    if (function_exists('gmp_init')) {
        $n = gmp_init(0);
        for ($i = 0; $i < $len; $i++) {
            $pos = strpos($alphabet, $text[$i]);
            if ($pos === false) {
                return '';
            }
            $n = gmp_add(gmp_mul($n, 58), $pos);
        }
        $hex = gmp_strval($n, 16);
    } elseif (function_exists('bcadd')) {
        $n = '0';
        for ($i = 0; $i < $len; $i++) {
            $pos = strpos($alphabet, $text[$i]);
            if ($pos === false) {
                return '';
            }
            $n = bcadd(bcmul($n, '58'), (string) $pos);
        }
        $hex = '';
        while (bccomp($n, '0') > 0) {
            $hex = dechex((int) bcmod($n, '16')) . $hex;
            $n = bcdiv($n, '16', 0);
        }
        if ($hex === '') {
            $hex = '0';
        }
    } else {
        return '';
    }
    if (strlen($hex) % 2) {
        $hex = '0' . $hex;
    }
    $bin = hex2bin($hex);
    $zeros = 0;
    for ($i = 0; $i < $len && $text[$i] === '1'; $i++) {
        $zeros++;
    }
    return str_repeat("\0", $zeros) . $bin;
}

function galia_desk_candles() {
    $rows = galia_desk_remote_json('https://api.mexc.com/api/v3/klines?symbol=ATLASUSDT&interval=4h&limit=42');
    $out = array();
    if (!is_array($rows)) {
        return $out;
    }
    foreach ($rows as $row) {
        if (!is_array($row) || count($row) < 5) {
            continue;
        }
        $out[] = array(
            't' => (int) $row[0],
            'o' => (float) $row[1],
            'h' => (float) $row[2],
            'l' => (float) $row[3],
            'c' => (float) $row[4],
        );
    }
    return $out;
}

function galia_desk_push_tape($resources) {
    $tape = get_option('galia_desk_tape', array());
    if (!is_array($tape)) {
        $tape = array();
    }
    $asks = array();
    foreach ($resources as $row) {
        if (isset($row['ask']) && $row['ask'] !== null && isset($row['mint'])) {
            $asks[$row['mint']] = $row['ask'];
        }
    }
    $last = end($tape);
    if (!is_array($last) || !isset($last['t']) || (time() - (int) $last['t']) >= 120) {
        $tape[] = array('t' => time(), 'asks' => $asks);
    }
    if (count($tape) > 48) {
        $tape = array_slice($tape, -48);
    }
    update_option('galia_desk_tape', $tape, false);
    return $tape;
}

function galia_desk_token($supply, $prices, $mint) {
    $quote = isset($prices[$mint]) && is_array($prices[$mint]) ? $prices[$mint] : array();
    return array(
        'usd' => isset($quote['usdPrice']) ? $quote['usdPrice'] : null,
        'change24h' => isset($quote['priceChange24h']) ? $quote['priceChange24h'] : null,
        'circulating' => isset($supply['circulating']) ? $supply['circulating'] : null,
    );
}

function galia_desk_wallet($owner) {
    $owner = trim($owner);
    if (!preg_match('/^[1-9A-HJ-NP-Za-km-z]{32,44}$/', $owner)) {
        return new WP_Error('galia_owner', 'Нужен публичный ключ Solana.');
    }
    $catalog = galia_desk_catalog();
    $items = array();
    foreach (array('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb') as $program) {
        $json = galia_desk_rpc('getTokenAccountsByOwner', array($owner, array('programId' => $program), array('encoding' => 'jsonParsed')));
        $rows = isset($json['result']['value']) && is_array($json['result']['value']) ? $json['result']['value'] : array();
        foreach ($rows as $row) {
            $info = $row['account']['data']['parsed']['info'] ?? null;
            if (!$info || empty($info['mint'])) {
                continue;
            }
            $amount = $info['tokenAmount']['uiAmount'] ?? 0;
            if ($amount <= 0) {
                continue;
            }
            $mint = $info['mint'];
            $decimals = isset($info['tokenAmount']['decimals']) ? (int) $info['tokenAmount']['decimals'] : 0;
            $known = isset($catalog[$mint]) ? $catalog[$mint] : null;
            $currency = null;
            if ($mint === GALIA_DESK_ATLAS) {
                $currency = array('name' => 'ATLAS', 'symbol' => 'ATLAS');
            } elseif ($mint === GALIA_DESK_POLIS) {
                $currency = array('name' => 'POLIS', 'symbol' => 'POLIS');
            }
            if (!$known && !$currency && $decimals !== 0) {
                continue;
            }
            if (!$known && !$currency && count($items) > 40) {
                continue;
            }
            $items[] = array(
                'mint' => $mint,
                'amount' => $amount,
                'name' => $known ? $known['name'] : ($currency ? $currency['name'] : substr($mint, 0, 4) . '…' . substr($mint, -4)),
                'kind' => $known ? $known['kind'] : ($currency ? 'resource' : 'nft'),
                'className' => $known ? $known['className'] : '',
                'rarity' => $known ? $known['rarity'] : '',
                'spec' => $known ? $known['spec'] : ($currency ? $currency['symbol'] : ''),
                'image' => $known ? $known['image'] : '',
                'traits' => array(),
            );
        }
    }
    $game = galia_desk_game($owner);
    return array(
        'owner' => $owner,
        'items' => $items,
        'profiles' => $game['profiles'],
        'note' => 'Подпись не нужна: адрес публичный. Пустой список на ключе значит, что корабли и груз уже в SAGE, не в кошельке. '
            . $game['note'],
    );
}

function galia_desk_game($owner) {
    $profiles = array();
    $seen = array();
    $warning = '';
    foreach (array(30, 110, 190) as $offset) {
        $json = galia_desk_rpc('getProgramAccounts', array(
            'pprofELXjL5Kck7Jn5hCpwAL82DpTkSYBENzahVtbc9',
            array(
                'encoding' => 'base64',
                'dataSlice' => array('offset' => 28, 'length' => 2),
                'filters' => array(array('memcmp' => array('offset' => $offset, 'bytes' => $owner))),
            ),
        ));
        if (!is_array($json) || isset($json['error'])) {
            $warning = isset($json['error']['message']) ? $json['error']['message'] : 'Профиль не прочитался';
            continue;
        }
        $rows = isset($json['result']) && is_array($json['result']) ? $json['result'] : array();
        foreach ($rows as $row) {
            if (empty($row['pubkey']) || isset($seen[$row['pubkey']])) {
                continue;
            }
            $seen[$row['pubkey']] = true;
            $keys = 0;
            if (!empty($row['account']['data'][0])) {
                $raw = base64_decode($row['account']['data'][0]);
                if (is_string($raw) && strlen($raw) >= 2) {
                    $keys = unpack('v', substr($raw, 0, 2))[1];
                }
            }
            $profiles[] = array(
                'profile' => $row['pubkey'],
                'keys' => $keys,
                'fleets' => galia_desk_fleets($row['pubkey']),
            );
            if (count($profiles) >= 4) {
                break 2;
            }
        }
    }
    $note = $warning !== '' ? $warning . '. ' : '';
    $note .= 'Игровой трюм Cargo этим списком не подменяется: видны профиль и имена флотов SAGE.';
    return array('profiles' => $profiles, 'note' => $note);
}

function galia_desk_fleets($profile) {
    $json = galia_desk_rpc('getProgramAccounts', array(
        'SAGE2HAwep459SNq61LHvjxPk4pLPEJLoMETef7f7EE',
        array(
            'encoding' => 'base64',
            'dataSlice' => array('offset' => 169, 'length' => 33),
            'filters' => array(
                array('memcmp' => array('offset' => 9, 'bytes' => 'GAMEzqJehF8yAnKiTARUuhZMvLvkZVAsCVri5vSfemLr')),
                array('memcmp' => array('offset' => 41, 'bytes' => $profile)),
            ),
        ),
    ));
    $out = array();
    $rows = isset($json['result']) && is_array($json['result']) ? $json['result'] : array();
    foreach ($rows as $row) {
        if (empty($row['account']['data'][0])) {
            continue;
        }
        $raw = base64_decode($row['account']['data'][0]);
        if (!is_string($raw) || strlen($raw) < 2) {
            continue;
        }
        $name = rtrim(substr($raw, 1), "\0");
        if ($name === '') {
            $name = 'флот';
        }
        $out[] = array('name' => $name, 'faction' => ord($raw[0]));
        if (count($out) >= 12) {
            break;
        }
    }
    return $out;
}

function galia_desk_ajax_market() {
    check_ajax_referer('galia_desk', 'nonce');
    wp_send_json_success(galia_desk_market());
}

function galia_desk_ajax_wallet() {
    check_ajax_referer('galia_desk', 'nonce');
    $scan = galia_desk_wallet(isset($_POST['owner']) ? sanitize_text_field(wp_unslash($_POST['owner'])) : '');
    if (is_wp_error($scan)) {
        wp_send_json_error(array('message' => $scan->get_error_message()), 400);
    }
    wp_send_json_success($scan);
}

add_action('wp_ajax_galia_desk_market', 'galia_desk_ajax_market');
add_action('wp_ajax_nopriv_galia_desk_market', 'galia_desk_ajax_market');
add_action('wp_ajax_galia_desk_wallet', 'galia_desk_ajax_wallet');
add_action('wp_ajax_nopriv_galia_desk_wallet', 'galia_desk_ajax_wallet');

function galia_desk_shortcode() {
    $nonce = wp_create_nonce('galia_desk');
    $ajax = admin_url('admin-ajax.php');
    ob_start();
    ?>
    <div class="galia-desk">
      <p class="galia-desk-kicker">Star Atlas · Galia</p>
      <h2 class="galia-desk-title">Стол цен</h2>
      <p class="galia-desk-note">Свечи ATLAS — общий рынок, не ноль браузера. Ресурсы — стакан Galactic Marketplace. Подпись кошелька не нужна: пустой адрес значит, что груз уже в игре. Лабиринт mini-sim остаётся своим шорткодом, этот блок его не заменяет.</p>
      <div class="galia-desk-row">
        <button type="button" data-galia-refresh>Обновить</button>
        <span data-galia-status>Загрузка…</span>
      </div>
      <div class="galia-desk-tokens" data-galia-tokens></div>
      <div data-galia-chart></div>
      <div class="galia-desk-table" data-galia-table></div>
      <h3 class="galia-desk-title">Сейф</h3>
      <form class="galia-desk-row" data-galia-wallet>
        <input type="text" name="owner" placeholder="Публичный ключ" autocomplete="off" spellcheck="false" />
        <button type="submit">Показать</button>
      </form>
      <div data-galia-hold></div>
    </div>
    <style>
      .galia-desk{background:#07090e;color:#e8eef2;padding:1.25rem;border:1px solid rgba(232,238,242,.12);border-radius:12px;font:16px/1.45 "Segoe UI",system-ui,sans-serif}
      .galia-desk *{box-sizing:border-box}
      .galia-desk-kicker{color:#c4a35a;letter-spacing:.18em;text-transform:uppercase;font-size:.75rem;margin:0}
      .galia-desk-title{margin:.35rem 0 .5rem;font-size:1.4rem}
      .galia-desk-note,.galia-desk-status{color:#8b96a3}
      .galia-desk-row{display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;margin:.75rem 0}
      .galia-desk button,.galia-desk input{height:44px;border-radius:8px;border:1px solid rgba(232,238,242,.18);background:#10141c;color:#e8eef2;padding:0 .8rem}
      .galia-desk input{min-width:16rem;flex:1}
      .galia-desk table{width:100%;border-collapse:collapse;font-size:.9rem}
      .galia-desk th,.galia-desk td{text-align:left;padding:.45rem .4rem;border-top:1px solid rgba(232,238,242,.12)}
      .galia-desk-card{border:1px solid rgba(232,238,242,.12);border-radius:10px;padding:.6rem .75rem;margin:.4rem 0;background:#10141c}
    </style>
    <script>
      (function () {
        var root = document.currentScript.previousElementSibling;
        while (root && !root.classList.contains("galia-desk")) root = root.previousElementSibling;
        if (!root) return;
        var ajax = <?php echo wp_json_encode($ajax); ?>;
        var nonce = <?php echo wp_json_encode($nonce); ?>;
        var status = root.querySelector("[data-galia-status]");
        function post(action, extra) {
          var body = new URLSearchParams(extra || {});
          body.set("action", action);
          body.set("nonce", nonce);
          return fetch(ajax, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body });
        }
        function num(n) {
          if (n == null) return "—";
          return Number(n).toLocaleString("ru-RU", { maximumFractionDigits: 6 });
        }
        function paint(data) {
          var tokens = root.querySelector("[data-galia-tokens]");
          tokens.innerHTML = ["atlas", "polis"].map(function (key) {
            var q = data[key] || {};
            return '<div class="galia-desk-card"><strong>' + key.toUpperCase() + '</strong> $' + num(q.usd) + ' · 24ч ' + num(q.change24h) + '% · оборот ' + num(q.circulating) + '</div>';
          }).join("");
          root.querySelector("[data-galia-chart]").innerHTML = candlesSvg(data.candles || []);
          var tape = data.tape || [];
          var prev = tape.length >= 2 ? tape[tape.length - 2].asks || {} : {};
          var rows = (data.resources || []).filter(function (row) { return row.ask != null; });
          var html = '<table><thead><tr><th>Ресурс</th><th>Класс</th><th>Продажа</th><th>Покупка</th><th>Δ</th></tr></thead><tbody>';
          rows.forEach(function (row) {
            var d = "—";
            if (prev[row.mint]) {
              var pct = ((row.ask - prev[row.mint]) / prev[row.mint]) * 100;
              d = (pct > 0 ? "+" : "") + pct.toLocaleString("ru-RU", { maximumFractionDigits: 2 }) + "%";
            }
            html += '<tr><td>' + row.name + '</td><td>' + row.className + '</td><td>' + num(row.ask) + '</td><td>' + num(row.bid) + '</td><td>' + d + '</td></tr>';
          });
          root.querySelector("[data-galia-table]").innerHTML = html + '</tbody></table>';
          var tapeNote = tape.length < 2 ? " Первый общий снимок ресурсов записан на сайте." : " Снимков ресурса на сайте: " + tape.length + ".";
          status.textContent = (data.gmp === false ? "На сервере нет GMP — цены стакана не посчитались." : ("Ордеров " + (data.orderCount || 0))) + tapeNote;
        }
        function candlesSvg(candles) {
          if (!candles || candles.length < 2) return "";
          var w = 640, h = 96, pad = 6;
          var min = candles[0].l, max = candles[0].h;
          candles.forEach(function (c) { if (c.l < min) min = c.l; if (c.h > max) max = c.h; });
          var span = (max - min) || 1;
          var slot = (w - pad * 2) / candles.length;
          function y(v) { return pad + (1 - (v - min) / span) * (h - pad * 2); }
          var first = candles[0].o, last = candles[candles.length - 1].c;
          var move = first ? ((last - first) / first) * 100 : 0;
          var body = candles.map(function (c, i) {
            var x = pad + i * slot + slot / 2;
            var up = c.c >= c.o;
            var color = up ? "#7a9a7e" : "#c45c4a";
            var top = y(Math.max(c.o, c.c));
            var bot = y(Math.min(c.o, c.c));
            return '<line x1="' + x + '" x2="' + x + '" y1="' + y(c.h) + '" y2="' + y(c.l) + '" stroke="' + color + '" stroke-width="1.2"/>'
              + '<rect x="' + (x - Math.max(1.2, slot * 0.28)) + '" y="' + top + '" width="' + Math.max(2, slot * 0.56) + '" height="' + Math.max(1.2, bot - top) + '" fill="' + color + '"/>';
          }).join("");
          return '<div class="galia-desk-card"><strong>ATLAS · свечи 4ч</strong> ' + move.toLocaleString("ru-RU", { maximumFractionDigits: 2 }) + '%<svg viewBox="0 0 ' + w + ' ' + h + '" style="width:100%;height:96px;display:block;margin-top:.4rem">' + body + '</svg><span class="galia-desk-note">Общий рынок MEXC.</span></div>';
        }
        function load() {
          status.textContent = "Снимаю стакан…";
          post("galia_desk_market").then(function (res) { return res.json(); }).then(function (json) {
            if (!json.success) throw new Error("market");
            paint(json.data);
          }).catch(function () { status.textContent = "Не вышло снять цены."; });
        }
        root.querySelector("[data-galia-refresh]").addEventListener("click", load);
        root.querySelector("[data-galia-wallet]").addEventListener("submit", function (event) {
          event.preventDefault();
          var owner = new FormData(event.currentTarget).get("owner");
          var hold = root.querySelector("[data-galia-hold]");
          hold.textContent = "Читаю кошелёк…";
          post("galia_desk_wallet", { owner: owner }).then(function (res) { return res.json(); }).then(function (json) {
            if (!json.success) throw new Error((json.data && json.data.message) || "wallet");
            var items = json.data.items || [];
            var profiles = json.data.profiles || [];
            var html = profiles.map(function (profile) {
              var fleets = (profile.fleets || []).map(function (fleet) {
                return fleet.name + " · фракция " + fleet.faction;
              }).join(", ") || "флотов не видно";
              return '<div class="galia-desk-card"><strong>В игре</strong><br>' + profile.profile + '<br>' + fleets + '</div>';
            }).join("");
            html += items.map(function (item) {
              return '<div class="galia-desk-card"><strong>' + item.name + '</strong> ×' + num(item.amount) + ' · ' + item.kind + (item.spec ? ' · ' + item.spec : '') + '</div>';
            }).join("");
            if (!items.length) html += "<p>На ключе нет токенов Star Atlas. Подпись это не лечит: груз игры лежит во флоте.</p>";
            hold.innerHTML = html;
            hold.insertAdjacentHTML("beforeend", "<p class='galia-desk-note'>" + (json.data.note || "") + "</p>");
          }).catch(function (err) { hold.textContent = err.message || "Кошелёк не прочитался."; });
        });
        load();
      })();
    </script>
    <?php
    return ob_get_clean();
}

add_shortcode('galia_desk', 'galia_desk_shortcode');

function galia_desk_app_url($override = '') {
    $raw = trim($override !== '' ? $override : (string) get_option('galia_app_url', ''));
    if (!preg_match('#^https://#i', $raw)) {
        return '';
    }
    return esc_url_raw($raw);
}

function galia_desk_sanitize_app_url($value) {
    return galia_desk_app_url(is_string($value) ? $value : '');
}

function galia_desk_register_settings() {
    register_setting('galia_desk_settings', 'galia_app_url', array(
        'type' => 'string',
        'sanitize_callback' => 'galia_desk_sanitize_app_url',
        'default' => '',
    ));
}
add_action('admin_init', 'galia_desk_register_settings');

function galia_desk_settings_page() {
    if (!current_user_can('manage_options')) {
        return;
    }
    $url = galia_desk_app_url();
    echo '<div class="wrap"><h1>Galia Desk</h1>';
    echo '<p>Глобус, экипаж, флот, рынок и сейф — это опубликованное приложение. WordPress только открывает его на весь экран. PHP сам этот вид не рисует.</p>';
    echo '<form method="post" action="options.php">';
    settings_fields('galia_desk_settings');
    echo '<table class="form-table"><tr><th scope="row"><label for="galia_app_url">Адрес приложения</label></th><td>';
    echo '<input name="galia_app_url" id="galia_app_url" type="url" class="regular-text" placeholder="https://" value="' . esc_attr($url) . '" />';
    echo '<p class="description">Только https. Страница с шаблоном «Galia — полный экран» или шорткод [galia_app]. Стол цен по-прежнему [galia_desk]. Лабиринт не трогается.</p>';
    echo '</td></tr></table>';
    submit_button('Сохранить');
    echo '</form></div>';
}

function galia_desk_admin_menu() {
    add_options_page('Galia Desk', 'Galia Desk', 'manage_options', 'galia-desk', 'galia_desk_settings_page');
}
add_action('admin_menu', 'galia_desk_admin_menu');

function galia_desk_page_templates($templates) {
    $templates['galia-app-template.php'] = 'Galia — полный экран';
    return $templates;
}
add_filter('theme_page_templates', 'galia_desk_page_templates');

function galia_desk_template_include($template) {
    if (!is_page()) {
        return $template;
    }
    if (get_page_template_slug() !== 'galia-app-template.php') {
        return $template;
    }
    $file = plugin_dir_path(__FILE__) . 'galia-app-template.php';
    return file_exists($file) ? $file : $template;
}
add_filter('template_include', 'galia_desk_template_include');

function galia_app_shortcode($atts) {
    $atts = shortcode_atts(array('url' => ''), $atts, 'galia_app');
    $url = galia_desk_app_url(isset($atts['url']) ? (string) $atts['url'] : '');
    if ($url === '') {
        return '<p class="galia-desk-note">Адрес Galia не задан. Настройки → Galia Desk, либо [galia_app url="https://…"].</p>';
    }
    $src = esc_url($url);
    ob_start();
    ?>
    <div class="galia-app-frame">
      <iframe title="Galia" src="<?php echo $src; ?>" allow="fullscreen" allowfullscreen></iframe>
      <p class="galia-desk-note"><a href="<?php echo $src; ?>">Открыть Galia отдельно</a> — так кошелёк Phantom цепляется надёжнее, чем внутри рамки.</p>
    </div>
    <style>
      .galia-app-frame{width:100vw;max-width:100vw;margin-left:calc(50% - 50vw);background:#07090e}
      .galia-app-frame iframe{display:block;width:100%;height:100dvh;border:0;background:#07090e}
      .galia-app-frame a{color:#c4a35a}
    </style>
    <?php
    return ob_get_clean();
}
add_shortcode('galia_app', 'galia_app_shortcode');

