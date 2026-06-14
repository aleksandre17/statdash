# ==================================================================
#  deploy.ps1  -  Multi-package deployment
#
#  Modes:  local | dist | remote | sync | watch
#  watch = static dist loop (npm build + nginx). For source rsync use: geostat fe dev watch
#  Env:    -Environment dev | prod  (all modes respect profile)
# ==================================================================
param(
    [Parameter(Position=0)] [string]$Arg1 = "",
    [Parameter(Position=1)] [string]$Arg2 = "",
    [ValidateSet("dev", "prod")]
    [string]$Environment = "prod",
    [int]$DebounceMs = 3000,
    [switch]$NoInitialSync
)

. "$PSScriptRoot\_common.ps1"
$GetComposeServices = Join-Path $env:GEOSTAT_KIT_ROOT "toolkit\powershell\Get-ComposeServices.ps1"
. $GetComposeServices

# geostat mod fe deploy dist -Environment prod → ("dist","-Environment","prod") via @rest
if ($Arg2 -eq "-Environment" -and $args.Count -ge 1 -and $args[0] -in @("dev", "prod")) {
    $Environment = [string]$args[0]
    $Arg2 = ""
}

$_validModes = @("local", "dist", "remote", "sync", "watch")
$_modeHints  = @(
    "Build Docker image here, run container locally",
    "Local npm build -> copy dist/ -> server nginx (volume mount)",
    "Copy source -> Docker build on server (compose/dev|prod paths)",
    "Quick: rebuild dist/ + nginx.conf + sync to server",
    "Auto on save: npm build + sync dist (static). Use fe dev watch for source rsync"
)

if ($Arg1 -in @("help", "-h", "--help")) {
    Write-Host ""
    Write-Host "  deploy.ps1 - multi-package deployment" -ForegroundColor Cyan
    Write-Host "  Modes: local | dist | remote | sync | watch" -ForegroundColor Gray
    Write-Host "  watch = static dist + nginx (NOT fe dev watch)" -ForegroundColor Gray
    Write-Host "  -Environment dev|prod  -DebounceMs 3000  -NoInitialSync (watch only)" -ForegroundColor Gray
    Write-Host "  DEPLOY_LAYOUT=structured in ${SECRETS_DIR}/.env.deploy" -ForegroundColor Gray
    Write-Host ""
    exit 0
}

$Mode = ""
$ServiceName = ""

if ($Arg1 -in $_validModes -and $Arg2) { $Mode = $Arg1; $ServiceName = $Arg2 }
elseif ($Arg2 -in $_validModes -and $Arg1) { $Mode = $Arg2; $ServiceName = $Arg1 }
elseif ($Arg1 -in $_validModes) { $Mode = $Arg1 }
elseif ($Arg1) { $ServiceName = $Arg1 }

$extraCompose = if ($Environment -eq "dev") { @("docker-compose.override.yml") } else { @("docker-compose.prod.yml") }
$_services = @(Get-ComposeServicesFromFile -ModuleRoot $ROOT -ComposeFile "docker-compose.yml" -ExtraComposeFiles $extraCompose)
$_serviceNames = @($_services | ForEach-Object { $_.Name })

if ($ServiceName) {
    if ($ServiceName -notin $_serviceNames) {
        Write-Host "  [ERROR] Service '$ServiceName' not found." -ForegroundColor Red
        exit 1
    }
} elseif ($_services.Count -eq 1) {
    $ServiceName = $_services[0].Name
} elseif ($_services.Count -gt 1) {
    $ServiceName = Select-Option "Select Service" $_serviceNames ($_services | ForEach-Object { $_.Dockerfile })
} else {
    Write-Host "  [ERROR] No services in docker-compose.yml" -ForegroundColor Red
    exit 1
}

Set-Service ($_services | Where-Object { $_.Name -eq $ServiceName })

if (-not $Mode) {
    $Mode = Select-Option "Select Deploy Mode" $_validModes $_modeHints
}

$TIMESTAMP = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$LOG_FILE = Join-Path $LOG_DIR "deploy-${ServiceName}-${Mode}-$Environment`_$TIMESTAMP.log"
$script:LOG_FILE = $LOG_FILE

if ($Mode -eq "local") {
    Assert-Env @("VITE_API_URL", "DEPLOY_HOST_PORT")
} else {
    Assert-Env @("DEPLOY_SERVER", "DEPLOY_HOST_PORT")
}

$VITE_API_URL = Get-ViteApiUrlForEnvironment -Environment $Environment
$startTime = Get-Date
$_serverHost = $SERVER -replace '^.*@', ''

# --- local ---
if ($Mode -eq "local") {
    LogBanner "$APP_NAME - Deploy: Local Docker" @{
        Environment = $Environment
        API         = $VITE_API_URL
        Port        = $HOST_PORT
    }

    LogSection "[1/3] Stop old container"
    docker stop $APP_NAME 2>$null | Out-Null
    docker rm $APP_NAME 2>$null | Out-Null

    Invoke-NginxGen

    LogSection "[2/3] Docker build"
    Push-Location $BUILD_CONTEXT
    docker build --target production --build-arg "VITE_API_URL=$VITE_API_URL" --file $DOCKERFILE_PATH -t $APP_NAME . 2>&1 | ForEach-Object {
        Add-Content -Path $LOG_FILE -Value "[docker] $_" -Encoding UTF8
        Write-Host "[docker] $_" -ForegroundColor DarkGray
    }
    $buildExit = $LASTEXITCODE
    Pop-Location
    if ($buildExit -ne 0) { Log "Docker build FAILED" "ERROR"; exit 1 }

    LogSection "[3/3] Run container"
    docker run -d --name $APP_NAME --restart unless-stopped -p "${HOST_PORT}:80" $APP_NAME 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { Log "docker run FAILED" "ERROR"; exit 1 }
    Log "Live: http://localhost:$HOST_PORT" "OK"
}

# --- dist ---
elseif ($Mode -eq "dist") {
    Set-DeployPathForMode -Kind "static"
    LogBanner "$APP_NAME - Deploy: dist ($Environment)" @{
        Server  = $SERVER
        Deploy  = $DEPLOY_PATH
        API     = $VITE_API_URL
        Port    = $HOST_PORT
    }

    LogSection "[1/3] npm build"
    $exitCode = Invoke-NpmBuildForEnvironment -Environment $Environment -LogFile $LOG_FILE
    if ($exitCode -ne 0) { Log "npm build FAILED" "ERROR"; exit 1 }
    $_distDir = Join-Path $BUILD_CONTEXT "dist"
    @{ VITE_API_URL = $VITE_API_URL } | ConvertTo-Json | Set-Content (Join-Path $_distDir "config.json") -Encoding UTF8

    LogSection "[2/3] Upload static bundle"
    Sync-StaticArtifactsToServer -DistDir $_distDir -IncludeNginx -WriteManifest -Environment $Environment -DeployMode "dist"

    LogSection "[3/3] Start nginx"
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
    if ((Invoke-SSH $remoteScript) -ne 0) { Log "Remote start FAILED" "ERROR"; exit 1 }
    Log "Live: http://${_serverHost}:$HOST_PORT" "OK"
}

# --- remote ---
elseif ($Mode -eq "remote") {
    $kind = if ($Environment -eq "dev") { "compose-dev" } else { "compose-prod" }
    Set-DeployPathForMode -Kind $kind
    $ARCHIVE = "${APP_NAME}_deploy_${Environment}.tar.gz"
    $stagingDir = "$SERVER_BASE/deploy-staging"
    $ARCHIVE_TMP = Join-Path (Split-Path $ROOT -Parent) $ARCHIVE

    LogBanner "$APP_NAME - Deploy: remote ($Environment)" @{
        Server = $SERVER
        Deploy = $DEPLOY_PATH
        API    = $VITE_API_URL
    }

    LogSection "[1/5] Archive source"
    if (Test-Path $ARCHIVE_TMP) { Remove-Item $ARCHIVE_TMP -Force }
    Push-Location $ROOT
    tar -czf "../$ARCHIVE" --exclude=node_modules --exclude=.git --exclude=dist --exclude=.idea --exclude=.vscode . 2>&1 | Out-Null
    $exitCode = $LASTEXITCODE
    Pop-Location
    if ($exitCode -ne 0) { Log "tar FAILED" "ERROR"; exit 1 }

    LogSection "[2/5] Upload archive"
    Invoke-SSH "mkdir -p $stagingDir" | Out-Null
    $rc = Invoke-SCP -Source $ARCHIVE_TMP -Dest "$stagingDir/"
    if ($rc -ne 0) { Log "scp FAILED" "ERROR"; exit 1 }

    LogSection "[3/5] Upload env for server compose"
    $remoteEnvName = Publish-RemoteEnvFiles -Environment $Environment

    $feComposeFiles = if ($Environment -eq "dev") {
        "-f docker-compose.yml -f docker-compose.override.yml"
    } else {
        "-f docker-compose.yml -f docker-compose.prod.yml"
    }

    LogSection "[4/5] Build on server"
    $remoteScript = @"
set -euo pipefail
mkdir -p $DEPLOY_PATH
tar -xzf $stagingDir/$ARCHIVE -C $DEPLOY_PATH
rm -f $stagingDir/$ARCHIVE
docker stop $APP_NAME 2>/dev/null || true
docker rm   $APP_NAME 2>/dev/null || true
cd $DEPLOY_PATH
set -a
source ./$remoteEnvName
set +a
export VITE_API_URL=$VITE_API_URL
export DEPLOY_HOST_PORT=$HOST_PORT
if docker compose version >/dev/null 2>&1; then
  docker compose --env-file ./$remoteEnvName $feComposeFiles up -d --build
else
  docker-compose --env-file ./$remoteEnvName $feComposeFiles up -d --build
fi
docker ps --filter name=$APP_NAME
"@
    if ((Invoke-SSH $remoteScript) -ne 0) {
        Remove-Item $ARCHIVE_TMP -ErrorAction SilentlyContinue
        Log "Remote build FAILED" "ERROR"; exit 1
    }

    LogSection "[5/5] Manifest"
    Write-RemoteDeployManifest -Environment $Environment -DeployMode "remote" -Kind $kind
    Remove-Item $ARCHIVE_TMP -ErrorAction SilentlyContinue
    Log "Live: http://${_serverHost}:$HOST_PORT" "OK"
}

# --- sync ---
elseif ($Mode -eq "sync") {
    Set-DeployPathForMode -Kind "static"
    LogBanner "$APP_NAME - Deploy: sync ($Environment)" @{
        Target = "$DEPLOY_PATH/dist"
        API    = $VITE_API_URL
    }

    LogSection "[1/1] Build + sync + reload"
    $exitCode = Invoke-FeStaticPublishCycle -Environment $Environment -LogFile $LOG_FILE -ReloadNginx -DeployMode "sync"
    if ($exitCode -ne 0) { Log "sync FAILED" "ERROR"; exit 1 }
    Log "Live: http://${_serverHost}:$HOST_PORT" "OK"
}

# --- watch (static dist loop) ---
elseif ($Mode -eq "watch") {
    Assert-Env @("DEPLOY_SERVER", "DEPLOY_HOST_PORT")
    $script:LOG_FILE = Join-Path $LOG_DIR "deploy-watch-${ServiceName}-$Environment`_$TIMESTAMP.log"
    Start-FeStaticDeployWatch -Environment $Environment -DebounceMs $DebounceMs -NoInitialSync:$NoInitialSync
    exit $LASTEXITCODE
}

LogDone $startTime
