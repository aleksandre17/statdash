# Engine Specialist — Memory Index

## Feedback — corrections & validated approaches
- [Class-M hook protocol](feedback_class_m_hook.md) — public `@statdash/engine` API edit → run 09B degradation-risk assessment as a named section; repeating an Opus-blessed seam needs no re-escalation
- [Shared-tree concurrency](feedback_shared_tree_concurrency.md) — tree is shared with concurrent agents; never `git stash -u`; diagnose typecheck/test failures via `git status`/`git diff <file>` first
- [Worktree vitest hoisted](feedback_worktree_vitest_hoisted.md) — pointer to plugins-specialist's consolidated worktree/Windows pitfalls file
- [Write tool byte-fidelity](feedback_write_tool_byte_fidelity.md) — Write silently normalizes exotic whitespace (e.g. NBSP) when retyping from memory; use Edit or verify byte-identity

## Project — epics, seams still evolving, escalation history
- [Perspective-axis refactor](project_perspective_axis.md) — timeMode/mode → generic perspective axis (SHIPPED, grep-clean); recurring hazard classes (ownership-vs-visibility gates, migrate-before-delete sequencing, alias-then-retire); superseded further by TM-STRANGLER
- [TM-STRANGLER time-binding](project_tm_strangler.md) — DimBinding+Selection discriminant (point/window/all) replaces shape-inferred timeBinding; generic TimeGranularity; FF-NO-MODE-LITERAL twin; supersedes PerspectiveTimeBinding
- [CLUSTER② Law-1 + inert seams](project_cluster2_law1_seams.md) — GrowthResolver privileged-literal leak fix (`atTime` wrong for obs-meta reads, use filter-key TIME_DIM); AD-6 `available` gate STILL not threaded in SiteRenderer (flagged); GRAIN-G4 granularity→grain default-gated
- [Adoption epic (X-2)](project_adoption_epic.md) — all 4 Acts done; Act 1's cross-workstream metric-delivery gap resolved later by AR-40 P0
- [AR-40 P0 semantic-layer spine](project_ar40_p0_spine.md) — KPI render+preliminary made metric-aware; the 3-paths-read-a-measure-ref bug (only warm resolved through resolveMeasureRef); gdp-total KPI migrated to metric-id
- [AR-49 M0 dimension catalog](project_ar49_m0_dimension_catalog.md) — DimensionDef governed-dim registry (peer of metric), manifest.dimensions, describeApp 1.1.0 bump; engine items 1-5 done, 6-11 pending
- [Preliminary-badge year-aware fix](project_preliminary_displayed_slice.md) — badge must derive from the DISPLAYED obs slice, not dataset-wide; applyEncoding now carries obsStatus
- [AR-36 pivot P0](project_ar36_pivot_p0.md) — state-bound encoding channels (CtxScopeRef + resolveEncodingRefs pre-pass, called in react before applyEncoding)
- [AR-36 pivot P1/P2/P3](project_ar36_pivot_p123.md) — regional 2-panel fold to ONE pivot; grain must bind to state (chart interpreters don't aggregate same-label rows); resolvePipeRefs seam for aggregate.by/sort
- [Async store ACL parity](project_async_store_acl_parity.md) — stats adapter contract: LocaleString classifier labels, obs Number coercion, display overlay, warm-key≡read-key seam
- [Canonical workbook parser](project_canonical_parser.md) — ADR-0031 xlsx→bronze deserializer; DSD SSOT = STRUCTURE.dimensions; xlsx ACL-confined to apps/api
- [Restructure paths](project_restructure_paths.md) — engine/* → platform/packages/*; @statdash/* scope (landed, @geostat/* fully retired)

## Reference — durable seam contracts (spot-checked against current code)
- [No-privileged-literal guard](reference_no_privileged_literal_guard.md) — FF-NO-PRIVILEGED-LITERAL scans registry/**; forbids privileged-dim + `<x>Color/<x>Label`; `measure` field exempt
- [Always-resolve seam](reference_alwaysresolve_seam.md) — ParamHidden.alwaysResolve hoists a default out of the perspective-ownership gate (post-P6; not bar-visibility anymore)
- [Time-dim SSOT](reference_time_dim_ssot.md) — TIME_DIM + atTime() in core/context.ts; never a raw 'time' literal
- [Time-dimension seam](reference_time_dimension_seam.md) — TimeDimensionSpec (ADR R5); fromDim/toDim fold byte-identically via ctx-ref bounds
- [Time-range readiness seam](reference_time_range_readiness_seam.md) — year-select pick:last on live ApiStore; store-builder folds server timeCoverage; 2 core defense guards
- [ApiStore freshness gate](reference_apistore_freshness_gate.md) — 304/ETag conditional-GET; TTL-aware `_cache{rows,expiresAt}`; fresh/stale/miss dispatch
- [Apps/api engine dist consumption](reference_apps_api_engine_dist.md) — apps/api resolves @statdash/engine via DIST not source; rebuild after any core export change
- [Desugar seam](reference_desugar_seam.md) — data/desugar.ts SSOT lowers convenience DataSpecs (ADR R3); only `pivot` desugars today; the R3 gap (val vs obs semantics)
- [Grain / store-port](reference_grain_store_port.md) — valAt port primitive + internal point-series lowering + grain.ts reducer; point-series is deliberately NOT a public discriminant
- [Transform dispatch registry](reference_transform_dispatch_registry.md) — applyStep dispatches only via step-registry; add op = one registerTransformStep line
- [Blend seam](reference_blend_seam.md) — `blend` op = declarative cross-store join front-door for joinByField; B0 core no-op, B1 react resolveBlends (manifest is react-only)
- [Encoding channel enrichment](reference_encoding_channel_enrichment.md) — EncodingChannel = string|ChannelDef{field,type?,key?} (ADR R2)+CtxScopeRef (AR-36); bare string byte-identical
- [Measure-ref seam](reference_measure_ref_seam.md) — resolveMeasureRef (ADR R1) is the SSOT distinguishing raw code vs registered metric-id; never call getMetric directly
- [Metric-store binding](reference_metric_store_binding.md) — MetricDef.dataSource (Cube pattern) → specDataSource → react effectiveStoreKey precedence
- [Calc-metric seam](reference_calc_metric_seam.md) — MetricDef.calc declarative measure-algebra via expr; resolveMetricValue/calcMetricRequirements; KpiValueSpec 'metric' variant
- [KPI visibility surface](reference_kpi_visibility_surface.md) — kpiVisible evaluates `when` against filterParams (not ctx.dims), same surface renderNode uses
- [Ref-dispatch SSOT](reference_ref_dispatch_ssot.md) — resolveRef (ADR R4) is the ONE dispatcher for every $-ref; ctx/param/row/var/dim scopes; expr's ExprRef is a separate lower-layer concern
- [LocaleString brand](reference_localestring_brand.md) — Symbol-brand positive ID of i18n row cells, tagged at the $d join, resolved at the react boundary
- [LocaleString display boundary](reference_localestring_display_boundary.md) — resolveTemplate is the funnel resolving display LocaleString at every render boundary; render-guard fitness
- [Source-kind spectrum](reference_source_kind_spectrum.md) — DatasourceInstanceConfig.kind = values|url|name trichotomy; static+href+stats all registered; OCP kind-dispatch
- [Export registry seam](reference_export_registry_seam.md) — registry is the format SSOT; SerializeFn string|Uint8Array; dep-free STORED-zip xlsx
- [Validate-config seam](reference_validate_config_seam.md) — engine-tier structural floor shared by api+react; node-type registry fail-open + injection-fed
- [Config vocab modules](reference_config_vocab_modules.md) — section.ts split into data-spec/visibility/links/template; barrel preserved
- [Slice-meta export chain](reference_slicemeta_export_chain.md) — a new PropField* type touches 3 barrels + PropSchemaForm's exhaustive FIELD_RENDERERS
- [Panel registration barrels](reference_panel_registration_barrels.md) — a new panel must touch 3 barrels or it silently drops; plugin-META tests must live in packages/plugins (arrow)
- [Plugin i18n + layout](reference_plugin_i18n_layout.md) — plugins have no src/ dir; meta.ts/Node.ts carry bilingual catalog content; tenant-content boundary
- [Defaults-vs-saveGuard contract](reference_defaults_guard_contract.md) — getDefaults must omit optional localized fields / seed required ones complete
- [Tenant-content gates](reference_tenant_content_gates.md) — two gates (vitest ALLOW + bash LAW4_CATALOG_ALLOW twin) must stay in sync for authoring-label catalogs
- [Effects retirement](reference_effects_retirement.md) — Effect/applyEffects/schema.effects deleted wholesale, locked by check-laws grep guard; BRE `\?` pitfall
