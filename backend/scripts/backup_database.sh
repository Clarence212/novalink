#!/usr/bin/env bash
set -euo pipefail

: "${MYSQL_LOGIN_PATH:?Set MYSQL_LOGIN_PATH to a configured mysql_config_editor login path.}"
: "${DB_NAME:?Set DB_NAME to the exact NovaLink database name.}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/novalink}"

if [[ ! "$MYSQL_LOGIN_PATH" =~ ^[A-Za-z0-9_.-]+$ ]]; then
  echo "Invalid MySQL login-path name." >&2
  exit 2
fi
if [[ ! "$DB_NAME" =~ ^[A-Za-z0-9_]+$ ]]; then
  echo "Invalid database name." >&2
  exit 2
fi
if [[ "$BACKUP_DIR" != /* || "$BACKUP_DIR" == "/" ]]; then
  echo "BACKUP_DIR must be a specific absolute directory." >&2
  exit 2
fi

umask 077
install -d -m 0700 "$BACKUP_DIR"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="$BACKUP_DIR/${DB_NAME}-${timestamp}.sql.gz"
temporary="$(mktemp "$BACKUP_DIR/.${DB_NAME}-${timestamp}.XXXXXX")"
trap 'rm -f -- "$temporary"' EXIT

mysqldump \
  --login-path="$MYSQL_LOGIN_PATH" \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  --hex-blob \
  --default-character-set=utf8mb4 \
  "$DB_NAME" | gzip -9 > "$temporary"

gzip -t "$temporary"
if ! zgrep -q 'CREATE TABLE' "$temporary"; then
  echo "Backup verification failed: no CREATE TABLE statement found." >&2
  exit 1
fi
mv -- "$temporary" "$target"
sha256sum "$target" > "$target.sha256"
trap - EXIT
printf '%s\n' "$target"
