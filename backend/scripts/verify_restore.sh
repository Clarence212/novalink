#!/usr/bin/env bash
set -euo pipefail

: "${MYSQL_LOGIN_PATH:?Set MYSQL_LOGIN_PATH to a privileged mysql_config_editor login path.}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/novalink}"
BACKUP_FILE="${BACKUP_FILE:-}"

if [[ ! "$MYSQL_LOGIN_PATH" =~ ^[A-Za-z0-9_.-]+$ ]]; then
  echo "Invalid MySQL login-path name." >&2
  exit 2
fi
if [[ "$BACKUP_DIR" != /* || "$BACKUP_DIR" == "/" ]]; then
  echo "BACKUP_DIR must be a specific absolute directory." >&2
  exit 2
fi
if [[ -z "$BACKUP_FILE" ]]; then
  BACKUP_FILE="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name '*.sql.gz' -print | sort | tail -n 1)"
fi
if [[ -z "$BACKUP_FILE" || ! -f "$BACKUP_FILE" ]]; then
  echo "No backup file is available for restore verification." >&2
  exit 1
fi

gzip -t "$BACKUP_FILE"
if [[ -f "$BACKUP_FILE.sha256" ]]; then
  expected_digest="$(awk 'NR == 1 { print $1 }' "$BACKUP_FILE.sha256")"
  actual_digest="$(sha256sum "$BACKUP_FILE" | awk '{ print $1 }')"
  if [[ -z "$expected_digest" || "$actual_digest" != "$expected_digest" ]]; then
    echo "Backup checksum verification failed." >&2
    exit 1
  fi
fi

scratch_database="novalink_restore_test_$(date -u +%Y%m%d%H%M%S)_$$"
if [[ ! "$scratch_database" =~ ^novalink_restore_test_[0-9_]+$ ]]; then
  echo "Unsafe restore-test database name." >&2
  exit 2
fi
cleanup() {
  mysql --login-path="$MYSQL_LOGIN_PATH" -e "DROP DATABASE IF EXISTS \`$scratch_database\`" >/dev/null
}
trap cleanup EXIT

mysql --login-path="$MYSQL_LOGIN_PATH" -e \
  "CREATE DATABASE \`$scratch_database\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
gzip -dc "$BACKUP_FILE" | mysql --login-path="$MYSQL_LOGIN_PATH" "$scratch_database"

table_count="$(mysql --login-path="$MYSQL_LOGIN_PATH" --batch --skip-column-names "$scratch_database" \
  -e 'SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()')"
schema_marker="$(mysql --login-path="$MYSQL_LOGIN_PATH" --batch --skip-column-names "$scratch_database" \
  -e "SELECT COUNT(*) FROM schema_migrations WHERE migration_id = '001_production_schema'")"
if (( table_count < 20 )) || [[ "$schema_marker" != "1" ]]; then
  echo "Restore verification failed: schema is incomplete." >&2
  exit 1
fi
mysqlcheck --login-path="$MYSQL_LOGIN_PATH" --check "$scratch_database" >/dev/null
printf 'Restore verified in isolated database %s (%s tables).\n' "$scratch_database" "$table_count"
