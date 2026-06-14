# geostat-kit — smart dev startup orchestrator.
#
# Usage: geostat dev up [alias|moduleId|all] [--mode hybrid|local|docker|remote] [--no-infra] [--no-tunnel]
#
# Modes (auto-detected when not set):
#   hybrid   Apps on host (Windows), infra remote Docker + SSH tunnel.  Default when DEPLOY_SERVER set.
#   local    Apps on host only — no infra management.                   Default when DEPLOY_SERVER not set.
#   docker   Full stack via geostat stack up -d --build.                Ignores per-module target.
#   remote   Source on Windows, rsync → Linux server, Docker reloads.   geostat <alias> dev watch.
#
# Flags:
#   --no-infra   Skip "infra remote up" — useful when infra is already running.
#   --no-tunnel  Skip SSH tunnel — useful when tunnel is already open in another window.
#   --all        Boot all modules in role order: api → worker → ui (each in a new terminal window).

param(
    [Parameter(Position = 0)]
    [string]$SubCommand = "help",
    [Parameter(Position = 1, ValueFromRemainingArguments = $true)]
    [string[]]$DevArgs = @()
)

$ErrorActionPreference = "Stop"
$PackageRoot = if ($env:GEOSTAT_KIT_ROOT) { $env:GEOSTAT_KIT_ROOT } else {
    Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
}
. (Join-Path $PackageRoot "lib\project.ps1")
. (Join-Path $PackageRoot "lib\env.ps1")
. (Join-Path $PackageRoot "lib\drivers.ps1")
. (Join-Path $PackageRoot "lib\modules.ps1")

$Root = Get-ProjectRootFromManifest
if (-not $Root) {
    Write-Host "[dev] geostat.ops.json not found (run: geostat init)" -ForegroundColor Red
    exit 1
}

# ── Helpers ───────────────────────────────────────────────────────────────────

function Write-DevLog {
    param([string]$Message, [string]$Level = "INFO")
    $color = switch ($Level) {
        "ERROR" { "Red" }
        "WARN"  { "Yellow" }
        "OK"    { "Green" }
        default { "Cyan" }
    }
    Write-Host "[dev] $Message" -ForegroundColor $color
}

function Show-DevHelp {
    $aliases = Get-CliAliasesFromManifest
    $aliasLine = if ($aliases.Count -gt 0) {
        ($aliases.GetEnumerator() | ForEach-Object { "$($_.Key)->$($_.Value)" }) -join ", "
    } else { "(none)" }
    Write-Host @"

  geostat dev — smart development startup (geostat-kit)

    geostat dev up <alias|moduleId|all> [flags]

  Modes (auto-detected from ops/config/deploy.env DEPLOY_SERVER):
    hybrid    Apps on host + infra remote Docker + SSH tunnel  [default when DEPLOY_SERVER set]
    local     Apps on host only; no infra management           [default otherwise]
    docker    Full stack via compose (geostat stack up)
    remote    rsync source → Linux server, Docker reloads (geostat <alias> dev watch)

  Flags:
    --mode <hybrid|local|docker>   Override auto-detected mode
    --no-infra                     Skip infra remote up (infra already running)
    --no-tunnel                    Skip SSH tunnel (tunnel already open)

  Targets:
    <alias>    e.g.  be, fe, ret, ing  (from cli.aliases in manifest)
    <moduleId> e.g.  chat-api, frontend
    all        Boot all modules in new windows (api -> worker -> ui)
               (remote mode: each module gets its own dev watch window)

  Examples:
    geostat dev up be                  # chat-api, hybrid mode (auto)
    geostat dev up ing --no-tunnel     # ingestion, skip tunnel
    geostat dev up all                 # all modules in new windows
    geostat dev up fe --mode local     # frontend, local only
    geostat dev up be --mode remote    # rsync source → server, docker reloads
    geostat dev up all --mode remote   # all modules as remote dev watch

  CLI aliases: $aliasLine

"@
}

function Resolve-DevTarget {
    param([string]$Raw)
    if ($Raw -eq "all") { return "all" }
    $aliases = Get-CliAliasesFromManifest
    if ($aliases.ContainsKey($Raw)) { return $aliases[$Raw] }
    $mf = Get-ProjectManifestPath
    if ($mf) {
        $data = Get-Content $mf -Raw | ConvertFrom-Json
        if ($data.modules.PSObject.Properties[$Raw]) { return $Raw }
    }
    return $null
}

function Get-DevMode {
    param([string]$ExplicitMode)
    if ($ExplicitMode) { return $ExplicitMode.ToLower().Trim() }
    $server = Get-DeployEnvValue "DEPLOY_SERVER"
    return if ($server) { "hybrid" } else { "local" }
}

function Get-GeostatScript {
    $rel = Get-ManifestField "vscode.geostatScript"
    if (-not $rel) { $rel = "tools/geostat.ps1" }
    Join-Path $Root ($rel -replace '/', '\')
}

function Start-ModuleInNewWindow {
    param([string]$ModuleId)
    $gs = Get-GeostatScript
    Write-DevLog "Opening window: $ModuleId"
    Start-Process powershell -ArgumentList @(
        '-NoExit',
        '-ExecutionPolicy', 'Bypass',
        '-Command',
        "& '$gs' hybrid boot $ModuleId"
    )
}

function Start-TunnelInNewWindow {
    $gs = Get-GeostatScript
    Write-DevLog "Opening SSH tunnel window (Ctrl+C in that window to close tunnel)"
    Start-Process powershell -ArgumentList @(
        '-NoExit',
        '-ExecutionPolicy', 'Bypass',
        '-Command',
        "& '$gs' infra tunnel"
    )
    Write-DevLog "Waiting 4 s for tunnel to establish..."
    Start-Sleep -Seconds 4
}

function Get-ModulesInRoleOrder {
    $mods = Get-ProjectModules
    $mf = Get-ProjectManifestPath
    $data = Get-Content $mf -Raw | ConvertFrom-Json
    $order = [System.Collections.ArrayList]@()
    $seen  = @{}
    foreach ($role in @("api", "worker", "ui")) {
        foreach ($mid in $mods) {
            $r = [string]($data.modules.$mid.role)
            if (-not $r -and $data.modules.$mid.type -eq "node-vite")  { $r = "ui" }
            if (-not $r -and $data.modules.$mid.type -eq "java-boot")  { $r = "api" }
            if ($r -eq $role -and -not $seen[$mid]) {
                [void]$order.Add($mid)
                $seen[$mid] = $true
            }
        }
    }
    foreach ($mid in $mods) {
        if (-not $seen[$mid]) { [void]$order.Add($mid) }
    }
    return @($order)
}

# ── Entry point ───────────────────────────────────────────────────────────────

if ($SubCommand -in @("help", "", $null)) { Show-DevHelp; exit 0 }

if ($SubCommand -ne "up") {
    Write-DevLog "Unknown subcommand: '$SubCommand'. Run: geostat dev help" "ERROR"
    exit 1
}

# Parse DevArgs ────────────────────────────────────────────────────────────────
$target       = ""
$explicitMode = ""
$skipInfra    = $false
$skipTunnel   = $false

$i = 0
while ($i -lt $DevArgs.Count) {
    $a = [string]$DevArgs[$i]
    switch -Exact ($a) {
        "--no-infra"  { $skipInfra = $true }
        "--no-tunnel" { $skipTunnel = $true }
        "--mode" {
            if (($i + 1) -lt $DevArgs.Count) {
                $explicitMode = [string]$DevArgs[$i + 1]
                $i++
            }
        }
        default {
            if (-not $a.StartsWith("--") -and -not $target) { $target = $a }
        }
    }
    $i++
}

if (-not $target) {
    Write-DevLog "Usage: geostat dev up <alias|moduleId|all> [--mode hybrid|local|docker] [--no-infra] [--no-tunnel]" "ERROR"
    exit 1
}

$mode = Get-DevMode $explicitMode
Write-DevLog "mode=$mode  target=$target  skip-infra=$skipInfra  skip-tunnel=$skipTunnel"

# ── Docker mode ───────────────────────────────────────────────────────────────
if ($mode -eq "docker") {
    Write-DevLog "Starting full stack via Docker Compose (geostat stack up -d --build)"
    $gs = Get-GeostatScript
    & $gs stack up -d --build
    exit $LASTEXITCODE
}

# ── Remote watch mode ─────────────────────────────────────────────────────────
# Source stays on Windows. geostat <alias> dev watch rsyncs to Linux server and
# reloads the Docker container. Requires DEPLOY_SERVER + DEPLOY_LAYOUT=structured.
# For java-boot: rsync + Gradle bootRun inside workspace/ container.
# For node-vite: rsync + Vite dev container (geostat fe dev watch).
if ($mode -eq "remote") {
    $gs = Get-GeostatScript
    $server = Get-DeployEnvValue "DEPLOY_SERVER"
    if (-not $server) {
        Write-DevLog "DEPLOY_SERVER not set in ops/config/deploy.env — remote watch requires a server." "ERROR"
        exit 1
    }

    function Start-RemoteWatch {
        param([string]$ModuleId)
        $modType = Get-ManifestField "modules.$ModuleId.type"
        Write-DevLog "remote dev watch: $ModuleId ($modType) -> $server"
        # java-boot: `geostat <alias> watch` → maps to dev watch (rsync + bootRun in workspace)
        # node-vite: `geostat <alias> dev watch` → rsync + Vite container
        if ($modType -eq "node-vite") {
            return @($gs, $ModuleId, "dev", "watch")
        }
        return @($gs, $ModuleId, "watch")
    }

    if ($target -eq "all") {
        $ordered = Get-ModulesInRoleOrder
        if ($ordered.Count -eq 0) { Write-DevLog "No modules in manifest" "ERROR"; exit 1 }
        Write-DevLog "Opening remote watch windows for: $($ordered -join ', ')"
        foreach ($mid in $ordered) {
            $cmd = Start-RemoteWatch $mid
            $cmdStr = "& '" + ($cmd -join "' '") + "'"
            Start-Process powershell -ArgumentList @('-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', $cmdStr)
            Start-Sleep -Milliseconds 500
        }
        Write-DevLog "All remote watch windows opened." "OK"
        exit 0
    }

    $resolved = Resolve-DevTarget $target
    if (-not $resolved) {
        Write-DevLog "Unknown target: '$target'" "ERROR"
        exit 1
    }
    $cmdArgs = Start-RemoteWatch $resolved
    & $cmdArgs[0] $cmdArgs[1..($cmdArgs.Count - 1)]
    exit $LASTEXITCODE
}

# ── Infra + tunnel (hybrid only) ──────────────────────────────────────────────
if ($mode -eq "hybrid") {
    if (-not $skipInfra) {
        Write-DevLog "Starting remote infra (geostat infra remote up)..."
        $gs = Get-GeostatScript
        & $gs infra remote up
        if ($LASTEXITCODE -ne 0) {
            Write-DevLog "infra remote up failed (exit $LASTEXITCODE). Pass --no-infra to skip." "ERROR"
            exit $LASTEXITCODE
        }
        Write-DevLog "Infra started" "OK"
    } else {
        Write-DevLog "Skipping infra remote up (--no-infra)"
    }

    if (-not $skipTunnel) {
        Start-TunnelInNewWindow
    } else {
        Write-DevLog "Skipping tunnel (--no-tunnel)"
    }
}

# ── Boot modules ─────────────────────────────────────────────────────────────
if ($target -eq "all") {
    $ordered = Get-ModulesInRoleOrder
    if ($ordered.Count -eq 0) {
        Write-DevLog "No modules found in manifest" "ERROR"
        exit 1
    }
    Write-DevLog "Opening windows for: $($ordered -join ', ')"
    foreach ($mid in $ordered) {
        Start-ModuleInNewWindow $mid
        Start-Sleep -Milliseconds 500
    }
    Write-DevLog "All module windows opened. Infra + apps should start shortly." "OK"
    exit 0
}

$resolved = Resolve-DevTarget $target
if (-not $resolved) {
    Write-DevLog "Unknown target: '$target'. Check cli.aliases in geostat.ops.json or use a module id." "ERROR"
    Write-DevLog "Known aliases: $((Get-CliAliasesFromManifest).GetEnumerator() | ForEach-Object { "$($_.Key)->$($_.Value)" } | Out-String)"
    exit 1
}

Write-DevLog "Booting $resolved..."
$env:GEOSTAT_MODULE_ID = $resolved
$runScript = Get-DriverCommandPath -ModuleId $resolved -Command "run"
& $runScript
exit $LASTEXITCODE