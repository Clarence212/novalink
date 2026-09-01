#!/usr/bin/env bash
set -euo pipefail

: "${MYSQL_LOGIN_PATH:?Set MYSQL_LOGIN_PATH to a privileged mysql_config_editor login path.}"
: "${DB_NAME:?Set DB_NAME to the exact NovaLink database name.}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/novalink}"

if [[ ! "$MYSQL_LOGIN_PATH" =~ ^[A-Za-z0-9_.-]+$ || ! "$DB_NAME" =~ ^[A-Za-z0-9_]+$ ]]; then
  echo "Invalid MySQL login-path or database name." >&2
  exit 2
fi

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
migrations_dir="$(cd -- "$script_dir/../migrations" && pwd)"
backup_file="$(MYSQL_LOGIN_PATH="$MYSQL_LOGIN_PATH" DB_NAME="$DB_NAME" BACKUP_DIR="$BACKUP_DIR" bash "$script_dir/backup_database.sh")"
printf 'Verified backup created: %s\n' "$backup_file"

mapfile -t migration_files < <(find "$migrations_dir" -maxdepth 1 -type f -name '[0-9][0-9][0-9]_*.sql' -print | sort)
applied=0
for migration_file in "${migration_files[@]}"; do
  migration_id="$(basename -- "$migration_file" .sql)"
  if [[ ! "$migration_id" =~ ^[0-9]{3}_[A-Za-z0-9_]+$ ]]; then
    echo "Unsafe migration filename: $migration_file" >&2
    exit 2
  fi
  already_applied="$(mysql --login-path="$MYSQL_LOGIN_PATH" --batch --skip-column-names "$DB_NAME" \
    -e "SELECT COUNT(*) FROM schema_migrations WHERE migration_id = '$migration_id'")"
  if [[ "$already_applied" == "1" ]]; then
    printf 'Already applied: %s\n' "$migration_id"
    continue
  fi
  printf 'Applying: %s\n' "$migration_id"
  mysql --login-path="$MYSQL_LOGIN_PATH" "$DB_NAME" < "$migration_file"
  migration_recorded="$(mysql --login-path="$MYSQL_LOGIN_PATH" --batch --skip-column-names "$DB_NAME" \
    -e "SELECT COUNT(*) FROM schema_migrations WHERE migration_id = '$migration_id'")"
  if [[ "$migration_recorded" != "1" ]]; then
    echo "Migration did not record itself: $migration_id" >&2
    exit 1
  fi
  applied=$((applied + 1))
done

printf 'Migration run completed; %d migration(s) applied.\n' "$applied"
