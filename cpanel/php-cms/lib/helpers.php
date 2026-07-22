<?php

declare(strict_types=1);

function nf_json($data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Headers: Authorization, Content-Type, X-HTTP-Method-Override');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function nf_read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function nf_slugify(string $title): string
{
    $slug = strtolower(trim($title));
    $slug = preg_replace('/[^a-z0-9]+/', '-', $slug) ?? '';
    $slug = trim($slug, '-');
    return substr($slug, 0, 80) ?: 'opportunity';
}

function nf_unique_slug(string $base, array $opportunities, ?string $excludeId = null): string
{
    $root = $base !== '' ? $base : 'opportunity';
    $slug = $root;
    $n = 1;
    while (true) {
        $exists = false;
        foreach ($opportunities as $o) {
            if (($o['slug'] ?? '') === $slug && ($excludeId === null || ($o['id'] ?? '') !== $excludeId)) {
                $exists = true;
                break;
            }
        }
        if (!$exists) {
            return $slug;
        }
        $slug = $root . '-' . $n;
        $n++;
    }
}

function nf_uuid(): string
{
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}
