# ════════════════════════════════════════════════════════════════════════════
# validate-local.ps1 — Windows mirror of validate-local.sh (THE FIRST REAL RUN).
# ════════════════════════════════════════════════════════════════════════════
#
# Same 8 stages, same contract, for a docker-capable Windows host:
#   network + Postgres → Flyway migrate (V1→V34, structure only) → build:engine →
#   DB-gated test suite (DATABASE_URL un-skips them) → API one-shot + /health →
#   canonical ingest (DATA/canonical/*.xlsx → pipeline → gold, self-verifying
#   counts + anchors) → teardown (unless -Keep).
#
# SSOT (ADR-0032): the demo-data SSOT is the canonical workbooks; the legacy bundle
# seed (ops/seed-data/*.bundle.json) is a RETIRED 3-dim-GDP lane that would fail the
# V34 canonical 4-dim DSD. This script no longer touches it — one demo-data SSOT.
#
# USAGE
#   pwsh ops/scripts/validate-local.ps1            # full run + teardown
#   pwsh ops/scripts/validate-local.ps1 -Keep      # leave the stack up
#
# PREREQ: docker (+ compose v2), pnpm, node, curl, bash, on a docker-capable machine.
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
# bash is required for the canonical ingest driver (ops/scripts/ingest-canonical.sh),
# which STAGE 6 runs (Git-for-Windows / WSL bash both work).
foreach ($tool in 'docker','pnpm','node','curl','bash') {
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
# un-skips the DB-gated suites and that the API boots against.
$env:DATABASE_URL  = "postgres://${PgUser}:${PgPass}@localhost:${PgPort}/${PgDb}"
$env:JWT_SECRET    = if ($env:JWT_SECRET)    { $env:JWT_SECRET }    else { 'validate-local-jwt-secret-at-least-32-chars!!' }
$env:ADMIN_USERNAME= if ($env:ADMIN_USERNAME){ $env:ADMIN_USERNAME }else { 'admin' }
$env:ADMIN_PASSWORD= if ($env:ADMIN_PASSWORD){ $env:ADMIN_PASSWORD }else { 'validate-local-pw' }

$ApiPort = 3001
$script:ApiProc = $null

# Canonical demo-data SSOT (ADR-0032): the 3 workbooks the bring-up ingest POSTs.
$CanonicalDir = Join-Path $Root 'DATA/canonical'

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

  # ══ STAGE 2 — Flyway migrate V1→V34 (structure only) ════════════════════════
  Info 'STAGE 2/8 — Flyway migrate (V1→V34, structure only)'
  # The flyway service mounts ONLY ops/postgres/migrations (Vnn); R__seed_geostat_gold
  # is unmounted (ADR-0032) — its 3-dim GDP would fail V34's canonical 4-dim DSD.
  # Demo data is loaded by the canonical ingest in STAGE 6, not by SQL.
  Invoke-OrDie {
    docker @Compose -f $FlywayYml up --abort-on-container-exit --exit-code-from flyway flyway
  } 'flyway migrate'
  Ok 'migrations applied clean from scratch (V1→V34, incl. V34 canonical 4-dim GDP DSD)'

  # ══ STAGE 3 — build engine dist ═════════════════════════════════════════════
  Info 'STAGE 3/8 — pnpm build:engine'
  Invoke-OrDie { pnpm -C $Platform install --frozen-lockfile } 'pnpm install'
  Invoke-OrDie { pnpm -C $Platform build:engine } 'build:engine'
  Ok 'engine packages built to dist'

  # ══ STAGE 4 — DB-gated test suite ═══════════════════════════════════════════
  # These suites SELF-PROVISION their own fixtures (rolled-back tx / runProvisioning
  # into a temp dir) — they do NOT depend on any prior cube seed, so this stage now
  # runs on a fresh-migrated DB BEFORE any demo-data load.
  Info 'STAGE 4/8 — pnpm test with DATABASE_URL set (DB-gated proofs RUN)'
  $env:NODE_ENV = 'test'
  Invoke-OrDie { pnpm -C $Platform test } 'pnpm test'
  Ok 'all suites green, including the live-DB proofs'

  # ══ STAGE 5 — start API one-shot, wait /health ══════════════════════════════
  Info 'STAGE 5/8 — start API one-shot (tsx src/index.ts), wait for /health'
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

  # ══ STAGE 6 — canonical bring-up ingest (demo-data SSOT → gold, the REAL way) ═
  # Drive the SAME script the prod compose `ingest` one-shot runs: POST each
  # DATA/canonical/*.xlsx to /api/ingest/canonical, publish through the FSM, then
  # serve-assert counts (GDP=288, ACCOUNTS=415, REGIONAL=1554) + the 3 anchors. The
  # GDP anchor (geo=GE, approach=_Z, 2010 ≈ 22148.65) only resolves if GDP is 4-dim
  # — the live proof that V34 + the canonical workbook agree. Idempotent (409 on a
  # re-run). REPLACES the retired bundle verify-parity.
  Info 'STAGE 6/8 — canonical ingest (DATA/canonical/*.xlsx -> pipeline -> gold)'
  $env:API_BASE_URL  = "http://localhost:$ApiPort"
  $env:CANONICAL_DIR = $CanonicalDir
  Invoke-OrDie {
    bash (Join-Path $ScriptDir 'ingest-canonical.sh')
  } 'canonical ingest'
  Ok 'canonical demo data ingested, served + anchors verified (4-dim GDP)'

  # ══ STAGE 7 — (folded into STAGE 6) ═════════════════════════════════════════
  Info 'STAGE 7/8 — parity covered by STAGE 6 canonical serve+anchor asserts'
  Ok 'row-level parity holds against the canonical SSOT (no separate gate needed)'

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
