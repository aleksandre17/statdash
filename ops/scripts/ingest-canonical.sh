#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ingest-canonical.sh — bring-up ingest of the 3 canonical workbooks into the
# running api, the REAL way (through POST /api/ingest/canonical + the publish FSM).
#
# This is the version-controlled, container-mountable form of the proven live
# probe (work/ingest-canonical-e2e.sh). It is what the prod/staging compose `ingest`
# one-shot service runs so a FRESH `compose up` lands the real demo data
# DETERMINISTICALLY — reproducing the manual cutover with no human step.
#
# WHY this exists (fresh-provision reproducibility): the Flyway migrations register
# the cube STRUCTURE (incl. the canonical 4-dim GDP DSD after V34) and the dataset
# lifecycle, but they intentionally do NOT carry the high-volume DEMO DATA — the
# SSOT for that is the canonical workbooks (DATA/canonical/*.xlsx), ingested through
# the pipeline. Without this step a fresh stack has structure but no facts.
#
# FLOW (per dataset — the real pipeline, no shortcut writes to gold):
#   POST /api/ingest/canonical (raw .xlsx bytes) → 202 { jobIds:[{kind,jobId}…] }
#   for each job IN ORDER (codelists → [displays] → facts):
#     poll GET /api/ingest/jobs/:id until status='staged'   (worker is async)
#     POST /api/ingest/jobs/:id/publish   (the EXPLICIT approval gate → gold)
#     poll GET /api/ingest/jobs/:id until status='published'
#   then SERVE-assert counts + the 3 anchor values.
#
# DSD NOTE (post-V34): GDP_ANNUAL's DSD is pre-registered 4-dim
# [measure, approach, time, geo] by migration V34, matching the canonical workbook,
# so the compat pre-pass is ROUTINE — NO `?datasetVersion=` mint is needed. (Before
# V34 a 4-dim GDP ingest hit 400 DSD_INCOMPATIBLE against the 3-dim V5/V7 DSD.)
#
# IDEMPOTENT-SAFE: a re-run re-POSTs the SAME bytes; an already-published facts
# payload returns 409 ALREADY_PUBLISHED, treated as "already ingested" (serve
# assertions still run). So `compose up` twice converges, never duplicates.
#
# ── ENV ──────────────────────────────────────────────────────────────────────
#   API_BASE_URL    the api base reachable from this container, e.g.
#                   http://statdash-api:3001 (service name on statdash-net). No /.
#   ADMIN_USERNAME  } curator (admin|editor) creds — exchanged for a JWT at
#   ADMIN_PASSWORD  } POST /api/auth. (ALTERNATIVELY preset ADMIN_JWT.)
#   CANONICAL_DIR   path to the 3 *.xlsx (default /canonical — the compose mount of
#                   DATA/canonical).
#
# Deps: bash, curl, jq.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

API_BASE_URL="${API_BASE_URL:?set API_BASE_URL (e.g. http://statdash-api:3001)}"
API_BASE_URL="${API_BASE_URL%/}"

CANONICAL_DIR="${CANONICAL_DIR:-/canonical}"

POLL_INTERVAL=2
POLL_TIMEOUT=180

DATASETS=(GDP_ANNUAL ACCOUNTS_SEQUENCE REGIONAL_GVA)
declare -A EXPECTED_OBS=( [GDP_ANNUAL]=399 [ACCOUNTS_SEQUENCE]=415 [REGIONAL_GVA]=1665 )

command -v jq >/dev/null   || { echo "FATAL: jq is required"; exit 1; }
command -v curl >/dev/null || { echo "FATAL: curl is required"; exit 1; }

# ── Wait for the api to answer /health (the compose depends_on covers boot order,
#    but this makes the script safe to run standalone too) ──────────────────────
echo "→ waiting for api at $API_BASE_URL/health"
deadline=$(( $(date +%s) + POLL_TIMEOUT ))
until curl -fsS "$API_BASE_URL/health" >/dev/null 2>&1; do
  [[ $(date +%s) -ge $deadline ]] && { echo "FATAL: api never became healthy"; exit 1; }
  sleep "$POLL_INTERVAL"
done
echo "  api healthy."

# ── Auth — exchange admin credentials for a JWT (unless ADMIN_JWT is preset) ──
if [[ -z "${ADMIN_JWT:-}" ]]; then
  : "${ADMIN_USERNAME:?set ADMIN_USERNAME or ADMIN_JWT}"
  : "${ADMIN_PASSWORD:?set ADMIN_PASSWORD or ADMIN_JWT}"
  echo "→ authenticating as '$ADMIN_USERNAME'"
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
  local code="$1" file="$CANONICAL_DIR/$code.xlsx" http
  [[ -f "$file" ]] || { echo "FATAL: missing workbook $file"; exit 1; }
  echo "→ POST /api/ingest/canonical  ($code)"

  http="$(curl -sS -o /tmp/canon_resp.json -w '%{http_code}' -X POST \
    "${AUTH[@]}" -H 'content-type: application/octet-stream' \
    -H "x-filename: $code.xlsx" --data-binary "@$file" \
    "$API_BASE_URL/api/ingest/canonical")"

  if [[ "$http" == "409" ]]; then
    echo "  409 ALREADY_PUBLISHED — '$code' already ingested (idempotent re-run); skip to serve."
    return 0
  fi
  if [[ "$http" != "202" ]]; then
    echo "FATAL: upload $code → HTTP $http"; cat /tmp/canon_resp.json; echo; exit 1
  fi

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

# ── Serve assertions: counts + the 3 anchors ──────────────────────────────────
serve_assert() {
  local code="$1" want="${EXPECTED_OBS[$1]}" count
  local obs; obs="$(curl -fsS "$API_BASE_URL/api/stats/observations?dataset=$code&limit=10000")"
  count="$(echo "$obs" | jq -r '.data | length')"
  echo "    $code observations served: $count  (expected $want)"
  [[ "$count" == "$want" ]] || { echo "    ✗ $code count mismatch"; FAIL=1; }
}

anchor_assert() {
  echo "→ ANCHORS"
  local v
  # GDP_ANNUAL 2010 GDP-at-current-prices total (geo=GE, approach=_Z) ≈ 22148.65 —
  # this only resolves if GDP is 4-dim (approach present), i.e. V34 + canonical ingest worked.
  v="$(curl -fsS "$API_BASE_URL/api/stats/observations?dataset=GDP_ANNUAL&from=2010&to=2010&filter=$(jq -rn --arg x '{"measure":"gross-domestic-product-at-current-prices","approach":"_Z","geo":"GE"}' '$x|@uri')" \
    | jq -r '.data[0].obs_value // empty')"
  echo "    GDP_ANNUAL 2010 GDP total = $v  (≈ 22148.65, 4-dim)"
  awk -v v="$v" 'BEGIN{ if (v=="" || (v-22148.65)^2 > 1) exit 1 }' || { echo "    ✗ GDP 4-dim anchor"; FAIL=1; }

  v="$(curl -fsS "$API_BASE_URL/api/stats/observations?dataset=REGIONAL_GVA&from=2010&to=2010&filter=$(jq -rn --arg x '{"geo":"_T","sector":"_T","measure":"GVA"}' '$x|@uri')" \
    | jq -r '.data[0].obs_value // empty')"
  echo "    REGIONAL_GVA _T/_T 2010 GVA = $v  (≈ 22148.65, post-2026-07-03 revision)"
  awk -v v="$v" 'BEGIN{ if (v=="" || (v-22148.65)^2 > 1) exit 1 }' || { echo "    ✗ REGIONAL anchor"; FAIL=1; }

  v="$(curl -fsS "$API_BASE_URL/api/stats/observations?dataset=ACCOUNTS_SEQUENCE&from=2010&to=2010&filter=$(jq -rn --arg x '{"account":"allocation-of-primary-income-account"}' '$x|@uri')" \
    | jq -r '.data | length')"
  echo "    ACCOUNTS_SEQUENCE 2010 allocation-of-primary-income rows = $v  (> 0)"
  [[ "${v:-0}" -gt 0 ]] || { echo "    ✗ ACCOUNTS anchor"; FAIL=1; }
}

# ── Main ──────────────────────────────────────────────────────────────────────
FAIL=0
echo "=== canonical bring-up ingest — target $API_BASE_URL ==="
for code in "${DATASETS[@]}"; do ingest_dataset "$code"; done
echo
for code in "${DATASETS[@]}"; do serve_assert "$code"; done
echo
anchor_assert
echo
if [[ "$FAIL" == "0" ]]; then
  echo "=== OK — 3 datasets ingested, served, anchors verified (4-dim GDP) ==="
else
  echo "=== FAIL — see ✗ lines above ==="; exit 1
fi
