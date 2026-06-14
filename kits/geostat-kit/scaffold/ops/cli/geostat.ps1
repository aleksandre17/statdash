# Project CLI entry — delegates to geostat-kit package
param(
    [Parameter(Position = 0)]
    [string]$Command = "help",
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$CliRest = @()
)
$Root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
& (Join-Path $Root "kits\geostat-kit\cli\geostat.ps1") -Command $Command -CliRest $CliRest
exit $LASTEXITCODE
