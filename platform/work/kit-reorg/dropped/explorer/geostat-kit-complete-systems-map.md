# geostat-kit Complete Systems Map — Ops Orchestration & Kit Architecture

**Date:** 2026-06-14  
**Scope:** Full `ops` and `kits/geostat-kit` directory exploration  
**Kit Version:** 1.0.0 (released 2026-05-21)

---

## Executive Summary

**geostat-kit** is a **manifest-driven ops package** (not application code). It orchestrates multi-module polyglot projects (Java/Spring, Node/Vite, etc.) without hardcoding module names, paths, or ports. All configuration flows through a single **`geostat.ops.json`** manifest that the kit reads at runtime.

**What it provides:**
- CLI dispatcher (`geostat` command) that routes to module-specific drivers
- Docker Compose generation (manifest → docker-compose.yml files)
- Credentials management (per-module or global GCP fallback)
- Environment configuration contracts
- Remote SSH deploy framework
- CI integration scaffold
- Credential file binding (no secrets in logs)

**What it does NOT include:**
- Application code, business logic, deployable artifacts
- Production secrets (manifests reference, don't embed)
- Any hardcoded app names, module IDs, or infrastructure
- Test or staging infra (consumer owns those)

---

## 1. PROJECT STRUCTURE

### ops/ — Consumer Operations Directory

**Consumption** (consumer project provides these; kit reads them):

```
ops/
├── config/                          # ← All real config values (gitignored)
│   ├── .env.example                 # Full contract documentation
│   ├── deploy.env.example           # SSH deploy base + project slug
│   ├── deploy.env                   # Actual deploy config (gitignored)
│   ├── ssh/                         # Optional SSH keys/config (gitignored)
│   │   ├── id_rsa, id_rsa.pub       # Private key
│   │   ├── config                   # SSH host aliases
│   │   └── .gitignore
│   ├── infra/                       # Data store configs
│   │   ├── .env.dev, .env.deploy
│   │   ├── .env.example
│   │   └── google-credentials.json (optional)
│   ├── backend/ (or chat-api)       # Module-specific env
│   │   ├── .env.dev                 # Local development
│   │   ├── .env.prod                # Production (for compose)
│   │   ├── .env.deploy              # Deploy scripts (module-specific paths)
│   │   ├── google-credentials.json  # Service account
│   │   └── .env.example, .env.deploy.example
│   ├── frontend/                    # UI module env
│   │   ├── .env.dev, .env.prod, .env.deploy
│   │   ├── nginx.env                # CSP headers, domains
│   │   ├── embed.env                # Embed mode config
│   │   └── .env.example, .env.deploy.example
│   ├── retrieval/                   # RAG search service (separate java-boot)
│   │   ├── .env.dev, .env.prod, .env.deploy.example
│   │   └── google-credentials.json
│   ├── ingestion/                   # Crawl/index service (worker role)
│   │   ├── .env.dev, .env.prod, .env.deploy.example
│   │   └── google-credentials.json
│   ├── profiles/                    # Optional feature toggles
│   │   ├── worker-disabled.md       # Disable embedded worker
│   │   └── legacy-server.env.example
│   └── README.md
│
├── cli/                             # Wrapper / documentation (kit reads toolkit/)
│   ├── geostat.sh                   # Bash shim (calls toolkit)
│   ├── geostat.ps1                  # PowerShell shim (calls toolkit)
│   └── README.md
│
├── compose/                         # Generated + Consumer Compose Files
│   ├── catalog.json                 # ← SOURCE: Templates + Targets (compose-gen input)
│   │                                #   Keys: templates, features, targets
│   │                                #   Features: worker (bool), custom flags
│   │                                #   Targets: { "apps/backend/docker-compose.yml": {...} }
│   ├── stack/                       # Generated full-stack (kit produces these)
│   │   ├── docker-compose.yml       # Generated (dev)
│   │   ├── docker-compose.prod.yml  # Generated (prod)
│   │   └── README.md
│   ├── infra/                       # Database/cache/queue infrastructure
│   │   ├── docker-compose.base.yml  # Base + service fragments
│   │   ├── docker-compose.prod.yml  # Prod overlay (logging, restart)
│   │   ├── services/                # Per-service fragments
│   │   │   ├── postgres.yml
│   │   │   ├── redis.yml
│   │   │   ├── qdrant.yml
│   │   │   ├── rabbitmq.yml
│   │   │   ├── minio.yml
│   │   │   ├── prometheus.yml, grafana.yml, loki.yml, tempo.yml
│   │   │   └── pgbouncer.yml
│   │   └── README.md
│   └── stack/                       # README (not consumed directly)
│
├── ci/                              # Consumer CI Scripts
│   ├── integration-stack.sh          # ← Orchestrates full test (infra + stack + smoke)
│   ├── seed-stack-integration-env.sh # Populates .env.dev for CI
│   ├── prepare-integration-env.sh    # In-kit (copied path)
│   ├── wait-health.sh               # In-kit health check waiter
│   ├── wait-stack-health.sh         # Consumer-specific endpoint checks
│   ├── rag-pipeline-smoke.sh        # Project-specific smoke tests
│   ├── chat-rag-e2e-smoke.sh        # E2E tests
│   ├── rag-eval-smoke.ps1           # Evaluation suite
│   ├── chat-catalog-rag-smoke.ps1   # Catalog + RAG integration
│   ├── rag-p1-cutover.ps1           # Derivation phase cutover
│   ├── rag-eval-gate.ps1            # Evaluation gate (block deploy)
│   └── logs/                         # Test run outputs
│
└── eval/                            # RAG evaluation (project-specific)
    ├── baseline.json                # Baseline metrics
    ├── baseline.yaml-frozen.json    # Frozen for cutover gate
    └── reports/
        ├── 2026-05-25.json
        ├── 2026-05-26.json
        └── ...
```

### kits/geostat-kit/ — The Kit Package

**Distribution** (the reusable ops package):

```
kits/geostat-kit/
├── README.md                        # Install + quick start
├── ARCHITECTURE.md                  # Boundaries + entry points
├── CHANGELOG.md                     # Version history
├── VERSION                          # Current: 1.0.0
├── manifest.schema.json             # JSON schema for geostat.ops.json validation
│
├── lib/                             # Core resolution & helper library
│   ├── project_context.py           # **API**: ProjectContext.discover() + accessors
│   ├── modules.py                   # N-module logic (roles, types, CLI aliases)
│   ├── modules_cli.py               # Layout + module filtering
│   ├── manifest_defaults.py         # Scaffold defaults (single source)
│   ├── credentials.py               # Module creds + global GCP fallback
│   ├── compose_identity.py          # Docker service naming rules
│   ├── project.sh / project.ps1     # Bash/PowerShell project root discovery
│   ├── env.sh / env.ps1             # Load manifest + build env vars
│   ├── drivers.ps1 / drivers.sh     # Driver registry lookup
│   ├── ci_prepare.py                # CI scaffold generator
│   ├── ci_health.py                 # Health check orchestration
│   ├── stack_deploy.py              # Deploy step ordering
│   ├── stack_endpoints.py           # Port resolution
│   ├── manifest_migrate.py          # v1→v2 migration
│   ├── validate_manifest.py         # Schema + project checks
│   ├── vscode_gen.py                # VS Code launch.json generator
│   ├── infra_tunnel.py              # SSH tunnel helpers
│   ├── deploy-defaults.json         # Deploy layout defaults
│   └── env.ps1                      # PowerShell env loading
│
├── drivers/                         # Module type implementations
│   ├── registry.json                # **DRIVER REGISTRY**
│   │                                #   type → label, runtime, commands
│   │                                #   Ext: java-boot, node-vite, node-api
│   ├── registry.schema.json         # Schema for registry
│   │
│   ├── java-boot/                   # Spring Boot / Gradle modules
│   │   ├── sh/
│   │   │   ├── _init.sh             # Common env setup
│   │   │   ├── modules.sh           # Module discovery in JAR
│   │   │   ├── compose.sh           # Compose (env.dev|prod → compose up)
│   │   │   └── dev.sh               # Remote dev: rsync + bootRun watch
│   │   └── README.md
│   │
│   ├── node-vite/                   # Vite frontend + rollup
│   │   ├── ps1/
│   │   │   ├── _common.ps1          # Env setup
│   │   │   ├── compose.ps1          # Compose w/ dev/prod variants
│   │   │   ├── check.ps1            # Syntax/lint checks
│   │   │   └── watch.ps1            # rsync + npm dev watch
│   │   └── README.md
│   │
│   ├── node-api/                    # Placeholder for Node HTTP API
│   │   └── README.md
│   │
│   ├── _template/                   # Template for new drivers
│   │   └── README.md
│   │
│   └── README.md                    # How to add drivers
│
├── compose/                         # Compose generation engine
│   ├── build.py                     # **ENTRY**: manifest → docker-compose.yml
│   ├── manifest_compose.py          # Module service rendering (N modules)
│   ├── infra-catalog.json           # Base infra service templates (NOT USED for catalog)
│   ├── stack-catalog.json           # Stack overlay templates (NOT USED for catalog)
│   └── README.md
│
├── toolkit/                         # High-level orchestration
│   ├── stack/
│   │   ├── compose.sh               # Full-stack compose wrapper
│   │   └── endpoints.sh             # Show URLs after up
│   │
│   ├── deploy/
│   │   ├── stack-remote.sh          # Multi-module remote deploy
│   │   ├── deploy.sh / deploy.ps1   # Module deploy orchestration
│   │   ├── common.sh                # Shared deploy helpers
│   │   ├── dev-remote.sh            # Remote dev (rsync + watch)
│   │   ├── manage.sh / manage.ps1   # Logs, status, delete, etc.
│   │   └── README.md
│   │
│   ├── init/
│   │   ├── Invoke-ProjectInit.ps1   # Scaffold generator
│   │   ├── init.sh
│   │   └── README.md
│   │
│   └── infra/
│       ├── Invoke-Infra.ps1         # Infrastructure lifecycle (up/down/status)
│       ├── ensure-prereqs.sh        # Docker/etc validation
│       └── README.md
│
├── adapters/                        # Env generators for external tools
│   ├── render_nginx.py              # CSP + domain injection for nginx.conf
│   └── README.md
│
├── cli/                             # Entry points
│   ├── geostat.sh                   # Bash dispatcher
│   ├── geostat.ps1                  # PowerShell dispatcher (primary)
│   └── README.md
│
├── contracts/                       # CLI contracts
│   ├── MANAGE-CONTRACT.md           # Unified manage verbs (status, logs, delete, etc.)
│   ├── README-MANAGE-LOGS.md        # Log source mapping
│   ├── manage-logs.contract.json    # Structured log source config
│   └── README.md
│
├── ci/                              # Generic CI helpers
│   ├── prepare-integration-env.sh   # Generate .env files from examples
│   ├── wait-health.sh               # HTTP health wait
│   ├── wait-stack-health.sh         # Multi-endpoint orchestrator (consumer extends)
│   └── README.md
│
├── scaffold/                        # Template for new consumer projects
│   ├── geostat.ops.json             # **DEFAULT MANIFEST** (scaffold defaults)
│   ├── .gitignore.example
│   ├── apps/
│   │   ├── backend/
│   │   │   ├── .env.example
│   │   │   ├── ops.config.sh        # Backend ops config (sourced by deploy)
│   │   │   └── logs/.gitignore
│   │   └── frontend/
│   │       ├── .env.example
│   │       ├── ops.config.ps1       # Frontend ops config
│   │       └── logs/.gitignore
│   ├── ops/
│   │   ├── config/
│   │   │   ├── .env.example
│   │   │   ├── .gitignore
│   │   │   ├── deploy.env.example
│   │   │   ├── profiles/
│   │   │   ├── ssh/
│   │   │   │   ├── config.example
│   │   │   │   ├── id_ed25519.example
│   │   │   │   └── .gitignore
│   │   │   └── README.md
│   │   ├── compose/
│   │   │   ├── README.md
│   │   │   ├── catalog.full.json    # Full-featured catalog template
│   │   │   ├── catalog.minimal.json # Starter template
│   │   │   ├── infra/
│   │   │   │   ├── docker-compose.base.yml
│   │   │   │   ├── docker-compose.prod.yml
│   │   │   │   ├── services/
│   │   │   │   └── README.md
│   │   │   └── stack/
│   │   │       └── README.md
│   │   └── ci/
│   │       ├── integration-stack.sh # Template
│   │       └── README.md
│   └── tools/
│       └── README.md
│
├── scripts/                         # Testing + verification
│   ├── dev-modes-verify.sh          # Smoke test all dev modes
│   ├── module-ops-smoke.sh          # Module CLI checks
│   └── publish-git.ps1              # Release automation
│
├── tests/                           # Pytest suite (180+ tests)
│   ├── test_manifest_defaults.py
│   ├── test_ci_health.py
│   ├── test_toolkit_hardcodes.py    # **Bans app names in code**
│   ├── test_backend_deploy_watch.py
│   ├── test_backend_dev_remote.py
│   ├── run-kit-tests.sh
│   ├── fixtures/
│   │   └── golden-consumer/
│   │       └── geostat.ops.json
│   └── README.md
│
├── docs/                            # Full documentation
│   ├── INSTALL.md                   # Installation (submodule, shim setup)
│   ├── ADOPTION.md                  # What's included
│   ├── ADOPTION-LINE.md             # Full adoption checklist
│   ├── STARTER.md                   # Quick-start guide
│   ├── PACKAGE-ARCHITECTURE.md      # This package's design
│   ├── GOLDEN-PATHS.md              # Canonical deploy flows
│   ├── GOLDEN-PATHS-BACKEND.md      # Backend-specific flows
│   ├── MATURITY.md                  # Stability, roadmap
│   ├── PACKAGE.md                   # Detailed package spec
│   ├── DEV-MODES.md                 # local/hybrid/docker/remote
│   ├── LOCAL-DEBUG.md               # VS Code Run and Debug setup
│   ├── REMOTE-DEV-JAR-FLOW.md       # Hybrid boot + rsync
│   ├── REMOTE-DEV-DOCKERFILE-FLOW.md # Container dev mode
│   └── README.md
│
└── .git/                            # Git history (submodule or repo copy)
```

---

## 2. CORE CONCEPTS

### A. Single Source of Truth: geostat.ops.json

**Where:** Project root (not in kit)  
**Format:** JSON  
**Schema:** `kits/geostat-kit/manifest.schema.json` (v2)

**Required fields:**
```json
{
  "version": 2,
  "package": "kits/geostat-kit",          // Path to this kit
  "secrets": "ops/config",                 // Where env files live
  "compose": {
    "catalog": "ops/compose/catalog.json"  // Source for docker-compose gen
  },
  "modules": {
    "chat-api": {
      "role": "api",                       // ui|api|worker|gateway|data|other
      "type": "java-boot",                 // Driver type
      "path": "apps/backend",              // Source tree
      "secretsModule": "backend"           // Subfolder under secrets
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

**What the kit reads at runtime:**
1. Module definitions (id, type, role, path, secrets folder)
2. Driver registry (type → command scripts)
3. Credentials (per-module or global GCP)
4. Compose catalog (templates + targets)
5. CLI aliases (`fe` → `frontend`, `be` → `chat-api`)
6. Stack deploy steps (api/worker/ui order)
7. CI hooks (which scripts to run, which modules to health-check)

**What the kit NEVER hardcodes:**
- `chat-api`, `frontend`, `backend`, `retrieval`, `ingestion` (all in manifest)
- Paths like `apps/backend`, `ops/config` (all from manifest)
- Ports like 8090, 5177 (all from `.env` files + port resolution)
- Service names like `geostat-chat-ai-api` (derived from modules + deploy.env overrides)
- Credentials files, mounts, env var names (all declarative)

### B. Driver Model (Type-Based Dispatch)

**Registry:** `kits/geostat-kit/drivers/registry.json`

```json
{
  "java-boot": {
    "label": "Spring Boot / Gradle",
    "runtime": "bash",
    "commands": {
      "compose": "sh/compose.sh",
      "dev": "sh/dev.sh",
      "deploy": "sh/deploy.sh",
      "manage": "sh/manage.sh",
      "modules": "sh/modules.sh"
    }
  },
  "node-vite": {
    "label": "Vite + rollup frontend",
    "runtime": "powershell",
    "commands": {
      "compose": "ps1/compose.ps1",
      "check": "ps1/check.ps1",
      "deploy": "ps1/deploy.ps1",
      "manage": "ps1/manage.ps1",
      "watch": "ps1/watch.ps1"
    }
  }
}
```

**Resolution flow:**
1. User: `geostat fe deploy --prod` (or `geostat mod frontend deploy --prod`)
2. CLI resolves `fe` → `frontend` via manifest `cli.aliases`
3. CLI reads `modules.frontend.type` → `node-vite`
4. CLI looks up `node-vite` in driver registry
5. CLI finds command `deploy` → `ps1/deploy.ps1`
6. CLI runs (PowerShell) `kits/geostat-kit/drivers/node-vite/ps1/deploy.ps1`
7. That script sources `lib/env.ps1` to load manifest + build env
8. Script runs `docker compose`, `rsync`, etc. with resolved values

**Adding a new driver:**
1. Copy `drivers/_template/` → `drivers/node-api/`
2. Implement `compose.sh`, `deploy.sh`, `manage.sh`, etc.
3. Register in `registry.json`
4. Set `modules.new-api.type = "node-api"` in consumer manifest

### C. Environment File Contract

**Per-module structure:**
```
ops/config/<module>/
├── .env.dev              # Local development (imported by compose)
├── .env.prod             # Production (for docker compose)
├── .env.deploy           # Deploy scripts (DEPLOY_LAYOUT, DEPLOY_PATH, etc.)
├── .env.example          # Documentation (version control)
└── .env.deploy.example   # Deploy example
```

**Shared file:**
```
ops/config/
├── deploy.env            # DEPLOY_SERVER, DEPLOY_PROJECT, SSH keys (gitignored)
├── deploy.env.example    # Template
└── README.md             # Contract
```

**Load order (by tool):**
- `docker compose up`: `--env-file ops/config/<module>/.env.dev`
- `geostat be deploy`: `ops/config/backend/.env.*` + `ops/config/deploy.env`
- `geostat be dev`: `ops/config/backend/.env.deploy` (DEPLOY_LAYOUT only)
- Vite build: `ops/config/frontend/.env.prod` (via `--mode prod`)

### D. Credentials Management (No Secrets in Code)

**Architecture:**
```
Per-module credentials[] or global GCP fallback
        ↓
lib/credentials.py → module_credentials(manifest, module_id)
        ↓
Render in compose: volumes + environment mount points
        ↓
docker-compose.yml: /app/google-credentials.json:ro (read-only)
        ↓
env var injection: GOOGLE_APPLICATION_CREDENTIALS=/app/google-credentials.json
```

**Resolution rules:**
1. **Check module explicit creds** (`modules.chat-api.credentials[]`)
   - If present, use those files (override global)
2. **Check global GCP** (`features.gcpCredentials=true`)
   - If enabled and module accepts it (api/worker/java-boot), use global
3. **Fallback:** None (module runs without credentials)

**Example from manifest:**
```json
"chat-api": {
  "credentials": [
    {
      "file": "google-credentials.json",
      "mount": "/app/google-credentials.json",
      "envVar": "GOOGLE_APPLICATION_CREDENTIALS"
    }
  ]
}
```

**In generated compose:**
```yaml
chat-api:
  volumes:
    - ops/config/backend/google-credentials.json:/app/google-credentials.json:ro
  environment:
    GOOGLE_APPLICATION_CREDENTIALS: /app/google-credentials.json
```

---

## 3. COMPOSE GENERATION PIPELINE

### Input Files
- **Manifest:** `geostat.ops.json` (modules, modules.*.path, modules.*.role, etc.)
- **Catalog:** `ops/compose/catalog.json` (templates + targets)
- **Module paths:** Project app directories (Dockerfile locations)

### Processing Steps

**Step 1: Load manifest + catalog**
```python
# compose/build.py → main()
manifest = load_manifest(project_root)
templates, targets, features = load_catalog(root)
```

**Step 2: Resolve global formatting**
```python
fmt_global = global_fmt(root)
# Includes: api_service, api_image, network_key, compose_project_name, etc.
# From: deploy.env + manifest + repo name
```

**Step 3: Per-target generation**
```python
for target_path, spec in targets.items():
    if spec.get("manifestStack"):
        # Full-stack mode: render all modules
        from manifest_compose import build_manifest_stack_services
        body = build_manifest_stack_services(ctx, profile="dev", ...)
    elif spec.get("manifestModule"):
        # Single-module mode: one module
        from manifest_compose import build_single_module_compose
        body = build_single_module_compose(ctx, module_id="chat-api", ...)
    else:
        # Template mode: simple templates
        services = resolve_services(spec, features)
        body = render(templates, services, fmt_global)
    
    # Write to disk
    target_path.write_text(HEADER + body)
```

**Step 4: Service naming**
- Source: `lib/compose_identity.py` → `resolve_module_service_name()`
- Input: module_id, role, target name, deploy.env overrides
- Output: docker service name (e.g., `geostat-chat-ai-api`, `geostat-chat-ai-app`)
- Rule: Slug from `COMPOSE_PROJECT_NAME` (or repo folder) + role-based or explicit target

### Output Files

Generated in consumer project:
```
apps/backend/docker-compose.dev.yml      # API + optional worker
apps/backend/docker-compose.prod.yml
apps/frontend/docker-compose.yml         # Base
apps/frontend/docker-compose.override.yml # Dev (auto-merged)
apps/frontend/docker-compose.prod.yml
apps/retrieval-service/docker-compose.dev.yml
apps/retrieval-service/docker-compose.prod.yml
apps/ingestion-service/docker-compose.dev.yml
apps/ingestion-service/docker-compose.prod.yml
ops/compose/stack/docker-compose.yml     # Full stack dev
ops/compose/stack/docker-compose.prod.yml
```

### Catalog Structure (`ops/compose/catalog.json`)

**Top-level keys:**
```json
{
  "features": {
    "worker": false           // Feature toggle: enable embedded worker?
  },
  "templates": {
    "api_dev": "...",         // Jinja-like template with {variable} placeholders
    "app_dev_overlay": "...",
    "net_internal": "networks: ...",
    "vols_prod": "volumes: ..."
  },
  "targets": {
    "apps/backend/docker-compose.dev.yml": {
      "comment": "# Dev API",
      "services": ["api_dev", "worker_dev"],
      "services_if": { "worker_dev": "worker" },  // Only include if features.worker=true
      "fmt": {
        "api_context": ".",
        "api_dockerfile_dev": "Dockerfile.dev",
        "secrets_backend": "../../ops/config/backend",
        ...
      },
      "networks": "net_internal"  // Reference to template key
    }
  }
}
```

**Types of targets:**

1. **Simple template mode** (most)
   - `services` + `services_if` → select templates
   - `fmt` → override global format vars
   - Render templates + substitute

2. **Manifest mode** (dynamic)
   - `manifestStack: "dev"` → render all modules from manifest
   - `manifestProfile: "prod"`
   - Kit reads manifest + generates service blocks for each module
   - Used for: stack compose, retrieval, ingestion (N modules)

3. **Mixed mode** (rare)
   - Combine template mode + manifest mode

---

## 4. RUNTIME RESOLUTION (ProjectContext API)

**Python entry point:** `lib/project_context.py`

```python
from lib.project_context import ProjectContext

# Discover project root + load manifest
ctx = ProjectContext.discover()

# Access manifest fields
ctx.field("secrets")                    # "ops/config"
ctx.field("compose.catalog")            # "ops/compose/catalog.json"

# Module queries
ctx.list_module_ids()                   # ["chat-api", "frontend", "retrieval", "ingestion"]
ctx.module_id_for_role("api")           # "chat-api" (first api-role module)
ctx.module_ids_for_role("api")          # ["chat-api", "retrieval"]
ctx.module_id_for_type("node-vite")     # "frontend"
ctx.get_module_role("frontend")         # "ui"

# Path resolution
ctx.module_path("frontend")             # /project/apps/frontend
ctx.secrets_module_dir("backend")       # /project/ops/config/backend
ctx.secrets_folder_path("backend")      # (same)
ctx.stack_compose_dir                   # /project/ops/compose/stack
ctx.catalog_path                        # /project/ops/compose/catalog.json

# Credentials
ctx.module_credentials_list("chat-api") # [{"file": "...", "mount": "...", "envVar": "..."}]
ctx.gcp_credentials_filename()          # "google-credentials.json" (if global enabled)

# Composition
ctx.compose_service_names()             # {"chat-api": "geostat-chat-ai-api", ...}

# Composition
ctx.cli_aliases()                       # {"fe": "frontend", "be": "chat-api", ...}
ctx.resolve_alias("fe")                 # "frontend"
```

**Bash/PowerShell equivalents:**
- `geostat_secrets_dir_for_module backend`
- `geostat_module_id_for_type node-vite`
- `Get-ManifestModulePath (Get-ModuleIdByRole api 0)`
- `Resolve-CliAlias fe`

---

## 5. PACKAGE.JSON / TSCONFIG.JSON HANDLING

**Kit does NOT generate or manage these.** They live in application code.

### Backend (Java/Gradle)
- No `package.json` (Spring Boot uses `build.gradle`)
- Kit's driver runs: `gradle build`, `gradle bootRun`, `gradle bootJar`
- Paths resolved from manifest: `modules.chat-api.path` → `apps/backend`
- `build.gradle` lives in `apps/backend/` (consumer manages it)

### Frontend (Node/Vite)
- **`package.json`** lives in `apps/frontend/` (consumer manages it)
- **`vite.config.js`** also lives in `apps/frontend/`
- **`tsconfig.json`** (same)
- Kit driver runs: `npm install`, `npm run build`, `npm run dev`, `npm run check`
- Environment variables passed via `--mode dev` or `--mode prod` + `.env.dev`, `.env.prod`
- **Vite mode** → env files (e.g., `VITE_API_URL` from `.env.dev`)

### No Centralization
- Each app owns its tooling config (no generated files from kit)
- `geostat compose-gen` only touches `docker-compose*.yml`
- No `package.json` generation or overwriting
- No `tsconfig.json` generation

---

## 6. KEY ENTRY POINTS & COMMANDS

### User-Facing Commands

```powershell
# Help
.\tools\geostat.ps1 help

# Validate manifest
.\tools\geostat.ps1 validate

# Compose generation
.\tools\geostat.ps1 compose-gen

# Full-stack local dev
.\tools\geostat.ps1 stack up -d --build

# Module-specific
.\tools\geostat.ps1 be deploy --prod          # Backend deploy
.\tools\geostat.ps1 fe deploy --Environment prod
.\tools\geostat.ps1 ret compose up --build    # Retrieval service
.\tools\geostat.ps1 ing compose               # Ingestion service

# Remote development
.\tools\geostat.ps1 be dev bootstrap
.\tools\geostat.ps1 be dev watch --debounce-ms 1500

# Manage (logs, status, delete)
.\tools\geostat.ps1 be manage api logs errors --prod
.\tools\geostat.ps1 fe manage status
.\tools\geostat.ps1 fe manage delete

# CI
.\tools\geostat.ps1 init                      # Scaffold new project
bash ops/ci/integration-stack.sh              # Full CI test
```

### Kit Entry Points

| Command | File | Role |
|---------|------|------|
| `geostat compose-gen` | `compose/build.py` | Generate docker-compose.yml |
| `geostat validate` | `lib/validate_manifest.py` | Check manifest against schema |
| `geostat migrate` | `lib/migrate_manifest.py` | v1→v2 migration hints |
| `geostat vscode-gen` | `lib/vscode_gen.py` | Generate VS Code launch.json |
| `geostat stack` | `toolkit/stack/compose.sh` | Full-stack compose wrapper |
| `geostat infra` | `toolkit/infra/Invoke-Infra.ps1` | Infra lifecycle |
| `geostat init` | `toolkit/init/Invoke-ProjectInit.ps1` | Scaffold new project |
| `geostat mod <id> <cmd>` | `lib/modules_cli.py` + drivers | Route to driver |
| `geostat layout` | `toolkit/layout/` | Module layout simulator |
| `geostat nginx-gen` | `adapters/render_nginx.py` | Generate nginx.conf |

---

## 7. CI INTEGRATION PATTERN

### Consumer Integration Script: `ops/ci/integration-stack.sh`

```bash
#!/bin/bash
# Project-specific orchestration (manifest drives it)

# 1. Source kit libraries (universal)
source "$PKG/lib/project.sh"
source "$PKG/lib/env.sh"

# 2. Discover from manifest (kit API)
STACK_DIR="$(geostat_read_manifest_field stack.composeDir)"
infra_service_ids() {
  # Python → manifest.stack.infra.services
  python3 -c "
from lib.project_context import ProjectContext
services = ProjectContext.discover().manifest.get('stack',{}).get('infra',{}).get('services',[])
for sid in services: print(sid)
"
}

# 3. Orchestrate infra (base + services from manifest)
build_infra_compose_args() {
  ARGS=(-f "$INFRA_DIR/docker-compose.base.yml")
  while read -r sid; do
    ARGS+=(-f "$INFRA_DIR/services/${sid}.yml")  # postgres.yml, redis.yml, etc.
  done < <(infra_service_ids)
}

# 4. Generate compose (kit does this)
python3 "$PKG/compose/build.py"

# 5. Run infra + stack
docker compose "${INFRA_ARGS[@]}" --env-file "$INFRA_ENV" up -d --wait
docker compose ... -f ops/compose/stack/docker-compose.yml up -d --build

# 6. Health checks
bash "$PKG/ci/wait-stack-health.sh"  # Consumer extends this

# 7. Project-specific smoke
bash "$ROOT/ops/ci/rag-pipeline-smoke.sh"
```

### What Kit Provides vs. What Consumer Provides

**Kit (`kits/geostat-kit/ci/`):**
- `prepare-integration-env.sh` — Generate .env.dev from .env.example
- `wait-health.sh` — Generic HTTP health check waiter
- `wait-stack-health.sh` — Stub (consumer extends with actual endpoints)

**Consumer (`ops/ci/`):**
- `integration-stack.sh` — Full orchestration (infra + stack + smoke)
- `seed-stack-integration-env.sh` — Populate .env.dev with test values
- `wait-stack-health.sh` — Actual endpoint checks (e.g., `/chat/health`)
- `*-smoke.ps1` / `*.sh` — Project-specific tests (RAG, catalog, etc.)

---

## 8. DEPLOYMENT MODEL

### Three Deployment Modes

**1. Local (host machine)**
```bash
geostat be hybrid boot         # Gradle bootRun on Windows/Mac
geostat fe dev                 # npm run dev (Vite)
```
- No Docker, no remote server
- Uses `ops/config/<module>/.env.dev`
- IDE run/debug integration

**2. Docker Compose (local or remote)**
```bash
geostat stack up -d --build    # All services locally
geostat be compose up --build  # Backend only
```
- Compose files generated by kit
- Environment from `ops/config/<module>/.env.dev|prod`
- Can run on remote via SSH + Docker daemon

**3. Remote SSH Deploy (JAR/dist on filesystem)**
```bash
geostat be deploy --prod
geostat fe deploy --Environment prod
```
- JAR → `/home/deploy/<project>/backend/runtime/<module>/app.jar`
- Static dist → `/home/deploy/<project>/frontend/static/<module>/`
- Workspace → `/home/deploy/<project>/backend/workspace/<module>/` (dev mode)
- Orchestrated by `toolkit/deploy/` scripts
- Requires SSH key + `ops/config/deploy.env` (DEPLOY_SERVER, DEPLOY_PATH, etc.)

### Path Layouts

**Java (Structured Layout - Recommended)**
```
/home/deploy/geostat/backend/
├── runtime/chat-api/          ← JAR deploys here (geostat be deploy)
├── workspace/chat-api/        ← Source for dev mode (geostat be dev)
├── runtime/retrieval/         ← Another API module
└── workspace/retrieval/
```

**Frontend (Static)**
```
/home/deploy/geostat/frontend/
├── static/geostat-chat-ai-app/ ← Dist files
└── static/other-ui/
```

---

## 9. CONSTRAINTS & ARCHITECTURAL RULES

### What Kit Code Must NOT Do (Test: `test_toolkit_hardcodes.py`)

1. **No app brand names**
   - ✗ `backend`, `frontend` hardcoded
   - ✓ Read from manifest: `modules.<id>`

2. **No fixed paths**
   - ✗ `apps/backend`, `ops/config` hardcoded
   - ✓ Read from manifest + ProjectContext API

3. **No assumption of structure**
   - ✗ Assume `frontend/package.json` exists
   - ✓ Read `modules.frontend.path` first

4. **No port hardcoding**
   - ✗ `8090` for API
   - ✓ Resolve from `.env.dev|prod` files or defaults

5. **No environment variable assumption**
   - ✗ Always `API_PORT`
   - ✓ Query manifest: `modules.chat-api.spring.portEnv`

6. **No optional features as defaults**
   - ✗ Always include worker sidecar
   - ✓ Check `modules.chat-api.compose.embeddedWorker` (false = skip)

### Manifest as Single Source of Truth

Every decision flows through the manifest:
```
User command
    ↓
CLI resolves alias (manifest.cli.aliases)
    ↓
CLI reads module type (manifest.modules.<id>.type)
    ↓
CLI looks up driver (registry.json)
    ↓
CLI executes driver script
    ↓
Driver script sources lib (env.sh / env.ps1)
    ↓
Lib resolves from manifest (ProjectContext.discover())
    ↓
Action (compose up, deploy, etc.)
```

No shortcuts, no guessing.

---

## 10. EXTENSION POINTS

### Adding a New Module Type

1. **Create driver folder:** `drivers/my-new-type/`
2. **Implement commands:**
   - `compose.sh` — `docker compose` integration
   - `deploy.sh` — remote JAR/binary deploy
   - `manage.sh` — logs, status, delete
   - `check.sh` — syntax/lint checks (optional)
3. **Register in `drivers/registry.json`:**
   ```json
   "my-new-type": {
     "label": "My language / runtime",
     "runtime": "bash",
     "commands": {
       "compose": "sh/compose.sh",
       "deploy": "sh/deploy.sh",
       "manage": "sh/manage.sh"
     }
   }
   ```
4. **Consume in manifest:**
   ```json
   "modules": {
     "my-service": {
       "type": "my-new-type",
       "path": "apps/my-service",
       ...
     }
   }
   ```

### Customizing Compose Templates

Extend `ops/compose/catalog.json`:
```json
{
  "templates": {
    "custom_service": "my custom service block...",
    "my_network": "custom network config..."
  },
  "targets": {
    "ops/compose/stack/docker-compose.yml": {
      "services": ["api_dev", "custom_service"],
      "networks": "my_network"
    }
  }
}
```

### Adding CI Steps

Extend `geostat.ops.json` + `ops/ci/` scripts:
```json
"ci": {
  "customSmoke": "ops/ci/my-custom-test.ps1"
}
```

Then call in `integration-stack.sh`:
```bash
bash "$ROOT/ops/ci/my-custom-test.ps1"
```

---

## 11. FILES READ — COMPLETE INVENTORY

### geostat-kit (442 files total)

**Core lib:**
- `project_context.py` — API (Manifest loader + accessors)
- `modules.py` — Role/type resolution
- `credentials.py` — Cred profiles + GCP fallback
- `compose_identity.py` — Docker service naming
- `manifest_defaults.py` — Scaffold defaults (single source)
- `manifest_compose.py` — N-module service rendering
- `compose/build.py` — Compose generator main entry
- `project.sh / project.ps1` — Root discovery
- `env.sh / env.ps1` — Manifest loading + env building
- `drivers.ps1` — Driver registry lookup

**Drivers:**
- `registry.json` — Type registry
- `java-boot/sh/compose.sh` — Compose for Java
- `java-boot/sh/dev.sh` — Remote dev (rsync + watch)
- `node-vite/ps1/compose.ps1` — Compose for Vite
- `node-vite/ps1/check.ps1` — Syntax checks

**Manifest schema:**
- `manifest.schema.json` — JSON Schema v7 (validates consumer manifest)
- `scaffold/geostat.ops.json` — Default values

**Contracts:**
- `contracts/MANAGE-CONTRACT.md` — Unified manage verbs
- `contracts/manage-logs.contract.json` — Log source config

**Tests:**
- `tests/test_toolkit_hardcodes.py` — Bans app names in code
- 180+ pytest files (module, CLI, compose, deploy paths)

**Documentation:**
- `ARCHITECTURE.md` — Boundaries + entry points
- `docs/PACKAGE-ARCHITECTURE.md` — Design details
- `docs/ADOPTION.md` — What's included
- `docs/GOLDEN-PATHS.md` — Canonical workflows
- `docs/DEV-MODES.md` — local/hybrid/docker/remote

### ops/ (geostat-chat-ai consumer)

**Configuration:**
- `config/.env.example` — Full contract
- `config/deploy.env.example` — Deploy base
- `config/{backend,frontend,retrieval,ingestion}/.env.{dev,prod,deploy}` — Module configs
- `config/ssh/` — SSH keys (gitignored)
- `config/infra/.env.{dev,deploy}` — Infra env

**Compose (generated by kit):**
- `compose/catalog.json` — **INPUT** (templates + targets)
- `compose/stack/docker-compose.yml` — **OUTPUT** (generated dev)
- `compose/stack/docker-compose.prod.yml` — **OUTPUT** (generated prod)
- `compose/infra/docker-compose.base.yml` — Base infra
- `compose/infra/services/*.yml` — Service fragments
- `compose/infra/docker-compose.prod.yml` — Prod overlay

**CI:**
- `ci/integration-stack.sh` — **Full orchestration** (infra + stack + smoke)
- `ci/seed-stack-integration-env.sh` — Populate .env for CI
- `ci/rag-pipeline-smoke.sh` — RAG tests
- `ci/rag-eval-smoke.ps1` — Evaluation harness
- `ci/chat-rag-e2e-smoke.sh` — E2E tests

**Eval:**
- `eval/baseline.json` — Baseline metrics
- `eval/baseline.yaml-frozen.json` — Frozen baseline
- `eval/reports/*.json` — Test results

---

## 12. HOW THINGS WORK TOGETHER

### Scenario: Add a new Backend Module

1. **Create app**
   ```
   apps/new-api/
   ├── build.gradle
   ├── Dockerfile, Dockerfile.dev
   ├── src/
   └── logs/
   ```

2. **Update manifest**
   ```json
   "modules": {
     "new-api": {
       "type": "java-boot",
       "role": "api",
       "path": "apps/new-api",
       "secretsModule": "new-api"
     }
   }
   ```

3. **Create config**
   ```bash
   mkdir -p ops/config/new-api
   cp ops/config/backend/.env.example ops/config/new-api/.env.dev
   cp ops/config/backend/.env.example ops/config/new-api/.env.prod
   cp ops/config/backend/.env.deploy.example ops/config/new-api/.env.deploy
   ```

4. **Update compose catalog** (`ops/compose/catalog.json`)
   ```json
   "targets": {
     "apps/new-api/docker-compose.dev.yml": {
       "manifestModule": "new-api",
       "manifestProfile": "dev"
     }
   }
   ```

5. **Regenerate compose**
   ```bash
   geostat compose-gen
   # Kit reads: manifest, catalog, modules.new-api.path
   # Kit generates: apps/new-api/docker-compose.dev.yml, docker-compose.prod.yml
   # Kit writes: resolved module paths, ports, service names
   ```

6. **Deploy locally**
   ```bash
   geostat mod new-api compose up --build
   # Finds compose.sh for java-boot driver
   # Runs it with ops/config/new-api/.env.dev
   ```

7. **Deploy remotely**
   ```bash
   geostat mod new-api deploy --prod
   # Finds deploy.sh for java-boot driver
   # Reads ops/config/new-api/.env.deploy (DEPLOY_LAYOUT, DEPLOY_PATH, etc.)
   # Builds JAR, uploads to server, restarts container
   ```

**What kit did automatically:**
- No hardcodes in kit code; all from manifest
- Service naming derived consistently
- Compose generation from templates + module info
- Driver dispatch based on type
- Environment resolution by module

---

## 13. SUMMARY: WHAT THE KIT IS

**Is:**
- Manifest-driven ops package (reads geostat.ops.json at runtime)
- Multi-module CLI dispatcher (type → driver → command)
- Compose generator (manifest + catalog → docker-compose.yml)
- Credential manager (per-module or global fallback, no plaintext in code)
- Environment configurator (cascading .env files by profile)
- Remote deploy framework (JAR + SSH + rsync + watch)
- CI orchestrator (scaffold + health checks + artifact handoff)
- Extensible driver model (add new types, not new code in kit)

**Is NOT:**
- Application code, business logic
- Build system (uses gradle, npm, vite — doesn't rewrite them)
- Package manager (doesn't touch package.json, tsconfig.json)
- Secrets storage (references only, all real values in ops/config/)
- Environment-specific (dev/prod/staging are consumer profiles)
- Docker image builder (runs docker build, doesn't define images)
- Database schema manager (guides Flyway, doesn't own it)

**Core pattern:**
```
Manifest (config, declarative)
    ↓ (runtime read)
ProjectContext API (resolution)
    ↓ (queries)
Driver scripts (bash/ps1 — implementation)
    ↓ (calls)
Docker, gradle, npm, rsync, ssh (actual work)
```

All decisions → manifest first → never hardcoded in kit.

