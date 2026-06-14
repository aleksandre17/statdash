# Regenerate compose from project catalog via geostat-kit package
$ErrorActionPreference = "Stop"
$PackageCompose = Join-Path $PSScriptRoot "build.py"
. (Join-Path $PSScriptRoot "..\lib\geostat-python.ps1")
$pyArgs = Get-GeostatPythonArgs
if (-not $pyArgs) {
    Write-Error "Python not found (tried py -3, python3, python)"
    exit 9009
}
Invoke-GeostatPythonExe $pyArgs $PackageCompose
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
