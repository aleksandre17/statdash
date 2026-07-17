---
name: isolated-dev-panel
description: Server-native isolated dev-panel preview — docker-compose.dev-panel.yml (project statdash-dev-panel, port 3010, reuses staging api via external net) + the git-worktree build recipe that never disturbs the staging clone
metadata:
  type: project
---

**⚠ SUPERSEDED 2026-07-11: the standalone dev-panel (3010) was FOLDED IN and torn down** (`docker-compose -p statdash-dev-panel down` — container + its own net removed; stg-net untouched, external). It is replaced by the FULL dev line [[full-dev-line]] (`docker-compose.dev.yml`, project statdash-dev), whose panel (statdash-dev-panel-full, port 3013) is backed by its OWN dev api+db, not staging's. The compose file below remains committed on the branch but is no longer running. Recipe still valid if a panel-only staging-api-backed preview is ever wanted again.

The architecturally-right replacement for the brittle workstation `dev watch` (pwsh+rsync) panel preview. See [[live-deploy-mechanism]] for the prod/staging stacks it sits beside.

`ops/compose/docker-compose.dev-panel.yml` (COMMITTED on feature branches, NOT main): project `statdash-dev-panel`, own net `statdash-dev-panel-net`, image `statdash-panel:dev`, port **3010**. Port map on the host: 3002/3003 = prod geostat/panel, 3007/3009 = stg api/geostat, **3008 = HELD by the running `statdash-stg-panel`** (never disturb). Panel-ONLY service — reuses the STAGING api by ALSO attaching to external net `statdash-stg-net`, where alias `statdash-api`→statdash-stg-api resolves the baked nginx `proxy_pass http://statdash-api:3001` (VITE_API_URL empty = relative /api, single-origin, no CORS). NEVER joins prod `statdash-net`, so it cannot reach the prod `statdash-api`. Backend couples to the staging stack being up (restart after any staging bring-up).

**Why:** owner wants to SEE the current branch's panel on the DEV server via kit/ops Docker, server-native and reusable, with zero workstation coupling — and PROD is untouchable.

**How to apply — deploy recipe (prod-safe, no clone disturbance):**
- Push the FEATURE branch only (never main). On server: `cd /tmp/statdash-build && git fetch origin <branch>`; capture `git rev-parse FETCH_HEAD`.
- Build in an ISOLATED `git worktree` so the staging clone's 2 UNCOMMITTED tracked mods (`docker-compose.staging.yml` + `apps/panel/Dockerfile`) stay untouched: `git worktree add --detach /tmp/statdash-dev-panel <fetched-sha>` — MUST be `--detach` (the branch is already checked out in the main clone, so a plain worktree add fails). Verify after: `git -C /tmp/statdash-build status --short` still shows both M files.
- `cd /tmp/statdash-dev-panel/ops/compose && DOCKER_BUILDKIT=0 docker-compose -f docker-compose.dev-panel.yml -p statdash-dev-panel build panel` then `… up -d --no-build`. Host uses hyphenated `docker-compose` v5.x (NOT `docker compose`). `statdash-panel:dev` tag never collides with prod `:latest` / stg `:stg`.
- **Frozen-lockfile:** at branch HEAD (2026-07-11) `pnpm install --frozen-lockfile --filter ./apps/panel...` = exit 0, so the COMMITTED panel Dockerfile (`--frozen-lockfile`) builds clean — no need for the staging clone's `--no-frozen` mod. Re-verify per batch (panel batches sometimes bump the lock w/o a refresh).
- **Verify:** `curl :3010/`=200 + `curl :3010/api/bootstrap`=200 (proxy→stg api) + entry bundle `assets/index-<hash>.js` fresh from HEAD. LAN reach `192.168.1.199:3010`.
- **Prod-untouched proof:** `docker ps --filter network=statdash-net` before/after — same 4 containers (postgres/geostat/api/panel), same ports, uptimes only GROWN (never reset); dev-panel NOT in `statdash-net` membership.
