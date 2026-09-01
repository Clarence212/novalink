<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    exit(1);
}

session_save_path(sys_get_temp_dir());
require_once __DIR__ . '/../lib/bootstrap.php';

$path = config_value('ERROR_LOG_PATH', 'NOVALINK_ERROR_LOG_PATH', '');
if ($path === '') {
    throw new RuntimeException('NOVALINK_ERROR_LOG_PATH is required for the monitor test.');
}
@unlink($path);
$requestId = record_application_error(new RuntimeException('CI structured-error probe'), 'test');
$line = is_file($path) ? file_get_contents($path) : false;
$record = is_string($line) ? json_decode(trim($line), true) : null;
if (!is_array($record)
    || ($record['requestId'] ?? null) !== $requestId
    || ($record['severity'] ?? null) !== 'test'
    || ($record['message'] ?? null) !== 'CI structured-error probe') {
    fwrite(STDERR, "Structured error monitoring test failed.\n");
    exit(1);
}
@unlink($path);
fwrite(STDOUT, "Structured error monitoring test passed.\n");
