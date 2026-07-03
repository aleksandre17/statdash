# Senior Backend Developer — Memory Index

## Project
- [CI DB gating](project_ci_db_gating.md) — how DB-gated suites un-skip; migrate vs seed vs self-provision preconditions
- [Toolchain facts](project_toolchain_facts.md) — pnpm root is platform/, build:engine first, no node pin
- [Deploy model](project_geostat_deploy_model.md) — jar vs context-dir server build layouts; node-vite remote tar-scope gap NOW FIXED; pre-existing test baseline
- [LIVE deploy mechanism](project_live_deploy_mechanism.md) — REAL 192.168.1.199 path: server git clone /tmp/statdash-build + docker-compose v1 prod-file-ALONE; 🔴 postgres data is EPHEMERAL (misconfigured volume) — NEVER `up --force-recreate` whole stack; backup/rollback + smoke
- [geograph d3-geo](project_geograph_d3geo.md) — SVG choropleth: app peer-alias build contract (external lib = peerDep of pkg + direct dep of apps) + geojson CW-winding projection bug; READ THE MAP SCREENSHOT, DOM metrics lie
- [API typecheck in-flight](project_api_typecheck_inflight.md) — RESOLVED: ADR-0027 region symbols landed (region.ts); apps/api typechecks fully green now
- [check-laws path coupling](project_checklaws_path_coupling.md) — ops scripts hardcode lib dir paths (rename false-greens them); check-laws fully GREEN; check_zero strict retirement-lock helper vs check_ts content-law helper
- [Structure migration log](project_migration_progress.md) — platform/ tree is now `packages/` (was `engine/`) + new zero-dep `@geostat/contracts`; npm scope rename to `@statdash/*` (Phase 5) is a deferred one-way door
- [SCD-2 classifier writers](project_scd2_classifier_writers.md) — which files are SCD-2 writers vs in-place upserters, and the is_current invariants across ingest/seed
- [api image + validate:local](project_api_image_and_validate_local.md) — Dockerfile pnpm-deploy (symlink-free) + the 8-stage live-DB one-shot; CI workflow is stale
- [api Problem Details](project_api_problem_details.md) — RFC 9457 problem+json: registry in apps/api lib, shape in contracts; Fastify error-handler-must-register-before-routes pitfall
- [api shared seams](project_api_shared_seams.md) — REUSE these lib/ seams: relationExists (rolling-migration probe), buildSetClause (partial-UPDATE), alreadyPublished (RFC-9457 409)
- [data_source provisioning](project_data_source_provisioning.md) — boot-seeds 3 geostat sources; status MUST be written 'connected' (DB default 'idle' is hidden by public read); url=NULL for single-origin
- [canonical upload route](project_canonical_upload_route.md) — ADR-0031 Wave 3a/3b: route seams (fetchActiveLocales/precheckContractCompat/recognizeReferenceMetadata), writeWorkbook ACL, txn-no-op-worker test trick
- [canonical e2e pipeline](project_canonical_e2e_pipeline.md) — EXACT FSM (received→staged→explicit publish→gold) + preconditions (V7 datasets/DSD, status=published, ka+en locales) + verified anchors
- [seed/DSD divergence](project_seed_dsd_divergence.md) — R__seed_geostat_gold GDP_ANNUAL DSD omits `approach`, fails V22 dim_key trigger on Flyway re-run; blocks full compose-up
- [parity render regressions](project_parity_render_regressions.md) — kpi-strip querySync-cold crash (caps.sync=false) + observations route ignores approach/geo filters; metrics lie, verify visually
- [fresh provision canonical](project_fresh_provision_canonical.md) — fresh prod compose-up now deterministic: V34 GDP DSD 4-dim widen + R__ neutralized (both flyway lanes) + ingest one-shot; bundle seed still stale 3-dim
- [api ops floor](project_api_ops_floor.md) — API-02/03/08/09/10/11/16: async pg-backed audit/snapshot ports, hand-rolled metrics+rate-limit+openapi(zod v3)+redact seams, V36/V37 migrations, canonicalRoutes-is-now-a-factory
- [metric delivery pipeline](project_metric_delivery_pipeline.md) — semantic layer manifest→boot→registry via site_config 'metrics' key; only query.measure migratable (KPI render NOT metric-aware); withMetricProvenance install gap; faithful units from V16
- [provisioning i18n](project_provisioning_i18n.md) — config-tier label-completeness gate + display-vs-binding classifier (DISPLAY_KEYS/BINDING_SEGMENTS) + field-specific LocaleString resolution asymmetry (KPI label resolved; unit/section-title template-only, resolveTemplate ignores {ka,en})

## Feedback
- [Flyway immutable](feedback_flyway_immutable.md) — never edit an applied migration, not even comments (checksum break)


---

> Entries below merged from platform (current @statdash content) during .claude SSOT reorg Phase 1.


## [platform] Project
- [versioned ingestion governance](project_versioned_ingestion.md) — ?datasetVersion resolves the DSD gate → new vintage; mints in the route (before facts validate), reuses dataset_dimension/dimension/bump_dataset_version/metadata, NOT V28 supersession
- [pnpm workspace root is platform/](project_workspace_root.md) — lockfile + catalog live under platform/, not repo root; shapes Dockerfile/compose context
- [package build/dist resolution](project_package_build_resolution.md) — tsup --dts exposes undeclared sibling deps / self-imports / deep-internal imports that Vite+Vitest source aliases hide
- [API TS build overrides](project_api_tsconfig_overrides.md) — apps/api must override root tsconfig's noEmit/bundler/allowImportingTsExtensions to emit
- [SQL migrations location](project_sql_migrations_location.md) — migrations live at repo-root ops/postgres/migrations, NOT platform/ops
- [config.page schema](project_config_page_schema.md) — page is identity-only; config/data_specs live in append-only config.page_version, key on slug
- [api scripts/src compilation boundary](project_api_scripts_src_boundary.md) — runtime src/ must not import build-time scripts/ (seed-helpers); restate SQL on Queryable port instead
- [time_period↔date SSOT](project_time_period_date_ssot.md) — period↔date math lives only in stats.parse_time_period (start) + parse_time_period_end (V16, end); routes pass raw SDMX text, never compute dates
- [RBAC vocabulary](project_rbac_vocabulary.md) — roles are admin/editor/viewer only; no publisher; publish gated to admin (editor saves, admin publishes)
- [api env fail-fast seam](project_api_env_failfast_seam.md) — env.ts is the single boot-time fail-fast seam; PROD_REQUIRED_SECRETS gate + how to test boot via resetModules
- [GeoStat source quirks](project_geostat_source_quirks.md) — raw DATA/ Excel defects: File1 ENG GDP column year-shifted (GEO=value SSOT), B6G ka typo, File3 partial activity breakdown + Excel lock hazard
- [V7 DSD vs canonical shape](project_v7_dsd_vs_canonical_shape.md) — V7 pre-registers GDP DSD 3-dim measure,time,geo (always applied, not neutralizable); canonical GDP is 4-dim → DSD gate fires; ACCOUNTS/REGIONAL match
- [version-mint locale label defect — RESOLVED](project_version_mint_locale_label.md) — FIXED in 8e9cb27: stats.dimension {en:code} insert now guarded by `if (isNew)`; existing axis never re-inserted; proven on staging (288 GDP obs, no 500)
- [canonical partial-failure retry — RESOLVED](project_canonical_partial_failure_retry.md) — submitToGold (now in canonical-fsm-drive.ts) converges an identical already-published reference payload to a no-op (KindJob.converged) instead of 409; facts retry lands. Scoped to reference + AlreadyPublishedError
- [observations multi-value filter](project_observations_multivalue_filter.md) — SDMX OR-within-dim: filter dim value may be scalar (AND containment) or JSON array (= ANY); buildDimFilter seam; scalar-only variant for the revision-triangle
- [codelist label revision path](project_codelist_label_revision_path.md) — display-label-only fix (codes unchanged): re-ingest canonical → changed label changes hash → SCD-2 upsertClassifier updates gold; facts 409 EXPECTED; converter *_MEASURE_CORRECTIONS map

## Auto-relocated (memory-home-guard — reconcile into a topic section)
- [LIVE deploy mechanism](project_live_deploy_mechanism.md) — REAL 192.168.1.199 path: server git clone /tmp/statdash-build + docker-compose v1 prod-file-ALONE; diverges from RUNBOOK; backup/rollback + smoke
