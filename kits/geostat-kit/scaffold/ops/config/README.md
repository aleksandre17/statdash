# ops/config/ — project configuration (consumer repo, not in geostat-kit package)

All runtime values live here. Application folders (`frontend/`, `backend/`) hold code only.

## First-time setup

```powershell
copy deploy.env.example deploy.env
copy frontend\.env.example frontend\.env.dev
copy frontend\.env.example frontend\.env.prod
copy frontend\.env.deploy.example frontend\.env.deploy
copy backend\.env.example backend\.env.dev
copy backend\.env.example backend\.env.prod
copy backend\.env.deploy.example backend\.env.deploy
# SSH: ssh/README.md
# GCP (if needed): backend/google-credentials.json
```

Then: `.\tools\geostat.ps1 compose-gen`

## Layout

See [kits/geostat-kit/scaffold/README.md](../scaffold/README.md) and [kits/geostat-kit/docs/ADOPTION-LINE.md](../docs/ADOPTION-LINE.md).
