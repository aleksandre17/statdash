---
name: project-obs-vs-stats
description: Two competing cube schemas exist — applied stats.* (canonical) vs paper obs.* design doc (never built). Always build on stats.*.
metadata:
  type: project
---

There are TWO statistical-cube schema designs in this repo and they conflict. Know which is real.

- **stats.\*** — the APPLIED, canonical schema. Flyway V1–V5 in `ops/postgres/migrations`, served live by `apps/api/src/routes/stats/*`. Generic JSONB `dim_key` series key + `dim_key_hash` + TimescaleDB hypertable on `observation`; `classifier` (LTREE) keyed by surrogate `id` with UNIQUE(dim_code, code); DSD in `dataset_dimension`; a BEFORE-INSERT trigger validates dim_key against the DSD + classifiers. This is SSOT — see [[project-schema-ssot]].
- **obs.\*** — a PAPER design only, in `docs/architecture/future/01-database/{obs-schema,overview,cms-schema,iam-audit}.md`. Four schemas (obs/cms/meta/iam), LIST-partitioned fact table with physical `geo_id`/`indicator_id` cols + `extra_dims` JSONB, SCD-2 dim_member, vintage FSM. The doc itself says "No Flyway migration files yet". It was never built.

**Why:** the obs.* doc predates the stats.* implementation; the team implemented a simpler generic-dim_key design instead. The doc has good ideas (per-locale display split, dataset vintage/versioning, RLS seam) but its table shapes do NOT match what exists.

**How to apply:** extend stats.* additively (V6+). Harvest IDEAS from obs.* (display overlay, version counter, SCD columns, RLS) but map them onto stats.* table shapes, never introduce obs.* tables. If asked to "implement the obs schema", flag the conflict first.
