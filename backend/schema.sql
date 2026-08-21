CREATE DATABASE IF NOT EXISTS novalink_db DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE novalink_db;

CREATE TABLE IF NOT EXISTS roles (
  role_id INT AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB;

INSERT INTO roles (role_id, role_name) VALUES (1, 'admin'), (2, 'security'), (3, 'resident')
ON DUPLICATE KEY UPDATE role_name=VALUES(role_name);

CREATE TABLE IF NOT EXISTS users (
  user_id VARCHAR(36) PRIMARY KEY,
  role_id INT NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  account_status ENUM('pending', 'active', 'rejected', 'inactive') DEFAULT 'pending',
  email_verified TINYINT(1) DEFAULT 0,
  email_verified_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS account_email_verifications (
  verification_id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  otp_code VARCHAR(10) NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  verified_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  reset_id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  otp_code VARCHAR(10) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS homeowners (
  homeowner_id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NULL UNIQUE,
  owner_name VARCHAR(100) NOT NULL,
  block_lot VARCHAR(100) NOT NULL,
  street VARCHAR(100) NOT NULL,
  contact_number VARCHAR(20) NOT NULL,
  email VARCHAR(150) NOT NULL,
  unpaid_months INT DEFAULT 0,
  restricted TINYINT(1) DEFAULT 0,
  record_status ENUM('active', 'archived') DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS household_occupants (
  occupant_id VARCHAR(36) PRIMARY KEY,
  homeowner_id VARCHAR(36) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  relationship VARCHAR(50) NOT NULL,
  FOREIGN KEY (homeowner_id) REFERENCES homeowners(homeowner_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS vehicles (
  vehicle_id VARCHAR(36) PRIMARY KEY,
  homeowner_id VARCHAR(36) NOT NULL,
  submitted_by VARCHAR(36) NOT NULL,
  reviewed_by VARCHAR(36) NULL,
  vehicle_type VARCHAR(50) NOT NULL,
  make_model VARCHAR(100) NOT NULL,
  plate_number VARCHAR(20) NOT NULL UNIQUE,
  color VARCHAR(50) NOT NULL,
  approval_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (homeowner_id) REFERENCES homeowners(homeowner_id) ON DELETE CASCADE,
  FOREIGN KEY (submitted_by) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS vehicle_sticker_renewals (
  renewal_id VARCHAR(36) PRIMARY KEY,
  vehicle_id VARCHAR(36) NOT NULL,
  homeowner_id VARCHAR(36) NOT NULL,
  requested_by VARCHAR(36) NOT NULL,
  reviewed_by VARCHAR(36) NULL,
  renewal_period VARCHAR(20) NOT NULL,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  sticker_number VARCHAR(50) NULL UNIQUE,
  requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  approved_at DATETIME NULL,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
  FOREIGN KEY (homeowner_id) REFERENCES homeowners(homeowner_id) ON DELETE CASCADE,
  FOREIGN KEY (requested_by) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS facilities (
  facility_id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  capacity INT NOT NULL,
  rate VARCHAR(50) NOT NULL,
  guest_bookable TINYINT(1) DEFAULT 1,
  is_active TINYINT(1) DEFAULT 1
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS guest_email_verifications (
  guest_verification_id VARCHAR(36) PRIMARY KEY,
  guest_email VARCHAR(150) NOT NULL,
  guest_name VARCHAR(100) NOT NULL,
  otp_code VARCHAR(10) NOT NULL,
  expires_at DATETIME NOT NULL,
  verified_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS facility_reservations (
  reservation_id VARCHAR(36) PRIMARY KEY,
  facility_id VARCHAR(36) NOT NULL,
  homeowner_id VARCHAR(36) NULL,
  guest_id VARCHAR(36) NULL,
  requester_type ENUM('resident', 'guest') NOT NULL,
  requester_name VARCHAR(100) NOT NULL,
  reservation_date DATE NOT NULL,
  time_slot VARCHAR(50) NOT NULL,
  purpose VARCHAR(255) NOT NULL,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  approved_by VARCHAR(36) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (facility_id) REFERENCES facilities(facility_id) ON DELETE CASCADE,
  FOREIGN KEY (homeowner_id) REFERENCES homeowners(homeowner_id) ON DELETE SET NULL,
  FOREIGN KEY (approved_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS dues (
  dues_id VARCHAR(36) PRIMARY KEY,
  homeowner_id VARCHAR(36) NOT NULL,
  billing_month VARCHAR(50) NOT NULL,
  amount_due DECIMAL(10,2) NOT NULL DEFAULT 1500.00,
  penalty_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  due_date DATE NOT NULL,
  status ENUM('paid', 'unpaid') DEFAULT 'unpaid',
  FOREIGN KEY (homeowner_id) REFERENCES homeowners(homeowner_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payments (
  payment_id VARCHAR(36) PRIMARY KEY,
  homeowner_id VARCHAR(36) NOT NULL,
  submitted_by VARCHAR(36) NOT NULL,
  validated_by VARCHAR(36) NULL,
  amount_paid DECIMAL(10,2) NOT NULL,
  payment_reference VARCHAR(100) NOT NULL,
  proof_image_path VARCHAR(255) NULL,
  validation_status ENUM('pending', 'validated', 'rejected') DEFAULT 'pending',
  payment_date DATE NOT NULL,
  validated_at DATETIME NULL,
  FOREIGN KEY (homeowner_id) REFERENCES homeowners(homeowner_id) ON DELETE CASCADE,
  FOREIGN KEY (submitted_by) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (validated_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS visitor_logs (
  visitor_log_id VARCHAR(36) PRIMARY KEY,
  visitor_name VARCHAR(100) NOT NULL,
  contact_number VARCHAR(20) NOT NULL,
  purpose VARCHAR(100) NOT NULL,
  destination_address VARCHAR(150) NOT NULL,
  vehicle_plate VARCHAR(20) NULL,
  entry_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  exit_time DATETIME NULL,
  recorded_by VARCHAR(36) NOT NULL,
  FOREIGN KEY (recorded_by) REFERENCES users(user_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS concerns (
  concern_id VARCHAR(36) PRIMARY KEY,
  homeowner_id VARCHAR(36) NOT NULL,
  submitted_by VARCHAR(36) NOT NULL,
  responded_by VARCHAR(36) NULL,
  concern_type VARCHAR(50) NOT NULL,
  subject VARCHAR(150) NOT NULL,
  description TEXT NOT NULL,
  status ENUM('pending', 'in-progress', 'resolved') DEFAULT 'pending',
  admin_response TEXT NULL,
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  responded_at DATETIME NULL,
  FOREIGN KEY (homeowner_id) REFERENCES homeowners(homeowner_id) ON DELETE CASCADE,
  FOREIGN KEY (submitted_by) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (responded_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS announcements (
  announcement_id VARCHAR(36) PRIMARY KEY,
  posted_by VARCHAR(36) NOT NULL,
  title VARCHAR(150) NOT NULL,
  content TEXT NOT NULL,
  priority ENUM('normal', 'important', 'urgent') DEFAULT 'normal',
  date_posted DATE NOT NULL,
  status ENUM('draft', 'published') DEFAULT 'published',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (posted_by) REFERENCES users(user_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS email_notifications (
  notification_id VARCHAR(36) PRIMARY KEY,
  recipient_email VARCHAR(150) NOT NULL,
  subject VARCHAR(200) NOT NULL,
  body_text TEXT NOT NULL,
  email_type ENUM('otp_verification', 'account_approval', 'dues_reminder', 'concern_update', 'reservation_update', 'announcement_broadcast') NOT NULL,
  status ENUM('queued', 'sent', 'failed') DEFAULT 'sent',
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
