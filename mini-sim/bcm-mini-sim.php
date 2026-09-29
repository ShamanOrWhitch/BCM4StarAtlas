<?php
/**
 * Plugin Name: BCM Mini Space Simulation
 * Description: Self-contained 6DOF space-labyrinth test for WordPress.
 * Version: 0.9.46
 * Author: ShamanOrWitch
 * License: GPL-2.0-or-later
 */

if (!defined('ABSPATH')) {
    exit;
}

define('BCM_MINI_SIM_VERSION', '0.9.46');
define('BCM_MINI_SIM_URL', plugin_dir_url(__FILE__));
define('BCM_MINI_SIM_PATH', plugin_dir_path(__FILE__));
define('BCM_MINI_SIM_BACKEND', 'https://bcm4staratlas.onrender.com/api/wallet-scan');

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

function bcm_mini_sim_find_media_asset($filename)
{
    $needle = strtolower(basename((string) $filename));
    if ($needle === '') {
        return '';
    }

    $posts = get_posts(array(
        'post_type' => 'attachment',
        'post_status' => 'inherit',
        'posts_per_page' => 50,
        's' => pathinfo($needle, PATHINFO_FILENAME),
    ));

    foreach ($posts as $attachment) {
        $file = get_attached_file($attachment->ID);
        if ($file && strtolower(basename($file)) === $needle) {
            $url = wp_get_attachment_url($attachment->ID);
            if ($url) {
                return $url;
            }
        }

        $url = wp_get_attachment_url($attachment->ID);
        if ($url) {
            $urlBase = strtolower(basename(parse_url($url, PHP_URL_PATH)));
            if ($urlBase === $needle) {
                return $url;
            }
        }
    }

    return '';
}


function bcm_mini_sim_remote_json($url, $method = 'GET', $body = null, $timeout = 20) {
    $args = array(
        'timeout' => $timeout,
        'headers' => array('Accept' => 'application/json'),
    );

    if (strtoupper($method) === 'POST') {
        $args['headers']['Content-Type'] = 'application/json';
        $args['body'] = wp_json_encode($body);
        $response = wp_remote_post($url, $args);
    } else {
        $response = wp_remote_get($url, $args);
    }

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

function bcm_mini_sim_crew_catalog() {
    $cached = get_transient('bcm_mini_sim_crew_catalog_v3');
    if (is_array($cached) && !empty($cached)) {
        return $cached;
    }

    $rows = bcm_mini_sim_remote_json('https://galaxy.staratlas.com/nfts', 'GET', null, 25);
    $index = array();

    if (is_array($rows)) {
        foreach ($rows as $row) {
            if (!is_array($row) || empty($row['mint'])) {
                continue;
            }

            $attrs = isset($row['attributes']) && is_array($row['attributes'])
                ? $row['attributes']
                : array();

            $item_type = isset($attrs['itemType']) ? strtolower((string) $attrs['itemType']) : '';
            if ($item_type !== 'crew') {
                continue;
            }

            $index[(string) $row['mint']] = array(
                'mint' => (string) $row['mint'],
                'name' => isset($row['name']) ? (string) $row['name'] : (string) $row['mint'],
                'symbol' => isset($row['symbol']) ? (string) $row['symbol'] : '',
                'rarity' => isset($attrs['rarity']) ? (string) $attrs['rarity'] : '',
                'species' => isset($attrs['spec']) ? (string) $attrs['spec'] : '',
                'image' => isset($row['image']) ? (string) $row['image'] : '',
                'raw' => $row,
            );
        }
    }

    if (!empty($index)) {
        set_transient('bcm_mini_sim_crew_catalog_v2', $index, 30 * MINUTE_IN_SECONDS);
    }

    return $index;
}

function bcm_mini_sim_solanafm_owner_tokens($owner, $token_type = null, $timeout = 20) {
    $url = 'https://api.solana.fm/v1/addresses/' . rawurlencode($owner) . '/tokens';
    if ($token_type !== null && $token_type !== '') {
        $url .= '?tokenType=' . rawurlencode($token_type);
    }
    $json = bcm_mini_sim_remote_json($url, 'GET', null, $timeout);
    if (!is_array($json) || !isset($json['tokens']) || !is_array($json['tokens'])) {
        return null;
    }
    $out = array();
    foreach ($json['tokens'] as $key => $row) {
        if (!is_array($row)) {
            continue;
        }
        $info = isset($row['info']) && is_array($row['info']) ? $row['info'] : $row;
        $mint = '';
        foreach (array(
            isset($info['mint']) ? $info['mint'] : '',
            isset($row['mint']) ? $row['mint'] : '',
            isset($row['tokenMint']) ? $row['tokenMint'] : '',
        ) as $candidate) {
            $candidate = (string) $candidate;
            if (preg_match('/^[1-9A-HJ-NP-Za-km-z]{32,44}$/', $candidate)) {
                $mint = $candidate;
                break;
            }
        }
        if ($mint === '') {
            continue;
        }
        $amount = 1;
        if (isset($info['tokenAmount']) && is_array($info['tokenAmount'])) {
            if (isset($info['tokenAmount']['uiAmount']) && is_numeric($info['tokenAmount']['uiAmount'])) {
                $amount = (float) $info['tokenAmount']['uiAmount'];
            } elseif (isset($info['tokenAmount']['amount']) && is_numeric($info['tokenAmount']['amount'])) {
                $amount = (float) $info['tokenAmount']['amount'];
            }
        } elseif (isset($info['amount']) && is_numeric($info['amount'])) {
            $amount = (float) $info['amount'];
        }
        if ($amount <= 0) {
            continue;
        }
        $out[$mint] = array('mint' => $mint, 'amount' => $amount, 'raw' => $row);
    }
    return $out;
}

function bcm_mini_sim_solanafm_token_metadata($mints, $timeout = 25) {
    $mints = array_values(array_unique(array_filter(array_map('strval', (array) $mints))));
    $out = array();
    foreach (array_chunk($mints, 50) as $chunk) {
        if (!$chunk) {
            continue;
        }
        $json = bcm_mini_sim_remote_json('https://api.solana.fm/v1/tokens', 'POST', array(
            'tokens' => $chunk,
        ), $timeout);
        if (!is_array($json)) {
            continue;
        }
        foreach ($json as $mint => $row) {
            if (!is_array($row)) {
                continue;
            }
            $key = (string) $mint;
            $actual = isset($row['mint']) ? (string) $row['mint'] : $key;
            if ($actual !== '') {
                $out[$actual] = $row;
            }
        }
    }
    return $out;
}

function bcm_mini_sim_attr_map($attributes) {
    $map = array();
    if (!is_array($attributes)) {
        return $map;
    }
    foreach ($attributes as $attr) {
        if (!is_array($attr)) {
            continue;
        }
        $trait = isset($attr['trait_type']) ? (string) $attr['trait_type'] : (isset($attr['trait']) ? (string) $attr['trait'] : '');
        if ($trait === '' || !array_key_exists('value', $attr) || is_array($attr['value'])) {
            continue;
        }
        $map[$trait] = $attr['value'];
    }
    return $map;
}

function bcm_mini_sim_case_trait($map, $name) {
    foreach ((array) $map as $key => $value) {
        if (strcasecmp((string) $key, $name) === 0) {
            return $value;
        }
    }
    return null;
}

function bcm_mini_sim_ocean_trait($map, $name) {
    $value = bcm_mini_sim_case_trait($map, $name);
    return bcm_mini_sim_ocean($value);
}

function bcm_mini_sim_metadata_uri_json($uri, $timeout = 12) {
    $uri = trim((string) $uri);
    if ($uri === '') {
        return array();
    }
    if (strpos($uri, 'ipfs://') === 0) {
        $uri = 'https://ipfs.io/ipfs/' . ltrim(substr($uri, 7), '/');
    } elseif (strpos($uri, 'ar://') === 0) {
        $uri = 'https://arweave.net/' . ltrim(substr($uri, 5), '/');
    }
    if (strpos($uri, 'https://') !== 0) {
        return array();
    }
    $json = bcm_mini_sim_remote_json($uri, 'GET', null, $timeout);
    return is_array($json) ? $json : array();
}

function bcm_mini_sim_extract_solanafm_metadata($row) {
    if (!is_array($row)) {
        return array();
    }
    $token_list = isset($row['tokenList']) && is_array($row['tokenList']) ? $row['tokenList'] : array();
    $token_meta = isset($row['tokenMetadata']) && is_array($row['tokenMetadata']) ? $row['tokenMetadata'] : array();
    $on_chain = isset($token_meta['onChainInfo']) && is_array($token_meta['onChainInfo']) ? $token_meta['onChainInfo'] : array();
    $off_chain = isset($token_meta['offChainInfo']) && is_array($token_meta['offChainInfo']) ? $token_meta['offChainInfo'] : array();
    if (!$off_chain && isset($row['offChainInfo']) && is_array($row['offChainInfo'])) {
        $off_chain = $row['offChainInfo'];
    }
    $attributes = array();
    if (isset($off_chain['attributes'])) {
        $attributes = $off_chain['attributes'];
    } elseif (isset($off_chain['data']['attributes'])) {
        $attributes = $off_chain['data']['attributes'];
    } elseif (isset($row['attributes'])) {
        $attributes = $row['attributes'];
    }
    return array(
        'name' => isset($off_chain['name']) ? (string) $off_chain['name'] : (isset($token_list['name']) ? (string) $token_list['name'] : ''),
        'image' => isset($off_chain['image']) ? (string) $off_chain['image'] : (isset($token_list['image']) ? (string) $token_list['image'] : ''),
        'symbol' => isset($off_chain['symbol']) ? (string) $off_chain['symbol'] : (isset($token_list['symbol']) ? (string) $token_list['symbol'] : ''),
        'attributes' => is_array($attributes) ? $attributes : array(),
        'uri' => isset($on_chain['uri']) ? (string) $on_chain['uri'] : '',
        'raw' => $row,
    );
}

function bcm_mini_sim_crew_rpc($method, $params, $timeout = 20) {
    // PublicNode is a standard RPC/indexer endpoint, not a DAS endpoint.
    // It rejects getAssetsByOwner unless a personal indexer token is used,
    // so it must never be a fallback for this wallet scan.
    $rpcs = array(
        'https://api.mainnet.solana.com',
        'https://api.mainnet-beta.solana.com',
    );

    $errors = array();

    foreach ($rpcs as $url) {
        $json = bcm_mini_sim_remote_json($url, 'POST', array(
            'jsonrpc' => '2.0',
            'id' => 1,
            'method' => $method,
            'params' => $params,
        ), $timeout);

        if (is_array($json) && array_key_exists('result', $json) && !isset($json['error'])) {
            return $json['result'];
        }

        if (is_array($json) && isset($json['error']['message'])) {
            $errors[] = $url . ': ' . (string) $json['error']['message'];
        } else {
            $errors[] = $url . ': запрос не вернул JSON-RPC result';
        }
    }

    return null;
}

function bcm_mini_sim_ocean($value) {
    if (!is_numeric($value)) {
        return null;
    }
    $n = (float) $value;
    return $n <= 1 ? (int) round($n * 100) : (int) round($n);
}

function bcm_mini_sim_galaxy_crew_by_das() {
    $rows = bcm_mini_sim_remote_json('https://galaxy.staratlas.com/crew', 'GET', null, 20);
    $index = array();
    if (!is_array($rows)) {
        return $index;
    }
    foreach ($rows as $row) {
        if (!is_array($row) || empty($row['dasID'])) {
            continue;
        }
        $index[(string) $row['dasID']] = $row;
    }
    return $index;
}

function bcm_mini_sim_das_wallet_scan($owner) {
    $galaxy = bcm_mini_sim_galaxy_crew_by_das();
    $crew = array();
    $inventory = array();
    $seen = array();
    $errors = array();
    $das_ok = false;

    for ($page = 1; $page <= 4; $page++) {
        $result = bcm_mini_sim_crew_rpc('getAssetsByOwner', array(
            'ownerAddress' => $owner,
            'page' => $page,
            'limit' => 100,
            'displayOptions' => array(
                'showFungible' => false,
                'showZeroBalance' => false,
            ),
        ), 22);

        if (!is_array($result)) {
            $errors[] = 'DAS getAssetsByOwner не ответил на https://api.mainnet.solana.com';
            break;
        }

        $das_ok = true;
        $rows = isset($result['items']) && is_array($result['items']) ? $result['items'] : array();
        foreach ($rows as $asset) {
            if (!is_array($asset) || empty($asset['id'])) {
                continue;
            }
            $mint = (string) $asset['id'];
            if (isset($seen[$mint])) {
                continue;
            }
            $seen[$mint] = true;
            $meta = isset($asset['content']['metadata']) && is_array($asset['content']['metadata']) ? $asset['content']['metadata'] : array();
            $chain_name = isset($meta['name']) ? (string) $meta['name'] : '';
            $symbol = isset($meta['symbol']) ? (string) $meta['symbol'] : '';
            $map = bcm_mini_sim_attr_map(isset($meta['attributes']) ? $meta['attributes'] : array());
            $card = isset($galaxy[$mint]) ? $galaxy[$mint] : null;
            $links = isset($asset['content']['links']) && is_array($asset['content']['links']) ? $asset['content']['links'] : array();
            $image = isset($links['image']) ? (string) $links['image'] : '';
            $blob = strtolower($chain_name . ' ' . $symbol . ' ' . implode(' ', array_keys($map)));
            $is_crew = $card || preg_match('/crew|openness|species/', $blob);

            if ($is_crew) {
                $given = $card && !empty($card['name']) ? (string) $card['name'] : (string) (bcm_mini_sim_case_trait($map, 'name') ?? '');
                if ($given !== '' && stripos($given, 'crew') === 0) {
                    $given = '';
                }
                $aptitudes = array();
                if ($card && !empty($card['aptitudes']) && is_array($card['aptitudes'])) {
                    foreach ($card['aptitudes'] as $apt => $level) {
                        $aptitudes[(string) $apt] = (string) $level;
                    }
                }
                foreach (array('Command', 'Flight', 'Operator', 'Engineering', 'Medical', 'Science', 'Fitness', 'Hospitality') as $apt) {
                    $value = bcm_mini_sim_case_trait($map, $apt);
                    if ($value !== null && !isset($aptitudes[$apt])) {
                        $aptitudes[$apt] = (string) $value;
                    }
                }
                $crew[] = array(
                    'id' => $mint,
                    'mint' => $mint,
                    'name' => $given !== '' ? $given : $chain_name,
                    'image' => $card && !empty($card['imageUrl']) ? (string) $card['imageUrl'] : $image,
                    'species' => $card && !empty($card['species']) ? (string) $card['species'] : (string) (bcm_mini_sim_case_trait($map, 'species') ?? ''),
                    'rarity' => $card && !empty($card['rarity']) ? (string) $card['rarity'] : (string) (bcm_mini_sim_case_trait($map, 'rarity') ?? ''),
                    'openness' => bcm_mini_sim_ocean(is_array($card) && array_key_exists('openness', $card) ? $card['openness'] : bcm_mini_sim_case_trait($map, 'openness')),
                    'conscientiousness' => bcm_mini_sim_ocean(is_array($card) && array_key_exists('conscientiousness', $card) ? $card['conscientiousness'] : bcm_mini_sim_case_trait($map, 'conscientiousness')),
                    'extraversion' => bcm_mini_sim_ocean(is_array($card) && array_key_exists('extraversion', $card) ? $card['extraversion'] : bcm_mini_sim_case_trait($map, 'extraversion')),
                    'agreeableness' => bcm_mini_sim_ocean(is_array($card) && array_key_exists('agreeableness', $card) ? $card['agreeableness'] : bcm_mini_sim_case_trait($map, 'agreeableness')),
                    'neuroticism' => bcm_mini_sim_ocean(is_array($card) && array_key_exists('neuroticism', $card) ? $card['neuroticism'] : bcm_mini_sim_case_trait($map, 'neuroticism')),
                    'aptitudes' => $aptitudes,
                    'source' => $card ? 'galaxy-crew-dasID' : 'das-metadata',
                    'amount' => 1,
                );
                continue;
            }

            $inventory[] = array(
                'mint' => $mint,
                'name' => $chain_name !== '' ? $chain_name : $mint,
                'amount' => 1,
                'kind' => 'nft',
                'image' => $image,
                'rarity' => (string) (bcm_mini_sim_case_trait($map, 'rarity') ?? ''),
                'spec' => '',
            );
        }

        $total = isset($result['total']) ? (int) $result['total'] : count($rows);
        if (!$rows || count($rows) < 100 || $page * 100 >= $total) {
            break;
        }
    }

    if (!$das_ok) {
        return null;
    }

    return array(
        'owner' => $owner,
        'items' => $crew,
        'crew' => $crew,
        'inventory' => $inventory,
        'counts' => array(
            'crew' => count($crew),
            'ship' => 0,
            'resource' => 0,
            'structure' => 0,
            'nft' => count($inventory),
            'other' => 0,
        ),
        'errors' => $errors,
        'source' => 'wordpress-das-api.mainnet.solana.com',
    );
}

function bcm_mini_sim_render_wallet_scan($owner) {
    $response = wp_remote_post(BCM_MINI_SIM_BACKEND, array(
        'timeout' => 45,
        'headers' => array(
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ),
        'body' => wp_json_encode(array('owner' => $owner)),
    ));

    if (is_wp_error($response)) {
        return new WP_Error(
            'bcm_mini_sim_backend',
            'Render wallet API: ' . $response->get_error_message()
        );
    }

    $code = (int) wp_remote_retrieve_response_code($response);
    $body = wp_remote_retrieve_body($response);
    $json = json_decode($body, true);

    if ($code < 200 || $code >= 300 || !is_array($json)) {
        return new WP_Error(
            'bcm_mini_sim_backend_http',
            'Render wallet API HTTP ' . $code
        );
    }

    if (!isset($json['owner'])) {
        $message = isset($json['error']) ? (string) $json['error'] : 'Render wallet API вернул неполный ответ.';
        return new WP_Error('bcm_mini_sim_backend_data', $message);
    }

    return $json;
}

function bcm_mini_sim_server_crew_scan($owner) {
    $owner = trim((string) $owner);
    if (!preg_match('/^[1-9A-HJ-NP-Za-km-z]{32,44}$/', $owner)) {
        return new WP_Error('bcm_mini_sim_owner', 'Нужен публичный ключ Solana.');
    }

    $render = bcm_mini_sim_render_wallet_scan($owner);
    if (is_array($render)) {
        $render['source'] = 'render-wallet-scan';
        return $render;
    }
    if (is_wp_error($render)) {
        return $render;
    }

    $das = bcm_mini_sim_das_wallet_scan($owner);
    if (is_array($das) && (!empty($das['items']) || empty($das['errors']))) {
        return $das;
    }

    $crew_catalog = bcm_mini_sim_crew_catalog();
    // SolanaFM owner endpoint already returns the wallet's token accounts,
    // NFTs and other supported assets in one GET. The free endpoint is rate
    // limited, so do not split this into separate NFT/Fungible requests.
    $mint_rows = bcm_mini_sim_solanafm_owner_tokens($owner, null, 20);
    $errors = array();
    if ($mint_rows === null) {
        $errors[] = 'SolanaFM wallet bridge не ответил';
        $mint_rows = array();
    }

    $metadata = bcm_mini_sim_solanafm_token_metadata(array_keys($mint_rows), 25);
    $crew = array();
    $inventory = array();

    foreach ($mint_rows as $mint => $hold) {
        $row = isset($metadata[$mint]) && is_array($metadata[$mint]) ? bcm_mini_sim_extract_solanafm_metadata($metadata[$mint]) : array();
        if (empty($row['attributes']) && !empty($row['uri'])) {
            $off = bcm_mini_sim_metadata_uri_json($row['uri'], 12);
            if ($off) {
                $row['name'] = !empty($off['name']) ? (string) $off['name'] : ($row['name'] ?? '');
                $row['image'] = !empty($off['image']) ? (string) $off['image'] : ($row['image'] ?? '');
                $row['symbol'] = !empty($off['symbol']) ? (string) $off['symbol'] : ($row['symbol'] ?? '');
                $row['attributes'] = isset($off['attributes']) && is_array($off['attributes']) ? $off['attributes'] : array();
            }
        }
        $map = bcm_mini_sim_attr_map(isset($row['attributes']) ? $row['attributes'] : array());
        $galaxy = isset($crew_catalog[$mint]) ? $crew_catalog[$mint] : null;

        $name = $galaxy && !empty($galaxy['name'])
            ? (string) $galaxy['name']
            : ((isset($row['name']) && $row['name'] !== '') ? $row['name'] : $mint);
        $symbol = isset($row['symbol']) ? (string) $row['symbol'] : '';
        $blob = strtolower($name . ' ' . $symbol . ' ' . implode(' ', array_keys($map)));

        $looks_crew = (bool) preg_match('/crew|openness|conscientiousness|extraversion|agreeableness|neuroticism|species|engineering|science|flight|command|operator|medical|fitness|hospitality/i', $blob);
        $species = $galaxy && !empty($galaxy['species'])
            ? (string) $galaxy['species']
            : (string) (bcm_mini_sim_case_trait($map, 'species') ?? bcm_mini_sim_case_trait($map, 'Species') ?? '');
        $rarity = $galaxy && !empty($galaxy['rarity'])
            ? (string) $galaxy['rarity']
            : (string) (bcm_mini_sim_case_trait($map, 'rarity') ?? '');
        if ($species !== '') {
            $looks_crew = true;
        }

        if ($looks_crew) {
            $aptitudes = array();
            foreach (array('Command', 'Flight', 'Operator', 'Engineering', 'Medical', 'Science', 'Fitness', 'Hospitality') as $apt) {
                $value = bcm_mini_sim_case_trait($map, $apt);
                if ($value !== null) {
                    $aptitudes[$apt] = (string) $value;
                }
            }
            if ($galaxy && !empty($galaxy['raw']['aptitudes']) && is_array($galaxy['raw']['aptitudes'])) {
                foreach ($galaxy['raw']['aptitudes'] as $apt => $value) {
                    $aptitudes[(string) $apt] = (string) $value;
                }
            }
            $crew[] = array(
                'id' => $mint,
                'mint' => $mint,
                'name' => $name,
                'image' => $galaxy && !empty($galaxy['image']) ? (string) $galaxy['image'] : (string) ($row['image'] ?? ''),
                'species' => $species,
                'rarity' => $rarity,
                'openness' => bcm_mini_sim_ocean_trait($map, 'openness'),
                'conscientiousness' => bcm_mini_sim_ocean_trait($map, 'conscientiousness'),
                'extraversion' => bcm_mini_sim_ocean_trait($map, 'extraversion'),
                'agreeableness' => bcm_mini_sim_ocean_trait($map, 'agreeableness'),
                'neuroticism' => bcm_mini_sim_ocean_trait($map, 'neuroticism'),
                'aptitudes' => $aptitudes,
                'source' => $galaxy ? 'solanafm+galaxy-crew' : 'solanafm-nft-metadata',
                'amount' => 1,
            );
            continue;
        }

        $kind = $galaxy && isset($galaxy['kind']) ? $galaxy['kind'] : 'nft';
        $inventory[] = array(
            'mint' => $mint,
            'name' => $name,
            'amount' => isset($hold['amount']) ? $hold['amount'] : 1,
            'kind' => $kind,
            'image' => $galaxy && !empty($galaxy['image']) ? (string) $galaxy['image'] : (string) ($row['image'] ?? ''),
            'rarity' => $rarity,
            'spec' => $galaxy && !empty($galaxy['spec']) ? (string) $galaxy['spec'] : '',
        );
    }

    if (!$crew && !$inventory && $errors) {
        return new WP_Error('bcm_mini_sim_solanafm', implode(' · ', $errors));
    }

    return array(
        'owner' => $owner,
        'items' => $crew,
        'crew' => $crew,
        'inventory' => $inventory,
        'counts' => array(
            'crew' => count($crew),
            'ship' => count(array_filter($inventory, static function($row) { return ($row['kind'] ?? '') === 'ship'; })),
            'resource' => count(array_filter($inventory, static function($row) { return ($row['kind'] ?? '') === 'resource'; })),
            'structure' => count(array_filter($inventory, static function($row) { return ($row['kind'] ?? '') === 'structure'; })),
            'nft' => count(array_filter($inventory, static function($row) { return ($row['kind'] ?? '') === 'nft'; })),
            'other' => count(array_filter($inventory, static function($row) { return !in_array(($row['kind'] ?? 'other'), array('ship','resource','structure','nft','crew'), true); })),
        ),
        'errors' => $errors,
        'source' => 'solanafm-wallet-bridge',
    );
}

function bcm_mini_sim_ajax_crew_wallet() {
    check_ajax_referer('bcm_mini_sim_crew', 'nonce');

    $owner = isset($_POST['owner']) ? sanitize_text_field(wp_unslash($_POST['owner'])) : '';
    $crew = bcm_mini_sim_server_crew_scan($owner);

    if (is_wp_error($crew)) {
        wp_send_json_error(array('message' => $crew->get_error_message()), 400);
    }

    wp_send_json_success($crew);
}

add_action('wp_ajax_bcm_mini_sim_crew_wallet', 'bcm_mini_sim_ajax_crew_wallet');
add_action('wp_ajax_nopriv_bcm_mini_sim_crew_wallet', 'bcm_mini_sim_ajax_crew_wallet');

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
    wp_enqueue_script('bcm-crew-wallet', BCM_MINI_SIM_URL . 'assets/js/crew-wallet.js', array(), BCM_MINI_SIM_VERSION, false);
    wp_enqueue_script('bcm-mini-sim', BCM_MINI_SIM_URL . 'assets/js/mini-sim.js', array('bcm-crew-wallet'), BCM_MINI_SIM_VERSION, false);
    wp_localize_script('bcm-mini-sim', 'BCMMiniSimConfig', array(
        'crewServerAjax' => admin_url('admin-ajax.php'),
        'crewServerNonce' => wp_create_nonce('bcm_mini_sim_crew'),
        'threeUrl' => BCM_MINI_SIM_URL . 'assets/js/three.min.js',
        'towerApproach' => array(
            // Preload around the actual automatic Tower gate: onicss.mp4.
            'x' => 0.0,
            'y' => -2.0,
            'z' => -260.0,
            'preloadRadius' => 120.0,
            'coverageThreshold' => 0.69,
            'uiRadius' => 180.0,
        ),
        'towerJsUrl' => BCM_MINI_SIM_URL . 'tower/assets/js/tower.js',
        'towerCssUrl' => BCM_MINI_SIM_URL . 'tower/assets/css/tower.css',
        // Prefer the real tower.mp4 from plugin assets; otherwise resolve
        // the exact filename from the WordPress Media Library.
        'towerLandingUrl' => bcm_mini_sim_pick_asset($assets, array('tower.mp4'), 'video')
            ?: bcm_mini_sim_find_media_asset('tower.mp4'),
        // Never replace the Tower landing clip with a portal video.
        'towerFallbackUrl' => '',
        'doorTexture' => $door,
        'menuBackgroundUrl' => bcm_mini_sim_pick_asset($assets, array('perference bg.png'), 'image'),
        'musicUrl' => bcm_mini_sim_pick_asset($assets, array('starbase ost.mp3', 'starbase-ost.mp3', 'ost.mp3'), 'audio'),
        'spaceVideoZones' => array(
            // Starbase exit: onicss.mp4 is placed directly in front of the ship
            // just beyond Room 2 rear exit (Z = -84.5), in open Deep Space.
            array(
                'url' => bcm_mini_sim_pick_asset($assets, array('onicss.mp4'), 'video'),
                'x' => 0,
                'y' => -2.0,
                // Deliberately far beyond the satellite and the existing space screens.
                'z' => -260.0,
                'radius' => 24,
                'preloadRadius' => 180,
                'maxWidth' => 13.0,
                'maxHeight' => 8.0,
                'preloadWhenStarted' => true,
                'towerGate' => true
            ),
            // Only one clip in the portal/open-space room.
            array('url' => 'https://walkingyog.com/wp-content/uploads/2025/11/30Сек43-1.mp4', 'x' => -4.2, 'y' => 1.4, 'z' => -42.0, 'radius' => 9, 'maxWidth' => 7.2, 'maxHeight' => 4.5),

            // The remaining clips are beyond Room 2 in the large exterior space.
            array('url' => 'https://walkingyog.com/wp-content/uploads/2025/12/Jah-Love-480P.mp4', 'x' => -18, 'y' => 7, 'z' => -105, 'radius' => 16, 'maxWidth' => 8.0, 'maxHeight' => 5.0),
            array('url' => 'https://walkingyog.com/wp-content/uploads/2026/09/i-dance-fin.mp4', 'x' => 18, 'y' => -6, 'z' => -135, 'radius' => 18, 'maxWidth' => 8.0, 'maxHeight' => 5.0),
            array('url' => 'https://walkingyog.com/wp-content/uploads/2026/09/Reshade-Rasta-Dance3.mp4', 'x' => -22, 'y' => 8, 'z' => -170, 'radius' => 20, 'maxWidth' => 8.5, 'maxHeight' => 5.2),
        ),
        'capdoorVideo' => bcm_mini_sim_pick_asset($assets, array('capdoor.mp4'), 'video'),
        'room1WallVideo' => bcm_mini_sim_pick_asset($assets, array('Wall.mp4', 'wall.mp4'), 'video'),
        'room2RightVideo' => bcm_mini_sim_pick_asset($assets, array('doorwallbotright.mp4', 'door-wallbotright.mp4'), 'video'),
        'backsideTextures' => $backside_urls,
        'crewRosterUrl' => BCM_MINI_SIM_URL . 'assets/crew-roster.json',
        'crewRosterDefaultCount' => 68,
        'assets' => $assets,
        'version' => BCM_MINI_SIM_VERSION,
    ));
}

function bcm_mini_sim_shortcode($atts = array())
{
    bcm_mini_sim_enqueue_assets();
    if (function_exists('bcm_tower_enqueue_assets')) {
        bcm_tower_enqueue_assets();
    }
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
            <div class="bcm-mini-sim-title">SPACE LABYRINTH — 0.9.46</div>
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
        <div class="bcm-mini-sim-crew-preflight" hidden>
            <div class="bcm-mini-sim-crew-preflight-card">
                <div class="bcm-mini-sim-crew-preflight-kicker">STAR ATLAS · CREW</div>
                <h2>ЭКИПАЖ ПЕРЕД ВЫЛЕТОМ</h2>
                <p class="bcm-mini-sim-crew-preflight-note">
                    Без кошелька используется двухместный Opal Jetjet. После скана число P1…Pn зависит от вместимости кораблей в инвентаре: Crew на корабле = места для игроков. Можно собрать несколько кораблей в один игровой флот.
                </p>
                <label class="bcm-mini-sim-crew-address">Публичный адрес
                    <input type="text" data-crew-address spellcheck="false" autocomplete="off" placeholder="вставьте адрес кошелька" />
                </label>
                <div class="bcm-mini-sim-crew-preflight-grid" data-crew-slots></div>
                <div class="bcm-mini-sim-crew-preflight-actions">
                    <button type="button" data-crew-scan>СКАН АДРЕСА</button>
                    <button type="button" data-crew-connect>PHANTOM</button>
                    <button type="button" data-crew-start>НАЧАТЬ ЛАБИРИНТ</button>
                </div>
                <div class="bcm-mini-sim-crew-preflight-status" aria-live="polite">
                    Команда по умолчанию — demo, пока адрес не прочитан.
                </div>
                <pre class="bcm-mini-sim-crew-diag" data-crew-diag></pre>
            </div>
        </div>
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
    if (function_exists('bcm_tower_shortcode')) {
        echo bcm_tower_shortcode(array(
            'height' => '100vh',
            'autostart' => '0',
            'embedded' => '1',
        ));
    }
    ?>
    <?php return ob_get_clean();
}

add_shortcode('bcm_mini_sim', 'bcm_mini_sim_shortcode');

// Optional Tower Toppler-style WebGL mode and texture-sheet analyzer.
// Do not bring down the whole site when Tower files are temporarily absent
// during a partial plugin upload/sync.
$tower_php = BCM_MINI_SIM_PATH . 'tower/bcm-tower.php';
if (is_readable($tower_php)) {
    require_once $tower_php;
}
add_filter('autoptimize_filter_js_exclude', function ($exclude) {
    return $exclude . ', mini-sim/assets/js/mini-sim.js, mini-sim/tower/assets/js/tower.js, three.min.js';
});
