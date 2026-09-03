<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/bootstrap.php';
require_once __DIR__ . '/../lib/state_repository.php';
require_once __DIR__ . '/../services/EmailService.php';

function homeowner_for_user(PDO $pdo, string $userId): array
{
    $statement = $pdo->prepare(
        "SELECT h.homeowner_id AS id, h.owner_name AS ownerName, h.email
         FROM homeowner_user_links hul
         JOIN homeowners h ON h.homeowner_id = hul.homeowner_id
         WHERE hul.user_id = ? AND h.record_status = 'active' LIMIT 1"
    );
    $statement->execute([$userId]);
    $homeowner = $statement->fetch();
    if (!$homeowner) {
        json_response(['error' => 'Your account is not linked to an active homeowner record. Contact the NHAI office.'], 409);
    }
    return $homeowner;
}

function safe_notification(PDO $pdo, string $email, string $name, string $subject, string $message, string $type): bool
{
    try {
        $result = (new EmailService($pdo))->sendNotification($email, $name, $subject, $message, $type);
        return (bool) ($result['success'] ?? false);
    } catch (Throwable $error) {
        error_log('NovaLink notification failure: ' . $error->getMessage());
        return false;
    }
}

function fetch_row(PDO $pdo, string $sql, array $params): ?array
{
    $statement = $pdo->prepare($sql);
    $statement->execute($params);
    $row = $statement->fetch();
    return $row ?: null;
}

function required_audit_log(
    PDO $pdo,
    ?string $actorId,
    string $action,
    string $entityType,
    ?string $entityId,
    mixed $before = null,
    mixed $after = null
): void {
    $statement = $pdo->prepare(
        'INSERT INTO audit_logs
         (actor_user_id, action_name, entity_type, entity_id, before_json, after_json, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $statement->execute([
        $actorId,
        $action,
        $entityType,
        $entityId,
        $before === null ? null : json_encode($before, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
        $after === null ? null : json_encode($after, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
        client_ip(),
        substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255),
    ]);
}

function normalized_block_lot(string $value): string
{
    return strtolower((string) preg_replace('/[^a-z0-9]+/i', '', trim($value)));
}

function require_iso_date(array $input, string $key): string
{
    $value = required_string($input, $key, 10, $key);
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value, new DateTimeZone('UTC'));
    if (!$date || $date->format('Y-m-d') !== $value) {
        json_response(['error' => "{$key} must use YYYY-MM-DD format."], 422);
    }
    return $value;
}

function validated_occupants(array $input): array
{
    $occupants = $input['occupants'] ?? [];
    if (!is_array($occupants) || count($occupants) > 20) {
        json_response(['error' => 'Occupants must be a list of no more than 20 people.'], 422);
    }
    $validated = [];
    foreach ($occupants as $occupant) {
        if (!is_array($occupant)) {
            json_response(['error' => 'Each occupant must include a name and relationship.'], 422);
        }
        $validated[] = [
            'fullName' => required_string($occupant, 'fullName', 120, 'Occupant name'),
            'relationship' => required_string($occupant, 'relationship', 60, 'Occupant relationship'),
        ];
    }
    return $validated;
}

function create_sticker_number(PDO $pdo, string $period): string
{
    for ($attempt = 0; $attempt < 10; $attempt++) {
        $year = preg_replace('/\D+/', '', explode('-', $period)[0] ?? gmdate('Y')) ?: gmdate('Y');
        $number = 'NVL-' . $year . '-' . str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $check = $pdo->prepare('SELECT renewal_id FROM vehicle_sticker_renewals WHERE sticker_number = ? LIMIT 1');
        $check->execute([$number]);
        if (!$check->fetch()) {
            return $number;
        }
    }
    throw new RuntimeException('Could not generate a unique sticker number.');
}

function create_visitor_pass_code(PDO $pdo): string
{
    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for ($attempt = 0; $attempt < 12; $attempt++) {
        $suffix = '';
        for ($index = 0; $index < 8; $index++) {
            $suffix .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        }
        $code = 'NVL-' . $suffix;
        $check = $pdo->prepare('SELECT visitor_pass_id FROM visitor_passes WHERE pass_code = ? LIMIT 1');
        $check->execute([$code]);
        if (!$check->fetch()) {
            return $code;
        }
    }
    throw new RuntimeException('A unique visitor pass could not be generated.');
}

function required_visitor_pass_code(array $input): string
{
    $code = strtoupper(required_string($input, 'passCode', 20, 'Visitor pass code'));
    $code = preg_replace('/\s+/', '', $code) ?? '';
    if (!preg_match('/^NVL-[A-HJ-NP-Z2-9]{8}$/', $code)) {
        json_response(['error' => 'Enter a valid visitor pass code in the format NVL-XXXXXXXX.'], 422);
    }
    return $code;
}

function payment_amount_cents(mixed $value): int
{
    if (!is_numeric($value)) {
        json_response(['error' => 'Enter a valid payment amount.'], 422);
    }
    $cents = (int) round((float) $value * 100);
    if ($cents <= 0 || $cents > 100_000_000) {
        json_response(['error' => 'Enter a valid payment amount.'], 422);
    }
    return $cents;
}

function store_payment_proof(): array
{
    if (!isset($_FILES['proof']) || $_FILES['proof']['error'] !== UPLOAD_ERR_OK) {
        json_response(['error' => 'A payment-proof image is required.'], 422);
    }
    $file = $_FILES['proof'];
    if ((int) $file['size'] <= 0 || (int) $file['size'] > 5_242_880) {
        json_response(['error' => 'Payment proof must be no larger than 5 MB.'], 422);
    }
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = (string) $finfo->file($file['tmp_name']);
    $extensions = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
    if (!isset($extensions[$mime])) {
        json_response(['error' => 'Payment proof must be a JPEG, PNG, or WebP image.'], 422);
    }
    $storage = __DIR__ . '/../storage/payment-proofs';
    if (!is_dir($storage) && !mkdir($storage, 0750, true) && !is_dir($storage)) {
        throw new RuntimeException('Payment-proof storage is unavailable.');
    }
    $storedName = bin2hex(random_bytes(24)) . '.' . $extensions[$mime];
    $target = $storage . '/' . $storedName;
    if (!move_uploaded_file($file['tmp_name'], $target)) {
        throw new RuntimeException('Payment proof could not be stored.');
    }
    return [
        'storedName' => $storedName,
        'originalName' => basename((string) $file['name']),
        'mime' => $mime,
        'size' => (int) $file['size'],
        'target' => $target,
    ];
}

function allocate_payment_credit(PDO $pdo, string $paymentId, string $homeownerId, int $creditCents): array
{
    $dues = $pdo->prepare(
        "SELECT dues_id, amount_due, penalty_amount FROM dues
         WHERE homeowner_id = ? AND status = 'unpaid' ORDER BY billing_month FOR UPDATE"
    );
    $dues->execute([$homeownerId]);
    $allocated = $pdo->prepare(
        'SELECT COALESCE(SUM(amount_applied), 0) FROM payment_allocations WHERE dues_id = ?'
    );
    $allocation = $pdo->prepare(
        'INSERT INTO payment_allocations (allocation_id, payment_id, dues_id, amount_applied)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE amount_applied = amount_applied + VALUES(amount_applied)'
    );
    $markPaid = $pdo->prepare("UPDATE dues SET status = 'paid' WHERE dues_id = ?");
    $remainingCents = $creditCents;
    $paidCount = 0;
    $allocationCount = 0;
    foreach ($dues->fetchAll() as $due) {
        if ($remainingCents <= 0) {
            break;
        }
        $allocated->execute([$due['dues_id']]);
        $requiredCents = max(0, (int) round(
            ((float) $due['amount_due'] + (float) $due['penalty_amount'] - (float) $allocated->fetchColumn()) * 100
        ));
        if ($requiredCents <= 0) {
            $markPaid->execute([$due['dues_id']]);
            continue;
        }
        $appliedCents = min($remainingCents, $requiredCents);
        $allocation->execute([uuid_v4(), $paymentId, $due['dues_id'], $appliedCents / 100]);
        $allocationCount++;
        if ($appliedCents >= $requiredCents) {
            $markPaid->execute([$due['dues_id']]);
            $paidCount++;
        }
        $remainingCents -= $appliedCents;
    }
    return [
        'remainingCents' => $remainingCents,
        'paidCount' => $paidCount,
        'allocationCount' => $allocationCount,
    ];
}

try {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
        json_response(['error' => 'Method not allowed.'], 405);
    }
    require_csrf();
    $pdo = requireDbConnection();
    $input = request_data();
    $resource = (string) ($input['resource'] ?? '');
    $action = (string) ($input['action'] ?? '');

    if ($resource === 'users') {
        $actor = require_auth($pdo, ['admin']);

        if ($action === 'create') {
            $fullName = required_string($input, 'fullName', 120, 'Full name');
            $email = normalize_email($input['email'] ?? '');
            $role = require_choice($input, 'role', ['admin', 'security', 'resident']);
            $password = require_password($input['password'] ?? '');
            $homeownerId = optional_string($input, 'homeownerId', 36);
            $roleMap = ['admin' => 1, 'security' => 2, 'resident' => 3];
            $exists = fetch_row($pdo, 'SELECT user_id FROM users WHERE email = ? LIMIT 1', [$email]);
            if ($exists) {
                json_response(['error' => 'An account already exists for this email address.'], 409);
            }

            $pdo->beginTransaction();
            try {
                $id = uuid_v4();
                $insert = $pdo->prepare(
                    "INSERT INTO users
                     (user_id, role_id, full_name, email, password_hash, account_status, email_verified,
                      email_verified_at, approved_by_user_id, approved_at, force_password_change)
                     VALUES (?, ?, ?, ?, ?, 'active', 1, UTC_TIMESTAMP(), ?, UTC_TIMESTAMP(), 1)"
                );
                $insert->execute([$id, $roleMap[$role], $fullName, $email, password_hash($password, PASSWORD_DEFAULT), $actor['id']]);
                if ($role === 'resident' && $homeownerId) {
                    $link = $pdo->prepare(
                        "INSERT INTO homeowner_user_links (homeowner_id, user_id, linked_by_user_id)
                         SELECT homeowner_id, ?, ? FROM homeowners
                         WHERE homeowner_id = ? AND record_status = 'active'"
                    );
                    $link->execute([$id, $actor['id'], $homeownerId]);
                    if ($link->rowCount() !== 1) {
                        throw new RuntimeException('The selected homeowner record is unavailable.');
                    }
                }
                $pdo->commit();
                audit_log($pdo, $actor['id'], 'user.create', 'user', $id, null, ['email' => $email, 'role' => $role]);
                $mailSent = safe_notification(
                    $pdo, $email, $fullName, 'Your NovaLink account is ready',
                    'An NHAI administrator created your account. Sign in with the password provided to you through an approved private channel. You will be asked to change it.',
                    'account_created'
                );
                json_response(['success' => true, 'id' => $id, 'emailDelivered' => $mailSent], 201);
            } catch (Throwable $error) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $error;
            }
        }

        if ($action === 'status') {
            $id = required_string($input, 'id', 36, 'User ID');
            $status = require_choice($input, 'status', ['active', 'rejected', 'inactive']);
            $reason = $status === 'active' ? null : required_string($input, 'reason', 500, 'Reason');
            if ($id === $actor['id'] && $status !== 'active') {
                json_response(['error' => 'You cannot deactivate your own active session.'], 422);
            }

            $pdo->beginTransaction();
            try {
                $before = fetch_row(
                    $pdo,
                    "SELECT u.user_id AS id, u.email, u.full_name AS fullName,
                            u.account_status AS status, r.role_name AS role
                     FROM users u JOIN roles r ON r.role_id = u.role_id
                     WHERE u.user_id = ? LIMIT 1 FOR UPDATE",
                    [$id]
                );
                if (!$before) {
                    $pdo->rollBack();
                    json_response(['error' => 'User not found.'], 404);
                }
                if ($status === 'active' && $before['role'] === 'resident') {
                    $homeownerLink = fetch_row(
                        $pdo,
                        "SELECT hul.homeowner_id FROM homeowner_user_links hul
                         JOIN homeowners h ON h.homeowner_id = hul.homeowner_id AND h.record_status = 'active'
                         WHERE hul.user_id = ? LIMIT 1",
                        [$id]
                    );
                }
                if ($before['role'] === 'admin' && $before['status'] === 'active' && $status !== 'active') {
                    $activeAdmins = $pdo->query(
                        "SELECT u.user_id FROM users u JOIN roles r ON r.role_id = u.role_id
                         WHERE r.role_name = 'admin' AND u.account_status = 'active' FOR UPDATE"
                    )->fetchAll();
                    if (count($activeAdmins) <= 1) {
                        $pdo->rollBack();
                        json_response(['error' => 'The last active administrator cannot be deactivated or rejected.'], 422);
                    }
                }
                $update = $pdo->prepare(
                    'UPDATE users SET account_status = ?, approved_by_user_id = ?, approved_at = CASE WHEN ? = \'active\' THEN UTC_TIMESTAMP() ELSE approved_at END WHERE user_id = ?'
                );
                $update->execute([$status, $actor['id'], $status, $id]);
                $pdo->commit();
            } catch (Throwable $error) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $error;
            }
            audit_log($pdo, $actor['id'], 'user.status', 'user', $id, $before, ['status' => $status, 'reason' => $reason]);
            $mailSent = safe_notification(
                $pdo, $before['email'], $before['fullName'], 'NovaLink account status updated',
                "Your NovaLink account status is now {$status}." . ($reason ? " Reason: {$reason}" : '') . ' Contact the NHAI office if you have questions.',
                'account_status'
            );
            json_response(['success' => true, 'emailDelivered' => $mailSent]);
        }

        if ($action === 'update') {
            $id = required_string($input, 'id', 36, 'User ID');
            $fullName = required_string($input, 'fullName', 120, 'Full name');
            $email = normalize_email($input['email'] ?? '');
            $role = require_choice($input, 'role', ['admin', 'security', 'resident']);
            $homeownerId = optional_string($input, 'homeownerId', 36);
            $confirmRoleChange = ($input['confirmRoleChange'] ?? false) === true;
            $confirmAccessChange = ($input['confirmAccessChange'] ?? false) === true;
            if ($id === $actor['id'] && $role !== 'admin') {
                json_response(['error' => 'You cannot remove your own administrator role.'], 422);
            }
            $roleMap = ['admin' => 1, 'security' => 2, 'resident' => 3];
            $pdo->beginTransaction();
            try {
                $before = fetch_row(
                    $pdo,
                    "SELECT u.user_id AS id, u.full_name AS fullName, u.email,
                            u.role_id AS roleId, r.role_name AS role, u.account_status AS status,
                            h.homeowner_id AS homeownerId
                     FROM users u JOIN roles r ON r.role_id = u.role_id
                     LEFT JOIN homeowner_user_links hul ON hul.user_id = u.user_id
                     LEFT JOIN homeowners h ON h.homeowner_id = hul.homeowner_id AND h.record_status = 'active'
                     WHERE u.user_id = ? LIMIT 1 FOR UPDATE",
                    [$id]
                );
                if (!$before) {
                    $pdo->rollBack();
                    json_response(['error' => 'User not found.'], 404);
                }
                $roleChanged = $before['role'] !== $role;
                if ($roleChanged && !$confirmRoleChange) {
                    $pdo->rollBack();
                    json_response(['error' => 'Confirm the role change explicitly before saving.'], 422);
                }
                $homeownerChanged = $role === 'resident'
                    && (string) ($before['homeownerId'] ?? '') !== (string) $homeownerId;
                if ($homeownerChanged && !$confirmAccessChange) {
                    $pdo->rollBack();
                    json_response(['error' => 'Confirm the homeowner-link change explicitly before saving.'], 422);
                }
                if ($roleChanged && $before['role'] === 'admin' && $before['status'] === 'active') {
                    $activeAdmins = $pdo->query(
                        "SELECT u.user_id FROM users u JOIN roles r ON r.role_id = u.role_id
                         WHERE r.role_name = 'admin' AND u.account_status = 'active' FOR UPDATE"
                    )->fetchAll();
                    if (count($activeAdmins) <= 1) {
                        $pdo->rollBack();
                        json_response(['error' => 'The last active administrator cannot be assigned another role.'], 422);
                    }
                }
                $duplicate = fetch_row($pdo, 'SELECT user_id AS id FROM users WHERE email = ? AND user_id <> ? LIMIT 1', [$email, $id]);
                if ($duplicate) {
                    $pdo->rollBack();
                    json_response(['error' => 'Another account already uses this email address.'], 409);
                }
                $emailChanged = strcasecmp((string) $before['email'], $email) !== 0;
                $update = $pdo->prepare(
                    'UPDATE users
                     SET full_name = ?, email = ?, role_id = ?,
                         email_verified = CASE WHEN ? = 1 THEN 0 ELSE email_verified END,
                         email_verified_at = CASE WHEN ? = 1 THEN NULL ELSE email_verified_at END
                     WHERE user_id = ?'
                );
                $update->execute([$fullName, $email, $roleMap[$role], $emailChanged ? 1 : 0, $emailChanged ? 1 : 0, $id]);
                $pdo->prepare('DELETE FROM homeowner_user_links WHERE user_id = ?')->execute([$id]);
                if ($role === 'resident' && $homeownerId) {
                    $link = $pdo->prepare(
                        "INSERT INTO homeowner_user_links (homeowner_id, user_id, linked_by_user_id)
                         SELECT homeowner_id, ?, ? FROM homeowners
                         WHERE homeowner_id = ? AND record_status = 'active'"
                    );
                    $link->execute([$id, $actor['id'], $homeownerId]);
                    if ($link->rowCount() !== 1) throw new RuntimeException('The selected homeowner record is unavailable.');
                }
                $pdo->commit();
            } catch (Throwable $error) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                throw $error;
            }
            audit_log($pdo, $actor['id'], 'user.update', 'user', $id, $before, [
                'fullName' => $fullName,
                'email' => $email,
                'role' => $role,
                'homeownerId' => $role === 'resident' ? $homeownerId : null,
                'homeownerLinkChanged' => $homeownerChanged,
                'emailVerificationRequired' => $emailChanged,
            ]);
            $response = ['success' => true];
            if ($roleChanged || $emailChanged) {
                $changes = [];
                if ($roleChanged) {
                    $changes[] = "Your NovaLink role is now {$role}.";
                }
                if ($emailChanged) {
                    $changes[] = 'Your account email was changed and must be verified before your next sign-in. Ask an NHAI administrator to send the verification code, then attempt to sign in with the new email to enter that code.';
                }
                $response['emailDelivered'] = safe_notification(
                    $pdo,
                    $email,
                    $fullName,
                    'NovaLink account access updated',
                    implode("\n\n", $changes),
                    'account_access_updated'
                );
            }
            json_response($response);
        }

        if ($action === 'unlock') {
            $id = required_string($input, 'id', 36, 'User ID');
            $before = fetch_row(
                $pdo,
                'SELECT user_id AS id, email, full_name AS fullName, failed_login_attempts AS failedLoginAttempts, locked_until AS lockedUntil FROM users WHERE user_id = ? LIMIT 1',
                [$id]
            );
            if (!$before) {
                json_response(['error' => 'User not found.'], 404);
            }
            $update = $pdo->prepare('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE user_id = ?');
            $update->execute([$id]);
            $loginRateAction = 'login:' . substr(hash('sha256', (string) $before['email']), 0, 32);
            $clearLoginThrottle = $pdo->prepare('DELETE FROM rate_limits WHERE action_name = ?');
            $clearLoginThrottle->execute([$loginRateAction]);
            audit_log($pdo, $actor['id'], 'user.unlock', 'user', $id, $before, [
                'failedLoginAttempts' => 0,
                'lockedUntil' => null,
                'loginRateLimitCleared' => true,
            ]);
            json_response(['success' => true]);
        }

        if ($action === 'force-password-reset') {
            $id = required_string($input, 'id', 36, 'User ID');
            if ($id === $actor['id']) {
                json_response(['error' => 'Use Change Password to update your own administrator password.'], 422);
            }
            $before = fetch_row(
                $pdo,
                'SELECT user_id AS id, email, full_name AS fullName, force_password_change AS forcePasswordChange FROM users WHERE user_id = ? LIMIT 1',
                [$id]
            );
            if (!$before) {
                json_response(['error' => 'User not found.'], 404);
            }
            $update = $pdo->prepare('UPDATE users SET force_password_change = 1 WHERE user_id = ?');
            $update->execute([$id]);
            audit_log($pdo, $actor['id'], 'user.force_password_reset', 'user', $id, $before, ['forcePasswordChange' => true]);
            $mailSent = safe_notification(
                $pdo,
                $before['email'],
                $before['fullName'],
                'NovaLink password change required',
                'An NHAI administrator has required a password change on your account. Sign in with your current password and NovaLink will ask you to set a new private password. If you no longer know your password, use Forgot Password on the sign-in page.',
                'password_change_required'
            );
            json_response(['success' => true, 'emailDelivered' => $mailSent]);
        }

        if ($action === 'resend-verification') {
            $id = required_string($input, 'id', 36, 'User ID');
            $userAccount = fetch_row(
                $pdo,
                'SELECT user_id AS id, email, full_name AS fullName, email_verified AS emailVerified FROM users WHERE user_id = ? LIMIT 1',
                [$id]
            );
            if (!$userAccount) {
                json_response(['error' => 'User not found.'], 404);
            }
            if ((bool) $userAccount['emailVerified']) {
                json_response(['error' => 'This account email is already verified.'], 409);
            }
            $recent = $pdo->prepare(
                "SELECT COUNT(*) FROM email_verification_tokens
                 WHERE email = ? AND purpose = 'registration'
                   AND created_at > DATE_SUB(UTC_TIMESTAMP(), INTERVAL 15 MINUTE)"
            );
            $recent->execute([$userAccount['email']]);
            if ((int) $recent->fetchColumn() >= 3) {
                json_response(['error' => 'Too many verification emails were sent recently. Wait 15 minutes before trying again.'], 429);
            }

            $code = (string) random_int(100000, 999999);
            $tokenId = uuid_v4();
            $pdo->beginTransaction();
            try {
                $consumeOld = $pdo->prepare(
                    "UPDATE email_verification_tokens SET consumed_at = UTC_TIMESTAMP()
                     WHERE email = ? AND purpose = 'registration' AND consumed_at IS NULL"
                );
                $consumeOld->execute([$userAccount['email']]);
                $insert = $pdo->prepare(
                    "INSERT INTO email_verification_tokens
                     (token_id, email, full_name, purpose, code_hash, expires_at)
                     VALUES (?, ?, ?, 'registration', ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 15 MINUTE))"
                );
                $insert->execute([
                    $tokenId,
                    $userAccount['email'],
                    $userAccount['fullName'],
                    password_hash($code, PASSWORD_DEFAULT),
                ]);
                $pdo->commit();
            } catch (Throwable $error) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $error;
            }

            try {
                $mailResult = (new EmailService($pdo))->sendOtpEmail(
                    $userAccount['email'],
                    $userAccount['fullName'],
                    $code,
                    'Account Email Verification'
                );
                $mailSent = (bool) ($mailResult['success'] ?? false);
            } catch (Throwable $error) {
                error_log('NovaLink account verification email failure: ' . $error->getMessage());
                $mailSent = false;
            }
            if (!$mailSent) {
                $pdo->prepare('UPDATE email_verification_tokens SET consumed_at = UTC_TIMESTAMP() WHERE token_id = ?')->execute([$tokenId]);
                json_response(['error' => 'Verification email could not be delivered. No active code was left behind.'], 502);
            }

            audit_log($pdo, $actor['id'], 'user.verification_resent', 'user', $id, null, [
                'email' => $userAccount['email'],
                'verificationTokenId' => $tokenId,
            ]);
            json_response(['success' => true, 'emailDelivered' => true]);
        }
    }

    if ($resource === 'homeowners') {
        $actor = require_auth($pdo, ['admin']);
        if (!in_array($action, ['create', 'update'], true)) {
            json_response(['error' => 'Invalid homeowner action.'], 400);
        }
        $ownerName = required_string($input, 'ownerName', 120, 'Owner name');
        $blockLot = required_string($input, 'blockLot', 100, 'Block and lot');
        $street = required_string($input, 'street', 120, 'Street');
        $contactNumber = required_string($input, 'contactNumber', 30, 'Contact number');
        $email = normalize_email($input['email'] ?? '');
        $occupants = validated_occupants($input);
        if ($action === 'create') {
            $pdo->beginTransaction();
            try {
                $id = uuid_v4();
                $insert = $pdo->prepare(
                    'INSERT INTO homeowners (homeowner_id, owner_name, block_lot, street, contact_number, email) VALUES (?, ?, ?, ?, ?, ?)'
                );
                $insert->execute([$id, $ownerName, $blockLot, $street, $contactNumber, $email]);
                $insertOccupant = $pdo->prepare(
                    'INSERT INTO household_occupants (occupant_id, homeowner_id, full_name, relationship) VALUES (?, ?, ?, ?)'
                );
                foreach ($occupants as $occupant) {
                    $insertOccupant->execute([uuid_v4(), $id, $occupant['fullName'], $occupant['relationship']]);
                }
                $pdo->commit();
            } catch (Throwable $error) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                throw $error;
            }
            audit_log($pdo, $actor['id'], 'homeowner.create', 'homeowner', $id, null, $input);
            json_response(['success' => true, 'id' => $id], 201);
        }
        $id = required_string($input, 'id', 36, 'Homeowner ID');
        $before = fetch_row($pdo, 'SELECT * FROM homeowners WHERE homeowner_id = ?', [$id]);
        if (!$before) {
            json_response(['error' => 'Homeowner record not found.'], 404);
        }
        $pdo->beginTransaction();
        try {
            $update = $pdo->prepare(
                'UPDATE homeowners SET owner_name = ?, block_lot = ?, street = ?, contact_number = ?, email = ? WHERE homeowner_id = ?'
            );
            $update->execute([$ownerName, $blockLot, $street, $contactNumber, $email, $id]);
            $pdo->prepare('DELETE FROM household_occupants WHERE homeowner_id = ?')->execute([$id]);
            $insertOccupant = $pdo->prepare(
                'INSERT INTO household_occupants (occupant_id, homeowner_id, full_name, relationship) VALUES (?, ?, ?, ?)'
            );
            foreach ($occupants as $occupant) {
                $insertOccupant->execute([uuid_v4(), $id, $occupant['fullName'], $occupant['relationship']]);
            }
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
        audit_log($pdo, $actor['id'], 'homeowner.update', 'homeowner', $id, $before, $input);
        json_response(['success' => true]);
    }

    if ($resource === 'visitors') {
        $actor = require_auth($pdo, ['admin', 'security']);
        if ($action === 'create') {
            $id = uuid_v4();
            $visitorName = required_string($input, 'visitorName', 120, 'Visitor name');
            $contactNumber = required_string($input, 'contactNumber', 30, 'Contact number');
            $purpose = required_string($input, 'purpose', 120, 'Purpose');
            $destination = required_string($input, 'destinationAddress', 190, 'Destination address');
            $plate = optional_string($input, 'vehiclePlate', 30);
            $pdo->beginTransaction();
            try {
                $insert = $pdo->prepare(
                    'INSERT INTO visitor_logs
                     (visitor_log_id, visitor_name, contact_number, purpose, destination_address, vehicle_plate, recorded_by_user_id)
                     VALUES (?, ?, ?, ?, ?, ?, ?)'
                );
                $insert->execute([$id, $visitorName, $contactNumber, $purpose, $destination, $plate, $actor['id']]);
                required_audit_log(
                    $pdo, $actor['id'], 'visitor.create', 'visitor_log', $id, null,
                    ['visitorName' => $visitorName, 'entrySource' => 'gate_entry']
                );
                $pdo->commit();
            } catch (Throwable $error) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $error;
            }
            json_response(['success' => true, 'id' => $id], 201);
        }
        if ($action === 'exit') {
            $id = required_string($input, 'id', 36, 'Visitor log ID');
            $pdo->beginTransaction();
            try {
                $entry = fetch_row(
                    $pdo,
                    'SELECT visitor_log_id, visitor_name, entry_time FROM visitor_logs
                     WHERE visitor_log_id = ? AND exit_time IS NULL FOR UPDATE',
                    [$id]
                );
                if (!$entry) {
                    $pdo->rollBack();
                    json_response(['error' => 'Active visitor entry not found.'], 404);
                }
                $update = $pdo->prepare(
                    'UPDATE visitor_logs SET exit_time = UTC_TIMESTAMP(), updated_by_user_id = ? WHERE visitor_log_id = ?'
                );
                $update->execute([$actor['id'], $id]);
                required_audit_log(
                    $pdo, $actor['id'], 'visitor.exit', 'visitor_log', $id,
                    ['exitTime' => null], ['exitTime' => gmdate('Y-m-d H:i:s')]
                );
                $pdo->commit();
            } catch (Throwable $error) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $error;
            }
            json_response(['success' => true]);
        }
        json_response(['error' => 'Invalid visitor action.'], 400);
    }

    if ($resource === 'visitor-passes') {
        if (!visitor_passes_available($pdo)) {
            json_response(['error' => 'Visitor passes are not ready. Apply migration 003_visitor_passes first.'], 503);
        }

        if ($action === 'create') {
            $actor = require_auth($pdo, ['resident']);
            $homeowner = homeowner_for_user($pdo, $actor['id']);
            $visitorName = required_string($input, 'visitorName', 120, 'Visitor name');
            $contactNumber = required_string($input, 'contactNumber', 30, 'Contact number');
            $purpose = required_string($input, 'purpose', 120, 'Purpose');
            $plate = optional_string($input, 'vehiclePlate', 30);
            $visitDate = require_iso_date($input, 'visitDate');
            $manila = new DateTimeZone('Asia/Manila');
            $today = new DateTimeImmutable('today', $manila);
            $date = new DateTimeImmutable($visitDate, $manila);
            if ($date < $today || $date > $today->modify('+30 days')) {
                json_response(['error' => 'Visit date must be today or within the next 30 days.'], 422);
            }
            $id = uuid_v4();
            $pdo->beginTransaction();
            try {
                $code = create_visitor_pass_code($pdo);
                $insert = $pdo->prepare(
                    'INSERT INTO visitor_passes
                     (visitor_pass_id, pass_code, homeowner_id, created_by_user_id,
                      visitor_name, contact_number, purpose, vehicle_plate, visit_date)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
                );
                $insert->execute([
                    $id, $code, $homeowner['id'], $actor['id'], $visitorName,
                    $contactNumber, $purpose, $plate, $visitDate,
                ]);
                required_audit_log(
                    $pdo, $actor['id'], 'visitor_pass.create', 'visitor_pass', $id, null,
                    ['visitorName' => $visitorName, 'visitDate' => $visitDate]
                );
                $pdo->commit();
            } catch (Throwable $error) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $error;
            }
            json_response(['success' => true, 'id' => $id, 'passCode' => $code], 201);
        }

        if ($action === 'cancel') {
            $actor = require_auth($pdo, ['resident']);
            $homeowner = homeowner_for_user($pdo, $actor['id']);
            $id = required_string($input, 'id', 36, 'Visitor pass ID');
            $pdo->beginTransaction();
            try {
                $pass = fetch_row(
                    $pdo,
                    "SELECT visitor_pass_id, pass_code, pass_status FROM visitor_passes
                     WHERE visitor_pass_id = ? AND homeowner_id = ? AND pass_status = 'active' FOR UPDATE",
                    [$id, $homeowner['id']]
                );
                if (!$pass) {
                    $pdo->rollBack();
                    json_response(['error' => 'Active visitor pass not found.'], 404);
                }
                $pdo->prepare(
                    "UPDATE visitor_passes SET pass_status = 'cancelled', cancelled_at = UTC_TIMESTAMP()
                     WHERE visitor_pass_id = ?"
                )->execute([$id]);
                required_audit_log(
                    $pdo, $actor['id'], 'visitor_pass.cancel', 'visitor_pass', $id,
                    ['status' => 'active'], ['status' => 'cancelled']
                );
                $pdo->commit();
            } catch (Throwable $error) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $error;
            }
            json_response(['success' => true]);
        }

        if ($action === 'lookup') {
            $actor = require_auth($pdo, ['admin', 'security']);
            $code = required_visitor_pass_code($input);
            enforce_rate_limit($pdo, 'visitor-pass-lookup', $actor['id'], 60, 60, 60);
            $pass = fetch_row(
                $pdo,
                "SELECT vp.visitor_pass_id AS id, vp.pass_code AS passCode,
                        vp.visitor_name AS visitorName, vp.contact_number AS contactNumber,
                        vp.purpose, vp.vehicle_plate AS vehiclePlate, vp.visit_date AS visitDate,
                        h.owner_name AS hostName, h.block_lot AS hostBlockLot, h.street AS hostStreet
                 FROM visitor_passes vp
                 JOIN homeowners h ON h.homeowner_id = vp.homeowner_id AND h.record_status = 'active'
                 WHERE vp.pass_code = ? AND vp.pass_status = 'active'
                   AND vp.visit_date = DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))
                 LIMIT 1",
                [$code]
            );
            if (!$pass) {
                json_response(['error' => 'This pass is invalid, inactive, or not valid today.'], 404);
            }
            json_response(['success' => true, 'pass' => $pass]);
        }

        if ($action === 'redeem') {
            $actor = require_auth($pdo, ['admin', 'security']);
            $code = required_visitor_pass_code($input);
            enforce_rate_limit($pdo, 'visitor-pass-redeem', $actor['id'], 30, 60, 60);
            $pdo->beginTransaction();
            try {
                $pass = fetch_row(
                    $pdo,
                    "SELECT vp.*, h.owner_name, h.block_lot, h.street
                     FROM visitor_passes vp
                     JOIN homeowners h ON h.homeowner_id = vp.homeowner_id AND h.record_status = 'active'
                     WHERE vp.pass_code = ? AND vp.pass_status = 'active'
                       AND vp.visit_date = DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))
                     FOR UPDATE",
                    [$code]
                );
                if (!$pass) {
                    $pdo->rollBack();
                    json_response(['error' => 'This pass is invalid, inactive, or not valid today.'], 404);
                }
                $logId = uuid_v4();
                $destination = trim($pass['block_lot'] . ', ' . $pass['street']) . ' — ' . $pass['owner_name'];
                $insert = $pdo->prepare(
                    'INSERT INTO visitor_logs
                     (visitor_log_id, visitor_name, contact_number, purpose, destination_address,
                      vehicle_plate, recorded_by_user_id)
                     VALUES (?, ?, ?, ?, ?, ?, ?)'
                );
                $insert->execute([
                    $logId, $pass['visitor_name'], $pass['contact_number'], $pass['purpose'],
                    $destination, $pass['vehicle_plate'], $actor['id'],
                ]);
                $update = $pdo->prepare(
                    "UPDATE visitor_passes SET pass_status = 'used', visitor_log_id = ?,
                     redeemed_by_user_id = ?, redeemed_at = UTC_TIMESTAMP()
                     WHERE visitor_pass_id = ?"
                );
                $update->execute([$logId, $actor['id'], $pass['visitor_pass_id']]);
                required_audit_log(
                    $pdo, $actor['id'], 'visitor_pass.redeem', 'visitor_pass', $pass['visitor_pass_id'],
                    ['status' => 'active'], ['status' => 'used', 'visitorLogId' => $logId]
                );
                $pdo->commit();
            } catch (Throwable $error) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $error;
            }
            json_response(['success' => true, 'visitorLogId' => $logId]);
        }

        json_response(['error' => 'Invalid visitor pass action.'], 400);
    }

    if ($resource === 'announcements') {
        $actor = require_auth($pdo, ['admin']);
        if ($action !== 'create') {
            json_response(['error' => 'Invalid announcement action.'], 400);
        }
        $title = required_string($input, 'title', 180, 'Title');
        $content = required_string($input, 'content', 10000, 'Content');
        $priority = require_choice($input, 'priority', ['normal', 'important', 'urgent']);
        $id = uuid_v4();
        $insert = $pdo->prepare(
            "INSERT INTO announcements
             (announcement_id, posted_by_user_id, title, content, priority, status, published_at)
             VALUES (?, ?, ?, ?, ?, 'published', UTC_TIMESTAMP())"
        );
        $insert->execute([$id, $actor['id'], $title, $content, $priority]);
        audit_log($pdo, $actor['id'], 'announcement.publish', 'announcement', $id, null, ['title' => $title, 'priority' => $priority]);

        $recipients = $pdo->query(
            "SELECT u.email, u.full_name AS fullName FROM users u
             JOIN roles r ON r.role_id = u.role_id
             WHERE r.role_name = 'resident' AND u.account_status = 'active' AND u.email_verified = 1"
        )->fetchAll();
        $delivered = 0;
        foreach ($recipients as $recipient) {
            if (safe_notification($pdo, $recipient['email'], $recipient['fullName'], 'NHAI Announcement: ' . $title, $content, 'announcement_broadcast')) {
                $delivered++;
            }
        }
        json_response(['success' => true, 'id' => $id, 'emailsDelivered' => $delivered, 'recipientCount' => count($recipients)], 201);
    }

    if ($resource === 'reservations') {
        if ($action === 'create') {
            $user = session_user($pdo);
            $guestId = (string) ($_SESSION['guest_profile_id'] ?? '');
            $guestFresh = (time() - (int) ($_SESSION['guest_verified_at'] ?? 0)) <= 3600;
            if (!$user && ($guestId === '' || !$guestFresh)) {
                json_response(['error' => 'Sign in or complete Guest Mode email verification first.'], 401);
            }

            $facilityId = required_string($input, 'facilityId', 36, 'Facility');
            $date = require_iso_date($input, 'date');
            if ($date < gmdate('Y-m-d')) {
                json_response(['error' => 'Reservation date cannot be in the past.'], 422);
            }
            $timeSlot = required_string($input, 'timeSlot', 60, 'Time slot');
            $purpose = required_string($input, 'purpose', 255, 'Purpose');
            $facility = fetch_row($pdo, 'SELECT facility_id, guest_bookable, is_active FROM facilities WHERE facility_id = ?', [$facilityId]);
            if (!$facility || !(bool) $facility['is_active']) {
                json_response(['error' => 'The selected facility is unavailable.'], 422);
            }

            $homeownerId = null;
            $requesterType = 'guest';
            $requesterName = '';
            $requesterEmail = '';
            $actorId = null;
            if ($user) {
                if ($user['role'] !== 'resident') {
                    json_response(['error' => 'Only residents or verified guests can submit reservations.'], 403);
                }
                $homeowner = homeowner_for_user($pdo, $user['id']);
                $restricted = fetch_row(
                    $pdo,
                    "SELECT restriction_id FROM access_restrictions WHERE homeowner_id = ? AND restriction_status = 'active' LIMIT 1",
                    [$homeowner['id']]
                );
                if ($restricted) {
                    json_response(['error' => 'Facility reservations are restricted until outstanding dues are settled.'], 403);
                }
                $homeownerId = $homeowner['id'];
                $requesterType = 'resident';
                $requesterName = $user['fullName'];
                $requesterEmail = $user['email'];
                $guestId = null;
                $actorId = $user['id'];
            } else {
                if (!(bool) $facility['guest_bookable']) {
                    json_response(['error' => 'This facility is not available for guest booking.'], 403);
                }
                $guest = fetch_row($pdo, 'SELECT full_name, email FROM guest_profiles WHERE guest_id = ?', [$guestId]);
                if (!$guest) {
                    json_response(['error' => 'Guest verification has expired.'], 401);
                }
                $requesterName = $guest['full_name'];
                $requesterEmail = $guest['email'];
            }

            $pdo->beginTransaction();
            try {
                $conflict = $pdo->prepare(
                    "SELECT reservation_id FROM facility_reservations
                     WHERE facility_id = ? AND reservation_date = ? AND time_slot = ?
                       AND status IN ('pending', 'approved') FOR UPDATE"
                );
                $conflict->execute([$facilityId, $date, $timeSlot]);
                if ($conflict->fetch()) {
                    $pdo->rollBack();
                    json_response(['error' => 'That facility and time slot already has an active reservation request.'], 409);
                }
                $id = uuid_v4();
                $insert = $pdo->prepare(
                    'INSERT INTO facility_reservations
                     (reservation_id, facility_id, homeowner_id, guest_id, requester_type,
                      requester_name, requester_email, reservation_date, time_slot, purpose)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
                );
                $insert->execute([$id, $facilityId, $homeownerId, $guestId, $requesterType, $requesterName, $requesterEmail, $date, $timeSlot, $purpose]);
                $pdo->commit();
                audit_log($pdo, $actorId, 'reservation.create', 'reservation', $id, null, ['date' => $date, 'timeSlot' => $timeSlot]);
                $mailSent = safe_notification(
                    $pdo, $requesterEmail, $requesterName, 'NovaLink reservation received',
                    "Your reservation request for {$date}, {$timeSlot} was recorded and is pending administrator review.",
                    'reservation_update'
                );
                json_response(['success' => true, 'id' => $id, 'emailDelivered' => $mailSent], 201);
            } catch (Throwable $error) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $error;
            }
        }

        if ($action === 'status') {
            $actor = require_auth($pdo, ['admin']);
            $id = required_string($input, 'id', 36, 'Reservation ID');
            $status = require_choice($input, 'status', ['approved', 'rejected']);
            $reservation = fetch_row(
                $pdo,
                'SELECT reservation_id, requester_name, requester_email, reservation_date, time_slot, status FROM facility_reservations WHERE reservation_id = ?',
                [$id]
            );
            if (!$reservation) {
                json_response(['error' => 'Reservation not found.'], 404);
            }
            $update = $pdo->prepare(
                'UPDATE facility_reservations SET status = ?, reviewed_by_user_id = ?, reviewed_at = UTC_TIMESTAMP() WHERE reservation_id = ?'
            );
            $update->execute([$status, $actor['id'], $id]);
            audit_log($pdo, $actor['id'], 'reservation.status', 'reservation', $id, $reservation, ['status' => $status]);
            $mailSent = safe_notification(
                $pdo, $reservation['requester_email'], $reservation['requester_name'], 'NovaLink reservation update',
                "Your reservation request for {$reservation['reservation_date']}, {$reservation['time_slot']} was {$status}.",
                'reservation_update'
            );
            json_response(['success' => true, 'emailDelivered' => $mailSent]);
        }
    }

    if ($resource === 'payments') {
        if (in_array($action, ['submit', 'resubmit'], true)) {
            $actor = require_auth($pdo, ['resident']);
            $homeowner = homeowner_for_user($pdo, $actor['id']);
            $amountCents = payment_amount_cents($input['amount'] ?? null);
            $amount = $amountCents / 100;
            $reference = required_string($input, 'reference', 120, 'Payment reference');
            $requestedPaymentId = $action === 'resubmit'
                ? required_string($input, 'paymentId', 36, 'Payment ID')
                : null;
            $referenceOwner = fetch_row(
                $pdo,
                'SELECT payment_id FROM payments WHERE payment_reference = ? LIMIT 1',
                [$reference]
            );
            if ($referenceOwner && $referenceOwner['payment_id'] !== $requestedPaymentId) {
                json_response(['error' => 'That payment reference has already been submitted.'], 409);
            }
            $proof = store_payment_proof();

            try {
                if ($action === 'submit') {
                    $id = uuid_v4();
                    $pdo->beginTransaction();
                    $insert = $pdo->prepare(
                        'INSERT INTO payments
                         (payment_id, homeowner_id, submitted_by_user_id, amount_paid, payment_reference,
                          proof_stored_name, proof_original_name, proof_mime_type, proof_file_size, payment_date)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_DATE())'
                    );
                    $insert->execute([
                        $id, $homeowner['id'], $actor['id'], $amount, $reference, $proof['storedName'],
                        $proof['originalName'], $proof['mime'], $proof['size'],
                    ]);
                    required_audit_log(
                        $pdo, $actor['id'], 'payment.submit', 'payment', $id, null,
                        ['amount' => $amount, 'reference' => $reference]
                    );
                    $pdo->commit();
                } else {
                    $id = $requestedPaymentId;
                    $pdo->beginTransaction();
                    $payment = fetch_row(
                        $pdo,
                        "SELECT * FROM payments
                         WHERE payment_id = ? AND homeowner_id = ? AND validation_status = 'rejected'
                         FOR UPDATE",
                        [$id, $homeowner['id']]
                    );
                    if (!$payment) {
                        $pdo->rollBack();
                        @unlink($proof['target']);
                        json_response(['error' => 'Rejected payment not found or already resubmitted.'], 404);
                    }
                    $pdo->prepare('DELETE FROM payment_allocations WHERE payment_id = ?')->execute([$id]);
                    $update = $pdo->prepare(
                        "UPDATE payments SET submitted_by_user_id = ?, amount_paid = ?, unallocated_amount = 0,
                         payment_reference = ?, proof_stored_name = ?, proof_original_name = ?,
                         proof_mime_type = ?, proof_file_size = ?, validation_status = 'pending',
                         validated_by_user_id = NULL, validated_at = NULL, payment_date = CURRENT_DATE()
                         WHERE payment_id = ?"
                    );
                    $update->execute([
                        $actor['id'], $amount, $reference, $proof['storedName'], $proof['originalName'],
                        $proof['mime'], $proof['size'], $id,
                    ]);
                    required_audit_log(
                        $pdo, $actor['id'], 'payment.resubmit', 'payment', $id,
                        ['amount' => (float) $payment['amount_paid'], 'reference' => $payment['payment_reference'], 'status' => 'rejected'],
                        ['amount' => $amount, 'reference' => $reference, 'status' => 'pending']
                    );
                    $pdo->commit();
                    if ($payment['proof_stored_name'] !== $proof['storedName']) {
                        @unlink(__DIR__ . '/../storage/payment-proofs/' . basename((string) $payment['proof_stored_name']));
                    }
                }
            } catch (Throwable $error) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                @unlink($proof['target']);
                throw $error;
            }
            json_response(['success' => true, 'id' => $id], $action === 'submit' ? 201 : 200);
        }

        if ($action === 'validate') {
            $actor = require_auth($pdo, ['admin']);
            $id = required_string($input, 'id', 36, 'Payment ID');
            refresh_financial_state($pdo);
            $pdo->beginTransaction();
            try {
                $payment = fetch_row(
                    $pdo,
                    "SELECT * FROM payments WHERE payment_id = ? AND validation_status = 'pending' FOR UPDATE",
                    [$id]
                );
                if (!$payment) {
                    $pdo->rollBack();
                    json_response(['error' => 'Pending payment not found.'], 404);
                }
                $allocationResult = allocate_payment_credit(
                    $pdo, $id, (string) $payment['homeowner_id'], (int) round((float) $payment['amount_paid'] * 100)
                );
                $remaining = $allocationResult['remainingCents'] / 100;
                $paidCount = $allocationResult['paidCount'];
                $update = $pdo->prepare(
                    "UPDATE payments SET validation_status = 'validated', unallocated_amount = ?, validated_by_user_id = ?, validated_at = UTC_TIMESTAMP() WHERE payment_id = ?"
                );
                $update->execute([$remaining, $actor['id'], $id]);
                required_audit_log(
                    $pdo, $actor['id'], 'payment.validate', 'payment', $id,
                    ['status' => 'pending'],
                    [
                        'status' => 'validated',
                        'duesPaid' => $paidCount,
                        'allocationsCreated' => $allocationResult['allocationCount'],
                        'unallocatedAmount' => $remaining,
                    ]
                );
                $pdo->commit();
                refresh_financial_state($pdo);
                $homeowner = fetch_row($pdo, 'SELECT owner_name, email FROM homeowners WHERE homeowner_id = ?', [$payment['homeowner_id']]);
                $mailSent = $homeowner ? safe_notification(
                    $pdo, $homeowner['email'], $homeowner['owner_name'], 'NovaLink payment validated',
                    "Your payment reference {$payment['payment_reference']} was validated. {$paidCount} billing record(s) were settled.",
                    'payment_update'
                ) : false;
                json_response(['success' => true, 'duesPaid' => $paidCount, 'unallocatedAmount' => $remaining, 'emailDelivered' => $mailSent]);
            } catch (Throwable $error) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $error;
            }
        }

        if ($action === 'reject') {
            $actor = require_auth($pdo, ['admin']);
            $id = required_string($input, 'id', 36, 'Payment ID');
            $reason = required_string($input, 'reason', 500, 'Rejection reason');
            $pdo->beginTransaction();
            try {
                $payment = fetch_row(
                    $pdo,
                    "SELECT p.*, h.owner_name, h.email FROM payments p JOIN homeowners h ON h.homeowner_id = p.homeowner_id
                     WHERE p.payment_id = ? AND p.validation_status = 'pending' FOR UPDATE",
                    [$id]
                );
                if (!$payment) {
                    $pdo->rollBack();
                    json_response(['error' => 'Pending payment not found.'], 404);
                }
                $update = $pdo->prepare(
                    "UPDATE payments SET validation_status = 'rejected', validated_by_user_id = ?, validated_at = UTC_TIMESTAMP() WHERE payment_id = ?"
                );
                $update->execute([$actor['id'], $id]);
                required_audit_log(
                    $pdo, $actor['id'], 'payment.reject', 'payment', $id,
                    ['status' => 'pending'], ['status' => 'rejected', 'reason' => $reason]
                );
                $pdo->commit();
            } catch (Throwable $error) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $error;
            }
            $mailSent = safe_notification(
                $pdo, $payment['email'], $payment['owner_name'], 'NovaLink payment proof rejected',
                "Your payment proof with reference {$payment['payment_reference']} was rejected. Reason: {$reason}. You can correct the details and resubmit it in NovaLink.",
                'payment_update'
            );
            json_response(['success' => true, 'emailDelivered' => $mailSent]);
        }

        if ($action === 'reconcile-credits') {
            $actor = require_auth($pdo, ['admin']);
            refresh_financial_state($pdo);
            $pdo->beginTransaction();
            try {
                $credits = $pdo->query(
                    "SELECT payment_id, homeowner_id, unallocated_amount FROM payments
                     WHERE validation_status = 'validated' AND unallocated_amount > 0
                     ORDER BY validated_at, created_at FOR UPDATE"
                )->fetchAll();
                $paymentsUpdated = 0;
                $allocationsCreated = 0;
                $duesPaid = 0;
                $updateCredit = $pdo->prepare('UPDATE payments SET unallocated_amount = ? WHERE payment_id = ?');
                foreach ($credits as $credit) {
                    $result = allocate_payment_credit(
                        $pdo,
                        (string) $credit['payment_id'],
                        (string) $credit['homeowner_id'],
                        (int) round((float) $credit['unallocated_amount'] * 100)
                    );
                    if ($result['allocationCount'] === 0) {
                        continue;
                    }
                    $updateCredit->execute([$result['remainingCents'] / 100, $credit['payment_id']]);
                    $paymentsUpdated++;
                    $allocationsCreated += $result['allocationCount'];
                    $duesPaid += $result['paidCount'];
                }
                required_audit_log(
                    $pdo, $actor['id'], 'payment.reconcile_credits', 'payment_batch', null, null,
                    [
                        'paymentsUpdated' => $paymentsUpdated,
                        'allocationsCreated' => $allocationsCreated,
                        'duesPaid' => $duesPaid,
                    ]
                );
                $pdo->commit();
                refresh_financial_state($pdo);
                json_response([
                    'success' => true,
                    'paymentsUpdated' => $paymentsUpdated,
                    'allocationsCreated' => $allocationsCreated,
                    'duesPaid' => $duesPaid,
                ]);
            } catch (Throwable $error) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $error;
            }
        }

        if ($action === 'remind') {
            $actor = require_auth($pdo, ['admin']);
            refresh_financial_state($pdo);
            $homeownerId = optional_string($input, 'homeownerId', 36);
            $sql =
                "SELECT h.homeowner_id, h.owner_name, h.email, COUNT(d.dues_id) AS unpaidCount,
                        SUM(GREATEST(0, d.amount_due + d.penalty_amount -
                            COALESCE((SELECT SUM(pa.amount_applied) FROM payment_allocations pa WHERE pa.dues_id = d.dues_id), 0))) AS totalOwed
                 FROM homeowners h JOIN dues d ON d.homeowner_id = h.homeowner_id AND d.status = 'unpaid'";
            $params = [];
            if ($homeownerId) {
                $sql .= ' WHERE h.homeowner_id = ?';
                $params[] = $homeownerId;
            }
            $sql .= ' GROUP BY h.homeowner_id, h.owner_name, h.email';
            $statement = $pdo->prepare($sql);
            $statement->execute($params);
            $targets = $statement->fetchAll();
            $delivered = 0;
            foreach ($targets as $target) {
                $amount = number_format((float) $target['totalOwed'], 2);
                if (safe_notification(
                    $pdo, $target['email'], $target['owner_name'], 'NovaLink dues reminder',
                    "You have {$target['unpaidCount']} unpaid billing record(s) with a current total of PHP {$amount}. Sign in to view the details and payment QR code.",
                    'dues_reminder'
                )) {
                    $delivered++;
                }
            }
            audit_log($pdo, $actor['id'], 'dues.remind', 'homeowner', $homeownerId, null, ['recipients' => count($targets)]);
            json_response(['success' => true, 'recipientCount' => count($targets), 'emailsDelivered' => $delivered]);
        }
    }

    if ($resource === 'dues') {
        $actor = require_auth($pdo, ['admin']);
        if ($action === 'configure') {
            $amountCents = payment_amount_cents($input['monthlyDueAmount'] ?? null);
            $penaltyValue = $input['monthlyPenaltyAmount'] ?? null;
            if (!is_numeric($penaltyValue)) {
                json_response(['error' => 'Enter a valid penalty amount.'], 422);
            }
            $penaltyCents = (int) round((float) $penaltyValue * 100);
            if ($penaltyCents < 0 || $penaltyCents > 100_000_000) {
                json_response(['error' => 'Enter a valid penalty amount.'], 422);
            }
            $dueDay = filter_var($input['monthlyDueDay'] ?? null, FILTER_VALIDATE_INT);
            $restrictionThreshold = filter_var($input['restrictAfterUnpaidMonths'] ?? null, FILTER_VALIDATE_INT);
            if ($dueDay === false || $dueDay < 1 || $dueDay > 31) {
                json_response(['error' => 'Monthly due day must be between 1 and 31.'], 422);
            }
            if ($restrictionThreshold === false || $restrictionThreshold < 1 || $restrictionThreshold > 24) {
                json_response(['error' => 'Restriction threshold must be between 1 and 24 months.'], 422);
            }
            $settings = [
                'monthly_due_amount' => number_format($amountCents / 100, 2, '.', ''),
                'monthly_due_day' => (string) $dueDay,
                'monthly_penalty_amount' => number_format($penaltyCents / 100, 2, '.', ''),
                'restrict_after_unpaid_months' => (string) $restrictionThreshold,
            ];
            $before = [];
            foreach (array_keys($settings) as $key) {
                $before[$key] = system_setting($pdo, $key, '');
            }
            $pdo->beginTransaction();
            try {
                $upsert = $pdo->prepare(
                    'INSERT INTO system_settings (setting_key, setting_value, updated_by_user_id)
                     VALUES (?, ?, ?)
                     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by_user_id = VALUES(updated_by_user_id)'
                );
                foreach ($settings as $key => $value) {
                    $upsert->execute([$key, $value, $actor['id']]);
                }
                required_audit_log($pdo, $actor['id'], 'dues.configure', 'system_settings', 'dues', $before, $settings);
                $pdo->commit();
                refresh_financial_state($pdo);
                json_response(['success' => true]);
            } catch (Throwable $error) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $error;
            }
        }
        if ($action !== 'generate') {
            json_response(['error' => 'Invalid dues action.'], 400);
        }
        $month = required_string($input, 'month', 7, 'Billing month');
        if (!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $month)) {
            json_response(['error' => 'Billing month must use YYYY-MM format.'], 422);
        }
        $billingMonth = $month . '-01';
        $dueDate = require_iso_date($input, 'dueDate');
        if (substr($dueDate, 0, 7) < $month) {
            json_response(['error' => 'Due date cannot be before the billing month.'], 422);
        }
        $amount = filter_var($input['amount'] ?? null, FILTER_VALIDATE_FLOAT);
        if ($amount === false || $amount <= 0 || $amount > 1_000_000) {
            json_response(['error' => 'Enter a valid monthly dues amount.'], 422);
        }
        $homeownerId = optional_string($input, 'homeownerId', 36);
        $sql =
            "INSERT INTO dues (dues_id, homeowner_id, billing_month, amount_due, due_date)
             SELECT UUID(), homeowner_id, ?, ?, ? FROM homeowners WHERE record_status = 'active'";
        $params = [$billingMonth, $amount, $dueDate];
        if ($homeownerId) {
            $sql .= ' AND homeowner_id = ?';
            $params[] = $homeownerId;
        }
        $sql .= ' ON DUPLICATE KEY UPDATE dues_id = dues_id';
        $insert = $pdo->prepare($sql);
        $insert->execute($params);
        refresh_financial_state($pdo);
        audit_log($pdo, $actor['id'], 'dues.generate', 'dues_batch', $month, null, [
            'amount' => $amount, 'dueDate' => $dueDate, 'homeownerId' => $homeownerId, 'recordsCreated' => $insert->rowCount(),
        ]);
        json_response(['success' => true, 'recordsCreated' => $insert->rowCount()]);
    }

    if ($resource === 'payment-qr') {
        $actor = require_auth($pdo, ['admin']);
        if ($action !== 'update') {
            json_response(['error' => 'Invalid payment QR action.'], 400);
        }
        $provider = required_string($input, 'provider', 50, 'Payment provider');
        $accountName = required_string($input, 'accountName', 120, 'Account name');
        $accountNumber = required_string($input, 'accountNumber', 50, 'Account number');
        $current = fetch_row($pdo, 'SELECT qr_code_id, qr_image_path FROM payment_qr_codes WHERE is_active = 1 ORDER BY updated_at DESC LIMIT 1', []);
        $storedName = $current['qr_image_path'] ?? null;
        $oldStoredName = $storedName;

        if (isset($_FILES['image']) && $_FILES['image']['error'] !== UPLOAD_ERR_NO_FILE) {
            if ($_FILES['image']['error'] !== UPLOAD_ERR_OK || (int) $_FILES['image']['size'] <= 0 || (int) $_FILES['image']['size'] > 2_097_152) {
                json_response(['error' => 'Payment QR image must be no larger than 2 MB.'], 422);
            }
            $finfo = new finfo(FILEINFO_MIME_TYPE);
            $mime = (string) $finfo->file($_FILES['image']['tmp_name']);
            $extensions = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
            if (!isset($extensions[$mime])) {
                json_response(['error' => 'Payment QR must be a JPEG, PNG, or WebP image.'], 422);
            }
            $storage = __DIR__ . '/../storage/payment-qr';
            if (!is_dir($storage) && !mkdir($storage, 0750, true) && !is_dir($storage)) {
                throw new RuntimeException('Payment QR storage is unavailable.');
            }
            $storedName = bin2hex(random_bytes(24)) . '.' . $extensions[$mime];
            if (!move_uploaded_file($_FILES['image']['tmp_name'], $storage . '/' . $storedName)) {
                throw new RuntimeException('Payment QR image could not be stored.');
            }
        }

        try {
            if ($current) {
                $update = $pdo->prepare(
                    'UPDATE payment_qr_codes SET provider = ?, account_name = ?, account_number = ?, qr_image_path = ?, created_by_user_id = ? WHERE qr_code_id = ?'
                );
                $update->execute([$provider, $accountName, $accountNumber, $storedName, $actor['id'], $current['qr_code_id']]);
                $id = $current['qr_code_id'];
            } else {
                $id = uuid_v4();
                $insert = $pdo->prepare(
                    'INSERT INTO payment_qr_codes (qr_code_id, provider, account_name, account_number, qr_image_path, created_by_user_id) VALUES (?, ?, ?, ?, ?, ?)'
                );
                $insert->execute([$id, $provider, $accountName, $accountNumber, $storedName, $actor['id']]);
            }
        } catch (Throwable $error) {
            if ($storedName && $storedName !== $oldStoredName) @unlink(__DIR__ . '/../storage/payment-qr/' . $storedName);
            throw $error;
        }
        if ($oldStoredName && $storedName !== $oldStoredName) {
            @unlink(__DIR__ . '/../storage/payment-qr/' . basename($oldStoredName));
        }
        audit_log($pdo, $actor['id'], 'payment_qr.update', 'payment_qr', $id, null, ['provider' => $provider, 'accountName' => $accountName]);
        json_response(['success' => true]);
    }

    if ($resource === 'facilities') {
        $actor = require_auth($pdo, ['admin']);
        if ($action !== 'save') {
            json_response(['error' => 'Invalid facility action.'], 400);
        }
        $id = optional_string($input, 'id', 36);
        $name = required_string($input, 'name', 120, 'Facility name');
        $description = optional_string($input, 'description', 1000);
        $capacity = filter_var($input['capacity'] ?? null, FILTER_VALIDATE_INT);
        if ($capacity === false || $capacity < 1 || $capacity > 100000) {
            json_response(['error' => 'Enter a valid facility capacity.'], 422);
        }
        $rate = required_string($input, 'rate', 80, 'Rate label');
        $guestBookable = filter_var($input['guestBookable'] ?? false, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        $isActive = filter_var($input['isActive'] ?? false, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        if ($guestBookable === null || $isActive === null) {
            json_response(['error' => 'Facility availability flags are invalid.'], 422);
        }
        if ($id) {
            $before = fetch_row($pdo, 'SELECT * FROM facilities WHERE facility_id = ?', [$id]);
            if (!$before) json_response(['error' => 'Facility not found.'], 404);
            $update = $pdo->prepare(
                'UPDATE facilities SET name = ?, description = ?, capacity = ?, rate_label = ?, guest_bookable = ?, is_active = ? WHERE facility_id = ?'
            );
            $update->execute([$name, $description, $capacity, $rate, (int) $guestBookable, (int) $isActive, $id]);
        } else {
            $id = uuid_v4();
            $before = null;
            $insert = $pdo->prepare(
                'INSERT INTO facilities (facility_id, name, description, capacity, rate_label, guest_bookable, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)'
            );
            $insert->execute([$id, $name, $description, $capacity, $rate, (int) $guestBookable, (int) $isActive]);
        }
        audit_log($pdo, $actor['id'], 'facility.save', 'facility', $id, $before, [
            'name' => $name, 'capacity' => $capacity, 'rate' => $rate, 'guestBookable' => $guestBookable, 'isActive' => $isActive,
        ]);
        json_response(['success' => true, 'id' => $id]);
    }

    if ($resource === 'concerns') {
        if ($action === 'create') {
            $actor = require_auth($pdo, ['resident']);
            $homeowner = homeowner_for_user($pdo, $actor['id']);
            $restricted = fetch_row($pdo, "SELECT restriction_id FROM access_restrictions WHERE homeowner_id = ? AND restriction_status = 'active' LIMIT 1", [$homeowner['id']]);
            if ($restricted) {
                json_response(['error' => 'Concern submission is restricted until outstanding dues are settled.'], 403);
            }
            $type = required_string($input, 'concernType', 60, 'Concern type');
            $subject = required_string($input, 'subject', 160, 'Subject');
            $description = required_string($input, 'description', 10000, 'Description');
            $id = uuid_v4();
            $insert = $pdo->prepare(
                'INSERT INTO concerns
                 (concern_id, homeowner_id, submitted_by_user_id, concern_type, subject, description)
                 VALUES (?, ?, ?, ?, ?, ?)'
            );
            $insert->execute([$id, $homeowner['id'], $actor['id'], $type, $subject, $description]);
            audit_log($pdo, $actor['id'], 'concern.create', 'concern', $id, null, ['subject' => $subject, 'type' => $type]);
            json_response(['success' => true, 'id' => $id], 201);
        }
        if ($action === 'respond') {
            $actor = require_auth($pdo, ['admin']);
            $id = required_string($input, 'id', 36, 'Concern ID');
            $response = required_string($input, 'response', 10000, 'Response');
            $status = require_choice($input, 'status', ['in-progress', 'resolved']);
            $concern = fetch_row(
                $pdo,
                'SELECT c.*, h.owner_name, h.email FROM concerns c JOIN homeowners h ON h.homeowner_id = c.homeowner_id WHERE c.concern_id = ?',
                [$id]
            );
            if (!$concern) {
                json_response(['error' => 'Concern not found.'], 404);
            }
            $update = $pdo->prepare(
                'UPDATE concerns SET status = ?, admin_response = ?, responded_by_user_id = ?, responded_at = UTC_TIMESTAMP() WHERE concern_id = ?'
            );
            $update->execute([$status, $response, $actor['id'], $id]);
            audit_log($pdo, $actor['id'], 'concern.respond', 'concern', $id, ['status' => $concern['status']], ['status' => $status]);
            $mailSent = safe_notification(
                $pdo, $concern['email'], $concern['owner_name'], 'NovaLink concern update: ' . $concern['subject'],
                "Status: {$status}\n\nOfficial response:\n{$response}", 'concern_update'
            );
            json_response(['success' => true, 'emailDelivered' => $mailSent]);
        }
    }

    if ($resource === 'vehicles') {
        if ($action === 'create') {
            $actor = require_auth($pdo, ['resident']);
            $homeowner = homeowner_for_user($pdo, $actor['id']);
            $type = required_string($input, 'vehicleType', 50, 'Vehicle type');
            $makeModel = required_string($input, 'makeModel', 120, 'Make and model');
            $plate = strtoupper(required_string($input, 'plateNumber', 30, 'Plate number'));
            $color = required_string($input, 'color', 50, 'Color');
            $id = uuid_v4();
            $insert = $pdo->prepare(
                'INSERT INTO vehicles
                 (vehicle_id, homeowner_id, submitted_by_user_id, vehicle_type, make_model, plate_number, color)
                 VALUES (?, ?, ?, ?, ?, ?, ?)'
            );
            $insert->execute([$id, $homeowner['id'], $actor['id'], $type, $makeModel, $plate, $color]);
            audit_log($pdo, $actor['id'], 'vehicle.create', 'vehicle', $id, null, ['plateNumber' => $plate]);
            json_response(['success' => true, 'id' => $id], 201);
        }
        if ($action === 'review') {
            $actor = require_auth($pdo, ['admin']);
            $id = required_string($input, 'id', 36, 'Vehicle ID');
            $status = require_choice($input, 'status', ['approved', 'rejected']);
            $vehicle = fetch_row(
                $pdo,
                'SELECT v.*, h.owner_name, h.email FROM vehicles v JOIN homeowners h ON h.homeowner_id = v.homeowner_id WHERE v.vehicle_id = ?',
                [$id]
            );
            if (!$vehicle) {
                json_response(['error' => 'Vehicle not found.'], 404);
            }
            $update = $pdo->prepare(
                'UPDATE vehicles SET approval_status = ?, reviewed_by_user_id = ?, reviewed_at = UTC_TIMESTAMP() WHERE vehicle_id = ?'
            );
            $update->execute([$status, $actor['id'], $id]);
            audit_log($pdo, $actor['id'], 'vehicle.review', 'vehicle', $id, ['status' => $vehicle['approval_status']], ['status' => $status]);
            $mailSent = safe_notification(
                $pdo, $vehicle['email'], $vehicle['owner_name'], 'NovaLink vehicle review update',
                "Vehicle {$vehicle['make_model']} ({$vehicle['plate_number']}) was {$status}.", 'vehicle_update'
            );
            json_response(['success' => true, 'emailDelivered' => $mailSent]);
        }
    }

    if ($resource === 'stickers') {
        if ($action === 'set-period') {
            $actor = require_auth($pdo, ['admin']);
            $period = required_string($input, 'period', 20, 'Renewal period');
            if (!preg_match('/^(\d{4})-(\d{4})$/', $period, $matches) || (int) $matches[2] !== (int) $matches[1] + 1) {
                json_response(['error' => 'Renewal period must look like 2026-2027 with consecutive years.'], 422);
            }
            $update = $pdo->prepare(
                "INSERT INTO system_settings (setting_key, setting_value, updated_by_user_id)
                 VALUES ('sticker_renewal_period', ?, ?)
                 ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by_user_id = VALUES(updated_by_user_id)"
            );
            $update->execute([$period, $actor['id']]);
            audit_log($pdo, $actor['id'], 'sticker.period_update', 'system_setting', 'sticker_renewal_period', null, ['period' => $period]);
            json_response(['success' => true]);
        }
        if ($action === 'create') {
            $actor = require_auth($pdo, ['resident']);
            $homeowner = homeowner_for_user($pdo, $actor['id']);
            $restricted = fetch_row($pdo, "SELECT restriction_id FROM access_restrictions WHERE homeowner_id = ? AND restriction_status = 'active' LIMIT 1", [$homeowner['id']]);
            if ($restricted) {
                json_response(['error' => 'Sticker renewal is restricted until outstanding dues are settled.'], 403);
            }
            $vehicleId = required_string($input, 'vehicleId', 36, 'Vehicle ID');
            $vehicle = fetch_row(
                $pdo,
                "SELECT vehicle_id FROM vehicles WHERE vehicle_id = ? AND homeowner_id = ? AND approval_status = 'approved'",
                [$vehicleId, $homeowner['id']]
            );
            if (!$vehicle) {
                json_response(['error' => 'Only an approved vehicle linked to your homeowner record is eligible.'], 422);
            }
            $period = system_setting($pdo, 'sticker_renewal_period', gmdate('Y') . '-' . ((int) gmdate('Y') + 1));
            $existing = fetch_row(
                $pdo,
                'SELECT renewal_id, status FROM vehicle_sticker_renewals WHERE vehicle_id = ? AND renewal_period = ? LIMIT 1',
                [$vehicleId, $period]
            );
            if ($existing) {
                json_response(['error' => "This vehicle already has a {$existing['status']} renewal for {$period}."], 409);
            }
            $id = uuid_v4();
            $insert = $pdo->prepare(
                'INSERT INTO vehicle_sticker_renewals
                 (renewal_id, vehicle_id, homeowner_id, requested_by_user_id, renewal_period)
                 VALUES (?, ?, ?, ?, ?)'
            );
            $insert->execute([$id, $vehicleId, $homeowner['id'], $actor['id'], $period]);
            audit_log($pdo, $actor['id'], 'sticker.create', 'sticker_renewal', $id, null, ['vehicleId' => $vehicleId]);
            json_response(['success' => true, 'id' => $id], 201);
        }
        if ($action === 'review') {
            $actor = require_auth($pdo, ['admin']);
            $id = required_string($input, 'id', 36, 'Renewal ID');
            $status = require_choice($input, 'status', ['approved', 'rejected']);
            $renewal = fetch_row(
                $pdo,
                'SELECT sr.*, h.owner_name, h.email, v.make_model, v.plate_number
                 FROM vehicle_sticker_renewals sr
                 JOIN homeowners h ON h.homeowner_id = sr.homeowner_id
                 JOIN vehicles v ON v.vehicle_id = sr.vehicle_id
                 WHERE sr.renewal_id = ?',
                [$id]
            );
            if (!$renewal) {
                json_response(['error' => 'Sticker renewal not found.'], 404);
            }
            $stickerNumber = $status === 'approved' ? create_sticker_number($pdo, $renewal['renewal_period']) : null;
            $update = $pdo->prepare(
                'UPDATE vehicle_sticker_renewals
                 SET status = ?, sticker_number = ?, reviewed_by_user_id = ?, reviewed_at = UTC_TIMESTAMP()
                 WHERE renewal_id = ?'
            );
            $update->execute([$status, $stickerNumber, $actor['id'], $id]);
            audit_log($pdo, $actor['id'], 'sticker.review', 'sticker_renewal', $id, ['status' => $renewal['status']], ['status' => $status, 'stickerNumber' => $stickerNumber]);
            $message = $status === 'approved'
                ? "Your sticker renewal for {$renewal['make_model']} ({$renewal['plate_number']}) was approved. Sticker number: {$stickerNumber}."
                : "Your sticker renewal for {$renewal['make_model']} ({$renewal['plate_number']}) was rejected. Contact the NHAI office for details.";
            $mailSent = safe_notification($pdo, $renewal['email'], $renewal['owner_name'], 'NovaLink sticker renewal update', $message, 'sticker_update');
            json_response(['success' => true, 'stickerNumber' => $stickerNumber, 'emailDelivered' => $mailSent]);
        }
    }

    json_response(['error' => 'Unknown resource or action.'], 400);
} catch (PDOException $error) {
    if ($error->getCode() === '23000') {
        json_response(['error' => 'That record conflicts with an existing unique value.'], 409);
    }
    api_exception($error);
} catch (Throwable $error) {
    api_exception($error);
}
