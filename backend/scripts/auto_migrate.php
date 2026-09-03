<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../config/database.php';

$requirements = [
    'schema_migrations' => ['migration_id', 'applied_at'],
    'roles' => ['role_id', 'role_name'],
    'users' => ['user_id', 'role_id', 'full_name', 'email', 'requested_address', 'password_hash', 'account_status', 'email_verified', 'email_verified_at', 'approved_by_user_id', 'approved_at', 'force_password_change', 'failed_login_attempts', 'locked_until', 'last_login_at', 'created_at', 'updated_at'],
    'email_verification_tokens' => ['token_id', 'email', 'full_name', 'contact_number', 'purpose', 'code_hash', 'action_token_hash', 'attempt_count', 'expires_at', 'verified_at', 'consumed_at', 'created_at'],
    'password_reset_tokens' => ['reset_id', 'user_id', 'token_hash', 'expires_at', 'used_at', 'created_at'],
    'homeowners' => ['homeowner_id', 'user_id', 'owner_name', 'block_lot', 'street', 'contact_number', 'email', 'record_status', 'created_at', 'updated_at'],
    'homeowner_user_links' => ['homeowner_id', 'user_id', 'linked_by_user_id', 'linked_at'],
    'household_occupants' => ['occupant_id', 'homeowner_id', 'full_name', 'relationship', 'created_at'],
    'homeowner_supporting_files' => ['file_id', 'homeowner_id', 'original_name', 'stored_name', 'mime_type', 'file_size', 'uploaded_by_user_id', 'uploaded_at'],
    'vehicles' => ['vehicle_id', 'homeowner_id', 'submitted_by_user_id', 'reviewed_by_user_id', 'vehicle_type', 'make_model', 'plate_number', 'color', 'approval_status', 'reviewed_at', 'created_at', 'updated_at'],
    'vehicle_sticker_renewals' => ['renewal_id', 'vehicle_id', 'homeowner_id', 'requested_by_user_id', 'reviewed_by_user_id', 'renewal_period', 'status', 'sticker_number', 'requested_at', 'reviewed_at'],
    'facilities' => ['facility_id', 'name', 'description', 'capacity', 'rate_label', 'guest_bookable', 'is_active', 'created_at', 'updated_at'],
    'guest_profiles' => ['guest_id', 'full_name', 'email', 'contact_number', 'email_verified_at', 'created_at'],
    'facility_reservations' => ['reservation_id', 'facility_id', 'homeowner_id', 'guest_id', 'requester_type', 'requester_name', 'requester_email', 'reservation_date', 'time_slot', 'purpose', 'status', 'reviewed_by_user_id', 'reviewed_at', 'created_at', 'updated_at'],
    'dues' => ['dues_id', 'homeowner_id', 'billing_month', 'amount_due', 'penalty_amount', 'due_date', 'status', 'created_at', 'updated_at'],
    'payments' => ['payment_id', 'homeowner_id', 'submitted_by_user_id', 'validated_by_user_id', 'amount_paid', 'unallocated_amount', 'payment_reference', 'proof_stored_name', 'proof_original_name', 'proof_mime_type', 'proof_file_size', 'validation_status', 'payment_date', 'validated_at', 'created_at'],
    'payment_allocations' => ['allocation_id', 'payment_id', 'dues_id', 'amount_applied', 'created_at'],
    'payment_qr_codes' => ['qr_code_id', 'provider', 'account_name', 'account_number', 'qr_image_path', 'is_active', 'created_by_user_id', 'created_at', 'updated_at'],
    'access_restrictions' => ['restriction_id', 'homeowner_id', 'reason', 'restriction_status', 'restricted_at', 'lifted_at', 'created_by_user_id'],
    'visitor_logs' => ['visitor_log_id', 'visitor_name', 'contact_number', 'purpose', 'destination_address', 'vehicle_plate', 'entry_time', 'exit_time', 'recorded_by_user_id', 'updated_by_user_id'],
    'concerns' => ['concern_id', 'homeowner_id', 'submitted_by_user_id', 'responded_by_user_id', 'concern_type', 'subject', 'description', 'status', 'admin_response', 'submitted_at', 'responded_at', 'updated_at'],
    'announcements' => ['announcement_id', 'posted_by_user_id', 'title', 'content', 'priority', 'status', 'published_at', 'created_at', 'updated_at'],
    'notifications' => ['notification_id', 'recipient_user_id', 'recipient_email', 'notification_type', 'subject', 'message_text', 'delivery_status', 'provider_message_id', 'failure_reason', 'sent_at', 'created_at'],
    'audit_logs' => ['audit_id', 'actor_user_id', 'action_name', 'entity_type', 'entity_id', 'before_json', 'after_json', 'ip_address', 'user_agent', 'created_at'],
    'rate_limits' => ['rate_key', 'action_name', 'attempts', 'window_started_at', 'blocked_until', 'updated_at'],
    'system_settings' => ['setting_key', 'setting_value', 'updated_by_user_id', 'updated_at'],
];

try {
    $pdo = requireDbConnection();
    $databaseName = (string) $pdo->query('SELECT DATABASE()')->fetchColumn();
    $columns = $pdo->query(
        'SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_TYPE
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()'
    )->fetchAll();

    $available = [];
    $metadata = [];
    foreach ($columns as $column) {
        $table = (string) $column['TABLE_NAME'];
        $name = (string) $column['COLUMN_NAME'];
        $available[$table][$name] = true;
        $metadata[$table][$name] = $column;
    }

    $errors = [];
    foreach ($requirements as $table => $requiredColumns) {
        if (!isset($available[$table])) {
            $errors[] = "missing table {$table}";
            continue;
        }

        foreach ($requiredColumns as $column) {
            if (!isset($available[$table][$column])) {
                $errors[] = "missing column {$table}.{$column}";
            }
        }
    }

    if (($metadata['dues']['billing_month']['DATA_TYPE'] ?? null) !== 'date') {
        $errors[] = 'dues.billing_month must use the DATE type';
    }

    $paymentStatusType = (string) ($metadata['payments']['validation_status']['COLUMN_TYPE'] ?? '');
    if (!str_contains($paymentStatusType, "'validated'")) {
        $errors[] = "payments.validation_status must allow 'validated'";
    }

    if (isset($available['schema_migrations'])) {
        $migration = $pdo->prepare(
            'SELECT COUNT(*) FROM schema_migrations WHERE migration_id = ?'
        );
        $migration->execute(['001_production_schema']);
        if ((int) $migration->fetchColumn() !== 1) {
            $errors[] = 'missing schema migration 001_production_schema';
        }
        $migration->execute(['004_household_account_links']);
        if ((int) $migration->fetchColumn() !== 1) {
            $errors[] = 'missing schema migration 004_household_account_links';
        }
    }

    if ($errors !== []) {
        fwrite(
            STDERR,
            "NovaLink schema check failed for {$databaseName}:\n - "
            . implode("\n - ", $errors)
            . "\n"
        );
        exit(1);
    }

    fwrite(
        STDOUT,
        'NovaLink schema check passed for '
        . $databaseName
        . ': '
        . count($requirements)
        . " tables verified.\n"
    );
} catch (Throwable $error) {
    error_log('NovaLink schema-check failure: ' . $error->getMessage());
    fwrite(
        STDERR,
        "NovaLink schema check could not complete. Verify the database connection and server log.\n"
    );
    exit(1);
}
