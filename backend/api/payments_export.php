<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/bootstrap.php';

function csv_safe(mixed $value): mixed
{
    if (!is_string($value) || $value === '') {
        return $value;
    }
    return preg_match('/^[=+\-@\t\r]/', $value) ? "'" . $value : $value;
}

try {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
        json_response(['error' => 'Method not allowed.'], 405);
    }
    $pdo = requireDbConnection();
    $user = require_auth($pdo, ['admin', 'resident']);
    $sql =
        "SELECT p.payment_id, h.owner_name, h.block_lot, p.payment_reference, p.payment_date,
                p.amount_paid,
                COALESCE((SELECT SUM(pa.amount_applied) FROM payment_allocations pa WHERE pa.payment_id = p.payment_id), 0) AS amount_allocated,
                p.unallocated_amount, p.validation_status, p.validated_at,
                validator.full_name AS validated_by,
                (SELECT JSON_UNQUOTE(JSON_EXTRACT(a.after_json, '$.reason'))
                 FROM audit_logs a
                 WHERE a.entity_type = 'payment' AND a.entity_id = p.payment_id
                   AND a.action_name = 'payment.reject'
                 ORDER BY a.created_at DESC, a.audit_id DESC LIMIT 1) AS rejection_reason
         FROM payments p
         JOIN homeowners h ON h.homeowner_id = p.homeowner_id
         LEFT JOIN users validator ON validator.user_id = p.validated_by_user_id";
    $params = [];
    if ($user['role'] === 'resident') {
        $sql .= ' WHERE p.homeowner_id = ?';
        $params[] = $user['homeownerId'] ?: '__unlinked__';
    }
    $sql .= ' ORDER BY p.created_at DESC';
    $statement = $pdo->prepare($sql);
    $statement->execute($params);
    header_remove('Content-Type');
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="novalink-payments-' . gmdate('Y-m-d') . '.csv"');
    header('Cache-Control: private, no-store');
    $output = fopen('php://output', 'wb');
    if ($output === false) {
        throw new RuntimeException('Payment export could not be created.');
    }
    fwrite($output, "\xEF\xBB\xBF");
    fputcsv($output, [
        'Payment ID', 'Homeowner', 'Block/Lot', 'Reference', 'Payment Date', 'Amount Paid',
        'Amount Allocated', 'Unallocated Credit', 'Status', 'Rejection Reason', 'Validated At', 'Validated By',
    ]);
    foreach ($statement->fetchAll() as $row) {
        fputcsv($output, array_map('csv_safe', [
            $row['payment_id'], $row['owner_name'], $row['block_lot'], $row['payment_reference'],
            $row['payment_date'], $row['amount_paid'], $row['amount_allocated'], $row['unallocated_amount'],
            $row['validation_status'], $row['rejection_reason'], $row['validated_at'], $row['validated_by'],
        ]));
    }
    fclose($output);
    exit;
} catch (Throwable $error) {
    api_exception($error);
}
