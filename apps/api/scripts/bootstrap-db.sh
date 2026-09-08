#!/usr/bin/env bash
# Bootstrap schema + permission seeds against the configured Postgres.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

: "${PGHOST:=127.0.0.1}"
: "${PGPORT:=5432}"
: "${PGUSER:=shopynn}"
: "${PGPASSWORD:=shopynn}"
: "${PGDATABASE:=shopynn}"

export PGPASSWORD

echo "Bootstrapping ${PGDATABASE:-db}..."

# Prefer the migrate runner (baseline + all migrations + schema_migrations tracking).
bash scripts/db-migrate.sh

echo "Bootstrap complete."
