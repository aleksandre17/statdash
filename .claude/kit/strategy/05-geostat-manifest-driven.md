# geostat-chat-ai: Manifest-Driven Ops Framework

**Reconnaissance:** 2026-06-14 · **Source:** `C:\Users\Test-User\CursorProjects\geostat-chat-ai`

## Core Soul: The Manifest Pattern

**File:** `geostat.ops.json` (410 lines) — THE single source of truth for all ops decisions.

### Why Manifest-Driven?

The kit reads `geostat.ops.json` at runtime for **every** decision:
- CLI commands resolve module aliases → type → driver scripts
- Docker Compose templates render with manifest vars (no hardcodes)
- Deploy steps ordered by module role (api → worker → ui)
- Credentials resolved per-module or global GCP fallback
- Health checks standardized by role

**Result:** Same kit code works for 1-module or 10-module projects without modification.

### Manifest Structure (Simplified)

```json
{
  "version": 2,
  "package": "kits/geostat-kit",  // Relative path to ops framework
  
  "modules": {
    "chat-api": {
      "role": "api",
      "type": "java-boot",
      "path": "apps/backend",
      "secretsModule": "backend",
      "credentials": [{"file": "google-credentials.json"}]
    },
    "frontend": {
      "role": "ui",
      "type": "node-vite",
      "path": "apps/frontend"
    }
    // + retrieval, ingestion
  },
  
  "stack": {
    "composeModules": ["chat-api", "retrieval", "ingestion", "frontend"],
    "networkName": "geostat-chat-ai-net",
    "infraComposeDir": "ops/compose/infra"
  },
  
  "cli": {
    "aliases": {
      "fe": "frontend",
      "be": "chat-api"
    }
  },
  
  "compose": {
    "catalog": "ops/compose/catalog.json"
  },
  
  "ci": {
    "healthModules": ["chat-api", "retrieval", "ingestion"],
    "integration": "ops/ci/integration-stack.sh"
  }
}
```

### Key Principle: Runtime Resolution

No hardcoded module IDs, ports, or paths in kit:
- `lib/project_context.py` loads manifest, exposes query API
- `lib/modules.py` queries for modules by role or type
- `lib/compose_identity.py` resolves service names from manifest
- `lib/credentials.py` resolves creds per-module or global fallback

**Example (Python):**
```python
ctx = ProjectContext.discover()
api_modules = ctx.module_ids_for_role("api")  # ["chat-api", "retrieval"]
backend_path = ctx.module_path("chat-api")    # Path("apps/backend")
creds = module_credentials(ctx.manifest, "chat-api")
```

### Deploy Order (Implicit Hierarchy)

`lib/stack_deploy.py` orders modules by role:
```python
ROLE_DEPLOY_ORDER = ("api", "worker", "gateway", "data", "ui", "other")
```

Manifest stack.composeModules or all modules → ordered by role → deploy steps generated.

**Example:** Deploy `["frontend", "chat-api", "ingestion"]` → reordered to `["chat-api", "ingestion", "frontend"]`

### Why This Matters

1. **No version skew** — manifest is source; CLI, compose, deploy all read same manifest
2. **Easy to extend** — add new module to manifest, run `geostat compose-gen` once
3. **Team readability** — ops decisions visible in JSON, not scattered in scripts
4. **Safe changes** — manifest validation schema prevents invalid configs
