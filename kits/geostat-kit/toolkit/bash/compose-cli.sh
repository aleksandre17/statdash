#!/bin/bash
# Docker Compose v1/v2 helper — source from deploy/manage scripts.
# Sets: GEOSTAT_COMPOSE (array: docker compose | docker-compose)

geostat_compose_init() {
  if docker compose version >/dev/null 2>&1; then
    GEOSTAT_COMPOSE=(docker compose)
  elif command -v docker-compose >/dev/null 2>&1; then
    GEOSTAT_COMPOSE=(docker-compose)
  else
    echo "ERROR: neither 'docker compose' nor 'docker-compose' found" >&2
    return 1
  fi
}

# Usage: geostat_compose_run <workdir> <compose-file> <env-file> [compose args...]
geostat_compose_run() {
  local workdir="$1" compose_file="$2" env_file="$3"
  shift 3
  geostat_compose_init || return 1
  (cd "$workdir" && "${GEOSTAT_COMPOSE[@]}" -f "$compose_file" --env-file "$env_file" "$@")
}
