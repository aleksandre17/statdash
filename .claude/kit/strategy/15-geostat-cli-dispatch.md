# geostat-chat-ai: CLI Dispatch & Driver Model

**Reconnaissance:** 2026-06-14 · **Source:** `C:\Users\Test-User\CursorProjects\geostat-chat-ai`

## CLI Entry Point: geostat.ps1

**File:** `kits/geostat-kit/cli/geostat.ps1` + `ops/cli/geostat.sh`

### Dispatch Contract

```powershell
geostat {command} [args...]
```

**Examples:**
```powershell
geostat validate              # Validate manifest against schema
geostat compose-gen           # Generate docker-compose files from catalog
geostat stack up -d --build   # Full-stack: docker compose up
geostat be deploy api --prod  # Deploy chat-api (alias: be → chat-api)
geostat fe dev watch          # Frontend source rsync + rebuild watch
geostat infra tunnel          # SSH tunnel for remote Postgres/Qdrant
```

### Dispatch Flow

1. **Load manifest**
   ```powershell
   $Root = Get-ProjectRootFromManifest  # Find geostat.ops.json
   $Manifest = ConvertFrom-Json (Get-Content geostat.ops.json)
   ```

2. **Resolve alias (optional)**
   ```powershell
   $Alias = Get-CliAliasesFromManifest  # "fe" → "frontend", "be" → "chat-api"
   if ($Command -in $Alias.Keys) {
     $ModuleId = $Alias[$Command]
   }
   ```

3. **Module command dispatch**
   ```powershell
   # geostat be deploy → geostat mod chat-api deploy
   $Type = Get-ModuleType "chat-api"  # "java-boot"
   $DriverScript = Get-DriverCommandPath -Type $Type -Command "deploy"
   # → drivers/java-boot/sh/deploy.sh
   & $DriverScript @args
   ```

## Driver Registry: Type → Command Mapping

**File:** `kits/geostat-kit/drivers/registry.json`

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

**Key Insight:** Every command is a **relative path to a script**. Kit resolves type + command → script path, then executes. No logic in kit; logic in drivers.

### Module Commands

Each driver must implement these commands:

| Command | Responsibility |
|---------|-----------------|
| `deploy` | Build artifact, upload, docker up (5-step) |
| `dev` | Local F5 debug or remote watch mode |
| `run` | Execute app in host environment (no Docker) |
| `manage` | Lifecycle: logs, restart, nuke, health |
| `compose` | Generate docker-compose file(s) |
| `check` | Health check (actuator or HTTP) |
| `modules` | List submodules (Gradle subprojects, npm workspaces) |

### Example: Backend Deploy Flow

```
geostat be deploy api --prod
  ↓
Resolve alias: be → chat-api
Get type from manifest: chat-api.type = "java-boot"
Get driver script: drivers/java-boot/sh/deploy.sh
Export env: GEOSTAT_MODULE_ID=chat-api, GEOSTAT_PROJECT_ROOT=...
Execute: bash deploy.sh api --prod
  ↓ (in deploy.sh)
  ├─ gradle-build.sh (./gradlew build -x test)
  ├─ jar-prepare.sh (extract metadata)
  ├─ upload.sh (scp to server)
  ├─ server-compose.sh (generate compose on server)
  └─ docker-up.sh (docker compose up + health check)
```

### Example: Frontend Watch Flow

```
geostat fe dev watch
  ↓
Resolve alias: fe → frontend
Get type from manifest: frontend.type = "node-vite"
Get driver script: drivers/node-vite/ps1/dev.ps1
Execute: PowerShell dev.ps1 watch
  ↓ (in dev.ps1)
  ├─ Assert rsync available (Git Bash)
  ├─ Generate rsync excludes
  ├─ rsync src/ to server workspace/
  ├─ Poll for changes (find -mmin -0.05)
  ├─ On change: npm run build + sync dist/
  └─ Repeat (debounced 3000ms)
```

## Per-Module Ops Config

**Files:** `apps/{backend,frontend}/ops.config.{sh,ps1}`

```bash
# apps/backend/ops.config.sh
OPS_SECRETS_MODULE="backend"        # ops/config/backend/
OPS_PROJECT_NAME=""                 # Fallback if DEPLOY_PROJECT unset
OPS_TARGET_DEFAULT="backend"        # Default module for Gradle
VERSIONS_KEEP=5
HEALTH_RETRIES=24
CRED_PATTERNS="*.p12 *.jks *.json"
```

```powershell
# apps/frontend/ops.config.ps1
$OpsSecretsModule = "frontend"
$OpsComposeFile = "docker-compose.yml"
# Optional overrides:
# $OpsDevWatchPaths = @("src/**/*.{tsx,css}")
# $OpsDevSyncExcludes = @("node_modules", "build")
```

These values are **sourced by drivers** to customize behavior per-module without editing kit.

## Why This Model Works

1. **No hardcodes** — Kit never writes app names, ports, or paths
2. **Extensible** — Add new driver type (e.g., `go-service`) = new dir in `drivers/`
3. **Composable** — Each command is a separate script; can re-run independently
4. **Readable** — Ops decisions visible in manifest + registry, not scattered in code
5. **Team-safe** — Same CLI for all team members; CI/CD uses same commands
