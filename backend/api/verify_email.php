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

$input = json_decode(file_get_contents('php://input'), true);

$email = filter_var($input['email'] ?? '', FILTER_VALIDATE_EMAIL);
$otpCode = trim($input['otp'] ?? '');
$type = $input['type'] ?? 'registration'; 

if (!$email || !$otpCode) {
    http_response_code(400);
    echo json_encode(['error' => 'Email and OTP code are required.']);
    exit;
}

try {
    $pdo = getDbConnection();

    if (!$pdo) {
        http_response_code(503);
        echo json_encode(['error' => 'Database connection unavailable. Please try again later.']);
        exit;
    }

    if ($type === 'guest') {
        $stmt = $pdo->prepare("
            SELECT guest_verification_id, expires_at, verified_at
            FROM guest_email_verifications
            WHERE guest_email = ? AND otp_code = ? AND verified_at IS NULL
            ORDER BY created_at DESC LIMIT 1
        ");
        $stmt->execute([$email, $otpCode]);
        $record = $stmt->fetch();

        if (!$record) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid or expired verification code.']);
            exit;
        }

        if (strtotime($record['expires_at']) < time()) {
            http_response_code(400);
            echo json_encode(['error' => 'Verification code has expired. Please request a new code.']);
            exit;
        }

        
        $stmt = $pdo->prepare("UPDATE guest_email_verifications SET verified_at = NOW() WHERE guest_verification_id = ?");
        $stmt->execute([$record['guest_verification_id']]);

    } else {
        $stmt = $pdo->prepare("
            SELECT v.verification_id, v.user_id, v.expires_at
            FROM account_email_verifications v
            JOIN users u ON u.user_id = v.user_id
            WHERE u.email = ? AND v.otp_code = ? AND v.verified_at IS NULL
            ORDER BY v.created_at DESC LIMIT 1
        ");
        $stmt->execute([$email, $otpCode]);
        $record = $stmt->fetch();

        if (!$record) {
            // Fallback to check guest_email_verifications for new registrations
            $stmt = $pdo->prepare("
                SELECT guest_verification_id, expires_at, verified_at
                FROM guest_email_verifications
                WHERE guest_email = ? AND otp_code = ? AND verified_at IS NULL
                ORDER BY created_at DESC LIMIT 1
            ");
            $stmt->execute([$email, $otpCode]);
            $guestRecord = $stmt->fetch();

            if (!$guestRecord) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid or expired verification code.']);
                exit;
            }

            if (strtotime($guestRecord['expires_at']) < time()) {
                http_response_code(400);
                echo json_encode(['error' => 'Verification code has expired. Please request a new code.']);
                exit;
            }

            $stmt = $pdo->prepare("UPDATE guest_email_verifications SET verified_at = NOW() WHERE guest_verification_id = ?");
            $stmt->execute([$guestRecord['guest_verification_id']]);

            // Persist verified registration directly to database
            $checkUser = $pdo->prepare("SELECT user_id FROM users WHERE email = ?");
            $checkUser->execute([$email]);
            if (!$checkUser->fetch()) {
                $userId = sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
                    mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff),
                    mt_rand(0, 0x0fff) | 0x4000, mt_rand(0, 0x3fff) | 0x8000,
                    mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
                );
                $fullName = !empty($guestRecord['guest_name']) ? $guestRecord['guest_name'] : 'Resident User';
                $passwordHash = password_hash('novalink2026', PASSWORD_BCRYPT);
                $ins = $pdo->prepare("
                    INSERT INTO users (user_id, role_id, full_name, email, password_hash, account_status, email_verified, email_verified_at)
                    VALUES (?, 3, ?, ?, ?, 'pending', 1, NOW())
                ");
                $ins->execute([$userId, $fullName, $email, $passwordHash]);
            }
        } else {
            if (strtotime($record['expires_at']) < time()) {
                http_response_code(400);
                echo json_encode(['error' => 'Verification code has expired. Please request a new code.']);
                exit;
            }

            $stmt = $pdo->prepare("UPDATE account_email_verifications SET verified_at = NOW() WHERE verification_id = ?");
            $stmt->execute([$record['verification_id']]);

            $stmt = $pdo->prepare("UPDATE users SET email_verified = 1, email_verified_at = NOW() WHERE user_id = ?");
            $stmt->execute([$record['user_id']]);
        }
    }

    echo json_encode([
        'success' => true,
        'message' => 'Email verified successfully.'
    ]);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'An unexpected server error occurred: ' . $e->getMessage()]);
}
