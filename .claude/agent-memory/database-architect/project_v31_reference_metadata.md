---
name: project-v31-reference-metadata
description: V31 SDMX Reference Metadata (ESMS-lite) — metadataflow + reference_metadata SCD-2 table backing the Law-9 badges; serve at GET /api/stats/datasets/:code/metadata
metadata:
  type: project
---
V31 landed the PRAGMATIC dataset-level slice of SDMX-P1-D Reference Metadata (the ADR door in `[[adr-sdmx-p1-frontier]]`, chief-engineer F8). Head was V30 → now V31; next = V32. All TWO-WAY (two new PLAIN tables in stats + one new function in config), NO column/trigger on stats.observation, hot path untouched.

**Schema (V31):**
- `stats.metadataflow` — SDMX Metadataflow namespace (code/agency/version maintainable-artefact identity, same idiom as concept_scheme V27 / category_scheme V29). Seeds ONE default `ESMS_LITE` flow (label complete bilingual). The SEAM the deferred full-ESMS predicate-row attribute engine slots behind.
- `stats.reference_metadata` — SDMX MetadataSet, SCD-2 versioned (is_current + valid_from/valid_to + revision; exactly one current per dataset via partial unique `uq_reference_metadata_current_dataset` WHERE is_current AND target_type='dataset'). Target polymorphism: `(target_type, dataset_code, dimension_code, member_code)` with `reference_metadata_target_chk` making target_type⇄columns coupling unrepresentable. 'dataset' built NOW; 'dimension'/'classifier' = nullable open doors. dimension_code is a GENERIC FK to stats.dimension (Law 1, no hardcoded dim name). member_code has NO FK (SCD-2 codelist posture, like content_constraint members).
- Structured i18n content cols = EXACTLY the engine ProvenanceRecord fields (provenance.ts: methodology/source/coverage/quality/note as LocaleString JSONB; last_updated DATE; contact_name/email TEXT; methodology_url TEXT). Folds into the existing MetadataPort/badge story — NOT a parallel system.
- **i18n:** content cols are WIRED to a NEW `config.enforce_locale_string_optional()` (V13 generic-guard variant, TG_ARGV column name): NULL/'{}' passes (field omitted), PRESENT must be locale-complete. Unlike V26/V27 structure tables, because RM is human-facing CONTENT shown in the badge (half-translated = blank badge in one locale = the V13/V14 failure mode).

**API:** `GET /api/stats/datasets/:code/metadata` — folded into `routes/stats/datasets.ts` (the dataset sub-resource, where descriptor+provenance flags already live; NOT a separate plugin). Read-only. Goes through `isDatasetDiscoverable` (V28 published-only gate, 404 draft/superseded like cube-profile). Graceful when V31 absent (to_regclass probe → 404, not 500). Omitted '{}' content fields → ABSENT wire key (Postel). Weak ETag W/"<code>.rm.<revision>".

**Contract:** `ReferenceMetadataContract` in `@statdash/contracts` (reference-metadata.ts, exported from index). Crosses api↔runner (runner folds into MetadataPort), so it belongs in the zero-dep shared home — UNLIKE the SDMX-P1 wire fields which stayed local. ContractLocaleString = Record<string,string> declared locally (contracts zero-dep).

**Seed:** `upsertReferenceMetadata` in seed-helpers.ts (in-place current-row convergence, NO SCD-2 history on re-seed — same posture as upsertClassifier). seed.ts seeds GDP_ANNUAL report (bilingual ka+en complete), own txn, guarded on V31 applied.

**Fitness:** `routes/stats/reference-metadata.fitness.test.ts` (DB-gated, app.pg bound to rolled-back client like cube-profile.test.ts): round-trip store→serve i18n intact, optional-locale teeth (half-translated rejected / omitted allowed), SCD-2 current uniqueness + revise-returns-current, target CHECK, discovery-gate 404s draft, no-report 404s.

**DEFERRED doors (reported):** full ESMS ~21-concept tree + ESQRS quality as predicate-row `stats.metadata_attribute` (content_constraint shape) — build when a real ESMS consumer (metadata panel/SDMX-RM export) exists, YAGNI. dimension/classifier RM targets (table supports them; no serve route/partial-index yet). SCD-2 revise via a public curator write path (seed/provisioning only for now). P1-F SDMX REST /metadata serializer.

**How to apply:** see `[[project-db-state]]`. Pre-existing test failures in config/pages.* (CURRENT_SCHEMA_VERSION=3 vs test-expected 2) are a DIFFERENT agent's lane, unrelated to RM.
