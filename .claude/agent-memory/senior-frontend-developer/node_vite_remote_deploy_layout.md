---
name: node-vite-remote-deploy-layout
description: How node-vite `deploy.ps1 remote` ships pnpm-workspace SPAs to the server (context-dir layout, env_file path math)
metadata:
  type: project
---

node-vite `remote` mode (kits/geostat-kit/drivers/node-vite/ps1/deploy.ps1) ships the apps in `platform/apps/{geostat,panel}` to a server `docker compose ... up --build`.

**Why it must archive the workspace root, not the module dir:** these apps are pnpm-workspace SPAs. Their per-module compose (`platform/apps/<app>/docker-compose.yml`) declares `build: { context: ../../, dockerfile: apps/<app>/src/Dockerfile }`, and the 5-stage Dockerfile COPYs `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `engine/`, `apps/<app>/`. So the server build context must be the whole workspace (`platform/`), not just the module dir.

**The layout (mirrors node-api's `context-dir` from toolkit/deploy/node-upload.sh):**
- tar the workspace root (resolved by walking up to `pnpm-workspace.yaml` via `Get-NodeWorkspaceDir` in deploy.ps1) → extract to `$DEPLOY_PATH/context/`.
- run compose from `$DEPLOY_PATH/context/<relModule>` (e.g. `context/apps/geostat`) so the compose relative paths resolve:
  - `../../` → `$DEPLOY_PATH/context` (workspace root / build context)
  - `apps/<app>/src/Dockerfile` → the app Dockerfile
  - `env_file: ../../../ops/config/<app>/.env.<env>` → `$DEPLOY_PATH/ops/config/<app>/.env.<env>`

**env_file gotcha:** the prod/override overlays carry `env_file: ../../../ops/config/<app>/.env.<env>`, pointing at the repo-root `ops/config` tree which is OUTSIDE the workspace tar (it's secrets, intentionally separate). deploy.ps1 step 3 copies the combined env bundle to `$DEPLOY_PATH/ops/config/<app>/.env.<env>` on the server so that directive resolves. The `--env-file $DEPLOY_PATH/.env.<env>` (variable substitution) is a SEPARATE concern from the per-service `env_file:` directive.

**Not touched / why:** the per-module compose files under `platform/apps/**` are off-limits (platform/** is another agent's lane) and were designed to align with this layout. `gen_server_compose.py` (node-api's `--build-layout context-dir`) was NOT reused for node-vite because it strips `build.target`/args/ports/healthcheck that the vite multi-target overlays need — node-vite keeps its native compose-overlay flow, only the archive scope + server dir layout were aligned.

**Unaffected modes:** `local` (direct `docker build`), `dist`/`sync`/`watch` (local vite build → nginx static) don't use the per-module compose at all — they were untouched.

Related: [[config_api_contract]]
