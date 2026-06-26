#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ingest-canonical-e2e.sh — LIVE-server proof of the canonical-workbook pipeline
# (ADR-0031 §6 Wave 5a). The lead runs THIS against a deployed stack to prove the
# 3 canonical workbooks ingest end-to-end and the serve endpoints return them.
#
# It is the curl-shaped twin of the in-process e2e vitest
# (apps/api/src/ingest/canonical/canonical-ingest.e2e.test.ts): same FSM drive,
# against a real HTTP API instead of app.inject.
#
# FLOW (per dataset, the REAL pipeline — no shortcut writes to gold):
#   POST /api/ingest/canonical  (raw .xlsx bytes, application/octet-stream)
#     → 202 { data: { jobIds: [{kind, jobId}, …] } }
#   for each job IN ORDER (codelists → [displays] → facts):
#     poll GET /api/ingest/jobs/:id  until status='staged'   (worker is async)
#     POST /api/ingest/jobs/:id/publish   (the EXPLICIT approval gate → gold)
#     poll GET /api/ingest/jobs/:id  until status='published'
#   then SERVE:
#     GET /api/cube/:code/profile          → dims + timeCoverage
#     GET /api/stats/observations?dataset= → the published facts (count)
#   and assert the 3 anchor values.
#
# IDEMPOTENT-SAFE to re-run: a second run re-POSTs the SAME bytes; the facts
# payload is already published → the route returns 409 ALREADY_PUBLISHED, which
# this script treats as "already ingested" (it still runs the serve assertions).
#
# ── ENV THE LIVE RUN NEEDS ───────────────────────────────────────────────────
#   API_BASE_URL    the deployed api base, e.g. https://stats.example.org  (or
#                   http://localhost:3001 against a local server). No trailing /.
#   ADMIN_USERNAME  } curator (admin|editor) credentials — exchanged for a JWT at
#   ADMIN_PASSWORD  } POST /api/auth.  ALTERNATIVELY set ADMIN_JWT directly to skip
#                   the login (e.g. a token minted out of band).
#   CANONICAL_DIR   path to the 3 DATA/canonical/*.xlsx (default: ../DATA/canonical
#                   relative to this script — the repo layout).
#
# ── FRESH-DB CAVEAT (flag for the live run) ──────────────────────────────────
#   The 3 datasets + their DSD (stats.dataset_dimension) must EXIST and be
#   status='published' before facts validate/serve (they ship from the V7
#   migration + are published by the lifecycle FSM). On a fully fresh DB run the
#   migrations + `pnpm --filter @statdash/api seed` (or set the datasets published)
#   FIRST — see the vitest harness ensurePreconditions() for the exact rows.
#   Also: the datasets must NOT pre-exist with an INCOMPATIBLE DSD, or the route's
#   compat pre-pass returns 400 DSD_INCOMPATIBLE before any submission. A fresh DB
#   whose DSD matches the workbook STRUCTURE (the V7 shape) passes cleanly.
#
# Deps: bash, curl, jq.   Usage:  API_BASE_URL=… ADMIN_USERNAME=… ADMIN_PASSWORD=… \
#                                 bash work/ingest-canonical-e2e.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

API_BASE_URL="${API_BASE_URL:?set API_BASE_URL (e.g. http://localhost:3001)}"
API_BASE_URL="${API_BASE_URL%/}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CANONICAL_DIR="${CANONICAL_DIR:-$SCRIPT_DIR/../DATA/canonical}"

POLL_INTERVAL=2
POLL_TIMEOUT=120

DATASETS=(GDP_ANNUAL ACCOUNTS_SEQUENCE REGIONAL_GVA)
declare -A EXPECTED_OBS=( [GDP_ANNUAL]=288 [ACCOUNTS_SEQUENCE]=415 [REGIONAL_GVA]=1554 )

command -v jq >/dev/null   || { echo "FATAL: jq is required"; exit 1; }
command -v curl >/dev/null || { echo "FATAL: curl is required"; exit 1; }

# ── Auth — exchange admin credentials for a JWT (unless ADMIN_JWT is preset) ──
if [[ -z "${ADMIN_JWT:-}" ]]; then
  : "${ADMIN_USERNAME:?set ADMIN_USERNAME or ADMIN_JWT}"
  : "${ADMIN_PASSWORD:?set ADMIN_PASSWORD or ADMIN_JWT}"
  echo "→ authenticating as '$ADMIN_USERNAME' at $API_BASE_URL/api/auth"
  ADMIN_JWT="$(curl -fsS -X POST "$API_BASE_URL/api/auth" \
    -H 'content-type: application/json' \
    -d "$(jq -n --arg u "$ADMIN_USERNAME" --arg p "$ADMIN_PASSWORD" '{username:$u,password:$p}')" \
    | jq -r '.data.token')"
  [[ -n "$ADMIN_JWT" && "$ADMIN_JWT" != "null" ]] || { echo "FATAL: login failed"; exit 1; }
  echo "  authenticated."
fi
AUTH=(-H "authorization: Bearer $ADMIN_JWT")

# ── Poll one job's FSM to a target terminal status (fail on rejected/failed) ──
poll_status() {
  local job_id="$1" target="$2" deadline status body
  deadline=$(( $(date +%s) + POLL_TIMEOUT ))
  while :; do
    body="$(curl -fsS "${AUTH[@]}" "$API_BASE_URL/api/ingest/jobs/$job_id")"
    status="$(echo "$body" | jq -r '.data.job.status')"
    [[ "$status" == "$target" ]] && return 0
    [[ "$status" == "published" && "$target" == "staged" ]] && return 0
    if [[ "$status" == "failed" || "$status" == "rejected" ]]; then
      echo "  job $job_id $status — issues:"
      curl -fsS "${AUTH[@]}" "$API_BASE_URL/api/ingest/jobs/$job_id/issues" \
        | jq -r '.data.issues[] | "    [\(.severity)] \(.code) row=\(.rowIndex // "-") \(.detail)"'
      return 1
    fi
    [[ $(date +%s) -ge $deadline ]] && { echo "  job $job_id timed out (last: $status)"; return 1; }
    sleep "$POLL_INTERVAL"
  done
}

# ── Drive one job: wait(staged) → publish → wait(published) ───────────────────
publish_job() {
  local job_id="$1"
  poll_status "$job_id" staged
  curl -fsS -X POST "${AUTH[@]}" "$API_BASE_URL/api/ingest/jobs/$job_id/publish" >/dev/null
  poll_status "$job_id" published
}

# ── Upload one workbook → publish every job it produced (in order) ────────────
ingest_dataset() {
  local code="$1" file="$CANONICAL_DIR/$code.xlsx" http resp
  [[ -f "$file" ]] || { echo "FATAL: missing fixture $file"; exit 1; }
  echo "→ POST /api/ingest/canonical  ($code)"

  # Capture body + status so a 409 (already published) is handled, not fatal.
  resp="$(curl -sS -o /tmp/canon_resp.json -w '%{http_code}' -X POST \
    "${AUTH[@]}" -H 'content-type: application/octet-stream' \
    -H "x-filename: $code.xlsx" --data-binary "@$file" \
    "$API_BASE_URL/api/ingest/canonical")"
  http="$resp"

  if [[ "$http" == "409" ]]; then
    echo "  409 ALREADY_PUBLISHED — '$code' already ingested (idempotent re-run); skipping to serve."
    return 0
  fi
  if [[ "$http" != "202" ]]; then
    echo "FATAL: upload $code → HTTP $http"; cat /tmp/canon_resp.json; echo; exit 1
  fi

  # Publish each job IN ORDER (codelists → [displays] → facts).
  local jobs
  jobs="$(jq -r '.data.jobIds[] | "\(.kind):\(.jobId)"' /tmp/canon_resp.json)"
  echo "  202 jobs: $(echo "$jobs" | tr '\n' ' ')"
  while IFS=: read -r kind job_id; do
    [[ -z "$job_id" ]] && continue
    echo "    publishing $kind ($job_id)…"
    publish_job "$job_id"
  done <<< "$jobs"
  echo "  $code published."
}

# ── Serve assertions: counts, the 3 anchors, timeCoverage ─────────────────────
serve_assert() {
  local code="$1" want="${EXPECTED_OBS[$1]}" count tc_min tc_periods
  echo "→ SERVE  ($code)"

  # cube-profile: dims + timeCoverage (what the geostat front bootstraps from).
  local profile; profile="$(curl -fsS "$API_BASE_URL/api/cube/$code/profile")"
  tc_min="$(echo "$profile" | jq -r '.data.timeCoverage.min')"
  tc_periods="$(echo "$profile" | jq -r '.data.timeCoverage.periods | length')"
  echo "    cube-profile: timeCoverage.min=$tc_min  periods=$tc_periods"

  # observations: the published facts. limit must exceed the largest dataset.
  local obs; obs="$(curl -fsS "$API_BASE_URL/api/stats/observations?dataset=$code&limit=10000")"
  count="$(echo "$obs" | jq -r '.data | length')"
  echo "    observations served: $count  (expected $want)"
  [[ "$count" == "$want" ]] || { echo "    ✗ count mismatch"; FAIL=1; }
}

anchor_assert() {
  echo "→ ANCHORS"
  local v

  # GDP_ANNUAL 2010 GDP-at-current-prices total (geo=GE, approach=_Z) ≈ 22148.65.
  v="$(curl -fsS "$API_BASE_URL/api/stats/observations?dataset=GDP_ANNUAL&from=2010&to=2010&filter=$(jq -rn --arg x '{"measure":"gross-domestic-product-at-current-prices","approach":"_Z","geo":"GE"}' '$x|@uri')" \
    | jq -r '.data[0].obs_value // empty')"
  echo "    GDP_ANNUAL 2010 GDP total = $v  (≈ 22148.65)"
  awk -v v="$v" 'BEGIN{ if (v=="" || (v-22148.65)^2 > 1) exit 1 }' || { echo "    ✗ GDP anchor"; FAIL=1; }

  # REGIONAL_GVA geo=_T, sector=_T, 2010 GVA ≈ 21821.57.
  v="$(curl -fsS "$API_BASE_URL/api/stats/observations?dataset=REGIONAL_GVA&from=2010&to=2010&filter=$(jq -rn --arg x '{"geo":"_T","sector":"_T","measure":"GVA"}' '$x|@uri')" \
    | jq -r '.data[0].obs_value // empty')"
  echo "    REGIONAL_GVA _T/_T 2010 GVA = $v  (≈ 21821.57)"
  awk -v v="$v" 'BEGIN{ if (v=="" || (v-21821.57)^2 > 1) exit 1 }' || { echo "    ✗ REGIONAL anchor"; FAIL=1; }

  # ACCOUNTS_SEQUENCE 2010 allocation-of-primary-income-account present.
  v="$(curl -fsS "$API_BASE_URL/api/stats/observations?dataset=ACCOUNTS_SEQUENCE&from=2010&to=2010&filter=$(jq -rn --arg x '{"account":"allocation-of-primary-income-account"}' '$x|@uri')" \
    | jq -r '.data | length')"
  echo "    ACCOUNTS_SEQUENCE 2010 allocation-of-primary-income rows = $v  (> 0)"
  [[ "${v:-0}" -gt 0 ]] || { echo "    ✗ ACCOUNTS anchor"; FAIL=1; }
}

# ── Main ──────────────────────────────────────────────────────────────────────
FAIL=0
echo "=== canonical ingestion e2e — target $API_BASE_URL ==="
for code in "${DATASETS[@]}"; do ingest_dataset "$code"; done
echo
for code in "${DATASETS[@]}"; do serve_assert "$code"; done
echo
anchor_assert
echo
if [[ "$FAIL" == "0" ]]; then
  echo "=== PASS — all 3 datasets ingested, served, and anchors verified ==="
else
  echo "=== FAIL — see ✗ lines above ==="; exit 1
fi
