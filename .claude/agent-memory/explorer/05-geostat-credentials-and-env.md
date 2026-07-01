---
name: geostat-credentials-and-env
description: Credentials management (per-module + global), env file contract, and no-secrets-in-code
metadata:
  type: reference
---

# Credentials & Environment — No Secrets in Code

**File:** `lib/credentials.py` — credential resolution  
**Principle:** Real values in `ops/config/`, references only in kit code

## Environment File Contract

**Per-module structure** (`ops/config/<secretsModule>/`):
```
.env.dev              # Local development (sourced by docker compose dev)
.env.prod             # Production (sourced by docker compose prod)
.env.deploy           # Deploy scripts (DEPLOY_LAYOUT, DEPLOY_PATH, SSH config)
.env.example          # Template (version control)
.env.deploy.example   # Deploy template
```

**Shared file** (`ops/config/`):
```
deploy.env            # DEPLOY_SERVER, DEPLOY_PROJECT, COMPOSE_* overrides (gitignored)
deploy.env.example    # Template
```

**Load order by tool:**
- `docker compose up`: `--env-file .env.dev` or `.env.prod`
- `geostat be deploy`: `.env.*` + `deploy.env` (reads multiple)
- `geostat be dev`: `.env.deploy` only (DEPLOY_LAYOUT, DEPLOY_PATH)
- Vite build: `--mode prod` → `.env.prod`

## Credentials Resolution

**Architecture:**
```
manifest.modules.<id>.credentials[] (explicit list)
    OR
manifest.features.gcpCredentials + adapters.gcp (global fallback)
    ↓
lib/credentials.py → module_credentials(manifest, module_id)
    ↓
Result: [{"file": "...", "mount": "...", "envVar": "..."}]
    ↓
Render in compose: volumes (read-only) + environment
```

**Rules:**
1. **Check module explicit** (`modules.chat-api.credentials[]`)
   - If present, use those files (override global)
2. **Check global GCP** (`features.gcpCredentials=true`)
   - If enabled and module accepts it (api/worker/java-boot), use global
3. **Fallback:** No credentials (module runs without them)

## Example: Manifest

```json
{
  "features": {
    "gcpCredentials": true  // Global GCP enabled
  },
  "adapters": {
    "gcp": {
      "credentialsFile": "google-credentials.json",
      "containerMount": "/app/google-credentials.json",
      "envVar": "GOOGLE_APPLICATION_CREDENTIALS"
    }
  },
  "modules": {
    "chat-api": {
      "credentials": [  // Override global for this module
        {
          "file": "google-credentials.json",
          "mount": "/app/google-credentials.json",
          "envVar": "GOOGLE_APPLICATION_CREDENTIALS"
        }
      ]
    },
    "frontend": {
      // No explicit creds; doesn't accept global GCP (role: ui)
    },
    "retrieval": {
      // No explicit creds; accepts global (role: api, type: java-boot)
      // Uses global: google-credentials.json
    }
  }
}
```

## Generated Compose

```yaml
chat-api:
  volumes:
    - ops/config/backend/google-credentials.json:/app/google-credentials.json:ro
  environment:
    GOOGLE_APPLICATION_CREDENTIALS: /app/google-credentials.json

retrieval:
  volumes:
    - ops/config/retrieval/google-credentials.json:/app/google-credentials.json:ro
  environment:
    GOOGLE_APPLICATION_CREDENTIALS: /app/google-credentials.json

frontend:
  # No credential volumes (UI doesn't use GCP)
```

## Key Rules

1. **All credentials are read-only** (`:ro` in mount)
2. **Env var names are configurable** (not `GOOGLE_APPLICATION_CREDENTIALS` always)
3. **Multiple credentials per module** supported (array, not single file)
4. **Global GCP is opt-in** (`features.gcpCredentials=true`)
5. **No production secrets in manifest or code** (paths only, real files in ops/config/)
6. **Manifest references files** (`file: "google-credentials.json"`); consumer provides actual files

## Consumer Responsibility

**Provide:**
- `ops/config/backend/google-credentials.json` (gitignored, real file)
- `ops/config/backend/.env.dev` (gitignored, real values)
- `ops/config/backend/.env.prod` (gitignored, real values)
- `ops/config/deploy.env` (gitignored, real deploy config)

**Kit does:**
- Read manifest references
- Mount files read-only
- Inject env var names
- Never embed or log real secrets

