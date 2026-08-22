# NovaLink backend operations

## Requirements

- PHP 8.0+ with PDO MySQL, cURL, mbstring, fileinfo, JSON, and session support
- MySQL 8 or MariaDB 10.6+
- HTTPS in production

## Configuration

Copy `config/env.example.php` to the production shared path `config/env.php` and replace every placeholder. The app also accepts the corresponding `NOVALINK_*` environment variables. The runtime database account needs only `SELECT`, `INSERT`, `UPDATE`, and `DELETE` on the NovaLink database after the schema has been installed by a separate privileged account.

Recommended permissions:

```bash
chown root:apache /var/www/novalink/shared/backend/config/env.php
chmod 0640 /var/www/novalink/shared/backend/config/env.php
chown -R apache:apache /var/www/novalink/shared/backend/storage
chmod -R u=rwX,g=rX,o= /var/www/novalink/shared/backend/storage
```

## Fresh database

`schema.sql` intentionally does not select or create a database. Import it into the database you explicitly selected:

```bash
mysql -u root -p -e "CREATE DATABASE novalink_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
mysql -u root -p novalink_db < backend/schema.sql
```

Do not run the new schema over beta tables with the same names. For the exact former beta schema, configure a MySQL login path and use the side-by-side migration:

```bash
mysql_config_editor set --login-path=novalink-admin --host=127.0.0.1 --user=root --password
OLD_DB=novalink_db NEW_DB=novalink_v2 MYSQL_LOGIN_PATH=novalink-admin \
  bash backend/migrations/upgrade_beta_to_v2.sh
```

The script creates a timestamped dump first and refuses to overwrite an existing target database. Guest reservations and old proof binaries require manual review because the beta database did not retain enough trustworthy metadata for an automatic migration.

## Create the first administrator

There is no seeded account. Run this on the server after importing the schema:

```bash
read -rsp 'Temporary administrator password: ' NOVALINK_INITIAL_ADMIN_PASSWORD
export NOVALINK_INITIAL_ADMIN_PASSWORD
php backend/scripts/create_admin.php --email=admin@example.com --name='NHAI Administrator'
unset NOVALINK_INITIAL_ADMIN_PASSWORD
```

The password must be 12–128 characters with a letter and number. It is hashed with PHP's current `PASSWORD_DEFAULT`, and the administrator must replace it at first sign-in.

## Maintenance and monthly billing

`scripts/maintenance.php` recalculates penalties/restrictions and removes expired verification/rate-limit records. `--generate-dues` also creates missing records for the current month; its unique constraint makes repeated execution idempotent.

Example root crontab entry (adjust the PHP path and service user):

```cron
17 2 * * * runuser -u apache -- /usr/bin/php /var/www/novalink/current/backend/scripts/maintenance.php --generate-dues >> /var/log/novalink-maintenance.log 2>&1
```

## API surface

| Endpoint | Access | Purpose |
|---|---|---|
| `api/auth.php` | public/session | Session, login, logout, registration, password reset/change |
| `api/send_otp.php` | public + CSRF/rate limit | Send hashed, expiring registration/reset/guest OTP |
| `api/verify_email.php` | public + CSRF/rate limit | Verify OTP and issue one-time opaque action token or guest session |
| `api/state.php` | role scoped | Centralized application state; public scope returns guest-bookable facilities only |
| `api/records.php` | role/ownership scoped | All domain mutations and private multipart uploads |
| `api/files.php` | admin/resident ownership scoped | Stream payment proofs and active payment QR images |
| `api/send_notification.php` | admin only | Manual email notification |
| `api/health.php` | public | Minimal database/schema health probe |

All state-changing browser requests require the server-generated `X-CSRF-Token`. Backend responses never return password hashes, OTP hashes, provider credentials, database errors, or physical upload paths.

## Backup and recovery

Back up both the database and persistent storage. A database dump without `shared/backend/storage` cannot restore payment proofs or the active payment QR.

```bash
mysqldump --single-transaction --routines --triggers novalink_db > novalink-db.sql
tar -C /var/www/novalink/shared -czf novalink-storage.tgz backend/storage
```

Test restoration periodically in an isolated database and directory. Atomic releases make application rollback a symlink change, but schema/data rollback still requires the verified backups.
