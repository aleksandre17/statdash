---
name: geostat-kit-manifest
description: Manifest schema, required fields, and resolution API
metadata:
  type: reference
---

# geostat.ops.json Manifest — Single Source of Truth

**Location:** Project root (consumer provides)  
**Schema:** `kits/geostat-kit/manifest.schema.json` (JSON Schema v7)  
**Defaults:** `kits/geostat-kit/scaffold/geostat.ops.json`

## Required Structure

```json
{
  "version": 2,
  "package": "kits/geostat-kit",           // Path to kit
  "secrets": "ops/config",                 // Where .env files live
  "compose": {
    "catalog": "ops/compose/catalog.json"  // Compose gen input
  },
  "modules": {
    "chat-api": {
      "role": "api",                       // ui|api|worker|gateway|data|other
      "type": "java-boot",                 // Driver type (registry key)
      "path": "apps/backend",              // App source tree
      "secretsModule": "backend"           // Env subfolder name
    },
    "frontend": {
      "role": "ui",
      "type": "node-vite",
      "path": "apps/frontend",
      "secretsModule": "frontend"
    }
  }
}
```

## Optional Fields

- `features.gcpCredentials` (bool) — Global GCP fallback if true
- `adapters.gcp.*` — Default GCP mount/envVar
- `modules.<id>.credentials[]` — Per-module file list (overrides global)
- `cli.aliases` — Custom shortcuts (e.g., `fe` → `frontend`)
- `stack.composeModules` — Which modules in full stack
- `stack.deployBaseSecretsModule` — Shared DEPLOY_PATH base
- `stackDeploy.steps` — Custom deploy order (default: api → worker → ui)
- `ci.*` — CI script paths and health module list

## Resolution at Runtime

**Python API** (`lib/project_context.py`):
```python
from lib.project_context import ProjectContext
ctx = ProjectContext.discover()
ctx.list_module_ids()                   # ["chat-api", "frontend", "retrieval"]
ctx.module_id_for_role("api")           # "chat-api" (first)
ctx.module_ids_for_role("api")          # ["chat-api", "retrieval"] (all)
ctx.module_id_for_type("node-vite")     # "frontend"
ctx.module_path("frontend")             # /project/apps/frontend
ctx.secrets_module_dir("backend")       # /project/ops/config/backend
ctx.cli_aliases()                       # {"fe": "frontend", "be": "chat-api"}
ctx.resolve_alias("fe")                 # "frontend"
ctx.module_credentials_list("chat-api") # Resolved credential files
```

**Bash/PowerShell equivalents:**
- `geostat_module_id_for_type node-vite`
- `Get-ManifestModulePath <module-id>`
- `Resolve-CliAlias fe`

## Key Principle

**No hardcodes in kit code.** Every decision reads from manifest:
- Module IDs only from `modules.*`
- Paths only from `modules.<id>.path`
- Secrets folder only from `modules.<id>.secretsModule`
- Driver type only from `modules.<id>.type`
- All discovered dynamically at runtime

This allows one kit to work for any project shape (single api, multi-api, worker+ui, etc.) without modification.

