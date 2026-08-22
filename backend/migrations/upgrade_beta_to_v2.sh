#!/usr/bin/env bash
set -euo pipefail

# Safe side-by-side migration from the exact beta schema formerly shipped by NovaLink.
# Configure a MySQL login path first: mysql_config_editor set --login-path=novalink-admin --host=127.0.0.1 --user=root --password

OLD_DB="${OLD_DB:-novalink_db}"
NEW_DB="${NEW_DB:-novalink_v2}"
MYSQL_LOGIN_PATH="${MYSQL_LOGIN_PATH:-novalink-admin}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCHEMA_FILE="$SCRIPT_DIR/../schema.sql"
BACKUP_DIR="$SCRIPT_DIR/../backups"

if [[ ! "$OLD_DB" =~ ^[A-Za-z0-9_]+$ || ! "$NEW_DB" =~ ^[A-Za-z0-9_]+$ || "$OLD_DB" == "$NEW_DB" ]]; then
  echo "OLD_DB and NEW_DB must be different and contain only letters, numbers, and underscores." >&2
  exit 2
fi

command -v mysql >/dev/null
command -v mysqldump >/dev/null
test -f "$SCHEMA_FILE"

if mysql --login-path="$MYSQL_LOGIN_PATH" -NBe "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='$NEW_DB'" | grep -qx "$NEW_DB"; then
  echo "Refusing to overwrite existing database: $NEW_DB" >&2
  exit 1
fi

install -d -m 0700 "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/${OLD_DB}-$(date -u +%Y%m%dT%H%M%SZ).sql"
mysqldump --login-path="$MYSQL_LOGIN_PATH" --single-transaction --routines --triggers "$OLD_DB" > "$BACKUP_FILE"
mysql --login-path="$MYSQL_LOGIN_PATH" -e "CREATE DATABASE \`$NEW_DB\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
mysql --login-path="$MYSQL_LOGIN_PATH" "$NEW_DB" < "$SCHEMA_FILE"

mysql --login-path="$MYSQL_LOGIN_PATH" "$NEW_DB" <<SQL
SET FOREIGN_KEY_CHECKS = 0;

INSERT INTO users
  (user_id, role_id, full_name, email, password_hash, account_status, email_verified, email_verified_at, force_password_change, created_at)
SELECT user_id, role_id, full_name, LOWER(email), password_hash, account_status, email_verified, email_verified_at, 1, created_at
FROM \`$OLD_DB\`.users;

INSERT INTO homeowners
  (homeowner_id, user_id, owner_name, block_lot, street, contact_number, email, record_status, created_at)
SELECT homeowner_id, user_id, owner_name, block_lot, street, contact_number, LOWER(email), record_status, created_at
FROM \`$OLD_DB\`.homeowners;

INSERT INTO household_occupants (occupant_id, homeowner_id, full_name, relationship)
SELECT occupant_id, homeowner_id, full_name, relationship FROM \`$OLD_DB\`.household_occupants;

INSERT INTO vehicles
  (vehicle_id, homeowner_id, submitted_by_user_id, reviewed_by_user_id, vehicle_type, make_model, plate_number, color, approval_status, created_at)
SELECT vehicle_id, homeowner_id, submitted_by, reviewed_by, vehicle_type, make_model, plate_number, color, approval_status, created_at
FROM \`$OLD_DB\`.vehicles;

INSERT IGNORE INTO vehicle_sticker_renewals
  (renewal_id, vehicle_id, homeowner_id, requested_by_user_id, reviewed_by_user_id, renewal_period, status, sticker_number, requested_at, reviewed_at)
SELECT renewal_id, vehicle_id, homeowner_id, requested_by, reviewed_by, renewal_period, status, sticker_number, requested_at, approved_at
FROM \`$OLD_DB\`.vehicle_sticker_renewals;

INSERT INTO facilities (facility_id, name, description, capacity, rate_label, guest_bookable, is_active)
SELECT facility_id, name, description, capacity, rate, guest_bookable, is_active FROM \`$OLD_DB\`.facilities
ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), capacity = VALUES(capacity), rate_label = VALUES(rate_label), guest_bookable = VALUES(guest_bookable), is_active = VALUES(is_active);

INSERT INTO facility_reservations
  (reservation_id, facility_id, homeowner_id, requester_type, requester_name, requester_email, reservation_date, time_slot, purpose, status, reviewed_by_user_id, created_at)
SELECT fr.reservation_id, fr.facility_id, fr.homeowner_id, 'resident', fr.requester_name, h.email,
       fr.reservation_date, fr.time_slot, fr.purpose, fr.status, fr.approved_by, fr.created_at
FROM \`$OLD_DB\`.facility_reservations fr
JOIN \`$OLD_DB\`.homeowners h ON h.homeowner_id = fr.homeowner_id
WHERE fr.requester_type = 'resident' AND fr.homeowner_id IS NOT NULL;

INSERT INTO dues (dues_id, homeowner_id, billing_month, amount_due, penalty_amount, due_date, status)
SELECT dues_id, homeowner_id,
       COALESCE(STR_TO_DATE(billing_month, '%M %Y'), STR_TO_DATE(billing_month, '%Y-%m-%d'), STR_TO_DATE(CONCAT(billing_month, '-01'), '%Y-%m-%d')),
       amount_due, penalty_amount, due_date, status
FROM \`$OLD_DB\`.dues
WHERE COALESCE(STR_TO_DATE(billing_month, '%M %Y'), STR_TO_DATE(billing_month, '%Y-%m-%d'), STR_TO_DATE(CONCAT(billing_month, '-01'), '%Y-%m-%d')) IS NOT NULL;

INSERT IGNORE INTO payments
  (payment_id, homeowner_id, submitted_by_user_id, validated_by_user_id, amount_paid, payment_reference,
   proof_stored_name, proof_original_name, proof_mime_type, proof_file_size, validation_status, payment_date, validated_at)
SELECT payment_id, homeowner_id, submitted_by, validated_by, amount_paid, payment_reference,
       'legacy-unavailable', COALESCE(proof_image_path, 'legacy proof path unavailable'), 'application/octet-stream', 0,
       validation_status, payment_date, validated_at
FROM \`$OLD_DB\`.payments;

INSERT INTO visitor_logs
  (visitor_log_id, visitor_name, contact_number, purpose, destination_address, vehicle_plate, entry_time, exit_time, recorded_by_user_id)
SELECT visitor_log_id, visitor_name, contact_number, purpose, destination_address, vehicle_plate, entry_time, exit_time, recorded_by
FROM \`$OLD_DB\`.visitor_logs;

INSERT INTO concerns
  (concern_id, homeowner_id, submitted_by_user_id, responded_by_user_id, concern_type, subject, description, status, admin_response, submitted_at, responded_at)
SELECT concern_id, homeowner_id, submitted_by, responded_by, concern_type, subject, description, status, admin_response, submitted_at, responded_at
FROM \`$OLD_DB\`.concerns;

INSERT INTO announcements
  (announcement_id, posted_by_user_id, title, content, priority, status, published_at, created_at)
SELECT announcement_id, posted_by, title, content, priority, status,
       CASE WHEN status = 'published' THEN TIMESTAMP(date_posted) ELSE NULL END, created_at
FROM \`$OLD_DB\`.announcements;

INSERT INTO notifications
  (notification_id, recipient_email, notification_type, subject, message_text, delivery_status, sent_at, created_at)
SELECT notification_id, recipient_email, email_type, subject, body_text, status,
       CASE WHEN status = 'sent' THEN sent_at ELSE NULL END, COALESCE(sent_at, UTC_TIMESTAMP())
FROM \`$OLD_DB\`.email_notifications;

INSERT INTO schema_migrations (migration_id) VALUES ('002_beta_data_import')
ON DUPLICATE KEY UPDATE migration_id = VALUES(migration_id);
SET FOREIGN_KEY_CHECKS = 1;
SQL

echo "Migration completed side-by-side. Backup: $BACKUP_FILE"
echo "Review $NEW_DB, reset any incompatible legacy passwords, copy legacy proof files if needed, then change DB_NAME in shared env.php."
echo "Guest verification codes and guest reservations were intentionally not migrated because the beta schema did not store a verified guest email on reservations."
