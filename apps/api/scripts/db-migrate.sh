#!/usr/bin/env bash
# Apply baseline schema (empty DB) + pending SQL migrations, then exit 0.
# Used on Railway/Docker boot (similar to `prisma migrate deploy`).
#
# Env: DATABASE_URL  OR  PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE
# Optional: SKIP_DB_MIGRATE=1 to no-op
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ "${SKIP_DB_MIGRATE:-}" == "1" ]]; then
  echo "db-migrate: SKIP_DB_MIGRATE=1 — skipping."
  exit 0
fi

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [[ -n "${DATABASE_URL:-}" ]]; then
  export PGDATABASE_URL="$DATABASE_URL"
  PSQL=(psql "$DATABASE_URL")
else
  : "${PGHOST:=127.0.0.1}"
  : "${PGPORT:=5432}"
  : "${PGUSER:=shopynn}"
  : "${PGPASSWORD:=shopynn}"
  : "${PGDATABASE:=shopynn}"
  export PGPASSWORD
  PSQL=(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE")
fi

echo "db-migrate: waiting for Postgres..."
for i in $(seq 1 30); do
  if "${PSQL[@]}" -v ON_ERROR_STOP=1 -c "SELECT 1" >/dev/null 2>&1; then
    break
  fi
  if [[ "$i" -eq 30 ]]; then
    echo "db-migrate: could not connect to Postgres after 30s" >&2
    exit 1
  fi
  sleep 1
done

"${PSQL[@]}" -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
  id varchar(200) PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SQL

tenants_exists="$("${PSQL[@]}" -v ON_ERROR_STOP=1 -tAc "SELECT CASE WHEN to_regclass('public.tenants') IS NULL THEN 0 ELSE 1 END")"
tenants_exists="$(echo "$tenants_exists" | tr -d '[:space:]')"

if [[ "$tenants_exists" != "1" ]]; then
  echo "db-migrate: empty database — applying baseline schema + seeds..."
  # schema.sql has a few out-of-order ALTERs; continue past those, then fix up.
  "${PSQL[@]}" -v ON_ERROR_STOP=0 -f schema.sql >/tmp/shopynn-schema-migrate.log 2>&1 || true

  "${PSQL[@]}" -v ON_ERROR_STOP=1 <<'SQL'
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS payment_mode varchar(20) not null default 'full';
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS amount_paid decimal(12,2) not null default 0;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS balance_due decimal(12,2) not null default 0;
ALTER TABLE IF EXISTS tenants ADD COLUMN IF NOT EXISTS creator_id varchar(40);
ALTER TABLE IF EXISTS tenants ADD COLUMN IF NOT EXISTS updator_id varchar(40);
ALTER TABLE IF EXISTS tenants ADD COLUMN IF NOT EXISTS subscription_id varchar(40);
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS warehouse_id varchar(40);
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS merchant_id varchar(40);
SQL

  "${PSQL[@]}" -v ON_ERROR_STOP=1 -f seed-permissions.sql
  if [[ -f industries.sql ]]; then
    "${PSQL[@]}" -v ON_ERROR_STOP=0 -f industries.sql >/tmp/shopynn-industries-migrate.log 2>&1 || true
  fi
  echo "db-migrate: baseline applied."
fi

shopt -s nullglob
files=(migrations/*.sql)
# Sort for stable apply order (bash 3 compatible — no mapfile).
IFS=$'\n' files=($(printf '%s\n' "${files[@]:-}" | sort))
unset IFS

if [[ ${#files[@]} -eq 0 || -z "${files[0]:-}" ]]; then
  echo "db-migrate: no migration files found."
  exit 0
fi

for file in "${files[@]}"; do
  name="$(basename "$file")"
  applied="$("${PSQL[@]}" -v ON_ERROR_STOP=1 -tAc "SELECT 1 FROM schema_migrations WHERE id = '$name' LIMIT 1")"
  applied="$(echo "$applied" | tr -d '[:space:]')"
  if [[ "$applied" == "1" ]]; then
    continue
  fi
  echo "db-migrate: applying $name ..."
  "${PSQL[@]}" -v ON_ERROR_STOP=1 -f "$file"
  "${PSQL[@]}" -v ON_ERROR_STOP=1 -c "INSERT INTO schema_migrations (id) VALUES ('$name') ON CONFLICT (id) DO NOTHING"
  echo "db-migrate: applied $name"
done

echo "db-migrate: up to date."
