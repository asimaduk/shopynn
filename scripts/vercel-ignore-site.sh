#!/usr/bin/env bash
# Vercel Ignored Build Step for @shopynn/site
# Exit 0 = skip deploy; exit 1 = continue build
set -euo pipefail
cd "$(dirname "$0")/.."
if command -v npx >/dev/null 2>&1; then
  npx --yes turbo-ignore @shopynn/site --fallback=HEAD^1
  exit $?
fi
if git diff --quiet HEAD^ HEAD -- apps/site package-lock.json package.json turbo.json; then
  echo "No changes affecting @shopynn/site — skipping."
  exit 0
fi
echo "Changes detected for @shopynn/site — building."
exit 1
