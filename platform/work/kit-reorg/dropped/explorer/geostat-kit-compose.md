---
name: geostat-kit-compose
description: Docker Compose generation pipeline - manifest to docker-compose.yml
metadata:
  type: reference
---

# geostat-kit compose/ — Manifest → Docker Compose

Single-source-of-truth pipeline: manifest + consumer catalog → generated docker-compose files.

## Flow

1. **manifest_compose.py** reads:
   - Manifest (modules, roles, ports, credentials)
   - Consumer `ops/compose/catalog.json` (templates + targets)
   - Kit `compose/compose-catalog.json` (reusable blocks)

2. **Substitution** (no hardcodes):
   - `{api_service}` ← resolved from manifest
   - `{network_key}` ← from manifest `stack.networkName`
   - `{health_interval}` ← from manifest defaults
   - `{secrets_backend}` ← from module `secretsModule`
   - `{api_port}` ← from module `spring.portEnv`

3. **Output** targets:
   - Per-module: `apps/backend/docker-compose.dev.yml`, `.prod.yml`
   - Full stack: `ops/compose/stack/docker-compose.yml`

## Consumer Catalog (ops/compose/catalog.json)

Template-driven. Kit provides defaults; consumer overrides as needed.

Structure:
```json
{
  "features": {
    "worker": false  // or true if embedded worker sidecar
  },
  "templates": {
    "api_dev": "  {api_service}:\n    image: {api_image}\n    build:\n      context: {api_context}\n      dockerfile: {api_dockerfile_dev}\n    ports:\n      - \"${{API_PORT:-8090}}:${{API_PORT:-8090}}\"\n    volumes:\n      - {secrets_backend}/google-credentials.json:/app/google-credentials.json:ro\n    env_file:\n      - {secrets_backend}/.env.dev\n    ...",
    "api_prod": "...",
    "worker_dev": "...",
    "worker_prod": "...",
    "app_base": "...",
    "app_dev_overlay": "...",
    "app_stack_dev": "...",
    "app_stack_prod": "...",
    "stack_depends": "    depends_on:\n      {api_service}:\n        condition: service_healthy\n",
    "net_internal": "networks:\n  {network_key}:\n    name: {network_name}\n",
    "vols_prod": "volumes:\n  {api_storage_vol}:\n  {api_uploads_vol}:\n"
  },
  "targets": {
    "apps/backend/docker-compose.dev.yml": {
      "comment": "# Dev API...",
      "services": ["api_dev", "worker_dev"],
      "services_if": { "worker_dev": "worker" },  // condition for embedded worker
      "fmt": {
        "api_context": ".",
        "api_dockerfile_dev": "Dockerfile.dev",
        "secrets_backend": "../../ops/config/backend",
        "health_interval": "15s"
      },
      "networks": "net_internal"
    },
    "apps/backend/docker-compose.prod.yml": { ... },
    "apps/frontend/docker-compose.yml": { ... },
    "apps/retrieval-service/docker-compose.dev.yml": {
      "manifestModule": "retrieval",   // auto-generate from manifest
      "manifestProfile": "dev"
    },
    "ops/compose/stack/docker-compose.yml": {
      "manifestStack": "dev",          // stack mode (dev vs prod)
      "fmt": { ... global subs ... },
      "moduleFmt": {                   // per-module overrides
        "chat-api": { "resource_limits": "    mem_limit: 768m\n    cpus: 1\n" },
        "ingestion": { "resource_limits": "    mem_limit: 1g\n    cpus: 1.5\n" }
      },
      "networks": "net_internal"
    }
  }
}
```

## Template Placeholders

Kit always substitutes (no consumer override needed):

| Placeholder | Source | Example |
|-------------|--------|---------|
| `{api_service}` | `resolve_module_service_name("chat-api", ...)` | `geostat-chat-ai-chat-api` |
| `{app_service}` | primary UI module service name | `geostat-chat-ai-frontend` |
| `{worker_service}` | primary worker module service name | `geostat-chat-ai-ingestion` |
| `{network_key}` | sanitized network name | `geostat_chat_ai_net` |
| `{network_name}` | manifest `stack.networkName` | `geostat-chat-ai-net` |
| `{compose_project_name}` | repo folder name | `geostat-chat-ai` |
| `{api_port}` | module `spring.portEnv` default | `8090` |
| `{api_image}` | `{project}:{module}` | `geostat-chat-ai:chat-api` |
| `{secrets_backend}` | `../../ops/config/{secretsModule}` | `../../ops/config/backend` |
| `{health_interval}` | manifest defaults or `fmt` | `15s` (dev) / `30s` (prod) |
| `{health_retries}` | manifest | `5` (dev) / `3` (prod) |

## Generation Modes

### Per-Module (dev/prod pair)
- `apps/backend/docker-compose.dev.yml` (services: api_dev, worker_dev if enabled)
- `apps/backend/docker-compose.prod.yml` (services: api_prod, worker_prod)
- Env: `.env.dev` / `.env.prod` from `ops/config/backend`

### Full Stack (single file)
- `ops/compose/stack/docker-compose.yml`
- Services from all `stack.composeModules`
- Role-ordered: api → worker → ui (depends_on chains)
- Single network, shared infra services

## Embedded Worker (P0-kit-13)

If `modules.<api>.compose.embeddedWorker == true`:
- Worker container in same `docker-compose.*` as API
- Depends_on: API service must be healthy first
- Useful for: single Spring Boot project with worker sidecar

If disabled:
- Separate `apps/backend/worker/Dockerfile*` + standalone compose
- Useful for: microservices (chat-api separate from ingestion-service)

## Credential Binding

For each module with credentials:

```yaml
volumes:
  - {secrets_backend}/google-credentials.json:/app/google-credentials.json:ro
environment:
  GOOGLE_APPLICATION_CREDENTIALS: /app/google-credentials.json
```

Respects `modules.<id>.credentials[]`:
- `file` — relative to secrets folder
- `mount` — path in container (read-only)
- `envVar` — env var pointing to mount path

Global fallback: `adapters.gcp.*` if module has no override.

## Volume Strategy

### Dev (ephemeral)
- Source mount: `./` (watch for hot reload)
- node_modules volume (avoid sync conflict)

### Prod (persistent)
```yaml
volumes:
  api_storage:      # /app/storage (persistent data)
  api_uploads:      # /tmp/uploads (temporary, but survives restart)
  api_logs:         # ./logs (logs on host filesystem)
```

## Health Check Contracts

### Java (all roles)
```yaml
healthcheck:
  test: ["CMD-SHELL", "wget -qO- http://localhost:${API_PORT:-8090}/actuator/health | grep -q UP || exit 1"]
  interval: 15s (dev) / 30s (prod)
  timeout: 5s
  retries: 5 (dev) / 3 (prod)
  start_period: 60s (dev) / 90s (prod, api) / 120s (prod, ingestion)
```

### Node (ui)
```yaml
healthcheck:
  test: ["CMD", "wget", "-qO-", "http://localhost/"]
  interval: 30s
  timeout: 5s
  retries: 3
  start_period: 10s
```

## Manifest to Compose Mapping

| Manifest | Compose | Context |
|----------|---------|---------|
| `modules.<id>.role` | container role in health check chain | api-first (depends_on) |
| `modules.<id>.type` | driver → Dockerfile path | java-boot → Dockerfile.dev / node-vite → Dockerfile |
| `modules.<id>.path` | build context | `.` (relative to app dir) |
| `modules.<id>.secretsModule` | volume mount source | `ops/config/{name}` |
| `modules.<id>.spring.portEnv` | port binding `${VAR}` | API_PORT, RETRIEVAL_PORT, etc. |
| `stack.composeModules` | service order + depends_on chain | full stack orchestration |
| `stack.networkName` | network.name | internal communication |

## Build Process

1. `geostat compose-gen` (entry: `compose/build.py`)
2. Reads manifest + catalog.json
3. For each target: render templates, substitute placeholders
4. Write docker-compose.yml files (git-ignored or in stack/)
5. Driver then runs `docker compose up` (dev/docker mode)

No manual docker-compose.yml editing needed; regenerate anytime manifest changes.
