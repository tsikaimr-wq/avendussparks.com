<?php
declare(strict_types=1);

function market_api_headers(): void
{
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
}

function market_api_exit_json(int $status, array $payload): void
{
    market_api_headers();
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function market_api_upstream_base(): string
{
    $envBase = getenv('MARKET_API_UPSTREAM_BASE');
    if (is_string($envBase) && trim($envBase) !== '') {
        return rtrim(trim($envBase), '/');
    }

    return 'https://api.avendussparks.com';
}

function market_api_extract_status(array $headers): int
{
    foreach ($headers as $header) {
        if (preg_match('/^HTTP\/\S+\s+(\d{3})/i', (string) $header, $matches)) {
            return (int) $matches[1];
        }
    }

    return 502;
}

function market_api_extract_content_type(array $headers): string
{
    foreach ($headers as $header) {
        if (stripos((string) $header, 'Content-Type:') === 0) {
            return trim(substr((string) $header, strlen('Content-Type:')));
        }
    }

    return 'application/json; charset=utf-8';
}

function market_api_request(string $url): array
{
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT => 20,
            CURLOPT_CONNECTTIMEOUT => 8,
            CURLOPT_HTTPHEADER => [
                'Accept: application/json',
                'User-Agent: AvendusMarketProxy/1.0',
            ],
            CURLOPT_HEADER => true,
        ]);

        $response = curl_exec($ch);
        if ($response === false) {
            $message = curl_error($ch) ?: 'upstream fetch failed';
            curl_close($ch);
            return [
                'status' => 502,
                'content_type' => 'application/json; charset=utf-8',
                'body' => json_encode([
                    'success' => false,
                    'message' => $message,
                ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            ];
        }

        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $headerSize = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        $contentType = (string) curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
        $headersRaw = substr($response, 0, $headerSize);
        $body = substr($response, $headerSize);
        curl_close($ch);

        $headerLines = preg_split("/\r\n|\n|\r/", $headersRaw) ?: [];

        return [
            'status' => $status > 0 ? $status : market_api_extract_status($headerLines),
            'content_type' => $contentType !== '' ? $contentType : market_api_extract_content_type($headerLines),
            'body' => is_string($body) ? $body : '',
        ];
    }

    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => 20,
            'ignore_errors' => true,
            'header' => implode("\r\n", [
                'Accept: application/json',
                'User-Agent: AvendusMarketProxy/1.0',
            ]),
        ],
    ]);

    $body = @file_get_contents($url, false, $context);
    $headers = isset($http_response_header) && is_array($http_response_header) ? $http_response_header : [];

    return [
        'status' => market_api_extract_status($headers),
        'content_type' => market_api_extract_content_type($headers),
        'body' => is_string($body) ? $body : '',
    ];
}

function market_api_forward(string $path, array $allowedQueryKeys, bool $requireSymbol = true): void
{
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        market_api_headers();
        http_response_code(204);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        market_api_exit_json(405, [
            'success' => false,
            'message' => 'Method not allowed',
        ]);
    }

    $query = [];
    foreach ($allowedQueryKeys as $key) {
        if (!isset($_GET[$key])) {
            continue;
        }

        $value = trim((string) $_GET[$key]);
        if ($value === '') {
            continue;
        }

        $query[$key] = $value;
    }

    if ($requireSymbol && (!isset($query['symbol']) || $query['symbol'] === '')) {
        market_api_exit_json(400, [
            'success' => false,
            'message' => 'Missing symbol',
        ]);
    }

    $url = market_api_upstream_base() . $path;
    if ($query) {
        $url .= '?' . http_build_query($query);
    }

    $result = market_api_request($url);

    market_api_headers();
    http_response_code((int) ($result['status'] ?? 502));
    header('Content-Type: ' . (string) ($result['content_type'] ?? 'application/json; charset=utf-8'));

    $body = (string) ($result['body'] ?? '');
    if ($body === '') {
        echo json_encode([
            'success' => false,
            'message' => 'Upstream market API unavailable',
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        exit;
    }

    echo $body;
    exit;
}
