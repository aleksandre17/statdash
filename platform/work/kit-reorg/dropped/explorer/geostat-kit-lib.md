---
name: geostat-kit-lib
description: Core library modules - Python + shell runtime abstractions
metadata:
  type: reference
---

# geostat-kit lib/ — Core Runtime

Agnostic project context + driver abstraction. All queries respect manifest; no app constants.

## Python Core (lib/*.py)

### ProjectContext
`project_context.py` — load manifest, resolve paths, accessor API.

- `find_project_root(start=None)` → Path
  - Walks up cwd until `geostat.ops.json`
  - Respects `GEOSTAT_PROJECT_ROOT` env var
  - Fallback: legacy root discovery (pre-v2 trees with `ops/config`)

- `ProjectContext.discover()` → ProjectContext
  - classmethod; loads manifest from root
  
- `ctx.field(dotted_path, default=None)` → str
  - Single accessor for all manifest values
  - Defaults from `scaffold/geostat.ops.json` if unspecified
  
- `ctx.module_path(module_id)` → Path
- `ctx.secrets_module_dir(module_id)` → Path
- `ctx.list_module_ids()` → [str]
- `ctx.get_module_role(module_id)` → str

### Modules
`modules.py` — role/type queries (never hardcode "backend" or "frontend").

- `module_by_role(manifest, role, index=0)` → str | None
  - Primary api / ui / worker
  - Returns first match for role (api → chat-api or backend)
  
- `modules_by_role(manifest, role)` → [str]
  - All modules with given role
  
- `module_by_type(manifest, driver_type, index=0)` → str | None
  - First module matching driver type
  
- `modules_by_type(manifest, driver_type)` → [str]
- `module_ids(manifest)` → [str] (all modules)
- `module_role(manifest, module_id)` → str
- `default_stack_deploy_steps(manifest)` → [{module, command, args}]
  - Auto-order: api → worker → ui (role precedence)

### Compose Identity
`compose_identity.py` — Docker service naming (single source).

- `resolve_module_service_name(module_id, manifest, deploy, repo_name)` → str
  - Canonical Docker service name
  - Logic: if role==api → `{slug}-api` (unless overridden)
  - if role==ui → `{slug}-app` (unless overridden)
  - if role==worker → `{slug}-{target}` (unless overridden)
  - Respects legacy `deploy.env` overrides (COMPOSE_API_SERVICE, etc.)

- `primary_api_module_id(manifest)` → str | None
  - Resolves "api" role or "backend"/"chat-api" special cases
  
- `primary_ui_module_id(manifest)` → str | None
- `primary_worker_module_id(manifest)` → str | None
- `embedded_worker_enabled(manifest)` → bool
  - Reads `modules.<api>.compose.embeddedWorker` (P0-kit-13)

### Config Generation
`config_gen.py` — generates `.env.*` files.

Modes:
- `simple` — basic vars (no profile groups)
- `postgres-profiles` — per-DB profile (test, dev, prod)
- `env-profiles` — SPRING_PROFILES_ACTIVE splits (dev/prod)

Outputs: `ops/config/<secretsModule>/.env.{dev,prod,deploy}`

Respects:
- `modules.<id>.spring.profileGroups` (group → [profiles])
- `modules.<id>.spring.envProfiles` (profile → {envFile, devtools, prodLogging})
- `modules.<id>.datastores` (postgres schema, qdrant vectors, events)

### Credentials
`credentials.py` — credential file resolution.

- `module_credentials(manifest, module_id)` → [{file, mount, envVar}]
  - Per-module override from `modules.<id>.credentials[]`
  - Global fallback: `adapters.gcp` (if `features.gcpCredentials`)
  
- `global_gcp_credentials(manifest)` → [{file, mount, envVar}]

### CI Helpers
`ci_prepare.py` — setup for CI/CD runs.

- Unpack secrets
- Set git vars (repo name, commit)
- Resolve manifest (find primary api module)
- Pre-flight checks (SSH keys, docker, compose)

`ci_health.py` — health check orchestration.

- Probe `healthModules` from manifest
- Role-based health check patterns
- Timeout + retry logic

### Stack Deployment
`stack_deploy.py` — remote deploy orchestration.

- Read manifest `stackDeploy.steps[]` (explicit) or auto-generate from `stack.composeModules`
- Role ordering: api → worker → ui
- Substitutions: `{environment}` → dev|prod, `{env}` → deploy.env value
- Executes per-module deploy scripts (upload, docker-up, health check)

### VSCode Gen
`vscode_gen.py` — generates `.vscode/launch.json`.

- Reads `modules.<id>.debug` (npmScript, mainClass, projectName)
- Generates launch config + compound task
- Respects `vscode.geostatScript` for CLI integration

### Manifest Defaults
`manifest_defaults.py` — supply defaults for unspecified fields.

- Load scaffold defaults (kit's built-in minimal manifest)
- Merge with consumer manifest
- Fallback values for `secrets`, `package`, `compose.catalog`, etc.

## PowerShell Wrappers (lib/*.ps1)

Thin wrappers around Python + native PS for IDE/Windows integration.

- `project.ps1` — Get-ProjectRootFromManifest, Get-ManifestField
- `env.ps1` — Parse .env files, expand vars
- `modules.ps1` — Get-ProjectModules, Get-ModuleType, Get-ModuleRole
- `drivers.ps1` — Get-DriverCapabilities, Get-DriverCommandPath
- `ssh.ps1` — SSH key mgmt, tunnel setup

## Bash Wrappers (lib/*.sh)

Sed/awk based for environments without Python.

- `project.sh` — source for find root, get field
- `env.sh` — dotenv parsing
- `drivers.sh` — driver registry
- `ssh.sh` — SSH operations

## Design Principles

1. **No hardcoded module names** — all resolved via manifest queries
2. **Single accessor pattern** — `ctx.field(dotted_path)` for all manifest reads
3. **Role-driven discovery** — module lookup by role, not ID
4. **Credential isolation** — per-module override + global fallback
5. **Path resolution at runtime** — never bake app paths into kit code
