---
name: geostat-kit-build-config-model
description: How geostat-kit controls where and how modules build; manifest-driven, no hardcoded per-module configs
metadata:
  type: reference
---

# Geostat-Kit Build & Config Control Model

## Core Insight: Manifest is the Single Source of Truth

The kit reads `geostat.ops.json` at **runtime** (not build-time) via `ProjectContext`. No code generation for module configs (vite.config, tsconfig, package.json). Each module owns its own build config files.

## Per-Module File Structure (Manifest-Driven)

Each module has:
- Own `package.json` in its module path (e.g., `apps/frontend/package.json`)
- Own `vite.config.js` / `tsconfig.json` / `eslint.config.js` (if needed)
- Own `docker-compose.yml` in module root (if applicable)
- Secrets/env in shared `ops/config/{secretsModule}/` (not per-module)

## What the Manifest Controls

**Module registration** (modules.{id}):
- `path`: Where the module lives (e.g., `apps/backend`, `apps/frontend`)
- `type`: Driver type (java-boot, node-vite) — determines which commands/scripts run
- `role`: Semantic role (api, ui, worker) — used for role-based discovery
- `secretsModule`: Folder name under `ops/config/` for this module's env/secrets
- `target`: Container/service name (optional, used for compose service naming)

**Compose catalog** (compose.catalog):
- Path to `ops/compose/catalog.json` — JSON template registry for services
- Used to generate actual `docker-compose.yml` for the stack

**Config generation** (modules.{id}.configGen):
- Mode: `simple`, `postgres-profiles`, `env-profiles` (Java/Spring only)
- Generates `application.yml` / profiles in module root from manifest + stack catalog

**Driver discovery & dispatch**:
- Kit queries manifest for module type → looks up type in `drivers/registry.json`
- Registry maps type to command scripts (e.g., node-vite → ps1/*.ps1, java-boot → sh/*.sh)
- Calls script with module path as working directory

## No Build Config Generation (For Node)

Node modules (Vite, Angular, Nx) do NOT get auto-generated:
- `vite.config.js` is hand-written (e.g., `apps/frontend/vite.config.js`)
- `tsconfig.json` is hand-written per module
- `package.json` is hand-written per module
- `.env` files come from `ops/config/{secretsModule}/` at runtime

The only thing auto-generated for frontend: the `docker-compose.{override,prod}.yml` files (not the vite/ts configs).

## How node-vite Driver Discovers & Runs

1. **Bootstrap**: Kit calls `ps1/dev.ps1 bootstrap` with module path as CWD
2. Script reads `docker-compose.yml` in that path (expected to exist)
3. Determines which service to use (single service or prompt user)
4. Performs rsync/build/compose operations

Example: `geostat fe dev bootstrap`
- Resolves `frontend` module via manifest alias
- Module path = `apps/frontend`
- Calls `kits/geostat-kit/drivers/node-vite/ps1/dev.ps1 bootstrap` in `apps/frontend` context
- Script finds `apps/frontend/docker-compose.yml` + optional `docker-compose.override.yml`
- Syncs source, brings up compose on remote server

## SSH Deploy: What Kit Expects Per-Module

**Structured layout** (from deploy_paths.py):
- Frontend: `{DEPLOY_PATH}/static/{container-name}/` (for static dist)
- Backend: `{DEPLOY_PATH}/runtime/{container-name}/` (for JAR) or `workspace/{container-name}` (for dev)
- Container name resolved from manifest module.target or composed from role + module ID

**Per-module environment**:
- `ops/config/{secretsModule}/.env.deploy` — where/how to deploy this module
- `DEPLOY_SERVER`, `DEPLOY_HOST_PORT`, `DEPLOY_LAYOUT` all come from secrets dir

The kit **does NOT** expect per-module docker-compose.yml on the server. It builds them during CI or takes them from the repo.

## Workspace vs Independent Modules

**Geostat-chat-ai (current state):**
- No root package.json (no workspace)
- Each app (backend, frontend, ingestion, retrieval) is independent Gradle/npm project
- Kit treats them as separate modules; no cross-module dependency in the kit

**National-accounts (in this workspace):**
- Root package.json with `"workspaces": ["apps/*"]`
- Two apps: geostat (dashboard), panel (admin)
- Both are single npm workspaces (shared devDeps, shared node_modules)
- Root tsconfig with references to app tsconfigs

## Implications for National-Accounts

The kit does **NOT** require or prohibit workspaces. It works with either:

1. **Fully independent modules** (no workspace):
   - Each app has its own package.json, tsconfig, eslint.config
   - Faster per-app rebuild (no hoisting)
   - Harder to share lint rules / build scripts at root
   - Each module declares all its devDeps (no dedup)

2. **Workspace with shared devDeps** (current national-accounts):
   - Root package.json defines all devDeps
   - All apps share linter config, build tools, type definitions
   - Single node_modules at root (faster install, smaller disk)
   - Interdependent builds (one app build can affect another via tsconfig paths)
   - More monorepo-like

**Kit sees both as valid.** It doesn't care where package.json/tsconfig live — it runs `npm run dev` / `npm run build` in the module's CWD. If the root has a workspace, those commands will respect it. If modules are independent, npm commands run in isolation.

## Config Generation: What the Kit Generates

Only **Java/Spring** modules get config generation (in kits/geostat-kit/lib/config_gen.py):
- Generates `application.yml`, `application-{profile}.yml`
- Reads manifest config + stack catalog to determine datasources, ports, etc.
- Output: `.yml` files in `apps/{backend,retrieval,ingestion}/src/main/resources/`

**Node modules get NO auto-generation:**
- vite.config.js, tsconfig.json, eslint.config.js are hand-written
- `.env` files are authored in `ops/config/frontend/` as templates or deployed copies
- Build is 100% the module's own concern

## Vite Config Pattern (from geostat-chat-ai/apps/frontend)

```javascript
// vite.config.js — hand-written, independent
export default defineConfig({
    envDir: path.resolve(__dirname, '../../ops/config/frontend'),
    plugins: [react()],
    // ... rest is standard Vite
})
```

Key: `envDir` points to `ops/config/frontend/` — the kit's secrets folder. Vite will read `.env`, `.env.dev`, `.env.prod` from there at build time.

## Summary: Kit's Build Control Boundary

**The kit controls:**
- Module discovery (which folder is each app)
- Secrets/env deployment (ops/config/{secretsModule}/)
- Compose generation (stack docker-compose.yml)
- Credential binding (GCP creds per-module)
- Deploy layout (structured / flat)
- SSH staging directories

**The kit does NOT control / does NOT generate:**
- Vite, tsconfig, eslint, postcss configs
- package.json (each module's)
- Typescript or JavaScript build output
- Module interdependencies (each workspace or app manages its own)

**Each module controls:**
- Its own package.json scripts and devDeps
- Its own tsconfig, vite.config, eslint.config
- Its own src/ structure and build artifacts
- (Java modules: only after config_gen.py runs)
