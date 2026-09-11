#!/usr/bin/env bash
# Prepare a production bundle of Shopynn Print for packaging.
# Usage: bash packaging/bundle/prepare-bundle.sh [mac|win] [outdir]
set -euo pipefail
cd "$(dirname "$0")/../.."
ROOT="$(pwd)"
TARGET="${1:-mac}"
OUT="${2:-$ROOT/packaging/dist/bundle-$TARGET}"
NODE_VERSION="${NODE_VERSION:-20.18.1}"

rm -rf "$OUT"
mkdir -p "$OUT/app" "$OUT/runtime"

# App files
cp index.js package.json service.js uninstall-service.js "$OUT/app/"
# Production deps only (install into bundle)
(
  cd "$OUT/app"
  npm install --omit=dev --no-audit --no-fund
)

case "$TARGET" in
  mac)
    ARCH="$(uname -m)"
    if [[ "$ARCH" == "arm64" ]]; then
      NODE_ARCH="arm64"
    else
      NODE_ARCH="x64"
    fi
    NODE_TARBALL="node-v${NODE_VERSION}-darwin-${NODE_ARCH}.tar.gz"
    NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/${NODE_TARBALL}"
    curl -fsSL "$NODE_URL" -o "/tmp/${NODE_TARBALL}"
    tar -xzf "/tmp/${NODE_TARBALL}" -C "$OUT/runtime" --strip-components=1
    cat > "$OUT/run-shopynn-print.sh" <<'EOF'
#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
export PATH="$DIR/runtime/bin:$PATH"
cd "$DIR/app"
exec "$DIR/runtime/bin/node" index.js
EOF
    chmod +x "$OUT/run-shopynn-print.sh"
    ;;
  win)
    NODE_ZIP="node-v${NODE_VERSION}-win-x64.zip"
    NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/${NODE_ZIP}"
    curl -fsSL "$NODE_URL" -o "/tmp/${NODE_ZIP}"
    mkdir -p "$OUT/runtime"
    unzip -q "/tmp/${NODE_ZIP}" -d "$OUT/runtime-tmp"
    mv "$OUT/runtime-tmp"/node-v*-win-x64/* "$OUT/runtime/"
    rm -rf "$OUT/runtime-tmp"
    cat > "$OUT/run-shopynn-print.cmd" <<'EOF'
@echo off
set DIR=%~dp0
set PATH=%DIR%runtime;%PATH%
cd /d "%DIR%app"
"%DIR%runtime\node.exe" index.js
EOF
    ;;
  *)
    echo "Unknown target: $TARGET (use mac|win)" >&2
    exit 1
    ;;
esac

echo "Bundle ready: $OUT"
