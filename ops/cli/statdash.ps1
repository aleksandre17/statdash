# statdash-platform CLI entry — forwards all arguments to geostat-kit (native pass-through)
# Canonical entry: all ops routing lives in kits/geostat-kit/cli/geostat.ps1
# This file exists so tools/statdash.ps1 has one stable forwarding target.
param(
    [Parameter(Position = 0)]
    [string]$Command = "help",
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$CliRest = @()
)
$Root    = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$KitRoot = Join-Path $Root "kits\geostat-kit"
$env:GEOSTAT_PROJECT_ROOT = $Root
$env:GEOSTAT_KIT_ROOT     = $KitRoot
$env:PYTHONPATH           = "$KitRoot"
& (Join-Path $KitRoot "cli\geostat.ps1") -Command $Command -CliRest $CliRest
exit $LASTEXITCODE
