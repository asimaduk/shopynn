# Import EC2 Postgres data into Railway (latest schema)

Goal: **Railway owns the current schema** (`schema.sql` + `migrations/`).  
EC2 dump contributes **data only**.

Do not restore a full EC2 backup on top of an empty/partial Railway DB and expect migrate-on-boot to fix everything — older dumps often lack tables/PKs that newer migrations assume.

## Prerequisites

- Custom-format dump from EC2: `shopynn-ec2.dump` (`pg_dump -Fc ...`)
- Railway Postgres public URL (`DATABASE_URL`)
- API service can be stopped (replicas = 0) during import

## Procedure

### 1. Stop the API

Railway → API service → Scaling → **replicas = 0** (or stop the service).  
Prevents migrate-on-boot from racing the import.

### 2. Wipe Railway `public`

```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO PUBLIC;
GRANT ALL ON SCHEMA public TO CURRENT_USER;
```

### 3. Apply latest schema (empty DB)

Set API replicas back to **1** and redeploy once.  
Boot runs `scripts/db-migrate.sh`:

- empty DB → baseline `schema.sql` + seeds
- then every file in `migrations/`

Confirm logs end with `db-migrate: up to date.` and the API stays healthy.

Then **stop the API again** (replicas = 0).

### 4. Clear seed rows (keep tables)

Seeds from step 3 would collide with EC2 IDs. Truncate all data:

```sql
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> 'schema_migrations'
  ) LOOP
    EXECUTE format('TRUNCATE TABLE public.%I CASCADE', r.tablename);
  END LOOP;
END $$;
```

Keep `schema_migrations` so boot does not re-apply migrations.

### 5. Restore **data only** from EC2

```bash
export RAILWAY_DATABASE_URL='postgresql://USER:PASS@HOST:PORT/railway?sslmode=require'

pg_restore -v --data-only --disable-triggers --no-owner --no-acl \
  -d "$RAILWAY_DATABASE_URL" \
  shopynn-ec2.dump
```

Ignore errors for tables that exist only in the old dump (or only in the new schema).  
If a table fails on unknown columns, that table’s dump is newer/older than schema — fix that table manually or exclude it with a restore list.

### 6. Start the API

Replicas = 1 / Redeploy.  
Migrate should report mostly skipped (`schema_migrations` already filled) and the app should serve EC2 data on the new schema.

### 7. Spot-check

```sql
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM tenants;
SELECT COUNT(*) FROM products;
SELECT id FROM schema_migrations ORDER BY id;
```

Try a known login on shopynn-web.

## Notes

- Prefer the **same** `JWT_SECRET` as EC2 if you want existing tokens to keep working.
- S3/object storage is separate from Postgres — keep AWS env vars if uploads matter.
- If `pg_restore` reports FK errors, you forgot `--disable-triggers` or skipped the truncate step.
