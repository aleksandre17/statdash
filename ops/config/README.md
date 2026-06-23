# ops/config — Secrets & Environment

All real env values live **only here**. `platform/apps/*` hold code; secrets stay in this directory.

All `.env.*` files (except `.env.example` / `.env.*.example`) are **gitignored** — never commit real secrets. SSH keys (`ssh/id_*`) are gitignored too.

Config module dirs = app names = `geostat.ops.json` module ids = each module's `secretsModule`.

## Structure

```
ops/config/
├── README.md                # this file
├── deploy.env.example       # shared deploy / SSH template → copy to deploy.env (gitignored)
├── deploy.env               # real deploy identity (gitignored): DEPLOY_SERVER, DEPLOY_PROJECT=statdash
├── ssh/                     # project-local SSH (gitignored config + keys; config.example tracked)
├── api/                     # @statdash/api (Fastify) — vars from platform/apps/api/src/env.ts
│   ├── .env.example         #   contract template
│   ├── .env.dev.example     #   local/hybrid dev template
│   └── .env.deploy.example  #   remote deploy path/port template
├── geostat/                 # SDUI runner — VITE_STORE_MODE / VITE_SITE_MODE / VITE_API_STATS_URL
├── panel/                   # Constructor — VITE_API_URL
├── db/                      # Postgres/Flyway identity (POSTGRES_*) — SSOT for DB credentials
└── infra/                   # infra identity (INFRA_SLUG/PREFIX, DOCKER_NETWORK, POSTGRES_PORT)
```

## First-time setup

```powershell
cd ops\config
Copy-Item deploy.env.example deploy.env
Copy-Item ssh\config.example  ssh\config        # then fix HostName + IdentityFile
Copy-Item api\.env.example     api\.env
Copy-Item db\.env.example      db\.env
Copy-Item infra\.env.dev.example infra\.env.dev
Copy-Item geostat\.env.example geostat\.env.dev
Copy-Item panel\.env.example   panel\.env.dev
```

## Who reads what

| Consumer | Source |
|----------|--------|
| `@statdash/api` (Fastify, src/env.ts) | `ops/config/api/.env` |
| Postgres + pgBouncer + Flyway + pgAdmin | `ops/config/db/.env` (POSTGRES_*) |
| Infra compose identity (network, ports) | `ops/config/infra/.env.dev` |
| geostat dev/build | `ops/config/geostat/.env.dev` / `.env.prod` |
| panel dev/build | `ops/config/panel/.env.dev` |
| Remote deploy (statdash.ps1 / kit) | `ops/config/deploy.env` + per-module `.env.deploy` |
```
