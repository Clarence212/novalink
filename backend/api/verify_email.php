<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/bootstrap.php';

try {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
        json_response(['error' => 'Method not allowed.'], 405);
    }
    require_csrf();
    $pdo = requireDbConnection();
    $input = json_input();
    $email = normalize_email($input['email'] ?? '');
    $code = required_string($input, 'otp', 10, 'Verification code');
    if (!preg_match('/^\d{6}$/', $code)) {
        json_response(['error' => 'Verification code must contain six digits.'], 422);
    }
    $type = require_choice($input, 'type', ['registration', 'reset', 'guest']);
    $purpose = $type === 'reset' ? 'password_reset' : $type;

    enforce_rate_limit($pdo, 'otp-verify-' . $purpose, $email, 8, 900, 1800);
    $statement = $pdo->prepare(
        'SELECT token_id, full_name, contact_number, code_hash, attempt_count
         FROM email_verification_tokens
         WHERE email = ? AND purpose = ? AND verified_at IS NULL AND consumed_at IS NULL
           AND expires_at > UTC_TIMESTAMP()
         ORDER BY created_at DESC LIMIT 1'
    );
    $statement->execute([$email, $purpose]);
    $record = $statement->fetch();

    if (!$record || (int) $record['attempt_count'] >= 5 || !password_verify($code, (string) $record['code_hash'])) {
        if ($record) {
            $update = $pdo->prepare('UPDATE email_verification_tokens SET attempt_count = attempt_count + 1 WHERE token_id = ?');
            $update->execute([$record['token_id']]);
        }
        json_response(['error' => 'Invalid or expired verification code.'], 422);
    }

    if ($purpose === 'registration') {
        $existing = $pdo->prepare('SELECT user_id, email_verified FROM users WHERE email = ? LIMIT 1');
        $existing->execute([$email]);
        $existingAccount = $existing->fetch();
        if ($existingAccount) {
            if ((bool) $existingAccount['email_verified']) {
                json_response(['error' => 'This account email is already verified.'], 409);
            }
            $pdo->beginTransaction();
            try {
                $consume = $pdo->prepare(
                    'UPDATE email_verification_tokens
                     SET verified_at = UTC_TIMESTAMP(), consumed_at = UTC_TIMESTAMP(), attempt_count = attempt_count + 1
                     WHERE token_id = ? AND consumed_at IS NULL'
                );
                $consume->execute([$record['token_id']]);
                if ($consume->rowCount() !== 1) {
                    throw new RuntimeException('The verification code was already used.');
                }
                $verifyAccount = $pdo->prepare(
                    'UPDATE users SET email_verified = 1, email_verified_at = UTC_TIMESTAMP()
                     WHERE user_id = ? AND email_verified = 0'
                );
                $verifyAccount->execute([$existingAccount['user_id']]);
                if ($verifyAccount->rowCount() !== 1) {
                    throw new RuntimeException('The account email could not be verified.');
                }
                $pdo->commit();
            } catch (Throwable $error) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $error;
            }
            clear_rate_limit($pdo, 'otp-verify-' . $purpose, $email);
            audit_log($pdo, null, 'user.email_verified', 'user', $existingAccount['user_id'], ['emailVerified' => false], ['emailVerified' => true]);
            audit_log($pdo, null, 'otp.verify', 'email_verification_token', $record['token_id'], null, ['purpose' => $purpose, 'email' => $email]);
            json_response([
                'success' => true,
                'message' => 'Account email verified successfully. You can now sign in once the account is active.',
                'accountVerified' => true,
            ]);
        }
    }

    $actionToken = bin2hex(random_bytes(32));
    $update = $pdo->prepare(
        'UPDATE email_verification_tokens
         SET verified_at = UTC_TIMESTAMP(), action_token_hash = ?, attempt_count = attempt_count + 1
         WHERE token_id = ?'
    );
    $update->execute([password_hash($actionToken, PASSWORD_DEFAULT), $record['token_id']]);
    clear_rate_limit($pdo, 'otp-verify-' . $purpose, $email);

    $response = ['success' => true, 'message' => 'Email verified successfully.'];
    if ($purpose === 'guest') {
        session_regenerate_id(true);
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        $guestId = uuid_v4();
        $insert = $pdo->prepare(
            'INSERT INTO guest_profiles (guest_id, full_name, email, contact_number, email_verified_at)
             VALUES (?, ?, ?, ?, UTC_TIMESTAMP())'
        );
        $insert->execute([
            $guestId,
            $record['full_name'] ?: 'Guest',
            $email,
            $record['contact_number'] ?: '',
        ]);
        $_SESSION['guest_profile_id'] = $guestId;
        $_SESSION['guest_verified_at'] = time();
        $consume = $pdo->prepare('UPDATE email_verification_tokens SET consumed_at = UTC_TIMESTAMP() WHERE token_id = ?');
        $consume->execute([$record['token_id']]);
        $response['guestVerified'] = true;
        $response['csrfToken'] = csrf_token();
    } else {
        $response['verificationToken'] = $actionToken;
    }

    audit_log($pdo, null, 'otp.verify', 'email_verification_token', $record['token_id'], null, ['purpose' => $purpose, 'email' => $email]);
    json_response($response);
} catch (Throwable $error) {
    api_exception($error);
}
