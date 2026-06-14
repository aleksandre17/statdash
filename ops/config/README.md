# ops/config — Secrets & Environment

All real env values live **only here**. `apps/geostat/` and `apps/panel/` hold code; secrets stay in this directory.

All `.env.*` files (except `.env.example`) are **gitignored** — never commit real secrets.

## Structure

```
ops/config/
├── README.md              # this file
├── deploy.env.example     # shared deploy / SSH template → copy to deploy.env (gitignored)
├── deploy.env             # real deploy config (gitignored)
├── geostat/
│   └── .env.example       # geostat app env template → copy to .env.dev / .env.prod
│   └── .env.dev           # local dev (gitignored)
│   └── .env.prod          # production (gitignored)
└── panel/
    └── .env.example       # panel app env template → copy to .env.dev
    └── .env.dev           # local dev (gitignored)
```

## First-time setup

```powershell
cd ops\config
Copy-Item deploy.env.example deploy.env
Copy-Item geostat\.env.example geostat\.env.dev
Copy-Item geostat\.env.example geostat\.env.prod
Copy-Item panel\.env.example   panel\.env.dev
```

## Who reads what

| Tool | Source |
|------|--------|
| `npm run dev` (geostat) | `ops/config/geostat/.env.dev` (or `apps/geostat/.env` for legacy) |
| `npm run build` (geostat) | `ops/config/geostat/.env.prod` |
| `tools/statdash.ps1 deploy geostat` | `ops/config/deploy.env` + `ops/config/geostat/.env.prod` |
| Docker compose (dev) | `ops/config/geostat/.env.dev` |
| Docker compose (prod) | `ops/config/geostat/.env.prod` |
