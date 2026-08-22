<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/bootstrap.php';
require_once __DIR__ . '/../lib/state_repository.php';

try {
    $pdo = requireDbConnection();
    require_auth($pdo, ['admin']);
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
        json_response([
            'error' => 'This legacy mutation endpoint has been retired. Use the protected records API.',
            'replacement' => '/backend/api/records.php',
        ], 410);
    }
    json_response(['success' => true, 'users' => fetch_users($pdo)]);
} catch (Throwable $error) {
    api_exception($error);
}
