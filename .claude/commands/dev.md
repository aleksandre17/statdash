# Dev Modes — geostat-chat-ai

Quick reference. Full guide: `kits/geostat-kit/docs/DEV-MODES.md`

## Mode matrix

| # | Mode | Apps run on | Infra | Best for |
|---|------|------------|-------|---------|
| ① | Local host | Windows (JVM/Node) | local | F5 breakpoints, fast iteration |
| ② | Local Docker | localhost container | localhost | Full stack smoke |
| ③ | Remote watch | Windows source → Linux+Docker | remote | Live reload on server |
| ④ | Hybrid | Windows (JVM/Node) | remote + SSH tunnel | Breakpoints + real infra |

**Default**: hybrid when `DEPLOY_SERVER` set in `ops/config/deploy.env`, local otherwise.

## CLI commands

```powershell
# --- Hybrid / Local (auto-detect) ---
.\tools\geostat.ps1 dev up be                    # chat-api
.\tools\geostat.ps1 dev up fe                    # frontend
.\tools\geostat.ps1 dev up ret                   # retrieval-service
.\tools\geostat.ps1 dev up ing                   # ingestion-service
.\tools\geostat.ps1 dev up all                   # all modules, each in new window
.\tools\geostat.ps1 dev up be --no-infra         # skip infra start
.\tools\geostat.ps1 dev up be --no-tunnel        # skip SSH tunnel

# --- Remote watch (Mode ③) ---
.\tools\geostat.ps1 dev up be --mode remote      # rsync + bootRun on server
.\tools\geostat.ps1 dev up all --mode remote     # all modules remote

# --- Docker (Mode ②) ---
.\tools\geostat.ps1 stack up -d --build
.\tools\geostat.ps1 stack down
```

## VS Code — Run & Debug (launch.json)

| Config | Mode |
|--------|------|
| **Full stack (local)** | ① chat-api + frontend compound |
| **Hybrid: infra tunnel + API + UI** | ④ tunnel preLaunch + compound |
| chat-api: Spring Boot | ① single service |
| retrieval: Spring Boot | ① single service |
| ingestion: Spring Boot | ① single service |
| frontend: npm run dev | ① single service |

## VS Code — Tasks (Terminal → Run Task)

| Task | What |
|------|------|
| `geostat: dev up all` | all modules hybrid |
| `geostat: dev up all (no-infra)` | all modules, infra already running |
| `geostat: infra tunnel` | SSH tunnel (background, waits for ready) |
| `geostat: infra remote up` | start infra containers on server |
| `geostat: be dev watch (remote)` | rsync + Gradle bootRun on server |
| `geostat: fe dev watch (remote)` | rsync + Vite dev container |
| `geostat: ret dev watch (remote)` | rsync + retrieval bootRun |
| `geostat: ing dev watch (remote)` | rsync + ingestion bootRun |
| `geostat: be deploy watch (remote)` | JAR build → runtime/ loop |
| `geostat: fe deploy watch (remote)` | Vite build → static/ + nginx reload |

## Env files (gitignored)

| Path | Purpose |
|------|---------|
| `ops/config/backend/.env.dev` | chat-api: DB, Gemini keys, RETRIEVAL_BASE_URL |
| `ops/config/retrieval/.env.dev` | INFRA_HOST, Qdrant, embedding provider |
| `ops/config/ingestion/.env.dev` | INFRA_HOST, Postgres, Qdrant, RabbitMQ |
| `ops/config/frontend/.env.dev` | VITE_API_URL |
| `ops/config/infra/.env.dev` | INFRA_HOST=127.0.0.1, all infra ports |
| `ops/config/deploy.env` | DEPLOY_SERVER, DEPLOY_LAYOUT=structured |