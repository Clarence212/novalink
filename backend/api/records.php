<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/bootstrap.php';
require_once __DIR__ . '/../lib/state_repository.php';
require_once __DIR__ . '/../services/EmailService.php';

function homeowner_for_user(PDO $pdo, string $userId): array
{
    $statement = $pdo->prepare(
        "SELECT homeowner_id AS id, owner_name AS ownerName, email
         FROM homeowners WHERE user_id = ? AND record_status = 'active' LIMIT 1"
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
            if ($role === 'resident' && !$homeownerId) {
                json_response(['error' => 'Resident accounts must be linked to an unlinked homeowner record.'], 422);
            }
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
                        "UPDATE homeowners SET user_id = ? WHERE homeowner_id = ? AND user_id IS NULL AND record_status = 'active'"
                    );
                    $link->execute([$id, $homeownerId]);
                    if ($link->rowCount() !== 1) {
                        throw new RuntimeException('The selected homeowner record is unavailable or already linked.');
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
            if ($id === $actor['id'] && $status !== 'active') {
                json_response(['error' => 'You cannot deactivate your own active session.'], 422);
            }
            $before = fetch_row($pdo, 'SELECT user_id AS id, email, full_name AS fullName, account_status AS status FROM users WHERE user_id = ?', [$id]);
            if (!$before) {
                json_response(['error' => 'User not found.'], 404);
            }
            $update = $pdo->prepare(
                'UPDATE users SET account_status = ?, approved_by_user_id = ?, approved_at = CASE WHEN ? = \'active\' THEN UTC_TIMESTAMP() ELSE approved_at END WHERE user_id = ?'
            );
            $update->execute([$status, $actor['id'], $status, $id]);
            audit_log($pdo, $actor['id'], 'user.status', 'user', $id, $before, ['status' => $status]);
            $mailSent = safe_notification(
                $pdo, $before['email'], $before['fullName'], 'NovaLink account status updated',
                "Your NovaLink account status is now {$status}. Contact the NHAI office if you have questions.",
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
            if ($id === $actor['id'] && $role !== 'admin') {
                json_response(['error' => 'You cannot remove your own administrator role.'], 422);
            }
            if ($role === 'resident' && !$homeownerId) {
                json_response(['error' => 'Resident accounts must be linked to a homeowner record.'], 422);
            }
            $roleMap = ['admin' => 1, 'security' => 2, 'resident' => 3];
            $before = fetch_row($pdo, 'SELECT user_id AS id, full_name AS fullName, email, role_id AS roleId FROM users WHERE user_id = ?', [$id]);
            if (!$before) {
                json_response(['error' => 'User not found.'], 404);
            }
            $pdo->beginTransaction();
            try {
                $update = $pdo->prepare('UPDATE users SET full_name = ?, email = ?, role_id = ? WHERE user_id = ?');
                $update->execute([$fullName, $email, $roleMap[$role], $id]);
                $pdo->prepare('UPDATE homeowners SET user_id = NULL WHERE user_id = ?')->execute([$id]);
                if ($role === 'resident') {
                    $link = $pdo->prepare("UPDATE homeowners SET user_id = ? WHERE homeowner_id = ? AND user_id IS NULL AND record_status = 'active'");
                    $link->execute([$id, $homeownerId]);
                    if ($link->rowCount() !== 1) throw new RuntimeException('The selected homeowner record is unavailable or already linked.');
                }
                $pdo->commit();
            } catch (Throwable $error) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                throw $error;
            }
            audit_log($pdo, $actor['id'], 'user.update', 'user', $id, $before, ['fullName' => $fullName, 'email' => $email, 'role' => $role]);
            json_response(['success' => true]);
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
            $insert = $pdo->prepare(
                'INSERT INTO visitor_logs
                 (visitor_log_id, visitor_name, contact_number, purpose, destination_address, vehicle_plate, recorded_by_user_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?)'
            );
            $insert->execute([$id, $visitorName, $contactNumber, $purpose, $destination, $plate, $actor['id']]);
            audit_log($pdo, $actor['id'], 'visitor.create', 'visitor_log', $id, null, ['visitorName' => $visitorName]);
            json_response(['success' => true, 'id' => $id], 201);
        }
        if ($action === 'exit') {
            $id = required_string($input, 'id', 36, 'Visitor log ID');
            $update = $pdo->prepare(
                'UPDATE visitor_logs SET exit_time = UTC_TIMESTAMP(), updated_by_user_id = ? WHERE visitor_log_id = ? AND exit_time IS NULL'
            );
            $update->execute([$actor['id'], $id]);
            if ($update->rowCount() !== 1) {
                json_response(['error' => 'Active visitor entry not found.'], 404);
            }
            audit_log($pdo, $actor['id'], 'visitor.exit', 'visitor_log', $id);
            json_response(['success' => true]);
        }
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
        if ($action === 'submit') {
            $actor = require_auth($pdo, ['resident']);
            $homeowner = homeowner_for_user($pdo, $actor['id']);
            $amount = filter_var($input['amount'] ?? null, FILTER_VALIDATE_FLOAT);
            if ($amount === false || $amount <= 0 || $amount > 1_000_000) {
                json_response(['error' => 'Enter a valid payment amount.'], 422);
            }
            $reference = required_string($input, 'reference', 120, 'Payment reference');
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

            try {
                $id = uuid_v4();
                $insert = $pdo->prepare(
                    'INSERT INTO payments
                     (payment_id, homeowner_id, submitted_by_user_id, amount_paid, payment_reference,
                      proof_stored_name, proof_original_name, proof_mime_type, proof_file_size, payment_date)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_DATE())'
                );
                $insert->execute([
                    $id, $homeowner['id'], $actor['id'], $amount, $reference, $storedName,
                    basename((string) $file['name']), $mime, (int) $file['size'],
                ]);
            } catch (Throwable $error) {
                @unlink($target);
                throw $error;
            }
            audit_log($pdo, $actor['id'], 'payment.submit', 'payment', $id, null, ['amount' => $amount, 'reference' => $reference]);
            json_response(['success' => true, 'id' => $id], 201);
        }

        if ($action === 'validate') {
            $actor = require_auth($pdo, ['admin']);
            $id = required_string($input, 'id', 36, 'Payment ID');
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
                $dues = $pdo->prepare(
                    "SELECT dues_id, amount_due, penalty_amount FROM dues
                     WHERE homeowner_id = ? AND status = 'unpaid' ORDER BY billing_month FOR UPDATE"
                );
                $dues->execute([$payment['homeowner_id']]);
                $remaining = (float) $payment['amount_paid'];
                $paidCount = 0;
                foreach ($dues->fetchAll() as $due) {
                    if ($remaining <= 0.00001) break;
                    $allocated = $pdo->prepare('SELECT COALESCE(SUM(amount_applied), 0) FROM payment_allocations WHERE dues_id = ?');
                    $allocated->execute([$due['dues_id']]);
                    $required = max(0.0, (float) $due['amount_due'] + (float) $due['penalty_amount'] - (float) $allocated->fetchColumn());
                    if ($required <= 0.00001) continue;
                    $applied = min($remaining, $required);
                    $allocation = $pdo->prepare(
                        'INSERT INTO payment_allocations (allocation_id, payment_id, dues_id, amount_applied) VALUES (?, ?, ?, ?)'
                    );
                    $allocation->execute([uuid_v4(), $id, $due['dues_id'], $applied]);
                    if ($applied + 0.00001 >= $required) {
                        $markPaid = $pdo->prepare("UPDATE dues SET status = 'paid', penalty_amount = 0 WHERE dues_id = ?");
                        $markPaid->execute([$due['dues_id']]);
                        $paidCount++;
                    }
                    $remaining -= $applied;
                }
                $update = $pdo->prepare(
                    "UPDATE payments SET validation_status = 'validated', unallocated_amount = ?, validated_by_user_id = ?, validated_at = UTC_TIMESTAMP() WHERE payment_id = ?"
                );
                $update->execute([max(0, $remaining), $actor['id'], $id]);
                $pdo->commit();
                refresh_financial_state($pdo);
                audit_log($pdo, $actor['id'], 'payment.validate', 'payment', $id, ['status' => 'pending'], ['status' => 'validated', 'duesPaid' => $paidCount]);
                $homeowner = fetch_row($pdo, 'SELECT owner_name, email FROM homeowners WHERE homeowner_id = ?', [$payment['homeowner_id']]);
                $mailSent = $homeowner ? safe_notification(
                    $pdo, $homeowner['email'], $homeowner['owner_name'], 'NovaLink payment validated',
                    "Your payment reference {$payment['payment_reference']} was validated. {$paidCount} billing record(s) were settled.",
                    'payment_update'
                ) : false;
                json_response(['success' => true, 'duesPaid' => $paidCount, 'unallocatedAmount' => round($remaining, 2), 'emailDelivered' => $mailSent]);
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
            $payment = fetch_row(
                $pdo,
                "SELECT p.*, h.owner_name, h.email FROM payments p JOIN homeowners h ON h.homeowner_id = p.homeowner_id
                 WHERE p.payment_id = ? AND p.validation_status = 'pending'",
                [$id]
            );
            if (!$payment) {
                json_response(['error' => 'Pending payment not found.'], 404);
            }
            $update = $pdo->prepare(
                "UPDATE payments SET validation_status = 'rejected', validated_by_user_id = ?, validated_at = UTC_TIMESTAMP() WHERE payment_id = ?"
            );
            $update->execute([$actor['id'], $id]);
            audit_log($pdo, $actor['id'], 'payment.reject', 'payment', $id, ['status' => 'pending'], ['status' => 'rejected']);
            $mailSent = safe_notification(
                $pdo, $payment['email'], $payment['owner_name'], 'NovaLink payment proof rejected',
                "Your payment proof with reference {$payment['payment_reference']} was rejected. Please review the details and submit a valid proof or contact the NHAI office.",
                'payment_update'
            );
            json_response(['success' => true, 'emailDelivered' => $mailSent]);
        }

        if ($action === 'remind') {
            $actor = require_auth($pdo, ['admin']);
            $homeownerId = optional_string($input, 'homeownerId', 36);
            $sql =
                "SELECT h.homeowner_id, h.owner_name, h.email, COUNT(d.dues_id) AS unpaidCount,
                        SUM(d.amount_due + d.penalty_amount) AS totalOwed
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
