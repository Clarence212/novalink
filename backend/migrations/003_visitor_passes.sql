-- Apply only after taking and verifying a database backup.
-- This migration is idempotent and does not modify existing visitor logs.

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

INSERT INTO schema_migrations (migration_id)
VALUES ('003_visitor_passes')
ON DUPLICATE KEY UPDATE migration_id = VALUES(migration_id);
