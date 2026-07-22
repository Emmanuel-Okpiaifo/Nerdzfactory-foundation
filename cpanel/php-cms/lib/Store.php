<?php

declare(strict_types=1);

final class NfStore
{
    private string $file;
    private array $config;

    public function __construct(array $config)
    {
        $this->config = $config;
        $this->file = $config['DATA_FILE'];
        $dir = dirname($this->file);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        if (!is_file($this->file)) {
            $this->write([
                'users' => [],
                'opportunities' => [],
            ]);
        }
        $this->ensureAdmin();
    }

    public function read(): array
    {
        $raw = file_get_contents($this->file);
        $data = json_decode($raw ?: '{}', true);
        if (!is_array($data)) {
            $data = ['users' => [], 'opportunities' => []];
        }
        $data['users'] = $data['users'] ?? [];
        $data['opportunities'] = $data['opportunities'] ?? [];
        return $data;
    }

    public function write(array $data): void
    {
        $tmp = $this->file . '.tmp';
        $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if ($json === false) {
            throw new RuntimeException('Failed to encode store');
        }
        if (file_put_contents($tmp, $json, LOCK_EX) === false) {
            throw new RuntimeException('Failed to write store');
        }
        rename($tmp, $this->file);
    }

    private function ensureAdmin(): void
    {
        $data = $this->read();
        if (count($data['users']) > 0) {
            return;
        }
        $email = strtolower((string) ($this->config['BOOTSTRAP_ADMIN_EMAIL'] ?? 'admin@nerdzfactory.org'));
        $password = (string) ($this->config['BOOTSTRAP_ADMIN_PASSWORD'] ?? 'changeme123');
        $name = (string) ($this->config['BOOTSTRAP_ADMIN_NAME'] ?? 'Admin');
        $data['users'][] = [
            'id' => nf_uuid(),
            'name' => $name,
            'email' => $email,
            'password_hash' => password_hash($password, PASSWORD_BCRYPT),
            'role' => 'admin',
            'created_at' => gmdate('c'),
        ];
        $this->write($data);
    }
}
