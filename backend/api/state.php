<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/bootstrap.php';
require_once __DIR__ . '/../lib/state_repository.php';

try {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
        json_response(['error' => 'Method not allowed.'], 405);
    }
    $pdo = requireDbConnection();

    if (($_GET['scope'] ?? '') === 'public') {
        json_response(['success' => true, 'facilities' => fetch_facilities($pdo, false, true)]);
    }

    $user = require_auth($pdo);
    json_response(['success' => true, 'state' => fetch_application_state($pdo, $user)]);
} catch (Throwable $error) {
    api_exception($error);
}
