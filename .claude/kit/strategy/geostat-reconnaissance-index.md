# geostat-chat-ai Deep Reconnaissance Index

**Completed:** 2026-06-14 · **Source:** `C:\Users\Test-User\CursorProjects\geostat-chat-ai`

## Full Architectural Report (Split Series)

The geostat-chat-ai system is a **manifest-driven, multi-service AI chatbot** with a **reusable ops framework (geostat-kit)** embedded as a git submodule. Read these in order:

### 05: Manifest-Driven Pattern
[[05-geostat-manifest-driven.md]] — The soul of the system.

**What:** `geostat.ops.json` is the single source of truth for all ops decisions (CLI dispatch, Docker Compose generation, deploy ordering, credential resolution).

**Why it matters:** Same kit code works for 1-module or 10-module projects. No hardcodes for app names, ports, or paths.

**Read this first:** Understand why the manifest exists and how it drives everything.

---

### 10: SSH/Docker Deploy Pipeline
[[10-geostat-deploy-system.md]] — 5-step remote deployment with health gating and automatic rollback.

**What:** Gradle build → SCP upload → Compose generation on server → Docker up → Health poll → Rollback on failure.

**Why it matters:** Ops is modular, auditable, and safe. Each step can re-run independently. Failed deployments auto-rollback to previous JAR version.

**Read this second:** Understand how code gets from developer machine to production Linux server.

---

### 15: CLI Dispatch & Driver Model
[[15-geostat-cli-dispatch.md]] — How the `geostat` CLI resolves commands to module-specific scripts.

**What:** Registry maps module types (java-boot, node-vite) to driver scripts. CLI dispatcher resolves alias → module → type → script path → execute.

**Why it matters:** Adding a new module type (e.g., Go service, Python worker) requires only a new driver directory; no kit changes.

**Read this third:** Understand the extensibility model (type-based dispatch).

---

### 20: Compose Generation Pipeline
[[20-geostat-compose-generation.md]] — How docker-compose files are generated from templates and manifest.

**What:** Catalog contains reusable YAML templates. Targets map which templates combine into which output files. Generation resolves manifest vars (service names, paths, credentials) and renders.

**Why it matters:** Compose files are generated, not version-controlled. This ensures they stay in sync with manifest; no manual editing required.

**Read this fourth:** Understand the template + target pattern for customizable, maintainable Compose files.

---

### 25: Services & Project Structure
[[25-geostat-services-and-structure.md]] — The four services, build structure, and why NOT a traditional Node monorepo.

**What:** chat-api (8090) + retrieval (8092) + ingestion (8093) + frontend (5177). Each owns its build. Heterogeneous (Java + Node). Shared libs only for domain contracts.

**Why it matters:** Heterogeneous systems need different ops patterns than homogeneous Node monorepos. This one works because services are deployed independently.

**Read this fifth:** Understand what each service does and why the structure supports multi-tech stacks.

---

## Quick Lookup

| Question | Read |
|----------|------|
| Why is the manifest important? | [[05-geostat-manifest-driven.md]] |
| How does code get deployed? | [[10-geostat-deploy-system.md]] |
| How do I add a new service type? | [[15-geostat-cli-dispatch.md]] §Driver Registry |
| How are docker-compose files generated? | [[20-geostat-compose-generation.md]] |
| What are the 4 services? | [[25-geostat-services-and-structure.md]] |

---

## Key Insights (One-Liners)

1. **Manifest is the source of truth.** CLI, compose, deploy, credentials—all query the manifest at runtime. No hardcodes.

2. **Same kit for any project shape.** Add modules to manifest → run `geostat compose-gen` → done. Kit never reads app names or ports.

3. **Deploy is 5 steps, each independent.** Build, prepare, upload, compose-gen on server, docker up. Can re-run step 3 without rebuilding.

4. **Health-gated deployments.** Docker up blocks until service is healthy or timeout. Prod failures trigger auto-rollback.

5. **Type-based driver dispatch.** New tech stack? Create `drivers/{type}/sh/{command}.sh` + register in registry. Kit dispatches; driver owns logic.

6. **Compose from templates.** Catalog contains YAML snippets. Targets compose snippets into full files. Manifest vars rendered at generation time.

7. **Heterogeneous by design.** Java backend + Node frontend + optional workers. Services build independently; kit treats them as opaque.

8. **Zero hardcodes in kit.** All project-specific strings (module IDs, ports, credentials, deploy servers) come from manifest + ops/config/.

---

## Files Read

**22 files, ~2500 lines of substantive code/config:**

- `geostat.ops.json` (410 lines) — Manifest
- `CLAUDE.md` (95 lines) — Project laws
- `kits/geostat-kit/ARCHITECTURE.md` (49 lines)
- `kits/geostat-kit/cli/geostat.ps1` (150 lines read)
- `kits/geostat-kit/lib/project_context.py` (150 lines read)
- `kits/geostat-kit/lib/stack_deploy.py` (92 lines)
- `kits/geostat-kit/lib/compose_identity.py` (100+ lines)
- `kits/geostat-kit/lib/credentials.py` (81 lines)
- `kits/geostat-kit/manifest.schema.json` (100 lines read)
- `kits/geostat-kit/compose/manifest_compose.py` (120 lines read)
- `kits/geostat-kit/drivers/registry.json` (30 lines)
- `kits/geostat-kit/toolkit/deploy/upload.sh` (69 lines)
- `kits/geostat-kit/toolkit/deploy/dev-remote.sh` (310 lines)
- `kits/geostat-kit/toolkit/deploy/docker-up.sh` (102 lines)
- `kits/geostat-kit/drivers/java-boot/sh/deploy.sh` (100 lines read)
- `kits/geostat-kit/drivers/node-vite/ps1/deploy.ps1` (100 lines read)
- `ops/compose/catalog.json` (1500+ lines, 100 read)
- `apps/backend/build.gradle.kts` (80 lines read)
- `apps/backend/ops.config.sh` (9 lines)
- `apps/frontend/package.json` (40 lines read)
- `apps/frontend/ops.config.ps1` (9 lines)
- `ops/cli/geostat.sh` (5 lines)

---

## How to Replicate This Pattern in national-accounts

1. **Already have:** `kits/geostat-kit/` (submodule)
2. **Must create:** `geostat.ops.json` (declare modules, roles, types)
3. **Must create:** `ops/compose/catalog.json` (templates + targets for your services)
4. **Must create:** `ops/config/` (module secrets + deploy.env)
5. **Must scaffold:** `ops.config.sh` or `.ps1` per module
6. **Must provide:** `Dockerfile.dev`, `Dockerfile` per module
7. **Run:** `geostat validate` to test manifest
8. **Run:** `geostat compose-gen` to generate docker-compose files

**Cost:** ~2–3 hours for 3–5 services. **Payoff:** Manifest-driven deployment; no changes to kit needed for new modules.
