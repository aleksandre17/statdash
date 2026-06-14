#!/bin/bash
# geostat-kit package — env & naming (no application logic)
# Source: geostat_kit_package_root/lib/env.sh (after project.sh)

# shellcheck source=project.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/project.sh"

geostat_monorepo_root() {
  if [[ -n "${OPS_MONOREPO_ROOT:-}" ]]; then
    echo "$OPS_MONOREPO_ROOT"
    return
  fi
  if [[ -n "${GEOSTAT_MONOREPO_ROOT:-}" ]]; then
    echo "$GEOSTAT_MONOREPO_ROOT"
    return
  fi
  if [[ -n "${GEOSTAT_PROJECT_ROOT:-}" ]]; then
    echo "$GEOSTAT_PROJECT_ROOT"
    return
  fi
  geostat_find_project_root "$(pwd)" || {
    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    echo "$(cd "$script_dir/../../.." && pwd)"
  }
}

# Read ops/config/deploy.env only (shared deploy identity)
geostat_deploy_env_value() {
  local key="$1" default="${2:-}"
  local f root line k v
  root="$(geostat_monorepo_root)"
  f="$(geostat_secrets_root)/deploy.env"
  [[ -f "$f" ]] || { echo "${!key:-$default}"; return; }
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)[[:space:]]*=[[:space:]]*(.*)$ ]] || continue
    k="${BASH_REMATCH[1]}"
    v="${BASH_REMATCH[2]}"
    v="${v%$'\r'}"
    v="${v#\"}"; v="${v%\"}"
    v="${v#\'}"; v="${v%\'}"
    [[ "$k" == "$key" && -n "$v" ]] && echo "$v" && return 0
  done <"$f"
  if [[ -n "${!key:-}" ]]; then
    echo "${!key}"
    return 0
  fi
  echo "$default"
}

geostat_slugify() {
  local s="$1"
  s="$(echo "$s" | tr '[:upper:]' '[:lower:]')"
  s="$(echo "$s" | sed -E 's/[^a-z0-9._-]+/-/g; s/^-+|-+$//g')"
  echo "$s"
}

# SSH remote path segment ($SERVER_BASE/$PROJECT/...)
geostat_project_slug() {
  local slug
  slug="$(geostat_deploy_env_value DEPLOY_PROJECT "")"
  [[ -n "$slug" ]] || slug="$(basename "$(geostat_monorepo_root)")"
  geostat_slugify "$slug"
}

# Docker compose / network naming (repo folder unless COMPOSE_PROJECT_NAME set)
geostat_compose_slug() {
  local slug
  slug="$(geostat_deploy_env_value COMPOSE_PROJECT_NAME "")"
  [[ -n "$slug" ]] || slug="$(basename "$(geostat_monorepo_root)")"
  geostat_slugify "$slug"
}

geostat_docker_network() {
  local slug net
  slug="$(geostat_compose_slug)"
  net="$(geostat_deploy_env_value DOCKER_NETWORK "")"
  [[ -n "$net" ]] || net="$(geostat_deploy_env_value GEOSTAT_DOCKER_NETWORK "")"
  [[ -n "$net" ]] || net="${slug}-net"
  echo "$net"
}

geostat_server_base() {
  local base server
  base="$(geostat_deploy_env_value DEPLOY_SERVER_BASE "")"
  [[ -n "$base" ]] && echo "$base" && return 0
  server="$(geostat_deploy_env_value DEPLOY_SERVER "")"
  if [[ "$server" =~ ^([^@]+)@ ]]; then
    echo "/home/${BASH_REMATCH[1]}"
    return 0
  fi
  echo ""
}

geostat_secrets_root() {
  local root rel
  root="$(geostat_monorepo_root)"
  rel="$(geostat_read_manifest_field secrets "ops/config")"
  echo "$root/$rel"
}

geostat_secrets_module_dir() {
  echo "$(geostat_secrets_root)/$1"
}

# Prints one path per line: .env.dev | .env.prod | deploy.env | .env.deploy
geostat_env_files() {
  local module="$1" profile="${2:-all}"
  local dir root
  dir="$(geostat_secrets_module_dir "$module")"
  root="$(geostat_monorepo_root)"

  if [[ "$profile" == "dev" || "$profile" == "all" ]] && [[ -f "$dir/.env.dev" ]]; then
    echo "$dir/.env.dev"
  fi
  if [[ "$profile" == "prod" || "$profile" == "all" ]] && [[ -f "$dir/.env.prod" ]]; then
    echo "$dir/.env.prod"
  fi
  if [[ "$profile" == "deploy" || "$profile" == "all" ]]; then
    [[ -f "$(geostat_secrets_root)/deploy.env" ]] && echo "$(geostat_secrets_root)/deploy.env"
    [[ -f "$dir/.env.deploy" ]] && echo "$dir/.env.deploy"
  fi
}

# geostat_env_value <module> <KEY> [default]
geostat_env_value() {
  local module="$1" key="$2" default="${3:-}"
  local f line k v
  while IFS= read -r f; do
    [[ -f "$f" ]] || continue
    while IFS= read -r line || [[ -n "$line" ]]; do
      [[ "$line" =~ ^[[:space:]]*# ]] && continue
      [[ "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)[[:space:]]*=[[:space:]]*(.*)$ ]] || continue
      k="${BASH_REMATCH[1]}"
      v="${BASH_REMATCH[2]}"
      v="${v%$'\r'}"
      v="${v#\"}"; v="${v%\"}"
      v="${v#\'}"; v="${v%\'}"
      [[ "$k" == "$key" && -n "$v" ]] && echo "$v" && return 0
    done < "$f"
  done < <(geostat_env_files "$module" all)
  echo "$default"
}

geostat_infra_consumer_slug() {
  local slug
  slug="$(geostat_env_value infra INFRA_SLUG "")"
  [[ -n "$slug" ]] || slug="$(basename "$(geostat_monorepo_root)")"
  geostat_slugify "$slug"
}

# Remote: {server_base}/{DEPLOY_PROJECT}/infra/{INFRA_SLUG}
geostat_resolve_infra_deploy_path() {
  local explicit slug base gp
  slug="$(geostat_infra_consumer_slug)"
  explicit="$(geostat_env_value infra DEPLOY_PATH "")"
  if [[ -n "$explicit" ]]; then
    explicit="${explicit%/}"
    if [[ "$explicit" != */infra/"$slug" ]]; then
      echo "ERROR: DEPLOY_PATH must end with /infra/$slug (got: $explicit)" >&2
      return 1
    fi
    echo "$explicit"
    return 0
  fi
  base="$(geostat_server_base)"
  gp="$(geostat_project_slug)"
  if [[ -n "$base" && -n "$gp" ]]; then
    echo "${base%/}/$gp/infra/$slug"
    return 0
  fi
  echo "/home/administrator/geostat/infra/$slug"
}

geostat_infra_compose_dir() {
  local proj rel
  proj="$(geostat_find_project_root)" || return 1
  rel="$(geostat_read_manifest_field stack.infraComposeDir "ops/compose/infra")"
  echo "$proj/$rel"
}

# geostat_stack_env_files <dev|prod>
geostat_stack_env_files() {
  local profile="$1" folder seen=()
  while IFS= read -r folder; do
    [[ -n "$folder" ]] || continue
    geostat_env_files "$folder" "$profile"
  done < <(geostat_list_secrets_module_folders)
  local deploy_env
  deploy_env="$(geostat_secrets_root)/deploy.env"
  [[ -f "$deploy_env" ]] && echo "$deploy_env"
}
