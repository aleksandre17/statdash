# statdash-platform — Operations Runbook

Two flows: **(A) Validate locally** (prove the data layer against a live
Postgres) and **(B) Deploy to the SSH server**. Both assume Docker + Compose v2.

> The data layer (Flyway migrations V1→V34 + the SDMX cube + the canonical demo
> data) is validated by flow A. Run it on any Docker-capable machine before
> trusting a deploy.
>
> **Demo-data SSOT (ADR-0032):** the canonical workbooks `DATA/canonical/*.xlsx`,
> ingested through `POST /api/ingest/canonical` + the publish FSM
> (`ops/scripts/ingest-canonical.sh`). The legacy bundle seed
> (`ops/seed-data/*.bundle.json` + `pnpm --filter @statdash/api seed`) is a
> **retired** 3-dim-GDP lane that no longer matches V34's canonical 4-dim
> `[measure, approach, time, geo]` DSD; it is no longer on any provisioning path.

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
| 2 | Flyway `migrate` — **V1→V34** from `ops/postgres/migrations` (structure only; `R__seed_geostat_gold` is **unmounted**, ADR-0032) | **all migrations apply clean from scratch** (the #1 standing risk), incl. V34's canonical 4-dim GDP DSD |
| 3 | `pnpm install --frozen-lockfile` + `pnpm build:engine` | the engine dist exists before any api command |
| 4 | `pnpm test` with `DATABASE_URL` exported | the DB-gated proofs **UN-SKIP and pass** on a fresh-migrated DB: bootstrap-parity, scd2, content-constraint, concept/category/lifecycle/vintage, observations-multivalue, canonical e2e. (They self-provision their own fixtures — no prior seed needed, so this runs before the demo-data load.) |
| 5 | start API one-shot (`tsx src/index.ts`), wait `/health` | the API boots against the live DB (env + provisioning) |
| 6 | **canonical ingest** — `ops/scripts/ingest-canonical.sh` POSTs `DATA/canonical/*.xlsx` → publish FSM → gold, then serve-asserts counts (GDP=288, ACCOUNTS=415, REGIONAL=1554) + the 3 anchors | the **real demo data** lands through the **same pipeline prod uses**; the GDP anchor (geo=GE, approach=`_Z`, 2010 ≈ 22148.65) is the live proof that V34 + the canonical workbook agree (4-dim GDP) |
| 7 | _(folded into stage 6 — its serve+anchor checks ARE the row-level parity gate, now against the canonical SSOT instead of the retired bundles)_ | row-level parity vs the canonical SSOT |
| 8 | stop API; `docker compose down -v` (unless `--keep`) | clean teardown |

Any stage failure → non-zero exit, stack torn down, no false green.

> **Prereq for stage 6:** the ingest driver needs `bash`, `curl`, and `jq` on the
> host (the prod path runs them inside an alpine container; locally they must be on
> PATH — on Windows, Git-for-Windows bash + a `jq` binary).

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

### B.2 — Infra up → migrate (structure) → canonical ingest (demo data)

```bash
# infra (postgres + pgBouncer)
docker compose \
  -f ops/compose/infra/docker-compose.base.yml \
  -f ops/compose/infra/services/postgres.yml \
  -f ops/compose/infra/docker-compose.prod.yml \
  up -d --wait

# migrate V1→V34 — STRUCTURE ONLY (the flyway service mounts only
# ops/postgres/migrations; R__seed_geostat_gold is unmounted, ADR-0032)
docker compose \
  -f ops/compose/infra/docker-compose.base.yml \
  -f ops/compose/infra/services/postgres.yml \
  -f ops/compose/infra/services/flyway.yml \
  up --abort-on-container-exit --exit-code-from flyway flyway
```

Demo data is NOT loaded by SQL/`pnpm seed` — the prod app stack (B.3) runs a
one-shot `ingest` service that POSTs `DATA/canonical/*.xlsx` through the real
pipeline (the demo-data SSOT, ADR-0032). To load it manually against a running
api instead, run the same driver:

```bash
API_BASE_URL="http://localhost:3001" CANONICAL_DIR="$PWD/DATA/canonical" \
  ADMIN_USERNAME="<curator>" ADMIN_PASSWORD="<pw>" \
  bash ops/scripts/ingest-canonical.sh   # idempotent: 409 on re-run, converges
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
→ infra up → migrate (V1→V34, structure) → app stack up (whose `ingest` one-shot
loads `DATA/canonical/*.xlsx` through the pipeline), all on `statdash-net`.

### Reset (destroys data)

```bash
docker compose -f ops/compose/infra/docker-compose.base.yml \
  -f ops/compose/infra/services/postgres.yml down -v
```
