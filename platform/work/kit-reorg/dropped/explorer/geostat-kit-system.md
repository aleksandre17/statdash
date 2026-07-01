---
name: geostat-kit-system
description: Complete structural analysis of geostat-kit ops framework - manifest-driven project orchestration system
metadata:
  type: reference
---

# geostat-kit System Architecture

## Overview
geostat-kit (version 1.0.0) is a reusable, manifest-driven operations framework for polyglot multi-module projects. It separates infrastructure orchestration from application code via a single source of truth: `geostat.ops.json`.

**Core principle:** _No consumer brand, module IDs, or project constants in kit runtime_

## Root-Level Structure

### Key Files
- `geostat.ops.json` (v2) — project manifest, single source of truth
- `package.json` — Node workspace (if needed)
- `CLAUDE.md` — non-negotiable laws (10 rules + architectural constraints)
- `tools/geostat.ps1` — CLI entry point (Windows)
- `tools/geostat.sh` — CLI entry point (Linux/macOS)

### Directory Layout
```
project-root/
  geostat.ops.json          (manifest — references kit path + secrets + compose)
  apps/
    backend/                (or chat-api, retrieval-service, ingestion-service)
    frontend/               (or any node-vite UI)
    retrieval-service/
    ingestion-service/
  libs/                     (shared Java libraries, platform contracts)
  kits/geostat-kit/         (submodule, never edit)
  ops/
    config/                 (secrets — ops/config/<module-id>/.env.*)
    compose/
      catalog.json          (compose-gen templates + targets)
      stack/                (generated full-stack docker-compose)
      infra/                (PostgreSQL, Redis, Qdrant, RabbitMQ, Prometheus, etc.)
    scripts/                (project-specific bash helpers)
    ci/                     (project-specific CI scripts)
    eval/                   (evaluation frameworks, baselines)
    db/                     (schema, migrations)
```

## Manifest Structure (geostat.ops.json)

```json
{
  "version": 2,
  "package": "kits/geostat-kit",         // relative path to kit
  "secrets": "ops/config",               // secrets root
  "features": { "gcpCredentials": true },

  "compose": {
    "catalog": "ops/compose/catalog.json",
    "syncModules": "apps/backend/ops.modules"
  },

  "stack": {
    "composeDir": "ops/compose/stack",
    "composeModules": ["chat-api", "retrieval", "ingestion", "frontend"],
    "networkName": "geostat-chat-ai-net",
    "infraComposeDir": "ops/compose/infra",
    "deployBaseSecretsModule": "chat-api",
    "infra": {
      "services": ["postgres", "redis", "qdrant", "rabbitmq", "prometheus", "grafana", "loki", "tempo", "pgbouncer", "minio"]
    }
  },

  "cli": {
    "aliases": {
      "fe": "frontend",
      "be": "chat-api",
      "ret": "retrieval",
      "ing": "ingestion"
    }
  },

  "modules": {
    "chat-api": {
      "role": "api",
      "type": "java-boot",
      "path": "apps/backend",
      "secretsModule": "backend",
      "target": "chat-api",
      "hybrid": {
        "springProfiles": "local",
        "preferJar": true,
        "bootJar": "apps/backend/build/libs/geostat-chat-ai-2.0.0-SNAPSHOT.jar"
      },
      "configGen": { "mode": "env-profiles" },
      "spring": {
        "applicationName": "geostat-chat-ai",
        "defaultProfile": "local",
        "portEnv": "API_PORT"
      },
      "catalog": {
        "sourceEnv": "GEOSTAT_CHAT_CATALOG_SOURCE",
        "defaultSource": "derived",
        "presentationResources": ["topic-style.yaml", "terminology-overlay.yaml"]
      },
      "credentials": [
        { "file": "google-credentials.json", "mount": "/app/google-credentials.json", "envVar": "GOOGLE_APPLICATION_CREDENTIALS" }
      ]
    },
    "frontend": {
      "role": "ui",
      "type": "node-vite",
      "path": "apps/frontend",
      "secretsModule": "frontend",
      "target": "frontend",
      "debug": { "npmScript": "dev" }
    },
    // ... retrieval (api, java-boot), ingestion (worker, java-boot)
  },

  "adapters": {
    "gcp": { "credentialsFile": "google-credentials.json", "containerMount": "/app/google-credentials.json" },
    "nginx": { "template": "apps/frontend/nginx.conf.template", "output": "apps/frontend/nginx.conf" },
    "embed": { "envExample": "ops/config/frontend/embed.env.example" }
  },

  "ci": {
    "integration": "ops/ci/integration-stack.sh",
    "prepareEnv": "kits/geostat-kit/ci/prepare-integration-env.sh",
    "ragSmoke": "ops/ci/rag-pipeline-smoke.sh",
    "chatDerivedCatalogSmoke": "ops/ci/chat-derived-catalog-smoke.ps1",
    "ragEvalGate": "ops/ci/rag-eval-gate.ps1",
    "ragP1Cutover": "ops/ci/rag-p1-cutover.ps1"
  },

  "vscode": {
    "folder": ".vscode",
    "geostatScript": "tools/geostat.ps1"
  }
}
```

## Kit Structure (kits/geostat-kit/)

### 1. **CLI Entry Points**
- `cli/geostat.ps1` (PowerShell main dispatcher)
- `cli/geostat.sh` (Bash wrapper)

### 2. **lib/** — Core Python/PowerShell/Bash Utilities

#### Python (project context, drivers, config generation)
- `project_context.py` — load manifest, resolve module paths, secrets folders
  - `find_project_root()` — walk up from cwd until `geostat.ops.json`
  - `ProjectContext.discover()` — manifest loader + accessor API
  - Methods: `field()`, `module_path()`, `secrets_module_dir()`, `list_module_ids()`
  
- `modules.py` — role/type queries
  - `module_by_role(manifest, role)` — primary api/ui/worker
  - `modules_by_role()` — all matching a role
  - `module_ids(manifest)` — all module IDs
  - `default_stack_deploy_steps()` — role-ordered deployment

- `compose_identity.py` — Docker Compose naming (no hardcodes)
  - `primary_api_module_id()` — resolves "api" or "backend" or "chat-api"
  - `primary_ui_module_id()` — resolves "frontend" or "ui"
  - `resolve_module_service_name()` — single source for Docker service names
  - Respects legacy overrides from `deploy.env` (COMPOSE_PROJECT_NAME, COMPOSE_API_SERVICE, etc.)

- `manifest_defaults.py` — defaults for unspecified fields
  - Reads from `scaffold/geostat.ops.json` as baseline
  - Legacy root discovery fallback (pre-v2)
  
- `config_gen.py` — generates `.env.*` files per module per profile
  - Mode: `simple` (basic vars), `postgres-profiles` (per-DB), `env-profiles` (dev/prod split)
  - Respects Spring `profileGroups`, `envProfiles`
  
- `stack_deploy.py` — remote deployment orchestration
  - Reads `stackDeploy.steps[]` or auto-generates from `stack.composeModules`
  - Role order: api → worker → ui
  
- `credentials.py` — resolves credential files per module
  - Per-module `modules.<id>.credentials[]` overrides global `adapters.gcp`
  - Returns: {file, mount, envVar}
  
- `ci_prepare.py` — CI setup (SSH, env unpacking, health checks)
- `vscode_gen.py` — generates `.vscode/launch.json` from manifest + `debug.*`

#### PowerShell (lib/*.ps1)
- `project.ps1` — manifest context (Measure-Manifest, Get-ProjectRoot, etc.)
- `env.ps1` — env file parsing, variable expansion
- `modules.ps1` — role/type lookups (PowerShell wrappers)
- `drivers.ps1` — driver registry + capability queries
- `ssh.ps1` — SSH key management + tunneling

#### Bash (lib/*.sh)
- `project.sh` — manifest loader + accessor (sed/awk based)
- `env.sh` — dotenv parsing
- `drivers.sh` — driver registry (bash)
- `ssh.sh` — SSH tunneling

### 3. **compose/** — Docker Compose Generation

- `manifest_compose.py` — main compose-gen engine
  - Reads: manifest + `ops/compose/catalog.json` (templates + targets)
  - Outputs: `apps/backend/docker-compose.{dev,prod}.yml`, `apps/frontend/docker-compose*`, `ops/compose/stack/docker-compose.yml`
  - Substitutes: service names, ports, volumes, env files, credentials, health checks

- `compose-catalog.json` — kit templates (reusable blocks)
  - `templates.api_dev`, `api_prod`, `worker_dev`, `worker_prod`, `app_base`, etc.
  - Uses placeholders: `{api_service}`, `{network_key}`, `{health_interval}`, etc.

- `compose/build.py` / `compose/build.ps1` — entry points for `geostat compose-gen`

- `sync_ops_modules.py` — syncs Gradle module IDs to `ops.modules` (for `geostat config-gen`)

### 4. **config/** — Environment File Generation

- `config-catalog.json` — Spring profile templates
  - Role-based: `spring.profileGroups` (e.g., hybrid → ["db", "hybrid-env"])
  - Per-profile: `spring.envProfiles.dev/prod` → `.env.dev` / `.env.prod`

- `config/build.py` — entry point for `geostat config-gen`
- `lib/config_gen.py` — core generation logic
  - Respects datascore declarations (postgres schema, qdrant, rabbitmq)
  - Generates `deploy.env` for remote servers

### 5. **drivers/** — Module-Type Drivers

Each driver is a pluggable command set (deploy, dev, run, check, compose, manage, modules).

#### registry.json
```json
{
  "java-boot": {
    "label": "JVM — Gradle / Spring Boot",
    "roles": ["api", "worker"],
    "runtime": "bash",
    "commands": {
      "deploy": "sh/deploy.sh",
      "dev": "sh/dev.sh",
      "run": "ps1/run.ps1",
      "manage": "sh/manage.sh",
      "compose": "sh/compose.sh",
      "check": "sh/check.sh",
      "modules": "sh/modules.sh"
    }
  },
  "node-vite": {
    "label": "Node — SPA dev remote + static deploy",
    "roles": ["ui"],
    "runtime": "powershell",
    "commands": { "deploy": "ps1/deploy.ps1", "dev": "ps1/dev.ps1", ... }
  }
}
```

#### java-boot driver
- `sh/deploy.sh` — gradle build → JAR → upload to server (DEPLOY_PATH layout)
- `sh/dev.sh` — gradle bootRun (local) or docker compose up (hybrid)
- `sh/compose.sh` — generates Dockerfile.dev, docker-compose.dev.yml
- `sh/manage.sh` — lifecycle: status, logs, stop, start, restart, nuke
- `sh/check.sh` — health check (curl /actuator/health)
- `ps1/run.ps1` — hybrid boot (local JVM)

#### node-vite driver
- `ps1/dev.ps1` — npm dev script (port 5177 default)
- `ps1/deploy.ps1` — npm build → dist/ → upload + nginx config
- `ps1/compose.ps1` — Dockerfile (dev=watch, prod=static), docker-compose.yml
- `ps1/manage.ps1` — docker lifecycle + nginx reload + static config
- `ps1/run.ps1` — local npm dev

#### _init.sh / _init.ps1
- Driver initialization: verify tools, set paths, dry-run checks

### 6. **toolkit/** — High-Level Commands

- `dev/Invoke-DevUp.ps1` — `geostat dev up <alias|all> [--mode hybrid|docker] [--no-infra]`
  - Hybrid: tunnel to infra, boot local API + UI
  - Docker: full `docker-compose up`
  - Multi-window launch (PowerShell)

- `hybrid/` — local app runs
  - `Invoke-HybridRun.ps1` — dispatch to driver (java-boot or node-vite)
  - `Invoke-HybridJarBoot.ps1` — Spring Boot JAR with local .env.dev

- `stack/` — Docker Compose orchestration
  - `stack.ps1` / `stack.sh` — `geostat stack up|down|logs`
  - `compose.ps1` / `compose.sh` — `geostat stack compose`

- `deploy/` — Remote deployment
  - `deploy.sh`, `upload.sh`, `modules.sh`, `docker-up.sh`
  - Layout migration (structured → new deploy paths)
  - Health checks, Flyway migrations

- `infra/` — Infrastructure provisioning
  - `Invoke-Infra.ps1` — Docker Compose for data stores (postgres, redis, qdrant, rabbitmq, monitoring)
  - `ensure-prereqs.sh` — tools check (docker, docker-compose)

- `init/` — Project bootstrap
  - `Invoke-ProjectInit.ps1` — scaffold + compose-gen + config-gen + vscode-gen
  - Calls `lib/ci_prepare.py`

### 7. **adapters/** — Integrations

- `render_nginx.py` — templated nginx.conf from manifest
  - Reads `adapters.nginx.template`, outputs `apps/frontend/nginx.conf`
  - Substitutes: backend URL, CSP headers, SSL config

### 8. **contracts/** — API Contracts

- `manage-logs.contract.json` — unified `manage logs` syntax
- `MANAGE-CONTRACT.md` — verb parity (status, logs, stop, start, restart, reload, nuke)

### 9. **ci/** — CI Integration Helpers

- `prepare-integration-env.sh` — unpack secrets, set git vars, resolve manifests
- `wait-health.sh` — probe module health (curl /actuator/health)
- `wait-stack-health.sh` — wait for full stack readiness

### 10. **docs/** — Deep Documentation

- `ARCHITECTURE.md` — package boundaries, entry points
- `PACKAGE-ARCHITECTURE.md` — manifest design, config-gen modes, deploy paths
- `PACKAGE-PRINCIPLES.md` — no hardcodes, N-module model, credential isolation
- `GOLDEN-PATHS.md` — canonical deployment patterns
- `ADOPTION.md` — how to adopt as submodule
- `STARTER.md`, `INSTALL.md` — quickstart
- `DEV-MODES.md` — local F5, hybrid, docker, remote
- `LOCAL-DEBUG.md` — VSCode launch.json generation

### 11. **scaffold/** — Template Project

Starting point for new consumers. Contains:

- `geostat.ops.json` (minimal example)
- `apply-scaffold.ps1` / `apply-scaffold.sh` — seeds project structure
- `ops/config/` (example .env files, ssh keys structure)
- `ops/compose/` (catalog.minimal.json, infra base)
- `ops/cli/` (wrappers: geostat.ps1, geostat.sh)
- `tools/` (copy of geostat.ps1 for IDE integration)
- `apps/backend/` (sample ops.config.sh, logs/)
- `apps/frontend/` (sample ops.config.ps1, logs/)

### 12. **tests/** — Comprehensive Test Suite

222 test files covering:
- Manifest validation (schema + defaults)
- Compose generation (catalog resolution, placeholder substitution)
- Config generation (env-profiles, postgres configs)
- Module identity (primary api/ui/worker resolution)
- Deploy paths (DEPLOY_PATH structure, migrating layouts)
- Credentials (per-module, global GCP fallback)
- Stack deployment orchestration
- Drivers (PS1 init, .env parsing, health checks)
- Registry integrity
- CI health checks
- VSCode launch.json generation
- Golden path matrix (all mode combinations)

Golden consumer fixture: `tests/fixtures/golden-consumer/geostat.ops.json`

## Key Design Patterns

### 1. **Manifest as Single Source of Truth**
- No hardcoded module names, role assignments, or paths in kit code
- All runtime logic queries manifest via `ProjectContext.field(dotted_path, default)`
- Defaults from `scaffold/geostat.ops.json` (library → consumer)

### 2. **Driver Registry Model**
- Runtime discovers commands per module type (java-boot, node-vite, etc.)
- Commands: deploy, dev, run, manage, compose, check, modules
- Role → default driver mapping (api→java-boot, ui→node-vite)
- Consumer never calls driver directly; kit CLI resolves module → driver → command

### 3. **Compose Identity Contract**
- Single function: `resolve_module_service_name(module_id, manifest, deploy, repo_name)`
- Docker service names = `{slug}-{target}` (no separate API_SERVICE, APP_SERVICE enums)
- Legacy overrides via `deploy.env` only (not code)

### 4. **No Hardcoded Paths**
Test: `test_toolkit_hardcodes.py` — bans grep for app-specific paths or module IDs in `.ps1` / `.sh`
- Safe substitutions: `{api_service}`, `{network_key}`, `{health_interval}` (manifest-provided)

### 5. **Credential Isolation**
- Per-module credentials: `modules.<id>.credentials[].{file, mount, envVar}`
- Global fallback: `adapters.gcp` (only if no module override)
- Mounted at runtime; never logged or committed

### 6. **Config Generation Hierarchy**
1. Manifest defaults (`manifest_defaults.py`)
2. Spring profile groups (`profileGroups`)
3. Per-profile env overrides (`envProfiles.dev/prod`)
4. Datastore declarations (postgres schema, qdrant vector indices)
5. Output: `ops/config/<secrets-module>/.env.dev`, `.env.prod`, `.env.deploy`

### 7. **Deploy Path Abstraction**
Structured layout (replaces `DEPLOY_BACKEND_PATH`/`DEPLOY_FRONTEND_PATH`):
```
/opt/geostat-chat-ai/
  runtime/
    chat-api/           (from DEPLOY_PATH + runtime/<container>/)
    retrieval/
    ingestion/
    frontend/
  config/
    backend/            (secrets/ mapped here)
    retrieval/
    ingestion/
    frontend/
  storage/              (persistent volumes)
```

Drivers map: `stack.deployBaseSecretsModule` → `DEPLOY_PATH`, auto-inherit for workers.

### 8. **Health Check Contracts**
- Java: `curl {host}:{port}/actuator/health | grep UP`
- Node: `curl {host}:{port}/`
- Manifest configurable: `health_interval`, `health_retries`, `health_start_period`

### 9. **Env File Precedence** (dev → docker → hybrid)
1. `.env.dev` (local development)
2. `.env.docker` (Docker Compose)
3. `.env.prod` (production → server)
4. `.env.deploy` (structured layout server params)

### 10. **N-Module Model**
- No hard-coded "backend" or "frontend" — manifest defines all modules
- Each module has `role: [api|worker|ui|gateway|data|other]`
- Kit auto-discovers primary api/worker/ui via role matching
- For multi-api or multi-worker, use explicit stack.composeModules + stackDeploy.steps

## Contract Boundaries (Manifest ↔ Kit ↔ Consumer)

### Kit Must Provide
1. Module discovery (ProjectContext)
2. Compose generation (manifest → docker-compose)
3. Config generation (manifest → .env files)
4. Credential resolution (per-module or global)
5. Driver dispatch (module-id → driver → command)
6. Health checks (role-based curl patterns)
7. Deploy path layout (DEPLOY_PATH structure)
8. CI integration helpers (prepare, wait, health)

### Consumer Must Provide
1. `geostat.ops.json` (valid manifest)
2. `ops/config/` (secrets, profiles)
3. `ops/compose/catalog.json` (consumer-specific compose templates)
4. `ops/ci/` (consumer-specific smoke tests, gates)
5. Module apps (backend, frontend, workers)
6. Driver initialization scripts if custom types

### Kit Must NOT Hardcode
1. Project/brand names (e.g., "geostat-chat-ai")
2. Module IDs (e.g., "backend", "frontend" — must query manifest)
3. Port numbers (use manifest `spring.portEnv` or defaults)
4. Health check URLs (use role + standard patterns)
5. Credential file names (use manifest `credentials[]`)
6. Deploy server paths (resolve at runtime from `deploy.env`)

## Version & Release

- **Version:** 1.0.0 (2026-05-21)
- Adoption strategy: GitHub submodule (pin to tag)
- Breaking changes: require migration guide

## How to Adopt

1. Clone project
2. Run `geostat init` (scaffolds `geostat.ops.json` + `ops/` structure)
3. Fill in app modules in manifest
4. Run `geostat compose-gen` (generates docker-compose*.yml)
5. Run `geostat config-gen` (generates .env files)
6. Run `geostat dev up all` (boots stack in Docker or hybrid modes)
