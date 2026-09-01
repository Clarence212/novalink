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
  CONSTRAINT fk_users_approver FOREIGN KEY (approved_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
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
  CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
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
  CONSTRAINT fk_homeowners_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
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
  CONSTRAINT fk_occupants_homeowner FOREIGN KEY (homeowner_id) REFERENCES homeowners(homeowner_id) ON DELETE CASCADE,
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
  uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_homeowner_files_homeowner FOREIGN KEY (homeowner_id) REFERENCES homeowners(homeowner_id) ON DELETE CASCADE,
  CONSTRAINT fk_homeowner_files_user FOREIGN KEY (uploaded_by_user_id) REFERENCES users(user_id),
  INDEX idx_homeowner_files_homeowner (homeowner_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS vehicles (
  vehicle_id CHAR(36) PRIMARY KEY,
  homeowner_id CHAR(36) NOT NULL,
  submitted_by_user_id CHAR(36) NOT NULL,
  reviewed_by_user_id CHAR(36) NULL,
  vehicle_type VARCHAR(50) NOT NULL,
  make_model VARCHAR(120) NOT NULL,
  plate_number VARCHAR(30) NOT NULL UNIQUE,
  color VARCHAR(50) NOT NULL,
  approval_status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  reviewed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_vehicles_homeowner FOREIGN KEY (homeowner_id) REFERENCES homeowners(homeowner_id) ON DELETE CASCADE,
  CONSTRAINT fk_vehicles_submitter FOREIGN KEY (submitted_by_user_id) REFERENCES users(user_id),
  CONSTRAINT fk_vehicles_reviewer FOREIGN KEY (reviewed_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX idx_vehicles_homeowner (homeowner_id),
  INDEX idx_vehicles_status (approval_status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS vehicle_sticker_renewals (
  renewal_id CHAR(36) PRIMARY KEY,
  vehicle_id CHAR(36) NOT NULL,
  homeowner_id CHAR(36) NOT NULL,
  requested_by_user_id CHAR(36) NOT NULL,
  reviewed_by_user_id CHAR(36) NULL,
  renewal_period VARCHAR(20) NOT NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  sticker_number VARCHAR(50) NULL UNIQUE,
  requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME NULL,
  CONSTRAINT fk_renewals_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
  CONSTRAINT fk_renewals_homeowner FOREIGN KEY (homeowner_id) REFERENCES homeowners(homeowner_id) ON DELETE CASCADE,
  CONSTRAINT fk_renewals_requester FOREIGN KEY (requested_by_user_id) REFERENCES users(user_id),
  CONSTRAINT fk_renewals_reviewer FOREIGN KEY (reviewed_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX idx_renewals_homeowner (homeowner_id),
  INDEX idx_renewals_status (status),
  UNIQUE KEY uq_vehicle_renewal_period (vehicle_id, renewal_period)
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
  requester_type ENUM('resident', 'guest') NOT NULL,
  requester_name VARCHAR(120) NOT NULL,
  requester_email VARCHAR(190) NOT NULL,
  reservation_date DATE NOT NULL,
  time_slot VARCHAR(60) NOT NULL,
  purpose VARCHAR(255) NOT NULL,
  status ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
  reviewed_by_user_id CHAR(36) NULL,
  reviewed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_reservations_facility FOREIGN KEY (facility_id) REFERENCES facilities(facility_id),
  CONSTRAINT fk_reservations_homeowner FOREIGN KEY (homeowner_id) REFERENCES homeowners(homeowner_id) ON DELETE SET NULL,
  CONSTRAINT fk_reservations_guest FOREIGN KEY (guest_id) REFERENCES guest_profiles(guest_id) ON DELETE SET NULL,
  CONSTRAINT fk_reservations_reviewer FOREIGN KEY (reviewed_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX idx_reservations_schedule (facility_id, reservation_date, time_slot, status),
  INDEX idx_reservations_homeowner (homeowner_id),
  INDEX idx_reservations_guest (guest_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS dues (
  dues_id CHAR(36) PRIMARY KEY,
  homeowner_id CHAR(36) NOT NULL,
  billing_month DATE NOT NULL,
  amount_due DECIMAL(10,2) NOT NULL DEFAULT 1500.00,
  penalty_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  due_date DATE NOT NULL,
  status ENUM('paid', 'unpaid', 'waived') NOT NULL DEFAULT 'unpaid',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_dues_homeowner FOREIGN KEY (homeowner_id) REFERENCES homeowners(homeowner_id) ON DELETE CASCADE,
  UNIQUE KEY uq_dues_homeowner_month (homeowner_id, billing_month),
  INDEX idx_dues_status_date (status, due_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payments (
  payment_id CHAR(36) PRIMARY KEY,
  homeowner_id CHAR(36) NOT NULL,
  submitted_by_user_id CHAR(36) NOT NULL,
  validated_by_user_id CHAR(36) NULL,
  amount_paid DECIMAL(10,2) NOT NULL,
  unallocated_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  payment_reference VARCHAR(120) NOT NULL,
  proof_stored_name VARCHAR(255) NOT NULL,
  proof_original_name VARCHAR(255) NOT NULL,
  proof_mime_type VARCHAR(100) NOT NULL,
  proof_file_size INT UNSIGNED NOT NULL,
  validation_status ENUM('pending', 'validated', 'rejected') NOT NULL DEFAULT 'pending',
  payment_date DATE NOT NULL,
  validated_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payments_homeowner FOREIGN KEY (homeowner_id) REFERENCES homeowners(homeowner_id) ON DELETE CASCADE,
  CONSTRAINT fk_payments_submitter FOREIGN KEY (submitted_by_user_id) REFERENCES users(user_id),
  CONSTRAINT fk_payments_validator FOREIGN KEY (validated_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX idx_payments_homeowner (homeowner_id),
  INDEX idx_payments_status (validation_status),
  UNIQUE KEY uq_payments_reference (payment_reference)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payment_allocations (
  allocation_id CHAR(36) PRIMARY KEY,
  payment_id CHAR(36) NOT NULL,
  dues_id CHAR(36) NOT NULL,
  amount_applied DECIMAL(10,2) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_allocations_payment FOREIGN KEY (payment_id) REFERENCES payments(payment_id) ON DELETE CASCADE,
  CONSTRAINT fk_allocations_dues FOREIGN KEY (dues_id) REFERENCES dues(dues_id),
  UNIQUE KEY uq_payment_dues_allocation (payment_id, dues_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payment_qr_codes (
  qr_code_id CHAR(36) PRIMARY KEY,
  provider VARCHAR(50) NOT NULL,
  account_name VARCHAR(120) NOT NULL,
  account_number VARCHAR(50) NOT NULL,
  qr_image_path VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by_user_id CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_payment_qr_creator FOREIGN KEY (created_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL
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
  CONSTRAINT fk_restrictions_homeowner FOREIGN KEY (homeowner_id) REFERENCES homeowners(homeowner_id) ON DELETE CASCADE,
  CONSTRAINT fk_restrictions_creator FOREIGN KEY (created_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX idx_restrictions_homeowner_status (homeowner_id, restriction_status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS visitor_logs (
  visitor_log_id CHAR(36) PRIMARY KEY,
  visitor_name VARCHAR(120) NOT NULL,
  contact_number VARCHAR(30) NOT NULL,
  purpose VARCHAR(120) NOT NULL,
  destination_address VARCHAR(190) NOT NULL,
  vehicle_plate VARCHAR(30) NULL,
  entry_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  exit_time DATETIME NULL,
  recorded_by_user_id CHAR(36) NOT NULL,
  updated_by_user_id CHAR(36) NULL,
  CONSTRAINT fk_visitor_recorder FOREIGN KEY (recorded_by_user_id) REFERENCES users(user_id),
  CONSTRAINT fk_visitor_updater FOREIGN KEY (updated_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX idx_visitor_entry_time (entry_time),
  INDEX idx_visitor_name (visitor_name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS visitor_passes (
  visitor_pass_id CHAR(36) PRIMARY KEY,
  pass_code CHAR(12) NOT NULL,
  homeowner_id CHAR(36) NOT NULL,
  created_by_user_id CHAR(36) NOT NULL,
  visitor_name VARCHAR(120) NOT NULL,
  contact_number VARCHAR(30) NOT NULL,
  purpose VARCHAR(120) NOT NULL,
  vehicle_plate VARCHAR(30) NULL,
  visit_date DATE NOT NULL,
  pass_status ENUM('active', 'used', 'cancelled') NOT NULL DEFAULT 'active',
  visitor_log_id CHAR(36) NULL,
  redeemed_by_user_id CHAR(36) NULL,
  redeemed_at DATETIME NULL,
  cancelled_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_visitor_pass_homeowner FOREIGN KEY (homeowner_id) REFERENCES homeowners(homeowner_id) ON DELETE CASCADE,
  CONSTRAINT fk_visitor_pass_creator FOREIGN KEY (created_by_user_id) REFERENCES users(user_id),
  CONSTRAINT fk_visitor_pass_log FOREIGN KEY (visitor_log_id) REFERENCES visitor_logs(visitor_log_id) ON DELETE SET NULL,
  CONSTRAINT fk_visitor_pass_redeemer FOREIGN KEY (redeemed_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
  UNIQUE KEY uq_visitor_pass_code (pass_code),
  UNIQUE KEY uq_visitor_pass_log (visitor_log_id),
  INDEX idx_visitor_pass_homeowner_date (homeowner_id, visit_date, pass_status)
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
  CONSTRAINT fk_concerns_homeowner FOREIGN KEY (homeowner_id) REFERENCES homeowners(homeowner_id) ON DELETE CASCADE,
  CONSTRAINT fk_concerns_submitter FOREIGN KEY (submitted_by_user_id) REFERENCES users(user_id),
  CONSTRAINT fk_concerns_responder FOREIGN KEY (responded_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
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
  CONSTRAINT fk_announcements_poster FOREIGN KEY (posted_by_user_id) REFERENCES users(user_id),
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
  CONSTRAINT fk_notifications_recipient FOREIGN KEY (recipient_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
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
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
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
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_settings_updater FOREIGN KEY (updated_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

INSERT INTO system_settings (setting_key, setting_value)
VALUES
  ('monthly_due_amount', '1500.00'),
  ('monthly_due_day', '15'),
  ('monthly_penalty_amount', '200.00'),
  ('restrict_after_unpaid_months', '2'),
  ('sticker_renewal_period', '2026-2027')
ON DUPLICATE KEY UPDATE setting_value = setting_value;

INSERT INTO schema_migrations (migration_id)
VALUES ('001_production_schema')
ON DUPLICATE KEY UPDATE migration_id = VALUES(migration_id);

INSERT INTO schema_migrations (migration_id)
VALUES ('003_visitor_passes')
ON DUPLICATE KEY UPDATE migration_id = VALUES(migration_id);
