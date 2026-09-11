param(
  [Parameter(Mandatory = $true)]
  [string]$InstallDir
)

$ErrorActionPreference = "Stop"
$node = Join-Path $InstallDir "runtime\node.exe"
$app = Join-Path $InstallDir "app"
Set-Location $app
& $node "service.js"
if ($LASTEXITCODE -ne 0) { throw "service.js failed with exit $LASTEXITCODE" }
Write-Host "Shopynn Print Windows service installed."
