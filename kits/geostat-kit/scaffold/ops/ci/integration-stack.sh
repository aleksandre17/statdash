#!/bin/bash
# Project CI: compose smoke — paths from geostat.ops.json (api role module)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PKG="$ROOT/kits/geostat-kit"
export GEOSTAT_PROJECT_ROOT="$ROOT"
export GEOSTAT_KIT_ROOT="$PKG"

# shellcheck source=../../../lib/project.sh
source "$PKG/lib/project.sh"
# shellcheck source=../../../lib/env.sh
source "$PKG/lib/env.sh"

API_MOD="$(geostat_module_id_for_role api)"
[[ -n "$API_MOD" ]] || API_MOD="$(geostat_module_id_for_type java-boot)"
[[ -n "$API_MOD" ]] || { echo "[ci] ERROR: no api/java-boot module in geostat.ops.json" >&2; exit 1; }

BE="$(geostat_module_path "$API_MOD")"
SECRETS_API="$(geostat_secrets_dir_for_module "$API_MOD")"
API_PORT="${API_PORT:-8090}"
WORKER_PORT="${WORKER_PORT:-8091}"

bash "$PKG/ci/prepare-integration-env.sh"
python3 "$PKG/compose/build.py"

cd "$BE"
export API_PORT WORKER_PORT
ENV_ARGS=(--env-file "$SECRETS_API/.env.dev")
[[ -f "$(geostat_secrets_root)/deploy.env" ]] && ENV_ARGS+=(--env-file "$(geostat_secrets_root)/deploy.env")

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.dev.yml}"
echo "[ci] docker compose up (module=$API_MOD)..."
docker compose "${ENV_ARGS[@]}" -f "$COMPOSE_FILE" up -d --build

bash "$PKG/ci/wait-health.sh" "http://127.0.0.1:${API_PORT}/health" "UP" 120

if docker compose "${ENV_ARGS[@]}" -f "$COMPOSE_FILE" ps --format json 2>/dev/null | grep -q worker; then
  bash "$PKG/ci/wait-health.sh" "http://127.0.0.1:${WORKER_PORT}/actuator/health" "UP" 120
fi

echo "[ci] docker compose down..."
docker compose "${ENV_ARGS[@]}" -f "$COMPOSE_FILE" down -v
echo "[ci] Integration stack passed."
