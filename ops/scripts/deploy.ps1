# ==================================================================
#  deploy.ps1  -  Multi-package deployment
#
#  Usage:
#    .\deploy.ps1                      interactive: pick package + mode
#    .\deploy.ps1 <package>            interactive: pick mode for package
#    .\deploy.ps1 <mode>               interactive: pick package for mode
#    .\deploy.ps1 <mode> <package>     direct (order doesn't matter)
#    .\deploy.ps1 <package> <mode>     direct (order doesn't matter)
#
#  Modes:  local | dist | remote | sync
# ==================================================================
param(
    [Parameter(Position=0)] [string]$Arg1 = "",
    [Parameter(Position=1)] [string]$Arg2 = ""
)

. "$PSScriptRoot\_common.ps1"

$_validModes = @("local", "dist", "remote", "sync")
$_modeHints  = @(
    "Build Docker image here, run container locally",
    "Local npm build -> copy dist/ -> server nginx (volume mount)",
    "Copy source -> Docker build on server",
    "Quick: rebuild dist/ + sync to server, no restart"
)

# --- Help ---------------------------------------------------------
if ($Arg1 -in @("help","-h","--help")) {
    Write-Host ""
    Write-Host "  deploy.ps1 - multi-package deployment" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Usage:" -ForegroundColor White
    Write-Host "    .\deploy.ps1                       interactive" -ForegroundColor Gray
    Write-Host "    .\deploy.ps1 <package>             pick mode interactively" -ForegroundColor Gray
    Write-Host "    .\deploy.ps1 <mode>                pick package interactively" -ForegroundColor Gray
    Write-Host "    .\deploy.ps1 <mode> <package>      direct (order doesn't matter)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Modes:" -ForegroundColor White
    for ($i = 0; $i -lt $_validModes.Count; $i++) {
        Write-Host ("    {0,-10} {1}" -f $_validModes[$i], $_modeHints[$i]) -ForegroundColor Gray
    }
    Write-Host ""
    Write-Host "  Packages = subdirectories containing a Dockerfile." -ForegroundColor DarkGray
    Write-Host ""
    exit 0
}

# --- Smart arg detection (order-independent) ----------------------
$Mode = ""; $ServiceName = ""

if     ($Arg1 -in $_validModes -and $Arg2) { $Mode = $Arg1; $ServiceName = $Arg2 }
elseif ($Arg2 -in $_validModes -and $Arg1) { $Mode = $Arg2; $ServiceName = $Arg1 }
elseif ($Arg1 -in $_validModes)            { $Mode = $Arg1 }
elseif ($Arg1)                             { $ServiceName = $Arg1 }

# --- Package selection --------------------------------------------
$_services     = Get-DockerServices
$_serviceNames = @($_services | ForEach-Object { $_.Name })

if ($ServiceName) {
    if ($ServiceName -notin $_serviceNames) {
        Write-Host "  [ERROR] Service '$ServiceName' not found in docker-compose.yml." -ForegroundColor Red
        Write-Host "  Available: $($_serviceNames -join ', ')" -ForegroundColor Yellow
        exit 1
    }
} elseif ($_services.Count -eq 0) {
    Write-Host "  [ERROR] No services found in docker-compose.yml." -ForegroundColor Red
    exit 1
} elseif ($_services.Count -eq 1) {
    $ServiceName = $_services[0].Name
    Write-Host "  Auto-selected service: $ServiceName" -ForegroundColor DarkGray
} else {
    $ServiceName = Select-Option "Select Service" $_serviceNames ($_services | ForEach-Object { $_.Dockerfile })
}

Set-Service ($_services | Where-Object { $_.Name -eq $ServiceName })

# --- Mode selection -----------------------------------------------
if (-not $Mode) {
    $Mode = Select-Option "Select Deploy Mode" $_validModes $_modeHints
}

# --- Setup --------------------------------------------------------
$TIMESTAMP = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$LOG_FILE  = Join-Path $LOG_DIR "deploy-${ServiceName}-${Mode}_$TIMESTAMP.log"

if ($Mode -eq "local") {
    Assert-Env @("VITE_API_URL", "DEPLOY_HOST_PORT")
} else {
    Assert-Env @("VITE_API_URL", "DEPLOY_SERVER", "DEPLOY_HOST_PORT")
}

$VITE_API_URL = Get-EnvValue "VITE_API_URL"
$startTime    = Get-Date
$_serverHost  = $SERVER -replace '^.*@', ''

# ==================================================================
#  local - Build Docker image on THIS machine, run container locally
# ==================================================================
if ($Mode -eq "local") {
    LogBanner "$APP_NAME - Deploy: Local Docker Build" @{
        "Package"    = $ServiceName
        "App"        = $APP_NAME
        "Dockerfile" = $DOCKERFILE_PATH.Replace($ROOT, ".")
        "Context"    = $BUILD_CONTEXT.Replace($ROOT, ".")
        "API"        = $VITE_API_URL
        "Port"       = $HOST_PORT
    }

    LogSection "[1/3] Stop old container"
    docker stop $APP_NAME 2>$null | Out-Null
    docker rm   $APP_NAME 2>$null | Out-Null
    Log "Old container cleared" "OK"

    LogSection "[2/3] Docker build (Stage 1 -> 3 -> 4)"
    Push-Location $BUILD_CONTEXT
    docker build `
        --target production `
        --build-arg "VITE_API_URL=$VITE_API_URL" `
        --file $DOCKERFILE_PATH `
        -t $APP_NAME . 2>&1 | ForEach-Object {
            Add-Content -Path $LOG_FILE -Value "[docker] $_" -Encoding UTF8
            Write-Host "[docker] $_" -ForegroundColor DarkGray
        }
    $buildExit = $LASTEXITCODE
    Pop-Location

    if ($buildExit -ne 0) { Log "Docker build FAILED" "ERROR"; exit 1 }
    Log "Build OK" "OK"

    LogSection "[3/3] Run container"
    docker run -d `
        --name $APP_NAME `
        --restart unless-stopped `
        -p "${HOST_PORT}:${HOST_PORT}" `
        $APP_NAME 2>&1 | ForEach-Object {
            Add-Content -Path $LOG_FILE -Value "[docker] $_" -Encoding UTF8
        }
    if ($LASTEXITCODE -ne 0) { Log "docker run FAILED" "ERROR"; exit 1 }
    Log "Container started" "OK"
    Log "Live: http://localhost:$HOST_PORT" "OK"
}

# ==================================================================
#  dist - Local npm build -> copy dist/ + nginx.conf -> server nginx
# ==================================================================
elseif ($Mode -eq "dist") {
    LogBanner "$APP_NAME - Deploy: Local Build -> dist copy" @{
        "Package" = $ServiceName
        "App"     = $APP_NAME
        "Server"  = $SERVER
        "Deploy"  = $DEPLOY_PATH
        "API"     = $VITE_API_URL
        "Port"    = $HOST_PORT
    }

    LogSection "[1/3] npm run build (local)"
    Log "VITE_API_URL will be baked into JS bundle" "WARN"

    Push-Location $BUILD_CONTEXT
    $env:VITE_API_URL = $VITE_API_URL
    npm run build 2>&1 | ForEach-Object {
        Add-Content -Path $LOG_FILE -Value "[npm] $_" -Encoding UTF8
        Write-Host "[npm] $_" -ForegroundColor DarkGray
    }
    $exitCode = $LASTEXITCODE
    Remove-Item Env:VITE_API_URL -ErrorAction SilentlyContinue
    Pop-Location

    if ($exitCode -ne 0) { Log "npm build FAILED (exit $exitCode)" "ERROR"; exit 1 }
    $_distDir = Join-Path $BUILD_CONTEXT "dist"
    $sizeMB = [math]::Round((Get-ChildItem $_distDir -Recurse | Measure-Object Length -Sum).Sum / 1MB, 2)
    Log "Build OK - dist/ size: ${sizeMB} MB" "OK"

    LogSection "[2/3] Upload to server"
    ssh $SERVER "mkdir -p $DEPLOY_PATH" | Out-Null
    if ($LASTEXITCODE -ne 0) { Log "mkdir on server FAILED" "ERROR"; exit 1 }

    $rc = Invoke-SCP -Source $_distDir -Dest $DEPLOY_PATH -Recurse
    if ($rc -ne 0) { Log "scp dist/ FAILED" "ERROR"; exit 1 }

    $rc = Invoke-SCP -Source (Join-Path $ROOT "nginx.conf") -Dest $DEPLOY_PATH
    if ($rc -ne 0) { Log "scp nginx.conf FAILED" "ERROR"; exit 1 }

    ssh $SERVER "chmod -R 755 $DEPLOY_PATH/dist" | Out-Null
    Log "Upload OK" "OK"

    LogSection "[3/3] Start nginx on server (volume mount)"
    $remoteScript = @"
set -euo pipefail
docker stop $APP_NAME 2>/dev/null || true
docker rm   $APP_NAME 2>/dev/null || true
docker run -d \
  --name $APP_NAME \
  --restart unless-stopped \
  -p ${HOST_PORT}:80 \
  -v $DEPLOY_PATH/dist:/usr/share/nginx/html:ro \
  -v $DEPLOY_PATH/nginx.conf:/etc/nginx/conf.d/default.conf:ro \
  nginx:1.27-alpine
docker ps --filter name=$APP_NAME
"@
    $rc = Invoke-SSH $remoteScript
    if ($rc -ne 0) { Log "Remote start FAILED" "ERROR"; exit 1 }
    Log "Live: http://${_serverHost}:$HOST_PORT" "OK"
}

# ==================================================================
#  remote - Copy source -> Docker build + compose up on server
# ==================================================================
elseif ($Mode -eq "remote") {
    $ARCHIVE     = "${APP_NAME}_deploy.tar.gz"
    $ARCHIVE_TMP = Join-Path (Split-Path $ROOT -Parent) $ARCHIVE

    LogBanner "$APP_NAME - Deploy: Source -> Server Build" @{
        "Package"    = $ServiceName
        "App"        = $APP_NAME
        "Dockerfile" = $DOCKERFILE_PATH.Replace($ROOT, ".")
        "Server"     = $SERVER
        "Deploy"     = $DEPLOY_PATH
        "API"        = $VITE_API_URL
    }

    LogSection "[1/4] Archive source (no node_modules/dist/.git)"
    if (Test-Path $ARCHIVE_TMP) { Remove-Item $ARCHIVE_TMP -Force }

    Push-Location $ROOT
    tar -czf "../$ARCHIVE" `
        --exclude=node_modules `
        --exclude=.git         `
        --exclude=dist         `
        --exclude=.idea        `
        --exclude=.vscode      `
        . 2>&1 | ForEach-Object { Add-Content -Path $LOG_FILE -Value "[tar] $_" -Encoding UTF8 }
    $exitCode = $LASTEXITCODE
    Pop-Location

    if ($exitCode -ne 0) { Log "tar FAILED" "ERROR"; exit 1 }
    $sizeMB = [math]::Round((Get-Item $ARCHIVE_TMP).Length / 1MB, 1)
    Log "Archive OK - size: ${sizeMB} MB" "OK"

    LogSection "[2/4] Upload archive to server"
    $rc = Invoke-SCP -Source $ARCHIVE_TMP -Dest $SERVER_BASE
    if ($rc -ne 0) {
        Remove-Item $ARCHIVE_TMP -ErrorAction SilentlyContinue
        Log "scp FAILED - check SSH access" "ERROR"; exit 1
    }
    Log "Upload OK" "OK"

    LogSection "[3/4] Build on server"
    Log "This may take 2-5 min (npm ci + npm run build on server)" "WARN"

    $remoteScript = @"
set -euo pipefail
echo '[remote] Extracting source...'
mkdir -p $DEPLOY_PATH
tar -xzf $SERVER_BASE/$ARCHIVE -C $DEPLOY_PATH
rm       $SERVER_BASE/$ARCHIVE

echo '[remote] Stopping any existing container...'
docker stop $APP_NAME 2>/dev/null || true
docker rm   $APP_NAME 2>/dev/null || true

echo '[remote] Building...'
cd $DEPLOY_PATH
export VITE_API_URL=$VITE_API_URL
export HOST_PORT=$HOST_PORT
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker ps --filter name=$APP_NAME
"@
    $rc = Invoke-SSH $remoteScript
    if ($rc -ne 0) {
        Remove-Item $ARCHIVE_TMP -ErrorAction SilentlyContinue
        Log "Remote build FAILED" "ERROR"; exit 1
    }

    LogSection "[4/4] Cleanup"
    Remove-Item $ARCHIVE_TMP -ErrorAction SilentlyContinue
    Log "Temp archive removed" "INFO"
    Log "Live: http://${_serverHost}:$HOST_PORT" "OK"
}

# ==================================================================
#  sync - Quick: rebuild dist/ + sync to server (no container restart)
# ==================================================================
elseif ($Mode -eq "sync") {
    LogBanner "$APP_NAME - Deploy: Quick dist sync" @{
        "Package" = $ServiceName
        "App"     = $APP_NAME
        "Server"  = $SERVER
        "Target"  = "$DEPLOY_PATH/dist"
        "API"     = $VITE_API_URL
        "Restart" = "NOT needed (volume mount)"
    }

    LogSection "[1/2] npm run build (local)"
    Push-Location $BUILD_CONTEXT
    $env:VITE_API_URL = $VITE_API_URL
    npm run build 2>&1 | ForEach-Object {
        Add-Content -Path $LOG_FILE -Value "[npm] $_" -Encoding UTF8
        Write-Host "[npm] $_" -ForegroundColor DarkGray
    }
    $exitCode = $LASTEXITCODE
    Remove-Item Env:VITE_API_URL -ErrorAction SilentlyContinue
    Pop-Location

    if ($exitCode -ne 0) { Log "npm build FAILED" "ERROR"; exit 1 }
    $_distDir = Join-Path $BUILD_CONTEXT "dist"
    $sizeMB = [math]::Round((Get-ChildItem $_distDir -Recurse | Measure-Object Length -Sum).Sum / 1MB, 2)
    Log "Build OK - dist/ size: ${sizeMB} MB" "OK"

    LogSection "[2/2] Sync dist/ -> server (overwrite)"
    $rc = Invoke-SCP -Source $_distDir -Dest $DEPLOY_PATH -Recurse
    if ($rc -ne 0) { Log "scp FAILED" "ERROR"; exit 1 }

    ssh $SERVER "chmod -R 755 $DEPLOY_PATH/dist" | Out-Null
    Log "Sync OK - nginx serves new content immediately" "OK"
    Log "Live: http://${_serverHost}:$HOST_PORT" "OK"
}

LogDone $startTime