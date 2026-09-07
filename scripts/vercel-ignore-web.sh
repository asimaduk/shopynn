#!/usr/bin/env bash
# Vercel Ignored Build Step for @shopynn/web
# Exit 0 = skip deploy; exit 1 = continue build
set -euo pipefail
cd "$(dirname "$0")/.."
if command -v npx >/dev/null 2>&1; then
  npx --yes turbo-ignore @shopynn/web --fallback=HEAD^1
  exit $?
fi
# Fallback without turbo-ignore
if git diff --quiet HEAD^ HEAD -- apps/web package-lock.json package.json turbo.json; then
  echo "No changes affecting @shopynn/web — skipping."
  exit 0
fi
echo "Changes detected for @shopynn/web — building."
exit 1
