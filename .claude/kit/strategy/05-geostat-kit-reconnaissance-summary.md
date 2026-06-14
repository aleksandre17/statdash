---
RECONNAISSANCE SUMMARY: How Geostat-Kit Controls Builds, Modules, and Deployment
Agent: Explorer (Haiku)
Date: 2026-06-14
Duration: Deep read of geostat-kit + geostat-chat-ai + national-accounts
---

# Geostat-Kit Reconnaissance — Build Model & Module Independence

## Executive Summary

**Geostat-kit is manifest-driven, not build-code-driven.** It reads `geostat.ops.json` at runtime to discover where modules are, what type they are, and what commands to run. No code generation for per-module build configs (Vite, tsconfig, ESLint). Each module owns its own package.json, tsconfig, vite.config, docker-compose.yml.

The kit supports **fully independent modules** (no workspace) OR **workspace-shared devDeps** (current national-accounts). Both work equally well because the kit doesn't care about the npm resolution tree — it just runs commands in the module's working directory.

---

## What Kit Controls

| Area | Kit's Role | Module's Role |
|------|-----------|---------------|
| **Module discovery** | Reads manifest for where (path), what type (type), role (api/ui/worker) | n/a |
| **Secrets/env** | Manages per-module folder in `ops/config/{secretsModule}/` | Reads .env.dev, .env.deploy from there |
| **Compose stack** | Generates docker-compose.yml for multi-module stack (from catalog.json templates) | Provides docker-compose.yml per module |
| **Config gen** | Generates Spring application.yml (Java only) from manifest | Only Java modules; Node gets nothing auto-gen'd |
| **Credential binding** | Maps credentials to modules, handles GCP files per-module | Inherits env from kit |
| **Deployment paths** | Computes remote paths (structured/flat layout) at deploy time | n/a |
| **SSH / rsync staging** | Orchestrates uploads to computed remote paths | n/a |
| **Driver dispatch** | Looks up type in registry, finds command script, invokes it | n/a |

---

## What Kit Does NOT Control (Node Modules)

**For Vite/React/Angular/Nx apps:**
- ❌ Does NOT generate vite.config.js
- ❌ Does NOT generate tsconfig.json
- ❌ Does NOT generate eslint.config.js
- ❌ Does NOT generate package.json
- ❌ Does NOT manage dependencies
- ✓ DOES read .env files from `ops/config/{secretsModule}/` at runtime

All build config is hand-written in the module and committed to git.

---

## No-Hardcodes Principle: Example Flow

**Command:** `geostat fe dev bootstrap`

1. **Alias resolution:** `fe` → `frontend` (from manifest.cli.aliases)
2. **Module discovery:** ProjectContext reads manifest, finds:
   - path: `apps/frontend`
   - type: `node-vite`
   - secretsModule: `frontend`
3. **Driver lookup:** drivers/registry.json finds:
   - type: `node-vite`
   - command: `dev` → `ps1/dev.ps1`
4. **Dispatch:** Calls `cd apps/frontend; powershell .../ps1/dev.ps1 bootstrap`
5. **Script execution:**
   - _init.ps1 loads `apps/frontend/docker-compose.yml`
   - _init.ps1 loads `ops/config/frontend/.env.dev`
   - dev.ps1 parses docker-compose to find service name (no hardcode!)
   - dev.ps1 calls rsync / compose on remote server

**Zero hardcodes of service names, paths, module IDs, ports in kit code or scripts.**

---

## Module Structure: Path, Type, Role

**geostat.ops.json excerpt:**
```json
{
  "modules": {
    "frontend": {
      "path": "apps/frontend",
      "type": "node-vite",
      "role": "ui",
      "secretsModule": "frontend",
      "target": "frontend"
    },
    "chat-api": {
      "path": "apps/backend",
      "type": "java-boot",
      "role": "api",
      "secretsModule": "backend",
      "target": "backend"
    }
  }
}
```

**Kit queries manifest at runtime for:**
- **path:** Where is this module? (CWD for commands)
- **type:** What driver? (java-boot, node-vite, etc.)
- **role:** What is its semantic role? (Used for role-based discovery: "give me the first api module", etc.)
- **secretsModule:** Where to find env files in `ops/config/{value}/`
- **target:** Container/service name (optional, used for compose naming)

**Each module provides:**
- `/path/package.json` (own deps)
- `/path/tsconfig.json` (own config)
- `/path/vite.config.js` (own build)
- `/path/docker-compose.yml` (own compose layout)

---

## Build Config Files: Not Generated, Committed

### Node-Vite Example (geostat-chat-ai/apps/frontend)

**vite.config.js (hand-written):**
```javascript
export default defineConfig({
    envDir: path.resolve(__dirname, '../../ops/config/frontend'),  // ← Hardcoded path
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    'vendor-react': ['react', 'react-dom', 'react-router-dom'],
                }
            }
        }
    }
})
```

**Key:** `envDir` points to `ops/config/frontend/` — where kit puts the secrets. Vite reads `.env`, `.env.dev`, `.env.prod` from there.

**package.json (hand-written):**
```json
{
  "name": "geostat-chat-frontend",
  "type": "module",
  "scripts": {
    "dev": "vite --mode dev",
    "build": "vite build --mode prod",
    "test": "vitest run"
  },
  "dependencies": { "react": "^19.2.0", ... },
  "devDependencies": { "@vitejs/plugin-react": "^5.1.0", ... }
}
```

**tsconfig.json (hand-written):** Standard TypeScript config.

**docker-compose.yml (hand-written):**
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
    environment:
      - VITE_API_URL=${VITE_API_URL}
```

**All of these are committed to git. Kit never generates them.**

---

## Workspace vs Independent Modules

### geostat-chat-ai (Current Real Project)
- **No root package.json** (no workspace)
- Each app (backend, frontend, ingestion, retrieval) is **fully independent**
- Each has own:
  - package.json
  - tsconfig.json
  - docker-compose.yml
  - node_modules/ (separate)
- Kit treats them as separate modules; manifests them individually

**Result:** True independence, but:
- Each app installs full devDeps (no dedup)
- Harder to enforce consistent lint/build rules across apps

### national-accounts (This Workspace)
- **Root package.json with `"workspaces": ["apps/*"]`**
- Two apps: geostat, panel
- Both are workspace members; share:
  - Root node_modules
  - Root devDependencies (ESLint, TypeScript, Vite, etc.)
  - Root tsconfig with path aliases to shared engine/ packages
- Kit treats them as separate modules; manifests them individually

**Result:** Monorepo benefits:
- Single npm install
- Shared devDeps (smaller disk, less duplication)
- Consistent linting across apps
- Shared engine/* packages via tsconfig paths

### Kit Compatibility

**Kit works with both.**

- **Workspace?** Kit doesn't care. It runs `npm run dev --workspace apps/geostat` or `npm run dev` (depending on root scripts), and npm respects the workspace.
- **Independent?** Kit still works. It runs `npm run dev` in the module's CWD, and npm finds that module's package.json + local node_modules.

**The only thing that matters to kit:** Module path (apps/frontend) contains a package.json with scripts that match manifest.modules.{id}.debug.npmScript or root script names.

---

## Config Generation: Only for Java

**config_gen.py** (in kits/geostat-kit/lib/):
- Reads manifest + stack catalog
- Generates Spring `application.yml`, `application-{profile}.yml`
- Output: `.yml` files in `apps/{backend,retrieval,ingestion}/src/main/resources/`

**Node modules get NO config generation:**
- vite.config.js is hand-written
- tsconfig.json is hand-written
- .env files are authored in `ops/config/{secretsModule}/` as templates or deployed
- Kit **does not** touch these files

---

## Deploy Layout: Structured Paths

From `lib/deploy_paths.py`, structured layout:

| Module Type | Deploy Kind | Path |
|-------------|------------|------|
| Frontend | static | `/deploy/base/static/{container-name}/` |
| Frontend | compose-dev | `/deploy/base/compose/dev/{container-name}/` |
| Backend | runtime (JAR) | `/deploy/base/runtime/{container-name}/` |
| Backend | workspace (dev) | `/deploy/base/workspace/{container-name}/` |

**Container name resolution:**
```python
def resolve_module_service_name(module_id, manifest, deploy, repo_name):
    # Uses role (api, ui, worker) + target (optional) + deploy.env overrides
    # Example: module_id="frontend", role="ui" → "geostat-chat-ai-app"
```

All computed at deploy time from manifest + `ops/config/{secretsModule}/.env.deploy`.

---

## Secrets & Credentials

**Per-module folder structure:**
```
ops/config/
├── frontend/
│   ├── .env.dev         ← Dev environment (VITE_API_URL, etc.)
│   ├── .env.deploy      ← Deploy config (DEPLOY_SERVER, DEPLOY_PATH, DEPLOY_LAYOUT)
│   └── nginx.env        ← Optional: Nginx template vars
├── backend/
│   ├── .env.dev
│   ├── .env.deploy
│   └── .env.prod
├── gcp/
│   ├── google-credentials.json  ← GCP service account (module-specific)
```

**Kit's role:**
1. Maps module.secretsModule to folder (backend → ops/config/backend)
2. Binds credentials (GCP file) to module if specified in manifest
3. Passes env files to deploy scripts (rsync to remote, Docker at startup)

**No env file generation; they're authored/committed/deployed as templates.**

---

## Node-Vite Driver: What It Expects

**Script:** `drivers/node-vite/ps1/dev.ps1`

**Expectations:**
1. Module path (CWD) contains `docker-compose.yml`
2. `docker-compose.yml` defines 1+ services (usually 1)
3. `ops/config/{secretsModule}/.env.dev` exists (for local dev)
4. `ops/config/{secretsModule}/.env.deploy` exists (for remote dev)
5. `ops/config/{secretsModule}/.env.prod` exists (for production deploy)
6. Root `.env` is typically NOT in the module (uses ops/config instead)

**Commands:**
- `dev bootstrap`: Rsync source from Windows → Linux, compose up --build
- `dev watch`: Debounced rsync on save
- `dev restart`: Restart compose on remote
- `run`: Local `npm run dev` with .env.dev
- `deploy local|dist|remote|sync|watch`: Artifact-based deploy
- `compose`: Local `docker-compose.yml` operations
- `check`: Pre-flight checks (rsync, ssh, env vars)
- `manage`: Remote lifecycle (stop/start/logs)

**No build config generation; all expectations are about runtime discovery from existing files.**

---

## Java-Boot Driver: What It Expects

**Script:** `drivers/java-boot/sh/dev.sh` and siblings

**Expectations:**
1. Module path contains `build.gradle` (Gradle project)
2. `kits/geostat-kit/lib/config_gen.py` has run → generates `application.yml`
3. `ops/config/{secretsModule}/.env.dev`, `.env.deploy` exist
4. `docker-compose.dev.yml` exists in module (for local dev)
5. Optional: `hybrid.bootJar` in manifest for pre-built JAR path

**Commands:**
- `dev bootstrap`: Rsync source + compose up --build
- `dev watch`: Debounced rsync + bootRun (Spring DevTools auto-restart in container)
- `deploy`: Gradle build → JAR → upload to `runtime/{container}`
- `deploy watch`: Debounced JAR rebuild + upload + compose up --build
- `run`: Local `./gradlew bootRun` with .env.dev (hybrid mode)
- `manage`, `check`, `compose`: Similar to node-vite

**Config generation:** config_gen.py runs once at setup; generated files checked in (or regenerated in CI).

---

## Summary: Kit's Build Control Boundary

### Kit Controls (via manifest)
- Where each module lives
- What type/driver each module uses
- Which secrets folder per module
- Compose stack generation (multi-module docker-compose.yml)
- Deploy paths (structured/flat/legacy)
- Credential binding (GCP per-module)
- Command dispatch (type → registry → script)

### Kit Does NOT Control (each module owns)
- package.json contents & scripts
- tsconfig.json, vite.config.js, eslint.config.js
- Dependency management (npm, Gradle)
- Build artifacts (dist/, build/)
- Module interdependencies (each app defines its own)

### Architectural Implication
**Manifest is source of truth for ops/deployment. Build configs are source of truth for each module.**

This separation allows:
- Kit to be agnostic to project shape (single api, multi-api, multi-worker, etc.)
- Each module to evolve its build independently (upgrade Vite, change tsconfig, etc.)
- Kit to support workspace OR independent modules without changes
- Zero hardcodes of module names, paths, ports in kit code

---

## Files Read

### geostat-kit Sources
- `geostat.ops.json` — manifest definition
- `manifest.schema.json` — manifest schema
- `drivers/registry.json` — type → commands mapping
- `drivers/node-vite/{README,ps1/*.ps1}` — Node driver
- `drivers/java-boot/{README,sh/*.sh}` — Java driver
- `lib/project_context.py` — manifest loader & accessor
- `lib/compose_identity.py` — service naming logic
- `lib/config_gen.py` — Spring config generation
- `lib/deploy_paths.py` — deployment path resolution
- `cli/geostat.ps1` — main dispatcher

### National-Accounts Project
- `package.json` — root workspace
- `tsconfig.json` — composite config with engine/ paths
- `apps/geostat/{package,tsconfig,vite.config}.json` — app config
- `apps/panel/{package,tsconfig,vite.config}.ts` — app config

### Geostat-Chat-AI Reference
- `apps/frontend/{package.json,vite.config.js,docker-compose.yml}` — independent module
- `apps/backend/{build.gradle,docker-compose.yml}` — independent module
- `ops/config/{frontend,backend}/{.env.dev,.env.deploy}` — secrets folders
- `ops/compose/stack/docker-compose.yml` — generated multi-module stack

---

## Verdict: Fully Independent Modules vs Workspace

**For national-accounts:**
- **Current workspace (shared devDeps, shared engine packages) is optimal.** It keeps lint/build tools consistent and engine packages DRY.
- Kit supports this without changes; no issues.
- If you want to split into fully independent modules later (remove workspace), kit will still work; just means each app installs its own devDeps.

**Decision:** Keep the workspace. It's a good fit for a 2-3 app monorepo with shared engine packages.
