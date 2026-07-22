<?php
/**
 * NerdzFactory Opportunities CMS — PHP (no Node required)
 *
 * Upload this folder to: public_html/nf-cms/
 * Put store.json at:     public_html/nf-cms/data/store.json
 * Put dist-admin files:  public_html/admin/
 * Uploads folder:        public_html/uploads/opportunities/ (writable)
 *
 * .htaccess (above WordPress):
 *   RewriteRule ^api/(.*)$ /nf-cms/index.php?nf_path=api/$1 [L,QSA]
 *   RewriteRule ^uploads/opportunities/(.*)$ - [L]
 */

declare(strict_types=1);

require __DIR__ . '/lib/helpers.php';
require __DIR__ . '/lib/Store.php';
require __DIR__ . '/lib/Auth.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Headers: Authorization, Content-Type, X-HTTP-Method-Override');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    http_response_code(204);
    exit;
}

$configFile = __DIR__ . '/config.php';
$exampleFile = __DIR__ . '/config.example.php';

if (!is_file($configFile) && is_file($exampleFile)) {
    // First deploy: create config.php automatically from the example
    if (!@copy($exampleFile, $configFile)) {
        nf_json([
            'error' => 'Missing config.php and could not auto-create it. In File Manager, rename config.example.php to config.php inside public_html/nf-cms/',
        ], 500);
    }
}

if (!is_file($configFile)) {
    nf_json([
        'error' => 'Missing config.php — in File Manager open public_html/nf-cms/ and rename config.example.php to config.php',
    ], 500);
}

$config = require $configFile;
$store = new NfStore($config);
$auth = new NfAuth((string) $config['JWT_SECRET']);

$path = isset($_GET['nf_path']) ? (string) $_GET['nf_path'] : '';
$path = trim($path, '/');

// Fallback: derive path from REQUEST_URI when rewrite does not pass nf_path
if ($path === '' || !str_starts_with($path, 'api/')) {
    $uri = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?: '';
    $uri = rawurldecode($uri);
    if (preg_match('#/(api/.*)$#', $uri, $um)) {
        $path = trim($um[1], '/');
    }
}

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
// Shared hosts often block PUT/DELETE — allow override via query or header
$override = $_GET['_method'] ?? $_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE'] ?? '';
if (is_string($override) && $override !== '') {
    $method = strtoupper($override);
}

$CATEGORIES = ['Grant', 'Fellowship', 'Internship', 'Training', 'Accelerator', 'Competition', 'Scholarship', 'Other'];
$LOCATIONS = ['Remote', 'Nigeria', 'Africa', 'Global'];

function map_row(array $row, NfStore $store): array
{
    $data = $store->read();
    $author = null;
    foreach ($data['users'] as $u) {
        if (($u['id'] ?? '') === ($row['created_by'] ?? null)) {
            $author = $u['name'] ?? null;
            break;
        }
    }
    $row['featured'] = !empty($row['featured']);
    $row['tags'] = $row['tags'] ?? [];
    $row['author_name'] = $author;
    if (!empty($row['image'])) {
        $row['image'] = nf_public_url((string) $row['image']);
    }
    return $row;
}

function nf_public_url(string $url): string
{
    if ($url === '' || preg_match('#^https?://#i', $url)) {
        return $url;
    }
    if ($url[0] !== '/') {
        $url = '/' . $url;
    }
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https')
        || (($_SERVER['SERVER_PORT'] ?? '') === '443');
    $scheme = $https ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'nerdzfactory.org';
    return $scheme . '://' . $host . $url;
}

function nf_normalize_choice(?string $value, array $allowed, string $fallback): string
{
    $value = trim((string) $value);
    foreach ($allowed as $opt) {
        if (strcasecmp($opt, $value) === 0) {
            return $opt;
        }
    }
    return $fallback;
}

function nf_valid_apply_url(string $apply): bool
{
    if ($apply === '' || $apply === '#') {
        return false;
    }
    return (bool) preg_match('#^https?://#i', $apply) || str_starts_with($apply, 'mailto:');
}

function require_user(NfAuth $auth): array
{
    $user = $auth->bearerUser();
    if (!$user) {
        nf_json([
            'error' => 'Unauthorized — log out and sign in again. If it keeps failing, add Authorization pass-through to .htaccess (see DEPLOY-PHP.txt).',
        ], 401);
    }
    return $user;
}

// ---------- routes ----------

if ($path === 'api/health' && $method === 'GET') {
    nf_json(['status' => 'ok', 'service' => 'nerdzfactory-opportunities-cms-php']);
}

if ($path === 'api/opportunities/meta' && $method === 'GET') {
    $data = $store->read();
    $published = array_values(array_filter(
        $data['opportunities'],
        static fn($o) => ($o['status'] ?? '') === 'published'
    ));
    $counts = [];
    foreach ($published as $o) {
        $cat = $o['category'] ?? 'Other';
        $counts[$cat] = ($counts[$cat] ?? 0) + 1;
    }
    nf_json([
        'categories' => $CATEGORIES,
        'locations' => $LOCATIONS,
        'categoryCounts' => $counts,
        'totalPublished' => count($published),
    ]);
}

if ($path === 'api/auth/login' && $method === 'POST') {
    $body = nf_read_json_body();
    $email = strtolower(trim((string) ($body['email'] ?? '')));
    $password = (string) ($body['password'] ?? '');
    if ($email === '' || $password === '') {
        nf_json(['error' => 'Email and password are required'], 400);
    }
    $data = $store->read();
    $user = null;
    foreach ($data['users'] as $u) {
        if (($u['email'] ?? '') === $email) {
            $user = $u;
            break;
        }
    }
    if (!$user || !password_verify($password, $user['password_hash'] ?? '')) {
        nf_json(['error' => 'Invalid email or password'], 401);
    }
    nf_json([
        'token' => $auth->issue($user),
        'user' => [
            'id' => $user['id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'role' => $user['role'],
        ],
    ]);
}

if ($path === 'api/auth/me' && $method === 'GET') {
    $tokenUser = require_user($auth);
    $data = $store->read();
    foreach ($data['users'] as $u) {
        if ($u['id'] === $tokenUser['id']) {
            nf_json([
                'id' => $u['id'],
                'name' => $u['name'],
                'email' => $u['email'],
                'role' => $u['role'],
                'created_at' => $u['created_at'] ?? null,
            ]);
        }
    }
    nf_json(['error' => 'User not found'], 404);
}

if ($path === 'api/auth/users' && $method === 'GET') {
    $tokenUser = require_user($auth);
    if (($tokenUser['role'] ?? '') !== 'admin') {
        nf_json(['error' => 'Admin access required'], 403);
    }
    $users = array_map(static function ($u) {
        unset($u['password_hash']);
        return $u;
    }, $store->read()['users']);
    usort($users, static fn($a, $b) => strcmp($b['created_at'] ?? '', $a['created_at'] ?? ''));
    nf_json($users);
}

if ($path === 'api/auth/register' && $method === 'POST') {
    $tokenUser = require_user($auth);
    if (($tokenUser['role'] ?? '') !== 'admin') {
        nf_json(['error' => 'Only admins can create users'], 403);
    }
    $body = nf_read_json_body();
    $name = trim((string) ($body['name'] ?? ''));
    $email = strtolower(trim((string) ($body['email'] ?? '')));
    $password = (string) ($body['password'] ?? '');
    if ($name === '' || $email === '' || $password === '') {
        nf_json(['error' => 'Name, email, and password are required'], 400);
    }
    if (strlen($password) < 8) {
        nf_json(['error' => 'Password must be at least 8 characters'], 400);
    }
    $data = $store->read();
    foreach ($data['users'] as $u) {
        if (($u['email'] ?? '') === $email) {
            nf_json(['error' => 'Email already registered'], 409);
        }
    }
    $user = [
        'id' => nf_uuid(),
        'name' => $name,
        'email' => $email,
        'password_hash' => password_hash($password, PASSWORD_BCRYPT),
        'role' => (($body['role'] ?? '') === 'admin') ? 'admin' : 'editor',
        'created_at' => gmdate('c'),
    ];
    $data['users'][] = $user;
    $store->write($data);
    nf_json(['id' => $user['id'], 'name' => $user['name'], 'email' => $user['email'], 'role' => $user['role']], 201);
}

if ($path === 'api/uploads' && $method === 'POST') {
    require_user($auth);
    if (empty($_FILES['image']) || !is_uploaded_file($_FILES['image']['tmp_name'])) {
        nf_json(['error' => 'No image file provided'], 400);
    }
    $file = $_FILES['image'];
    $mime = mime_content_type($file['tmp_name']) ?: '';
    if (!preg_match('#^image/(jpeg|png|webp|gif)#i', $mime)) {
        nf_json(['error' => 'Only image files (JPEG, PNG, WebP, GIF) are allowed'], 400);
    }
    $dir = $config['UPLOAD_DIR'];
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
    $ext = 'jpg';
    if (stripos($mime, 'png') !== false) {
        $ext = 'png';
    } elseif (stripos($mime, 'webp') !== false) {
        $ext = 'webp';
    } elseif (stripos($mime, 'gif') !== false) {
        $ext = 'gif';
    }
    $filename = nf_uuid() . '.' . $ext;
    $dest = rtrim($dir, '/\\') . DIRECTORY_SEPARATOR . $filename;
    if (!move_uploaded_file($file['tmp_name'], $dest)) {
        nf_json(['error' => 'Failed to save image'], 500);
    }
    $url = rtrim((string) $config['UPLOAD_URL'], '/') . '/' . $filename;
    nf_json(['url' => nf_public_url($url), 'filename' => $filename], 201);
}

// opportunities collection
if ($path === 'api/opportunities' && $method === 'GET') {
    $page = max(1, (int) ($_GET['page'] ?? 1));
    $limit = min(100, max(1, (int) ($_GET['limit'] ?? 12)));
    $category = $_GET['category'] ?? null;
    $search = trim((string) ($_GET['search'] ?? ''));
    $featured = $_GET['featured'] ?? null;
    $admin = ($_GET['admin'] ?? '') === 'true';

    $data = $store->read();
    $items = $data['opportunities'];

    $canAdmin = $admin && $auth->bearerUser();
    if (!$canAdmin) {
        $items = array_values(array_filter($items, static fn($o) => ($o['status'] ?? '') === 'published'));
    }
    if ($category && $category !== 'all') {
        $items = array_values(array_filter($items, static fn($o) => ($o['category'] ?? '') === $category));
    }
    if ($featured === 'true') {
        $items = array_values(array_filter($items, static fn($o) => !empty($o['featured'])));
    }
    if ($search !== '') {
        $q = strtolower($search);
        $items = array_values(array_filter($items, static function ($o) use ($q) {
            $hay = strtolower(
                ($o['title'] ?? '') . ' ' . ($o['summary'] ?? '') . ' ' . ($o['content'] ?? '') . ' ' . implode(' ', $o['tags'] ?? [])
            );
            return str_contains($hay, $q);
        }));
    }

    usort($items, static function ($a, $b) {
        // Newest posted first (created_at), ignore featured for ordering
        $ad = strtotime((string) ($a['created_at'] ?? $a['published_at'] ?? '')) ?: 0;
        $bd = strtotime((string) ($b['created_at'] ?? $b['published_at'] ?? '')) ?: 0;
        if ($ad === $bd) {
            return strcmp((string) ($b['id'] ?? ''), (string) ($a['id'] ?? ''));
        }
        return $bd <=> $ad;
    });

    $total = count($items);
    $slice = array_slice($items, ($page - 1) * $limit, $limit);
    nf_json([
        'data' => array_map(static fn($r) => map_row($r, $store), $slice),
        'pagination' => [
            'page' => $page,
            'limit' => $limit,
            'total' => $total,
            'totalPages' => max(1, (int) ceil($total / $limit)),
        ],
    ]);
}

if ($path === 'api/opportunities' && $method === 'POST') {
    $user = require_user($auth);
    $body = nf_read_json_body();
    $title = trim((string) ($body['title'] ?? ''));
    $apply = trim((string) ($body['apply_url'] ?? ''));
    if ($title === '') {
        nf_json(['error' => 'Title is required'], 400);
    }
    $status = ($body['status'] ?? 'draft') === 'published' ? 'published' : 'draft';
    if ($status === 'published' && !nf_valid_apply_url($apply)) {
        nf_json(['error' => 'Apply URL must start with http://, https://, or mailto:'], 400);
    }
    if ($apply === '') {
        $apply = '#';
    } elseif ($apply !== '#' && !nf_valid_apply_url($apply)) {
        nf_json(['error' => 'Apply URL must start with http://, https://, or mailto:'], 400);
    }

    $data = $store->read();
    $slug = trim((string) ($body['slug'] ?? ''));
    $slug = $slug !== '' ? nf_slugify($slug) : nf_slugify($title);
    $slug = nf_unique_slug($slug, $data['opportunities']);
    $now = gmdate('c');

    $row = [
        'id' => nf_uuid(),
        'slug' => $slug,
        'title' => $title,
        'summary' => trim((string) ($body['summary'] ?? '')),
        'content' => (string) ($body['content'] ?? ''),
        'apply_url' => $apply,
        'category' => nf_normalize_choice($body['category'] ?? null, $CATEGORIES, 'Other'),
        'location' => nf_normalize_choice($body['location'] ?? null, $LOCATIONS, 'Global'),
        'deadline' => ($body['deadline'] ?? '') ?: null,
        'tags' => is_array($body['tags'] ?? null) ? $body['tags'] : [],
        'featured' => !empty($body['featured']),
        'status' => $status,
        'image' => ($body['image'] ?? '') ?: null,
        'image_alt' => trim((string) ($body['image_alt'] ?? $title)),
        'created_by' => $user['id'],
        'created_at' => $now,
        'updated_at' => $now,
        'published_at' => $status === 'published' ? $now : null,
    ];
    $data['opportunities'][] = $row;
    $store->write($data);
    nf_json(map_row($row, $store), 201);
}

if (preg_match('#^api/opportunities/by-slug/([^/]+)$#', $path, $m) && $method === 'GET') {
    $slug = urldecode($m[1]);
    $data = $store->read();
    foreach ($data['opportunities'] as $o) {
        if (($o['slug'] ?? '') === $slug) {
            if (($o['status'] ?? '') !== 'published' && !$auth->bearerUser()) {
                nf_json(['error' => 'Not found'], 404);
            }
            nf_json(map_row($o, $store));
        }
    }
    nf_json(['error' => 'Not found'], 404);
}

if (preg_match('#^api/opportunities/([^/]+)$#', $path, $m)) {
    $id = $m[1];
    $data = $store->read();
    $idx = null;
    foreach ($data['opportunities'] as $i => $o) {
        if (($o['id'] ?? '') === $id || ($o['slug'] ?? '') === $id) {
            $idx = $i;
            break;
        }
    }
    if ($idx === null) {
        nf_json(['error' => 'Not found'], 404);
    }
    $row = $data['opportunities'][$idx];

    if ($method === 'GET') {
        if (($row['status'] ?? '') !== 'published' && !$auth->bearerUser()) {
            nf_json(['error' => 'Not found'], 404);
        }
        nf_json(map_row($row, $store));
    }

    if ($method === 'PUT') {
        require_user($auth);
        $body = nf_read_json_body();
        $title = array_key_exists('title', $body) ? trim((string) $body['title']) : $row['title'];
        if ($title === '') {
            nf_json(['error' => 'Title is required'], 400);
        }
        $nextStatus = array_key_exists('status', $body)
            ? (($body['status'] === 'published') ? 'published' : 'draft')
            : ($row['status'] ?? 'draft');

        if (array_key_exists('apply_url', $body)) {
            $apply = trim((string) $body['apply_url']);
            if ($apply === '') {
                $apply = '#';
            }
            if ($nextStatus === 'published' && !nf_valid_apply_url($apply)) {
                nf_json(['error' => 'Apply URL must start with http://, https://, or mailto:'], 400);
            }
            if ($apply !== '#' && !nf_valid_apply_url($apply)) {
                nf_json(['error' => 'Apply URL must start with http://, https://, or mailto:'], 400);
            }
            $row['apply_url'] = $apply;
        } elseif ($nextStatus === 'published' && !nf_valid_apply_url((string) ($row['apply_url'] ?? ''))) {
            nf_json(['error' => 'Apply URL must start with http://, https://, or mailto:'], 400);
        }

        $row['title'] = $title;
        if (array_key_exists('summary', $body)) {
            $row['summary'] = trim((string) $body['summary']);
        }
        if (array_key_exists('content', $body)) {
            $row['content'] = (string) $body['content'];
        }
        if (array_key_exists('category', $body)) {
            $row['category'] = nf_normalize_choice($body['category'] ?? null, $CATEGORIES, $row['category'] ?? 'Other');
        }
        if (array_key_exists('location', $body)) {
            $row['location'] = nf_normalize_choice($body['location'] ?? null, $LOCATIONS, $row['location'] ?? 'Global');
        }
        if (array_key_exists('deadline', $body)) {
            $row['deadline'] = $body['deadline'] !== '' ? $body['deadline'] : null;
        }
        if (array_key_exists('tags', $body)) {
            $row['tags'] = is_array($body['tags']) ? $body['tags'] : [];
        }
        if (array_key_exists('featured', $body)) {
            $row['featured'] = !empty($body['featured']);
        }
        if (array_key_exists('image', $body)) {
            $row['image'] = $body['image'] !== '' ? $body['image'] : null;
        }
        if (array_key_exists('image_alt', $body)) {
            $row['image_alt'] = trim((string) $body['image_alt']) ?: $title;
        }
        $row['status'] = $nextStatus;
        if (array_key_exists('slug', $body) && trim((string) $body['slug']) !== '') {
            $row['slug'] = nf_unique_slug(nf_slugify((string) $body['slug']), $data['opportunities'], $row['id']);
        } elseif (($row['slug'] ?? '') === '') {
            $row['slug'] = nf_unique_slug(nf_slugify($title), $data['opportunities'], $row['id']);
        }
        if (($row['status'] ?? '') === 'published' && empty($row['published_at'])) {
            $row['published_at'] = gmdate('c');
        }
        if (($row['status'] ?? '') === 'draft') {
            $row['published_at'] = null;
        }
        $row['updated_at'] = gmdate('c');
        $data['opportunities'][$idx] = $row;
        $store->write($data);
        nf_json(map_row($row, $store));
    }

    if ($method === 'DELETE') {
        require_user($auth);
        array_splice($data['opportunities'], $idx, 1);
        $store->write($data);
        nf_json(['success' => true]);
    }
}

nf_json(['error' => 'Not found', 'path' => $path], 404);
