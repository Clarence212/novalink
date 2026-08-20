# NovaLink Backend — PHP & MySQL Infrastructure

This directory contains the production backend API scripts and MySQL database schema for NovaLink HOA Management System (Novaville Homeowners Association, Inc.).

---

## 1. Database Setup (MySQL)

1. Open your MySQL client (XAMPP / phpMyAdmin / MySQL CLI).
2. Execute the `backend/schema.sql` script to create the `novalink_db` database and all 14 tables:
   ```bash
   mysql -u root -p < backend/schema.sql
   ```

---

## 2. Mail & Database Configuration

- Database Connection: Edit `backend/config/database.php` with your MySQL credentials:
  ```php
  define('DB_HOST', 'localhost');
  define('DB_NAME', 'novalink_db');
  define('DB_USER', 'root');
  define('DB_PASS', 'your_password');
  ```

- Mail Settings: Edit `backend/config/mail.php` with your SMTP details or local PHP mailer configuration:
  ```php
  return [
      'smtp_host' => 'smtp.gmail.com',
      'smtp_port' => 587,
      'smtp_user' => 'notifications@novaville.org',
      'smtp_pass' => 'your_app_password',
      'from_email' => 'no-reply@novaville.org',
      'from_name' => 'Novaville Homeowners Association, Inc.',
  ];
  ```

---

## 3. Email Verification & API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/backend/api/send_otp.php` | `POST` | Generates 6-digit OTP code, records in database, and emails the user/guest |
| `/backend/api/verify_email.php` | `POST` | Verifies submitted OTP against MySQL database and updates account status |

---

## 4. Operational Flow

1. **Guest Booking**: Guest enters details → `send_otp.php` dispatches email with HTML formatted template → Guest inputs code → `verify_email.php` validates code → Booking unlocked.
2. **Resident Registration**: Resident submits registration → `send_otp.php` dispatches verification email → `verify_email.php` confirms email → Account placed in Admin Approval Queue.
3. **Email Notification Hub**: All sent emails are logged in the `email_notifications` table in MySQL with timestamps and delivery status.
