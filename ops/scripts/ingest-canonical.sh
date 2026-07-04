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
#   POST /api/ingest/canonical (raw .xlsx bytes) → 202 { jobIds:[{kind,jobId,status}…] }
#   for each job IN ORDER (codelists → [displays] → facts):
#     the route already drove REFERENCE data (codelists/displays) to gold in-process,
#     so those jobs come back status='published'; only FACTS come back 'staged'. We
#     publish ONLY the jobs still 'staged' (the curator-approval gate → gold), then
#     poll GET /api/ingest/jobs/:id until status='published'.
#   then SERVE-assert counts + the 3 anchor values.
#
# DSD NOTE (post-V34): GDP_ANNUAL's DSD is pre-registered 4-dim
# [measure, approach, time, geo] by migration V34, matching the canonical workbook,
# so the compat pre-pass is ROUTINE — NO `?datasetVersion=` mint is needed. (Before
# V34 a 4-dim GDP ingest hit 400 DSD_INCOMPATIBLE against the 3-dim V5/V7 DSD.)
#
# IDEMPOTENT-SAFE (two convergence points, both treated as SUCCESS — never a false abort):
#   1. UPLOAD step: a re-run re-POSTs the SAME bytes; an already-published facts payload
#      returns 409 ALREADY_PUBLISHED, treated as "already ingested" (serve assertions
#      still run).
#   2. PUBLISH step: a job whose target state ('published') is already reached is a
#      CONVERGED NO-OP, not a conflict. The route publishes reference data itself and
#      returns it status='published'; publishing it again would 409. We (a) skip any job
#      the response already reports 'published' (the contract is the SSOT), and (b) if a
#      publish nonetheless returns 409, we re-read the AUTHORITATIVE FSM status and treat
#      "409 but the job IS now published" as idempotent SUCCESS — while a genuine conflict
#      (still 'staged' with error issues, or 'rejected'/'failed') still fails fast.
#   So `compose up` twice converges, never duplicates, and never aborts on a no-op.
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
#
# TESTABILITY: the pure decision (classify_publish_result) + the function defs are
# defined at top level; the network work (health-wait, auth, ingest/serve/anchor) runs
# only via main(), guarded by the BASH_SOURCE==$0 check at the foot. So a test can
# `source` this file and unit-test classify_publish_result with no api/network — see
# ops/scripts/ingest-canonical.test.sh.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

CANONICAL_DIR="${CANONICAL_DIR:-/canonical}"

POLL_INTERVAL=2
POLL_TIMEOUT=180

DATASETS=(GDP_ANNUAL ACCOUNTS_SEQUENCE REGIONAL_GVA)
declare -A EXPECTED_OBS=( [GDP_ANNUAL]=399 [ACCOUNTS_SEQUENCE]=415 [REGIONAL_GVA]=1665 )

# ── job_status <job_id> — echo one job's current FSM status (the gold/silver SSOT) ──
# One authoritative GET, used to CLASSIFY a publish outcome (converged vs conflict).
job_status() {
  curl -fsS "${AUTH[@]}" "$API_BASE_URL/api/ingest/jobs/$1" | jq -r '.data.job.status'
}

# ── classify_publish_result <http_code> <job_status_after> → outcome (PURE) ──────
#
# Given the POST /jobs/:id/publish HTTP status AND the job's authoritative status read
# back AFTER the attempt, decide the outcome. This is the idempotent-publish rule, kept
# side-effect-free so it is unit-testable in isolation (no api, no network):
#
#   ok         2xx — the publish transitioned the job; the caller confirms 'published'.
#   converged  409 AND the job IS 'published' — the target state is ALREADY reached: a
#              no-op (reference data the route drove to gold, or a re-run that already
#              converged). This is idempotent SUCCESS, NOT a conflict.
#   conflict   any other non-2xx — a GENUINE failure we must propagate (fail-fast):
#              a 409 while still 'staged' (error-severity issues → cannot publish),
#              'rejected'/'failed', or any unexpected status/code. We do NOT blindly
#              swallow all 409s — only the one that provably converged to 'published'.
#
# The distinguisher is the resulting FSM STATE, not the English detail string — robust
# to message-wording changes (Postel / least astonishment). The publish endpoint emits
# 409 for BOTH the converged case (wrong state = already 'published') and genuine ones
# (error issues, rejected/failed); re-reading the state is what separates them.
classify_publish_result() {
  local http="$1" status_after="$2"
  if [[ "$http" =~ ^2[0-9][0-9]$ ]]; then echo "ok"; return 0; fi
  if [[ "$http" == "409" && "$status_after" == "published" ]]; then echo "converged"; return 0; fi
  echo "conflict"
}

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

# ── Drive one job to gold: skip-if-published → wait(staged) → publish → wait(published) ─
# $2 is the job's status AS REPORTED by the 202 upload response (the contract SSOT).
publish_job() {
  local job_id="$1" reported="${2:-}" http status_after outcome
  # (a) PRIMARY — the 202 response already tells us each job's status. The canonical
  # route drives REFERENCE data (codelists/displays) to gold in-process and returns them
  # status='published'; only FACTS come back 'staged'. A job already 'published' is at its
  # target: skip the (doomed, 409-ing) publish entirely. No wasted request, no false abort.
  if [[ "$reported" == "published" ]]; then
    echo "      already published by the route (reference/converged) — skip publish."
    return 0
  fi
  poll_status "$job_id" staged
  # Capture the code WITHOUT -f so a non-2xx (409) does not abort under set -e; we then
  # classify it ourselves. -sS keeps curl quiet but still shows transport errors.
  http="$(curl -sS -o /tmp/publish_resp.json -w '%{http_code}' -X POST \
    "${AUTH[@]}" "$API_BASE_URL/api/ingest/jobs/$job_id/publish")"
  # (b) DEFENSIVE — re-read the AUTHORITATIVE status and classify. Handles a race (the job
  # converged to 'published' between the 202 and our publish) or any re-run edge the
  # reported-status skip missed.
  status_after="$(job_status "$job_id")"
  outcome="$(classify_publish_result "$http" "$status_after")"
  case "$outcome" in
    ok)
      poll_status "$job_id" published
      ;;
    converged)
      echo "      publish → HTTP $http but job is 'published' — converged no-op (idempotent), treated as SUCCESS."
      return 0
      ;;
    conflict)
      echo "FATAL: publish $job_id → HTTP $http, job status '$status_after' (genuine conflict, not converged):"
      cat /tmp/publish_resp.json; echo
      return 1
      ;;
  esac
}

# ── Upload one workbook → publish every STAGED job it produced (in order) ──────
ingest_dataset() {
  local code="$1" http
  local file="$CANONICAL_DIR/$code.xlsx"
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

  # Thread each job's REPORTED status (kind:jobId:status) so publish_job can skip the
  # ones the route already drove to gold (reference data), publishing only 'staged' facts.
  local jobs
  jobs="$(jq -r '.data.jobIds[] | "\(.kind):\(.jobId):\(.status)"' /tmp/canon_resp.json)"
  echo "  202 jobs: $(echo "$jobs" | tr '\n' ' ')"
  while IFS=: read -r kind job_id status; do
    [[ -z "$job_id" ]] && continue
    echo "    $kind ($job_id) reported status=$status"
    publish_job "$job_id" "$status"
  done <<< "$jobs"
  echo "  $code done."
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
# Guarded (see TESTABILITY note): runs only when the script is EXECUTED, not sourced.
# All env resolution + network work lives here so `source`-ing the file for tests has
# no side effects (it just registers the pure helpers).
main() {
  API_BASE_URL="${API_BASE_URL:?set API_BASE_URL (e.g. http://statdash-api:3001)}"
  API_BASE_URL="${API_BASE_URL%/}"

  command -v jq >/dev/null   || { echo "FATAL: jq is required"; exit 1; }
  command -v curl >/dev/null || { echo "FATAL: curl is required"; exit 1; }

  # Wait for the api to answer /health (compose depends_on covers boot order, but this
  # makes the script safe to run standalone too).
  echo "→ waiting for api at $API_BASE_URL/health"
  local deadline
  deadline=$(( $(date +%s) + POLL_TIMEOUT ))
  until curl -fsS "$API_BASE_URL/health" >/dev/null 2>&1; do
    [[ $(date +%s) -ge $deadline ]] && { echo "FATAL: api never became healthy"; exit 1; }
    sleep "$POLL_INTERVAL"
  done
  echo "  api healthy."

  # Auth — exchange admin credentials for a JWT (unless ADMIN_JWT is preset).
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
}

# Execute main only when run directly; a test that `source`s this file skips it.
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
