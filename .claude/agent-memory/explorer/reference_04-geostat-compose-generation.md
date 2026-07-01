---
name: geostat-compose-generation
description: Compose generator pipeline, catalog structure, and generation modes
metadata:
  type: reference
---

# Compose Generation — Manifest to Docker Compose

**Entry point:** `kits/geostat-kit/compose/build.py`  
**Command:** `geostat compose-gen`  
**Input:** Manifest + `ops/compose/catalog.json`  
**Output:** Generated `docker-compose.yml` files in app dirs + `ops/compose/stack/`

## Pipeline Steps

1. **Load manifest + catalog**
   ```python
   manifest = load_manifest(project_root)
   templates, targets, features = load_catalog(root)
   ```

2. **Resolve global formatting**
   ```python
   fmt_global = global_fmt(root)
   # Includes: api_service, api_image, network_key, compose_project_name, etc.
   # Sources: deploy.env + manifest + repo name
   ```

3. **Per-target generation**
   - If `manifestStack` mode: render all modules dynamically
   - If `manifestModule` mode: single module by ID
   - If template mode: select template list + substitute vars

4. **Write to disk**
   ```
   apps/backend/docker-compose.dev.yml
   apps/backend/docker-compose.prod.yml
   apps/frontend/docker-compose.yml (base + override)
   apps/frontend/docker-compose.prod.yml
   ops/compose/stack/docker-compose.yml (dev)
   ops/compose/stack/docker-compose.prod.yml (prod)
   ```

## Catalog Structure (`ops/compose/catalog.json`)

**Top-level keys:**
```json
{
  "features": {
    "worker": false           // Feature toggle
  },
  "templates": {
    "api_dev": "...",         // Jinja-like {var} template
    "app_dev_overlay": "...",
    "net_internal": "networks: ..."
  },
  "targets": {
    "apps/backend/docker-compose.dev.yml": {
      "comment": "# Dev API",
      "services": ["api_dev", "worker_dev"],
      "services_if": { "worker_dev": "worker" },  // Conditional include
      "fmt": { ... },         // Variable overrides
      "networks": "net_internal"  // Reference to template
    }
  }
}
```

## Three Generation Modes

**1. Simple Template Mode** (most targets)
- Select templates from `services` list
- Apply `services_if` conditions
- Substitute `fmt` variables
- Example: `apps/backend/docker-compose.dev.yml`

**2. Manifest Stack Mode** (dynamic, full-stack)
- `manifestStack: "dev"` or `"prod"`
- Render all modules in `stack.composeModules` from manifest
- Kit calls `build_manifest_stack_services(ctx, profile=...)`
- Example: `ops/compose/stack/docker-compose.yml`

**3. Manifest Module Mode** (dynamic, single)
- `manifestModule: "retrieval"`
- Render one module by ID with chosen profile
- Kit calls `build_single_module_compose(ctx, module_id=...)`
- Example: `apps/retrieval-service/docker-compose.dev.yml`

## Service Naming

Source: `lib/compose_identity.py` → `resolve_module_service_name()`

**Rules:**
- Module ID + role → service name (e.g., `chat-api` with role `api` → `geostat-chat-ai-api`)
- Slug = `COMPOSE_PROJECT_NAME` from `deploy.env` (or repo folder name)
- Legacy `deploy.env` overrides allowed: `COMPOSE_API_SERVICE`, `COMPOSE_APP_SERVICE`
- No hardcodes; all derived from manifest + deploy config

**Examples:**
- `chat-api` (role: api, id: chat-api) → `geostat-chat-ai-api`
- `frontend` (role: ui) → `geostat-chat-ai-app`
- `retrieval` (role: api) → `geostat-chat-ai-retrieval`
- `ingestion` (role: worker) → `geostat-chat-ai-ingestion`

## Generated Output Structure

```
apps/backend/
├── docker-compose.dev.yml      # API + optional embedded worker
├── docker-compose.prod.yml
├── Dockerfile.dev
└── Dockerfile

apps/frontend/
├── docker-compose.yml          # Base service config
├── docker-compose.override.yml # Dev variant (auto-merged)
├── docker-compose.prod.yml     # Prod overlay

ops/compose/stack/
├── docker-compose.yml          # Full-stack dev (all modules + health checks)
├── docker-compose.prod.yml
├── docker-compose.coexist.yml  # Legacy old+new containers side-by-side
└── README.md
```

## What Compose Files Contain

**Generated compose files ALWAYS include:**
- Service definitions (one per module)
- Volume mounts (especially credentials as read-only)
- Environment variable sourcing (`--env-file ops/config/<module>/.env.dev|prod`)
- Health checks (HTTP GET to /actuator/health or /)
- Network definitions (shared network from manifest)
- Logging config for prod
- Resource limits (memory, CPU)

**NOT generated:**
- Application package.json, tsconfig.json, build.gradle
- App Dockerfiles (consumer owns these)

