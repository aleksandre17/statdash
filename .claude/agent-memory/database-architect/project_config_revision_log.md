---
name: project-config-revision-log
description: ADR-052 — the Authoring Lifecycle revision log + validated-PUT seam (0104 wave E0, door #2); how config docs are stored today and the append-only design
metadata:
  type: project
---

ADR-052 (`docs/architecture/decisions/ADR-052-authoring-lifecycle-revision-log.md`, Proposed) — decides door #2 of the 0104 elevation (`DESIGN-0104-elevation-reference-class.md` §2·C3). Design-only; build lands in wave E0.

**Ground truth (verified 2026-07-22, file:line):** the `config` schema (V3) has TWO write disciplines. `config.page` ALREADY has append-only history (`config.page_version`, trigger-assigned `version_number` via `assign_version_number()` V3:85, `is_published` flag, `POST /:id/publish` pages.ts:316, `guardConfig` validateConfig REJECT-mode pages.ts:24). But `config.data_spec` (data-specs.ts:60) and `config.data_source` (data-sources.ts:56) are **destructive UPDATE via buildSetClause, no history, no referential validation** — that un-versioned path is exactly where the corruption incidents landed (datasetCode flip; 8 orphan 0-row scratch specs). Provisioning is the 2nd writer via its OWN change-gated idempotent path (upsert.ts / upsert-data-source.ts), NOT the HTTP PUT; per-id catalog merge = `mergeCatalogById` upsert.ts:70.

**The design (chosen):** ONE polymorphic append-only `config.revision` table (proposed V39), generalizing the page_version pattern to all doc kinds — reuse `assign_revision_number()` trigger, UNIQUE(doc_kind,doc_id,revision_number), full `body JSONB` snapshot, `restored_from` self-FK (restore = NEW revision, never rewrite), nullable `tenant_id` MT-seam placeholder (mirrors V6 stats.dataset.tenant_id). **`config.page` NOT migrated** (its `is_published` is load-bearing for bootstrap/provisioning) — expand-contract: new table serves data_spec/data_source; pages keep page_version; the `RevisionRecord` CONTRACT is universal (pages project page_version→RevisionRecord). Two-store-one-contract seam is disclosed, unification deferred.

**Contract lives in `packages/contracts` (src/revision.ts):** RevisionRecord {id, docKind, docId, revisionNumber, body, actor, note, restoredFrom, createdAt} + RevisionSummary (body omitted). Reads: GET :id/revisions (summaries), GET :id/revisions/:revId (full), POST :id/revisions/:revId/restore (server re-reads old body, RE-VALIDATES against today's refs, appends).

**Validation seam** at the HTTP PUT boundary (untrusted client), shared `lib/validate-config-doc.ts`; provisioning (trusted/git) NOT gated but still appends a revision on change. Four checks: shape (engine validateConfig) + datasetCode exists + source dims ⊆ DSD dims + metric refs resolve. Reject = NEW 422 Problem kind `config-invalid` with machine-readable `violations[]` (mirrors accounting-identity 422 precedent problem.ts:78). Does NOT validate: emptiness/0-rows (honest canvas state; drafts-never-reach-server is C3's other half), scope honesty, tenant scoping.

**Risk:** LOW/Class-M — additive CREATE only, reversible by DROP; one real hazard = revision-append + current-row-UPDATE must be ONE txn (pages.ts:213 shape). See [[project_db_state]], [[project_multi_tenancy]] (tenant seam), [[project_vintage_release]] (genesis-backfill precedent).
