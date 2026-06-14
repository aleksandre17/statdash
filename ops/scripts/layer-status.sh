#!/usr/bin/env bash
# Shows completion status of all layers from IMPLEMENTATION-ROADMAP.md
# Usage: ./layer-status.sh [phase]
# Example: ./layer-status.sh 0   → shows only Phase 0 layers
#          ./layer-status.sh 1   → shows only Phase 1 layers
#          ./layer-status.sh     → shows all layers

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PLAN_DIR="$ROOT/docs/plan"
FILTER="${1:-}"

echo "═══════════════════════════════════════"
echo " statdash-platform Layer Status"
[[ -n "$FILTER" ]] && echo " Phase filter: $FILTER"
echo "═══════════════════════════════════════"

# Scan all roadmap files (index + phase files)
ROADMAP_FILES=("$PLAN_DIR/IMPLEMENTATION-ROADMAP.md" "$PLAN_DIR"/roadmap-phase-*.md)

# Pre-scan: find which phases are marked COMPLETE at the phase level
declare -A PHASE_DONE
for f in "${ROADMAP_FILES[@]}"; do
  [[ -f "$f" ]] || continue
  while IFS= read -r line; do
    if [[ "$line" =~ ✅.*Phase\ ([0-9]+)\ COMPLETE ]]; then
      PHASE_DONE["${BASH_REMATCH[1]}"]=1
    fi
    # Also catch "✅ Phase 1 COMPLETE" in file headers
    if [[ "$line" =~ ✅.*Phase\ ([0-9]+)\ COMPLETE ]]; then
      PHASE_DONE["${BASH_REMATCH[1]}"]=1
    fi
  done < "$f"
done

TOTAL=0
DONE=0

for ROADMAP in "${ROADMAP_FILES[@]}"; do
  [[ -f "$ROADMAP" ]] || continue
  while IFS= read -r line; do
    # Match layer headers: "### Layer X.Y — title"
    if [[ "$line" =~ ^###\ Layer\ ([0-9]+\.[0-9]+)[[:space:]][-—] ]]; then
      layer_num="${BASH_REMATCH[1]}"
      phase="${layer_num%%.*}"

      # Phase filter
      if [[ -n "$FILTER" && "$phase" != "$FILTER" ]]; then
        continue
      fi

      # Extract title (after the dash/em-dash), strip ✅ suffix and [Nx] refs
      title=$(echo "$line" | sed 's/^### Layer [0-9.]*[[:space:]]*[-—][[:space:]]*//' | sed 's/`\[N[0-9]*\]`//' | sed 's/✅//' | xargs | cut -c1-52)

      TOTAL=$((TOTAL + 1))

      # Determine status:
      # 1. Phase-level COMPLETE banner → all layers in that phase are done
      # 2. ✅ on the layer header line itself
      # 3. ✅ blockquote within 5 lines after the header
      if [[ -n "${PHASE_DONE[$phase]:-}" ]] || echo "$line" | grep -q "✅"; then
        status="✅ DONE"
        DONE=$((DONE + 1))
      else
        # Look for ✅ within 5 lines after the header in this file
        context=$(grep -A5 "^### Layer $layer_num[[:space:]]" "$ROADMAP" 2>/dev/null | head -6)
        if echo "$context" | grep -q "✅"; then
          status="✅ DONE"
          DONE=$((DONE + 1))
        elif echo "$context" | grep -qE "🚧|IN PROGRESS|WIP"; then
          status="🚧 IN PROGRESS"
        else
          status="⬜ pending"
        fi
      fi

      printf "  %-8s  %-20s  %s\n" "$layer_num" "$status" "$title"
    fi
  done < "$ROADMAP"
done

echo "═══════════════════════════════════════"
echo " Done: $DONE / $TOTAL layers"
echo "═══════════════════════════════════════"
