#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ingest-canonical.test.sh — focused unit test for the idempotent-publish rule in
# ingest-canonical.sh. Proves a CONVERGED-409 (the publish target state is already
# reached) is treated as SUCCESS, while a GENUINE conflict still fails fast.
#
# No api, no network: we `source` the driver (its main() is guarded, so sourcing only
# registers the pure helpers) and drive classify_publish_result directly, plus exercise
# publish_job's two convergence paths with stubbed collaborators.
#
# Run:  bash ops/scripts/ingest-canonical.test.sh
# Deps: bash. (Does NOT need curl/jq — the network functions are stubbed.)
# ─────────────────────────────────────────────────────────────────────────────
# Static analysis cannot resolve the runtime `source` or see that the stub functions /
# vars below are consumed indirectly by the sourced publish_job. Suppress those:
#   SC1091 — the sourced driver is resolved at runtime, not on disk from here.
#   SC2034 — API_BASE_URL / AUTH are read by the sourced publish_job (set -u expansions).
#   SC2329 — the stub curl/poll_status/job_status are invoked indirectly by publish_job.
# shellcheck disable=SC1091,SC2034,SC2329
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./ingest-canonical.sh
source "$SCRIPT_DIR/ingest-canonical.sh"
# Sourcing runs the driver's `set -euo pipefail`; this test drives return codes
# manually, so disable errexit (we assert on rc explicitly, never abort on it).
set +e

# Satisfy the set -u expansions inside publish_job (curl is stubbed, so the values
# are never actually used against a network).
API_BASE_URL="http://stub"
AUTH=(-H "authorization: Bearer test")

TESTS=0
FAILED=0

# assert_eq <label> <expected> <actual>
assert_eq() {
  local label="$1" expected="$2" actual="$3"
  TESTS=$(( TESTS + 1 ))
  if [[ "$actual" == "$expected" ]]; then
    echo "  ok   — $label"
  else
    echo "  FAIL — $label: expected '$expected', got '$actual'"
    FAILED=$(( FAILED + 1 ))
  fi
}

# assert_rc <label> <expected_rc> <actual_rc>
assert_rc() {
  local label="$1" expected="$2" actual="$3"
  TESTS=$(( TESTS + 1 ))
  if [[ "$actual" == "$expected" ]]; then
    echo "  ok   — $label"
  else
    echo "  FAIL — $label: expected rc=$expected, got rc=$actual"
    FAILED=$(( FAILED + 1 ))
  fi
}

echo "── classify_publish_result (the pure idempotent-publish decision) ──"
# 2xx → ok (a normal publish transition).
assert_eq "202 + published → ok"          "ok"        "$(classify_publish_result 202 published)"
assert_eq "200 + staged    → ok"          "ok"        "$(classify_publish_result 200 staged)"
# THE converged-409: 409 but the job IS published → idempotent SUCCESS (not a conflict).
assert_eq "409 + published → converged"   "converged" "$(classify_publish_result 409 published)"
# Genuine conflicts: a 409 that did NOT converge to 'published' must stay a conflict.
assert_eq "409 + staged    → conflict"    "conflict"  "$(classify_publish_result 409 staged)"    # error-severity issues
assert_eq "409 + rejected  → conflict"    "conflict"  "$(classify_publish_result 409 rejected)"
assert_eq "409 + failed    → conflict"    "conflict"  "$(classify_publish_result 409 failed)"
# A non-409 failure is NEVER 'converged', even if the job later reads 'published'.
assert_eq "500 + published → conflict"    "conflict"  "$(classify_publish_result 500 published)"
assert_eq "404 + <empty>   → conflict"    "conflict"  "$(classify_publish_result 404 '')"

echo "── publish_job convergence paths (collaborators stubbed) ──"

# (a) PRIMARY skip: a job the 202 response already reports 'published' must return SUCCESS
# without issuing any publish. Poison the network collaborators so ANY call marks the test.
poll_status()  { echo "UNEXPECTED poll_status call"; return 99; }
job_status()   { echo "UNEXPECTED job_status call"; return 99; }
curl()         { echo "UNEXPECTED curl call"; return 99; }
out="$(publish_job job-ref published 2>&1)"; rc=$?
assert_rc "reported=published → skip, success" 0 "$rc"
assert_eq "reported=published → no publish issued" "0" "$(echo "$out" | grep -c UNEXPECTED)"

# (b) DEFENSIVE converged-409: a job reported 'staged' that races to 'published'. The publish
# POST returns 409, but the authoritative re-read says 'published' → idempotent SUCCESS.
poll_status() { return 0; }                                   # reaches 'staged'
curl()        { echo "409"; }                                 # publish POST → 409 (the %{http_code})
job_status()  { echo "published"; }                           # authoritative re-read: converged
publish_job job-race staged >/dev/null 2>&1; rc=$?
assert_rc "409 but job published → converged success" 0 "$rc"

# (c) GENUINE conflict: publish POST returns 409 and the job is still 'staged' (error issues)
# → publish_job must FAIL (non-zero), propagating the real conflict.
poll_status() { return 0; }
curl()        { echo "409"; }
job_status()  { echo "staged"; }
publish_job job-bad staged >/dev/null 2>&1; rc=$?
assert_rc "409 and job still staged → genuine conflict (fail)" 1 "$rc"

echo "────────────────────────────────────────────"
echo "Tests: $TESTS, Failed: $FAILED"
if [[ "$FAILED" -eq 0 ]]; then
  echo "RESULT: PASS"
  exit 0
else
  echo "RESULT: FAIL — $FAILED failed"
  exit 1
fi
