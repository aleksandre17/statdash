---
name: geostat-kit-drivers
description: Driver registry, type dispatch model, and how to add new drivers
metadata:
  type: reference
---

# Driver Model — Type-Based Dispatch

**Registry:** `kits/geostat-kit/drivers/registry.json`

## Registry Structure

```json
{
  "java-boot": {
    "label": "Spring Boot / Gradle",
    "runtime": "bash",
    "roles": ["api", "worker"],
    "commands": {
      "compose": "sh/compose.sh",
      "deploy": "sh/deploy.sh",
      "dev": "sh/dev.sh",
      "manage": "sh/manage.sh",
      "modules": "sh/modules.sh"
    }
  },
  "node-vite": {
    "label": "Vite + rollup frontend",
    "runtime": "powershell",
    "roles": ["ui"],
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

## Dispatch Flow

1. User: `geostat fe deploy --prod` (or `geostat mod frontend deploy`)
2. CLI resolves alias: `fe` → `frontend` (via manifest `cli.aliases`)
3. CLI reads module type: `modules.frontend.type` → `node-vite`
4. CLI looks up driver: `registry.json` → `node-vite`
5. CLI finds command: `commands.deploy` → `ps1/deploy.ps1`
6. CLI executes: `kits/geostat-kit/drivers/node-vite/ps1/deploy.ps1`
7. Script sources `lib/env.ps1` → loads manifest via ProjectContext
8. Script runs: `docker compose`, `rsync`, etc. with resolved values

**Key:** Driver scripts don't hardcode paths/modules; they query the manifest API.

## Directory Structure

```
drivers/
├── registry.json               # Type → commands mapping
├── registry.schema.json
├── java-boot/
│   ├── sh/
│   │   ├── _init.sh           # Common env setup (sourced by all scripts)
│   │   ├── compose.sh         # Docker compose integration
│   │   ├── deploy.sh          # Remote JAR deploy
│   │   ├── dev.sh             # Remote dev: rsync + bootRun watch
│   │   └── modules.sh         # Discover modules in built JAR
│   └── README.md
├── node-vite/
│   ├── ps1/
│   │   ├── _common.ps1        # Common env setup
│   │   ├── compose.ps1        # Compose w/ dev/prod variants
│   │   ├── check.ps1          # Syntax/lint checks
│   │   ├── deploy.ps1         # Build + upload static dist
│   │   └── manage.ps1         # Logs, status, delete
│   └── README.md
├── node-api/
│   └── README.md              # Placeholder for future Node HTTP API
├── _template/
│   └── README.md              # Copy to create new type
└── README.md
```

## Adding a New Driver

1. Copy `drivers/_template/` → `drivers/my-type/`
2. Implement required commands:
   - `compose.<sh|ps1>` — docker compose integration
   - `deploy.<sh|ps1>` — remote deploy
   - `manage.<sh|ps1>` — logs, status, delete
   - (optional) `check.*`, `dev.*`
3. Register in `registry.json`:
   ```json
   "my-type": {
     "label": "My language / runtime",
     "runtime": "bash|powershell",
     "commands": {
       "compose": "sh/compose.sh",
       "deploy": "sh/deploy.sh",
       "manage": "sh/manage.sh"
     }
   }
   ```
4. Consume in manifest:
   ```json
   "modules": {
     "my-service": {
       "type": "my-type",
       "path": "apps/my-service",
       "secretsModule": "my-service"
     }
   }
   ```
5. Run `geostat help` — lists new type in output

## No Single Module Assumption

Driver registry allows **multiple modules per type** (e.g., two Node APIs, three backends). Dispatch is by `modules.<id>.type`, not by folder name. Kit never assumes `backend` is java-boot; it reads the type explicitly.

