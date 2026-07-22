<?php

declare(strict_types=1);

final class NfAuth
{
    private string $secret;

    public function __construct(string $secret)
    {
        $this->secret = $secret;
    }

    public function issue(array $user): string
    {
        $payload = [
            'id' => $user['id'],
            'email' => $user['email'],
            'name' => $user['name'],
            'role' => $user['role'],
            'exp' => time() + 60 * 60 * 24 * 7,
        ];
        $body = $this->b64(json_encode($payload, JSON_UNESCAPED_SLASHES));
        $sig = $this->b64(hash_hmac('sha256', $body, $this->secret, true));
        return $body . '.' . $sig;
    }

    public function verify(?string $token): ?array
    {
        if (!$token || !str_contains($token, '.')) {
            return null;
        }
        [$body, $sig] = explode('.', $token, 2);
        $expected = $this->b64(hash_hmac('sha256', $body, $this->secret, true));
        if (!hash_equals($expected, $sig)) {
            return null;
        }
        $json = json_decode($this->ub64($body), true);
        if (!is_array($json) || ($json['exp'] ?? 0) < time()) {
            return null;
        }
        return $json;
    }

    public function bearerUser(): ?array
    {
        $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
        if (!preg_match('/Bearer\s+(\S+)/i', $header, $m)) {
            return null;
        }
        return $this->verify($m[1]);
    }

    private function b64(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private function ub64(string $data): string
    {
        $remainder = strlen($data) % 4;
        if ($remainder) {
            $data .= str_repeat('=', 4 - $remainder);
        }
        return base64_decode(strtr($data, '-_', '+/')) ?: '';
    }
}
