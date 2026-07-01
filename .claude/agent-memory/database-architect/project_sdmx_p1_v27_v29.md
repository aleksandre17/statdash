---
name: project-sdmx-p1-v27-v29
description: SDMX-P1 NOW-set — V27 ConceptScheme, V28 dataset lifecycle FSM, V29 CategoryScheme; all additive/two-way; api published-only projection seam
metadata:
  type: project
---
SDMX-P1 NOW-set landed (ADR `.claude/agent-memory/architect/adr_sdmx_p1_frontier.md`). Migrations are at repo-root `ops/postgres/migrations/` (NOT `platform/`); api is at `platform/apps/api`. Head was V26 → now V29. All TWO-WAY (new PLAIN tables + nullable/defaulted ADD COLUMNs), NO trigger/column on stats.observation, hot path untouched, lifecycle deletes no facts.

**V27 ConceptScheme** — `stats.concept_scheme` (namespace: code/agency/version) + `stats.concept` (code=identity, concept_role MOVED here from V18 dimension as SSOT, core_representation_codelist, parent_code code-chain). `stats.dimension` += nullable `(concept_scheme_code, concept_code)` FK `dimension_concept_fk`. EXPAND half: backfill seeds one concept per role-typed dimension (default scheme 'CROSS_DOMAIN', concept code = dim code) and binds; `dimension.concept_role` KEPT as read alias (NO dual-write trigger) — a future V-contract drops it. In-migration no-drift RAISE gate. Role now resolves THROUGH concept: cube-profile uses `COALESCE(c.concept_role, d.concept_role)` and exposes `dimension.concept = {scheme, code}`.

**V28 Dataset lifecycle FSM** — `stats.dataset` += `status` (draft/published/deprecated/superseded, DEFAULT draft) + `valid_from/valid_to` + self-FK `replaced_by`. `dataset_superseded_chk` makes illegal state unrepresentable. `stats.set_dataset_status(code,new_status,replaced_by)` mirrors publish_release. Backfill promotes ALL pre-V28 datasets draft→published (else default 'draft' would dark-out delivery). ORTHOGONAL to release (V25 = data vintage) and dataset_version (V6 = ETag) — SSOT each, not merged. SSOT projection view `stats.dataset_published` (status IN published/deprecated).

**V29 CategoryScheme** — `stats.category_scheme` + `stats.category` (LTREE `category_path`, reuses V23 `stats.code_to_ltree_label`, trg_category_code_path acyclicity guard, `category_no_self_parent_chk`) + `stats.categorisation` (Dataflow→Category M:N, FK to stats.dataset). NOT config.nav_item, NOT classifier rows.

**api integration** — `platform/apps/api/src/routes/stats/lifecycle.ts` is the published-only SEAM (`isDatasetDiscoverable`, `publishedDatasetRelation`, `datasetPublishedViewExists`) with graceful degradation when V28 absent (rolling migration), mirroring actual-region.ts viewExists. Wired into: cube-profile (`assertDatasetExists` → discoverable; +dimension.concept), observations (current-cube read gated, **asOf permalink BYPASSES gate** for auditability), new `GET /api/catalog` route (registered in index.ts; categorisation JOIN dataset_published), bootstrap optional `categories` block (local intersection type — NOT added to @statdash/contracts, that package is out of lane).

**Fitness tests (DB-gated skip-without-DATABASE_URL):** `routes/cube/concept-scheme.fitness.test.ts` (no-drift + Law-1 grep: strips COMMENT ON + inline/leading comments before checking for hardcoded REF_AREA etc.), `routes/stats/dataset-lifecycle.fitness.test.ts` (projection holds + supersede deletes 0 obs + data still resolves + illegal-state), `routes/catalog/category-scheme.fitness.test.ts` (acyclic + catalog excludes non-published). Source-grep path to migrations from cube dir = 6x `../`.

**How to apply:** the contract package is OUT of lane for this agent — additive api wire fields go as local intersection types, not contract edits. See `[[project-db-state]]`. Next head = V30.
