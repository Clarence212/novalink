<?php
declare(strict_types=1);

$envFile = __DIR__ . '/env.php';
if (is_file($envFile)) {
    require_once $envFile;
}

function config_value(string $constant, ?string $environment = null, ?string $default = null): ?string
{
    if (defined($constant)) {
        return (string) constant($constant);
    }

    $name = $environment ?? $constant;
    $value = getenv($name);
    return $value === false ? $default : (string) $value;
}

function getDbConnection(): ?PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $host = config_value('DB_HOST', 'NOVALINK_DB_HOST', '127.0.0.1');
    $port = config_value('DB_PORT', 'NOVALINK_DB_PORT', '3306');
    $name = config_value('DB_NAME', 'NOVALINK_DB_NAME', 'novalink_db');
    $user = config_value('DB_USER', 'NOVALINK_DB_USER');
    $pass = config_value('DB_PASS', 'NOVALINK_DB_PASS');

    if ($user === null || $pass === null) {
        error_log('NovaLink database credentials are not configured.');
        return null;
    }

    try {
        $dsn = "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4";
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_STRINGIFY_FETCHES => false,
        ]);
        $pdo->exec("SET time_zone = '+00:00'");
        $pdo->exec("SET SESSION sql_mode = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION,ONLY_FULL_GROUP_BY'");
        return $pdo;
    } catch (PDOException $error) {
        error_log('NovaLink database connection failed: ' . $error->getMessage());
        return null;
    }
}

function requireDbConnection(): PDO
{
    $pdo = getDbConnection();
    if (!$pdo) {
        throw new RuntimeException('Database service unavailable.');
    }
    return $pdo;
}
