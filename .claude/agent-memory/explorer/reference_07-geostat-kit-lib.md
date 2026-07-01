---
name: geostat-kit-lib
description: Core libraries — ProjectContext, modules resolution, manifest defaults
metadata:
  type: reference
---

# Kit Core Libraries — Manifest Resolution API

**Location:** `kits/geostat-kit/lib/`  
**Primary:** `project_context.py` (Python API, used everywhere)  
**Equivalents:** `project.sh`, `project.ps1`, `env.sh`, `env.ps1` (Bash/PS1)

## ProjectContext (Python API)

```python
from lib.project_context import ProjectContext

# Discover and load
ctx = ProjectContext.discover()
ctx = ProjectContext(root=Path("..."), manifest=json.load(...))

# Fields
ctx.field("secrets")                    # "ops/config"
ctx.field("compose.catalog")            # "ops/compose/catalog.json"

# Modules
ctx.list_module_ids()                   # ["chat-api", "frontend", "retrieval"]
ctx.module_id_for_role("api")           # "chat-api" (first)
ctx.module_ids_for_role("api")          # ["chat-api", "retrieval"] (all)
ctx.module_id_for_type("node-vite")     # "frontend"
ctx.module_ids_for_type("java-boot")    # ["chat-api", "retrieval", "ingestion"]
ctx.get_module_role("frontend")         # "ui"

# Paths
ctx.module_path("frontend")             # /project/apps/frontend
ctx.secrets_module_dir("backend")       # /project/ops/config/backend
ctx.secrets_folder_path("backend")      # (same as above)
ctx.secrets_root                        # /project/ops/config
ctx.package_root                        # /project/kits/geostat-kit
ctx.stack_compose_dir                   # /project/ops/compose/stack
ctx.catalog_path                        # /project/ops/compose/catalog.json

# Credentials
ctx.module_credentials_list("chat-api") # [{"file": "...", "mount": "...", "envVar": "..."}]
ctx.gcp_credentials_filename()          # "google-credentials.json" or None
ctx.module_credentials_list("frontend") # [] (UI doesn't get creds)

# Docker compose
ctx.compose_service_names()             # {"chat-api": "geostat-chat-ai-api", ...}

# CLI
ctx.cli_aliases()                       # {"fe": "frontend", "be": "chat-api", ...}
ctx.resolve_alias("fe")                 # "frontend"

# Advanced
ctx.layout_simulator_script("frontend") # "simulate-frontend-layout.ps1" (for debug)
ctx.stack_deploy_steps_default()        # [api modules, then worker, then ui]
ctx.secrets_module_dirs()               # {"backend": Path(...), "frontend": Path(...)}
ctx.list_secrets_module_folders()       # ["backend", "frontend", "retrieval"]
```

## Module Resolution (modules.py)

```python
from lib.modules import (
    module_ids, module_role, modules_by_role, module_by_role,
    modules_by_type, module_by_type, infer_cli_aliases, resolve_cli_alias
)

module_ids(manifest)                    # List all module IDs
module_role(manifest, "frontend")       # "ui"
modules_by_role(manifest, "api")        # All api-role modules
module_by_role(manifest, "api", 0)      # First api-role module
modules_by_type(manifest, "java-boot")  # All java-boot modules
module_by_type(manifest, "java-boot", 0) # First java-boot module
infer_cli_aliases(manifest)             # Auto-generated + explicit aliases
resolve_cli_alias(manifest, "fe")       # "frontend"
```

## Manifest Defaults (manifest_defaults.py)

**Single source:** `scaffold/geostat.ops.json`

```python
from lib.manifest_defaults import (
    load_scaffold_manifest, flatten_defaults, default_field,
    cli_aliases, resolve_cli_alias, legacy_root_discovery_enabled
)

load_scaffold_manifest()                # Load defaults from kit
flatten_defaults()                      # Flattened dict (all defaults)
default_field("secrets")                # "ops/config" (from scaffold)
default_field("stack.composeDir")       # "ops/compose/stack" (from scaffold)
```

**Rule:** No `DEFAULTS = {...}` dicts inline in code. All from `scaffold/geostat.ops.json`.

## Credentials (credentials.py)

```python
from lib.credentials import (
    global_gcp_credentials, module_credentials, all_module_credential_files
)

global_gcp_credentials(manifest)        # [{"file": "...", "mount": "...", "envVar": "..."}]
module_credentials(manifest, "chat-api") # Resolved creds (explicit OR global)
all_module_credential_files(manifest)   # {module_id: [creds]} for all modules
```

## Compose Identity (compose_identity.py)

```python
from lib.compose_identity import (
    slugify, compose_slug, stack_compose_module_ids,
    primary_api_module_id, resolve_module_service_name,
    embedded_worker_enabled, effective_compose_features
)

compose_slug(deploy, repo_name)         # "geostat-chat-ai"
resolve_module_service_name(
    "chat-api", manifest, deploy, repo_name
)                                       # "geostat-chat-ai-api"
primary_api_module_id(manifest)         # "chat-api" (first api role)
embedded_worker_enabled(manifest)       # Check modules.chat-api.compose.embeddedWorker
stack_compose_module_ids(manifest)      # Which modules in full stack
```

## Deploy Paths (deploy_paths.py)

```python
from lib.deploy_paths import resolve_module_deploy_path

resolve_module_deploy_path(
    *, base: str, container_name: str, kind: DeployKind,
    layout: str = "structured", path_mode: str = "base",
)   # e.g. base=/opt/{project}, kind="static"|"compose-dev"|"compose-prod",
    # structured layout → {base}/runtime/{container}/ , {base}/config/{module}/ , {base}/storage/
```

**Structured layout** replaces bespoke `DEPLOY_BACKEND_PATH`/`DEPLOY_FRONTEND_PATH`. Server-side paths are computed (not hardcoded) from `DEPLOY_PATH` + `DEPLOY_LAYOUT` (structured|flat|legacy) + module container name + command kind. Worker modules inherit `DEPLOY_PATH` from `stack.deployBaseSecretsModule`.

## Config Generation (config_gen.py)

Generates Spring `application.yml` / `application-{profile}.yml` from manifest + stack catalog — **Java/Spring modules only**. Node/Vite modules get NO config generation (their configs are hand-written; `.env` comes from `ops/config/{secretsModule}/` at runtime). Three modes: `simple` (minimal vars), `postgres-profiles` (test/dev/prod DB), `env-profiles` (`SPRING_PROFILES_ACTIVE` splits).

## Project Root Discovery (project.sh / project.ps1)

```bash
# Bash
source "lib/project.sh"
root=$(geostat_project_root)
root=$(geostat_read_manifest_field "secrets")
```

```powershell
# PowerShell
. "lib/project.ps1"
$root = Get-ProjectRootFromManifest
$field = Get-ManifestField "secrets"
```

**Discovery order:**
1. `GEOSTAT_PROJECT_ROOT` env var
2. Walk up for `geostat.ops.json` (required)
3. Legacy (opt-in): `GEOSTAT_LEGACY_ROOT_DISCOVERY=1` → `ops/config` or `secrets/` + `kits/geostat-kit`

## All Files in lib/

```
lib/
├── project_context.py           # Python API (primary)
├── project.sh / project.ps1     # Root discovery
├── env.sh / env.ps1             # Load manifest + build env
├── modules.py                   # Role/type resolution
├── modules_cli.py               # CLI + layout commands
├── credentials.py               # Cred profiles
├── compose_identity.py          # Service naming
├── deploy_paths.py              # Structured deploy-path resolution (runtime/config/storage)
├── config_gen.py                # Spring application.yml generation (Java only; simple|postgres-profiles|env-profiles)
├── manifest_defaults.py         # Scaffold defaults (single source)
├── manifest_migrate.py          # v1→v2 migration
├── manifest_compose.py          # Manifest-mode service rendering
├── validate_manifest.py         # Schema validation
├── vscode_gen.py                # VS Code launch.json
├── ci_prepare.py                # CI scaffold
├── ci_health.py                 # Health check orchestration
├── stack_deploy.py              # Deploy step ordering
├── stack_endpoints.py           # Port resolution
├── infra_tunnel.py              # SSH tunnel
├── drivers.ps1 / drivers.sh     # Driver registry lookup
├── deploy-defaults.json         # Deploy layout defaults
└── env.ps1                      # PowerShell env
```

