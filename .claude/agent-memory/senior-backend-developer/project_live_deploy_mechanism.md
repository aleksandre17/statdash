---
name: live-deploy-mechanism
description: Runbook for the LIVE 192.168.1.199 demo (geostat :3002 / panel :3003 / internal api) — server-side git clone + prod-only compose, per-service recreate, rollback + backup discipline
metadata:
  type: project
---

Runbook for the ACTUAL live-demo deploy. It DIVERGES from `ops/RUNBOOK.md` §B (stale: the `-f docker-compose.yml -f docker-compose.prod.yml` + `geostat api deploy --prod` docs are drift) and does NOT use the geostat-kit node-api/node-vite drivers (those ship the LOCAL tree; the live stack builds from a server-side clone).

## Access + topology
- **SSH:** `geostat-deploy` = `administrator@192.168.1.199:22`, key `ops/config/ssh/id_rsa`, via `-F ops/config/ssh/config`. `ops/` is at REPO ROOT (not under `platform/`); agent threads reset cwd → use the ABSOLUTE ssh-config path.
- **Build source:** server-side git clone at `/tmp/statdash-build`, tracks `main` (remote `https://github.com/aleksandre17/statdash.git`). Deploy a ref: `git fetch origin main && git reset --hard FETCH_HEAD` (a bare-sha `reset --hard <sha>` fails; for a branch `git checkout -B <branch> FETCH_HEAD` — the clone has no `origin/<branch>` tracking refs). The clone has **NO github push creds** → push git tags from your LOCAL repo. gitignored secrets (`ops/config/*/.env*`, `ops/compose/.env`) are untracked → survive checkout.
- **Compose:** `cd /tmp/statdash-build/ops/compose`, use `docker-compose -f docker-compose.prod.yml` **ALONE** (project `statdash-prod`). Do NOT add `-f docker-compose.yml` (dev base re-introduces an absent `../config/api/.env` → config error). Server `docker-compose` is now v5.x (was v1) but responds to the same invocation. Ports from `ops/compose/.env` → geostat **:3002**, panel **:3003** (compose default 8080/8081). Stack: postgres, flyway, `statdash-api` (internal only, `statdash-api:3001`, NO host port), ingest (one-shot), geostat, panel.

## Deploy procedure
1. **Backup first** (mandatory, the ONLY recovery): `pg_dump -Fc` to `/tmp/statdash-prod-backup-<ts>.dump`. DB user is **`statdash`** NOT `postgres` (role `postgres` doesn't exist); creds in `ops/config/api/.env.prod` `DATABASE_URL`. Verify a backup by RESTORING into a throwaway db + `SELECT count(*)`, never by streaming — `pg_restore --data-only | grep '\t'` shows 0 rows for timescaledb hypertables (data is in compressed chunks). Expected obs anchor below.
2. **Arm rollback:** re-tag current-live `:latest`→`:rollback` for each image ABOUT to be rebuilt (`docker tag statdash-{api,geostat,panel}:latest …:rollback`) — do this BEFORE building (the build overwrites `:latest`). `:rollback` tags go STALE if a prior deploy skipped an image → always re-tag from the CURRENT-live `:latest`, not blindly. Push git tag `pre-<x>-deploy=<prior-live-sha>` from LOCAL. Confirm prior-live is a linear ancestor: `git merge-base --is-ancestor <prior> <new>`.
3. **Check disk** (`df -h /`) — see disk landmine.
4. **Build** only the affected images, genuine no-cache, classic builder: `DOCKER_BUILDKIT=0 docker-compose -f docker-compose.prod.yml build --no-cache <svcs>`. Confirm real build (0 `Using cache`, `Successfully built`, new bundle hash).
5. **Recreate** ONLY the app services: `up -d --no-deps --no-build --force-recreate <geostat|panel|statdash-api>`. **NEVER `up -d --force-recreate` the whole stack** (would recreate postgres). `--no-deps` also keeps flyway/ingest from firing.

## What to rebuild (minimal set)
- **Frontend-only** (`packages/plugins`, `packages/charts`, `packages/core`, geostat app) → geostat rebuild (+panel if the change is in a shared `packages/react`/`packages/core` bundle both SPAs consume).
- **Provisioning-only** (`apps/api/provisioning/geostat.provisioning.json`) → **api rebuild ONLY** + re-provision. The JSON is baked into the api image (`COPY apps/api`) and re-applied every boot by `runProvisioning`, which appends+publishes new `config.page_version` rows. Panel/geostat NOT rebuilt.
- Verify re-provision via the `config.page_version` table (bumps on exactly the affected pages), NOT logs — provisioning logs at info/debug, only warns ≥40 surface.
- **Page attribution gotcha:** in the provisioning JSON the `"slug"` key sits at the END of each page object → a section's owning page = the NEXT `"slug":` AFTER it, not the previous. Confirm attribution by which page_version bumped, never by slug-line proximity.

## Migrations
`flyway` service in the same compose. Run explicitly first if needed: `docker-compose -f docker-compose.prod.yml run --rm flyway`. Forward-only but all additive/backward-compatible (expand-contract) → a code rollback over an advanced schema is SAFE. `geostat`/`panel`/`api`/`ingest` gate on flyway `service_completed_successfully`.

## Rollback
Retag `:rollback`→`:latest` + `git reset --hard <ref>` + `up -d --no-build`. **NEVER `down -v`** (destroys the DB volume). Data anchors + smoke to confirm.

## Smoke
`curl :3002 :3003` → 200; api health via `docker exec statdash-api wget -qO- 127.0.0.1:3001/health` → `{"status":"ok"}` (route is `/health` NOT `/api/health`; :3001 isn't host-reachable and the api container has no curl → use docker health + `:3002/api/bootstrap`=200 as the api-serving proof). Data anchors (as of `main`@7709059, 2026-07-07): GDP_ANNUAL=**399**, ACCOUNTS_SEQUENCE=**415**, REGIONAL_GVA=**1665**, total obs **2479**, flyway **V38** via `ORDER BY installed_rank DESC LIMIT 1` (NOT `max(version)` — it string-sorts and returns "9").

## Fast-iterate hot-swap (frontend-only geostat, skips the ~15min 3-image cycle)
Build dist LOCALLY vite-only (never `tsc -b` — matches the Dockerfile builder) with prod args: `cd platform && VITE_API_URL="" VITE_API_STATS_URL="" pnpm --filter ./apps/geostat exec vite build` (empty URLs = relative `/api` single-origin; nginx proxies `/api/`→`statdash-api:3001`). Backup web root (`docker cp statdash-geostat:/usr/share/nginx/html /tmp/…`), tar dist CONTENTS → scp → `docker cp /tmp/geostat-dist/. statdash-geostat:/usr/share/nginx/html` (web root `/usr/share/nginx/html`). No restart (nginx serves new hashed assets immediately; index.html not cached). `:latest` is UNTOUCHED → a restart/recreate REVERTS the hot-swap (low-risk, ephemeral). Verify the browser fetched the new `index-<hash>.js` 200 (a Playwright `response` listener, not just `curl`).

## Ingest driver (`ops/scripts/ingest-canonical.sh`)
Script + `DATA/canonical/` are BIND-MOUNTED into the one-shot (not baked) → a git checkout on the clone makes new canonical+script live with NO rebuild; re-run the gate with `up -d`. Gotchas: (1) its `EXPECTED_OBS` self-check must be bumped in the SAME PR as any additive re-ingest or the next deploy's ingest gate false-fails (blocking geostat/panel start). (2) **Converged-409:** on re-ingest the codelists job auto-converges to `published` (SCD-2 upsert during staging → explicit publish POST = 409) and `set -e` aborts, leaving `facts` STAGED-unpublished. Fix: publish the staged facts job directly — `POST /api/ingest/jobs/:id/publish` (empty body, `curl -X POST`, Bearer; NOT busybox `wget --post-data`, returns 400). Additive new-member ingest is routine (no `?datasetVersion=`). (3) serve queries cap `limit`≤10000 (20000 → HTTP 400). See [[project_canonical_partial_failure_retry]].

## Standing landmines / lessons
- **Postgres persistence — RESOLVED (ADR-019).** Postgres is `timescale/timescaledb-ha` (Spilo, real `PGDATA=/home/postgres/pgdata/data`). The old `statdash-prod-pgdata` volume was mis-mounted at `/var/lib/postgresql/data` → the live DB lived on the container's WRITABLE LAYER and a whole-stack `--force-recreate` once wiped it (data-loss incident, recovered from the pre-deploy `pg_dump`). FIXED in prod compose: volume `statdash-prod-pgdata-v2` mounted at `postgres_data:/home/postgres/pgdata`. The operational rules still hold regardless: per-service `--no-deps --force-recreate` only, and always back up before any postgres-touching op. Restore procedure: `psql -c "CREATE EXTENSION IF NOT EXISTS timescaledb; SELECT timescaledb_pre_restore();"` → `pg_restore --no-owner --no-acl -U statdash -d <db>` → `SELECT timescaledb_post_restore();`.
- **Disk fill.** `/dev/sda2` is 147G. A no-cache 3-image build can tip a near-full server to 100% (`pg_dump` fails, postgres WAL at risk). Check `df -h /` BEFORE building; if <15G free, prune first: `docker builder prune -f` (build cache, 0 active = always safe) + `docker image prune -f` (dangling/untagged ONLY — **NEVER `-a`** which drops `:rollback` tags; **NEVER `--volumes`** which touches the DB). Prune AFTER a verified deploy to keep just-built layers.
- **Headless screenshot caveat.** The `geostat-chat-ai-chromium` (zenika/alpine-chrome) container does NOT faithfully render this Vite SPA under `--virtual-time-budget` (blank PNG = static shell only) — NOT a render-failure signal. Verify via served-bundle 200 + `/api/bootstrap` 200, or local Playwright→:3002.

## Staging (non-disruptive branch probes)
`ops/compose/docker-compose.staging.yml` — project `statdash-stg`, ports 5457/3009/3008, volume `statdash-stg-pgdata`, fully isolated (shares nothing with prod). Committed but STALE (header says V1→V32, predates V33+). Never rebuild `:latest` for staging; use `:stg` images. Reach the staging DB over LAN at `192.168.1.199:5457` for `DATABASE_URL`-gated suites. See [[fresh-provision-canonical]] for the V33 fresh-DB block.
