#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# bringup-fresh.sh — deterministic FRESH-FROM-ZERO full-data bring-up.
#
# THE PROBLEM THIS SOLVES (ADR-035): a single uncapped `flyway migrate` on a fresh
# volume DIES at V33. V33__demo_classifier_data asserts on ingest-produced members
# (geo _T+R2..R12, sector, account) — "expected >=11 regions parented to _T, found 0"
# — which only the canonical REGIONAL/ACCOUNTS ingest creates. And V34 must run BEFORE
# the GDP ingest (it widens GDP to the canonical 4-dim DSD). So the migration batch
# V33..V34 is straddled by TWO ingests: V33 needs REGIONAL/ACCOUNTS to have run; GDP
# needs V34 to have run. One pre-ingest flyway pass cannot satisfy both. V33..V38 are
# applied+immutable (never edited → checksum-stable), so the fix is this ORCHESTRATION:
#
#   Phase 1  flyway migrate -target=32                 # all structure/config/auth/provisioning
#   Phase 2  ingest REGIONAL_GVA + ACCOUNTS_SEQUENCE   # creates geo _T+R2..R12, sector, account
#   Phase 3  flyway migrate  (uncapped)                # V33 passes; V34 widens GDP 4-dim; V35..V38
#   Phase 4  ingest GDP_ANNUAL                         # 4-dim GDP facts land vs the widened DSD
#
# End state: schema at V38 WITH real data (stats.observation > 0, 4-dim GDP).
# Fully IDEMPOTENT: migrations are idempotent no-ops on re-run; the ingest driver
# converges (409 ALREADY_PUBLISHED / converged-publish); re-running the whole script is
# a no-op. NO migration body is touched → prod/staging `validate` stays green.
#
# ── SAFETY ───────────────────────────────────────────────────────────────────
# This is meant for a FRESH THROWAWAY DB (a local docker/podman TimescaleDB volume, or an
# isolated dev line). It runs `flyway migrate` and POSTs ingest — do NOT point it at a
# line you cannot afford to converge. It never DELETES data; it is additive + idempotent.
#
# ── INPUTS (env) ─────────────────────────────────────────────────────────────
#   PG_URL         JDBC url for flyway, e.g. jdbc:postgresql://localhost:5432/statdash
#   PG_USER        db user            (default: statdash)
#   PG_PASSWORD    db password        (required)
#   MIGRATIONS_DIR host path to ops/postgres/migrations (default: repo ops/postgres/migrations)
#   FLYWAY_TARGET  phase-1 cap        (default: 32 — last migration before V33)
#   API_BASE_URL   running api base, e.g. http://localhost:3011  (required for Phase 2/4)
#   ADMIN_USERNAME / ADMIN_PASSWORD   curator creds for the ingest (or preset ADMIN_JWT)
#   CANONICAL_DIR  host path to DATA/canonical (default: repo DATA/canonical)
#   FLYWAY_IMAGE   default: flyway/flyway:10-alpine
#   FLYWAY_NET     optional docker network to attach flyway to (e.g. statdash-dev-net)
#   SKIP_MIGRATE / SKIP_INGEST  set to 1 to skip that half (partial re-runs)
#
# The api (and postgres) must ALREADY be running (compose `up -d postgres api`, or an
# api pointed at PG_URL). This script owns only the migrate/ingest INTERLEAVE, not the
# container lifecycle — so it composes with any line (dev/staging/local) without owning it.
#
# ── LOCAL PROOF (fresh throwaway, no server) ─────────────────────────────────
#   docker run -d --name pgproof -e POSTGRES_DB=statdash -e POSTGRES_USER=statdash \
#     -e POSTGRES_PASSWORD=pw -p 5499:5432 timescale/timescaledb-ha:pg16
#   # start an api against postgres://statdash:pw@localhost:5499/statdash on :3011, then:
#   PG_URL=jdbc:postgresql://localhost:5499/statdash PG_PASSWORD=pw \
#     API_BASE_URL=http://localhost:3011 ADMIN_USERNAME=admin ADMIN_PASSWORD=... \
#     bash ops/scripts/bringup-fresh.sh
#   # assert: psql -c "select count(*) from stats.observation;"  →  > 0
#   #         flyway ... info  →  head = V38 (Success)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"

PG_USER="${PG_USER:-statdash}"
PG_PASSWORD="${PG_PASSWORD:?set PG_PASSWORD}"
PG_URL="${PG_URL:?set PG_URL (jdbc:postgresql://host:port/db)}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-$REPO/ops/postgres/migrations}"
FLYWAY_TARGET="${FLYWAY_TARGET:-32}"
FLYWAY_IMAGE="${FLYWAY_IMAGE:-flyway/flyway:10-alpine}"
CANONICAL_DIR="${CANONICAL_DIR:-$REPO/DATA/canonical}"

# ── flyway <extra-args...> — run a flyway command in the pinned image ──────────
# All connection args are supplied here (not baked in a compose command) so this
# orchestrator is self-contained. placeholderReplacement=false: the migrations are
# static SQL. An optional --network lets it reach a compose-internal postgres by name.
flyway() {
  local netarg=()
  [[ -n "${FLYWAY_NET:-}" ]] && netarg=(--network "$FLYWAY_NET")
  docker run --rm "${netarg[@]}" \
    -v "$MIGRATIONS_DIR:/flyway/sql:ro" \
    "$FLYWAY_IMAGE" \
    -url="$PG_URL" -user="$PG_USER" -password="$PG_PASSWORD" \
    -locations=filesystem:/flyway/sql -placeholderReplacement=false "$@"
}

ingest() {  # $1 = space-separated dataset list
  INGEST_DATASETS="$1" CANONICAL_DIR="$CANONICAL_DIR" \
    API_BASE_URL="${API_BASE_URL:?set API_BASE_URL}" \
    bash "$HERE/ingest-canonical.sh"
}

echo "════ fresh-from-zero bring-up (ADR-035 interleave) ════"

if [[ "${SKIP_MIGRATE:-0}" != "1" ]]; then
  echo "── Phase 1: flyway migrate -target=$FLYWAY_TARGET (structure through V$FLYWAY_TARGET) ──"
  flyway -target="$FLYWAY_TARGET" migrate
fi

if [[ "${SKIP_INGEST:-0}" != "1" ]]; then
  echo "── Phase 2: ingest REGIONAL_GVA + ACCOUNTS_SEQUENCE (pre-V33 members) ──"
  ingest "REGIONAL_GVA ACCOUNTS_SEQUENCE"
fi

if [[ "${SKIP_MIGRATE:-0}" != "1" ]]; then
  echo "── Phase 3: flyway migrate (uncapped: V33 passes, V34 widens GDP 4-dim, V35..V38) ──"
  flyway migrate
fi

if [[ "${SKIP_INGEST:-0}" != "1" ]]; then
  echo "── Phase 4: ingest GDP_ANNUAL (4-dim facts vs the widened DSD) ──"
  ingest "GDP_ANNUAL"
fi

echo "════ done — schema at head (V38) with data. Verify: stats.observation > 0 ════"
