---
RECONNAISSANCE: Geostat-Kit Manifest-Driven Architecture
Agent: Explorer (Haiku) | Date: 2026-06-14
---

# Geostat-Kit: Manifest as Single Source of Truth

Geostat-kit reads `geostat.ops.json` at **runtime** (not build-time). No code generation for per-module build configs. Each module owns its own package.json, vite.config.js, tsconfig.json, docker-compose.yml.

## What Kit Controls (via Manifest)

| Area | Kit's Role | Who Owns It |
|------|-----------|-----------|
| **Module discovery** | Reads manifest: path, type, role, secrets folder | n/a |
| **Secrets/env** | Manages `ops/config/{secretsModule}/` | Module reads from there |
| **Compose stack** | Generates multi-module docker-compose.yml (from catalog) | n/a |
| **Config gen** | Generates Spring application.yml (Java only) | Java modules |
| **Credential binding** | Maps GCP creds to modules | n/a |
| **Deploy paths** | Computes remote paths at deploy time | n/a |
| **Command dispatch** | Type → registry → script invocation | n/a |

## What Kit Does NOT Control (Node)

**For Vite/React/Angular:**
- ❌ vite.config.js (hand-written, committed)
- ❌ tsconfig.json (hand-written, committed)
- ❌ eslint.config.js (hand-written, committed)
- ❌ package.json (hand-written, committed)
- ❌ Dependency resolution
- ✓ Reads .env from `ops/config/{secretsModule}/` at runtime

All build configs are committed. Kit never generates them.

## Module Registration (geostat.ops.json)

```json
{
  "modules": {
    "frontend": {
      "path": "apps/frontend",
      "type": "node-vite",
      "role": "ui",
      "secretsModule": "frontend",
      "target": "frontend"
    }
  }
}
```

**Kit uses:**
- `path`: Working directory for commands
- `type`: Determines driver (java-boot, node-vite)
- `role`: Semantic role (api, ui, worker) — for role-based discovery
- `secretsModule`: Folder under `ops/config/` for .env files
- `target`: Service/container name (optional)

## No-Hardcodes Principle

Commands **never embed** module IDs, paths, service names, ports. All discovered at runtime:

```powershell
# node-vite driver finds service name from docker-compose.yml, not hardcode
$_services = @(Get-ComposeServicesFromFile -ModuleRoot $ROOT -ComposeFile "docker-compose.yml" ...)
# Then uses the parsed service name
```

Same for Java driver (bash): reads gradle, queries compose, resolves paths from manifest + .env.deploy.

## Per-Module Files (Committed)

**apps/frontend/vite.config.js:**
```javascript
export default defineConfig({
    envDir: path.resolve(__dirname, '../../ops/config/frontend'),  // ← Hardcoded, OK
    plugins: [react()],
    // ...
})
```

**apps/frontend/package.json:**
```json
{
  "name": "geostat-chat-frontend",
  "scripts": { "dev": "vite --mode dev", "build": "vite build" },
  "dependencies": { /* ... */ },
  "devDependencies": { /* ... */ }
}
```

**apps/frontend/docker-compose.yml:**
```yaml
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

All committed. Kit never touches them.

## Secrets Structure

```
ops/config/
├── frontend/
│   ├── .env.dev         ← Kit's node-vite driver loads for local dev
│   ├── .env.deploy      ← DEPLOY_SERVER, DEPLOY_PATH, DEPLOY_LAYOUT
│   └── .env.prod        ← Deploy-time env
├── backend/
│   ├── .env.dev
│   ├── .env.deploy
│   └── google-credentials.json
```

Kit binds these per module via manifest.secretsModule. No generation; authored/committed as templates.

## Verdict

**Manifest drives ops/deployment. Each module owns its build config.** This separation enables:
- Kit agnostic to project shape (1 app, 5 apps, N modules)
- Each module evolves independently (upgrade Vite, change tsconfig)
- Support for workspace OR independent modules (kit doesn't care)
- Zero hardcodes in kit code/scripts
