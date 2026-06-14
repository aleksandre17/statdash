# Resolve a working Python on Windows (Store alias) and Unix.

function Get-GeostatPythonArgs {
    if (Get-Command py -ErrorAction SilentlyContinue) {
        & py -3 -c "import sys" 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { return @("py", "-3") }
    }
    foreach ($candidate in @("python3", "python")) {
        if (-not (Get-Command $candidate -ErrorAction SilentlyContinue)) { continue }
        & $candidate -c "import sys" 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { return @($candidate) }
    }
    return $null
}

function Invoke-GeostatPythonExe {
    param([Parameter(Mandatory = $true)][string[]]$PyArgs, [Parameter(ValueFromRemainingArguments = $true)][string[]]$CommandArgs)
    switch ($PyArgs.Count) {
        2 { & $PyArgs[0] $PyArgs[1] @CommandArgs }
        1 { & $PyArgs[0] @CommandArgs }
        default { throw "Invalid Python command args (count=$($PyArgs.Count))" }
    }
}

function Invoke-GeostatPython {
    param(
        [Parameter(Mandatory = $true)][string]$ScriptPath,
        [Parameter(ValueFromRemainingArguments = $true)][string[]]$ScriptArgs
    )
    $pyArgs = Get-GeostatPythonArgs
    if (-not $pyArgs) {
        Write-Error "Python not found (tried py -3, python3, python)"
        exit 9009
    }
    Invoke-GeostatPythonExe $pyArgs $ScriptPath @ScriptArgs
    exit $LASTEXITCODE
}
