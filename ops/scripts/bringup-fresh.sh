#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# bringup-fresh.sh — deterministic FRESH-FROM-ZERO full-data bring-up.
#
# THE PROBLEM THIS SOLVED, AND THE ROOT-CAUSE FIX (ADR-035):
# A single uncapped `flyway migrate` on a fresh volume USED to DIE at V33:
# V33__demo_classifier_data §7 asserts `n_geo_regions >= 11` on geo _T+R2..R12,
# members that only the canonical REGIONAL ingest created — and V33 ALSO stamps the
# sector roll-up (§6) and the account order/display (§4) onto ingest-produced
# members. On a fresh DB those members are absent, so V33 either RAISEs (geo) or
# silently drops its corrections (sector/account).
#
# The fix is a Flyway CALLBACK — `ops/postgres/migrations/beforeEachMigrate.sql` —
# that idempotently seeds the geo/sector/account STRUCTURAL codelist members (SDMX
# codelists are structure, V7's own law) BEFORE V33, sourced from the canonical
# CL_* sheets. It is checksum-neutral (a callback is not in the version chain →
# prod/staging `validate` stays green) and a pure no-op on any already-populated DB
# (seed-if-missing). With it, V33's §4/§5/§6 corrections apply exactly as they did
# on prod, and the whole ingest becomes purely ADDITIVE (facts only).
#
# So the bring-up COLLAPSES to two ordered phases (no -target cap, no ingest split,
# no pre-applied worker columns, no V37 `claimed_at` trap):
#
#   Phase 1  flyway migrate            # uncapped → V38; the callback seeds geo/
#                                      # sector/account structure before V33, so V33
#                                      # passes and its corrections land; V34 widens
#                                      # GDP to the canonical 4-dim DSD; V35..V38.
#   Phase 2  ingest ALL 3 workbooks    # additive: classifier members converge
#                                      # (identical labels ⇒ ON CONFLICT DO NOTHING,
#                                      # no SCD-2 churn); facts (incl. 4-dim GDP vs
#                                      # the now-widened DSD) land.
#
# End state: schema at V38 WITH real data (stats.observation > 0, 4-dim GDP).
# Fully IDEMPOTENT: migrations are idempotent no-ops on re-run; the callback is a
# seed-if-missing no-op; the ingest driver converges (409 ALREADY_PUBLISHED /
# converged-publish); re-running the whole script is a no-op. NO migration body is
# touched → prod/staging `validate` stays green.
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
#   API_BASE_URL   running api base, e.g. http://localhost:3011  (required for Phase 2)
#   ADMIN_USERNAME / ADMIN_PASSWORD   curator creds for the ingest (or preset ADMIN_JWT)
#   CANONICAL_DIR  host path to DATA/canonical (default: repo DATA/canonical)
#   FLYWAY_IMAGE   default: flyway/flyway:10-alpine
#   FLYWAY_NET     optional docker network to attach flyway to (e.g. statdash-dev-net)
#   SKIP_MIGRATE / SKIP_INGEST  set to 1 to skip that half (partial re-runs)
#
# The api (and postgres) must ALREADY be running (compose `up -d postgres api`, or an
# api pointed at PG_URL). This script owns only the migrate/ingest sequence, not the
# container lifecycle — so it composes with any line (dev/staging/local) without owning it.
#
# ── LOCAL PROOF (fresh throwaway, no server) ─────────────────────────────────
#   docker run -d --name pgproof -e POSTGRES_DB=statdash -e POSTGRES_USER=statdash \
#     -e POSTGRES_PASSWORD=pw -p 5499:5432 timescale/timescaledb-ha:pg16
#   # start an api against postgres://statdash:pw@localhost:5499/statdash on :3011, then:
#   PG_URL=jdbc:postgresql://localhost:5499/statdash PG_PASSWORD=pw \
#     API_BASE_URL=http://localhost:3011 ADMIN_USERNAME=admin ADMIN_PASSWORD=... \
#     bash ops/scripts/bringup-fresh.sh
#   # assert: psql -c "select count(*) from stats.observation;"  →  > 0  (~2479)
#   #         flyway ... info  →  head = V38 (Success)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"

PG_USER="${PG_USER:-statdash}"
PG_PASSWORD="${PG_PASSWORD:?set PG_PASSWORD}"
PG_URL="${PG_URL:?set PG_URL (jdbc:postgresql://host:port/db)}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-$REPO/ops/postgres/migrations}"
FLYWAY_IMAGE="${FLYWAY_IMAGE:-flyway/flyway:10-alpine}"
CANONICAL_DIR="${CANONICAL_DIR:-$REPO/DATA/canonical}"

# ── flyway <extra-args...> — run a flyway command in the pinned image ──────────
# All connection args are supplied here (not baked in a compose command) so this
# orchestrator is self-contained. The migrations dir is mounted as the flyway
# `locations`, so the co-located beforeEachMigrate.sql callback is auto-discovered.
# placeholderReplacement=false: the migrations are static SQL (does not affect
# callback discovery). An optional --network lets it reach a compose-internal
# postgres by name.
flyway() {
  local netarg=()
  [[ -n "${FLYWAY_NET:-}" ]] && netarg=(--network "$FLYWAY_NET")
  docker run --rm "${netarg[@]}" \
    -v "$MIGRATIONS_DIR:/flyway/sql:ro" \
    "$FLYWAY_IMAGE" \
    -url="$PG_URL" -user="$PG_USER" -password="$PG_PASSWORD" \
    -locations=filesystem:/flyway/sql -placeholderReplacement=false "$@"
}

ingest() {  # $1 = space-separated dataset list ('' = all)
  INGEST_DATASETS="$1" CANONICAL_DIR="$CANONICAL_DIR" \
    API_BASE_URL="${API_BASE_URL:?set API_BASE_URL}" \
    bash "$HERE/ingest-canonical.sh"
}

echo "════ fresh-from-zero bring-up (ADR-035 — beforeEachMigrate callback) ════"

if [[ "${SKIP_MIGRATE:-0}" != "1" ]]; then
  echo "── Phase 1: flyway migrate (uncapped → V38; callback seeds geo/sector/account structure before V33) ──"
  flyway migrate
fi

if [[ "${SKIP_INGEST:-0}" != "1" ]]; then
  echo "── Phase 2: ingest ALL canonical workbooks (additive: members converge, facts land, GDP 4-dim vs widened DSD) ──"
  ingest ""
fi

echo "════ done — schema at head (V38) with data. Verify: stats.observation > 0 (~2479) ════"
