# Architect Memory Index

## Project
- [Platform Layout](project_platform_layout.md) — real engine/* + apps/* paths; chart/table/kpi are *panels* not nodes; where framework seams live
- [Deferred Framework Seams](project_deferred_framework_seams.md) — published-but-unconsumed seams (getByCapability, node:status, PropSchemaForm, SwitchNode) + their activation triggers
- [Typecheck Baseline](project_typecheck_baseline.md) — root `tsc --noEmit`=0 is a FALSE GREEN; real gate is `cd apps/geostat && tsc -b` = ~293 pre-existing errors; tests 571/571 green
- [DB Layer](project_db_layer.md) — Phase-2 DB (PG+Timescale+LTREE+JSONB) now backed by Flyway V1-V10 at ops/postgres/migrations/; seed.ts implements the 3-bundle ETL
- [Ingestion Architecture](project_ingestion_architecture.md) — proposed Staged Submission Pipeline (Medallion bronze/silver/gold + 202-job + PUBLISH gate) to replace manual seed.ts
- [engine/core build gap](project_engine_core_build_gap.md) — core is a dist-pointing pkg w/ NO tsconfig + empty dist + undeclared @geostat/expr dep; only bundler apps consume it from source; Node consumers (apps/api) break
- [I18N DB](project_i18n_db.md) — two co-existing locale patterns (JSONB bags vs classifier_display.locale rows); canonical img timescaledb-ha:pg16 HAS ICU; recommend keep ka/en short subtags + config.locale registry
- [Classifier code-path ADR](project_classifier_code_path_adr.md) — ADR-0023: classifier hierarchy moves from surrogate-id-chain to code-chain LTREE over (dim_code,code); deletes upsert.ts Step 3/3b; V23/V24/V25 Strangler-Fig
- [Vintage-as-Release ADR](project_vintage_release_adr.md) — ADR-0025 SDMX-P0-2: release = publication-event aggregate stamped on observation + observation_revision (GUC app.release_id); as-of via pre-image overlay; V25 additive
- [ContentConstraint ADR](project_content_constraint_adr.md) — ADR-0027 SDMX-P0-1: cube region = predicate-row model (allowed-set per dim + conditional B9-only-on-U); validated in SILVER (ILLEGAL_COMBINATION); actual = view; V26 additive
- [Bootstrap Runner ADR](project_bootstrap_runner_adr.md) — ADR-0026: gut apps/geostat into a generic SDUI runner booting any site from GET /api/bootstrap; 3 entanglement points; compiled plugins + content-from-DB; store half already live
- [Bootstrap Phase B](project_bootstrap_phase_b.md) — ADR-0026 Phase B: extract geostat content to config.* via export-script→provisioning JSON; 3 structural gaps (publish-state, nav shape, label encoding); nav→site_config.nav blob; slug===config.id enforced
- [De-tenant Phase C ADR](project_detenant_phase_c_adr.md) — ADR-0028: gut geostat to a pure SDUI runner; extract facts/classifiers/displays to ops/seed-data/geostat/*.bundle.json (existing format:'bundle'); 2-stage preserve (R__ gold SQL + pipeline); buildManifest→emptyManifest; 4-way parity gate before deletion

## Feedback — corrections & validated approaches
- [engine/react locale-agnostic](feedback_engine_react_locale_agnostic.md) — hook BLOCKS Georgian codepoints + 'ka' literals in engine/react; use 'en'/'fr' in tests
