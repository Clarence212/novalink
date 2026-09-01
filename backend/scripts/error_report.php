<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../config/database.php';

$hours = 24;
foreach ($argv as $argument) {
    if (preg_match('/^--hours=(\d+)$/', $argument, $matches)) {
        $hours = max(1, min(720, (int) $matches[1]));
    }
}
$path = config_value('ERROR_LOG_PATH', 'NOVALINK_ERROR_LOG_PATH', '');
if ($path === '' || !is_file($path) || !is_readable($path)) {
    fwrite(STDOUT, "No readable NovaLink structured error log is configured.\n");
    exit(0);
}
$cutoff = time() - ($hours * 3600);
$counts = [];
$recent = [];
$handle = fopen($path, 'rb');
if ($handle === false) {
    fwrite(STDERR, "The NovaLink error log could not be opened.\n");
    exit(1);
}
while (($line = fgets($handle)) !== false) {
    $record = json_decode(trim($line), true);
    if (!is_array($record) || strtotime((string) ($record['timestamp'] ?? '')) < $cutoff) {
        continue;
    }
    $key = (string) ($record['exception'] ?? 'Unknown');
    $counts[$key] = ($counts[$key] ?? 0) + 1;
    $recent[] = $record;
}
fclose($handle);
arsort($counts);
fwrite(STDOUT, "NovaLink errors in the last {$hours} hour(s): " . count($recent) . "\n");
foreach ($counts as $exception => $count) {
    fwrite(STDOUT, " - {$exception}: {$count}\n");
}
foreach (array_slice(array_reverse($recent), 0, 10) as $record) {
    fwrite(
        STDOUT,
        sprintf(
            "[%s] %s %s request=%s path=%s\n",
            $record['timestamp'] ?? 'unknown',
            $record['severity'] ?? 'error',
            $record['message'] ?? 'No message',
            $record['requestId'] ?? 'unknown',
            $record['path'] ?? ''
        )
    );
}
