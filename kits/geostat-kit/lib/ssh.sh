#!/bin/bash
# SSH helpers for geostat deploy — optional project-local keys under ops/config/ssh/
# Source after geostat_monorepo_root / geostat_deploy_env_value are available.

geostat_resolve_repo_path() {
  local p="$1"
  [[ -z "$p" ]] && return 1
  if [[ "$p" == /* ]] || [[ "$p" =~ ^[A-Za-z]:[/\\] ]]; then
    echo "$p"
    return 0
  fi
  echo "$(geostat_monorepo_root)/$p"
}

# Print extra openssh args: -F config, -i identity (one line, eval-safe with array)
geostat_ssh_extra_args() {
  local cfg id root opts=""
  root="$(geostat_monorepo_root)"
  cfg="$(geostat_deploy_env_value DEPLOY_SSH_CONFIG_FILE "")"
  id="$(geostat_deploy_env_value DEPLOY_SSH_IDENTITY_FILE "")"
  [[ -n "$cfg" ]] && cfg="$(geostat_resolve_repo_path "$cfg")"
  [[ -n "$id" ]] && id="$(geostat_resolve_repo_path "$id")"
  if [[ -n "$cfg" && -f "$cfg" ]]; then
    printf '%s\n' "-F" "$cfg"
  fi
  if [[ -n "$id" && -f "$id" ]]; then
    printf '%s\n' "-i" "$id"
  fi
  local extra
  extra="$(geostat_deploy_env_value DEPLOY_SSH_OPTIONS "")"
  if [[ -n "$extra" ]]; then
    # shellcheck disable=SC2086
    printf '%s\n' $extra
  fi
}

geostat_ssh() {
  local -a _extra=()
  while IFS= read -r _line; do
    [[ -n "$_line" ]] && _extra+=("$_line")
  done < <(geostat_ssh_extra_args)
  command ssh "${_extra[@]}" "$@"
}

geostat_scp() {
  local -a _extra=()
  while IFS= read -r _line; do
    [[ -n "$_line" ]] && _extra+=("$_line")
  done < <(geostat_ssh_extra_args)
  command scp "${_extra[@]}" "$@"
}

# When deploy.env sets SSH options, prefer geostat_ssh/geostat_scp in toolkit scripts.
geostat_ssh_maybe_alias() {
  if [[ -n "$(geostat_deploy_env_value DEPLOY_SSH_CONFIG_FILE "")" ]] \
    || [[ -n "$(geostat_deploy_env_value DEPLOY_SSH_IDENTITY_FILE "")" ]] \
    || [[ -n "$(geostat_deploy_env_value DEPLOY_SSH_OPTIONS "")" ]]; then
    ssh() { geostat_ssh "$@"; }
    scp() { geostat_scp "$@"; }
  fi
}
