#!/bin/bash
# Remote path helpers for manage.sh (requires REMOTE, PROJECT_DIR, COMPOSE_FILE)

# shellcheck disable=SC2155
remote_path() {
  local s="$1" found
  if declare -f backend_find_deployed_path >/dev/null 2>&1; then
    found="$(backend_find_deployed_path "$s" 2>/dev/null || true)"
    if [[ -n "$found" ]]; then
      echo "$found"
      return
    fi
  fi
  if declare -f remote_path_for_service >/dev/null 2>&1; then
    remote_path_for_service "$s"
    return
  fi
  echo "$REMOTE/$(_manage_remote_dir "$s")"
}

remote_logs_path() {
  local s="$1"
  echo "$(remote_path "$s")/logs"
}

remote_container_name() {
  local s="$1"
  local name
  name="$(_manage_remote_dir "$s")"
  echo "${name:-$s}"
}

# Remove images tagged for deployed compose services only — not server-wide unused-image prune.
manage_prune_deployed_images() {
  local s img_list=""
  for s in "${SERVICES[@]}"; do
    img_list="${img_list} ${s}"
  done
  img_list="${img_list# }"
  [ -z "$img_list" ] && return 0
  ssh "$SERVER" "for name in $img_list; do ids=\$(docker images -q \"\$name\" 2>/dev/null); [ -n \"\$ids\" ] && docker rmi -f \$ids 2>/dev/null || true; done"
}
