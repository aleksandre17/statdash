---
RECONNAISSANCE: Geostat-Kit Command Dispatch & Drivers
Agent: Explorer (Haiku) | Date: 2026-06-14
---

# Command Dispatch: Manifest → Type → Registry → Script

## Three-Layer Resolution

### 1. Alias Resolution (CLI Input)
User: `geostat fe dev bootstrap`
- Manifest alias: `fe` → `frontend` (from manifest.cli.aliases)

### 2. Module Discovery (Manifest Query)
ProjectContext reads manifest, finds module `frontend`:
```json
{
  "path": "apps/frontend",
  "type": "node-vite",
  "role": "ui",
  "secretsModule": "frontend"
}
```

Gets: path, type, role, secrets folder

### 3. Driver Lookup (Registry)
drivers/registry.json:
```json
{
  "node-vite": {
    "runtime": "powershell",
    "commands": {
      "dev": "ps1/dev.ps1",
      "deploy": "ps1/deploy.ps1",
      "run": "ps1/run.ps1",
      "check": "ps1/check.ps1",
      "compose": "ps1/compose.ps1",
      "manage": "ps1/manage.ps1"
    }
  }
}
```

Type `node-vite` → command `dev` → script `ps1/dev.ps1`

### 4. Command Dispatch
```powershell
cd apps/frontend
& "kits/geostat-kit/drivers/node-vite/ps1/dev.ps1" bootstrap -Environment dev
```

## Driver Structure: node-vite Example

```
drivers/node-vite/
├── README.md              ← Commands & prerequisites
├── _init.ps1              ← Driver init (sets env, loads toolkit libs)
└── ps1/
    ├── _common.ps1        ← Shared functions (sourced by all)
    ├── dev.ps1            ← Remote dev: rsync + compose
    ├── deploy.ps1         ← Artifact deploy (local|dist|remote|sync|watch)
    ├── run.ps1            ← Local npm run + .env.dev (hybrid)
    ├── check.ps1          ← Pre-flight validation
    ├── compose.ps1        ← Local docker-compose ops
    └── manage.ps1         ← Server-side lifecycle (stop|start|logs)
```

All scripts dot-source `_init.ps1`:
```powershell
. "$PSScriptRoot\..\_init.ps1"
```

This loads:
- ProjectContext discovery (find project root)
- Toolkit functions (Deploy-Path, Get-ComposeServices, SSH helpers)
- Module env files (.env.dev, .env.deploy from ops/config/{secretsModule}/)

## Runtime Discovery: No Hardcodes

**Example: dev.ps1 finds service name**

```powershell
$GetComposeServices = Join-Path $env:GEOSTAT_KIT_ROOT "toolkit\powershell\Get-ComposeServices.ps1"
. $GetComposeServices

# Parse CWD's docker-compose.yml
$_services = @(Get-ComposeServicesFromFile -ModuleRoot $ROOT -ComposeFile "docker-compose.yml" ...)
$_serviceNames = @($_services | ForEach-Object { $_.Name })

# User picks or auto-select if 1 service
if ($_services.Count -eq 1) {
    $ServiceName = $_services[0].Name
} elseif ($_services.Count -gt 1) {
    $ServiceName = Select-Option "Select Service" $_serviceNames ...
}
```

**No hardcoded service names.** Script parses docker-compose.yml in CWD to discover.

## Command Categories

### Dev Commands (Windows → Linux, source rsync)

**`geostat fe dev bootstrap`**
- Rsync source (no dist/)
- Build Docker image on remote
- Start compose on remote server
- Requires: `DEPLOY_SERVER`, rsync (Git for Windows), docker-compose.override.yml with dev target

**`geostat fe dev watch`**
- Debounced rsync on save (watches src/)
- No rebuild; relies on Vite hot-reload in container
- Lighter than `deploy watch` (no npm build)

**`geostat fe dev restart`**
- Restart compose on remote (no resync)
- Used after config change, credential update

### Deploy Commands (Artifact-based)

**`geostat fe deploy local`**
- Build Docker locally
- Run container locally
- For testing before remote deploy

**`geostat fe deploy dist`**
- Local npm build → dist/
- Copy dist/ + nginx.conf to server
- Fast static deploy (no Docker rebuild on server)

**`geostat fe deploy remote`**
- Copy source to server
- Docker build on server
- For full server-side build (slower but uses server compute)

**`geostat fe deploy sync`**
- Rebuild local dist/ + nginx.conf
- Sync to server (quick re-deploy of static assets)

**`geostat fe deploy watch`**
- Debounced `deploy sync` loop on save
- Fastest iteration for static UI
- Use `fe dev watch` for source rsync (Vite server-side)

### Hybrid Commands (Local)

**`geostat fe run`**
- Local `npm run dev` (manifest.debug.npmScript)
- Loads `.env.dev` from ops/config/{secretsModule}/
- No Docker; Vite on Windows
- For rapid dev iteration (if you prefer Windows dev)

### Lifecycle Commands

**`geostat fe compose`**
- Local docker-compose up/down/logs
- Uses docker-compose.yml + docker-compose.override.yml

**`geostat fe manage`**
- Remote server lifecycle
- stop / start / logs / shell on remote runtime

**`geostat fe check`**
- Pre-flight validation
- Checks DEPLOY_SERVER, rsync, SSH creds, env vars
- Before any deploy

## Java-Boot Driver (Bash)

Similar structure but bash:
```
drivers/java-boot/
├── _init.sh
└── sh/
    ├── dev.sh             ← rsync + gradlew bootRun
    ├── deploy.sh          ← gradle build → JAR → upload
    ├── run.ps1            ← Local ./gradlew bootRun (hybrid)
    ├── manage.sh
    ├── check.sh
    ├── compose.sh
    └── modules.sh         ← Query ops.modules registry
```

Bash version reads same manifest, resolves same runtime metadata, behaves the same (just POSIX instead of PowerShell).

## Secrets/Env Loading

All drivers load secrets from `ops/config/{secretsModule}/`:

1. **_init.ps1 / _init.sh loads:**
   - `ops/config/{secretsModule}/.env.dev` (local dev env)
   - `ops/config/{secretsModule}/.env.deploy` (deploy config: DEPLOY_SERVER, DEPLOY_PATH, DEPLOY_LAYOUT)
   - `ops/config/{secretsModule}/docker-compose.override.yml` (optional, for local dev)

2. **At runtime (dev / deploy):**
   - Script reads env vars from loaded files
   - Passes to SSH / Docker / npm commands
   - No hardcoded creds; all injected from env

3. **GCP Credentials:**
   - If manifest.modules.{id}.credentials → kit binds file
   - E.g., ops/config/backend/google-credentials.json
   - Mounted to container via docker-compose or SSH

## Module-Manifest Contract

Driver expects manifest.modules.{id} to provide:

```json
{
  "path": "apps/frontend",
  "type": "node-vite",
  "role": "ui",
  "secretsModule": "frontend",
  "target": "frontend",                    // Optional; defaults to module id
  "debug": {
    "npmScript": "dev"                     // npm run X (for fe run)
  }
}
```

Driver uses:
- `path`: CWD for all commands
- `type`: Determines which driver to use
- `secretsModule`: Where to load .env files (ops/config/{value}/)
- `target`: Service name in compose (optional override)
- `debug.npmScript`: Which npm script to invoke for local dev

**Everything else:** discovered at runtime (service names, ports, deploy paths, credentials).

## Verdict

**No hardcodes in kit code. All module names, paths, service names, ports, credentials resolved at runtime from:**
1. Manifest (static metadata)
2. docker-compose.yml in module (service discovery)
3. .env files in ops/config/ (runtime config)
4. Module's own package.json, tsconfig, etc. (build behavior)

**This enables kit to work for any project shape without modification.**
