#!/bin/bash
# Gradle activeModules + optional findProject integration across boot modules

deploy_resolve_gradle_modules() {
  local interactive="${1:-0}"
  GRADLE_PROPS=""
  [ "$SKIP_BUILD" = "1" ] && return 0

  local active_modules
  active_modules="$(module_resolve_active_gradle_names "$SERVICE")"

  if [ "$interactive" != "1" ]; then
    GRADLE_PROPS="-PactiveModules=$active_modules"
    return 0
  fi

  local s gradle_file opt inc gn
  for s in "${SERVICES[@]}"; do
    [ "$SERVICE" != "all" ] && [ "$SERVICE" != "$s" ] && continue
    is_deployable_service "$s" || continue
    gn="$(module_gradle_name "$s")"
    for gradle_file in \
      "$(module_project_dir "$s")/build.gradle.kts" \
      "$(module_project_dir "$s")/build.gradle" \
      "$PROJECT_DIR/build.gradle.kts" \
      "$PROJECT_DIR/build.gradle"; do
      [ -f "$gradle_file" ] || continue
      while IFS= read -r opt; do
        [ -z "$opt" ] && continue
        read -rp "   Include :$opt in ${gn:-root}? [Y/n]: " inc
        if [[ "$inc" =~ ^[Nn] ]]; then
          active_modules=$(echo "$active_modules" | tr ',' '\n' | grep -vFx "${gn:-root}" | grep -vFx "$opt" | tr '\n' ',' | sed 's/,$//')
          echo "     → skipped"
        else
          active_modules="${active_modules},${opt}"
          active_modules=$(echo "$active_modules" | tr ',' '\n' | sort -u | paste -sd, -)
          echo "     → included"
        fi
      done < <(grep -oE "findProject\(':([^']+)'\)|project\(\":([^\"]+)\"\)" "$gradle_file" 2>/dev/null \
        | grep -oE "':[^']+'|\":[^\"]+\"" | tr -d "'\":")
    done
  done
  GRADLE_PROPS="-PactiveModules=$active_modules"
}
