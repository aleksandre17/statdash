# ==================================================================
#  manage.ps1  -  Multi-package container management
#
#  Usage:
#    .\manage.ps1                      interactive: pick package + command
#    .\manage.ps1 <package>            interactive: pick command for package
#    .\manage.ps1 <command>            interactive: pick package for command
#    .\manage.ps1 <command> <package>  direct (order doesn't matter)
#    .\manage.ps1 <package> <command>  direct (order doesn't matter)
#
#  Commands:  status | logs | restart | undeploy | delete
# ==================================================================
param(
    [Parameter(Position=0)] [string]$Arg1 = "",
    [Parameter(Position=1)] [string]$Arg2 = ""
)

. "$PSScriptRoot\_common.ps1"

$_validCommands = @("status", "logs", "restart", "undeploy", "delete")
$_commandHints  = @(
    "Show container status (local + remote)",
    "Tail container logs (remote, live)",
    "Restart container on server",
    "Stop + remove container (image + files stay)",
    "Full cleanup: container + image + server files"
)

# --- Help ---------------------------------------------------------
if ($Arg1 -in @("help","-h","--help")) {
    Write-Host ""
    Write-Host "  manage.ps1 - multi-package container management" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Usage:" -ForegroundColor White
    Write-Host "    .\manage.ps1                       interactive" -ForegroundColor Gray
    Write-Host "    .\manage.ps1 <package>             pick command interactively" -ForegroundColor Gray
    Write-Host "    .\manage.ps1 <command>             pick package interactively" -ForegroundColor Gray
    Write-Host "    .\manage.ps1 <command> <package>   direct (order doesn't matter)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Commands:" -ForegroundColor White
    for ($i = 0; $i -lt $_validCommands.Count; $i++) {
        Write-Host ("    {0,-12} {1}" -f $_validCommands[$i], $_commandHints[$i]) -ForegroundColor Gray
    }
    Write-Host ""
    exit 0
}

# --- Smart arg detection (order-independent) ----------------------
$Command = ""; $ServiceName = ""

if     ($Arg1 -in $_validCommands -and $Arg2) { $Command = $Arg1; $ServiceName = $Arg2 }
elseif ($Arg2 -in $_validCommands -and $Arg1) { $Command = $Arg2; $ServiceName = $Arg1 }
elseif ($Arg1 -in $_validCommands)            { $Command = $Arg1 }
elseif ($Arg1)                                { $ServiceName = $Arg1 }

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

# --- Command selection --------------------------------------------
if (-not $Command) {
    $Command = Select-Option "Select Command" $_validCommands $_commandHints
}

# --- Setup --------------------------------------------------------
$TIMESTAMP = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$LOG_FILE  = Join-Path $LOG_DIR "manage-${ServiceName}-${Command}_$TIMESTAMP.log"

$startTime   = Get-Date
$_serverHost = $SERVER -replace '^.*@', ''

# Remote commands require DEPLOY_SERVER
if ($Command -ne "status") {
    Assert-Env @("DEPLOY_SERVER")
}

# ==================================================================
#  status - Show container status (local + remote)
# ==================================================================
if ($Command -eq "status") {
    LogBanner "$APP_NAME - Status" @{
        "Package" = $ServiceName
        "App"     = $APP_NAME
        "Server"  = if ($SERVER) { $SERVER } else { "(DEPLOY_SERVER not set)" }
        "Port"    = $HOST_PORT
    }

    # Local
    LogSection "Local Docker"
    $localStatus = docker inspect --format "{{.State.Status}}" $APP_NAME 2>$null
    if ($localStatus) {
        Log "Status: $localStatus" $(if ($localStatus -eq "running") { "OK" } else { "WARN" })
        docker ps --filter "name=$APP_NAME" --format "table {{.Names}}`t{{.Status}}`t{{.Ports}}" 2>&1 |
            ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
    } else {
        Log "No local container '$APP_NAME' found" "WARN"
    }

    # Remote (only if DEPLOY_SERVER is set)
    if ($SERVER) {
        LogSection "Remote Server ($_serverHost)"
        $remoteScript = @"
echo '--- Container ---'
STATUS=`$(docker inspect --format '{{.State.Status}}' $APP_NAME 2>/dev/null || echo 'not found')
echo "  Status : `$STATUS"
echo ''
echo '--- Running ---'
docker ps --filter name=$APP_NAME --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null || echo '  (none)'
echo ''
echo '--- Image ---'
docker images $APP_NAME --format 'table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedSince}}' 2>/dev/null || echo '  (no image)'
echo ''
echo '--- Deploy dir ---'
du -sh $DEPLOY_PATH 2>/dev/null || echo '  (not found)'
"@
        Invoke-SSH $remoteScript | Out-Null
    } else {
        Log "DEPLOY_SERVER not set - skipping remote status" "WARN"
    }
}

# ==================================================================
#  logs - Tail container logs from server (live, Ctrl+C to exit)
# ==================================================================
elseif ($Command -eq "logs") {
    LogBanner "$APP_NAME - Logs (live, Ctrl+C to exit)" @{
        "Package"   = $ServiceName
        "Container" = $APP_NAME
        "Server"    = $SERVER
    }
    Log "Connecting to server logs..." "STEP"
    Write-Host ""
    ssh $SERVER "docker logs -f --tail 100 $APP_NAME"
}

# ==================================================================
#  restart - Restart container on server
# ==================================================================
elseif ($Command -eq "restart") {
    LogBanner "$APP_NAME - Restart container" @{
        "Package"   = $ServiceName
        "Container" = $APP_NAME
        "Server"    = $SERVER
    }

    LogSection "Restarting container on server"
    $remoteScript = @"
set -euo pipefail
STATUS=`$(docker inspect --format '{{.State.Status}}' $APP_NAME 2>/dev/null || echo 'not found')
if [ "`$STATUS" = "not found" ]; then
  echo '[remote] Container not found - nothing to restart'
  exit 1
fi
echo "[remote] Current status: `$STATUS"
docker restart $APP_NAME
echo '[remote] Restarted OK'
docker ps --filter name=$APP_NAME
"@
    $rc = Invoke-SSH $remoteScript
    if ($rc -ne 0) { Log "Restart FAILED" "ERROR"; exit 1 }
    Log "Container restarted" "OK"
    LogDone $startTime
}

# ==================================================================
#  undeploy - Stop + remove container (image + server files stay)
# ==================================================================
elseif ($Command -eq "undeploy") {
    LogBanner "$APP_NAME - Undeploy" @{
        "Package"   = $ServiceName
        "Container" = $APP_NAME
        "Image"     = "stays"
        "Files"     = "stay at $DEPLOY_PATH"
    }

    Write-Host ""
    Write-Host "  This will STOP and REMOVE container '$APP_NAME' on $SERVER" -ForegroundColor Yellow
    Write-Host "  Docker image and server files will NOT be deleted." -ForegroundColor DarkGray
    Write-Host ""
    $confirm = Read-Host "  Continue? [y/N]"
    if ($confirm -notmatch "^[Yy]$") { Log "Cancelled by user" "WARN"; exit 0 }

    LogSection "Stop + remove container on server"
    $remoteScript = @"
set -euo pipefail
STATUS=`$(docker inspect --format '{{.State.Status}}' $APP_NAME 2>/dev/null || echo 'not found')
echo "[remote] Container '$APP_NAME': `$STATUS"
if [ "`$STATUS" = "not found" ]; then
  echo '[remote] Already undeployed'
  exit 0
fi
docker stop $APP_NAME
docker rm   $APP_NAME
echo '[remote] Done. Image and files remain on server.'
"@
    $rc = Invoke-SSH $remoteScript
    if ($rc -ne 0) { Log "Undeploy FAILED" "ERROR"; exit 1 }
    Log "Container stopped and removed" "OK"
    Log "Image and files still on server" "INFO"
    LogDone $startTime
}

# ==================================================================
#  delete - Full cleanup: container + image + server files [DESTRUCTIVE]
# ==================================================================
elseif ($Command -eq "delete") {
    LogBanner "$APP_NAME - DELETE (full cleanup)" @{
        "Package"   = $ServiceName
        "Container" = "$APP_NAME -> will be removed"
        "Image"     = "$APP_NAME -> will be removed"
        "Files"     = "$DEPLOY_PATH -> will be deleted"
    }

    Write-Host ""
    Write-Host "  ⚠  WARNING: This will permanently delete:" -ForegroundColor Red
    Write-Host "     • Container  : $APP_NAME" -ForegroundColor Red
    Write-Host "     • Image      : $APP_NAME" -ForegroundColor Red
    Write-Host "     • Server dir : $DEPLOY_PATH" -ForegroundColor Red
    Write-Host ""
    $confirm1 = Read-Host "  Are you sure? [y/N]"
    if ($confirm1 -notmatch "^[Yy]$") { Log "Cancelled" "WARN"; exit 0 }

    $confirm2 = Read-Host "  Type 'DELETE' to confirm"
    if ($confirm2 -ne "DELETE") { Log "Cancelled - did not type DELETE" "WARN"; exit 0 }
    Write-Host ""

    LogSection "Full cleanup on server"
    $remoteScript = @"
set -euo pipefail
echo '[remote] === Step 1: Stop container ==='
docker stop $APP_NAME 2>/dev/null && echo '[remote] Stopped' || echo '[remote] Not running'

echo '[remote] === Step 2: Remove container ==='
docker rm $APP_NAME 2>/dev/null && echo '[remote] Removed' || echo '[remote] Not found'

echo '[remote] === Step 3: Remove Docker image ==='
docker rmi $APP_NAME 2>/dev/null && echo '[remote] Image removed' || echo '[remote] Image not found'

echo '[remote] === Step 4: Delete server files ==='
if [ -d "$DEPLOY_PATH" ]; then
  rm -rf $DEPLOY_PATH
  echo '[remote] Deleted: $DEPLOY_PATH'
else
  echo '[remote] Directory not found: $DEPLOY_PATH'
fi

echo '[remote] === Verify ==='
docker ps -a --filter name=$APP_NAME | grep -q $APP_NAME && echo '[remote] WARN: container still exists' || echo '[remote] Container : clean'
docker images $APP_NAME | grep -q $APP_NAME              && echo '[remote] WARN: image still exists'     || echo '[remote] Image     : clean'
[ -d "$DEPLOY_PATH" ]                                    && echo '[remote] WARN: dir still exists'       || echo '[remote] Files     : clean'
"@
    $rc = Invoke-SSH $remoteScript
    if ($rc -ne 0) { Log "Delete FAILED (partial cleanup may have occurred)" "ERROR"; exit 1 }

    Log "Container removed" "OK"
    Log "Image removed" "OK"
    Log "Server files deleted: $DEPLOY_PATH" "OK"
    LogDone $startTime
}