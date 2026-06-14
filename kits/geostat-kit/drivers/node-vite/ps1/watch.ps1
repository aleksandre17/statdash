# DEPRECATED top-level command — use: geostat fe deploy watch
# Kept so old scripts/docs get a clear redirect (registry may omit "watch").

param(
    [ValidateSet("dev", "prod")]
    [string]$Environment = "dev",
    [int]$DebounceMs = 3000,
    [switch]$NoInitialSync
)

Write-Host ""
Write-Host "  fe watch was renamed for clarity:" -ForegroundColor Yellow
Write-Host "    geostat fe deploy watch   # static: npm build + dist + nginx reload" -ForegroundColor White
Write-Host "    geostat fe dev watch      # remote dev: rsync source only (no build)" -ForegroundColor White
Write-Host ""

$deployScript = Join-Path $PSScriptRoot "deploy.ps1"
& $deployScript watch -Environment $Environment -DebounceMs $DebounceMs -NoInitialSync:$NoInitialSync
exit $LASTEXITCODE
