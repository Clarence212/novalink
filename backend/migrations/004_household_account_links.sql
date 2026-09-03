START TRANSACTION;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS requested_address VARCHAR(190) NULL AFTER email;

CREATE TABLE IF NOT EXISTS homeowner_user_links (
  homeowner_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  linked_by_user_id CHAR(36) NULL,
  linked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (homeowner_id, user_id),
  UNIQUE KEY uq_homeowner_user_links_user (user_id),
  CONSTRAINT fk_homeowner_user_links_homeowner FOREIGN KEY (homeowner_id) REFERENCES homeowners(homeowner_id) ON DELETE CASCADE,
  CONSTRAINT fk_homeowner_user_links_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_homeowner_user_links_actor FOREIGN KEY (linked_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX idx_homeowner_user_links_homeowner (homeowner_id)
) ENGINE=InnoDB;

INSERT IGNORE INTO homeowner_user_links (homeowner_id, user_id, linked_by_user_id, linked_at)
SELECT homeowner_id, user_id, NULL, created_at
FROM homeowners
WHERE user_id IS NOT NULL;

UPDATE homeowners SET user_id = NULL WHERE user_id IS NOT NULL;

INSERT INTO schema_migrations (migration_id)
VALUES ('004_household_account_links')
ON DUPLICATE KEY UPDATE migration_id = VALUES(migration_id);

COMMIT;
