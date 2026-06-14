# SSH helpers for geostat deploy — optional ops/config/ssh/ keys

function Resolve-GeostatRepoPath {
    param([string]$Path)
    if (-not $Path) { return $null }
    if ([System.IO.Path]::IsPathRooted($Path)) { return $Path }
    Join-Path (Get-MonorepoRoot) ($Path -replace '/', '\')
}

function Get-GeostatSshExtraArgs {
    $sshArgs = [System.Collections.ArrayList]@()
    $cfg = Get-DeployEnvValue "DEPLOY_SSH_CONFIG_FILE"
    $id  = Get-DeployEnvValue "DEPLOY_SSH_IDENTITY_FILE"
    if ($cfg) {
        $cfgPath = Resolve-GeostatRepoPath $cfg
        if (Test-Path $cfgPath) {
            [void]$sshArgs.Add("-F")
            [void]$sshArgs.Add($cfgPath)
        }
    }
    if ($id) {
        $idPath = Resolve-GeostatRepoPath $id
        if (Test-Path $idPath) {
            [void]$sshArgs.Add("-i")
            [void]$sshArgs.Add($idPath)
        }
    }
    $extra = Get-DeployEnvValue "DEPLOY_SSH_OPTIONS"
    if ($extra) {
        $extra -split '\s+' | ForEach-Object { if ($_) { [void]$sshArgs.Add($_) } }
    }
    return $sshArgs
}

function Invoke-GeostatRemoteBash {
    param([string]$Script)
    $server = Get-DeployEnvValue "DEPLOY_SERVER"
    if (-not $server) { throw "DEPLOY_SERVER not set in ops/config/deploy.env" }
    $sshExtra = @(Get-GeostatSshExtraArgs)
    $payload = (($Script -replace "`r", "") -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ }) -join "`n"
    if (-not $payload.EndsWith("`n")) { $payload += "`n" }

    # Windows PowerShell mangles bash -lc "..." quoting; pipe LF-only script via stdin.
    $tmp = [System.IO.Path]::GetTempFileName()
    try {
        $utf8NoBom = New-Object System.Text.UTF8Encoding $false
        [System.IO.File]::WriteAllText($tmp, $payload, $utf8NoBom)
        $sshCmd = Get-Command ssh -ErrorAction Stop
        $argList = New-Object System.Collections.Generic.List[string]
        foreach ($a in $sshExtra) { [void]$argList.Add($a) }
        [void]$argList.Add($server)
        [void]$argList.Add("bash")
        [void]$argList.Add("-s")
        $proc = Start-Process -FilePath $sshCmd.Source -ArgumentList $argList.ToArray() `
            -RedirectStandardInput $tmp -Wait -PassThru -NoNewWindow
        return $proc.ExitCode
    }
    finally {
        if (Test-Path $tmp) { Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue }
    }
}

function Invoke-GeostatScp {
    param([string]$LocalPath, [string]$RemoteDest)
    $server = Get-DeployEnvValue "DEPLOY_SERVER"
    if (-not $server) { throw "DEPLOY_SERVER not set" }
    $sshExtra = @(Get-GeostatSshExtraArgs)
    & scp @sshExtra $LocalPath "${server}:${RemoteDest}" 2>&1 | ForEach-Object {
        Write-Host "[scp] $_" -ForegroundColor DarkGray
    }
    return $LASTEXITCODE
}
