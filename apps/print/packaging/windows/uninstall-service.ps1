param(
  [string]$InstallDir = $PSScriptRoot
)

$ErrorActionPreference = "SilentlyContinue"
$node = Join-Path $InstallDir "runtime\node.exe"
$app = Join-Path $InstallDir "app"
if (Test-Path (Join-Path $app "uninstall-service.js")) {
  Set-Location $app
  & $node "uninstall-service.js"
} else {
  sc.exe stop "Shopynn Print Service" | Out-Null
  sc.exe delete "Shopynn Print Service" | Out-Null
}
Write-Host "Shopynn Print service removed (if it existed)."
