<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../services/EmailService.php';

$input = json_decode(file_get_contents('php://input'), true);

$email = filter_var($input['email'] ?? '', FILTER_VALIDATE_EMAIL);
$name = trim($input['name'] ?? 'User');
$title = trim($input['title'] ?? 'NovaLink Notification');
$message = trim($input['message'] ?? '');

if (!$email) {
    http_response_code(400);
    echo json_encode(['error' => 'Valid email address is required.']);
    exit;
}

try {
    // getDbConnection handles failure silently for local testing thanks to our earlier fix
    $pdo = getDbConnection();
    $emailService = new EmailService();

    // Reusing the announcement broadcast format for general system notifications
    $res = $emailService->sendAnnouncementBroadcast($email, $title, $message, 'SYSTEM');

    echo json_encode([
        'success' => true,
        'message' => 'Notification email dispatched successfully.'
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to process notification request: ' . $e->getMessage()]);
}
