---
name: geostat-kit-dispatch-architecture
description: How the kit dispatches commands; module type + driver registry + command mapping
metadata:
  type: reference
---

# Geostat-Kit Dispatch & Driver Architecture

## Three-Layer Command Resolution

1. **CLI Alias Resolution** (geostat.ops.json `.cli.aliases`)
   - User: `geostat fe dev bootstrap`
   - Manifest alias: `fe` → `frontend`

2. **Module Discovery** (ProjectContext queries manifest)
   - Resolves `frontend` module
   - Gets: module path (`apps/frontend`), type (`node-vite`), role (`ui`)

3. **Driver Type → Commands** (drivers/registry.json)
   - Type: `node-vite`
   - Registry entry:
     ```json
     {
       "node-vite": {
         "runtime": "powershell",
         "commands": {
           "dev": "ps1/dev.ps1",
           "deploy": "ps1/deploy.ps1",
           "run": "ps1/run.ps1",
           "check": "ps1/check.ps1",
           "compose": "ps1/compose.ps1",
           "manage": "ps1/manage.ps1"
         }
       }
     }
     ```

4. **Command Dispatch**
   - Extracts command script path from registry
   - Sets CWD to module path
   - Invokes script with remaining args
   - Example: `& "kits/geostat-kit/drivers/node-vite/ps1/dev.ps1" bootstrap -Environment dev`

## Driver Structure (Example: node-vite)

Directory: `kits/geostat-kit/drivers/node-vite/`

```
node-vite/
├── README.md              ← Commands & prerequisites
├── ps1/                   ← PowerShell scripts (Windows-native)
│   ├── _common.ps1        ← Shared functions (sourced by all)
│   ├── dev.ps1            ← Source rsync + compose (Windows → Linux)
│   ├── deploy.ps1         ← Artifact deploy (local | dist | remote | sync | watch)
│   ├── run.ps1            ← Local npm run (hybrid dev)
│   ├── check.ps1          ← Pre-flight checks
│   ├── compose.ps1        ← Local docker-compose operations
│   └── manage.ps1         ← Server-side lifecycle (stop/start/logs)
├── _init.ps1              ← Driver initialization (sets env, loads libs)
└── (no _common.ps1 shown but pattern is: all scripts dot-source _init.ps1)
```

## Key Dispatch Rule: No Hardcodes in Kit

Scripts **never hardcode**:
- Module IDs (geostat-chat-ai, statdash-platform)
- Service names (frontend, chat-api)
- Container names (geostat-chat-ai-app, geostat-chat-ai-api)
- Ports (8080, 3000)
- Paths (apps/frontend, apps/backend)

**Instead:**
1. Scripts read manifest via ProjectContext (Python) or load it at script start
2. Resolve module metadata at runtime
3. Use metadata to determine behavior

Example (node-vite ps1/dev.ps1):
```powershell
$GetComposeServices = Join-Path $env:GEOSTAT_KIT_ROOT "toolkit\powershell\Get-ComposeServices.ps1"
. $GetComposeServices

$_services = @(Get-ComposeServicesFromFile -ModuleRoot $ROOT -ComposeFile "docker-compose.yml" ...)
# Parse CWD's docker-compose.yml to discover service names
# No hardcoded service names!
```

## Runtime Environment Setup

**All drivers inherit from `_init.ps1` or `_init.sh`:**
- Sets `$env:GEOSTAT_PROJECT_ROOT` = project root (found via ProjectContext.discover)
- Sets `$env:GEOSTAT_KIT_ROOT` = kit root path
- Loads toolkit libraries (Deploy-Path.ps1, Get-ComposeServices.ps1, etc.)
- Loads module-specific env (ops/config/{secretsModule}/.env.deploy, .env.dev, etc.)

**Java driver (_init.sh, bash):**
- `source "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/_init.sh"`
- Inherits from bash toolkit

**Node driver (_init.ps1, PowerShell):**
- Sourced by all ps1/ scripts
- Sets up logging, deploy paths, SSH commands

## Module-Manifest Contract

Each driver expects:

**For node-vite module:**
```json
{
  "frontend": {
    "path": "apps/frontend",
    "type": "node-vite",
    "role": "ui",
    "secretsModule": "frontend",
    "target": "frontend",
    "debug": {
      "npmScript": "dev"
    }
  }
}
```

Driver uses:
- `path`: CWD for all commands
- `type`: Determines which driver to use
- `secretsModule`: Where to find `.env.dev`, `.env.deploy` (in `ops/config/`)
- `target`: Service name prefix in docker-compose (optional, defaults to module id)
- `debug.npmScript`: Which `npm run X` to invoke for local dev (hybrid mode)

**For java-boot module:**
```json
{
  "chat-api": {
    "path": "apps/backend",
    "type": "java-boot",
    "role": "api",
    "secretsModule": "backend",
    "target": "backend",
    "hybrid": {
      "springProfiles": "local",
      "preferJar": true,
      "bootJar": "apps/backend/build/libs/geostat-chat-ai-2.0.0-SNAPSHOT.jar"
    },
    "spring": {
      "applicationName": "geostat-chat-ai",
      "defaultProfile": "local",
      "portEnv": "API_PORT"
    }
  }
}
```

Driver uses:
- `path`: CWD for gradle commands
- `hybrid.springProfiles`: Spring profile(s) to use in local dev
- `hybrid.bootJar`: Path to pre-built JAR (if using `prefer: true`)
- `spring.applicationName`: Used in Spring config generation
- `spring.portEnv`: Which env var controls the port

## Compose Service Name Resolution

In `lib/compose_identity.py`:

```python
def resolve_module_service_name(
    module_id: str,
    manifest: dict[str, Any],
    deploy: dict[str, str],  # from deploy.env
    repo_name: str,
) -> str:
    """Docker compose service key for a manifest module (single source of truth)."""
    # Uses module role + target + deploy.env overrides
    # Example: module_id="frontend", role="ui" → service="geostat-chat-ai-app"
```

**Rules:**
- Primary API ("backend" or "chat-api") → `{slug}-api` (or COMPOSE_API_SERVICE override)
- Frontend UI → `{slug}-app` (or COMPOSE_APP_SERVICE override)
- Other roles → `{slug}-{target}` (slugified module ID if no target)
- Slug = COMPOSE_PROJECT_NAME or repo folder name

**No hardcodes:** Service names are derived from manifest at runtime.

## How node-vite Gets Module Path to Module Config

1. User: `geostat fe dev bootstrap`
2. Kit resolves `frontend` → manifest entry
3. Gets `modules.frontend.path` = `apps/frontend`
4. Sets CWD to `{PROJECT_ROOT}/apps/frontend`
5. Invokes `ps1/dev.ps1 bootstrap` (relative to CWD)
6. Script sources `_init.ps1` which sets:
   - `$ROOT = Get-Location` (or explicit CWD)
   - Loads `docker-compose.yml` from `$ROOT`
   - Loads env from `ops/config/frontend/.env.dev`, `.env.deploy`

7. Script reads `docker-compose.yml` (hand-written in module) to discover service names

Example docker-compose.yml in apps/frontend:
```yaml
version: '3.8'
services:
  frontend:
    build:
      context: .
      dockerfile: Dockerfile
      target: dev
    volumes:
      - .:/app
      - /app/node_modules
    environment:
      - VITE_API_URL=${VITE_API_URL}
```

Script parses this and finds service name `frontend`.

## Deployment Path Resolution

From `lib/deploy_paths.py`:

```python
def resolve_module_deploy_path(
    *, base: str, container_name: str, kind: DeployKind, layout: str = "structured", path_mode: str = "base"
) -> str:
    # Structured layout example:
    # base = /home/deploy/geostat-chat-ai
    # kind = "static" (frontend) or "compose-dev" or "compose-prod"
    # container_name = "geostat-chat-ai-app"
    # Returns: /home/deploy/geostat-chat-ai/static/geostat-chat-ai-app/
```

**No hardcoded paths on the server side.** Paths are computed from:
- DEPLOY_PATH (in ops/config/{secretsModule}/.env.deploy)
- DEPLOY_LAYOUT (structured | flat | legacy)
- Module's target/container name (from manifest)
- Command kind (deploy, deploy watch, dev, etc.)

## Summary: Manifest → Runtime Discovery

```
geostat fe dev bootstrap
    ↓
Resolve alias "fe" → "frontend"
    ↓
Load manifest, find modules.frontend
    ↓
Get: path=apps/frontend, type=node-vite
    ↓
Look up type in drivers/registry.json
    ↓
Find command "dev" → "ps1/dev.ps1"
    ↓
Execute: cd apps/frontend; powershell ps1/dev.ps1 bootstrap ...
    ↓
Script (_init.ps1) loads:
  - docker-compose.yml from CWD
  - ops/config/frontend/.env.dev
  - ops/config/frontend/.env.deploy (if remote)
    ↓
Script discovers service name from docker-compose
    ↓
Run rsync / compose / deploy operations
```

**All paths, service names, ports, credentials resolved at dispatch time. No hardcodes in kit or scripts.**
