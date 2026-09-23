<?php
/**
 * Plugin Name: Galia Desk
 * Description: Цены ресурсов Star Atlas и чтение кошелька. Шорткод [galia_desk]. Карта Galia остаётся в приложении.
 * Version: 0.1.0
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
            $known = isset($catalog[$mint]) ? $catalog[$mint] : null;
            if (!$known) {
                continue;
            }
            $items[] = array(
                'mint' => $mint,
                'amount' => $amount,
                'name' => $known ? $known['name'] : substr($mint, 0, 4) . '…' . substr($mint, -4),
                'kind' => $known ? $known['kind'] : 'nft',
                'className' => $known ? $known['className'] : '',
                'rarity' => $known ? $known['rarity'] : '',
                'spec' => $known ? $known['spec'] : '',
                'image' => $known ? $known['image'] : '',
                'traits' => array(),
            );
        }
    }
    return array(
        'owner' => $owner,
        'items' => $items,
        'note' => 'На сайте читается кошелёк и каталог Galaxy. Уникальные способности экипажа из метадаты NFT смотри в приложении Galia, вкладка Сейф: там Metaplex. Cargo и Profile Vault сюда не входят.',
    );
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
      <p class="galia-desk-note">Ресурсы — лучшая цена стакана Galactic Marketplace в ATLAS. ATLAS и POLIS в долларах — Jupiter, оборот — Galaxy /tokens. Летающая карта Galia этим блоком не заменяется.</p>
      <div class="galia-desk-row">
        <button type="button" data-galia-refresh>Обновить</button>
        <span data-galia-status>Загрузка…</span>
      </div>
      <div class="galia-desk-tokens" data-galia-tokens></div>
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
          var rows = (data.resources || []).filter(function (row) { return row.ask != null; });
          var html = '<table><thead><tr><th>Ресурс</th><th>Класс</th><th>Продажа</th><th>Покупка</th></tr></thead><tbody>';
          rows.forEach(function (row) {
            html += '<tr><td>' + row.name + '</td><td>' + row.className + '</td><td>' + num(row.ask) + '</td><td>' + num(row.bid) + '</td></tr>';
          });
          root.querySelector("[data-galia-table]").innerHTML = html + '</tbody></table>';
          status.textContent = data.gmp === false ? 'На сервере нет GMP — цены стакана не посчитались.' : ('Ордеров ' + (data.orderCount || 0));
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
            hold.innerHTML = items.map(function (item) {
              return '<div class="galia-desk-card"><strong>' + item.name + '</strong> ×' + num(item.amount) + ' · ' + item.kind + (item.spec ? ' · ' + item.spec : '') + '</div>';
            }).join("") || "<p>На адресе нет токенов Star Atlas.</p>";
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
