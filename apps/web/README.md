# Shopynn admin web

Next.js control panel for merchants and staff.

## Deployment

Deployed on Vercel as `admin-shopynn`. Dependencies install from the monorepo root `package-lock.json`.

Vercel skips projects whose files did not change, so a fix that only touches the root lockfile (for example a
dependency security upgrade in another app) does not rebuild this project. Start a new deployment from the latest
`main` in the Vercel dashboard, or push a change under `apps/web`. Redeploying an older failed deployment rebuilds
that old commit and its old lockfile.
