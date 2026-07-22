<?php
/**
 * NerdzFactory CMS proxy for cPanel (no mod_proxy required).
 *
 * Upload to: public_html/nf-proxy.php
 * Config:    public_html/nf-proxy-config.php  (copy from nf-proxy-config.example.php)
 *
 * Wire in public_html/.htaccess ABOVE WordPress:
 *
 *   RewriteRule ^api/(.*)$ /nf-proxy.php?nf_path=api/$1 [L,QSA]
 *   RewriteRule ^uploads/(.*)$ /nf-proxy.php?nf_path=uploads/$1 [L,QSA]
 *   RewriteRule ^admin/?$ /nf-proxy.php?nf_path=admin [L,QSA]
 *   RewriteRule ^admin/(.*)$ /nf-proxy.php?nf_path=admin/$1 [L,QSA]
 */

declare(strict_types=1);

$configFile = __DIR__ . '/nf-proxy-config.php';
if (!is_file($configFile)) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'error' => 'Missing nf-proxy-config.php. Copy nf-proxy-config.example.php and set CMS_ORIGIN.',
    ]);
    exit;
}

/** @var array{CMS_ORIGIN: string} $config */
$config = require $configFile;
$origin = rtrim((string) ($config['CMS_ORIGIN'] ?? ''), '/');

if ($origin === '') {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'CMS_ORIGIN is empty in nf-proxy-config.php']);
    exit;
}

$path = isset($_GET['nf_path']) ? (string) $_GET['nf_path'] : '';
$path = ltrim($path, '/');

if ($path === '' || !preg_match('#^(api|admin|uploads)(/|$)#', $path)) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Invalid proxy path']);
    exit;
}

$query = $_GET;
unset($query['nf_path']);
$qs = http_build_query($query);
$target = $origin . '/' . $path . ($qs !== '' ? ('?' . $qs) : '');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$headers = [];

foreach ($_SERVER as $key => $value) {
    if (strpos($key, 'HTTP_') !== 0) {
        continue;
    }
    $name = str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($key, 5)))));
    if (in_array(strtolower($name), ['host', 'content-length', 'connection'], true)) {
        continue;
    }
    $headers[] = $name . ': ' . $value;
}

if (!empty($_SERVER['CONTENT_TYPE'])) {
    $headers[] = 'Content-Type: ' . $_SERVER['CONTENT_TYPE'];
}

$body = null;
if (!in_array($method, ['GET', 'HEAD'], true)) {
    $body = file_get_contents('php://input');
}

$ch = curl_init($target);
curl_setopt_array($ch, [
    CURLOPT_CUSTOMREQUEST => $method,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HEADER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_TIMEOUT => 60,
    CURLOPT_HTTPHEADER => $headers,
    CURLOPT_POSTFIELDS => $body,
]);

$response = curl_exec($ch);
if ($response === false) {
    $err = curl_error($ch);
    curl_close($ch);
    http_response_code(502);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'CMS proxy failed', 'detail' => $err, 'target' => $target]);
    exit;
}

$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
curl_close($ch);

$rawHeaders = substr($response, 0, $headerSize);
$rawBody = substr($response, $headerSize);

http_response_code($status);

foreach (explode("\r\n", $rawHeaders) as $line) {
    if ($line === '' || stripos($line, 'HTTP/') === 0) {
        continue;
    }
    $lower = strtolower($line);
    if (
        str_starts_with($lower, 'transfer-encoding:') ||
        str_starts_with($lower, 'connection:') ||
        str_starts_with($lower, 'content-length:')
    ) {
        continue;
    }
    header($line, false);
}

echo $rawBody;
