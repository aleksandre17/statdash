უნდა # Database Architect — Memory Index

## Project
- [DB Contracts Source of Truth](project_db_contracts.md) — the frontend types the DB must project, and where they live
- [DB State](project_db_state.md) — Flyway V1-V26 on timescaledb-ha:pg16; three schemas (config/stats/stats_stage)
- [V38 AgencyScheme](project_v38_agency_scheme.md) — DB-08 identity SSOT; stats.agency(UUID id) + nullable agency_id FK re-point (EXPAND); CONTRACT+MT deferred, V6 seam untouched
- [SDMX-P1 V27-V29](project_sdmx_p1_v27_v29.md) — ConceptScheme + dataset lifecycle FSM + CategoryScheme; published-only api seam (lifecycle.ts)
- [V31 Reference Metadata](project_v31_reference_metadata.md) — SDMX ESMS-lite metadataflow + reference_metadata SCD-2; GET /datasets/:code/metadata backs Law-9 badges
- [ContentConstraint Model](project_content_constraint_model.md) — V26 cube region: predicate rows, AND-conjoined conditions, allowed=table/actual=view
- [Decision C — UNIT_MEASURE at measure-classifier level](project_decision_c_unit_measure.md) — V20/V21; resolution measure -> dataset default -> NULL via stats.measure_unit_resolved
- [V20 backfill fail-fast](project_v20_v21_backfill_failfast.md) — confirm V16 unit_measure seed covers all legacy metadata unit codes before live apply
- [Classifier parent model](project_classifier_parent_model.md) — parent_code is SAME-dim only; measures FLAT (approach=metadata attr); geo/sector keep real hierarchies
- [DSD-completeness](project_dsd_completeness.md) — every obs dim_key value must be a classifier member; GDP_DEFLATOR added; fitness-locked offline (compute-dim-key-gap.mjs)
- [Accounting-identity gate](project_accounting_identity_gate.md) — DC-02 signed `linearIdentity` rule + publish gate; GDP=C+I_GFCF+X−M (error sev, 422); apps/api only, no migration
- [Multi-tenancy](project_multi_tenancy.md) — ratified tiered hybrid POOL+FORCE-RLS / SILO escape; agency=tenant; 4 red-team gates (worker-GUC, snapshot carve-out, shared-ref/scoped-fact, 3-role split)

## Feedback
- [Mirror frontend contracts](feedback_mirror_frontend_contracts.md) — DB schema must project existing engine types, not invent a parallel model


---

> Entries below merged from platform (current @statdash content) during .claude SSOT reorg Phase 1.


## [platform] Project
- [DB Infrastructure](project_db_infra.md) — statdash Postgres+pgAdmin in ops/; Docker CLI absent locally, validate compose via YAML parse
- [Schema SSOT](project_schema_ssot.md) — canonical schema is Flyway V1-V30 in ops/postgres/migrations; apps/api routes target it; do NOT fork a 2nd migration system
- [concept_role SSOT + V30](project_concept_role_ssot.md) — seed dims' SDMX concept_role; V30 (not an edit to V5/V7) sets roles + re-runs V27 backfill; closes V29 category cycle gap
- [DB-gated fixtures](project_db_gated_fixtures.md) — live-DB fitness tests must satisfy V14 LocaleString completeness, V28 published projection, SCD-2 txn-time semantics
- [Vintage / Release (ADR-0025)](project_vintage_release.md) — V25 adds stats.release publication-event aggregate; release_id stamps on observation + revision via app.release_id GUC; as-of vintage reconstruction
- [obs.* vs stats.*](project_obs_vs_stats.md) — TWO cube schemas: applied stats.* (real) vs paper obs.* design doc (never built); extend stats.* additively, harvest obs.* ideas only
- [Demo classifier data (V33)](project_demo_classifier_data.md) — aggregates virtual classifier (isClosing in metadata) + geo SCD-2 de-dup; ON CONFLICT must target the partial unique (V18 dropped the blanket)
- [Canonical GDP_ANNUAL shape](project_canonical_gdp_annual_shape.md) — approach is a real 4th fact dim (PROD/EXP/INC/_Z); contribution_role (add/subtract/total) classifies components (SSOT — render must read it, never hardcode)
- [Live SSOT: canonical vs retired bundle](project_live_ssot_canonical_vs_retired_bundle.md) — LIVE data = DATA/canonical/*.xlsx (genuine en); ops/seed-data bundle is RETIRED (en=ka) — diagnosis trap

## [platform] Feedback
- [Seed ETL decoupling](feedback_seed_etl_decoupling.md) — api seed imports geostat bundles via ACL + ambient @geostat/engine shim + cleared paths; never couple API to engine type graph
