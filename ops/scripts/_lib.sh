#!/usr/bin/env bash
# Shared helpers for ops/scripts/*.sh
#
# Source from sibling scripts:
#   SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
#   . "$SCRIPT_DIR/_lib.sh"
#
# Provides:
#   ROOT          — absolute repo root
#   ts            — wallclock timestamp
#   color helpers — info, ok, warn, err
#   wait_http     — poll HTTP endpoint until 2xx or timeout
#   retry         — retry a command N times with backoff
#   discover_corpora — list corpus codes from ops/config/corpus/*-policy.yaml
#   discover_services — list service module names from apps/*/build.gradle.kts
#   require       — fail with message if a command is missing
#
# Conventions: POSIX-safe bash 4+, set -euo pipefail expected at caller site.

# Detect repo root from this file's own location (script can be sourced from any CWD).
_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$_LIB_DIR/../.." && pwd)"

# Colors — disabled when stdout is not a tty (so logs stay clean).
if [[ -t 1 ]] && [[ -z "${NO_COLOR:-}" ]]; then
  _C_RESET=$'\033[0m'
  _C_RED=$'\033[31m'
  _C_GREEN=$'\033[32m'
  _C_YELLOW=$'\033[33m'
  _C_BLUE=$'\033[34m'
  _C_DIM=$'\033[2m'
else
  _C_RESET=''; _C_RED=''; _C_GREEN=''; _C_YELLOW=''; _C_BLUE=''; _C_DIM=''
fi

ts() { date +'%H:%M:%S'; }

info() { printf '%s[%s]%s %s\n' "$_C_BLUE" "$(ts)" "$_C_RESET" "$*"; }
ok()   { printf '%s[%s] OK%s    %s\n' "$_C_GREEN" "$(ts)" "$_C_RESET" "$*"; }
warn() { printf '%s[%s] WARN%s  %s\n' "$_C_YELLOW" "$(ts)" "$_C_RESET" "$*" >&2; }
err()  { printf '%s[%s] ERR%s   %s\n' "$_C_RED" "$(ts)" "$_C_RESET" "$*" >&2; }
dim()  { printf '%s%s%s\n' "$_C_DIM" "$*" "$_C_RESET"; }

# require <cmd> — exit 127 if missing.
require() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    err "required command not found: $cmd"
    exit 127
  fi
}

# wait_http <url> <max_seconds> [interval_seconds] [expected_grep_pattern]
# Polls until curl returns HTTP 2xx (and optional pattern matches body).
# Returns 0 on success, 1 on timeout. Caller decides what to do.
wait_http() {
  local url="$1"
  local max="${2:-120}"
  local interval="${3:-2}"
  local pattern="${4:-}"
  local elapsed=0
  local body status

  while (( elapsed < max )); do
    # -s silent, -o body, -w just the status code, --max-time keeps each probe bounded.
    body=$(curl -s -o /tmp/_lib_body.$$ -w '%{http_code}' --max-time "$interval" "$url" 2>/dev/null || echo "000")
    status="$body"
    if [[ "$status" =~ ^2[0-9][0-9]$ ]]; then
      if [[ -z "$pattern" ]] || grep -q "$pattern" /tmp/_lib_body.$$ 2>/dev/null; then
        rm -f /tmp/_lib_body.$$
        return 0
      fi
    fi
    sleep "$interval"
    elapsed=$(( elapsed + interval ))
  done
  rm -f /tmp/_lib_body.$$
  return 1
}

# retry <attempts> <delay_seconds> <cmd...>
# Re-runs cmd until exit 0 or attempts exhausted. Returns last exit code.
retry() {
  local attempts="$1"; shift
  local delay="$1"; shift
  local i=1
  local rc=0
  while (( i <= attempts )); do
    if "$@"; then
      return 0
    fi
    rc=$?
    if (( i < attempts )); then
      dim "  retry $i/$attempts failed (rc=$rc), sleeping ${delay}s..."
      sleep "$delay"
    fi
    i=$(( i + 1 ))
  done
  return $rc
}

# discover_corpora — emits one corpus code per line, derived from ops/config/corpus/*-policy.yaml.
# The policy file is the canonical existence marker (every corpus must have one).
discover_corpora() {
  local dir="$ROOT/ops/config/corpus"
  if [[ ! -d "$dir" ]]; then
    return 0
  fi
  local f code
  for f in "$dir"/*-policy.yaml; do
    [[ -e "$f" ]] || continue   # no-glob safety
    code="$(basename "$f" -policy.yaml)"
    printf '%s\n' "$code"
  done
}

# discover_services — emits one service module name per line, from apps/*/build.gradle.kts.
# Frontend has no build.gradle.kts so it is correctly excluded.
discover_services() {
  local apps_dir="$ROOT/apps"
  local d name
  for d in "$apps_dir"/*/; do
    [[ -d "$d" ]] || continue
    if [[ -f "$d/build.gradle.kts" ]]; then
      name="$(basename "$d")"
      printf '%s\n' "$name"
    fi
  done
}

# gradlew_for <service> — emits absolute path to the gradlew wrapper for a service.
gradlew_for() {
  local svc="$1"
  if [[ -x "$ROOT/apps/$svc/gradlew" ]]; then
    printf '%s/apps/%s/gradlew' "$ROOT" "$svc"
  else
    err "no gradlew wrapper at apps/$svc/gradlew"
    return 1
  fi
}
