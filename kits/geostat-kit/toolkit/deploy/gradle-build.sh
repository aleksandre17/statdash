#!/bin/bash
# Step 1: Gradle build (requires SERVICES, SERVICE, SKIP_BUILD, PROJECT_DIR, GRADLE_PROPS)

deploy_resolve_gradlew() {
  if [[ -f "$PROJECT_DIR/gradle/wrapper/gradle-wrapper.jar" && -x "$PROJECT_DIR/gradlew" ]]; then
    echo "$PROJECT_DIR/gradlew"
    return 0
  fi
  local shared="$MONOREPO/apps/backend/gradlew"
  if [[ -x "$shared" ]]; then
    echo "$shared"
    return 0
  fi
  echo "$PROJECT_DIR/gradlew"
}

deploy_step_build() {
  if [ "$SKIP_BUILD" = "1" ]; then
    deploy_log "  [1/5] Build skipped"
    return 0
  fi
  deploy_log "  [1/5] Building..."
  local s task prefix local_build_log gradlew
  gradlew="$(deploy_resolve_gradlew)"
  for s in "${SERVICES[@]}"; do
    [ "$SERVICE" != "all" ] && [ "$SERVICE" != "$s" ] && continue
    is_deployable_service "$s" || continue
    task="$(module_gradle_boot_task "$s")"
    prefix="${OPS_BUILD_TMP_PREFIX:-ops-build}"
    local_build_log="/tmp/${prefix}-$s.log"
    { echo "=== Build [$s] task=$task gradlew=$gradlew $(date) ==="; } >"$local_build_log"
    # shellcheck disable=SC2086
    (cd "$PROJECT_DIR" && "$gradlew" "$task" -x test --no-daemon $GRADLE_PROPS) 2>&1 | tee -a "$local_build_log"
    if [ "${PIPESTATUS[0]}" -ne 0 ]; then
      deploy_log "  [FAIL] Build failed: $s ($task)"
      return 1
    fi
    deploy_log "  [OK]   Build: $s ($task)"
  done
}
