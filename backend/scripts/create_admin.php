<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../config/database.php';

function cli_uuid_v4(): string
{
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    $hex = bin2hex($bytes);
    return sprintf('%s-%s-%s-%s-%s', substr($hex, 0, 8), substr($hex, 8, 4), substr($hex, 12, 4), substr($hex, 16, 4), substr($hex, 20, 12));
}

$options = getopt('', ['email:', 'name:']);
$email = strtolower(trim((string) ($options['email'] ?? '')));
$name = trim((string) ($options['name'] ?? ''));
$password = (string) getenv('NOVALINK_INITIAL_ADMIN_PASSWORD');

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $name === '') {
    fwrite(STDERR, "Usage: NOVALINK_INITIAL_ADMIN_PASSWORD='...' php create_admin.php --email=admin@example.com --name='Admin Name'\n");
    exit(2);
}
if (strlen($password) < 12 || strlen($password) > 128 || !preg_match('/[A-Za-z]/', $password) || !preg_match('/\d/', $password)) {
    fwrite(STDERR, "NOVALINK_INITIAL_ADMIN_PASSWORD must be 12-128 characters and include a letter and number.\n");
    exit(2);
}

try {
    $pdo = requireDbConnection();
    $exists = $pdo->prepare('SELECT user_id FROM users WHERE email = ? LIMIT 1');
    $exists->execute([$email]);
    if ($exists->fetch()) {
        fwrite(STDERR, "An account already exists for that email.\n");
        exit(1);
    }
    $id = cli_uuid_v4();
    $insert = $pdo->prepare(
        "INSERT INTO users
         (user_id, role_id, full_name, email, password_hash, account_status, email_verified, email_verified_at, force_password_change)
         VALUES (?, 1, ?, ?, ?, 'active', 1, UTC_TIMESTAMP(), 1)"
    );
    $insert->execute([$id, $name, $email, password_hash($password, PASSWORD_DEFAULT)]);
    fwrite(STDOUT, "Initial administrator created. The temporary password must be changed at first sign-in.\n");
} catch (Throwable $error) {
    fwrite(STDERR, "Administrator creation failed. Check the server log and database configuration.\n");
    error_log('NovaLink create-admin failure: ' . $error->getMessage());
    exit(1);
}
