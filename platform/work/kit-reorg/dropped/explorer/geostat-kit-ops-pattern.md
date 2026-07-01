---
name: geostat-kit-ops-pattern
description: Key architectural patterns and seams - how manifest drives all operations
metadata:
  type: reference
---

# geostat-kit — Key Architectural Patterns

## 1. Manifest as Single Source of Truth

**Pattern:** All runtime logic queries manifest via `ProjectContext.field(dotted_path, default)` accessor.

**Why:** Enables extensibility (new modules, new roles) without kit code changes.

**Implementation:**
```python
# Instead of hardcoding:
if module_id == "backend":
    port = 8090
    
# Kit does:
port = ctx.field(f"modules.{module_id}.spring.portEnv", "PORT")
# Then reads: PORT=8090 from .env
```

**Scope:** Module IDs, roles, paths, ports, credentials, profiles, datastores.

## 2. Driver Registry Model

**Pattern:** Type → Commands → Implementation

```
Module Type (manifest.modules.<id>.type)
    ↓
Driver Registry (drivers/registry.json)
    ↓
Command (deploy, dev, run, compose, check, manage, modules)
    ↓
Script (sh/ or ps1/)
```

**Why:** N-module support without per-module kit code.

**Example:**
```json
"chat-api": { "type": "java-boot" }
→ drivers/java-boot/sh/deploy.sh
→ Gradle build + JAR upload
```

If new type needed: add to registry, implement commands, done.

## 3. Compose Identity Contract

**Pattern:** Single function resolves Docker service names.

```
resolve_module_service_name(module_id, manifest, deploy, repo_name)
→ "{slug}-{target}" or legacy COMPOSE_API_SERVICE override
```

**Why:** Consistent across all outputs (docker-compose.yml, health checks, CI).

**No sprawl:** No separate API_SERVICE, APP_SERVICE, WORKER_SERVICE enums in code.

## 4. Credential Isolation

**Pattern:** Per-module override + global fallback.

```
modules.<id>.credentials[]  ← per-module
    ↓ if missing:
adapters.gcp.*  ← global fallback (if features.gcpCredentials)
```

**Why:** Fine-grained control; never force global creds on all modules.

**Binding:** Mounted at container startup, never logged or diff'd.

## 5. Config Generation Hierarchy

**Pattern:** Defaults ← ProfileGroups ← PerProfileEnv ← DatastoreVars ← Output

```
1. Manifest defaults (scaffold baseline)
2. Spring profileGroups (e.g., hybrid → ["db", "hybrid-env"])
3. Per-profile envProfiles (dev → .env.dev, prod → .env.prod)
4. Datastore declarations (postgres schema, qdrant indices)
5. Output: ops/config/<secretsModule>/.env.*
```

**Modes:**
- `simple` — minimal vars
- `postgres-profiles` — test/dev/prod DB config
- `env-profiles` — SPRING_PROFILES_ACTIVE splits

**Why:** Single source (manifest) for all env config; regenerate on change.

## 6. Role-Driven Discovery

**Pattern:** Query by role, never assume module IDs.

```
Primary API:
  module_by_role(manifest, "api", 0)  ← auto-discovers "backend" or "chat-api"
  
All workers:
  modules_by_role(manifest, "worker")  ← returns ["ingestion", "retrieval", ...]
  
Stack order (auto-generated deploy steps):
  api → worker → ui  (respects role precedence)
```

**Why:** Enables multi-api, multi-worker configs without kit rewrites.

## 7. Deploy Path Abstraction

**Pattern:** Structured layout replaces bespoke DEPLOY_BACKEND_PATH/DEPLOY_FRONTEND_PATH.

```
/opt/{project}/
  runtime/
    chat-api/         ← DEPLOY_PATH + runtime/{module-id}/
    retrieval/
    ingestion/
    frontend/
  config/
    backend/          ← secrets mounted here
    retrieval/
    ingestion/
    frontend/
  storage/            ← persistent volumes
```

**Inheritance:** Worker modules inherit DEPLOY_PATH from `stack.deployBaseSecretsModule` (api).

**Why:** Single layout convention for all modules; drivers don't need to know paths.

## 8. Health Check Contracts

**Pattern:** Role-based standard checks (no per-app hardcodes).

| Role | Command | Port Source |
|------|---------|-------------|
| api | `curl http://localhost:${port}/actuator/health` | manifest `spring.portEnv` |
| worker | same | `RETRIEVAL_PORT`, `INGESTION_PORT`, etc. |
| ui | `curl http://localhost/` or `wget` | manifest `spring.portEnv` (dev) / 80 (nginx) |

**Why:** CI/CD health checks always work (no special cases per app).

## 9. No Consumer Brand in Kit

**Pattern:** Test: `test_toolkit_hardcodes.py` bans grep for app-specific strings.

Forbidden in kit code:
- Project names (geostat-chat-ai, any-bank)
- Module IDs (backend, frontend, api, ui)
- Port numbers (8090, 5177)
- Domain slugs (backend-api, app-ui)
- Credential file names

Allowed:
- Placeholders: `{api_service}`, `{network_key}`, `{health_interval}`
- Generic patterns: role-based health checks, standard profiles

**Why:** Kit works unchanged for any project; consumer only edits manifest.

## 10. N-Module Model

**Pattern:** No "backend" or "frontend" assumptions.

```
Multiple APIs:
  chat-api (role: api)
  search-api (role: api)
  
Multiple Workers:
  ingestion-service (role: worker)
  audit-processor (role: worker)
  
Multiple UIs:
  frontend (role: ui)
  admin-dashboard (role: ui)
  
Kit auto-discovers via role queries; stack order: api → worker → ui.
```

**Explicit control:** `stack.composeModules` + `stackDeploy.steps[]` for custom order.

**Why:** Supports microservices, worker farms, multi-dashboard architectures.

## 11. Environment Precedence

**Pattern:** Layered override (no conflicts).

```
1. Manifest defaults → base values
2. ProjectContext defaults (from scaffold) → fallback
3. ops/config/<module>/.env.dev → local override
4. ops/config/<module>/.env.prod → prod override
5. deploy.env → remote server params
6. CLI --mode hybrid|docker → runtime mode selection
7. Docker Compose → substitute ${VAR} from env
```

**Why:** Each layer has a clear purpose; no magic surprises.

## 12. Compose Generation is Declarative

**Pattern:** Catalog + manifest → templates + substitutions.

No imperative logic in compose generation:
- No `if (apiModuleIs("backend"))` in templates
- No conditional service names
- All decisions made upfront: role → service name, module type → dockerfile, etc.

**Output:** Safe to regenerate anytime.

## System Boundaries

### Kit Owns
1. Module discovery (ProjectContext)
2. Compose generation (manifest → docker-compose)
3. Config generation (manifest → .env files)
4. Credential resolution (per-module or global)
5. Driver dispatch (type → command)
6. Health checks (role-based)
7. Deploy path structure (DEPLOY_PATH/runtime/{module}/)

### Consumer Owns
1. `geostat.ops.json` (manifest)
2. `ops/config/` (secrets, per-module .env templates)
3. `ops/compose/catalog.json` (consumer-specific compose overrides)
4. `ops/ci/` (consumer-specific smoke tests, gates)
5. App code (backend, frontend, workers)
6. Custom driver types (if needed)

### Kit Must NOT
1. Hardcode module IDs
2. Assume role (must query manifest)
3. Bake port numbers
4. Reference consumer brands/domains
5. Make role assumptions (no "backend always api")
