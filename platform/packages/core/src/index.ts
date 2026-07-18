// ── @statdash/engine — Public API ──────────────────────────────────────
//
//  Pure TypeScript — zero React, zero side effects, fully testable.
//  Hexagonal Architecture: this is the "core" hexagon (domain + ports).
//
//  Import everything from this single entry point:
//    import { interpretSpec, type DataSpec } from '@statdash/engine'
//
//  Module structure:
//    core/         — error types + SectionContext + primitive types
//    sdmx.ts       — SDMX observation model (ISO 17369, leaf node)
//    data/         — DataStore, DataRow, interpretSpec, transform pipeline
//    field/        — FieldConfig display system (Grafana equivalent)
//    config/       — DataSpec, TableConfig, VisibilityExpr, KpiDef
//    validation/   — self-validating configs (Constructor-facing)
//    registry/     — EngineRegistry, SpecResolver (plugin system)
//

// ── Core ──────────────────────────────────────────────────────────────
export type { EngineErrorCode }                                          from './core/error'
export { EngineError }                                                   from './core/error'
// ── Diagnostic + Result<T> — typed error contract [N17] ───────────────
export type { DiagnosticLevel, Diagnostic, Result }                      from './core/diagnostic'
export { diagError, diagWarning, diagInfo, ok, err }                     from './core/diagnostic'
// ── Provenance — data quality + lineage record [N14] ──────────────────
export type { ObsStatus, ProvenanceRecord, MetadataPort }                from './core/provenance'
export { OBS_STATUS_LABELS }                                             from './core/provenance'
export type { Unit, ChartType, Indicator, SectionContext } from './core/context'
// TIME_DIM — the SSOT key for the conventional time axis. Exported so the
// store-builder (plugins) can fall back to it when a profile's DSD time-dim is
// absent, WITHOUT hardcoding the 'time' literal (Law 1).
export { TIME_DIM, MEASURE_DIM, atTime }                                 from './core/context'
export { groupBySpan }                                                   from './core/layout'
export type { DataLookupOp, DeriveEntry, NodeDeriveMap }                from './core/types'
export { evalNodeDerive }                                                from './core/evalNodeDerive'

// ── Perspective System ────────────────────────────────────────────────
export type { PerspectiveId, PerspectiveOption, PerspectiveContext }     from './perspective/types'
export { perspectiveRegistry }                                           from './perspective/registry'

// ── Perspective Axis [VISION #3] — the generic OLAP query-perspective axis ──────
//  The structural envelope lives in @statdash/contracts (shared by panel/api/core);
//  core REFINES the opaque blobs (when/available → VisibilityExpr, scope → the two
//  registered scope-keys). P0 is purely additive — nothing reads these yet (the
//  ctx-scoping step + axis parser land in P1/P4). A page with no `perspectives`
//  declared touches none of this (byte-identical render, FF-ONE-VIEW-NO-MACHINERY).
export type { PerspectiveScope, PerspectiveDef, PerspectiveAxis,
              PerspectivesByParam, PerspectiveTimeBinding,
              DimBinding, Selection, PerspectiveEffect }                 from './config/perspective-axis'
// Reactive param mutation on a perspective transition (C3 — forward recovery of the
// retired reactive effects, re-homed on onEnter/onExit; pure, reuses perspective-is + ExprVal).
export { applyPerspectiveEffects }                                       from './config/perspective-effects'
//  The scope-key registry — the OCP seam (SYNTHESIS §1.4): every scope door is a
//  registration, not an interface widening. timeBinding + metric registered today;
//  the coverage gate reads listPerspectiveScopeKeys() directly (the 5th axis).
export type { PerspectiveScopeKey }                                      from './config/perspective-scope-registry'
export { registerPerspectiveScopeKey, getPerspectiveScopeKeySchema,
         listPerspectiveScopeKeys }                                      from './config/perspective-scope-registry'
import './config/perspective-scope-schemas' // side-effect: register built-in scope-key authoring schemas (binding, timeBinding, metric)

//  P1 — the active-id SSOT readers + the parser + the ctx-scoping step. The active
//  perspective id flows ONLY through ctx.perspectiveState (HIGH-3); parsePerspectiveAxes
//  yields ONE internal representation (declared `perspectives`, else a legacy
//  scopeCtxByPerspective folds the active perspective's timeBinding into ctx.dims
//  before interpretSpec (the declarative replacement for the retired time-mode).
export { PERSPECTIVE_PARAM, LEGACY_MODE_PARAM, activePerspective }       from './config/perspective-state'
export type { ParsePerspectiveInput, PerspectiveOwnership }             from './config/perspective-axis-parser'
export { parsePerspectiveAxes, activeIdForAxis, scopeCtxByPerspective,
         perspectiveOwnedParamKeys, perspectiveOptions }                from './config/perspective-axis-parser'

// ── Standard 2: SDMX Observation Model (ISO 17369) ───────────────────
export type { DimVal, CtxRef, FilterValue, NeRef, NeCtxRef, Observation, ObsQuery } from './sdmx'

// ── Kimball Classifier — per-dim surrogate-key codelist + hierarchy edges ──
export type { AttrVal, ClassifierEntry, Classifier, ClassifierRef, ClassifierView,
              DisplayMap, DisplayRef, DimRef, DataBundle } from './sdmx'
export { codelistOf, itemsOf, leavesOf, rollupsOf, codesOf,
         childrenOf, depthOf, membersAtDepth, constrainClassifier,
         isClassifierRef, isDisplayRef, isDimRef,
         resolveClassifierRef, resolveDisplayRef, resolveDimRef } from './data/codelist'

// ── Ref taxonomy + one resolution dispatcher [R4] — the SSOT for `$`-refs ──
export type { Ref, RefScope, RefServices, DimViewResult,
              CtxScopeRef, ParamScopeRef, RowScopeRef, VarScopeRef, DimScopeRef } from './ref/ref'
export { REF_SCOPES, refScope, isRef, resolveRef }                                from './ref/ref'

// ── DataSource — universal options/years/chips abstraction ───────────
export type {
  SelectOption, ChipOption,
  StaticSource, QuerySource, InlineSource, RemoteSource,
  SelectFieldMap, ChipFieldMap, YearsFieldMap,
  OptionsSource, ChipSource, YearsSource,
}                                                                        from './data/source'
export { resolveYears, resolveOptions, resolveChips }                    from './data/resolve'

// ── Standard 3: Grammar of Graphics — Vega-Lite Encoding ─────────────
export type { EngineRow, EncodingSpec, DataRow,
              MeasurementType, ChannelDef, EncodingChannel }            from './data/encoding'
export { applyEncoding, channelField, channelType, channelKey,
         deriveMeasurementType, resolveMeasurementType,
         isCtxRef, resolveEncodingRefs }                               from './data/encoding'
export type { FieldMeta, FieldType, FieldRole, FieldSchema }            from './data/fieldSchema'
export { deriveFieldSchema, toFieldMeta, schemasToFieldMeta,
         suggestEncodings }                                            from './data/fieldSchema'
export type { NodeDataFrame }                                           from './data/nodeDataFrame'

// ── Standard 1: Tidy Data + Transform Pipeline ────────────────────────
export type { RawRow, DeriveExpr, TransformStep, PipelineContext }      from './data/transform'
export { applyPipeline, applyStep, resolvePipeRefs, getFormatter, FORMATTERS, fmtNum, compact } from './data/transform'
// Transform-step registry — the Constructor's transform-op catalog (listTransformOps)
// + the plugin extension seam (registerTransformStep). Built-in ops registered via
// the './data/transform' side-effect above.
export type { StepFn, StepCategory }                                    from './data/transform/step-registry'
export { registerTransformStep, getTransformStep, listTransformOps,
         getTransformStepSchema, listTransformOpSchemas,
         getTransformStepCategory, listUncategorizedOps,
         STEP_CATEGORIES, getOpsInCategory, listOpsByCategory }         from './data/transform/step-registry'

// ── FieldConfig — Grafana-equivalent display configuration ────────────
export type { Threshold, ColorMode, FieldOverride, FieldConfig }        from './field/config'
export { formatFieldValue, resolveThresholdColor, resolveFieldConfig }  from './field/utils'

// ── Config Types ──────────────────────────────────────────────────────
export type { KpiDef }                                                   from './config/kpi'
export type {
  ColumnDef,
  RowSpec,
  DataSpec,
  MetricSpec,
  MetricRef,
  PipelineSpec,
  SourceStep,
  PipeStep,
  TableConfig,
  YearsSpec,
  TimeBound,
  TimeRange,
  TimeGranularity,
  TimeDimensionSpec,
}                                                                        from './config/data-spec'
// ── Value mappings — declarative value → {text, token, icon} (Grafana) [EXP-06] ──
//  Token-bound (no literal colour): the `token` is a registered semantic-token KEY
//  resolved through the spine by the react/charts consumer (cssVar), so a mapping
//  re-themes per tenant. `applyValueMap` is the pure first-match-wins resolver. The
//  bilingual authoring schema lives in the panel (apps/panel), not here.
export type { ValueMapping, ValueMappingMatch, ValueMappingResult } from './config/value-mapping'
export { applyValueMap }                                            from './config/value-mapping'
// ── ValueThresholds — declarative numeric-breakpoint → presentation (token-bound) ─
//  The ORDERED-NUMERIC sibling of value mappings: a monotonic step function over one
//  numeric axis (a value takes the HIGHEST breakpoint it reaches). Token-bound (same
//  no-literal-colour discipline); `resolveValueThreshold` is the pure resolver, HONEST
//  — a no-data/masked/non-finite value resolves to null (never colour a fabricated
//  number). Named `ValueThreshold` to disambiguate from the LEGACY chart FieldConfig
//  `Threshold` (literal-hex, line ~118) — convergence to one grammar is flagged debt.
export type { ValueThreshold, ValueThresholdStep, ValueThresholdResult } from './config/threshold'
export { resolveValueThreshold }                                         from './config/threshold'
// ── timeDimension — first-class time normalization seam [ADR R5] ──────
export { resolveTimeDimension, clampToBounds, effectiveBounds, effectiveYears } from './core/time-dimension'
export type { NormalizedTime, LegacyTimeSpec }                          from './core/time-dimension'
export type { VisibilityExpr }              from './config/visibility'
// ── Discriminant manifests — runtime SSOT mirrors for Coverage Fitness #1 ──
//  Compile-time-verified-exhaustive tuples of the authorable union discriminants
//  (DataSpec / ParamDef / VisibilityExpr). The Constructor coverage gate
//  enumerates these (TransformStep ops use listTransformOps()).
export type { DataSpecDiscriminant, ParamDefType, VisibilityOp } from './config/discriminant-manifest'
export { DATASPEC_DISCRIMINANTS, PARAMDEF_TYPES, VISIBILITY_OPS } from './config/discriminant-manifest'
// ── ParamDef authoring-schema registry — the page-level FilterSchema catalog [V0] ──
//  Each ParamDef type CARRIES its authoring PropSchema (OCP), registered via the
//  config/index side-effect. The panel's filterParamSchemaSource resolves a
//  ParamDef through getParamSchema into the SAME generic Inspector — no bespoke
//  per-control form (mirrors getTransformStepSchema for transform steps).
export { registerParamSchema, getParamSchema, listParamSchemas } from './config/param-schema-registry'
import './config/param-schemas' // side-effect: register built-in ParamDef authoring schemas
// ── VisibilityExpr authoring-surface registry — node-level "show when" [V4] ────
//  Each VisibilityExpr op CARRIES its authoring surface (a leaf PropSchema or a
//  composite marker), registered via the visibility-schemas side-effect. The
//  panel's visibilityLeafSchemaSource resolves a leaf op through getVisibilityLeaf
//  Schema into the generic Inspector; the recursive VisibilityBuilder renders
//  composites (and/or/not). Mirrors getParamSchema / getTransformStepSchema.
export type { VisibilityOpKind, VisibilityOpSurface } from './config/visibility-schema-registry'
export {
  registerVisibilityLeafSchema, registerVisibilityComposite,
  getVisibilitySurface, getVisibilityLeafSchema,
  isVisibilityOpAuthorable, listVisibilitySurfaces,
} from './config/visibility-schema-registry'
import './config/visibility-schemas' // side-effect: register built-in VisibilityExpr authoring surfaces
// ── RowSpec authoring-schema registry — `row-list` row entries [V2] ────────────
//  A RowSpec (one entry of a `row-list` DataSpec) CARRIES its authoring PropSchema,
//  registered via the rowspec-schemas side-effect. The panel's rowSpecSchemaSource
//  resolves it through getRowSpecSchema into the SAME generic Inspector — no bespoke
//  per-field form (mirrors getParamSchema / getTransformStepSchema, one rung down).
export { registerRowSpecSchema, getRowSpecSchema, ROW_SPEC_KEY } from './config/rowspec-schema-registry'
import './config/rowspec-schemas' // side-effect: register the built-in RowSpec authoring schema
// ── PropSchema — typed authoring-form vocabulary (Constructor) ─────────
//  Lives in core (not react) because a TransformStep op now CARRIES its own
//  authoring PropSchema (OCP) and core may not import react (the arrow).
//  react/slice-meta re-exports these, so existing import sites are unchanged.
export type {
  PropFieldType, PropFieldSource, PropFieldOption, PropFieldValidation,
  PropField, PropSchema, PropertyGroup, AudiencePlane, FieldConcern,
}                                           from './config/prop-schema'
export type { LinkIconKey, LinkDef }        from './config/links'
// ── Dynamic property binding — literal-OR-expression scalar props (⚡ / `{{ }}`) ──
//  The additive value model: any authorable scalar may be `{ $bind: "<expr>" }`, a
//  serializable expr-string (Law 2) the render pipeline resolves at ONE structural
//  seam against the live scope (filter params · vars · rows). Additive + OCP (Law 8):
//  a prop with no binding is byte-identical. Honest tri-state (Law 11): ok/no-data/error.
export type { Binding, BindState, BindResolution, BindingDiagnostic, ResolveBindingsResult } from './config/binding'
export { isBinding, resolveBinding, resolveBindings }                                        from './config/binding'
export { evalVisibility }                   from './config/visibility'
export { resolveTemplate }                  from './config/template'
export type { PerspectiveCarrier }          from './config/template'

// ── Authoring config-semantics SSOT (P1) — dot-path grammar + showWhen ─────
//  getAtPath/setAtPath: the one dot-path reader/writer (read=write parity, array
//  segments = indices). evalShowWhen: the one PropField.showWhen evaluator.
//  Shared by runner + Constructor; re-exported through @statdash/react/engine.
export { getAtPath, setAtPath }             from './config/prop-path'
export { evalShowWhen }                     from './config/prop-visibility'

// ── Config Schema Versioning [N19 / P3-3] ────────────────────────────
//  Stored page configs carry a `schemaVersion`. migratePageConfig() forward-
//  migrates a raw JSONB blob from its stored version to CURRENT_SCHEMA_VERSION
//  before the renderer sees it (lazy migration on read). registerMigration()
//  is the extension seam: bump CURRENT_SCHEMA_VERSION + register a step.
export type { MigrationFn }                                              from './config/migration'
export { CURRENT_SCHEMA_VERSION, migratePageConfig, isCurrentSchema,
         registerMigration, highestMigrationVersion }                   from './config/migration'

// ── Filter Schema — declarative filter config types + evaluators ──────
export type {
  CascadeNode,
  Condition, WhenMap,
  ValidatorPredicate, Validator, CrossValidator,
  ParamHidden, ParamYearSelect, ParamCascade, ParamSelect,
  ParamRange, ParamMultiSelect, ParamChipSelect, ParamDef,
  BarDef, BarsConfig,
  ContextMapping,
  FilterSchemaInput,
  // NodeDef-based filter types
  BarNode,
  ParamHiddenNode, ParamYearSelectNode, ParamCascadeNode, ParamSelectNode,
  ParamRangeNode, ParamMultiSelectNode, ParamChipSelectNode, ParamNode,
  FilterDerive,
  VarMap,
  FilterBarNode,
  // DefaultSpec — three-tier default value
  OptionsDefault, DefaultSpec,
  // Observability seam
  FilterDeriveObserver,
}                                                                        from './config/filter'
export { evalCondition, evalWhen, evalValidatorPredicate, validators,
         autoParse, toCtxValue, isVisible, isEnabled,
         validateField, applyCrossValidation,
         evalFilterDerive, setFilterDeriveObserver,
         resolveDefaults, validateCascadeValues }                        from './config/filter'

// ── Repository Pattern — DataStore ────────────────────────────────────
export type { DataStore, Requirement, StoreQuery, StoreCaps,
              QueryResult, ResultMeta, Unsubscribe, GrainLevel, RollupOp } from './data/store'
export { staticStore, storeVal, storeValAt, storeObs, storeSchema, runBatch, asyncFromSync } from './data/store'
// ── The honest value envelope — AR-52 / Law 11 (the canvas never lies) ─────────
export type { Cell, ValueState }                                       from './data/cell'
export { storeCell, obsAtCoord, obsStatusOf }                          from './data/cell'
export { rollupValues }                                                from './data/grain'
export type { ExternalStoreOptions }                                   from './data/store-impl'
export { ExternalStore, CachedStore }                                  from './data/store-impl'
export type { RawObsRow }                                              from './data/store-api'
export { ApiStore }                                                    from './data/store-api'
export type { DatasourceInstanceConfig }                                from './data/datasource'
export type {
  SourceMetadata, SourceMetadataDimension, SourceMetadataMeasure, SourceTestResult,
}                                                                       from './data/datasource'
export type { AggOp, AggregationRule }                                  from './data/aggregate'
export { groupAggregate }                                               from './data/aggregate'

// ── Validation Pipeline ───────────────────────────────────────────────
export type {
  ValidationSeverity,
  ValidationCode,
  ValidationError,
  ValidationResult,
}                                                                        from './validation/types'
export { validateDataSpec }                                             from './validation/pipeline'
// ── Structural config validator — wire-contract floor (P-1, ADR §7) ───
//  The SAME structural validator apps/api (save) + packages/react (render)
//  share. Returns ValidationError[] ([] === valid); never throws.
export type { StructuralNode, StructuralPageConfig }                    from './validation/config'
export { validateConfig }                                              from './validation/config'
// ── Shared accept/reject corpus (fitness F1 SSOT, ADR §7.8) ────────────
//  The labelled VALID/INVALID config corpus. Exported from the engine so the
//  apps/api save-guard contract test and the react pre-render gate reuse the
//  SAME samples that pin validateConfig here — one corpus, three faces, no
//  copy-drift (they all run one validator).
export type { ValidCase, InvalidCase }                                 from './validation/config-corpus'
export { VALID_CONFIGS, INVALID_CONFIGS, CORPUS_KNOWN_TYPES,
         corpusAllTypes }                                              from './validation/config-corpus'

// ── Registry — Strategy + Plugin Pattern ─────────────────────────────
export type { SpecResolver }                                           from './registry/engine'
export { EngineRegistry, defaultRegistry }                             from './registry/engine'
// ── Node-type registry — derived placeable-type SET (ADR §7.3) ────────
//  Fail-open when empty; populated at startup by react's register-all so
//  validateConfig can enforce `type ∈ known set`. Core holds NO hardcoded list.
export { registerNodeType, knownNodeTypes, hasNodeType,
         _resetNodeTypes }                                             from './registry/nodeTypes'
export type { DiagnosticObserver }                                     from './registry/diagnostics'
export { setDiagnosticObserver, emitDiagnostic }                       from './registry/diagnostics'

// ── Scope Override — per-panel context override + merge [N37] ────────
export type { ScopeOverride }                                           from './data/scopeOverride'
export { mergeScope }                                                   from './data/mergeScope'

// ── Reactive query graph [AR-49 / ADR-024] — the config → dependency SSOT ──────
//  extractDeps is the pure, framework-free static analyzer that computes the TOTAL
//  dependency (edge) set of one renderable — generalising specDimKey + varsKey +
//  the storeKey cascade + the AR-36 ref scanner + locale + collectRequirements into
//  ONE mechanism. It COMPUTES deps here (V1); the reactive graph (V2) compiles from
//  it, the render switch (V3) consumes it. Reversible: delete src/graph/ to revert.
export type { NodeDeps, DepScanCtx, DepNode }                          from './graph/extractDeps'
export { extractDeps }                                                 from './graph/extractDeps'
// V2 (shadow-mode): the reactive query-graph engine + config compiler + the shared
// core node-walker (consolidated here from packages/react so compilePage is arrow-clean;
// the react target re-exports these). SHADOW-ONLY — nothing renders from the graph yet.
export type { Equals }                                                 from './graph/engine'
export { ReactiveGraph, deepEqual }                                    from './graph/engine'
export type { GraphState, DeriveFn, QueryGraph, CompileOptions }       from './graph/compilePage'
export { compilePage, depsToSources, diffState, SRC }                  from './graph/compilePage'
export type { GenericNode, WalkedNode }                                from './graph/nodeWalk'
export { isNodeObject, collectChildNodes, collectNodesDeep, DATA_CARRYING_KEYS } from './graph/nodeWalk'
export type { ShadowStep, ShadowTransition, ShadowReport }             from './graph/shadow'
export { runShadowParity }                                             from './graph/shadow'

// ── Core Resolvers ────────────────────────────────────────────────────
export type { SpecResolveObserver }                                     from './data/spec'
export { interpretSpec, extractRequirements, setSpecResolveObserver }  from './data/spec'
// GAP 4 — the SSOT obs-query the QueryResolver read issues; the async warm path
// (useNodeRows) fetches under this IDENTICAL query so warm-key ≡ read-key.
export { queryReadObs }                                                 from './registry/resolvers'
// ADR-046 Addendum 2 — the obs query a pipeline `source` head reads/warms (steward query
// OR the governed grain-∅ BROWSE); the async warm (useNodeRows) aligns its key to this SSOT.
export { sourceHeadObs }                                                from './registry/pipeline-resolver'
export { desugar, desugarToPipeline }                                   from './data/desugar'
export { applySelection, splitRangeValue }                              from './data/applySelection'
export type { SelectionMode }                                           from './data/applySelection'
// ── Directional cross-filter-pivot LAW [AR-42 P2] — the six AR-38 derives, once ──
//  ONE declared, dimension-blind relation (`{op:'directional', focus, co, priority,
//  emit:'axis'}`) that RETURNS the encoding-axis assignment the six hand-authored
//  `op:if` derives produced. resolveMultiVar is the evalVarMap front-door: a var whose
//  expr emits MULTIPLE named outputs (spread into the derived scope), else null.
export type { DirectionalSpec, DirectionalAxis }                        from './data/directional'
export { resolveDirectional, resolveMultiVar, isDirectionalSpec }       from './data/directional'
export { splitMultiValue }                                              from './data/store-filter'
export { interpretKpis, extractKpiRequirements }                        from './data/kpi'
export type { KpiSpec, KpiValueSpec, KpiTrendSpec, DimFilter, DimFilterRef } from './data/kpi'
// Featured collection (AR-40) — curated headline items lowered to point KpiSpecs
// + interpreted by interpretKpi (reuse, not a parallel resolver). The react hook
// (useFeaturedRows) supplies the per-item FeaturedStoreResolver.
export { interpretFeatured, extractFeaturedRequirements, featuredToKpiSpec }  from './data/featured'
export type { FeaturedItemSpec, FeaturedSlideDef, FeaturedStoreResolver, FeaturedRequirement } from './data/featured'

// ── Metric registry [N26] — Constructor metric vocabulary + extension seam ──
export type { MetricDef, ResolvedMeasure, MetricInput, MetricCalc, MetricAgg,
         Additivity, SemiAdditiveRule, RelativeCoord }                from './data/metric'
export { registerMetric, registerMetrics, getMetric, listMetrics, listMetricDefs,
         resolveMeasureRef, mergeMetricDims, withMetricProvenance,
         METRIC_AGG_VALUES, ADDITIVITY_VALUES,
         effectiveAdditivity, defaultAdditivity, isRelativeCoord }    from './data/metric'
export { resolveMetricValue, calcMetricRequirements, isCalculatedMetric } from './data/metric-calc'
// ── Relative member navigation [ADR-045] — MDX Lag/ParallelPeriod over an ordered dim ──
export { orderedMembers, navigateRelative, resolveRelativeAt }        from './data/relative-coord'
// ── Measure algebra at grain [AR-50 M2] — the grain-polymorphic evaluator ──
//  evalCalcAtGrain generalizes a calc metric from scalar (grain-∅, byte-identical
//  to resolveMetricValue) to any grain via align-join + per-row Expr eval. The
//  additivity model is CONSUMED here: guardNoSumOfRatio is the FF-NO-SUM-OF-RATIO
//  gate; rollupForAxis is the DAX semi-additive per-axis reducer selection.
//  evalMeasureAtGrain is the COMPLETE "any governed measure at grain" entry (calc via
//  evalCalcAtGrain, base via the same align machinery) — the seam the `metric` DataSpec
//  (AR-50 M-SQ) lowers onto.
export { evalCalcAtGrain, evalMeasureAtGrain, guardNoSumOfRatio, rollupForAxis, isSummingOp,
         NonAdditiveSumError }                                        from './data/metric-grain'
// ── Dimension registry [AR-49 / M0] — the governed-dimension PEER of metric ──
//  Law 1: dimensions are equal citizens of the semantic layer. A thin curation
//  (governed label / conceptRole / default / whitelist) over the cube-profile
//  dimension; members resolve FROM the DSD at runtime (Law 5), never copied here.
//  Delivered exactly like metrics (registerDimensions ← manifest.dimensions).
export type { DimensionDef, DimensionHierarchy, HierarchyLevel } from './data/dimension'
export { registerDimension, registerDimensions, getDimension, listDimensions,
         listDimensionDefs }    from './data/dimension'
// ── Dimension-hierarchy drill seam [ADR-034 S4] — the AR-40/50 ⟷ AR-42 bridge ──
//  A declared drill (DrillTarget) along a governed hierarchy, lowered onto the M2
//  measure-at-grain SSOT: additivity-respecting re-aggregation, member set REIFIED
//  from the SDMX codelist parent edges (Law 5). No new query path — composes
//  evalMeasureAtGrain per reified coordinate. Generic axis (Law 1), declarative (Law 2).
export type { DrillTarget }     from './data/drill'
export { drillAxis, reifyLevelMembers, evalMetricDrill, reifyHierarchy } from './data/drill'
// ── manifest → registry boot seam — the wire→engine refinement, one platform SSOT ──
//  registerManifestMetrics/registerManifestDimensions refine the zero-dep wire
//  shapes (ManifestMetric/ManifestDimension) into MetricDef/DimensionDef and prime
//  the registries. Reused by EVERY boot (the geostat runner, the Constructor's
//  authoring boot) — not a per-app fork (Law 8 / DRY).
export { registerManifestMetrics, registerManifestDimensions }         from './data/manifest-catalog'
// metric→store binding [M1] — the Cube.dev `dataSource` middle tier. A node's
// DataSpec → the storeKey its referenced metric names (plain string; react's
// resolveStore consumes it, no core→react import — arrow clean).
export { specDataSource, specMeasureRefs }                             from './data/metric-store'

// ── Export formats [N16] — registry + built-ins (csv, sdmx-json) ──────
//  Re-exporting the barrel also runs its side-effect: the csv / sdmx-json
//  formats register themselves on import, so listExportFormats() is non-empty.
export type { ExportMeta, ExportProvenance, SerializeFn, ExportFormat, ExportFormatId } from './data/export'
export type { ProvenanceLine }                                         from './data/export'
export { registerExport, getExportFormat, listExportFormats }          from './data/export'
export { provenanceLines, deriveExportProvenance }                     from './data/export'

// ── DataLinks — declarative drill-down / navigation ───────────────────
export type { DataLinkDef, DataLinkParam, ResolvedLink }                from './links'
export { resolveDataLinks }                                              from './links'

// ── I18n Primitives ───────────────────────────────────────────────────
export type { LocaleString }                                             from './i18n/types'
export { resolveLocaleString, resolveLabel, tagLocaleString, isTaggedLocaleString, composeLocale, localeKeysOf } from './i18n/types'
export type { LocaleFormatter }                                          from './i18n/format'
export { formatterRegistry }                                             from './i18n/format'

// ── Spec Capability Catalog — Self-Describing Module (Panel / Constructor) ─
export type { SpecField, SpecDescriptor }  from './spec-catalog'
export { SPEC_CATALOG }                    from './spec-catalog'

// ── FilterDerive ops → @statdash/expr plugin registration ─────────────
//
//  FilterDerive ops (find, breadcrumbs, join-labels, …) are domain-specific.
//  Registering them here keeps @statdash/expr zero-dep while making them
//  available in any VarMap evaluated via evalExpr().
//  scope.ctx carries { classifiers, display, raw } injected by SiteRenderer.
//
import { registerExprOp }  from '@statdash/expr'
import type { ExprScope }  from '@statdash/expr'
import type { FilterDerive, DeriveContext } from './config/filter'
import { evalFilterDerive } from './config/filter'

type _SiteCtx = { classifiers?: DeriveContext['classifiers']; display?: DeriveContext['display']; raw?: Record<string, string>; locale?: string; fallback?: string }

const _FILTER_DERIVE_OPS = ['lookup', 'find', 'tree-field', 'if-else', 'breadcrumbs', 'contains', 'join-labels'] as const

for (const op of _FILTER_DERIVE_OPS) {
  registerExprOp(op, (expr: Record<string, unknown>, scope: ExprScope): unknown => {
    const siteCtx = scope.ctx as _SiteCtx | undefined
    return evalFilterDerive(
      expr as unknown as FilterDerive,
      scope.dims,
      siteCtx?.raw ?? {},
      { classifiers: siteCtx?.classifiers, display: siteCtx?.display, locale: siteCtx?.locale, fallback: siteCtx?.fallback },
    )
  })
}
