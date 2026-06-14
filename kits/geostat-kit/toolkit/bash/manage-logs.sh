#!/bin/bash
# Shared log viewing for manage.sh (requires manage-remote.sh, SERVER, ssh)

MANAGE_LOG_SOURCES=(docker app errors auth db files)

manage_log_is_source() {
  local x="$1"
  local s
  for s in "${MANAGE_LOG_SOURCES[@]}"; do
    [[ "$x" == "$s" ]] && return 0
  done
  return 1
}

manage_log_file_name() {
  case "$1" in
    app)     echo "app.log" ;;
    errors)  echo "error.log" ;;
    auth)    echo "auth.log" ;;
    db)      echo "db.log" ;;
    *)       echo "" ;;
  esac
}

manage_build_grep_filter() {
  MANAGE_GREP_FILTER=""
  [[ -z "${LOG_LEVEL:-}" ]] && return 0
  MANAGE_GREP_FILTER="| grep -E '${LOG_LEVEL}'"
}

manage_logs_interactive_source() {
  echo ""
  echo "   Log source:"
  echo "     1) docker  — live container output"
  echo "     2) app     — app.log"
  echo "     3) errors  — error.log"
  echo "     4) auth    — auth.log"
  echo "     5) db      — db.log"
  echo "     6) files   — list log files"
  echo ""
  read -rp "  Source [1-6]: " lc
  case "$lc" in
    1) ARG3="docker" ;; 2) ARG3="app" ;; 3) ARG3="errors" ;;
    4) ARG3="auth"  ;; 5) ARG3="db"   ;; 6) ARG3="files" ;;
    *) echo "  Invalid."; exit 1 ;;
  esac
}

manage_logs_interactive_level() {
  [[ "$ARG3" == "files" || "$ARG3" == "docker" ]] && return 0
  echo ""
  echo "   Level filter:"
  echo "     1) ALL   2) ERROR   3) WARN   4) INFO"
  echo ""
  read -rp "  Level [1-4, enter=ALL]: " lvl
  case "$lvl" in
    2) LOG_LEVEL="ERROR" ;; 3) LOG_LEVEL="WARN" ;;
    4) LOG_LEVEL="INFO"  ;; *) LOG_LEVEL="" ;;
  esac
}

# Dispatch logs action — uses SVC, ARG3, LOG_LEVEL, ssh_all, ssh_svc, COMPOSE, PROJECT
manage_logs_dispatch() {
  local s d cname logf path
  manage_build_grep_filter

  case "$ARG3" in
    docker)
      if [[ "$SVC" == "all" ]]; then
        for s in "${SERVICES[@]}"; do
          cname="$(remote_container_name "$s")"
          echo "  === $cname (docker) ==="
          ssh "$SERVER" "docker logs --tail=100 $cname" || true
          echo ""
        done
      else
        cname="$(remote_container_name "$SVC")"
        ssh "$SERVER" "docker logs -f --tail=100 $cname"
      fi
      ;;
    files)
      ssh "$SERVER" "find '$REMOTE' -name '*.log' -exec ls -lh {} \; 2>/dev/null | head -80"
      ;;
    app|errors|auth|db)
      logf="$(manage_log_file_name "$ARG3")"
      if [[ "$SVC" == "all" ]]; then
        for s in "${SERVICES[@]}"; do
          path="$(remote_logs_path "$s")"
          ssh "$SERVER" "echo '=== $s ($ARG3) ==='; tail -100 '${path}/${logf}' 2>/dev/null ${MANAGE_GREP_FILTER} || echo '  (no ${logf})'; echo"
        done
      else
        path="$(remote_logs_path "$SVC")"
        ssh "$SERVER" "tail -f '${path}/${logf}' ${MANAGE_GREP_FILTER}"
      fi
      ;;
    *)
      if [[ "$SVC" == "all" ]]; then
        ssh_all logs --tail=50
      else
        cname="$(remote_container_name "$SVC")"
        ssh "$SERVER" "docker logs -f --tail=100 $cname"
      fi
      ;;
  esac
}
