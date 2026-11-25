#!/bin/bash
# Double-click this file to install Shopynn Print (opens Terminal).
# If macOS blocks it once: Control-click → Open → Open.
cd "$(dirname "$0")"
curl -fsSL "${SHOPYNN_API_BASE:-https://api.shopynn.app}/api/public/print-agent/install-macos.sh" | bash
echo ""
read -r -p "Press Return to close…"
