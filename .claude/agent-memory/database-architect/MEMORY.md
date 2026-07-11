# Database Architect — Memory Index

> Canonical schema SSOT = the Flyway set at `ops/postgres/migrations/` (head advances — re-Glob before writing a migration). Memory keeps DECISION RATIONALE, data-source truths, and live-DB gotchas; raw schema facts are derivable from the migrations themselves.

## State, contracts & the SSOT rule
- [DB State](project_db_state.md) — timescaledb-ha:pg16; three schemas (config/stats/stats_stage); the TimescaleDB partition-column rule (time_period_date is WRITER-PROVIDED — GENERATED-STORED and BEFORE-triggers both proven to fail); core invariants
- [Schema SSOT](project_schema_ssot.md) — the Flyway set is canonical; do NOT fork a 2nd migration system under apps/api; geostat bundles are non-uniform (code-keyed GDP vs id-keyed regional/accounts); 400-line seed-split ceiling
- [DB Contracts](project_db_contracts.md) — the frontend/engine TS shapes the DB must project verbatim (JSON round-trip), and the subsystem-doc home of each
- [obs.* vs stats.*](project_obs_vs_stats.md) — TWO cube schemas: applied stats.* (real) vs paper obs.* design doc (never built); extend stats.* additively, harvest obs.* ideas only
- [DB-gated fixtures](project_db_gated_fixtures.md) — live-DB fitness tests must satisfy V14 LocaleString completeness, V28 published projection, SCD-2 txn-time zero-width windows
- [Fresh-from-zero interleave (ADR-035)](project_fresh_from_zero_interleave.md) — why uncapped flyway DIES at V33 (V33 asserts ingest-made geo R2..R12); impossibility of an additive-only fix; the migrate/ingest interleave (bringup-fresh.sh); law: no migration may depend on ingest data

## Model decisions (SDMX rigor)
- [Classifier parent model](project_classifier_parent_model.md) — parent_code is SAME-dim only; measures FLAT (approach = metadata attr); geo/sector keep real hierarchies
- [Decision C — UNIT_MEASURE at measure-classifier level](project_decision_c_unit_measure.md) — V20/V21; resolution measure→dataset default→NULL via stats.measure_unit_resolved; +V20 backfill fail-fast gotcha
- [concept_role SSOT + V30](project_concept_role_ssot.md) — seed dims' SDMX concept_role; V30 (not an edit to V5/V7) sets roles + re-runs V27 backfill; closes V29 category cycle gap
- [ContentConstraint model (V26)](project_content_constraint_model.md) — cube region: predicate rows, AND-conjoined conditions, allowed=table/actual=view; region.ts and the SQL helper are deliberate twins (keep in lockstep)
- [Accounting-identity gate (DC-02)](project_accounting_identity_gate.md) — signed `linearIdentity` rule + un-bypassable publish gate; GDP=C+I_GFCF+X−M (error sev, 422); apps/api only, no migration
- [Multi-tenancy (ratified)](project_multi_tenancy.md) — tiered hybrid POOL+FORCE-RLS / SILO escape; agency=tenant; 4 red-team gates (worker-GUC, snapshot carve-out, shared-ref/scoped-fact, 3-role split)

## SDMX-P1 landings (rationale + gotchas beyond the migration text)
- [SDMX-P1 V27-V29](project_sdmx_p1_v27_v29.md) — ConceptScheme + dataset lifecycle FSM + CategoryScheme; release/lifecycle/dataset_version each SSOT (not merged); published-only api seam (lifecycle.ts)
- [Vintage / Release (ADR-0025, V25)](project_vintage_release.md) — stats.release publication-event aggregate; release_id stamps via app.release_id GUC; genesis-backfill trigger-safety (V8 column-scoped won't fire; V17 auto-bump suppressed with app.dry_run)
- [V31 Reference Metadata](project_v31_reference_metadata.md) — SDMX ESMS-lite; reference_metadata SCD-2 backs Law-9 badges; content cols use OPTIONAL locale guard (human-facing → complete-when-present); contract in @statdash/contracts
- [V38 AgencyScheme (DB-08)](project_v38_agency_scheme.md) — identity SSOT; stats.agency(UUID id, mutable code); nullable agency_id FK re-point (EXPAND); CONTRACT+MT deferred; agency_id(identity) ≠ tenant_id(isolation); V6 seam untouched
- [Governed dimension catalog (AR-49 M0 item 6)](project_governed_dimension_catalog.md) — provisioning siteConfig `dimensions` key (peer of `metrics`); measure EXCLUDED (peer split: measure→metric, other dims→dimension); conceptRole from V30; members from DSD; I added the missing bootstrap `dimensions` projection; fitness now 7 siteConfig keys
- [Provisioning catalog merge (AR-49 M2.2)](project_provisioning_catalog_merge.md) — provisioning MERGES site_config.metrics/dimensions per entry-id (existing wins) not wholesale replace; steward-authored entries survive re-provision; trade-off (provisioning can't update an existing id) → AR-47

## Live data-source truths (from the real workbooks / source systems)
- [Live SSOT: canonical vs retired bundle](project_live_ssot_canonical_vs_retired_bundle.md) — LIVE data = DATA/canonical/*.xlsx (genuine en); ops/seed-data bundle is RETIRED (en=ka placeholder) — a diagnosis trap
- [Canonical GDP_ANNUAL shape](project_canonical_gdp_annual_shape.md) — approach is a real 4th fact dim (PROD/EXP/INC/_Z); contribution_role (add/subtract/total) is the component-vs-total SSOT (render must read it); per-capita is USD not GEL_MN
- [DSD-completeness](project_dsd_completeness.md) — every obs dim_key value must be a declared classifier member; GDP_DEFLATOR closed the gap; fitness-locked offline via compute-dim-key-gap.mjs
- [Demo classifier data (V33)](project_demo_classifier_data.md) — aggregates virtual classifier (isClosing in metadata) + geo SCD-2 de-dup of ISO/Rn dups; ON CONFLICT must target the partial unique (V18 dropped the blanket)
- [REGIONAL_GVA 2010-2015 revision (deferred)](project_regional_gva_2010_2015_revision.md) — 2026-07-03 source revises 2010-2015; only +2024 applied (0-drift law); re-vintage pending owner decision — treat the 2015/2016 basis discontinuity as known
- [FEATURED manifest](project_featured_manifest.md) — DATA/canonical/FEATURED.json governed featured-metrics (AR-40); yellow-fill (ARGB FFFFFF00) authoring signal; coordinate resolves to exactly 1 obs

## Operations
- [PG persistent volume CLOSED](project_pg_persistent_volume_closed.md) — ephemeral-postgres data-loss landmine fixed 2026-07-04 (ADR-019); DB on statdash-prod-pgdata-v2 at Spilo PGDATA /home/postgres/pgdata; the "NEVER --force-recreate postgres" rule is now obsolete for data-loss

## Feedback
- [Mirror frontend contracts](feedback_mirror_frontend_contracts.md) — DB schema must project existing engine TS types (JSON round-trip), not invent a parallel relational model; Kimball+SDMX for facts, JSON-fidelity for config
- [Seed ETL decoupling](feedback_seed_etl_decoupling.md) — api seed imports geostat bundles via ACL + ambient @geostat/engine shim + cleared tsconfig paths; never couple the API to the engine type graph
