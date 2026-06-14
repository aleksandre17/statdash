# ==================================================================
#  _common.ps1  -  shared config, logger, helpers
#
#  Portable & multi-service: drop scripts/ into any project.
#  Services are read from docker-compose.yml (single source of truth).
#
#  Usage: . "$PSScriptRoot\_common.ps1"
# ==================================================================

# --- Paths --------------------------------------------------------
$ROOT    = Split-Path $PSScriptRoot -Parent
$LOG_DIR = Join-Path  $PSScriptRoot "logs"
if (-not (Test-Path $LOG_DIR)) { New-Item -ItemType Directory -Path $LOG_DIR | Out-Null }

# ==================================================================
#  .env helpers  (defined first - used to load all other config)
# ==================================================================
function Get-EnvValue {
    param([string]$Key, [string]$Default = $null)
    # .env.local overrides .env (gitignored, machine-specific)
    foreach ($envFile in @((Join-Path $ROOT ".env.local"), (Join-Path $ROOT ".env"))) {
        if (-not (Test-Path $envFile)) { continue }
        $line = Get-Content $envFile | Where-Object { $_ -match "^$Key\s*=\s*(.*)$" } | Select-Object -First 1
        if ($line -match "^$Key\s*=\s*(.*)$") {
            $val = $Matches[1].Trim().Trim('"').Trim("'")
            if ($val) { return $val }
        }
    }
    return $Default
}

function Assert-Env {
    param([string[]]$Keys)
    $missing = $Keys | Where-Object { -not (Get-EnvValue $_) }
    if ($missing) {
        Write-Host ""
        foreach ($k in $missing) { Write-Host "  [ERROR] Missing in .env: $k" -ForegroundColor Red }
        Write-Host "  Add the above keys to your .env file and retry." -ForegroundColor Yellow
        Write-Host ""
        exit 1
    }
}

# ==================================================================
#  Project-level defaults  (overridden per-service by Set-Service)
# ==================================================================
$APP_NAME        = Split-Path $ROOT -Leaf
$DOCKERFILE_PATH = $null
$BUILD_CONTEXT   = $ROOT

# ==================================================================
#  Server config  (all from .env)
#
#  Required in .env for remote operations:
#    DEPLOY_SERVER       e.g. user@192.168.1.10
#    DEPLOY_HOST_PORT    e.g. 5171
#
#  Optional:
#    DEPLOY_SERVER_BASE  default: /home/<user>
#    DEPLOY_PATH         default: SERVER_BASE/APP_NAME
# ==================================================================
$SERVER = Get-EnvValue "DEPLOY_SERVER"
$_defaultBase = if ($SERVER -and $SERVER -match "^([^@]+)@") { "/home/$($Matches[1])" } else { "/home/deploy" }
$SERVER_BASE = Get-EnvValue "DEPLOY_SERVER_BASE" $_defaultBase
$HOST_PORT   = Get-EnvValue "DEPLOY_HOST_PORT"   "80"
$DEPLOY_PATH = Get-EnvValue "DEPLOY_PATH"         "$SERVER_BASE/$APP_NAME"

# ==================================================================
#  Service discovery  (reads docker-compose.yml)
# ==================================================================

# Parses docker-compose.yml and returns service objects with build config.
# Each object: Name, ContainerName, Context, Dockerfile
function Get-DockerServices {
    $composeFile = Join-Path $ROOT "docker-compose.yml"
    if (-not (Test-Path $composeFile)) {
        Write-Host "  [ERROR] docker-compose.yml not found in $ROOT" -ForegroundColor Red
        return @()
    }

    $lines    = Get-Content $composeFile
    $services = [System.Collections.ArrayList]@()
    $inSvc    = $false
    $inBuild  = $false
    $cur      = $null

    foreach ($line in $lines) {
        if ($line -match '^\s*#' -or $line -match '^\s*$') { continue }

        # Top-level "services:" block
        if ($line -match '^services\s*:') { $inSvc = $true; continue }
        if ($inSvc -and $line -match '^[a-zA-Z\-_]') { break }   # next top-level key
        if (-not $inSvc) { continue }

        $indent  = ($line -replace '^(\s*).*', '$1').Length
        $trimmed = $line.Trim()

        # Service name at indent 2
        if ($indent -eq 2 -and $trimmed -match '^([a-zA-Z0-9][a-zA-Z0-9_-]*)\s*:') {
            if ($cur) { [void]$services.Add($cur) }
            $cur = [PSCustomObject]@{
                Name          = $Matches[1]
                ContainerName = $Matches[1]
                Context       = '.'
                Dockerfile    = 'Dockerfile'
            }
            $inBuild = $false
            continue
        }

        if ($null -eq $cur) { continue }

        # Properties at indent 4
        if ($indent -eq 4) {
            if ($trimmed -match '^container_name\s*:\s*(.+)') {
                $cur.ContainerName = $Matches[1].Trim().Trim('"').Trim("'")
            }
            if ($trimmed -match '^build\s*:\s*$')   { $inBuild = $true  }
            elseif ($trimmed -match '^[a-zA-Z]')    { $inBuild = $false }
        }

        # Build sub-properties at indent 6
        if ($indent -eq 6 -and $inBuild) {
            if ($trimmed -match '^context\s*:\s*(.+)')    { $cur.Context    = $Matches[1].Trim().Trim('"').Trim("'") }
            if ($trimmed -match '^dockerfile\s*:\s*(.+)') { $cur.Dockerfile = $Matches[1].Trim().Trim('"').Trim("'") }
        }
    }

    if ($cur) { [void]$services.Add($cur) }
    return $services.ToArray()
}

# Interactive numbered menu - returns selected string value
function Select-Option {
    param(
        [string]  $Title,
        [string[]]$Options,
        [string[]]$Hints = @()
    )
    Write-Host ""
    Write-Host "  ------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "    $Title" -ForegroundColor Cyan
    Write-Host "  ------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host ""
    for ($i = 0; $i -lt $Options.Count; $i++) {
        $hint = if ($i -lt $Hints.Count -and $Hints[$i]) { "  $($Hints[$i])" } else { "" }
        Write-Host ("    [{0}]  {1,-22}{2}" -f ($i + 1), $Options[$i], $hint) -ForegroundColor Gray
    }
    Write-Host ""
    $selected = $null
    do {
        $raw = Read-Host "    Enter number (1-$($Options.Count))"
        $n = 0
        if ([int]::TryParse($raw.Trim(), [ref]$n) -and $n -ge 1 -and $n -le $Options.Count) {
            $selected = $Options[$n - 1]
        } else {
            Write-Host "    Invalid. Enter a number between 1 and $($Options.Count)." -ForegroundColor Yellow
        }
    } while (-not $selected)
    Write-Host ""
    return $selected
}

# Apply service config: sets APP_NAME, DOCKERFILE_PATH, BUILD_CONTEXT, DEPLOY_PATH
function Set-Service {
    param([PSCustomObject]$Svc)

    $script:APP_NAME = $Svc.ContainerName

    # Resolve build context
    if ($Svc.Context -eq '.' -or $Svc.Context -eq './') {
        $script:BUILD_CONTEXT = $ROOT
    } elseif ([IO.Path]::IsPathRooted($Svc.Context)) {
        $script:BUILD_CONTEXT = $Svc.Context
    } else {
        $script:BUILD_CONTEXT = Join-Path $ROOT $Svc.Context
    }

    # Resolve Dockerfile path (relative to ROOT, as docker-compose expects)
    if ([IO.Path]::IsPathRooted($Svc.Dockerfile)) {
        $script:DOCKERFILE_PATH = $Svc.Dockerfile
    } else {
        $script:DOCKERFILE_PATH = Join-Path $ROOT $Svc.Dockerfile
    }

    # DEPLOY_PATH in .env = base directory (e.g. /home/administrator/geostat/frontend)
    # Actual service path = base/APP_NAME (e.g. frontend/geostat-chat-app)
    $_deployBase = Get-EnvValue "DEPLOY_PATH" $SERVER_BASE
    $script:DEPLOY_PATH = "$_deployBase/$($script:APP_NAME)"
}

# ==================================================================
#  Logger
# ==================================================================
function Log {
    param(
        [string]$Message,
        [ValidateSet("INFO","STEP","OK","WARN","ERROR")]
        [string]$Level = "INFO"
    )
    $ts    = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $entry = "[$ts] [$Level] $Message"
    if ($LOG_FILE) { Add-Content -Path $LOG_FILE -Value $entry -Encoding UTF8 }
    $color = switch ($Level) {
        "STEP"  { "Cyan"   }
        "OK"    { "Green"  }
        "WARN"  { "Yellow" }
        "ERROR" { "Red"    }
        default { "Gray"   }
    }
    Write-Host $entry -ForegroundColor $color
}

function LogSection {
    param([string]$Title)
    Log "----------------------------------------------" "INFO"
    Log "  $Title" "STEP"
    Log "----------------------------------------------" "INFO"
}

function LogBanner {
    param([string]$Title, [hashtable]$Info = @{})
    Log "=======================================================" "INFO"
    Log "  $Title" "STEP"
    foreach ($key in $Info.Keys) {
        Log ("  {0,-14}: {1}" -f $key, $Info[$key]) "INFO"
    }
    Log "  Log           : $LOG_FILE" "INFO"
    Log "=======================================================" "INFO"
}

function LogDone {
    param([datetime]$StartTime)
    $secs = [math]::Round(((Get-Date) - $StartTime).TotalSeconds, 1)
    Log "=======================================================" "INFO"
    Log "  DONE in ${secs}s" "OK"
    Log "  Log  : $LOG_FILE" "INFO"
    Log "=======================================================" "INFO"
}

# ==================================================================
#  SSH / SCP helpers
# ==================================================================
function Invoke-SSH {
    param([string]$Script)
    ($Script -replace "`r", "") | ssh $SERVER bash 2>&1 | ForEach-Object {
        if ($LOG_FILE) { Add-Content -Path $LOG_FILE -Value "[ssh] $_" -Encoding UTF8 }
        Write-Host "[ssh] $_" -ForegroundColor DarkGray
    }
    return $LASTEXITCODE
}

function Invoke-SCP {
    param([string]$Source, [string]$Dest, [switch]$Recurse)
    $flag = if ($Recurse) { "-r" } else { "" }
    $cmd  = "scp $flag `"$Source`" `"${SERVER}:${Dest}`""
    Invoke-Expression $cmd 2>&1 | ForEach-Object {
        if ($LOG_FILE) { Add-Content -Path $LOG_FILE -Value "[scp] $_" -Encoding UTF8 }
    }
    return $LASTEXITCODE
}