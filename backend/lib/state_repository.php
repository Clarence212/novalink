<?php
declare(strict_types=1);

function system_setting(PDO $pdo, string $key, string $default): string
{
    $statement = $pdo->prepare('SELECT setting_value FROM system_settings WHERE setting_key = ? LIMIT 1');
    $statement->execute([$key]);
    $value = $statement->fetchColumn();
    return $value === false ? $default : (string) $value;
}

function ensure_current_month_dues(PDO $pdo): int
{
    $billingMonth = gmdate('Y-m-01');
    $amount = max(0.01, (float) system_setting($pdo, 'monthly_due_amount', '1500.00'));
    $configuredDay = max(1, min(31, (int) system_setting($pdo, 'monthly_due_day', '15')));
    $daysInMonth = (int) (new DateTimeImmutable($billingMonth, new DateTimeZone('UTC')))->format('t');
    $dueDay = min($configuredDay, $daysInMonth);
    $dueDate = substr($billingMonth, 0, 8) . str_pad((string) $dueDay, 2, '0', STR_PAD_LEFT);
    $insert = $pdo->prepare(
        "INSERT INTO dues (dues_id, homeowner_id, billing_month, amount_due, due_date)
         SELECT UUID(), homeowner_id, ?, ?, ? FROM homeowners WHERE record_status = 'active'
         ON DUPLICATE KEY UPDATE dues_id = dues_id"
    );
    $insert->execute([$billingMonth, $amount, $dueDate]);
    return $insert->rowCount();
}

function refresh_financial_state(PDO $pdo): void
{
    ensure_current_month_dues($pdo);
    $penalty = (float) system_setting($pdo, 'monthly_penalty_amount', '200.00');
    $threshold = max(1, (int) system_setting($pdo, 'restrict_after_unpaid_months', '2'));

    $statement = $pdo->prepare(
        "UPDATE dues
         SET penalty_amount = CASE
             WHEN due_date < CURRENT_DATE()
             THEN GREATEST(1, TIMESTAMPDIFF(MONTH, due_date, CURRENT_DATE()) + 1) * ?
             ELSE 0
         END
         WHERE status = 'unpaid'"
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
                u.failed_login_attempts AS failedLoginAttempts, u.locked_until AS lockedUntil,
                u.last_login_at AS lastLoginAt, u.approved_at AS approvedAt,
                approver.full_name AS approvedByName, u.created_at AS createdAt,
                u.updated_at AS updatedAt
         FROM users u
         JOIN roles r ON r.role_id = u.role_id
         LEFT JOIN homeowners h ON h.user_id = u.user_id AND h.record_status = 'active'
         LEFT JOIN users approver ON approver.user_id = u.approved_by_user_id
         ORDER BY u.created_at DESC"
    )->fetchAll();

    $historyRows = $pdo->query(
        "SELECT audit.audit_id AS id, audit.entity_id AS userId, audit.action_name AS action,
                audit.before_json AS beforeJson, audit.after_json AS afterJson,
                audit.ip_address AS ipAddress, audit.user_agent AS userAgent,
                audit.created_at AS createdAt, actor.full_name AS actorName
         FROM audit_logs audit
         LEFT JOIN users actor ON actor.user_id = audit.actor_user_id
         WHERE audit.entity_type = 'user' AND audit.entity_id IS NOT NULL
         ORDER BY audit.created_at DESC
         LIMIT 1500"
    )->fetchAll();
    $historyByUser = [];
    foreach ($historyRows as $history) {
        $userId = (string) $history['userId'];
        if (!isset($historyByUser[$userId])) {
            $historyByUser[$userId] = [];
        }
        if (count($historyByUser[$userId]) >= 30) {
            continue;
        }
        $history['before'] = $history['beforeJson'] ? json_decode((string) $history['beforeJson'], true) : null;
        $history['after'] = $history['afterJson'] ? json_decode((string) $history['afterJson'], true) : null;
        unset($history['beforeJson'], $history['afterJson'], $history['userId']);
        $historyByUser[$userId][] = $history;
    }

    foreach ($rows as &$row) {
        $row['emailVerified'] = (bool) $row['emailVerified'];
        $row['forcePasswordChange'] = (bool) $row['forcePasswordChange'];
        $row['failedLoginAttempts'] = (int) $row['failedLoginAttempts'];
        $row['history'] = $historyByUser[(string) $row['id']] ?? [];
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
                billing_month AS billingMonthDate,
                amount_due AS amountDue, penalty_amount AS penaltyAmount,
                COALESCE((SELECT SUM(pa.amount_applied) FROM payment_allocations pa WHERE pa.dues_id = dues.dues_id), 0) AS amountApplied,
                GREATEST(0, amount_due + penalty_amount - COALESCE((SELECT SUM(pa.amount_applied) FROM payment_allocations pa WHERE pa.dues_id = dues.dues_id), 0)) AS balanceDue,
                due_date AS dueDate, status,
                CASE WHEN status = 'unpaid' THEN GREATEST(0, DATEDIFF(CURRENT_DATE(), due_date)) ELSE 0 END AS daysOverdue
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
        $row['displayStatus'] = $row['status'] === 'unpaid' && $row['amountApplied'] > 0.0
            ? 'partial'
            : $row['status'];
        $daysOverdue = $row['status'] === 'unpaid' && $row['balanceDue'] > 0.0
            ? (int) $row['daysOverdue']
            : 0;
        $row['daysOverdue'] = $daysOverdue;
        $row['agingBucket'] = match (true) {
            $daysOverdue <= 0 => 'Current',
            $daysOverdue <= 30 => '1-30 days',
            $daysOverdue <= 60 => '31-60 days',
            $daysOverdue <= 90 => '61-90 days',
            default => '90+ days',
        };
    }
    return $rows;
}

function fetch_payments(PDO $pdo, ?string $homeownerId = null): array
{
    $sql =
        "SELECT p.payment_id AS id, p.homeowner_id AS homeownerId, p.submitted_by_user_id AS submittedBy,
                p.validated_by_user_id AS validatedBy, p.amount_paid AS amountPaid,
                unallocated_amount AS unallocatedAmount,
                payment_reference AS paymentReference,
                CONCAT('/backend/api/files.php?paymentId=', p.payment_id) AS proofImage,
                CONCAT('/backend/api/receipt.php?paymentId=', p.payment_id) AS receiptUrl,
                p.validation_status AS validationStatus, p.payment_date AS paymentDate,
                p.validated_at AS validatedAt, p.created_at AS createdAt,
                h.owner_name AS homeownerName, h.block_lot AS blockLot,
                validator.full_name AS validatorName
         FROM payments p
         JOIN homeowners h ON h.homeowner_id = p.homeowner_id
         LEFT JOIN users validator ON validator.user_id = p.validated_by_user_id";
    $params = [];
    if ($homeownerId !== null) {
        $sql .= ' WHERE p.homeowner_id = ?';
        $params[] = $homeownerId;
    }
    $sql .= ' ORDER BY p.created_at DESC';
    $statement = $pdo->prepare($sql);
    $statement->execute($params);
    $rows = $statement->fetchAll();
    if (!$rows) {
        return [];
    }
    $paymentIds = array_column($rows, 'id');
    $placeholders = implode(',', array_fill(0, count($paymentIds), '?'));
    $allocationStatement = $pdo->prepare(
        "SELECT pa.payment_id AS paymentId, pa.dues_id AS duesId,
                DATE_FORMAT(d.billing_month, '%M %Y') AS billingMonth,
                pa.amount_applied AS amountApplied
         FROM payment_allocations pa
         JOIN dues d ON d.dues_id = pa.dues_id
         WHERE pa.payment_id IN ({$placeholders})
         ORDER BY d.billing_month"
    );
    $allocationStatement->execute($paymentIds);
    $allocationsByPayment = [];
    foreach ($allocationStatement->fetchAll() as $allocation) {
        $paymentId = (string) $allocation['paymentId'];
        unset($allocation['paymentId']);
        $allocation['amountApplied'] = (float) $allocation['amountApplied'];
        $allocationsByPayment[$paymentId][] = $allocation;
    }
    $auditStatement = $pdo->prepare(
        "SELECT entity_id AS paymentId, action_name AS action, after_json AS afterJson,
                created_at AS createdAt
         FROM audit_logs
         WHERE entity_type = 'payment' AND entity_id IN ({$placeholders})
           AND action_name IN ('payment.reject', 'payment.resubmit')
         ORDER BY created_at DESC, audit_id DESC"
    );
    $auditStatement->execute($paymentIds);
    $auditsByPayment = [];
    foreach ($auditStatement->fetchAll() as $audit) {
        $auditsByPayment[(string) $audit['paymentId']][] = $audit;
    }
    foreach ($rows as &$row) {
        $row['amountPaid'] = (float) $row['amountPaid'];
        $row['unallocatedAmount'] = (float) $row['unallocatedAmount'];
        $row['allocations'] = $allocationsByPayment[(string) $row['id']] ?? [];
        $row['amountAllocated'] = array_reduce(
            $row['allocations'],
            static fn(float $sum, array $allocation): float => $sum + $allocation['amountApplied'],
            0.0
        );
        $row['rejectionReason'] = null;
        $row['resubmissionCount'] = 0;
        $row['lastResubmittedAt'] = null;
        foreach ($auditsByPayment[(string) $row['id']] ?? [] as $audit) {
            $details = $audit['afterJson'] ? json_decode((string) $audit['afterJson'], true) : [];
            if ($audit['action'] === 'payment.reject' && $row['rejectionReason'] === null) {
                $row['rejectionReason'] = is_array($details) ? ($details['reason'] ?? null) : null;
            }
            if ($audit['action'] === 'payment.resubmit') {
                $row['resubmissionCount']++;
                $row['lastResubmittedAt'] ??= $audit['createdAt'];
            }
        }
    }
    return $rows;
}

function visitor_passes_available(PDO $pdo): bool
{
    static $available = null;
    if ($available !== null) {
        return $available;
    }
    $requiredColumns = [
        'visitor_pass_id', 'pass_code', 'homeowner_id', 'created_by_user_id',
        'visitor_name', 'contact_number', 'purpose', 'vehicle_plate', 'visit_date',
        'pass_status', 'visitor_log_id', 'redeemed_by_user_id', 'redeemed_at',
        'cancelled_at', 'created_at',
    ];
    $placeholders = implode(',', array_fill(0, count($requiredColumns), '?'));
    $statement = $pdo->prepare(
        "SELECT COUNT(*) FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'visitor_passes'
           AND COLUMN_NAME IN ({$placeholders})"
    );
    $statement->execute($requiredColumns);
    $available = (int) $statement->fetchColumn() === count($requiredColumns);
    return $available;
}

function fetch_visitor_logs(PDO $pdo): array
{
    $passColumns = visitor_passes_available($pdo)
        ? "CASE WHEN vp.visitor_pass_id IS NULL THEN 'gate_entry' ELSE 'resident_pass' END AS entrySource,
           h.owner_name AS hostName, h.block_lot AS hostBlockLot"
        : "'gate_entry' AS entrySource, NULL AS hostName, NULL AS hostBlockLot";
    $passJoins = visitor_passes_available($pdo)
        ? ' LEFT JOIN visitor_passes vp ON vp.visitor_log_id = v.visitor_log_id
            LEFT JOIN homeowners h ON h.homeowner_id = vp.homeowner_id'
        : '';
    return $pdo->query(
        "SELECT v.visitor_log_id AS id, v.visitor_name AS visitorName,
                v.contact_number AS contactNumber, v.purpose,
                v.destination_address AS destinationAddress, v.vehicle_plate AS vehiclePlate,
                v.entry_time AS entryTime, v.exit_time AS exitTime,
                DATE_FORMAT(DATE_ADD(v.entry_time, INTERVAL 8 HOUR), '%Y-%m-%d') AS entryDate,
                DATE_FORMAT(DATE_ADD(v.entry_time, INTERVAL 8 HOUR), '%b %e, %Y %l:%i %p') AS entryTimeDisplay,
                CASE WHEN v.exit_time IS NULL THEN NULL
                     ELSE DATE_FORMAT(DATE_ADD(v.exit_time, INTERVAL 8 HOUR), '%b %e, %Y %l:%i %p') END AS exitTimeDisplay,
                v.recorded_by_user_id AS recordedBy, {$passColumns}
         FROM visitor_logs v{$passJoins}
         ORDER BY v.entry_time DESC LIMIT 2000"
    )->fetchAll();
}

function fetch_visitor_passes(PDO $pdo, string $homeownerId): array
{
    if (!visitor_passes_available($pdo)) {
        return [];
    }
    $statement = $pdo->prepare(
        "SELECT visitor_pass_id AS id, pass_code AS passCode, homeowner_id AS homeownerId,
                visitor_name AS visitorName, contact_number AS contactNumber, purpose,
                vehicle_plate AS vehiclePlate, visit_date AS visitDate,
                CASE WHEN pass_status = 'active'
                          AND visit_date < DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))
                     THEN 'expired' ELSE pass_status END AS status,
                visitor_log_id AS visitorLogId, redeemed_at AS redeemedAt,
                cancelled_at AS cancelledAt, created_at AS createdAt
         FROM visitor_passes
         WHERE homeowner_id = ?
         ORDER BY created_at DESC LIMIT 250"
    );
    $statement->execute([$homeownerId]);
    return $statement->fetchAll();
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
    $visitorPassesReady = visitor_passes_available($pdo);
    $state = [
        'users' => $role === 'admin' ? fetch_users($pdo) : [],
        'homeowners' => $role === 'admin' ? fetch_homeowners($pdo) : ($role === 'resident' ? fetch_homeowners($pdo, $homeownerId) : []),
        'vehicles' => $role === 'admin' ? fetch_vehicles($pdo) : ($role === 'resident' ? fetch_vehicles($pdo, $homeownerId) : []),
        'reservations' => $role === 'admin' ? fetch_reservations($pdo) : ($role === 'resident' ? fetch_reservations($pdo, $homeownerId) : []),
        'dues' => $role === 'admin' ? fetch_dues($pdo) : ($role === 'resident' ? fetch_dues($pdo, $homeownerId) : []),
        'payments' => $role === 'admin' ? fetch_payments($pdo) : ($role === 'resident' ? fetch_payments($pdo, $homeownerId) : []),
        'visitorLogs' => in_array($role, ['admin', 'security'], true) ? fetch_visitor_logs($pdo) : [],
        'visitorPasses' => $role === 'resident' && $visitorPassesReady ? fetch_visitor_passes($pdo, $homeownerId) : [],
        'visitorPassesReady' => $visitorPassesReady,
        'concerns' => $role === 'admin' ? fetch_concerns($pdo) : ($role === 'resident' ? fetch_concerns($pdo, $homeownerId) : []),
        'announcements' => fetch_announcements($pdo, $role === 'admin'),
        'stickerRenewals' => $role === 'admin' ? fetch_sticker_renewals($pdo) : ($role === 'resident' ? fetch_sticker_renewals($pdo, $homeownerId) : []),
        'facilities' => fetch_facilities($pdo, $role === 'admin'),
        'emailLog' => $role === 'admin' ? fetch_notifications($pdo) : [],
        'paymentQRCode' => $role === 'resident' || $role === 'admin' ? fetch_payment_qr($pdo) : [],
        'duesSettings' => $role === 'resident' || $role === 'admin' ? [
            'monthlyDueAmount' => (float) system_setting($pdo, 'monthly_due_amount', '1500.00'),
            'monthlyDueDay' => (int) system_setting($pdo, 'monthly_due_day', '15'),
            'monthlyPenaltyAmount' => (float) system_setting($pdo, 'monthly_penalty_amount', '200.00'),
            'restrictAfterUnpaidMonths' => (int) system_setting($pdo, 'restrict_after_unpaid_months', '2'),
        ] : [],
        'stickerRenewalPeriod' => system_setting($pdo, 'sticker_renewal_period', gmdate('Y') . '-' . ((int) gmdate('Y') + 1)),
    ];
    return $state;
}
