# statdash-platform — Operations Runbook

Two flows: **(A) Validate locally** (prove the data layer against a live
Postgres) and **(B) Deploy to the SSH server**. Both assume Docker + Compose v2.

> The data layer (29 Flyway migrations + seed + the SDMX cube) is validated by
> flow A. Run it on any Docker-capable machine before trusting a deploy.

---

## A. Validate locally — `pnpm validate:local`

**Prereq:** Docker (+ compose v2), pnpm, node, curl. One command, run from
`platform/`:

```bash
cd platform
pnpm validate:local            # full run, tears the stack down at the end
pnpm validate:local -- --keep  # leave Postgres up for inspection
# Windows:  pwsh ops/scripts/validate-local.ps1 [-Keep]
```

### What the one command does (8 fail-fast stages)

| # | Stage | Proves |
|---|-------|--------|
| 1 | `docker network create statdash-net` (idempotent) + Postgres `timescaledb-ha:pg16` up, wait `pg_isready` | the engine the migrations require (TimescaleDB + ICU) starts |
| 2 | Flyway `migrate` — V1→V29 from `ops/postgres/migrations` + `R__seed_geostat_gold` from `ops/postgres/seed` | **all 29 migrations apply clean from scratch** (the #1 standing risk) |
| 3 | `pnpm install --frozen-lockfile` + `pnpm build:engine` | the engine dist exists before any api command |
| 4 | `pnpm --filter @statdash/api seed` (reads `ops/seed-data/`) | the cube ETL loads gold idempotently |
| 5 | `pnpm test` with `DATABASE_URL` exported | the **33 DB-gated proofs UN-SKIP and pass**: bootstrap-parity, scd2, content-constraint, seed-data parity, concept/category/lifecycle/vintage |
| 6 | start API one-shot (`tsx src/index.ts`), wait `/health` | the API boots against the live DB (env + provisioning) |
| 7 | `pnpm --filter @statdash/api verify-parity` | bundle reference == live `/observations`, row-for-row |
| 8 | stop API; `docker compose down -v` (unless `--keep`) | clean teardown |

Any stage failure → non-zero exit, stack torn down, no false green.

### DATABASE_URL & credentials

The script reads `ops/config/db/.env` (auto-created from `.env.example` on first
run) and builds `DATABASE_URL=postgres://<user>:<pass>@localhost:<port>/<db>`
from it — Postgres publishes its port to `127.0.0.1`, so host-side Node steps
reach it at `localhost`. `JWT_SECRET` / `ADMIN_*` default to local-only values;
override by exporting them before the run.

---

## B. Deploy to the SSH server

Two independent Compose stacks on the shared external `statdash-net` network:
**infra** (Postgres, pgBouncer, pgAdmin) and **app** (statdash-api, geostat-app).
Infra comes up first; the app stack reaches it by container DNS.

### B.0 — Secrets the human supplies (never committed)

| File | From example | Holds |
|------|--------------|-------|
| `ops/config/db/.env` | `.env.example` | `POSTGRES_USER/PASSWORD/DB`, port |
| `ops/config/api/.env.prod` | `api/.env.example` | `DATABASE_URL` (→ `statdash-pgbouncer:5432`), `JWT_SECRET` (≥32), `ADMIN_*`, `EMBED_SECRET` |
| `ops/config/deploy.env` | `deploy.env.example` | `DEPLOY_SERVER`, `DEPLOY_SERVER_BASE`, `DEPLOY_PROJECT` |
| `ops/config/ssh/config` + key | `ssh/config.example` | SSH identity for the deploy target |

`DATABASE_URL` in `api/.env.prod` MUST match `db/.env` (user/pass/db) and point
at `statdash-pgbouncer:5432` (container DNS on `statdash-net`), not localhost.

### B.1 — One-time: network

```bash
docker network create statdash-net    # idempotent; shared by both stacks
```

### B.2 — Infra up → migrate → seed

```bash
# infra (postgres + pgBouncer)
docker compose \
  -f ops/compose/infra/docker-compose.base.yml \
  -f ops/compose/infra/services/postgres.yml \
  -f ops/compose/infra/docker-compose.prod.yml \
  up -d --wait

# migrate V1→V29 + R__ gold seed (the flyway service mounts both locations)
docker compose \
  -f ops/compose/infra/docker-compose.base.yml \
  -f ops/compose/infra/services/postgres.yml \
  -f ops/compose/infra/services/flyway.yml \
  up --abort-on-container-exit --exit-code-from flyway flyway

# seed the cube (DATABASE_URL → the prod DB; run from platform/)
cd platform && pnpm build:engine && \
  DATABASE_URL="<prod url>" pnpm --filter @statdash/api seed && cd ..
```

### B.3 — App stack up (api image built via `pnpm deploy`)

```bash
docker compose \
  -f ops/compose/docker-compose.yml \
  -f ops/compose/docker-compose.prod.yml \
  up -d --build
```

The api image (`platform/apps/api/Dockerfile`) builds the engine closure, then
`pnpm deploy --prod` flattens the api + its deps into a self-contained runtime
dir (no pnpm `.pnpm` symlinks — see Dockerfile comments). Healthcheck:
`/health` returns `ok`.

### B.4 — Remote deploy via the geostat-kit driver

The node-api driver scp's `platform/apps/api/docker-compose.prod.yml` to
`$DEPLOY_SERVER_BASE/$DEPLOY_PROJECT/api/`, strips build/ports, and runs the
service on `statdash-net`. With `ops/config/deploy.env` + ssh config filled:

```bash
geostat api deploy --prod      # remote build + up on the SSH server
```

Order on the server is the same as local: `docker network create statdash-net`
→ infra up → migrate → seed → app stack up, all on `statdash-net`.

### Reset (destroys data)

```bash
docker compose -f ops/compose/infra/docker-compose.base.yml \
  -f ops/compose/infra/services/postgres.yml down -v
```
