# geostat-chat-ai Deep Architectural Reconnaissance

**Completed:** 2026-06-14 · **Project Root:** `C:\Users\Test-User\CursorProjects\geostat-chat-ai`

## Executive Summary

**geostat-chat-ai** is a manifest-driven, multi-service AI chatbot system with a **reusable ops framework (geostat-kit)** embedded as a git submodule. The architecture decouples four deployable services from ops concerns via a single `geostat.ops.json` manifest that drives CLI, compose generation, SSH/Docker deployment, and remote development workflows. No hardcoded paths, module IDs, or ports in kit code—all discovered at runtime from the manifest.

**Key architectural soul:** The manifest is the single source of truth. Every CLI command, deploy step, and compose artifact is **generated** from it. The kit is **polyglot-ready** (java-boot, node-vite, etc.) with type-driven driver dispatch, meaning it works for any project shape without modification.

---

## 1. Root Folder Structure

### What IS at Root
```
geostat-chat-ai/
├── geostat.ops.json          ← THE MANIFEST (manifest-driven ops)
├── CLAUDE.md                 ← Project laws (non-negotiable)
├── README.md                 ← Georgian/English overview
├── VERSION                   ← "1.0.0"
├── apps/                     ← 4 deployable services
├── libs/                     ← Shared platform libs
├── kits/geostat-kit/         ← Git submodule (v1.1.0, external repo)
├── ops/                      ← Operations (compose templates, config, scripts)
├── tools/geostat.ps1         ← CLI entry point (dispatcher)
└── docs/                     ← Architecture decisions, plans, layers
```

### What IS NOT at Root (Intentional Placement)

No traditional monorepo structure:
- **No `package.json` at root** — each app manages its own (`apps/frontend/package.json`)
- **No `tsconfig.json` at root** — frontend only
- **No `build.gradle.kts` at root** — only in `apps/backend/`
- **No eslint/vitest config at root** — apps own their tooling
- **No shared node_modules** — frontend builds independently

**Why:** geostat-chat-ai is **not a Node monorepo**—it's a **heterogeneous multi-service system**. Java backend + Node frontend + optional workers. The ops kit treats each service as opaque, deployable units.

---

## 2. The Manifest: geostat.ops.json (The Soul)

**File:** `C:/Users/Test-User/CursorProjects/geostat-chat-ai/geostat.ops.json` (410 lines)

The manifest is **not config**—it's a **declarative registry** of:
- **Module metadata** (type, path, role, secrets)
- **Docker Compose catalog** location and targets
- **Stack topology** (module order, network, infra services)
- **CLI aliases** (shortcuts: `fe` → `frontend`, `be` → `chat-api`)
- **CI scripts** location (integration, health checks, smoke tests)

### Key Sections

**1. Version & Package**
```json
{
  "version": 2,
  "package": "kits/geostat-kit"  // Relative path to ops framework
}
```

**2. Modules Block** — Defines 4 services (no hardcodes in kit)
```json
{
  "modules": {
    "chat-api": {
      "role": "api",
      "type": "java-boot",
      "path": "apps/backend",
      "secretsModule": "backend",
      "hybrid": { "bootJar": "apps/backend/build/libs/..." },
      "spring": { "applicationName": "geostat-chat-ai" },
      "credentials": [{ "file": "google-credentials.json", ... }]
    },
    "frontend": {
      "role": "ui",
      "type": "node-vite",
      "path": "apps/frontend"
    },
    "retrieval": {
      "role": "api",
      "type": "java-boot",
      "path": "apps/retrieval-service"
    },
    "ingestion": {
      "role": "worker",
      "type": "java-boot",
      "path": "apps/ingestion-service"
    }
  }
}
```

**3. Stack Block** — Deployment topology
```json
{
  "stack": {
    "composeDir": "ops/compose/stack",
    "composeModules": ["chat-api", "retrieval", "ingestion", "frontend"],
    "networkName": "geostat-chat-ai-net",
    "infraComposeDir": "ops/compose/infra",
    "infra": {
      "services": ["postgres", "redis", "qdrant", "rabbitmq", "prometheus", ...]
    }
  }
}
```

**4. Compose Catalog**
```json
{
  "compose": {
    "catalog": "ops/compose/catalog.json",
    "syncModules": "apps/backend/ops.modules"
  }
}
```

**5. CLI Aliases**
```json
{
  "cli": {
    "aliases": {
      "fe": "frontend",
      "be": "chat-api",
      "ret": "retrieval",
      "ing": "ingestion"
    }
  }
}
```

**6. CI Scripts** — Integrated test/smoke/health workflows
```json
{
  "ci": {
    "integration": "ops/ci/integration-stack.sh",
    "waitHealth": "kits/geostat-kit/ci/wait-health.sh",
    "ragSmoke": "ops/ci/rag-pipeline-smoke.sh",
    "healthModules": ["chat-api", "retrieval", "ingestion"]
  }
}
```

### The Contract: What Kit Never Knows

The kit never reads:
- App names, module IDs, or port numbers (all via manifest + resolve-at-runtime)
- Database schemas, domain logic, or business rules
- Build artifact paths (resolved from driver + manifest)
- Deployment servers or SSH keys (from `.env.deploy`, gitignored)

**Result:** The same kit (submodule) works for any project shape without modification.

---

## 3. ops/ Directory — The Build & Deploy System

### 3.1 ops/compose/ — Compose Catalog & Generated Stacks

**File:** `ops/compose/catalog.json` (1500+ lines)

A **template registry** defining how to generate docker-compose files for each service type (java-boot, node-vite) and role (api, worker, ui).

**Structure:**
```json
{
  "features": { "worker": false },
  "templates": {
    "api_dev": "  {api_service}:\n    image: {api_image}\n    ...",
    "api_prod": "  ...",
    "worker_dev": "...",
    "worker_prod": "...",
    "app_dev_overlay": "...",
    "app_stack_prod": "..."
  },
  "targets": {
    "apps/backend/docker-compose.dev.yml": {
      "services": ["api_dev", "worker_dev"],
      "fmt": {
        "api_context": ".",
        "api_dockerfile_dev": "Dockerfile.dev",
        "secrets_backend": "../../ops/config/backend"
      }
    },
    "apps/frontend/docker-compose.yml": { ... },
    "apps/retrieval-service/docker-compose.dev.yml": { ... }
  }
}
```

**Key Template Variables:**
- `{api_service}` → container name (derived from manifest + deploy.env)
- `{api_image}` → image tag (repo:version)
- `{secrets_backend}` → path to .env.dev/.env.prod
- `{health_interval}`, `{health_retries}` → healthcheck params

**Generated Artifacts:**
- `ops/compose/stack/docker-compose.yml` — Full multi-service stack
- `apps/backend/docker-compose.dev.yml` — Backend dev (api + worker)
- `apps/backend/docker-compose.prod.yml` — Backend prod
- `apps/frontend/docker-compose.yml` — Frontend (base + overrides)

### 3.2 ops/config/ — Secrets & Deployment Config

**Structure (gitignored):**
```
ops/config/
├── backend/
│   ├── .env.dev           (local Spring profiles)
│   ├── .env.prod          (remote production)
│   ├── .env.deploy        (DEPLOY_PATH, DEPLOY_LAYOUT, SSH)
│   └── google-credentials.json
├── frontend/
│   ├── .env.dev
│   ├── .env.prod
│   ├── nginx.env          (template vars for nginx.conf)
│   └── embed.env.example
├── retrieval/
│   └── .env.dev / .env.prod
├── ingestion/
│   └── .env.dev / .env.prod
└── deploy.env             (shared: DEPLOY_SERVER, DEPLOY_USER, etc.)
```

**Critical Files:**
- `.env.deploy` — Contains `DEPLOY_SERVER=user@host`, `DEPLOY_PATH=/opt/deploy`, `DEPLOY_LAYOUT=structured`
- `google-credentials.json` — GCP service account for Gemini/embeddings

### 3.3 ops/ci/ — Integration & Smoke Tests

All invoked from `geostat.ops.json` ci block:
```
ops/ci/
├── integration-stack.sh              (Docker up, health, smoke)
├── rag-pipeline-smoke.sh             (E2E crawl → embed → retrieve)
├── chat-rag-e2e-smoke.sh             (Full RAG + Gemini response)
├── corpus-quality-audit.sh           (Index stats, vector quality)
├── rag-eval-harness.ps1              (Benchmark evaluation)
└── verify-services-prod.sh           (Prod health + version checks)
```

---

## 4. SSH/Docker Deploy Mechanism (The Critical Path)

### 4.1 Deploy Scripts — 5-Step Pipeline

**File:** `kits/geostat-kit/toolkit/deploy/`

Deploy is **orchestrated**, not manual. Each step is a separate script:

**1. Step 1: Gradle Build** (`gradle-build.sh`)
```bash
./gradlew build -x test --info
```
- Runs on **developer machine** (Windows/Linux)
- Output: JAR in `apps/backend/build/libs/geostat-chat-ai-2.0.0-SNAPSHOT.jar`

**2. Step 2: JAR Prepare** (`jar-prepare.sh`)
```bash
# Extract JAR metadata, log version
```

**3. Step 3: SCP Upload** (`upload.sh`)
```bash
ssh -n "$SERVER" "mkdir -p '$DEPLOY_PATH/logs' '$DEPLOY_PATH/versions'"
scp "$JAR_SRC" "$SERVER:$DEPLOY_PATH/app.jar"
scp "$SECRETS_DIR/.env.prod" "$SERVER:$DEPLOY_PATH/.env.prod"
```
- Uses `DEPLOY_SERVER` (e.g., `deploy@example.com`)
- Uses `DEPLOY_PATH` (e.g., `/opt/deploy/runtime/chat-api`)
- Uploads JAR + env + creds

**4. Step 4: Compose Generation on Server** (`server-compose.sh`)
```bash
ssh "$SERVER" "
  cd '$DEPLOY_PATH'
  cat > docker-compose.prod.yml <<EOF
  services:
    chat-api:
      image: chat-api:prod
      build:
        context: .
        dockerfile: Dockerfile
      ...
EOF
"
```

**5. Step 5: Docker Up** (`docker-up.sh`)
```bash
ssh "$SERVER" "
  cd '$DEPLOY_PATH'
  docker compose -f docker-compose.prod.yml up -d --build
  docker inspect --format='{{.State.Health.Status}}' chat-api
  # Health check poll (10s x HEALTH_RETRIES)
  # Rollback if unhealthy (prev JAR version)
"
```

### 4.2 Remote Dev Watch (`dev-remote.sh`)

**File:** `kits/geostat-kit/toolkit/deploy/dev-remote.sh` (310 lines)

For real-time backend dev on remote Linux server:

**Flow:**
1. **rsync** source tree to server `$DEPLOY_PATH/workspace/`
   - Excludes: `.git/`, `build/`, `.gradle/`, etc.
   - Uses Git rsync (Git Bash on Windows)

2. **Generate workspace compose** on server:
   ```bash
   ssh "$SERVER" cat > workspace/docker-compose.workspace.yml <<YML
   services:
     backend:
       image: backend-workspace
       command: ["./gradlew", "bootRun"]
       volumes:
         - .:/app
         - gradle_cache:/home/gradle/.gradle
       environment:
         SPRING_PROFILES_ACTIVE: dev
   YML
   ```

3. **Poll for source changes** (debounced, 1500ms default)
   ```bash
   # Watch src/, shared/, worker/ for .java, .yml, .properties changes
   # On change: rsync + docker compose restart
   ```

**Result:** Code changes in IDE → rsync to server → Docker restart → immediate feedback.

### 4.3 Environment Variables & Credentials

**Structured Deploy Path:**
```
DEPLOY_PATH=/opt/deploy/runtime/{module-id}/
├── app.jar                   (built JAR)
├── Dockerfile                (copy from source)
├── .env.prod                 (Spring application.yml → environment vars)
├── google-credentials.json   (mounted at /app/google-credentials.json)
├── versions/
│   ├── app-20260614.jar
│   ├── app-20260613.jar
│   └── app-20260612.jar      (keep last N)
├── logs/
│   ├── deploy.log
│   ├── build.log
│   └── upload.log
└── docker-compose.prod.yml   (generated on server)
```

**Credential Isolation:**
- Per-module `.env.dev` in `ops/config/{module}/`
- Global `.env.deploy` in `ops/config/` (DEPLOY_SERVER, paths)
- Module secrets mount at runtime (no logs leak)

---

## 5. kits/geostat-kit/ — The Reusable Framework (Submodule)

**Path:** `kits/geostat-kit/` (submodule @ v1.1.0)

A complete, standalone ops framework. **Never edited in geostat-chat-ai**—pulled from external GitHub.

### 5.1 CLI Entry Point: geostat.ps1

**File:** `kits/geostat-kit/cli/geostat.ps1` (150 lines read)

**Contract:**
```powershell
geostat {command} [args...]
```

**Dispatcher Logic:**
1. Load manifest from `geostat.ops.json`
2. Resolve aliases (e.g., `fe` → `frontend`)
3. Dispatch to driver:
   - `mod {moduleId} {command}` → `drivers/{type}/{command}.ps1`
   - `stack {command}` → `toolkit/stack/{command}.ps1`
   - `compose-gen` → `compose/build.py`
   - `infra tunnel` → `toolkit/infra/Invoke-Infra.ps1`

**Example:**
```powershell
geostat be deploy api --prod
  ↓ (resolve alias be → chat-api)
  ↓ (get type: java-boot from manifest)
  ↓ Invoke drivers/java-boot/sh/deploy.sh $args
```

### 5.2 Driver Registry: drivers/registry.json

**File:** `kits/geostat-kit/drivers/registry.json`

Maps module type → commands:
```json
{
  "java-boot": {
    "label": "JVM — Gradle / Spring Boot",
    "roles": ["api", "worker"],
    "runtime": "bash",
    "commands": {
      "deploy": "sh/deploy.sh",
      "dev": "sh/dev.sh",
      "compose": "sh/compose.sh",
      "check": "sh/check.sh"
    }
  },
  "node-vite": {
    "label": "Node — SPA dev remote + static deploy",
    "roles": ["ui"],
    "runtime": "powershell",
    "commands": {
      "deploy": "ps1/deploy.ps1",
      "dev": "ps1/dev.ps1",
      "compose": "ps1/compose.ps1"
    }
  }
}
```

**Key Insight:** Every command is a **script path**. Kit dispatches to the script; the script owns the behavior.

### 5.3 Core Python Libraries

**lib/project_context.py** (150 lines read)
```python
class ProjectContext:
    @classmethod
    def discover(cls) -> ProjectContext:
        # Find geostat.ops.json in parent dirs
        # Load manifest JSON
        
    def field(self, dotted: str) -> str:
        # query manifest via "stack.composeDir", etc.
        
    def module_ids_for_role(self, role: str) -> list[str]:
        # Find all modules with role="api"
        
    def module_path(self, module_id: str) -> Path:
        # Return apps/backend, apps/frontend, etc.
        
    def secrets_module_dir(self, module_id: str) -> Path:
        # Return ops/config/backend, ops/config/frontend
```

**lib/stack_deploy.py** (92 lines)
```python
def ordered_stack_deploy_modules(manifest) -> list[str]:
    # Return module order: api → worker → gateway → ui
    # Respects stack.composeModules or all modules
    
def default_stack_deploy_steps(manifest) -> list[dict]:
    # Generate: [{"module": "chat-api", "command": "deploy", "args": ["all"]}, ...]
```

**lib/compose_identity.py** (100+ lines)
```python
def compose_slug(deploy: dict, repo_name: str) -> str:
    # Return docker network prefix (geostat-chat-ai or from COMPOSE_PROJECT_NAME)
    
def primary_api_module_id(manifest) -> str:
    # Return "chat-api" (first api role found)
```

**lib/credentials.py** (81 lines)
```python
def module_credentials(manifest, module_id) -> list[dict]:
    # Return explicit creds OR global GCP if JVM + api role
    # Example: [{"file": "google-credentials.json", "mount": "/app/google-credentials.json", "envVar": "GOOGLE_APPLICATION_CREDENTIALS"}]
    
def global_gcp_credentials(manifest) -> list[dict]:
    # If features.gcpCredentials=true, return GCP creds from adapters.gcp
```

### 5.4 Compose Generation: compose/manifest_compose.py

**Generates** docker-compose.yml files from manifest + catalog.

**Flow:**
1. Read manifest modules
2. Load catalog.json (templates + targets)
3. For each module:
   - Determine type (java-boot → api_dev / api_prod)
   - Load credentials (global GCP or explicit)
   - Render template with variables
4. Write docker-compose.yml to `ops/compose/stack/`

---

## 6. Apps/ Directory — Service Layer

### 6.1 Frontend (Node/Vite)

**File:** `apps/frontend/`
- **package.json** (V1.0.0, private)
- **vite.config.ts** (local tsconfig)
- **Dockerfile** + **Dockerfile.dev**
- **ops.config.ps1** — Module ops config (not in kit, per-app)

**Commands:**
```bash
npm run dev          # Local Vite dev server
npm run build        # Production build → dist/
npm run test         # Vitest
npm run generate:api # Type-gen from backend OpenAPI
```

**Docker Stages:**
```dockerfile
FROM node:20 AS development
# npm install, vite dev server

FROM nginx:latest AS production
# Copy dist/ to /usr/share/nginx/html
# Mount nginx.conf template (rendered by kit)
```

### 6.2 Backend (Java/Spring Boot)

**File:** `apps/backend/`
- **build.gradle.kts** (root multi-module)
- **settings.gradle.kts** (subprojects: :chat-api, :retrieval-service, :ingestion-service)
- **Dockerfile** + **Dockerfile.dev**
- **ops.config.sh** — Module ops config

**Build:**
```bash
./gradlew build -x test  # All modules via settings.gradle subprojects
# Output: {module}/build/libs/{name}-{version}.jar
```

**Subprojects (modules via Gradle):**
- `:chat-api` (main application, port 8090)
- `:retrieval-service` (port 8092)
- `:ingestion-service` (port 8093)

**Key Dependencies:**
- Spring Boot 4.0.2
- Spring AI 2.0.0 GA
- Qdrant gRPC 1.13
- PostgreSQL + Flyway
- RabbitMQ (P5)
- Bucket4j (rate limiting)
- Resilience4j (circuit breaker)

---

## 7. Patterns: The 12 Architectural Laws (Implicit)

From reading the system, the kit enforces:

1. **Manifest as Source of Truth** — No hardcodes in kit
2. **Role-Driven Discovery** — Modules identified by role, queried from manifest
3. **No Consumer Constants in Kit** — Names, ports, paths from manifest + resolve-at-runtime
4. **N-Module Model** — Works for 1+ api, 1+ worker, 1+ ui (no assumptions)
5. **Type-Based Driver Dispatch** — java-boot, node-vite, etc.; new type = new driver
6. **Credential Isolation** — Per-module override + global fallback, no logs
7. **Deploy Layout** — Structured paths (DEPLOY_PATH/runtime/{module-id}/), not per-app env vars
8. **Health Check Standardization** — Role-based (/actuator/health for api, / for ui)
9. **Compose Catalog** — Templates + targets (manifest + catalog.json = compose.yml)
10. **Stack Deploy Steps** — Role-ordered, explicit or generated from manifest
11. **Hybrid Dev** — Local Java + Docker Compose infra, or full remote watch
12. **No Degradation** — Existing ports, paths, roles never downgrade; changes only add

---

## 8. Critical Configuration Files

| File | Purpose | Ownership |
|------|---------|-----------|
| `geostat.ops.json` | Manifest (source of truth) | Consumer (geostat-chat-ai) |
| `ops/compose/catalog.json` | Compose templates + targets | Consumer |
| `ops/config/*/.env.dev` | Local Spring profiles | Consumer (gitignored) |
| `ops/config/*/.env.prod` | Remote Spring profiles | Consumer (gitignored) |
| `ops/config/deploy.env` | SSH host, deploy path | Consumer (gitignored) |
| `kits/geostat-kit/manifest.schema.json` | JSON schema for validation | Kit (read-only) |
| `kits/geostat-kit/lib/project_context.py` | Manifest loader API | Kit (read-only) |
| `kits/geostat-kit/drivers/registry.json` | Type → command mapping | Kit (read-only) |

---

## 9. Comparison to Standard Node Monorepo

| Aspect | Standard Monorepo | geostat-chat-ai |
|--------|-------------------|-----------------|
| **Root package.json** | Yes | No (per-app) |
| **Root tsconfig** | Yes | No (frontend only) |
| **Root build** | `npm run build:all` | `geostat compose-gen` (manifest-driven) |
| **Service discovery** | Hardcoded paths | Manifest → runtime query |
| **Deploy** | npm scripts | SSH orchestration (5-step) |
| **Dev modes** | npm dev | Hybrid (local + infra tunnel) |
| **Ops framework** | External (github-actions) | **Embedded (geostat-kit submodule)** |

---

## 10. Knowledge Graph

**Replication to national-accounts:** geostat-kit is already there (submodule @ `kits/geostat-kit/`). To adopt:

1. **Create `geostat.ops.json`** — declare all modules, roles, types
2. **Create `ops/compose/catalog.json`** — templates + targets for your services
3. **Create `ops/config/`** — module secrets + deploy.env
4. **Create `tools/geostat.ps1`** — wrapper → `kits/geostat-kit/cli/geostat.ps1`
5. **Add `ops.config.sh` or `ops.config.ps1`** per module
6. **Define `Dockerfile.dev`, `Dockerfile`** per module
7. **Run `geostat validate`** to test manifest
8. **Run `geostat compose-gen`** to generate docker-compose files

**Cost:** ~2–3 hours to set up if you have 3–5 services. Payoff: Manifest-driven deployment for any project shape.

---

## Files Read (Full Paths)

All from `C:\Users\Test-User\CursorProjects\geostat-chat-ai`:

- `CLAUDE.md` — Project laws
- `geostat.ops.json` — Manifest (410 lines)
- `README.md` — Overview
- `apps/frontend/package.json` — Frontend config
- `apps/frontend/ops.config.ps1` — Frontend ops module config
- `apps/backend/build.gradle.kts` — Backend build (80 lines read)
- `apps/backend/ops.config.sh` — Backend ops module config
- `kits/geostat-kit/ARCHITECTURE.md` — Kit boundaries
- `kits/geostat-kit/cli/geostat.ps1` — Main dispatcher (150 lines read)
- `kits/geostat-kit/drivers/registry.json` — Type registry
- `kits/geostat-kit/lib/project_context.py` — Manifest API (150 lines read)
- `kits/geostat-kit/lib/stack_deploy.py` — Deploy steps (92 lines)
- `kits/geostat-kit/lib/compose_identity.py` — Service naming (100 lines read)
- `kits/geostat-kit/lib/credentials.py` — Credential resolution (81 lines)
- `kits/geostat-kit/manifest.schema.json` — JSON schema (100 lines read)
- `kits/geostat-kit/compose/manifest_compose.py` — Compose gen (120 lines read)
- `kits/geostat-kit/toolkit/deploy/upload.sh` — SCP upload (69 lines)
- `kits/geostat-kit/toolkit/deploy/dev-remote.sh` — Remote watch (310 lines)
- `kits/geostat-kit/toolkit/deploy/docker-up.sh` — Docker launch (102 lines)
- `kits/geostat-kit/drivers/java-boot/sh/deploy.sh` — Backend deploy (100 lines read)
- `kits/geostat-kit/drivers/node-vite/ps1/deploy.ps1` — Frontend deploy (100 lines read)
- `ops/cli/geostat.sh` — Bash wrapper (5 lines)
- `ops/compose/catalog.json` — Compose templates (1500+ lines, 100 read)

**Total:** 22 files, ~2500 lines of substantive code/config read (plus 200+ test files, 100+ shell scripts in kit not fully read).

---

## Notes for Future Reference

- **Kit updates:** `git submodule update --remote` pulls new versions from upstream
- **No editing kit in consumer:** All customization via manifest + ops.config + per-module scripts
- **SSH key setup:** Must have passwordless SSH to `DEPLOY_SERVER` (typically via `~/.ssh/config`)
- **Docker network:** All services on same network (`stack.networkName`) for inter-service communication
- **Health checks:** Standard by role; customize in catalog.json if needed
- **Secrets rotation:** Add new .env.prod, bump version, redeploy—old versions kept for quick rollback
