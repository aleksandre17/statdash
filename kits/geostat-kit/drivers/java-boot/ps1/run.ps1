# java-boot — local run via manifest (host + secrets .env.dev)
if (-not $env:GEOSTAT_MODULE_ID) {
    throw 'GEOSTAT_MODULE_ID required - run: geostat {alias} run | geostat hybrid boot {alias}'
}
$DriverRoot = Split-Path $PSScriptRoot -Parent
$PackageRoot = Split-Path (Split-Path $DriverRoot -Parent) -Parent
$env:GEOSTAT_KIT_ROOT = $PackageRoot

& (Join-Path $PackageRoot "toolkit\hybrid\Invoke-HybridRun.ps1") -ModuleId $env:GEOSTAT_MODULE_ID
exit $LASTEXITCODE
