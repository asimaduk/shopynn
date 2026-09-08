# Shopynn deploy guide

Monorepo layout:

| App | Path | Host |
|-----|------|------|
| API | `apps/api` | Railway (Docker) |
| Merchant / admin web | `apps/web` | Vercel |
| Marketing site | `apps/site` | Vercel |
| Mobile | `apps/mobile` | EAS / App Store / Play |
| Print | `apps/print` | On-prem only (USB printers) |

## Prevent cross-app rebuilds

### Vercel (web + site)

Create **two** Vercel projects from the **same** Git repo:

1. **shopynn-web**
   - Root Directory: `apps/web`
   - Framework: Next.js
   - Ignored Build Step:
     ```bash
     bash scripts/vercel-ignore-web.sh
     ```
   - Equivalent: `npx turbo-ignore @shopynn/web`

2. **shopynn-site**
   - Root Directory: `apps/site`
   - Framework: **TanStack Start** (not Next.js — this app is Vite + TanStack Start)
   - Leave Build Command / Output Directory empty (Nitro writes `.vercel/output`)
   - `apps/site/vercel.json` sets `"framework": "tanstack-start"`
   - Ignored Build Step:
     ```bash
     bash scripts/vercel-ignore-site.sh
     ```
   - Equivalent: `npx turbo-ignore @shopynn/site`
   - Env: `VITE_API_BASE_URL` (Railway API origin), `VITE_WEB_APP_URL` (Vercel web origin)

`turbo-ignore` / these scripts exit `0` to **skip** the deploy when the commit does not touch that app (so an API-only push will not rebuild Vercel).

### Railway (API)

- Root Directory / service source: `apps/api`
- Builder: Dockerfile (`apps/api/Dockerfile`)
- Optional: set Railway **Watch Paths** to `apps/api/**` so web/site-only commits do not redeploy the API
- Healthcheck: `GET /health`

Local smoke test:

```bash
docker compose up --build api
curl -s http://localhost:4000/health
```

## Environment checklist

### Railway — `@shopynn/api`

Copy from `apps/api/.env.example`. Required at minimum:

- `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` (or Railway `DATABASE_URL`)
- Listen on Railway’s `PORT` (app reads `PORT` then `APP_PORT`; do not hard-pin a different port)
- `JWT_SECRET`
- `PAYSTACK_SECRET_KEY` (production payments / withdrawals)
- `FRONTEND_URL` / `PAYMENT_CALLBACK_URL` (point at Vercel web URL)
- AWS/S3 keys if uploads are enabled

Never commit real `.env` files.

### Vercel — `@shopynn/web`

- Public API base URL pointing at the Railway API (whatever env name the app already uses, e.g. `NEXT_PUBLIC_*` / existing config)
- Auth / OAuth secrets as already configured in the former `ims-web` project

### Vercel — `@shopynn/site`

- `VITE_API_BASE_URL` — Railway API origin (no trailing slash), e.g. `https://shopynn-production.up.railway.app`
- `VITE_WEB_APP_URL` — Vercel web app origin for sign-in links
- Any analytics keys

### Mobile — `@shopynn/mobile`

- Update API base URL to the Railway public URL after cutover
- Rebuild with EAS when the API host changes

## Git cutover (old Bitbucket remotes)

Previously each app was a separate Bitbucket repo (`ims-services`, `ims-web`, `ims-checkr` / Cheqstock mobile, `ims-print-service`).

1. Create a new empty remote for this monorepo (e.g. `shopynn`).
2. Push this repo as the single source of truth.
3. Point Railway + both Vercel projects at the new remote.
4. Archive / mark read-only the old Bitbucket repos.
5. **Rotate any credentials that were ever embedded in Git remote URLs.**

Do not force-push rewritten history onto the old remotes.

## Print service

`apps/print` stays in the monorepo for code unity. Do **not** deploy it to Railway or Vercel; it talks to local USB ESC/POS printers.
