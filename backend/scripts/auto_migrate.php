<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli' && !defined('ALLOW_AUTO_MIGRATE')) {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../config/database.php';

try {
    $pdo = requireDbConnection();

    // 1. Create missing tables
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS schema_migrations (
          migration_id VARCHAR(100) PRIMARY KEY,
          applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB;
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS roles (
          role_id TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          role_name VARCHAR(50) NOT NULL UNIQUE
        ) ENGINE=InnoDB;
    ");

    $pdo->exec("
        INSERT INTO roles (role_id, role_name)
        VALUES (1, 'admin'), (2, 'security'), (3, 'resident')
        ON DUPLICATE KEY UPDATE role_name = VALUES(role_name);
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS audit_logs (
          audit_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          actor_user_id CHAR(36) NULL,
          action_name VARCHAR(100) NOT NULL,
          entity_type VARCHAR(60) NOT NULL,
          entity_id VARCHAR(64) NULL,
          before_json JSON NULL,
          after_json JSON NULL,
          ip_address VARCHAR(45) NULL,
          user_agent VARCHAR(255) NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_audit_entity (entity_type, entity_id),
          INDEX idx_audit_actor_date (actor_user_id, created_at)
        ) ENGINE=InnoDB;
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS rate_limits (
          rate_key CHAR(64) PRIMARY KEY,
          action_name VARCHAR(80) NOT NULL,
          attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
          window_started_at DATETIME NOT NULL,
          blocked_until DATETIME NULL,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_rate_limits_cleanup (updated_at)
        ) ENGINE=InnoDB;
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS system_settings (
          setting_key VARCHAR(100) PRIMARY KEY,
          setting_value VARCHAR(255) NOT NULL,
          updated_by_user_id CHAR(36) NULL,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB;
    ");

    $pdo->exec("
        INSERT INTO system_settings (setting_key, setting_value)
        VALUES
          ('monthly_due_amount', '1500.00'),
          ('monthly_due_day', '15'),
          ('monthly_penalty_amount', '200.00'),
          ('restrict_after_unpaid_months', '2'),
          ('sticker_renewal_period', '2026-2027')
        ON DUPLICATE KEY UPDATE setting_value = setting_value;
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS guest_profiles (
          guest_id CHAR(36) PRIMARY KEY,
          full_name VARCHAR(120) NOT NULL,
          email VARCHAR(190) NOT NULL,
          contact_number VARCHAR(30) NOT NULL,
          email_verified_at DATETIME NOT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_guests_email (email)
        ) ENGINE=InnoDB;
    ");

    // Helper to safely add a column if it doesn't exist
    $addColumn = function (PDO $pdo, string $table, string $column, string $definition) {
        $stmt = $pdo->prepare("
            SELECT COUNT(*) 
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = ? 
              AND COLUMN_NAME = ?
        ");
        $stmt->execute([$table, $column]);
        if ((int) $stmt->fetchColumn() === 0) {
            $pdo->exec("ALTER TABLE `{$table}` ADD COLUMN `{$column}` {$definition}");
        }
    };

    // 2. Add missing columns safely
    // Users table
    $addColumn($pdo, 'users', 'approved_by_user_id', 'CHAR(36) NULL');
    $addColumn($pdo, 'users', 'approved_at', 'DATETIME NULL');
    $addColumn($pdo, 'users', 'force_password_change', 'TINYINT(1) NOT NULL DEFAULT 0');
    $addColumn($pdo, 'users', 'failed_login_attempts', 'SMALLINT UNSIGNED NOT NULL DEFAULT 0');
    $addColumn($pdo, 'users', 'locked_until', 'DATETIME NULL');
    $addColumn($pdo, 'users', 'last_login_at', 'DATETIME NULL');

    // Facilities table
    $addColumn($pdo, 'facilities', 'rate_label', 'VARCHAR(100) NOT NULL DEFAULT ""');
    $addColumn($pdo, 'facilities', 'guest_bookable', 'TINYINT(1) NOT NULL DEFAULT 1');

    // If 'rate' existed previously in facilities, copy data to 'rate_label' if needed
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'facilities' AND COLUMN_NAME = 'rate'");
    $stmt->execute();
    if ((int) $stmt->fetchColumn() > 0) {
        $pdo->exec("UPDATE facilities SET rate_label = rate WHERE rate_label = '' OR rate_label IS NULL");
    }

    // Vehicles table
    $addColumn($pdo, 'vehicles', 'submitted_by_user_id', 'CHAR(36) NULL');
    $addColumn($pdo, 'vehicles', 'reviewed_by_user_id', 'CHAR(36) NULL');

    // Vehicle Sticker Renewals table
    $addColumn($pdo, 'vehicle_sticker_renewals', 'requested_by_user_id', 'CHAR(36) NULL');
    $addColumn($pdo, 'vehicle_sticker_renewals', 'reviewed_by_user_id', 'CHAR(36) NULL');

    // Payments table
    $addColumn($pdo, 'payments', 'submitted_by_user_id', 'CHAR(36) NULL');
    $addColumn($pdo, 'payments', 'validated_by_user_id', 'CHAR(36) NULL');
    $addColumn($pdo, 'payments', 'proof_stored_name', 'VARCHAR(255) NULL');
    $addColumn($pdo, 'payments', 'proof_original_name', 'VARCHAR(255) NULL');
    $addColumn($pdo, 'payments', 'proof_mime_type', 'VARCHAR(100) NULL');
    $addColumn($pdo, 'payments', 'proof_file_size', 'INT UNSIGNED NOT NULL DEFAULT 0');

    // Facility Reservations table
    $addColumn($pdo, 'facility_reservations', 'requester_type', "ENUM('resident', 'guest') NOT NULL DEFAULT 'resident'");
    $addColumn($pdo, 'facility_reservations', 'guest_id', 'CHAR(36) NULL');
    $addColumn($pdo, 'facility_reservations', 'total_amount', 'DECIMAL(10,2) NOT NULL DEFAULT 0.00');
    $addColumn($pdo, 'facility_reservations', 'reference_number', 'VARCHAR(32) NULL');

    $pdo->exec("INSERT INTO schema_migrations (migration_id) VALUES ('001_production_schema') ON DUPLICATE KEY UPDATE migration_id = VALUES(migration_id)");

    echo "NovaLink database auto-migration completed successfully.\n";
} catch (Throwable $error) {
    echo "NovaLink database migration failed: " . $error->getMessage() . "\n";
    exit(1);
}
