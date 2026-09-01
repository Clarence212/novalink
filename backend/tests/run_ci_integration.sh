#!/usr/bin/env bash
set -euo pipefail

php backend/tests/bootstrap_test_database.php
php backend/scripts/auto_migrate.php
session_dir="$(mktemp -d)"
server_log="$(mktemp)"
cleanup() {
  if [[ -n "${server_pid:-}" ]]; then
    kill "$server_pid" 2>/dev/null || true
  fi
  rm -rf -- "$session_dir"
  rm -f -- "$server_log"
}
trap cleanup EXIT

export NOVALINK_SESSION_SAVE_PATH="$session_dir"
php backend/tests/error_monitor_test.php
php -S 127.0.0.1:8080 -t . >"$server_log" 2>&1 &
server_pid=$!
ready=0
for _ in $(seq 1 30); do
  if curl --fail --silent http://127.0.0.1:8080/backend/api/health.php >/dev/null; then
    ready=1
    break
  fi
  sleep 1
done
if [[ "$ready" != "1" ]]; then
  cat "$server_log" >&2
  echo "NovaLink test server did not become ready." >&2
  exit 1
fi

NOVALINK_TEST_BASE_URL=http://127.0.0.1:8080 php backend/tests/api_integration.php
