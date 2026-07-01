---
name: geostat-kit-drivers
description: Driver architecture - pluggable module type system (java-boot, node-vite)
metadata:
  type: reference
---

# geostat-kit drivers/ — Type-Driven Command Dispatch

Drivers are pluggable command sets. Kit never calls driver directly; CLI dispatches: module-id → type → driver → command.

## Registry

`drivers/registry.json`:
```json
{
  "java-boot": {
    "label": "JVM — Gradle / Spring Boot (multi-module JAR deploy)",
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
    "label": "Node — SPA dev remote + static deploy (Vite, Angular, Nx)",
    "roles": ["ui"],
    "runtime": "powershell",
    "commands": {
      "deploy": "ps1/deploy.ps1",
      "dev": "ps1/dev.ps1",
      "run": "ps1/run.ps1",
      "manage": "ps1/manage.ps1",
      "compose": "ps1/compose.ps1",
      "check": "ps1/check.ps1"
    }
  }
}
```

## Command Contract

All drivers must implement:

| Command | Purpose | Input | Output |
|---------|---------|-------|--------|
| `deploy` | Build + upload to server | module-id, env | artifact in `DEPLOY_PATH` |
| `dev` | Local dev (bootRun or watch) | module-id, profile | running process on port |
| `run` | Hybrid boot (local JVM/npm) | module-id | process + logs |
| `compose` | Generate Dockerfile + docker-compose.*.yml | module-id | in app dir |
| `check` | Health check (curl, wget, or curl /actuator) | host:port | exit 0/1 |
| `manage` | Lifecycle: status, logs, stop, start, restart, nuke | subcommand | container state change |
| `modules` | Gradle module list (java-boot only) | — | stdout: module names |

## java-boot Driver

Location: `drivers/java-boot/`

### sh/deploy.sh
- Calls gradle build (if not preferJar)
- JAR in `apps/backend/build/libs/`
- Uploads to `DEPLOY_PATH/runtime/{module-id}/app.jar`
- Calls `toolkit/deploy/upload.sh` for rsync + remote setup
- Runs Flyway migrations if `modules.<id>.datastores.postgres.flyway == true`
- Health check: `curl http://localhost:{port}/actuator/health | grep UP`

### sh/dev.sh
- Local: `gradle bootRun` (if not preferJar)
- Docker: `docker compose up` (hybrid/compose mode)
- Reads `modules.<id>.spring.profileGroups` for profile order
- Env: `.env.dev` from `ops/config/<secretsModule>/`

### ps1/run.ps1
- PowerShell hybrid entry: `hybrid boot <module>`
- Calls `Invoke-HybridRun.ps1` → `Invoke-HybridJarBoot.ps1` if preferJar
- Alternative: `gradle bootRun` if no JAR
- Respects `spring.springProfiles`

### sh/compose.sh
- Generates `Dockerfile.dev` (gradle bootRun target)
- Generates `docker-compose.dev.yml` (via kit compose-gen)
- Output: `apps/backend/` (git-ignored)

### sh/manage.sh
- `status` — docker ps / systemctl status
- `logs {source} {level}` — docker logs / journalctl
  - Sources: app, db, auth, errors, files
  - Levels: DEBUG, INFO, WARN, ERROR
- `stop|start|restart` — docker / systemctl
- `nuke` — stop + rm + delete deploy dir (no images)
- `reload` — N/A (no-op)

### sh/check.sh
- Probes `/actuator/health` (Spring Boot standard)
- Returns exit 0 (UP) or 1 (DOWN)

### sh/modules.sh
- Parses gradle subprojects
- Stdout: module names (for config-gen sync)

### _init.sh
- Verify: gradle, java, docker
- Dry-run checks (syntax, dependencies)
- Skipped if tools missing

## node-vite Driver

Location: `drivers/node-vite/`

### ps1/dev.ps1
- Runs `npm run dev` (or custom npmScript)
- Port: from manifest or default 5177
- Watches `src/`, hot reload
- Local development in PowerShell window

### ps1/deploy.ps1
- Runs `npm run build` (prod)
- Dist output: `apps/frontend/dist/`
- Uploads to `DEPLOY_PATH/runtime/{module-id}/dist/`
- Triggers nginx reload on server
- No container used in static deploy

### ps1/compose.ps1
- Multi-stage Dockerfile:
  - `development` target: node + vite dev server (5177)
  - `production` target: node + nginx (80)
- Generates `docker-compose.yml` + `docker-compose.override.yml` (dev)
- Calls kit compose-gen for stack integration

### ps1/run.ps1
- Hybrid: npm run dev (local 5177)
- Or docker run if prefer-container
- Respects `npmScript` from manifest

### ps1/manage.ps1
- `status` — docker ps / systemctl (static: file exists?)
- `logs` — docker logs (compose) or error log file (static)
- `stop|start|restart|reload` — docker or nginx reload
  - Reload: `nginx -s reload` (static dist only)
- `config` — show `dist/config.json` (static mode)
- `nuke` — stop + rm + delete dist/ (keep nginx config)

### ps1/check.ps1
- `curl http://localhost:{port}/` (compose dev)
- `wget http://server/index.html` (static prod)
- Exit 0/1

### _init.ps1
- Verify: node, npm, docker
- Pre-flight: package.json, vite.config.js
- Skipped if tools missing

## How Kit Dispatches

CLI flow (example: `geostat be compose`):

1. `cli/geostat.ps1` resolves alias: `be` → `chat-api`
2. Gets module type: `manifest.modules.chat-api.type` → `java-boot`
3. Looks up command: `drivers/java-boot/sh/compose.sh`
4. Executes: `bash drivers/java-boot/sh/compose.sh`
5. Script reads manifest from ProjectContext (ProjectContext exports env vars)

## Design Rules

1. **Drivers are stateless** — all config from manifest + env files
2. **No consumer brand in driver code** — substitute placeholders only
3. **Health check standardized** — port is manifest field, URL is role-based
4. **Credential files in containers** — mounted at runtime, never logged
5. **Exit codes matter** — 0 = success, 1 = failure (CI depends on it)
6. **Compose generated** — drivers create Dockerfile + docker-compose templates, kit merges them

## Extension Points

To add a custom driver type (e.g., `rust-axum`):

1. Add to `drivers/registry.json`
2. Create `drivers/rust-axum/{sh,ps1}/` (same command set)
3. Implement all commands (deploy, dev, run, compose, check, manage)
4. Reference in manifest: `modules.<id>.type = "rust-axum"`
5. Kit auto-discovers and dispatches

No kit changes needed; manifest-driven extensibility.
