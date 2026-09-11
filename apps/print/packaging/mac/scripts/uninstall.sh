#!/usr/bin/env bash
# Uninstall Shopynn Print (run with sudo).
set -euo pipefail
launchctl bootout system/com.shopynn.print 2>/dev/null || launchctl unload -w /Library/LaunchDaemons/com.shopynn.print.plist 2>/dev/null || true
rm -f /Library/LaunchDaemons/com.shopynn.print.plist
rm -rf /usr/local/shopynn-print
echo "Shopynn Print removed."
