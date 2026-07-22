---
name: config-revision-log
description: ADR-052 E0 — config.revision append-only log + validated versioned PUT on data_spec/data_source; the ref-class-location verdict (datasetCode/dims live on the SOURCE config, NOT extractDeps)
metadata:
  type: project
---

ADR-052 (`docs/architecture/decisions/ADR-052-*.md`) door #2, built E0 (commit db51e189, 2026-07-22). Ends silent destructive config writes: `data_spec`/`data_source` PUTs were a destructive `buildSetClause` UPDATE with no history + no referential validation (the datasetCode-flip corruption class).

**The seams (reuse, don't re-derive):**
- `V39__config_revision.sql` — ONE polymorphic append-only `config.revision` (doc_kind, doc_id, revision_number trigger-assigned per-parent via `config.assign_revision_number`, mirrors V3 page_version). Genesis-adoption backfill (revision-1 per existing row). Nullable `tenant_id` MT placeholder. Pages NOT migrated (expand-contract; they keep page_version, project into the same RevisionRecord contract). Additive/reversible.
- `@statdash/contracts` `revision.ts` — `RevisionRecord`/`RevisionSummary`/`ConfigDocKind` (panel↔api wire shape; body OMITTED from summary).
- `apps/api/src/lib/validate-config-doc.ts` — `validateConfigDoc(docKind, body, db)` the referential gate → `ConfigViolation[]`; route throws `configInvalid(violations)` (422). Probes are rolling-migration-safe (gate on `relationExists` first, degrade to skip).
- `apps/api/src/lib/revision-log.ts` — `appendRevision`(in-txn)/`listRevisions`/`getRevision` + snake→camel mappers.
- `apps/api/src/lib/publish-roles.ts` — `requirePublishRole` admin gate SSOT (pages.ts still has its own copy; harmonizing is a follow-up).
- `lib/problem.ts` — `config-invalid` 422 kind + `configInvalid()` factory + `ConfigViolation` type (violations[] as RFC-9457 extension members, the accounting-identity shape).

**THE REF-CLASS-LOCATION VERDICT (the MUST-VERIFY — load-bearing, don't relearn):** the blessed "4 checks" assume a document exposes datasetCode/source-dims/metric-refs. In THIS codebase they live in DIFFERENT places, and `extractDeps` is the WRONG seam for validation (it's a RENDER-dependency extractor — its `dims` is a SUPERSET incl. TIME_DIM + ambient coordinate + `$ctx` filter dims; would false-positive a ⊆-DSD check). Authoritative sources:
- **datasetCode** = a DIRECT field of a `data_source` config JSONB (`config.datasetCode`, the stats/rest kind — see `source-descriptor.ts`). A `data_spec` has NO datasetCode; reaches one only via `source_id`.
- **source-dims** = `config.nonTimeDims` (direct field, authoritative declared list). `nonTimeDims ⊆ DSD` (`stats.dataset_dimension(dataset_code, dim_code)`) is clean + decisive on the SOURCE. Spec render-dep dims are NOT used.
- **metric-refs** = the GOVERNED positions only (`metric.metrics`, governed `pipeline` source head `metrics`) → resolve against `config.site_config` key='metrics' (id∪code set). Steward-plane raw codes (`query.measure`, `timeseries.code`) are NOT checked (physical SDMX codes, share the MetricRef namespace under Postel — flagging them false-positives). The author/steward plane split (Law 11) makes #4 decisive.
- **shape** (data_spec) = spec.type ∈ DATASPEC_DISCRIMINANTS only. There is NO pure standalone-DataSpec structural validator (SPEC_CATALOG is authoring metadata; engine `validateConfig` validates a PAGE tree, not a lone spec). Deeper per-kind field validation happens at interpret time — SURFACED, not gated pre-store.

Net: data_source PUT = the incident surface (dataset-exists + dims-subset, both direct-field decisive). data_spec PUT = shape + metric-resolves intrinsic; dataset/dims transitive via `source_id`. Emptiness/0-row is NOT invalid (honest canvas, ADR §4) — the orphan-scratch class is a client-side-drafts concern, not this gate.

**Test idiom:** `config-revision.fitness.test.ts` — stateful fake-pg (pages.validation.test.ts pattern, extended to model config.revision + stats DSD probes + metrics catalog). Fake revision ids MUST be valid UUIDs (routes validate `:revId` as uuid). 200 bodies are wrapped by `ok()` → read `.data`; 422 problem envelopes are not wrapped.
