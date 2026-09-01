<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/bootstrap.php';
require_once __DIR__ . '/../lib/state_repository.php';

function visitor_report_csv_safe(mixed $value): mixed
{
    if (!is_string($value) || $value === '') {
        return $value;
    }
    return preg_match('/^[=+\-@\t\r]/', $value) ? "'" . $value : $value;
}

function manila_time(?string $value): string
{
    if ($value === null || $value === '') {
        return '';
    }
    $date = new DateTimeImmutable($value, new DateTimeZone('UTC'));
    return $date->setTimezone(new DateTimeZone('Asia/Manila'))->format('Y-m-d h:i A');
}

try {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
        json_response(['error' => 'Method not allowed.'], 405);
    }
    $pdo = requireDbConnection();
    require_auth($pdo, ['admin', 'security']);
    $reportDate = trim((string) ($_GET['date'] ?? ''));
    $manila = new DateTimeZone('Asia/Manila');
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $reportDate, $manila);
    if (!$date || $date->format('Y-m-d') !== $reportDate) {
        json_response(['error' => 'Report date must use YYYY-MM-DD format.'], 422);
    }
    $utc = new DateTimeZone('UTC');
    $start = $date->setTimezone($utc)->format('Y-m-d H:i:s');
    $end = $date->modify('+1 day')->setTimezone($utc)->format('Y-m-d H:i:s');
    $passColumns = visitor_passes_available($pdo)
        ? "CASE WHEN vp.visitor_pass_id IS NULL THEN 'Gate entry' ELSE 'Resident pass' END AS entry_source,
           h.owner_name AS host_name"
        : "'Gate entry' AS entry_source, NULL AS host_name";
    $passJoins = visitor_passes_available($pdo)
        ? ' LEFT JOIN visitor_passes vp ON vp.visitor_log_id = v.visitor_log_id
            LEFT JOIN homeowners h ON h.homeowner_id = vp.homeowner_id'
        : '';
    $statement = $pdo->prepare(
        "SELECT v.visitor_name, v.contact_number, v.purpose, v.destination_address,
                v.vehicle_plate, v.entry_time, v.exit_time,
                CASE WHEN v.exit_time IS NULL THEN NULL
                     ELSE TIMESTAMPDIFF(MINUTE, v.entry_time, v.exit_time) END AS duration_minutes,
                {$passColumns}
         FROM visitor_logs v{$passJoins}
         WHERE v.entry_time >= ? AND v.entry_time < ?
         ORDER BY v.entry_time"
    );
    $statement->execute([$start, $end]);
    header_remove('Content-Type');
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="novalink-visitors-' . $reportDate . '.csv"');
    header('Cache-Control: private, no-store');
    $output = fopen('php://output', 'wb');
    if ($output === false) {
        throw new RuntimeException('Visitor report could not be created.');
    }
    fwrite($output, "\xEF\xBB\xBF");
    fputcsv($output, [
        'Visitor', 'Contact Number', 'Purpose', 'Destination', 'Vehicle Plate',
        'Entry Time (Asia/Manila)', 'Exit Time (Asia/Manila)', 'Status',
        'Duration (minutes)', 'Entry Source', 'Resident Host',
    ]);
    foreach ($statement->fetchAll() as $row) {
        fputcsv($output, array_map('visitor_report_csv_safe', [
            $row['visitor_name'], $row['contact_number'], $row['purpose'], $row['destination_address'],
            $row['vehicle_plate'], manila_time($row['entry_time']), manila_time($row['exit_time']),
            $row['exit_time'] ? 'Exited' : 'On-site', $row['duration_minutes'],
            $row['entry_source'], $row['host_name'],
        ]));
    }
    fclose($output);
    exit;
} catch (Throwable $error) {
    api_exception($error);
}
