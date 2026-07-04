---
name: pg-persistent-volume-closed
description: Prod ephemeral-postgres data-loss landmine is CLOSED (2026-07-04) — DB now persists on statdash-prod-pgdata-v2 at the Spilo PGDATA path
metadata:
  type: project
---

The #1 prod data-loss landmine is **CLOSED** as of 2026-07-04 (ADR-019, branch
`fix/postgres-persistent-volume`).

**Fact:** prod postgres (`timescale/timescaledb-ha:pg16`, Spilo, PGDATA=/home/postgres/pgdata/data)
now mounts named volume **`statdash-prod-pgdata-v2` at `/home/postgres/pgdata`** (on
persistent `/dev/sda2`). Previously the volume `statdash-prod-pgdata` was mis-mounted at the
vanilla `/var/lib/postgresql/data` (never used by Spilo) → DB lived in the container writable
layer → wiped by any recreate. The OLD `statdash-prod-pgdata` volume is now **orphaned/empty,
left untouched** (never pruned).

**Why:** Spilo's real data dir is `/home/postgres/pgdata`, not the vanilla path. A fresh volume
name (`-v2`) was required so Docker seeds an empty, image-owned (`postgres:postgres`) volume —
reusing the non-empty old volume would shadow the dir with wrong ownership.

**Proven:** migrated via restore-verified `pg_dump` → recreate onto v2 (fresh initdb) → restore →
anchors matched (2479 obs = GDP_ANNUAL 399 / ACCOUNTS_SEQUENCE 415 / REGIONAL_GVA 1665, flyway
v38, GDP-2025 P=25) → **persistence proof: a second `--force-recreate postgres` (id changed) and
data SURVIVED**. Disk-hygiene cron installed: `17 4 * * *` runs
`/home/administrator/statdash-ops/docker-prune-safe.sh` (builder + dangling image prune only;
never `-a`, never `--volumes`).

**How to apply:** the senior-backend-developer memory `[[live-deploy-mechanism]]` still describes
this landmine as OPEN with the rule "NEVER --force-recreate the whole stack" — that rule is now
obsolete for the DATA-LOSS reason (postgres recreate is safe once the branch is merged/live).
Staging compose got the identical fix (`statdash-stg-pgdata-v2` at `/home/postgres/pgdata`).
Fitness function still owed: `FF-PG-VOLUME-AT-PGDATA`.
