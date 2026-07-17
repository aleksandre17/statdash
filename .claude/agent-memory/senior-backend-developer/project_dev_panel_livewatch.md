---
name: dev-panel-livewatch
description: WORKING server-side live-watch for the dev-line panel — source-mounted vite dev container on statdash-dev :3013 + rsync sync. Robust replacement for the kit `dev watch` driver (which short-circuits in the MSYS2/Git-Bash shell). Supersedes the "image-based only / kit live-watch unproven" notes.
metadata:
  type: project
---

Server-side LIVE-WATCH for the panel on the isolated dev line (`statdash-dev`, 192.168.1.199) — a local `platform/apps/panel/src` edit reflects LIVE on `http://192.168.1.199:3013` via vite HMR with NO rebuild. Built + PROVEN 2026-07-11 (commit `7693460`). Robust equivalent of the kit `dev watch` driver, which short-circuits in this MSYS2/Git-Bash shell (its compose-up never fires). SUPERSEDES the [[full-dev-line]] "panel is image-based at :3013" note and the [[remote-dev-cli]] "kit live-watch couldn't be made to work" wall — we own a working path now.

**Why:** owner develops against the dev line ON THE SERVER with live-watch (edit → instant reflect), not local vite.

**How to apply — the mechanism (3 committed files):**
- `ops/compose/docker-compose.dev.yml` panel svc: `target: development` (Dockerfile stage 3 = `vite dev`), `image: statdash-panel:dev-watch`, publish **3013:3013** (page port == container vite port so the HMR websocket, default clientPort = page port, connects straight through — mapping 3013:5171 BREAKS HMR), env `APP_DEV_PORT=3013 / VITE_API_URL="" / CHOKIDAR_USEPOLLING=true`, bind-mount ONLY `${DEV_PANEL_SRC:-../../platform/apps/panel/src}:/app/apps/panel/src`.
- `platform/apps/panel/vite.config.ts` dev-only `server` block (ignored by `vite build`, so the nginx prod image is unaffected): `host:true`, `port: Number(process.env.APP_DEV_PORT)||5173`, `proxy: { '/api': process.env.VITE_DEV_API_PROXY ?? 'http://statdash-api:3001' }`.
- `ops/scripts/dev-watch-panel.sh` — rsync-on-change watch loop (`--once` for one-shot) using the [[remote-dev-cli]] MSYS2 rsync+ssh recipe with `--exclude node_modules --exclude dist --exclude .git`. Server rsync target: `/home/administrator/statdash-dev-src/platform/apps/panel/src` (a DEDICATED dir, not the git worktree). Owner workflow: `bash ops/scripts/dev-watch-panel.sh` (continuous) on save.

**Load-bearing design decisions (don't undo):**
- **Bind-mount ONLY `apps/panel/src`, never whole `/app`.** `.npmrc shamefully-hoist=false` (strict pnpm isolation) → node_modules live per-package (root + `apps/panel` + every `packages/*`). A whole-`/app` mount + only `- /app/node_modules` (the brief's shape, and the geostat override's shape) would SHADOW the nested node_modules and break resolution. `src/` holds no node_modules → overlaying it is safe, no anonymous-volume preservation needed. The image's `development` stage `COPY . .` bakes full source + all node_modules; the mount just overlays the changing src. packages/* stay baked (to live-edit a package, add a `packages/<x>/src` mount).
- **vite.config is the port SSOT, NOT the CLI.** The Dockerfile dev CMD `pnpm --filter ./apps/panel dev -- --host 0.0.0.0 --port ${APP_DEV_PORT}` forwards a stray `--` → vite's cac parser drops `--port` and binds its DEFAULT 5173 (silent; the published 3013 then maps to nothing). `server.port` from `APP_DEV_PORT` makes it deterministic. (Latent Dockerfile-CMD double-dash bug affects geostat's dev target too — not fixed here, scope.)
- **vite dev proxies /api itself** (no nginx in dev). Panel shares `statdash-dev-net`; api is aliased `statdash-api` there → proxy target `http://statdash-api:3001` is same-origin from the browser (all via :3013), so the dev api needs NO CORS change (`CORS_ORIGIN:false` stays).
- **CHOKIDAR_USEPOLLING=true** — reliable change detection for rsync writes over the bind mount (inotify propagation can be flaky).

**Deploy/rebuild recipe (server-native):** rsync src → the target dir; scp/rsync the changed build-context files (`vite.config.ts`, `docker-compose.dev.yml`) to the worktree `/tmp/statdash-dev-line`; `cd .../ops/compose && DEV_PANEL_SRC=<target> DOCKER_BUILDKIT=0 docker-compose -f docker-compose.dev.yml -p statdash-dev build panel` then `up -d --no-deps --force-recreate panel` (`--no-deps` protects pg/api/geostat — data intact, `observations=2479`). vite.config lives OUTSIDE src/ → it is BAKED, so a vite.config change needs a rebuild (not just an rsync).

**Proof (2026-07-11):** served module `GET :3013/src/studio/StudioTopBar.tsx` `Strata` → local edit `Strata LIVEWATCH` → `dev-watch-panel.sh --once` (rsync exit 0) → module served `Strata LIVEWATCH` + vite log `[vite] (client) hmr update /src/studio/StudioTopBar.tsx`, no rebuild; reverted. Isolation held: prod/staging uptimes only grew.

**⚠ Working-tree volatility observed:** this repo dir had heavy PARALLEL agent activity — HEAD was reset mid-session (0969c7d→4699e52) which silently discarded uncommitted edits to `docker-compose.dev.yml` + the untracked script. Lesson: on this dir, commit deliverable files promptly and re-verify on-disk state before relying on earlier edits; the server worktree (`/tmp/statdash-dev-line`) held the correct rsynced copies throughout.
