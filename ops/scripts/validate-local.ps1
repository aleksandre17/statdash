# ════════════════════════════════════════════════════════════════════════════
# validate-local.ps1 — Windows mirror of validate-local.sh (THE FIRST REAL RUN).
# ════════════════════════════════════════════════════════════════════════════
#
# Same 8 stages, same contract, for a docker-capable Windows host:
#   network + Postgres → Flyway migrate (V1→V29 + R__) → build:engine → seed →
#   DB-gated test suite (DATABASE_URL un-skips them) → API one-shot + /health →
#   verify-parity → teardown (unless -Keep).
#
# USAGE
#   pwsh ops/scripts/validate-local.ps1            # full run + teardown
#   pwsh ops/scripts/validate-local.ps1 -Keep      # leave the stack up
#
# PREREQ: docker (+ compose v2), pnpm, node, curl, on a docker-capable machine.
# Fail-fast: $ErrorActionPreference=Stop + explicit exit-code checks; any stage
# failure aborts with a non-zero exit (never a false green).
# ════════════════════════════════════════════════════════════════════════════
[CmdletBinding()]
param(
  [switch]$Keep
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# Repo root = two levels up from this script (ops/scripts → repo root).
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root      = (Resolve-Path (Join-Path $ScriptDir '..\..')).Path
$Platform  = Join-Path $Root 'platform'

function Info($m) { Write-Host ("[{0}] {1}" -f (Get-Date -Format HH:mm:ss), $m) -ForegroundColor Blue }
function Ok($m)   { Write-Host ("[{0}] OK    {1}" -f (Get-Date -Format HH:mm:ss), $m) -ForegroundColor Green }
function Warn($m) { Write-Host ("[{0}] WARN  {1}" -f (Get-Date -Format HH:mm:ss), $m) -ForegroundColor Yellow }
function Err($m)  { Write-Host ("[{0}] ERR   {1}" -f (Get-Date -Format HH:mm:ss), $m) -ForegroundColor Red }

# Run a command and throw on non-zero exit (fail-fast). PowerShell does not stop
# on native-exe failure by default, so every external call goes through this.
function Invoke-OrDie {
  param([Parameter(Mandatory)][scriptblock]$Cmd, [string]$What = 'command')
  & $Cmd
  if ($LASTEXITCODE -ne 0) { throw "$What failed (exit $LASTEXITCODE)" }
}

# ── Preflight ─────────────────────────────────────────────────────────────────
foreach ($tool in 'docker','pnpm','node','curl') {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
    Err "required command not found: $tool"; exit 127
  }
}
docker compose version *> $null
if ($LASTEXITCODE -ne 0) { Err 'docker compose v2 plugin is required.'; exit 127 }

# ── Compose stack paths ───────────────────────────────────────────────────────
$InfraDir  = Join-Path $Root 'ops/compose/infra'
$BaseYml   = Join-Path $InfraDir 'docker-compose.base.yml'
$PgYml     = Join-Path $InfraDir 'services/postgres.yml'
$FlywayYml = Join-Path $InfraDir 'services/flyway.yml'
$Project   = 'statdash-validate'
$Compose   = @('compose','-p',$Project,'-f',$BaseYml,'-f',$PgYml)

# ── DB identity from ops/config/db/.env (create from example if absent) ───────
$DbEnv = Join-Path $Root 'ops/config/db/.env'
if (-not (Test-Path $DbEnv)) {
  Info 'ops/config/db/.env not found — creating it from .env.example (dev defaults).'
  Copy-Item (Join-Path $Root 'ops/config/db/.env.example') $DbEnv
}
# Parse KEY=VALUE lines (ignore comments/blanks) into a hashtable.
$db = @{}
Get-Content $DbEnv | ForEach-Object {
  if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') { $db[$matches[1]] = $matches[2].Trim() }
}
$PgUser = if ($db.ContainsKey('POSTGRES_USER'))     { $db['POSTGRES_USER'] }     else { 'statdash' }
$PgPass = if ($db.ContainsKey('POSTGRES_PASSWORD')) { $db['POSTGRES_PASSWORD'] } else { 'changeme_dev_only' }
$PgDb   = if ($db.ContainsKey('POSTGRES_DB'))       { $db['POSTGRES_DB'] }       else { 'statdash' }
$PgPort = if ($db.ContainsKey('POSTGRES_PORT'))     { $db['POSTGRES_PORT'] }     else { '5432' }

# DATABASE_URL → localhost (port published to 127.0.0.1). THE switch that
# un-skips the DB-gated suites + drives seed/verify-parity.
$env:DATABASE_URL  = "postgres://${PgUser}:${PgPass}@localhost:${PgPort}/${PgDb}"
$env:JWT_SECRET    = if ($env:JWT_SECRET)    { $env:JWT_SECRET }    else { 'validate-local-jwt-secret-at-least-32-chars!!' }
$env:ADMIN_USERNAME= if ($env:ADMIN_USERNAME){ $env:ADMIN_USERNAME }else { 'admin' }
$env:ADMIN_PASSWORD= if ($env:ADMIN_PASSWORD){ $env:ADMIN_PASSWORD }else { 'validate-local-pw' }

$ApiPort = 3001
$script:ApiProc = $null

# ── Teardown ──────────────────────────────────────────────────────────────────
function Invoke-Cleanup {
  if ($script:ApiProc -and -not $script:ApiProc.HasExited) {
    Info "stopping background API (pid $($script:ApiProc.Id))"
    Stop-Process -Id $script:ApiProc.Id -Force -ErrorAction SilentlyContinue
  }
  if ($Keep) {
    Warn '-Keep set: leaving the stack UP. Tear down with:'
    Warn "    docker compose -p $Project -f `"$BaseYml`" -f `"$PgYml`" -f `"$FlywayYml`" down -v"
  } else {
    Info "tearing down the '$Project' stack (down -v)"
    docker @Compose -f $FlywayYml down -v --remove-orphans *> $null
  }
}

try {
  # ══ STAGE 1 — network + Postgres ════════════════════════════════════════════
  Info 'STAGE 1/8 — docker network + Postgres (timescaledb-ha:pg16)'
  docker network inspect statdash-net *> $null
  if ($LASTEXITCODE -ne 0) {
    Invoke-OrDie { docker network create statdash-net | Out-Null } 'docker network create'
    Ok 'created docker network statdash-net'
  } else { Write-Host '  network statdash-net already exists' -ForegroundColor DarkGray }

  Invoke-OrDie { docker @Compose up -d --wait postgres } 'postgres up'
  Ok "Postgres healthy on localhost:${PgPort} (db=$PgDb user=$PgUser)"

  # ══ STAGE 2 — Flyway migrate V1→V29 + R__ ═══════════════════════════════════
  Info 'STAGE 2/8 — Flyway migrate (V1→V29 + R__seed_geostat_gold)'
  Invoke-OrDie {
    docker @Compose -f $FlywayYml up --abort-on-container-exit --exit-code-from flyway flyway
  } 'flyway migrate'
  Ok 'migrations applied clean from scratch (V1→V29 + R__ gold seed)'

  # ══ STAGE 3 — build engine dist ═════════════════════════════════════════════
  Info 'STAGE 3/8 — pnpm build:engine'
  Invoke-OrDie { pnpm -C $Platform install --frozen-lockfile } 'pnpm install'
  Invoke-OrDie { pnpm -C $Platform build:engine } 'build:engine'
  Ok 'engine packages built to dist'

  # ══ STAGE 4 — seed the cube ═════════════════════════════════════════════════
  Info 'STAGE 4/8 — seed the cube'
  Invoke-OrDie { pnpm -C $Platform --filter '@statdash/api' seed } 'seed'
  Ok 'cube seeded (GDP_ANNUAL, ACCOUNTS_SEQUENCE, REGIONAL_GVA)'

  # ══ STAGE 5 — DB-gated test suite ═══════════════════════════════════════════
  Info 'STAGE 5/8 — pnpm test with DATABASE_URL set (DB-gated proofs RUN)'
  $env:NODE_ENV = 'test'
  Invoke-OrDie { pnpm -C $Platform test } 'pnpm test'
  Ok 'all suites green, including the live-DB proofs'

  # ══ STAGE 6 — start API one-shot, wait /health ══════════════════════════════
  Info 'STAGE 6/8 — start API one-shot (tsx src/index.ts), wait for /health'
  $apiLog = Join-Path ([System.IO.Path]::GetTempPath()) ("statdash-api-{0}.log" -f ([guid]::NewGuid().ToString('N')))
  $apiEnv = @{
    NODE_ENV='production'; PORT="$ApiPort"; HOST='0.0.0.0'; CORS_ORIGIN='http://localhost:5175'
    DATABASE_URL=$env:DATABASE_URL; JWT_SECRET=$env:JWT_SECRET
    ADMIN_USERNAME=$env:ADMIN_USERNAME; ADMIN_PASSWORD=$env:ADMIN_PASSWORD
  }
  # Launch tsx via pnpm in the platform dir; inherit the api env vars.
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = (Get-Command pnpm).Source
  $psi.Arguments = '--filter @statdash/api exec tsx src/index.ts'
  $psi.WorkingDirectory = $Platform
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError  = $true
  foreach ($k in $apiEnv.Keys) { $psi.EnvironmentVariables[$k] = $apiEnv[$k] }
  $script:ApiProc = [System.Diagnostics.Process]::Start($psi)
  Write-Host "  API pid=$($script:ApiProc.Id), log=$apiLog" -ForegroundColor DarkGray

  $healthy = $false
  for ($i = 0; $i -lt 60; $i++) {
    try {
      $r = Invoke-WebRequest -Uri "http://localhost:$ApiPort/health" -UseBasicParsing -TimeoutSec 2
      if ($r.StatusCode -eq 200 -and $r.Content -match 'ok') { $healthy = $true; break }
    } catch { }
    Start-Sleep -Seconds 2
  }
  if (-not $healthy) {
    Err 'API did not become healthy in time.'
    throw 'API health timeout'
  }
  Ok "API healthy at http://localhost:$ApiPort"

  # ══ STAGE 7 — verify-parity ═════════════════════════════════════════════════
  Info 'STAGE 7/8 — verify-parity (P1-3 gate)'
  $env:API_BASE_URL = "http://localhost:$ApiPort"
  Invoke-OrDie { pnpm -C $Platform --filter '@statdash/api' verify-parity } 'verify-parity'
  Ok 'parity holds — bundle reference equals the live API row-for-row'

  # ══ STAGE 8 — stop API ══════════════════════════════════════════════════════
  Info 'STAGE 8/8 — stopping API; stack teardown on exit'
  if ($script:ApiProc -and -not $script:ApiProc.HasExited) {
    Stop-Process -Id $script:ApiProc.Id -Force -ErrorAction SilentlyContinue
  }
  $script:ApiProc = $null
  Ok 'all 8 stages passed'

  Invoke-Cleanup
  Ok 'validate:local PASSED — the data layer is proven against a live Postgres.'
  exit 0
}
catch {
  Err "validate:local FAILED — $($_.Exception.Message)"
  Invoke-Cleanup
  exit 1
}
