---
name: project-db-infra
description: statdash DB infra in ops/ — now TimescaleDB + Flyway migrations + pgBouncer; psql/docker absent locally so only structural validation is possible here
metadata:
  type: project
---

The statdash database infrastructure stack (PostgreSQL 16-alpine + pgAdmin) lives at `ops/docker-compose.yml` with init SQL in `ops/postgres/init/` (00-extensions → 04-seed). It is a standalone stack, separate from the app compose stack in `ops/compose/`. DB name `statdash`, two schemas: `config` (Constructor output) and `stats` (SDMX data cube).

**Why:** Built per the project_vision foundation principle — the DB underpins everything Constructor/Engine produce.

**How to apply:**
- Docker / `docker compose` is NOT on PATH in this environment (Docker Desktop not installed). `docker compose config` cannot run here — validate compose files via YAML structural parse (`python -c "import yaml; yaml.safe_load(open(f,encoding='utf-8'))"`) instead, and note to the user that runtime validation must happen on a Docker host.
- Python on this machine defaults to cp1252 — always pass `encoding='utf-8'` when reading files that contain Georgian / box-drawing characters, or it raises UnicodeDecodeError.
- Observation uniqueness uses a generated `dim_key_hash = md5(dim_key::text)` column (deterministic because `jsonb` sorts keys), plus a `gin (dim_key jsonb_path_ops)` index for `@>` containment. This is the ON CONFLICT upsert target — see [[feedback-upsert-not-check-delete-insert]].
- **Migration tool (2026-06-14 redesign): Flyway is now canonical.** Versioned migrations live in `ops/postgres/migrations/` (`V1__extensions` … `V5__seed`), run by `ops/compose/infra/services/flyway.yml` (flyway/flyway:10-alpine, `migrate`, depends_on postgres healthy). The old `init/` scripts (00→04) are retained as reference only and now carry a DEPRECATED banner; the init mount was REMOVED from postgres.yml so init and Flyway can't both run. Still NO Qdrant/Redis/RabbitMQ in statdash (those are geostat-chat-ai's stack).
- **Image: now `timescale/timescaledb-ha:pg16`** (was postgres:16-alpine). mem_limit/cpus removed. `observation` is a TimescaleDB hypertable partitioned on `time_period_date` (3-month chunks, compress policy >6mo, segmentby dataset_code+dim_key_hash). A UNIQUE index on a hypertable MUST include the partition col — so `uq_observation_series` is `(dataset_code, time_period, dim_key_hash, time_period_date)`; time_period_date is GENERATED from time_period so the logical key is unchanged.
- **Both integrity gaps from the audit are now FIXED:** (C2) `stats.validate_observation_dim_key()` BEFORE-trigger validates dim_key keys against the DSD and each value against `stats.classifier`. (C3) `obs_time_period_fmt_chk` CHECK + `stats.parse_time_period()` enforce/normalize SDMX TIME_PERIOD format. `dimension_value` was RENAMED to `stats.classifier` with a surrogate BIGINT id + `parent_id` + LTREE `path` (trigger-materialized via `stats.refresh_classifier_path()`, GIST-indexed). Engine's `$cl` ref maps to this table.
- **pgBouncer added** (`services/pgbouncer.yml`, edoburu 1.22, transaction pool, 100 client / 20 pool) plus `ops/config/db/pgbouncer.ini.example` + `userlist.txt.example` references. App services still hit Postgres 5432 directly until a later rewire.
- Validation limits without a live DB here: psql AND docker are both absent on PATH — could only structurally lint SQL (dollar-quote/paren balance) and YAML (Python yaml.safe_load). Runtime `flyway migrate` + hypertable creation must be verified on a Docker host.
