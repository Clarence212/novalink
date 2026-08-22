<?php
declare(strict_types=1);

function system_setting(PDO $pdo, string $key, string $default): string
{
    $statement = $pdo->prepare('SELECT setting_value FROM system_settings WHERE setting_key = ? LIMIT 1');
    $statement->execute([$key]);
    $value = $statement->fetchColumn();
    return $value === false ? $default : (string) $value;
}

function refresh_financial_state(PDO $pdo): void
{
    $penalty = (float) system_setting($pdo, 'monthly_penalty_amount', '200.00');
    $threshold = max(1, (int) system_setting($pdo, 'restrict_after_unpaid_months', '2'));

    $statement = $pdo->prepare(
        "UPDATE dues
         SET penalty_amount = CASE
             WHEN status = 'unpaid' AND due_date < CURRENT_DATE()
             THEN GREATEST(1, TIMESTAMPDIFF(MONTH, due_date, CURRENT_DATE()) + 1) * ?
             ELSE 0
         END"
    );
    $statement->execute([$penalty]);

    $restrict = $pdo->prepare(
        "INSERT INTO access_restrictions (restriction_id, homeowner_id, reason, restriction_status)
         SELECT UUID(), overdue.homeowner_id, 'Two or more overdue monthly dues', 'active'
         FROM (
             SELECT homeowner_id FROM dues
             WHERE status = 'unpaid' AND due_date < CURRENT_DATE()
             GROUP BY homeowner_id HAVING COUNT(*) >= ?
         ) overdue
         WHERE NOT EXISTS (
                SELECT 1 FROM access_restrictions ar
                WHERE ar.homeowner_id = overdue.homeowner_id AND ar.restriction_status = 'active'
         )"
    );
    $restrict->execute([$threshold]);

    $lift = $pdo->prepare(
        "UPDATE access_restrictions ar
         SET ar.restriction_status = 'lifted', ar.lifted_at = UTC_TIMESTAMP()
         WHERE ar.restriction_status = 'active'
           AND (SELECT COUNT(*) FROM dues d WHERE d.homeowner_id = ar.homeowner_id AND d.status = 'unpaid' AND d.due_date < CURRENT_DATE()) < ?"
    );
    $lift->execute([$threshold]);
}

function fetch_users(PDO $pdo): array
{
    $rows = $pdo->query(
        "SELECT u.user_id AS id, r.role_name AS role, u.full_name AS fullName,
                u.email, u.account_status AS status, u.email_verified AS emailVerified,
                u.force_password_change AS forcePasswordChange, h.homeowner_id AS homeownerId,
                u.last_login_at AS lastLoginAt, u.created_at AS createdAt
         FROM users u
         JOIN roles r ON r.role_id = u.role_id
         LEFT JOIN homeowners h ON h.user_id = u.user_id AND h.record_status = 'active'
         ORDER BY u.created_at DESC"
    )->fetchAll();
    foreach ($rows as &$row) {
        $row['emailVerified'] = (bool) $row['emailVerified'];
        $row['forcePasswordChange'] = (bool) $row['forcePasswordChange'];
    }
    return $rows;
}

function fetch_homeowners(PDO $pdo, ?string $homeownerId = null): array
{
    $sql =
        "SELECT h.homeowner_id AS id, h.user_id AS userId, h.owner_name AS ownerName,
                h.block_lot AS blockLot, h.street, h.contact_number AS contactNumber,
                h.email, h.record_status AS recordStatus,
                (SELECT COUNT(*) FROM dues d WHERE d.homeowner_id = h.homeowner_id AND d.status = 'unpaid') AS unpaidMonths,
                EXISTS(SELECT 1 FROM access_restrictions ar WHERE ar.homeowner_id = h.homeowner_id AND ar.restriction_status = 'active') AS restricted
         FROM homeowners h WHERE h.record_status = 'active'";
    $params = [];
    if ($homeownerId !== null) {
        $sql .= ' AND h.homeowner_id = ?';
        $params[] = $homeownerId;
    }
    $sql .= ' ORDER BY h.owner_name';
    $statement = $pdo->prepare($sql);
    $statement->execute($params);
    $rows = $statement->fetchAll();
    $occupants = $pdo->prepare(
        'SELECT occupant_id AS id, full_name AS fullName, relationship FROM household_occupants WHERE homeowner_id = ? ORDER BY full_name'
    );
    foreach ($rows as &$row) {
        $row['unpaidMonths'] = (int) $row['unpaidMonths'];
        $row['restricted'] = (bool) $row['restricted'];
        $occupants->execute([$row['id']]);
        $row['occupants'] = $occupants->fetchAll();
    }
    return $rows;
}

function fetch_vehicles(PDO $pdo, ?string $homeownerId = null): array
{
    $sql =
        "SELECT vehicle_id AS id, homeowner_id AS homeownerId, submitted_by_user_id AS submittedBy,
                reviewed_by_user_id AS reviewedBy, vehicle_type AS vehicleType, make_model AS makeModel,
                plate_number AS plateNumber, color, approval_status AS approvalStatus,
                created_at AS createdAt, reviewed_at AS reviewedAt
         FROM vehicles";
    $params = [];
    if ($homeownerId !== null) {
        $sql .= ' WHERE homeowner_id = ?';
        $params[] = $homeownerId;
    }
    $sql .= ' ORDER BY created_at DESC';
    $statement = $pdo->prepare($sql);
    $statement->execute($params);
    return $statement->fetchAll();
}

function fetch_sticker_renewals(PDO $pdo, ?string $homeownerId = null): array
{
    $sql =
        "SELECT renewal_id AS id, vehicle_id AS vehicleId, homeowner_id AS homeownerId,
                requested_by_user_id AS requestedBy, reviewed_by_user_id AS reviewedBy,
                renewal_period AS renewalPeriod, status, sticker_number AS stickerNumber,
                requested_at AS requestedAt, reviewed_at AS approvedAt
         FROM vehicle_sticker_renewals";
    $params = [];
    if ($homeownerId !== null) {
        $sql .= ' WHERE homeowner_id = ?';
        $params[] = $homeownerId;
    }
    $sql .= ' ORDER BY requested_at DESC';
    $statement = $pdo->prepare($sql);
    $statement->execute($params);
    return $statement->fetchAll();
}

function fetch_facilities(PDO $pdo, bool $includeInactive = false, bool $guestOnly = false): array
{
    $where = [];
    if (!$includeInactive) {
        $where[] = 'is_active = 1';
    }
    if ($guestOnly) {
        $where[] = 'guest_bookable = 1';
    }
    $sql =
        "SELECT facility_id AS id, name, description, capacity, rate_label AS rate,
                guest_bookable AS guestBookable, is_active AS isActive
         FROM facilities" . ($where ? ' WHERE ' . implode(' AND ', $where) : '') . ' ORDER BY name';
    $rows = $pdo->query($sql)->fetchAll();
    foreach ($rows as &$row) {
        $row['capacity'] = (int) $row['capacity'];
        $row['guestBookable'] = (bool) $row['guestBookable'];
        $row['isActive'] = (bool) $row['isActive'];
    }
    return $rows;
}

function fetch_reservations(PDO $pdo, ?string $homeownerId = null): array
{
    $sql =
        "SELECT reservation_id AS id, facility_id AS facilityId, homeowner_id AS homeownerId,
                guest_id AS guestId, requester_type AS requesterType, requester_name AS requesterName,
                requester_email AS requesterEmail, reservation_date AS date, time_slot AS timeSlot,
                purpose, status, reviewed_by_user_id AS approvedBy, created_at AS createdAt
         FROM facility_reservations";
    $params = [];
    if ($homeownerId !== null) {
        $sql .= ' WHERE homeowner_id = ?';
        $params[] = $homeownerId;
    }
    $sql .= ' ORDER BY reservation_date DESC, created_at DESC';
    $statement = $pdo->prepare($sql);
    $statement->execute($params);
    return $statement->fetchAll();
}

function fetch_dues(PDO $pdo, ?string $homeownerId = null): array
{
    $sql =
        "SELECT dues_id AS id, homeowner_id AS homeownerId,
                DATE_FORMAT(billing_month, '%M %Y') AS billingMonth,
                amount_due AS amountDue, penalty_amount AS penaltyAmount,
                COALESCE((SELECT SUM(pa.amount_applied) FROM payment_allocations pa WHERE pa.dues_id = dues.dues_id), 0) AS amountApplied,
                GREATEST(0, amount_due + penalty_amount - COALESCE((SELECT SUM(pa.amount_applied) FROM payment_allocations pa WHERE pa.dues_id = dues.dues_id), 0)) AS balanceDue,
                due_date AS dueDate, status
         FROM dues";
    $params = [];
    if ($homeownerId !== null) {
        $sql .= ' WHERE homeowner_id = ?';
        $params[] = $homeownerId;
    }
    $sql .= ' ORDER BY billing_month ASC';
    $statement = $pdo->prepare($sql);
    $statement->execute($params);
    $rows = $statement->fetchAll();
    foreach ($rows as &$row) {
        $row['amountDue'] = (float) $row['amountDue'];
        $row['penaltyAmount'] = (float) $row['penaltyAmount'];
        $row['amountApplied'] = (float) $row['amountApplied'];
        $row['balanceDue'] = (float) $row['balanceDue'];
    }
    return $rows;
}

function fetch_payments(PDO $pdo, ?string $homeownerId = null): array
{
    $sql =
        "SELECT payment_id AS id, homeowner_id AS homeownerId, submitted_by_user_id AS submittedBy,
                validated_by_user_id AS validatedBy, amount_paid AS amountPaid,
                unallocated_amount AS unallocatedAmount,
                payment_reference AS paymentReference,
                CONCAT('/backend/api/files.php?paymentId=', payment_id) AS proofImage,
                validation_status AS validationStatus, payment_date AS paymentDate,
                validated_at AS validatedAt, created_at AS createdAt
         FROM payments";
    $params = [];
    if ($homeownerId !== null) {
        $sql .= ' WHERE homeowner_id = ?';
        $params[] = $homeownerId;
    }
    $sql .= ' ORDER BY created_at DESC';
    $statement = $pdo->prepare($sql);
    $statement->execute($params);
    $rows = $statement->fetchAll();
    foreach ($rows as &$row) {
        $row['amountPaid'] = (float) $row['amountPaid'];
        $row['unallocatedAmount'] = (float) $row['unallocatedAmount'];
    }
    return $rows;
}

function fetch_visitor_logs(PDO $pdo): array
{
    return $pdo->query(
        "SELECT visitor_log_id AS id, visitor_name AS visitorName, contact_number AS contactNumber,
                purpose, destination_address AS destinationAddress, vehicle_plate AS vehiclePlate,
                entry_time AS entryTime, exit_time AS exitTime, recorded_by_user_id AS recordedBy
         FROM visitor_logs ORDER BY entry_time DESC LIMIT 2000"
    )->fetchAll();
}

function fetch_concerns(PDO $pdo, ?string $homeownerId = null): array
{
    $sql =
        "SELECT concern_id AS id, homeowner_id AS homeownerId, submitted_by_user_id AS submittedBy,
                responded_by_user_id AS respondedBy, concern_type AS concernType, subject,
                description, status, admin_response AS adminResponse,
                submitted_at AS submittedAt, responded_at AS respondedAt
         FROM concerns";
    $params = [];
    if ($homeownerId !== null) {
        $sql .= ' WHERE homeowner_id = ?';
        $params[] = $homeownerId;
    }
    $sql .= ' ORDER BY submitted_at DESC';
    $statement = $pdo->prepare($sql);
    $statement->execute($params);
    return $statement->fetchAll();
}

function fetch_announcements(PDO $pdo, bool $includeNonPublished = false): array
{
    $where = $includeNonPublished ? '' : " WHERE status = 'published'";
    return $pdo->query(
        "SELECT announcement_id AS id, posted_by_user_id AS postedBy, title, content,
                priority, status, COALESCE(published_at, created_at) AS datePosted
         FROM announcements{$where} ORDER BY COALESCE(published_at, created_at) DESC"
    )->fetchAll();
}

function fetch_notifications(PDO $pdo): array
{
    return $pdo->query(
        "SELECT notification_id AS id, recipient_email AS `to`, subject, message_text AS body,
                delivery_status AS status, COALESCE(sent_at, created_at) AS sentAt,
                failure_reason AS failureReason
         FROM notifications ORDER BY created_at DESC LIMIT 500"
    )->fetchAll();
}

function fetch_payment_qr(PDO $pdo): array
{
    $row = $pdo->query(
        "SELECT provider, account_name AS gcashName, account_number AS gcashNumber,
                CASE WHEN qr_image_path IS NULL THEN NULL ELSE '/backend/api/files.php?type=payment-qr' END AS imagePath
         FROM payment_qr_codes WHERE is_active = 1 ORDER BY updated_at DESC LIMIT 1"
    )->fetch();
    return $row ?: ['provider' => 'GCash', 'gcashName' => 'Not configured', 'gcashNumber' => '', 'imagePath' => null];
}

function fetch_application_state(PDO $pdo, array $user): array
{
    refresh_financial_state($pdo);
    $role = $user['role'];
    $homeownerId = $role === 'resident' ? ($user['homeownerId'] ?: '__unlinked__') : null;
    $state = [
        'users' => $role === 'admin' ? fetch_users($pdo) : [],
        'homeowners' => $role === 'admin' ? fetch_homeowners($pdo) : ($role === 'resident' ? fetch_homeowners($pdo, $homeownerId) : []),
        'vehicles' => $role === 'admin' ? fetch_vehicles($pdo) : ($role === 'resident' ? fetch_vehicles($pdo, $homeownerId) : []),
        'reservations' => $role === 'admin' ? fetch_reservations($pdo) : ($role === 'resident' ? fetch_reservations($pdo, $homeownerId) : []),
        'dues' => $role === 'admin' ? fetch_dues($pdo) : ($role === 'resident' ? fetch_dues($pdo, $homeownerId) : []),
        'payments' => $role === 'admin' ? fetch_payments($pdo) : ($role === 'resident' ? fetch_payments($pdo, $homeownerId) : []),
        'visitorLogs' => in_array($role, ['admin', 'security'], true) ? fetch_visitor_logs($pdo) : [],
        'concerns' => $role === 'admin' ? fetch_concerns($pdo) : ($role === 'resident' ? fetch_concerns($pdo, $homeownerId) : []),
        'announcements' => fetch_announcements($pdo, $role === 'admin'),
        'stickerRenewals' => $role === 'admin' ? fetch_sticker_renewals($pdo) : ($role === 'resident' ? fetch_sticker_renewals($pdo, $homeownerId) : []),
        'facilities' => fetch_facilities($pdo, $role === 'admin'),
        'emailLog' => $role === 'admin' ? fetch_notifications($pdo) : [],
        'paymentQRCode' => $role === 'resident' || $role === 'admin' ? fetch_payment_qr($pdo) : [],
        'stickerRenewalPeriod' => system_setting($pdo, 'sticker_renewal_period', gmdate('Y') . '-' . ((int) gmdate('Y') + 1)),
    ];
    return $state;
}
