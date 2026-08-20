<?php
// hey reader! REST API endpoint for generating and sending OTP email verification codes
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
$type = $input['type'] ?? 'registration'; // 'registration' | 'guest' | 'reset'

if (!$email) {
    http_response_code(400);
    echo json_encode(['error' => 'Valid email address is required.']);
    exit;
}

try {
    $pdo = getDbConnection();
    $emailService = new EmailService();

    // generate secure 6-digit OTP code
    $otpCode = sprintf('%06d', mt_rand(0, 999999));
    $expiresAt = date('Y-m-d H:i:s', strtotime('+15 minutes'));
    $id = sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000, mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
    );

    if ($type === 'guest') {
        $stmt = $pdo->prepare("
            INSERT INTO guest_email_verifications (guest_verification_id, guest_email, guest_name, otp_code, expires_at)
            VALUES (?, ?, ?, ?, ?)
        ");
        $stmt->execute([$id, $email, $name, $otpCode, $expiresAt]);
        $purpose = 'Guest Facility Reservation';
    } else {
        // find user if existing
        $stmt = $pdo->prepare("SELECT user_id FROM users WHERE email = ?");
        $stmt->execute([$email]);
        $user = $stmt->fetch();
        $userId = $user ? $user['user_id'] : $id;

        $stmt = $pdo->prepare("
            INSERT INTO account_email_verifications (verification_id, user_id, otp_code, token_hash, expires_at)
            VALUES (?, ?, ?, ?, ?)
        ");
        $stmt->execute([$id, $userId, $otpCode, password_hash($otpCode, PASSWORD_BCRYPT), $expiresAt]);
        $purpose = 'Account Registration Verification';
    }

    // dispatch email
    $res = $emailService->sendOtpEmail($email, $name, $otpCode, $purpose);

    echo json_encode([
        'success' => true,
        'message' => 'Verification OTP code dispatched successfully.',
        'expires_at' => $expiresAt,
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to process OTP request: ' . $e->getMessage()]);
}
