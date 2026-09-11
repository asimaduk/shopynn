#!/usr/bin/env bash
# Build Shopynn Print .pkg on macOS.
# Requires: curl, pkgbuild, productbuild
set -euo pipefail
cd "$(dirname "$0")/../.."
ROOT="$(pwd)"
VERSION="$(node -p "require('./package.json').version")"
DIST="$ROOT/packaging/dist"
STAGE="$DIST/mac-root"
SCRIPTS="$DIST/mac-scripts"
PKG_OUT="$DIST/ShopynnPrint-${VERSION}.pkg"

bash "$ROOT/packaging/bundle/prepare-bundle.sh" mac "$DIST/bundle-mac"

rm -rf "$STAGE" "$SCRIPTS"
mkdir -p "$STAGE/usr/local/shopynn-print" "$STAGE/usr/local/shopynn-print/launchd" "$SCRIPTS"

cp -R "$DIST/bundle-mac/"* "$STAGE/usr/local/shopynn-print/"
cp "$ROOT/packaging/mac/launchd/com.shopynn.print.plist" "$STAGE/usr/local/shopynn-print/launchd/"
cp "$ROOT/packaging/mac/scripts/postinstall" "$SCRIPTS/postinstall"
chmod +x "$SCRIPTS/postinstall" "$STAGE/usr/local/shopynn-print/run-shopynn-print.sh"

pkgbuild \
  --root "$STAGE" \
  --scripts "$SCRIPTS" \
  --identifier com.shopynn.print \
  --version "$VERSION" \
  --install-location / \
  "$PKG_OUT"

echo "Built: $PKG_OUT"
