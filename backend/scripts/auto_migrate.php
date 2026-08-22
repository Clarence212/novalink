<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli' && !defined('ALLOW_AUTO_MIGRATE')) {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../config/database.php';

try {
    $pdo = requireDbConnection();

    // Disable FK checks temporarily for safe table setup
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 0;");

    // 1. Create ALL tables if they do not exist
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS schema_migrations (
          migration_id VARCHAR(100) PRIMARY KEY,
          applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB;

        CREATE TABLE IF NOT EXISTS roles (
          role_id TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          role_name VARCHAR(50) NOT NULL UNIQUE
        ) ENGINE=InnoDB;

        INSERT INTO roles (role_id, role_name)
        VALUES (1, 'admin'), (2, 'security'), (3, 'resident')
        ON DUPLICATE KEY UPDATE role_name = VALUES(role_name);

        CREATE TABLE IF NOT EXISTS users (
          user_id CHAR(36) PRIMARY KEY,
          role_id TINYINT UNSIGNED NOT NULL,
          full_name VARCHAR(120) NOT NULL,
          email VARCHAR(190) NOT NULL UNIQUE,
          password_hash VARCHAR(255) NOT NULL,
          account_status ENUM('pending', 'active', 'rejected', 'inactive') NOT NULL DEFAULT 'pending',
          email_verified TINYINT(1) NOT NULL DEFAULT 0,
          email_verified_at DATETIME NULL,
          approved_by_user_id CHAR(36) NULL,
          approved_at DATETIME NULL,
          force_password_change TINYINT(1) NOT NULL DEFAULT 0,
          failed_login_attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
          locked_until DATETIME NULL,
          last_login_at DATETIME NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(role_id),
          INDEX idx_users_status (account_status),
          INDEX idx_users_role (role_id)
        ) ENGINE=InnoDB;

        CREATE TABLE IF NOT EXISTS email_verification_tokens (
          token_id CHAR(36) PRIMARY KEY,
          email VARCHAR(190) NOT NULL,
          full_name VARCHAR(120) NULL,
          contact_number VARCHAR(30) NULL,
          purpose ENUM('registration', 'password_reset', 'guest') NOT NULL,
          code_hash VARCHAR(255) NOT NULL,
          action_token_hash VARCHAR(255) NULL,
          attempt_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
          expires_at DATETIME NOT NULL,
          verified_at DATETIME NULL,
          consumed_at DATETIME NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_email_tokens_lookup (email, purpose, created_at),
          INDEX idx_email_tokens_expiry (expires_at)
        ) ENGINE=InnoDB;

        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          reset_id CHAR(36) PRIMARY KEY,
          user_id CHAR(36) NOT NULL,
          token_hash VARCHAR(255) NOT NULL,
          expires_at DATETIME NOT NULL,
          used_at DATETIME NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_password_reset_expiry (expires_at)
        ) ENGINE=InnoDB;

        CREATE TABLE IF NOT EXISTS homeowners (
          homeowner_id CHAR(36) PRIMARY KEY,
          user_id CHAR(36) NULL UNIQUE,
          owner_name VARCHAR(120) NOT NULL,
          block_lot VARCHAR(100) NOT NULL,
          street VARCHAR(120) NOT NULL,
          contact_number VARCHAR(30) NOT NULL,
          email VARCHAR(190) NOT NULL,
          record_status ENUM('active', 'archived') NOT NULL DEFAULT 'active',
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_homeowners_name (owner_name),
          INDEX idx_homeowners_address (block_lot, street),
          INDEX idx_homeowners_email (email)
        ) ENGINE=InnoDB;

        CREATE TABLE IF NOT EXISTS household_occupants (
          occupant_id CHAR(36) PRIMARY KEY,
          homeowner_id CHAR(36) NOT NULL,
          full_name VARCHAR(120) NOT NULL,
          relationship VARCHAR(60) NOT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_occupants_homeowner (homeowner_id)
        ) ENGINE=InnoDB;

        CREATE TABLE IF NOT EXISTS homeowner_supporting_files (
          file_id CHAR(36) PRIMARY KEY,
          homeowner_id CHAR(36) NOT NULL,
          original_name VARCHAR(255) NOT NULL,
          stored_name VARCHAR(255) NOT NULL UNIQUE,
          mime_type VARCHAR(100) NOT NULL,
          file_size INT UNSIGNED NOT NULL,
          uploaded_by_user_id CHAR(36) NOT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_homeowner_files (homeowner_id)
        ) ENGINE=InnoDB;

        CREATE TABLE IF NOT EXISTS vehicles (
          vehicle_id CHAR(36) PRIMARY KEY,
          homeowner_id CHAR(36) NOT NULL,
          submitted_by_user_id CHAR(36) NULL,
          reviewed_by_user_id CHAR(36) NULL,
          vehicle_type ENUM('car', 'motorcycle', 'van', 'suv', 'truck', 'other') NOT NULL,
          make_model VARCHAR(100) NOT NULL,
          plate_number VARCHAR(30) NOT NULL UNIQUE,
          color VARCHAR(50) NOT NULL,
          approval_status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_vehicles_homeowner (homeowner_id),
          INDEX idx_vehicles_status (approval_status)
        ) ENGINE=InnoDB;

        CREATE TABLE IF NOT EXISTS vehicle_sticker_renewals (
          renewal_id CHAR(36) PRIMARY KEY,
          vehicle_id CHAR(36) NOT NULL,
          homeowner_id CHAR(36) NOT NULL,
          requested_by_user_id CHAR(36) NULL,
          reviewed_by_user_id CHAR(36) NULL,
          renewal_period VARCHAR(50) NOT NULL,
          status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
          sticker_number VARCHAR(50) NULL,
          requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          reviewed_at DATETIME NULL,
          INDEX idx_renewals_homeowner (homeowner_id),
          INDEX idx_renewals_status (status)
        ) ENGINE=InnoDB;

        CREATE TABLE IF NOT EXISTS facilities (
          facility_id CHAR(36) PRIMARY KEY,
          name VARCHAR(120) NOT NULL UNIQUE,
          description TEXT NULL,
          capacity SMALLINT UNSIGNED NOT NULL,
          rate_label VARCHAR(100) NOT NULL,
          guest_bookable TINYINT(1) NOT NULL DEFAULT 1,
          is_active TINYINT(1) NOT NULL DEFAULT 1,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB;

        INSERT INTO facilities (facility_id, name, description, capacity, rate_label, guest_bookable, is_active)
        VALUES
          ('f1', 'Clubhouse Main Hall', 'Spacious indoor hall for events, parties, and gatherings.', 150, 'PHP 2,500 / 4 hours', 1, 1),
          ('f2', 'Covered Basketball Court', 'Full-sized covered basketball court for sports events.', 50, 'PHP 500 / hour', 1, 1),
          ('f3', 'Swimming Pool Area', 'Community pool with lounge area. Residents only.', 30, 'PHP 200 / person / day', 0, 1),
          ('f4', 'Function Room', 'Meeting room for seminars and small gatherings.', 30, 'PHP 1,000 / 4 hours', 0, 1)
        ON DUPLICATE KEY UPDATE description = VALUES(description), capacity = VALUES(capacity), rate_label = VALUES(rate_label);

        CREATE TABLE IF NOT EXISTS guest_profiles (
          guest_id CHAR(36) PRIMARY KEY,
          full_name VARCHAR(120) NOT NULL,
          email VARCHAR(190) NOT NULL,
          contact_number VARCHAR(30) NOT NULL,
          email_verified_at DATETIME NOT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_guests_email (email)
        ) ENGINE=InnoDB;

        CREATE TABLE IF NOT EXISTS facility_reservations (
          reservation_id CHAR(36) PRIMARY KEY,
          facility_id CHAR(36) NOT NULL,
          homeowner_id CHAR(36) NULL,
          guest_id CHAR(36) NULL,
          requester_type ENUM('resident', 'guest') NOT NULL DEFAULT 'resident',
          requester_name VARCHAR(120) NOT NULL,
          requester_email VARCHAR(190) NOT NULL,
          reservation_date DATE NOT NULL,
          time_slot VARCHAR(60) NOT NULL,
          purpose VARCHAR(255) NOT NULL,
          total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          status ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
          reference_number VARCHAR(32) NULL,
          reviewed_by_user_id CHAR(36) NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_reservations_facility_date (facility_id, reservation_date),
          INDEX idx_reservations_homeowner (homeowner_id),
          INDEX idx_reservations_status (status)
        ) ENGINE=InnoDB;

        CREATE TABLE IF NOT EXISTS dues (
          dues_id CHAR(36) PRIMARY KEY,
          homeowner_id CHAR(36) NOT NULL,
          billing_month DATE NOT NULL,
          amount_due DECIMAL(10,2) NOT NULL,
          penalty_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          due_date DATE NOT NULL,
          status ENUM('unpaid', 'partially_paid', 'paid', 'overdue') NOT NULL DEFAULT 'unpaid',
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uq_dues_homeowner_month (homeowner_id, billing_month),
          INDEX idx_dues_status (status)
        ) ENGINE=InnoDB;

        CREATE TABLE IF NOT EXISTS payments (
          payment_id CHAR(36) PRIMARY KEY,
          homeowner_id CHAR(36) NOT NULL,
          submitted_by_user_id CHAR(36) NULL,
          validated_by_user_id CHAR(36) NULL,
          amount_paid DECIMAL(10,2) NOT NULL,
          payment_reference VARCHAR(100) NOT NULL,
          proof_stored_name VARCHAR(255) NOT NULL,
          proof_original_name VARCHAR(255) NOT NULL,
          proof_mime_type VARCHAR(100) NOT NULL,
          proof_file_size INT UNSIGNED NOT NULL,
          validation_status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
          payment_date DATE NOT NULL,
          validated_at DATETIME NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_payments_homeowner (homeowner_id),
          INDEX idx_payments_status (validation_status)
        ) ENGINE=InnoDB;

        CREATE TABLE IF NOT EXISTS payment_qr_codes (
          qr_code_id CHAR(36) PRIMARY KEY,
          provider VARCHAR(60) NOT NULL,
          account_name VARCHAR(120) NOT NULL,
          account_number VARCHAR(80) NOT NULL,
          qr_image_path VARCHAR(255) NULL,
          is_active TINYINT(1) NOT NULL DEFAULT 1,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB;

        INSERT INTO payment_qr_codes (qr_code_id, provider, account_name, account_number, qr_image_path, is_active)
        VALUES ('qr-default', 'GCash', 'Novaville HOA Inc.', 'Configure in production', NULL, 1)
        ON DUPLICATE KEY UPDATE provider = VALUES(provider);

        CREATE TABLE IF NOT EXISTS access_restrictions (
          restriction_id CHAR(36) PRIMARY KEY,
          homeowner_id CHAR(36) NOT NULL,
          reason VARCHAR(255) NOT NULL,
          restriction_status ENUM('active', 'lifted') NOT NULL DEFAULT 'active',
          restricted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          lifted_at DATETIME NULL,
          created_by_user_id CHAR(36) NULL,
          INDEX idx_restrictions_homeowner_status (homeowner_id, restriction_status)
        ) ENGINE=InnoDB;

        CREATE TABLE IF NOT EXISTS visitor_logs (
          visitor_log_id CHAR(36) PRIMARY KEY,
          visitor_name VARCHAR(120) NOT NULL,
          contact_number VARCHAR(30) NOT NULL,
          purpose VARCHAR(160) NOT NULL,
          destination_address VARCHAR(160) NOT NULL,
          vehicle_plate VARCHAR(30) NULL,
          entry_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          exit_time DATETIME NULL,
          recorded_by_user_id CHAR(36) NOT NULL,
          INDEX idx_visitors_destination (destination_address),
          INDEX idx_visitors_entry (entry_time)
        ) ENGINE=InnoDB;

        CREATE TABLE IF NOT EXISTS concerns (
          concern_id CHAR(36) PRIMARY KEY,
          homeowner_id CHAR(36) NOT NULL,
          submitted_by_user_id CHAR(36) NOT NULL,
          responded_by_user_id CHAR(36) NULL,
          concern_type VARCHAR(60) NOT NULL,
          subject VARCHAR(160) NOT NULL,
          description TEXT NOT NULL,
          status ENUM('pending', 'in-progress', 'resolved') NOT NULL DEFAULT 'pending',
          admin_response TEXT NULL,
          submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          responded_at DATETIME NULL,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_concerns_homeowner (homeowner_id),
          INDEX idx_concerns_status (status)
        ) ENGINE=InnoDB;

        CREATE TABLE IF NOT EXISTS announcements (
          announcement_id CHAR(36) PRIMARY KEY,
          posted_by_user_id CHAR(36) NOT NULL,
          title VARCHAR(180) NOT NULL,
          content TEXT NOT NULL,
          priority ENUM('normal', 'important', 'urgent') NOT NULL DEFAULT 'normal',
          status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'published',
          published_at DATETIME NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_announcements_status_date (status, published_at)
        ) ENGINE=InnoDB;

        CREATE TABLE IF NOT EXISTS notifications (
          notification_id CHAR(36) PRIMARY KEY,
          recipient_user_id CHAR(36) NULL,
          recipient_email VARCHAR(190) NOT NULL,
          notification_type VARCHAR(60) NOT NULL,
          subject VARCHAR(200) NOT NULL,
          message_text TEXT NOT NULL,
          delivery_status ENUM('queued', 'sent', 'failed') NOT NULL DEFAULT 'queued',
          provider_message_id VARCHAR(255) NULL,
          failure_reason VARCHAR(255) NULL,
          sent_at DATETIME NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_notifications_recipient (recipient_user_id, created_at),
          INDEX idx_notifications_delivery (delivery_status, created_at)
        ) ENGINE=InnoDB;

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

        CREATE TABLE IF NOT EXISTS rate_limits (
          rate_key CHAR(64) PRIMARY KEY,
          action_name VARCHAR(80) NOT NULL,
          attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
          window_started_at DATETIME NOT NULL,
          blocked_until DATETIME NULL,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_rate_limits_cleanup (updated_at)
        ) ENGINE=InnoDB;

        CREATE TABLE IF NOT EXISTS system_settings (
          setting_key VARCHAR(100) PRIMARY KEY,
          setting_value VARCHAR(255) NOT NULL,
          updated_by_user_id CHAR(36) NULL,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB;

        INSERT INTO system_settings (setting_key, setting_value)
        VALUES
          ('monthly_due_amount', '1500.00'),
          ('monthly_due_day', '15'),
          ('monthly_penalty_amount', '200.00'),
          ('restrict_after_unpaid_months', '2'),
          ('sticker_renewal_period', '2026-2027')
        ON DUPLICATE KEY UPDATE setting_value = setting_value;
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
    $addColumn($pdo, 'users', 'approved_by_user_id', 'CHAR(36) NULL');
    $addColumn($pdo, 'users', 'approved_at', 'DATETIME NULL');
    $addColumn($pdo, 'users', 'force_password_change', 'TINYINT(1) NOT NULL DEFAULT 0');
    $addColumn($pdo, 'users', 'failed_login_attempts', 'SMALLINT UNSIGNED NOT NULL DEFAULT 0');
    $addColumn($pdo, 'users', 'locked_until', 'DATETIME NULL');
    $addColumn($pdo, 'users', 'last_login_at', 'DATETIME NULL');

    $addColumn($pdo, 'facilities', 'rate_label', 'VARCHAR(100) NOT NULL DEFAULT ""');
    $addColumn($pdo, 'facilities', 'guest_bookable', 'TINYINT(1) NOT NULL DEFAULT 1');

    $stmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'facilities' AND COLUMN_NAME = 'rate'");
    $stmt->execute();
    if ((int) $stmt->fetchColumn() > 0) {
        $pdo->exec("UPDATE facilities SET rate_label = rate WHERE rate_label = '' OR rate_label IS NULL");
    }

    $addColumn($pdo, 'vehicles', 'submitted_by_user_id', 'CHAR(36) NULL');
    $addColumn($pdo, 'vehicles', 'reviewed_by_user_id', 'CHAR(36) NULL');

    $addColumn($pdo, 'vehicle_sticker_renewals', 'requested_by_user_id', 'CHAR(36) NULL');
    $addColumn($pdo, 'vehicle_sticker_renewals', 'reviewed_by_user_id', 'CHAR(36) NULL');

    $addColumn($pdo, 'payments', 'submitted_by_user_id', 'CHAR(36) NULL');
    $addColumn($pdo, 'payments', 'validated_by_user_id', 'CHAR(36) NULL');
    $addColumn($pdo, 'payments', 'proof_stored_name', 'VARCHAR(255) NULL');
    $addColumn($pdo, 'payments', 'proof_original_name', 'VARCHAR(255) NULL');
    $addColumn($pdo, 'payments', 'proof_mime_type', 'VARCHAR(100) NULL');
    $addColumn($pdo, 'payments', 'proof_file_size', 'INT UNSIGNED NOT NULL DEFAULT 0');

    $addColumn($pdo, 'facility_reservations', 'requester_type', "ENUM('resident', 'guest') NOT NULL DEFAULT 'resident'");
    $addColumn($pdo, 'facility_reservations', 'guest_id', 'CHAR(36) NULL');
    $addColumn($pdo, 'facility_reservations', 'total_amount', 'DECIMAL(10,2) NOT NULL DEFAULT 0.00');
    $addColumn($pdo, 'facility_reservations', 'reference_number', 'VARCHAR(32) NULL');

    $pdo->exec("SET FOREIGN_KEY_CHECKS = 1;");
    $pdo->exec("INSERT INTO schema_migrations (migration_id) VALUES ('001_production_schema') ON DUPLICATE KEY UPDATE migration_id = VALUES(migration_id)");

    echo "NovaLink database auto-migration completed successfully.\n";
} catch (Throwable $error) {
    echo "NovaLink database migration failed: " . $error->getMessage() . "\n";
    exit(1);
}
