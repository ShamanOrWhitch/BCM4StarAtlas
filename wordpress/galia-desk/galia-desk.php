<?php
/**
 * Plugin Name: Galia Desk
 * Description: Полный экран Galia и стол цен. Шорткоды [galia_app] и [galia_desk]. Лабиринт не заменяет.
 * Version: 0.8.9
 * Author: ShamanOrWitch
 * License: GPL-2.0-or-later
 */

if (!defined('ABSPATH')) {
    exit;
}

const GALIA_DESK_GM = 'traderDnaR5w6Tcoi3NFm53i48FTDNbGjBSZwWXDRrg';
const GALIA_DESK_ATLAS = 'ATLASXmbPQxBUYbxPsV97usA3fPQYEqzQBUHgiFCUsXx';
const GALIA_DESK_USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const GALIA_DESK_POLIS = 'poLisWXnNRwC6oBu1vHiuKQzFjGL4XDSu4g9qjz9qVk';
const GALIA_DESK_RPC = 'https://api.mainnet.solana.com';
const GALIA_DESK_BACKEND = 'https://bcm4staratlas.onrender.com/api/wallet-scan';

function galia_desk_rpc($method, $params, $timeout = 20) {
    $urls = array(
        'https://api.mainnet.solana.com',
        'https://api.mainnet-beta.solana.com',
    );
    $errors = array();
    foreach ($urls as $url) {
        $response = wp_remote_post($url, array(
            'timeout' => $timeout,
            'headers' => array('Content-Type' => 'application/json'),
            'body' => wp_json_encode(array(
                'jsonrpc' => '2.0',
                'id' => 1,
                'method' => $method,
                'params' => $params,
            )),
        ));
        if (is_wp_error($response)) {
            $errors[] = $url . ': ' . $response->get_error_message();
            continue;
        }
        $code = (int) wp_remote_retrieve_response_code($response);
        $json = json_decode(wp_remote_retrieve_body($response), true);
        if ($code < 200 || $code >= 300 || !is_array($json)) {
            $errors[] = $url . ': HTTP ' . $code;
            continue;
        }
        if (isset($json['error']['message'])) {
            $errors[] = $url . ': ' . $json['error']['message'];
            continue;
        }
        $GLOBALS['galia_desk_rpc_error'] = '';
        return $json;
    }
    $GLOBALS['galia_desk_rpc_error'] = implode(' · ', $errors);
    return null;
}

function galia_desk_usdc_rpc($method, $params, $timeout = 20) {
    $urls = array(
        'https://api.mainnet.solana.com',
        'https://api.mainnet-beta.solana.com',
        'https://solana-rpc.publicnode.com',
    );
    $errors = array();
    for ($pass = 0; $pass < 4; $pass++) {
        foreach ($urls as $url) {
            $response = wp_remote_post($url, array(
                'timeout' => $timeout,
                'headers' => array('Content-Type' => 'application/json'),
                'body' => wp_json_encode(array(
                    'jsonrpc' => '2.0',
                    'id' => 1,
                    'method' => $method,
                    'params' => $params,
                )),
            ));
            if (is_wp_error($response)) {
                $errors[] = $url . ': ' . $response->get_error_message();
                continue;
            }
            $code = (int) wp_remote_retrieve_response_code($response);
            $json = json_decode(wp_remote_retrieve_body($response), true);
            if ($code < 200 || $code >= 300 || !is_array($json)) {
                $errors[] = $url . ': HTTP ' . $code;
                continue;
            }
            if (isset($json['error']['message'])) {
                $errors[] = $url . ': ' . $json['error']['message'];
                continue;
            }
            return $json;
        }
        if ($pass === 0) {
            usleep(250000);
        }
    }
    $GLOBALS['galia_desk_usdc_error'] = implode(' · ', $errors);
    return null;
}

function galia_desk_show($mint) {
    static $shows = null;
    if ($shows === null) {
        $file = plugin_dir_path(__FILE__) . 'shows.json';
        $shows = array();
        if (is_readable($file)) {
            $decoded = json_decode((string) file_get_contents($file), true);
            if (is_array($decoded)) {
                $shows = $decoded;
            }
        }
    }
    if (!isset($shows[$mint]) || !is_string($shows[$mint])) {
        return '';
    }
    return preg_match('#^https://#', $shows[$mint]) ? $shows[$mint] : '';
}

function galia_desk_roster_html() {
    $file = plugin_dir_path(__FILE__) . 'roster.json';
    if (!is_readable($file)) {
        return '';
    }
    $rows = json_decode((string) file_get_contents($file), true);
    if (!is_array($rows)) {
        return '';
    }
    $html = '<table><thead><tr><th>Имя</th><th>Слот</th><th>OCEAN</th><th>Задание</th></tr></thead><tbody>';
    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }
        $html .= '<tr><td>' . esc_html((string) ($row['name'] ?? '')) . '</td><td>' . esc_html((string) ($row['seats'] ?? '')) . '</td><td>'
            . esc_html((string) ($row['ocean'] ?? '')) . '</td><td>' . esc_html((string) ($row['mission'] ?? '')) . '</td></tr>';
    }
    return $html . '</tbody></table>';
}

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

function galia_desk_catalog() {
    $cached = get_transient('galia_desk_catalog_v2');
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
        $media = isset($row['media']) && is_array($row['media']) ? $row['media'] : array();
        $gallery = isset($media['gallery']) && is_array($media['gallery']) ? array_slice($media['gallery'], 0, 8) : array();
        $slots = isset($row['slots']['crewSlots']) && is_array($row['slots']['crewSlots']) ? $row['slots']['crewSlots'] : array();
        $crew = 0;
        $slot_names = array();
        foreach ($slots as $slot) {
            if (!is_array($slot)) {
                continue;
            }
            $n = isset($slot['quantity']) ? (int) $slot['quantity'] : 1;
            $crew += $n;
            $slot_names[] = (isset($slot['type']) ? $slot['type'] : 'слот') . ' ×' . $n;
        }
        $msrp = isset($row['tradeSettings']['msrp']['value']) ? $row['tradeSettings']['msrp']['value'] : null;
        $catalog[$row['mint']] = array(
            'name' => isset($row['name']) ? $row['name'] : $row['mint'],
            'symbol' => isset($row['symbol']) ? $row['symbol'] : '',
            'kind' => isset($attrs['itemType']) ? $attrs['itemType'] : 'other',
            'className' => isset($attrs['class']) ? strtolower((string) $attrs['class']) : '',
            'rarity' => isset($attrs['rarity']) ? $attrs['rarity'] : '',
            'spec' => isset($attrs['spec']) ? $attrs['spec'] : '',
            'make' => isset($attrs['make']) ? $attrs['make'] : '',
            'image' => isset($row['image']) ? $row['image'] : '',
            'description' => isset($row['description']) ? $row['description'] : '',
            'gallery' => $gallery,
            'crew' => $crew,
            'slots' => $slot_names,
            'msrp' => is_numeric($msrp) ? (float) $msrp : null,
        );
    }
    set_transient('galia_desk_catalog_v2', $catalog, 30 * MINUTE_IN_SECONDS);
    return $catalog;
}

function galia_desk_top($rows, $high_first) {
    if (!is_array($rows)) {
        return array();
    }
    usort($rows, function ($a, $b) use ($high_first) {
        $av = isset($a['price']) ? (float) $a['price'] : 0;
        $bv = isset($b['price']) ? (float) $b['price'] : 0;
        if ($av === $bv) {
            return 0;
        }
        if ($high_first) {
            return ($av < $bv) ? 1 : -1;
        }
        return ($av > $bv) ? 1 : -1;
    });
    return array_slice($rows, 0, 8);
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
            'filters' => array(
                array('dataSize' => 201),
                array('memcmp' => array('offset' => 40, 'bytes' => GALIA_DESK_ATLAS)),
            ),
        ),
    ), 12);

    $asks = array();
    $bids = array();
    $qty = array();
    $atlas_ask_lv = array();
    $atlas_bid_lv = array();
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
            if ($side === 1) {
                $atlas_ask_lv[$asset][] = array('price' => $price, 'qty' => $rem);
                if (!isset($asks[$asset]) || $price < $asks[$asset]) {
                    $asks[$asset] = $price;
                    $qty[$asset] = $rem;
                }
            } elseif ($side === 0) {
                $atlas_bid_lv[$asset][] = array('price' => $price, 'qty' => $rem);
                if (!isset($bids[$asset]) || $price > $bids[$asset]) {
                    $bids[$asset] = $price;
                }
            }
        }
    }

    $polis_book = galia_desk_rpc('getProgramAccounts', array(
        GALIA_DESK_GM,
        array(
            'encoding' => 'base64',
            'dataSlice' => array('offset' => 40, 'length' => 153),
            'filters' => array(
                array('dataSize' => 201),
                array('memcmp' => array('offset' => 40, 'bytes' => GALIA_DESK_POLIS)),
            ),
        ),
    ), 12);
    $polis_asks = array();
    $polis_bids = array();
    if (isset($polis_book['result']) && is_array($polis_book['result']) && (function_exists('gmp_init') || function_exists('bcadd'))) {
        $polis_hex = bin2hex(galia_desk_b58_decode(GALIA_DESK_POLIS));
        foreach ($polis_book['result'] as $row) {
            if (empty($row['account']['data'][0])) {
                continue;
            }
            $raw = base64_decode($row['account']['data'][0]);
            if (!is_string($raw) || strlen($raw) < 153 || bin2hex(substr($raw, 0, 32)) !== $polis_hex) {
                continue;
            }
            $asset = galia_desk_b58encode(substr($raw, 32, 32));
            $side = ord($raw[128]);
            $price = galia_desk_u64(substr($raw, 129, 8)) / 100000000;
            $rem = galia_desk_u64(substr($raw, 145, 8));
            if ($price <= 0 || $rem <= 0) {
                continue;
            }
            if ($side === 1 && (!isset($polis_asks[$asset]) || $price < $polis_asks[$asset])) {
                $polis_asks[$asset] = $price;
            } elseif ($side === 0 && (!isset($polis_bids[$asset]) || $price > $polis_bids[$asset])) {
                $polis_bids[$asset] = $price;
            }
        }
    }

    $usdc = galia_desk_usdc_rpc('getProgramAccounts', array(
        GALIA_DESK_GM,
        array(
            'encoding' => 'base64',
            'dataSlice' => array('offset' => 40, 'length' => 153),
            'filters' => array(
                array('dataSize' => 201),
                array('memcmp' => array('offset' => 40, 'bytes' => GALIA_DESK_USDC)),
            ),
        ),
    ), 20);
    $usdc_asks = array();
    $usdc_bids = array();
    $usdc_ask_lv = array();
    $usdc_bid_lv = array();
    if (isset($usdc['result']) && is_array($usdc['result']) && (function_exists('gmp_init') || function_exists('bcadd'))) {
        $usdc_hex = bin2hex(galia_desk_b58_decode(GALIA_DESK_USDC));
        foreach ($usdc['result'] as $row) {
            if (empty($row['account']['data'][0])) {
                continue;
            }
            $raw = base64_decode($row['account']['data'][0]);
            if (!is_string($raw) || strlen($raw) < 153 || bin2hex(substr($raw, 0, 32)) !== $usdc_hex) {
                continue;
            }
            $asset = galia_desk_b58encode(substr($raw, 32, 32));
            $side = ord($raw[128]);
            $price = galia_desk_u64(substr($raw, 129, 8)) / 1000000;
            $rem = galia_desk_u64(substr($raw, 145, 8));
            if ($price <= 0 || $rem <= 0) {
                continue;
            }
            if ($side === 1) {
                $usdc_ask_lv[$asset][] = array('price' => $price, 'qty' => $rem);
                if (!isset($usdc_asks[$asset]) || $price < $usdc_asks[$asset]) {
                    $usdc_asks[$asset] = $price;
                }
            } elseif ($side === 0) {
                $usdc_bid_lv[$asset][] = array('price' => $price, 'qty' => $rem);
                if (!isset($usdc_bids[$asset]) || $price > $usdc_bids[$asset]) {
                    $usdc_bids[$asset] = $price;
                }
            }
        }
    }

    $resources = array();
    $ships = array();
    $market_ships = array();
    foreach ($catalog as $mint => $item) {
        $row = array(
            'mint' => $mint,
            'name' => $item['name'],
            'symbol' => $item['symbol'],
            'className' => $item['className'],
            'image' => isset($item['image']) ? $item['image'] : '',
            'usdcAsk' => isset($usdc_asks[$mint]) ? $usdc_asks[$mint] : null,
            'usdcBid' => isset($usdc_bids[$mint]) ? $usdc_bids[$mint] : null,
            'atlasAsk' => isset($asks[$mint]) ? $asks[$mint] : null,
            'atlasBid' => isset($bids[$mint]) ? $bids[$mint] : null,
            'polisAsk' => isset($polis_asks[$mint]) ? $polis_asks[$mint] : null,
            'polisBid' => isset($polis_bids[$mint]) ? $polis_bids[$mint] : null,
            'ask' => isset($usdc_asks[$mint]) ? $usdc_asks[$mint] : null,
            'bid' => isset($usdc_bids[$mint]) ? $usdc_bids[$mint] : null,
            'askQty' => isset($qty[$mint]) ? $qty[$mint] : 0,
            'quote' => 'USDC',
        );
        if ($item['kind'] === 'resource') {
            $resources[] = $row;
        } elseif ($item['kind'] === 'ship') {
            $ships[] = $row;
            $market_ships[] = array(
                'mint' => $mint,
                'name' => $item['name'],
                'image' => isset($item['image']) ? $item['image'] : '',
                'gallery' => isset($item['gallery']) && is_array($item['gallery']) ? $item['gallery'] : array(),
                'description' => isset($item['description']) ? $item['description'] : '',
                'rarity' => isset($item['rarity']) ? $item['rarity'] : '',
                'className' => isset($item['className']) ? $item['className'] : '',
                'spec' => isset($item['spec']) ? $item['spec'] : '',
                'make' => isset($item['make']) ? $item['make'] : '',
                'crew' => isset($item['crew']) ? (int) $item['crew'] : 0,
                'slots' => isset($item['slots']) && is_array($item['slots']) ? $item['slots'] : array(),
                'msrp' => isset($item['msrp']) ? $item['msrp'] : null,
                'usdcAsks' => galia_desk_top(isset($usdc_ask_lv[$mint]) ? $usdc_ask_lv[$mint] : array(), false),
                'usdcBids' => galia_desk_top(isset($usdc_bid_lv[$mint]) ? $usdc_bid_lv[$mint] : array(), true),
                'atlasAsks' => galia_desk_top(isset($atlas_ask_lv[$mint]) ? $atlas_ask_lv[$mint] : array(), false),
                'atlasBids' => galia_desk_top(isset($atlas_bid_lv[$mint]) ? $atlas_bid_lv[$mint] : array(), true),
            );
        }
    }

    usort($resources, function ($a, $b) {
        return strcasecmp($a['name'], $b['name']);
    });
    if ($order_count > 0) {
        update_option('galia_desk_book', array(
            'at' => time(),
            'orderCount' => $order_count,
            'resources' => $resources,
            'ships' => $ships,
        ), false);
    } elseif ($order_count === 0) {
        $stored = get_option('galia_desk_book');
        if (is_array($stored) && !empty($stored['resources'])) {
            $resources = $stored['resources'];
            $ships = isset($stored['ships']) && is_array($stored['ships']) ? $stored['ships'] : array();
            $order_count = isset($stored['orderCount']) ? (int) $stored['orderCount'] : 0;
        }
    }

    $atlas_candles = galia_desk_candles();
    $payload = array(
        'at' => time(),
        'orderCount' => $order_count,
        'atlas' => galia_desk_token($atlas, $prices, GALIA_DESK_ATLAS),
        'polis' => galia_desk_token($polis, $prices, GALIA_DESK_POLIS),
        'resources' => $resources,
        'ships' => $ships,
        'marketShips' => $market_ships,
        'candles' => $atlas_candles,
        'pairCandles' => galia_desk_cross(galia_desk_kraken('POLISUSD'), $atlas_candles),
        'tape' => galia_desk_push_tape(array_merge($resources, $ships)),
        'gmp' => function_exists('gmp_init') || function_exists('bcadd'),
    );
    if (!empty($resources)) {
        set_transient('galia_desk_market', $payload, 3 * MINUTE_IN_SECONDS);
    }
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

function galia_desk_kraken($pair) {
    $data = galia_desk_remote_json('https://api.kraken.com/0/public/OHLC?pair=' . rawurlencode($pair) . '&interval=1440');
    $out = array();
    if (!is_array($data) || empty($data['result']) || !is_array($data['result'])) {
        return $out;
    }
    $rows = array();
    foreach ($data['result'] as $value) {
        if (is_array($value) && isset($value[0]) && is_array($value[0])) {
            $rows = $value;
        }
    }
    $rows = array_slice($rows, -180);
    foreach ($rows as $row) {
        if (!is_array($row) || count($row) < 5) {
            continue;
        }
        $out[] = array(
            't' => (int) $row[0] * 1000,
            'o' => (float) $row[1],
            'h' => (float) $row[2],
            'l' => (float) $row[3],
            'c' => (float) $row[4],
        );
    }
    return $out;
}

function galia_desk_cross($base, $quote) {
    $by = array();
    foreach ($quote as $row) {
        $by[$row['t']] = $row;
    }
    $out = array();
    foreach ($base as $row) {
        if (!isset($by[$row['t']]) || $by[$row['t']]['c'] <= 0) {
            continue;
        }
        $other = $by[$row['t']];
        $o = $row['o'] / $other['o'];
        $c = $row['c'] / $other['c'];
        if ($o <= 0 || $c <= 0) {
            continue;
        }
        $out[] = array(
            't' => $row['t'],
            'o' => $o,
            'h' => max($row['h'] / max($other['h'], 0.0000001), $o, $c),
            'l' => min($row['l'] / max($other['l'], 0.0000001), $o, $c),
            'c' => $c,
        );
    }
    return $out;
}

function galia_desk_candles() {
    $atlas = galia_desk_kraken('ATLASUSD');
    if (count($atlas) < 2) {
        $rows = galia_desk_remote_json('https://api.mexc.com/api/v3/klines?symbol=ATLASUSDT&interval=4h&limit=48');
        $atlas = array();
        if (is_array($rows)) {
            foreach ($rows as $row) {
                if (!is_array($row) || count($row) < 5) {
                    continue;
                }
                $atlas[] = array(
                    't' => (int) $row[0],
                    'o' => (float) $row[1],
                    'h' => (float) $row[2],
                    'l' => (float) $row[3],
                    'c' => (float) $row[4],
                );
            }
        }
    }
    return $atlas;
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
    if (count($asks) > 0 && (!is_array($last) || !isset($last['t']) || (time() - (int) $last['t']) >= 120)) {
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

function galia_desk_crew_index() {
    $cached = get_transient('galia_desk_crew');
    if (is_array($cached)) {
        return $cached;
    }
    $rows = galia_desk_remote_json('https://galaxy.staratlas.com/crew');
    $index = array();
    if (is_array($rows)) {
        foreach ($rows as $row) {
            if (empty($row['dasID']) || !is_array($row)) {
                continue;
            }
            $traits = array();
            foreach (array(
                'openness' => 'Openness',
                'conscientiousness' => 'Conscientiousness',
                'extraversion' => 'Extraversion',
                'agreeableness' => 'Agreeableness',
                'neuroticism' => 'Neuroticism',
            ) as $key => $label) {
                if (!isset($row[$key]) || !is_numeric($row[$key])) {
                    continue;
                }
                $n = (float) $row[$key];
                $traits[] = array('trait' => $label, 'value' => (string) ($n <= 1 ? (int) round($n * 100) : (int) round($n)));
            }
            if (!empty($row['aptitudes']) && is_array($row['aptitudes'])) {
                foreach ($row['aptitudes'] as $name => $level) {
                    $traits[] = array('trait' => (string) $name, 'value' => (string) $level);
                }
            }
            if (!empty($row['species'])) {
                $traits[] = array('trait' => 'Species', 'value' => (string) $row['species']);
            }
            $index[$row['dasID']] = array(
                'name' => isset($row['name']) ? $row['name'] : $row['dasID'],
                'image' => isset($row['imageUrl']) ? $row['imageUrl'] : '',
                'rarity' => isset($row['rarity']) ? $row['rarity'] : '',
                'species' => isset($row['species']) ? $row['species'] : '',
                'traits' => $traits,
            );
        }
    }
    set_transient('galia_desk_crew', $index, 30 * MINUTE_IN_SECONDS);
    return $index;
}

function galia_desk_is_crew($name, $symbol, $traits) {
    if (stripos($name, 'crew') !== false || stripos($symbol, 'crew') !== false) {
        return true;
    }
    $blob = '';
    foreach ($traits as $trait) {
        $blob .= ' ' . ($trait['trait'] ?? '') . ' ' . ($trait['value'] ?? '');
    }
    return (bool) preg_match('/flight|command|engineering|hospitality|operator|medical|science|fitness|openness|species|aptitude|ustur|punaab|sogmian|mierese|hair/i', $blob);
}

function galia_desk_assets($owner) {
    $out = array();
    for ($page = 1; $page <= 3; $page++) {
        $json = galia_desk_rpc('getAssetsByOwner', array(
            'ownerAddress' => $owner,
            'page' => $page,
            'limit' => 100,
            'displayOptions' => array('showFungible' => false, 'showZeroBalance' => false),
        ), 15);
        $chunk = isset($json['result']['items']) && is_array($json['result']['items']) ? $json['result']['items'] : array();
        if (!$chunk) {
            break;
        }
        foreach ($chunk as $asset) {
            $out[] = $asset;
        }
        $total = isset($json['result']['total']) ? (int) $json['result']['total'] : count($out);
        if (count($out) >= $total) {
            break;
        }
    }
    return $out;
}

function galia_desk_wallet($owner) {
    $owner = trim($owner);
    if (!preg_match('/^[1-9A-HJ-NP-Za-km-z]{32,44}$/', $owner)) {
        return new WP_Error('galia_owner', 'Нужен публичный ключ Solana.');
    }
    $catalog = galia_desk_catalog();
    $crew_index = galia_desk_crew_index();
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
            if (isset($crew_index[$mint])) {
                $card = $crew_index[$mint];
                $items[] = array(
                    'mint' => $mint,
                    'amount' => $amount,
                    'name' => $card['name'],
                    'kind' => 'crew',
                    'className' => 'crew',
                    'rarity' => $card['rarity'],
                    'spec' => $card['species'],
                    'image' => $card['image'],
                    'video' => '',
                    'traits' => $card['traits'],
                );
                continue;
            }
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
            $show = galia_desk_show($mint);
            $items[] = array(
                'mint' => $mint,
                'amount' => $amount,
                'name' => $known ? $known['name'] : ($currency ? $currency['name'] : substr($mint, 0, 4) . '…' . substr($mint, -4)),
                'kind' => $known ? $known['kind'] : ($currency ? 'resource' : 'nft'),
                'className' => $known ? $known['className'] : '',
                'rarity' => $known ? $known['rarity'] : '',
                'spec' => $known ? $known['spec'] : ($currency ? $currency['symbol'] : ''),
                'image' => $known && !empty($known['image']) ? $known['image'] : '',
                'video' => $show ? $show : '',
                'traits' => array(),
            );
        }
    }
    $seen = array();
    foreach ($items as $index => $item) {
        $seen[$item['mint']] = $index;
    }
    foreach (galia_desk_assets($owner) as $asset) {
        if (empty($asset['id'])) {
            continue;
        }
        $mint = $asset['id'];
        $meta = isset($asset['content']['metadata']) && is_array($asset['content']['metadata']) ? $asset['content']['metadata'] : array();
        $links = isset($asset['content']['links']) && is_array($asset['content']['links']) ? $asset['content']['links'] : array();
        $traits = array();
        if (!empty($meta['attributes']) && is_array($meta['attributes'])) {
            foreach ($meta['attributes'] as $trait) {
                if (!is_array($trait) || empty($trait['trait_type']) || !isset($trait['value'])) {
                    continue;
                }
                $traits[] = array('trait' => (string) $trait['trait_type'], 'value' => (string) $trait['value']);
            }
        }
        $trait_rarity = '';
        foreach ($traits as $trait) {
            if (isset($trait['trait']) && strcasecmp((string) $trait['trait'], 'rarity') === 0) {
                $trait_rarity = (string) $trait['value'];
            }
        }
        $card = isset($crew_index[$mint]) ? $crew_index[$mint] : null;
        $name = $card ? $card['name'] : (isset($meta['name']) ? $meta['name'] : '');
        foreach ($traits as $trait) {
            if (isset($trait['trait']) && strcasecmp((string) $trait['trait'], 'name') === 0) {
                $given = (string) $trait['value'];
                if ($given !== '' && stripos($given, 'crew') !== 0) {
                    $name = $given;
                }
            }
        }
        $symbol = isset($meta['symbol']) ? $meta['symbol'] : '';
        if (!$card && isset($catalog[$mint]) && ($catalog[$mint]['kind'] ?? 'other') !== 'other') {
            $known = $catalog[$mint];
            $items[] = array(
                'mint' => $mint,
                'amount' => 1,
                'name' => $known['name'],
                'kind' => $known['kind'],
                'className' => $known['className'],
                'rarity' => $known['rarity'],
                'spec' => $known['spec'],
                'image' => $known['image'],
                'video' => '',
                'traits' => $traits,
                'description' => $known['description'],
                'gallery' => $known['gallery'],
                'make' => $known['make'],
                'crew' => $known['crew'],
                'slots' => $known['slots'],
                'msrp' => $known['msrp'],
            );
            continue;
        }
        if (!$card && !galia_desk_is_crew($name, $symbol, $traits)) {
            continue;
        }
        $row = array(
            'mint' => $mint,
            'amount' => 1,
            'name' => $name ? $name : $mint,
            'kind' => 'crew',
            'className' => 'crew',
            'rarity' => $trait_rarity !== '' ? $trait_rarity : ($card ? $card['rarity'] : ''),
            'spec' => $card ? $card['species'] : '',
            'image' => $card && $card['image'] ? $card['image'] : (isset($links['image']) ? $links['image'] : ''),
            'video' => '',
            'traits' => $card && !empty($card['traits']) ? $card['traits'] : $traits,
        );
        if (isset($seen[$mint])) {
            $prev = $items[$seen[$mint]];
            $row['amount'] = $prev['amount'];
            $items[$seen[$mint]] = $row;
        } else {
            $seen[$mint] = count($items);
            $items[] = $row;
        }
    }
    $order_rows = galia_desk_rpc('getProgramAccounts', array(
        GALIA_DESK_GM,
        array(
            'encoding' => 'base64',
            'dataSlice' => array('offset' => 8, 'length' => 160),
            'filters' => array(
                array('dataSize' => 201),
                array('memcmp' => array('offset' => 8, 'bytes' => $owner)),
            ),
        ),
    ), 12);
    if (isset($order_rows['result']) && is_array($order_rows['result'])) {
        foreach ($order_rows['result'] as $row) {
            if (empty($row['account']['data'][0])) {
                continue;
            }
            $raw = base64_decode($row['account']['data'][0]);
            if (!is_string($raw) || strlen($raw) < 145 || ord($raw[120]) !== 1) {
                continue;
            }
            $asset = galia_desk_b58encode(substr($raw, 64, 32));
            $rem = galia_desk_u64(substr($raw, 137, 8));
            if ($rem <= 0 || empty($catalog[$asset]) || $catalog[$asset]['kind'] !== 'ship') {
                continue;
            }
            $known = $catalog[$asset];
            $items[] = array(
                'mint' => $asset,
                'amount' => $rem,
                'name' => $known['name'],
                'kind' => 'ship',
                'className' => 'order',
                'rarity' => $known['rarity'],
                'spec' => 'мой ордер',
                'image' => isset($known['image']) ? $known['image'] : '',
                'video' => '',
                'traits' => array(),
            );
        }
    }
    $game = galia_desk_game($owner);
    return array(
        'owner' => $owner,
        'items' => $items,
        'profiles' => $game['profiles'],
        'note' => (empty($items) && !empty($GLOBALS['galia_desk_rpc_error'])
            ? 'RPC с этого хоста не отдал кошелёк: ' . $GLOBALS['galia_desk_rpc_error'] . ' '
            : 'Экипаж снят с инвентаря ключа: официальные карточки Galaxy и NFT, которые реестр помечает как crew. Если человек уже в Starbase, на адресе его нет. ')
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

function galia_desk_render_wallet_scan($owner) {
    $owner = trim((string) $owner);
    if (!preg_match('/^[1-9A-HJ-NP-Za-km-z]{32,44}$/', $owner)) {
        return new WP_Error('galia_owner', 'Нужен публичный ключ Solana.');
    }

    $response = wp_remote_post(GALIA_DESK_BACKEND, array(
        'timeout' => 45,
        'headers' => array(
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ),
        'body' => wp_json_encode(array('owner' => $owner)),
    ));

    if (is_wp_error($response)) {
        return new WP_Error(
            'galia_backend',
            'Render wallet API: ' . $response->get_error_message()
        );
    }

    $code = (int) wp_remote_retrieve_response_code($response);
    $body = wp_remote_retrieve_body($response);
    $json = json_decode($body, true);

    if ($code < 200 || $code >= 300 || !is_array($json)) {
        return new WP_Error(
            'galia_backend_http',
            'Render wallet API HTTP ' . $code
        );
    }

    if (!isset($json['owner'])) {
        $message = isset($json['error']) ? (string) $json['error'] : 'Render wallet API вернул неполный ответ.';
        return new WP_Error('galia_backend_data', $message);
    }

    return $json;
}

function galia_desk_ajax_market() {
    check_ajax_referer('galia_desk', 'nonce');
    wp_send_json_success(galia_desk_market());
}

function galia_desk_ajax_wallet() {
    check_ajax_referer('galia_desk', 'nonce');
    $owner = isset($_POST['owner']) ? sanitize_text_field(wp_unslash($_POST['owner'])) : '';
    $scan = galia_desk_render_wallet_scan($owner);
    if (is_wp_error($scan)) {
        $fallback = galia_desk_wallet($owner);
        if (!is_wp_error($fallback)) {
            $fallback['source'] = 'wordpress-rpc-galaxy-fallback';
            wp_send_json_success($fallback);
        }
        wp_send_json_error(array(
            'message' => $scan->get_error_message() . ' · fallback: ' . $fallback->get_error_message(),
        ), 400);
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
        <button type="button" data-galia-phantom>Phantom</button>
        <button type="submit">Показать</button>
      </form>
      <div data-galia-hold></div>
      <details class="galia-desk-card">
        <summary>База экипажа</summary>
        <?php echo galia_desk_roster_html(); ?>
      </details>
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
      .galia-wallet-section{margin-top:.9rem}
      .galia-wallet-section h4{margin:.25rem 0 .45rem;color:#c4a35a;letter-spacing:.06em}
      .galia-wallet-card{display:flex;gap:.65rem;align-items:flex-start;border:1px solid rgba(232,238,242,.12);border-radius:10px;padding:.55rem .65rem;margin:.45rem 0;background:#10141c}
      .galia-wallet-image{width:64px;height:64px;object-fit:cover;border-radius:8px;flex:0 0 64px;background:#080c12}
      .galia-wallet-empty{display:flex;align-items:center;justify-content:center;font:700 10px/1 Arial;color:#8b96a3}
      .galia-wallet-main{min-width:0}
      .galia-wallet-meta{color:#aab5bf;font-size:.82rem;margin-top:.18rem}
      .galia-wallet-mint{color:#687683;font:10px/1.3 ui-monospace,monospace;margin-top:.22rem;overflow-wrap:anywhere}
      .galia-wallet-thumb{width:48px;height:48px;flex:0 0 48px}
      .galia-wallet-thumb img{width:48px;height:48px;object-fit:cover;border-radius:7px}
      .galia-fleet-list{display:grid;gap:.45rem}
      .galia-fleet-row{display:grid;grid-template-columns:64px 48px minmax(0,1fr);gap:.55rem;align-items:center;border:1px solid rgba(232,238,242,.12);border-radius:10px;padding:.45rem .55rem;background:#10141c}
      .galia-fleet-row input{min-width:0;width:64px;flex:none;flex:0 0 64px}
      .galia-fleet-main{display:grid;gap:.12rem;min-width:0}
      .galia-fleet-main span{color:#aab5bf;font-size:.78rem}
      .galia-fleet-summary{display:flex;gap:.7rem;flex-wrap:wrap;margin-top:.55rem;padding:.6rem .7rem;border:1px solid rgba(196,163,90,.35);border-radius:9px;background:rgba(196,163,90,.05)}
      .galia-fleet-summary span{color:#aab5bf}
      .galia-player-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.45rem;margin-top:.55rem}
      .galia-player-grid label{display:grid;gap:.25rem;color:#aab5bf;font-size:.75rem}
      .galia-player-grid select{width:100%;min-width:0;height:40px;border:1px solid rgba(232,238,242,.18);border-radius:8px;background:#0d1219;color:#e8eef2;padding:0 .45rem}
      @media (max-width:620px){.galia-fleet-row{grid-template-columns:58px 42px minmax(0,1fr)}.galia-wallet-image{width:54px;height:54px;flex-basis:54px}}
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
          var tape = data.tape || [];
          var prev = tape.length >= 2 ? tape[tape.length - 2].asks || {} : {};
          root.querySelector("[data-galia-chart]").innerHTML = candlesSvg("POLIS / ATLAS · 1д", data.pairCandles || []) + candlesSvg("ATLAS / USD · 1д", data.candles || []) + bubblesHtml("Ресурсы и сырьё · ATLAS", data.resources || [], prev) + bubblesHtml("Корабли", data.ships || [], prev);
          var rows = (data.resources || []).filter(function (row) { return row.ask != null; });
          var html = '<table><thead><tr><th>Ресурс</th><th>Класс</th><th>Продажа, ATLAS</th><th>Покупка, ATLAS</th><th>Δ</th></tr></thead><tbody>';
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
          status.textContent = (data.gmp === false ? "На сервере нет GMP — цены стакана не посчитались." : ("Ордеров " + (data.orderCount || 0))) + tapeNote + " · авто 3 мин";
        }
        function bubblesHtml(title, rows, prev) {
          var priced = (rows || []).filter(function (row) { return row.image || row.usdcAsk != null || row.ask != null; }).slice(0, 60);
          if (!priced.length) return "";
          var html = '<div class="galia-desk-card"><strong>' + title + '</strong><div style="display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.5rem">';
          priced.forEach(function (row) {
            var change = "—";
            var color = "#8b96a3";
            if (prev[row.mint]) {
              var pct = ((row.ask - prev[row.mint]) / prev[row.mint]) * 100;
              change = (pct > 0 ? "+" : "") + pct.toLocaleString("ru-RU", { maximumFractionDigits: 1 }) + "%";
              color = pct > 0 ? "#c45c4a" : "#7a9a7e";
            } else {
              change = num(row.usdcAsk != null ? row.usdcAsk : row.ask) + " USDC";
            }
            var size = 74 + Math.min(48, Math.log10((row.askQty || 1) + 10) * 16);
            html += '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:999px;border:1px solid ' + color + ';display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:.25rem">';
            if (row.image) html += '<img alt="" src="' + row.image + '" style="width:22px;height:22px;border-radius:999px;object-fit:cover" />';
            html += '<span style="font-size:11px;line-height:1.1">' + row.name + '</span><span style="color:' + color + ';font-size:10px">' + change + '</span></div>';
          });
          return html + '</div></div>';
        }
        function candlesSvg(title, candles) {
          if (!candles || candles.length < 2) return "";
          var w = 640, h = 160, pad = 8, padR = 72;
          var min = candles[0].l, max = candles[0].h;
          candles.forEach(function (c) { if (c.l < min) min = c.l; if (c.h > max) max = c.h; });
          var span = (max - min) || 1;
          var slot = (w - pad - padR) / candles.length;
          function y(v) { return pad + (1 - (v - min) / span) * (h - pad * 2); }
          function tick(n) { return n >= 100 ? n.toFixed(1) : n >= 1 ? n.toFixed(2) : n.toFixed(6); }
          var last = candles[candles.length - 1];
          var first = candles[0].o;
          var move = first ? ((last.c - first) / first) * 100 : 0;
          var grid = [max, (max + min) / 2, min].map(function (v) {
            return '<line x1="' + pad + '" x2="' + (w - padR) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="rgba(232,238,242,.12)"/>'
              + '<text x="' + (w - 4) + '" y="' + (y(v) + 4) + '" text-anchor="end" fill="#8b96a3" font-size="12">' + tick(v) + '</text>';
          }).join("");
          var body = candles.map(function (c, i) {
            var x = pad + i * slot + slot / 2;
            var up = c.c >= c.o;
            var color = up ? "#7a9a7e" : "#c45c4a";
            var top = y(Math.max(c.o, c.c));
            var bot = y(Math.min(c.o, c.c));
            return '<line x1="' + x + '" x2="' + x + '" y1="' + y(c.h) + '" y2="' + y(c.l) + '" stroke="' + color + '" stroke-width="1.2"/>'
              + '<rect x="' + (x - Math.max(1.2, slot * 0.28)) + '" y="' + top + '" width="' + Math.max(2, slot * 0.56) + '" height="' + Math.max(1.2, bot - top) + '" fill="' + color + '"/>';
          }).join("");
          return '<div class="galia-desk-card"><strong>' + title + '</strong> ' + move.toLocaleString("ru-RU", { maximumFractionDigits: 2 }) + '%'
            + ' <span class="galia-desk-note">O ' + tick(last.o) + ' H ' + tick(last.h) + ' L ' + tick(last.l) + ' C ' + tick(last.c) + '</span>'
            + '<svg viewBox="0 0 ' + w + ' ' + h + '" style="width:100%;height:160px;display:block;margin-top:.4rem">' + grid + body + '</svg></div>';
        }
        function load() {
          status.textContent = "Снимаю стакан…";
          post("galia_desk_market").then(function (res) { return res.json(); }).then(function (json) {
            if (!json.success) throw new Error("market");
            paint(json.data);
          }).catch(function () { status.textContent = "Не вышло снять цены."; });
        }
        root.querySelector("[data-galia-refresh]").addEventListener("click", load);
        window.setInterval(function () {
          if (document.hidden) return;
          load();
        }, 3 * 60 * 1000);
        document.addEventListener("visibilitychange", function () {
          if (!document.hidden) load();
        });
        root.querySelector("[data-galia-wallet]").addEventListener("submit", function (event) {
          event.preventDefault();
          var owner = new FormData(event.currentTarget).get("owner");
          var hold = root.querySelector("[data-galia-hold]");
          hold.textContent = "Читаю кошелёк…";
          fetch("https://bcm4staratlas.onrender.com/api/wallet-scan", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify({ owner: owner })
          }).then(function (res) {
            return res.json().then(function (json) {
              if (!res.ok) throw new Error((json && json.error) || "Render wallet API HTTP " + res.status);
              return json;
            });
          }).then(function (json) {
            var data = json && json.data && Array.isArray(json.data.items) ? json.data : json;
            if (!data || !Array.isArray(data.items)) {
              throw new Error("Render wallet API вернул ответ без inventory.");
            }

            function esc(value) {
              return String(value == null ? "" : value)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;");
            }
            function shortMint(value) {
              var text = String(value || "");
              return text.length > 14 ? text.slice(0, 7) + "…" + text.slice(-7) : text;
            }
            function traitValue(item, wanted) {
              var traits = Array.isArray(item.traits) ? item.traits : [];
              var hit = traits.find(function (row) {
                return row && String(row.trait || "").toLowerCase() === wanted.toLowerCase();
              });
              return hit ? String(hit.value || "") : "";
            }
            function aptitudeRows(item) {
              var names = [];
              (item.traits || []).forEach(function (trait) {
                if (!trait) return;
                var name = String(trait.trait || "");
                if (/^(command|flight|operator|engineering|medical|science|fitness|hospitality)$/i.test(name)) {
                  if (!names.some(function (row) { return row.name.toLowerCase() === name.toLowerCase(); })) {
                    names.push({ name: name, value: String(trait.value || "") });
                  }
                }
              });
              var labels = {
                Command: "Командир",
                Flight: "Пилот",
                Operator: "Оператор",
                Engineering: "Инженер",
                Medical: "Медик",
                Science: "Учёный",
                Fitness: "Боец",
                Hospitality: "Обслуживание"
              };
              return names.map(function (row) {
                return (labels[row.name] || row.name) + " " + row.value;
              });
            }

            var items = data.items.slice().sort(function (a, b) {
              var rank = { crew: 0, ship: 1, structure: 2, resource: 3, nft: 4, other: 5 };
              return (rank[a.kind] == null ? 9 : rank[a.kind]) - (rank[b.kind] == null ? 9 : rank[b.kind]);
            });
            var crews = items.filter(function (item) { return item.kind === "crew"; });
            var ships = items.filter(function (item) { return item.kind === "ship" && item.spec !== "мой ордер"; });
            var inventory = items.filter(function (item) { return item.kind !== "crew" && item.kind !== "ship"; });

            var profiles = data.profiles || [];
            var html = profiles.map(function (profile) {
              var fleets = (profile.fleets || []).map(function (fleet) {
                return esc(fleet.name) + " · фракция " + esc(fleet.faction);
              }).join(", ") || "флотов не видно";
              return '<div class="galia-desk-card"><strong>В игре</strong><br><code>' + esc(profile.profile) + '</code><br>' + fleets + '</div>';
            }).join("");

            if (crews.length) {
              html += '<div class="galia-wallet-section"><h4>Экипаж · ' + crews.length + '</h4>';
              html += crews.map(function (item) {
                var ocean = [
                  traitValue(item, "Openness"),
                  traitValue(item, "Conscientiousness"),
                  traitValue(item, "Extraversion"),
                  traitValue(item, "Agreeableness"),
                  traitValue(item, "Neuroticism")
                ];
                var aptitudes = aptitudeRows(item);
                var media = item.image ? '<img alt="" src="' + esc(item.image) + '" class="galia-wallet-image" />' : '<div class="galia-wallet-image galia-wallet-empty">CREW</div>';
                return '<div class="galia-wallet-card">' +
                  media +
                  '<div class="galia-wallet-main"><strong>' + esc(item.name) + '</strong>' +
                  '<div class="galia-wallet-meta">' + esc(item.rarity || "Rarity —") + ' · ' + esc(item.spec || "Раса —") + '</div>' +
                  '<div class="galia-wallet-meta">OCEAN · ' + esc(ocean.join(" / ") || "—") + '</div>' +
                  '<div class="galia-wallet-meta">' + esc(aptitudes.join(" · ") || "Профессии —") + '</div>' +
                  '<div class="galia-wallet-mint">' + esc(shortMint(item.mint)) + '</div></div></div>';
              }).join("");
              html += '</div>';
            }

            var selected = {};
            if (ships.length) {
              var opal = ships.find(function (item) { return /opal\s*jetjet/i.test(String(item.name || "")); });
              if (opal) selected[opal.mint] = Math.min(1, Number(opal.amount || 1));
              html += '<div class="galia-wallet-section"><h4>Флот для игры</h4>' +
                '<p class="galia-desk-note">Место Crew на корабле = потенциальное число игроков. Можно собрать несколько кораблей в один игровой флот.</p>' +
                '<div class="galia-fleet-list">';
              ships.forEach(function (ship) {
                var max = Math.max(0, Math.floor(Number(ship.amount || 1)));
                var value = selected[ship.mint] || 0;
                var slots = Number(ship.crew || 0);
                var slotText = slots ? (slots + " игроков") : "вместимость не указана";
                var specs = [
                  ship.className,
                  ship.spec,
                  ship.make,
                  Array.isArray(ship.slots) && ship.slots.length ? ship.slots.join(", ") : ""
                ].filter(Boolean).join(" · ");
                html += '<label class="galia-fleet-row">' +
                  '<input type="number" min="0" max="' + max + '" value="' + value + '" data-galia-ship-qty data-mint="' + esc(ship.mint) + '" data-crew="' + slots + '" data-name="' + esc(ship.name) + '">' +
                  '<span class="galia-wallet-thumb">' + (ship.image ? '<img alt="" src="' + esc(ship.image) + '" />' : '') + '</span>' +
                  '<span class="galia-fleet-main"><strong>' + esc(ship.name) + '</strong>' +
                  '<span>' + esc(ship.rarity || "") + ' · ' + esc(slotText) + '</span>' +
                  '<span>' + esc(specs || "параметры корабля доступны") + '</span>' +
                  '<span class="galia-wallet-mint">' + esc(shortMint(ship.mint)) + '</span></span></label>';
              });
              html += '</div><div data-galia-fleet-summary></div><div data-galia-player-slots></div></div>';
            }

            if (inventory.length) {
              html += '<div class="galia-wallet-section"><h4>Остальной инвентарь · ' + inventory.length + '</h4>';
              html += inventory.map(function (item) {
                var media = item.image ? '<img alt="" src="' + esc(item.image) + '" class="galia-wallet-image" />' : '';
                var details = [
                  item.kind,
                  item.rarity,
                  item.className,
                  item.spec,
                  "×" + num(item.amount)
                ].filter(Boolean).join(" · ");
                return '<div class="galia-wallet-card">' + media + '<div><strong>' + esc(item.name) + '</strong><div class="galia-wallet-meta">' + esc(details) + '</div><div class="galia-wallet-mint">' + esc(shortMint(item.mint)) + '</div></div></div>';
              }).join("");
              html += '</div>';
            }

            if (!items.length) {
              html += "<p>На ключе не найден инвентарь Star Atlas. Для игры без кошелька используется Opal Jetjet на 2 места.</p>";
            }

            html += "<p class='galia-desk-note'>" + esc(data.note || "") + "</p>";
            hold.innerHTML = html;

            var fleetSummary = root.querySelector("[data-galia-fleet-summary]");
            var playerSlots = root.querySelector("[data-galia-player-slots]");
            function renderFleetBuilder() {
              if (!fleetSummary || !playerSlots) return;
              var rows = Array.from(root.querySelectorAll("[data-galia-ship-qty]"));
              var totalCapacity = 0;
              var chosenShips = [];
              rows.forEach(function (input) {
                var qty = Math.max(0, Number(input.value || 0));
                var crewPer = Math.max(0, Number(input.getAttribute("data-crew") || 0));
                if (qty > 0) {
                  totalCapacity += qty * crewPer;
                  chosenShips.push({
                    mint: input.getAttribute("data-mint") || "",
                    name: input.getAttribute("data-name") || "",
                    quantity: qty,
                    crew: crewPer
                  });
                }
              });
              var maxPlayers = totalCapacity > 0 ? totalCapacity : 2;
              fleetSummary.innerHTML =
                '<div class="galia-fleet-summary"><strong>Игроков доступно: ' + maxPlayers + '</strong>' +
                '<span>кораблей: ' + chosenShips.length + ' · мест Crew: ' + totalCapacity + '</span></div>';

              var options = '<option value="">— без Crew —</option>' + crews.map(function (crew) {
                return '<option value="' + esc(crew.mint) + '">' + esc(crew.name) + ' · ' + esc(crew.spec || "раса —") + '</option>';
              }).join("");
              playerSlots.innerHTML = '<div class="galia-player-grid">' +
                Array.from({length: maxPlayers}, function (_, index) {
                  var value = crews[index] ? crews[index].mint : "";
                  return '<label>Игрок ' + (index + 1) + '<select data-galia-player><option value="">— без Crew —</option>' +
                    crews.map(function (crew) {
                      var selectedAttr = value === crew.mint ? ' selected' : '';
                      return '<option value="' + esc(crew.mint) + '"' + selectedAttr + '>' + esc(crew.name) + '</option>';
                    }).join("") + '</select></label>';
                }).join("") + '</div>';

              var config = {
                owner: data.owner || "",
                ships: chosenShips,
                players: Array.from(root.querySelectorAll("[data-galia-player]")).map(function (select, index) {
                  var crew = crews.find(function (item) { return item.mint === select.value; });
                  return { slot: index + 1, crew: crew ? crew.mint : "", crewName: crew ? crew.name : "" };
                }),
                maxPlayers: maxPlayers
              };
              window.GALIA_FLEET = config;
              document.dispatchEvent(new CustomEvent("galia-fleet-config", { detail: config }));
            }

            root.querySelectorAll("[data-galia-ship-qty]").forEach(function (input) {
              input.addEventListener("input", renderFleetBuilder);
              input.addEventListener("change", renderFleetBuilder);
            });
            renderFleetBuilder();

            window.GALIA_HOLDINGS = items;
            window.GALIA_WALLET_SCAN = data;
            document.dispatchEvent(new CustomEvent("galia-holdings", { detail: items }));
            document.dispatchEvent(new CustomEvent("galia-wallet-scan", { detail: data }));
          }).catch(function (err) { hold.textContent = err.message || "Кошелёк не прочитался."; });
        });
        root.querySelector("[data-galia-phantom]").addEventListener("click", function () {
          var provider = window.phantom && window.phantom.solana ? window.phantom.solana : (window.solana && window.solana.isPhantom ? window.solana : null);
          if (!provider || !provider.connect) {
            root.querySelector("[data-galia-hold]").textContent = "Phantom в этом браузере не найден. Можно вставить публичный ключ вручную.";
            return;
          }
          provider.connect().then(function (response) {
            var key = response && response.publicKey && response.publicKey.toString ? response.publicKey.toString() : "";
            if (!key) throw new Error("Phantom не вернул публичный ключ.");
            root.querySelector('input[name="owner"]').value = key;
            root.querySelector("[data-galia-wallet]").requestSubmit();
          }).catch(function (err) {
            root.querySelector("[data-galia-hold]").textContent = err && err.message ? err.message : "Phantom не подключился.";
          });
        });
        load();
      })();
    </script>
    <?php
    return ob_get_clean();
}

add_shortcode('galia_desk', 'galia_desk_shortcode');

function galia_desk_valid_url($raw) {
    $raw = trim((string) $raw);
    if (!preg_match('#^https://[a-z0-9.-]+\.[a-z]{2,}#i', $raw)) {
        return '';
    }
    if (stripos($raw, 'grok-sandbox.com') !== false || stripos($raw, 'grok.com/preview') !== false) {
        return '';
    }
    return esc_url_raw($raw);
}

function galia_desk_app_url($override = '') {
    $raw = $override !== '' ? $override : (string) get_option('galia_app_url', '');
    return galia_desk_valid_url($raw);
}

function galia_desk_sanitize_app_url($value) {
    return galia_desk_valid_url(is_string($value) ? $value : '');
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
    $url = (string) get_option('galia_app_url', '');
    echo '<div class="wrap"><h1>Galia Desk</h1>';
    echo '<p>Поле можно оставить пустым. [galia_app] открывает карту, экипаж, флот, рынок и сейф с этого сайта. Стол цен [galia_desk] и лабиринт не трогаются.</p>';
    echo '<form method="post" action="options.php">';
    settings_fields('galia_desk_settings');
    echo '<table class="form-table"><tr><th scope="row"><label for="galia_app_url">Чужой адрес, не обязателен</label></th><td>';
    echo '<input name="galia_app_url" id="galia_app_url" type="text" class="regular-text" value="' . esc_attr($url) . '" placeholder="оставь пустым" />';
    echo '<p class="description">Пустое поле стирает старую ссылку. Страница с шаблоном «Galia — полный экран» или шорткод [galia_app] рисует глобус с walkingyog.com. Стол цен — [galia_desk]. Лабиринт не трогается.</p>';
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

function galia_desk_globe_markup($full = false) {
    $base = plugin_dir_url(__FILE__) . 'app/';
    $ajax = admin_url('admin-ajax.php');
    $nonce = wp_create_nonce('galia_desk');
    $height = $full ? '100dvh' : 'min(88vh, 920px)';
    ob_start();
    ?>
    <div id="galia-root" style="min-height:<?php echo esc_attr($height); ?>;background:#07090e"></div>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Rajdhani:wght@500;600;700&family=Source+Sans+3:wght@400;500;600&display=swap" />
    <link rel="stylesheet" href="<?php echo esc_url($base . 'app.css?ver=0.8.9'); ?>" />
    <!-- noptimize -->
    <script>
      window.GALIA_ASSET = <?php echo wp_json_encode($base); ?>;
      window.GALIA_WP = <?php echo wp_json_encode(array('ajax' => $ajax, 'nonce' => $nonce)); ?>;
    </script>
    <script type="module" src="<?php echo esc_url($base . 'app.js?ver=0.8.9'); ?>"></script>
    <!-- /noptimize -->
    <?php
    return ob_get_clean();
}

function galia_app_shortcode($atts) {
    $atts = shortcode_atts(array('url' => ''), $atts, 'galia_app');
    $url = galia_desk_app_url(isset($atts['url']) ? (string) $atts['url'] : '');
    if ($url === '') {
        return galia_desk_globe_markup(false);
    }
    $src = esc_url($url);
    ob_start();
    ?>
    <div class="galia-app-frame">
      <iframe title="Galia" src="<?php echo $src; ?>" allow="fullscreen" allowfullscreen></iframe>
    </div>
    <style>
      .galia-app-frame{width:100vw;max-width:100vw;margin-left:calc(50% - 50vw);background:#07090e}
      .galia-app-frame iframe{display:block;width:100%;height:100dvh;border:0;background:#07090e}
    </style>
    <?php
    return ob_get_clean();
}
add_shortcode('galia_app', 'galia_app_shortcode');

