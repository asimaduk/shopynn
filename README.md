# Shopynn

Monorepo for the Shopynn commerce platform.

## Apps

| Package | Path | Description |
|---------|------|-------------|
| `@shopynn/api` | `apps/api` | Express API + Postgres |
| `@shopynn/web` | `apps/web` | Next.js merchant / admin |
| `@shopynn/site` | `apps/site` | Marketing site |
| `@shopynn/mobile` | `apps/mobile` | React Native merchant app |
| `@shopynn/print` | `apps/print` | Local ESC/POS print agent |

## Quick start

```bash
# Install (from repo root) — prefer per-app install if workspaces conflict with RN
cd apps/api && npm install
cd ../web && npm install
cd ../site && npm install

# API + Postgres locally
docker compose up --build api

# Or API without Docker
cd apps/api && cp .env.example .env && npm run dev
```

## Deploy

See [docs/DEPLOY.md](docs/DEPLOY.md) for Railway, Vercel, ignore-build setup, and env checklist.

## Workspaces

Root `package.json` defines npm workspaces over `apps/*` and Turbo pipelines for `build` / `lint` / `dev`. Mobile may still be developed from `apps/mobile` directly (Metro / EAS).
