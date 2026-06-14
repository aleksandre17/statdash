#!/usr/bin/env bash
# Usage: ./test-lib.sh <lib-name>
# Example: ./test-lib.sh platform-async
#
# Runs tests for one lib via the ingestion-service composite build.
# Returns only the summary — no gradle noise.

set -euo pipefail

LIB="${1:-}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RUNNER="$ROOT/apps/ingestion-service"

if [[ -z "$LIB" ]]; then
  echo "Usage: test-lib.sh <lib-name>"
  echo "Available libs:"
  ls "$ROOT/libs/"
  exit 1
fi

if [[ ! -d "$ROOT/libs/$LIB" ]]; then
  echo "ERROR: libs/$LIB does not exist"
  exit 1
fi

echo "▶ Testing :$LIB ..."
cd "$RUNNER"

OUTPUT=$(./gradlew ":$LIB:test" --console=plain 2>&1)
EXIT_CODE=$?

# Extract summary lines
SUMMARY=$(echo "$OUTPUT" | grep -E "(tests|BUILD|FAILED|passed|skipped|errors)" | tail -10)

if [[ $EXIT_CODE -eq 0 ]]; then
  echo "✅ BUILD SUCCESSFUL"
else
  echo "❌ BUILD FAILED"
fi

echo "$SUMMARY"

# Print test counts from XML if available
XML_DIR="$ROOT/libs/$LIB/build/test-results/test"
if [[ -d "$XML_DIR" ]]; then
  TOTAL=$(grep -h 'tests=' "$XML_DIR"/TEST-*.xml 2>/dev/null \
    | grep -oE 'tests="[0-9]+"' | grep -oE '[0-9]+' | awk '{s+=$1} END {print s}')
  FAILURES=$(grep -h 'failures=' "$XML_DIR"/TEST-*.xml 2>/dev/null \
    | grep -oE 'failures="[0-9]+"' | grep -oE '[0-9]+' | awk '{s+=$1} END {print s}')
  ERRORS=$(grep -h 'errors=' "$XML_DIR"/TEST-*.xml 2>/dev/null \
    | grep -oE 'errors="[0-9]+"' | grep -oE '[0-9]+' | awk '{s+=$1} END {print s}')
  echo "📊 Tests: ${TOTAL:-0} | Failures: ${FAILURES:-0} | Errors: ${ERRORS:-0}"
fi

exit $EXIT_CODE