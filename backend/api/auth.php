<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/bootstrap.php';

try {
    $pdo = requireDbConnection();
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $action = (string) ($_GET['action'] ?? 'session');

    if ($method === 'GET' && $action === 'session') {
        json_response([
            'success' => true,
            'csrfToken' => csrf_token(),
            'user' => session_user($pdo),
            'guestVerified' => !empty($_SESSION['guest_profile_id']),
        ]);
    }

    if ($method !== 'POST') {
        json_response(['error' => 'Method not allowed.'], 405);
    }

    require_csrf();
    $input = json_input();
    $action = (string) ($input['action'] ?? $action);

    if ($action === 'login') {
        $email = normalize_email($input['email'] ?? '');
        $password = (string) ($input['password'] ?? '');
        $rememberMe = filter_var($input['rememberMe'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $loginRateAction = 'login:' . substr(hash('sha256', $email), 0, 32);
        enforce_rate_limit($pdo, $loginRateAction, $email, 5, 900, 900);

        $statement = $pdo->prepare(
            'SELECT u.user_id, u.password_hash, u.account_status, u.email_verified,
                    u.locked_until, u.failed_login_attempts
             FROM users u WHERE u.email = ? LIMIT 1'
        );
        $statement->execute([$email]);
        $record = $statement->fetch();

        $valid = $record && password_verify($password, (string) $record['password_hash']);
        if (!$valid) {
            if ($record) {
                $attempts = (int) $record['failed_login_attempts'] + 1;
                $lockedUntil = $attempts >= 5 ? gmdate('Y-m-d H:i:s', time() + 900) : null;
                $update = $pdo->prepare('UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE user_id = ?');
                $update->execute([$attempts, $lockedUntil, $record['user_id']]);
            }
            json_response(['error' => 'Invalid email address or password.'], 401);
        }

        if ($record['locked_until'] && strtotime($record['locked_until']) > time()) {
            json_response(['error' => 'This account is temporarily locked. Please try again later.'], 423);
        }
        if ($record['account_status'] === 'pending') {
            json_response(['error' => 'Account pending administrator approval.'], 403);
        }
        if ($record['account_status'] !== 'active') {
            json_response(['error' => 'This account is not active. Contact the NHAI office.'], 403);
        }
        if (!(bool) $record['email_verified']) {
            json_response([
                'error' => 'Verify your email address before signing in.',
                'code' => 'EMAIL_VERIFICATION_REQUIRED',
            ], 403);
        }

        session_regenerate_id(true);
        $_SESSION['user_id'] = $record['user_id'];
        $_SESSION['last_seen_at'] = time();
        $_SESSION['remember_me'] = $rememberMe;
        unset($_SESSION['guest_profile_id']);
        set_session_cookie_persistence($rememberMe);
        csrf_token();
        $update = $pdo->prepare(
            'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = UTC_TIMESTAMP() WHERE user_id = ?'
        );
        $update->execute([$record['user_id']]);
        clear_rate_limit($pdo, $loginRateAction, $email);
        audit_log($pdo, $record['user_id'], 'auth.login', 'user', $record['user_id']);
        json_response(['success' => true, 'user' => session_user($pdo), 'csrfToken' => csrf_token()]);
    }

    if ($action === 'logout') {
        $user = session_user($pdo);
        if ($user) {
            audit_log($pdo, $user['id'], 'auth.logout', 'user', $user['id']);
        }
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'] ?? '', $params['secure'], $params['httponly']);
        }
        session_destroy();
        start_secure_session();
        json_response(['success' => true, 'csrfToken' => csrf_token()]);
    }

    if ($action === 'register') {
        $email = normalize_email($input['email'] ?? '');
        $fullName = required_string($input, 'fullName', 120, 'Full name');
        $requestedAddress = required_string($input, 'requestedAddress', 190, 'Household address');
        $password = require_password($input['password'] ?? '');
        $verificationToken = required_string($input, 'verificationToken', 256, 'Verification token');

        enforce_rate_limit($pdo, 'register', $email, 3, 3600, 3600);
        $statement = $pdo->prepare(
            "SELECT token_id, action_token_hash FROM email_verification_tokens
             WHERE email = ? AND purpose = 'registration' AND verified_at IS NOT NULL
               AND consumed_at IS NULL AND expires_at > UTC_TIMESTAMP()
             ORDER BY created_at DESC LIMIT 1"
        );
        $statement->execute([$email]);
        $tokenRecord = $statement->fetch();
        if (!$tokenRecord || !password_verify($verificationToken, (string) $tokenRecord['action_token_hash'])) {
            json_response(['error' => 'Email verification is missing or expired.'], 422);
        }

        $exists = $pdo->prepare('SELECT user_id FROM users WHERE email = ? LIMIT 1');
        $exists->execute([$email]);
        if ($exists->fetch()) {
            json_response(['error' => 'An account already exists for this email address.'], 409);
        }

        $pdo->beginTransaction();
        try {
            $userId = uuid_v4();
            $insert = $pdo->prepare(
                "INSERT INTO users
                 (user_id, role_id, full_name, email, requested_address, password_hash, account_status, email_verified, email_verified_at)
                 VALUES (?, 3, ?, ?, ?, ?, 'pending', 1, UTC_TIMESTAMP())"
            );
            $insert->execute([$userId, $fullName, $email, $requestedAddress, password_hash($password, PASSWORD_DEFAULT)]);

            $consume = $pdo->prepare('UPDATE email_verification_tokens SET consumed_at = UTC_TIMESTAMP() WHERE token_id = ?');
            $consume->execute([$tokenRecord['token_id']]);

            $pdo->commit();
            clear_rate_limit($pdo, 'register', $email);
<<<<<<< HEAD
            audit_log($pdo, $userId, 'user.register', 'user', $userId, null, [
                'email' => $email,
                'requestedAddress' => $requestedAddress,
            ]);
=======
            audit_log($pdo, $userId, 'user.register', 'user', $userId, null, ['email' => $email]);
>>>>>>> c3fca0a3127f4cb2f205d5a28ea87666d4df0976
            json_response(['success' => true, 'message' => 'Registration submitted for administrator approval.'], 201);
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $error;
        }
    }

    if ($action === 'change-password') {
        $user = require_auth($pdo, [], true);
        $currentPassword = (string) ($input['currentPassword'] ?? '');
        $newPassword = require_password($input['newPassword'] ?? '');
        $statement = $pdo->prepare('SELECT password_hash FROM users WHERE user_id = ? LIMIT 1');
        $statement->execute([$user['id']]);
        $currentHash = $statement->fetchColumn();
        if (!$currentHash || !password_verify($currentPassword, (string) $currentHash)) {
            json_response(['error' => 'Current password is incorrect.'], 422);
        }
        if (password_verify($newPassword, (string) $currentHash)) {
            json_response(['error' => 'New password must be different from the current password.'], 422);
        }
        $update = $pdo->prepare(
            'UPDATE users SET password_hash = ?, force_password_change = 0, failed_login_attempts = 0, locked_until = NULL WHERE user_id = ?'
        );
        $update->execute([password_hash($newPassword, PASSWORD_DEFAULT), $user['id']]);
        session_regenerate_id(true);
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        audit_log($pdo, $user['id'], 'auth.password_change', 'user', $user['id']);
        json_response(['success' => true, 'user' => session_user($pdo), 'csrfToken' => csrf_token()]);
    }

    if ($action === 'reset-password') {
        $email = normalize_email($input['email'] ?? '');
        $password = require_password($input['password'] ?? '');
        $verificationToken = required_string($input, 'verificationToken', 256, 'Verification token');
        enforce_rate_limit($pdo, 'reset-password', $email, 5, 3600, 3600);

        $statement = $pdo->prepare(
            "SELECT token.token_id, token.action_token_hash, account.user_id
             FROM email_verification_tokens token
             JOIN users account ON account.email = token.email
             WHERE token.email = ? AND token.purpose = 'password_reset' AND token.verified_at IS NOT NULL
               AND token.consumed_at IS NULL AND token.expires_at > UTC_TIMESTAMP()
             ORDER BY token.created_at DESC LIMIT 1"
        );
        $statement->execute([$email]);
        $record = $statement->fetch();
        if (!$record || !password_verify($verificationToken, (string) $record['action_token_hash'])) {
            json_response(['error' => 'Password-reset verification is missing or expired.'], 422);
        }

        $pdo->beginTransaction();
        try {
            $update = $pdo->prepare(
                'UPDATE users SET password_hash = ?, force_password_change = 0, failed_login_attempts = 0, locked_until = NULL WHERE email = ?'
            );
            $update->execute([password_hash($password, PASSWORD_DEFAULT), $email]);
            if ($update->rowCount() !== 1) {
                throw new RuntimeException('Account could not be updated.');
            }
            $consume = $pdo->prepare('UPDATE email_verification_tokens SET consumed_at = UTC_TIMESTAMP() WHERE token_id = ?');
            $consume->execute([$record['token_id']]);
            $pdo->commit();
            clear_rate_limit($pdo, 'reset-password', $email);
            audit_log($pdo, null, 'auth.password_reset', 'user', $record['user_id'], null, ['email' => $email]);
            json_response(['success' => true, 'message' => 'Password updated successfully.']);
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $error;
        }
    }

    json_response(['error' => 'Unknown authentication action.'], 400);
} catch (Throwable $error) {
    api_exception($error);
}
