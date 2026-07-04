---
title: Postgres data persistence (Spilo PGDATA volume mount)
status: Accepted
date: 2026-07-04
authors: database-architect (Opus)
---

# ADR-019 — Postgres Persistent Volume (Spilo PGDATA mount)

**Status:** Accepted. Closes the #1 prod data-loss landmine.

## Context

Prod runs `timescale/timescaledb-ha:pg16` (Spilo). Spilo's data directory is
`PGDATA=/home/postgres/pgdata/data` (PGROOT `/home/postgres/pgdata`) — NOT the
vanilla Postgres `/var/lib/postgresql/data`.

`ops/compose/docker-compose.prod.yml` mounted the named volume
`statdash-prod-pgdata` at `/var/lib/postgresql/data`. Spilo never writes there, so:

- The named volume held **nothing** (a root-owned empty skeleton; verified on host).
- The live DB (2479 obs, flyway v38) lived in the **container writable layer** at
  `/home/postgres/pgdata/data` (83 MB, `postgres:postgres`, verified via `docker exec`).

Consequence: the data survived `restart`/`stop`/`up --build` (same container) but was
**destroyed by any `docker rm` / `--force-recreate` of postgres** → fresh initdb → flyway
re-runs V1→V38 and fails at data-dependent V33. This actually caused a data-loss incident
on 2026-07-03; recovery was only possible because a `pg_dump` backup existed. Data survived
day-to-day purely because deploys happened never to recreate postgres.

Secondary: no scheduled Docker prune; `/dev/sda2` (147 G) drifts toward 100% on
`--no-cache` builds (hit 100% on 2026-07-03).

## Decision

1. **Mount the named volume at the Spilo PGROOT**, not the vanilla path:
   `postgres_data:/home/postgres/pgdata`. Data now lives on a persistent named volume
   (backed by `/var/lib/docker/volumes` on the persistent `/dev/sda2`), surviving any
   container recreate.
2. **Rename the volume `statdash-prod-pgdata` → `statdash-prod-pgdata-v2`.** The old
   volume is non-empty (stale root-owned `/var/lib/postgresql/data` skeleton); reusing it
   at the new path would shadow the image dir with wrong ownership and no image-seeding.
   A fresh name forces Docker to create an **empty, image-seeded volume** → clean initdb
   with correct `postgres:postgres` ownership. The old volume is **left untouched**
   (never pruned).
3. **Migration procedure = safeguarded recreate:** verified `pg_dump` → restore-verify into
   a throwaway DB → recreate postgres onto the new volume (fresh initdb) → restore the dump
   (timescaledb `pre_restore`/`post_restore` dance) → verify anchors → prove persistence by
   recreating postgres once more and confirming data survives. The ephemeral writable-layer
   data is expendable ONLY because the restore-verified dump exists.
4. **Same fix applied to `docker-compose.staging.yml`** (identical Spilo mis-mount).
5. **Disk hygiene:** a scheduled (systemd-timer / cron) safe prune —
   `docker builder prune -f` + `docker image prune -f` (dangling only). **Never** `-a`
   (would drop `:rollback` tags), **never** `--volumes` (would touch the DB volume).

## Rejected Alternatives

1. **Host bind-mount** (`/opt/statdash/pgdata:/home/postgres/pgdata`) — REJECTED: requires
   pre-creating the dir with Spilo's exact uid/gid and manual `chown`; permission-fragile.
   A named volume lets Docker seed ownership from the image. (Kept as a valid option if an
   operator ever wants the data at a known host path.)
2. **Reuse the existing `statdash-prod-pgdata` volume at the new path** — REJECTED: it is
   non-empty, so Docker would not image-seed it; the stale root-owned content would shadow
   the Spilo dir and break initdb/ownership.
3. **Leave the mount, just "never recreate postgres"** — REJECTED: a landmine defended only
   by operator discipline is not a fix (Fail-fast / make-illegal-states-unrepresentable). A
   single stray `--force-recreate` wipes prod.
4. **`down -v` + fresh `up`** — REJECTED outright: destroys volumes; forbidden.

## Consequences

- Positive: prod DB survives container recreate; the data-loss landmine is structurally
  closed, not procedurally avoided. Disk no longer drifts to 100%.
- Negative / cost: a one-time safeguarded postgres recreate + dump/restore (brief API blip
  while postgres is empty, before restore). One orphaned empty volume left behind (harmless).
- Data outlives code: the schema is forward-only/additive (expand-contract), so a code
  rollback over v38 stays safe; the volume now guarantees the data itself outlives the
  container.
- Fitness function (owed): `FF-PG-VOLUME-AT-PGDATA` — assert the postgres service volume
  destination equals the image's `PGDATA` parent (guards against re-introducing the vanilla
  path for a Spilo image).
