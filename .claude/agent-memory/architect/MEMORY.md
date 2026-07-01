# Architect Memory Index

> Giant ADRs were migrated to first-class artifacts in `docs/architecture/decisions/ADR-NNN-*.md` (Phase-2 SSOT reorg). Memory now holds only slim pointers; the ADR doc is the SSOT for each decision.

## Project
- [Multi-tenancy decision fork (P0 one-way door)](project_multitenancy_decision_fork.md) — branch is tenant-AGNOSTIC (rebrandable single-tenant), NOT multi-tenant-isolated; decide SaaS-vs-per-deploy before stacking features
- [apps/ monorepo migration](project_apps_monorepo.md) — workspaces restructure; why a @plugins alias seam was added moving src → apps/geostat
- [@geostat/* alias resolution](project_geostat_alias_resolution.md) — packages resolve via path aliases only, NOT npm workspaces; workspace:* is a latent install-breaker
- [Panel as external product](project_panel_external_product.md) — panel ships externally; engine packages = the published contract (SemVer)
- [catalog.ts React purity](project_catalog_react_purity.md) — plugins/catalog.ts pulls Shell modules; blocks apps/panel palette; fix = per-slice *.meta.ts extraction
- [Charts split (Phase 8.1)](project_charts_split_8_1.md) — @geostat/charts out of engine; cycle resolved by TWO registries split by package
- [Semantic Layer (Phase 10.1 N26)](project_semantic_layer_n26.md) — MetricRegistry as 2nd registry axis; by→encoding.series; provenance via MetadataPort decorator
- [Unit attachment decision](project_unit_attachment_level.md) — UNIT_MEASURE attaches at the MEASURE-classifier level, not dataset, not series
- [Seed units codelist mismatch](project_seed_units_codelist_mismatch.md) — seed-units.ts emits PCT but V16 seeds PERCENT; breaks once unit_code becomes an FK
- [Data-binding SHIPPED](project_data_binding_shipped.md) — VERIFIED 2026-06-26: the data-source ADRs are now CODE (3 store KINDS behind one DataStore port; href D-HREF opened; metric→store + declarative blend wired); ADR-001's PROPOSED/DEFER-href status now partly STALE; open work = ADOPTION not architecture; still defer D3-PLANNER

## Architecture Decisions — migrated to docs/architecture/decisions/ (Phase-2 SSOT)
- [Data-Binding Architecture](project_data_binding_architecture.md) → ADR-001 — one DataStore port + N source kinds; semantic-layer binding spine (R1); ship blend SEAM, defer planner (consolidates blending + reference-render + source-spectrum). Accepted (partial)
- [Platform & Constructor Vision](project_platform_constructor_vision.md) → ADR-002 — config-object SSOT + pure SDUI renderer; enforce contract + publish JSON Schema; coverage LEADS. Proposed (vision)
- [Constructor](project_constructor.md) → ADR-003 — open store model, PropSchema inspector, lossless round-trip, G3 live preview via buildStoreManifest. Accepted (substantially built)
- [Mode → generic `perspective` axis](project_mode_as_perspective_axis.md) → ADR-005 — generalize privileged mode into a generic perspective axis (ctx.perspectiveState); delete by-mode no shim; permalink from registry. Proposed (final, ready)
- [Semantic-Token / Theming Spine](project_semantic_token_theming_spine.md) → ADR-006 — 3-tier tokens; brand-neutral default + [data-tenant]; byte-identical geostat; CSS attribute scoping. Proposed
- [SDMX P1 Frontier](project_sdmx_p1_frontier.md) → ADR-007 — P1 NOW = ConceptScheme V27 + lifecycle FSM V28 + CategoryScheme V29; defer ref-metadata/quality/SDMX-REST. Proposed
- [Deployment Topology](project_deployment_topology.md) → ADR-008 — per-app single-origin reverse proxy; vite-only build stage; SPA fallback ''; no wildcard CORS. Proposed
- [Element Config Schema Seam](project_element_config_schema_seam.md) → ADR-009 — kill shared-base bloat; per-slice schema; base-minimality fitness fn (ISP/OCP). Proposed
- [Multi-store / storeId](project_multistore_storeid.md) → ADR-010 — routing spine LIVE (buildStoreManifest+resolveStore+storeKey); re-adopt metric→store + authoring, defer envelope/auth/blending (D1-D3). Accepted (implemented)
- [Time-Range Readiness Seam](project_time_range_readiness_seam.md) → ADR-011 — store-builder folds server time coverage into store.classifiers['time'] (A-variant) so pick:last resolves sync; +2 guards. Proposed
- [Platform Structure Re-architecture](project_platform_structure_rearchitecture.md) → ADR-012 — engine/→packages/, @geostat→@statdash, new @statdash/contracts; keep dependency arrow + source-condition; Strangler-Fig. Proposed
- [Shell Variant / Style Spine](project_shell_variant_style_spine.md) → ADR-013 — meta-declared VariantDef → data-attrs; hero+compact → one emphasis enum; CSS attribute scoping. Proposed
- [No Privileged Element / Capability Nav](project_no_privileged_element_capability_nav.md) → ADR-014 — nav-contributor + nav-transparent caps + registry visitor; navUtils stops hardcoding node types. Proposed
- [Ingestion Pipeline](project_ingestion_pipeline.md) → ADR-004 — generic self-describing canonical-workbook parser (PRIMARY); per-template declarative mapping demoted to SECONDARY (consolidates ADR-0030 + ADR-0031). Proposed (build-ready)
- [Statistical Platform North-Star](project_statistical_platform_north_star.md) → ADR-015 — maturity vision vs Eurostat/.Stat/IMF; 3 ports (Serializer/RuleSpec/QuerySpec) absorb the roadmap; trigger-gated. Proposed (vision)
- [ContentConstraint](project_content_constraint_adr.md) → ADR-016 — cube region predicate-row model validated in SILVER (orig. ADR-0027). Accepted (implemented)
- [Geostat De-tenant Phase C](project_detenant_phase_c_adr.md) → ADR-017 — serialize bundle BronzePayload to ops/seed-data/, 4-way parity gate before deletion (orig. ADR-0028). Proposed
- [Bootstrap Phase B](project_bootstrap_phase_b.md) → ADR-018 — geostat SiteManifest from Postgres; nav as site_config.nav blob; publish in the provisioning upsert (orig. ADR-0026 Phase B). Designed

---

> Entries below merged from platform (current @statdash content) during .claude SSOT reorg Phase 1.


## [platform] Project
- [Authoring-Schema SSOT epic](project_authoring_schema_ssot.md) — Constructor must CONSUME engine manifest/PropSchema not fork it; P1 SHIPPED (c1a635e); P2 saveGuard / P3 chart colorMode+thresholds / P4 dataLinks remain
- [API Demo Parity](project_api_demo_parity.md) — blocking NEW :3002 demo parity: ApiStore missing `display` channel + stats-api classifier/obs wire drift + empty `aggregates` + regional `_T` pollution; OLD spec at git 7a47e5d^
- [Live Provisioning](project_live_provisioning.md) — live statdash demo seeded by Flyway V1-V32 + R__ repeatable GOLD seed; fresh DB re-seeds 3-dim placeholders unless R__ neutralized; GDP_ANNUAL adds `approach` (DSD conflict)
- [GDP Page Dim Underspecification](project_gdp_page_dim_underspecification.md) — GDP panels pin only measure+time; obs route does NO aggregation; a 4-dim real GDP needs approach+geo pinned per panel or render garbles
- [Platform Layout](project_platform_layout.md) — real engine/* + apps/* paths; chart/table/kpi are *panels* not nodes; where framework seams live
- [Deferred Framework Seams](project_deferred_framework_seams.md) — published-but-unconsumed seams (getByCapability, node:status, PropSchemaForm, SwitchNode) + activation triggers
- [Typecheck Baseline](project_typecheck_baseline.md) — root `tsc --noEmit`=0 is a FALSE GREEN; real gate is `cd apps/geostat && tsc -b` = ~293 pre-existing errors; tests 571/571 green
- [DB Layer](project_db_layer.md) — Phase-2 DB (PG+Timescale+LTREE+JSONB) backed by Flyway V1-V10 at ops/postgres/migrations/; seed.ts implements the 3-bundle ETL
- [Ingestion Architecture](project_ingestion_architecture.md) — proposed Staged Submission Pipeline (Medallion bronze/silver/gold + 202-job + PUBLISH gate) replacing manual seed.ts
- [engine/core build gap](project_engine_core_build_gap.md) — core is a dist-pointing pkg w/ NO tsconfig + empty dist + undeclared @geostat/expr dep; Node consumers (apps/api) break
- [I18N DB](project_i18n_db.md) — two co-existing locale patterns (JSONB bags vs classifier_display.locale rows); canonical img HAS ICU; keep ka/en short subtags + config.locale registry
- [Classifier code-path ADR](project_classifier_code_path_adr.md) → ADR-0023 — classifier hierarchy moves surrogate-id-chain → code-chain LTREE over (dim_code,code); Strangler-Fig V23 EXPAND + V24 CONTRACT. Accepted (design)
- [Vintage-as-Release ADR](project_vintage_release_adr.md) → ADR-0025 — SDMX-P0-2: release = publication-event aggregate stamped (GUC/triggers) on observation + observation_revision; V25 additive + genesis backfill. Accepted (design only)
- [Bootstrap Runner ADR](project_bootstrap_runner_adr.md) → ADR-0026 — gut apps/geostat into a generic SDUI runner booting from GET /api/bootstrap (Phase A); store half live. Proposed. Phase B = ADR-018, Phase C = ADR-017
- [Responsive CSS Model](project_responsive_css_model.md) — binding spine = work/DESIGN-css-responsive-standard.md; panel sizing = honest height band `--size-panel-height` clamp NOT aspect-ratio; KPI strip = count-aware @container ladder; Playwright-verified
- [Chrome/Panel/Section unification](project_chrome_panel_section_unification.md) — SHIPPED 2026-07-01 (ade152b): body-only height model (token on .panel__body/.section__body via bodyProps); map-collapse RESOLVED; SectionShell-as-PanelLayout-adapter still aspirational
- [RSP defects R1/R2/R3 status](project_responsive_css_model.md#rsp) — R1/R2/R3 already fixed in code by 2026-06-30; this session added fitness LOCKS FF-HEADER-NO-OVERFLOW + FF-PAGE-MEASURE-SSOT; remaining subsystem work needs the docker api+db stack

## [platform] Feedback — corrections & validated approaches
- [engine/react locale-agnostic](feedback_engine_react_locale_agnostic.md) — hook BLOCKS Georgian codepoints + 'ka' literals in engine/react; use 'en'/'fr' in tests
