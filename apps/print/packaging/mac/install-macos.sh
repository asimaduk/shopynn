#!/usr/bin/env bash
# Shopynn Print — macOS install helper.
# Prefer running via Terminal (avoids Gatekeeper quarantine from browser downloads):
#   curl -fsSL https://api.shopynn.app/api/public/print-agent/install-macos.sh | bash
set -euo pipefail

API_BASE="${SHOPYNN_API_BASE:-https://api.shopynn.app}"
API_BASE="${API_BASE%/}"
DOWNLOAD_URL="${API_BASE}/api/public/print-agent/download/macos"
WORKDIR="${TMPDIR:-/tmp}/shopynn-print-install-$$"
PKG="${WORKDIR}/ShopynnPrint.pkg"
KEEP="${HOME}/Downloads/ShopynnPrint-install.pkg"

cleanup() { rm -rf "${WORKDIR}" 2>/dev/null || true; }
trap cleanup EXIT

mkdir -p "${WORKDIR}"
echo "Downloading Shopynn Print…"
if ! curl -fL --progress-bar -o "${PKG}" "${DOWNLOAD_URL}"; then
  echo "Download failed. Check your internet connection and try again." >&2
  exit 1
fi

# Browser downloads are quarantined; curl usually is not. Clear just in case.
xattr -cr "${PKG}" 2>/dev/null || true
mkdir -p "${HOME}/Downloads"
cp "${PKG}" "${KEEP}"
xattr -cr "${KEEP}" 2>/dev/null || true

echo "Opening the installer…"
open "${KEEP}"

echo ""
echo "Installer opened. Finish the prompts (admin password), then in Shopynn:"
echo "  Settings → Invoice & Receipt → enter this Mac's LAN IP → pair → save."
echo "Package saved at: ${KEEP}"
