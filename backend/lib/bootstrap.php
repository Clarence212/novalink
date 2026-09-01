<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';

const NOVALINK_MAX_JSON_BYTES = 1_048_576;

function request_id(): string
{
    static $requestId = null;
    if ($requestId === null) {
        $requestId = bin2hex(random_bytes(12));
    }
    return $requestId;
}

function record_application_error(Throwable $error, string $severity = 'error'): string
{
    $record = [
        'timestamp' => gmdate(DATE_ATOM),
        'severity' => $severity,
        'requestId' => request_id(),
        'exception' => get_class($error),
        'message' => mb_substr($error->getMessage(), 0, 2000),
        'file' => basename($error->getFile()),
        'line' => $error->getLine(),
        'method' => substr((string) ($_SERVER['REQUEST_METHOD'] ?? PHP_SAPI), 0, 12),
        'path' => substr((string) (parse_url((string) ($_SERVER['REQUEST_URI'] ?? ''), PHP_URL_PATH) ?: ''), 0, 255),
    ];
    $encoded = json_encode($record, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($encoded === false) {
        $encoded = '{"severity":"error","message":"Application error could not be encoded."}';
    }
    $configuredPath = config_value('ERROR_LOG_PATH', 'NOVALINK_ERROR_LOG_PATH', '');
    if ($configuredPath !== '') {
        $directory = dirname($configuredPath);
        if (is_dir($directory) && is_writable($directory) && error_log($encoded . PHP_EOL, 3, $configuredPath)) {
            return $record['requestId'];
        }
    }
    error_log('NovaLink application error ' . $encoded);
    return $record['requestId'];
}

function is_https_request(): bool
{
    if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
        return true;
    }
    return strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
}

function configure_http_headers(): void
{
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, max-age=0');
    header('Pragma: no-cache');
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: no-referrer');
    header("Permissions-Policy: camera=(), microphone=(), geolocation=()");
    header('X-Request-ID: ' . request_id());

    $origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
    $configured = config_value('APP_ORIGIN', 'NOVALINK_APP_ORIGIN', '');
    $allowedOrigins = array_values(array_filter(array_map('trim', explode(',', (string) $configured))));
    if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');
        header('Access-Control-Allow-Methods: GET, POST, PATCH, OPTIONS');
        header('Vary: Origin');
    }

    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
        if ($origin !== '' && !in_array($origin, $allowedOrigins, true)) {
            json_response(['error' => 'Origin is not allowed.'], 403);
        }
        http_response_code(204);
        exit;
    }
}

function start_secure_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    session_name(config_value('SESSION_NAME', 'NOVALINK_SESSION_NAME', 'novalink_session'));
    $sessionPath = config_value('SESSION_SAVE_PATH', 'NOVALINK_SESSION_SAVE_PATH', '');
    if ($sessionPath !== '' && is_dir($sessionPath) && is_writable($sessionPath)) {
        session_save_path($sessionPath);
    }
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => is_https_request(),
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.cookie_httponly', '1');
    session_start();

    $now = time();
    $lastSeen = (int) ($_SESSION['last_seen_at'] ?? 0);
    if ($lastSeen > 0 && ($now - $lastSeen) > 1800) {
        $_SESSION = [];
        session_regenerate_id(true);
    }
    $_SESSION['last_seen_at'] = $now;
}

function json_response(array $payload, int $status = 200): void
{
    if ($status >= 400 && !isset($payload['requestId'])) {
        $payload['requestId'] = request_id();
    }
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function json_input(): array
{
    $length = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($length > NOVALINK_MAX_JSON_BYTES) {
        json_response(['error' => 'Request body is too large.'], 413);
    }

    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    try {
        $decoded = json_decode($raw, true, 64, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        json_response(['error' => 'Request body must be valid JSON.'], 400);
    }

    if (!is_array($decoded)) {
        json_response(['error' => 'Request body must be a JSON object.'], 400);
    }
    return $decoded;
}

function request_data(): array
{
    $contentType = strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? ''));
    return str_contains($contentType, 'multipart/form-data') ? $_POST : json_input();
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return (string) $_SESSION['csrf_token'];
}

function require_csrf(): void
{
    $provided = (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if ($provided === '' || !hash_equals(csrf_token(), $provided)) {
        json_response(['error' => 'Security token is missing or invalid. Refresh the page and try again.'], 419);
    }
}

function uuid_v4(): string
{
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    $hex = bin2hex($bytes);
    return sprintf('%s-%s-%s-%s-%s',
        substr($hex, 0, 8), substr($hex, 8, 4), substr($hex, 12, 4),
        substr($hex, 16, 4), substr($hex, 20, 12)
    );
}

function normalize_email(mixed $value): string
{
    $email = strtolower(trim((string) $value));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 190) {
        json_response(['error' => 'A valid email address is required.'], 422);
    }
    return $email;
}

function required_string(array $input, string $key, int $maxLength, ?string $label = null): string
{
    $value = trim((string) ($input[$key] ?? ''));
    if ($value === '') {
        json_response(['error' => ($label ?? $key) . ' is required.'], 422);
    }
    if (mb_strlen($value) > $maxLength) {
        json_response(['error' => ($label ?? $key) . " must not exceed {$maxLength} characters."], 422);
    }
    return $value;
}

function optional_string(array $input, string $key, int $maxLength): ?string
{
    $value = trim((string) ($input[$key] ?? ''));
    if ($value === '') {
        return null;
    }
    if (mb_strlen($value) > $maxLength) {
        json_response(['error' => "{$key} must not exceed {$maxLength} characters."], 422);
    }
    return $value;
}

function require_choice(array $input, string $key, array $allowed): string
{
    $value = (string) ($input[$key] ?? '');
    if (!in_array($value, $allowed, true)) {
        json_response(['error' => "Invalid {$key}."], 422);
    }
    return $value;
}

function require_password(mixed $value): string
{
    $password = (string) $value;
    if (strlen($password) < 12 || strlen($password) > 128) {
        json_response(['error' => 'Password must contain between 12 and 128 characters.'], 422);
    }
    if (!preg_match('/[A-Za-z]/', $password) || !preg_match('/\d/', $password)) {
        json_response(['error' => 'Password must contain at least one letter and one number.'], 422);
    }
    return $password;
}

function client_ip(): string
{
    return substr((string) ($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45);
}

function session_user(PDO $pdo): ?array
{
    $userId = (string) ($_SESSION['user_id'] ?? '');
    if ($userId === '') {
        return null;
    }

    $statement = $pdo->prepare(
        "SELECT u.user_id AS id, r.role_name AS role, u.full_name AS fullName,
                u.email, u.account_status AS status, u.email_verified AS emailVerified,
                u.force_password_change AS forcePasswordChange,
                h.homeowner_id AS homeownerId
         FROM users u
         JOIN roles r ON r.role_id = u.role_id
         LEFT JOIN homeowners h ON h.user_id = u.user_id AND h.record_status = 'active'
         WHERE u.user_id = ? LIMIT 1"
    );
    $statement->execute([$userId]);
    $user = $statement->fetch();
    if (!$user || $user['status'] !== 'active') {
        unset($_SESSION['user_id']);
        return null;
    }
    $user['emailVerified'] = (bool) $user['emailVerified'];
    $user['forcePasswordChange'] = (bool) $user['forcePasswordChange'];
    return $user;
}

function require_auth(PDO $pdo, array $roles = [], bool $allowForcedPasswordChange = false): array
{
    $user = session_user($pdo);
    if (!$user) {
        json_response(['error' => 'Authentication required.'], 401);
    }
    if ($roles && !in_array($user['role'], $roles, true)) {
        json_response(['error' => 'You do not have permission to perform this action.'], 403);
    }
    if ($user['forcePasswordChange'] && !$allowForcedPasswordChange) {
        json_response(['error' => 'Change the temporary password before accessing NovaLink.'], 403);
    }
    return $user;
}

function audit_log(PDO $pdo, ?string $actorId, string $action, string $entityType, ?string $entityId, mixed $before = null, mixed $after = null): void
{
    try {
        $statement = $pdo->prepare(
            'INSERT INTO audit_logs
             (actor_user_id, action_name, entity_type, entity_id, before_json, after_json, ip_address, user_agent)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $statement->execute([
            $actorId,
            $action,
            $entityType,
            $entityId,
            $before === null ? null : json_encode($before, JSON_UNESCAPED_UNICODE),
            $after === null ? null : json_encode($after, JSON_UNESCAPED_UNICODE),
            client_ip(),
            substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255),
        ]);
    } catch (Throwable $error) {
        error_log('NovaLink audit log failure: ' . $error->getMessage());
    }
}

function enforce_rate_limit(PDO $pdo, string $action, string $identifier, int $limit, int $windowSeconds, int $blockSeconds): void
{
    $key = hash('sha256', $action . '|' . client_ip() . '|' . strtolower($identifier));
    $pdo->beginTransaction();
    try {
        $statement = $pdo->prepare('SELECT * FROM rate_limits WHERE rate_key = ? FOR UPDATE');
        $statement->execute([$key]);
        $row = $statement->fetch();
        $now = time();

        if ($row && $row['blocked_until'] && strtotime($row['blocked_until']) > $now) {
            $pdo->commit();
            json_response(['error' => 'Too many attempts. Please try again later.'], 429);
        }

        $windowExpired = !$row || (strtotime($row['window_started_at']) + $windowSeconds) <= $now;
        $attempts = $windowExpired ? 1 : ((int) $row['attempts'] + 1);
        $windowStart = $windowExpired ? gmdate('Y-m-d H:i:s') : $row['window_started_at'];
        $blockedUntil = $attempts > $limit ? gmdate('Y-m-d H:i:s', $now + $blockSeconds) : null;

        $upsert = $pdo->prepare(
            'INSERT INTO rate_limits (rate_key, action_name, attempts, window_started_at, blocked_until)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE action_name = VALUES(action_name), attempts = VALUES(attempts),
                 window_started_at = VALUES(window_started_at), blocked_until = VALUES(blocked_until)'
        );
        $upsert->execute([$key, $action, $attempts, $windowStart, $blockedUntil]);
        $pdo->commit();

        if ($blockedUntil !== null) {
            json_response(['error' => 'Too many attempts. Please try again later.'], 429);
        }
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }
}

function clear_rate_limit(PDO $pdo, string $action, string $identifier): void
{
    $key = hash('sha256', $action . '|' . client_ip() . '|' . strtolower($identifier));
    $statement = $pdo->prepare('DELETE FROM rate_limits WHERE rate_key = ?');
    $statement->execute([$key]);
}

function api_exception(Throwable $error): void
{
    $requestId = record_application_error($error);
    $environment = config_value('APP_ENV', 'NOVALINK_APP_ENV', 'production');
    $message = $environment === 'development' ? $error->getMessage() : 'An unexpected server error occurred.';
    json_response(['error' => $message, 'requestId' => $requestId], 500);
}

function register_fatal_error_monitor(): void
{
    register_shutdown_function(static function (): void {
        $lastError = error_get_last();
        if (!$lastError || !in_array($lastError['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
            return;
        }
        record_application_error(
            new ErrorException(
                (string) $lastError['message'],
                0,
                (int) $lastError['type'],
                (string) $lastError['file'],
                (int) $lastError['line']
            ),
            'fatal'
        );
    });
}

configure_http_headers();
start_secure_session();
register_fatal_error_monitor();
