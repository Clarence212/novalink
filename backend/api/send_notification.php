<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/bootstrap.php';
require_once __DIR__ . '/../services/EmailService.php';

try {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
        json_response(['error' => 'Method not allowed.'], 405);
    }
    require_csrf();
    $pdo = requireDbConnection();
    $actor = require_auth($pdo, ['admin']);
    enforce_rate_limit($pdo, 'manual-notification', $actor['id'], 20, 3600, 3600);
    $input = json_input();
    $email = normalize_email($input['email'] ?? '');
    $name = required_string($input, 'name', 120, 'Recipient name');
    $title = required_string($input, 'title', 200, 'Title');
    $message = required_string($input, 'message', 10000, 'Message');
    $result = (new EmailService($pdo))->sendNotification($email, $name, $title, $message, 'manual_admin_notification');
    audit_log($pdo, $actor['id'], 'notification.send', 'notification', $result['notificationId'] ?? null, null, ['recipient' => $email]);
    json_response(['success' => (bool) ($result['success'] ?? false)]);
} catch (Throwable $error) {
    api_exception($error);
}
