START TRANSACTION;

ALTER TABLE users
  MODIFY COLUMN account_status ENUM('pending', 'active', 'rejected', 'inactive', 'archived') NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS archived_at DATETIME NULL AFTER last_login_at,
  ADD COLUMN IF NOT EXISTS anonymized_at DATETIME NULL AFTER archived_at;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(120) NULL AFTER recipient_email,
  ADD COLUMN IF NOT EXISTS notification_category VARCHAR(40) NOT NULL DEFAULT 'general' AFTER notification_type,
  MODIFY COLUMN delivery_status ENUM('queued', 'sent', 'failed', 'suppressed') NOT NULL DEFAULT 'queued',
  ADD COLUMN IF NOT EXISTS in_app_visible TINYINT(1) NOT NULL DEFAULT 0 AFTER delivery_status,
  ADD COLUMN IF NOT EXISTS read_at DATETIME NULL AFTER in_app_visible,
  ADD COLUMN IF NOT EXISTS retry_count SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER read_at,
  ADD COLUMN IF NOT EXISTS last_attempt_at DATETIME NULL AFTER retry_count;

UPDATE notifications n
JOIN users u ON LOWER(u.email) = LOWER(n.recipient_email)
SET n.recipient_user_id = u.user_id,
    n.recipient_name = COALESCE(n.recipient_name, u.full_name),
    n.in_app_visible = CASE WHEN n.notification_type = 'otp_verification' THEN 0 ELSE 1 END
WHERE n.recipient_user_id IS NULL;

UPDATE notifications
SET notification_category = CASE
  WHEN notification_type IN ('account_created', 'account_status', 'account_access_updated', 'password_change_required', 'otp_verification') THEN 'account'
  WHEN notification_type = 'announcement_broadcast' THEN 'announcements'
  WHEN notification_type IN ('payment_update', 'dues_reminder') THEN 'payments'
  WHEN notification_type = 'reservation_update' THEN 'reservations'
  WHEN notification_type = 'concern_update' THEN 'concerns'
  WHEN notification_type IN ('vehicle_update', 'sticker_update') THEN 'records'
  ELSE 'general'
END;

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id CHAR(36) NOT NULL,
  notification_category VARCHAR(40) NOT NULL,
  email_enabled TINYINT(1) NOT NULL DEFAULT 1,
  in_app_enabled TINYINT(1) NOT NULL DEFAULT 1,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, notification_category),
  CONSTRAINT fk_notification_preferences_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT INTO schema_migrations (migration_id)
VALUES ('005_enterprise_notifications_lifecycle')
ON DUPLICATE KEY UPDATE migration_id = VALUES(migration_id);

COMMIT;
