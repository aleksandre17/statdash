# Memory Index

## Feedback — corrections & validated approaches
- [Class-M hook protocol](feedback_class_m_hook.md) — public `@statdash/engine` API edit → run degradation-risk assessment; a repeated Opus-blessed seam needs no re-escalation
- [Shared-tree concurrency](feedback_shared_tree_concurrency.md) — tree is shared with concurrent agents; never `git stash -u`; diagnose via `git status`/`git diff <file>` first
- [Worktree vitest hoisted](feedback_worktree_vitest_hoisted.md) — worktree/Windows pnpm pitfalls pointer + Vitest 4 ignores `vitest.workspace.ts` (config lives in `vitest.config.ts`)
- [Write tool byte-fidelity](feedback_write_tool_byte_fidelity.md) — Write silently normalizes exotic whitespace (e.g. NBSP) when retyping from memory; use Edit or verify byte-identity
- [Reversible-expansion parity](feedback_reversible_expansion_parity.md) — prove a core generalization safe via byte-identical parity of the narrow path first; single-dialect + arrow + Law-1 grain are hard gates

## Reference — core data/time/metric seams
- [Cell honest-state seam](reference_cell_honest_state_seam.md) — Cell/ValueState + storeCell/storeCellAt; no-data≠genuine-0 via obs-scan; ADR-047 Wave B = coalesce
- [Time seam](reference_time_seam.md) — TIME_DIM/atTime SSOT + timeDimension config feature (ADR R5) + async-store year-select readiness fix, consolidated
- [Metric-natural seam (ADR-047 A)](reference_metric_natural_seam.md) — closes calc-browse foreign-pin lie; naturality DERIVED from obs, never declared; `''` neutralizes a foreign pin
- [Metric-store binding](reference_metric_store_binding.md) — MetricDef.dataSource (Cube pattern) → specDataSource → react effectiveStoreKey precedence
- [Measure-ref seam](reference_measure_ref_seam.md) — resolveMeasureRef (ADR R1) is the SSOT distinguishing raw code vs registered metric-id; never call getMetric directly
- [Wire measure-pin](reference_wire_measure_pin.md) — measurePin() unifies val+obs MEASURE_DIM wire pin; closes AR-38 obs-arm measure-drop (0104); FF-QUERY-RENDER-TRUTH is the truth gate
- [Calc-metric seam](reference_calc_metric_seam.md) — MetricDef.calc declarative measure-algebra via expr; resolveMetricValue/calcMetricRequirements; KpiValueSpec 'metric' variant
- [Relative-coord seam (ADR-045)](reference_relative_coord_seam.md) — `{$prev:n}` MDX-Lag over ordered members; honest first-period edge (→null); obs-scan member enum
- [Hierarchy drill seam](reference_hierarchy_drill_seam.md) — ADR-034 §8 S4: DimensionDef.hierarchy + data/drill.ts; reifies codelist parent edges; composes evalMeasureAtGrain
- [Grain / store-port](reference_grain_store_port.md) — valAt port primitive + point-series lowering + grain.ts reducer; point-series deliberately NOT a public discriminant
- [Desugar seam](reference_desugar_seam.md) — data/desugar.ts SSOT lowers convenience DataSpecs (ADR R3); pivot desugars today; R3 gap = val vs obs semantics
- [Transform dispatch registry](reference_transform_dispatch_registry.md) — applyStep dispatches only via step-registry; add op = one registerTransformStep line
- [extractDeps seam](reference_extractdeps_seam.md) — config→dependency SSOT (ADR-024); NodeDeps buckets + classification rules (literal-pin≠edge, $ctx scope split)
- [Encoding channel enrichment](reference_encoding_channel_enrichment.md) — EncodingChannel = string|ChannelDef{field,type?,key?} (ADR R2)+CtxScopeRef (AR-36); bare string byte-identical
- [Blend seam](reference_blend_seam.md) — `blend` op = declarative cross-store join front-door for joinByField; B0 core no-op, B1 react resolveBlends
- [Source-kind spectrum](reference_source_kind_spectrum.md) — DatasourceInstanceConfig.kind = values|url|name trichotomy; static+href+stats all registered; OCP kind-dispatch
- [DataSpec authoring-contract (ADR-049 P1)](reference_dataspec_authoring_contract.md) — SPEC_CATALOG stub→contract (make()+schema/editorKey); binding-axis port; DataSpecEditor switch-free
- [Ref-dispatch SSOT](reference_ref_dispatch_ssot.md) — resolveRef (ADR R4) is the ONE dispatcher for every $-ref; ctx/param/row/var/dim scopes
- [LocaleString seam](reference_localestring_seam.md) — row-cell Symbol brand (positive ID at $d join) + resolveTemplate display funnel, consolidated
- [KPI visibility surface](reference_kpi_visibility_surface.md) — kpiVisible evaluates `when` against filterParams (not ctx.dims), same surface renderNode uses
- [Always-resolve seam](reference_alwaysresolve_seam.md) — ParamHidden.alwaysResolve hoists a default out of the perspective-ownership gate
- [No-privileged-literal guard](reference_no_privileged_literal_guard.md) — FF-NO-PRIVILEGED-LITERAL scans registry/**; forbids privileged-dim + `<x>Color/<x>Label`; `measure` field exempt
- [ObjectMeta one type system](reference_object_meta_one_type_system.md) — ADR-023 R1: ObjectMeta base + kind-as-facet refinements; objectRegistry one discovery registry
- [Fail-soft interpret guard](reference_failsoft_interpret_guard.md) — per-node interpreters tolerate absent optional input `?? []`, never hard-throw into NodeErrorBoundary

## Reference — config/export/validation
- [Validate-config seam](reference_validate_config_seam.md) — engine-tier structural floor shared by api+react; node-type registry fail-open + injection-fed
- [Config vocab modules](reference_config_vocab_modules.md) — section.ts split into data-spec/visibility/links/template; barrel preserved
- [Defaults-vs-saveGuard contract](reference_defaults_guard_contract.md) — getDefaults must omit optional localized fields / seed required ones complete
- [Export registry seam](reference_export_registry_seam.md) — registry is the export-format SSOT; SerializeFn string|Uint8Array; dep-free STORED-zip xlsx
- [Slice-meta export chain](reference_slicemeta_export_chain.md) — a new PropField* type touches 3 barrels + PropSchemaForm's exhaustive FIELD_RENDERERS
- [Effects retirement](reference_effects_retirement.md) — Effect/applyEffects/schema.effects deleted wholesale, locked by check-laws grep guard; BRE `\?` pitfall

## Reference — app/store boundary + panel/plugin conventions
- [FetchScheduler coalescing](reference_fetch_scheduler_coalesce.md) — in-flight single-flight (0111) ON TOP of ADR-048 queue; stats-api getAt routes through scheduleFetch = the ~18× classifier collapse
- [ApiStore freshness gate](reference_apistore_freshness_gate.md) — 304/ETag conditional-GET; TTL-aware `_cache{rows,expiresAt}`; fresh/stale/miss dispatch
- [Apps/api engine dist consumption](reference_apps_api_engine_dist.md) — apps/api resolves @statdash/engine via DIST not source; rebuild after any core export change
- [Panel/plugin conventions](reference_panel_plugin_conventions.md) — 3-barrel panel registration + plugin layout/i18n boundary (2 sync'd gates) + offline e2e bridge, consolidated

## Reference — semantic-layer pointers
- [Semantic-layer proposals](ref_semantic_layer_proposals.md) — where the erosion catalog + AR-50 design studies + ADR-034 live

## Project — initiatives
- [Pipeline track (ADR-046)](project_pipeline_track.md) — query/transform/pivot/timeseries fold onto the spine; growth/ratio-list/row-list deferred (architect-owned); the "5 traversals" lesson for any new SourceStep variant
- [AR-50 semantic-layer](project_ar50_semantic_layer.md) — E1/E2 DONE (one dialect+agg vocab); ⛔ growth/ratio-list one-way-door held; open findings: additivity guard path-dependent, no lineage graph edge, metric DataSpec near-zero consumers
- [Part-grammar track (ADR-041/042)](project_part_grammar_track.md) — containment (wrapper/leaf derived, kind-as-containment retired) + placePart manipulation port, consolidated
- [Reactive graph track (ADR-024)](project_reactive_graph_track.md) — V0/V1/V2/V2.5 SHIPPED (extractDeps + shadow graph); Findings A/B CLOSED → parity EXACT; V3 render-switch UNBLOCKED, not fired
- [S6 chrome reversible landed](project_s6_chrome_reversible_landed.md) — chrome=sourced Part of site-frame; EXPAND + the one-way FOLD (selection arm 2→1) both landed green
- [TM-STRANGLER time-binding](project_tm_strangler.md) — DimBinding+Selection discriminant replaces shape-inferred timeBinding; generic TimeGranularity; FF-NO-MODE-LITERAL twin
- [Perspective-axis refactor](project_perspective_axis.md) — timeMode/mode → generic perspective axis (SHIPPED, grep-clean); 5 recurring hazard classes for any future per-mode design
- [AR-36 pivot](project_ar36_pivot.md) — P0 EncodingChannel CtxRef seam + P1-P3 state-bound aggregate.by/chartType fold facts
- [AR-49 M0 dimension catalog](project_ar49_m0_dimension_catalog.md) — DimensionDef governed-dim registry (peer of metric), manifest.dimensions, describeApp 1.1.0; mergeMetricDims KPI-parity fix
- [AR-40 P0 semantic-layer spine](project_ar40_p0_spine.md) — KPI render+preliminary made metric-aware; the 3-paths-read-a-measure-ref bug; gdp-total KPI migrated to metric-id
- [CLUSTER② Law-1 + inert seams](project_cluster2_law1_seams.md) — GrowthResolver privileged-literal fix (use TIME_DIM for obs-meta reads); AD-6 `available` gate; GRAIN-G4 granularity→grain
- [Adoption epic (X-2)](project_adoption_epic.md) — all 4 Acts done; Act 1's cross-workstream metric-delivery gap resolved later by AR-40 P0
- [Async store ACL parity](project_async_store_acl_parity.md) — stats adapter contract: LocaleString classifier labels, obs Number coercion, display overlay, warm-key≡read-key seam
- [Canonical workbook parser](project_canonical_parser.md) — ADR-0031 xlsx→bronze deserializer; DSD SSOT = STRUCTURE.dimensions; xlsx ACL-confined to apps/api
- [Preliminary-badge year-aware fix](project_preliminary_displayed_slice.md) — badge must derive from the DISPLAYED obs slice, not dataset-wide; applyEncoding now carries obsStatus
- [Panel StyleSurface gate flake](project_gate_panel_flake.md) — full-graph `pnpm test` can false-RED on a panel StyleSurface timeout; verify heavy panel React tests in isolation
