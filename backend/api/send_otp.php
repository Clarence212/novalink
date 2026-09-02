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
    $input = json_input();
    $email = normalize_email($input['email'] ?? '');
    $type = require_choice($input, 'type', ['registration', 'reset', 'guest']);
    $purpose = $type === 'reset' ? 'password_reset' : $type;
    $name = trim((string) ($input['name'] ?? 'User'));
    $contactNumber = trim((string) ($input['contactNumber'] ?? ''));
    $blockLot = trim((string) ($input['blockLot'] ?? ''));
    if ($name === '' || mb_strlen($name) > 120) {
        $name = 'User';
    }
    if (mb_strlen($contactNumber) > 30) {
        json_response(['error' => 'Contact number is too long.'], 422);
    }
    if ($purpose === 'guest') {
        $name = required_string($input, 'name', 120, 'Full name');
        $contactNumber = required_string($input, 'contactNumber', 30, 'Contact number');
    }

    enforce_rate_limit($pdo, 'otp-send-' . $purpose, $email, 3, 900, 1800);

    if ($purpose === 'registration') {
        $check = $pdo->prepare('SELECT user_id FROM users WHERE email = ? LIMIT 1');
        $check->execute([$email]);
        if ($check->fetch()) {
            json_response(['error' => 'An account already exists for this email address.'], 409);
        }
        if ($blockLot === '' || mb_strlen($blockLot) > 100) {
            json_response(['error' => 'Enter the block and lot recorded with NHAI.'], 422);
        }
        $blockLotKey = strtolower((string) preg_replace('/[^a-z0-9]+/i', '', $blockLot));
        if ($blockLotKey === '') {
            json_response(['error' => 'Block and lot must contain letters or numbers.'], 422);
        }
        $homeowner = $pdo->prepare(
            "SELECT homeowner_id FROM homeowners
             WHERE email = ?
               AND REGEXP_REPLACE(LOWER(block_lot), '[^a-z0-9]', '') = ?
               AND user_id IS NULL AND record_status = 'active' LIMIT 1"
        );
        $homeowner->execute([$email, $blockLotKey]);
        if (!$homeowner->fetchColumn()) {
            json_response([
                'error' => 'The email and block/lot do not match the current NHAI homeowner record. Check the details or contact the office before requesting a code.',
                'code' => 'HOMEOWNER_DETAILS_MISMATCH',
            ], 422);
        }
    }

    if ($purpose === 'password_reset') {
        $check = $pdo->prepare("SELECT user_id, full_name FROM users WHERE email = ? AND account_status <> 'rejected' LIMIT 1");
        $check->execute([$email]);
        $user = $check->fetch();
        if (!$user) {
            // Do not disclose whether an account exists.
            json_response(['success' => true, 'message' => 'If the address is registered, a verification code will be sent.']);
        }
        $name = $user['full_name'];
    }

    $code = (string) random_int(100000, 999999);
    $tokenId = uuid_v4();
    $statement = $pdo->prepare(
        'INSERT INTO email_verification_tokens
         (token_id, email, full_name, contact_number, purpose, code_hash, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 15 MINUTE))'
    );
    $statement->execute([
        $tokenId,
        $email,
        $name,
        $contactNumber !== '' ? $contactNumber : null,
        $purpose,
        password_hash($code, PASSWORD_DEFAULT),
    ]);

    $label = match ($purpose) {
        'password_reset' => 'Password Reset',
        'guest' => 'Guest Facility Reservation',
        default => 'Resident Registration',
    };
    $result = (new EmailService($pdo))->sendOtpEmail($email, $name, $code, $label);
    if (!$result['success']) {
        json_response(['error' => 'Verification email could not be delivered. Please try again later.'], 502);
    }

    audit_log($pdo, null, 'otp.request', 'email_verification_token', $tokenId, null, ['purpose' => $purpose, 'email' => $email]);
    json_response(['success' => true, 'message' => 'Verification code sent.']);
} catch (Throwable $error) {
    api_exception($error);
}
