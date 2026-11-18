# Shopynn local seed logins

Local-only accounts from the API seed scripts. Do not use these passwords in production.

| Role | Email | Password | Seed command |
|------|-------|----------|--------------|
| Platform admin | `admin@shopynn.local` | `Admin1234!` | `npm run seed:admin -w @shopynn/api` |
| Merchant manager | `manager@shopynn.local` | `Manager1234!` | `npm run seed:merchants -w @shopynn/api` |
| Field agent | `agent@shopynn.local` | `Agent1234!` | `npm run seed:merchants -w @shopynn/api` |
| Test shop owner | `test@shopynn.local` | `Test1234!` | `npm run seed:test -w @shopynn/api` |
| **Demo store owner** | `demo@shopynn.app` | `DemoStore2026!` | `npm run seed:demo-store -w @shopynn/api` |
| **Demo field agent** | `demo-agent@shopynn.app` | `DemoAgent2026!` | `npm run seed:demo-store -w @shopynn/api` |
| **Demo visitor** | `demo-visitor@shopynn.app` | *(not for login — use `/demo`)* | `npm run seed:demo-store -w @shopynn/api` |

## Dedicated Demo Store (field agents + public live demo)

One shared **Shopynn Demo Store** (Premium) with Ghana retail catalog + ~6 months of activity. Tenant `settings.demo = true`.

| Who | How |
|-----|-----|
| Public (marketing site) | One-click **Try live demo** → web `/demo` → `POST /api/demo/enter` as **Demo Visitor** (restricted role). **Never publish owner/agent passwords on the site.** |
| Field agents | Private sign-in as `demo-agent@shopynn.app` (password only in this doc / ops vault — not marketing) |
| Owner admin | Private `demo@shopynn.app` for ops/seed only |

### Hardening (live demo)

- Enter issues a JWT for **Demo Visitor** (manager-like *browse* + POS sell): sees seeded sales/reports/stock/purchases/expenses/online orders; no staff/roles admin, no catalog/purchase/expense writes, no MoMo/payouts.
- API blocks password change, staff CRUD, role edits, company profile update, uploads, invoice email, step-up/contact OTPs on the demo tenant (`DEMO_ACTION_BLOCKED`).
- Money paths still blocked (`DEMO_MONEY_BLOCKED`).
- Outbound email/SMS from a demo session is suppressed in `sendEmailService` / `sendSmsService`.
- `DEMO_ENTER_SECRET` — required in production; web sends `X-Demo-Enter-Secret` (server-side only). Set the **same** value on API and web.
- Optional Cloudflare Turnstile: set `TURNSTILE_SECRET_KEY` (API) + `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (web).
- Nightly reset at **03:00 Africa/Accra** reseeds catalog + activity; users/passwords preserved.
- Do **not** put real merchant data, real Paystack keys tied to live chargeable demos, or agent passwords on public pages.

```bash
# Local
npm run seed:demo-store -w @shopynn/api

# Railway / production
DATABASE_URL='postgresql://USER:PASS@HOST:PORT/railway?sslmode=require' \
  npm run seed:demo-store -w @shopynn/api

# Accounts only (skip catalog wipe/reseed)
npm run seed:demo-store -w @shopynn/api -- --skip-catalog
```

Re-run anytime to reset passwords, refresh Demo Visitor role, and set `settings.demo`.

**EC2 cutover:** the Railway truncate + EC2 restore wipes this tenant. After restore, re-run `seed:demo-store` (see [DB_IMPORT_EC2.md](./DB_IMPORT_EC2.md) §8).

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
