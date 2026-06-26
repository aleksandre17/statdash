#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
# validate-local.sh — THE FIRST REAL RUN, turnkey.
# ════════════════════════════════════════════════════════════════════════════
#
# WHAT IT PROVES
#   Closes the #1 standing risk: the Flyway migrations + the entire data layer
#   have never run against a real Postgres. This single command stands up a live
#   TimescaleDB, applies V1→V34 from scratch, UN-SKIPS and runs the DB-gated proof
#   suites (they `describe.skip` themselves when DATABASE_URL is unset), then boots
#   the API and provisions the REAL demo data through the canonical ingest pipeline
#   (the SAME path prod uses), self-verifying counts + anchor values.
#
#   Mirrors prod provisioning (ops/compose/docker-compose.prod.yml): flyway V1→V34
#   → api healthy → canonical ingest one-shot → SPAs. Here it runs as ONE local
#   command against a docker you control (the dev infra compose stack).
#
# SSOT (ADR-0032): the demo-data SSOT is the canonical workbooks DATA/canonical/*.xlsx,
#   ingested through POST /api/ingest/canonical + the publish FSM. The legacy bundle
#   seed (ops/seed-data/*.bundle.json + `pnpm --filter @statdash/api seed`) is a
#   RETIRED parity lane: it carries 3-dim GDP facts that no longer match the V34
#   canonical 4-dim [measure, approach, time, geo] DSD and would fail the V22 dim_key
#   trigger. This script no longer touches it — there is exactly ONE demo-data SSOT.
#
# USAGE
#   pnpm validate:local              # full run + teardown
#   pnpm validate:local -- --keep    # leave the stack up for inspection
#   bash ops/scripts/validate-local.sh [--keep]
#
# PREREQ
#   docker (+ compose v2), pnpm, node, curl, on a docker-capable machine.
#   THIS authoring environment has NO docker — the script is correct-by-
#   construction; what the first real run must confirm is listed in ops/RUNBOOK.md.
#
# CONTRACT
#   set -euo pipefail + clear stage echoes + non-zero exit on ANY failure
#   (fail-fast, never a false green). Teardown runs on exit via a trap unless
#   --keep is given.
# ════════════════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/_lib.sh"   # ROOT, info/ok/warn/err, wait_http, require

# ── Flags ───────────────────────────────────────────────────────────────────
KEEP=0
for arg in "$@"; do
  case "$arg" in
    --keep) KEEP=1 ;;
    *) err "unknown flag: $arg (supported: --keep)"; exit 2 ;;
  esac
done

# ── Preflight: required tooling ───────────────────────────────────────────────
require docker
require pnpm
require node
require curl

# docker compose v2 (plugin) — the whole stack assumes `docker compose`, not the
# legacy `docker-compose` binary.
if ! docker compose version >/dev/null 2>&1; then
  err "docker compose v2 plugin is required (docker compose version failed)."
  exit 127
fi

PLATFORM="$ROOT/platform"

# ── Paths to the infra compose stack (the existing assembled pieces) ──────────
INFRA_DIR="$ROOT/ops/compose/infra"
BASE_YML="$INFRA_DIR/docker-compose.base.yml"
PG_YML="$INFRA_DIR/services/postgres.yml"
FLYWAY_YML="$INFRA_DIR/services/flyway.yml"
# One compose project for the whole validate run so down -v cleans everything.
PROJECT="statdash-validate"
COMPOSE=(docker compose -p "$PROJECT" -f "$BASE_YML" -f "$PG_YML")

# ── DB identity: source ops/config/db/.env (create from example if absent) ────
# postgres.yml + flyway.yml load this via env_file; DATABASE_URL must match it.
DB_ENV="$ROOT/ops/config/db/.env"
if [[ ! -f "$DB_ENV" ]]; then
  info "ops/config/db/.env not found — creating it from .env.example (dev defaults)."
  cp "$ROOT/ops/config/db/.env.example" "$DB_ENV"
fi
# shellcheck disable=SC1090
set -a; . "$DB_ENV"; set +a
PG_USER="${POSTGRES_USER:-statdash}"
PG_PASS="${POSTGRES_PASSWORD:-changeme_dev_only}"
PG_DB="${POSTGRES_DB:-statdash}"
PG_PORT="${POSTGRES_PORT:-5432}"

# The published port binds to 127.0.0.1 (postgres.yml), so every Node step on the
# host reaches Postgres at localhost:<PG_PORT>. This is the DATABASE_URL that
# un-skips the DB-gated suites and that the API boots against.
export DATABASE_URL="postgres://${PG_USER}:${PG_PASS}@localhost:${PG_PORT}/${PG_DB}"

# api env (env.ts fail-fasts at import if these are absent/weak — see apps/api/src/env.ts).
# ADMIN_* double as the curator creds the canonical ingest authenticates with.
export JWT_SECRET="${JWT_SECRET:-validate-local-jwt-secret-at-least-32-chars!!}"
export ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
export ADMIN_PASSWORD="${ADMIN_PASSWORD:-validate-local-pw}"

API_PORT=3001
API_PID=""

# Canonical demo-data SSOT (ADR-0032): the 3 workbooks the bring-up ingest POSTs.
CANONICAL_DIR="$ROOT/DATA/canonical"

# ── Teardown (trap) ───────────────────────────────────────────────────────────
cleanup() {
  local rc=$?
  # Stop a backgrounded API if one is still running.
  if [[ -n "$API_PID" ]] && kill -0 "$API_PID" 2>/dev/null; then
    info "stopping background API (pid $API_PID)"
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
  fi
  if (( KEEP == 1 )); then
    warn "--keep set: leaving the '$PROJECT' stack UP. Tear down with:"
    warn "    docker compose -p $PROJECT -f $BASE_YML -f $PG_YML -f $FLYWAY_YML down -v"
  else
    info "tearing down the '$PROJECT' stack (down -v)"
    "${COMPOSE[@]}" -f "$FLYWAY_YML" down -v --remove-orphans >/dev/null 2>&1 || true
  fi
  if (( rc == 0 )); then
    ok "validate:local PASSED — the data layer is proven against a live Postgres."
  else
    err "validate:local FAILED at some stage (rc=$rc). See the stage echoes above."
  fi
  exit $rc
}
trap cleanup EXIT

# ════════════════════════════════════════════════════════════════════════════
# STAGE 1 — network + Postgres up, wait for health
# ════════════════════════════════════════════════════════════════════════════
info "STAGE 1/8 — docker network + Postgres (timescaledb-ha:pg16)"

# Idempotent: the infra base compose declares the external-style network, but the
# app stack + RUNBOOK deploy flow expect a pre-created statdash-net. Create it
# explicitly so this script and the deploy flow share one network contract.
if ! docker network inspect statdash-net >/dev/null 2>&1; then
  docker network create statdash-net >/dev/null
  ok "created docker network statdash-net"
else
  dim "  network statdash-net already exists"
fi

# Bring up only Postgres (no pgadmin/flyway yet). --wait blocks until the
# service is HEALTHY per postgres.yml's pg_isready healthcheck.
"${COMPOSE[@]}" up -d --wait postgres
ok "Postgres is healthy on localhost:${PG_PORT} (db=${PG_DB} user=${PG_USER})"

# ════════════════════════════════════════════════════════════════════════════
# STAGE 2 — Flyway migrate V1→V34 (STRUCTURE only), from scratch
# ════════════════════════════════════════════════════════════════════════════
info "STAGE 2/8 — Flyway migrate (V1→V34, structure only)"
# The flyway service mounts ONLY ops/postgres/migrations (Vnn) read-only and runs
# `migrate` once Postgres is healthy, then exits. The R__ gold seed
# (ops/postgres/seed) is NO LONGER mounted/listed (ADR-0032 neutralization — see
# ops/compose/infra/services/flyway.yml): it is the stale 3-dim-GDP parity twin
# that V34's canonical 4-dim DSD widen would fail. Demo data comes from the
# canonical ingest in STAGE 6, not from SQL. Run flyway as a one-shot and FAIL the
# whole script on a non-zero exit.
#   --abort-on-container-exit: the run ends when flyway exits.
#   --exit-code-from flyway:   propagate flyway's exit code as the compose exit.
"${COMPOSE[@]}" -f "$FLYWAY_YML" up \
  --abort-on-container-exit \
  --exit-code-from flyway \
  flyway
ok "migrations applied clean from scratch (V1→V34, incl. V34 canonical 4-dim GDP DSD)"

# ════════════════════════════════════════════════════════════════════════════
# STAGE 3 — build engine dist (before any api command)
# ════════════════════════════════════════════════════════════════════════════
info "STAGE 3/8 — pnpm build:engine (contracts → expr → engine dist)"
pnpm -C "$PLATFORM" install --frozen-lockfile
pnpm -C "$PLATFORM" build:engine
ok "engine packages built to dist"

# ════════════════════════════════════════════════════════════════════════════
# STAGE 4 — DB-gated test suite (DATABASE_URL exported → suites UN-SKIP)
# ════════════════════════════════════════════════════════════════════════════
info "STAGE 4/8 — pnpm test with DATABASE_URL set (DB-gated proofs RUN)"
# DATABASE_URL is exported (above), so every `const suite = DATABASE_URL ?
# describe : describe.skip` flips from skip → run:
#   bootstrap-parity, upsert.scd2, content-constraint, concept/category-scheme,
#   dataset-lifecycle, cube-profile (vintage), observations-multivalue, canonical e2e.
# These suites SELF-PROVISION their own fixtures (each INSERTs its DSD+obs inside a
# rolled-back tx, or runProvisioning into a temp dir) — they do NOT depend on any
# prior cube seed. That is exactly why this stage now runs BEFORE any demo-data
# load: a fresh-migrated (V1→V34) DB is all they require. The canonical demo data
# is loaded next (STAGE 6) through the real pipeline, not by these tests.
NODE_ENV=test pnpm -C "$PLATFORM" test
ok "all suites green, including the live-DB proofs"

# ════════════════════════════════════════════════════════════════════════════
# STAGE 5 — start the API one-shot (background), wait for /health
# ════════════════════════════════════════════════════════════════════════════
info "STAGE 5/8 — start API one-shot (tsx src/index.ts), wait for /health"
# One-shot, NOT `pnpm dev` (tsx watch): watch mode would hold open / re-trigger.
# Boot runs env.ts (DATABASE_URL + JWT + ADMIN_*) then runProvisioning before
# listening. NODE_ENV=production to exercise the real boot path.
API_LOG="$(mktemp -t statdash-api.XXXXXX.log)"
(
  cd "$PLATFORM"
  NODE_ENV=production PORT="$API_PORT" HOST=0.0.0.0 \
    CORS_ORIGIN="http://localhost:5175" \
    pnpm --filter @statdash/api exec tsx src/index.ts
) >"$API_LOG" 2>&1 &
API_PID=$!
dim "  API pid=$API_PID, log=$API_LOG"

if ! wait_http "http://localhost:${API_PORT}/health" 120 2 "ok"; then
  err "API did not become healthy in time — dumping log:"
  cat "$API_LOG" >&2 || true
  exit 1
fi
ok "API healthy at http://localhost:${API_PORT}"

# ════════════════════════════════════════════════════════════════════════════
# STAGE 6 — canonical bring-up ingest (the demo-data SSOT → gold, the REAL way)
# ════════════════════════════════════════════════════════════════════════════
info "STAGE 6/8 — canonical ingest (DATA/canonical/*.xlsx → pipeline → gold)"
# Drive the SAME script the prod compose `ingest` one-shot runs
# (ops/scripts/ingest-canonical.sh): POST each .xlsx to /api/ingest/canonical,
# poll the worker to `staged`, publish (the explicit gold gate), poll to
# `published`, then SERVE-assert counts (GDP=288, ACCOUNTS=415, REGIONAL=1554) and
# the 3 anchor values. The GDP anchor (geo=GE, approach=_Z, 2010 ≈ 22148.65) only
# resolves if GDP is 4-dim — so this stage is the live proof that V34 + the
# canonical workbook agree. Idempotent: a re-run hits 409 ALREADY_PUBLISHED and
# still runs the serve assertions. This REPLACES the retired bundle verify-parity:
# the ingest's built-in serve+anchor checks ARE the row-level parity gate, now
# against the canonical SSOT instead of the stale 3-dim bundles.
API_BASE_URL="http://localhost:${API_PORT}" \
  CANONICAL_DIR="$CANONICAL_DIR" \
  ADMIN_USERNAME="$ADMIN_USERNAME" ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  bash "$SCRIPT_DIR/ingest-canonical.sh"
ok "canonical demo data ingested, served + anchors verified (4-dim GDP)"

# ════════════════════════════════════════════════════════════════════════════
# STAGE 7 — (intentionally folded into STAGE 6) — kept as a no-op marker
# ════════════════════════════════════════════════════════════════════════════
info "STAGE 7/8 — parity covered by STAGE 6 canonical serve+anchor asserts"
ok "row-level parity holds against the canonical SSOT (no separate gate needed)"

# ════════════════════════════════════════════════════════════════════════════
# STAGE 8 — stop API (teardown handles the stack)
# ════════════════════════════════════════════════════════════════════════════
info "STAGE 8/8 — stopping API; stack teardown on exit"
if [[ -n "$API_PID" ]] && kill -0 "$API_PID" 2>/dev/null; then
  kill "$API_PID" 2>/dev/null || true
  wait "$API_PID" 2>/dev/null || true
fi
API_PID=""
rm -f "$API_LOG" 2>/dev/null || true
ok "all 8 stages passed"
# trap cleanup runs next (teardown unless --keep), then exits 0.
