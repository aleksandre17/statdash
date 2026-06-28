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
export { TIME_DIM, atTime }                                              from './core/context'
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
              PerspectivesByParam, PerspectiveTimeBinding }              from './config/perspective-axis'
//  The scope-key registry — the OCP seam (SYNTHESIS §1.4): every scope door is a
//  registration, not an interface widening. timeBinding + metric registered today;
//  the coverage gate reads listPerspectiveScopeKeys() directly (the 5th axis).
export type { PerspectiveScopeKey }                                      from './config/perspective-scope-registry'
export { registerPerspectiveScopeKey, getPerspectiveScopeKeySchema,
         listPerspectiveScopeKeys }                                      from './config/perspective-scope-registry'
import './config/perspective-scope-schemas' // side-effect: register built-in scope-key authoring schemas (timeBinding, metric)

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
         deriveMeasurementType, resolveMeasurementType }               from './data/encoding'
export type { FieldMeta, FieldType, FieldRole, FieldSchema }            from './data/fieldSchema'
export { deriveFieldSchema, toFieldMeta, schemasToFieldMeta,
         suggestEncodings }                                            from './data/fieldSchema'
export type { NodeDataFrame }                                           from './data/nodeDataFrame'

// ── Standard 1: Tidy Data + Transform Pipeline ────────────────────────
export type { RawRow, DeriveExpr, TransformStep, PipelineContext }      from './data/transform'
export { applyPipeline, applyStep, getFormatter, FORMATTERS, fmtNum }   from './data/transform'
// Transform-step registry — the Constructor's transform-op catalog (listTransformOps)
// + the plugin extension seam (registerTransformStep). Built-in ops registered via
// the './data/transform' side-effect above.
export type { StepFn }                                                  from './data/transform/step-registry'
export { registerTransformStep, getTransformStep, listTransformOps,
         getTransformStepSchema, listTransformOpSchemas }              from './data/transform/step-registry'

// ── FieldConfig — Grafana-equivalent display configuration ────────────
export type { Threshold, ColorMode, FieldOverride, FieldConfig }        from './field/config'
export { formatFieldValue, resolveThresholdColor, resolveFieldConfig }  from './field/utils'

// ── Config Types ──────────────────────────────────────────────────────
export type { KpiDef }                                                   from './config/kpi'
export type {
  ColumnDef,
  RowSpec,
  DataSpec,
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
  PropField, PropSchema, PropertyGroup,
}                                           from './config/prop-schema'
export type { LinkIconKey, LinkDef }        from './config/links'
export { evalVisibility }                   from './config/visibility'
export { resolveTemplate }                  from './config/template'

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
         autoParse, isVisible, isEnabled,
         validateField, applyCrossValidation,
         evalFilterDerive, setFilterDeriveObserver,
         resolveDefaults, validateCascadeValues }                        from './config/filter'

// ── Repository Pattern — DataStore ────────────────────────────────────
export type { DataStore, Requirement, StoreQuery, StoreCaps,
              QueryResult, ResultMeta, Unsubscribe, GrainLevel, RollupOp } from './data/store'
export { staticStore, storeVal, storeValAt, storeObs, storeSchema, runBatch, asyncFromSync } from './data/store'
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

// ── Core Resolvers ────────────────────────────────────────────────────
export type { SpecResolveObserver }                                     from './data/spec'
export { interpretSpec, extractRequirements, setSpecResolveObserver }  from './data/spec'
// GAP 4 — the SSOT obs-query the QueryResolver read issues; the async warm path
// (useNodeRows) fetches under this IDENTICAL query so warm-key ≡ read-key.
export { queryReadObs }                                                 from './registry/resolvers'
export { desugar }                                                      from './data/desugar'
export { interpretKpis, extractKpiRequirements }                        from './data/kpi'
export type { KpiSpec, KpiValueSpec, KpiTrendSpec }                     from './data/kpi'

// ── Metric registry [N26] — Constructor metric vocabulary + extension seam ──
export type { MetricDef, ResolvedMeasure, MetricInput, MetricCalc }    from './data/metric'
export { registerMetric, registerMetrics, getMetric, listMetrics, listMetricDefs,
         resolveMeasureRef, withMetricProvenance }                     from './data/metric'
export { resolveMetricValue, calcMetricRequirements, isCalculatedMetric } from './data/metric-calc'
// metric→store binding [M1] — the Cube.dev `dataSource` middle tier. A node's
// DataSpec → the storeKey its referenced metric names (plain string; react's
// resolveStore consumes it, no core→react import — arrow clean).
export { specDataSource, specMeasureRefs }                             from './data/metric-store'

// ── Export formats [N16] — registry + built-ins (csv, sdmx-json) ──────
//  Re-exporting the barrel also runs its side-effect: the csv / sdmx-json
//  formats register themselves on import, so listExportFormats() is non-empty.
export type { ExportMeta, SerializeFn, ExportFormat, ExportFormatId }   from './data/export'
export { registerExport, getExportFormat, listExportFormats }          from './data/export'

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

type _SiteCtx = { classifiers?: DeriveContext['classifiers']; display?: DeriveContext['display']; raw?: Record<string, string> }

const _FILTER_DERIVE_OPS = ['lookup', 'find', 'tree-field', 'if-else', 'breadcrumbs', 'contains', 'join-labels'] as const

for (const op of _FILTER_DERIVE_OPS) {
  registerExprOp(op, (expr: Record<string, unknown>, scope: ExprScope): unknown => {
    const siteCtx = scope.ctx as _SiteCtx | undefined
    return evalFilterDerive(
      expr as unknown as FilterDerive,
      scope.dims,
      siteCtx?.raw ?? {},
      { classifiers: siteCtx?.classifiers, display: siteCtx?.display },
    )
  })
}