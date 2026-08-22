<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/bootstrap.php';

try {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
        json_response(['error' => 'Method not allowed.'], 405);
    }
    $pdo = requireDbConnection();
    $pdo->query('SELECT 1')->fetchColumn();
    $migration = $pdo->query('SELECT migration_id FROM schema_migrations ORDER BY applied_at DESC LIMIT 1')->fetchColumn();
    json_response([
        'status' => 'ok',
        'database' => 'ok',
        'schema' => $migration ?: 'unknown',
        'time' => gmdate(DATE_ATOM),
    ]);
} catch (Throwable $error) {
    api_exception($error);
}
