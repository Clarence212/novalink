<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../lib/state_repository.php';

try {
    $pdo = requireDbConnection();
    $duesCreated = ensure_current_month_dues($pdo);
    refresh_financial_state($pdo);
    $pdo->exec("DELETE FROM email_verification_tokens WHERE expires_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY)");
    $pdo->exec("DELETE FROM password_reset_tokens WHERE expires_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY)");
    $pdo->exec("DELETE FROM rate_limits WHERE updated_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 2 DAY)");
    $pdo->exec(
        "DELETE gp FROM guest_profiles gp
         WHERE gp.created_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)
           AND NOT EXISTS (SELECT 1 FROM facility_reservations fr WHERE fr.guest_id = gp.guest_id)"
    );

    if (in_array('--generate-dues', $argv, true)) {
        fwrite(STDOUT, "Monthly dues checked; {$duesCreated} record(s) created.\n");
    }
    fwrite(STDOUT, "NovaLink maintenance completed.\n");
} catch (Throwable $error) {
    fwrite(STDERR, "NovaLink maintenance failed. See the server log.\n");
    error_log('NovaLink maintenance failure: ' . $error->getMessage());
    exit(1);
}
