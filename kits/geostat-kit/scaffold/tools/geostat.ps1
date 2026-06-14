# Shim — canonical entry: ops/cli/geostat.ps1
# CMD.exe: use tools\geostat.cmd
param(
    [Parameter(Position = 0)]
    [string]$Command = "help",
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$CliRest = @()
)
$Root = Split-Path $PSScriptRoot -Parent
& (Join-Path $Root "ops\cli\geostat.ps1") -Command $Command -CliRest $CliRest
exit $LASTEXITCODE
