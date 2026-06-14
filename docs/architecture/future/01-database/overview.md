# Database Architecture — Overview

> **Standards:** SDMX ISO 17369 · SNA 2008 / ESA 2010 · Kimball DWH Toolkit (2013) · PostgreSQL 16
> **Platform alignment:** matches frontend engine contracts (`Classifier`/`DisplayMap` · `DatasourceInstanceConfig` · `NodeDef` tree · `ApiResponse` envelope)

---

## Four PostgreSQL schemas

| schema | owns | churn rate | who writes |
|---|---|---|---|
| `obs` | statistical warehouse (facts, dims, DSD, vintages) | medium (data loads) | ingestion / ETL |
| `cms` | platform config (sites, datasources, pages, nav, i18n) | high (Constructor) | Constructor admin |
| `meta` | Constructor introspection (node/transform registry, catalog) | low | deploy + Constructor |
| `iam` | users, roles, permissions, audit | low | admin |

Blast radius is explicit: a CMS migration can never threaten fact data and vice-versa.

---

## Two design laws

1. **Warehouse (`obs`)** — full Kimball + SDMX rigor. Normalize dims, constrain hard, partition the fact table. Internal storage; the engine reaches it through a query API, never by serializing rows directly.
2. **Config (`cms`/`meta`)** — JSON-safe round-trip fidelity beats relational purity. `NodeDef[]` and `DatasourceInstanceConfig` are stored as `JSONB` matching TS shapes verbatim, because `JSON.parse(JSON.stringify(x)) === x` is a platform invariant.

---

## Schema map (ER summary)

```
obs.dimension ──< obs.dim_member ──< obs.dim_display
                        │  (surrogate id)
                        ├──── obs.observation >── obs.dataset >── obs.dsd ──< obs.dsd_component
                        │    (geo_id, indicator_id, extra_dims)
                        └──── obs.dataset_vintage  [FSM: preliminary→revised→final]

cms.site ──< cms.datasource_instance
         ──< cms.page ──< cms.page_version
         ──< cms.nav_item  (page_id → cms.page, optional, same-tenant FK)
         ──< cms.i18n_slice

meta.node_type    meta.transform    meta.catalog  (VIEW over obs.* + cms.*)

iam.app_user ──< iam.user_role >── iam.role ──< iam.role_permission >── iam.permission
iam.audit_log  (append-only)
```

---

## Key design decisions

| Decision | Chosen | Rejected | Why |
|---|---|---|---|
| Dim storage | Normalized `dim_member` + JSONB display | One JSONB blob per dim | Integrity + hierarchy traversal; display half stays JSONB for i18n |
| Fact extra dims | 6 physical cols + `extra_dims` JSONB | A column per dimension | No privileged dims (Law 1); new dim = zero DDL |
| Page tree | Single JSONB `children` | Normalized `node` table | Round-trip fidelity; no DB-level node queries needed |
| Partitioning | LIST(dataset) → RANGE(time) | Single heap | Guaranteed pruning on every query |
| Status | `vintage.lifecycle` FSM + per-cell `obs_status` | Scattered status enums | Illegal states unrepresentable; one source per concern |
| Secrets | `secret_ref` in `auth` JSONB | Live token in row | Avoid leaking into page_version/audit history (OWASP) |
| Tenant isolation | RLS + composite FKs | App-layer filtering only | Defense in depth |

---

## Detail files

- [`obs-schema.md`](obs-schema.md) — warehouse: dimensions, fact table, indexing, DSD, SDMX serializer
- [`cms-schema.md`](cms-schema.md) — platform config: site, datasource_instance, page, nav, i18n, manifest query
- [`iam-audit.md`](iam-audit.md) — meta/iam: node registry, users, roles, RLS, audit, page versioning, vintage FSM

---

## YAGNI guard (deliberately NOT done)

- No event-sourcing of observations — `dataset_vintage` + `page_version` cover the audit need
- No separate `node` table — premature normalization, no query justification
- No SCD-2 machinery beyond `valid_from/valid_to/is_current` columns — wired, not running until a codelist revises
- No Flyway migration files yet — `V1__baseline.sql` is a separate step when the Java backend begins

---

## Next steps

- [ ] `obs.classifiers_for()` + `obs.display_for()` helper functions
- [ ] `V1__baseline.sql` Flyway migration (when Java backend begins)
- [ ] ER diagram (dbdiagram.io from this DDL)
- [ ] Java entity mapping (`@Type(JsonType)` for `extra_dims`)
- [ ] `GET /api/site` controller wiring the manifest assembly query
- [ ] RLS policies on all `cms.*` tables
