# Shopynn local seed logins

Local-only accounts from the API seed scripts. Do not use these passwords in production.

| Role | Email | Password | Seed command |
|------|-------|----------|--------------|
| Platform admin | `admin@shopynn.local` | `Admin1234!` | `npm run seed:admin -w @shopynn/api` |
| Merchant manager | `manager@shopynn.local` | `Manager1234!` | `npm run seed:merchants -w @shopynn/api` |
| Field agent | `agent@shopynn.local` | `Agent1234!` | `npm run seed:merchants -w @shopynn/api` |
| Test shop owner | `test@shopynn.local` | `Test1234!` | `npm run seed:test -w @shopynn/api` |

## Demo catalog (Ghana retail SKUs)

Replaces a tenant’s products/categories (and by default sales/purchases/stock movements) with ~60 realistic demo products, plus customers/suppliers and **~6 months** of sales, purchases, and expenses.

```bash
# Local Docker DB (default account) — catalog + activity
npm run seed:demo-catalog -w @shopynn/api -- --wipe

# Catalog only (no sales/purchases/expenses)
npm run seed:demo-catalog -w @shopynn/api -- --wipe --no-activity

# Keep catalog; reseed partners + 6 months of activity
npm run seed:demo-catalog -w @shopynn/api -- --activity-only --email=you@example.com

# Railway / remote Postgres
DATABASE_URL='postgresql://USER:PASS@HOST:PORT/railway?sslmode=require' \
  npm run seed:demo-catalog -w @shopynn/api -- --wipe --email=you@example.com
```

`--wipe` or `--activity-only` is required.

## Notes

- Web: `http://127.0.0.1:3001`
- API: `http://127.0.0.1:4001`
- Mobile (simulator) uses Railway production API in `__DEV__` unless you switch `LOCAL_DEV_API` in `apps/mobile/src/config/index.js`
- After re-seeding roles/permissions, sign out and sign back in
- After `seed:demo-catalog`, pull-to-refresh / re-sync on mobile
