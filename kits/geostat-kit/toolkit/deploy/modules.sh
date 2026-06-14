#!/bin/bash
# Multi-module registry — parse backend/ops.modules (or frontend/ops.modules)
# Requires: PROJECT_DIR, MONOREPO (from _init.sh)

OPS_MODULES_FILE="${OPS_MODULES_FILE:-$PROJECT_DIR/ops.modules}"

module_load_registry() {
  MODULE_COMPOSE=()
  MODULE_GRADLE=()
  MODULE_TYPE=()
  MODULE_DOCKERFILE=()
  MODULE_ENABLED=()
  MODULE_LIB_GRADLE=()

  [[ -f "$OPS_MODULES_FILE" ]] || return 0

  local line compose gradle mtype dockerfile enabled
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%%#*}"
    line="$(echo "$line" | tr -d '\r' | xargs 2>/dev/null || true)"
    [[ -z "$line" ]] && continue
    IFS='|' read -r compose gradle mtype dockerfile enabled <<<"$line"
    enabled="${enabled:-yes}"
    [[ "${enabled,,}" == "no" || "${enabled,,}" == "false" ]] && continue
    if [[ -z "$compose" && "$mtype" == "library" ]]; then
      MODULE_LIB_GRADLE+=("$gradle")
      continue
    fi
    [[ -z "$compose" ]] && continue
    MODULE_COMPOSE+=("$compose")
    MODULE_GRADLE+=("$gradle")
    MODULE_TYPE+=("$mtype")
    MODULE_DOCKERFILE+=("$dockerfile")
    MODULE_ENABLED+=("yes")
  done <"$OPS_MODULES_FILE"
}

module_index_for_compose() {
  local s="$1" i
  for i in "${!MODULE_COMPOSE[@]}"; do
    [[ "${MODULE_COMPOSE[$i]}" == "$s" ]] && echo "$i" && return 0
  done
  return 1
}

# Gradle subproject name (empty = root)
module_gradle_name() {
  local s="$1" i gn
  if i=$(module_index_for_compose "$s" 2>/dev/null); then
    gn="${MODULE_GRADLE[$i]}"
    echo "$gn"
    return 0
  fi
  if is_subproject_dir "$s"; then
    echo "$s"
    return 0
  fi
  echo ""
}

is_subproject_dir() {
  local d="$1"
  [[ -f "$PROJECT_DIR/$d/build.gradle.kts" || -f "$PROJECT_DIR/$d/build.gradle" ]]
}

module_type_for() {
  local s="$1" i
  if i=$(module_index_for_compose "$s" 2>/dev/null); then
    echo "${MODULE_TYPE[$i]}"
    return 0
  fi
  if is_subproject_dir "$s"; then
    echo "boot"
    return 0
  fi
  echo "boot"
}

is_deployable_service() {
  local s="$1"
  [[ "$(module_type_for "$s")" == "boot" ]]
}

module_project_dir() {
  local s="$1" gn
  gn="$(module_gradle_name "$s")"
  if [[ -n "$gn" ]]; then
    echo "$PROJECT_DIR/$gn"
  else
    echo "$PROJECT_DIR"
  fi
}

module_dockerfile() {
  local s="$1" i df gn
  if i=$(module_index_for_compose "$s" 2>/dev/null); then
    df="${MODULE_DOCKERFILE[$i]}"
    if [[ -n "$df" ]]; then
      gn="$(module_gradle_name "$s")"
      if [[ -n "$gn" ]]; then
        echo "$PROJECT_DIR/$gn/$df"
      else
        echo "$PROJECT_DIR/$df"
      fi
      return 0
    fi
  fi
  if is_subproject_dir "$s" && [[ -f "$PROJECT_DIR/$s/Dockerfile" ]]; then
    echo "$PROJECT_DIR/$s/Dockerfile"
    return 0
  fi
  if [[ -f "$PROJECT_DIR/Dockerfile" ]]; then
    echo "$PROJECT_DIR/Dockerfile"
    return 0
  fi
  echo "$PROJECT_DIR/src/Dockerfile"
}

module_jar_libs_dir() {
  local s="$1"
  echo "$(module_project_dir "$s")/build/libs"
}

module_jar_dest() {
  local s="$1"
  echo "$(module_project_dir "$s")/app.jar"
}

module_gradle_boot_task() {
  local s="$1" gn
  gn="$(module_gradle_name "$s")"
  if [[ -n "$gn" ]]; then
    echo ":$gn:bootJar"
  else
    echo "bootJar"
  fi
}

module_list_boot_gradle_names() {
  local i
  for i in "${!MODULE_COMPOSE[@]}"; do
    [[ "${MODULE_TYPE[$i]}" == "boot" ]] || continue
    [[ -n "${MODULE_COMPOSE[$i]}" ]] || continue
    echo "${MODULE_GRADLE[$i]}"
  done
}

module_resolve_active_gradle_names() {
  local service="$1" s gn names=() n
  if [[ "$service" == "all" ]]; then
    for s in "${SERVICES[@]}"; do
      gn="$(module_gradle_name "$s")"
      names+=("${gn:-root}")
    done
  else
    gn="$(module_gradle_name "$service")"
    names=("${gn:-root}")
  fi
  # Include library modules referenced from registry (always built as deps via Gradle)
  for n in "${MODULE_GRADLE[@]}"; do
    [[ -n "$n" ]] || continue
  done
  printf '%s' "${names[0]}"
  local i
  for ((i = 1; i < ${#names[@]}; i++)); do
    printf ',%s' "${names[$i]}"
  done
  echo
}

# remote_path_for_service / remote_dir_for_service — deploy-path.sh
