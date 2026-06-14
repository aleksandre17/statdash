# Portable ops toolkit (Bash) — sourced from java-boot driver _init.sh
# Requires: OPS_SCRIPT_DIR (= module root), OPS_SECRETS_MODULE, PROJECT_DIR, MONOREPO

: "${OPS_SCRIPT_DIR:?OPS_SCRIPT_DIR not set}"
: "${OPS_SECRETS_MODULE:?OPS_SECRETS_MODULE not set}"

SECRETS_DIR="$(geostat_secrets_module_dir "$OPS_SECRETS_MODULE")"
OPS_LOG_DIR="${OPS_SCRIPT_DIR}/logs"
mkdir -p "$OPS_LOG_DIR"

SERVER="$(geostat_env_value "$OPS_SECRETS_MODULE" DEPLOY_SERVER "$(geostat_deploy_env_value DEPLOY_SERVER "")")"
PROJECT="$(geostat_env_value "$OPS_SECRETS_MODULE" DEPLOY_PROJECT "")"
[[ -n "$PROJECT" ]] || PROJECT="${OPS_PROJECT_NAME:-}"
[[ -n "$PROJECT" ]] || PROJECT="$(geostat_project_slug)"
SERVER_BASE="$(geostat_env_value "$OPS_SECRETS_MODULE" DEPLOY_SERVER_BASE "$(geostat_server_base)")"
OPS_BUILD_TMP_PREFIX="$(geostat_deploy_env_value OPS_BUILD_TMP_PREFIX "ops-build")"
DOCKER_NETWORK="$(geostat_docker_network)"

# Optional module overrides (ops.config.sh)
: "${VERSIONS_KEEP:=5}"
: "${HEALTH_RETRIES:=24}"
: "${CRED_PATTERNS:=*.p12 *.jks *.keystore *.pem *.crt *credentials*.json *service-account*.json}"

# shellcheck source=../../lib/ssh.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/lib/ssh.sh"
geostat_ssh_maybe_alias
