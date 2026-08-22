# NovaLink HOA Management System

NovaLink is the role-based HOA portal described in the project proposal and requirements documents. It supports administrators, residents, security personnel, and email-verified facility guests.

## Implemented architecture

- React 19 + Vite frontend. The browser contains presentation state only; it is not an authority for users, roles, passwords, dues, approvals, or restrictions.
- PHP 8.0+ JSON API with server sessions, `HttpOnly`/`SameSite=Strict` cookies, CSRF protection, input validation, role and ownership checks, rate limiting, and audit logging.
- MySQL 8 / MariaDB 10.6+ centralized relational schema with foreign keys, unique constraints, transactions, payment allocations, and private upload metadata.
- Brevo transactional email integration. OTPs use `random_int`, are stored only as password hashes, expire after 15 minutes, and allow at most five verification attempts.
- Apache configuration for same-origin production hosting, SPA fallback, security headers, HTTPS, and denial of internal/backend storage paths.

There are no built-in accounts or default passwords. Create the first administrator with the CLI bootstrap command in [backend/README.md](backend/README.md).

## Modules

- Account registration, email verification, administrator approval, login lockout, password reset, and forced temporary-password replacement
- Homeowner and household-occupant master records
- Vehicle submissions, review, sticker renewals, and server-generated sticker numbers
- Facility configuration and conflict-safe resident/verified-guest reservations
- Monthly dues generation, overdue penalties, partial payment allocation, proof validation, reminders, payment QR configuration, and automatic service restrictions
- Visitor entry and exit logs for security personnel
- Resident concerns and administrator responses
- Announcements, delivery logs, dashboards, and audit records

## Local frontend development

The Vite development server proxies `/backend` to PHP on port 8000.

```bash
npm ci
php -S 127.0.0.1:8000 -t .
npm run dev
```

Copy `backend/config/env.example.php` to `backend/config/env.php` and configure a local database before starting PHP. Never commit `env.php`.

Build the production frontend with:

```bash
npm run build
```

## Database setup

Create an empty database with `utf8mb4`, then import the schema into that selected database:

```bash
mysql -u root -p -e "CREATE DATABASE novalink_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
mysql -u root -p novalink_db < backend/schema.sql
```

For an installation that used the former beta schema, do not import the new schema over the old tables. Use the side-by-side, backup-first migration in `backend/migrations/upgrade_beta_to_v2.sh` and review its stated legacy-data limitations.

## Oracle Linux 9 production outline

1. Install Apache, TLS support, PHP 8.0+, required PHP extensions, and MySQL/MariaDB. Enable `httpd`, `php-fpm`, and the database service.
2. Create `/var/www/novalink/{releases,shared/backend/config,shared/backend/storage}` and grant the deployment user ownership of `/var/www/novalink`.
3. Put the uncommitted production configuration at `/var/www/novalink/shared/backend/config/env.php` with mode `0640` and an appropriate service group.
4. Install `deploy/apache/novalink.conf` under `/etc/httpd/conf.d/`, provision the referenced TLS certificate, run `apachectl configtest`, and reload Apache.
5. Apply SELinux labels: content is `httpd_sys_content_t`; only `/var/www/novalink/shared/backend/storage` is `httpd_sys_rw_content_t`. Enable the narrowly required Apache database/network booleans for MySQL and Brevo.
6. Import `backend/schema.sql`, create the first administrator, and schedule `backend/scripts/maintenance.php --generate-dues` once daily.
7. Configure the GitHub environment secrets listed below and trigger the deployment workflow.

The production workflow publishes only compiled frontend files and the required backend runtime. It uses immutable release directories, persistent symlinks for `env.php` and uploads, an atomic `current` symlink switch, pinned SSH host keys, and a post-deployment health check.

Required GitHub environment secrets:

- `ORACLE_HOST`
- `ORACLE_USER`
- `ORACLE_SSH_KEY`
- `ORACLE_KNOWN_HOSTS` — the pre-verified complete `known_hosts` line, not a runtime `ssh-keyscan`

## Production verification

```bash
apachectl configtest
curl --fail https://novalinkhub.tech/backend/api/health.php
curl -I https://novalinkhub.tech/
```

Then test every role using non-production sample accounts: failed-login lockout, resident registration matching, admin approval, guest OTP, overlapping reservation rejection, payment proof authorization, partial/full allocation, overdue restriction/lifting, visitor exit, concern response, announcement delivery status, and first-login password replacement.

See [backend/README.md](backend/README.md) for endpoint, cron, backup, and account-bootstrap details.
